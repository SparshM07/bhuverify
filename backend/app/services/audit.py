import json
from typing import Optional, Any
from sqlalchemy.orm import Session
from backend.app.models.entities import AuditEvent

def log_audit_event(
    db: Session,
    document_id: str,
    action: str,
    user_id: Optional[str] = None,
    details: Optional[Any] = None
) -> AuditEvent:
    """
    Append an irrevocable audit event to the ledger.
    Audit events can never be edited or deleted.
    """
    details_str = json.dumps(details) if isinstance(details, (dict, list)) else (str(details) if details is not None else None)
    
    event = AuditEvent(
        document_id=document_id,
        user_id=user_id,
        action=action,
        details=details_str
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
