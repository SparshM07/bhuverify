import json
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, desc

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models.entities import User, Document, LandRecord, VerificationCheck, AuditEvent, CaseBundle, CaseDocumentAttachment
from backend.app.schemas.dashboard import (
    DashboardMetricsResponse,
    ConfidenceBucket,
    RecentActivityItem,
    GlobalSearchResponse,
    SearchResultItem
)
from backend.app.security.auth import get_current_user

router = APIRouter(tags=["Dashboard & Search"])

def _get_document_filter(user: User):
    """Returns SQLAlchemy filter clause scoped by user role confidentiality."""
    if user.role == "admin":
        return True  # Admins see everything
    elif user.role == "clerk":
        return or_(Document.is_restricted == False, Document.uploaded_by_id == user.id)
    else:
        return Document.is_restricted == False


@router.get("/dashboard/metrics", response_model=DashboardMetricsResponse)
def get_dashboard_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Computes system-wide operational metrics scoped by the caller's role:
    - Total accessible documents and case bundles
    - In-progress OCR processing count
    - Records requiring clerk/admin review
    - Verification mismatches and red flags
    - Approved records
    - OCR confidence distribution histogram
    - Recent audit activity feed
    """
    doc_filter = _get_document_filter(current_user)

    # Base query for accessible documents
    accessible_docs_q = db.query(Document).filter(doc_filter)
    total_docs = accessible_docs_q.count()

    # Processing count
    processing_count = db.query(Document).filter(
        doc_filter,
        Document.status.in_(["uploaded", "queued", "processing"])
    ).count()

    # Approved count
    approved_count = db.query(Document).filter(
        doc_filter,
        Document.review_status == "approved"
    ).count()

    # Needs review count (either land record needs review or review_status is pending/changes_requested/needs_review)
    needs_review_count = db.query(Document).outerjoin(LandRecord).filter(
        doc_filter,
        or_(
            LandRecord.needs_review == True,
            Document.review_status.in_(["pending", "changes_requested", "needs_review"])
        )
    ).count()

    # Mismatches / Red flags count
    mismatches_count = db.query(Document).join(VerificationCheck).filter(
        doc_filter,
        VerificationCheck.status == "failed"
    ).distinct().count()

    # Case bundles count
    total_cases = db.query(CaseBundle).count()

    # OCR confidence distribution
    confidences = db.query(LandRecord.overall_confidence).join(Document).filter(
        doc_filter
    ).all()

    buckets_def = [
        {"bucket": "90-100%", "label": "High Confidence (≥90%)", "min": 90.0, "max": 100.01},
        {"bucket": "80-89%", "label": "Standard (80-89%)", "min": 80.0, "max": 90.0},
        {"bucket": "70-79%", "label": "Moderate (70-79%)", "min": 70.0, "max": 80.0},
        {"bucket": "50-69%", "label": "Low / Review Req (50-69%)", "min": 50.0, "max": 70.0},
        {"bucket": "<50%", "label": "Critical / Incomplete (<50%)", "min": 0.0, "max": 50.0},
    ]

    total_records = len(confidences)
    bucket_counts = {b["bucket"]: 0 for b in buckets_def}

    for (c,) in confidences:
        val = float(c or 0.0)
        for b in buckets_def:
            if b["min"] <= val < b["max"]:
                bucket_counts[b["bucket"]] += 1
                break

    dist_list: List[ConfidenceBucket] = []
    for b in buckets_def:
        count = bucket_counts[b["bucket"]]
        pct = round((count / total_records * 100), 1) if total_records > 0 else 0.0
        dist_list.append(ConfidenceBucket(
            bucket=b["bucket"],
            label=b["label"],
            count=count,
            percentage=pct
        ))

    # Recent activity
    recent_events = db.query(AuditEvent).join(Document).filter(
        doc_filter
    ).order_by(AuditEvent.timestamp.desc()).limit(10).all()

    activity_list: List[RecentActivityItem] = []
    for ev in recent_events:
        parsed_dt = None
        if ev.details:
            try:
                parsed_dt = json.loads(ev.details)
            except Exception:
                parsed_dt = {"raw": ev.details}

        activity_list.append(RecentActivityItem(
            id=ev.id,
            action=ev.action,
            document_id=ev.document_id,
            document_filename=ev.document.filename if ev.document else None,
            user_id=ev.user_id,
            details=parsed_dt,
            timestamp=ev.timestamp
        ))

    return DashboardMetricsResponse(
        role=current_user.role,
        total_documents=total_docs,
        total_cases=total_cases,
        processing=processing_count,
        needs_review=needs_review_count,
        mismatches=mismatches_count,
        approved=approved_count,
        confidence_distribution=dist_list,
        recent_activity=activity_list,
        disclaimer=settings.DEMO_DISCLAIMER
    )


@router.get("/search", response_model=GlobalSearchResponse)
def global_search(
    q: str = Query(..., min_length=1, description="Search query by khasra, khata, village, owner, or case ref"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Unified cadastral search querying across:
    - Khasra / Gata numbers
    - Khata numbers
    - Village / Gram Panchayat names
    - Landholder / Owner names
    - Case references & parcel identifiers
    Scoped by the authenticated caller's confidentiality permissions.
    """
    clean_q = q.strip()
    like_pat = f"%{clean_q}%"
    doc_filter = _get_document_filter(current_user)

    results: List[SearchResultItem] = []

    # 1. Search in Land Records (Owner, Khata, Khasra, Village)
    matching_records = db.query(LandRecord, Document).join(Document).filter(
        doc_filter,
        or_(
            LandRecord.khasra_gata_no.ilike(like_pat),
            LandRecord.khata_no.ilike(like_pat),
            LandRecord.owner_name.ilike(like_pat),
            LandRecord.village.ilike(like_pat),
            Document.village.ilike(like_pat),
            Document.filename.ilike(like_pat)
        )
    ).limit(30).all()

    for lr, doc in matching_records:
        matched_field = "document"
        matched_val = doc.filename
        if clean_q.lower() in (lr.owner_name or "").lower():
            matched_field = "owner_name"
            matched_val = lr.owner_name
        elif clean_q.lower() in (lr.khata_no or "").lower():
            matched_field = "khata_no"
            matched_val = lr.khata_no
        elif clean_q.lower() in (lr.khasra_gata_no or "").lower():
            matched_field = "khasra_gata_no"
            matched_val = lr.khasra_gata_no
        elif clean_q.lower() in (lr.village or doc.village or "").lower():
            matched_field = "village"
            matched_val = lr.village or doc.village

        results.append(SearchResultItem(
            result_type="document",
            id=doc.id,
            title=doc.filename,
            subtitle=f"Owner: {lr.owner_name or 'Unspecified'} | Khata: {lr.khata_no or '-'} | Khasra: {lr.khasra_gata_no or '-'}",
            matched_field=matched_field,
            matched_value=matched_val,
            link=f"/documents/{doc.id}",
            status=doc.review_status or doc.status,
            village=lr.village or doc.village,
            extra={
                "area": lr.area,
                "confidence": lr.overall_confidence,
                "district": lr.district or doc.district
            }
        ))

    # 2. Search in Case Bundles
    matching_cases = db.query(CaseBundle).filter(
        or_(
            CaseBundle.case_ref.ilike(like_pat),
            CaseBundle.title.ilike(like_pat),
            CaseBundle.parcel_identifier.ilike(like_pat),
            CaseBundle.village.ilike(like_pat)
        )
    ).limit(20).all()

    cases_count = len(matching_cases)
    docs_count = len(results)

    for cb in matching_cases:
        matched_field = "case_ref"
        matched_val = cb.case_ref
        if clean_q.lower() in cb.title.lower():
            matched_field = "title"
            matched_val = cb.title
        elif cb.parcel_identifier and clean_q.lower() in cb.parcel_identifier.lower():
            matched_field = "parcel_identifier"
            matched_val = cb.parcel_identifier

        results.append(SearchResultItem(
            result_type="case",
            id=cb.id,
            title=cb.title,
            subtitle=f"Ref: {cb.case_ref} | Parcel: {cb.parcel_identifier or '-'} | Village: {cb.village or '-'}",
            matched_field=matched_field,
            matched_value=matched_val,
            link=f"/cases?selected={cb.id}",
            status=cb.status,
            village=cb.village,
            extra={
                "district": cb.district,
                "attachments_count": len(cb.attachments)
            }
        ))

    return GlobalSearchResponse(
        query=clean_q,
        total_results=len(results),
        documents_count=docs_count,
        cases_count=cases_count,
        results=results,
        disclaimer=settings.DEMO_DISCLAIMER
    )
