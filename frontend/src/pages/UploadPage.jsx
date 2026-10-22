import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { documentAPI } from '../services/api';
import {
  UploadCloud,
  FileText,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  X,
  FileCheck,
  ShieldAlert,
  ArrowRight,
  Lock,
  Layers,
  MapPin,
  ExternalLink,
  Info
} from 'lucide-react';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png'
];

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [recordType, setRecordType] = useState('Khatauni (ROR - Record of Rights)');
  const [district, setDistrict] = useState('Lucknow (Synthetic)');
  const [tehsil, setTehsil] = useState('Bakshi Ka Talab (Synthetic)');
  const [village, setVillage] = useState('Syntheticpur');
  const [isRestricted, setIsRestricted] = useState(false);

  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Success & Duplicate states
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const validateFile = (selectedFile) => {
    setValidationError('');
    setDuplicateWarning(null);
    setUploadSuccess(null);

    if (!selectedFile) return false;

    // Check size limit
    if (selectedFile.size > MAX_FILE_SIZE) {
      setValidationError(`File exceeds maximum allowed size of 10 MB (Selected: ${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB).`);
      return false;
    }

    // Check extension & basic MIME
    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['pdf', 'jpg', 'jpeg', 'png'];

    if (!validExtensions.includes(extension)) {
      setValidationError('Invalid file format. Only PDF, JPG, and PNG files are accepted.');
      return false;
    }

    return true;
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected && validateFile(selected)) {
      setFile(selected);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (validateFile(droppedFile)) {
        setFile(droppedFile);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setValidationError('Please select or drag-and-drop a document file to proceed.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);
    setValidationError('');
    setDuplicateWarning(null);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('record_type', recordType);
    formData.append('district', district);
    formData.append('tehsil', tehsil);
    formData.append('village', village);
    formData.append('is_restricted', isRestricted ? 'true' : 'false');

    try {
      const response = await documentAPI.upload(formData, (percent) => {
        setUploadProgress(percent);
      });
      setUploadSuccess(response);
      setFile(null);
    } catch (err) {
      if (err.response && err.response.status === 409) {
        // Duplicate hash detected
        const detail = err.response.data.detail;
        setDuplicateWarning({
          warning: detail.warning || 'Duplicate document detected.',
          message: detail.message || 'A document with the exact same SHA-256 hash has already been registered.',
          existingId: detail.existing_document_id,
          hash: detail.sha256_hash,
          disclaimer: detail.disclaimer
        });
      } else if (err.response && err.response.status === 413) {
        setValidationError('File exceeds the 10 MB maximum upload limit.');
      } else if (err.response && err.response.status === 400) {
        setValidationError(err.response.data.detail || 'Invalid file content. Must be a valid PDF, JPG, or PNG.');
      } else {
        setValidationError(err.response?.data?.detail || 'An unexpected error occurred during upload. Please try again.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setUploadSuccess(null);
    setDuplicateWarning(null);
    setValidationError('');
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono mb-2">
          <UploadCloud className="w-3.5 h-3.5" /> Departmental Ingestion Portal
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Upload Land Record</h1>
        <p className="text-sm text-slate-400 mt-1">
          Ingest Uttar Pradesh Khatauni or Khasra scans. Binary magic bytes are validated, SHA-256 hash is computed, and an append-only audit event is recorded.
        </p>
      </div>

      {/* Duplicate Warning Display */}
      {duplicateWarning && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <h3 className="text-base font-semibold text-amber-200">
                {duplicateWarning.warning}
              </h3>
              <p className="text-xs text-amber-300/90 leading-relaxed">
                {duplicateWarning.message}
              </p>
              <div className="pt-2 text-xs font-mono text-amber-400/90">
                Matched SHA-256 Hash:{' '}
                <span className="bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/20 break-all select-all">
                  {duplicateWarning.hash}
                </span>
              </div>
            </div>
          </div>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link
              to={`/documents/${duplicateWarning.existingId}`}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> View Existing Registered Document ({duplicateWarning.existingId.slice(0, 8)}...)
            </Link>
            <button
              onClick={resetForm}
              className="px-3 py-2 rounded-xl bg-amber-950/40 hover:bg-amber-900/40 text-amber-300 text-xs font-medium border border-amber-500/20"
            >
              Upload Different File
            </button>
          </div>
        </div>
      )}

      {/* Upload Success Alert */}
      {uploadSuccess && (
        <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <h3 className="text-base font-semibold text-emerald-200">
                Document Ingested & Verified Successfully!
              </h3>
              <p className="text-xs text-emerald-300/90 leading-relaxed">
                The document has been securely stored outside the public webroot. Status set to <span className="font-semibold uppercase text-emerald-300">"uploaded"</span> and irrevocable audit event <span className="font-semibold uppercase text-emerald-300">"DOCUMENT_UPLOADED"</span> logged.
              </p>
              <div className="pt-2 text-xs font-mono text-emerald-400/90">
                Computed SHA-256:{' '}
                <span className="bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/20 break-all select-all">
                  {uploadSuccess.sha256_hash}
                </span>
              </div>
            </div>
          </div>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link
              to={`/documents/${uploadSuccess.id}`}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
            >
              Inspect Document & Timeline <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={resetForm}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700"
            >
              Upload Another Record
            </button>
          </div>
        </div>
      )}

      {/* Validation Error Alert */}
      {validationError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Upload Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Drag & Drop Card */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
            dragActive
              ? 'border-emerald-500 bg-emerald-500/10'
              : file
              ? 'border-emerald-500/50 bg-slate-900/90'
              : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            id="file-upload-input"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={handleFileChange}
            className="hidden"
          />

          {file ? (
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 shadow-lg shadow-emerald-500/10">
                <FileCheck className="w-7 h-7" />
              </div>
              <div className="text-sm font-semibold text-white max-w-md truncate">{file.name}</div>
              <div className="text-xs text-slate-400 mt-1 font-mono">
                {(file.size / (1024 * 1024)).toFixed(2)} MB &bull; {file.type || 'Verified Binary'}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition"
                >
                  Change File
                </button>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition"
                  title="Remove selection"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-3 group-hover:text-emerald-400">
                <UploadCloud className="w-7 h-7 text-emerald-400" />
              </div>
              <div className="text-base font-medium text-white mb-1">
                Drag and drop your land record scan here
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Strict binary MIME validation: <span className="text-slate-200">PDF, JPG, PNG only</span> (Max 10 MB limit)
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 shadow-sm transition"
              >
                Browse Files
              </button>
            </div>
          )}
        </div>

        {/* Upload Progress Bar */}
        {isUploading && (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                Uploading & computing SHA-256 checksum...
              </span>
              <span className="font-mono text-emerald-400">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Land Record Metadata Fields */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-sm font-semibold text-white">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Cadastral Metadata & Territorial Attributes</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Record Type */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Record Type / Document Category
              </label>
              <select
                value={recordType}
                onChange={(e) => setRecordType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 text-sm text-slate-200 outline-none transition"
              >
                <option value="Khatauni (ROR - Record of Rights)">Khatauni (ROR - Record of Rights)</option>
                <option value="Khasra (Field Book / Survey)">Khasra (Field Book / Survey)</option>
                <option value="1359 Fasli Archive Record">1359 Fasli Archive Record</option>
                <option value="Bhu-Naksha (Cadastral Map)">Bhu-Naksha (Cadastral Map)</option>
                <option value="Deed of Sale / Registry">Deed of Sale / Registry</option>
              </select>
            </div>

            {/* District */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                District (जि़ला)
              </label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. Lucknow (Synthetic)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 text-sm text-slate-200 outline-none transition"
              />
            </div>

            {/* Tehsil */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Tehsil (तहसील)
              </label>
              <input
                type="text"
                value={tehsil}
                onChange={(e) => setTehsil(e.target.value)}
                placeholder="e.g. Bakshi Ka Talab (Synthetic)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 text-sm text-slate-200 outline-none transition"
              />
            </div>

            {/* Village */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Village / Gram Panchayat (गाँव)
              </label>
              <input
                type="text"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                placeholder="e.g. Syntheticpur"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 text-sm text-slate-200 outline-none transition"
              />
            </div>
          </div>

          {/* Restriction Toggle */}
          <div className="pt-2">
            <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer transition">
              <input
                type="checkbox"
                checked={isRestricted}
                onChange={(e) => setIsRestricted(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-900 border-slate-700"
              />
              <div className="flex-1">
                <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  Mark as Restricted / Confidential Record
                </div>
                <div className="text-[11px] text-slate-400">
                  When enabled, Citizen Viewers will be denied access and will receive a 404 (zero metadata leakage).
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Privacy & Legal Warning Box */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-slate-300">
            <Info className="w-4 h-4 text-emerald-400" />
            Security & Sandbox Storage Notice
          </div>
          <p className="leading-relaxed">
            Uploaded specimens are isolated in private filesystem directories outside of all public HTTP assets. Files are cryptographically fingerprinted with SHA-256 for non-repudiation and tracked in the append-only ledger.
          </p>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={resetForm}
            disabled={isUploading}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium border border-slate-700 transition"
          >
            Clear
          </button>
          <button
            type="submit"
            disabled={!file || isUploading}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-sm shadow-lg shadow-emerald-600/20 border border-emerald-500/30 flex items-center gap-2 disabled:opacity-50 transition"
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Ingesting Document...
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" /> Ingest & Sign Record
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
