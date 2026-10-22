from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from backend.app.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="viewer")  # admin, clerk, viewer
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    documents = relationship("Document", foreign_keys="[Document.uploaded_by_id]", back_populates="uploader")
    audit_events = relationship("AuditEvent", back_populates="user")

class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)  # Stored outside public webroot
    file_size_bytes = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    sha256_hash = Column(String(64), unique=True, index=True, nullable=False)
    status = Column(String(50), nullable=False, default="uploaded")  # uploaded, queued, processing, done, failed
    record_type = Column(String(100), nullable=True, default="Khatauni (ROR)")
    district = Column(String(255), nullable=True)
    tehsil = Column(String(255), nullable=True)
    village = Column(String(255), nullable=True, index=True)
    is_restricted = Column(Boolean, default=False, nullable=False)
    uploaded_by_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    raw_ocr_text = Column(Text, nullable=True)
    processing_error = Column(Text, nullable=True)
    review_status = Column(String(50), nullable=False, default="pending")  # pending, approved, rejected, changes_requested
    reviewed_by_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_reason = Column(Text, nullable=True)
    detected_qr_data = Column(Text, nullable=True)  # JSON-serialized list of parsed QR codes and allowlist checks
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    uploader = relationship("User", foreign_keys=[uploaded_by_id], back_populates="documents")
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
    audit_events = relationship("AuditEvent", back_populates="document", cascade="all, delete-orphan")
    pages = relationship("DocumentPage", back_populates="document", cascade="all, delete-orphan", order_by="DocumentPage.page_number")
    land_record = relationship("LandRecord", back_populates="document", uselist=False, cascade="all, delete-orphan")
    verification_checks = relationship("VerificationCheck", back_populates="document", cascade="all, delete-orphan", order_by="VerificationCheck.created_at.desc()")
    share_tokens = relationship("ShareToken", back_populates="document", cascade="all, delete-orphan", order_by="ShareToken.created_at.desc()")
    case_attachments = relationship("CaseDocumentAttachment", back_populates="document", cascade="all, delete-orphan")

class LandRecord(Base):
    """Structured land record extracted from OCR documents."""
    __tablename__ = "land_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, unique=True, index=True)
    owner_name = Column(String(255), nullable=True)
    district = Column(String(255), nullable=True)
    tehsil = Column(String(255), nullable=True)
    village = Column(String(255), nullable=True)
    khata_no = Column(String(50), nullable=True)
    khasra_gata_no = Column(String(255), nullable=True)
    area = Column(Float, nullable=True)
    land_class = Column(String(255), nullable=True)
    mutation_ref = Column(String(255), nullable=True)
    overall_confidence = Column(Float, nullable=False, default=0.0)
    needs_review = Column(Boolean, default=False, nullable=False)
    current_version = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    document = relationship("Document", back_populates="land_record")
    evidence_fields = relationship("FieldEvidence", back_populates="land_record", cascade="all, delete-orphan")
    versions = relationship("RecordVersion", back_populates="land_record", cascade="all, delete-orphan", order_by="RecordVersion.version_number.desc()")

class FieldEvidence(Base):
    """Field-level OCR evidence, match strength, and bounding references."""
    __tablename__ = "field_evidence"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    land_record_id = Column(String(36), ForeignKey("land_records.id"), nullable=False, index=True)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    field_name = Column(String(50), nullable=False)  # owner_name, district, tehsil, village, khata_no, khasra_gata_no, area, land_class, mutation_ref
    extracted_value = Column(String(500), nullable=True)  # Raw extracted value (immutable baseline)
    corrected_value = Column(String(500), nullable=True)  # Human-corrected value (kept strictly separate)
    confidence = Column(Float, nullable=False, default=0.0)
    evidence_text = Column(Text, nullable=True)
    page_no = Column(Integer, nullable=False, default=1)
    needs_review = Column(Boolean, default=False, nullable=False)
    rule_matched = Column(String(100), nullable=True)
    correction_reason = Column(Text, nullable=True)
    corrected_by_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    corrected_at = Column(DateTime, nullable=True)
    version = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    land_record = relationship("LandRecord", back_populates="evidence_fields")
    corrected_by = relationship("User")

class RecordVersion(Base):
    """
    Immutable historical snapshot of corrections made to a land record.
    Each correction creates a new revision version and records the actor, reason, and delta.
    """
    __tablename__ = "record_versions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    land_record_id = Column(String(36), ForeignKey("land_records.id"), nullable=False, index=True)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False, default=1)
    created_by_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=False)
    changes = Column(Text, nullable=False)  # JSON-serialized dict of {field_name: {"old": ..., "new": ...}}
    snapshot = Column(Text, nullable=False)  # JSON-serialized snapshot of all fields at this version
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    land_record = relationship("LandRecord", back_populates="versions")
    document = relationship("Document")
    created_by = relationship("User")

class DocumentPage(Base):
    """Stores per-page raw OCR text, word metrics, and bounding boxes."""
    __tablename__ = "document_pages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    page_number = Column(Integer, nullable=False)
    raw_text = Column(Text, nullable=False)
    word_count = Column(Integer, default=0, nullable=False)
    avg_confidence = Column(Integer, nullable=True)
    ocr_metadata = Column(Text, nullable=True)  # JSON-serialized word confidence & bounding box coordinates
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    document = relationship("Document", back_populates="pages")

class AuditEvent(Base):
    """Append-only audit trail. Records can never be updated or deleted."""
    __tablename__ = "audit_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)  # e.g. DOCUMENT_UPLOADED, VIEWED, etc.
    details = Column(Text, nullable=True)  # JSON-serialized audit payload
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    document = relationship("Document", back_populates="audit_events")
    user = relationship("User", back_populates="audit_events")

class VerificationCheck(Base):
    """
    Stores individual automated validation and cross-reference verification checks.
    Categorized into three primary layers: file_integrity, registry_match, human_review.
    """
    __tablename__ = "verification_checks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    layer = Column(String(50), nullable=False)  # file_integrity, registry_match, human_review
    check_type = Column(String(100), nullable=False)  # e.g., file_hash_integrity, duplicate_hash, id_match_khasra, etc.
    source_name = Column(String(150), nullable=False)  # e.g., SHA-256 Checksum, UP Bhulekh Demo Registry, etc.
    status = Column(String(50), nullable=False)  # passed, failed, review_required, not_checked, warning
    label = Column(String(255), nullable=False)  # Human-readable rule label
    details = Column(Text, nullable=True)  # JSON-serialized payload with expected, observed, diffs
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    document = relationship("Document", back_populates="verification_checks")

class ShareToken(Base):
    """
    Cryptographically secure share tokens for public verification.
    Stores only the SHA-256 hash of the generated token to prevent exposure from database breaches.
    """
    __tablename__ = "share_tokens"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    created_by_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    revoked_by_id = Column(String(36), ForeignKey("users.id"), nullable=True)

    document = relationship("Document", back_populates="share_tokens")
    created_by = relationship("User", foreign_keys=[created_by_id])
    revoked_by = relationship("User", foreign_keys=[revoked_by_id])

class CaseBundle(Base):
    """
    Parcel / case bundle grouping related cadastral documents, physical parcel records,
    and administrative review procedures.
    """
    __tablename__ = "case_bundles"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    case_ref = Column(String(100), unique=True, index=True, nullable=False)  # e.g., CASE-UP-2026-001
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    parcel_identifier = Column(String(100), nullable=True)  # e.g., Khata 00124, Khasra 45/1
    village = Column(String(255), nullable=True, index=True)
    tehsil = Column(String(255), nullable=True)
    district = Column(String(255), nullable=True)
    status = Column(String(50), nullable=False, default="open")  # open, under_review, resolved, closed
    created_by_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    created_by = relationship("User", foreign_keys=[created_by_id])
    attachments = relationship("CaseDocumentAttachment", back_populates="case", cascade="all, delete-orphan", order_by="CaseDocumentAttachment.attached_at.desc()")

class CaseDocumentAttachment(Base):
    """
    Junction entity attaching land record documents to case bundles with designated access levels.
    """
    __tablename__ = "case_document_attachments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    case_id = Column(String(36), ForeignKey("case_bundles.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    access_level = Column(String(50), nullable=False, default="internal")  # public, internal, confidential, restricted
    notes = Column(Text, nullable=True)
    attached_by_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    attached_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    case = relationship("CaseBundle", back_populates="attachments")
    document = relationship("Document", back_populates="case_attachments")
    attached_by = relationship("User", foreign_keys=[attached_by_id])



