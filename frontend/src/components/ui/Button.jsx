import React from 'react';
import { Loader2 } from 'lucide-react';
import Tooltip from './Tooltip';

/**
 * Button component matching 14.png UI Kit:
 * Variants: primary, secondary, danger, ghost.
 * Supports comingSoon prop which adds disabled state and "Coming soon" tooltip.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  comingSoon = false,
  comingSoonText = 'Coming soon',
  tooltip,
  className = '',
  onClick,
  ...props
}) {
  const isDisabled = disabled || loading || comingSoon;

  const variantClasses = {
    primary:
      'bg-[#044eed] hover:bg-[#0345d0] active:bg-[#023aa8] text-white border border-transparent shadow-sm disabled:bg-[#044eed]/50',
    secondary:
      'bg-white hover:bg-blue-50/60 active:bg-blue-100 text-[#044eed] border border-[#044eed] disabled:border-blue-300 disabled:text-blue-300',
    danger:
      'bg-[#dc2626] hover:bg-[#b91c1c] active:bg-[#991b1b] text-white border border-transparent shadow-sm disabled:bg-[#dc2626]/50',
    ghost:
      'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200',
    outline:
      'bg-transparent hover:bg-slate-100 text-slate-700 border border-slate-300 disabled:text-slate-400 disabled:border-slate-200',
    text:
      'bg-transparent hover:bg-slate-100/70 text-slate-600 hover:text-slate-900 border-none shadow-none disabled:text-slate-400',
  }[variant] || 'bg-[#044eed] text-white';

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
    md: 'px-4 py-2 text-sm rounded-lg gap-2',
    lg: 'px-5 py-2.5 text-base rounded-lg gap-2.5',
  }[size] || 'px-4 py-2 text-sm rounded-lg gap-2';

  const buttonElement = (
    <button
      type={type}
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 select-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
        isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      } ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
    </button>
  );

  if (comingSoon) {
    return (
      <Tooltip content={comingSoonText}>
        {buttonElement}
      </Tooltip>
    );
  }

  if (tooltip) {
    return (
      <Tooltip content={tooltip}>
        {buttonElement}
      </Tooltip>
    );
  }

  return buttonElement;
}
