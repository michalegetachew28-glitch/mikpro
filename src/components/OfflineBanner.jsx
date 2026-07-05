import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useOffline } from '../context/OfflineContext';
import { WifiOff, RefreshCw, CloudOff } from 'lucide-react';

/**
 * OfflineBanner
 * ─────────────────────────────────────────────────────────────────
 * Shows:
 *  • Offline strip   – when isOnline === false
 *  • Syncing strip   – while isSyncing === true (after reconnect)
 *  • Success flash   – hides after 5 s
 * ─────────────────────────────────────────────────────────────────
 */
const OfflineBanner = () => {
  const { isOnline, isSyncing, pendingCount, syncProgress, triggerSync } = useOffline();
  const [showSuccess, setShowSuccess] = useState(false);
  const [isHiding,    setIsHiding]    = useState(false);
  // ref instead of state — changing it never triggers a re-render or effect cleanup
  const wasOffline = useRef(false);

  /* Track going offline */
  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      setShowSuccess(false);
      setIsHiding(false);
    }
  }, [isOnline]);

  /* Back online: show success strip, then hide after 5 s */
  useEffect(() => {
    if (wasOffline.current && isOnline && !isSyncing) {
      wasOffline.current = false; // ref — no re-render, no cleanup cancel
      setShowSuccess(true);
      setIsHiding(false);

      const hideTimer = setTimeout(() => {
        setIsHiding(true);
        setTimeout(() => {
          setShowSuccess(false);
          setIsHiding(false);
        }, 400);
      }, 5000);

      return () => clearTimeout(hideTimer);
    }
  }, [isOnline, isSyncing]);

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
      icon:  <span style={{
        display: 'inline-block',
        width: 10, height: 10,
        borderRadius: '50%',
        background: '#10b981',
        boxShadow: '0 0 0 0 rgba(16,185,129,0.6)',
        animation: 'onlinePulse 1.8s ease-out 3',
        flexShrink: 0,
      }} />,
      label: 'You are back online',
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
