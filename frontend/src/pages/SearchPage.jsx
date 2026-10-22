import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { dashboardAPI, documentAPI } from '../services/api';
import {
  Search,
  MapPin,
  FileText,
  Briefcase,
  X,
  ExternalLink,
  ChevronRight,
  Filter,
  ArrowUpDown,
  MoreVertical,
  Check,
  AlertCircle,
  Hash,
  User,
  Building,
  RefreshCw,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  StatusChip,
  Tooltip,
  Pagination,
} from '../components/ui';

/**
 * Thumbnail component with real page preview or stylized cadastral document graphic
 */
function DocumentThumbnail({ id, type }) {
  const [imgUrl, setImgUrl] = useState(null);

  useEffect(() => {
    let active = true;
    if (type === 'document' && id) {
      documentAPI
        .getPageImageBlob(id, 1)
        .then((url) => {
          if (active) setImgUrl(url);
        })
        .catch(() => {
          // Fall back gracefully to SVG frame
        });
    }
    return () => {
      active = false;
    };
  }, [id, type]);

  if (imgUrl) {
    return (
      <img
        src={imgUrl}
        alt="Document scan thumbnail"
        className="w-14 h-18 object-cover rounded border border-slate-200 shrink-0 shadow-2xs"
      />
    );
  }

  return (
    <div className="w-14 h-18 rounded border border-slate-200 bg-slate-50 flex flex-col justify-between p-1.5 shrink-0 select-none shadow-2xs">
      <div className="space-y-1">
        <div className="h-1 bg-slate-300 rounded w-full" />
        <div className="h-1 bg-slate-200 rounded w-4/5" />
        <div className="h-1 bg-slate-200 rounded w-3/4" />
      </div>
      <div className="border border-slate-200 rounded p-0.5 bg-white">
        <div className="h-0.5 bg-slate-300 rounded w-full mb-0.5" />
        <div className="h-0.5 bg-slate-200 rounded w-2/3" />
      </div>
      <div className="flex justify-between items-center text-[8px] text-slate-400 font-mono">
        <span>{type === 'case' ? 'CASE' : 'ROR'}</span>
        {type === 'case' ? (
          <Briefcase className="w-2.5 h-2.5 text-slate-400" />
        ) : (
          <FileText className="w-2.5 h-2.5 text-slate-400" />
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const query = searchParams.get('q') || '';
  const [inputVal, setInputVal] = useState(query);

  const [loading, setLoading] = useState(false);
  const [rawResults, setRawResults] = useState([]);
  const [error, setError] = useState(null);

  // Filters state
  const [selectedTypes, setSelectedTypes] = useState(new Set());
  const [selectedVillages, setSelectedVillages] = useState(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState(new Set());
  const [villageSearch, setVillageSearch] = useState('');

  // Sort state: 'relevance' | 'confidence' | 'title'
  const [sortBy, setSortBy] = useState('relevance');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Synchronize local input state with query param
  useEffect(() => {
    setInputVal(query);
  }, [query]);

  // Execute backend search when query changes
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setRawResults([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    dashboardAPI
      .search(trimmed)
      .then((res) => {
        if (!active) return;
        setRawResults(res.results || []);
        setCurrentPage(1);
      })
      .catch((err) => {
        if (!active) return;
        console.error('Search error', err);
        setError('Failed to fetch search results from server.');
        setRawResults([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query]);

  // Handle in-page search submission
  const handleSearchSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const trimmed = inputVal.trim();
    if (trimmed) {
      setSearchParams({ q: trimmed });
    } else {
      setSearchParams({});
    }
  };

  // Helper to extract fields from subtitle (Owner, Khata, Khasra, etc.)
  const parseSubtitle = (item) => {
    const sub = item.subtitle || '';
    const ownerMatch = sub.match(/Owner:\s*([^|]+)/i);
    const khataMatch = sub.match(/Khata:\s*([^|]+)/i);
    const khasraMatch = sub.match(/Khasra:\s*([^|]+)/i);
    const parcelMatch = sub.match(/Parcel:\s*([^|]+)/i);
    const refMatch = sub.match(/Ref:\s*([^|]+)/i);

    const owner = ownerMatch ? ownerMatch[1].trim() : null;
    const khata = khataMatch ? khataMatch[1].trim() : null;
    const khasra = khasraMatch ? khasraMatch[1].trim() : parcelMatch ? parcelMatch[1].trim() : null;
    const ref = refMatch
      ? refMatch[1].trim()
      : item.result_type === 'document'
      ? `BV-2026-${item.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`
      : `CASE-UP-${item.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;

    // Derive record type
    let recordType = 'Khatauni';
    const lowerTitle = (item.title || '').toLowerCase();
    if (lowerTitle.includes('khasra')) {
      recordType = 'Khasra';
    } else if (item.result_type === 'case') {
      recordType = 'Case';
    } else if (lowerTitle.includes('other') || lowerTitle.includes('doc')) {
      recordType = 'Other';
    }

    return {
      owner,
      khata,
      khasra,
      ref,
      recordType,
      area: item.extra?.area ? `${item.extra.area} ha` : null,
      district: item.extra?.district || null,
    };
  };

  // Derive counts for available filter options
  const filterCounts = useMemo(() => {
    const types = { Khatauni: 0, Khasra: 0, Other: 0 };
    const villages = {};
    const statuses = {};

    rawResults.forEach((item) => {
      const { recordType } = parseSubtitle(item);
      if (types[recordType] !== undefined) {
        types[recordType]++;
      } else {
        types.Other++;
      }

      if (item.village && item.village.trim()) {
        const v = item.village.trim();
        villages[v] = (villages[v] || 0) + 1;
      }

      const st = (item.status || 'pending').toLowerCase();
      statuses[st] = (statuses[st] || 0) + 1;
    });

    return { types, villages, statuses };
  }, [rawResults]);

  // Filter & sort results
  const filteredResults = useMemo(() => {
    let list = [...rawResults];

    // Filter by record type
    if (selectedTypes.size > 0) {
      list = list.filter((item) => {
        const { recordType } = parseSubtitle(item);
        return selectedTypes.has(recordType);
      });
    }

    // Filter by village
    if (selectedVillages.size > 0) {
      list = list.filter((item) => {
        return item.village && selectedVillages.has(item.village.trim());
      });
    }

    // Filter by status
    if (selectedStatuses.size > 0) {
      list = list.filter((item) => {
        const st = (item.status || 'pending').toLowerCase();
        return selectedStatuses.has(st);
      });
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'confidence') {
        const confA = a.extra?.confidence || 0;
        const confB = b.extra?.confidence || 0;
        return confB - confA;
      }
      if (sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      }
      // 'relevance' maintains backend order
      return 0;
    });

    return list;
  }, [rawResults, selectedTypes, selectedVillages, selectedStatuses, sortBy]);

  // Pagination
  const totalResults = filteredResults.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredResults.slice(start, start + pageSize);
  }, [filteredResults, currentPage, pageSize]);

  // Clear all filters
  const handleClearFilters = () => {
    setSelectedTypes(new Set());
    setSelectedVillages(new Set());
    setSelectedStatuses(new Set());
    setVillageSearch('');
  };

  const hasActiveFilters =
    selectedTypes.size > 0 ||
    selectedVillages.size > 0 ||
    selectedStatuses.size > 0;

  // Toggle filter helper
  const toggleFilter = (set, setFn, val) => {
    const next = new Set(set);
    if (next.has(val)) {
      next.delete(val);
    } else {
      next.add(val);
    }
    setFn(next);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Search Header Bar (9.png) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Search results {query ? `for "${query}"` : ''}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {loading
              ? 'Searching records...'
              : filteredResults.length > 0
              ? `Found ${filteredResults.length} records matching your search.`
              : query
              ? 'No records found.'
              : 'Enter a search query in the top bar to find land records.'}
          </p>
        </div>

        {/* Sort by Dropdown */}
        {filteredResults.length > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span className="text-xs text-slate-500 font-medium">Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs font-semibold rounded-lg px-3 py-1.5 bg-white border border-slate-200 text-slate-800 focus:outline-none focus:border-[#044eed]"
            >
              <option value="relevance">Relevance</option>
              <option value="confidence">Confidence</option>
              <option value="title">Title (A–Z)</option>
            </select>
          </div>
        )}
      </div>

      {/* Active Filter Chips Row (9.png) */}
      {(query || hasActiveFilters) && (
        <div className="flex items-center gap-2 flex-wrap">
          {query && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
              <span>Search: {query}</span>
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="hover:text-amber-950"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {Array.from(selectedTypes).map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
            >
              <span>Type: {t}</span>
              <button
                type="button"
                onClick={() => toggleFilter(selectedTypes, setSelectedTypes, t)}
                className="hover:text-blue-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {Array.from(selectedVillages).map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
            >
              <span>Village: {v}</span>
              <button
                type="button"
                onClick={() => toggleFilter(selectedVillages, setSelectedVillages, v)}
                className="hover:text-slate-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {Array.from(selectedStatuses).map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 capitalize"
            >
              <span>Status: {s.replace(/_/g, ' ')}</span>
              <button
                type="button"
                onClick={() => toggleFilter(selectedStatuses, setSelectedStatuses, s)}
                className="hover:text-slate-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-semibold text-[#044eed] hover:underline ml-1"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Main Two-Column Layout (9.png) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Filter Sidebar (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Filters
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs text-[#044eed] hover:underline font-medium"
                >
                  Clear filters
                </button>
              )}
            </div>

            <div className="p-4 space-y-5 text-xs">
              {/* Record Type filter */}
              <div>
                <span className="block font-semibold text-slate-900 mb-2">Record type</span>
                <div className="space-y-1.5">
                  {['Khatauni', 'Khasra', 'Other'].map((typeKey) => {
                    const count = filterCounts.types[typeKey] || 0;
                    return (
                      <label
                        key={typeKey}
                        className="flex items-center justify-between py-1 cursor-pointer group hover:text-slate-900 text-slate-600"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedTypes.has(typeKey)}
                            onChange={() =>
                              toggleFilter(selectedTypes, setSelectedTypes, typeKey)
                            }
                            className="rounded border-slate-300 text-[#044eed] focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                          />
                          <span className="font-medium">{typeKey}</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 group-hover:text-slate-600">
                          {count}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Village Filter */}
              <div className="pt-3 border-t border-slate-100">
                <span className="block font-semibold text-slate-900 mb-2">
                  Village (गाँव)
                </span>

                {/* Village mini search */}
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={villageSearch}
                    onChange={(e) => setVillageSearch(e.target.value)}
                    placeholder="Search village..."
                    className="w-full pl-8 pr-2 py-1 text-xs rounded-md border border-slate-200 bg-white placeholder:text-slate-400 text-slate-800 focus:outline-none focus:border-[#044eed]"
                  />
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {Object.entries(filterCounts.villages)
                    .filter(([v]) =>
                      !villageSearch ||
                      v.toLowerCase().includes(villageSearch.toLowerCase())
                    )
                    .map(([villageName, count]) => (
                      <label
                        key={villageName}
                        className="flex items-center justify-between py-1 cursor-pointer group hover:text-slate-900 text-slate-600"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <input
                            type="checkbox"
                            checked={selectedVillages.has(villageName)}
                            onChange={() =>
                              toggleFilter(selectedVillages, setSelectedVillages, villageName)
                            }
                            className="rounded border-slate-300 text-[#044eed] focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer shrink-0"
                          />
                          <span className="font-medium truncate">{villageName}</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 group-hover:text-slate-600 shrink-0">
                          {count}
                        </span>
                      </label>
                    ))}

                  {Object.keys(filterCounts.villages).length === 0 && (
                    <span className="text-slate-400 italic block py-1">
                      No villages in results
                    </span>
                  )}
                </div>
              </div>

              {/* Status Filter */}
              <div className="pt-3 border-t border-slate-100">
                <span className="block font-semibold text-slate-900 mb-2">Status</span>
                <div className="space-y-1.5">
                  {['approved', 'needs_review', 'processing', 'mismatch', 'rejected'].map(
                    (stKey) => {
                      const count = filterCounts.statuses[stKey] || 0;
                      const label = {
                        approved: 'Approved',
                        needs_review: 'Needs review',
                        processing: 'Processing',
                        mismatch: 'Mismatch',
                        rejected: 'Rejected',
                      }[stKey];

                      return (
                        <label
                          key={stKey}
                          className="flex items-center justify-between py-1 cursor-pointer group hover:text-slate-900 text-slate-600"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedStatuses.has(stKey)}
                              onChange={() =>
                                toggleFilter(selectedStatuses, setSelectedStatuses, stKey)
                              }
                              className="rounded border-slate-300 text-[#044eed] focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="font-medium">{label}</span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 group-hover:text-slate-600">
                            {count}
                          </span>
                        </label>
                      );
                    }
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Results List or Empty State (9 cols) */}
        <div className="lg:col-span-9 space-y-4">
          {loading ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
              <RefreshCw className="w-8 h-8 text-[#044eed] animate-spin mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-900">
                Searching cadastral records...
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Scanning khasra, khata, villages, and owner directories
              </p>
            </div>
          ) : filteredResults.length === 0 ? (
            /* Empty State Matching 9.png */
            <Card className="p-8 text-center max-w-xl mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#044eed] flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-2xs">
                <Search className="w-8 h-8 stroke-[1.75]" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">No results found</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                {query
                  ? `We couldn't find any records matching "${query}".`
                  : 'Start searching by typing a khasra number, owner name, or village in the search bar above.'}
              </p>

              <div className="bg-slate-50/80 rounded-xl p-4 mt-6 text-left border border-slate-100">
                <span className="text-xs font-bold text-slate-800 block mb-2">
                  Try searching with:
                </span>
                <ul className="text-xs text-slate-600 space-y-1.5">
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    <span>A different khasra or khata number (e.g. <strong>45/1</strong>, <strong>00123</strong>)</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    <span>Owner name (e.g. <strong>Ramesh Kumar</strong>, <strong>Suresh Maurya</strong>)</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    <span>Village name (e.g. <strong>Syntheticpur</strong>, <strong>Rampur Khas</strong>)</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    <span>Document reference (e.g. <strong>BV-2026-000129</strong>)</span>
                  </li>
                </ul>
              </div>

              {hasActiveFilters && (
                <div className="mt-5">
                  <Button variant="secondary" size="sm" onClick={handleClearFilters}>
                    Clear all filters
                  </Button>
                </div>
              )}
            </Card>
          ) : (
            /* Results Cards List Matching 9.png */
            <div className="space-y-3">
              {paginatedResults.map((item) => {
                const parsed = parseSubtitle(item);
                const qLower = query.toLowerCase().trim();

                // Highlight matcher flags
                const isKhasraMatch =
                  item.matched_field === 'khasra_gata_no' ||
                  item.matched_field === 'parcel_identifier' ||
                  (parsed.khasra && parsed.khasra.toLowerCase().includes(qLower));

                const isKhataMatch =
                  item.matched_field === 'khata_no' ||
                  (parsed.khata && parsed.khata.toLowerCase().includes(qLower));

                const isOwnerMatch =
                  item.matched_field === 'owner_name' ||
                  (parsed.owner && parsed.owner.toLowerCase().includes(qLower));

                const isVillageMatch =
                  item.matched_field === 'village' ||
                  (item.village && item.village.toLowerCase().includes(qLower));

                return (
                  <div
                    key={`${item.result_type}-${item.id}`}
                    className="bg-white rounded-xl border border-slate-200/90 hover:border-slate-300 hover:shadow-xs transition-all p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    {/* Left: Document Thumbnail Preview + Details */}
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <DocumentThumbnail id={item.id} type={item.result_type} />

                      <div className="space-y-1.5 min-w-0 flex-1">
                        {/* Title & Ref */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to={item.link}
                            className="font-mono text-xs font-bold text-[#044eed] hover:underline"
                          >
                            {parsed.ref}
                          </Link>
                          <span className="text-xs text-slate-500 font-medium truncate max-w-xs">
                            {item.title}
                          </span>
                        </div>

                        {/* Metadata row with highlighted match */}
                        <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                          {/* Village */}
                          {item.village && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {isVillageMatch ? (
                                <span className="bg-[#fef3c7] text-[#92400e] border border-[#fde68a] px-1.5 py-0.2 rounded font-bold">
                                  {item.village}
                                </span>
                              ) : (
                                <span>{item.village}</span>
                              )}
                            </span>
                          )}

                          {/* Record Type */}
                          <span className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{parsed.recordType}</span>
                          </span>

                          {/* Khata */}
                          {parsed.khata && (
                            <span>
                              {isKhataMatch ? (
                                <span className="bg-[#fef3c7] text-[#92400e] border border-[#fde68a] px-1.5 py-0.2 rounded font-bold font-mono">
                                  Khata: {parsed.khata}
                                </span>
                              ) : (
                                <span className="font-mono text-slate-500">
                                  Khata: {parsed.khata}
                                </span>
                              )}
                            </span>
                          )}

                          {/* Khasra (Plot) */}
                          {parsed.khasra && (
                            <span>
                              {isKhasraMatch ? (
                                <span className="bg-[#fef3c7] text-[#92400e] border border-[#fde68a] px-1.5 py-0.2 rounded font-bold font-mono">
                                  Khasra: {parsed.khasra}
                                </span>
                              ) : (
                                <span className="font-mono text-slate-500">
                                  Khasra: {parsed.khasra}
                                </span>
                              )}
                            </span>
                          )}

                          {/* Owner (if matched or available) */}
                          {parsed.owner && (
                            <span>
                              {isOwnerMatch ? (
                                <span className="bg-[#fef3c7] text-[#92400e] border border-[#fde68a] px-1.5 py-0.2 rounded font-bold">
                                  Owner: {parsed.owner}
                                </span>
                              ) : (
                                <span className="text-slate-500">Owner: {parsed.owner}</span>
                              )}
                            </span>
                          )}

                          {/* Area */}
                          {parsed.area && (
                            <span className="text-slate-500 font-mono">
                              Area: {parsed.area}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Status chip, Date, Open Action */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="flex items-center gap-2">
                        <StatusChip status={item.status} size="sm" />
                      </div>

                      <div className="flex items-center gap-2">
                        <Link to={item.link}>
                          <Button variant="secondary" size="sm">
                            Open
                          </Button>
                        </Link>

                        <Tooltip content="Actions coming soon">
                          <button
                            type="button"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Pagination matching 9.png */}
              <div className="pt-2">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalRecords={totalResults}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
