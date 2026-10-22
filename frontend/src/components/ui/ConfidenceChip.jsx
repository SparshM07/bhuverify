import React from 'react';

/**
 * ConfidenceChip component matching 14.png UI Kit:
 * Levels: High, Medium, Low with dot indicators.
 * Can take score (0-1 or 0-100) or explicit level.
 */
export default function ConfidenceChip({
  score,
  level,
  showScore = false,
  size = 'md',
  className = '',
  children,
}) {
  let resolvedLevel = 'medium';

  if (level) {
    resolvedLevel = String(level).toLowerCase();
  } else if (score !== undefined && score !== null) {
    const num = Number(score) > 1 ? Number(score) : Number(score) * 100;
    if (num >= 80) resolvedLevel = 'high';
    else if (num >= 50) resolvedLevel = 'medium';
    else resolvedLevel = 'low';
  }

  const configs = {
    high: {
      label: 'High',
      bgClass: 'bg-[#e4f8ef] text-[#166534] border-[#bbf7d0]/60',
      dotClass: 'bg-[#16a34a]',
    },
    medium: {
      label: 'Medium',
      bgClass: 'bg-[#fef8e2] text-[#92400e] border-[#fef08a]/60',
      dotClass: 'bg-[#d97706]',
    },
    low: {
      label: 'Low',
      bgClass: 'bg-[#feecec] text-[#991b1b] border-[#fecaca]/60',
      dotClass: 'bg-[#dc2626]',
    },
  };

  const config = configs[resolvedLevel] || configs.medium;

  let labelText = config.label;
  if (children) {
    labelText = children;
  } else if (showScore && score !== undefined && score !== null) {
    const pct = Math.round(Number(score) > 1 ? Number(score) : Number(score) * 100);
    labelText = `${config.label} (${pct}%)`;
  }

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
      <span className="truncate">{labelText}</span>
    </span>
  );
}
