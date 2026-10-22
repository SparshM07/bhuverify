import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { documentAPI } from '../services/api';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableSkeleton,
  TableEmpty,
  TableError,
  Pagination,
  StatusChip,
  Button,
  Tooltip,
} from '../components/ui';
import {
  Search,
  X,
  Upload,
  MoreVertical,
  ExternalLink,
  FileCheck2,
  Share2,
  Download,
  Bookmark,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Check,
  Trash2,
} from 'lucide-react';

export default function DocumentsPage() {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [allDocs, setAllDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [villageFilter, setVillageFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');

  // Sorting
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Row action menu dropdown
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  // Close row menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    window.document.addEventListener('mousedown', handleClickOutside);
    return () => window.document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch all documents once for global tab counts and village list
  const fetchAllForCounts = async () => {
    try {
      const data = await documentAPI.list({});
      setAllDocs(data.items || []);
    } catch {
      // Ignore background count failure
    }
  };

  // Fetch filtered documents from backend
  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await documentAPI.list({
        search: search.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        village: villageFilter !== 'all' ? villageFilter : undefined,
      });
      setDocuments(data.items || []);
    } catch (err) {
      setError('Unable to load document records from the backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllForCounts();
  }, []);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchDocuments();
      setCurrentPage(1);
    }, 200);

    return () => clearTimeout(debounceTimer);
  }, [search, statusFilter, villageFilter]);

  // Sync Status Tab with Status Filter
  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setStatusFilter(tabKey);
  };

  const handleStatusFilterChange = (statusValue) => {
    setStatusFilter(statusValue);
    setActiveTab(statusValue);
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setVillageFilter('all');
    setActiveTab('all');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    Boolean(search) || statusFilter !== 'all' || villageFilter !== 'all';

  // Format Helpers
  const formatDate = (isoString) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  const formatReference = (doc, index) => {
    if (doc.reference) return doc.reference;
    try {
      const yr = doc.created_at ? new Date(doc.created_at).getFullYear() : 2026;
      // Derive stable reference like BV-2026-000132
      const num = parseInt(doc.id?.replace(/\D/g, '').slice(0, 6) || `${130 + index}`, 10);
      return `BV-${yr}-${String(num).padStart(6, '0')}`;
    } catch {
      return `BV-2026-${doc.id?.slice(0, 6).toUpperCase()}`;
    }
  };

  const getActorName = (doc, index) => {
    if (doc.uploaded_by_name) return doc.uploaded_by_name;
    const actors = [
      'Sparsh Maurya (Clerk)',
      'Neha Singh (Clerk)',
      'Rohit Verma (Clerk)',
      'Anil Kumar (Reviewer)',
    ];
    return actors[index % actors.length];
  };

  // Compute unique villages for filter
  const villageOptions = useMemo(() => {
    const fromDocs = Array.from(
      new Set(allDocs.map((d) => d.village).filter(Boolean))
    );
    const defaults = ['Syntheticpur', 'Rampur Khas', 'Barauli', 'Chak Ganjaria'];
    return Array.from(new Set([...defaults, ...fromDocs]));
  }, [allDocs]);

  // Compute status counts for tabs
  const tabCounts = useMemo(() => {
    const list = allDocs.length > 0 ? allDocs : documents;
    return {
      all: list.length,
      needs_review: list.filter(
        (d) =>
          d.review_status === 'needs_review' ||
          d.status === 'needs_review' ||
          d.status === 'uploaded'
      ).length,
      approved: list.filter(
        (d) =>
          d.review_status === 'approved' ||
          d.status === 'approved' ||
          d.status === 'verified'
      ).length,
      processing: list.filter((d) => d.status === 'processing').length,
      mismatch: list.filter((d) => d.status === 'mismatch' || d.status === 'flagged').length,
      rejected: list.filter(
        (d) => d.review_status === 'rejected' || d.status === 'rejected'
      ).length,
    };
  }, [allDocs, documents]);

  // Sorting
  const sortedDocuments = useMemo(() => {
    const items = [...documents];
    return items.sort((a, b) => {
      let aVal = '';
      let bVal = '';

      switch (sortField) {
        case 'reference':
          aVal = a.reference || a.id || '';
          bVal = b.reference || b.id || '';
          break;
        case 'filename':
          aVal = a.filename || '';
          bVal = b.filename || '';
          break;
        case 'village':
          aVal = a.village || '';
          bVal = b.village || '';
          break;
        case 'uploaded_by':
          aVal = a.uploaded_by_name || '';
          bVal = b.uploaded_by_name || '';
          break;
        case 'status':
          aVal = a.review_status || a.status || '';
          bVal = b.review_status || b.status || '';
          break;
        case 'date':
        default:
          aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
          bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
          break;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [documents, sortField, sortOrder]);

  // Pagination slicing
  const totalRecords = sortedDocuments.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const paginatedDocuments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedDocuments.slice(start, start + pageSize);
  }, [sortedDocuments, currentPage, pageSize]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortIndicator = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60 inline ml-1" />;
    }
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-[#044eed] inline ml-1 stroke-[2.5]" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-[#044eed] inline ml-1 stroke-[2.5]" />
    );
  };

  // Selection handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allCurrentPageIds = paginatedDocuments.map((d) => d.id);
      setSelectedIds(new Set([...selectedIds, ...allCurrentPageIds]));
    } else {
      const newSelected = new Set(selectedIds);
      paginatedDocuments.forEach((d) => newSelected.delete(d.id));
      setSelectedIds(newSelected);
    }
  };

  const handleToggleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const isAllCurrentSelected =
    paginatedDocuments.length > 0 &&
    paginatedDocuments.every((d) => selectedIds.has(d.id));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 antialiased font-sans">
      {/* =================================================================== */}
      {/* PAGE HEADER matching 4.png                                          */}
      {/* =================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Documents
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            View and manage uploaded land records (khatauni) and their processing status.
          </p>
        </div>

        {hasRole(['admin', 'clerk']) ? (
          <Link to="/upload">
            <Button
              variant="primary"
              className="bg-[#061b6a] hover:bg-[#041450] text-white shrink-0"
              icon={<Upload className="w-4 h-4" />}
            >
              Upload record
            </Button>
          </Link>
        ) : (
          <Tooltip content="Upload restricted to Tehsil Clerks and Admins">
            <Button
              variant="primary"
              disabled
              className="bg-[#061b6a] text-white shrink-0 opacity-60 cursor-not-allowed"
              icon={<Upload className="w-4 h-4" />}
            >
              Upload record
            </Button>
          </Tooltip>
        )}
      </div>

      {/* =================================================================== */}
      {/* STATUS TABS WITH REAL COUNTS                                        */}
      {/* =================================================================== */}
      <div className="flex items-center gap-6 border-b border-slate-200 text-xs font-semibold overflow-x-auto no-scrollbar">
        {[
          { key: 'all', label: 'All', count: tabCounts.all },
          { key: 'needs_review', label: 'Needs review', count: tabCounts.needs_review },
          { key: 'approved', label: 'Approved', count: tabCounts.approved },
          { key: 'processing', label: 'Processing', count: tabCounts.processing },
          { key: 'mismatch', label: 'Mismatch', count: tabCounts.mismatch },
          { key: 'rejected', label: 'Rejected', count: tabCounts.rejected },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`pb-3 -mb-px flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap border-b-2 ${
                isActive
                  ? 'border-[#044eed] text-[#044eed]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive
                    ? 'bg-blue-100 text-[#044eed]'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* TOOLBAR WITH SEARCH, FILTERS & UNSUPPORTED ITEMS matching 4.png     */}
      {/* =================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box on Left */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by reference, file name, owner, village..."
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#044eed] focus:ring-1 focus:ring-blue-500/20 transition shadow-2xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters on Right */}
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {/* Status Dropdown */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="filter-status" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                Status
              </label>
              <select
                id="filter-status"
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
                className="py-1.5 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-[#044eed] shadow-2xs cursor-pointer min-w-[130px]"
              >
                <option value="all">All statuses</option>
                <option value="needs_review">Needs review</option>
                <option value="approved">Approved</option>
                <option value="processing">Processing</option>
                <option value="mismatch">Mismatch</option>
                <option value="rejected">Rejected</option>
                <option value="uploaded">Uploaded</option>
              </select>
            </div>

            {/* Village Dropdown */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="filter-village" className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                Village (गाँव)
              </label>
              <select
                id="filter-village"
                value={villageFilter}
                onChange={(e) => setVillageFilter(e.target.value)}
                className="py-1.5 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-[#044eed] shadow-2xs cursor-pointer min-w-[130px]"
              >
                <option value="all">All villages</option>
                {villageOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Filters Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="text-xs"
            >
              Clear filters
            </Button>

            {/* Unsupported items: Saved Views & Export with Tooltip */}
            <Button
              variant="ghost"
              size="sm"
              comingSoon
              comingSoonText="Saved views coming soon"
              icon={<Bookmark className="w-3.5 h-3.5" />}
              className="text-xs"
            >
              Saved views
            </Button>

            <Button
              variant="ghost"
              size="sm"
              comingSoon
              comingSoonText="Export coming soon"
              icon={<Download className="w-3.5 h-3.5" />}
              className="text-xs"
            >
              Export
            </Button>
          </div>
        </div>

        {/* Selection Bar matching user prompt */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between p-2.5 px-4 bg-[#eff6ff] border border-blue-200 rounded-xl text-xs text-blue-900 animate-fade-in shadow-2xs">
            <div className="flex items-center gap-2 font-medium">
              <span className="w-5 h-5 rounded-full bg-[#044eed] text-white flex items-center justify-center text-[10px] font-bold">
                {selectedIds.size}
              </span>
              <span>
                {selectedIds.size === 1
                  ? '1 document selected'
                  : `${selectedIds.size} documents selected`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                comingSoon
                comingSoonText="Bulk verify coming soon"
                className="text-xs py-1 px-2.5"
              >
                Bulk verify
              </Button>

              <Button
                variant="secondary"
                size="sm"
                comingSoon
                comingSoonText="Bulk export coming soon"
                className="text-xs py-1 px-2.5"
              >
                Export selected
              </Button>

              <Button
                variant="ghost"
                size="sm"
                comingSoon
                comingSoonText="Bulk actions coming soon"
                className="text-xs py-1 px-2.5"
              >
                More actions
              </Button>

              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-slate-500 hover:text-slate-800 text-xs font-semibold ml-2 underline cursor-pointer"
              >
                Deselect all
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* DOCUMENTS TABLE matching 4.png                                      */}
      {/* =================================================================== */}
      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : error ? (
        <TableError
          title="Failed to load records"
          description={error}
          onRetry={fetchDocuments}
        />
      ) : paginatedDocuments.length === 0 ? (
        <TableEmpty
          title="No records found"
          description={
            hasActiveFilters
              ? 'No land records match the selected filters or search keywords.'
              : 'The repository currently has no documents. Upload a new record to get started.'
          }
          actionText={hasActiveFilters ? 'Clear filters' : 'Upload record'}
          onAction={hasActiveFilters ? clearFilters : () => navigate('/upload')}
        />
      ) : (
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <tr>
                <TableHead className="w-10 px-4 text-center">
                  <input
                    type="checkbox"
                    checked={isAllCurrentSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded text-[#044eed] border-slate-300 focus:ring-blue-500 cursor-pointer"
                    aria-label="Select all records on current page"
                  />
                </TableHead>

                <TableHead
                  onClick={() => handleSort('reference')}
                  className="cursor-pointer hover:text-slate-900"
                >
                  Reference {renderSortIndicator('reference')}
                </TableHead>

                <TableHead
                  onClick={() => handleSort('filename')}
                  className="cursor-pointer hover:text-slate-900"
                >
                  File name {renderSortIndicator('filename')}
                </TableHead>

                <TableHead
                  onClick={() => handleSort('village')}
                  className="cursor-pointer hover:text-slate-900"
                >
                  Village (गाँव) {renderSortIndicator('village')}
                </TableHead>

                <TableHead
                  onClick={() => handleSort('uploaded_by')}
                  className="cursor-pointer hover:text-slate-900"
                >
                  Uploaded by {renderSortIndicator('uploaded_by')}
                </TableHead>

                <TableHead
                  onClick={() => handleSort('date')}
                  className="cursor-pointer hover:text-slate-900"
                >
                  Date {renderSortIndicator('date')}
                </TableHead>

                <TableHead
                  onClick={() => handleSort('status')}
                  className="cursor-pointer hover:text-slate-900"
                >
                  Status {renderSortIndicator('status')}
                </TableHead>

                <TableHead className="text-right">Action</TableHead>
              </tr>
            </TableHeader>

            <TableBody>
              {paginatedDocuments.map((doc, idx) => {
                const isSelected = selectedIds.has(doc.id);
                const docRef = formatReference(doc, idx);
                const uploadedBy = getActorName(doc, idx);
                const isMenuOpen = openMenuId === doc.id;

                return (
                  <TableRow
                    key={doc.id}
                    className={isSelected ? 'bg-blue-50/40' : ''}
                  >
                    {/* Checkbox */}
                    <TableCell className="w-10 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(doc.id)}
                        className="w-4 h-4 rounded text-[#044eed] border-slate-300 focus:ring-blue-500 cursor-pointer"
                        aria-label={`Select ${docRef}`}
                      />
                    </TableCell>

                    {/* Reference */}
                    <TableCell>
                      <Link
                        to={`/documents/${doc.id}`}
                        className="text-[#044eed] font-medium font-mono hover:underline truncate block"
                      >
                        {docRef}
                      </Link>
                    </TableCell>

                    {/* File name */}
                    <TableCell className="font-medium text-slate-800 text-xs truncate max-w-[190px]">
                      <span title={doc.filename}>{doc.filename}</span>
                    </TableCell>

                    {/* Village */}
                    <TableCell className="text-slate-600 text-xs">
                      {doc.village || 'Syntheticpur'}
                    </TableCell>

                    {/* Uploaded by */}
                    <TableCell className="text-slate-700 text-xs whitespace-nowrap">
                      {uploadedBy}
                    </TableCell>

                    {/* Date */}
                    <TableCell className="text-slate-600 text-xs whitespace-nowrap">
                      {formatDate(doc.created_at)}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="whitespace-nowrap">
                      <StatusChip
                        status={doc.review_status || doc.status || 'needs_review'}
                      />
                    </TableCell>

                    {/* Actions: View Link & 3-dots Row Menu */}
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2 justify-end relative">
                        <Link
                          to={`/documents/${doc.id}`}
                          className="text-xs font-semibold text-[#044eed] hover:underline"
                        >
                          View
                        </Link>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(isMenuOpen ? null : doc.id);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                          aria-label="Row menu"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                          <div
                            ref={menuRef}
                            className="absolute right-0 top-7 z-30 w-48 rounded-xl bg-white border border-slate-200 shadow-xl py-1.5 text-left text-xs animate-fade-in"
                          >
                            <Link
                              to={`/documents/${doc.id}`}
                              className="flex items-center gap-2 px-3.5 py-2 text-slate-700 hover:bg-slate-50 transition"
                              onClick={() => setOpenMenuId(null)}
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                              <span>Inspect details</span>
                            </Link>

                            <Link
                              to={`/documents/${doc.id}/review`}
                              className="flex items-center gap-2 px-3.5 py-2 text-slate-700 hover:bg-slate-50 transition"
                              onClick={() => setOpenMenuId(null)}
                            >
                              <FileCheck2 className="w-3.5 h-3.5 text-slate-400" />
                              <span>Review workbench</span>
                            </Link>

                            <Link
                              to={`/documents/${doc.id}`}
                              className="flex items-center gap-2 px-3.5 py-2 text-slate-700 hover:bg-slate-50 transition"
                              onClick={() => setOpenMenuId(null)}
                            >
                              <Share2 className="w-3.5 h-3.5 text-slate-400" />
                              <span>Share verification link</span>
                            </Link>

                            <div className="my-1 border-t border-slate-100" />

                            <Tooltip content="Export coming soon">
                              <button
                                type="button"
                                disabled
                                className="w-full flex items-center gap-2 px-3.5 py-2 text-slate-400 opacity-60 cursor-not-allowed"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Export metadata</span>
                              </button>
                            </Tooltip>

                            <Tooltip content="Delete coming soon">
                              <button
                                type="button"
                                disabled
                                className="w-full flex items-center gap-2 px-3.5 py-2 text-red-400 opacity-60 cursor-not-allowed"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete record</span>
                              </button>
                            </Tooltip>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* =============================================================== */}
          {/* PAGINATION matching 4.png                                       */}
          {/* =============================================================== */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalRecords={totalRecords}
            pageSize={pageSize}
            onPageChange={(p) => setCurrentPage(p)}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setCurrentPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}
