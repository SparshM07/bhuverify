from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict
from backend.app.config import settings

class UserAdminResponse(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    documents_count: int = 0

    model_config = ConfigDict(from_attributes=True)

class UserUpdateRequest(BaseModel):
    role: Optional[str] = None  # admin, clerk, viewer
    is_active: Optional[bool] = None

class SourceStatusItem(BaseModel):
    name: str
    tag: str  # "DEMO" or "NATIVE"
    is_demo: bool
    status: str
    record_count: Optional[int] = None
    file_path: Optional[str] = None
    description: str
    capabilities: List[str]
    disclaimer: str

class AdminSourcesResponse(BaseModel):
    sources: List[SourceStatusItem]
    system_status: str
    disclaimer: str = settings.DEMO_DISCLAIMER
