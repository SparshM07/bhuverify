import os
import io
import base64
import hashlib
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import cv2
import numpy as np
from PIL import Image

from backend.app.main import app
from backend.app.database import Base, get_db
from backend.app.models.entities import User, Document, ShareToken, AuditEvent, LandRecord
from backend.app.security.auth import create_access_token, get_password_hash
from backend.app.services.qr_scanner import scan_and_parse_qr_data, is_domain_allowlisted

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

@pytest.fixture
def test_users(test_db):
    clerk = User(
        id="user-clerk-share",
        email="clerk.share@bhuverify.gov.in",
        hashed_password=get_password_hash("clerk123"),
        role="clerk",
        is_active=True
    )
    viewer = User(
        id="user-viewer-share",
        email="viewer.share@bhuverify.gov.in",
        hashed_password=get_password_hash("viewer123"),
        role="viewer",
        is_active=True
    )
    reviewer = User(
        id="user-reviewer-share",
        email="reviewer.share@bhuverify.gov.in",
        hashed_password=get_password_hash("reviewer123"),
        role="reviewer",
        is_active=True
    )
    test_db.add_all([clerk, viewer, reviewer])
    test_db.commit()
    test_db.refresh(clerk)
    test_db.refresh(viewer)
    test_db.refresh(reviewer)
    return {"clerk": clerk, "viewer": viewer, "reviewer": reviewer}

def _auth(user: User) -> dict:
    token = create_access_token(data={"sub": user.id, "role": user.role})
    return {"Authorization": f"Bearer {token}"}


def test_review_actions_and_permissions(client, test_db, test_users):
    """
    Test review workflow:
    - Viewers and clerks forbidden from submitting review decisions (403).
    - Mandatory review reason required (minimum 3 chars) (422).
    - Reviewers can approve, reject, or request changes.
    - Immutable audit event recorded.
    """
    clerk = test_users["clerk"]
    viewer = test_users["viewer"]
    reviewer = test_users["reviewer"]

    doc = Document(
        id="doc-review-test",
        filename="sample_khatauni.pdf",
        file_path="mock/path.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
        sha256_hash="hash-review-test",
        status="done",
        review_status="pending",
        uploaded_by_id=clerk.id
    )
    test_db.add(doc)
    test_db.commit()

    # 1. Viewer forbidden (403)
    resp_viewer = client.post(
        f"/documents/{doc.id}/review",
        json={"action": "approve", "reason": "Looks good"},
        headers=_auth(viewer)
    )
    assert resp_viewer.status_code == 403

    # 1b. Clerk forbidden from submitting review decisions (403)
    resp_clerk = client.post(
        f"/documents/{doc.id}/review",
        json={"action": "approve", "reason": "Clerk should not be able to review"},
        headers=_auth(clerk)
    )
    assert resp_clerk.status_code == 403

    # 2. Reason validation (blank or too short) by reviewer
    resp_empty = client.post(
        f"/documents/{doc.id}/review",
        json={"action": "approve", "reason": "  "},
        headers=_auth(reviewer)
    )
    assert resp_empty.status_code == 422

    # 3. Valid rejection by reviewer
    resp_reject = client.post(
        f"/documents/{doc.id}/review",
        json={"action": "reject", "reason": "Mismatch in khata holder details against registry."},
        headers=_auth(reviewer)
    )
    assert resp_reject.status_code == 200
    assert resp_reject.json()["review_status"] == "rejected"

    # 4. Valid approval by reviewer
    resp_approve = client.post(
        f"/documents/{doc.id}/review",
        json={"action": "approve", "reason": "All 9 cadastral attributes cross-referenced and verified against Tehsil register."},
        headers=_auth(reviewer)
    )
    assert resp_approve.status_code == 200
    data = resp_approve.json()
    assert data["review_status"] == "approved"
    assert data["reviewed_by_id"] == reviewer.id

    # 5. Audit event verification
    audits = test_db.query(AuditEvent).filter(
        AuditEvent.document_id == doc.id,
        AuditEvent.action == "DOCUMENT_REVIEWED"
    ).all()
    assert len(audits) == 2
    assert any("rejected" in a.details for a in audits)
    assert any("approved" in a.details for a in audits)


def test_share_token_requires_approved_status(client, test_db, test_users):
    """Ensure share tokens cannot be generated unless document is approved, and clerk is forbidden."""
    clerk = test_users["clerk"]
    reviewer = test_users["reviewer"]

    doc = Document(
        id="doc-pending-share",
        filename="sample_khatauni.pdf",
        file_path="mock/path.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
        sha256_hash="hash-pending-share",
        status="done",
        review_status="pending",
        uploaded_by_id=clerk.id
    )
    test_db.add(doc)
    test_db.commit()

    # 1. Clerk forbidden from generating share tokens (403)
    resp_clerk = client.post(
        f"/documents/{doc.id}/share-token",
        json={"expires_in_hours": 24},
        headers=_auth(clerk)
    )
    assert resp_clerk.status_code == 403

    # 2. Reviewer receives 400 because document review_status is 'pending'
    resp = client.post(
        f"/documents/{doc.id}/share-token",
        json={"expires_in_hours": 24},
        headers=_auth(reviewer)
    )
    assert resp.status_code == 400
    assert "approved" in resp.json()["detail"].lower()


def test_valid_token(client, test_db, test_users):
    """
    Test generating and using a valid share token:
    - Generates cryptographically secure token.
    - Database stores ONLY the token hash (never cleartext token).
    - Public endpoint GET /verify/{token} returns minimal verification output.
    """
    clerk = test_users["clerk"]

    doc = Document(
        id="doc-valid-share",
        filename="approved_khatauni_2026.pdf",
        file_path="mock/path.pdf",
        file_size_bytes=2048,
        mime_type="application/pdf",
        sha256_hash="hash-valid-share",
        status="done",
        review_status="approved",
        uploaded_by_id=clerk.id
    )
    test_db.add(doc)
    test_db.commit()

    # Clerk forbidden from generating share token (403)
    clerk = test_users["clerk"]
    reviewer = test_users["reviewer"]

    resp_clerk = client.post(
        f"/documents/{doc.id}/share-token",
        json={"expires_in_hours": 48},
        headers=_auth(clerk)
    )
    assert resp_clerk.status_code == 403

    # Reviewer successfully generates token (200)
    gen_resp = client.post(
        f"/documents/{doc.id}/share-token",
        json={"expires_in_hours": 48},
        headers=_auth(reviewer)
    )
    assert gen_resp.status_code == 200, gen_resp.text
    gen_data = gen_resp.json()

    raw_token = gen_data["token"]
    token_hash = gen_data["token_hash"]
    qr_data_url = gen_data["qr_code_data_url"]

    # Verify database security: token_hash stored, raw_token NOT stored
    db_token = test_db.query(ShareToken).filter(ShareToken.token_hash == token_hash).first()
    assert db_token is not None
    assert hashlib.sha256(raw_token.encode("utf-8")).hexdigest() == token_hash
    # The database model does not have a raw token column
    assert not hasattr(db_token, "token")

    # Now verify publicly via GET /verify/{token} (NO AUTH)
    pub_resp = client.get(f"/verify/{raw_token}")
    assert pub_resp.status_code == 200, pub_resp.text
    pub_data = pub_resp.json()

    assert pub_data["status"] == "valid"
    assert pub_data["document_reference"] == "approved_khatauni_2026.pdf"
    assert pub_data["review_status"] == "approved"
    assert pub_data["integrity_status"] == "Verified Intact"
    assert pub_data["upload_date"] is not None
    assert pub_data["last_checked_time"] is not None


def test_expired_token(client, test_db, test_users):
    """
    Test expired token:
    - Token created with past expiry time.
    - Public GET /verify/{token} returns ONLY status 'expired' (zero data leakage).
    """
    clerk = test_users["clerk"]

    doc = Document(
        id="doc-expired-test",
        filename="confidential_cadastre.pdf",
        file_path="mock/path.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
        sha256_hash="hash-expired-test",
        status="done",
        review_status="approved",
        uploaded_by_id=clerk.id
    )
    test_db.add(doc)

    raw_token = "expired_secret_token_abcdef123456"
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    expired_token = ShareToken(
        document_id=doc.id,
        token_hash=token_hash,
        created_by_id=clerk.id,
        expires_at=datetime.now(timezone.utc) - timedelta(hours=2),
        is_revoked=False
    )
    test_db.add(expired_token)
    test_db.commit()

    pub_resp = client.get(f"/verify/{raw_token}")
    assert pub_resp.status_code == 200
    data = pub_resp.json()

    # Must show ONLY expired status (Rule: expired/revoked shows only that status)
    assert data["status"] == "expired"
    assert data.get("document_reference") is None
    assert data.get("upload_date") is None
    assert data.get("review_status") is None


def test_revoked_token(client, test_db, test_users):
    """
    Test revoked token:
    - Reviewer revokes the share token.
    - Public GET /verify/{token} returns ONLY status 'revoked' (zero data leakage).
    """
    clerk = test_users["clerk"]

    doc = Document(
        id="doc-revoked-test",
        filename="sensitive_record.pdf",
        file_path="mock/path.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
        sha256_hash="hash-revoked-test",
        status="done",
        review_status="approved",
        uploaded_by_id=clerk.id
    )
    test_db.add(doc)

    raw_token = "active_then_revoked_token_987654321"
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    token_obj = ShareToken(
        id="token-to-revoke",
        document_id=doc.id,
        token_hash=token_hash,
        created_by_id=clerk.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        is_revoked=False
    )
    test_db.add(token_obj)
    test_db.commit()

    # Clerk forbidden from revoking share token (403)
    clerk = test_users["clerk"]
    reviewer = test_users["reviewer"]

    revoke_clerk = client.post(
        f"/documents/{doc.id}/share-tokens/{token_obj.id}/revoke",
        headers=_auth(clerk)
    )
    assert revoke_clerk.status_code == 403

    # Reviewer successfully revokes share token (200)
    revoke_resp = client.post(
        f"/documents/{doc.id}/share-tokens/{token_obj.id}/revoke",
        headers=_auth(reviewer)
    )
    assert revoke_resp.status_code == 200
    assert revoke_resp.json()["is_revoked"] is True

    # Now access via public verification endpoint
    pub_resp = client.get(f"/verify/{raw_token}")
    assert pub_resp.status_code == 200
    data = pub_resp.json()

    # Must show ONLY revoked status (Rule: expired/revoked shows only that status)
    assert data["status"] == "revoked"
    assert data.get("document_reference") is None
    assert data.get("upload_date") is None
    assert data.get("review_status") is None


def test_bad_token(client):
    """
    Test invalid / non-existent token:
    - Returns generic 404 with enumeration-safe message.
    """
    resp = client.get("/verify/totally_fabricated_invalid_token_999")
    assert resp.status_code == 404
    assert "invalid or unknown" in resp.json()["detail"].lower()


def test_no_data_leakage(client, test_db, test_users):
    """
    Test strict privacy and zero data leakage:
    - Public response does NOT include owner names, khata numbers, PII, uploader email, or private IDs.
    - QR code decodes strictly to the URL https://.../verify/<token> and contains NO personal data.
    """
    clerk = test_users["clerk"]

    doc = Document(
        id="doc-privacy-test",
        filename="citizen_private_record.pdf",
        file_path="mock/path.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
        sha256_hash="hash-privacy-test",
        status="done",
        review_status="approved",
        uploaded_by_id=clerk.id
    )
    test_db.add(doc)

    lr = LandRecord(
        id="lr-privacy-test",
        document_id=doc.id,
        owner_name="श्री रामेश्वर नाथ (Rameshwar Nath)",
        khata_no="00987",
        khasra_gata_no="55/2",
        area=1.45,
        village="PrivateGao",
        district="Varanasi"
    )
    test_db.add(lr)
    test_db.commit()

    # Generate share token (clerk forbidden 403, reviewer allowed 200)
    reviewer = test_users["reviewer"]
    clerk_resp = client.post(
        f"/documents/{doc.id}/share-token",
        headers=_auth(clerk)
    )
    assert clerk_resp.status_code == 403

    gen_resp = client.post(
        f"/documents/{doc.id}/share-token",
        headers=_auth(reviewer)
    )
    assert gen_resp.status_code == 200
    gen_data = gen_resp.json()
    raw_token = gen_data["token"]
    qr_data_url = gen_data["qr_code_data_url"]

    # 1. Decode QR code and verify payload contains ONLY URL, no personal data
    assert qr_data_url.startswith("data:image/png;base64,")
    b64_payload = qr_data_url.replace("data:image/png;base64,", "")
    img_bytes = base64.b64decode(b64_payload)
    img_pil = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    img_cv = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)

    detector = cv2.QRCodeDetector()
    decoded_text, _, _ = detector.detectAndDecode(img_cv)
    assert decoded_text.startswith("http")
    assert f"/verify/{raw_token}" in decoded_text

    # Verify no PII is embedded in the QR payload
    assert "Rameshwar" not in decoded_text
    assert "रामेश्वर" not in decoded_text
    assert "00987" not in decoded_text
    assert "PrivateGao" not in decoded_text

    # 2. Inspect public GET /verify/{token} response
    pub_resp = client.get(f"/verify/{raw_token}")
    pub_data = pub_resp.json()

    # Must contain only minimal reference fields
    assert "owner_name" not in pub_data
    assert "khata_no" not in pub_data
    assert "khasra_gata_no" not in pub_data
    assert "uploaded_by_id" not in pub_data
    assert "file_path" not in pub_data
    assert "raw_ocr_text" not in pub_data


def test_document_qr_parsing_and_allowlist(tmp_path):
    """
    Test safe document QR parsing:
    - Never fetches URL automatically (zero outbound HTTP requests).
    - Checks domain against allowlist (upbhulekh.gov.in allowed, external domain flagged).
    """
    # Test allowlist helper
    allowed_ok, d1 = is_domain_allowlisted("https://upbhulekh.gov.in/public/verify?ref=123")
    assert allowed_ok is True
    assert "upbhulekh.gov.in" in d1

    untrusted_ok, d2 = is_domain_allowlisted("https://phishing-attacker.org/steal_token")
    assert untrusted_ok is False
    assert "phishing-attacker.org" in d2

    # Test text parsing
    text_content = (
        "UP Land Record Khatauni\n"
        "Official Verification: https://upbhulekh.gov.in/verify/DOC999\n"
        "External Link: https://external-untrusted-portal.com/data\n"
    )
    detected = scan_and_parse_qr_data(file_path="", raw_ocr_text=text_content)
    assert len(detected) == 2

    by_domain = {d["domain"]: d for d in detected}
    assert "upbhulekh.gov.in" in by_domain
    assert by_domain["upbhulekh.gov.in"]["is_allowed"] is True
    assert "Allowlisted Official Domain" in by_domain["upbhulekh.gov.in"]["status"]

    assert "external-untrusted-portal.com" in by_domain
    assert by_domain["external-untrusted-portal.com"]["is_allowed"] is False
    assert "Unverified / Non-Whitelisted" in by_domain["external-untrusted-portal.com"]["status"]
