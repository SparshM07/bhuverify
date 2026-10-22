import os
import hashlib
import json
import logging
import math
from difflib import SequenceMatcher
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session

from backend.app.models.entities import Document, LandRecord, FieldEvidence, VerificationCheck, AuditEvent
from backend.app.providers.base import VerificationProvider, DemoRegistryProvider, _normalize_id

logger = logging.getLogger(__name__)

def _string_similarity(a: str, b: str) -> float:
    """Calculate string similarity ratio between 0.0 and 1.0."""
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def _extract_name_tokens(name_str: str) -> List[str]:
    """Extract individual name tokens, separating Hindi and English components if combined."""
    # E.g. "रमेश कुमार (Ramesh Kumar)" -> tokens
    import re
    cleaned = re.sub(r"[()\[\]/\\,]", " ", name_str)
    return [t.strip().lower() for t in cleaned.split() if t.strip()]


class ValidationEngine:
    """
    Multi-layered validation engine implementing cadastral integrity,
    cryptographic file verification, external registry cross-referencing,
    and human review governance.
    """

    def __init__(self, provider: Optional[VerificationProvider] = None):
        self.provider = provider or DemoRegistryProvider()

    def run_all_checks(self, db: Session, document: Document) -> List[VerificationCheck]:
        """
        Executes all validation checks across the three primary layers:
        1. File Integrity (SHA-256 recomputation, duplicate detection)
        2. Demo Registry Match (official source match, exact ID mismatch, name spelling, impossible area, missing fields)
        3. Human Review (version history, manual correction audit status)

        Returns list of newly constructed VerificationCheck entity objects.
        """
        checks: List[VerificationCheck] = []

        # =========================================================================
        # LAYER 1: FILE INTEGRITY
        # =========================================================================
        # 1.1 SHA-256 Hash Recomputation (Tamper Detection)
        recompute_check = self._check_file_tamper(document)
        checks.append(recompute_check)

        # 1.2 Duplicate Hash Ledger Check
        dup_check = self._check_duplicate_hash(db, document)
        checks.append(dup_check)

        # =========================================================================
        # LAYER 2: REGISTRY MATCH & CADASTRAL VALIDATION
        # =========================================================================
        land_record = document.land_record

        # 2.1 Required Cadastral Fields Check
        req_check = self._check_required_fields(document, land_record)
        checks.append(req_check)

        # 2.2 Impossible Area Values Check
        area_check = self._check_area_values(land_record)
        checks.append(area_check)

        # 2.3 Official / Demo Registry Cross-Reference
        registry_checks = self._check_registry_match(document, land_record)
        checks.extend(registry_checks)

        # =========================================================================
        # LAYER 3: HUMAN REVIEW GOVERNANCE
        # =========================================================================
        review_check = self._check_human_review_status(land_record)
        checks.append(review_check)

        # Associate document_id
        for c in checks:
            c.document_id = document.id

        return checks

    # -------------------------------------------------------------------------
    # Layer 1 Helpers
    # -------------------------------------------------------------------------
    def _check_file_tamper(self, document: Document) -> VerificationCheck:
        """Recompute file SHA-256 from disk and compare to stored checksum."""
        file_path = document.file_path
        if not file_path or not os.path.exists(file_path):
            return VerificationCheck(
                layer="file_integrity",
                check_type="file_hash_integrity",
                source_name="File System Storage",
                status="failed",
                label="File Tampered / Missing On Disk",
                details=json.dumps({
                    "error": "Physical document file not found at registered storage path",
                    "file_path": file_path,
                    "tampered": True
                })
            )

        try:
            sha256 = hashlib.sha256()
            with open(file_path, "rb") as f:
                while chunk := f.read(65536):
                    sha256.update(chunk)
            recomputed_hash = sha256.hexdigest()

            if recomputed_hash.lower() != document.sha256_hash.lower():
                return VerificationCheck(
                    layer="file_integrity",
                    check_type="file_hash_integrity",
                    source_name="SHA-256 Checksum",
                    status="failed",
                    label="File Tampered / Integrity Mismatch",
                    details=json.dumps({
                        "expected_hash": document.sha256_hash,
                        "observed_hash": recomputed_hash,
                        "tampered": True,
                        "message": "Physical file content has been altered or tampered with since initial ingestion."
                    })
                )
            else:
                return VerificationCheck(
                    layer="file_integrity",
                    check_type="file_hash_integrity",
                    source_name="SHA-256 Checksum",
                    status="passed",
                    label="File Integrity Verified (SHA-256 Match)",
                    details=json.dumps({
                        "sha256_hash": recomputed_hash,
                        "status": "intact",
                        "message": "Cryptographic digest matches exact ingestion signature."
                    })
                )
        except Exception as e:
            return VerificationCheck(
                layer="file_integrity",
                check_type="file_hash_integrity",
                source_name="SHA-256 Checksum",
                status="failed",
                label="File Tampered / Read Error",
                details=json.dumps({"error": str(e), "tampered": True})
            )

    def _check_duplicate_hash(self, db: Session, document: Document) -> VerificationCheck:
        """Check if identical file hash has already been registered in the database."""
        duplicates = db.query(Document).filter(
            Document.sha256_hash == document.sha256_hash,
            Document.id != document.id
        ).all()

        if duplicates:
            dup_info = [{"id": d.id, "filename": d.filename, "created_at": d.created_at.isoformat()} for d in duplicates]
            return VerificationCheck(
                layer="file_integrity",
                check_type="duplicate_hash",
                source_name="Document Ledger",
                status="warning",
                label="Duplicate File Hash Detected",
                details=json.dumps({
                    "duplicate_count": len(duplicates),
                    "duplicates": dup_info,
                    "message": f"Identical file content detected across {len(duplicates)} other document(s)."
                })
            )
        else:
            return VerificationCheck(
                layer="file_integrity",
                check_type="duplicate_hash",
                source_name="Document Ledger",
                status="passed",
                label="Unique File Hash (No Duplicates)",
                details=json.dumps({
                    "sha256_hash": document.sha256_hash,
                    "is_unique": True,
                    "message": "Zero hash collisions in database ledger."
                })
            )

    # -------------------------------------------------------------------------
    # Layer 2 Helpers
    # -------------------------------------------------------------------------
    def _check_required_fields(self, document: Document, land_record: Optional[LandRecord]) -> VerificationCheck:
        """Verify presence of core required cadastral fields."""
        required_fields = ["owner_name", "khata_no", "khasra_gata_no", "area", "village"]
        missing = []

        if not land_record:
            missing = required_fields
        else:
            for field in required_fields:
                val = getattr(land_record, field, None)
                if val is None or str(val).strip() == "":
                    missing.append(field)

        if missing:
            return VerificationCheck(
                layer="registry_match",
                check_type="missing_fields",
                source_name="Cadastral Integrity Engine",
                status="failed",
                label="Missing Required Fields",
                details=json.dumps({
                    "missing_fields": missing,
                    "required_fields": required_fields,
                    "message": f"Document is missing {len(missing)} essential cadastral field(s): {', '.join(missing)}."
                })
            )
        else:
            return VerificationCheck(
                layer="registry_match",
                check_type="missing_fields",
                source_name="Cadastral Integrity Engine",
                status="passed",
                label="All Required Fields Present",
                details=json.dumps({
                    "verified_fields": required_fields,
                    "message": "All mandatory cadastral identifiers are populated."
                })
            )

    def _check_area_values(self, land_record: Optional[LandRecord]) -> VerificationCheck:
        """Check for impossible or malformed land area measurements."""
        if not land_record or land_record.area is None:
            return VerificationCheck(
                layer="registry_match",
                check_type="impossible_area",
                source_name="Cadastral Integrity Engine",
                status="review_required",
                label="Area Value Missing",
                details=json.dumps({
                    "observed_area": None,
                    "message": "Land area was not extracted or provided."
                })
            )

        area = land_record.area
        # Impossible values: negative, zero, NaN, or absurdly high (e.g. > 1,000 hectares for agricultural plot)
        if math.isnan(area) or math.isinf(area) or area <= 0.0 or area > 1000.0:
            return VerificationCheck(
                layer="registry_match",
                check_type="impossible_area",
                source_name="Cadastral Integrity Engine",
                status="failed",
                label="Impossible Area Value: Red Flag",
                details=json.dumps({
                    "observed_area": area,
                    "red_flag": True,
                    "reason": "Parcel area must be positive and realistically bounded (0 < area <= 1000 hectares).",
                    "message": f"Observed area {area} hectares violates physical and legal cadastral boundaries."
                })
            )
        else:
            return VerificationCheck(
                layer="registry_match",
                check_type="impossible_area",
                source_name="Cadastral Integrity Engine",
                status="passed",
                label="Area Value Within Feasible Range",
                details=json.dumps({
                    "observed_area": area,
                    "unit": "hectares",
                    "status": "valid"
                })
            )

    def _check_registry_match(self, document: Document, land_record: Optional[LandRecord]) -> List[VerificationCheck]:
        """
        Cross-reference document with VerificationProvider (DemoRegistryProvider).
        Enforces rules:
        - no source = "Not checked against official source"
        - exact ID mismatch (khasra/khata) = red flag with expected vs observed
        - owner-name spelling difference = soft "review required"
        """
        results: List[VerificationCheck] = []

        obs_khata = getattr(land_record, "khata_no", None) if land_record else None
        obs_khasra = getattr(land_record, "khasra_gata_no", None) if land_record else None
        obs_village = (getattr(land_record, "village", None) or document.village) if land_record else document.village
        obs_owner = getattr(land_record, "owner_name", None) if land_record else None

        # Attempt lookup in provider
        registry_record = self.provider.lookup(
            document_reference=document.filename,
            village=obs_village,
            khata_no=obs_khata,
            khasra_no=obs_khasra
        )

        # Rule: no source = "Not checked against official source"
        if not registry_record:
            results.append(VerificationCheck(
                layer="registry_match",
                check_type="registry_lookup",
                source_name=self.provider.source_name,
                status="not_checked",
                label="Not checked against official source",
                details=json.dumps({
                    "source": self.provider.source_name,
                    "disclaimer": self.provider.disclaimer,
                    "message": "No matching record found in official or demo registry ledger for this document."
                })
            ))
            return results

        # Registry record exists! Validate IDs and owner names
        exp_khata = str(registry_record.get("khata_number", ""))
        exp_khasras = registry_record.get("khasra_numbers", [])
        if isinstance(exp_khasras, str):
            exp_khasras = [exp_khasras]

        # ---------------------------------------------------------------------
        # Rule: Exact ID Mismatch (Khata) = Red Flag with expected vs observed
        # ---------------------------------------------------------------------
        norm_obs_khata = _normalize_id(obs_khata)
        norm_exp_khata = _normalize_id(exp_khata)

        if not norm_obs_khata or norm_obs_khata != norm_exp_khata:
            results.append(VerificationCheck(
                layer="registry_match",
                check_type="id_match_khata",
                source_name=self.provider.source_name,
                status="failed",
                label="Exact ID Mismatch (Khata): Red Flag",
                details=json.dumps({
                    "field": "khata_no",
                    "expected": exp_khata,
                    "observed": obs_khata,
                    "red_flag": True,
                    "message": f"Critical mismatch: Extracted Khata '{obs_khata}' does not match official Registry Khata '{exp_khata}'."
                })
            ))
        else:
            results.append(VerificationCheck(
                layer="registry_match",
                check_type="id_match_khata",
                source_name=self.provider.source_name,
                status="passed",
                label="Khata Number Verified",
                details=json.dumps({
                    "field": "khata_no",
                    "expected": exp_khata,
                    "observed": obs_khata
                })
            ))

        # ---------------------------------------------------------------------
        # Rule: Exact ID Mismatch (Khasra) = Red Flag with expected vs observed
        # ---------------------------------------------------------------------
        norm_exp_khasras = [_normalize_id(k) for k in exp_khasras]
        norm_obs_khasra = _normalize_id(obs_khasra)

        # Check if observed matches any expected or if comma-separated list overlaps
        khasra_matched = False
        if norm_obs_khasra:
            # Check direct match
            if norm_obs_khasra in norm_exp_khasras:
                khasra_matched = True
            else:
                # Check parts if comma-delimited
                obs_parts = [_normalize_id(p) for p in norm_obs_khasra.replace(",", " ").split() if p.strip()]
                if any(p in norm_exp_khasras for p in obs_parts):
                    khasra_matched = True

        if not khasra_matched:
            results.append(VerificationCheck(
                layer="registry_match",
                check_type="id_match_khasra",
                source_name=self.provider.source_name,
                status="failed",
                label="Exact ID Mismatch (Khasra): Red Flag",
                details=json.dumps({
                    "field": "khasra_gata_no",
                    "expected": ", ".join(exp_khasras) if exp_khasras else "None",
                    "observed": obs_khasra,
                    "red_flag": True,
                    "message": f"Critical mismatch: Document shows Khasra '{obs_khasra}' whereas Official Registry records Khasra '{', '.join(exp_khasras)}'."
                })
            ))
        else:
            results.append(VerificationCheck(
                layer="registry_match",
                check_type="id_match_khasra",
                source_name=self.provider.source_name,
                status="passed",
                label="Khasra Number Verified",
                details=json.dumps({
                    "field": "khasra_gata_no",
                    "expected": ", ".join(exp_khasras),
                    "observed": obs_khasra
                })
            ))

        # ---------------------------------------------------------------------
        # Rule: Owner-name spelling difference = soft "review required"
        # ---------------------------------------------------------------------
        landholders = registry_record.get("landholders", [])
        expected_names = [h.get("name", "") for h in landholders if isinstance(h, dict)]

        if not obs_owner:
            results.append(VerificationCheck(
                layer="registry_match",
                check_type="owner_name_match",
                source_name=self.provider.source_name,
                status="review_required",
                label="Owner Name Missing",
                details=json.dumps({
                    "expected": expected_names,
                    "observed": None,
                    "message": "Owner name not extracted from document."
                })
            ))
        else:
            best_sim, matched_name = self._match_owner_names(obs_owner, expected_names)

            if best_sim >= 0.95:
                # Exact or virtually identical
                results.append(VerificationCheck(
                    layer="registry_match",
                    check_type="owner_name_match",
                    source_name=self.provider.source_name,
                    status="passed",
                    label="Owner Name Verified",
                    details=json.dumps({
                        "expected": matched_name,
                        "observed": obs_owner,
                        "similarity": round(best_sim, 2)
                    })
                ))
            elif best_sim >= 0.50:
                # Soft "review required" for spelling/transliteration differences
                results.append(VerificationCheck(
                    layer="registry_match",
                    check_type="owner_name_match",
                    source_name=self.provider.source_name,
                    status="review_required",
                    label="Owner-Name Spelling Difference: Review Required",
                    details=json.dumps({
                        "expected": matched_name or expected_names,
                        "observed": obs_owner,
                        "similarity": round(best_sim, 2),
                        "soft_flag": True,
                        "message": f"Owner name spelling variance detected: '{obs_owner}' vs registry '{matched_name}'. Manual review required."
                    })
                ))
            else:
                # Complete mismatch
                results.append(VerificationCheck(
                    layer="registry_match",
                    check_type="owner_name_match",
                    source_name=self.provider.source_name,
                    status="review_required",
                    label="Owner Name Mismatch: Review Required",
                    details=json.dumps({
                        "expected": expected_names,
                        "observed": obs_owner,
                        "similarity": round(best_sim, 2),
                        "message": f"Extracted owner name '{obs_owner}' does not align with registered landholders."
                    })
                ))

        return results

    def _match_owner_names(self, observed: str, expected_names: List[str]) -> Tuple[float, Optional[str]]:
        """Compute highest similarity across expected landholders taking English/Hindi into account."""
        best_sim = 0.0
        best_match = None
        obs_tokens = _extract_name_tokens(observed)

        for exp in expected_names:
            sim = _string_similarity(observed, exp)
            if sim > best_sim:
                best_sim = sim
                best_match = exp

            # Also test similarity on isolated English or Hindi parenthetical segments
            import re
            parts = re.split(r"[()]", exp)
            for part in parts:
                p_clean = part.strip()
                if p_clean:
                    p_sim = _string_similarity(observed, p_clean)
                    if p_sim > best_sim:
                        best_sim = p_sim
                        best_match = exp

                    # Token overlap check (e.g. Ramesh Kumar in Ramesh Kumar Maurya)
                    exp_tokens = _extract_name_tokens(p_clean)
                    if obs_tokens and exp_tokens:
                        common = set(obs_tokens).intersection(set(exp_tokens))
                        if common:
                            overlap_ratio = len(common) / max(len(obs_tokens), len(exp_tokens))
                            if overlap_ratio * 0.85 > best_sim:
                                best_sim = overlap_ratio * 0.85
                                best_match = exp

        return best_sim, best_match

    # -------------------------------------------------------------------------
    # Layer 3 Helpers
    # -------------------------------------------------------------------------
    def _check_human_review_status(self, land_record: Optional[LandRecord]) -> VerificationCheck:
        """Evaluate the human review state, revision history, and outstanding flags."""
        if not land_record:
            return VerificationCheck(
                layer="human_review",
                check_type="human_review_status",
                source_name="Human Review Workflow",
                status="review_required",
                label="Review Pending: No Cadastral Record",
                details=json.dumps({
                    "status": "unprocessed",
                    "message": "Document has not yet undergone cadastral extraction or review."
                })
            )

        if land_record.current_version > 1:
            corrected_fields = [
                f.field_name for f in land_record.evidence_fields if f.corrected_value is not None
            ]
            latest_version = land_record.versions[0] if land_record.versions else None
            return VerificationCheck(
                layer="human_review",
                check_type="human_review_status",
                source_name="Human Review Workflow",
                status="passed",
                label=f"Human Reviewed (Version v{land_record.current_version})",
                details=json.dumps({
                    "current_version": land_record.current_version,
                    "corrected_fields": corrected_fields,
                    "latest_reason": latest_version.reason if latest_version else "Manual correction applied",
                    "message": f"Land record verified and corrected by authorized clerk/admin (v{land_record.current_version})."
                })
            )
        elif land_record.needs_review:
            flagged = [f.field_name for f in land_record.evidence_fields if f.needs_review]
            return VerificationCheck(
                layer="human_review",
                check_type="human_review_status",
                source_name="Human Review Workflow",
                status="review_required",
                label="Human Review Required: Unresolved Flagged Fields",
                details=json.dumps({
                    "needs_review": True,
                    "flagged_fields": flagged,
                    "message": f"{len(flagged)} field(s) have low OCR confidence or missing values requiring clerk confirmation."
                })
            )
        else:
            return VerificationCheck(
                layer="human_review",
                check_type="human_review_status",
                source_name="Human Review Workflow",
                status="passed",
                label="Human Review Cleared: High OCR Confidence",
                details=json.dumps({
                    "overall_confidence": land_record.overall_confidence,
                    "needs_review": False,
                    "message": "All fields meet automated confidence thresholds (≥ 85%). No human intervention required."
                })
            )
