import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import {
  ClipboardList, CheckCircle2, XCircle, Clock,
  Search, Calendar, User, FileText, Filter,
  Check, X, AlertCircle,
  Users, Save, History
} from 'lucide-react';
import './Attendance.css';
import EthiopianSelector from './EthiopianSelector';

const Attendance = () => {
  const {
    staff, attendance, salaries, addItem, updateItem, showToast,
    logActivity, t, language, formatDate, formatTime
  } = useAppContext();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'table'
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [draftAttendance, setDraftAttendance] = useState({}); // { staffId: { status, note, isNew } }

  // Handle window resize for responsive view switching
  React.useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && viewMode === 'table') {
        setViewMode('card');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [viewMode]);

  // Filter staff to manage
  const filteredStaff = useMemo(() => {
    return (staff || []).filter(s => {
      const nameMatch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
      const roleMatch = roleFilter === 'all' || s.role === roleFilter;
      // Don't show customers or inventory managers in attendance
      return nameMatch && roleMatch && s.role !== 'customer' && s.role !== 'inventoryManager' && s.status !== 'inactive';
    });
  }, [staff, searchTerm, roleFilter]);

  // Get attendance records for selected date
  const dateRecords = useMemo(() => {
    return (attendance || []).filter(r => r.date === selectedDate);
  }, [attendance, selectedDate]);

  // Update status/note in draft state
  const handleStatusChange = useCallback((staffId, status) => {
    const existingDraft = draftAttendance[staffId];
    const existingRecord = (attendance || []).find(
      r => r.date === selectedDate && String(r.staffId) === String(staffId)
    );

    let newStatus;
    if (existingDraft) {
      newStatus = existingDraft.status === status ? 'none' : status;
    } else {
      newStatus = (existingRecord?.status || 'none') === status ? 'none' : status;
    }

    setDraftAttendance(prev => ({
      ...prev,
      [staffId]: {
        ...(prev[staffId] || {
          note: existingRecord?.note || '',
          isNew: !existingRecord
        }),
        status: newStatus
      }
    }));
  }, [attendance, selectedDate, draftAttendance]);

  const handleNoteChange = useCallback((staffId, note) => {
    const existingRecord = (attendance || []).find(
      r => r.date === selectedDate && String(r.staffId) === String(staffId)
    );

    setDraftAttendance(prev => ({
      ...prev,
      [staffId]: {
        ...(prev[staffId] || {
          status: existingRecord?.status || 'none',
          isNew: !existingRecord
        }),
        note
      }
    }));
  }, [attendance, selectedDate]);

  const handleSaveAll = useCallback(() => {
    const drafts = Object.entries(draftAttendance);
    if (drafts.length === 0) return;

    drafts.forEach(([staffId, data]) => {
      const existing = (attendance || []).find(
        r => r.date === selectedDate && String(r.staffId) === String(staffId)
      );

      if (existing) {
        // Update existing
        updateItem('attendance', existing.id, {
          status: data.status,
          note: data.note,
          updatedAt: new Date().toISOString()
        });
      } else if (data.status !== 'none' || data.note) {
        // Create new
        addItem('attendance', {
          staffId,
          date: selectedDate,
          status: data.status,
          note: data.note,
          createdAt: new Date().toISOString()
        });
      }
    });

    setDraftAttendance({});
    showToast(t('attendanceSavedSuccessfully'), 'success');
    logActivity(t('Attendance Saved'), `${t('User saved attendance for')} ${drafts.length} ${t('employees')} ${t('on')} ${selectedDate}`);
  }, [draftAttendance, attendance, selectedDate, updateItem, addItem, showToast, t, logActivity]);

  const getStatsForRange = (days) => {
    const counts = { present: 0, absent: 0, late: 0, excused: 0, pending: 0 };
    if (!selectedDate) return counts;

    const dateLimit = new Date(selectedDate);
    if (isNaN(dateLimit.getTime())) return counts;

    dateLimit.setDate(dateLimit.getDate() - days);
    const limitStr = dateLimit.toISOString().split('T')[0];

    const rangeRecords = (attendance || []).filter(r => r.date <= selectedDate && r.date >= limitStr);

    // For counts, we might want "unique employee statuses" per day in the range
    // Or just simple total instances in the range. The user asked for "Daily statistics, Weekly summary, Monthly summary"
    // We'll calculate totals in the range.
    rangeRecords.forEach(r => {
      if (counts.hasOwnProperty(r.status)) counts[r.status]++;
    });

    // For Daily (days=0), we also count pending
    if (days === 0) {
      filteredStaff.forEach(s => {
        if (!dateRecords.find(r => String(r.staffId) === String(s.id))) {
          counts.pending++;
        }
      });
    }

    return counts;
  };

  const dashboardStats = useMemo(() => ({
    daily: getStatsForRange(0),
    weekly: getStatsForRange(7),
    monthly: getStatsForRange(30),
    totalDeduction: dateRecords.reduce((total, rec) => {
      const sal = (salaries || []).find(sal => String(sal.employeeId) === String(rec.staffId));
      if (sal && sal.isDeductionEnabled) {
        if (rec.status === 'absent') return total + (sal.absentDeduction || 0);
        if (rec.status === 'late') return total + (sal.lateDeduction || 0);
      }
      return total;
    }, 0)
  }), [attendance, salaries, selectedDate, filteredStaff, dateRecords]);

  const roles = [...new Set(staff.filter(s => s.role !== 'customer').map(s => s.role))];

  return (
    <div className="attendance-page">
      <div className="attendance-controls">
        <div className="date-selector">
          <Calendar size={18} />
          {language === 'am' ? (
            <EthiopianSelector
              value={selectedDate}
              onChange={setSelectedDate}
              size="small"
              language="am"
            />
          ) : (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, flex: 1, minWidth: '300px', alignItems: 'center' }}>
          <div className="search-box" style={{ flex: 1 }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder={t('searchStaff')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-item">
            <Filter size={16} />
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">{t('allRoles')}</option>
              {roles.map(r => (
                <option key={r} value={r}>{t(r) || r}</option>
              ))}
            </select>
          </div>

          <div className="view-toggle desktop-only">
            <button
              className={`toggle-btn ${viewMode === 'card' ? 'active' : ''}`}
              onClick={() => setViewMode('card')}
              title={t('Card View')}
            >
              <Users size={18} />
            </button>
            <button
              className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title={t('Table View')}
            >
              <ClipboardList size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="attendance-dashboard">
        <SummaryCard
          title={t('present')}
          status="present"
          daily={dashboardStats.daily.present}
          icon={<CheckCircle2 size={20} />}
          t={t}
        />
        <SummaryCard
          title={t('absent')}
          status="absent"
          daily={dashboardStats.daily.absent}
          icon={<XCircle size={20} />}
          t={t}
        />
        <SummaryCard
          title={t('late')}
          status="late"
          daily={dashboardStats.daily.late}
          icon={<Clock size={20} />}
          t={t}
        />
        <SummaryCard
          title={t('excused')}
          status="excused"
          daily={dashboardStats.daily.excused}
          icon={<AlertCircle size={20} />}
          t={t}
        />
        <SummaryCard
          title={t('unmarked')}
          status="pending"
          daily={dashboardStats.daily.pending}
          icon={<Users size={20} />}
          t={t}
        />
      </div>

      <div className="bulk-actions" style={{ marginBottom: 16 }}>
        <button className="btn-bulk" onClick={() => {
          const newDrafts = { ...draftAttendance };
          filteredStaff.forEach(s => {
            const hasExisting = (attendance || []).some(r => r.date === selectedDate && String(r.staffId) === String(s.id));
            if (!hasExisting && !newDrafts[s.id]) {
              newDrafts[s.id] = { status: 'present', note: '', isNew: true };
            } else if (newDrafts[s.id] && newDrafts[s.id].status === 'none') {
              newDrafts[s.id] = { ...newDrafts[s.id], status: 'present' };
            }
          });
          setDraftAttendance(newDrafts);
        }}>
          <Check size={16} /> {t('Mark All Present')}
        </button>
      </div>

      {viewMode === 'card' || isMobile ? (
        <div className="staff-grid">
          {filteredStaff.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              <User size={48} opacity={0.5} />
              <p>{t("No staff found.")}</p>
            </div>
          ) : (
            filteredStaff.map(s => (
              <AttendanceCard
                key={s.id}
                staff={s}
                record={dateRecords.find(r => String(r.staffId) === String(s.id))}
                draft={draftAttendance[s.id]}
                handleStatusChange={handleStatusChange}
                handleNoteChange={handleNoteChange}
                t={t}
              />
            ))
          )}
        </div>
      ) : (
        <div className="attendance-table-wrapper">
          <table className="attendance-table">
            <thead>
              <tr>
                <th>{t('Employee')}</th>
                <th>{t('Role')}</th>
                <th>{t('Status')}</th>
                <th>{t('Deduction')}</th>
                <th>{t('Note')}</th>
                <th>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map(s => {
                const record = dateRecords.find(r => String(r.staffId) === String(s.id));
                const draft = draftAttendance[s.id];
                const status = draft ? draft.status : (record?.status || 'none');
                const note = draft ? draft.note : (record?.note || '');
                const isModified = !!draft;

                const sal = (salaries || []).find(sal => String(sal.employeeId) === String(s.id));
                let deduction = 0;
                if (sal && sal.isDeductionEnabled) {
                  if (status === 'absent') deduction = sal.absentDeduction || 0;
                  if (status === 'late') deduction = sal.lateDeduction || 0;
                }

                return (
                  <tr key={s.id} className={isModified ? 'row-modified' : ''}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="staff-avatar-sm">
                          {s.profilePic ? <img src={s.profilePic} alt={s.name} /> : <User size={16} />}
                        </div>
                        <span style={{ fontWeight: 600 }}>{s.name}</span>
                        {isModified && <span className="modified-dot" title={t('Unsaved changes')} />}
                      </div>
                    </td>
                    <td><span className="badge-role">{t(s.role) || s.role}</span></td>
                    <td>
                      <span className={`badge-status ${status}`}>
                        {t(status)}
                        {isModified && <span style={{ fontSize: '0.7em', marginLeft: 4 }}>({t('draft')})</span>}
                      </span>
                    </td>
                    <td><span className={deduction > 0 ? 'text-danger' : ''}>{deduction.toLocaleString()} {t('ETB')}</span></td>
                    <td>
                      <input
                        type="text"
                        className={`table-note-input ${isModified && draft.note !== record?.note ? 'modified' : ''}`}
                        placeholder="..."
                        value={note}
                        onChange={(e) => handleNoteChange(s.id, e.target.value)}
                      />
                    </td>
                    <td>
                      <div className="table-status-chips">
                        <button className={`chip-mini present ${status === 'present' ? 'active' : ''}`} onClick={() => handleStatusChange(s.id, 'present')}>{t('Present')}</button>
                        <button className={`chip-mini absent ${status === 'absent' ? 'active' : ''}`} onClick={() => handleStatusChange(s.id, 'absent')}>{t('Absent')}</button>
                        <button className={`chip-mini late ${status === 'late' ? 'active' : ''}`} onClick={() => handleStatusChange(s.id, 'late')}>{t('Late')}</button>
                        <button className={`chip-mini excused ${status === 'excused' ? 'active' : ''}`} onClick={() => handleStatusChange(s.id, 'excused')}>{t('Excused')}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {Object.keys(draftAttendance).length > 0 && (
        <div className="save-attendance-outer animate-slideUp">
          <div className="save-attendance-container">
            <div className="save-info">
              <strong>{Object.keys(draftAttendance).length}</strong> {t('changesPending')}
            </div>
            <button className="btn-save-attendance" onClick={handleSaveAll}>
              <Save size={18} /> {t('Save Attendance')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({ title, status, daily, icon, t }) => (
  <div className={`summary-card ${status}`}>
    <div className="card-header">
      <div className="icon">{icon}</div>
      <h3>{title}</h3>
    </div>
    <div className="stats-row">
      <div className="stat-item">
        <span className="val">{daily ?? 0}</span>
        <span className="lab">{t('Today')}</span>
      </div>
    </div>
  </div>
);

const AttendanceCard = ({ staff, record, draft, handleStatusChange, handleNoteChange, t }) => {
  const status = draft ? draft.status : (record?.status || 'none');
  const note = draft ? draft.note : (record?.note || '');
  const isModified = !!draft;

  const initials = (staff.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const [draftNote, setDraftNote] = useState(note);
  const [showNoteBar, setShowNoteBar] = useState(status === 'excused' && !note);

  // Keep draft in sync if record or draft changes
  useEffect(() => {
    setDraftNote(note);
    if (status === 'excused' && !note) {
      setShowNoteBar(true);
    }
  }, [note, status]);

  const onSaveNote = () => {
    handleNoteChange(staff.id, draftNote);
    setShowNoteBar(false);
  };

  const onStatusClick = (newStatus) => {
    if (newStatus === 'excused') {
      if (status === 'excused' && !showNoteBar) {
        setShowNoteBar(true);
        return;
      }
    }
    handleStatusChange(staff.id, newStatus);
  };

  return (
    <div className={`attendance-card status-${status} ${isModified ? 'modified' : ''}`}>
      <div className={`card-status-indicator ${status}`} />
      {isModified && <div className="card-modified-corner" title={t('Unsaved changes')} />}
      <div className="card-top">
        <div className="staff-avatar">
          {staff.profilePic
            ? <img src={staff.profilePic} alt={staff.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
            : <span className="avatar-initials">{initials}</span>
          }
        </div>
        <div className="staff-info">
          <h3>{staff.name}</h3>
          <span className="staff-role">{t(staff.role) || staff.role}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span className={`badge-status ${status}`}>{t(status)}</span>
            {isModified && <span className="draft-label">({t('draft')})</span>}
          </div>
        </div>
      </div>
      <div className="status-buttons">
        <button className={`btn-status-chip present ${status === 'present' ? 'active' : ''}`} onClick={() => onStatusClick('present')}><Check size={14} /> {t('present')}</button>
        <button className={`btn-status-chip absent ${status === 'absent' ? 'active' : ''}`} onClick={() => onStatusClick('absent')}><X size={14} /> {t('absent')}</button>
        <button className={`btn-status-chip late ${status === 'late' ? 'active' : ''}`} onClick={() => onStatusClick('late')}><Clock size={14} /> {t('late')}</button>
        <button className={`btn-status-chip excused ${status === 'excused' ? 'active' : ''}`} onClick={() => onStatusClick('excused')}><AlertCircle size={14} /> {t('excused')}</button>
      </div>

      {(status === 'excused' || note) && showNoteBar && (
        <div className="excused-reason-wrapper excused-active">
          <div className="excused-reason-label">
            <AlertCircle size={14} />
            <span>{t('Reason for Excusal')}</span>
          </div>
          <textarea
            className="excused-reason-input"
            placeholder={t('Type the reason for excusal here...')}
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            rows={3}
          />
          <button className="btn-note-save-large draft" onClick={onSaveNote}>
            <Save size={16} /> {t('Mark for Save')}
          </button>
        </div>
      )}
      {status === 'excused' && !showNoteBar && note && (
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn-text"
            style={{
              padding: '2px 8px',
              fontSize: '0.7rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              opacity: 0.6
            }}
            onClick={() => setShowNoteBar(true)}
          >
            <FileText size={12} /> {t('Edit Note')}
          </button>
        </div>
      )}
    </div>
  );
};

export default Attendance;
