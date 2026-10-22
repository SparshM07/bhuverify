from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict
from backend.app.config import settings

class CaseAttachDocumentRequest(BaseModel):
    document_id: str
    access_level: str = "internal"  # public, internal, confidential, restricted
    notes: Optional[str] = None

class CaseAttachmentResponse(BaseModel):
    id: str
    case_id: str
    document_id: str
    document_filename: str
    document_status: str
    document_review_status: str
    document_sha256: str
    is_restricted: bool = False
    access_level: str
    notes: Optional[str] = None
    attached_by_id: str
    attached_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CaseCreateRequest(BaseModel):
    case_ref: Optional[str] = None
    title: str
    description: Optional[str] = None
    parcel_identifier: Optional[str] = None
    village: Optional[str] = None
    tehsil: Optional[str] = None
    district: Optional[str] = None
    status: Optional[str] = "open"

class CaseUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    parcel_identifier: Optional[str] = None
    village: Optional[str] = None
    tehsil: Optional[str] = None
    district: Optional[str] = None

class CaseResponse(BaseModel):
    id: str
    case_ref: str
    title: str
    description: Optional[str] = None
    parcel_identifier: Optional[str] = None
    village: Optional[str] = None
    tehsil: Optional[str] = None
    district: Optional[str] = None
    status: str
    created_by_id: str
    created_at: datetime
    updated_at: datetime
    attachments_count: int = 0
    attachments: List[CaseAttachmentResponse] = []
    disclaimer: str = settings.DEMO_DISCLAIMER

    model_config = ConfigDict(from_attributes=True)

class CaseListResponse(BaseModel):
    items: List[CaseResponse]
    total: int
    disclaimer: str = settings.DEMO_DISCLAIMER
