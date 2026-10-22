# BhuVerify: End-to-End Operational Checklist & Verification Protocol

This document outlines the step-by-step verification protocol for departmental officers and evaluators to validate UP Khatauni and Khasra cadastral records.

Automated runner available at:
```bash
python scripts/e2e_verification_flow.py
```

---

## 1. Document Ingestion Phase
- [x] **Secure Upload**: Accepts scanned PDF, PNG, and JPEG documents up to 10MB.
- [x] **Out-of-Webroot Storage**: Stored in isolated directory (`backend/storage/uploads/`), never served as raw executable assets.
- [x] **Cryptographic Fingerprinting**: Computes 256-bit SHA-256 hash immediately upon arrival.
- [x] **Duplicate Rejection**: Rejects re-upload of identical file bytes with `HTTP 409 Conflict`, referencing the original document ID.
- [x] **Immutable Audit Entry**: Automatically records `DOCUMENT_UPLOADED` with timestamp, uploader ID, and original filename.

---

## 2. OCR & Deterministic Field Extraction Phase
- [x] **Asynchronous Ingestion**: Dispatches background job leaving frontend responsive.
- [x] **Preprocessing Pipeline**: Auto-rotation correction, adaptive thresholding, and contrast normalization.
- [x] **Devanagari Digits Normalization**: Normalizes Hindi numerals (`०, १, २, ३, ४, ५, ६, ७, ८, ९`) to standard ASCII digits (`0-9`).
- [x] **Bilingual Extraction Rules**:
  - `khata_no`: Isolated 5-digit normalized sequence (e.g. `00124`).
  - `khasra_gata_no`: Multi-plot composite identifiers (e.g. `45/1, 45/2, 46`).
  - `area`: Hectares float parsing with decimal bounding.
  - `district`, `tehsil`, `village`: Clean entity parsing.
  - `owner_name`: Extracts English transliterated names while preserving Devanagari script.
- [x] **Confidence Scoring**: Combines OCR word confidence with pattern match strength; scores below 70% automatically trigger `needs_review = true`.

---

## 3. Human Review Workbench & Field Corrections
- [x] **Split-Screen Workbench**: Original PDF/image viewer with page navigation on the left; structured editable fields with green/amber/red confidence badges on the right.
- [x] **Evidence Traceability**: Highlights exact bounding boxes and evidence snippets for each parsed field.
- [x] **Strict Non-Destructive Versioning**:
  - Extracted raw OCR text is never overwritten.
  - Field updates create incremental version (`v1` -> `v2`).
  - `extracted_value` and `corrected_value` are permanently preserved side-by-side.
- [x] **Mandatory Correction Reason**: Requires justification (e.g. `"Verified against Tehsil register seal"`) and logs `FIELD_CORRECTION_APPLIED` audit event.

---

## 4. Multi-Layer Verification Engine
Verification checks are categorized into 3 distinct governance layers:

### Layer 1: File Integrity
- [x] **Hash Re-computation**: Re-reads physical disk file to confirm current SHA-256 matches registration fingerprint.
- [x] **Tamper Detection**: Instantly marks `file_hash_integrity` as `FAILED` if on-disk bytes were modified.

### Layer 2: Demo Registry Cross-Check
- [x] **UP Bhulekh Demo Registry Match**: Cross-references parsed fields against official synthetic Mauza registry (`sample_data/demo_registry.json`).
- [x] **ID Mismatch Flagging**: Exact Khasra/Khata mismatches produce red-flag warnings with observed vs expected plot listings.
- [x] **Owner Name Spelling Variance**: Fuzzy Levenshtein match identifies phonetic differences as soft review suggestions without blocking.
- [x] **Synthetic Source Disclaimer**: Visibly displays `"Demo registry match - not an official government verification"`.

### Layer 3: Human Administrative Review
- [x] Validates that review decisions are logged by authorized officers (`clerk` or `admin`).

---

## 5. Reviewer Decisioning & History
- [x] **Role Access Control**: Review decisions strictly forbidden to `viewer` role (`HTTP 403 Forbidden`).
- [x] **Supported Actions**: `approve`, `reject`, `request_changes`.
- [x] **Mandatory Reason**: Requires minimum 3-character explanation.
- [x] **Rejection History Preserved**: Rejections are permanently stored in append-only audit trail; subsequent change of decision never deletes past rejection entries.

---

## 6. Cryptographic QR Share Tokens & Citizen Verification
- [x] **Approval Pre-requisite**: Share tokens can only be minted on `approved` documents.
- [x] **256-Bit Cryptographic Random Token**: Stored only as SHA-256 hash in database; cleartext token provided once at generation time.
- [x] **Zero-PII QR Code**: Encodes strictly `https://<BASE_URL>/verify/<token>` without owner names or personal information.
- [x] **Public Verification Endpoint** (`GET /verify/{token}`):
  - Enumeration-safe, constant-time hash lookup.
  - IP-based sliding window rate limiter (60 req/min).
  - Displays: Document reference, upload date, review status, verification method, integrity status.
  - Expired or revoked tokens output solely that status with zero metadata.

---

## 7. Append-Only Audit Trail
- [x] Every system lifecycle transition creates an irrevocable `AuditEvent` row.
- [x] Chronological inspection confirms ordering:
  1. `DOCUMENT_UPLOADED`
  2. `OCR_PROCESSING_STARTED`
  3. `OCR_COMPLETED`
  4. `FIELD_EXTRACTION_COMPLETED`
  5. `FIELD_CORRECTION_APPLIED`
  6. `DOCUMENT_VERIFIED`
  7. `DOCUMENT_REVIEWED`
  8. `SHARE_TOKEN_GENERATED`
