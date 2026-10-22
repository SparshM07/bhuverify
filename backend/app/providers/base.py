import os
import json
import logging
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

class VerificationProvider(ABC):
    """Abstract interface for external/internal land registry verification providers."""

    @property
    @abstractmethod
    def source_name(self) -> str:
        """Human-readable identifier for this verification source."""
        pass

    @property
    @abstractmethod
    def disclaimer(self) -> str:
        """Mandatory legal disclaimer regarding source authority."""
        pass

    @abstractmethod
    def lookup(
        self,
        document_reference: Optional[str] = None,
        village: Optional[str] = None,
        khata_no: Optional[str] = None,
        khasra_no: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Query the verification provider for a matching cadastral record.
        Returns a dictionary representing the official registry record, or None if not found.
        """
        pass


def _normalize_id(value: Optional[str]) -> str:
    """Normalize numeric/alphanumeric IDs by stripping leading zeros and spaces."""
    if not value:
        return ""
    # Normalise Devanagari numerals
    devanagari = "०१२३४५६७८९"
    res = []
    for ch in str(value).strip():
        idx = devanagari.find(ch)
        if idx != -1:
            res.append(str(idx))
        else:
            res.append(ch)
    s = "".join(res).strip()
    # Strip leading zeros for pure digits or simple numbers
    if s.isdigit():
        return str(int(s))
    return s.lower()


class DemoRegistryProvider(VerificationProvider):
    """
    Demo verification provider reading local synthetic records from sample_data/demo_registry.json.
    Simulates integration with an official state land records database (e.g. UP Bhulekh).
    """

    def __init__(self, registry_file_path: Optional[str] = None):
        if not registry_file_path:
            # Locate sample_data/demo_registry.json robustly
            current_dir = os.path.dirname(os.path.abspath(__file__))
            candidates = [
                os.path.join(current_dir, "..", "..", "..", "sample_data", "demo_registry.json"),
                os.path.join(current_dir, "..", "..", "sample_data", "demo_registry.json"),
                os.path.join(os.getcwd(), "sample_data", "demo_registry.json"),
                os.path.join(os.getcwd(), "..", "sample_data", "demo_registry.json"),
            ]
            for c in candidates:
                if os.path.exists(c):
                    registry_file_path = os.path.abspath(c)
                    break

        self._path = registry_file_path
        self._records: List[Dict[str, Any]] = []
        self._disclaimer = "Demo registry match - not an official government verification"
        self._load_data()

    def _load_data(self) -> None:
        if not self._path or not os.path.exists(self._path):
            logger.warning(f"Demo registry file not found at: {self._path}")
            return
        try:
            with open(self._path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self._disclaimer = data.get("disclaimer", self._disclaimer)
                self._records = data.get("registry_records", [])
                logger.info(f"Loaded {len(self._records)} demo registry records from {self._path}")
        except Exception as e:
            logger.error(f"Failed to load demo registry: {e}")

    @property
    def source_name(self) -> str:
        return "UP Bhulekh Demo Registry (Synthetic)"

    @property
    def disclaimer(self) -> str:
        return self._disclaimer

    @property
    def records(self) -> List[Dict[str, Any]]:
        return self._records

    def lookup(
        self,
        document_reference: Optional[str] = None,
        village: Optional[str] = None,
        khata_no: Optional[str] = None,
        khasra_no: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Lookup registry record by exact document filename/reference, or by cadastral identifiers.
        """
        # 1. Match by document_reference (filename) if provided
        if document_reference:
            clean_ref = os.path.basename(document_reference).lower().strip()
            for rec in self._records:
                rec_doc = rec.get("document_reference", "").lower().strip()
                rec_id = rec.get("document_id", "").lower().strip()
                if clean_ref and (rec_doc == clean_ref or rec_id == clean_ref):
                    return rec

        # 2. Match by village + khata_number
        norm_khata = _normalize_id(khata_no)
        norm_village = village.strip().lower() if village else ""

        if norm_khata:
            for rec in self._records:
                rec_khata = _normalize_id(rec.get("khata_number"))
                rec_village = rec.get("village", "").strip().lower()
                if rec_khata == norm_khata:
                    if not norm_village or norm_village in rec_village or rec_village in norm_village:
                        return rec

        # 3. Match by khasra_number if unique
        if khasra_no:
            norm_khasra = _normalize_id(khasra_no)
            for rec in self._records:
                khasra_list = [_normalize_id(k) for k in rec.get("khasra_numbers", [])]
                if norm_khasra in khasra_list:
                    if not norm_village or norm_village in rec.get("village", "").strip().lower():
                        return rec

        return None
