import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { documentAPI } from '../services/api';
import {
  Button,
  Card,
  Tooltip,
} from '../components/ui';
import {
  UploadCloud,
  FileText,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  X,
  Check,
  ArrowRight,
  ExternalLink,
  Info,
  Clock,
  Briefcase,
  Languages,
} from 'lucide-react';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [recordType, setRecordType] = useState('Khatauni (ROR - Record of Rights)');
  const [district, setDistrict] = useState('Lucknow (Synthetic)');
  const [tehsil, setTehsil] = useState('Bakshi Ka Talab');
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

    // Check size limit (10MB)
    if (selectedFile.size > MAX_FILE_SIZE) {
      setValidationError(
        `File exceeds maximum allowed size of 10 MB (Selected: ${(
          selectedFile.size /
          (1024 * 1024)
        ).toFixed(2)} MB).`
      );
      return false;
    }

    // Check extension
    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['pdf', 'jpg', 'jpeg', 'png'];

    if (!validExtensions.includes(extension)) {
      setValidationError(
        'Invalid file format. Only PDF, JPG, and PNG files are accepted.'
      );
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
    setUploadProgress(15);
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
          message:
            detail.message ||
            'A document with the exact same SHA-256 hash has already been registered in the system.',
          existingId: detail.existing_document_id,
          hash: detail.sha256_hash,
          disclaimer: detail.disclaimer,
        });
      } else if (err.response && err.response.status === 413) {
        setValidationError('File exceeds the 10 MB maximum upload limit.');
      } else if (err.response && err.response.status === 400) {
        setValidationError(
          err.response.data.detail ||
            'Invalid file content. Must be a valid PDF, JPG, or PNG.'
        );
      } else {
        setValidationError(
          err.response?.data?.detail ||
            'An unexpected error occurred during upload. Please try again.'
        );
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
    <div className="space-y-6 max-w-5xl mx-auto pb-16 antialiased font-sans">
      {/* =================================================================== */}
      {/* PAGE HEADER matching 3.png                                          */}
      {/* =================================================================== */}
      <div className="pb-2">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Upload record
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Upload a scanned land record (khatauni) to extract fields using OCR.
        </p>
      </div>

      {/* =================================================================== */}
      {/* WORKFLOW STEP INDICATOR                                             */}
      {/* =================================================================== */}
      <div className="flex items-center justify-between max-w-xl mx-auto px-5 py-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-xs transition-colors ${
              uploadSuccess
                ? 'bg-[#16a34a] text-white'
                : 'bg-[#044eed] text-white'
            }`}
          >
            {uploadSuccess ? <Check className="w-4 h-4 stroke-[2.5]" /> : '1'}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 leading-tight">
              Upload record
            </div>
            <div
              className={`text-[10px] font-medium ${
                uploadSuccess ? 'text-emerald-600' : 'text-[#044eed]'
              }`}
            >
              {uploadSuccess ? 'Completed' : isUploading ? 'Uploading...' : 'Current step'}
            </div>
          </div>
        </div>

        <div
          className={`h-0.5 flex-1 mx-4 rounded transition-colors ${
            uploadSuccess ? 'bg-emerald-300' : 'bg-slate-200'
          }`}
        />

        <div className={`flex items-center gap-2.5 ${uploadSuccess ? '' : 'opacity-60'}`}>
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
              uploadSuccess
                ? 'bg-[#044eed] text-white'
                : 'bg-slate-100 border border-slate-300 text-slate-500'
            }`}
          >
            2
          </div>
          <div>
            <div className="text-xs font-medium text-slate-700 leading-tight">
              OCR extraction
            </div>
            <div className="text-[10px] text-slate-400">Next step</div>
          </div>
        </div>

        <div className="h-0.5 flex-1 mx-4 bg-slate-200 rounded" />

        <div className="flex items-center gap-2.5 opacity-60">
          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-300 text-slate-500 flex items-center justify-center text-xs font-semibold">
            3
          </div>
          <div>
            <div className="text-xs font-medium text-slate-700 leading-tight">
              Review & verify
            </div>
            <div className="text-[10px] text-slate-400">Final step</div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* DUPLICATE-FILE WARNING AREA matching user requirement               */}
      {/* =================================================================== */}
      {duplicateWarning && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3 animate-fade-in shadow-2xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <h4 className="text-sm font-bold text-amber-900">
                {duplicateWarning.warning}
              </h4>
              <p className="text-xs text-amber-800 leading-relaxed">
                {duplicateWarning.message}
              </p>
              <div className="text-xs font-mono text-amber-800/90 pt-1">
                Matched SHA-256 Hash:{' '}
                <span className="bg-white px-2 py-0.5 rounded border border-amber-200 break-all select-all font-semibold text-slate-900">
                  {duplicateWarning.hash}
                </span>
              </div>
            </div>
          </div>
          <div className="pt-1 flex flex-wrap items-center gap-2.5">
            <Link to={`/documents/${duplicateWarning.existingId}`}>
              <Button
                variant="secondary"
                size="sm"
                icon={<ExternalLink className="w-3.5 h-3.5" />}
              >
                View Existing Registered Document ({duplicateWarning.existingId.slice(0, 8)}...)
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              Upload Different File
            </Button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* UPLOAD SUCCESS ALERT                                                */}
      {/* =================================================================== */}
      {uploadSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-3 animate-fade-in shadow-2xs">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#16a34a] shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <h4 className="text-sm font-bold text-emerald-900">
                Document Ingested & Verified Successfully!
              </h4>
              <p className="text-xs text-emerald-800 leading-relaxed">
                The land record has been securely stored and computed with SHA-256 checksum. An irrevocable audit event was recorded.
              </p>
              <div className="text-xs font-mono text-emerald-800 pt-1">
                Computed SHA-256:{' '}
                <span className="bg-white px-2 py-0.5 rounded border border-emerald-200 break-all select-all font-semibold text-slate-900">
                  {uploadSuccess.sha256_hash}
                </span>
              </div>
            </div>
          </div>
          <div className="pt-1 flex flex-wrap items-center gap-2.5">
            <Link to={`/documents/${uploadSuccess.id}`}>
              <Button
                variant="primary"
                size="sm"
                icon={<ArrowRight className="w-3.5 h-3.5" />}
                iconPosition="right"
              >
                Inspect Document & Workbench
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              Upload Another Record
            </Button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* VALIDATION ERROR ALERT                                              */}
      {/* =================================================================== */}
      {validationError && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{validationError}</span>
        </div>
      )}

      {/* =================================================================== */}
      {/* UPLOAD FORM                                                         */}
      {/* =================================================================== */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ================================================================= */}
        {/* DROP ZONE WITH FILE PREVIEW AND PROGRESS matching 3.png           */}
        {/* ================================================================= */}
        <input
          ref={fileInputRef}
          type="file"
          id="file-upload-input"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={handleFileChange}
          className="hidden"
        />

        {file ? (
          /* File Selected Preview matching 3.png */
          <div className="border-2 border-dashed border-blue-200 bg-white rounded-2xl p-6 transition-all shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* File Info Card inside Drop Zone */}
              <div className="border border-slate-200 rounded-xl p-3 bg-white flex items-center gap-3.5 shadow-2xs flex-1 max-w-md w-full">
                {/* Red PDF / Blue IMG Badge */}
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 tracking-wider ${
                    file.name.toLowerCase().endsWith('.pdf')
                      ? 'bg-[#ef4444]'
                      : 'bg-[#044eed]'
                  }`}
                >
                  {file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMG'}
                </div>

                {/* File Details */}
                <div className="min-w-0 flex-1">
                  <div
                    className="text-sm font-semibold text-slate-800 truncate"
                    title={file.name}
                  >
                    {file.name}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 font-medium">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </div>
                </div>

                {/* Green checkmark circle */}
                <div className="w-7 h-7 rounded-full bg-[#dcfce7] text-[#16a34a] flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 stroke-[2.5]" />
                </div>

                {/* Remove file button */}
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition cursor-pointer"
                  title="Remove file"
                  aria-label="Remove selected file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* "Choose another file" button on right */}
              <div className="flex flex-col items-start sm:items-end shrink-0">
                <Button
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose another file
                </Button>
                <span className="text-[11px] text-slate-400 mt-1">
                  PDF, JPG or PNG (max 10 MB)
                </span>
              </div>
            </div>

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                  <span className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-blue-600/30 border-t-[#044eed] rounded-full animate-spin" />
                    Uploading & computing SHA-256 checksum...
                  </span>
                  <span className="font-mono text-[#044eed] font-bold">
                    {uploadProgress}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#044eed] h-full rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty Drop Zone matching 3.png */
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer shadow-2xs ${
              dragActive
                ? 'border-[#044eed] bg-blue-50/50'
                : 'border-slate-300 hover:border-[#044eed] bg-white'
            }`}
          >
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#044eed] flex items-center justify-center mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div className="text-sm font-semibold text-slate-800 mb-1">
                Drag and drop your land record here, or click to browse
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Strict binary validation:{' '}
                <span className="text-slate-600 font-medium">
                  PDF, JPG or PNG
                </span>{' '}
                (max 10 MB limit)
              </p>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                Choose file
              </Button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* RECORD DETAILS FORM matching 3.png                                */}
        {/* ================================================================= */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-2xs">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Record details
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Provide basic information about this land record to help with processing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {/* Record type */}
            <div>
              <label
                htmlFor="record-type"
                className="block text-xs font-semibold text-slate-800 mb-1.5"
              >
                Record type <span className="text-red-500">*</span>
              </label>
              <select
                id="record-type"
                value={recordType}
                onChange={(e) => setRecordType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:border-[#044eed] focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="Khatauni (खतौनी)">Khatauni (खतौनी)</option>
                <option value="Khasra (खसरा / Field Book)">Khasra (खसरा / Field Book)</option>
                <option value="1359 Fasli Archive Record">1359 Fasli Archive Record</option>
                <option value="Bhu-Naksha (भू-नक्शा / Cadastral Map)">Bhu-Naksha (भू-नक्शा / Cadastral Map)</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Select the type of land record you are uploading.
              </p>
            </div>

            {/* District */}
            <div>
              <label
                htmlFor="district"
                className="block text-xs font-semibold text-slate-800 mb-1.5"
              >
                District (जिला) <span className="text-red-500">*</span>
              </label>
              <select
                id="district"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:border-[#044eed] focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="Lucknow (Synthetic)">Lucknow (Synthetic)</option>
                <option value="Barabanki (Synthetic)">Barabanki (Synthetic)</option>
                <option value="Sitapur (Synthetic)">Sitapur (Synthetic)</option>
                <option value="Unnao (Synthetic)">Unnao (Synthetic)</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Select the district where the land is located.
              </p>
            </div>

            {/* Tehsil */}
            <div>
              <label
                htmlFor="tehsil"
                className="block text-xs font-semibold text-slate-800 mb-1.5"
              >
                Tehsil (तहसील) <span className="text-red-500">*</span>
              </label>
              <select
                id="tehsil"
                value={tehsil}
                onChange={(e) => setTehsil(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:border-[#044eed] focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="Bakshi Ka Talab">Bakshi Ka Talab</option>
                <option value="Malihabad">Malihabad</option>
                <option value="Mohanlalganj">Mohanlalganj</option>
                <option value="Sadar">Sadar</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Select the tehsil where the land is located.
              </p>
            </div>

            {/* Village */}
            <div>
              <label
                htmlFor="village"
                className="block text-xs font-semibold text-slate-800 mb-1.5"
              >
                Village (गाँव) <span className="text-red-500">*</span>
              </label>
              <select
                id="village"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:border-[#044eed] focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="Syntheticpur">Syntheticpur</option>
                <option value="Alinagar">Alinagar</option>
                <option value="Chandpur">Chandpur</option>
                <option value="Rampur">Rampur</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Select the village where the land is located.
              </p>
            </div>

            {/* Unsupported fields with "Coming soon" tooltip per prompt requirement */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                Language (भाषा)
              </label>
              <Tooltip content="Language selection coming soon (Default: Hindi)">
                <select
                  disabled
                  defaultValue="Hindi (हिन्दी / Devnagari)"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-400 cursor-not-allowed"
                >
                  <option value="Hindi (हिन्दी / Devnagari)">Hindi (हिन्दी / Devnagari)</option>
                  <option value="English">English</option>
                </select>
              </Tooltip>
              <p className="text-[11px] text-slate-400 mt-1">
                OCR document recognition language.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                Attach to case (मामला)
              </label>
              <Tooltip content="Direct case attachment during upload coming soon">
                <select
                  disabled
                  defaultValue="None (Standalone record)"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-400 cursor-not-allowed"
                >
                  <option value="None (Standalone record)">None (Standalone record)</option>
                </select>
              </Tooltip>
              <p className="text-[11px] text-slate-400 mt-1">
                Associate this upload directly with an active dispute case.
              </p>
            </div>
          </div>

          {/* =============================================================== */}
          {/* RESTRICT-ACCESS TOGGLE matching 3.png                           */}
          {/* =============================================================== */}
          <div className="pt-2">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isRestricted}
                onChange={(e) => setIsRestricted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-[#044eed] border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <div>
                <span className="text-xs font-semibold text-slate-900 block">
                  Restrict access to this record
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">
                  Only authorised users (clerks, reviewers and admins) can view this record.
                </span>
              </div>
            </label>
          </div>

          {/* =============================================================== */}
          {/* SECURITY & SANDBOX STORAGE NOTICE BOX matching 3.png            */}
          {/* =============================================================== */}
          <div className="bg-[#eff6ff] border border-blue-200/80 rounded-xl p-4 flex items-start gap-3 text-xs text-[#1e40af]">
            <Info className="w-4 h-4 text-[#2563eb] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#1e3a8a] text-xs">
                Uploaded files are stored securely and used only for digitisation and verification within BhuVerify.
              </p>
              <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                This is a demo system with synthetic data. Do not upload real personal or sensitive documents.
              </p>
            </div>
          </div>

          {/* =============================================================== */}
          {/* ACTION BUTTONS matching 3.png                                   */}
          {/* =============================================================== */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={resetForm}
              disabled={isUploading}
            >
              Clear
            </Button>

            <Button
              variant="secondary"
              comingSoon
              comingSoonText="Save as draft coming soon"
              disabled
            >
              Save as draft
            </Button>

            <Button
              variant="primary"
              type="submit"
              loading={isUploading}
              disabled={!file || isUploading}
              className="bg-[#061b6a] hover:bg-[#041450] text-white"
            >
              {isUploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
