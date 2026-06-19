import React, { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import {
  History, ArrowLeft, ClipboardList, User, Calendar
} from 'lucide-react';
import './Attendance.css';
import EthiopianSelector from './EthiopianSelector';

const AttendanceHistory = () => {
  const { staff, attendance, t, formatDate, language } = useAppContext();

  // States
  // States
  const [dateFilter, setDateFilter] = useState('today'); // today, yesterday, week, month, year, date, custom
  const [customRange, setCustomRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [specificDate, setSpecificDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [detailModal, setDetailModal] = useState(null);

  // Helper to get date boundaries
  const getDateRange = useCallback(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (dateFilter) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'yesterday':
        start.setDate(now.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end.setDate(now.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        const day = now.getDay(); // 0 is Sunday
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end.setHours(23, 59, 59, 999);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end.setHours(23, 59, 59, 999);
        break;
      case 'date':
        start = new Date(specificDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(specificDate);
        end.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        start = new Date(customRange.start);
        start.setHours(0, 0, 0, 0);
        end = new Date(customRange.end);
        end.setHours(23, 59, 59, 999);
        break;
      default:
        break;
    }
    return { start, end };
  }, [dateFilter, customRange, specificDate]);

  // Filter staff - same as Attendance.jsx logic
  const filteredStaff = useMemo(() => {
    return (staff || []).filter(s => {
      const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchSearch && s.role !== 'customer' && s.status !== 'inactive';
    });
  }, [staff, searchTerm]);

  // Build per-employee stats for the history ranges
  const historyData = useMemo(() => {
    const { start, end } = getDateRange();

    // Check if start/end Dates are valid before calling toISOString
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return [];
    }

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    const isSingleDay = startStr === endStr;

    const results = filteredStaff.map(s => {
      const recs = (attendance || []).filter(
        r => String(r.staffId) === String(s.id) && r.date >= startStr && r.date <= endStr
      );

      const dayRecord = isSingleDay ? recs[0] : null;

      return {
        id: s.id,
        name: s.name,
        role: s.role,
        present: recs.filter(r => r.status === 'present').length,
        absent: recs.filter(r => r.status === 'absent').length,
        late: recs.filter(r => r.status === 'late').length,
        excused: recs.filter(r => r.status === 'excused').length,
        total: recs.length,
        notes: recs.filter(r => r.status === 'excused' && r.note).map(r => r.note),
        records: recs,
        status: dayRecord?.status || 'none',
        note: dayRecord?.note || ''
      };
    });

    // If single day, hide people with no records to comply with "only view that date history"
    return isSingleDay ? results.filter(r => r.status !== 'none') : results;
  }, [attendance, filteredStaff, getDateRange]);

  const isSingleDayView = useMemo(() => {
    const { start, end } = getDateRange();
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return true; // Default to single day view if invalid
    return start.toISOString().split('T')[0] === end.toISOString().split('T')[0];
  }, [getDateRange]);

  return (
    <div className="attendance-page">
      <div className="history-section" style={{ marginTop: 0 }}>
        <div className="history-header-controls">
          <div className="history-top-row">
            <div className="search-box">
              <User size={18} />
              <input
                type="text"
                placeholder={t('searchStaff')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="date-filter-chips">
              {['today', 'yesterday', 'week', 'month', 'year', 'date', 'custom'].map((f) => (
                <button
                  key={f}
                  className={`chip-mini ${dateFilter === f ? 'active' : ''}`}
                  onClick={() => setDateFilter(f)}
                >
                  {t(f)}
                </button>
              ))}
            </div>
          </div>

          {(dateFilter === 'custom' || dateFilter === 'date') && (
            <div className="custom-date-row animate-fadeIn">
              {dateFilter === 'date' ? (
                <div className="date-input-group">
                  <label>{t('specificDate')}</label>
                  {language === 'am' ? (
                    <EthiopianSelector
                      value={specificDate}
                      onChange={setSpecificDate}
                      size="small"
                      language="am"
                    />
                  ) : (
                    <input
                      type="date"
                      value={specificDate}
                      onChange={(e) => setSpecificDate(e.target.value)}
                    />
                  )}
                </div>
              ) : (
                <>
                  <div className="date-input-group">
                    <label>{t('start')}</label>
                    {language === 'am' ? (
                      <EthiopianSelector
                        value={customRange.start}
                        onChange={(val) => setCustomRange({ ...customRange, start: val })}
                        size="small"
                        language="am"
                      />
                    ) : (
                      <input
                        type="date"
                        value={customRange.start}
                        onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                      />
                    )}
                  </div>
                  <div className="date-input-group">
                    <label>{t('end')}</label>
                    {language === 'am' ? (
                      <EthiopianSelector
                        value={customRange.end}
                        onChange={(val) => setCustomRange({ ...customRange, end: val })}
                        size="small"
                        language="am"
                      />
                    ) : (
                      <input
                        type="date"
                        value={customRange.end}
                        onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="attendance-table-wrapper">
          <table className="attendance-table">
            <thead>
              {isSingleDayView ? (
                <tr>
                  <th>{t('employee')}</th>
                  <th>{t('role')}</th>
                  <th style={{ textAlign: 'center' }}>{t('status')}</th>
                  <th>{t('notes')}</th>
                </tr>
              ) : (
                <tr>
                  <th>{t('employee')}</th>
                  <th>{t('role')}</th>
                  <th style={{ textAlign: 'center', color: '#10b981' }}>{t('present')}</th>
                  <th style={{ textAlign: 'center', color: '#ef4444' }}>{t('absent')}</th>
                  <th style={{ textAlign: 'center', color: '#f59e0b' }}>{t('late')}</th>
                  <th style={{ textAlign: 'center', color: '#6366f1' }}>{t('excused')}</th>
                  <th>{t('notes')}</th>
                  <th style={{ textAlign: 'center' }}>{t('total')}</th>
                </tr>
              )}
            </thead>
            <tbody>
              {historyData.length === 0 ? (
                <tr>
                  <td colSpan={isSingleDayView ? 4 : 8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                    {t('noActivityFound')}
                  </td>
                </tr>
              ) : historyData.map(row => (
                <tr key={row.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="staff-avatar-sm">
                        <User size={16} />
                      </div>
                      <strong>{row.name}</strong>
                    </div>
                  </td>
                  <td><span className="badge-role">{t(row.role) || row.role}</span></td>

                  {isSingleDayView ? (
                    <>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge-status ${row.status}`}>
                          {t(row.status === 'none' ? 'pending' : row.status)}
                        </span>
                      </td>
                      <td>{row.note || '-'}</td>
                    </>
                  ) : (
                    <>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="badge-status present clickable"
                          onClick={() => setDetailModal({ name: row.name, status: 'present', records: row.records.filter(r => r.status === 'present') })}
                          title={t('viewDetails')}
                        >{row.present}</button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="badge-status absent clickable"
                          onClick={() => setDetailModal({ name: row.name, status: 'absent', records: row.records.filter(r => r.status === 'absent') })}
                          title={t('viewDetails')}
                        >{row.absent}</button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="badge-status late clickable"
                          onClick={() => setDetailModal({ name: row.name, status: 'late', records: row.records.filter(r => r.status === 'late') })}
                          title={t('viewDetails')}
                        >{row.late}</button>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="badge-status excused clickable"
                          onClick={() => setDetailModal({ name: row.name, status: 'excused', records: row.records.filter(r => r.status === 'excused') })}
                          title={t('viewDetails')}
                        >{row.excused}</button>
                      </td>
                      <td>
                        {row.notes.length > 0 ? (
                          <div className="history-notes-list">
                            {row.notes.slice(0, 2).map((n, i) => (
                              <div key={i} className="history-note-item mini">
                                {n.length > 25 ? n.substring(0, 25) + '...' : n}
                              </div>
                            ))}
                            {row.notes.length > 2 && <div className="more-notes">+{row.notes.length - 2} {t('more')}</div>}
                          </div>
                        ) : '-'}
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{row.total}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detailModal && (
        <div className="modal-overlay" onClick={() => setDetailModal(null)}>
          <div className="status-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className={`icon-circle ${detailModal.status}`}>
                  <History size={20} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{detailModal.name}</h2>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {t(detailModal.status)} {t('History')}
                  </p>
                </div>
              </div>
              <button className="btn-close" onClick={() => setDetailModal(null)}><ArrowLeft size={20} /></button>
            </div>
            <div className="modal-content">
              {detailModal.records.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  {t('No records found for this status.')}
                </div>
              ) : (
                <div className="detail-records-list">
                  {detailModal.records.sort((a, b) => b.date.localeCompare(a.date)).map((rec, i) => (
                    <div key={i} className="detail-record-item">
                      <div className="record-date">
                        <Calendar size={14} />
                        <span>{formatDate(rec.date)}</span>
                      </div>
                      {rec.note && (
                        <div className="record-note-box">
                          {rec.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceHistory;
