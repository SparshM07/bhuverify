# BhuVerify (भू-Verify)
### AI-Assisted Land Record Digitisation & Cryptographic Verification Platform for UP Cadastral Records

> **DISCLAIMER:** *Demo registry match - not an official government verification. All demonstration records, village names, and plot identifiers are synthetic fixtures designed for architecture evaluation. Not affiliated with or endorsed by any government body.*

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Prerequisites & System Requirements](#prerequisites--system-requirements)
3. [Tesseract OCR & Language Pack Installation](#tesseract-ocr--language-pack-installation)
4. [Environment Variables Configuration](#environment-variables-configuration)
5. [Local Development Setup](#local-development-setup)
6. [Automated Test Suite & Verification Scripts](#automated-test-suite--verification-scripts)
7. [Measured OCR Extraction Accuracy Benchmark](#measured-ocr-extraction-accuracy-benchmark)
8. [Known Technical Limitations](#known-technical-limitations)
9. [4-Minute Demonstration Script](#4-minute-demonstration-script)

---

## System Overview

BhuVerify is a specialised cadastre verification platform engineered for Uttar Pradesh revenue court records (Khatauni RoR & Khasra maps). It bridges physical, paper-based revenue records with digital land registries through:

- **Bilingual Deterministic Regex Extraction (No-LLM hallucination risk)**: Normalises Devanagari numerals (`०-९` to `0-9`) and parses cadastral identifiers (`khata_no`, `khasra_gata_no`, `area`, `village`, `tehsil`, `district`, `owner_name`).
- **Three-Layer Verification Engine**:
  1. *File Integrity Layer*: Continuous SHA-256 re-computation and tamper detection.
  2. *Deterministic Registry Layer*: Automated cross-referencing against UP revenue ground-truth fixtures with red-flag detection on plot ID mismatches.
  3. *Human Review Layer*: Split-screen review workbench with non-destructive versioning (`extracted_value` vs `corrected_value`).
- **Cryptographic Share Tokens & Zero-PII QR Verification**: Offline verifiable proof of authenticity without leaking landholder names or sensitive personal data.
- **Parcel & Case Bundles**: Linking related deeds, mutation filings, and survey maps under unified parcel identifiers with role-based access policies (`public`, `internal`, `confidential`, `restricted`).
- **Append-Only Immutable Audit Trail**: Cryptographic logging of every document lifecycle event.

---

## Prerequisites & System Requirements

- **Python**: 3.11 or 3.12 (tested on Python 3.12.10)
- **Node.js**: v18.x or v20.x+ and `npm`
- **Tesseract OCR**: v5.0+ with English (`eng`) and Hindi (`hin`) trained data
- **OS**: Windows 10/11, Ubuntu 20.04+, or macOS 12+

---

## Tesseract OCR & Language Pack Installation

BhuVerify uses a dual-engine OCR pipeline: **RapidOCR** (on-device ONNX engine bundled with dependencies) and **Tesseract OCR** with Hindi language support.

### Windows Installation:
1. Download the Tesseract Windows installer from UB-Mannheim:
   [https://github.com/UB-Mannheim/tesseract/wiki](https://github.com/UB-Mannheim/tesseract/wiki)
2. During installation, select **Additional script data** -> check **Devanagari script**, and under **Additional language data** check **Hindi (`hin`)**.
3. Default installation directory is: `C:\Program Files\Tesseract-OCR`.
4. Add `C:\Program Files\Tesseract-OCR` to your Windows System `PATH`, or set `TESSERACT_CMD` in `.env`:
   ```env
   TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
   ```

### Ubuntu / Debian Installation:
```bash
sudo apt-get update
sudo apt-get install -y tesseract-ocr tesseract-ocr-hin libtesseract-dev
```

### macOS Installation:
```bash
brew install tesseract
brew install tesseract-lang
```

---

## Environment Variables Configuration

Create a `.env` file in the repository root by copying `.env.example`:

```bash
cp .env.example .env
```

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `SECRET_KEY` | `change-to-a-secure-random-256-bit-key-in-production` | 256-bit secret key used to sign JWT auth tokens. |
| `ALGORITHM` | `HS256` | JWT signature algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Session expiration duration (24 hours). |
| `DATABASE_URL` | `sqlite:///./bhuverify.db` | SQLite database URI. |
| `TESSERACT_CMD` | `""` | Absolute binary path if Tesseract is not in global PATH. |
| `UPLOAD_DIR` | `backend/storage/uploads` | Isolated file storage outside public webroot. |
| `ENVIRONMENT` | `development` | Deployment environment identifier. |
| `PUBLIC_BASE_URL` | `http://localhost:5173` | Base URL embedded in citizen verification QR codes. |
| `VITE_API_URL` | `http://localhost:8000` | Backend API base URL for the React frontend client. |
| `DEFAULT_SHARE_TOKEN_EXPIRE_HOURS` | `168` | Share token validity (7 days default). |

---

## Local Development Setup

### 1. Backend Service (FastAPI)

```powershell
# Open terminal in project root
python -m venv backend/.venv

# Activate virtualenv (Windows PowerShell)
.\backend\.venv\Scripts\Activate.ps1
# (On Linux / macOS: source backend/.venv/bin/activate)

# Install Python dependencies
pip install -r backend/requirements.txt

# Start backend development server
uvicorn backend.app.main:app --reload --port 8000
```
- API Endpoint: `http://localhost:8000`
- Interactive OpenAPI Docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

**Pre-seeded Test Accounts:**
- **Clerk**: `clerk@bhuverify.test` / `ClerkPass123!`
- **Admin**: `admin@bhuverify.test` / `AdminPass123!`
- **Viewer**: `viewer@bhuverify.test` / `ViewerPass123!`
- **Reviewer**: `reviewer@bhuverify.test` / `ReviewerPass123!`

### 2. Frontend Client (React + Vite + Tailwind CSS)

```powershell
# In a separate terminal window
cd frontend

# Install Node modules
npm install

# Start Vite client server
npm run dev
```
- Frontend Web App: `http://localhost:5173`

---

## Automated Test Suite & Verification Scripts

### 1. Run Complete Pytest Suite
```powershell
# Run all 46 unit, integration, and security resilience tests
.\backend\.venv\Scripts\python.exe -m pytest backend/tests -v
```

### 2. Run Deterministic Extraction Accuracy Benchmark
Compares OCR rule extraction output against the 12 ground-truth Uttar Pradesh specimen records without LLM hallucination:
```powershell
.\backend\.venv\Scripts\python.exe sample_data/benchmark_extraction.py
```

### 3. Run Automated End-to-End Pipeline
Executes the full 7-phase operational flow (Upload -> OCR -> Correction -> Match/Mismatch -> Approval -> QR Token -> Audit Trail):
```powershell
.\backend\.venv\Scripts\python.exe scripts/e2e_verification_flow.py
```

---

## Measured OCR Extraction Accuracy Benchmark

Evaluation across **12 synthetic Uttar Pradesh Khatauni specimens** covering rotated scans, low-contrast photocopies, co-tenants, and missing attributes.

| Field Name | Strict Exact Match | Normalised Recall | Avg OCR Conf | Extraction Accuracy Status | Technical Root Cause / Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`district`** | **12 / 12 (100.0%)** | **100.0%** | **0.95** | **STRONG** | Bilingual regex matches both `जनपद` and `District`. |
| **`tehsil`** | **12 / 12 (100.0%)** | **100.0%** | **0.94** | **STRONG** | Handles OCR character fusion and camelCase tokens. |
| **`khata_no`** | **12 / 12 (100.0%)** | **100.0%** | **0.93** | **STRONG** | 5-digit zero-padded numbers isolated from noise. |
| **`area`** | **12 / 12 (100.0%)** | **100.0%** | **0.98** | **STRONG** | Decimal hectare values bounded and parsed accurately. |
| **`khasra_gata_no`** | **11 / 12 (91.7%)** | **91.7%** | **0.85** | **STRONG** | Composite plot fractions (e.g. `45/1, 45/2`) parsed. In low-contrast sample 05, ink bleeding required review. |
| **`village`** | **10 / 12 (83.3%)** | **83.3%** | **0.89** | **MODERATE** | In degraded photocopies, dropped characters (e.g. `Beha` vs `Belha`) flagged for human verification. |
| **`owner_name`** | **0 / 12 (0.0%)** | **10 / 12 (83.3%)** | **0.81** | **MODERATE** | English transliteration recall is **83.3%**. Strict Hindi exact-match is 0% due to on-device OCR phonetic substitution of complex Devanagari ligatures. Correctly routed to clerk review. |
| **`land_class`** | **0 / 1 (0.0%)** | **0.0%** | **0.00** | **WEAK (BY DESIGN)** | Appears only in freeform Hindi remarks columns without English subtitles. Deterministic rule refuses to hallucinate, outputs `null`, and flags `needs_review=True`. |
| **`mutation_ref`** | **0 / 1 (0.0%)** | **0.0%** | **0.00** | **WEAK (BY DESIGN)** | Complex Hindi legal remarks require manual clerk transcription. Correctly flagged for review. |

---

## Known Technical Limitations

1. **Closed NIC UP-Bhulekh VPN**: Official Uttar Pradesh state land record APIs are restricted behind state government SDC/NIC intranet firewalls. BhuVerify operates against a verified, realistic synthetic UP revenue ledger (`sample_data/demo_registry.json`) marked with the prominent `"DEMO"` status badge.
2. **Pure Devanagari Ligatures on Photocopied Carbon Copies**: Highly degraded 3rd-generation photocopies with complex Hindi conjunct characters (e.g., `श्र`, `क्ष`, `त्र`) without English transliterations exhibit lower OCR word confidence. BhuVerify's zero-hallucination guardrail intentionally marks these fields `null` rather than guessing.
3. **Handwritten Revenue Official Endorsements**: Freeform marginal notes scribbled by Lekhpals in cursive Urdu/Kaithi scripts require human review via the Review Workbench.

---

## 4-Minute Demonstration Script

| Time | Scene / Action | Screen / Endpoint | Talking Points |
| :---: | :--- | :--- | :--- |
| **0:00 - 0:45** | **Login & Role-Scoped Dashboard** | `http://localhost:5173/login`<br>`http://localhost:5173/dashboard` | Log in using one-click demo credentials as `clerk@bhuverify.test` or `reviewer@bhuverify.test`. Point out the **Dashboard KPI Cards** (Documents, Case Bundles, Processing, Needs Review, Mismatches, Approved). Highlight the **OCR Confidence Histogram** and the live **Global Unified Search Bar** (search for plot `45/1` or `Rameshwar`). |
| **0:45 - 1:30** | **Secure Document Ingestion & Background OCR** | `http://localhost:5173/upload` | Upload `sample_data/samples/sample_01_clean.pdf`. Explain that the file is stored outside webroot, hashed via SHA-256 immediately, and duplicate uploads are rejected with HTTP 409. Show the status update as OCR finishes asynchronously. |
| **1:30 - 2:30** | **Review Workbench & Non-Destructive Versioning** | `http://localhost:5173/documents/:id/review` | Open the Review Workbench. Show original scan on the left with zoom and page controls. On the right, observe parsed cadastral attributes (`Khata 00124`, `Khasra 45/1`, `Area 0.405`). Demonstrate correcting a field with mandatory reason (`"Verified against tehsil seal"`). Show that Version 2 was created and the raw OCR evidence was **not overwritten**. |
| **2:30 - 3:15** | **Three-Layer Verification & Mismatch Flagging** | Document Detail Verification Panel | Trigger Verification. Show the 3 distinct governance layers: (1) File integrity check passes, (2) Official demo registry check matches parcel, (3) Human review version verified. Now show a record with wrong Khasra (`999/INVALID`) to showcase the **Red Flag Exact ID Mismatch** detection. |
| **3:15 - 3:45** | **Official Approval & Zero-PII QR Share Token** | Document Review & Share Modal | Reviewer approves document with mandatory reason (`"Cadastral survey verified"`). Generate a QR share token. Show that the generated QR code encodes **only** `https://<BASE_URL>/verify/<token>`. Open the link in an incognito window: it proves document authenticity and integrity without leaking landholder personal PII. |
| **3:45 - 4:00** | **Parcel Case Bundles & Admin Center** | `/cases` and `/admin` | Show **Case Bundles** linking multiple documents with access level policies (`confidential`, `restricted`). Switch to `/admin` to show user role management and the **Demo Registry Provider** visibly badged with the bright `"DEMO"` prototype indicator. |
