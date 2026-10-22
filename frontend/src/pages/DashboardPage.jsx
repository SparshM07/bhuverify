import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI } from '../services/api';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldAlert,
  Search,
  Briefcase,
  TrendingUp,
  Activity,
  ArrowRight,
  RefreshCw,
  FolderLock,
  User,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Building,
  Hash
} from 'lucide-react';

export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Global Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const fetchMetrics = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await dashboardAPI.getMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load metrics', err);
      setError('Unable to load departmental metrics. Please check network connectivity.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  // Handle live global search
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults(null);
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await dashboardAPI.search(trimmed);
        setSearchResults(res);
        setSearchOpen(true);
      } catch (e) {
        console.error('Search error', e);
      } finally {
        setSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const getBucketColor = (bucket) => {
    if (bucket.includes('90')) return 'bg-emerald-500 text-emerald-400';
    if (bucket.includes('80')) return 'bg-teal-500 text-teal-400';
    if (bucket.includes('70')) return 'bg-blue-500 text-blue-400';
    if (bucket.includes('50-69')) return 'bg-amber-500 text-amber-400';
    return 'bg-rose-500 text-rose-400';
  };

  const formatAction = (action) => {
    return action
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono mb-3">
              <ShieldCheck className="w-3.5 h-3.5" /> UP Cadastre Digitisation & Verification Engine
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Departmental Dashboard
            </h1>
            <p className="text-sm text-slate-400 mt-1.5 max-w-2xl leading-relaxed">
              Real-time monitoring of land record OCR extraction accuracy, human verification queues, cross-registry discrepancies, and parcel dispute case bundles.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => fetchMetrics(true)}
              disabled={refreshing || loading}
              className="px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 flex items-center gap-2 transition-all shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {hasRole(['admin', 'clerk']) && (
              <>
                <Link
                  to="/cases"
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-2 transition-all"
                >
                  <Briefcase className="w-3.5 h-3.5 text-amber-400" /> New Case Bundle
                </Link>
                <Link
                  to="/upload"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-2 shadow-lg shadow-emerald-600/20 border border-emerald-500/30 transition-all"
                >
                  <UploadCloud className="w-3.5 h-3.5" /> Upload Record
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="mt-6 relative">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults && setSearchOpen(true)}
              placeholder="Unified Global Search: Khasra (e.g. 45/1), Khata (e.g. 00124), Village, Owner Name, or Case Ref..."
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-11 pr-24 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all shadow-inner"
            />
            {searching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-xs text-slate-400 font-mono">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" /> Searching...
              </div>
            )}
            {searchQuery && !searching && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults(null);
                  setSearchOpen(false);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
              >
                Clear
              </button>
            )}
          </div>

          {/* Search Results Dropdown Overlay */}
          {searchOpen && searchResults && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-800 max-h-96 overflow-y-auto">
              <div className="p-3 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
                <span>
                  Found <strong className="text-white">{searchResults.total_results}</strong> matches (
                  {searchResults.documents_count} documents, {searchResults.cases_count} cases)
                </span>
                <button
                  onClick={() => setSearchOpen(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Close
                </button>
              </div>

              {searchResults.results.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">
                  No documents or cases found matching "{searchResults.query}".
                </div>
              ) : (
                searchResults.results.map((item) => (
                  <div
                    key={`${item.result_type}-${item.id}`}
                    onClick={() => {
                      setSearchOpen(false);
                      if (item.result_type === 'case') {
                        navigate('/cases');
                      } else {
                        navigate(`/documents/${item.id}`);
                      }
                    }}
                    className="p-3.5 hover:bg-slate-800/80 cursor-pointer flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        item.result_type === 'case' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {item.result_type === 'case' ? <Briefcase className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">
                            {item.title}
                          </span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {item.result_type}
                          </span>
                          {item.village && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              • {item.village}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{item.subtitle}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-right">
                      <div className="hidden sm:block">
                        <span className="text-[11px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {item.matched_field}: {item.matched_value}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary KPI Metric Cards (Scoped by Role) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Documents */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Documents</span>
            <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {loading ? '...' : metrics?.total_documents ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Accessible in ledger</p>
        </div>

        {/* Case Bundles */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Case Bundles</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {loading ? '...' : metrics?.total_cases ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Parcel bundles active</p>
        </div>

        {/* In Processing */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Processing</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-400 font-mono">
            {loading ? '...' : metrics?.processing ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">OCR queue running</p>
        </div>

        {/* Needs Review */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Needs Review</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">
            {loading ? '...' : metrics?.needs_review ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Low confidence / edits</p>
        </div>

        {/* Verification Mismatches */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Mismatches</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono">
            {loading ? '...' : metrics?.mismatches ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Red flags & registry diffs</p>
        </div>

        {/* Approved Records */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Approved</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {loading ? '...' : metrics?.approved ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Verified & certified</p>
        </div>
      </div>

      {/* Grid: Confidence Distribution Histogram + Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* OCR Confidence Distribution Chart (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" /> OCR Confidence Distribution
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Extracted word & field confidence spectrum across all active land records
                </p>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                Role: {metrics?.role || user?.role}
              </span>
            </div>

            {loading ? (
              <div className="h-56 flex items-center justify-center text-slate-500 text-sm">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading histogram data...
              </div>
            ) : (
              <div className="space-y-4 py-2">
                {metrics?.confidence_distribution?.map((item) => {
                  const barColor = getBucketColor(item.bucket);
                  return (
                    <div key={item.bucket} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-300 flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${barColor.split(' ')[0]}`} />
                          {item.label}
                        </span>
                        <div className="flex items-center gap-3 font-mono">
                          <span className="text-slate-400">{item.count} docs</span>
                          <span className="font-semibold text-white w-12 text-right">
                            {item.percentage}%
                          </span>
                        </div>
                      </div>
                      <div className="h-3 w-full bg-slate-800/80 rounded-full overflow-hidden p-0.5 border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor.split(' ')[0]}`}
                          style={{ width: `${Math.max(item.percentage, item.count > 0 ? 3 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Automated threshold flagging active (&lt;70% flags for review)
            </span>
            <Link to="/documents" className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium">
              Filter Records <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Recent Audit & Processing Activity (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" /> Irrevocable Audit Activity
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Append-only departmental ledger events
                </p>
              </div>
            </div>

            {loading ? (
              <div className="h-56 flex items-center justify-center text-slate-500 text-sm">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading ledger events...
              </div>
            ) : metrics?.recent_activity?.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-slate-500 text-sm">
                No recent activity recorded.
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {metrics?.recent_activity?.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start justify-between gap-3 text-xs hover:border-slate-700 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-emerald-400 font-mono">
                          {formatAction(ev.action)}
                        </span>
                      </div>
                      {ev.document_filename && (
                        <p className="text-slate-300 truncate max-w-[200px] font-mono text-[11px]">
                          {ev.document_filename}
                        </p>
                      )}
                      {ev.details && typeof ev.details === 'object' && (
                        <p className="text-slate-400 text-[11px]">
                          {ev.details.reason ? `Reason: "${ev.details.reason}"` : ev.details.method ? `Method: ${ev.details.method}` : ''}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-500 block font-mono">
                        {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {ev.document_id && (
                        <Link
                          to={`/documents/${ev.document_id}`}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 mt-1 inline-block"
                        >
                          View Doc
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-right">
            <Link
              to="/documents"
              className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1 font-medium"
            >
              All Records <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
