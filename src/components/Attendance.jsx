import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAppContext } from '../context/AppContext';
import {
  Users, CheckCircle, XCircle, Clock, CalendarCheck, BarChart2,
  Plus, Edit2, Trash2, RefreshCw, ChevronDown, Download, Search, Filter, Check
} from 'lucide-react';
import { SkeletonStatsGrid, SkeletonListPage, SkeletonCardGrid } from './SkeletonLoader';
import ErrorState from './ErrorState';
import './Attendance.css';

const STATUS_COLORS = {
  Present: '#22c55e', Absent: '#ef4444', 'Half Day': '#f59e0b',
  Leave: '#6366f1', Holiday: '#06b6d4', Weekend: '#8b5cf6', Excused: '#3b82f6'
};

const STATUS_LIST = ['Present', 'Absent', 'Excused', 'Half Day', 'Leave', 'Holiday', 'Weekend'];

export default function Attendance() {
  const { showToast, isSyncing, isInitialLoadComplete } = useAppContext();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [summary, setSummary] = useState({ total: 0, present: 0, absent: 0, late: 0, onLeave: 0, excused: 0, attendanceRate: 0 });
  const [trend, setTrend] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterEmp, setFilterEmp] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  // Modal state for manual attendance
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('single'); // 'single' | 'bulk'
  const [form, setForm] = useState({ employeeId: '', attendanceDate: new Date().toISOString().split('T')[0], checkIn: '', checkOut: '', status: 'Present', remarks: '' });
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkRecords, setBulkRecords] = useState([]);
  const [saving, setSaving] = useState(false);
  const [markDate, setMarkDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingCards, setSavingCards] = useState({});
  const [syncingStaff, setSyncingStaff] = useState(false);
  const [draftAttendances, setDraftAttendances] = useState({});
  const [savingDaily, setSavingDaily] = useState(false);

  const handleSyncStaff = async () => {
    setSyncingStaff(true);
    try {
      const result = await api.syncEmployeesFromStaff();
      showToast(result.message || 'Staff synced as employees!', 'success');
      await load(true);
    } catch (err) {
      showToast('Sync failed: ' + err.message, 'error');
    } finally {
      setSyncingStaff(false);
    }
  };

  // Leave modal
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ employeeId: '', leaveType: 'Annual', startDate: '', endDate: '', reason: '' });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [s, t, e, a, l] = await Promise.all([
        api.getAttendanceSummary(),
        api.getAttendanceTrend(30),
        api.getEmployees(),
        api.getAttendances({ month: filterMonth, year: filterYear, ...(filterEmp ? { employeeId: filterEmp } : {}), ...(filterStatus ? { status: filterStatus } : {}) }),
        api.getLeaveRequests()
      ]);
      setSummary(s);
      setTrend(t);
      setEmployees(Array.isArray(e) ? e : []);
      setAttendances(Array.isArray(a) ? a : []);
      setLeaves(Array.isArray(l) ? l : []);
    } catch (err) {
      showToast('Failed to load attendance data: ' + err.message, 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filterMonth, filterYear, filterEmp, filterStatus, showToast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (modalMode === 'bulk' && employees.length > 0) {
      setBulkRecords(employees.map(e => ({ employeeId: e.id, fullName: e.fullName, employeeNumber: e.employeeNumber, attendanceDate: bulkDate, status: 'Present', checkIn: '08:00', checkOut: '17:00', remarks: '' })));
    }
  }, [modalMode, employees, bulkDate]);

  useEffect(() => {
    // Populate draftAttendances locally from actual attendances for the current markDate
    const newDrafts = {};
    employees.forEach(emp => {
      const record = attendances.find(a => a.employeeId === emp.id && a.attendanceDate?.split('T')[0] === markDate);
      newDrafts[emp.id] = {
        status: record?.status || '',
        checkIn: record?.checkIn ? new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
        checkOut: record?.checkOut ? new Date(record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
        remarks: record?.remarks || '',
        isDirty: false
      };
    });
    setDraftAttendances(newDrafts);
  }, [employees, attendances, markDate]);

  const handleSaveDailyAttendance = async () => {
    const dirtyEmployeeIds = Object.keys(draftAttendances).filter(id => draftAttendances[id].isDirty && draftAttendances[id].status);
    if (dirtyEmployeeIds.length === 0) {
      showToast('No daily attendance updates to save', 'info');
      return;
    }

    setSavingDaily(true);
    try {
      // 1. Resolve virtual staff_ IDs if any
      const hasVirtual = dirtyEmployeeIds.some(id => id.startsWith('staff_'));
      let freshEmployees = employees;
      if (hasVirtual) {
        await api.syncEmployeesFromStaff();
        freshEmployees = await api.getEmployees();
      }

      // 2. Build attendance records to save
      const recordsToSave = [];
      for (const empId of dirtyEmployeeIds) {
        const draft = draftAttendances[empId];
        let realEmpId = empId;
        if (empId.startsWith('staff_')) {
          const staffUser = employees.find(e => e.id === empId);
          if (staffUser) {
            const realEmp = freshEmployees.find(e => e.userId === staffUser.userId && !e.isVirtual);
            if (realEmp) realEmpId = realEmp.id;
          }
        }

        const dateStr = markDate;
        const currentStatus = draft.status;
        const hasTime = currentStatus === 'Present' || currentStatus === 'Half Day';
        const checkInFull = hasTime && draft.checkIn ? `${dateStr}T${draft.checkIn}:00` : null;
        const checkOutFull = hasTime && draft.checkOut ? `${dateStr}T${draft.checkOut}:00` : null;

        recordsToSave.push({
          employeeId: realEmpId,
          attendanceDate: dateStr,
          status: currentStatus,
          checkIn: checkInFull,
          checkOut: checkOutFull,
          remarks: draft.remarks
        });
      }

      const result = await api.bulkAttendance(recordsToSave);
      showToast(`${result.created} attendance card(s) saved successfully`, 'success');
      await load(true);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingDaily(false);
    }
  };

  const handleSaveSingle = async () => {
    setSaving(true);
    try {
      // If this is a virtual staff_ ID, resolve it using the userId
      let empId = form.employeeId;
      if (empId && empId.startsWith('staff_')) {
        const staffUser = employees.find(e => e.id === empId);
        if (staffUser?.isVirtual) {
          // Try to sync first so a real employee record exists
          await api.syncEmployeesFromStaff();
          await load(true);
          // Find the newly created record
          const refreshed = employees.find(e => e.userId === staffUser.userId && !e.isVirtual);
          if (refreshed) empId = refreshed.id;
          else empId = staffUser.userId; // fallback: should not happen
        }
      }
      const checkInFull = form.checkIn ? `${form.attendanceDate}T${form.checkIn}:00` : null;
      const checkOutFull = form.checkOut ? `${form.attendanceDate}T${form.checkOut}:00` : null;
      await api.createAttendance({ ...form, employeeId: empId, checkIn: checkInFull, checkOut: checkOutFull });
      showToast('Attendance recorded', 'success');
      setShowModal(false);
      load(true);
    } catch (err) {
      showToast(err.message, 'error');
    } finally { setSaving(false); }
  };

  const handleSaveBulk = async () => {
    setSaving(true);
    try {
      const records = bulkRecords.map(r => ({
        ...r,
        checkIn: r.checkIn ? `${r.attendanceDate}T${r.checkIn}:00` : null,
        checkOut: r.checkOut ? `${r.attendanceDate}T${r.checkOut}:00` : null
      }));
      const result = await api.bulkAttendance(records);
      showToast(`${result.created} records saved${result.failed.length ? `, ${result.failed.length} failed` : ''}`, result.failed.length ? 'warning' : 'success');
      setShowModal(false);
      load(true);
    } catch (err) {
      showToast(err.message, 'error');
    } finally { setSaving(false); }
  };

  const handleApproveLeave = async (id) => {
    try {
      await api.approveLeave(id);
      showToast('Leave approved. Attendance records created.', 'success');
      load(true);
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleRejectLeave = async (id) => {
    try {
      await api.rejectLeave(id);
      showToast('Leave rejected', 'info');
      load(true);
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleSubmitLeave = async () => {
    setSaving(true);
    try {
      await api.createLeaveRequest(leaveForm);
      showToast('Leave request submitted', 'success');
      setShowLeaveModal(false);
      load(true);
    } catch (err) { showToast(err.message, 'error'); } finally { setSaving(false); }
  };

  const filtered = attendances.filter(a => {
    const name = a.employee?.fullName?.toLowerCase() || '';
    return !search || name.includes(search.toLowerCase()) || a.employee?.employeeNumber?.toLowerCase().includes(search.toLowerCase());
  });

  const exportCSV = () => {
    const header = 'Employee,Number,Date,Status,CheckIn,CheckOut,WorkingHrs,LateMin,OvertimeHrs\n';
    const rows = filtered.map(a =>
      `"${a.employee?.fullName}","${a.employee?.employeeNumber}","${a.attendanceDate?.split('T')[0]}","${a.status}","${a.checkIn ? new Date(a.checkIn).toLocaleTimeString() : ''}","${a.checkOut ? new Date(a.checkOut).toLocaleTimeString() : ''}","${a.workingHours}","${a.lateMinutes}","${a.overtimeHours}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `attendance_${filterYear}_${filterMonth}.csv`; a.click();
  };

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const maxBarVal = Math.max(...trend.map(t => t.present + t.absent), 1);

  if ((loading && attendances.length === 0) || (isSyncing && !isInitialLoadComplete)) {
    return <SkeletonListPage rows={6} cols={5} />;
  }

  return (
    <div className="attendance-page">
      {/* Header */}
      <div className="attendance-header">
        <div>
          <h1 className="attendance-title">Attendance Management</h1>
          <p className="attendance-sub">Track, manage and analyze employee attendance</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="att-btn att-btn-outline" onClick={load}><RefreshCw size={16} /> Refresh</button>
          <button className="att-btn att-btn-outline" title="Sync existing staff as employees" onClick={handleSyncStaff} disabled={syncingStaff}>
            {syncingStaff ? 'Syncing...' : '⟳ Sync Staff'}
          </button>
          <button className="att-btn att-btn-outline" onClick={() => { setShowLeaveModal(true); }}><CalendarCheck size={16} /> Leave Request</button>
          <button className="att-btn att-btn-primary" onClick={() => { setShowModal(true); setModalMode('single'); }}>
            <Plus size={16} /> Record Attendance
          </button>
          <button className="att-btn att-btn-secondary" onClick={() => { setShowModal(true); setModalMode('bulk'); }}>
            <CheckCircle size={16} /> Bulk Attendance
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="att-tabs">
        {[['dashboard','Dashboard'],['mark','Daily Attendance (Cards)'],['records','Records'],['leaves','Leave Requests']].map(([k,l]) => (
          <button key={k} className={`att-tab ${activeTab === k ? 'active' : ''}`} onClick={() => setActiveTab(k)}>{l}</button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {activeTab === 'dashboard' && (
        <>
          {/* ── Four Status Cards ── */}
          <div className="att-status-cards">
            {[
              {
                label: 'Present',
                value: attendances.filter(a => a.status === 'Present').length,
                icon: <CheckCircle size={26} />, color: '#22c55e', bg: '#22c55e18'
              },
              {
                label: 'Absent',
                value: attendances.filter(a => a.status === 'Absent').length,
                icon: <XCircle size={26} />, color: '#ef4444', bg: '#ef444418'
              },
              {
                label: 'Late',
                value: attendances.filter(a => a.status === 'Present' && (a.lateMinutes || 0) > 0).length,
                icon: <Clock size={26} />, color: '#f59e0b', bg: '#f59e0b18'
              },
              {
                label: 'Excused',
                value: attendances.filter(a => a.status === 'Excused').length,
                icon: <CalendarCheck size={26} />, color: '#3b82f6', bg: '#3b82f618'
              }
            ].map(c => (
              <div key={c.label} className="att-status-card" style={{ borderLeft: `4px solid ${c.color}` }}>
                <div className="att-status-card-icon" style={{ background: c.bg, color: c.color }}>{c.icon}</div>
                <div className="att-status-card-info">
                  <div className="att-status-card-value" style={{ color: c.color }}>{loading ? '—' : c.value}</div>
                  <div className="att-status-card-label">{c.label}</div>
                </div>
                <div className="att-status-card-bar">
                  <div style={{ height: attendances.length > 0 ? `${Math.round((c.value / (attendances.length || 1)) * 100)}%` : '0%', background: c.color, borderRadius: 4, transition: 'height 0.4s ease' }} />
                </div>
              </div>
            ))}
          </div>

          <div className="att-cards">
            {[
              { label: 'Total Employees', value: summary.total, icon: <Users size={22} />, color: '#4361ee' },
              { label: 'Attendance Rate', value: `${summary.attendanceRate}%`, icon: <BarChart2 size={22} />, color: '#06b6d4' },
              { label: 'On Leave', value: summary.onLeave, icon: <CalendarCheck size={22} />, color: '#6366f1' },
            ].map(card => (
              <div key={card.label} className="att-card" style={{ borderTop: `3px solid ${card.color}` }}>
                <div className="att-card-icon" style={{ background: card.color + '20', color: card.color }}>{card.icon}</div>
                <div className="att-card-body">
                  <div className="att-card-value">{loading ? '—' : card.value}</div>
                  <div className="att-card-label">{card.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Trend Chart */}
          <div className="att-chart-card">
            <h3 className="att-section-title">30-Day Attendance Trend</h3>
            <div className="att-bar-chart">
              {trend.slice(-14).map((t, i) => (
                <div key={i} className="att-bar-group">
                  <div className="att-bars">
                    <div className="att-bar att-bar-present" style={{ height: `${(t.present / maxBarVal) * 100}%` }} title={`Present: ${t.present}`} />
                    <div className="att-bar att-bar-absent" style={{ height: `${(t.absent / maxBarVal) * 100}%` }} title={`Absent: ${t.absent}`} />
                    <div className="att-bar" style={{ background: '#f59e0b', height: `${(( t.late||0) / maxBarVal) * 100}%`, width: 6 }} title={`Late: ${t.late||0}`} />
                    <div className="att-bar" style={{ background: '#3b82f6', height: `${((t.excused||0) / maxBarVal) * 100}%`, width: 6 }} title={`Excused: ${t.excused||0}`} />
                  </div>
                  <div className="att-bar-label">{t.date?.slice(5)}</div>
                </div>
              ))}
            </div>
            <div className="att-legend">
              <span><span className="dot" style={{ background: '#22c55e' }} /> Present</span>
              <span><span className="dot" style={{ background: '#ef4444' }} /> Absent</span>
              <span><span className="dot" style={{ background: '#f59e0b' }} /> Late</span>
              <span><span className="dot" style={{ background: '#3b82f6' }} /> Excused</span>
            </div>
          </div>
        </>
      )}

      {/* ── DAILY ATTENDANCE (CARDS) ── */}
      {activeTab === 'mark' && (
        <div className="att-section">
          <div className="att-filters" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 600 }}>Select Date:</span>
              <input 
                type="date" 
                className="att-input" 
                value={markDate} 
                onChange={e => {
                  const dateVal = e.target.value;
                  setMarkDate(dateVal);
                  const d = new Date(dateVal);
                  setFilterMonth(d.getMonth() + 1);
                  setFilterYear(d.getFullYear());
                }} 
              />
            </div>
            <div>
              <button className="att-btn att-btn-outline" onClick={() => load(true)}>
                <RefreshCw size={15} /> Sync Cards
              </button>
            </div>
          </div>

          <div className="staff-grid">
            {employees.map(emp => {
              const draft = draftAttendances[emp.id] || { status: '', checkIn: '', checkOut: '', remarks: '', isDirty: false };
              const currentStatus = draft.status || '';
              const currentCheckIn = draft.checkIn || '';
              const currentCheckOut = draft.checkOut || '';

              const handleStatusClickLocal = (statusVal) => {
                setDraftAttendances(prev => {
                  let cIn = prev[emp.id]?.checkIn || '';
                  let cOut = prev[emp.id]?.checkOut || '';
                  if (statusVal === 'Present') {
                    cIn = '08:00';
                    cOut = '17:00';
                  } else if (statusVal === 'Half Day') {
                    cIn = '08:00';
                    cOut = '12:30';
                  } else {
                    cIn = '';
                    cOut = '';
                  }
                  return {
                    ...prev,
                    [emp.id]: {
                      ...prev[emp.id],
                      status: statusVal,
                      checkIn: cIn,
                      checkOut: cOut,
                      isDirty: true
                    }
                  };
                });
              };

              const handleDetailsUpdateLocal = (cInVal, cOutVal, remarksVal) => {
                setDraftAttendances(prev => ({
                  ...prev,
                  [emp.id]: {
                    ...prev[emp.id],
                    checkIn: cInVal,
                    checkOut: cOutVal,
                    remarks: remarksVal,
                    isDirty: true
                  }
                }));
              };

              return (
                <div key={emp.id} className="attendance-card" style={{ borderLeft: `4px solid ${STATUS_COLORS[currentStatus] || '#cbd5e1'}` }}>
                  <div className="card-top">
                    <div className="staff-avatar">
                      {emp.fullName?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div className="staff-info">
                      <h3>{emp.fullName}</h3>
                      <span>{emp.employeeNumber} · {emp.department}</span>
                    </div>
                  </div>

                  <div className="status-buttons">
                    {['Present', 'Absent', 'Excused', 'Late'].map(s => {
                      const isActive = currentStatus === s;
                      return (
                        <button 
                          key={s} 
                          className={`btn-status-chip ${s.toLowerCase().replace(' ', '-')} ${isActive ? 'active' : ''}`}
                          onClick={() => handleStatusClickLocal(s)}
                          disabled={savingDaily}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>

                  {currentStatus && (
                    <CardDetailsForm 
                      checkIn={currentCheckIn}
                      checkOut={currentCheckOut}
                      remarks={draft.remarks || ''}
                      showTime={currentStatus === 'Present' || currentStatus === 'Half Day'}
                      onSave={(cIn, cOut, rem) => handleDetailsUpdateLocal(cIn, cOut, rem)}
                      isSaving={savingDaily}
                    />
                  )}

                  {draft.isDirty && (
                    <div style={{ position: 'absolute', top: 12, right: 12, fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>
                      ● Unsaved
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32, paddingBottom: 32 }}>
            <button 
              className={`att-btn att-btn-primary ${savingDaily ? 'loading' : ''}`} 
              onClick={handleSaveDailyAttendance}
              disabled={savingDaily}
              style={{ padding: '12px 36px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 10, minWidth: 200, justifyContent: 'center' }}
            >
              {savingDaily ? (
                <>
                  <RefreshCw size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> Saving...
                </>
              ) : (
                'Save Attendance'
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── RECORDS ── */}
      {activeTab === 'records' && (
        <div className="att-section">
          {/* Filters */}
          <div className="att-filters">
            <select className="att-select" value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
              {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select className="att-select" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
              {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className="att-select" value={filterEmp} onChange={e => setFilterEmp(e.target.value)}>
              <option value="">All Employees</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
            </select>
            <select className="att-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="att-search">
              <Search size={15} />
              <input placeholder="Search employee..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="att-btn att-btn-outline" onClick={exportCSV}><Download size={15} /> CSV</button>
          </div>

          <div className="att-table-wrap">
            <table className="att-table">
              <thead>
                <tr>
                  <th>Employee</th><th>Date</th><th>Status</th>
                  <th>Check In</th><th>Check Out</th>
                  <th>Working Hrs</th><th>Late Min</th><th>Overtime Hrs</th><th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32 }}>Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, opacity: 0.5 }}>No records found</td></tr>
                ) : filtered.map(a => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{a.employee?.fullName}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{a.employee?.employeeNumber}</div>
                    </td>
                    <td>{a.attendanceDate?.split('T')[0]}</td>
                    <td>
                      <span className="att-badge" style={{ background: STATUS_COLORS[a.status] + '20', color: STATUS_COLORS[a.status] }}>{a.status}</span>
                    </td>
                    <td>{a.checkIn ? new Date(a.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td>{a.checkOut ? new Date(a.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td>{a.workingHours}h</td>
                    <td style={{ color: a.lateMinutes > 0 ? '#f59e0b' : 'inherit' }}>{a.lateMinutes}m</td>
                    <td style={{ color: a.overtimeHours > 0 ? '#22c55e' : 'inherit' }}>{a.overtimeHours}h</td>
                    <td style={{ opacity: 0.6, fontSize: '0.8rem' }}>{a.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 8, opacity: 0.5, fontSize: '0.8rem' }}>{filtered.length} record(s)</div>
        </div>
      )}

      {/* ── LEAVE REQUESTS ── */}
      {activeTab === 'leaves' && (
        <div className="att-section">
          <div className="att-table-wrap">
            <table className="att-table">
              <thead>
                <tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {leaves.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, opacity: 0.5 }}>No leave requests</td></tr>
                ) : leaves.map(l => (
                  <tr key={l.id}>
                    <td><div style={{ fontWeight: 600 }}>{l.employee?.fullName}</div><div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{l.employee?.department}</div></td>
                    <td><span className="att-badge" style={{ background: '#6366f120', color: '#6366f1' }}>{l.leaveType}</span></td>
                    <td>{l.startDate?.split('T')[0]}</td>
                    <td>{l.endDate?.split('T')[0]}</td>
                    <td>{l.totalDays}</td>
                    <td style={{ opacity: 0.7, fontSize: '0.85rem', maxWidth: 160 }}>{l.reason || '—'}</td>
                    <td>
                      <span className="att-badge" style={{
                        background: l.status === 'approved' ? '#22c55e20' : l.status === 'rejected' ? '#ef444420' : '#f59e0b20',
                        color: l.status === 'approved' ? '#22c55e' : l.status === 'rejected' ? '#ef4444' : '#f59e0b'
                      }}>{l.status}</span>
                    </td>
                    <td>
                      {l.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="att-btn att-btn-xs att-btn-success" onClick={() => handleApproveLeave(l.id)}>Approve</button>
                          <button className="att-btn att-btn-xs att-btn-danger" onClick={() => handleRejectLeave(l.id)}>Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL: Single / Bulk ── */}
      {showModal && (
        <div className="att-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="att-modal" onClick={e => e.stopPropagation()}>
            <div className="att-modal-header">
              <h3>{modalMode === 'bulk' ? 'Bulk Attendance' : 'Record Attendance'}</h3>
              <button className="att-modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {modalMode === 'single' ? (
              <div className="att-modal-body">
                <div className="att-form-row">
                  <label>Employee</label>
                  <select className="att-select w-full" value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}>
                    <option value="">Select Employee</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeNumber})</option>)}
                  </select>
                </div>
                <div className="att-form-row">
                  <label>Date</label>
                  <input type="date" className="att-input" value={form.attendanceDate} onChange={e => setForm(f => ({ ...f, attendanceDate: e.target.value }))} />
                </div>
                <div className="att-form-row">
                  <label>Status</label>
                  <select className="att-select w-full" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {(form.status === 'Present' || form.status === 'Half Day') && (<>
                  <div className="att-form-row">
                    <label>Check In</label>
                    <input type="time" className="att-input" value={form.checkIn} onChange={e => setForm(f => ({ ...f, checkIn: e.target.value }))} />
                  </div>
                  <div className="att-form-row">
                    <label>Check Out</label>
                    <input type="time" className="att-input" value={form.checkOut} onChange={e => setForm(f => ({ ...f, checkOut: e.target.value }))} />
                  </div>
                </>)}
                <div className="att-form-row">
                  <label>Remarks</label>
                  <input className="att-input" value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Optional" />
                </div>
              </div>
            ) : (
              <div className="att-modal-body">
                <div className="att-form-row">
                  <label>Date</label>
                  <input type="date" className="att-input" value={bulkDate} onChange={e => { setBulkDate(e.target.value); setBulkRecords(r => r.map(x => ({ ...x, attendanceDate: e.target.value }))); }} />
                </div>
                <div className="att-bulk-table-wrap">
                  <table className="att-table att-bulk-table">
                    <thead><tr><th>Employee</th><th>Status</th><th>Check In</th><th>Check Out</th></tr></thead>
                    <tbody>
                      {bulkRecords.map((r, i) => (
                        <tr key={r.employeeId}>
                          <td>{r.fullName}<br /><span style={{ fontSize: '0.72rem', opacity: 0.6 }}>{r.employeeNumber}</span></td>
                          <td>
                            <select className="att-select" value={r.status} onChange={e => setBulkRecords(br => br.map((x, j) => j === i ? { ...x, status: e.target.value } : x))}>
                              {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td><input type="time" className="att-input" value={r.checkIn} onChange={e => setBulkRecords(br => br.map((x, j) => j === i ? { ...x, checkIn: e.target.value } : x))} /></td>
                          <td><input type="time" className="att-input" value={r.checkOut} onChange={e => setBulkRecords(br => br.map((x, j) => j === i ? { ...x, checkOut: e.target.value } : x))} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="att-modal-footer">
              <button className="att-btn att-btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="att-btn att-btn-primary" disabled={saving} onClick={modalMode === 'single' ? handleSaveSingle : handleSaveBulk}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Leave Request ── */}
      {showLeaveModal && (
        <div className="att-modal-overlay" onClick={() => setShowLeaveModal(false)}>
          <div className="att-modal" onClick={e => e.stopPropagation()}>
            <div className="att-modal-header">
              <h3>New Leave Request</h3>
              <button className="att-modal-close" onClick={() => setShowLeaveModal(false)}>✕</button>
            </div>
            <div className="att-modal-body">
              <div className="att-form-row"><label>Employee</label>
                <select className="att-select w-full" value={leaveForm.employeeId} onChange={e => setLeaveForm(f => ({ ...f, employeeId: e.target.value }))}>
                  <option value="">Select Employee</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </select>
              </div>
              <div className="att-form-row"><label>Leave Type</label>
                <select className="att-select w-full" value={leaveForm.leaveType} onChange={e => setLeaveForm(f => ({ ...f, leaveType: e.target.value }))}>
                  {['Annual','Sick','Emergency','Unpaid'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="att-form-row"><label>Start Date</label><input type="date" className="att-input" value={leaveForm.startDate} onChange={e => setLeaveForm(f => ({ ...f, startDate: e.target.value }))} /></div>
              <div className="att-form-row"><label>End Date</label><input type="date" className="att-input" value={leaveForm.endDate} onChange={e => setLeaveForm(f => ({ ...f, endDate: e.target.value }))} /></div>
              <div className="att-form-row"><label>Reason</label><input className="att-input" placeholder="Optional reason..." value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} /></div>
            </div>
            <div className="att-modal-footer">
              <button className="att-btn att-btn-outline" onClick={() => setShowLeaveModal(false)}>Cancel</button>
              <button className="att-btn att-btn-primary" disabled={saving || !leaveForm.employeeId || !leaveForm.startDate || !leaveForm.endDate} onClick={handleSubmitLeave}>{saving ? 'Submitting...' : 'Submit Request'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CardDetailsForm({ checkIn, checkOut, remarks, showTime, onSave, isSaving }) {
  const [localCheckIn, setLocalCheckIn] = useState(checkIn);
  const [localCheckOut, setLocalCheckOut] = useState(checkOut);
  const [localRemarks, setLocalRemarks] = useState(remarks);

  useEffect(() => { setLocalCheckIn(checkIn || ''); }, [checkIn]);
  useEffect(() => { setLocalCheckOut(checkOut || ''); }, [checkOut]);
  useEffect(() => { setLocalRemarks(remarks || ''); }, [remarks]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      {showTime && (
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Check In</label>
            <input 
              type="time" 
              className="att-input" 
              style={{ padding: '6px 8px', fontSize: '0.8rem', minHeight: 'unset' }}
              value={localCheckIn} 
              onChange={e => setLocalCheckIn(e.target.value)} 
            />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Check Out</label>
            <input 
              type="time" 
              className="att-input" 
              style={{ padding: '6px 8px', fontSize: '0.8rem', minHeight: 'unset' }}
              value={localCheckOut} 
              onChange={e => setLocalCheckOut(e.target.value)} 
            />
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input 
          placeholder="Remarks/Notes" 
          className="att-input" 
          style={{ flex: 1, padding: '6px 12px', fontSize: '0.8rem', minHeight: 'unset' }}
          value={localRemarks} 
          onChange={e => setLocalRemarks(e.target.value)} 
        />
        <button 
          className="att-btn att-btn-primary" 
          style={{ padding: '6px 10px', borderRadius: 6, minHeight: 'unset' }} 
          title="Save Details"
          disabled={isSaving}
          onClick={() => onSave(localCheckIn, localCheckOut, localRemarks)}
        >
          <Check size={14} />
        </button>
      </div>
    </div>
  );
}
