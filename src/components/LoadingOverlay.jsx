import React, { useEffect, useRef, useState } from 'react';
import { Wrench, WifiOff, RefreshCw, RotateCcw } from 'lucide-react';
import './LoadingOverlay.css';

/**
 * Full-screen loading overlay.
 *
 * Props:
 *  visible   boolean  – whether to show
 *  message   string   – optional label below spinner
 *  sub       string   – optional sub-label
 *  showBar   boolean  – show bar instead of spinner
 *  error     any      – truthy = show "Connection Problem" error state
 *                       'timeout' shows the timeout message; any Error shows err.message
 *  onRetry   fn       – called by Retry button
 *  onRefresh fn       – called by Refresh button (defaults to window.location.reload)
 */
const LoadingOverlay = ({
  visible = false,
  message = 'Loading',
  sub = '',
  showBar = false,
  error = null,
  onRetry,
  onRefresh,
}) => {
  // Minimum-display timer: once visible goes true we keep showing for ≥300ms
  const [shouldShow, setShouldShow] = useState(false);
  const showTimerRef = useRef(null);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    if (visible) {
      // Show immediately
      clearTimeout(hideTimerRef.current);
      setShouldShow(true);
      // Mark start time so we can enforce minimum
      showTimerRef.current = Date.now();
    } else {
      // Only hide after ≥300ms from when we first showed
      const elapsed = Date.now() - (showTimerRef.current || 0);
      const remaining = Math.max(0, 300 - elapsed);
      hideTimerRef.current = setTimeout(() => setShouldShow(false), remaining);
    }
    return () => {
      clearTimeout(hideTimerRef.current);
    };
  }, [visible]);

  // Scroll-lock while overlay is visible
  useEffect(() => {
    if (shouldShow) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [shouldShow]);

  if (!shouldShow) return null;

  const isTimeout = error === 'timeout';
  const errorMessage = error && error !== 'timeout'
    ? (error.message || 'An unexpected error occurred.')
    : 'Your network connection is unstable or the server is taking too long to respond.';

  return (
    <div className="loading-overlay" role={error ? 'alert' : 'status'} aria-live="polite">
      {error ? (
        /* ── Error / Timeout state ─────────────────────────── */
        <div className="loading-overlay__error-panel">
          <div className="loading-overlay__error-icon">
            <WifiOff size={40} />
          </div>
          <h2 className="loading-overlay__error-title">Connection Problem</h2>
          <p className="loading-overlay__error-msg">{errorMessage}</p>
          <p className="loading-overlay__error-hint">
            Please check your internet connection and try again.
          </p>
          <div className="loading-overlay__error-actions">
            {onRetry && (
              <button
                className="loading-overlay__btn loading-overlay__btn--primary"
                onClick={onRetry}
              >
                <RotateCcw size={16} /> Retry
              </button>
            )}
            <button
              className="loading-overlay__btn loading-overlay__btn--secondary"
              onClick={onRefresh || (() => window.location.reload())}
            >
              <RefreshCw size={16} /> Refresh Page
            </button>
          </div>
        </div>
      ) : (
        /* ── Spinner / Bar state ───────────────────────────── */
        <>
          <div className="loading-overlay__spinner-wrap">
            {!showBar && <div className="loading-overlay__spinner" />}
            {!showBar && (
              <div className="loading-overlay__logo">
                <Wrench size={20} strokeWidth={2.5} />
              </div>
            )}
          </div>

          {showBar && (
            <div className="loading-overlay__bar">
              <div className="loading-overlay__bar-fill" />
            </div>
          )}

          {message && (
            <p className="loading-overlay__message">
              {message}
              <span className="loading-overlay__dots" aria-hidden="true">...</span>
            </p>
          )}

          {sub && <span className="loading-overlay__sub">{sub}</span>}
        </>
      )}
    </div>
  );
};

export default LoadingOverlay;
