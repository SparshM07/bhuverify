import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models.entities import User, Document, CaseBundle, CaseDocumentAttachment, AuditEvent
from backend.app.schemas.case import (
    CaseCreateRequest,
    CaseUpdateRequest,
    CaseAttachDocumentRequest,
    CaseResponse,
    CaseListResponse,
    CaseAttachmentResponse
)
from backend.app.security.auth import get_current_user
from backend.app.security.permissions import require_roles, verify_document_object_access
from backend.app.services.audit import log_audit_event

router = APIRouter(prefix="/cases", tags=["Case Bundles"])

def _format_case_response(case: CaseBundle) -> dict:
    attachments_list = []
    for att in case.attachments:
        attachments_list.append({
            "id": att.id,
            "case_id": att.case_id,
            "document_id": att.document_id,
            "document_filename": att.document.filename if att.document else "Unknown Document",
            "document_status": att.document.status if att.document else "unknown",
            "document_review_status": att.document.review_status if att.document else "pending",
            "document_sha256": att.document.sha256_hash if att.document else "",
            "is_restricted": att.document.is_restricted if att.document else False,
            "access_level": att.access_level,
            "notes": att.notes,
            "attached_by_id": att.attached_by_id,
            "attached_at": att.attached_at
        })

    return {
        "id": case.id,
        "case_ref": case.case_ref,
        "title": case.title,
        "description": case.description,
        "parcel_identifier": case.parcel_identifier,
        "village": case.village,
        "tehsil": case.tehsil,
        "district": case.district,
        "status": case.status,
        "created_by_id": case.created_by_id,
        "created_at": case.created_at,
        "updated_at": case.updated_at,
        "attachments_count": len(attachments_list),
        "attachments": attachments_list,
        "disclaimer": settings.DEMO_DISCLAIMER
    }


@router.post("", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
def create_case(
    req: CaseCreateRequest,
    current_user: User = Depends(require_roles(["admin", "clerk"])),
    db: Session = Depends(get_db)
):
    """
    Creates a new parcel/case bundle.
    Generates a unique case reference if not explicitly supplied.
    """
    ref = req.case_ref
    if not ref or not ref.strip():
        date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        rnd_hex = uuid.uuid4().hex[:6].upper()
        ref = f"CASE-UP-{date_str}-{rnd_hex}"
    else:
        ref = ref.strip().upper()
        # Verify uniqueness
        exists = db.query(CaseBundle).filter(CaseBundle.case_ref == ref).first()
        if exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Case reference '{ref}' is already in use."
            )

    case = CaseBundle(
        case_ref=ref,
        title=req.title.strip(),
        description=req.description.strip() if req.description else None,
        parcel_identifier=req.parcel_identifier.strip() if req.parcel_identifier else None,
        village=req.village.strip() if req.village else None,
        tehsil=req.tehsil.strip() if req.tehsil else None,
        district=req.district.strip() if req.district else None,
        status=req.status or "open",
        created_by_id=current_user.id
    )
    db.add(case)
    db.commit()
    db.refresh(case)

    return _format_case_response(case)


@router.get("", response_model=CaseListResponse)
def list_cases(
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    village: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lists parcel/case bundles with search and status filtering.
    """
    query = db.query(CaseBundle)

    if status_filter and status_filter != "all":
        query = query.filter(CaseBundle.status == status_filter)

    if village:
        query = query.filter(CaseBundle.village.ilike(f"%{village.strip()}%"))

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                CaseBundle.case_ref.ilike(s),
                CaseBundle.title.ilike(s),
                CaseBundle.parcel_identifier.ilike(s),
                CaseBundle.village.ilike(s)
            )
        )

    cases = query.order_by(desc(CaseBundle.created_at)).all()
    formatted = [_format_case_response(c) for c in cases]

    return {
        "items": formatted,
        "total": len(formatted),
        "disclaimer": settings.DEMO_DISCLAIMER
    }


@router.get("/{id}", response_model=CaseResponse)
def get_case(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves full case bundle details and attached documents."""
    case = db.query(CaseBundle).filter(CaseBundle.id == id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case bundle not found.")

    return _format_case_response(case)


@router.post("/{id}/documents", response_model=CaseResponse)
def attach_document_to_case(
    id: str,
    req: CaseAttachDocumentRequest,
    current_user: User = Depends(require_roles(["admin", "clerk"])),
    db: Session = Depends(get_db)
):
    """
    Attaches a document to the case bundle with a designated access level.
    (Access levels: public, internal, confidential, restricted).
    """
    case = db.query(CaseBundle).filter(CaseBundle.id == id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case bundle not found.")

    document = db.query(Document).filter(Document.id == req.document_id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document to attach not found.")

    verify_document_object_access(document, current_user)

    # Check if already attached
    existing = db.query(CaseDocumentAttachment).filter(
        CaseDocumentAttachment.case_id == case.id,
        CaseDocumentAttachment.document_id == document.id
    ).first()

    if existing:
        existing.access_level = req.access_level
        existing.notes = req.notes
    else:
        attachment = CaseDocumentAttachment(
            case_id=case.id,
            document_id=document.id,
            access_level=req.access_level,
            notes=req.notes,
            attached_by_id=current_user.id
        )
        db.add(attachment)

    log_audit_event(
        db=db,
        document_id=document.id,
        user_id=current_user.id,
        action="DOCUMENT_ATTACHED_TO_CASE",
        details={
            "case_id": case.id,
            "case_ref": case.case_ref,
            "access_level": req.access_level,
            "notes": req.notes
        }
    )

    db.commit()
    db.refresh(case)
    return _format_case_response(case)


@router.delete("/{id}/documents/{attachment_id}")
def detach_document_from_case(
    id: str,
    attachment_id: str,
    current_user: User = Depends(require_roles(["admin", "clerk"])),
    db: Session = Depends(get_db)
):
    """Detaches a document from the case bundle."""
    case = db.query(CaseBundle).filter(CaseBundle.id == id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case bundle not found.")

    att = db.query(CaseDocumentAttachment).filter(
        CaseDocumentAttachment.id == attachment_id,
        CaseDocumentAttachment.case_id == case.id
    ).first()

    if not att:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found in this case.")

    doc_id = att.document_id
    db.delete(att)
    db.commit()

    log_audit_event(
        db=db,
        document_id=doc_id,
        user_id=current_user.id,
        action="DOCUMENT_DETACHED_FROM_CASE",
        details={"case_id": case.id, "case_ref": case.case_ref}
    )

    return {"message": "Document detached successfully.", "case_id": case.id}


@router.patch("/{id}", response_model=CaseResponse)
def update_case(
    id: str,
    req: CaseUpdateRequest,
    current_user: User = Depends(require_roles(["admin", "clerk"])),
    db: Session = Depends(get_db)
):
    """Updates case title, description, status, or parcel attributes."""
    case = db.query(CaseBundle).filter(CaseBundle.id == id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case bundle not found.")

    if req.title is not None:
        case.title = req.title.strip()
    if req.description is not None:
        case.description = req.description.strip()
    if req.status is not None:
        case.status = req.status.strip()
    if req.parcel_identifier is not None:
        case.parcel_identifier = req.parcel_identifier.strip()
    if req.village is not None:
        case.village = req.village.strip()
    if req.tehsil is not None:
        case.tehsil = req.tehsil.strip()
    if req.district is not None:
        case.district = req.district.strip()

    db.commit()
    db.refresh(case)
    return _format_case_response(case)
