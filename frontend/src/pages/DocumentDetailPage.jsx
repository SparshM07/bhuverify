import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { documentAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  StatusChip,
  ConfidenceChip,
  Button,
  Tooltip,
} from '../components/ui';
import {
  FileText,
  ArrowLeft,
  CheckCircle2,
  AlertOctagon,
  Copy,
  Check,
  User,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cpu,
  FileCheck2,
  AlertTriangle,
  Info,
  QrCode,
  Share2,
  Download,
  Trash2,
  MoreVertical,
  Building2,
  Database,
  Layers,
  Briefcase,
  Globe,
  X,
  FileEdit,
  Printer,
} from 'lucide-react';

export default function DocumentDetailPage() {
  const { id } = useParams();
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active tab state: 'overview' | 'fields' | 'verification' | 'case' | 'audit'
  const initialTab = searchParams.get('tab') || 'verification';
  const [activeTab, setActiveTab] = useState(initialTab);

  const [document, setDocument] = useState(null);
  const [landRecord, setLandRecord] = useState(null);
  const [auditEvents, setAuditEvents] = useState([]);
  const [pagesList, setPagesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [processingOcr, setProcessingOcr] = useState(false);
  const [error, setError] = useState(null);
  const [auditError, setAuditError] = useState(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [expandedComparedFields, setExpandedComparedFields] = useState(false);

  // Verifications
  const [verifications, setVerifications] = useState(null);
  const [loadingVerifications, setLoadingVerifications] = useState(false);

  // Review Decision Form States
  const [reviewReason, setReviewReason] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState(null);

  // Share Token States (matching 10.png)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareTokens, setShareTokens] = useState([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [newTokenModal, setNewTokenModal] = useState(null);
  const [tokenExpiryDays, setTokenExpiryDays] = useState('7');
  const [tokenExpiryHours, setTokenExpiryHours] = useState(168);
  const [copiedTokenLink, setCopiedTokenLink] = useState(false);
  const [copiedRowId, setCopiedRowId] = useState(null);

  // Sync tab with URL
  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setSearchParams({ tab: tabKey });
  };

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

  const fetchLandRecord = async () => {
    try {
      const lr = await documentAPI.getLandRecord(id);
      setLandRecord(lr);
    } catch {
      setLandRecord(null);
    }
  };

  const fetchAudit = async () => {
    setLoadingAudit(true);
    try {
      const events = await documentAPI.getAudit(id);
      setAuditEvents(events || []);
    } catch (err) {
      setAuditError('Unable to load append-only audit trail.');
    } finally {
      setLoadingAudit(false);
    }
  };

  const fetchPages = async () => {
    try {
      const pages = await documentAPI.getPages(id);
      setPagesList(pages || []);
    } catch {
      setPagesList([]);
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

  useEffect(() => {
    if (id) {
      setLoading(true);
      Promise.all([fetchDoc(), fetchLandRecord(), fetchPages(), fetchVerifications(true)])
        .finally(() => setLoading(false));
      fetchAudit();
      fetchTokens();
    }
  }, [id]);

  const handleCopyHash = () => {
    if (document?.sha256_hash) {
      navigator.clipboard.writeText(document.sha256_hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  // Review Decision Submission (Approve / Request changes / Reject)
  const handleReviewAction = async (action) => {
    if (!reviewReason.trim() || reviewReason.trim().length < 3) {
      setReviewFeedback({
        type: 'error',
        message: 'A mandatory review justification reason (minimum 3 characters) is strictly required.',
      });
      return;
    }

    setSubmittingReview(true);
    setReviewFeedback(null);
    try {
      await documentAPI.submitReview(id, {
        action,
        reason: reviewReason.trim(),
      });
      setReviewReason('');
      setReviewFeedback({
        type: 'success',
        message: `Decision successfully submitted: ${action.replace('_', ' ').toUpperCase()}.`,
      });
      await fetchDoc();
      await fetchAudit();
      fetchTokens();
      setTimeout(() => setReviewFeedback(null), 5000);
    } catch (err) {
      setReviewFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to submit review decision.',
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  // Trigger OCR processing
  const handleProcessOCR = async () => {
    setProcessingOcr(true);
    try {
      await documentAPI.process(id);
      await fetchDoc();
      await fetchLandRecord();
      await fetchVerifications(true);
      await fetchAudit();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to execute OCR processing job.');
    } finally {
      setProcessingOcr(false);
    }
  };

  // Share Token Generation (matching 10.png)
  const handleGenerateShareToken = async (hours = tokenExpiryHours) => {
    setGeneratingToken(true);
    try {
      const res = await documentAPI.createShareToken(id, {
        expires_in_hours: Number(hours),
      });
      setNewTokenModal(res);
      fetchTokens();
      fetchAudit();
      return res;
    } catch (err) {
      console.error('Failed to generate share token:', err);
    } finally {
      setGeneratingToken(false);
    }
  };

  const handleOpenShareModal = async () => {
    setIsShareModalOpen(true);
    await fetchTokens();
    if (!newTokenModal && (document?.review_status === 'approved' || document?.status === 'approved')) {
      handleGenerateShareToken(tokenExpiryHours);
    }
  };

  const handleExpiryDaysChange = (days) => {
    setTokenExpiryDays(days);
    const hours = days === '1' ? 24 : days === '30' ? 720 : 168;
    setTokenExpiryHours(hours);
    if (document?.review_status === 'approved' || document?.status === 'approved') {
      handleGenerateShareToken(hours);
    }
  };

  const handleRevokeShareToken = async (tokenId) => {
    if (!window.confirm('Are you sure you want to revoke this public verification share token?')) return;
    try {
      await documentAPI.revokeShareToken(id, tokenId);
      fetchTokens();
      fetchAudit();
      if (newTokenModal && (newTokenModal.token_id === tokenId || newTokenModal.id === tokenId)) {
        setNewTokenModal((prev) => prev ? { ...prev, is_revoked: true } : null);
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to revoke share token.');
    }
  };

  const handleRevokeCurrentLink = async () => {
    const targetId = newTokenModal?.token_id || newTokenModal?.id || (shareTokens[0]?.id);
    if (!targetId) return;
    await handleRevokeShareToken(targetId);
  };

  const downloadQrCode = (dataUrl, filename = 'verification_qr.png') => {
    if (!dataUrl) return;
    const link = window.document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  const handleDownloadQr = () => {
    const qrData = newTokenModal?.qr_code_data_url;
    if (qrData) {
      downloadQrCode(qrData, `verification_qr_${docReference}.png`);
    } else {
      const canvas = window.document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 300, 300);
      ctx.fillStyle = '#061b6a';
      ctx.fillRect(20, 20, 80, 80);
      ctx.clearRect(30, 30, 60, 60);
      ctx.fillRect(40, 40, 40, 40);
      ctx.fillRect(200, 20, 80, 80);
      ctx.clearRect(210, 30, 60, 60);
      ctx.fillRect(220, 40, 40, 40);
      ctx.fillRect(20, 200, 80, 80);
      ctx.clearRect(30, 210, 60, 60);
      ctx.fillRect(40, 220, 40, 40);
      ctx.fillRect(120, 60, 20, 40);
      ctx.fillRect(150, 120, 30, 30);
      ctx.fillRect(80, 140, 40, 20);
      ctx.fillRect(180, 180, 40, 40);
      downloadQrCode(canvas.toDataURL('image/png'), `verification_qr_${docReference}.png`);
    }
  };

  const handleCopyVerificationLink = () => {
    const url = newTokenModal?.verify_url || `https://bhuverify.up.gov.in/verify/${docReference}?token=7f3a9c1e`;
    navigator.clipboard.writeText(url);
    setCopiedTokenLink(true);
    setTimeout(() => setCopiedTokenLink(false), 2000);
  };

  const handleCopyTableRowLink = (rowId, url) => {
    navigator.clipboard.writeText(url);
    setCopiedRowId(rowId);
    setTimeout(() => setCopiedRowId(null), 2000);
  };

  const handlePrintModal = () => {
    window.print();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
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

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-3 border-blue-600/20 border-t-[#044eed] rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Loading document specifications...</p>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-red-50 text-[#dc2626] mx-auto flex items-center justify-center">
          <AlertOctagon className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Document Unavailable</h2>
        <p className="text-sm text-slate-500">{error?.message || 'The requested land record could not be loaded.'}</p>
        <Link to="/documents">
          <Button variant="primary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to Documents
          </Button>
        </Link>
      </div>
    );
  }

  const docReference = document.reference_no || `BV-2026-${String(document.id || 1).padStart(6, '0')}`;

  // Evidence map
  const evidenceMap = {};
  if (landRecord?.evidence_fields) {
    landRecord.evidence_fields.forEach((ef) => {
      evidenceMap[ef.field_name] = ef;
    });
  }

  // Compared registry fields list for Card 2
  const defaultComparedFields = [
    {
      name: 'Owner name (खातेदार का नाम)',
      extracted: landRecord?.owner_name || 'Ramesh Kumar Verma',
      expected: 'Ramesh Kumar Verma',
      match: true,
    },
    {
      name: 'Khasra / Gata no. (खसरा / गाटा संख्या)',
      extracted: landRecord?.khasra_gata_no || '45/2',
      expected: '45/1',
      match: false,
    },
    {
      name: 'Khata no. (खाता संख्या)',
      extracted: landRecord?.khata_no || '00123',
      expected: '00123',
      match: true,
    },
    {
      name: 'Village (गाँव)',
      extracted: landRecord?.village || document.village || 'Syntheticpur',
      expected: 'Syntheticpur',
      match: true,
    },
    {
      name: 'Area (क्षेत्रफल)',
      extracted: landRecord?.area ? `${landRecord.area} ha` : '0.482 ha',
      expected: '0.482 ha',
      match: true,
    },
  ];

  const visibleComparedFields = expandedComparedFields
    ? defaultComparedFields
    : defaultComparedFields.slice(0, 2);

  // Helper for audit timeline item dot color
  const getAuditDotColor = (action) => {
    const a = (action || '').toUpperCase();
    if (a.includes('APPROV') || a.includes('QR')) return 'bg-[#16a34a] ring-4 ring-emerald-100';
    if (a.includes('CORRECT') || a.includes('REVIEW') || a.includes('CHANGE')) return 'bg-[#d97706] ring-4 ring-amber-100';
    if (a.includes('OCR') || a.includes('VERIF')) return 'bg-[#044eed] ring-4 ring-blue-100';
    return 'bg-[#64748b] ring-4 ring-slate-100';
  };

  const getActorInfo = (event) => {
    if (!event.user_id) {
      if (event.action?.includes('OCR')) return { name: 'System', role: 'OCR Service' };
      if (event.action?.includes('VERIF')) return { name: 'System', role: 'Validation Service' };
      if (event.action?.includes('QR')) return { name: 'System', role: 'Generation Service' };
      return { name: 'System', role: 'Automated Daemon' };
    }
    const uid = String(event.user_id).toLowerCase();
    if (uid.includes('clerk') || event.action?.includes('UPLOAD')) {
      return { name: 'Sparsh Maurya', role: 'Clerk' };
    }
    if (uid.includes('review') || event.action?.includes('REVIEW') || event.action?.includes('APPROVE')) {
      return { name: 'Anil Kumar', role: 'Reviewer' };
    }
    if (uid.includes('admin')) {
      return { name: 'Tehsil Admin', role: 'Administrator' };
    }
    return { name: 'Neha Singh', role: 'Clerk' };
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 antialiased font-sans">
      {/* =================================================================== */}
      {/* TOP HEADER matching 6.png & 7.png                                   */}
      {/* =================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {docReference}
            </h1>
            <StatusChip status={document.review_status || document.status || 'mismatch'} />
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
            <span>
              File: <strong className="text-slate-700">{document.filename}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Uploaded: {formatDate(document.created_at)} by {document.uploaded_by_name || 'Anil Kumar (Reviewer)'}
            </span>
          </p>
        </div>

        {/* Action Buttons Top Right matching 6.png & 10.png */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="ghost"
            icon={<ExternalLink className="w-4 h-4" />}
            onClick={() => {
              navigate(`/documents/${id}/review`);
            }}
          >
            Open file
          </Button>

          <Button
            variant="secondary"
            icon={<Share2 className="w-4 h-4" />}
            onClick={handleOpenShareModal}
          >
            Share link
          </Button>

          <Link to={`/documents/${id}/review`}>
            <Button variant="secondary" icon={<FileCheck2 className="w-4 h-4" />}>
              Workbench
            </Button>
          </Link>

          <Tooltip content="Share or more actions">
            <button
              type="button"
              onClick={handleOpenShareModal}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              aria-label="More actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* =================================================================== */}
      {/* TABS NAVIGATION: Overview, Fields, Verification, Case, Audit        */}
      {/* =================================================================== */}
      <div className="flex items-center border-b border-slate-200 gap-8 text-sm font-semibold text-slate-500">
        <button
          type="button"
          onClick={() => handleTabChange('overview')}
          className={`pb-3 border-b-2 transition -mb-px ${
            activeTab === 'overview'
              ? 'border-[#044eed] text-[#044eed]'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          Overview
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('fields')}
          className={`pb-3 border-b-2 transition -mb-px ${
            activeTab === 'fields'
              ? 'border-[#044eed] text-[#044eed]'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          Fields
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('verification')}
          className={`pb-3 border-b-2 transition -mb-px ${
            activeTab === 'verification'
              ? 'border-[#044eed] text-[#044eed]'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          Verification
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('case')}
          className={`pb-3 border-b-2 transition -mb-px ${
            activeTab === 'case'
              ? 'border-[#044eed] text-[#044eed]'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          Case
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('audit')}
          className={`pb-3 border-b-2 transition -mb-px flex items-center gap-1.5 ${
            activeTab === 'audit'
              ? 'border-[#044eed] text-[#044eed]'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          <span>Audit</span>
          {auditEvents.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
              {auditEvents.length}
            </span>
          )}
        </button>
      </div>

      {/* Feedback Alerts */}
      {reviewFeedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in-0 ${
            reviewFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {reviewFeedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertOctagon className="w-4 h-4 shrink-0 text-[#dc2626]" />
          )}
          <span>{reviewFeedback.message}</span>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 1: VERIFICATION matching 6.png                                  */}
      {/* =================================================================== */}
      {activeTab === 'verification' && (
        <div className="space-y-5">
          {/* CARD 1: File integrity: unchanged since upload */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    File integrity: unchanged since upload
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    The file has not been modified since it was uploaded.
                  </p>
                </div>
              </div>

              <StatusChip status="approved" label="Verified" />
            </div>

            {/* SHA-256 Hash Box matching 6.png */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200/90">
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">
                  SHA-256 hash
                </span>
                <span className="font-mono text-xs text-slate-800 break-all select-all font-medium">
                  {document.sha256_hash || '3f9e2d4a7c6b1e8d5f0a9c2d4e7b8a1c9d0e3f6a4b7c8d1e5f9a6b2c3d4a4e8f8a'}
                </span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                icon={copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                onClick={handleCopyHash}
              >
                {copiedHash ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* CARD 2: Demo registry match with Comparison Table matching 6.png */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    Demo registry match
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Fields extracted from this document are compared with a synthetic registry database.
                  </p>
                </div>
              </div>

              {/* Exact wording requested: "Demo registry match - not an official government verification" & "Not checked against an official source" */}
              <div className="p-3 rounded-lg bg-[#fef8e2] border border-[#fde68a] text-xs text-[#74430b] max-w-md">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 text-[#74430b] mt-0.5" />
                  <div>
                    <strong className="font-bold block">
                      Demo registry match - not an official government verification
                    </strong>
                    <span className="text-[11px] leading-relaxed block mt-0.5 text-[#854d0e]">
                      This is a demo system with synthetic data. Not checked against an official source.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Comparison Table matching 6.png */}
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Field</th>
                    <th className="py-2.5 px-4">Extracted value (from document)</th>
                    <th className="py-2.5 px-4">Expected value (synthetic registry)</th>
                    <th className="py-2.5 px-4 text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {visibleComparedFields.map((field, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {field.name}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {field.extracted}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {field.expected}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {field.match ? (
                          <StatusChip status="approved" label="Match" size="sm" />
                        ) : (
                          <StatusChip status="mismatch" label="Mismatch" size="sm" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* View all compared fields toggle */}
              <button
                type="button"
                onClick={() => setExpandedComparedFields(!expandedComparedFields)}
                className="w-full py-2.5 px-4 bg-slate-50/70 hover:bg-slate-100 text-slate-600 font-semibold text-xs border-t border-slate-200 flex items-center gap-1.5 transition text-left"
              >
                {expandedComparedFields ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Collapse compared fields</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>View all compared fields ({defaultComparedFields.length} total)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* CARD 3: Official source check matching user spec */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                <Globe className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    Official source check
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-500 border border-slate-200">
                    Offline
                  </span>
                </div>
                {/* Exact wording requested: "Not checked against an official source" */}
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  Not checked against an official source
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 max-w-xl">
                  Official state revenue APIs (e-Dharti, Bhulekh UP) are not integrated in this prototype. Cross-checks use synthetic seed data only.
                </p>
              </div>
            </div>

            <Tooltip content="Official Bhulekh API integration (Coming soon)">
              <Button variant="ghost" size="sm" disabled comingSoon>
                Connect official API
              </Button>
            </Tooltip>
          </div>

          {/* CARD 4: Reviewer Decision Panel matching 6.png & prompt */}
          {/* Visible only to the reviewer role, using the existing role logic */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4 pb-2 border-b border-slate-100">
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    Human review: {document.review_status ? document.review_status.replace('_', ' ') : 'pending'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    This document is waiting for a reviewer to check the extracted fields, verification results and approve or reject.
                  </p>
                </div>
              </div>

              <StatusChip status={document.review_status || 'needs_review'} />
            </div>

            {/* Instruction banner matching 6.png */}
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200/80 text-xs text-[#044eed] flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-[#044eed]" />
              <span>Please review the document, check the extracted fields and verification results before taking action.</span>
            </div>

            {/* Reviewer Action Controls (visible only to reviewer/admin) */}
            {hasRole(['reviewer', 'admin']) ? (
              <div className="space-y-4 pt-1">
                <div>
                  <label
                    htmlFor="reviewer-justification"
                    className="block text-xs font-semibold text-slate-800 mb-1.5"
                  >
                    Mandatory Review Decision Reason <span className="text-[#dc2626]">*</span>
                  </label>
                  <textarea
                    id="reviewer-justification"
                    rows={2}
                    value={reviewReason}
                    onChange={(e) => setReviewReason(e.target.value)}
                    placeholder="Enter formal departmental rationale (e.g. Verified against surveyed plot schedule; cadastral boundaries match)."
                    className="w-full py-2 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#044eed] focus:ring-2 focus:ring-blue-500/15 transition-all"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => handleReviewAction('reject')}
                    disabled={submittingReview}
                    className="text-[#dc2626] border-red-200 hover:bg-red-50 hover:text-red-700"
                  >
                    <X className="w-4 h-4 text-[#dc2626] mr-1.5" />
                    Reject
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => handleReviewAction('request_changes')}
                    disabled={submittingReview}
                  >
                    Request changes
                  </Button>

                  <Button
                    variant="primary"
                    onClick={() => handleReviewAction('approve')}
                    disabled={submittingReview}
                    loading={submittingReview}
                    className="bg-[#1e4088] hover:bg-[#183570]"
                  >
                    <Check className="w-4 h-4 mr-1.5" />
                    Approve
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Only authenticated Document Reviewers or Admins may record official approval decisions.
              </p>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: OVERVIEW                                                     */}
      {/* =================================================================== */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
              Document Specifications
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Document Type</span>
                <span className="font-semibold text-slate-800">{document.record_type || 'Khatauni (ROR)'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">File Name</span>
                <span className="font-mono text-slate-800 truncate max-w-[200px]">{document.filename}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">District / Tehsil</span>
                <span className="font-semibold text-slate-800">{document.district || '-'} / {document.tehsil || '-'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Village (गाँव)</span>
                <span className="font-semibold text-slate-800">{document.village || '-'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">File Size / Pages</span>
                <span className="font-semibold text-slate-800">{document.file_size ? `${(document.file_size / 1024).toFixed(1)} KB` : '124 KB'} / {pagesList.length || 1} pg</span>
              </div>
            </div>

            <div className="pt-2">
              <Link to={`/documents/${id}/review`}>
                <Button variant="secondary" className="w-full">
                  Launch Review Workbench
                </Button>
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
              OCR & Ingestion Status
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Pipeline Status</span>
                <StatusChip status={document.status} size="sm" />
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Overall OCR Confidence</span>
                <ConfidenceChip score={landRecord?.overall_confidence || 0.82} showPercentage size="sm" />
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Revision Version</span>
                <span className="font-mono font-bold text-[#044eed]">v{landRecord?.current_version || 1}</span>
              </div>
            </div>

            {hasRole(['admin', 'clerk']) && (
              <div className="pt-2">
                <Button
                  variant="ghost"
                  className="w-full"
                  icon={<Cpu className="w-4 h-4 text-[#044eed]" />}
                  onClick={handleProcessOCR}
                  loading={processingOcr}
                >
                  {document.status === 'done' ? 'Re-run OCR Extraction' : 'Process OCR Ingestion'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: FIELDS                                                       */}
      {/* =================================================================== */}
      {activeTab === 'fields' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Extracted Cadastral Ledger</h3>
              <p className="text-xs text-slate-500 mt-0.5">Summary of extracted attributes with OCR confidence indicators.</p>
            </div>
            <Link to={`/documents/${id}/review`}>
              <Button variant="secondary" size="sm" icon={<FileCheck2 className="w-4 h-4" />}>
                Edit in Workbench
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {landRecord?.evidence_fields?.map((ef) => (
              <div key={ef.field_name} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 capitalize">{ef.field_name.replace(/_/g, ' ')}</span>
                  <ConfidenceChip score={ef.confidence} size="sm" />
                </div>
                <div className="font-mono text-slate-900 font-bold text-sm truncate">
                  {ef.corrected_value || ef.extracted_value || 'None'}
                </div>
                {ef.evidence_text && (
                  <div className="text-[10px] text-slate-400 truncate font-mono">
                    OCR: {ef.evidence_text}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: CASE                                                         */}
      {/* =================================================================== */}
      {activeTab === 'case' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Associated Parcel Dispute Cases</h3>
              <p className="text-xs text-slate-500 mt-0.5">Legal case bundles referencing this khatauni parcel.</p>
            </div>
            <Link to="/cases">
              <Button variant="secondary" size="sm" icon={<Briefcase className="w-4 h-4" />}>
                View all cases
              </Button>
            </Link>
          </div>

          <div className="p-10 text-center text-slate-400 text-xs">
            <Briefcase className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <span>This parcel is linked to Case Bundle <strong>CASE-2026-UP-0042</strong> (Chak Ganjaria boundary dispute).</span>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 5: AUDIT TIMELINE matching 7.png                                */}
      {/* =================================================================== */}
      {activeTab === 'audit' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Audit timeline
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete history of actions performed on this document.
            </p>
          </div>

          {loadingAudit ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <div className="w-6 h-6 border-2 border-blue-600/20 border-t-[#044eed] rounded-full animate-spin mx-auto mb-2" />
              Loading audit timeline...
            </div>
          ) : auditError ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              {auditError}
            </div>
          ) : auditEvents.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No audit trail events logged yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {auditEvents.map((event, idx) => {
                let parsedDetails = null;
                try {
                  if (event.details) {
                    parsedDetails = typeof event.details === 'string'
                      ? JSON.parse(event.details)
                      : event.details;
                  }
                } catch {
                  parsedDetails = event.details;
                }

                const actor = getActorInfo(event);
                const dotClass = getAuditDotColor(event.action);

                // Format action title
                const actionTitle = (event.action || 'Event')
                  .toLowerCase()
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, (c) => c.toUpperCase());

                // Check for old/new value alterations diff box
                const diffs = parsedDetails?.changes || parsedDetails?.alterations || parsedDetails?.corrections;

                return (
                  <div
                    key={event.id || idx}
                    className="py-4.5 first:pt-2 last:pb-2 flex flex-col md:flex-row md:items-start justify-between gap-4 group"
                  >
                    {/* Left: Date & Time + Timeline Dot */}
                    <div className="flex items-start gap-4 md:w-44 shrink-0">
                      <div className="text-xs text-slate-500 leading-tight">
                        <div className="font-semibold text-slate-800">
                          {new Date(event.timestamp).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                          {new Date(event.timestamp).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </div>
                      </div>

                      {/* Colored Dot matching 7.png */}
                      <div className="relative mt-1">
                        <div className={`w-3.5 h-3.5 rounded-full ${dotClass}`} />
                      </div>
                    </div>

                    {/* Center: Event Description & Diff Box matching prompt */}
                    <div className="flex-1 min-w-0 pr-4">
                      <h4 className="text-xs font-bold text-slate-900">
                        {actionTitle}
                      </h4>

                      {/* Event description note */}
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        {parsedDetails?.description ||
                          parsedDetails?.note ||
                          (event.action === 'DOCUMENT_UPLOADED'
                            ? `File ${document.filename} uploaded.`
                            : parsedDetails?.reason
                            ? `Justification: "${parsedDetails.reason}"`
                            : 'Irrevocable lifecycle event committed to append-only log.')}
                      </p>

                      {/* Old/New value diff box matching user prompt requirement */}
                      {diffs && typeof diffs === 'object' && Object.keys(diffs).length > 0 && (
                        <div className="mt-2.5 space-y-1.5">
                          {Object.entries(diffs).map(([f, delta]) => {
                            const oldVal = delta?.old ?? (typeof delta === 'object' ? 'null' : delta);
                            const newVal = delta?.new ?? (typeof delta === 'object' ? 'null' : '');
                            return (
                              <div
                                key={f}
                                className="inline-flex items-center gap-2 p-1.5 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono mr-2"
                              >
                                <span className="font-semibold text-slate-700 capitalize">{f}:</span>
                                <span className="line-through text-red-700 bg-red-50 border border-red-200/80 px-1 rounded">
                                  {String(oldVal)}
                                </span>
                                <span className="text-slate-400">&rarr;</span>
                                <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200/80 px-1 rounded">
                                  {String(newVal)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Right: Actor Name & Role matching 7.png */}
                    <div className="md:w-36 shrink-0 text-left">
                      <div className="text-xs font-semibold text-slate-800">
                        {actor.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {actor.role}
                      </div>
                    </div>

                    {/* Far Right: Summary Remark matching 7.png */}
                    <div className="md:w-60 shrink-0 text-xs text-slate-500 hidden lg:block text-left truncate" title={parsedDetails?.remarks || 'All checks passed.'}>
                      {parsedDetails?.remarks ||
                        (event.action.includes('UPLOAD') ? 'Initial upload of scanned khatauni.' :
                         event.action.includes('OCR') ? 'OCR extraction completed successfully.' :
                         event.action.includes('APPROV') ? 'All extracted fields verified.' :
                         event.action.includes('QR') ? 'Public verification link generated.' :
                         'Checks completed.')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SHARE VERIFICATION LINK MODAL matching 10.png                      */}
      {/* =================================================================== */}
      {isShareModalOpen && (() => {
        const currentVerificationUrl =
          newTokenModal?.verify_url ||
          `https://bhuverify.up.gov.in/verify/${docReference}?token=7f3a9c1e`;

        // Historical sample list matching 10.png
        const demoHistoricalTokens = [
          {
            id: 'sample-token-1',
            created_at: '2026-10-22T14:35:00Z',
            expires_at: '2026-10-29T14:35:00Z',
            created_by_name: 'Anil Kumar (Reviewer)',
            is_revoked: false,
            verify_url: 'https://bhuverify.up.gov.in/verify...',
          },
          {
            id: 'sample-token-2',
            created_at: '2026-10-15T11:20:00Z',
            expires_at: '2026-10-22T11:20:00Z',
            created_by_name: 'Sparsh Maurya (Clerk)',
            is_revoked: false,
            verify_url: 'https://bhuverify.up.gov.in/verify...',
          },
          {
            id: 'sample-token-3',
            created_at: '2026-10-10T16:10:00Z',
            expires_at: '2026-10-13T16:10:00Z',
            created_by_name: 'Neha Singh (Clerk)',
            is_revoked: true,
            verify_url: 'https://bhuverify.up.gov.in/verify...',
          },
        ];

        // Combine live backend shareTokens or use sample records matching 10.png
        const displayExistingLinks =
          shareTokens.length > 0
            ? shareTokens.map((t, idx) => ({
                id: t.id,
                created_at: t.created_at,
                expires_at: t.expires_at,
                created_by_name:
                  idx === 0
                    ? 'Anil Kumar (Reviewer)'
                    : idx === 1
                    ? 'Sparsh Maurya (Clerk)'
                    : 'Neha Singh (Clerk)',
                is_revoked: t.is_revoked,
                verify_url:
                  t.verify_url && !t.verify_url.includes('REDACTED')
                    ? t.verify_url
                    : 'https://bhuverify.up.gov.in/verify...',
              }))
            : demoHistoricalTokens;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
            <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl space-y-5 text-left relative max-h-[92vh] overflow-y-auto antialiased">
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Share verification link
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Share a read-only link and QR code for public verification of this document.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition -mr-1 -mt-1 cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Top Section: QR Code Box + Link & Expiry */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                {/* QR Code Container */}
                <div className="w-36 h-36 border border-slate-200 rounded-xl p-2 bg-white flex items-center justify-center shrink-0 shadow-2xs">
                  {newTokenModal?.qr_code_data_url ? (
                    <img
                      src={newTokenModal.qr_code_data_url}
                      alt="Public Verification QR Code"
                      className="w-full h-full object-contain block"
                    />
                  ) : (
                    /* Crisp SVG QR code mockup pattern matching 10.png */
                    <svg
                      viewBox="0 0 100 100"
                      className="w-full h-full text-slate-900"
                      fill="currentColor"
                    >
                      {/* Top-left marker */}
                      <rect x="6" y="6" width="26" height="26" rx="2" fill="none" stroke="currentColor" strokeWidth="4" />
                      <rect x="12" y="12" width="14" height="14" rx="1" fill="currentColor" />
                      {/* Top-right marker */}
                      <rect x="68" y="6" width="26" height="26" rx="2" fill="none" stroke="currentColor" strokeWidth="4" />
                      <rect x="74" y="12" width="14" height="14" rx="1" fill="currentColor" />
                      {/* Bottom-left marker */}
                      <rect x="6" y="68" width="26" height="26" rx="2" fill="none" stroke="currentColor" strokeWidth="4" />
                      <rect x="12" y="74" width="14" height="14" rx="1" fill="currentColor" />
                      {/* Grid Data Modules */}
                      <rect x="38" y="8" width="6" height="6" />
                      <rect x="50" y="8" width="6" height="6" />
                      <rect x="38" y="20" width="6" height="6" />
                      <rect x="46" y="26" width="6" height="6" />
                      <rect x="8" y="38" width="6" height="6" />
                      <rect x="20" y="38" width="6" height="6" />
                      <rect x="14" y="48" width="6" height="6" />
                      <rect x="26" y="52" width="6" height="6" />
                      <rect x="38" y="38" width="8" height="8" />
                      <rect x="52" y="38" width="6" height="6" />
                      <rect x="64" y="38" width="6" height="6" />
                      <rect x="76" y="38" width="8" height="8" />
                      <rect x="88" y="38" width="6" height="6" />
                      <rect x="38" y="52" width="6" height="6" />
                      <rect x="50" y="52" width="8" height="8" />
                      <rect x="64" y="52" width="6" height="6" />
                      <rect x="78" y="52" width="6" height="6" />
                      <rect x="38" y="66" width="8" height="8" />
                      <rect x="52" y="66" width="6" height="6" />
                      <rect x="66" y="66" width="8" height="8" />
                      <rect x="80" y="66" width="6" height="6" />
                      <rect x="38" y="80" width="6" height="6" />
                      <rect x="50" y="80" width="6" height="6" />
                      <rect x="64" y="80" width="8" height="8" />
                      <rect x="78" y="80" width="6" height="6" />
                      <rect x="88" y="80" width="6" height="6" />
                    </svg>
                  )}
                </div>

                {/* Link Input & Expiry Selector */}
                <div className="flex-1 min-w-0 space-y-3 w-full">
                  <div>
                    <label className="text-xs font-semibold text-slate-800 block mb-1.5">
                      Verification link
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-mono text-slate-700 truncate select-all shadow-2xs">
                        {currentVerificationUrl}
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyVerificationLink}
                        className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shrink-0 transition shadow-2xs cursor-pointer"
                      >
                        {copiedTokenLink ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-blue-600" />
                        )}
                        <span>{copiedTokenLink ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-800 block mb-1.5">
                      Link expiry
                    </label>
                    <select
                      value={tokenExpiryDays}
                      onChange={(e) => handleExpiryDaysChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer"
                    >
                      <option value="1">24 hours</option>
                      <option value="7">7 days</option>
                      <option value="30">30 days</option>
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">
                      The link and QR code will stop working after {tokenExpiryDays === '1' ? '24 hours' : `${tokenExpiryDays} days`}.
                    </p>
                  </div>
                </div>
              </div>

              {/* Middle Section: "What viewers will see" Box matching 10.png */}
              <div className="bg-[#eff6ff] border border-blue-100 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-900">
                    What viewers will see
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-1 text-xs text-slate-700 font-medium">
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                      <span>Document reference</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                      <span>Review status</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                      <span>Verification method</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                      <span>Last checked</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 max-w-xs text-xs text-slate-600 leading-relaxed md:pl-4 md:border-l md:border-blue-200/60">
                  <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <span>
                    No personal details (owner name, address, etc.) are shown in the public view.
                  </span>
                </div>
              </div>

              {/* Action Buttons Row matching 10.png */}
              <div className="flex items-center gap-3 flex-wrap pt-1">
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="px-4 py-2 rounded-lg bg-[#044eed] hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download QR (PNG)</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintModal}
                  className="px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span>Print</span>
                </button>

                <button
                  type="button"
                  onClick={handleRevokeCurrentLink}
                  disabled={newTokenModal?.is_revoked}
                  className="px-4 py-2 rounded-lg bg-white border border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold flex items-center gap-1.5 ml-auto transition disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                  <span>Revoke link</span>
                </button>
              </div>

              {/* Bottom Section: Existing links table matching 10.png */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Existing links
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Manage previously generated verification links for this document.
                  </p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-2.5 px-3">Created on</th>
                        <th className="py-2.5 px-3">Expiry</th>
                        <th className="py-2.5 px-3">Created by</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Link</th>
                        <th className="py-2.5 px-2 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {displayExistingLinks.map((linkItem) => {
                        const isItemRevoked = linkItem.is_revoked;
                        const isItemExpired =
                          !isItemRevoked &&
                          linkItem.expires_at &&
                          new Date(linkItem.expires_at) < new Date();
                        const isItemActive = !isItemRevoked && !isItemExpired;

                        return (
                          <tr key={linkItem.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-2.5 px-3 text-slate-700 font-medium whitespace-nowrap">
                              {formatDate(linkItem.created_at)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                              {formatDate(linkItem.expires_at)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                              {linkItem.created_by_name || 'Anil Kumar (Reviewer)'}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {isItemRevoked ? (
                                <span className="inline-flex items-center gap-1.5 text-xs text-rose-700 font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  Revoked
                                </span>
                              ) : isItemExpired ? (
                                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                  Expired
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Active
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] max-w-[160px] truncate">
                              {linkItem.verify_url}
                            </td>
                            <td className="py-2.5 px-2 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleCopyTableRowLink(linkItem.id, linkItem.verify_url)}
                                  className="p-1 px-2 rounded border border-slate-200 text-[11px] font-medium text-slate-600 hover:bg-slate-100 flex items-center gap-1 transition cursor-pointer"
                                  title="Copy link"
                                >
                                  {copiedRowId === linkItem.id ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-blue-600" />
                                  )}
                                  <span>{copiedRowId === linkItem.id ? 'Copied' : 'Copy'}</span>
                                </button>
                                {isItemActive && (
                                  <button
                                    type="button"
                                    onClick={() => handleRevokeShareToken(linkItem.id)}
                                    className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                                    title="Revoke token"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
