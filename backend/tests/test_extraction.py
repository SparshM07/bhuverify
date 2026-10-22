import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base
from backend.app.models.entities import User, Document, DocumentPage, LandRecord, FieldEvidence
from backend.app.services.extraction import (
    normalize_text,
    split_camel_case,
    extract_fields_from_ocr_text,
    extract_document_fields,
    persist_extraction_results,
    extract_and_persist_document,
    DEFAULT_CONFIDENCE_THRESHOLD,
    TARGET_FIELDS
)

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

def test_normalize_devanagari_digits():
    raw = "खाता संख्या: ०१२४, क्षेत्रफल: ०.४०५ हे०"
    norm = normalize_text(raw)
    assert "0124" in norm
    assert "0.405" in norm

def test_normalize_full_width_punctuation():
    raw = "जि़ला（District）：Lucknow／Synthetic"
    norm = normalize_text(raw)
    assert ":" in norm
    assert "/" in norm
    assert "(" in norm and ")" in norm

def test_split_camel_case():
    assert split_camel_case("BakshiKa Talab") == "Bakshi Ka Talab"
    assert split_camel_case("Lucknow(Synthetic)") == "Lucknow (Synthetic)"

def test_extraction_clean_sample():
    ocr_sample = """
    BdRRGuHRg(Board of Revenue,UttarPradesh)
    RU(HR/RECORDOFRIGHTS(ROR)
    Tl(District):
    Lucknow(Synthetic)
    (Tehsil):
    BakshiKa Talab(Synthetic)
    R/(Village）:Syntheticpur
    (KhaNo)
    00124
    (1)Khata No.
    (2)Landholder&Parent/Spouse
    (3)Khasra No.
    (4) Area (Ha)
    00124
    HR(RameshKumar)HT1/2
    45/1,45/2,46
    0.4050
    """
    fields = extract_fields_from_ocr_text(ocr_sample)

    assert fields["district"].value == "Lucknow (Synthetic)"
    assert fields["district"].confidence >= 0.70
    assert fields["district"].needs_review is False

    assert fields["tehsil"].value == "Bakshi Ka Talab (Synthetic)"
    assert fields["tehsil"].confidence >= 0.70
    assert fields["tehsil"].needs_review is False

    assert fields["village"].value == "Syntheticpur"
    assert fields["village"].confidence >= 0.70

    assert fields["khata_no"].value == "00124"
    assert fields["area"].value == 0.405
    assert fields["khasra_gata_no"].value == "45/1, 45/2, 46"
    assert "Ramesh Kumar" in fields["owner_name"].value

def test_missing_fields_flagged_for_review():
    sparse_text = "उत्तर प्रदेश राजस्व परिषद"
    fields = extract_fields_from_ocr_text(sparse_text)

    # Missing fields should have None value, 0.0 confidence, and needs_review=True
    assert fields["district"].value is None
    assert fields["district"].confidence == 0.0
    assert fields["district"].needs_review is True

    assert fields["khata_no"].value is None
    assert fields["khata_no"].needs_review is True

def test_persistence_to_land_records_and_evidence(db_session):
    # Setup test user and document
    user = User(id="user-1", email="test@bhuverify.gov.in", hashed_password="pw", role="clerk")
    db_session.add(user)
    db_session.commit()

    doc = Document(
        id="doc-test-1",
        filename="khatauni_test.pdf",
        file_path="/storage/test.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
        sha256_hash="hash123",
        status="done",
        uploaded_by_id=user.id
    )
    db_session.add(doc)
    db_session.commit()

    sample_ocr = """
    Tl(District): Varanasi (Synthetic)
    (Tehsil): Sadar (Synthetic)
    (Village): Mohanpur
    00088
    (Dinesh Yadav) Hl1 1/1
    112/3
    0.8210
    """
    page = DocumentPage(
        id="page-1",
        document_id=doc.id,
        page_number=1,
        raw_text=sample_ocr,
        word_count=20,
        avg_confidence=88
    )
    db_session.add(page)
    db_session.commit()

    # Run extraction and persist
    land_record = extract_and_persist_document(db=db_session, document=doc)

    assert land_record is not None
    assert land_record.document_id == doc.id
    assert land_record.district == "Varanasi (Synthetic)"
    assert land_record.tehsil == "Sadar (Synthetic)"
    assert land_record.village == "Mohanpur"
    assert land_record.khata_no == "00088"
    assert land_record.area == 0.821
    assert land_record.khasra_gata_no == "112/3"
    assert land_record.owner_name == "Dinesh Yadav"

    # Verify field evidence rows
    evidence_rows = db_session.query(FieldEvidence).filter(FieldEvidence.land_record_id == land_record.id).all()
    assert len(evidence_rows) == len(TARGET_FIELDS)

    field_map = {fe.field_name: fe for fe in evidence_rows}
    assert field_map["district"].extracted_value == "Varanasi (Synthetic)"
    assert field_map["district"].confidence > 0.7
    assert field_map["district"].needs_review is False

    # Check that missing fields get needs_review = True
    assert field_map["mutation_ref"].extracted_value is None
    assert field_map["mutation_ref"].needs_review is True

def test_idempotent_re_extraction(db_session):
    user = User(id="user-2", email="user2@bhuverify.gov.in", hashed_password="pw", role="clerk")
    db_session.add(user)
    db_session.commit()

    doc = Document(
        id="doc-test-2",
        filename="khatauni_test_2.pdf",
        file_path="/storage/test2.pdf",
        file_size_bytes=1024,
        mime_type="application/pdf",
        sha256_hash="hash456",
        status="done",
        uploaded_by_id=user.id
    )
    db_session.add(doc)
    db_session.commit()

    sample_ocr = "Tl(District): Ayodhya (Synthetic)\n00315\n0.2500"
    page = DocumentPage(id="page-2", document_id=doc.id, page_number=1, raw_text=sample_ocr, word_count=10)
    db_session.add(page)
    db_session.commit()

    # Extract 1st time
    lr1 = extract_and_persist_document(db=db_session, document=doc)
    # Extract 2nd time (should update existing, not create duplicate)
    lr2 = extract_and_persist_document(db=db_session, document=doc)

    assert lr1.id == lr2.id
    all_lrs = db_session.query(LandRecord).filter(LandRecord.document_id == doc.id).all()
    assert len(all_lrs) == 1
    evidence_count = db_session.query(FieldEvidence).filter(FieldEvidence.land_record_id == lr1.id).count()
    assert evidence_count == len(TARGET_FIELDS)
