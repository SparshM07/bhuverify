import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { documentAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Save,
  X,
  History,
  FileCheck2,
  Sparkles,
  Info,
  Clock,
  User,
  ExternalLink,
  Filter,
  Check,
  RefreshCw,
  HelpCircle,
  Eye,
  Tag
} from 'lucide-react';

const FIELD_METADATA = {
  owner_name: {
    labelHi: 'खातेदार का नाम',
    labelEn: 'Landholder / Owner Name',
    placeholder: 'e.g. Ramesh Kumar',
  },
  district: {
    labelHi: 'जि़ला',
    labelEn: 'District',
    placeholder: 'e.g. Lucknow (Synthetic)',
  },
  tehsil: {
    labelHi: 'तहसील',
    labelEn: 'Tehsil',
    placeholder: 'e.g. Bakshi Ka Talab (Synthetic)',
  },
  village: {
    labelHi: 'ग्राम / गाँव',
    labelEn: 'Village',
    placeholder: 'e.g. Syntheticpur',
  },
  khata_no: {
    labelHi: 'खाता संख्या',
    labelEn: 'Khata Number',
    placeholder: 'e.g. 00124',
  },
  khasra_gata_no: {
    labelHi: 'खसरा सं० (गाटा)',
    labelEn: 'Khasra / Gata Number',
    placeholder: 'e.g. 45/1, 45/2, 46',
  },
  area: {
    labelHi: 'क्षेत्रफल (हे०)',
    labelEn: 'Land Area (Hectares)',
    placeholder: 'e.g. 0.4050',
  },
  land_class: {
    labelHi: 'भूमि श्रेणी',
    labelEn: 'Land Classification',
    placeholder: 'e.g. श्रेणी 1-क (भूमिधर अधिकार वाली भूमि)',
  },
  mutation_ref: {
    labelHi: 'नामांतरण पत्रावली सं०',
    labelEn: 'Mutation Order / Case Ref',
    placeholder: 'e.g. पत्रावली सं० 42/2024',
  },
};

export default function ReviewWorkbenchPage() {
  const { id } = useParams();
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();

  // Data states
  const [document, setDocument] = useState(null);
  const [landRecord, setLandRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Scan Viewer states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageImageUrl, setPageImageUrl] = useState(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);

  // Correction & Workbench states
  const [editedFields, setEditedFields] = useState({});
  const [isEditing, setIsEditing] = useState({});
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [filterNeedsReview, setFilterNeedsReview] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const canEdit = hasRole(['admin', 'clerk']);

  // Fetch document specifications and extracted land records
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [docData, lrData] = await Promise.all([
        documentAPI.get(id),
        documentAPI.getLandRecord(id).catch((err) => {
          // If land record extraction not yet performed, return null
          return null;
        }),
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
      } catch (err) {
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

  const startEditingField = (fieldName, currentValue) => {
    setIsEditing((prev) => ({ ...prev, [fieldName]: true }));
    if (!(fieldName in editedFields)) {
      setEditedFields((prev) => ({ ...prev, [fieldName]: currentValue || '' }));
    }
  };

  const cancelEditingField = (fieldName) => {
    setIsEditing((prev) => ({ ...prev, [fieldName]: false }));
    setEditedFields((prev) => {
      const copy = { ...prev };
      delete copy[fieldName];
      return copy;
    });
  };

  // Submit corrections
  const handleSaveCorrections = async (e) => {
    e.preventDefault();
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
      setIsEditing({});
      setReason('');

      // Auto dismiss success toast after 5s
      setTimeout(() => setSaveSuccess(null), 5000);
    } catch (err) {
      setSaveError(err.response?.data?.detail || 'Failed to submit cadastral field correction.');
    } finally {
      setSaving(false);
    }
  };

  // Helper for confidence badge styling
  const getConfidenceBadge = (confidence, isMissing) => {
    if (isMissing || confidence === null || confidence === undefined) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <AlertOctagon className="w-3 h-3" /> Missing (0%)
        </span>
      );
    }

    const confPct = Math.round(confidence * 100);
    if (confPct >= 85) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3" /> High ({confPct}%)
        </span>
      );
    }
    if (confPct >= 70) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <AlertTriangle className="w-3 h-3" /> Medium ({confPct}%)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
        <AlertOctagon className="w-3 h-3" /> Low ({confPct}%)
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-3 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Loading Cadastral Review Workbench...</p>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center">
          <AlertOctagon className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-semibold text-white">Workbench Unavailable</h2>
        <p className="text-sm text-slate-400">{error || 'Document record could not be loaded.'}</p>
        <Link
          to="/documents"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Documents
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
  const fieldsNeedingReview = targetFieldsList.filter((fname) => {
    const ef = evidenceMap[fname];
    return !ef || ef.needs_review || !ef.extracted_value;
  });

  const displayedFields = filterNeedsReview
    ? targetFieldsList.filter((fname) => fieldsNeedingReview.includes(fname))
    : targetFieldsList;

  const hasPendingEdits = Object.keys(editedFields).length > 0;

  return (
    <div className="space-y-4 max-w-[1700px] mx-auto pb-12">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            to={`/documents/${id}`}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Return to Document Overview"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-bold text-white tracking-tight">
                Review Workbench: {document.filename}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {document.record_type || 'Khatauni (ROR)'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                Rev v{landRecord?.current_version || 1}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
              <span>District: <strong className="text-slate-200">{document.district || '-'}</strong></span>
              <span>•</span>
              <span>Village: <strong className="text-slate-200">{document.village || '-'}</strong></span>
              <span>•</span>
              <span>Uploaded: {new Date(document.created_at).toLocaleDateString()}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {landRecord?.versions?.length > 0 && (
            <button
              onClick={() => setShowHistoryModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700 transition"
            >
              <History className="w-3.5 h-3.5 text-emerald-400" />
              <span>Version History ({landRecord.versions.length})</span>
            </button>
          )}

          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            {landRecord?.needs_review ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                <AlertTriangle className="w-3.5 h-3.5" />
                Needs Review ({fieldsNeedingReview.length} flags)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                Review Completed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Two-Column Split Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[750px]">
        {/* ================================================================= */}
        {/* LEFT PANE: High-Resolution Scan Viewer with Zoom & Page Switcher */}
        {/* ================================================================= */}
        <div className="lg:col-span-6 flex flex-col rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
          {/* Viewer Controls Toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-850 border-b border-slate-800 text-xs">
            {/* Page switcher */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Page:</span>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || loadingImage}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 py-0.5 rounded bg-slate-900 font-mono text-emerald-400 font-semibold border border-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || loadingImage}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 py-0.5 rounded bg-slate-900 font-mono text-slate-300 text-[11px] min-w-[50px] text-center border border-slate-700">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomLevel(1.0)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition ml-1"
                title="Reset Zoom to 100%"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Scan Canvas Viewport */}
          <div className="relative flex-1 bg-slate-950 overflow-auto flex items-center justify-center p-4 min-h-[620px]">
            {loadingImage ? (
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                <span className="text-xs text-slate-400">Rendering high-res page raster...</span>
              </div>
            ) : pageImageUrl ? (
              <div
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.15s ease-out',
                }}
                className="relative shadow-2xl rounded border border-slate-700 max-w-full"
              >
                <img
                  src={pageImageUrl}
                  alt={`Original Scan Page ${currentPage}`}
                  className="max-w-none block select-none pointer-events-auto"
                />
              </div>
            ) : (
              <div className="text-center p-8 space-y-2 text-slate-500">
                <FileText className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-xs">No scan image available for page {currentPage}.</p>
              </div>
            )}
          </div>

          {/* Bottom Watermark Notice */}
          <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="text-emerald-400 font-mono">Original Upload Layer: SHA-256 Verified Immutable</span>
            <span className="text-slate-400 text-right">Synthetic Demo Specimen</span>
          </div>
        </div>

        {/* ================================================================= */}
        {/* RIGHT PANE: Extracted Fields, Confidence Badges & Inline Editor   */}
        {/* ================================================================= */}
        <div className="lg:col-span-6 flex flex-col rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
          {/* Pane Header with Filter and Status */}
          <div className="p-4 bg-slate-850 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-white">Cadastral Attribute Review</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Deterministic regex extraction with field evidence citation and human correction.
              </p>
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setFilterNeedsReview((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                filterNeedsReview
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{filterNeedsReview ? 'Showing Flagged Only' : 'Filter Needs Review'}</span>
              {fieldsNeedingReview.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400/20 text-amber-300 font-mono">
                  {fieldsNeedingReview.length}
                </span>
              )}
            </button>
          </div>

          {/* Low-confidence / Missing Fields Alert Banner */}
          {fieldsNeedingReview.length > 0 && (
            <div className="mx-4 mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-xs text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold text-amber-300">
                  {fieldsNeedingReview.length} Cadastral {fieldsNeedingReview.length === 1 ? 'Field Requires' : 'Fields Require'} Verification:
                </strong>
                <p className="text-amber-200/80 mt-0.5">
                  Fields with confidence &lt; 70% or unreadable OCR tokens are marked in amber/red. Verify against the original scan on the left and enter corrections.
                </p>
              </div>
            </div>
          )}

          {/* Form and Field Cards Scrollable Area */}
          <form onSubmit={handleSaveCorrections} className="flex-1 overflow-y-auto p-4 space-y-3.5 max-h-[620px]">
            {displayedFields.map((fieldName) => {
              const meta = FIELD_METADATA[fieldName];
              const ef = evidenceMap[fieldName];
              const isFlagged = !ef || ef.needs_review || !ef.extracted_value;
              const hasCorrection = ef?.corrected_value !== null && ef?.corrected_value !== undefined;
              const activeVal = fieldName in editedFields
                ? editedFields[fieldName]
                : (hasCorrection ? ef.corrected_value : ef?.extracted_value || '');
              const currentlyEditing = isEditing[fieldName] || false;

              return (
                <div
                  key={fieldName}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isFlagged
                      ? 'bg-slate-900/90 border-amber-500/40 shadow-sm shadow-amber-500/5'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Field Header */}
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white tracking-wide">
                          {meta.labelEn}
                        </span>
                        <span className="text-[11px] text-slate-400 font-hindi">
                          ({meta.labelHi})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {hasCorrection && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                          <Tag className="w-2.5 h-2.5" /> Corrected (v{ef.version})
                        </span>
                      )}
                      {getConfidenceBadge(ef?.confidence, !ef?.extracted_value)}
                    </div>
                  </div>

                  {/* Value Section (Read vs Edit) */}
                  <div className="pt-2.5">
                    {currentlyEditing ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={activeVal}
                            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                            placeholder={meta.placeholder}
                            autoFocus
                            className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-emerald-500/60 text-white text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => cancelEditingField(fieldName)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                            title="Revert edits"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {ef?.extracted_value && (
                          <p className="text-[11px] text-slate-400">
                            Original OCR extracted value: <code className="text-slate-300">{ef.extracted_value}</code> (baseline remains preserved)
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                          {hasCorrection ? (
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                                <span>{activeVal || '[Cleared Value]'}</span>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                                <span>Raw OCR Baseline:</span>
                                <span className="line-through text-slate-400">{ef.extracted_value || 'None'}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs font-medium text-slate-200">
                              {ef?.extracted_value ? (
                                <span className="text-slate-100 font-semibold">{ef.extracted_value}</span>
                              ) : (
                                <span className="text-rose-400/80 italic">[Unrecorded / Null OCR Detection]</span>
                              )}
                            </div>
                          )}
                        </div>

                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => startEditingField(fieldName, activeVal)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 transition"
                          >
                            <Edit3 className="w-3 h-3 text-emerald-400" />
                            <span>Edit</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Evidence & Citation Box */}
                    {ef?.evidence_text && (
                      <div className="mt-2.5 p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2">
                        <span className="font-mono text-emerald-500/80 font-bold shrink-0">OCR [P.{ef.page_no}]:</span>
                        <span className="font-mono text-slate-300 break-all select-all">{ef.evidence_text}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Mandatory Reason Input Section */}
            {hasPendingEdits && (
              <div className="p-4 rounded-xl bg-slate-850 border border-emerald-500/40 space-y-2 mt-4 shadow-lg shadow-emerald-500/5">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Mandatory Correction Justification</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Cadastral ledger regulations mandate a formal audit rationale for altering OCR extractions.
                </p>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Verified against original Patwari survey register; corrected OCR alphanumeric artifact in village name."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>
            )}

            {/* Success and Error Alerts */}
            {saveSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{saveSuccess}</span>
              </div>
            )}

            {saveError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{saveError}</span>
              </div>
            )}

            {/* Sticky Save Bar */}
            {canEdit && (
              <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                <div className="text-xs text-slate-400">
                  {hasPendingEdits ? (
                    <span className="text-emerald-400 font-medium">
                      {Object.keys(editedFields).length} field modifications pending commit.
                    </span>
                  ) : (
                    <span>All fields synchronized with current revision ledger.</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {hasPendingEdits && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditedFields({});
                        setIsEditing({});
                        setReason('');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                    >
                      Discard Edits
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={!hasPendingEdits || saving || !reason.trim()}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-xs shadow-md shadow-emerald-600/20 flex items-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span>Logging Revision Version...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save & Log Version</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Version History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-semibold text-base">
                <History className="w-5 h-5 text-emerald-400" />
                <span>Cadastral Revision Version Ledger</span>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              All human alterations generate append-only revision snapshots. Original raw OCR tokens remain immutable.
            </p>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {landRecord?.versions?.map((v) => (
                <div key={v.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-400 font-mono">
                      Revision Version {v.version_number}
                    </span>
                    <span className="text-slate-400 text-[11px] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(v.created_at).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 bg-slate-900 p-2 rounded border border-slate-800/80">
                    <strong className="text-slate-400 font-normal">Reason: </strong>
                    {v.reason}
                  </p>

                  <div className="text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-300">Alterations: </span>
                    {Object.entries(v.changes || {}).map(([f, delta]) => (
                      <span key={f} className="inline-block mr-2 mt-1 px-2 py-0.5 rounded bg-slate-800 text-slate-200">
                        <code>{f}</code>: <span className="line-through text-slate-500">{delta.old || 'null'}</span> &rarr; <span className="text-emerald-400 font-semibold">{delta.new || 'null'}</span>
                      </span>
                    ))}
                  </div>

                  {v.created_by_email && (
                    <div className="text-[10px] text-slate-500 flex items-center gap-1 pt-1">
                      <User className="w-3 h-3" />
                      <span>Authenticated Actor: {v.created_by_email}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
