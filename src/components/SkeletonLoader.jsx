import React from 'react';
import './SkeletonLoader.css';

/* ─────────────────────────────────────────────────────────────────── */
/* Primitive: a single shimmering block                               */
/* ─────────────────────────────────────────────────────────────────── */
export const SkeletonBlock = ({ className = '', style = {} }) => (
  <div className={`skeleton ${className}`} style={style} aria-hidden="true" />
);

/* ─────────────────────────────────────────────────────────────────── */
/* Text line skeleton                                                  */
/* ─────────────────────────────────────────────────────────────────── */
export const SkeletonText = ({ size = 'md', style = {} }) => (
  <div className={`skeleton skeleton-text ${size}`} style={style} aria-hidden="true" />
);

/* ─────────────────────────────────────────────────────────────────── */
/* Stat card skeleton (mirrors the .stat-card layout)                 */
/* ─────────────────────────────────────────────────────────────────── */
export const SkeletonCard = () => (
  <div className="skeleton-card" aria-hidden="true">
    <div className="skeleton-card-header">
      <SkeletonText size="sm" style={{ width: '60%' }} />
      <div className="skeleton skeleton-icon" />
    </div>
    <div className="skeleton skeleton-value" />
    <SkeletonText size="sm" style={{ width: '40%' }} />
  </div>
);

/* ─────────────────────────────────────────────────────────────────── */
/* Table row skeleton                                                  */
/* cols = number of column shims to render                            */
/* ─────────────────────────────────────────────────────────────────── */
export const SkeletonRow = ({ cols = 4 }) => (
  <tr aria-hidden="true">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} style={{ padding: '14px 12px' }}>
        <div
          className="skeleton skeleton-text"
          style={{ width: i === 0 ? '70%' : i === cols - 1 ? '50%' : '85%' }}
        />
      </td>
    ))}
  </tr>
);

/* ─────────────────────────────────────────────────────────────────── */
/* Multiple skeleton rows inside a <tbody>                            */
/* ─────────────────────────────────────────────────────────────────── */
export const SkeletonTable = ({ rows = 5, cols = 4 }) => (
  <tbody aria-label="Loading data…">
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonRow key={i} cols={cols} />
    ))}
  </tbody>
);

/* ─────────────────────────────────────────────────────────────────── */
/* Stats grid skeleton – N shimmer cards                              */
/* ─────────────────────────────────────────────────────────────────── */
export const SkeletonStatsGrid = ({ count = 6 }) => (
  <div className="skeleton-stats-grid" aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

/* ─────────────────────────────────────────────────────────────────── */
/* Page header skeleton                                               */
/* ─────────────────────────────────────────────────────────────────── */
export const SkeletonPageHeader = () => (
  <div className="skeleton-header" aria-hidden="true">
    <div className="skeleton-header-left">
      <div className="skeleton skeleton-text title" />
      <div className="skeleton skeleton-text sm" style={{ width: '260px' }} />
    </div>
    <div className="skeleton skeleton-btn" />
  </div>
);

/* ─────────────────────────────────────────────────────────────────── */
/* Message bubble skeleton (chat list)                                */
/* ─────────────────────────────────────────────────────────────────── */
export const SkeletonMessage = ({ direction = 'received' }) => (
  <div style={{
    display: 'flex',
    gap: 10,
    padding: '8px 16px',
    flexDirection: direction === 'sent' ? 'row-reverse' : 'row',
    alignItems: 'flex-end'
  }} aria-hidden="true">
    {direction === 'received' && (
      <div className="skeleton skeleton-avatar" />
    )}
    <div className={`skeleton skeleton-bubble ${direction}`} />
  </div>
);

/* ─────────────────────────────────────────────────────────────────── */
/* List item skeleton (for simple card lists)                         */
/* ─────────────────────────────────────────────────────────────────── */
export const SkeletonListItem = () => (
  <div className="skeleton-row" aria-hidden="true">
    <div className="skeleton skeleton-avatar" />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SkeletonText size="md" />
      <SkeletonText size="sm" style={{ width: '55%' }} />
    </div>
  </div>
);
