from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class AuditEventResponse(BaseModel):
    id: str
    document_id: str
    user_id: Optional[str]
    action: str
    details: Optional[str]
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)
