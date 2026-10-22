import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.main import app
from backend.app.database import Base, get_db
from backend.app.models.entities import User, Document, AuditEvent
from backend.app.security.auth import get_password_hash, create_access_token

# In-memory SQLite engine for isolated tests
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture
def db_session():
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def seed_users(db_session):
    admin = User(
        email="admin@bhuverify.test",
        hashed_password=get_password_hash("AdminPass123!"),
        role="admin"
    )
    clerk = User(
        email="clerk@bhuverify.test",
        hashed_password=get_password_hash("ClerkPass123!"),
        role="clerk"
    )
    viewer = User(
        email="viewer@bhuverify.test",
        hashed_password=get_password_hash("ViewerPass123!"),
        role="viewer"
    )
    db_session.add_all([admin, clerk, viewer])
    db_session.commit()
    db_session.refresh(admin)
    db_session.refresh(clerk)
    db_session.refresh(viewer)

    return {
        "admin": {
            "user": admin,
            "token": create_access_token({"sub": admin.id, "email": admin.email, "role": "admin"})
        },
        "clerk": {
            "user": clerk,
            "token": create_access_token({"sub": clerk.id, "email": clerk.email, "role": "clerk"})
        },
        "viewer": {
            "user": viewer,
            "token": create_access_token({"sub": viewer.id, "email": viewer.email, "role": "viewer"})
        }
    }

def get_auth_header(token: str):
    return {"Authorization": f"Bearer {token}"}

# 1. Test upload ok
def test_upload_ok(client, seed_users):
    clerk_token = seed_users["clerk"]["token"]
    # Valid synthetic PDF content
    pdf_content = b"%PDF-1.4 Synthetic UP Khatauni Document Header\n%%EOF\n"
    file = io.BytesIO(pdf_content)

    response = client.post(
        "/documents",
        headers=get_auth_header(clerk_token),
        files={"file": ("khatauni_sample.pdf", file, "application/pdf")},
        data={"village": "Syntheticpur", "district": "Lucknow"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "uploaded"
    assert data["village"] == "Syntheticpur"
    assert data["district"] == "Lucknow"
    assert data["mime_type"] == "application/pdf"
    assert "Demo registry match - not an official government verification" in data["disclaimer"]
    assert "sha256_hash" in data

# 2. Test bad file type (validate real MIME content, not the filename)
def test_bad_file_type(client, seed_users):
    clerk_token = seed_users["clerk"]["token"]
    # File named .pdf but containing plain text without PDF magic bytes
    fake_pdf = io.BytesIO(b"Hello world, this is just plain text, not a real PDF.")

    response = client.post(
        "/documents",
        headers=get_auth_header(clerk_token),
        files={"file": ("fake_document.pdf", fake_pdf, "application/pdf")},
    )
    assert response.status_code == 400
    assert "Invalid file format" in response.json()["detail"]

# 3. Test oversized file (> 10 MB limit)
def test_oversized_file(client, seed_users):
    clerk_token = seed_users["clerk"]["token"]
    # Start with valid PDF magic bytes, but exceed 10 MB limit
    oversized_size = 10 * 1024 * 1024 + 1024  # 10MB + 1KB
    large_pdf = io.BytesIO(b"%PDF-1.4" + b"0" * (oversized_size - 8))

    response = client.post(
        "/documents",
        headers=get_auth_header(clerk_token),
        files={"file": ("huge_document.pdf", large_pdf, "application/pdf")},
    )
    assert response.status_code == 413
    assert "File exceeds maximum allowed size" in response.json()["detail"]

# 4. Test duplicate hash detection
def test_duplicate_hash(client, seed_users, db_session):
    clerk_token = seed_users["clerk"]["token"]
    pdf_content = b"%PDF-1.4 Unique Duplicate Test Payload Content 2026\n%%EOF\n"

    # First upload succeeds
    res1 = client.post(
        "/documents",
        headers=get_auth_header(clerk_token),
        files={"file": ("doc1.pdf", io.BytesIO(pdf_content), "application/pdf")},
    )
    assert res1.status_code == 201
    first_doc_id = res1.json()["id"]

    # Second upload with identical content returns 409 warning and does not create second record
    res2 = client.post(
        "/documents",
        headers=get_auth_header(clerk_token),
        files={"file": ("doc2_copy.pdf", io.BytesIO(pdf_content), "application/pdf")},
    )
    assert res2.status_code == 409
    error_detail = res2.json()["detail"]
    assert "Duplicate document detected" in error_detail["warning"]
    assert error_detail["existing_document_id"] == first_doc_id

    # Verify database count is exactly 1
    doc_count = db_session.query(Document).count()
    assert doc_count == 1

# 5. Test viewer denied (permissions & object-level 404 check)
def test_viewer_denied(client, seed_users):
    clerk_token = seed_users["clerk"]["token"]
    viewer_token = seed_users["viewer"]["token"]

    # Viewer cannot upload (403 Forbidden)
    res_upload = client.post(
        "/documents",
        headers=get_auth_header(viewer_token),
        files={"file": ("test.pdf", io.BytesIO(b"%PDF-1.4 demo\n%%EOF"), "application/pdf")}
    )
    assert res_upload.status_code == 403

    # Clerk uploads a restricted document
    res_restricted = client.post(
        "/documents",
        headers=get_auth_header(clerk_token),
        files={"file": ("confidential_record.pdf", io.BytesIO(b"%PDF-1.4 confidential\n%%EOF"), "application/pdf")},
        data={"is_restricted": "true"}
    )
    assert res_restricted.status_code == 201
    restricted_id = res_restricted.json()["id"]

    # Clerk can view it (200 OK)
    res_clerk_view = client.get(
        f"/documents/{restricted_id}",
        headers=get_auth_header(clerk_token)
    )
    assert res_clerk_view.status_code == 200

    # Viewer is denied with 404 Not Found to prevent metadata leak
    res_viewer_view = client.get(
        f"/documents/{restricted_id}",
        headers=get_auth_header(viewer_token)
    )
    assert res_viewer_view.status_code == 404

    # Viewer listing excludes restricted document
    res_viewer_list = client.get(
        "/documents",
        headers=get_auth_header(viewer_token)
    )
    assert res_viewer_list.status_code == 200
    listed_ids = [doc["id"] for doc in res_viewer_list.json()["items"]]
    assert restricted_id not in listed_ids

# 6. Test audit event created
def test_audit_event_created(client, seed_users):
    clerk_token = seed_users["clerk"]["token"]
    clerk_id = seed_users["clerk"]["user"].id
    pdf_content = b"%PDF-1.4 Audit Trail Verification Specimen\n%%EOF\n"

    # Upload document
    upload_res = client.post(
        "/documents",
        headers=get_auth_header(clerk_token),
        files={"file": ("audit_sample.pdf", io.BytesIO(pdf_content), "application/pdf")},
        data={"village": "Mohanlalganj"}
    )
    assert upload_res.status_code == 201
    doc_id = upload_res.json()["id"]

    # Retrieve audit timeline
    audit_res = client.get(
        f"/documents/{doc_id}/audit",
        headers=get_auth_header(clerk_token)
    )
    assert audit_res.status_code == 200
    timeline = audit_res.json()
    assert len(timeline) >= 1

    upload_event = timeline[0]
    assert upload_event["action"] == "DOCUMENT_UPLOADED"
    assert upload_event["document_id"] == doc_id
    assert upload_event["user_id"] == clerk_id
    assert "timestamp" in upload_event

# 7. Test OCR process background job, idempotency, and audit trail
def test_ocr_process_background_job_and_idempotency(client, seed_users):
    clerk_token = seed_users["clerk"]["token"]
    pdf_content = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n180\n%%EOF\n"

    # Upload document
    upload_res = client.post(
        "/documents",
        headers=get_auth_header(clerk_token),
        files={"file": ("ocr_job_test.pdf", io.BytesIO(pdf_content), "application/pdf")},
        data={"village": "Syntheticpur"}
    )
    assert upload_res.status_code == 201
    doc_id = upload_res.json()["id"]

    # Trigger OCR processing
    proc_res = client.post(
        f"/documents/{doc_id}/process",
        headers=get_auth_header(clerk_token)
    )
    assert proc_res.status_code == 200
    proc_data = proc_res.json()
    assert proc_data["document_id"] == doc_id
    assert proc_data["status"] in ["queued", "processing", "done"]

    # Test idempotency: trigger again on same document
    proc_res_2 = client.post(
        f"/documents/{doc_id}/process",
        headers=get_auth_header(clerk_token)
    )
    assert proc_res_2.status_code == 200
    proc_data_2 = proc_res_2.json()
    assert proc_data_2["document_id"] == doc_id
    # Either already in progress or already processed
    assert proc_data_2["status"] in ["queued", "processing", "done"]

    # Verify audit timeline recorded OCR_QUEUED
    audit_res = client.get(
        f"/documents/{doc_id}/audit",
        headers=get_auth_header(clerk_token)
    )
    assert audit_res.status_code == 200
    timeline = audit_res.json()
    actions = [ev["action"] for ev in timeline]
    assert "OCR_QUEUED" in actions

    # Verify pages endpoint is accessible
    pages_res = client.get(
        f"/documents/{doc_id}/pages",
        headers=get_auth_header(clerk_token)
    )
    assert pages_res.status_code == 200

