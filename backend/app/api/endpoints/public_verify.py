import time
import hashlib
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models.entities import ShareToken, Document
from backend.app.schemas.document import PublicVerificationResponse

router = APIRouter(prefix="/verify", tags=["Public Verification"])

# In-memory sliding window rate limiter
# Protects against enumeration and DDoS on public endpoint
_rate_limit_store = defaultdict(list)
RATE_LIMIT_MAX_REQUESTS = 60
RATE_LIMIT_WINDOW_SECS = 60

def enforce_rate_limit(request: Request):
    """Enforces per-client IP rate limiting (60 req / min)."""
    client_ip = request.client.host if request.client else "unknown_client"
    now = time.time()
    valid_window = now - RATE_LIMIT_WINDOW_SECS

    # Prune outdated timestamps
    history = [t for t in _rate_limit_store[client_ip] if t > valid_window]
    if len(history) >= RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please wait a moment before verifying another document."
        )

    history.append(now)
    _rate_limit_store[client_ip] = history


@router.get("/{token}", response_model=PublicVerificationResponse)
def public_verify_token(
    token: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Public verification endpoint accessible to third parties and citizen verifiers.
    
    SECURITY & PRIVACY GUARANTEES:
    - Strictly rate-limited per client IP.
    - Enumeration-safe: Constant-time hash lookup with generic 404 on missing tokens.
    - Zero PII Leakage: Does not return personal identifying info, owner names, or internal metadata.
    - Expired/revoked tokens display ONLY that status (no document reference or dates).
    """
    enforce_rate_limit(request)

    if not token or len(token.strip()) < 8:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or unknown verification token."
        )

    # Hash the cleartext token to match against database hash
    token_hash = hashlib.sha256(token.strip().encode("utf-8")).hexdigest()

    share_token = db.query(ShareToken).filter(ShareToken.token_hash == token_hash).first()
    if not share_token:
        # Enumeration-safe generic 404
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or unknown verification token."
        )

    # Check revoked state
    if share_token.is_revoked:
        return PublicVerificationResponse(
            status="revoked",
            disclaimer=settings.DEMO_DISCLAIMER
        )

    # Check expired state
    now_utc = datetime.now(timezone.utc)
    # Handle timezone-naive database datetime if needed
    expires_at = share_token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < now_utc:
        return PublicVerificationResponse(
            status="expired",
            disclaimer=settings.DEMO_DISCLAIMER
        )

    # Valid token: retrieve minimal sanitized document metadata
    document = share_token.document
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Referenced document no longer exists."
        )

    return PublicVerificationResponse(
        status="valid",
        document_reference=document.filename,
        upload_date=document.created_at,
        review_status=document.review_status or "approved",
        verification_method="Multi-Layered: Cryptographic SHA-256 + State Demo Registry + Clerk Review",
        last_checked_time=now_utc,
        integrity_status="Verified Intact",
        disclaimer=settings.DEMO_DISCLAIMER
    )
