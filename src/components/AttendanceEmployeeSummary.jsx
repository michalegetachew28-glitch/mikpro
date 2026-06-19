import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Users, User, TrendingUp, Award } from 'lucide-react';
import './Attendance.css';

const AttendanceEmployeeSummary = () => {
  const { staff, attendance, t } = useAppContext();
  const [summaryTab, setSummaryTab] = useState('weekly');

  const days = summaryTab === 'weekly' ? 7 : 30;
  const today = new Date().toISOString().split('T')[0];
  const startDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  })();

  const filteredStaff = useMemo(
    () => (staff || []).filter(s => s.role !== 'customer' && s.status !== 'inactive'),
    [staff]
  );

  const summaryData = useMemo(() => {
    return filteredStaff.map(s => {
      const recs = (attendance || []).filter(
        r => String(r.staffId) === String(s.id) && r.date >= startDate && r.date <= today
      );
      const present = recs.filter(r => r.status === 'present').length;
      const absent  = recs.filter(r => r.status === 'absent').length;
      const late    = recs.filter(r => r.status === 'late').length;
      const excused = recs.filter(r => r.status === 'excused').length;
      const total   = recs.length;
      const rate    = total > 0 ? Math.round((present / total) * 100) : null;
      return { ...s, present, absent, late, excused, total, rate };
    }).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
  }, [filteredStaff, attendance, startDate, today]);

  const getRateColor = (rate) => {
    if (rate === null) return 'var(--text-secondary)';
    if (rate >= 80) return '#10b981';
    if (rate >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getRateLabel = (rate) => {
    if (rate === null) return t('No data');
    if (rate >= 80) return t('Excellent');
    if (rate >= 60) return t('Average');
    return t('Low');
  };

  return (
    <div className="attendance-page">
      {/* Header */}
      <div className="attendance-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="icon-wrapper"><Users size={28} /></div>
          <div>
            <h1>{t('Employee Summary')}</h1>
            <p className="subtitle">{t('Individual attendance performance overview')}</p>
          </div>
        </div>
        <div className="history-tabs">
          <button
            className={`history-tab ${summaryTab === 'weekly' ? 'active' : ''}`}
            onClick={() => setSummaryTab('weekly')}
          >{t('Last 7 Days')}</button>
          <button
            className={`history-tab ${summaryTab === 'monthly' ? 'active' : ''}`}
            onClick={() => setSummaryTab('monthly')}
          >{t('Last 30 Days')}</button>
        </div>
      </div>

      {/* Employee Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {summaryData.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>
            <User size={48} opacity={0.4} />
            <p>{t('No staff found.')}</p>
          </div>
        ) : summaryData.map(emp => (
          <div
            key={emp.id}
            className="attendance-card"
            style={{ cursor: 'default' }}
          >
            <div className="card-top">
              <div className="staff-avatar">
                {emp.profilePic
                  ? <img src={emp.profilePic} alt={emp.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                  : <span className="avatar-initials">
                      {(emp.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                    </span>
                }
              </div>
              <div className="staff-info">
                <h3>{emp.name}</h3>
                <span className="staff-role">{t(emp.role) || emp.role}</span>
              </div>
              {/* Rate Badge */}
              <div style={{
                marginLeft: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: `rgba(${getRateColor(emp.rate) === '#10b981' ? '16,185,129' : getRateColor(emp.rate) === '#f59e0b' ? '245,158,11' : '239,68,68'}, 0.1)`,
                borderRadius: 12,
                padding: '8px 12px',
                minWidth: 60
              }}>
                {emp.rate !== null ? (
                  <>
                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: getRateColor(emp.rate) }}>
                      {emp.rate}%
                    </span>
                    <span style={{ fontSize: '0.65rem', color: getRateColor(emp.rate), fontWeight: 600 }}>
                      {getRateLabel(emp.rate)}
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('No data')}</span>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
              {[
                { label: t('present'), value: emp.present, color: '#10b981' },
                { label: t('absent'),  value: emp.absent,  color: '#ef4444' },
                { label: t('late'),    value: emp.late,    color: '#f59e0b' },
                { label: t('excused'), value: emp.excused, color: '#6366f1' },
              ].map(stat => (
                <div
                  key={stat.label}
                  style={{
                    background: 'var(--bg-body)',
                    borderRadius: 10,
                    padding: '8px 4px',
                    textAlign: 'center',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: 2 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Progress Bar */}
            {emp.rate !== null && (
              <div style={{ marginTop: 12 }}>
                <div style={{
                  height: 6,
                  background: 'var(--border)',
                  borderRadius: 999,
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${emp.rate}%`,
                    background: getRateColor(emp.rate),
                    borderRadius: 999,
                    transition: 'width 0.6s ease'
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  <span>{t('Attendance Rate')}</span>
                  <span>{emp.total} {t('days tracked')}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AttendanceEmployeeSummary;
