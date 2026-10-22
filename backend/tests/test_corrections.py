import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.main import app
from backend.app.database import Base, get_db
from backend.app.models.entities import User, Document, DocumentPage, LandRecord, FieldEvidence, RecordVersion, AuditEvent
from backend.app.security.auth import create_access_token, get_password_hash
from backend.app.services.extraction import extract_and_persist_document

from sqlalchemy.pool import StaticPool

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
        id="user-clerk-1",
        email="clerk@bhuverify.gov.in",
        hashed_password=get_password_hash("clerk123"),
        role="clerk",
        is_active=True
    )
    admin = User(
        id="user-admin-1",
        email="admin@bhuverify.gov.in",
        hashed_password=get_password_hash("admin123"),
        role="admin",
        is_active=True
    )
    viewer = User(
        id="user-viewer-1",
        email="viewer@bhuverify.gov.in",
        hashed_password=get_password_hash("viewer123"),
        role="viewer",
        is_active=True
    )
    test_db.add_all([clerk, admin, viewer])
    test_db.commit()
    return {"clerk": clerk, "admin": admin, "viewer": viewer}

@pytest.fixture
def sample_document(test_db, test_users):
    doc = Document(
        id="doc-corr-1",
        filename="sample_khatauni.pdf",
        file_path="sample_data/samples/sample_01_clean.pdf",
        file_size_bytes=2048,
        mime_type="application/pdf",
        sha256_hash="sha256-test-correction-12345",
        status="done",
        record_type="Khatauni (ROR)",
        district="Lucknow (Synthetic)",
        tehsil="Bakshi Ka Talab (Synthetic)",
        village="Syntheticpur",
        is_restricted=False,
        uploaded_by_id=test_users["clerk"].id
    )
    test_db.add(doc)
    test_db.commit()

    # Add sample extracted land record & evidence
    sample_ocr = """
    Tl(District): Lucknow(Synthetic)
    (Tehsil): BakshiKa Talab(Synthetic)
    (Village): Syntheticpur
    00124
    HR(RameshKumar)HT1/2
    45/1,45/2,46
    0.4050
    """
    page = DocumentPage(
        id="page-c1",
        document_id=doc.id,
        page_number=1,
        raw_text=sample_ocr,
        word_count=25,
        avg_confidence=85
    )
    test_db.add(page)
    test_db.commit()

    lr = extract_and_persist_document(db=test_db, document=doc)
    return doc

def auth_headers(user: User) -> dict:
    token = create_access_token(data={"sub": user.id, "email": user.email, "role": user.role})
    return {"Authorization": f"Bearer {token}"}

# ============================================================================
# Permission Check Tests
# ============================================================================

def test_viewer_forbidden_from_correcting_fields(client, test_users, sample_document):
    """Viewers must be forbidden from performing corrections (HTTP 403)."""
    headers = auth_headers(test_users["viewer"])
    payload = {
        "corrections": {"village": "CorrectedVillage"},
        "reason": "Official field survey update"
    }
    response = client.patch(f"/documents/{sample_document.id}/fields", json=payload, headers=headers)
    assert response.status_code == 403
    assert "Access denied" in response.json()["detail"]

def test_unauthenticated_request_denied(client, sample_document):
    """Requests without token must be denied (HTTP 401)."""
    payload = {
        "corrections": {"village": "CorrectedVillage"},
        "reason": "Unauthorized attempt"
    }
    response = client.patch(f"/documents/{sample_document.id}/fields", json=payload)
    assert response.status_code == 401

def test_restricted_document_access_check(client, test_db, test_users):
    """Viewers cannot access restricted document endpoints (HTTP 404 to avoid metadata leak)."""
    restr_doc = Document(
        id="doc-restr-99",
        filename="confidential.pdf",
        file_path="sample_data/samples/sample_01_clean.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
        sha256_hash="restr-hash-999",
        status="done",
        is_restricted=True,
        uploaded_by_id=test_users["admin"].id
    )
    test_db.add(restr_doc)
    test_db.commit()

    headers = auth_headers(test_users["viewer"])
    response = client.get(f"/documents/{restr_doc.id}/land-record", headers=headers)
    assert response.status_code == 404

# ============================================================================
# Validation & Reason Enforcement Tests
# ============================================================================

def test_correction_requires_reason(client, test_users, sample_document):
    """Corrections without a reason or with empty reason must fail."""
    headers = auth_headers(test_users["clerk"])
    
    # Missing reason
    response1 = client.patch(
        f"/documents/{sample_document.id}/fields",
        json={"corrections": {"village": "NewVillage"}, "reason": ""},
        headers=headers
    )
    assert response1.status_code in [400, 422]

    # Whitespace-only reason
    response2 = client.patch(
        f"/documents/{sample_document.id}/fields",
        json={"corrections": {"village": "NewVillage"}, "reason": "   "},
        headers=headers
    )
    assert response2.status_code in [400, 422]

def test_correction_invalid_field_name_rejected(client, test_users, sample_document):
    """Corrections targeting non-existent fields must be rejected."""
    headers = auth_headers(test_users["clerk"])
    payload = {
        "corrections": {"non_existent_field": "HackerValue"},
        "reason": "Testing schema validation"
    }
    response = client.patch(f"/documents/{sample_document.id}/fields", json=payload, headers=headers)
    assert response.status_code == 400
    assert "Invalid field names" in response.json()["detail"]

# ============================================================================
# Core Versioning & Audit Logging Tests
# ============================================================================

def test_correction_keeps_extracted_and_corrected_separate(client, test_db, test_users, sample_document):
    """
    Extracted value must remain immutable.
    Corrected value must be stored separately in FieldEvidence.
    """
    headers = auth_headers(test_users["clerk"])
    
    # Original extracted village is 'Syntheticpur'
    fe_before = test_db.query(FieldEvidence).filter(
        FieldEvidence.document_id == sample_document.id,
        FieldEvidence.field_name == "village"
    ).first()
    original_extracted = fe_before.extracted_value
    assert original_extracted == "Syntheticpur"
    assert fe_before.corrected_value is None

    # Apply correction
    payload = {
        "corrections": {"village": "Mohanlalganj Proper"},
        "reason": "Tehsil land register verification shows village alias"
    }
    response = client.patch(f"/documents/{sample_document.id}/fields", json=payload, headers=headers)
    assert response.status_code == 200

    # Verify separation in DB
    test_db.expire_all()
    fe_after = test_db.query(FieldEvidence).filter(
        FieldEvidence.document_id == sample_document.id,
        FieldEvidence.field_name == "village"
    ).first()

    # RAW EXTRACTED VALUE IS PRESERVED
    assert fe_after.extracted_value == "Syntheticpur"
    # CORRECTED VALUE IS STORED SEPARATELY
    assert fe_after.corrected_value == "Mohanlalganj Proper"
    assert fe_after.correction_reason == "Tehsil land register verification shows village alias"
    assert fe_after.corrected_by_id == test_users["clerk"].id
    assert fe_after.version == 2
    assert fe_after.needs_review is False

def test_correction_creates_new_version_never_overwrites(client, test_db, test_users, sample_document):
    """
    Multiple corrections must create sequential versions (v2, v3),
    preserving the full snapshot history in RecordVersion.
    """
    headers = auth_headers(test_users["clerk"])

    # Revision 1 -> 2: Correct village
    res1 = client.patch(
        f"/documents/{sample_document.id}/fields",
        json={"corrections": {"village": "Belha Khurd"}, "reason": "First correction: village update"},
        headers=headers
    )
    assert res1.status_code == 200
    assert res1.json()["version_number"] == 2

    # Revision 2 -> 3: Correct area
    res2 = client.patch(
        f"/documents/{sample_document.id}/fields",
        json={"corrections": {"area": "0.5500"}, "reason": "Second correction: patwari survey report correction"},
        headers=headers
    )
    assert res2.status_code == 200
    assert res2.json()["version_number"] == 3

    # Check DB record versions
    versions = test_db.query(RecordVersion).filter(
        RecordVersion.document_id == sample_document.id
    ).order_by(RecordVersion.version_number.asc()).all()

    assert len(versions) == 2
    assert versions[0].version_number == 2
    assert "Belha Khurd" in versions[0].changes
    assert versions[0].reason == "First correction: village update"

    assert versions[1].version_number == 3
    assert "0.5500" in versions[1].changes
    assert versions[1].reason == "Second correction: patwari survey report correction"

    # Active LandRecord must reflect latest version
    test_db.expire_all()
    lr = test_db.query(LandRecord).filter(LandRecord.document_id == sample_document.id).first()
    assert lr.current_version == 3
    assert lr.village == "Belha Khurd"
    assert lr.area == 0.55

def test_correction_logs_append_only_audit_event(client, test_db, test_users, sample_document):
    """
    Field corrections must append an immutable AuditEvent recording
    old value, new value, actor identity, and reason.
    """
    headers = auth_headers(test_users["clerk"])
    payload = {
        "corrections": {"khata_no": "00999"},
        "reason": "Rectification of clerical digitisation misread"
    }
    response = client.patch(f"/documents/{sample_document.id}/fields", json=payload, headers=headers)
    assert response.status_code == 200

    audit_event = test_db.query(AuditEvent).filter(
        AuditEvent.document_id == sample_document.id,
        AuditEvent.action == "FIELD_CORRECTION_APPLIED"
    ).order_by(AuditEvent.timestamp.desc()).first()

    assert audit_event is not None
    assert audit_event.user_id == test_users["clerk"].id

    import json
    details = json.loads(audit_event.details)
    assert details["version"] == 2
    assert details["actor_email"] == test_users["clerk"].email
    assert details["reason"] == "Rectification of clerical digitisation misread"
    assert "khata_no" in details["changes"]
    assert details["changes"]["khata_no"]["old"] == "00124"
    assert details["changes"]["khata_no"]["new"] == "00999"
