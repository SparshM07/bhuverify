import os
import io
import json
import hashlib
from datetime import datetime, timezone, timedelta
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.database import Base, get_db
from backend.app.models.entities import User, Document, DocumentPage, LandRecord, AuditEvent, ShareToken, VerificationCheck
from backend.app.security.auth import create_access_token, get_password_hash
from backend.app.api.endpoints.documents import run_background_ocr_processing

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture
def test_db():
    session = TestingSessionLocal()
    yield session
    session.close()

@pytest.fixture
def client(test_db):
    def override_get_db():
        try:
            yield test_db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def auth_headers(user: User) -> dict:
    token = create_access_token(data={"sub": user.id, "email": user.email, "role": user.role})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def test_users(test_db):
    clerk = User(
        id="user-clerk-resil",
        email="clerk.resil@bhuverify.gov.in",
        hashed_password=get_password_hash("clerk123"),
        role="clerk",
        is_active=True
    )
    admin = User(
        id="user-admin-resil",
        email="admin.resil@bhuverify.gov.in",
        hashed_password=get_password_hash("admin123"),
        role="admin",
        is_active=True
    )
    viewer = User(
        id="user-viewer-resil",
        email="viewer.resil@bhuverify.gov.in",
        hashed_password=get_password_hash("viewer123"),
        role="viewer",
        is_active=True
    )
    reviewer = User(
        id="user-reviewer-resil",
        email="reviewer.resil@bhuverify.gov.in",
        hashed_password=get_password_hash("reviewer123"),
        role="reviewer",
        is_active=True
    )
    test_db.add_all([clerk, admin, viewer, reviewer])
    test_db.commit()
    return {"clerk": clerk, "admin": admin, "viewer": viewer, "reviewer": reviewer}


def test_viewer_denied_on_restricted_id(client, test_db, test_users):
    """Viewer must receive HTTP 404 (enumeration/leak prevention) on restricted documents."""
    doc = Document(
        id="restr-doc-test-1",
        filename="confidential_registry.pdf",
        file_path="mock/path.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
        sha256_hash="hash-restr-001",
        status="done",
        is_restricted=True,
        uploaded_by_id=test_users["clerk"].id
    )
    test_db.add(doc)
    test_db.commit()

    # Clerk can view
    res_c = client.get(f"/documents/{doc.id}", headers=auth_headers(test_users["clerk"]))
    assert res_c.status_code == 200

    # Viewer gets 404
    res_v = client.get(f"/documents/{doc.id}", headers=auth_headers(test_users["viewer"]))
    assert res_v.status_code == 404


def test_duplicate_upload_rejection(client, test_db, test_users):
    """Uploading a document with identical SHA-256 hash must return HTTP 409 Conflict."""
    pdf_bytes = b"%PDF-1.4 duplicate test sample document content\n%%EOF"
    h = hashlib.sha256(pdf_bytes).hexdigest()

    # Pre-register document with this hash
    existing = Document(
        id="orig-doc-duplicate",
        filename="first_upload.pdf",
        file_path="mock/first.pdf",
        file_size_bytes=len(pdf_bytes),
        mime_type="application/pdf",
        sha256_hash=h,
        status="done",
        is_restricted=False,
        uploaded_by_id=test_users["clerk"].id
    )
    test_db.add(existing)
    test_db.commit()

    # Attempt to upload same bytes
    res = client.post(
        "/documents",
        headers=auth_headers(test_users["clerk"]),
        files={"file": ("second_upload.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    )
    assert res.status_code == 409
    data = res.json()
    assert "Duplicate document detected" in data["detail"]["warning"]
    assert data["detail"]["existing_document_id"] == existing.id


def test_tampered_file_fails_verification(client, test_db, test_users, tmp_path):
    """When on-disk file bytes are modified, verification check must record FAIL for file_hash_integrity."""
    file_path = tmp_path / "tampered.pdf"
    file_path.write_bytes(b"%PDF-1.4 original content\n%%EOF")

    doc = Document(
        id="tamper-doc-1",
        filename="tampered.pdf",
        file_path=str(file_path),
        file_size_bytes=100,
        mime_type="application/pdf",
        sha256_hash="f" * 64,  # Intentionally mismatching SHA256
        status="done",
        is_restricted=False,
        uploaded_by_id=test_users["clerk"].id
    )
    test_db.add(doc)
    test_db.commit()

    res = client.post(f"/documents/{doc.id}/verify", headers=auth_headers(test_users["clerk"]))
    assert res.status_code == 200
    checks = res.json()["checks"]
    integrity_check = next((c for c in checks if c["check_type"] == "file_hash_integrity"), None)
    assert integrity_check is not None
    assert integrity_check["status"] == "failed"


def test_expired_qr_public_verification(client, test_db, test_users):
    """Public verification of an expired QR token displays only expired status and no personal data."""
    raw_token = "bhuverify_expired_token_xyz123"
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    doc = Document(
        id="doc-exp-test",
        filename="confidential.pdf",
        file_path="mock/path.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
        sha256_hash="hash-exp",
        status="done",
        review_status="approved",
        is_restricted=False,
        uploaded_by_id=test_users["clerk"].id
    )
    test_db.add(doc)

    st = ShareToken(
        id="st-exp-1",
        document_id=doc.id,
        token_hash=token_hash,
        created_by_id=test_users["clerk"].id,
        is_revoked=False,
        expires_at=datetime.now(timezone.utc) - timedelta(days=1)  # Expired
    )
    test_db.add(st)
    test_db.commit()

    res = client.get(f"/verify/{raw_token}")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "expired"
    assert data["document_reference"] is None


def test_reviewer_rejection_history_preserved(client, test_db, test_users):
    """
    Test that when a reviewer rejects a document:
    1. Mandatory reason is recorded.
    2. Document review_status transitions to 'rejected'.
    3. Immutable audit event is logged with the rejection reason.
    4. QR share token generation is blocked.
    5. Later change of review status does not overwrite/delete earlier rejection history.
    """
    clerk = test_users["clerk"]
    reviewer = test_users["reviewer"]

    doc = Document(
        id="doc-reject-test-1",
        filename="deed_with_error.pdf",
        file_path="mock/deed.pdf",
        file_size_bytes=2048,
        mime_type="application/pdf",
        sha256_hash="hash-reject-test-1",
        status="done",
        review_status="pending",
        uploaded_by_id=clerk.id
    )
    test_db.add(doc)
    test_db.commit()

    # 0. Clerk cannot submit review decisions (403 Forbidden)
    res_clerk = client.post(
        f"/documents/{doc.id}/review",
        json={"action": "reject", "reason": "Unauthorized clerk review"},
        headers=auth_headers(clerk)
    )
    assert res_clerk.status_code == 403

    # 1. Reviewer rejects document (200 OK)
    reject_reason = "Illegible seal and mismatched khasra boundary in Khasra 45/1"
    res_reject = client.post(
        f"/documents/{doc.id}/review",
        json={"action": "reject", "reason": reject_reason},
        headers=auth_headers(reviewer)
    )
    assert res_reject.status_code == 200
    assert res_reject.json()["review_status"] == "rejected"

    # 2. Clerk cannot generate share token (403 Forbidden)
    res_clerk_token = client.post(
        f"/documents/{doc.id}/share-token",
        json={"expires_in_hours": 24},
        headers=auth_headers(clerk)
    )
    assert res_clerk_token.status_code == 403

    # 3. Reviewer cannot generate QR token for rejected document (400 Bad Request)
    res_token = client.post(
        f"/documents/{doc.id}/share-token",
        json={"expires_in_hours": 24},
        headers=auth_headers(reviewer)
    )
    assert res_token.status_code == 400
    assert "rejected" in res_token.json()["detail"].lower()

    # 4. Later action: Request changes by reviewer
    res_changes = client.post(
        f"/documents/{doc.id}/review",
        json={"action": "request_changes", "reason": "Please re-upload higher resolution scan of page 1"},
        headers=auth_headers(reviewer)
    )
    assert res_changes.status_code == 200
    assert res_changes.json()["review_status"] == "changes_requested"

    # 4. Verify rejection history is preserved in audit timeline
    res_audit = client.get(f"/documents/{doc.id}/audit", headers=auth_headers(reviewer))
    assert res_audit.status_code == 200
    timeline = res_audit.json()

    # Both review decisions must be present in the append-only timeline
    review_events = [ev for ev in timeline if ev["action"] == "DOCUMENT_REVIEWED"]
    assert len(review_events) == 2

    # Check rejection event content
    rejection_ev = None
    for ev in review_events:
        d = ev["details"]
        if isinstance(d, str):
            try:
                d = json.loads(d)
            except Exception:
                d = {}
        if d and d.get("new_review_status") == "rejected":
            rejection_ev = ev
            break

    assert rejection_ev is not None
    d_obj = json.loads(rejection_ev["details"]) if isinstance(rejection_ev["details"], str) else rejection_ev["details"]
    assert d_obj["reason"] == reject_reason


def test_ocr_failure_keeps_the_original(test_db, test_users, tmp_path):
    """
    When the OCR extraction pipeline encounters an internal worker or engine failure,
    the document status transitions to 'failed', the processing error is logged,
    and the ORIGINAL file on disk remains completely intact and byte-identical.
    """
    clerk = test_users["clerk"]
    doc_id = "doc-ocr-fail-1"

    # Write a real test file to disk
    original_bytes = b"%PDF-1.4 Important UP Khatauni Scan Original Content\n%%EOF"
    test_file = tmp_path / "original_khatauni.pdf"
    test_file.write_bytes(original_bytes)
    original_sha256 = hashlib.sha256(original_bytes).hexdigest()

    doc = Document(
        id=doc_id,
        filename="original_khatauni.pdf",
        file_path=str(test_file),
        file_size_bytes=len(original_bytes),
        mime_type="application/pdf",
        sha256_hash=original_sha256,
        status="queued",
        uploaded_by_id=clerk.id
    )
    test_db.add(doc)
    test_db.commit()

    # Simulate OCR failure in worker
    with patch(
        "backend.app.api.endpoints.documents.extract_and_persist_document_ocr",
        side_effect=RuntimeError("Simulated Tesseract worker crash: image segmentation fault")
    ):
        with patch("backend.app.api.endpoints.documents.SessionLocal", return_value=test_db):
            run_background_ocr_processing(doc_id, clerk.id)

    # Query document fresh from db
    reloaded_doc = test_db.query(Document).filter(Document.id == doc_id).first()

    # 1. Status marked failed with error details
    assert reloaded_doc.status == "failed"
    assert "Simulated Tesseract worker crash" in reloaded_doc.processing_error

    # 2. Original file on disk is preserved, unmodified
    assert os.path.exists(reloaded_doc.file_path)
    current_bytes = open(reloaded_doc.file_path, "rb").read()
    assert current_bytes == original_bytes
    assert hashlib.sha256(current_bytes).hexdigest() == original_sha256

    # 3. Audit trail records OCR_FAILED
    failed_ev = test_db.query(AuditEvent).filter(
        AuditEvent.document_id == reloaded_doc.id,
        AuditEvent.action == "OCR_FAILED"
    ).first()
    assert failed_ev is not None
    assert "Original file remained intact" in failed_ev.details
