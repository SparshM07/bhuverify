import os
import hashlib
import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.database import Base, get_db
from backend.app.models.entities import User, Document, LandRecord, FieldEvidence, VerificationCheck, AuditEvent
from backend.app.security.auth import create_access_token, get_password_hash

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
def test_clerk(test_db):
    clerk = User(
        id="user-clerk-verify",
        email="clerk.verify@bhuverify.gov.in",
        hashed_password=get_password_hash("clerk123"),
        role="clerk",
        is_active=True
    )
    test_db.add(clerk)
    test_db.commit()
    test_db.refresh(clerk)
    return clerk

def _auth_header(user: User) -> dict:
    token = create_access_token(data={"sub": user.id, "role": user.role})
    return {"Authorization": f"Bearer {token}"}


def test_verification_match(client, test_db, test_clerk, tmp_path):
    """
    Test a clean match with Demo Registry:
    - Cryptographic file integrity passes (recomputed hash matches disk).
    - Khata and Khasra match Demo Registry entry REG-UP-REF-001.
    - Owner name matches.
    - Verification check rows are written and overall status is verified.
    """
    sample_file = tmp_path / "sample_01_clean.pdf"
    content = b"%PDF-1.4 Mock clean document content for registration match"
    sample_file.write_bytes(content)
    real_hash = hashlib.sha256(content).hexdigest()

    doc = Document(
        id="doc-verify-match",
        filename="sample_01_clean.pdf",
        file_path=str(sample_file),
        file_size_bytes=len(content),
        mime_type="application/pdf",
        sha256_hash=real_hash,
        status="done",
        village="Syntheticpur",
        district="Lucknow",
        tehsil="Bakshi Ka Talab",
        uploaded_by_id=test_clerk.id
    )
    test_db.add(doc)

    lr = LandRecord(
        id="lr-verify-match",
        document_id=doc.id,
        owner_name="रमेश कुमार (Ramesh Kumar)",
        district="Lucknow",
        tehsil="Bakshi Ka Talab",
        village="Syntheticpur",
        khata_no="00124",
        khasra_gata_no="45/1",
        area=0.405,
        overall_confidence=92.0,
        needs_review=False,
        current_version=1
    )
    test_db.add(lr)
    test_db.commit()

    resp = client.post(f"/documents/{doc.id}/verify", headers=_auth_header(test_clerk))
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["document_id"] == doc.id
    assert data["status"] == "verified"
    assert data["total_checks"] >= 5

    # Verify database persistence
    checks = test_db.query(VerificationCheck).filter(VerificationCheck.document_id == doc.id).all()
    check_map = {c.check_type: c for c in checks}

    # 1. File integrity passed
    assert "file_hash_integrity" in check_map
    assert check_map["file_hash_integrity"].status == "passed"
    assert "SHA-256 Match" in check_map["file_hash_integrity"].label

    # 2. Khata and Khasra passed
    assert check_map["id_match_khata"].status == "passed"
    assert check_map["id_match_khasra"].status == "passed"

    # 3. Owner name verified
    assert check_map["owner_name_match"].status == "passed"
    assert check_map["owner_name_match"].label == "Owner Name Verified"

    # 4. Audit event logged
    audit = test_db.query(AuditEvent).filter(
        AuditEvent.document_id == doc.id,
        AuditEvent.action == "DOCUMENT_VERIFIED"
    ).first()
    assert audit is not None


def test_verification_id_mismatch(client, test_db, test_clerk, tmp_path):
    """
    Test exact ID mismatch rule:
    - Document matches registry record REG-UP-REF-011 (sample_11_wrong_khasra.pdf).
    - Document shows Khasra 999/INVALID, whereas official registry records 88/9.
    - Yields red flag with expected vs observed.
    """
    sample_file = tmp_path / "sample_11_wrong_khasra.pdf"
    content = b"%PDF-1.4 Mock document with erroneous khasra"
    sample_file.write_bytes(content)
    real_hash = hashlib.sha256(content).hexdigest()

    doc = Document(
        id="doc-verify-id-mismatch",
        filename="sample_11_wrong_khasra.pdf",
        file_path=str(sample_file),
        file_size_bytes=len(content),
        mime_type="application/pdf",
        sha256_hash=real_hash,
        status="done",
        village="Shivpur",
        uploaded_by_id=test_clerk.id
    )
    test_db.add(doc)

    lr = LandRecord(
        id="lr-verify-id-mismatch",
        document_id=doc.id,
        owner_name="ब्रजेश कुमार त्रिपाठी",
        village="Shivpur",
        khata_no="00619",
        khasra_gata_no="999/INVALID",  # Erroneous ID
        area=0.45,
        overall_confidence=85.0,
        needs_review=True,
        current_version=1
    )
    test_db.add(lr)
    test_db.commit()

    resp = client.post(f"/documents/{doc.id}/verify", headers=_auth_header(test_clerk))
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "failed"

    # Verify check in DB
    khasra_check = test_db.query(VerificationCheck).filter(
        VerificationCheck.document_id == doc.id,
        VerificationCheck.check_type == "id_match_khasra"
    ).first()

    assert khasra_check is not None
    assert khasra_check.status == "failed"
    assert "Exact ID Mismatch (Khasra): Red Flag" in khasra_check.label

    details = json.loads(khasra_check.details)
    assert details["red_flag"] is True
    assert "88/9" in str(details["expected"])
    assert details["observed"] == "999/INVALID"


def test_verification_name_spelling_difference(client, test_db, test_clerk, tmp_path):
    """
    Test owner-name spelling difference rule:
    - Minor spelling/transliteration difference triggers soft "review required" flag.
    - Expected vs observed names stored in details.
    """
    sample_file = tmp_path / "sample_01_clean.pdf"
    content = b"%PDF-1.4 Mock document with spelling variance in owner name"
    sample_file.write_bytes(content)
    real_hash = hashlib.sha256(content).hexdigest()

    doc = Document(
        id="doc-verify-spelling",
        filename="sample_01_clean.pdf",
        file_path=str(sample_file),
        file_size_bytes=len(content),
        mime_type="application/pdf",
        sha256_hash=real_hash,
        status="done",
        village="Syntheticpur",
        uploaded_by_id=test_clerk.id
    )
    test_db.add(doc)

    # Registry has "रमेश कुमार (Ramesh Kumar)" - observed has slight suffix/variant
    lr = LandRecord(
        id="lr-verify-spelling",
        document_id=doc.id,
        owner_name="Ramesh Kumar Maurya",
        village="Syntheticpur",
        khata_no="00124",
        khasra_gata_no="45/1",
        area=0.405,
        overall_confidence=82.0,
        needs_review=True,
        current_version=1
    )
    test_db.add(lr)
    test_db.commit()

    resp = client.post(f"/documents/{doc.id}/verify", headers=_auth_header(test_clerk))
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] in ["review_required", "failed"]

    # Verify check in DB
    name_check = test_db.query(VerificationCheck).filter(
        VerificationCheck.document_id == doc.id,
        VerificationCheck.check_type == "owner_name_match"
    ).first()

    assert name_check is not None
    assert name_check.status == "review_required"
    assert "Owner-Name Spelling Difference: Review Required" in name_check.label

    details = json.loads(name_check.details)
    assert details.get("soft_flag") is True
    assert details["observed"] == "Ramesh Kumar Maurya"
    assert "Ramesh Kumar" in str(details["expected"])


def test_verification_no_source(client, test_db, test_clerk, tmp_path):
    """
    Test no source rule:
    - Document does not exist in official or demo registry.
    - Yields exact label: "Not checked against official source".
    """
    sample_file = tmp_path / "unregistered_external_deed.pdf"
    content = b"%PDF-1.4 Unregistered private deed not present in registry"
    sample_file.write_bytes(content)
    real_hash = hashlib.sha256(content).hexdigest()

    doc = Document(
        id="doc-verify-no-source",
        filename="unregistered_external_deed.pdf",
        file_path=str(sample_file),
        file_size_bytes=len(content),
        mime_type="application/pdf",
        sha256_hash=real_hash,
        status="done",
        village="UnknownGramPanchayat",
        uploaded_by_id=test_clerk.id
    )
    test_db.add(doc)

    lr = LandRecord(
        id="lr-verify-no-source",
        document_id=doc.id,
        owner_name="Unknown Owner",
        village="UnknownGramPanchayat",
        khata_no="99999",
        khasra_gata_no="888",
        area=1.2,
        overall_confidence=90.0,
        needs_review=False,
        current_version=1
    )
    test_db.add(lr)
    test_db.commit()

    resp = client.post(f"/documents/{doc.id}/verify", headers=_auth_header(test_clerk))
    assert resp.status_code == 200
    data = resp.json()

    # Verify registry_lookup check has exact label
    registry_check = test_db.query(VerificationCheck).filter(
        VerificationCheck.document_id == doc.id,
        VerificationCheck.check_type == "registry_lookup"
    ).first()

    assert registry_check is not None
    assert registry_check.status == "not_checked"
    assert registry_check.label == "Not checked against official source"


def test_verification_tampered_file(client, test_db, test_clerk, tmp_path):
    """
    Test file-integrity recheck (tampered file):
    - Document registered with original checksum.
    - File content on disk is modified/tampered.
    - Verification recomputes hash and detects tampering with status failed.
    """
    sample_file = tmp_path / "secure_khatauni.pdf"
    original_content = b"%PDF-1.4 Authentic government signed document"
    sample_file.write_bytes(original_content)
    original_hash = hashlib.sha256(original_content).hexdigest()

    doc = Document(
        id="doc-verify-tampered",
        filename="secure_khatauni.pdf",
        file_path=str(sample_file),
        file_size_bytes=len(original_content),
        mime_type="application/pdf",
        sha256_hash=original_hash,
        status="done",
        uploaded_by_id=test_clerk.id
    )
    test_db.add(doc)
    test_db.commit()

    # Now tamper with the physical file on storage
    tampered_content = b"%PDF-1.4 MALICIOUSLY ALTERED BY UNAUTHORIZED PARTY"
    sample_file.write_bytes(tampered_content)

    resp = client.post(f"/documents/{doc.id}/verify", headers=_auth_header(test_clerk))
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "failed"

    integrity_check = test_db.query(VerificationCheck).filter(
        VerificationCheck.document_id == doc.id,
        VerificationCheck.check_type == "file_hash_integrity"
    ).first()

    assert integrity_check is not None
    assert integrity_check.status == "failed"
    assert "File Tampered / Integrity Mismatch" in integrity_check.label

    details = json.loads(integrity_check.details)
    assert details["tampered"] is True
    assert details["expected_hash"] == original_hash
    assert details["observed_hash"] == hashlib.sha256(tampered_content).hexdigest()
