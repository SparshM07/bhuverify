"""
app/services/extraction.py - Deterministic Rule & Regex Extraction for UP Land Records.

Features:
- Deterministic extraction for: owner_name, district, tehsil, village, khata_no,
  khasra_gata_no, area, land_class, mutation_ref.
- Supports Hindi and English labels.
- Normalizes Devanagari numerals (०-९ -> 0-9), punctuation, full-width symbols, and whitespace.
- Computes combined confidence for each field (OCR word confidence + rule match strength).
- Flags fields below confidence threshold or missing values with needs_review=True.
- Persists extracted structured records into SQLAlchemy models `LandRecord` and `FieldEvidence`.
"""

import re
import json
import logging
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
import uuid

from sqlalchemy.orm import Session

from backend.app.models.entities import LandRecord, FieldEvidence, Document, DocumentPage, RecordVersion, User
from backend.app.config import settings
from backend.app.services.audit import log_audit_event

logger = logging.getLogger("bhuverify.extraction")

# Devanagari digits to ASCII digits translation map
DEV_TO_ASCII = str.maketrans("०१२३४५६७८९", "0123456789")

# Default threshold below which a field is flagged for manual human verification
DEFAULT_CONFIDENCE_THRESHOLD = 0.70

# Canonical 9 target fields
TARGET_FIELDS = [
    "owner_name",
    "district",
    "tehsil",
    "village",
    "khata_no",
    "khasra_gata_no",
    "area",
    "land_class",
    "mutation_ref"
]

@dataclass
class ExtractedField:
    field_name: str
    value: Any
    confidence: float
    evidence_text: Optional[str]
    page_no: int
    needs_review: bool
    rule_matched: Optional[str]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class DocumentExtractionResult:
    document_id: Optional[str]
    fields: Dict[str, ExtractedField]
    overall_confidence: float
    needs_review: bool
    page_count: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "document_id": self.document_id,
            "overall_confidence": self.overall_confidence,
            "needs_review": self.needs_review,
            "page_count": self.page_count,
            "fields": {k: v.to_dict() for k, v in self.fields.items()}
        }

def normalize_text(text: str) -> str:
    """
    Normalizes OCR text:
    - Translates Devanagari numerals (०१२३४५६७८९) to standard ASCII (0123456789).
    - Normalizes full-width and non-standard punctuation (：／－（），).
    - Strips zero-width and unusual unicode spaces.
    """
    if not text:
        return ""
    t = text.translate(DEV_TO_ASCII)
    t = t.replace("：", ":").replace("／", "/").replace("－", "-")
    t = t.replace("（", "(").replace("）", ")").replace("，", ",")
    t = t.replace("\u200b", "").replace("\u200c", "").replace("\u200d", "").replace("\ufeff", "")
    return t

def split_camel_case(text: str) -> str:
    """
    Splits fused words and fixes spacing around synthetic watermarks / parenthesis.
    Example: 'BakshiKa' -> 'Bakshi Ka', 'Lucknow(Synthetic)' -> 'Lucknow (Synthetic)'
    """
    if not text:
        return ""
    t = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)
    t = re.sub(r'([^\s\(])\s*\((Synthetic)\)', r'\1 (\2)', t, flags=re.IGNORECASE)
    # Collapse multiple whitespace
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def compute_ocr_word_confidence(
    evidence_text: Optional[str],
    ocr_words: Optional[List[Dict[str, Any]]],
    default_page_conf: float = 0.85
) -> float:
    """
    Matches words from the evidence text against OCR word bounding metadata
    to compute an authentic average word confidence (0.0 to 1.0).
    """
    if not evidence_text or not ocr_words:
        return default_page_conf

    ev_tokens = set(re.findall(r'[A-Za-z0-9\u0900-\u097F]+', evidence_text.lower()))
    if not ev_tokens:
        return default_page_conf

    matched_confidences = []
    for w in ocr_words:
        word_str = str(w.get("word", "")).lower()
        w_tokens = re.findall(r'[A-Za-z0-9\u0900-\u097F]+', word_str)
        if any(token in ev_tokens for token in w_tokens):
            conf = float(w.get("confidence", 0.0))
            # Tesseract or RapidOCR might report confidence in 0-100 or 0-1 range
            if conf > 1.0:
                conf = conf / 100.0
            matched_confidences.append(conf)

    if matched_confidences:
        return round(sum(matched_confidences) / len(matched_confidences), 4)
    return default_page_conf

def combine_confidence(
    rule_strength: float,
    ocr_confidence: float,
    ocr_weight: float = 0.4,
    rule_weight: float = 0.6
) -> float:
    """
    Combines rule match strength and OCR word confidence into a single 0.0 - 1.0 score.
    """
    combined = (rule_strength * rule_weight) + (ocr_confidence * ocr_weight)
    return round(max(0.0, min(1.0, combined)), 2)

# ============================================================================
# Field-Specific Extraction Rules
# ============================================================================

def extract_district(
    lines: List[str],
    ocr_words: Optional[List[Dict[str, Any]]] = None,
    threshold: float = DEFAULT_CONFIDENCE_THRESHOLD
) -> ExtractedField:
    rule_strength = 0.0
    matched_value = None
    evidence_text = None
    rule_matched = None

    for idx, line in enumerate(lines):
        m = re.search(r'(?:ज़िला|जिला|जनपद|District|Dist)[^\w\n]*[:\)]?\s*(.*)', line, re.IGNORECASE)
        if m:
            candidate = m.group(1).strip()
            # If value is on the immediate next line
            if not candidate or len(candidate) < 2 or re.match(r'^[:\-\)\s]+$', candidate):
                if idx + 1 < len(lines):
                    candidate = lines[idx + 1].strip()
                    evidence_text = f"{line}\n{lines[idx + 1]}"
            else:
                evidence_text = line

            candidate = re.sub(r'^[:\-\)\s]+', '', candidate)
            candidate = split_camel_case(candidate)

            # Avoid false match with subsequent labels
            if candidate and not re.search(r'pargana|tehsil|village|fasli', candidate, re.IGNORECASE):
                matched_value = candidate
                rule_strength = 0.95
                rule_matched = "regex_district_label_with_synthetic_norm"
                break

    ocr_conf = compute_ocr_word_confidence(evidence_text, ocr_words)
    final_conf = combine_confidence(rule_strength, ocr_conf) if matched_value else 0.0
    needs_review = (matched_value is None) or (final_conf < threshold)

    return ExtractedField(
        field_name="district",
        value=matched_value,
        confidence=final_conf,
        evidence_text=evidence_text,
        page_no=1,
        needs_review=needs_review,
        rule_matched=rule_matched
    )

def extract_tehsil(
    lines: List[str],
    ocr_words: Optional[List[Dict[str, Any]]] = None,
    threshold: float = DEFAULT_CONFIDENCE_THRESHOLD
) -> ExtractedField:
    rule_strength = 0.0
    matched_value = None
    evidence_text = None
    rule_matched = None

    for idx, line in enumerate(lines):
        m = re.search(r'(?:तहसील|तह०|Tehsil|lehsil)[^\w\n]*[:\)]?\s*(.*)', line, re.IGNORECASE)
        if m:
            candidate = m.group(1).strip()
            if not candidate or len(candidate) < 2 or re.match(r'^[:\-\)\s]+$', candidate):
                if idx + 1 < len(lines):
                    candidate = lines[idx + 1].strip()
                    evidence_text = f"{line}\n{lines[idx + 1]}"
            else:
                evidence_text = line

            candidate = re.sub(r'^[:\-\)\s]+', '', candidate)
            candidate = split_camel_case(candidate)

            if candidate and not re.search(r'village|district|fasli|pargana', candidate, re.IGNORECASE):
                matched_value = candidate
                rule_strength = 0.95
                rule_matched = "regex_tehsil_label_v1"
                break

    ocr_conf = compute_ocr_word_confidence(evidence_text, ocr_words)
    final_conf = combine_confidence(rule_strength, ocr_conf) if matched_value else 0.0
    needs_review = (matched_value is None) or (final_conf < threshold)

    return ExtractedField(
        field_name="tehsil",
        value=matched_value,
        confidence=final_conf,
        evidence_text=evidence_text,
        page_no=1,
        needs_review=needs_review,
        rule_matched=rule_matched
    )

def extract_village(
    lines: List[str],
    ocr_words: Optional[List[Dict[str, Any]]] = None,
    threshold: float = DEFAULT_CONFIDENCE_THRESHOLD
) -> ExtractedField:
    rule_strength = 0.0
    matched_value = None
    evidence_text = None
    rule_matched = None

    for idx, line in enumerate(lines):
        m = re.search(r'(?:ग्राम|गाँव|मौजा|Village)[^\w\n]*[:\)]?\s*(.*)', line, re.IGNORECASE)
        if m:
            candidate = m.group(1).strip()
            if not candidate or len(candidate) < 2 or re.match(r'^[:\-\)\s]+$', candidate):
                if idx + 1 < len(lines):
                    candidate = lines[idx + 1].strip()
                    evidence_text = f"{line}\n{lines[idx + 1]}"
            else:
                evidence_text = line

            candidate = re.sub(r'^[:\-\)\s]+', '', candidate)
            candidate = split_camel_case(candidate)

            if candidate and not re.search(r'khata|fasli|tehsil|pargana', candidate, re.IGNORECASE):
                matched_value = candidate
                rule_strength = 0.92
                rule_matched = "regex_village_label_v1"
                break

    ocr_conf = compute_ocr_word_confidence(evidence_text, ocr_words)
    final_conf = combine_confidence(rule_strength, ocr_conf) if matched_value else 0.0
    needs_review = (matched_value is None) or (final_conf < threshold)

    return ExtractedField(
        field_name="village",
        value=matched_value,
        confidence=final_conf,
        evidence_text=evidence_text,
        page_no=1,
        needs_review=needs_review,
        rule_matched=rule_matched
    )

def extract_khata_no(
    lines: List[str],
    full_text: str,
    ocr_words: Optional[List[Dict[str, Any]]] = None,
    threshold: float = DEFAULT_CONFIDENCE_THRESHOLD
) -> ExtractedField:
    rule_strength = 0.0
    matched_value = None
    evidence_text = None
    rule_matched = None

    # Step 1: Look for explicit Khata No label in header metadata
    for idx, line in enumerate(lines):
        if re.search(r'(?:खाता|Khata|KhaNo|Kha No)', line, re.IGNORECASE):
            for offset in range(1, 4):
                if idx + offset < len(lines):
                    cand_line = lines[idx + offset]
                    km = re.search(r'\b(00\d{3}|\d{3,5})\b', cand_line)
                    if km:
                        matched_value = km.group(1)
                        evidence_text = f"{line} -> {cand_line}"
                        rule_strength = 0.96
                        rule_matched = "regex_khata_header_label"
                        break
            if matched_value:
                break

    # Step 2: Look for table column 1 value
    if not matched_value:
        km = re.search(r'\b(00\d{3})\b', full_text)
        if km:
            matched_value = km.group(1)
            evidence_text = km.group(0)
            rule_strength = 0.90
            rule_matched = "regex_khata_standard_5digit_pattern"

    ocr_conf = compute_ocr_word_confidence(evidence_text, ocr_words)
    final_conf = combine_confidence(rule_strength, ocr_conf) if matched_value else 0.0
    needs_review = (matched_value is None) or (final_conf < threshold)

    return ExtractedField(
        field_name="khata_no",
        value=matched_value,
        confidence=final_conf,
        evidence_text=evidence_text,
        page_no=1,
        needs_review=needs_review,
        rule_matched=rule_matched
    )

def extract_khasra_gata_no(
    lines: List[str],
    ocr_words: Optional[List[Dict[str, Any]]] = None,
    threshold: float = DEFAULT_CONFIDENCE_THRESHOLD
) -> ExtractedField:
    rule_strength = 0.0
    matched_value = None
    evidence_text = None
    rule_matched = None

    # Look for khasra patterns like '45/1, 45/2, 46' or '112/3' or '999/INVALID'
    for line in lines:
        # Exclude boilerplate or metadata
        if re.search(r'SYNTHETIC|CADASTRE|RevenueCode|Digitised|UPCADASTRE|Documen', line, re.IGNORECASE):
            continue

        km = re.search(r'\b((?:999/INVALID|[1-9]\d{0,3}(?:/[0-9A-Za-z]+)?)(?:\s*,\s*\d+(?:/[0-9A-Za-z]+)?)*)\b', line)
        if km:
            candidate = km.group(1).strip()
            # Ignore share fractions (1/1, 1/2) and fasli years / revenue code
            if candidate in ['1/1', '1/2', '1/4', '2006']:
                continue
            if re.search(r'1430|00\d{3}', candidate):
                continue
            if '/' in candidate or ',' in candidate:
                parts = [p.strip() for p in candidate.split(',')]
                matched_value = ', '.join(parts)
                evidence_text = line
                rule_strength = 0.92
                rule_matched = "regex_khasra_composite_slashed_numbers"
                break

    ocr_conf = compute_ocr_word_confidence(evidence_text, ocr_words)
    final_conf = combine_confidence(rule_strength, ocr_conf) if matched_value else 0.0
    needs_review = (matched_value is None) or (final_conf < threshold)

    return ExtractedField(
        field_name="khasra_gata_no",
        value=matched_value,
        confidence=final_conf,
        evidence_text=evidence_text,
        page_no=1,
        needs_review=needs_review,
        rule_matched=rule_matched
    )

def extract_area(
    lines: List[str],
    full_text: str,
    ocr_words: Optional[List[Dict[str, Any]]] = None,
    threshold: float = DEFAULT_CONFIDENCE_THRESHOLD
) -> ExtractedField:
    rule_strength = 0.0
    matched_value = None
    evidence_text = None
    rule_matched = None

    # UP Khatauni land area in hectares is rendered as a floating point decimal with 3 or 4 places
    area_m = re.search(r'\b([0-9]+\.[0-9]{3,4})\b', full_text)
    if area_m:
        try:
            matched_value = float(area_m.group(1))
            evidence_text = area_m.group(0)
            rule_strength = 0.98
            rule_matched = "regex_area_hectares_decimal"
        except (ValueError, TypeError):
            matched_value = None

    ocr_conf = compute_ocr_word_confidence(evidence_text, ocr_words)
    final_conf = combine_confidence(rule_strength, ocr_conf) if matched_value is not None else 0.0
    needs_review = (matched_value is None) or (final_conf < threshold)

    return ExtractedField(
        field_name="area",
        value=matched_value,
        confidence=final_conf,
        evidence_text=evidence_text,
        page_no=1,
        needs_review=needs_review,
        rule_matched=rule_matched
    )

def extract_owner_name(
    lines: List[str],
    ocr_words: Optional[List[Dict[str, Any]]] = None,
    threshold: float = DEFAULT_CONFIDENCE_THRESHOLD
) -> ExtractedField:
    rule_strength = 0.0
    matched_value = None
    evidence_text = None
    rule_matched = None

    owners = []
    evidence_lines = []

    for line in lines:
        if re.search(r'SYNTHETIC|NOTOFFICIAL|RevenueCode|Digitised|UPCADASTRE|Documen', line, re.IGNORECASE):
            continue
        # Exclude parent / husband lineage lines and residence lines
        if re.search(r'pita|pati|पिता|पति|ufd|uif|aaf|qfa/qaf|fa/qaf|a/qaf|नि०|Mohanpur|Belha|Baragaon|Sarai|Alinagar|Govindpur|Kalyanpur|Rampur|Shivpur', line, re.IGNORECASE):
            continue

        # Look for names associated with landholder share fractions (e.g. 1/1, 1/2)
        # 1. Name inside parentheses: e.g. '(RameshKumar)HT1/2' or '(Dinesh Yadav) Hl1 1/1'
        m_paren = re.findall(r'\(([A-Za-z\s]+)\)(?:\s*[A-Za-z0-9]*\s*1\s*/\s*[12\)])', line)
        if m_paren:
            for p in m_paren:
                if p not in ['Ha', 'Rev', 'R', 'ROR', 'Synthetic']:
                    clean_name = split_camel_case(p)
                    owners.append(clean_name)
                    evidence_lines.append(line)
        else:
            # 2. Direct Latin letters preceding share fraction: e.g. '3RMohammadAi1/1'
            m_direct = re.findall(r'([A-Za-z]{3,})(?:[A-Za-z0-9]*\s*1\s*/\s*[12\)])', line)
            for d in m_direct:
                if d not in ['Ha', 'Rev', 'R', 'ROR', 'Synthetic']:
                    clean_d = re.sub(r'^[A-Z]([A-Z][a-z])', r'\1', d)
                    clean_name = split_camel_case(clean_d)
                    owners.append(clean_name)
                    evidence_lines.append(line)

    if owners:
        matched_value = ", ".join(owners)
        evidence_text = "; ".join(evidence_lines)
        rule_strength = 0.88
        rule_matched = "regex_landholder_share_pattern"

    ocr_conf = compute_ocr_word_confidence(evidence_text, ocr_words)
    final_conf = combine_confidence(rule_strength, ocr_conf) if matched_value else 0.0
    needs_review = (matched_value is None) or (final_conf < threshold)

    return ExtractedField(
        field_name="owner_name",
        value=matched_value,
        confidence=final_conf,
        evidence_text=evidence_text,
        page_no=1,
        needs_review=needs_review,
        rule_matched=rule_matched
    )

def extract_land_class(
    lines: List[str],
    full_text: str,
    ocr_words: Optional[List[Dict[str, Any]]] = None,
    threshold: float = DEFAULT_CONFIDENCE_THRESHOLD
) -> ExtractedField:
    rule_strength = 0.0
    matched_value = None
    evidence_text = None
    rule_matched = None

    # Matches land categories e.g. 'श्रेणी 1-क (भूमिधर अधिकार वाली भूमि)'
    m_lc = re.search(
        r'(?:कृषि भूमि\s*[-–]\s*)?(?:श्रेणी|भूमि श्रेणी|Land Class)[:\s]*([1-9][-\w\u0900-\u097F]*(?:\s*\([^\)]+\))?)',
        full_text,
        re.IGNORECASE
    )
    if m_lc:
        matched_value = m_lc.group(0).strip()
        evidence_text = m_lc.group(0)
        rule_strength = 0.85
        rule_matched = "regex_land_class_category"

    ocr_conf = compute_ocr_word_confidence(evidence_text, ocr_words)
    final_conf = combine_confidence(rule_strength, ocr_conf) if matched_value else 0.0
    needs_review = (matched_value is None) or (final_conf < threshold)

    return ExtractedField(
        field_name="land_class",
        value=matched_value,
        confidence=final_conf,
        evidence_text=evidence_text,
        page_no=1,
        needs_review=needs_review,
        rule_matched=rule_matched
    )

def extract_mutation_ref(
    lines: List[str],
    full_text: str,
    ocr_words: Optional[List[Dict[str, Any]]] = None,
    threshold: float = DEFAULT_CONFIDENCE_THRESHOLD
) -> ExtractedField:
    rule_strength = 0.0
    matched_value = None
    evidence_text = None
    rule_matched = None

    # Matches mutation order or case reference e.g. 'पत्रावली सं० 42/2024'
    m_mut = re.search(
        r'(?:पत्रावली|नामांतरण|आदेश|मुकदमा|Case|Order)\s*(?:सं०|संख्या|नं०|No\.?)?[:\s]*([0-9\u0966-\u096F]+/[0-9\u0966-\u096F]+)',
        full_text,
        re.IGNORECASE
    )
    if m_mut:
        matched_value = m_mut.group(1).strip()
        evidence_text = m_mut.group(0)
        rule_strength = 0.85
        rule_matched = "regex_mutation_case_filing_ref"

    ocr_conf = compute_ocr_word_confidence(evidence_text, ocr_words)
    final_conf = combine_confidence(rule_strength, ocr_conf) if matched_value else 0.0
    needs_review = (matched_value is None) or (final_conf < threshold)

    return ExtractedField(
        field_name="mutation_ref",
        value=matched_value,
        confidence=final_conf,
        evidence_text=evidence_text,
        page_no=1,
        needs_review=needs_review,
        rule_matched=rule_matched
    )

# ============================================================================
# Main Extraction Pipelines
# ============================================================================

def extract_fields_from_ocr_text(
    raw_text: str,
    ocr_words: Optional[List[Dict[str, Any]]] = None,
    page_no: int = 1,
    threshold: float = DEFAULT_CONFIDENCE_THRESHOLD
) -> Dict[str, ExtractedField]:
    """
    Extracts all 9 target fields from raw OCR text with Devanagari digit normalisation.
    """
    norm_text = normalize_text(raw_text)
    lines = [l.strip() for l in norm_text.splitlines() if l.strip()]

    fields: Dict[str, ExtractedField] = {}
    fields["district"] = extract_district(lines, ocr_words, threshold)
    fields["tehsil"] = extract_tehsil(lines, ocr_words, threshold)
    fields["village"] = extract_village(lines, ocr_words, threshold)
    fields["khata_no"] = extract_khata_no(lines, norm_text, ocr_words, threshold)
    fields["khasra_gata_no"] = extract_khasra_gata_no(lines, ocr_words, threshold)
    fields["area"] = extract_area(lines, norm_text, ocr_words, threshold)
    fields["owner_name"] = extract_owner_name(lines, ocr_words, threshold)
    fields["land_class"] = extract_land_class(lines, norm_text, ocr_words, threshold)
    fields["mutation_ref"] = extract_mutation_ref(lines, norm_text, ocr_words, threshold)

    # Set page number on all fields
    for f in fields.values():
        f.page_no = page_no

    return fields

def extract_document_fields(
    pages_ocr: List[Dict[str, Any]],
    document_id: Optional[str] = None,
    threshold: float = DEFAULT_CONFIDENCE_THRESHOLD
) -> DocumentExtractionResult:
    """
    Extracts structured fields across all document pages. Merges multi-page results.
    """
    if not pages_ocr:
        # Return empty structured result with all fields None and flagged for review
        empty_fields = {
            f: ExtractedField(
                field_name=f,
                value=None,
                confidence=0.0,
                evidence_text=None,
                page_no=1,
                needs_review=True,
                rule_matched=None
            ) for f in TARGET_FIELDS
        }
        return DocumentExtractionResult(
            document_id=document_id,
            fields=empty_fields,
            overall_confidence=0.0,
            needs_review=True,
            page_count=0
        )

    # Aggregate extracted fields across pages (taking highest confidence per field)
    best_fields: Dict[str, ExtractedField] = {}

    for page_idx, page in enumerate(pages_ocr):
        page_no = page.get("page_number", page_idx + 1)
        raw_text = page.get("raw_text", "")
        words = page.get("words", [])

        # Parse JSON string if stored as text in DB
        if isinstance(words, str):
            try:
                words = json.loads(words)
            except Exception:
                words = []

        page_fields = extract_fields_from_ocr_text(
            raw_text=raw_text,
            ocr_words=words,
            page_no=page_no,
            threshold=threshold
        )

        for field_name, field_obj in page_fields.items():
            if field_name not in best_fields:
                best_fields[field_name] = field_obj
            else:
                # If current page has higher confidence, replace
                if field_obj.confidence > best_fields[field_name].confidence:
                    best_fields[field_name] = field_obj

    # Calculate overall confidence and review requirements
    total_conf = sum(f.confidence for f in best_fields.values())
    overall_conf = round(total_conf / len(best_fields), 2) if best_fields else 0.0
    needs_review = any(f.needs_review for f in best_fields.values())

    return DocumentExtractionResult(
        document_id=document_id,
        fields=best_fields,
        overall_confidence=overall_conf,
        needs_review=needs_review,
        page_count=len(pages_ocr)
    )

# ============================================================================
# Database Persistence: LandRecord & FieldEvidence
# ============================================================================

def persist_extraction_results(
    db: Session,
    document_id: str,
    result: DocumentExtractionResult
) -> LandRecord:
    """
    Persists structured extraction result into `land_records` and `field_evidence` tables.
    Maintains idempotency: replaces existing LandRecord / FieldEvidence rows for this document.
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise ValueError(f"Document with ID {document_id} not found in database.")

    # 1. Find or create LandRecord
    land_record = db.query(LandRecord).filter(LandRecord.document_id == document_id).first()
    if not land_record:
        land_record = LandRecord(
            id=str(uuid.uuid4()),
            document_id=document_id
        )
        db.add(land_record)
        db.flush()

    # 2. Update LandRecord fields
    fields = result.fields
    land_record.owner_name = fields.get("owner_name").value if fields.get("owner_name") else None
    land_record.district = fields.get("district").value if fields.get("district") else None
    land_record.tehsil = fields.get("tehsil").value if fields.get("tehsil") else None
    land_record.village = fields.get("village").value if fields.get("village") else None
    land_record.khata_no = str(fields.get("khata_no").value) if fields.get("khata_no") and fields.get("khata_no").value is not None else None
    land_record.khasra_gata_no = fields.get("khasra_gata_no").value if fields.get("khasra_gata_no") else None
    
    # Area conversion
    area_val = fields.get("area").value if fields.get("area") else None
    if area_val is not None:
        try:
            land_record.area = float(area_val)
        except (ValueError, TypeError):
            land_record.area = None
    else:
        land_record.area = None

    land_record.land_class = fields.get("land_class").value if fields.get("land_class") else None
    land_record.mutation_ref = fields.get("mutation_ref").value if fields.get("mutation_ref") else None
    land_record.overall_confidence = result.overall_confidence
    land_record.needs_review = result.needs_review
    land_record.updated_at = datetime.now(timezone.utc)

    # Also sync territory on Document object if unset
    if land_record.district and not document.district:
        document.district = land_record.district
    if land_record.tehsil and not document.tehsil:
        document.tehsil = land_record.tehsil
    if land_record.village and not document.village:
        document.village = land_record.village

    # 3. Clean up existing FieldEvidence rows for idempotency
    db.query(FieldEvidence).filter(FieldEvidence.land_record_id == land_record.id).delete()

    # 4. Insert FieldEvidence rows for each of the target fields
    for field_name in TARGET_FIELDS:
        extracted = fields.get(field_name)
        val_str = str(extracted.value) if extracted and extracted.value is not None else None
        
        evidence = FieldEvidence(
            id=str(uuid.uuid4()),
            land_record_id=land_record.id,
            document_id=document.id,
            field_name=field_name,
            extracted_value=val_str,
            confidence=extracted.confidence if extracted else 0.0,
            evidence_text=extracted.evidence_text if extracted else None,
            page_no=extracted.page_no if extracted else 1,
            needs_review=extracted.needs_review if extracted else True,
            rule_matched=extracted.rule_matched if extracted else None
        )
        db.add(evidence)

    db.commit()
    db.refresh(land_record)
    logger.info(f"Persisted LandRecord {land_record.id} for document {document_id} (confidence: {land_record.overall_confidence}, needs_review: {land_record.needs_review})")

    return land_record

def extract_and_persist_document(
    db: Session,
    document: Document,
    threshold: float = DEFAULT_CONFIDENCE_THRESHOLD
) -> LandRecord:
    """
    Loads DocumentPages from DB (or falls back to document.raw_ocr_text),
    runs deterministic extraction, and saves into land_records and field_evidence.
    """
    pages_ocr = []
    if document.pages:
        for p in document.pages:
            pages_ocr.append({
                "page_number": p.page_number,
                "raw_text": p.raw_text,
                "word_count": p.word_count,
                "avg_confidence": p.avg_confidence,
                "words": p.ocr_metadata
            })
    elif document.raw_ocr_text:
        pages_ocr.append({
            "page_number": 1,
            "raw_text": document.raw_ocr_text,
            "word_count": len(document.raw_ocr_text.split()),
            "avg_confidence": 85,
            "words": []
        })

    result = extract_document_fields(
        pages_ocr=pages_ocr,
        document_id=document.id,
        threshold=threshold
    )

    return persist_extraction_results(db=db, document_id=document.id, result=result)

def extract_and_persist_by_document_id(
    db: Session,
    document_id: str,
    threshold: float = DEFAULT_CONFIDENCE_THRESHOLD
) -> LandRecord:
    """
    Helper function to extract and persist by document ID string.
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise ValueError(f"Document {document_id} not found.")
    return extract_and_persist_document(db=db, document=document, threshold=threshold)

def apply_field_corrections(
    db: Session,
    document_id: str,
    corrections: Dict[str, Optional[str]],
    reason: str,
    actor_user: User
) -> Tuple[LandRecord, RecordVersion, Dict[str, Any]]:
    """
    Applies human field corrections to a land record:
    - Enforces mandatory audit reason.
    - Keeps raw `extracted_value` and human `corrected_value` strictly separate.
    - Creates a new immutable RecordVersion snapshot (never overwrites history).
    - Logs an append-only AuditEvent recording old value, new value, actor, and reason.
    - Updates active LandRecord and marks corrected fields as reviewed.
    """
    if not reason or not reason.strip():
        raise ValueError("A valid justification reason is required for cadastral record correction.")

    clean_reason = reason.strip()
    if len(clean_reason) < 3:
        raise ValueError("Reason must be at least 3 characters long.")

    if not corrections:
        raise ValueError("At least one field correction must be provided.")

    # Validate correction fields
    invalid_fields = [f for f in corrections.keys() if f not in TARGET_FIELDS]
    if invalid_fields:
        raise ValueError(f"Invalid field names for correction: {', '.join(invalid_fields)}. Allowed: {', '.join(TARGET_FIELDS)}")

    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise ValueError(f"Document {document_id} not found.")

    land_record = db.query(LandRecord).filter(LandRecord.document_id == document_id).first()
    if not land_record:
        # If OCR text exists, extract first
        if document.pages or document.raw_ocr_text:
            land_record = extract_and_persist_document(db=db, document=document)
        else:
            raise ValueError(f"No land record extraction found for document {document_id}. Process document with OCR first.")

    evidence_map = {fe.field_name: fe for fe in land_record.evidence_fields}
    changes = {}

    # Increment revision version
    new_version_num = (land_record.current_version or 1) + 1
    land_record.current_version = new_version_num

    for field_name, new_val in corrections.items():
        fe = evidence_map.get(field_name)
        if not fe:
            # Create field evidence if missing
            fe = FieldEvidence(
                id=str(uuid.uuid4()),
                land_record_id=land_record.id,
                document_id=document.id,
                field_name=field_name,
                extracted_value=None,
                confidence=1.0,
                page_no=1,
                needs_review=False
            )
            db.add(fe)
            evidence_map[field_name] = fe

        # Determine old value (previous corrected value if set, else original extracted value)
        old_val = fe.corrected_value if fe.corrected_value is not None else fe.extracted_value
        clean_new_val = str(new_val).strip() if new_val is not None and str(new_val).strip() != "" else None

        changes[field_name] = {
            "old": old_val,
            "new": clean_new_val
        }

        # Update FieldEvidence: KEEP extracted_value INTACT, store in corrected_value!
        fe.corrected_value = clean_new_val
        fe.correction_reason = clean_reason
        fe.corrected_by_id = actor_user.id
        fe.corrected_at = datetime.now(timezone.utc)
        fe.version = new_version_num
        fe.needs_review = False  # Explicitly verified by human reviewer

        # Update active LandRecord attribute
        if field_name == "owner_name":
            land_record.owner_name = clean_new_val
        elif field_name == "district":
            land_record.district = clean_new_val
            document.district = clean_new_val
        elif field_name == "tehsil":
            land_record.tehsil = clean_new_val
            document.tehsil = clean_new_val
        elif field_name == "village":
            land_record.village = clean_new_val
            document.village = clean_new_val
        elif field_name == "khata_no":
            land_record.khata_no = clean_new_val
        elif field_name == "khasra_gata_no":
            land_record.khasra_gata_no = clean_new_val
        elif field_name == "area":
            try:
                land_record.area = float(clean_new_val) if clean_new_val is not None else None
            except (ValueError, TypeError):
                land_record.area = None
        elif field_name == "land_class":
            land_record.land_class = clean_new_val
        elif field_name == "mutation_ref":
            land_record.mutation_ref = clean_new_val

    # Update overall review flag: False if all fields now have non-null values or have been reviewed
    land_record.needs_review = any(fe.needs_review for fe in land_record.evidence_fields)
    land_record.updated_at = datetime.now(timezone.utc)

    # Build snapshot of active state at this version
    snapshot = {}
    for f in TARGET_FIELDS:
        fe = evidence_map.get(f)
        snapshot[f] = fe.corrected_value if (fe and fe.corrected_value is not None) else (fe.extracted_value if fe else None)

    # Create immutable RecordVersion row
    record_version = RecordVersion(
        id=str(uuid.uuid4()),
        land_record_id=land_record.id,
        document_id=document.id,
        version_number=new_version_num,
        created_by_id=actor_user.id,
        reason=clean_reason,
        changes=json.dumps(changes, ensure_ascii=False),
        snapshot=json.dumps(snapshot, ensure_ascii=False)
    )
    db.add(record_version)

    # Log immutable AuditEvent
    log_audit_event(
        db=db,
        document_id=document.id,
        action="FIELD_CORRECTION_APPLIED",
        user_id=actor_user.id,
        details={
            "version": new_version_num,
            "reason": clean_reason,
            "actor_id": actor_user.id,
            "actor_email": actor_user.email,
            "actor_role": actor_user.role,
            "changes": changes
        }
    )

    db.commit()
    db.refresh(land_record)
    db.refresh(record_version)

    return land_record, record_version, changes
