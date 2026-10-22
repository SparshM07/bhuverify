import React, { forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Input component matching 14.png UI Kit:
 * States: Default, Focus, Error, Disabled.
 * Supports label, required star, left/right icons, error messages, and helper text.
 */
export const Input = forwardRef(function Input(
  {
    label,
    error,
    helperText,
    required = false,
    disabled = false,
    leftIcon,
    rightIcon,
    className = '',
    id,
    ...props
  },
  ref
) {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-700 mb-1.5"
        >
          {label}
          {required && <span className="text-[#dc2626] ml-0.5">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3 flex items-center pointer-events-none text-slate-400">
            {leftIcon}
          </div>
        )}

        <input
          id={inputId}
          ref={ref}
          disabled={disabled}
          className={`w-full rounded-lg text-sm transition-colors duration-150 py-2 px-3 text-slate-900 placeholder:text-slate-400 ${
            leftIcon ? 'pl-9' : ''
          } ${rightIcon ? 'pr-9' : ''} ${
            disabled
              ? 'bg-slate-50 border border-slate-200 text-slate-400 cursor-not-allowed'
              : error
              ? 'bg-white border border-[#dc2626] focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-[#dc2626]'
              : 'bg-white border border-slate-300 focus:outline-none focus:border-[#044eed] focus:ring-2 focus:ring-blue-500/20'
          } ${className}`}
          {...props}
        />

        {rightIcon && (
          <div className="absolute right-3 flex items-center pointer-events-none text-slate-400">
            {rightIcon}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1 text-xs text-[#dc2626] flex items-center gap-1 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {!error && helperText && (
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
      )}
    </div>
  );
});

/**
 * Textarea component matching 14.png Confirmation Dialog:
 * Supports max length counter ("0/500") and error states.
 */
export const Textarea = forwardRef(function Textarea(
  {
    label,
    error,
    helperText,
    required = false,
    disabled = false,
    maxLength,
    value,
    className = '',
    id,
    rows = 3,
    ...props
  },
  ref
) {
  const inputId = id || (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
  const currentLength = typeof value === 'string' ? value.length : 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-slate-700"
          >
            {label}
            {required && <span className="text-[#dc2626] ml-0.5">*</span>}
          </label>
        )}
        {maxLength && (
          <span className="text-[11px] text-slate-400 font-mono">
            {currentLength}/{maxLength}
          </span>
        )}
      </div>

      <textarea
        id={inputId}
        ref={ref}
        rows={rows}
        disabled={disabled}
        maxLength={maxLength}
        value={value}
        className={`w-full rounded-lg text-sm transition-colors duration-150 py-2 px-3 text-slate-900 placeholder:text-slate-400 resize-y ${
          disabled
            ? 'bg-slate-50 border border-slate-200 text-slate-400 cursor-not-allowed'
            : error
            ? 'bg-white border border-[#dc2626] focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-[#dc2626]'
            : 'bg-white border border-slate-300 focus:outline-none focus:border-[#044eed] focus:ring-2 focus:ring-blue-500/20'
        } ${className}`}
        {...props}
      />

      {error && (
        <p className="mt-1 text-xs text-[#dc2626] flex items-center gap-1 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {!error && helperText && (
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
      )}
    </div>
  );
});

export default Input;
