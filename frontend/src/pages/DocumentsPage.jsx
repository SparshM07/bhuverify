import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { documentAPI } from '../services/api';
import {
  FileText,
  Search,
  Filter,
  UploadCloud,
  MapPin,
  Clock,
  CheckCircle2,
  AlertOctagon,
  RefreshCw,
  FolderLock,
  ArrowRight,
  X,
  FileCheck2,
  Calendar
} from 'lucide-react';

export default function DocumentsPage() {
  const { user, hasRole } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [villageFilter, setVillageFilter] = useState('');

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await documentAPI.list({
        search: search.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        village: villageFilter.trim() || undefined,
      });
      setDocuments(data.items || []);
    } catch (err) {
      setError('Unable to load document ledger from backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchDocuments();
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [search, statusFilter, villageFilter]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setVillageFilter('');
  };

  const hasActiveFilters = search || statusFilter !== 'all' || villageFilter;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Verified
          </span>
        );
      case 'flagged':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <AlertOctagon className="w-3 h-3" /> Flagged
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Clock className="w-3 h-3" /> Processing
          </span>
        );
      case 'uploaded':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30">
            <Clock className="w-3 h-3" /> Uploaded
          </span>
        );
    }
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
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono mb-2">
            <FileText className="w-3.5 h-3.5" /> UP Cadastre Ledger
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Land Records Registry</h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse and search indexed Khatauni and Khasra specimens. All records are guarded by object-level authorization.
          </p>
        </div>

        {hasRole(['admin', 'clerk']) && (
          <Link
            to="/upload"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/20 border border-emerald-500/30 transition-all shrink-0"
          >
            <UploadCloud className="w-4 h-4" /> Ingest New Record
          </Link>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search filename, village, district, or tehsil..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs text-white placeholder-slate-400 outline-none transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="md:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 text-xs text-slate-300 outline-none transition"
            >
              <option value="all">All Verification Statuses</option>
              <option value="uploaded">Uploaded (Pending)</option>
              <option value="processing">Processing</option>
              <option value="verified">Verified</option>
              <option value="flagged">Flagged</option>
            </select>
          </div>

          {/* Village Filter */}
          <div className="md:col-span-3">
            <input
              type="text"
              value={villageFilter}
              onChange={(e) => setVillageFilter(e.target.value)}
              placeholder="Filter by Village..."
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 text-xs text-white placeholder-slate-400 outline-none transition"
            />
          </div>

          {/* Refresh / Clear Button */}
          <div className="md:col-span-1 flex items-center gap-1.5">
            <button
              onClick={fetchDocuments}
              className="w-full p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center justify-center border border-slate-700 transition"
              title="Refresh ledger"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <span>
              Showing filtered results ({documents.length} records found)
            </span>
            <button
              onClick={clearFilters}
              className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Documents Registry Table */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 text-sm">
            <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-3" />
            Querying land records ledger...
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <p className="text-sm text-rose-300 font-medium">{error}</p>
            <button
              onClick={fetchDocuments}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            >
              Retry Connection
            </button>
          </div>
        ) : documents.length === 0 ? (
          <div className="py-20 text-center text-slate-400 px-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">No matching land records found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {hasActiveFilters
                ? 'Try adjusting your search parameters or clearing filters to see more registry entries.'
                : 'The registry has no documents ingested yet. Upload an official scan to get started.'}
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
                >
                  Clear Filters
                </button>
              )}
              {hasRole(['admin', 'clerk']) && (
                <Link
                  to="/upload"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5"
                >
                  <UploadCloud className="w-4 h-4" /> Upload Document
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-4">Document / File</th>
                  <th className="py-3.5 px-4">Record Category</th>
                  <th className="py-3.5 px-4">Territory (District / Village)</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Size & Date</th>
                  <th className="py-3.5 px-4">SHA-256 Digest</th>
                  <th className="py-3.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-800/40 transition-colors group">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-emerald-400 shrink-0 border border-slate-700/60">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-200 truncate max-w-[200px]" title={doc.filename}>
                            {doc.filename}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono truncate max-w-[150px]">
                            ID: #{doc.id.slice(0, 8)}
                          </div>
                        </div>
                        {doc.is_restricted && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium"
                            title="Restricted document: hidden from citizens"
                          >
                            <FolderLock className="w-3 h-3" /> Restricted
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300">
                      <span className="px-2 py-1 rounded bg-slate-800/80 border border-slate-700/50 text-slate-300">
                        {doc.record_type || 'Khatauni (ROR)'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300">
                      <div className="flex items-center gap-1 font-medium">
                        <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>{doc.village || 'Syntheticpur'}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 pl-4">
                        {doc.tehsil ? `${doc.tehsil}, ` : ''}{doc.district || 'Lucknow'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {getStatusBadge(doc.status)}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400">
                      <div>{formatFileSize(doc.file_size_bytes)}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(doc.created_at)}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                      <span className="bg-slate-950 px-2 py-1 rounded border border-slate-800 select-all" title={doc.sha256_hash}>
                        {doc.sha256_hash.slice(0, 8)}...{doc.sha256_hash.slice(-6)}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <Link
                          to={`/documents/${doc.id}/review`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-medium text-xs border border-emerald-500/30 transition-colors"
                          title="Open Cadastral Review Workbench"
                        >
                          <FileCheck2 className="w-3.5 h-3.5" /> Review
                        </Link>
                        <Link
                          to={`/documents/${doc.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs border border-slate-700 transition-colors"
                        >
                          Inspect <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
