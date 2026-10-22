import os
import uuid
import json
import secrets
import hashlib
import io
import base64
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, Query, BackgroundTasks, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
import qrcode

from backend.app.config import settings
from backend.app.database import get_db, SessionLocal
from backend.app.models.entities import User, Document, AuditEvent, DocumentPage, LandRecord, FieldEvidence, RecordVersion, VerificationCheck, ShareToken
from backend.app.schemas.document import (
    DocumentResponse,
    DocumentListResponse,
    DocumentProcessingResponse,
    DocumentPageResponse,
    FieldCorrectionRequest,
    CorrectionSuccessResponse,
    LandRecordResponse,
    VerificationCheckResponse,
    VerificationSummaryResponse,
    ReviewDecisionRequest,
    ReviewDecisionResponse,
    ShareTokenCreateRequest,
    ShareTokenCreatedResponse,
    ShareTokenResponse
)
from backend.app.schemas.audit import AuditEventResponse
from backend.app.security.auth import get_current_user
from backend.app.security.permissions import require_roles, verify_document_object_access
from backend.app.providers.file_validator import process_and_validate_upload
from backend.app.services.audit import log_audit_event
from backend.app.services.ocr import extract_and_persist_document_ocr
from backend.app.services.validation import ValidationEngine

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    record_type: Optional[str] = Form("Khatauni (ROR)"),
    district: Optional[str] = Form(None),
    tehsil: Optional[str] = Form(None),
    village: Optional[str] = Form(None),
    is_restricted: bool = Form(False),
    current_user: User = Depends(require_roles(["admin", "clerk"])),
    db: Session = Depends(get_db)
):
    """
    Upload a land record document.
    - Restricted to Clerk and Admin roles.
    - Validates binary magic bytes (PDF, JPG, PNG).
    - Enforces 10MB limit.
    - Saves outside public webroot.
    - Computes SHA-256 and detects duplicate files.
    - Creates document record and logs an append-only audit event.
    """
    doc_id = str(uuid.uuid4())

    # Process and validate file binary content & size
    final_path, mime_type, file_size, sha256_hash = await process_and_validate_upload(
        upload_file=file,
        target_dir=settings.UPLOAD_DIR,
        doc_id=doc_id
    )

    # Duplicate hash check
    existing_doc = db.query(Document).filter(Document.sha256_hash == sha256_hash).first()
    if existing_doc:
        # Clean up newly written duplicate file
        if os.path.exists(final_path):
            try:
                os.remove(final_path)
            except OSError:
                pass

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "warning": "Duplicate document detected.",
                "message": "A document with the exact same SHA-256 hash has already been registered. A second record was not created.",
                "existing_document_id": existing_doc.id,
                "sha256_hash": sha256_hash,
                "disclaimer": settings.DEMO_DISCLAIMER
            }
        )

    # Persist Document record
    document = Document(
        id=doc_id,
        filename=file.filename or f"upload_{doc_id}",
        file_path=final_path,
        file_size_bytes=file_size,
        mime_type=mime_type,
        sha256_hash=sha256_hash,
        status="uploaded",
        record_type=record_type,
        district=district,
        tehsil=tehsil,
        village=village,
        is_restricted=is_restricted,
        uploaded_by_id=current_user.id
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    # Write append-only audit event
    log_audit_event(
        db=db,
        document_id=document.id,
        action="DOCUMENT_UPLOADED",
        user_id=current_user.id,
        details={
            "filename": document.filename,
            "file_size_bytes": file_size,
            "mime_type": mime_type,
            "sha256_hash": sha256_hash,
            "status": document.status,
            "record_type": record_type,
            "district": district,
            "tehsil": tehsil,
            "village": village,
            "is_restricted": is_restricted
        }
    )

    return document

@router.get("", response_model=DocumentListResponse)
def list_documents(
    status: Optional[str] = Query(None, description="Filter by document status"),
    village: Optional[str] = Query(None, description="Filter by village name"),
    search: Optional[str] = Query(None, description="Search text across filename, village, district, or tehsil"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List land records with filters and object-level permission enforcement.
    Viewers are strictly prevented from viewing restricted documents (excluded from results).
    """
    query = db.query(Document)

    # Object-level check: Viewers must not see restricted documents
    if current_user.role == "viewer":
        query = query.filter(Document.is_restricted == False)

    if status:
        query = query.filter(Document.status == status)

    if village:
        query = query.filter(Document.village.ilike(f"%{village}%"))

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Document.filename.ilike(search_filter),
                Document.village.ilike(search_filter),
                Document.district.ilike(search_filter),
                Document.tehsil.ilike(search_filter)
            )
        )

    items = query.order_by(Document.created_at.desc()).all()

    return {
        "items": items,
        "total": len(items),
        "disclaimer": settings.DEMO_DISCLAIMER
    }

@router.get("/{id}", response_model=DocumentResponse)
def get_document(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a single document by ID.
    Enforces object-level check: Viewers cannot see restricted documents (returns 404 to avoid leaking metadata).
    """
    document = db.query(Document).filter(Document.id == id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    # Object-level permission check: viewers cannot see restricted records (returns 404)
    verify_document_object_access(document, current_user)

    # Append audit event for document access
    log_audit_event(
        db=db,
        document_id=document.id,
        action="DOCUMENT_ACCESSED",
        user_id=current_user.id,
        details={"accessed_by_role": current_user.role}
    )

    return document

@router.get("/{id}/audit", response_model=List[AuditEventResponse])
def get_document_audit_timeline(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get append-only audit trail timeline for a document.
    Subject to object-level access verification.
    """
    document = db.query(Document).filter(Document.id == id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    verify_document_object_access(document, current_user)

    audit_events = (
        db.query(AuditEvent)
        .filter(AuditEvent.document_id == id)
        .order_by(AuditEvent.timestamp.asc())
        .all()
    )
    return audit_events

def run_background_ocr_processing(doc_id: str, user_id: str):
    """
    Background worker that runs the full OCR pipeline, updates document status,
    persists per-page text & bounding boxes, logs audit events at each stage,
    and guarantees the original uploaded file is never lost or modified on failure.
    """
    db = SessionLocal()
    try:
        document = db.query(Document).filter(Document.id == doc_id).first()
        if not document:
            return

        # Transition status to 'processing'
        document.status = "processing"
        document.processing_error = None
        db.commit()

        # Audit stage: OCR_PROCESSING_STARTED
        log_audit_event(
            db=db,
            document_id=document.id,
            action="OCR_PROCESSING_STARTED",
            user_id=user_id,
            details={
                "filename": document.filename,
                "file_path": document.file_path,
                "status": "processing"
            }
        )

        # Run OCR extraction & persistence
        summary = extract_and_persist_document_ocr(db=db, document=document)

        # Audit stage: OCR_COMPLETED
        log_audit_event(
            db=db,
            document_id=document.id,
            action="OCR_COMPLETED",
            user_id=user_id,
            details={
                "pages": summary["page_count"],
                "total_words": summary["total_words"],
                "avg_confidence": summary["avg_confidence"],
                "final_status": "done"
            }
        )

        # Run deterministic regex/rule field extraction and persist to land_records & field_evidence
        try:
            from backend.app.services.extraction import extract_and_persist_document
            land_record = extract_and_persist_document(db=db, document=document)
            log_audit_event(
                db=db,
                document_id=document.id,
                action="FIELD_EXTRACTION_COMPLETED",
                user_id=user_id,
                details={
                    "land_record_id": land_record.id,
                    "overall_confidence": land_record.overall_confidence,
                    "needs_review": land_record.needs_review,
                    "owner_name": land_record.owner_name,
                    "district": land_record.district,
                    "tehsil": land_record.tehsil,
                    "village": land_record.village,
                    "khata_no": land_record.khata_no,
                    "khasra_gata_no": land_record.khasra_gata_no,
                    "area": land_record.area
                }
            )
        except Exception as extract_err:
            log_audit_event(
                db=db,
                document_id=document.id,
                action="FIELD_EXTRACTION_FAILED",
                user_id=user_id,
                details={"error": str(extract_err)}
            )

    except Exception as exc:
        try:
            document = db.query(Document).filter(Document.id == doc_id).first()
            if document:
                document.status = "failed"
                document.processing_error = f"OCR Processing Failure: {str(exc)}"
                db.commit()

                # Audit stage: OCR_FAILED (Original upload preserved safely)
                log_audit_event(
                    db=db,
                    document_id=document.id,
                    action="OCR_FAILED",
                    user_id=user_id,
                    details={
                        "error": str(exc),
                        "human_readable_message": "An error occurred during OCR text extraction or rendering. Original file remained intact.",
                        "file_path": document.file_path,
                        "status": "failed"
                    }
                )
        except Exception:
            pass
    finally:
        db.close()

@router.post("/{id}/process", response_model=DocumentProcessingResponse)
def process_document_endpoint(
    id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_roles(["admin", "clerk"])),
    db: Session = Depends(get_db)
):
    """
    Trigger OCR digitization and text extraction as a background job.
    - Status transitions: queued -> processing -> done / failed.
    - Idempotent: returns existing state if already queued, processing, or done.
    - Human-readable error messages.
    - Preserves original file without loss on failure.
    - Audit logs each stage.
    """
    document = db.query(Document).filter(Document.id == id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    verify_document_object_access(document, current_user)

    # Idempotency checks:
    if document.status in ["queued", "processing"]:
        return {
            "message": f"Document is already in '{document.status}' state. OCR processing job is currently running.",
            "document_id": document.id,
            "status": document.status,
            "is_already_processed": False,
            "disclaimer": settings.DEMO_DISCLAIMER
        }

    if document.status == "done":
        return {
            "message": "Document has already been successfully processed by OCR pipeline.",
            "document_id": document.id,
            "status": document.status,
            "is_already_processed": True,
            "disclaimer": settings.DEMO_DISCLAIMER
        }

    # Set document status to queued
    document.status = "queued"
    document.processing_error = None
    db.commit()

    # Log audit event for queuing
    log_audit_event(
        db=db,
        document_id=document.id,
        action="OCR_QUEUED",
        user_id=current_user.id,
        details={
            "status": "queued",
            "triggered_by": current_user.email,
            "filename": document.filename
        }
    )

    # Schedule asynchronous worker
    background_tasks.add_task(run_background_ocr_processing, document.id, current_user.id)

    return {
        "message": "Document successfully queued for background OCR extraction and validation.",
        "document_id": document.id,
        "status": "queued",
        "is_already_processed": False,
        "disclaimer": settings.DEMO_DISCLAIMER
    }

@router.get("/{id}/pages", response_model=List[DocumentPageResponse])
def get_document_pages(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get per-page OCR raw text, word count, confidence, and bounding boxes.
    Subject to object-level access verification.
    """
    document = db.query(Document).filter(Document.id == id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    verify_document_object_access(document, current_user)
    return document.pages

@router.get("/{id}/land-record", response_model=LandRecordResponse)
def get_document_land_record(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get extracted structured land record, field-level evidence, and historical correction versions.
    """
    document = db.query(Document).filter(Document.id == id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    verify_document_object_access(document, current_user)

    if not document.land_record:
        # If OCR text exists, extract on demand
        if document.pages or document.raw_ocr_text:
            from backend.app.services.extraction import extract_and_persist_document
            document.land_record = extract_and_persist_document(db=db, document=document)
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Land record extraction not yet performed on this document.")

    lr = document.land_record

    evidence_list = []
    for fe in lr.evidence_fields:
        active_val = fe.corrected_value if fe.corrected_value is not None else fe.extracted_value
        evidence_list.append({
            "id": fe.id,
            "field_name": fe.field_name,
            "extracted_value": fe.extracted_value,
            "corrected_value": fe.corrected_value,
            "active_value": active_val,
            "is_corrected": fe.corrected_value is not None,
            "confidence": fe.confidence,
            "evidence_text": fe.evidence_text,
            "page_no": fe.page_no,
            "needs_review": fe.needs_review,
            "rule_matched": fe.rule_matched,
            "correction_reason": fe.correction_reason,
            "corrected_by_id": fe.corrected_by_id,
            "corrected_at": fe.corrected_at,
            "version": fe.version
        })

    version_list = []
    for v in lr.versions:
        try:
            changes_dict = json.loads(v.changes) if isinstance(v.changes, str) else v.changes
        except Exception:
            changes_dict = {}
        version_list.append({
            "id": v.id,
            "version_number": v.version_number,
            "created_by_id": v.created_by_id,
            "created_by_email": v.created_by.email if v.created_by else None,
            "reason": v.reason,
            "changes": changes_dict,
            "created_at": v.created_at
        })

    return {
        "id": lr.id,
        "document_id": lr.document_id,
        "owner_name": lr.owner_name,
        "district": lr.district,
        "tehsil": lr.tehsil,
        "village": lr.village,
        "khata_no": lr.khata_no,
        "khasra_gata_no": lr.khasra_gata_no,
        "area": lr.area,
        "land_class": lr.land_class,
        "mutation_ref": lr.mutation_ref,
        "overall_confidence": lr.overall_confidence,
        "needs_review": lr.needs_review,
        "current_version": lr.current_version,
        "created_at": lr.created_at,
        "updated_at": lr.updated_at,
        "evidence_fields": evidence_list,
        "versions": version_list,
        "disclaimer": settings.DEMO_DISCLAIMER
    }

@router.patch("/{id}/fields", response_model=CorrectionSuccessResponse)
def patch_document_fields(
    id: str,
    payload: FieldCorrectionRequest,
    current_user: User = Depends(require_roles(["admin", "clerk"])),
    db: Session = Depends(get_db)
):
    """
    Apply human reviewer corrections to extracted cadastral fields:
    - Requires clerk or admin role (viewers receive 403 Forbidden).
    - Requires non-empty mandatory justification reason.
    - Keeps raw `extracted_value` and human `corrected_value` strictly separate.
    - Creates a new immutable RecordVersion snapshot (never overwrites history).
    - Logs an append-only AuditEvent with old/new/actor/reason.
    - Updates active LandRecord and re-evaluates review flags.
    """
    document = db.query(Document).filter(Document.id == id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    verify_document_object_access(document, current_user)

    if not payload.reason or not payload.reason.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A mandatory reason is required to log field corrections in the audit ledger."
        )

    try:
        from backend.app.services.extraction import apply_field_corrections
        land_record, record_version, changes = apply_field_corrections(
            db=db,
            document_id=document.id,
            corrections=payload.corrections,
            reason=payload.reason,
            actor_user=current_user
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Correction failed: {str(exc)}")

    # Format response
    evidence_list = []
    for fe in land_record.evidence_fields:
        active_val = fe.corrected_value if fe.corrected_value is not None else fe.extracted_value
        evidence_list.append({
            "id": fe.id,
            "field_name": fe.field_name,
            "extracted_value": fe.extracted_value,
            "corrected_value": fe.corrected_value,
            "active_value": active_val,
            "is_corrected": fe.corrected_value is not None,
            "confidence": fe.confidence,
            "evidence_text": fe.evidence_text,
            "page_no": fe.page_no,
            "needs_review": fe.needs_review,
            "rule_matched": fe.rule_matched,
            "correction_reason": fe.correction_reason,
            "corrected_by_id": fe.corrected_by_id,
            "corrected_at": fe.corrected_at,
            "version": fe.version
        })

    version_list = []
    for v in land_record.versions:
        try:
            changes_dict = json.loads(v.changes) if isinstance(v.changes, str) else v.changes
        except Exception:
            changes_dict = {}
        version_list.append({
            "id": v.id,
            "version_number": v.version_number,
            "created_by_id": v.created_by_id,
            "created_by_email": v.created_by.email if v.created_by else None,
            "reason": v.reason,
            "changes": changes_dict,
            "created_at": v.created_at
        })

    lr_response = {
        "id": land_record.id,
        "document_id": land_record.document_id,
        "owner_name": land_record.owner_name,
        "district": land_record.district,
        "tehsil": land_record.tehsil,
        "village": land_record.village,
        "khata_no": land_record.khata_no,
        "khasra_gata_no": land_record.khasra_gata_no,
        "area": land_record.area,
        "land_class": land_record.land_class,
        "mutation_ref": land_record.mutation_ref,
        "overall_confidence": land_record.overall_confidence,
        "needs_review": land_record.needs_review,
        "current_version": land_record.current_version,
        "created_at": land_record.created_at,
        "updated_at": land_record.updated_at,
        "evidence_fields": evidence_list,
        "versions": version_list,
        "disclaimer": settings.DEMO_DISCLAIMER
    }

    return {
        "message": f"Successfully applied field corrections. Revision version {land_record.current_version} created.",
        "document_id": document.id,
        "version_number": land_record.current_version,
        "applied_changes": changes,
        "land_record": lr_response,
        "disclaimer": settings.DEMO_DISCLAIMER
    }

@router.get("/{id}/pages/{page_num}/image")
def get_document_page_image(
    id: str,
    page_num: int = 1,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Renders or serves a high-resolution image of the requested document page.
    - PDFs rendered to PNG bytes via PyMuPDF.
    - JPG/PNG served directly with proper MIME type.
    - Strictly authenticated and permission-controlled.
    """
    document = db.query(Document).filter(Document.id == id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    verify_document_object_access(document, current_user)

    if not os.path.exists(document.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Physical document file not found on storage.")

    ext = os.path.splitext(document.file_path)[1].lower()

    if ext == ".pdf":
        try:
            import pymupdf
            doc = pymupdf.open(document.file_path)
            try:
                total_pages = len(doc)
                if page_num < 1 or page_num > total_pages:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Requested page {page_num} out of bounds. Document contains {total_pages} pages."
                    )
                page = doc.load_page(page_num - 1)
                pix = page.get_pixmap(dpi=150)
                img_bytes = pix.tobytes("png")
                return Response(content=img_bytes, media_type="image/png")
            finally:
                doc.close()
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to render PDF page: {str(exc)}")

    elif ext in [".jpg", ".jpeg", ".png"]:
        return FileResponse(document.file_path, media_type=document.mime_type)

    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Format {ext} cannot be previewed.")

def _format_verification_response(document_id: str, checks: List[VerificationCheck]) -> dict:
    """Helper to assemble structured verification response with by_layer grouping."""
    by_layer = {
        "file_integrity": [],
        "registry_match": [],
        "human_review": []
    }
    has_failed = False
    has_review = False
    has_not_checked = False

    formatted_checks = []
    for c in checks:
        parsed_details = None
        if c.details:
            try:
                parsed_details = json.loads(c.details)
            except Exception:
                parsed_details = {"raw": c.details}

        check_dict = {
            "id": c.id,
            "document_id": c.document_id,
            "layer": c.layer,
            "check_type": c.check_type,
            "source_name": c.source_name,
            "status": c.status,
            "label": c.label,
            "details": parsed_details,
            "created_at": c.created_at
        }
        formatted_checks.append(check_dict)
        if c.layer in by_layer:
            by_layer[c.layer].append(check_dict)
        else:
            by_layer[c.layer] = [check_dict]

        if c.status == "failed":
            has_failed = True
        elif c.status == "review_required":
            has_review = True
        elif c.status == "not_checked":
            has_not_checked = True

    overall_status = "verified"
    if has_failed:
        overall_status = "failed"
    elif has_review:
        overall_status = "review_required"
    elif has_not_checked:
        overall_status = "not_checked"

    return {
        "document_id": document_id,
        "total_checks": len(checks),
        "status": overall_status,
        "checks": formatted_checks,
        "by_layer": by_layer,
        "disclaimer": settings.DEMO_DISCLAIMER
    }

@router.post("/{id}/verify", response_model=VerificationSummaryResponse)
def verify_document(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Executes multi-layered verification on the specified document:
    1. File Integrity Layer (SHA-256 rehash, duplicate detection)
    2. Demo Registry Match (official/demo source comparison, ID match, spelling diff, impossible area)
    3. Human Review Governance (version audit, manual changes)

    Stores each check separately in `verification_checks` table with check_type, source_name and details.
    """
    document = db.query(Document).filter(Document.id == id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    verify_document_object_access(document, current_user)

    engine = ValidationEngine()
    checks = engine.run_all_checks(db, document)

    # Clean existing checks for clean idempotent state
    db.query(VerificationCheck).filter(VerificationCheck.document_id == document.id).delete()

    for c in checks:
        db.add(c)

    log_audit_event(
        db=db,
        document_id=document.id,
        user_id=current_user.id,
        action="DOCUMENT_VERIFIED",
        details={
            "total_checks": len(checks),
            "checks_summary": [{"layer": c.layer, "type": c.check_type, "status": c.status, "label": c.label} for c in checks]
        }
    )

    db.commit()

    # Re-query saved checks
    saved_checks = db.query(VerificationCheck).filter(
        VerificationCheck.document_id == document.id
    ).order_by(VerificationCheck.created_at.asc()).all()

    return _format_verification_response(document.id, saved_checks)

@router.get("/{id}/verifications", response_model=VerificationSummaryResponse)
def get_document_verifications(
    id: str,
    auto_run: bool = Query(True, description="Automatically run verification if no prior checks exist"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves stored verification checks for a document, categorized across the 3 layers.
    If no checks have been recorded yet and auto_run is true, triggers an initial verification run.
    """
    document = db.query(Document).filter(Document.id == id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    verify_document_object_access(document, current_user)

    checks = db.query(VerificationCheck).filter(
        VerificationCheck.document_id == document.id
    ).order_by(VerificationCheck.created_at.asc()).all()

    if not checks and auto_run:
        engine = ValidationEngine()
        checks = engine.run_all_checks(db, document)
        for c in checks:
            db.add(c)
        db.commit()
        checks = db.query(VerificationCheck).filter(
            VerificationCheck.document_id == document.id
        ).order_by(VerificationCheck.created_at.asc()).all()

    return _format_verification_response(document.id, checks)

@router.post("/{id}/review", response_model=ReviewDecisionResponse)
def review_document(
    id: str,
    req: ReviewDecisionRequest,
    current_user: User = Depends(require_roles(["admin", "reviewer"])),
    db: Session = Depends(get_db)
):
    """
    Submits a formal review decision on a document (approve, reject, or request_changes).
    - Reviewer only (Admin or Reviewer).
    - Mandatory audit reason (minimum 3 characters).
    - Records an immutable AuditEvent in the cryptographic audit trail.
    """
    document = db.query(Document).filter(Document.id == id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    verify_document_object_access(document, current_user)

    action = req.action.lower().strip()
    allowed_actions = {"approve": "approved", "reject": "rejected", "request_changes": "changes_requested"}
    if action not in allowed_actions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid review action: '{req.action}'. Allowed actions: 'approve', 'reject', 'request_changes'."
        )

    if not req.reason or len(req.reason.strip()) < 3:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A mandatory justification reason must be provided (minimum 3 characters)."
        )

    old_status = document.review_status or "pending"
    new_status = allowed_actions[action]

    document.review_status = new_status
    document.reviewed_by_id = current_user.id
    document.reviewed_at = datetime.now(timezone.utc)
    document.review_reason = req.reason.strip()

    # Log immutable audit event
    log_audit_event(
        db=db,
        document_id=document.id,
        user_id=current_user.id,
        action="DOCUMENT_REVIEWED",
        details={
            "action": action,
            "old_review_status": old_status,
            "new_review_status": new_status,
            "reason": req.reason.strip(),
            "reviewer_email": current_user.email
        }
    )

    db.commit()
    db.refresh(document)

    return {
        "message": f"Document successfully {new_status}.",
        "document_id": document.id,
        "review_status": document.review_status,
        "reviewed_by_id": current_user.id,
        "reviewed_at": document.reviewed_at,
        "reason": document.review_reason,
        "disclaimer": settings.DEMO_DISCLAIMER
    }

def _generate_qr_data_url(data: str) -> str:
    """Generate base64 encoded PNG data URL for QR code containing only public URL."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{qr_b64}"

@router.post("/{id}/share-token", response_model=ShareTokenCreatedResponse)
def create_share_token(
    id: str,
    req: ShareTokenCreateRequest = ShareTokenCreateRequest(),
    current_user: User = Depends(require_roles(["admin", "reviewer"])),
    db: Session = Depends(get_db)
):
    """
    Generates a cryptographically secure public verification share token.
    SECURITY SPECIFICATIONS:
    - Only available when document review_status == 'approved'.
    - Generates 256-bit cryptographically random token.
    - Stores ONLY its SHA-256 hash in database; cleartext token returned to caller only once.
    - Generates QR code encoding ONLY https://<BASE_URL>/verify/<token> (strictly no personal PII in the QR).
    - Supports expiry and revocation.
    """
    document = db.query(Document).filter(Document.id == id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    verify_document_object_access(document, current_user)

    if document.review_status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Share tokens can only be generated for approved documents. Current review status: '{document.review_status}'."
        )

    # Cryptographically random token (256-bit entropy)
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    expiry_hours = req.expires_in_hours or settings.DEFAULT_SHARE_TOKEN_EXPIRE_HOURS
    expires_at = datetime.now(timezone.utc) + timedelta(hours=expiry_hours)

    share_token = ShareToken(
        document_id=document.id,
        token_hash=token_hash,
        created_by_id=current_user.id,
        expires_at=expires_at
    )
    db.add(share_token)

    # QR Code encodes ONLY the public verification URL (No PII)
    verify_url = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/verify/{raw_token}"
    qr_data_url = _generate_qr_data_url(verify_url)

    # Immutable audit event
    log_audit_event(
        db=db,
        document_id=document.id,
        user_id=current_user.id,
        action="SHARE_TOKEN_GENERATED",
        details={
            "token_id": share_token.id,
            "token_hash_prefix": token_hash[:16],
            "expires_at": expires_at.isoformat(),
            "expires_in_hours": expiry_hours
        }
    )

    db.commit()
    db.refresh(share_token)

    return {
        "token_id": share_token.id,
        "token": raw_token,
        "token_hash": token_hash,
        "verify_url": verify_url,
        "qr_code_data_url": qr_data_url,
        "expires_at": share_token.expires_at,
        "created_at": share_token.created_at,
        "disclaimer": settings.DEMO_DISCLAIMER
    }

@router.get("/{id}/share-tokens", response_model=List[ShareTokenResponse])
def get_share_tokens(
    id: str,
    current_user: User = Depends(require_roles(["admin", "reviewer"])),
    db: Session = Depends(get_db)
):
    """Lists existing share tokens for an approved document."""
    document = db.query(Document).filter(Document.id == id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    verify_document_object_access(document, current_user)

    tokens = db.query(ShareToken).filter(ShareToken.document_id == document.id).order_by(ShareToken.created_at.desc()).all()
    response = []
    for t in tokens:
        response.append({
            "id": t.id,
            "document_id": t.document_id,
            "created_at": t.created_at,
            "expires_at": t.expires_at,
            "is_revoked": t.is_revoked,
            "revoked_at": t.revoked_at,
            "verify_url": f"{settings.PUBLIC_BASE_URL.rstrip('/')}/verify/[TOKEN_HASH_REDACTED]",
            "qr_code_data_url": None,
            "disclaimer": settings.DEMO_DISCLAIMER
        })
    return response

@router.post("/{id}/share-tokens/{token_id}/revoke")
def revoke_share_token(
    id: str,
    token_id: str,
    current_user: User = Depends(require_roles(["admin", "reviewer"])),
    db: Session = Depends(get_db)
):
    """Revokes an active share token immediately."""
    document = db.query(Document).filter(Document.id == id).first()
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    verify_document_object_access(document, current_user)

    token = db.query(ShareToken).filter(
        ShareToken.id == token_id,
        ShareToken.document_id == document.id
    ).first()

    if not token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share token not found.")

    if token.is_revoked:
        return {"message": "Share token is already revoked.", "token_id": token.id, "is_revoked": True}

    token.is_revoked = True
    token.revoked_at = datetime.now(timezone.utc)
    token.revoked_by_id = current_user.id

    log_audit_event(
        db=db,
        document_id=document.id,
        user_id=current_user.id,
        action="SHARE_TOKEN_REVOKED",
        details={
            "token_id": token.id,
            "revoked_at": token.revoked_at.isoformat(),
            "revoker_email": current_user.email
        }
    )

    db.commit()
    return {"message": "Share token revoked successfully.", "token_id": token.id, "is_revoked": True}



