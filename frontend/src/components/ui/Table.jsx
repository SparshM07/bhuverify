import React from 'react';
import { ChevronLeft, ChevronRight, FileSearch, AlertCircle, RefreshCw } from 'lucide-react';
import Button from './Button';

/**
 * Table components matching 14.png UI Kit and 4.png Documents table.
 * Includes Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
 * TableSkeleton, TableEmpty, TableError, and Pagination.
 */
export function Table({ children, className = '', ...props }) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className={`w-full text-left border-collapse text-sm ${className}`} {...props}>
          {children}
        </table>
      </div>
    </div>
  );
}

export function TableHeader({ children, className = '', ...props }) {
  return (
    <thead className={`bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider ${className}`} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className = '', ...props }) {
  return (
    <tbody className={`divide-y divide-slate-100 ${className}`} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ children, className = '', hover = true, ...props }) {
  return (
    <tr
      className={`transition-colors duration-100 ${
        hover ? 'hover:bg-slate-50/70' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({ children, className = '', ...props }) {
  return (
    <th
      scope="col"
      className={`py-3.5 px-4 font-semibold text-slate-600 select-none ${className}`}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({ children, className = '', ...props }) {
  return (
    <td
      className={`py-3.5 px-4 text-slate-700 align-middle ${className}`}
      {...props}
    >
      {children}
    </td>
  );
}

/**
 * TableSkeleton matching 14.png "Table loading skeleton":
 * Gray pulsing pill shapes arranged in rows and columns.
 */
export function TableSkeleton({ rows = 5, cols = 5, className = '' }) {
  return (
    <div className={`w-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 ${className}`}>
      {/* Header pills */}
      <div className="grid grid-cols-5 gap-4 pb-3 border-b border-slate-100">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={`head-${i}`} className="h-4 bg-slate-200 rounded-md animate-pulse" />
        ))}
      </div>
      {/* Row pills */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`row-${r}`} className="grid grid-cols-5 gap-4 items-center py-2 border-b border-slate-50 last:border-b-0">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-slate-200 animate-pulse shrink-0" />
            <div className="h-3.5 bg-slate-200 rounded-md w-3/4 animate-pulse" />
          </div>
          <div className="h-3.5 bg-slate-200 rounded-md w-4/5 animate-pulse" />
          <div className="h-3.5 bg-slate-200 rounded-md w-3/5 animate-pulse" />
          <div className="h-3.5 bg-slate-200 rounded-md w-2/3 animate-pulse" />
          <div className="h-5 bg-slate-200 rounded-full w-20 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/**
 * TableEmpty matching 14.png "Empty state":
 * Document icon with search glass, title, message, and clear filters button.
 */
export function TableEmpty({
  title = 'No records found',
  description = "We couldn't find any records matching your search.",
  actionText = 'Clear filters',
  onAction,
  className = '',
}) {
  return (
    <div className={`p-10 text-center flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#044eed] mb-3.5">
        <FileSearch className="w-7 h-7" />
      </div>
      <h4 className="text-base font-bold text-slate-900 mb-1">{title}</h4>
      <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">{description}</p>
      {onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
}

/**
 * TableError matching 14.png "Error state":
 * Document icon with red exclamation, error title, message, and retry button.
 */
export function TableError({
  title = 'Failed to load records',
  description = "We couldn't load the data. Please check your connection and try again.",
  actionText = 'Retry',
  onRetry,
  className = '',
}) {
  return (
    <div className={`p-10 text-center flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-[#dc2626] mb-3.5">
        <AlertCircle className="w-7 h-7" />
      </div>
      <h4 className="text-base font-bold text-slate-900 mb-1">{title}</h4>
      <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">{description}</p>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw className="w-3.5 h-3.5" />}
          onClick={onRetry}
        >
          {actionText}
        </Button>
      )}
    </div>
  );
}

/**
 * Pagination matching 4.png / 9.png:
 * Showing X-Y of Z records, rows per page, prev/next buttons, and page pills.
 */
export function Pagination({
  currentPage = 1,
  totalPages = 1,
  totalRecords = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  className = '',
}) {
  const startRecord = Math.min((currentPage - 1) * pageSize + 1, totalRecords);
  const endRecord = Math.min(currentPage * pageSize, totalRecords);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 text-xs text-slate-500 ${className}`}>
      <div>
        Showing <span className="font-semibold text-slate-700">{totalRecords > 0 ? startRecord : 0}</span>–
        <span className="font-semibold text-slate-700">{endRecord}</span> of{' '}
        <span className="font-semibold text-slate-700">{totalRecords}</span> records
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="py-1 px-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium focus:outline-none focus:border-[#044eed]"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange && onPageChange(currentPage - 1)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          {getPageNumbers().map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange && onPageChange(p)}
              className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${
                p === currentPage
                  ? 'bg-[#044eed] text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          ))}

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange && onPageChange(currentPage + 1)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Table;
