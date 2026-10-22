import React from 'react';

/**
 * StatusChip component matching 14.png UI Kit:
 * Pill shape with circular color dot indicator.
 * Statuses: Uploaded, Processing, Needs review, Mismatch, Approved, Rejected, Failed.
 */
export default function StatusChip({
  status = 'uploaded',
  label,
  size = 'md',
  className = '',
  children,
}) {
  const normStatus = String(status || '').toLowerCase().trim().replace(/[\s-]+/g, '_');

  const configs = {
    uploaded: {
      label: 'Uploaded',
      bgClass: 'bg-[#f1f5f9] text-[#475569] border-[#e2e8f0]/60',
      dotClass: 'bg-[#64748b]',
    },
    processing: {
      label: 'Processing',
      bgClass: 'bg-[#e5f1ff] text-[#1d4ed8] border-[#bfdbfe]/50',
      dotClass: 'bg-[#2563eb]',
    },
    queued: {
      label: 'Processing',
      bgClass: 'bg-[#e5f1ff] text-[#1d4ed8] border-[#bfdbfe]/50',
      dotClass: 'bg-[#2563eb]',
    },
    needs_review: {
      label: 'Needs review',
      bgClass: 'bg-[#fef8e2] text-[#92400e] border-[#fef08a]/60',
      dotClass: 'bg-[#d97706]',
    },
    pending_review: {
      label: 'Needs review',
      bgClass: 'bg-[#fef8e2] text-[#92400e] border-[#fef08a]/60',
      dotClass: 'bg-[#d97706]',
    },
    mismatch: {
      label: 'Mismatch',
      bgClass: 'bg-[#feecec] text-[#991b1b] border-[#fecaca]/60',
      dotClass: 'bg-[#dc2626]',
    },
    mismatches: {
      label: 'Mismatch',
      bgClass: 'bg-[#feecec] text-[#991b1b] border-[#fecaca]/60',
      dotClass: 'bg-[#dc2626]',
    },
    approved: {
      label: 'Approved',
      bgClass: 'bg-[#e4f8ef] text-[#166534] border-[#bbf7d0]/60',
      dotClass: 'bg-[#16a34a]',
    },
    rejected: {
      label: 'Rejected',
      bgClass: 'bg-[#feecec] text-[#991b1b] border-[#fecaca]/60',
      dotClass: 'bg-[#dc2626]',
    },
    failed: {
      label: 'Failed',
      bgClass: 'bg-[#feecec] text-[#991b1b] border-[#fecaca]/60',
      dotClass: 'bg-[#dc2626]',
    },
    open: {
      label: 'Open',
      bgClass: 'bg-[#e5f1ff] text-[#1d4ed8] border-[#bfdbfe]/50',
      dotClass: 'bg-[#2563eb]',
    },
    active: {
      label: 'Active',
      bgClass: 'bg-[#e4f8ef] text-[#166534] border-[#bbf7d0]/60',
      dotClass: 'bg-[#16a34a]',
    },
    in_progress: {
      label: 'In progress',
      bgClass: 'bg-[#fef8e2] text-[#92400e] border-[#fef08a]/60',
      dotClass: 'bg-[#d97706]',
    },
    closed: {
      label: 'Closed',
      bgClass: 'bg-[#f1f5f9] text-[#475569] border-[#e2e8f0]',
      dotClass: 'bg-[#64748b]',
    },
  };

  const config = configs[normStatus] || {
    label: normStatus ? normStatus.charAt(0).toUpperCase() + normStatus.slice(1).replace(/_/g, ' ') : 'Unknown',
    bgClass: 'bg-[#f1f5f9] text-[#475569] border-[#e2e8f0]',
    dotClass: 'bg-[#64748b]',
  };

  const displayLabel = children || label || config.label;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[11px] gap-1.5',
    md: 'px-2.5 py-1 text-xs gap-2',
    lg: 'px-3 py-1.5 text-sm gap-2',
  }[size] || 'px-2.5 py-1 text-xs gap-2';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border border-transparent tracking-normal transition-colors select-none ${sizeClasses} ${config.bgClass} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dotClass}`} />
      <span className="truncate">{displayLabel}</span>
    </span>
  );
}
