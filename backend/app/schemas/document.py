from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, ConfigDict
from backend.app.config import settings

class DocumentResponse(BaseModel):
    id: str
    filename: str
    file_size_bytes: int
    mime_type: str
    sha256_hash: str
    status: str
    record_type: Optional[str] = "Khatauni (ROR)"
    district: Optional[str] = None
    tehsil: Optional[str] = None
    village: Optional[str] = None
    is_restricted: bool = False
    raw_ocr_text: Optional[str] = None
    processing_error: Optional[str] = None
    review_status: str = "pending"
    reviewed_by_id: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_reason: Optional[str] = None
    detected_qr_data: Optional[str] = None
    uploaded_by_id: str
    created_at: datetime
    updated_at: datetime
    disclaimer: str = settings.DEMO_DISCLAIMER

    model_config = ConfigDict(from_attributes=True)

class DocumentPageResponse(BaseModel):
    id: str
    page_number: int
    raw_text: str
    word_count: int
    avg_confidence: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class DocumentProcessingResponse(BaseModel):
    message: str
    document_id: str
    status: str
    is_already_processed: bool = False
    disclaimer: str = settings.DEMO_DISCLAIMER

class DocumentListResponse(BaseModel):
    items: List[DocumentResponse]
    total: int
    disclaimer: str = settings.DEMO_DISCLAIMER

class DuplicateHashWarningResponse(BaseModel):
    warning: str
    detail: str
    existing_document_id: str
    sha256_hash: str
    disclaimer: str = settings.DEMO_DISCLAIMER

class FieldCorrectionRequest(BaseModel):
    corrections: dict[str, Optional[str]]
    reason: str

class FieldEvidenceResponse(BaseModel):
    id: str
    field_name: str
    extracted_value: Optional[str] = None
    corrected_value: Optional[str] = None
    active_value: Optional[str] = None
    is_corrected: bool = False
    confidence: float
    evidence_text: Optional[str] = None
    page_no: int = 1
    needs_review: bool
    rule_matched: Optional[str] = None
    correction_reason: Optional[str] = None
    corrected_by_id: Optional[str] = None
    corrected_at: Optional[datetime] = None
    version: int = 1

    model_config = ConfigDict(from_attributes=True)

class RecordVersionResponse(BaseModel):
    id: str
    version_number: int
    created_by_id: str
    created_by_email: Optional[str] = None
    reason: str
    changes: dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class LandRecordResponse(BaseModel):
    id: str
    document_id: str
    owner_name: Optional[str] = None
    district: Optional[str] = None
    tehsil: Optional[str] = None
    village: Optional[str] = None
    khata_no: Optional[str] = None
    khasra_gata_no: Optional[str] = None
    area: Optional[float] = None
    land_class: Optional[str] = None
    mutation_ref: Optional[str] = None
    overall_confidence: float
    needs_review: bool
    current_version: int = 1
    created_at: datetime
    updated_at: datetime
    evidence_fields: List[FieldEvidenceResponse] = []
    versions: List[RecordVersionResponse] = []
    disclaimer: str = settings.DEMO_DISCLAIMER

    model_config = ConfigDict(from_attributes=True)

class CorrectionSuccessResponse(BaseModel):
    message: str
    document_id: str
    version_number: int
    applied_changes: dict[str, Any]
    land_record: LandRecordResponse
    disclaimer: str = settings.DEMO_DISCLAIMER

class VerificationCheckResponse(BaseModel):
    id: str
    document_id: str
    layer: str  # file_integrity, registry_match, human_review
    check_type: str
    source_name: str
    status: str  # passed, failed, review_required, not_checked, warning
    label: str
    details: Optional[dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class VerificationSummaryResponse(BaseModel):
    document_id: str
    total_checks: int
    status: str  # verified, review_required, failed, not_checked
    checks: List[VerificationCheckResponse]
    by_layer: dict[str, List[VerificationCheckResponse]]
    disclaimer: str = settings.DEMO_DISCLAIMER

class ReviewDecisionRequest(BaseModel):
    action: str  # approve, reject, request_changes
    reason: str

class ReviewDecisionResponse(BaseModel):
    message: str
    document_id: str
    review_status: str
    reviewed_by_id: str
    reviewed_at: datetime
    reason: str
    disclaimer: str = settings.DEMO_DISCLAIMER

class ShareTokenCreateRequest(BaseModel):
    expires_in_hours: Optional[int] = 168  # 7 days default

class ShareTokenCreatedResponse(BaseModel):
    token_id: str
    token: str  # Cleartext token provided ONLY on creation
    token_hash: str
    verify_url: str
    qr_code_data_url: str
    expires_at: datetime
    created_at: datetime
    disclaimer: str = settings.DEMO_DISCLAIMER

class ShareTokenResponse(BaseModel):
    id: str
    document_id: str
    created_at: datetime
    expires_at: datetime
    is_revoked: bool
    revoked_at: Optional[datetime] = None
    verify_url: str
    qr_code_data_url: Optional[str] = None
    disclaimer: str = settings.DEMO_DISCLAIMER

    model_config = ConfigDict(from_attributes=True)

class PublicVerificationResponse(BaseModel):
    status: str  # valid, expired, revoked, not_found
    document_reference: Optional[str] = None
    upload_date: Optional[datetime] = None
    review_status: Optional[str] = None
    verification_method: Optional[str] = None
    last_checked_time: Optional[datetime] = None
    integrity_status: Optional[str] = None
    disclaimer: str = settings.DEMO_DISCLAIMER


