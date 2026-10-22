import React, { useState } from 'react';

/**
 * Lightweight accessible Tooltip component.
 * Used for disabled elements and "Coming soon" hints without backend support.
 */
export default function Tooltip({
  content,
  children,
  position = 'top',
  delay = 100,
  className = '',
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState(null);

  if (!content) return children;

  const showTooltip = () => {
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  };

  const hideTooltip = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setIsVisible(false);
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[position] || 'bottom-full left-1/2 -translate-x-1/2 mb-2';

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <div
          role="tooltip"
          className={`absolute z-50 px-2.5 py-1 text-xs font-medium text-white bg-slate-900 rounded-md shadow-lg pointer-events-none whitespace-nowrap transition-opacity duration-150 animate-in fade-in-0 zoom-in-95 ${positionClasses}`}
        >
          {content}
          <div
            className={`absolute w-0 h-0 border-solid border-4 ${
              position === 'bottom'
                ? 'bottom-full left-1/2 -translate-x-1/2 border-transparent border-b-slate-900'
                : position === 'left'
                ? 'left-full top-1/2 -translate-y-1/2 border-transparent border-l-slate-900'
                : position === 'right'
                ? 'right-full top-1/2 -translate-y-1/2 border-transparent border-r-slate-900'
                : 'top-full left-1/2 -translate-x-1/2 border-transparent border-t-slate-900'
            }`}
          />
        </div>
      )}
    </div>
  );
}
