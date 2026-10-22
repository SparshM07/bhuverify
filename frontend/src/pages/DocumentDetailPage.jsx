import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { documentAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertOctagon,
  Copy,
  Check,
  Calendar,
  User,
  HardDrive,
  MapPin,
  FolderLock,
  Layers,
  History,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cpu,
  Sparkles,
  RefreshCw,
  FileCode2,
  FileCheck2,
  Database,
  UserCheck,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Scale,
  QrCode,
  Share2,
  Download,
  ThumbsUp,
  ThumbsDown,
  FileEdit,
  Trash2
} from 'lucide-react';

export default function DocumentDetailPage() {
  const { id } = useParams();
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();

  const [document, setDocument] = useState(null);
  const [auditEvents, setAuditEvents] = useState([]);
  const [pagesList, setPagesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [loadingPages, setLoadingPages] = useState(false);
  const [processingOcr, setProcessingOcr] = useState(false);
  const [processMessage, setProcessMessage] = useState(null);
  const [error, setError] = useState(null);
  const [auditError, setAuditError] = useState(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedOcr, setCopiedOcr] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState({});
  const [verifications, setVerifications] = useState(null);
  const [loadingVerifications, setLoadingVerifications] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState(null);

  // Review Decision & Share Token States
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState('approve');
  const [reviewReason, setReviewReason] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const [shareTokens, setShareTokens] = useState([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [newTokenModal, setNewTokenModal] = useState(null);
  const [tokenExpiryHours, setTokenExpiryHours] = useState(168);
  const [copiedTokenLink, setCopiedTokenLink] = useState(false);

  const fetchDoc = async () => {
    try {
      const data = await documentAPI.get(id);
      setDocument(data);
      return data;
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setError({
          status: 404,
          message: 'Document not found or access restricted under departmental confidentiality rules.',
        });
      } else {
        setError({
          status: err.response?.status || 500,
          message: err.response?.data?.detail || 'Failed to load document specifications.',
        });
      }
      return null;
    }
  };

  const fetchAudit = async () => {
    try {
      const events = await documentAPI.getAudit(id);
      setAuditEvents(events || []);
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setAuditError('Audit trail unavailable.');
      } else {
        setAuditError('Unable to load append-only audit trail.');
      }
    }
  };

  const fetchPages = async () => {
    setLoadingPages(true);
    try {
      const pages = await documentAPI.getPages(id);
      setPagesList(pages || []);
    } catch {
      setPagesList([]);
    } finally {
      setLoadingPages(false);
    }
  };

  const fetchVerifications = async (triggerAuto = true) => {
    setLoadingVerifications(true);
    try {
      const data = await documentAPI.getVerifications(id, triggerAuto);
      setVerifications(data);
    } catch (err) {
      console.error('Failed to load verifications:', err);
    } finally {
      setLoadingVerifications(false);
    }
  };

  const fetchTokens = async () => {
    if (!hasRole(['admin', 'reviewer'])) return;
    setLoadingTokens(true);
    try {
      const tokens = await documentAPI.getShareTokens(id);
      setShareTokens(tokens || []);
    } catch {
      setShareTokens([]);
    } finally {
      setLoadingTokens(false);
    }
  };

  const handleRunVerification = async () => {
    setVerifying(true);
    setVerificationFeedback(null);
    try {
      const data = await documentAPI.verify(id);
      setVerifications(data);
      setVerificationFeedback({
        type: 'success',
        message: `Multi-layer verification completed. Total checks: ${data.total_checks}, Status: ${data.status.toUpperCase()}`
      });
      fetchAudit();
    } catch (err) {
      setVerificationFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to execute multi-layer verification.'
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmitReview = async (e) => {
    e?.preventDefault();
    if (!reviewReason || reviewReason.trim().length < 3) return;
    setSubmittingReview(true);
    try {
      await documentAPI.submitReview(id, {
        action: reviewAction,
        reason: reviewReason.trim(),
      });
      setReviewModalOpen(false);
      setReviewReason('');
      await fetchDoc();
      await fetchAudit();
      fetchTokens();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit review decision.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleGenerateShareToken = async () => {
    setGeneratingToken(true);
    try {
      const res = await documentAPI.createShareToken(id, {
        expires_in_hours: Number(tokenExpiryHours),
      });
      setNewTokenModal(res);
      fetchTokens();
      fetchAudit();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to generate share token.');
    } finally {
      setGeneratingToken(false);
    }
  };

  const handleRevokeShareToken = async (tokenId) => {
    if (!window.confirm('Are you sure you want to revoke this public verification share token?')) return;
    try {
      await documentAPI.revokeShareToken(id, tokenId);
      fetchTokens();
      fetchAudit();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to revoke share token.');
    }
  };

  const downloadQrCode = (dataUrl, filename = 'verification_qr.png') => {
    const link = window.document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  useEffect(() => {
    if (id) {
      setLoading(true);
      fetchDoc().finally(() => setLoading(false));
      fetchAudit().finally(() => setLoadingAudit(false));
      fetchPages();
      fetchVerifications(true);
      fetchTokens();
    }
  }, [id]);

  const handleProcessOCR = async () => {
    setProcessingOcr(true);
    setProcessMessage(null);
    try {
      const res = await documentAPI.process(id);
      setProcessMessage({ type: 'success', text: res.message });
      // Poll document status
      setTimeout(() => {
        fetchDoc();
        fetchAudit();
        fetchPages();
      }, 1500);
      setTimeout(() => {
        fetchDoc();
        fetchAudit();
        fetchPages();
      }, 3500);
    } catch (err) {
      setProcessMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to dispatch background OCR job.'
      });
    } finally {
      setProcessingOcr(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const copyOcrToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedOcr(true);
    setTimeout(() => setCopiedOcr(false), 2000);
  };

  const toggleEventExpand = (eventId) => {
    setExpandedEvents((prev) => ({
      ...prev,
      [eventId]: !prev[eventId],
    }));
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'done':
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> Status: Processed (Done)
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <AlertOctagon className="w-3.5 h-3.5" /> Status: OCR Failed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <div className="w-3 h-3 border-2 border-amber-400/20 border-t-amber-400 rounded-full animate-spin" /> Processing OCR...
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <Clock className="w-3.5 h-3.5" /> Status: Queued
          </span>
        );
      case 'uploaded':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30">
            <Clock className="w-3.5 h-3.5" /> Status: Uploaded
          </span>
        );
    }
  };

  const getReviewBadge = (reviewStatus) => {
    switch (reviewStatus) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> Review: Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <AlertOctagon className="w-3.5 h-3.5" /> Review: Rejected
          </span>
        );
      case 'changes_requested':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" /> Review: Changes Requested
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            <Clock className="w-3.5 h-3.5 text-slate-400" /> Review: Pending
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400 text-sm">
        <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
        Loading authenticated document details & cryptographic ledger...
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
          <FolderLock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">
          {error.status === 404 ? 'Document Not Found or Access Denied' : 'Error Retrieving Document'}
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
          {error.message}
        </p>
        <div className="pt-2">
          <Link
            to="/documents"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Land Records
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Nav Breadcrumb */}
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/documents"
          className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Records Registry
        </Link>
        <div className="text-xs text-slate-400 font-mono">
          SPECIMEN ID: #{document.id}
        </div>
      </div>

      {/* Main Header Card */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-white tracking-tight break-all">
                {document.filename}
              </h1>
              {document.is_restricted && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <FolderLock className="w-3.5 h-3.5" /> Restricted Record
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Database UUID: {document.id}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {getReviewBadge(document.review_status)}
            {getStatusBadge(document.status)}
          </div>
        </div>

        {/* Monospace SHA-256 Checksum Card */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Cryptographic SHA-256 Digest
            </span>
            <button
              onClick={() => copyToClipboard(document.sha256_hash)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 transition"
              title="Copy hash to clipboard"
            >
              {copiedHash ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Hash
                </>
              )}
            </button>
          </div>
          <div className="font-mono text-xs text-emerald-400 break-all select-all bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
            {document.sha256_hash}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Duplicate hash checks guarantee singleton entry in the registry ledger.</span>
            <span className="text-emerald-400 font-semibold">Integrity Verified</span>
          </div>
        </div>

        {/* OCR & Review Action Bar */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
          <div className="text-xs text-slate-400">
            {document.status === 'done' ? (
              <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4" /> OCR digitization completed. Text layer and bounding boxes indexed.
              </span>
            ) : document.status === 'processing' || document.status === 'queued' ? (
              <span className="text-amber-300 flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 border-2 border-amber-400/20 border-t-amber-400 rounded-full animate-spin" />
                Background OCR extraction in progress...
              </span>
            ) : document.status === 'failed' ? (
              <span className="text-rose-400 flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4" /> {document.processing_error || 'OCR Processing failed.'}
              </span>
            ) : (
              <span>Ready for OCR processing and cadastral text digitization.</span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/documents/${document.id}/review`}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-medium text-xs shadow-md shadow-teal-600/20 border border-teal-500/30 flex items-center gap-2 transition"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Review Workbench</span>
            </Link>

            {hasRole(['admin', 'reviewer']) && (
              <button
                onClick={() => {
                  setReviewAction('approve');
                  setReviewReason('');
                  setReviewModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs border border-slate-700 flex items-center gap-2 transition"
              >
                <FileEdit className="w-4 h-4 text-emerald-400" />
                <span>Submit Review Decision</span>
              </button>
            )}

            {hasRole(['admin', 'clerk']) && document.status !== 'processing' && document.status !== 'queued' && (
              <button
                onClick={handleProcessOCR}
                disabled={processingOcr}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs border border-slate-700 flex items-center gap-2 transition disabled:opacity-50"
              >
                {processingOcr ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Queueing Job...
                  </>
                ) : (
                  <>
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    {document.status === 'done' ? 'Re-run OCR' : 'Execute OCR Extraction'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {processMessage && (
          <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
            processMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
          }`}>
            <Info className="w-4 h-4 shrink-0" />
            <span>{processMessage.text}</span>
          </div>
        )}
      </div>

      {/* DEPARTMENTAL REVIEW AUDIT BANNER */}
      {document.review_reason && (
        <div className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
          document.review_status === 'approved'
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
            : document.review_status === 'rejected'
            ? 'bg-rose-500/10 border-rose-500/25 text-rose-200'
            : 'bg-amber-500/10 border-amber-500/25 text-amber-200'
        }`}>
          <div className="flex items-center justify-between font-semibold">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <FileCheck2 className="w-4 h-4" /> Departmental Review Decision: {document.review_status}
            </span>
            {document.reviewed_at && (
              <span className="font-mono text-[10px] text-slate-400">
                {formatDate(document.reviewed_at)}
              </span>
            )}
          </div>
          <p className="text-slate-300 italic">"{document.review_reason}"</p>
        </div>
      )}

      {/* DETECTED DOCUMENT QR URLS (OFFLINE PARSED WITH ALLOWLIST CHECK) */}
      {document.detected_qr_data && (() => {
        let qrItems = [];
        try {
          qrItems = typeof document.detected_qr_data === 'string'
            ? JSON.parse(document.detected_qr_data)
            : document.detected_qr_data;
        } catch {
          qrItems = [];
        }
        if (!qrItems || qrItems.length === 0) return null;

        return (
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-white uppercase tracking-wider">
                  Document QR Code Analysis (SSRF Safe)
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                No outbound HTTP fetch performed
              </span>
            </div>
            <div className="space-y-2">
              {qrItems.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="font-mono text-white truncate max-w-lg select-all">
                      {item.raw_url}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                      item.is_allowed
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                    <span>Parsed Domain: <span className="font-mono text-slate-300">{item.domain}</span></span>
                    <span className="text-emerald-400/90 font-mono text-[10px]">{item.action_taken}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* PUBLIC VERIFICATION SHARE TOKENS & QR CODES (WHEN APPROVED) */}
      {document.review_status === 'approved' && hasRole(['admin', 'reviewer']) && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Public Share Tokens & Verification QR Codes
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Generate cryptographically secure share tokens encoding only the public URL. No personal data in the QR.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={tokenExpiryHours}
                onChange={(e) => setTokenExpiryHours(Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 text-slate-200 text-xs border border-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
              >
                <option value={24}>Valid: 24 Hours</option>
                <option value={168}>Valid: 7 Days</option>
                <option value={720}>Valid: 30 Days</option>
              </select>

              <button
                onClick={handleGenerateShareToken}
                disabled={generatingToken}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{generatingToken ? 'Generating...' : 'Generate QR & Token'}</span>
              </button>
            </div>
          </div>

          {loadingTokens ? (
            <div className="py-4 text-center text-xs text-slate-400">Loading share tokens...</div>
          ) : shareTokens.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400">
              No active share tokens generated yet. Click "Generate QR & Token" to produce a public verification link.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {shareTokens.map((st) => (
                <div
                  key={st.id}
                  className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                    st.is_revoked
                      ? 'bg-slate-950/50 border-slate-800/60 opacity-60'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-slate-300 font-medium text-[11px]">
                      Token ID: #{st.id.slice(0, 8)}...
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                      st.is_revoked
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {st.is_revoked ? 'Revoked' : 'Active'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 space-y-0.5">
                    <div>Created: {formatDate(st.created_at)}</div>
                    <div>Expires: {formatDate(st.expires_at)}</div>
                  </div>

                  {!st.is_revoked && (
                    <div className="pt-2 flex items-center justify-end border-t border-slate-800/80">
                      <button
                        onClick={() => handleRevokeShareToken(st.id)}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-[11px] font-medium border border-rose-500/20 flex items-center gap-1 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Revoke Token</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MULTI-LAYER VERIFICATION PANEL */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                Cadastral Validation & Cross-Reference Ledger
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Independent multi-layered verification: Cryptographic File Integrity, Registry Match, and Human Review.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {verifications && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                verifications.status === 'verified'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : verifications.status === 'failed'
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  : verifications.status === 'review_required'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                {verifications.status === 'verified' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {verifications.status === 'failed' && <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />}
                {verifications.status === 'review_required' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                {verifications.status === 'not_checked' && <Info className="w-3.5 h-3.5 text-slate-400" />}
                Status: {verifications.status === 'failed' ? 'RED FLAG DETECTED' : verifications.status === 'review_required' ? 'REVIEW REQUIRED' : verifications.status.toUpperCase()}
              </span>
            )}

            <button
              onClick={handleRunVerification}
              disabled={verifying}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs border border-slate-700 flex items-center gap-2 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${verifying ? 'animate-spin' : ''}`} />
              <span>{verifying ? 'Verifying...' : 'Re-run Checks'}</span>
            </button>
          </div>
        </div>

        {verificationFeedback && (
          <div className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
            verificationFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
          }`}>
            <Info className="w-4 h-4 shrink-0" />
            <span>{verificationFeedback.message}</span>
          </div>
        )}

        {loadingVerifications && !verifications ? (
          <div className="py-8 flex flex-col items-center justify-center text-xs text-slate-400">
            <div className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-2" />
            Running cryptographic and registry verification engines...
          </div>
        ) : verifications ? (
          <div className="space-y-5">
            {/* ------------------------------------------------------------- */}
            {/* LAYER 1: FILE INTEGRITY */}
            {/* ------------------------------------------------------------- */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">
                    Layer 1: Cryptographic File Integrity
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">SHA-256 Checksum & Dedup Engine</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(verifications.by_layer?.file_integrity || []).map((chk) => {
                  const isTampered = chk.status === 'failed';
                  return (
                    <div
                      key={chk.id || chk.check_type}
                      className={`p-3.5 rounded-xl border text-xs space-y-2 transition ${
                        isTampered
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                          : chk.status === 'warning'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                          : 'bg-slate-900/80 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white flex items-center gap-1.5">
                          {isTampered ? (
                            <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          )}
                          {chk.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                          isTampered
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : chk.status === 'warning'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {chk.status}
                        </span>
                      </div>

                      {chk.details?.message && (
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {chk.details.message}
                        </p>
                      )}

                      {chk.details?.tampered && (
                        <div className="mt-2 p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 space-y-1 font-mono text-[11px]">
                          <div className="text-rose-400 font-semibold">TAMPERED FILE DETECTED</div>
                          <div className="text-slate-400 truncate">Expected: {chk.details.expected_hash}</div>
                          <div className="text-rose-300 truncate">Observed: {chk.details.observed_hash}</div>
                        </div>
                      )}

                      {chk.details?.duplicates && (
                        <div className="mt-2 space-y-1 text-[11px]">
                          <div className="text-amber-400 font-medium">Matches existing documents:</div>
                          {chk.details.duplicates.map((d, i) => (
                            <div key={i} className="text-slate-400 font-mono text-[10px]">
                              • {d.filename} (#{d.id.slice(0, 8)})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* LAYER 2: DEMO REGISTRY MATCH */}
            {/* ------------------------------------------------------------- */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">
                    Layer 2: State Registry Match & Rules Engine
                  </span>
                </div>
                <span className="text-[11px] text-amber-300/80 font-mono">
                  {verifications.disclaimer || 'Demo registry match - not an official government verification'}
                </span>
              </div>

              <div className="space-y-3">
                {(verifications.by_layer?.registry_match || []).map((chk) => {
                  const isRedFlag = chk.status === 'failed' || chk.details?.red_flag;
                  const isReviewRequired = chk.status === 'review_required';
                  const isNotChecked = chk.status === 'not_checked';
                  const isPassed = chk.status === 'passed';

                  return (
                    <div
                      key={chk.id || chk.check_type}
                      className={`p-3.5 rounded-xl border text-xs transition space-y-2.5 ${
                        isRedFlag
                          ? 'bg-rose-500/10 border-rose-500/30'
                          : isReviewRequired
                          ? 'bg-amber-500/10 border-amber-500/30'
                          : isNotChecked
                          ? 'bg-slate-900 border-slate-800 text-slate-400'
                          : 'bg-slate-900/70 border-slate-800/80 text-slate-300'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {isRedFlag ? (
                            <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                          ) : isReviewRequired ? (
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          ) : isNotChecked ? (
                            <Info className="w-4 h-4 text-slate-400 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          )}
                          <span className={`font-bold ${
                            isRedFlag
                              ? 'text-rose-300'
                              : isReviewRequired
                              ? 'text-amber-300'
                              : isNotChecked
                              ? 'text-slate-300'
                              : 'text-white'
                          }`}>
                            {chk.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">
                            Source: {chk.source_name}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                            isRedFlag
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : isReviewRequired
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : isNotChecked
                              ? 'bg-slate-800 text-slate-400 border border-slate-700'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {isRedFlag ? 'RED FLAG' : chk.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      {chk.details?.message && (
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          {chk.details.message}
                        </p>
                      )}

                      {/* Expected vs Observed Callout Box */}
                      {(chk.details?.expected !== undefined || chk.details?.observed !== undefined) && (
                        <div className={`p-2.5 rounded-lg border text-xs grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono ${
                          isRedFlag
                            ? 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                            : isReviewRequired
                            ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}>
                          <div className="space-y-0.5">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                              Expected (Official Registry):
                            </span>
                            <span className="font-semibold text-white">
                              {Array.isArray(chk.details?.expected)
                                ? chk.details.expected.join(', ')
                                : String(chk.details?.expected || '-')}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                              Observed (Extracted Document):
                            </span>
                            <span className={`font-semibold ${
                              isRedFlag ? 'text-rose-400' : isReviewRequired ? 'text-amber-400' : 'text-emerald-400'
                            }`}>
                              {String(chk.details?.observed || 'Missing / Not found')}
                            </span>
                          </div>
                        </div>
                      )}

                      {chk.details?.missing_fields && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
                          <span className="text-rose-400 font-medium">Missing:</span>
                          {chk.details.missing_fields.map((mf) => (
                            <span key={mf} className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono text-[10px]">
                              {mf}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* LAYER 3: HUMAN REVIEW GOVERNANCE */}
            {/* ------------------------------------------------------------- */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">
                    Layer 3: Human Review Governance
                  </span>
                </div>
                <Link
                  to={`/documents/${document.id}/review`}
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium transition"
                >
                  <span>Open Review Workbench</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              {(verifications.by_layer?.human_review || []).map((chk) => (
                <div
                  key={chk.id || chk.check_type}
                  className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                    chk.status === 'review_required'
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-slate-900/80 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white flex items-center gap-2">
                      {chk.status === 'review_required' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                      {chk.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                      chk.status === 'review_required'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {chk.status.replace('_', ' ')}
                    </span>
                  </div>

                  {chk.details?.message && (
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {chk.details.message}
                    </p>
                  )}

                  {chk.details?.latest_reason && (
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] space-y-1">
                      <span className="text-slate-400 font-medium">Audit Justification for Latest Correction:</span>
                      <p className="text-slate-200 italic">"{chk.details.latest_reason}"</p>
                    </div>
                  )}

                  {chk.details?.flagged_fields && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
                      <span className="text-amber-400 font-medium">Pending Fields:</span>
                      {chk.details.flagged_fields.map((f) => (
                        <span key={f} className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-[10px]">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-400">
            No verification checks logged yet. Click "Re-run Checks" to initiate validation.
          </div>
        )}
      </div>

      {/* Attributes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Land Record Cadastral Details */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-sm font-semibold text-white">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Cadastral Attributes (UP Revenue)</span>
          </div>
          <dl className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">Record Classification:</dt>
              <dd className="font-medium text-slate-200">
                {document.record_type || 'Khatauni (ROR)'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">State (राज्य):</dt>
              <dd className="font-medium text-slate-200">Uttar Pradesh</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">District (जि़ला):</dt>
              <dd className="font-medium text-slate-200">{document.district || '-'}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">Tehsil (तहसील):</dt>
              <dd className="font-medium text-slate-200">{document.tehsil || '-'}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">Village / Gram Panchayat:</dt>
              <dd className="font-medium text-emerald-400">{document.village || '-'}</dd>
            </div>
          </dl>
        </div>

        {/* File Ingestion & Security Specifications */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-sm font-semibold text-white">
            <HardDrive className="w-4 h-4 text-emerald-400" />
            <span>File & Ingestion Metadata</span>
          </div>
          <dl className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">MIME Content Type:</dt>
              <dd className="font-mono text-slate-200">{document.mime_type}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">File Size:</dt>
              <dd className="font-mono text-slate-200">{formatFileSize(document.file_size_bytes)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">Ingested At:</dt>
              <dd className="text-slate-200">{formatDate(document.created_at)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">Last Ledger Update:</dt>
              <dd className="text-slate-200">{formatDate(document.updated_at)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">Uploader User ID:</dt>
              <dd className="font-mono text-slate-400" title={document.uploaded_by_id}>
                {document.uploaded_by_id.slice(0, 8)}...
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Extracted Raw OCR Text & Page Analysis Card */}
      {document.raw_ocr_text && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 text-base font-semibold text-white">
                <FileCode2 className="w-5 h-5 text-emerald-400" />
                <span>Extracted OCR Text & Page Analysis</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Full-text transcription generated by PyMuPDF + OpenCV + Tesseract/RapidOCR engine.
              </p>
            </div>
            <button
              onClick={() => copyOcrToClipboard(document.raw_ocr_text)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 transition"
            >
              {copiedOcr ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Text
                </>
              )}
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto select-all">
            {document.raw_ocr_text}
          </pre>

          {pagesList.length > 0 && (
            <div className="pt-2">
              <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                Indexed Pages ({pagesList.length} total)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pagesList.map((page) => (
                  <div key={page.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold text-slate-200">
                      <span>Page {page.page_number}</span>
                      <span className="text-emerald-400 font-mono">{page.word_count} words</span>
                    </div>
                    {page.avg_confidence && (
                      <div className="text-[11px] text-slate-400">
                        Avg Confidence: {page.avg_confidence}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Append-Only Audit Timeline */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-white">
              <History className="w-5 h-5 text-emerald-400" />
              <span>Append-Only Audit Timeline</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Irrevocable ledger recording creation and all lifecycle access events.
            </p>
          </div>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
            {auditEvents.length} Events Logged
          </span>
        </div>

        {loadingAudit ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <div className="w-5 h-5 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-2" />
            Loading timeline ledger...
          </div>
        ) : auditError ? (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
            {auditError}
          </div>
        ) : auditEvents.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No audit events found for this document.
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
            {auditEvents.map((event, idx) => {
              let parsedDetails = null;
              try {
                if (event.details) {
                  parsedDetails = JSON.parse(event.details);
                }
              } catch {
                parsedDetails = event.details;
              }

              const isExpanded = !!expandedEvents[event.id];

              return (
                <div key={event.id || idx} className="relative group">
                  {/* Timeline Dot */}
                  <div className="absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full bg-slate-900 border-2 border-emerald-500 group-hover:scale-110 transition-transform" />

                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 font-mono">
                          {event.action}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Event #{event.id?.slice(0, 8)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatDate(event.timestamp)}
                      </div>
                    </div>

                    <div className="text-xs text-slate-300 flex items-center gap-2 mt-2">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Actor User ID:{' '}
                        <span className="font-mono text-slate-400">
                          {event.user_id ? event.user_id : 'System Daemon'}
                        </span>
                      </span>
                    </div>

                    {parsedDetails && (
                      <div className="mt-3 pt-2.5 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => toggleEventExpand(event.id)}
                          className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 font-medium transition"
                        >
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {isExpanded ? 'Collapse Audit Payload' : 'View Ingestion Payload & Metadata'}
                        </button>
                        {isExpanded && (
                          <pre className="mt-2 p-2.5 rounded-lg bg-slate-900 text-[11px] font-mono text-slate-300 overflow-x-auto border border-slate-800 leading-relaxed">
                            {typeof parsedDetails === 'object'
                              ? JSON.stringify(parsedDetails, null, 2)
                              : String(parsedDetails)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* REVIEW DECISION MODAL */}
      {reviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <FileEdit className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Departmental Review Decision</h3>
              </div>
              <button
                onClick={() => setReviewModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Select Decision Action:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewAction('approve')}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition ${
                      reviewAction === 'approve'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" /> Approve
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewAction('request_changes')}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition ${
                      reviewAction === 'request_changes'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 ring-1 ring-amber-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" /> Changes Req
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewAction('reject')}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition ${
                      reviewAction === 'reject'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 ring-1 ring-rose-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Mandatory Audit Justification (Minimum 3 characters):
                </label>
                <textarea
                  required
                  rows={3}
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  placeholder="State the formal basis for this decision (e.g., 'All cadastral attributes verified against Tehsil registry ledger')..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview || !reviewReason || reviewReason.trim().length < 3}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
                >
                  {submittingReview ? 'Recording Decision...' : 'Confirm & Commit Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHARE TOKEN QR DISPLAY & DOWNLOAD MODAL */}
      {newTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5 text-center">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-left">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Verification QR Code Generated</h3>
              </div>
              <button
                onClick={() => setNewTokenModal(null)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕ Close
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed text-left">
              Share this QR code or verification link with third parties or citizens. The QR encodes only the verification URL (zero PII embedded).
            </p>

            {/* QR Image Box */}
            <div className="p-4 rounded-2xl bg-white max-w-[240px] mx-auto shadow-inner border border-slate-200">
              <img
                src={newTokenModal.qr_code_data_url}
                alt="Verification QR Code"
                className="w-full h-auto block rounded-lg"
              />
            </div>

            {/* Public Link Box */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-left space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Public Verification URL
              </span>
              <div className="text-xs font-mono text-emerald-400 break-all select-all">
                {newTokenModal.verify_url}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(newTokenModal.verify_url);
                  setCopiedTokenLink(true);
                  setTimeout(() => setCopiedTokenLink(false), 2000);
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center justify-center gap-1.5 transition"
              >
                {copiedTokenLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedTokenLink ? 'Copied Link!' : 'Copy Link'}</span>
              </button>

              <button
                onClick={() => downloadQrCode(newTokenModal.qr_code_data_url, `verification_qr_${newTokenModal.token_id.slice(0, 8)}.png`)}
                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-4 h-4" />
                <span>Download QR (PNG)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
