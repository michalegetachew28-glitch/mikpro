import React from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';

/**
 * ErrorState – friendly error UI shown when a data fetch fails.
 *
 * Props:
 *  - title     : string              – main heading (default: "Something went wrong")
 *  - message   : string              – description text
 *  - onRetry   : function | null     – if provided, shows a Retry button
 *  - icon      : ReactNode | null    – custom icon; defaults to AlertTriangle
 *  - offline   : boolean             – show offline-specific UI
 *  - style     : object              – wrapper inline style
 */
const ErrorState = ({
  title,
  message,
  onRetry,
  icon,
  offline = false,
  style = {},
}) => {
  const defaultTitle   = offline ? 'No Connection' : 'Something went wrong';
  const defaultMessage = offline
    ? 'Check your internet connection and try again.'
    : 'We could not load this data. Please try again.';

  const Icon = offline ? WifiOff : AlertTriangle;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        gap: 16,
        ...style,
      }}
      role="alert"
    >
      {/* Icon */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: offline
            ? 'rgba(234,179,8,0.12)'
            : 'rgba(239,68,68,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: offline ? '#ca8a04' : '#ef4444',
        }}
      >
        {icon ?? <Icon size={28} strokeWidth={2} />}
      </div>

      {/* Text */}
      <div>
        <h3
          style={{
            margin: 0,
            fontSize: '1.05rem',
            fontWeight: 700,
            color: 'var(--text-primary, #1e293b)',
            marginBottom: 6,
          }}
        >
          {title ?? defaultTitle}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: '0.9rem',
            color: 'var(--text-secondary, #64748b)',
            maxWidth: 300,
            lineHeight: 1.55,
          }}
        >
          {message ?? defaultMessage}
        </p>
      </div>

      {/* Retry button */}
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 22px',
            background: 'var(--primary, #6366f1)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600,
            transition: 'opacity 0.2s',
          }}
          onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseOut={e  => (e.currentTarget.style.opacity = '1')}
        >
          <RefreshCw size={16} />
          Try Again
        </button>
      )}
    </div>
  );
};

export default ErrorState;
