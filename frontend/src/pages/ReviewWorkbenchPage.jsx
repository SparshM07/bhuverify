import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { documentAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusChip, ConfidenceChip, Button, Tooltip } from '../components/ui';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Hand,
  Check,
  Undo2,
  FileText,
  Clock,
  User,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Copy,
  CheckCheck,
} from 'lucide-react';

const FIELD_METADATA = {
  owner_name: {
    labelHi: 'खातेदार का नाम',
    labelEn: 'Owner name',
    placeholder: 'e.g. Ramesh Kumar Verma',
  },
  district: {
    labelHi: 'जनपद',
    labelEn: 'District',
    placeholder: 'e.g. Lucknow (Synthetic)',
  },
  tehsil: {
    labelHi: 'तहसील',
    labelEn: 'Tehsil',
    placeholder: 'e.g. Bakshi Ka Talab',
  },
  village: {
    labelHi: 'गाँव',
    labelEn: 'Village',
    placeholder: 'e.g. Syntheticpur',
  },
  khata_no: {
    labelHi: 'खाता संख्या',
    labelEn: 'Khata no.',
    placeholder: 'e.g. 00123',
  },
  khasra_gata_no: {
    labelHi: 'खसरा / गाटा संख्या',
    labelEn: 'Khasra / Gata no.',
    placeholder: 'e.g. 45/1',
  },
  area: {
    labelHi: 'क्षेत्रफल',
    labelEn: 'Area',
    placeholder: 'e.g. 0.482',
  },
  land_class: {
    labelHi: 'भूमि श्रेणी',
    labelEn: 'Land classification',
    placeholder: 'e.g. श्रेणी 1-क',
  },
  mutation_ref: {
    labelHi: 'नामांतरण पत्रावली सं०',
    labelEn: 'Mutation order',
    placeholder: 'e.g. पत्रावली सं० 42/2024',
  },
};

const WORKFLOW_STEPS = [
  { id: 1, label: 'Uploaded' },
  { id: 2, label: 'OCR done' },
  { id: 3, label: 'Reviewed' },
  { id: 4, label: 'Verified' },
  { id: 5, label: 'Approved' },
];

export default function ReviewWorkbenchPage() {
  const { id } = useParams();
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();

  // Data states
  const [document, setDocument] = useState(null);
  const [landRecord, setLandRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tabs on right panel
  const [activeTab, setActiveTab] = useState('fields'); // 'fields' | 'raw_ocr' | 'history'

  // Scan Viewer states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageImageUrl, setPageImageUrl] = useState(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [rotation, setRotation] = useState(0);

  // Correction & Workbench states
  const [editedFields, setEditedFields] = useState({});
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [copiedRawText, setCopiedRawText] = useState(false);

  const canEdit = hasRole(['admin', 'clerk']);

  // Fetch document specifications and extracted land records
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [docData, lrData] = await Promise.all([
        documentAPI.get(id),
        documentAPI.getLandRecord(id).catch(() => null),
      ]);

      setDocument(docData);
      setLandRecord(lrData);

      // Estimate total pages from pages endpoint or default to 1
      try {
        const pagesList = await documentAPI.getPages(id);
        if (pagesList && pagesList.length > 0) {
          setTotalPages(pagesList.length);
        }
      } catch {
        setTotalPages(1);
      }
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setError('Document not found or access restricted under departmental confidentiality rules.');
      } else {
        setError(err.response?.data?.detail || 'Failed to load document workbench specifications.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  // Load page scan image blob whenever currentPage changes
  useEffect(() => {
    let active = true;
    let objectUrl = null;

    const fetchScanImage = async () => {
      if (!id) return;
      try {
        setLoadingImage(true);
        const blobUrl = await documentAPI.getPageImageBlob(id, currentPage);
        if (active) {
          objectUrl = blobUrl;
          setPageImageUrl(blobUrl);
        }
      } catch {
        if (active) {
          setPageImageUrl(null);
        }
      } finally {
        if (active) {
          setLoadingImage(false);
        }
      }
    };

    fetchScanImage();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [id, currentPage]);

  // Handle inline field change
  const handleFieldChange = (fieldName, value) => {
    setEditedFields((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  // Revert/Undo a specific field to baseline extracted OCR value
  const handleUndoField = (fieldName) => {
    const ef = evidenceMap[fieldName];
    const originalExtracted = ef?.extracted_value || '';
    setEditedFields((prev) => {
      const copy = { ...prev };
      // If was previously saved as a correction on backend, re-set to original
      if (ef?.corrected_value !== null && ef?.corrected_value !== undefined) {
        copy[fieldName] = originalExtracted;
        return copy;
      }
      delete copy[fieldName];
      return copy;
    });
  };

  const handleDiscardChanges = () => {
    setEditedFields({});
    setReason('');
    setSaveError(null);
  };

  // Submit corrections
  const handleSaveCorrections = async (e) => {
    if (e) e.preventDefault();
    if (!reason.trim()) {
      setSaveError('A valid justification reason is strictly required by the departmental audit ledger.');
      return;
    }

    if (Object.keys(editedFields).length === 0) {
      setSaveError('No field modifications detected. Edit at least one field before saving.');
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(null);

      const payload = {
        corrections: editedFields,
        reason: reason.trim(),
      };

      const result = await documentAPI.correctFields(id, payload);

      setSaveSuccess(`Successfully registered revision Version ${result.version_number}. Baseline extractions remain preserved.`);
      setLandRecord(result.land_record);
      setEditedFields({});
      setReason('');

      // Auto dismiss success toast after 5s
      setTimeout(() => setSaveSuccess(null), 5000);
    } catch (err) {
      setSaveError(err.response?.data?.detail || 'Failed to submit cadastral field correction.');
    } finally {
      setSaving(false);
    }
  };

  const copyRawOcrText = () => {
    if (landRecord?.raw_text) {
      navigator.clipboard.writeText(landRecord.raw_text);
      setCopiedRawText(true);
      setTimeout(() => setCopiedRawText(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-3 border-blue-600/20 border-t-[#044eed] rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Loading review workbench...</p>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-red-50 text-[#dc2626] mx-auto flex items-center justify-center">
          <AlertOctagon className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Workbench Unavailable</h2>
        <p className="text-sm text-slate-500">{error || 'Document record could not be loaded.'}</p>
        <Link to="/documents">
          <Button variant="primary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to Documents
          </Button>
        </Link>
      </div>
    );
  }

  const evidenceMap = {};
  if (landRecord?.evidence_fields) {
    landRecord.evidence_fields.forEach((ef) => {
      evidenceMap[ef.field_name] = ef;
    });
  }

  const targetFieldsList = Object.keys(FIELD_METADATA);

  // Compute how many fields are confirmed
  const confirmedCount = targetFieldsList.filter((fname) => {
    const ef = evidenceMap[fname];
    const isEdited = fname in editedFields;
    if (isEdited) return true;
    if (ef?.corrected_value) return true;
    return ef && !ef.needs_review && ef.confidence >= 0.75;
  }).length;

  const totalFieldsCount = targetFieldsList.length;
  const hasPendingEdits = Object.keys(editedFields).length > 0;

  // Determine current active workflow step matching 5.png
  // 1: Uploaded, 2: OCR done, 3: Reviewed, 4: Verified, 5: Approved
  let currentStepId = 3;
  if (document.review_status === 'approved') {
    currentStepId = 5;
  } else if (document.status === 'uploaded') {
    currentStepId = 1;
  } else if (document.status === 'processing' || document.status === 'queued') {
    currentStepId = 2;
  } else if (document.review_status === 'verified') {
    currentStepId = 4;
  } else {
    currentStepId = 3; // In review workbench
  }

  const formatUploadedDate = (dateStr) => {
    if (!dateStr) return '23 Oct 2026, 11:42 AM';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const docReference = document.reference_no || `BV-2026-${String(document.id || 1).padStart(6, '0')}`;

  return (
    <div className="space-y-5 max-w-[1700px] mx-auto pb-12 antialiased">
      {/* Top Header Bar matching 5.png */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Review document
            </h1>
            <StatusChip status={document.review_status || document.status || 'needs_review'} />
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
            <span>
              Reference: <strong className="text-slate-700">{docReference}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              File: <strong className="text-slate-700">{document.filename}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Uploaded: {formatUploadedDate(document.created_at)} by {document.uploaded_by_name || 'Sparsh Maurya (Clerk)'}
            </span>
          </p>
        </div>

        {/* Workflow Stepper matching 5.png */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {WORKFLOW_STEPS.map((st, idx) => {
            const isCompleted = st.id < currentStepId;
            const isCurrent = st.id === currentStepId;
            const isUpcoming = st.id > currentStepId;

            return (
              <React.Fragment key={st.id}>
                {idx > 0 && (
                  <div
                    className={`w-6 sm:w-10 h-0.5 ${
                      isCompleted || isCurrent ? 'bg-[#044eed]' : 'bg-slate-200'
                    }`}
                  />
                )}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isCompleted
                        ? 'bg-[#044eed] text-white shadow-xs'
                        : isCurrent
                        ? 'bg-[#044eed] text-white ring-4 ring-blue-100 shadow-xs'
                        : 'border border-slate-300 text-slate-400 bg-white'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : st.id}
                  </div>
                  <span
                    className={`text-[11px] mt-1 font-medium ${
                      isCurrent
                        ? 'text-slate-900 font-semibold'
                        : isCompleted
                        ? 'text-slate-700'
                        : 'text-slate-400'
                    }`}
                  >
                    {st.label}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Main Two-Column Split Layout matching 5.png */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[720px] items-start">
        {/* ================================================================= */}
        {/* LEFT PANE: Scan Viewer (High-Resolution Scan, Zoom, Rotate, Page)  */}
        {/* ================================================================= */}
        <div className="lg:col-span-6 flex flex-col rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm">
          {/* Viewer Toolbar matching 5.png */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs">
            {/* Page switcher: < 1 / 1 > */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || loadingImage}
                className="p-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Previous Page"
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 font-mono text-xs font-semibold text-slate-800">
                <span>{currentPage}</span>
                <span className="text-slate-400">/</span>
                <span>{totalPages}</span>
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || loadingImage}
                className="p-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title="Next Page"
                aria-label="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Zoom & Tools: ZoomOut, Selector, Hand, ZoomIn */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.5, +(z - 0.2).toFixed(1)))}
                className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
                title="Zoom Out"
                aria-label="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <select
                value={Math.round(zoomLevel * 100)}
                onChange={(e) => setZoomLevel(Number(e.target.value) / 100)}
                className="py-1 px-2 rounded-md bg-white border border-slate-200 text-slate-700 font-mono text-xs focus:outline-none focus:border-[#044eed]"
              >
                <option value={50}>50%</option>
                <option value={75}>75%</option>
                <option value={100}>100%</option>
                <option value={125}>125%</option>
                <option value={150}>150%</option>
                <option value={200}>200%</option>
              </select>

              {/* Hand Tool (Disabled with Coming soon tooltip) */}
              <Tooltip content="Pan tool (Coming soon)">
                <button
                  type="button"
                  disabled
                  className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-400 opacity-60 cursor-not-allowed"
                  aria-label="Pan tool"
                >
                  <Hand className="w-3.5 h-3.5" />
                </button>
              </Tooltip>

              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(2.5, +(z + 0.2).toFixed(1)))}
                className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
                title="Zoom In"
                aria-label="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Right: Rotate & Fit to Width */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
                title="Rotate 90° Clockwise"
                aria-label="Rotate 90 degrees"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setZoomLevel(1.0);
                  setRotation(0);
                }}
                className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
                title="Fit to Width / Reset View"
                aria-label="Fit to Width"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Scan Canvas Viewport */}
          <div className="relative flex-1 bg-slate-100/70 overflow-auto flex items-center justify-center p-6 min-h-[600px] max-h-[820px]">
            {loadingImage ? (
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-600/20 border-t-[#044eed] rounded-full animate-spin" />
                <span className="text-xs text-slate-500 font-medium">Rendering document raster...</span>
              </div>
            ) : pageImageUrl ? (
              <div
                style={{
                  transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s ease-out',
                }}
                className="relative shadow-md rounded-sm border border-slate-300 bg-white"
              >
                <img
                  src={pageImageUrl}
                  alt={`Scan Page ${currentPage}`}
                  className="max-w-none block select-none pointer-events-auto"
                />
              </div>
            ) : (
              <div className="text-center p-8 space-y-2 text-slate-400">
                <FileText className="w-12 h-12 mx-auto text-slate-300" />
                <p className="text-xs text-slate-500 font-medium">
                  Scan raster unavailable for page {currentPage}.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* RIGHT PANE: Extracted Fields, Raw OCR, History Tabs               */}
        {/* ================================================================= */}
        <div className="lg:col-span-6 flex flex-col rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm">
          {/* Tabs matching visual spec: Fields / Raw OCR text / History */}
          <div className="flex items-center border-b border-slate-200 px-6 pt-3 gap-6 bg-slate-50/70">
            <button
              type="button"
              onClick={() => setActiveTab('fields')}
              className={`pb-3 text-sm font-semibold border-b-2 transition -mb-px ${
                activeTab === 'fields'
                  ? 'border-[#044eed] text-[#044eed]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Fields
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('raw_ocr')}
              className={`pb-3 text-sm font-semibold border-b-2 transition -mb-px ${
                activeTab === 'raw_ocr'
                  ? 'border-[#044eed] text-[#044eed]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Raw OCR text
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`pb-3 text-sm font-semibold border-b-2 transition -mb-px flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'border-[#044eed] text-[#044eed]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>History</span>
              {landRecord?.versions?.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-blue-100 text-[#044eed]">
                  {landRecord.versions.length}
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: FIELDS FORM */}
          {activeTab === 'fields' && (
            <div className="flex flex-col flex-1 p-6">
              {/* Header inside Fields tab matching 5.png */}
              <div className="pb-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                      Extracted fields
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Review and correct the extracted information. Low confidence fields need your attention.
                    </p>
                  </div>
                </div>

                {/* Progress Line matching spec: "x of y fields confirmed" */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-4">
                  <div className="text-xs text-slate-600 font-medium">
                    <span className="font-semibold text-slate-900">{confirmedCount}</span> of{' '}
                    <span className="font-semibold text-slate-900">{totalFieldsCount}</span> fields confirmed
                  </div>
                  <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${(confirmedCount / totalFieldsCount) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Success / Error Banners */}
              {saveSuccess && (
                <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{saveSuccess}</span>
                </div>
              )}

              {saveError && (
                <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 shrink-0 text-[#dc2626]" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* Fields Table / Form matching 5.png */}
              <form onSubmit={handleSaveCorrections} className="space-y-3 mt-4">
                {targetFieldsList.map((fieldName) => {
                  const meta = FIELD_METADATA[fieldName];
                  const ef = evidenceMap[fieldName];
                  const hasCorrection = ef?.corrected_value !== null && ef?.corrected_value !== undefined;
                  const isEdited = fieldName in editedFields;

                  // Active displayed value
                  const currentValue = isEdited
                    ? editedFields[fieldName]
                    : hasCorrection
                    ? ef.corrected_value
                    : ef?.extracted_value || '';

                  // Confidence status
                  const conf = ef?.confidence ?? 0.85;
                  const isLowConf = conf < 0.75 || ef?.needs_review;

                  let confLevel = 'high';
                  if (conf >= 0.8) confLevel = 'high';
                  else if (conf >= 0.5) confLevel = 'medium';
                  else confLevel = 'low';

                  // Evidence snippet citation from OCR
                  const evidenceSnippet = ef?.evidence_text || (ef?.extracted_value ? `"${ef.extracted_value}"` : null);

                  return (
                    <div
                      key={fieldName}
                      className={`p-3 rounded-lg border transition-all ${
                        isLowConf
                          ? 'border-l-4 border-l-amber-400 bg-amber-50/20 border-slate-200'
                          : 'border-slate-200/90 bg-white'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Label: Owner name (खातेदार का नाम) * */}
                        <div className="sm:w-1/3 min-w-[140px]">
                          <label
                            htmlFor={`field-${fieldName}`}
                            className="block text-xs font-semibold text-slate-800"
                          >
                            <span>{meta.labelEn}</span>{' '}
                            <span className="text-slate-500 font-normal">({meta.labelHi})</span>{' '}
                            <span className="text-[#dc2626]">*</span>
                          </label>
                        </div>

                        {/* Input Value */}
                        <div className="flex-1 min-w-[180px]">
                          <input
                            id={`field-${fieldName}`}
                            type="text"
                            value={currentValue}
                            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                            placeholder={meta.placeholder}
                            disabled={!canEdit}
                            className={`w-full py-1.5 px-3 rounded-lg border text-xs font-medium text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:border-[#044eed] focus:ring-2 focus:ring-blue-500/15 transition-all ${
                              isEdited
                                ? 'border-[#044eed] ring-1 ring-blue-500/20'
                                : 'border-slate-300'
                            }`}
                          />
                        </div>

                        {/* Confidence Chip matching 5.png */}
                        <div className="shrink-0 min-w-[70px]">
                          <ConfidenceChip level={confLevel} size="sm" />
                        </div>

                        {/* Evidence Citation Box matching 5.png */}
                        <div className="sm:w-1/4 shrink-0 text-left min-w-[110px]">
                          {evidenceSnippet ? (
                            <div className="text-[11px] text-slate-500 leading-tight">
                              <span className="text-[10px] uppercase font-mono text-slate-400 block font-semibold">
                                Evidence
                              </span>
                              <span className="truncate block font-mono text-slate-700 mt-0.5" title={evidenceSnippet}>
                                {evidenceSnippet}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">None</span>
                          )}
                        </div>
                      </div>

                      {/* Undo control showing originally extracted baseline value */}
                      {(isEdited || hasCorrection) && ef?.extracted_value && (
                        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">
                            Baseline OCR value:{' '}
                            <strong className="text-slate-700 font-mono">"{ef.extracted_value}"</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUndoField(fieldName)}
                            className="inline-flex items-center gap-1 text-[#044eed] hover:underline font-medium"
                          >
                            <Undo2 className="w-3 h-3" />
                            <span>Undo to original</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Reason for change Box matching 5.png */}
                <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="correction-reason"
                      className="block text-xs font-semibold text-slate-800"
                    >
                      Reason for change [यदि आप कोई बदलाव कर रहे हैं तो कारण लिखें]
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {reason.length}/250
                    </span>
                  </div>

                  <textarea
                    id="correction-reason"
                    rows={3}
                    maxLength={250}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter reason for correction (optional)..."
                    disabled={!canEdit}
                    className="w-full py-2 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#044eed] focus:ring-2 focus:ring-blue-500/15 transition-all resize-y"
                  />
                </div>

                {/* Bottom Action Buttons matching 5.png */}
                <div className="pt-4 flex items-center justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={handleDiscardChanges}
                    disabled={!hasPendingEdits}
                  >
                    Discard changes
                  </Button>

                  <Button
                    variant="primary"
                    type="submit"
                    disabled={!hasPendingEdits || saving}
                    loading={saving}
                    className="bg-[#1e4088] hover:bg-[#183570]"
                  >
                    Save correction
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: RAW OCR TEXT */}
          {activeTab === 'raw_ocr' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Raw OCR Extracted Text
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Unmodified text payload extracted by the OCR pipeline from original scan pages.
                  </p>
                </div>
                {landRecord?.raw_text && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={copiedRawText ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    onClick={copyRawOcrText}
                  >
                    {copiedRawText ? 'Copied' : 'Copy text'}
                  </Button>
                )}
              </div>

              {landRecord?.raw_text ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 leading-relaxed max-h-[550px] overflow-y-auto whitespace-pre-wrap select-all">
                  {landRecord.raw_text}
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  No raw OCR text stream recorded for this specimen.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: REVISION HISTORY */}
          {activeTab === 'history' && (
            <div className="p-6 space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">
                  Cadastral Revision Version Ledger
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Append-only audit trail of human corrections. Original baseline extractions remain preserved.
                </p>
              </div>

              {landRecord?.versions && landRecord.versions.length > 0 ? (
                <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                  {landRecord.versions.map((v) => (
                    <div
                      key={v.id}
                      className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#044eed] font-mono">
                          Revision Version {v.version_number}
                        </span>
                        <span className="text-slate-400 text-[11px] flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(v.created_at).toLocaleString()}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-700">
                        <span className="font-semibold text-slate-500">Reason: </span>
                        <span>{v.reason}</span>
                      </div>

                      {v.changes && Object.keys(v.changes).length > 0 && (
                        <div className="text-[11px] text-slate-600">
                          <span className="font-semibold text-slate-700 block mb-1">
                            Alterations:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(v.changes).map(([f, delta]) => (
                              <span
                                key={f}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800 font-mono text-[10px]"
                              >
                                <strong>{f}:</strong>
                                <span className="line-through text-slate-400">
                                  {delta.old || 'null'}
                                </span>
                                <span>&rarr;</span>
                                <span className="text-emerald-700 font-semibold">
                                  {delta.new || 'null'}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {v.created_by_email && (
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 pt-1 border-t border-slate-100">
                          <User className="w-3 h-3" />
                          <span>Actor: {v.created_by_email}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  Baseline extraction (Version 1). No manual corrections recorded yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
