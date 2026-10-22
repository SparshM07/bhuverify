import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { caseAPI, documentAPI } from '../services/api';
import {
  Briefcase,
  Plus,
  Search,
  FileText,
  Paperclip,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  Shield,
  Lock,
  ChevronRight,
  ExternalLink,
  MapPin,
  Calendar,
  Layers,
  Filter,
  RefreshCw
} from 'lucide-react';

export default function CasesPage() {
  const { user, hasRole } = useAuth();

  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseLoading, setCaseLoading] = useState(false);

  // Create Case Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    parcel_identifier: '',
    village: '',
    tehsil: '',
    district: '',
  });

  // Attach Document Modal
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [availableDocs, setAvailableDocs] = useState([]);
  const [attaching, setAttaching] = useState(false);
  const [attachForm, setAttachForm] = useState({
    document_id: '',
    access_level: 'internal',
    notes: '',
  });

  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const data = await caseAPI.list();
      setCases(data.items || []);
    } catch (err) {
      console.error('Failed to load cases', err);
      setError('Unable to fetch case bundles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const handleSelectCase = async (caseId) => {
    setCaseLoading(true);
    setError(null);
    try {
      const data = await caseAPI.get(caseId);
      setSelectedCase(data);
    } catch (err) {
      console.error('Failed to fetch case detail', err);
      setError('Unable to load case bundle details.');
    } finally {
      setCaseLoading(false);
    }
  };

  const handleCreateCase = async (e) => {
    e.preventDefault();
    if (!createForm.title.trim()) return;

    setCreating(true);
    setError(null);
    try {
      const newCase = await caseAPI.create(createForm);
      setSuccessMsg(`Created bundle ${newCase.case_ref} successfully.`);
      setCreateModalOpen(false);
      setCreateForm({
        title: '',
        description: '',
        parcel_identifier: '',
        village: '',
        tehsil: '',
        district: '',
      });
      await fetchCases();
      setSelectedCase(newCase);
    } catch (err) {
      console.error('Error creating case bundle', err);
      setError(err.response?.data?.detail || 'Failed to create case bundle.');
    } finally {
      setCreating(false);
    }
  };

  const openAttachModal = async () => {
    setAttachModalOpen(true);
    try {
      const docsRes = await documentAPI.list();
      setAvailableDocs(docsRes.items || []);
      if (docsRes.items?.length > 0) {
        setAttachForm((prev) => ({ ...prev, document_id: docsRes.items[0].id }));
      }
    } catch (err) {
      console.error('Failed to load available documents', err);
    }
  };

  const handleAttachDocument = async (e) => {
    e.preventDefault();
    if (!selectedCase || !attachForm.document_id) return;

    setAttaching(true);
    setError(null);
    try {
      const updatedCase = await caseAPI.attachDocument(selectedCase.id, attachForm);
      setSelectedCase(updatedCase);
      setSuccessMsg('Document securely attached with specified access level.');
      setAttachModalOpen(false);
      setAttachForm({ document_id: '', access_level: 'internal', notes: '' });
      await fetchCases();
    } catch (err) {
      console.error('Error attaching document', err);
      setError(err.response?.data?.detail || 'Failed to attach document to case bundle.');
    } finally {
      setAttaching(false);
    }
  };

  const handleDetachDocument = async (attachmentId) => {
    if (!selectedCase) return;
    if (!window.confirm('Remove this document from the parcel case bundle?')) return;

    try {
      await caseAPI.detachDocument(selectedCase.id, attachmentId);
      const updated = await caseAPI.get(selectedCase.id);
      setSelectedCase(updated);
      setSuccessMsg('Document detached from bundle.');
      await fetchCases();
    } catch (err) {
      console.error('Failed to detach document', err);
      setError('Failed to detach document.');
    }
  };

  const filteredCases = cases.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.title?.toLowerCase().includes(q) ||
      c.case_ref?.toLowerCase().includes(q) ||
      c.village?.toLowerCase().includes(q) ||
      c.parcel_identifier?.toLowerCase().includes(q)
    );
  });

  const getAccessBadge = (level) => {
    switch (level) {
      case 'public':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'internal':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'confidential':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'restricted':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono mb-1.5">
            <Briefcase className="w-3.5 h-3.5" /> Parcel Dispute & Transaction Bundles
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Case Bundles</h1>
          <p className="text-sm text-slate-400">
            Group land records, mutation certificates, and evidence documents under unified parcel case files.
          </p>
        </div>

        {hasRole(['admin', 'clerk']) && (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-amber-600/20 border border-amber-500/30 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" /> New Case Bundle
          </button>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Main Grid: Cases List & Detail Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Cases List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ref, title, khasra or village..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-400" />
              Loading case bundles...
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="p-8 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
              No case bundles found.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredCases.map((c) => {
                const isSelected = selectedCase?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCase(c.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-950/20 border-amber-500/40 shadow-md shadow-amber-950/30'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {c.case_ref}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {c.status}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-white truncate">{c.title}</h3>
                    {c.description && (
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{c.description}</p>
                    )}

                    <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {c.village || 'N/A'} {c.parcel_identifier ? `(Plot ${c.parcel_identifier})` : ''}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-slate-300">
                        <Paperclip className="w-3 h-3 text-amber-400" />
                        {c.attachments_count} docs
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Case Bundle Detail (7 cols) */}
        <div className="lg:col-span-7">
          {caseLoading ? (
            <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-amber-400" />
              Loading bundle details...
            </div>
          ) : !selectedCase ? (
            <div className="p-12 rounded-2xl bg-slate-900/60 border border-slate-800 border-dashed text-center">
              <Briefcase className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-300">No Case Selected</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Select a case bundle from the left list to inspect its parcel identifiers, audit documents, and access controls.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
              {/* Detail Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {selectedCase.case_ref}
                    </span>
                    <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      Status: {selectedCase.status}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white">{selectedCase.title}</h2>
                  {selectedCase.description && (
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {selectedCase.description}
                    </p>
                  )}
                </div>

                {hasRole(['admin', 'clerk']) && (
                  <button
                    onClick={openAttachModal}
                    className="px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-xs font-semibold border border-amber-500/30 flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Paperclip className="w-3.5 h-3.5" /> Attach Document
                  </button>
                )}
              </div>

              {/* Parcel Demographics Badge Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                    Parcel (Khasra)
                  </span>
                  <span className="text-xs font-mono font-bold text-white mt-0.5 block">
                    {selectedCase.parcel_identifier || 'Unspecified'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                    Village
                  </span>
                  <span className="text-xs font-semibold text-white mt-0.5 block truncate">
                    {selectedCase.village || 'N/A'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                    Tehsil
                  </span>
                  <span className="text-xs font-semibold text-white mt-0.5 block truncate">
                    {selectedCase.tehsil || 'N/A'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                    District
                  </span>
                  <span className="text-xs font-semibold text-white mt-0.5 block truncate">
                    {selectedCase.district || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Attached Documents Ledger */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" /> Attached Documents (
                    {selectedCase.attachments?.length || 0})
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Irrevocable Document Pointers
                  </span>
                </div>

                {selectedCase.attachments?.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-500">
                    No documents currently linked to this case bundle.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedCase.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-white truncate max-w-xs">
                              {att.document_filename}
                            </span>
                            <span
                              className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${getAccessBadge(
                                att.access_level
                              )}`}
                            >
                              Access: {att.access_level}
                            </span>
                            {att.is_restricted && (
                              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                Restricted
                              </span>
                            )}
                          </div>

                          {att.notes && (
                            <p className="text-[11px] text-slate-400 italic">
                              "{att.notes}"
                            </p>
                          )}

                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                            <span>Status: {att.document_status}</span>
                            <span>•</span>
                            <span>Review: {att.document_review_status}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Link
                            to={`/documents/${att.document_id}`}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="Open Document Workbench"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                          {hasRole(['admin', 'clerk']) && (
                            <button
                              onClick={() => handleDetachDocument(att.id)}
                              className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                              title="Detach document"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Case Bundle */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-amber-400 font-mono text-xs mb-1">
              <Briefcase className="w-4 h-4" /> New Bundle Registration
            </div>
            <h2 className="text-lg font-bold text-white mb-4">Create Parcel Case Bundle</h2>

            <form onSubmit={handleCreateCase} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="e.g. Partition Dispute - Plot 128/4 Mauza Rampur"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Parcel Identifier (Khasra / Gata No)</label>
                <input
                  type="text"
                  value={createForm.parcel_identifier}
                  onChange={(e) => setCreateForm({ ...createForm, parcel_identifier: e.target.value })}
                  placeholder="e.g. 128/4"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Village</label>
                  <input
                    type="text"
                    value={createForm.village}
                    onChange={(e) => setCreateForm({ ...createForm, village: e.target.value })}
                    placeholder="Village"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Tehsil</label>
                  <input
                    type="text"
                    value={createForm.tehsil}
                    onChange={(e) => setCreateForm({ ...createForm, tehsil: e.target.value })}
                    placeholder="Tehsil"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">District</label>
                  <input
                    type="text"
                    value={createForm.district}
                    onChange={(e) => setCreateForm({ ...createForm, district: e.target.value })}
                    placeholder="District"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description & Context</label>
                <textarea
                  rows={3}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Details of the bundle purpose, dispute background, or legal hearing..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold flex items-center gap-1.5"
                >
                  {creating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Register Bundle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Attach Document */}
      {attachModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setAttachModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-amber-400 font-mono text-xs mb-1">
              <Paperclip className="w-4 h-4" /> Secure Document Attachment
            </div>
            <h2 className="text-lg font-bold text-white mb-4">Attach to {selectedCase?.case_ref}</h2>

            <form onSubmit={handleAttachDocument} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Select Document *</label>
                <select
                  required
                  value={attachForm.document_id}
                  onChange={(e) => setAttachForm({ ...attachForm, document_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 font-mono"
                >
                  {availableDocs.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.filename} ({doc.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Access Level Policy *</label>
                <select
                  value={attachForm.access_level}
                  onChange={(e) => setAttachForm({ ...attachForm, access_level: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 font-medium"
                >
                  <option value="public">Public (Visible to Citizen Portal & Public Verification)</option>
                  <option value="internal">Internal (Available across departmental staff)</option>
                  <option value="confidential">Confidential (Clerks & Admins only)</option>
                  <option value="restricted">Restricted (Assigned Case Officer & Admin only)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Enforces role-based visibility scoping when retrieving bundles.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Attachment Note</label>
                <input
                  type="text"
                  value={attachForm.notes}
                  onChange={(e) => setAttachForm({ ...attachForm, notes: e.target.value })}
                  placeholder="e.g. Certified registry copy submitted during hearing"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAttachModalOpen(false)}
                  className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={attaching}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold flex items-center gap-1.5"
                >
                  {attaching && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Attach Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
