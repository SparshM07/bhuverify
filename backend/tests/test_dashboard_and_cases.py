import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.database import Base, get_db
from backend.app.models.entities import (
    User, Document, LandRecord, VerificationCheck,
    CaseBundle, CaseDocumentAttachment, AuditEvent
)
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

def auth_headers(user: User) -> dict:
    token = create_access_token(data={"sub": user.id, "email": user.email, "role": user.role})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def test_users(test_db):
    clerk1 = User(
        id="user-clerk-1",
        email="clerk1@bhuverify.gov.in",
        hashed_password=get_password_hash("clerk123"),
        role="clerk",
        is_active=True
    )
    clerk2 = User(
        id="user-clerk-2",
        email="clerk2@bhuverify.gov.in",
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
    test_db.add_all([clerk1, clerk2, admin, viewer])
    test_db.commit()

    return {
        "clerk1": clerk1,
        "clerk2": clerk2,
        "admin": admin,
        "viewer": viewer,
    }


def test_dashboard_metrics_role_scoping(client, test_db, test_users):
    """
    Test role scoping for GET /dashboard/metrics:
    - Admin sees all documents including restricted
    - Clerk sees public + their own restricted
    - Viewer sees only non-restricted
    """
    # Create documents
    # 1. Non-restricted, approved
    doc1 = Document(
        id="doc-1",
        filename="doc1.pdf",
        file_path="storage/doc1.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
        sha256_hash="hash1",
        status="done",
        review_status="approved",
        is_restricted=False,
        uploaded_by_id=test_users["clerk1"].id
    )
    rec1 = LandRecord(
        id="rec-1",
        document_id="doc-1",
        overall_confidence=92.0
    )

    # 2. Restricted, owned by clerk1, needs review
    doc2 = Document(
        id="doc-2",
        filename="doc2.pdf",
        file_path="storage/doc2.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
        sha256_hash="hash2",
        status="done",
        review_status="needs_review",
        is_restricted=True,
        uploaded_by_id=test_users["clerk1"].id
    )
    rec2 = LandRecord(
        id="rec-2",
        document_id="doc-2",
        needs_review=True,
        overall_confidence=65.0
    )

    # 3. Restricted, owned by clerk2, processing
    doc3 = Document(
        id="doc-3",
        filename="doc3.pdf",
        file_path="storage/doc3.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
        sha256_hash="hash3",
        status="processing",
        review_status="pending",
        is_restricted=True,
        uploaded_by_id=test_users["clerk2"].id
    )
    test_db.add_all([doc1, rec1, doc2, rec2, doc3])
    test_db.commit()

    # Admin requests metrics
    res_admin = client.get("/dashboard/metrics", headers=auth_headers(test_users["admin"]))
    assert res_admin.status_code == 200
    data_admin = res_admin.json()
    assert data_admin["total_documents"] == 3
    assert data_admin["processing"] == 1
    assert data_admin["needs_review"] == 2
    assert data_admin["approved"] == 1
    assert len(data_admin["confidence_distribution"]) == 5

    # Clerk1 requests metrics (should see doc1 and doc2, but NOT doc3)
    res_clerk1 = client.get("/dashboard/metrics", headers=auth_headers(test_users["clerk1"]))
    assert res_clerk1.status_code == 200
    data_clerk1 = res_clerk1.json()
    assert data_clerk1["total_documents"] == 2
    assert data_clerk1["processing"] == 0
    assert data_clerk1["needs_review"] == 1
    assert data_clerk1["approved"] == 1

    # Viewer requests metrics (should only see doc1)
    res_viewer = client.get("/dashboard/metrics", headers=auth_headers(test_users["viewer"]))
    assert res_viewer.status_code == 200
    data_viewer = res_viewer.json()
    assert data_viewer["total_documents"] == 1
    assert data_viewer["processing"] == 0
    assert data_viewer["needs_review"] == 0
    assert data_viewer["approved"] == 1


def test_global_search(client, test_db, test_users):
    """
    Test GET /search querying by:
    - khasra
    - khata
    - village
    - owner
    - case ref
    """
    # Create a document with land record
    doc = Document(
        id="search-doc-1",
        filename="khat_001.pdf",
        file_path="storage/search_doc_1.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
        sha256_hash="searchhash1",
        status="done",
        review_status="pending",
        is_restricted=False,
        uploaded_by_id=test_users["clerk1"].id
    )
    test_db.add(doc)
    test_db.commit()

    record = LandRecord(
        id="rec-s1",
        document_id="search-doc-1",
        district="Varanasi",
        tehsil="Pindra",
        village="Shivpur",
        khata_no="00142",
        khasra_gata_no="458/2",
        owner_name="Rameshwar Prasad",
        area="0.4500",
        land_class="agricultural"
    )
    test_db.add(record)

    # Create a Case Bundle
    case = CaseBundle(
        id="case-101",
        case_ref="CASE-2026-0042",
        title="Dispute over plot 458/2 Shivpur",
        description="Boundary verification bundle",
        parcel_identifier="458/2",
        village="Shivpur",
        tehsil="Pindra",
        district="Varanasi",
        status="open",
        created_by_id=test_users["clerk1"].id
    )
    test_db.add(case)
    test_db.commit()

    headers = auth_headers(test_users["clerk1"])

    # 1. Search by khasra
    r_khasra = client.get("/search?q=458/2", headers=headers)
    assert r_khasra.status_code == 200
    res = r_khasra.json()
    assert res["total_results"] >= 1
    types = [item["result_type"] for item in res["results"]]
    assert "document" in types or "case" in types

    # 2. Search by khata
    r_khata = client.get("/search?q=00142", headers=headers)
    assert r_khata.status_code == 200
    assert r_khata.json()["total_results"] >= 1
    assert r_khata.json()["results"][0]["matched_field"] in ["khata", "khata_no"]

    # 3. Search by village
    r_vil = client.get("/search?q=Shivpur", headers=headers)
    assert r_vil.status_code == 200
    assert r_vil.json()["total_results"] >= 2  # matches both case and doc

    # 4. Search by owner
    r_owner = client.get("/search?q=Rameshwar", headers=headers)
    assert r_owner.status_code == 200
    assert r_owner.json()["total_results"] >= 1
    assert "Rameshwar" in r_owner.json()["results"][0]["subtitle"]

    # 5. Search by case ref
    r_ref = client.get("/search?q=CASE-2026-0042", headers=headers)
    assert r_ref.status_code == 200
    assert r_ref.json()["total_results"] >= 1
    assert r_ref.json()["results"][0]["result_type"] == "case"


def test_case_bundle_lifecycle(client, test_db, test_users):
    """
    Test creating a case, listing cases, getting details,
    attaching a document with an access level, and detaching.
    """
    # 1. Prepare a document
    doc = Document(
        id="case-doc-1",
        filename="deed_scan.pdf",
        file_path="storage/case_doc_1.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
        sha256_hash="casehash1",
        status="done",
        review_status="approved",
        is_restricted=False,
        uploaded_by_id=test_users["clerk1"].id
    )
    test_db.add(doc)
    test_db.commit()

    headers = auth_headers(test_users["clerk1"])

    # 2. Create case
    case_payload = {
        "title": "Partition Deed Bundle - Mauza Rampur",
        "description": "Partition dispute between co-tenants",
        "parcel_identifier": "128/4",
        "village": "Rampur",
        "tehsil": "Sadar",
        "district": "Jaunpur"
    }
    create_res = client.post("/cases", json=case_payload, headers=headers)
    assert create_res.status_code == 201
    created_case = create_res.json()
    case_id = created_case["id"]
    assert created_case["case_ref"].startswith("CASE-")
    assert created_case["village"] == "Rampur"
    assert created_case["attachments_count"] == 0

    # 3. List cases
    list_res = client.get("/cases", headers=headers)
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1

    # 4. Attach document with access level 'confidential'
    attach_payload = {
        "document_id": "case-doc-1",
        "access_level": "confidential",
        "notes": "Original registry copy attached for verification"
    }
    attach_res = client.post(f"/cases/{case_id}/documents", json=attach_payload, headers=headers)
    assert attach_res.status_code == 200
    case_after_attach = attach_res.json()
    assert len(case_after_attach["attachments"]) == 1
    attachment = case_after_attach["attachments"][0]
    assert attachment["access_level"] == "confidential"
    assert attachment["document_id"] == "case-doc-1"
    attachment_id = attachment["id"]

    # 5. Get case details
    get_res = client.get(f"/cases/{case_id}", headers=headers)
    assert get_res.status_code == 200
    case_data = get_res.json()
    assert len(case_data["attachments"]) == 1
    assert case_data["attachments"][0]["access_level"] == "confidential"

    # 6. Detach document
    detach_res = client.delete(f"/cases/{case_id}/documents/{attachment_id}", headers=headers)
    assert detach_res.status_code == 200

    # Check that attachment is removed
    get_res_after = client.get(f"/cases/{case_id}", headers=headers)
    assert len(get_res_after.json()["attachments"]) == 0


def test_admin_user_management_and_sources(client, test_db, test_users):
    """
    Test Admin user management and source status endpoint:
    - Admin can list and update users
    - Viewer is blocked from accessing /admin endpoints (403)
    - Demo source is visibly returned with is_demo=True and source_name
    """
    admin_headers = auth_headers(test_users["admin"])
    viewer_headers = auth_headers(test_users["viewer"])

    # 1. Viewer blocked from admin user list
    res_v = client.get("/admin/users", headers=viewer_headers)
    assert res_v.status_code == 403

    # 2. Admin can list users
    res_a = client.get("/admin/users", headers=admin_headers)
    assert res_a.status_code == 200
    users_list = res_a.json()
    assert len(users_list) >= 4

    # 3. Admin updates user role to viewer
    update_payload = {"role": "viewer", "is_active": True}
    res_u = client.patch("/admin/users/user-clerk-2", json=update_payload, headers=admin_headers)
    assert res_u.status_code == 200
    assert res_u.json()["role"] == "viewer"

    # 4. Check /admin/sources
    res_sources = client.get("/admin/sources", headers=admin_headers)
    assert res_sources.status_code == 200
    sources_data = res_sources.json()
    assert len(sources_data["sources"]) >= 1

    demo_source = next((s for s in sources_data["sources"] if s["is_demo"]), None)
    assert demo_source is not None
    assert "DEMO" in demo_source["name"] or demo_source["is_demo"] is True
    assert "OPERATIONAL" in demo_source["status"].upper()
