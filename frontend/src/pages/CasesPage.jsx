import React, { useState, useEffect, useMemo } from 'react';
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
  ExternalLink,
  MapPin,
  Calendar,
  Layers,
  Filter,
  RefreshCw,
  Clock,
  Check,
  Download,
  Share2,
  ShieldAlert,
  ChevronRight,
  FolderOpen,
  Info,
  Building,
  Hash,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Textarea,
  StatusChip,
  Tooltip,
  Modal,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableSkeleton,
  TableEmpty,
  Pagination,
} from '../components/ui';

export default function CasesPage() {
  const { user, hasRole } = useAuth();

  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [villageFilter, setVillageFilter] = useState('all');

  const [selectedCase, setSelectedCase] = useState(null);
  const [caseLoading, setCaseLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingAccessId, setUpdatingAccessId] = useState(null);

  // Pagination for cases table
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

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

  // Feedback notifications
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Auto-clear success message after 5 seconds
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Fetch all cases
  const fetchCases = async () => {
    setLoading(true);
    try {
      const data = await caseAPI.list();
      const items = data.items || [];
      setCases(items);

      // If a case is already selected, re-fetch its details
      if (selectedCase) {
        const refreshed = items.find((c) => c.id === selectedCase.id);
        if (refreshed) {
          handleSelectCase(refreshed.id, false);
        }
      } else if (items.length > 0) {
        // Auto-select first case for master-detail view
        handleSelectCase(items[0].id, false);
      }
    } catch (err) {
      console.error('Failed to load cases', err);
      setError('Unable to fetch case bundles from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const handleSelectCase = async (caseId, showLoading = true) => {
    if (showLoading) setCaseLoading(true);
    setError(null);
    try {
      const data = await caseAPI.get(caseId);
      setSelectedCase(data);
    } catch (err) {
      console.error('Failed to fetch case detail', err);
      setError('Unable to load case bundle details.');
    } finally {
      if (showLoading) setCaseLoading(false);
    }
  };

  // Filter cases in memory
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.title?.toLowerCase().includes(q) ||
        c.case_ref?.toLowerCase().includes(q) ||
        c.village?.toLowerCase().includes(q) ||
        c.parcel_identifier?.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'all' ||
        (c.status || '').toLowerCase() === statusFilter.toLowerCase();

      const matchesVillage =
        villageFilter === 'all' ||
        (c.village || '').toLowerCase() === villageFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesVillage;
    });
  }, [cases, search, statusFilter, villageFilter]);

  // Unique villages for filter dropdown
  const uniqueVillages = useMemo(() => {
    const set = new Set();
    cases.forEach((c) => {
      if (c.village && c.village.trim()) {
        set.add(c.village.trim());
      }
    });
    return Array.from(set).sort();
  }, [cases]);

  // Paginated cases
  const totalRecords = filteredCases.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCases.slice(start, start + pageSize);
  }, [filteredCases, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, villageFilter]);

  const handleCreateCase = async (e) => {
    e.preventDefault();
    if (!createForm.title.trim()) return;

    setCreating(true);
    setError(null);
    try {
      const newCase = await caseAPI.create(createForm);
      setSuccessMsg(`Created case bundle ${newCase.case_ref} successfully.`);
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

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedCase || updatingStatus) return;
    setUpdatingStatus(true);
    setError(null);
    try {
      const updated = await caseAPI.update(selectedCase.id, { status: newStatus });
      setSelectedCase(updated);
      setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setSuccessMsg(`Case status updated to ${newStatus}.`);
    } catch (err) {
      console.error('Failed to update case status', err);
      setError(err.response?.data?.detail || 'Failed to update case status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openAttachModal = async () => {
    setAttachModalOpen(true);
    try {
      const docsRes = await documentAPI.list();
      const list = docsRes.items || [];
      setAvailableDocs(list);
      if (list.length > 0) {
        setAttachForm((prev) => ({ ...prev, document_id: list[0].id }));
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
      setCases((prev) => prev.map((c) => (c.id === updatedCase.id ? updatedCase : c)));
      setSuccessMsg('Document successfully attached to case bundle.');
      setAttachModalOpen(false);
      setAttachForm({ document_id: '', access_level: 'internal', notes: '' });
    } catch (err) {
      console.error('Error attaching document', err);
      setError(err.response?.data?.detail || 'Failed to attach document to case bundle.');
    } finally {
      setAttaching(false);
    }
  };

  const handleUpdateAccessLevel = async (attachment, newLevel) => {
    if (!selectedCase) return;
    setUpdatingAccessId(attachment.id);
    setError(null);
    try {
      const updatedCase = await caseAPI.attachDocument(selectedCase.id, {
        document_id: attachment.document_id,
        access_level: newLevel,
        notes: attachment.notes || '',
      });
      setSelectedCase(updatedCase);
      setSuccessMsg(`Access level changed to "${newLevel}".`);
    } catch (err) {
      console.error('Failed to update access level', err);
      setError('Failed to update access level.');
    } finally {
      setUpdatingAccessId(null);
    }
  };

  const handleDetachDocument = async (attachmentId) => {
    if (!selectedCase) return;
    if (!window.confirm('Remove this document from the parcel case bundle?')) return;

    try {
      await caseAPI.detachDocument(selectedCase.id, attachmentId);
      const updated = await caseAPI.get(selectedCase.id);
      setSelectedCase(updated);
      setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setSuccessMsg('Document detached from case bundle.');
    } catch (err) {
      console.error('Failed to detach document', err);
      setError('Failed to detach document.');
    }
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const getAccessBadgeClass = (level) => {
    switch (level) {
      case 'public':
        return 'bg-[#e4f8ef] text-[#166534] border-[#bbf7d0]/60';
      case 'internal':
        return 'bg-[#e5f1ff] text-[#1d4ed8] border-[#bfdbfe]/50';
      case 'confidential':
        return 'bg-[#fef8e2] text-[#92400e] border-[#fef08a]/60';
      case 'restricted':
        return 'bg-[#f3e8ff] text-[#7e22ce] border-[#e9d5ff]/60';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Synthesize timeline activity events for selected case
  const activityEvents = useMemo(() => {
    if (!selectedCase) return [];
    const events = [];

    // Case creation event
    events.push({
      id: 'created',
      date: selectedCase.created_at,
      type: 'created',
      title: 'Case bundle registered',
      desc: `Registered reference ${selectedCase.case_ref} with status "${selectedCase.status}"`,
      actor: 'System User',
    });

    // Attachment events
    if (selectedCase.attachments && selectedCase.attachments.length > 0) {
      selectedCase.attachments.forEach((att) => {
        events.push({
          id: `att-${att.id}`,
          date: att.attached_at,
          type: 'attachment',
          title: `Document attached`,
          desc: `${att.document_filename} (Access: ${att.access_level})${att.notes ? ` • "${att.notes}"` : ''}`,
          actor: 'Case Officer',
        });
      });
    }

    // Status / Update event if different from created_at
    if (
      selectedCase.updated_at &&
      selectedCase.updated_at !== selectedCase.created_at
    ) {
      events.push({
        id: 'updated',
        date: selectedCase.updated_at,
        type: 'update',
        title: 'Case bundle updated',
        desc: `Status is currently ${selectedCase.status}`,
        actor: 'Department Staff',
      });
    }

    // Sort descending by date
    return events.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [selectedCase]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cases</h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {cases.length} {cases.length === 1 ? 'bundle' : 'bundles'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Group land records, mutation certificates, and evidence documents under unified parcel case files.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Tooltip content="Coming soon">
            <Button
              variant="secondary"
              size="md"
              disabled
              leftIcon={<Download className="w-4 h-4 text-slate-400" />}
            >
              Export
            </Button>
          </Tooltip>

          {hasRole(['admin', 'clerk']) && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setCreateModalOpen(true)}
            >
              New case
            </Button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between animate-in fade-in-50">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="p-1 hover:bg-red-100 rounded text-red-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between animate-in fade-in-50">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="p-1 hover:bg-emerald-100 rounded text-emerald-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Split: Cases Table (Left) & Case Detail Panel (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Table & Filters (7 cols on lg, 6 cols on xl) */}
        <div className="lg:col-span-6 xl:col-span-6 space-y-4">
          <Card>
            {/* Filters bar */}
            <div className="p-4 border-b border-slate-100 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by ref, title, khasra, village..."
                    className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#044eed] focus:ring-1 focus:ring-blue-500/20 text-slate-900 placeholder:text-slate-400"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Status filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-[#044eed] focus:ring-1 focus:ring-blue-500/20"
                >
                  <option value="all">All statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="closed">Closed</option>
                </select>

                {/* Village filter */}
                <select
                  value={villageFilter}
                  onChange={(e) => setVillageFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-[#044eed] focus:ring-1 focus:ring-blue-500/20 max-w-[130px] truncate"
                >
                  <option value="all">All villages</option>
                  {uniqueVillages.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>

                {(search || statusFilter !== 'all' || villageFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setStatusFilter('all');
                      setVillageFilter('all');
                    }}
                    className="text-xs text-slate-500"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {/* Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Case Ref</TableHead>
                  <TableHead>Title & Parcel</TableHead>
                  <TableHead className="w-[100px]">Village</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[80px] text-center">Docs</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableSkeleton rows={5} columns={6} />
                ) : filteredCases.length === 0 ? (
                  <TableEmpty
                    title="No case bundles found"
                    description={
                      search || statusFilter !== 'all' || villageFilter !== 'all'
                        ? 'Try clearing filters or adjusting your search keywords.'
                        : 'No case bundles have been created yet. Click "New case" above to register one.'
                    }
                    colSpan={6}
                    onClearFilters={
                      search || statusFilter !== 'all' || villageFilter !== 'all'
                        ? () => {
                            setSearch('');
                            setStatusFilter('all');
                            setVillageFilter('all');
                          }
                        : undefined
                    }
                  />
                ) : (
                  paginatedCases.map((c) => {
                    const isSelected = selectedCase?.id === c.id;
                    return (
                      <TableRow
                        key={c.id}
                        selected={isSelected}
                        onClick={() => handleSelectCase(c.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50/60 font-medium'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <TableCell>
                          <span className="font-mono text-xs font-semibold text-[#044eed]">
                            {c.case_ref}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-0 max-w-[200px]">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {c.title}
                            </p>
                            {c.parcel_identifier ? (
                              <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5 truncate">
                                <Hash className="w-3 h-3 text-slate-400 shrink-0" />
                                Plot {c.parcel_identifier}
                              </p>
                            ) : (
                              <p className="text-[11px] text-slate-400 italic">No parcel id</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-slate-600 truncate block">
                            {c.village || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusChip status={c.status} size="sm" />
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            <Paperclip className="w-3 h-3 text-slate-400" />
                            {c.attachments_count || (c.attachments ? c.attachments.length : 0)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <ChevronRight
                            className={`w-4 h-4 transition-transform ${
                              isSelected ? 'text-[#044eed] translate-x-0.5' : 'text-slate-300'
                            }`}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* Pagination footer */}
            {!loading && filteredCases.length > 0 && (
              <div className="p-3 border-t border-slate-100">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalRecords={totalRecords}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Case Detail Panel (6 cols on lg/xl) */}
        <div className="lg:col-span-6 xl:col-span-6 space-y-4">
          {caseLoading ? (
            <Card className="p-12 text-center">
              <RefreshCw className="w-7 h-7 text-[#044eed] animate-spin mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-900">Loading bundle details...</h3>
              <p className="text-xs text-slate-500 mt-1">
                Fetching linked parcel records and audit timeline
              </p>
            </Card>
          ) : !selectedCase ? (
            <Card className="p-12 text-center border-dashed border-2 bg-slate-50/50">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Briefcase className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No case selected</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Select a case bundle from the table on the left to inspect parcel details, attached documents, access policies, and audit events.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* 1. Case Header Card */}
              <Card>
                <div className="p-5 space-y-4">
                  {/* Top Bar: Case Ref, Status & Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-[#044eed] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                          {selectedCase.case_ref}
                        </span>
                        <StatusChip status={selectedCase.status} size="sm" />
                        <span className="text-[11px] text-slate-400 font-mono">
                          Updated {formatDate(selectedCase.updated_at || selectedCase.created_at)}
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-slate-900 leading-snug">
                        {selectedCase.title}
                      </h2>
                    </div>

                    {/* Status Changer & Unsupported Action Tooltips */}
                    <div className="flex items-center gap-2 shrink-0">
                      {hasRole(['admin', 'clerk']) ? (
                        <div className="flex items-center gap-1.5">
                          <label className="text-[11px] font-medium text-slate-500">Status:</label>
                          <select
                            value={selectedCase.status}
                            disabled={updatingStatus}
                            onChange={(e) => handleUpdateStatus(e.target.value)}
                            className="text-xs font-semibold rounded-lg px-2.5 py-1 bg-white border border-slate-200 text-slate-800 focus:outline-none focus:border-[#044eed] cursor-pointer"
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In progress</option>
                            <option value="closed">Closed</option>
                          </select>
                        </div>
                      ) : null}

                      <Tooltip content="Coming soon">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled
                          leftIcon={<Share2 className="w-3.5 h-3.5 text-slate-400" />}
                        >
                          Share
                        </Button>
                      </Tooltip>
                    </div>
                  </div>

                  {selectedCase.description && (
                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                      {selectedCase.description}
                    </p>
                  )}

                  {/* 2. Parcel Summary Card (inside detail) */}
                  <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <MapPin className="w-3.5 h-3.5 text-[#044eed]" />
                        <span>Parcel Summary</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        Revenue Division
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                          Khasra / Plot
                        </span>
                        <span className="font-mono font-bold text-slate-900 mt-0.5 block truncate">
                          {selectedCase.parcel_identifier || 'Unspecified'}
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                          Village (गाँव)
                        </span>
                        <span className="font-semibold text-slate-900 mt-0.5 block truncate">
                          {selectedCase.village || '—'}
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                          Tehsil
                        </span>
                        <span className="font-semibold text-slate-900 mt-0.5 block truncate">
                          {selectedCase.tehsil || '—'}
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                          District
                        </span>
                        <span className="font-semibold text-slate-900 mt-0.5 block truncate">
                          {selectedCase.district || '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* 3. Documents List & Access Level Selector */}
              <Card>
                <div className="p-5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#044eed]" />
                        Attached Documents ({selectedCase.attachments?.length || 0})
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Manage document links and role-based visibility policies.
                      </p>
                    </div>

                    {hasRole(['admin', 'clerk']) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<Paperclip className="w-3.5 h-3.5 text-[#044eed]" />}
                        onClick={openAttachModal}
                      >
                        Add document
                      </Button>
                    )}
                  </div>

                  {!selectedCase.attachments || selectedCase.attachments.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center bg-slate-50/50">
                      <FolderOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-700">No documents attached yet</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Attach khatauni scans, mutation certificates, or evidence files to this case bundle.
                      </p>
                      {hasRole(['admin', 'clerk']) && (
                        <div className="mt-3">
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<Plus className="w-3.5 h-3.5" />}
                            onClick={openAttachModal}
                          >
                            Add first document
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedCase.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="p-3 rounded-xl bg-white border border-slate-200/90 hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-slate-900 truncate max-w-xs">
                                {att.document_filename}
                              </span>
                              <StatusChip status={att.document_review_status || att.document_status} size="sm" />
                              {att.is_restricted && (
                                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                                  Restricted
                                </span>
                              )}
                            </div>

                            {att.notes && (
                              <p className="text-[11px] text-slate-500 italic">
                                Note: "{att.notes}"
                              </p>
                            )}

                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 flex-wrap">
                              <span>SHA: {att.document_sha256 ? att.document_sha256.substring(0, 10) + '...' : '—'}</span>
                              <span>•</span>
                              <span>Attached {formatDate(att.attached_at)}</span>
                            </div>
                          </div>

                          {/* Access Level Selector & Action buttons */}
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Access Level Selector */}
                            <div className="flex items-center gap-1">
                              {hasRole(['admin', 'clerk']) ? (
                                <select
                                  value={att.access_level}
                                  disabled={updatingAccessId === att.id}
                                  onChange={(e) => handleUpdateAccessLevel(att, e.target.value)}
                                  className={`text-[11px] font-medium rounded-lg px-2 py-1 border transition-colors cursor-pointer outline-none ${getAccessBadgeClass(
                                    att.access_level
                                  )}`}
                                  title="Change document access level"
                                >
                                  <option value="internal">Internal</option>
                                  <option value="public">Public</option>
                                  <option value="confidential">Confidential</option>
                                  <option value="restricted">Restricted</option>
                                </select>
                              ) : (
                                <span
                                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${getAccessBadgeClass(
                                    att.access_level
                                  )}`}
                                >
                                  {att.access_level}
                                </span>
                              )}
                            </div>

                            <Link
                              to={`/documents/${att.document_id}`}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors"
                              title="Open in Document Workbench"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>

                            {hasRole(['admin', 'clerk']) && (
                              <button
                                onClick={() => handleDetachDocument(att.id)}
                                className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 text-red-600 transition-colors"
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
              </Card>

              {/* 4. Activity Feed Card */}
              <Card>
                <div className="p-5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#044eed]" />
                        Activity Feed
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Audit events and lifecycle tracking for this case bundle.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Immutable Log
                    </span>
                  </div>

                  <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {activityEvents.map((evt) => (
                      <div key={evt.id} className="relative group">
                        {/* Dot indicator */}
                        <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-white border-2 border-[#044eed] ring-2 ring-blue-50" />
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-900">
                              {evt.title}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {formatDate(evt.date)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            {evt.desc}
                          </p>
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                            By {evt.actor}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-100 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Every bundle modification is permanently recorded in the cryptographic audit trail.</span>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Case Bundle */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Parcel Case Bundle"
        description="Register a new parcel bundle to unify land records, mutation certificates, and disputes."
        maxWidth="max-w-lg"
        confirmText="Register bundle"
        cancelText="Cancel"
        onConfirm={handleCreateCase}
        loading={creating}
      >
        <form onSubmit={handleCreateCase} className="space-y-3.5 text-xs">
          <div>
            <Input
              label="Bundle Title"
              required
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              placeholder="e.g. Partition Dispute - Plot 128/4 Mauza Rampur"
            />
          </div>

          <div>
            <Input
              label="Parcel Identifier (Khasra / Gata No)"
              value={createForm.parcel_identifier}
              onChange={(e) => setCreateForm({ ...createForm, parcel_identifier: e.target.value })}
              placeholder="e.g. 128/4"
              helperText="The primary land parcel khasra number this bundle pertains to."
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <Input
                label="Village"
                value={createForm.village}
                onChange={(e) => setCreateForm({ ...createForm, village: e.target.value })}
                placeholder="Syntheticpur"
              />
            </div>
            <div>
              <Input
                label="Tehsil"
                value={createForm.tehsil}
                onChange={(e) => setCreateForm({ ...createForm, tehsil: e.target.value })}
                placeholder="Bakshi Ka Talab"
              />
            </div>
            <div>
              <Input
                label="District"
                value={createForm.district}
                onChange={(e) => setCreateForm({ ...createForm, district: e.target.value })}
                placeholder="Lucknow"
              />
            </div>
          </div>

          <div>
            <Textarea
              label="Description & Context"
              rows={3}
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              placeholder="Provide background regarding this bundle, dispute details, hearing dates or mutation summary..."
              maxLength={500}
            />
          </div>
        </form>
      </Modal>

      {/* Modal: Attach Document */}
      <Modal
        isOpen={attachModalOpen}
        onClose={() => setAttachModalOpen(false)}
        title={`Attach Document to ${selectedCase?.case_ref || 'Case'}`}
        description="Select a processed land record and designate its access security policy."
        maxWidth="max-w-md"
        confirmText="Attach document"
        cancelText="Cancel"
        onConfirm={handleAttachDocument}
        loading={attaching}
      >
        <form onSubmit={handleAttachDocument} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Document <span className="text-red-500">*</span>
            </label>
            {availableDocs.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No available documents found.</p>
            ) : (
              <select
                required
                value={attachForm.document_id}
                onChange={(e) => setAttachForm({ ...attachForm, document_id: e.target.value })}
                className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs text-slate-900 bg-white focus:outline-none focus:border-[#044eed]"
              >
                {availableDocs.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.filename} ({doc.reference || doc.id.substring(0, 8)}) - {doc.status}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Access Level Policy <span className="text-red-500">*</span>
            </label>
            <select
              value={attachForm.access_level}
              onChange={(e) => setAttachForm({ ...attachForm, access_level: e.target.value })}
              className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs text-slate-900 bg-white focus:outline-none focus:border-[#044eed]"
            >
              <option value="internal">Internal (Available across departmental staff)</option>
              <option value="public">Public (Visible to citizen portal & public verification)</option>
              <option value="confidential">Confidential (Clerks & Admins only)</option>
              <option value="restricted">Restricted (Assigned Case Officer & Admin only)</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Controls visibility when case bundles are shared or exported.
            </p>
          </div>

          <div>
            <Input
              label="Attachment Note"
              value={attachForm.notes}
              onChange={(e) => setAttachForm({ ...attachForm, notes: e.target.value })}
              placeholder="e.g. Certified registry copy submitted during hearing"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
