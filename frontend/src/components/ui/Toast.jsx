import React from 'react';
import { Check, X, AlertTriangle } from 'lucide-react';

/**
 * Toast component matching 14.png UI Kit:
 * Variants: success, error, warning.
 * Features colored icon badge, bold title, description, and dismiss X button.
 */
export default function Toast({
  variant = 'success',
  title,
  description,
  onClose,
  className = '',
}) {
  const configs = {
    success: {
      bg: 'bg-[#e8f8ee]',
      border: 'border-[#bbf7d0]',
      iconBg: 'bg-[#16a34a]',
      icon: <Check className="w-4 h-4 text-white stroke-[2.5]" />,
      defaultTitle: 'Record updated successfully.',
      defaultDesc: 'The changes have been saved.',
    },
    error: {
      bg: 'bg-[#feecec]',
      border: 'border-[#fecaca]',
      iconBg: 'bg-[#dc2626]',
      icon: <X className="w-4 h-4 text-white stroke-[2.5]" />,
      defaultTitle: 'Failed to process document.',
      defaultDesc: 'Please try again or contact support.',
    },
    warning: {
      bg: 'bg-[#fef8e2]',
      border: 'border-[#fef08a]',
      iconBg: 'bg-[#d97706]',
      icon: <AlertTriangle className="w-4 h-4 text-white stroke-[2.5]" />,
      defaultTitle: 'Some fields need review.',
      defaultDesc: 'Please check the highlighted fields.',
    },
  };

  const config = configs[variant] || configs.success;
  const displayTitle = title || config.defaultTitle;
  const displayDesc = description || config.defaultDesc;

  return (
    <div
      role="alert"
      className={`flex items-start justify-between gap-3 p-4 rounded-xl border shadow-sm transition-all duration-200 animate-in fade-in-0 slide-in-from-top-2 ${config.bg} ${config.border} ${className}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${config.iconBg}`}
        >
          {config.icon}
        </div>
        <div>
          <h5 className="text-sm font-bold text-slate-900 leading-snug">
            {displayTitle}
          </h5>
          {displayDesc && (
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              {displayDesc}
            </p>
          )}
        </div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-black/5 transition-colors shrink-0"
          aria-label="Dismiss toast"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/**
 * ToastContainer for floating toasts
 */
export function ToastContainer({ children, className = '' }) {
  return (
    <div
      className={`fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none [&>*]:pointer-events-auto ${className}`}
    >
      {children}
    </div>
  );
}
