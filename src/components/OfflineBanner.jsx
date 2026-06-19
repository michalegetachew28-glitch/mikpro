import React, { useState, useEffect, useCallback } from 'react';
import { useOffline } from '../context/OfflineContext';
import { WifiOff, RefreshCw, CheckCircle, CloudOff } from 'lucide-react';

/**
 * OfflineBanner
 * ─────────────────────────────────────────────────────────────────
 * Shows:
 *  • Offline strip   – when isOnline === false
 *  • Syncing strip   – while isSyncing === true (after reconnect)
 *  • Success flash   – briefly after sync completes
 * ─────────────────────────────────────────────────────────────────
 */
const OfflineBanner = () => {
  const { isOnline, isSyncing, pendingCount, syncProgress, triggerSync } = useOffline();
  const [showSuccess, setShowSuccess]   = useState(false);
  const [isHiding,    setIsHiding]      = useState(false);
  const [wasOffline,  setWasOffline]    = useState(false);

  /* Track transitions to show success flash */
  useEffect(() => {
    if (!isOnline) { setWasOffline(true); setShowSuccess(false); }
  }, [isOnline]);

  useEffect(() => {
    if (wasOffline && isOnline && !isSyncing) {
      setShowSuccess(true);
      setWasOffline(false);
      
      const timer = setTimeout(() => {
        setIsHiding(true);
        setTimeout(() => {
          setShowSuccess(false);
          setIsHiding(false);
        }, 500); // Wait for transition
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [wasOffline, isOnline, isSyncing]);

  /* Nothing to show */
  if (isOnline && !isSyncing && !showSuccess) return null;

  /* ── Determine which strip variant to show ────────────────── */
  const variant =
    !isOnline   ? 'offline'  :
    isSyncing   ? 'syncing'  :
    showSuccess ? 'success'  : null;

  if (!variant) return null;

  const configs = {
    offline: {
      cls:   'offline-banner--offline',
      icon:  <WifiOff size={18} />,
      label: 'You are offline – Changes saved locally',
      extra: pendingCount > 0
        ? <span className="offline-badge">{pendingCount} pending</span>
        : null,
      action: null,
    },
    syncing: {
      cls:   'offline-banner--syncing',
      icon:  <RefreshCw size={18} className="spin-icon" />,
      label: syncProgress.total > 0
        ? `Syncing… ${syncProgress.done} / ${syncProgress.total}`
        : 'Reconnected – syncing changes…',
      extra: null,
      action: null,
    },
    success: {
      cls:   'offline-banner--success',
      icon:  <CheckCircle size={18} />,
      label: 'you are back to online',
      extra: null,
      action: null,
    },
  };

  const cfg = configs[variant];

  return (
    <>
      <div className={`offline-banner ${cfg.cls} ${isHiding ? 'banner-hiding' : ''}`} role="status" aria-live="polite">
        <div className="offline-banner__body">
          <span className="offline-banner__icon">{cfg.icon}</span>
          <span className="offline-banner__label">{cfg.label}</span>
          {cfg.extra}
        </div>

        {!isOnline && (
          <button
            className="offline-banner__retry"
            onClick={triggerSync}
            title="Retry sync"
          >
            <RefreshCw size={15} />
            Retry
          </button>
        )}

        {/* Sync progress bar */}
        {isSyncing && syncProgress.total > 0 && (
          <div className="offline-progress">
            <div
              className="offline-progress__bar"
              style={{ width: `${Math.round((syncProgress.done / syncProgress.total) * 100)}%` }}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default OfflineBanner;
