import React from 'react';
import { Wrench } from 'lucide-react';
import './LoadingOverlay.css';

/**
 * Full-screen loading overlay for global operations:
 * login, logout, app startup, session validation, data sync.
 *
 * Props:
 *  - visible: boolean   – whether to show
 *  - message: string    – optional label ("Signing in", "Loading app…")
 *  - sub:     string    – optional small sub-label
 *  - showBar: boolean   – show animated progress bar instead of spinner
 */
const LoadingOverlay = ({
  visible = false,
  message = 'Loading',
  sub = '',
  showBar = false,
}) => {
  if (!visible) return null;

  return (
    <div className="loading-overlay" role="status" aria-live="polite">
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
    </div>
  );
};

export default LoadingOverlay;
