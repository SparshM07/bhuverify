import os
import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models.entities import User, Document
from backend.app.schemas.admin import UserAdminResponse, UserUpdateRequest, AdminSourcesResponse, SourceStatusItem
from backend.app.security.permissions import require_roles
from backend.app.providers.base import DemoRegistryProvider

router = APIRouter(prefix="/admin", tags=["Admin Operations"])

@router.get("/users", response_model=List[UserAdminResponse])
def list_admin_users(
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db)
):
    """
    Lists all registered departmental users and their assigned roles.
    Restricted to Administrator role.
    """
    users = db.query(User).order_by(User.created_at.desc()).all()
    result = []
    for u in users:
        doc_count = db.query(Document).filter(Document.uploaded_by_id == u.id).count()
        result.append({
            "id": u.id,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at,
            "documents_count": doc_count
        })
    return result


@router.patch("/users/{user_id}", response_model=UserAdminResponse)
def update_user_role(
    user_id: str,
    req: UserUpdateRequest,
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db)
):
    """
    Updates role assignment (admin, clerk, viewer) or active state of a user.
    Restricted to Administrator role.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if req.role is not None:
        role = req.role.lower().strip()
        if role not in ["admin", "clerk", "viewer", "reviewer"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role: '{req.role}'. Valid roles: 'admin', 'clerk', 'viewer', 'reviewer'."
            )
        user.role = role

    if req.is_active is not None:
        user.is_active = req.is_active

    db.commit()
    db.refresh(user)

    doc_count = db.query(Document).filter(Document.uploaded_by_id == user.id).count()
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "documents_count": doc_count
    }


@router.get("/sources", response_model=AdminSourcesResponse)
def get_registry_sources_status(
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db)
):
    """
    Returns active integration status of verification providers and source registries.
    Highlights DEMO sources visibly to prevent mistaking prototype data for live government registries.
    """
    provider = DemoRegistryProvider()
    record_count = len(provider.records)

    sources = [
        SourceStatusItem(
            name="UP Bhulekh Land Records (Synthetic)",
            tag="DEMO",
            is_demo=True,
            status="OPERATIONAL (SIMULATED)",
            record_count=record_count,
            file_path="sample_data/demo_registry.json",
            description="Synthetic demo registry simulating Uttar Pradesh Bhulekh cadastral records and ROR ledgers.",
            capabilities=[
                "Khatauni ROR Lookup",
                "Khasra/Gata Parcel Matching",
                "Landholder Name Cross-Referencing",
                "Area Measurement Feasibility Check"
            ],
            disclaimer="Demo registry match - not an official government verification"
        ),
        SourceStatusItem(
            name="Cryptographic Storage Integrity Engine",
            tag="NATIVE",
            is_demo=False,
            status="ACTIVE",
            record_count=db.query(Document).count(),
            file_path=settings.UPLOAD_DIR,
            description="Hardware/OS filesystem SHA-256 tamper-evident integrity validator with zero public exposure.",
            capabilities=[
                "SHA-256 Cryptographic Checksumming",
                "Binary Magic Byte Validation",
                "On-the-fly Tamper Recomputation",
                "Singleton Ledger Duplicate Detection"
            ],
            disclaimer="Native cryptographic integrity layer"
        ),
        SourceStatusItem(
            name="Cadastral OCR & Computer Vision Pipeline",
            tag="NATIVE",
            is_demo=False,
            status="ACTIVE",
            record_count=None,
            file_path=None,
            description="PyMuPDF + OpenCV skew correction + RapidOCR / Tesseract Hindi-English cadastral extraction.",
            capabilities=[
                "PDF Page Rendering (150 DPI)",
                "Document Orientation & Skew Detection",
                "Bilingual Devanagari & Latin Character Extraction",
                "Offline QR Code & Allowlist Safety Parser"
            ],
            disclaimer="Deterministic optical recognition"
        )
    ]

    return {
        "sources": sources,
        "system_status": "ALL SYSTEMS OPERATIONAL",
        "disclaimer": settings.DEMO_DISCLAIMER
    }
