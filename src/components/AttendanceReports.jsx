import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { BarChart2, Calendar, TrendingUp, Users } from 'lucide-react';
import { formatEthiopianDate } from '../utils/ethiopianDate';
import './Attendance.css';

const AttendanceReports = () => {
  const { staff, attendance, language, t } = useAppContext();
  const [reportTab, setReportTab] = useState('weekly'); // 'weekly' | 'monthly'

  const days = reportTab === 'weekly' ? 7 : 30;
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

  const rangeRecords = useMemo(
    () => (attendance || []).filter(r => r.date >= startDate && r.date <= today),
    [attendance, startDate, today]
  );

  // Per-day breakdown for the period
  const dailyBreakdown = useMemo(() => {
    const map = {};
    rangeRecords.forEach(r => {
      if (!map[r.date]) map[r.date] = { present: 0, absent: 0, late: 0, excused: 0 };
      if (map[r.date][r.status] !== undefined) map[r.date][r.status]++;
    });
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, counts]) => ({ date, ...counts }));
  }, [rangeRecords]);

  const totals = useMemo(() => {
    return rangeRecords.reduce(
      (acc, r) => {
        if (acc[r.status] !== undefined) acc[r.status]++;
        return acc;
      },
      { present: 0, absent: 0, late: 0, excused: 0 }
    );
  }, [rangeRecords]);

  const totalDays = dailyBreakdown.length;
  const totalRecords = rangeRecords.length;
  const attendanceRate = totalRecords > 0
    ? Math.round((totals.present / totalRecords) * 100)
    : 0;

  return (
    <div className="attendance-page">
      {/* Header */}
      <div className="attendance-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="icon-wrapper"><BarChart2 size={28} /></div>
          <div>
            <h1>{t('Attendance Reports')}</h1>
            <p className="subtitle">{t('Period summaries and daily breakdowns')}</p>
          </div>
        </div>
        <div className="history-tabs">
          <button
            className={`history-tab ${reportTab === 'weekly' ? 'active' : ''}`}
            onClick={() => setReportTab('weekly')}
          >{t('Last 7 Days')}</button>
          <button
            className={`history-tab ${reportTab === 'monthly' ? 'active' : ''}`}
            onClick={() => setReportTab('monthly')}
          >{t('Last 30 Days')}</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="attendance-dashboard" style={{ marginBottom: 24 }}>
        <div className="summary-card present">
          <div className="card-header">
            <div className="icon"><Users size={20} /></div>
            <h3>{t('present')}</h3>
          </div>
          <div className="stats-row">
            <div className="stat-item">
              <span className="val">{totals.present}</span>
              <span className="lab">{t('Total')}</span>
            </div>
          </div>
        </div>
        <div className="summary-card absent">
          <div className="card-header">
            <div className="icon"><Users size={20} /></div>
            <h3>{t('absent')}</h3>
          </div>
          <div className="stats-row">
            <div className="stat-item">
              <span className="val">{totals.absent}</span>
              <span className="lab">{t('Total')}</span>
            </div>
          </div>
        </div>
        <div className="summary-card late">
          <div className="card-header">
            <div className="icon"><Users size={20} /></div>
            <h3>{t('late')}</h3>
          </div>
          <div className="stats-row">
            <div className="stat-item">
              <span className="val">{totals.late}</span>
              <span className="lab">{t('Total')}</span>
            </div>
          </div>
        </div>
        <div className="summary-card excused">
          <div className="card-header">
            <div className="icon"><TrendingUp size={20} /></div>
            <h3>{t('Attendance Rate')}</h3>
          </div>
          <div className="stats-row">
            <div className="stat-item">
              <span className="val">{attendanceRate}%</span>
              <span className="lab">{totalDays} {t('days tracked')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Breakdown Table */}
      <div className="attendance-table-wrapper">
        <table className="attendance-table">
          <thead>
            <tr>
              <th style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={14} /> {t('Date')}
              </th>
              <th style={{ textAlign: 'center', color: '#10b981' }}>{t('present')}</th>
              <th style={{ textAlign: 'center', color: '#ef4444' }}>{t('absent')}</th>
              <th style={{ textAlign: 'center', color: '#f59e0b' }}>{t('late')}</th>
              <th style={{ textAlign: 'center', color: '#6366f1' }}>{t('excused')}</th>
              <th style={{ textAlign: 'center' }}>{t('Total')}</th>
            </tr>
          </thead>
          <tbody>
            {dailyBreakdown.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                  {t('No attendance data recorded for this period.')}
                </td>
              </tr>
            ) : dailyBreakdown.map(row => (
              <tr key={row.date}>
                <td>
                  <strong>
                    {language === 'am' || language === 'አማርኛ' 
                      ? formatEthiopianDate(row.date, 'am') 
                      : row.date}
                  </strong>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className="badge-status present">{row.present}</span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className="badge-status absent">{row.absent}</span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className="badge-status late">{row.late}</span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className="badge-status excused">{row.excused}</span>
                </td>
                <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                  {row.present + row.absent + row.late + row.excused}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendanceReports;
