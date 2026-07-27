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

/* ─────────────────────────────────────────────────────────────────── */
/* Chart card skeleton                                                */
/* ─────────────────────────────────────────────────────────────────── */
export const SkeletonChartCard = ({ height = 180 }) => (
  <div className="skeleton-chart-card" aria-hidden="true">
    <SkeletonText size="sm" style={{ width: '40%', marginBottom: 16 }} />
    <div className="skeleton skeleton-chart-area" style={{ height }} />
  </div>
);

/* ─────────────────────────────────────────────────────────────────── */
/* Full Dashboard skeleton                                            */
/* Shows: header + stat grid (6) + content grid (table + list)       */
/* ─────────────────────────────────────────────────────────────────── */
export const SkeletonDashboard = ({ cardCount = 6 }) => (
  <div className="skeleton-dashboard" aria-label="Loading dashboard…" aria-hidden="true">
    <SkeletonPageHeader />
    <SkeletonStatsGrid count={cardCount} />
    <div className="skeleton-content-grid">
      {/* Table card */}
      <div className="skeleton-content-card">
        <SkeletonText size="sm" style={{ width: '30%', marginBottom: 16 }} />
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <SkeletonTable rows={5} cols={4} />
        </table>
      </div>
      {/* Side card */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="skeleton-content-card">
          <SkeletonText size="sm" style={{ width: '40%', marginBottom: 12 }} />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <div className="skeleton skeleton-avatar" style={{ width: 32, height: 32 }} />
              <div style={{ flex: 1 }}>
                <SkeletonText size="sm" style={{ marginBottom: 6 }} />
                <SkeletonText size="sm" style={{ width: '55%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────────── */
/* Full List Page skeleton (Customers, Vehicles, Repairs, etc.)      */
/* Shows: header + filter bar + table                                 */
/* ─────────────────────────────────────────────────────────────────── */
export const SkeletonListPage = ({ rows = 7, cols = 5 }) => (
  <div className="skeleton-list-page" aria-label="Loading…" aria-hidden="true">
    <SkeletonPageHeader />
    {/* Filter / search bar */}
    <div className="skeleton-filter-bar">
      <div className="skeleton skeleton-search-bar" />
      <div className="skeleton skeleton-btn" style={{ width: 110 }} />
      <div className="skeleton skeleton-btn" style={{ width: 90 }} />
    </div>
    {/* Table */}
    <div className="skeleton-content-card" style={{ marginTop: 0 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <SkeletonTable rows={rows} cols={cols} />
      </table>
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────────── */
/* Attendance / Payroll — stats + chart + table layout                */
/* ─────────────────────────────────────────────────────────────────── */
export const SkeletonAttendancePage = () => (
  <div className="skeleton-dashboard" aria-label="Loading attendance…" aria-hidden="true">
    <SkeletonPageHeader />
    <SkeletonStatsGrid count={4} />
    <div className="skeleton-content-card" style={{ marginTop: 16 }}>
      <SkeletonChartCard height={150} />
    </div>
    <div className="skeleton-content-card" style={{ marginTop: 16 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <SkeletonTable rows={6} cols={8} />
      </table>
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────────── */
/* Salary / Payroll page skeleton                                     */
/* ─────────────────────────────────────────────────────────────────── */
export const SkeletonSalaryPage = () => (
  <div className="skeleton-dashboard" aria-label="Loading payroll…" aria-hidden="true">
    <SkeletonPageHeader />
    <SkeletonStatsGrid count={5} />
    <div className="skeleton-content-grid">
      <div className="skeleton-content-card">
        <SkeletonChartCard height={140} />
      </div>
      <div className="skeleton-content-card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <SkeletonTable rows={5} cols={5} />
        </table>
      </div>
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────────── */
/* Grid Card Skeleton (for Inventory & Staff grid views)               */
/* ─────────────────────────────────────────────────────────────────── */
export const SkeletonCardGrid = ({ count = 6 }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', width: '100%' }} aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="skeleton-content-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="skeleton" style={{ height: '140px', borderRadius: '10px' }} />
        <SkeletonText size="lg" style={{ width: '75%' }} />
        <SkeletonText size="sm" style={{ width: '45%' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <SkeletonText size="md" style={{ width: '35%' }} />
          <div className="skeleton skeleton-btn" style={{ width: '80px', height: '32px' }} />
        </div>
      </div>
    ))}
  </div>
);

/* ─────────────────────────────────────────────────────────────────── */
/* Messaging / Chat Skeleton                                           */
/* ─────────────────────────────────────────────────────────────────── */
export const SkeletonMessaging = () => (
  <div style={{ display: 'flex', height: 'calc(100vh - 120px)', width: '100%', gap: '16px' }} aria-hidden="true">
    {/* Chat sidebar */}
    <div className="skeleton-content-card" style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="skeleton skeleton-search-bar" />
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </div>
    {/* Chat main window */}
    <div className="skeleton-content-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
        <div className="skeleton skeleton-avatar" />
        <div style={{ flex: 1 }}>
          <SkeletonText size="md" style={{ width: '30%' }} />
          <SkeletonText size="sm" style={{ width: '15%', marginTop: '4px' }} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, justifyContent: 'center' }}>
        <SkeletonMessage direction="received" />
        <SkeletonMessage direction="sent" />
        <SkeletonMessage direction="received" />
      </div>
      <div className="skeleton skeleton-search-bar" style={{ height: '48px' }} />
    </div>
  </div>
);
