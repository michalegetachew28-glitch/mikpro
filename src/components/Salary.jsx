import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  DollarSign, Users, CheckCircle, Clock, TrendingUp, BarChart2,
  Plus, RefreshCw, Download, Search, Lock, Unlock, CreditCard, Eye,
  Building2, Smartphone, Banknote, AlertCircle, X, User, Edit2, Trash2,
  Wallet, Receipt, Calendar, FileText, Send, RotateCcw, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { SkeletonStatsGrid, SkeletonListPage } from './SkeletonLoader';
import './Salary.css';

const STATUS_COLORS = {
  Pending: { bg: '#f59e0b20', text: '#f59e0b' },
  Approved: { bg: '#22c55e20', text: '#22c55e' },
  Paid: { bg: '#6366f120', text: '#6366f1' },
  Open: { bg: '#06b6d420', text: '#06b6d4' },
  Locked: { bg: '#f59e0b20', text: '#f59e0b' }
};

const ETHIOPIAN_BANKS = [
  'Commercial Bank of Ethiopia (CBE)',
  'Awash Bank',
  'Dashen Bank',
  'Bank of Abyssinia',
  'Wegagen Bank',
  'Nib International Bank',
  'Hibret Bank',
  'Cooperative Bank of Oromia',
  'Zemen Bank',
  'Oromia International Bank'
];

const ETHIOPIAN_MOBILE_PROVIDERS = [
  'Telebirr',
  'CBE Birr',
  'AwashBirr',
  'HelloCash'
];

function nameToColor(name = '') {
  const palette = [
    '#4361ee', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function getInitials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

export default function Salary() {
  const { showToast, isSyncing, isInitialLoadComplete } = useAppContext();
  const { currentUser } = useAuth();
  
  const userRole = currentUser?.role || 'mechanic';
  const isEmployee = userRole === 'mechanic' || userRole === 'manager';
  
  const [activeTab, setActiveTab] = useState(isEmployee ? 'my-salary' : 'dashboard');
  const [dashData, setDashData] = useState({});
  const [trend, setTrend] = useState([]);
  const [deptCosts, setDeptCosts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [calculations, setCalculations] = useState([]);
  const [payments, setPayments] = useState([]);
  const [structures, setStructures] = useState([]);
  const [loading, setLoading] = useState(false);

  // My Salary (Employee) states
  const [personalDash, setPersonalDash] = useState(null);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [bankForm, setBankForm] = useState({
    bankName: '',
    bankAccount: '',
    mobileBank: '',
    mobileAccount: ''
  });
  // My Salary — history filters
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [payHistoryDateFrom, setPayHistoryDateFrom] = useState('');
  const [payHistoryDateTo, setPayHistoryDateTo] = useState('');

  // Salary Payment tab state
  const [paymentEmployees, setPaymentEmployees] = useState([]);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState('all');

  // Side panel state (replaces the old dialog)
  const [showPaymentDialog, setShowPaymentDialog] = useState(null);
  const [payDialogMethod, setPayDialogMethod] = useState('Cash');
  const [payDialogReference, setPayDialogReference] = useState('');
  const [payDialogDate, setPayDialogDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [payDialogNotes, setPayDialogNotes] = useState('');
  const [dialogProcessing, setDialogProcessing] = useState(false);

  // Employee approval state
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approvalProcessing, setApprovalProcessing] = useState(false);

  // Payroll tab filters
  const [filterPeriod, setFilterPeriod] = useState('');
  const [searchCalc, setSearchCalc] = useState('');

  // Modals
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(null);
  const [showSlip, setShowSlip] = useState(null);

  const [periodForm, setPeriodForm] = useState({ periodName: '', salaryType: 'Monthly', startDate: '', endDate: '' });
  const [structureForm, setStructureForm] = useState({
    employeeId: '', baseSalary: '', absencePenaltyPerDay: '', latePenaltyPerOccurrence: ''
  });
  const [editingStructure, setEditingStructure] = useState(null);
  const [payForm, setPayForm] = useState({ paymentMethod: 'Cash', paymentReference: '', notes: '' });
  const [saving, setSaving] = useState(false);

  // Global load for admins & cashiers
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, t, dc, e, p, s, py] = await Promise.all([
        api.getPayrollDashboard(),
        api.getPayrollTrend(6),
        api.getDepartmentCosts(),
        api.getEmployees(),
        api.getSalaryPeriods(),
        api.getSalaryStructures(),
        api.getSalaryPayments()
      ]);
      setDashData(d);
      setTrend(t);
      setDeptCosts(dc);
      setEmployees(Array.isArray(e) ? e : []);
      setPeriods(Array.isArray(p) ? p : []);
      setStructures(Array.isArray(s) ? s : []);
      setPayments(Array.isArray(py) ? py : []);
    } catch (err) {
      showToast('Failed to load payroll data: ' + err.message, 'error');
    } finally { setLoading(false); }
  }, [showToast]);

  // Personal Load for Employees (Mechanic & Manager)
  const loadPersonalDashboard = useCallback(async () => {
    setPersonalLoading(true);
    try {
      const data = await api.getPersonalSalaryDashboard();
      setPersonalDash(data);
      if (data?.employee) {
        setBankForm({
          bankName: data.employee.bankName || '',
          bankAccount: data.employee.bankAccount || '',
          mobileBank: data.employee.mobileBank || '',
          mobileAccount: data.employee.mobileAccount || ''
        });
      }
    } catch (err) {
      showToast('Failed to load personal salary dashboard: ' + err.message, 'error');
    } finally {
      setPersonalLoading(false);
    }
  }, [showToast]);

  const loadPaymentEmployees = useCallback(async () => {
    setPaymentLoading(true);
    try {
      const data = await api.getPayableEmployees();
      setPaymentEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast('Failed to load employee payment data: ' + err.message, 'error');
    } finally { setPaymentLoading(false); }
  }, [showToast]);

  const loadCalcs = useCallback(async () => {
    if (!filterPeriod) { setCalculations([]); return; }
    try {
      const c = await api.getSalaryCalculations({ periodId: filterPeriod });
      setCalculations(Array.isArray(c) ? c : []);
    } catch (err) { showToast(err.message, 'error'); }
  }, [filterPeriod, showToast]);

  useEffect(() => {
    if (isEmployee) {
      loadPersonalDashboard();
    } else {
      load();
    }
  }, [isEmployee, load, loadPersonalDashboard]);

  useEffect(() => {
    if (!isEmployee) loadCalcs();
  }, [filterPeriod, loadCalcs, isEmployee]);

  useEffect(() => {
    if (!isEmployee && activeTab === 'salary-payment') loadPaymentEmployees();
  }, [activeTab, loadPaymentEmployees, isEmployee]);

  const handleGeneratePayroll = async () => {
    if (!filterPeriod) { showToast('Select a period first', 'warning'); return; }
    setSaving(true);
    try {
      const result = await api.generatePayroll(filterPeriod);
      showToast(`Generated ${result.generated} records${result.failed?.length ? `, ${result.failed.length} failed` : ''}`, 'success');
      loadCalcs();
      load();
    } catch (err) { showToast(err.message, 'error'); } finally { setSaving(false); }
  };

  const handleApprove = async (id) => {
    try { await api.approveSalaryCalc(id); showToast('Approved', 'success'); loadCalcs(); }
    catch (err) { showToast(err.message, 'error'); }
  };

  const handleReject = async (id) => {
    try { await api.rejectSalaryCalc(id, 'Rejected'); showToast('Rejected', 'info'); loadCalcs(); }
    catch (err) { showToast(err.message, 'error'); }
  };

  const handleLockPeriod = async (id) => {
    try { await api.lockSalaryPeriod(id); showToast('Period locked', 'success'); load(); }
    catch (err) { showToast(err.message, 'error'); }
  };

  const handleUnlockPeriod = async (id) => {
    try { await api.unlockSalaryPeriod(id); showToast('Period unlocked', 'success'); load(); }
    catch (err) { showToast(err.message, 'error'); }
  };

  const handleMarkPaid = async (id) => {
    try { await api.markSalaryPeriodPaid(id); showToast('Period marked as Paid', 'success'); load(); }
    catch (err) { showToast(err.message, 'error'); }
  };

  const handleCreatePeriod = async () => {
    setSaving(true);
    try {
      await api.createSalaryPeriod(periodForm);
      showToast('Period created', 'success');
      setShowPeriodModal(false);
      setPeriodForm({ periodName: '', salaryType: 'Monthly', startDate: '', endDate: '' });
      load();
    } catch (err) { showToast(err.message, 'error'); } finally { setSaving(false); }
  };

  const closeStructureModal = () => {
    setShowStructureModal(false);
    setEditingStructure(null);
    setStructureForm({ employeeId: '', baseSalary: '', absencePenaltyPerDay: '', latePenaltyPerOccurrence: '' });
  };

  const openEditStructure = (s) => {
    setEditingStructure(s);
    setStructureForm({
      employeeId: s.employeeId,
      baseSalary: String(s.baseSalary ?? ''),
      absencePenaltyPerDay: String(s.absencePenaltyPerDay ?? ''),
      latePenaltyPerOccurrence: String(s.latePenaltyPerOccurrence ?? '')
    });
    setShowStructureModal(true);
  };

  const handleSaveStructure = async () => {
    if (!structureForm.employeeId) { showToast('Please select an employee', 'warning'); return; }
    if (!structureForm.baseSalary || isNaN(Number(structureForm.baseSalary))) { showToast('Enter a valid Base Salary', 'warning'); return; }
    setSaving(true);
    try {
      const payload = {
        employeeId: structureForm.employeeId,
        baseSalary: parseFloat(structureForm.baseSalary) || 0,
        absencePenaltyPerDay: parseFloat(structureForm.absencePenaltyPerDay) || 0,
        latePenaltyPerOccurrence: parseFloat(structureForm.latePenaltyPerOccurrence) || 0
      };
      if (editingStructure) {
        await api.updateSalaryStructure(editingStructure.id, payload);
        showToast('Salary structure updated successfully', 'success');
      } else {
        await api.createSalaryStructure(payload);
        showToast('Salary structure saved successfully', 'success');
      }
      closeStructureModal();
      load();
    } catch (err) { showToast(err.message, 'error'); } finally { setSaving(false); }
  };

  const handleDeleteStructure = async (id) => {
    if (!window.confirm('Are you sure you want to delete this salary structure?')) return;
    try {
      await api.deleteSalaryStructure(id);
      showToast('Salary structure soft-deleted successfully', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handlePay = async () => {
    if (!showPayModal) return;
    setSaving(true);
    try {
      await api.createSalaryPayment({ salaryCalculationId: showPayModal.id, amount: showPayModal.netSalary, ...payForm });
      showToast('Payment recorded successfully', 'success');
      setShowPayModal(null);
      loadCalcs(); load();
    } catch (err) { showToast(err.message, 'error'); } finally { setSaving(false); }
  };

  const handleViewSlip = async (id) => {
    try { const slip = await api.getSalarySlip(id); setShowSlip(slip); }
    catch (err) { showToast(err.message, 'error'); }
  };

  const handleDialogPay = async () => {
    if (!showPaymentDialog) return;
    const dlgE = showPaymentDialog;
    const calc = dlgE.latestCalculation;
    if (calc && calc.status === 'Pending') { showToast('Salary must be Approved before payment', 'warning'); return; }
    setDialogProcessing(true);
    try {
      const payload = {
        amount: calc ? calc.netSalary : dlgE.baseSalary,
        paymentMethod: payDialogMethod,
        paymentReference: payDialogReference || undefined,
        paymentDate: payDialogDate || undefined,
        notes: payDialogNotes || undefined
      };
      if (calc) {
        payload.salaryCalculationId = calc.id;
      } else {
        payload.employeeId = dlgE.id;
      }
      await api.createSalaryPayment(payload);
      showToast(`✅ Payment processed for ${dlgE.fullName}`, 'success');
      setShowPaymentDialog(null);
      setPayDialogReference('');
      setPayDialogNotes('');
      setPayDialogDate(new Date().toISOString().split('T')[0]);
      await Promise.all([loadPaymentEmployees(), load()]);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDialogProcessing(false);
    }
  };

  const handleApprovePayment = async (paymentId) => {
    setApprovalProcessing(true);
    try {
      await api.approveSalaryPayment(paymentId);
      showToast('✅ Payment approved successfully!', 'success');
      loadPersonalDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setApprovalProcessing(false);
    }
  };

  const handleRejectPayment = async (paymentId) => {
    if (!rejectReason.trim()) { showToast('Please provide a reason for rejection', 'warning'); return; }
    setApprovalProcessing(true);
    try {
      await api.reportSalaryPaymentIssue(paymentId, rejectReason);
      showToast('Payment rejected. Admin has been notified.', 'info');
      setShowRejectBox(false);
      setRejectReason('');
      loadPersonalDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setApprovalProcessing(false);
    }
  };

  const openPaymentDialog = (emp) => {
    setShowPaymentDialog(emp);
    setPayDialogMethod('Cash');
    setPayDialogReference('');
    setPayDialogDate(new Date().toISOString().split('T')[0]);
    setPayDialogNotes('');
  };

  const printSlip = () => { window.print(); };

  const handleUpdateBankInfo = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updatePersonalBankInfo(bankForm);
      showToast('Banking details updated successfully', 'success');
      loadPersonalDashboard();
    } catch (err) {
      showToast('Failed to update banking details: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredCalcs = calculations.filter(c => {
    const name = c.employee?.fullName?.toLowerCase() || '';
    return !searchCalc || name.includes(searchCalc.toLowerCase()) || c.employee?.employeeNumber?.toLowerCase().includes(searchCalc.toLowerCase());
  });

  const filteredPaymentEmployees = paymentEmployees.filter(emp => {
    const matchSearch = !paymentSearch ||
      emp.fullName?.toLowerCase().includes(paymentSearch.toLowerCase()) ||
      emp.employeeNumber?.toLowerCase().includes(paymentSearch.toLowerCase()) ||
      emp.department?.toLowerCase().includes(paymentSearch.toLowerCase());
    const cs = emp.cardStatus || 'idle';
    const matchFilter =
      paymentFilter === 'all' ||
      (paymentFilter === 'payable'          && cs === 'payable') ||
      (paymentFilter === 'processing'       && cs === 'processing') ||
      (paymentFilter === 'waiting_approval' && cs === 'waiting_approval') ||
      (paymentFilter === 'paid'             && cs === 'paid') ||
      (paymentFilter === 'rejected'         && cs === 'rejected');
    return matchSearch && matchFilter;
  });

  const payTotal = paymentEmployees.length;
  const payPaid = paymentEmployees.filter(e => e.cardStatus === 'paid').length;
  const payPayable = paymentEmployees.filter(e => e.cardStatus === 'payable').length;
  const payProcessing = paymentEmployees.filter(e => e.cardStatus === 'processing' || e.cardStatus === 'waiting_approval').length;
  const payTotalETB = paymentEmployees
    .filter(e => e.cardStatus === 'paid')
    .reduce((s, e) => s + (e.latestCalculation?.netSalary || 0), 0);
  const payPayableETB = paymentEmployees
    .filter(e => e.cardStatus === 'payable')
    .reduce((s, e) => s + (e.latestCalculation?.netSalary || 0), 0);
  const payProcessingETB = paymentEmployees
    .filter(e => e.cardStatus === 'processing' || e.cardStatus === 'waiting_approval')
    .reduce((s, e) => s + (e.latestCalculation?.netSalary || 0), 0);

  const maxTrend = Math.max(...trend.map(t => t.total), 1);
  const maxDept = Math.max(...deptCosts.map(d => d.total), 1);

  const dlgEmp = showPaymentDialog;
  const hasBank = dlgEmp && (dlgEmp.bankName || dlgEmp.bankAccount);
  const hasMobile = dlgEmp && (dlgEmp.mobileBank || dlgEmp.mobileAccount);
  const hasAnyAccount = hasBank || hasMobile;

  const CARD_STATUS_BADGE = {
    payable:        { cls: 'payable',    label: 'Payable' },
    processing:     { cls: 'processing', label: 'Processing' },
    waiting_approval: { cls: 'waiting',  label: 'Awaiting Approval' },
    paid:           { cls: 'paid',       label: 'Paid' },
    rejected:       { cls: 'rejected',   label: 'Rejected' },
    idle:           { cls: 'payable',    label: 'Payable' },
  };

  // 1. Mechanic / Manager Dashboard view
  if (isEmployee) {
    if (personalLoading || !personalDash || (isSyncing && !isInitialLoadComplete)) {
      return (
        <div className="salary-page">
          <SkeletonStatsGrid count={5} />
          <SkeletonListPage rows={5} cols={6} />
        </div>
      );
    }

    const { employee, baseSalary, totalPaid, pendingSalary, lastPayment, nextPayment, totalBonuses, totalDeductions, salaryHistory, paymentHistory } = personalDash;

    // Filter salary history
    const filteredSalaryHistory = (salaryHistory || []).filter(c => {
      const matchStatus = historyStatusFilter === 'all' || c.status === historyStatusFilter;
      const calcDate = c.calculatedAt || c.createdAt;
      const matchFrom = !historyDateFrom || (calcDate && calcDate >= historyDateFrom);
      const matchTo   = !historyDateTo   || (calcDate && calcDate.slice(0,10) <= historyDateTo);
      return matchStatus && matchFrom && matchTo;
    });

    // Filter payment history
    const filteredPayHistory = (paymentHistory || []).filter(p => {
      const d = p.paymentDate?.slice(0,10);
      const matchFrom = !payHistoryDateFrom || (d && d >= payHistoryDateFrom);
      const matchTo   = !payHistoryDateTo   || (d && d <= payHistoryDateTo);
      return matchFrom && matchTo;
    });

    return (
      <div className="salary-page">
        <div className="salary-header">
          <div>
            <h1 className="salary-title">My Salary</h1>
            <p className="salary-sub">{employee.fullName} &middot; {employee.employeeNumber} &middot; {employee.department}</p>
          </div>
          <button className="sal-btn sal-btn-outline" onClick={loadPersonalDashboard}><RefreshCw size={15} /> Refresh</button>
        </div>

        {/* Summary cards */}
        <div className="sal-cards">
          {[
            { label: 'Current Base Salary',      value: `ETB ${(baseSalary||0).toLocaleString()}`,      color: '#4361ee' },
            { label: 'Total Paid to Date',        value: `ETB ${(totalPaid||0).toLocaleString()}`,       color: '#22c55e' },
            { label: 'Pending / Approved',        value: `ETB ${(pendingSalary||0).toLocaleString()}`,   color: '#f59e0b' },
            { label: 'Total Bonuses',             value: `ETB ${(totalBonuses||0).toLocaleString()}`,    color: '#ec4899' },
            { label: 'Total Deductions',          value: `ETB ${(totalDeductions||0).toLocaleString()}`, color: '#ef4444' }
          ].map(c => (
            <div key={c.label} className="sal-card" style={{ borderTop: `3px solid ${c.color}` }}>
              <div className="sal-card-body">
                <div className="sal-card-value">{c.value}</div>
                <div className="sal-card-label">{c.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Payout alert banners */}
        {/* Payout alert banners: pending approval */}
        {(() => {
          const pendingPayment = (paymentHistory || []).find(
            p => p.status === 'Processing' || p.status === 'Waiting for Employee Approval'
          );
          if (!pendingPayment) return null;
          const isWaiting = pendingPayment.status === 'Waiting for Employee Approval';
          const bannerCls = isWaiting ? 'waiting' : 'processing';
          return (
            <div className={`sp-approval-banner ${bannerCls}`}>
              <div className={`sp-banner-title ${bannerCls}`}>
                {isWaiting ? <ThumbsUp size={18} /> : <Send size={18} />}
                {isWaiting ? 'Action Required: Approve or Reject Your Salary Payment' : 'Salary Payment Processing'}
              </div>
              <div className="sp-banner-details">
                <div className="sp-banner-detail-item">
                  <span className="sp-banner-detail-label">Amount</span>
                  <span className="sp-banner-detail-value">ETB {pendingPayment.amount?.toLocaleString()}</span>
                </div>
                <div className="sp-banner-detail-item">
                  <span className="sp-banner-detail-label">Method</span>
                  <span className="sp-banner-detail-value">{pendingPayment.paymentMethod}</span>
                </div>
                <div className="sp-banner-detail-item">
                  <span className="sp-banner-detail-label">Receipt #</span>
                  <span className="sp-banner-detail-value" style={{fontFamily:'monospace',fontSize:'0.82rem'}}>{pendingPayment.receiptNumber}</span>
                </div>
              </div>
              {pendingPayment.notes && (
                <div style={{fontSize:'0.82rem',opacity:0.7}}>Note: {pendingPayment.notes}</div>
              )}
              {isWaiting && (
                <div className="sp-banner-actions">
                  <button
                    className="sp-banner-approve-btn"
                    onClick={() => handleApprovePayment(pendingPayment.id)}
                    disabled={approvalProcessing}
                  >
                    <ThumbsUp size={15} />
                    {approvalProcessing ? 'Processing...' : 'Approve Payment'}
                  </button>
                  <button
                    className="sp-banner-reject-btn"
                    onClick={() => setShowRejectBox(prev => !prev)}
                    disabled={approvalProcessing}
                  >
                    <ThumbsDown size={15} /> Reject / Report Issue
                  </button>
                </div>
              )}
              {showRejectBox && isWaiting && (
                <div className="sp-reject-reason-box">
                  <label>Reason for rejection (required)</label>
                  <textarea
                    placeholder="Describe the issue with this payment..."
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    rows={3}
                  />
                  <div style={{display:'flex',gap:8}}>
                    <button
                      className="sp-reject-reason-submit"
                      onClick={() => handleRejectPayment(pendingPayment.id)}
                      disabled={approvalProcessing}
                    >
                      {approvalProcessing ? 'Submitting...' : 'Confirm Rejection'}
                    </button>
                    <button
                      style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-secondary)',fontSize:'0.85rem',fontFamily:'inherit'}}
                      onClick={() => { setShowRejectBox(false); setRejectReason(''); }}
                    >Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Main two-column grid — stacks on mobile via CSS class */}
        <div className="my-salary-grid">
          {/* LEFT: History tables */}
          <div>
            {/* === Payroll Slips === */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <h3 className="sal-section-title" style={{ margin: 0 }}>My Payroll Slips</h3>
            </div>

            {/* Slip filters */}
            <div className="my-sal-filter-bar">
              <div className="my-sal-filter-pills">
                {[['all','All'],['Pending','Pending'],['Approved','Approved'],['Paid','Paid']].map(([k,l]) => (
                  <button
                    key={k}
                    className={`sal-pay-pill ${historyStatusFilter === k ? 'active' : ''}`}
                    onClick={() => setHistoryStatusFilter(k)}
                  >{l}</button>
                ))}
              </div>
              <div className="my-sal-date-range">
                <input
                  type="date"
                  className="sal-input"
                  style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                  value={historyDateFrom}
                  onChange={e => setHistoryDateFrom(e.target.value)}
                  title="From date"
                />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>–</span>
                <input
                  type="date"
                  className="sal-input"
                  style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                  value={historyDateTo}
                  onChange={e => setHistoryDateTo(e.target.value)}
                  title="To date"
                />
                {(historyDateFrom || historyDateTo || historyStatusFilter !== 'all') && (
                  <button
                    className="sal-btn sal-btn-xs sal-btn-outline"
                    onClick={() => { setHistoryDateFrom(''); setHistoryDateTo(''); setHistoryStatusFilter('all'); }}
                  >Clear</button>
                )}
              </div>
            </div>

            <div className="sal-table-wrap">
              <table className="sal-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Base</th>
                    <th>Gross</th>
                    <th>Deductions</th>
                    <th>Net Salary</th>
                    <th>Status</th>
                    <th>Slip</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSalaryHistory.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', opacity: 0.5, padding: 20 }}>No records match your filters</td></tr>
                  ) : filteredSalaryHistory.map(c => (
                    <tr key={c.id}>
                      <td data-label="Period"><strong>{c.salaryPeriod?.periodName}</strong></td>
                      <td data-label="Base">ETB {c.baseSalary?.toLocaleString()}</td>
                      <td data-label="Gross">ETB {c.grossSalary?.toLocaleString()}</td>
                      <td data-label="Deductions" style={{ color: '#ef4444' }}>ETB {c.totalDeduction?.toLocaleString()}</td>
                      <td data-label="Net" style={{ fontWeight: 700, color: 'var(--primary)' }}>ETB {c.netSalary?.toLocaleString()}</td>
                      <td data-label="Status">
                        <span className="sal-badge" style={{ background: STATUS_COLORS[c.status]?.bg, color: STATUS_COLORS[c.status]?.text }}>{c.status}</span>
                      </td>
                      <td data-label="Slip">
                        <button className="sal-btn sal-btn-xs sal-btn-outline" onClick={() => handleViewSlip(c.id)}><Eye size={12} /> View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* === Received Payments === */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 28, marginBottom: 8 }}>
              <h3 className="sal-section-title" style={{ margin: 0 }}>My Received Payments</h3>
            </div>

            {/* Payment filters */}
            <div className="my-sal-filter-bar">
              <div className="my-sal-date-range">
                <input
                  type="date"
                  className="sal-input"
                  style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                  value={payHistoryDateFrom}
                  onChange={e => setPayHistoryDateFrom(e.target.value)}
                  title="From date"
                />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>–</span>
                <input
                  type="date"
                  className="sal-input"
                  style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                  value={payHistoryDateTo}
                  onChange={e => setPayHistoryDateTo(e.target.value)}
                  title="To date"
                />
                {(payHistoryDateFrom || payHistoryDateTo) && (
                  <button
                    className="sal-btn sal-btn-xs sal-btn-outline"
                    onClick={() => { setPayHistoryDateFrom(''); setPayHistoryDateTo(''); }}
                  >Clear</button>
                )}
              </div>
            </div>

            <div className="sal-table-wrap">
              <table className="sal-table">
                <thead>
                  <tr>
                    <th>Receipt</th>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayHistory.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', opacity: 0.5, padding: 20 }}>No payments in this date range</td></tr>
                  ) : filteredPayHistory.map(p => (
                    <tr key={p.id}>
                      <td data-label="Receipt" style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{p.receiptNumber}</td>
                      <td data-label="Date">{p.paymentDate?.split('T')[0]}</td>
                      <td data-label="Method">{p.paymentMethod}</td>
                      <td data-label="Amount" style={{ color: '#22c55e', fontWeight: 600 }}>ETB {p.amount?.toLocaleString()}</td>
                      <td data-label="Notes">{p.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT: Banking form */}
          <div>
            <div className="sal-chart-card">
              <h3 className="sal-section-title"><Building2 size={16} /> My Payment Accounts</h3>
              <p style={{ fontSize: '0.82rem', opacity: 0.7, marginBottom: 20 }}>
                These details are used by Admin &amp; Cashier to process bank / mobile transfers.
              </p>
              <form onSubmit={handleUpdateBankInfo}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="sal-form-row">
                    <label>Bank Name</label>
                    <select className="sal-select w-full" value={bankForm.bankName} onChange={e => setBankForm(f => ({ ...f, bankName: e.target.value }))}>
                      <option value="">No Bank Account</option>
                      {ETHIOPIAN_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="sal-form-row">
                    <label>Account Number</label>
                    <input className="sal-input w-full" placeholder="e.g. 1000234567899" value={bankForm.bankAccount} onChange={e => setBankForm(f => ({ ...f, bankAccount: e.target.value }))} />
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                  <div className="sal-form-row">
                    <label>Mobile Banking Provider</label>
                    <select className="sal-select w-full" value={bankForm.mobileBank} onChange={e => setBankForm(f => ({ ...f, mobileBank: e.target.value }))}>
                      <option value="">No Mobile Money</option>
                      {ETHIOPIAN_MOBILE_PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="sal-form-row">
                    <label>Registered Mobile Number</label>
                    <input className="sal-input w-full" placeholder="e.g. +251911234567" value={bankForm.mobileAccount} onChange={e => setBankForm(f => ({ ...f, mobileAccount: e.target.value }))} />
                  </div>
                  <button className="sal-btn sal-btn-primary" style={{ marginTop: 6 }} type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Update Banking Profile'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {showSlip && renderSlipModal()}
      </div>
    );
  }

  // 2. Admin / Cashier Dashboard and Tabs rendering
  const showStructuresTab = userRole === 'admin' || userRole === 'coder';

  if ((loading && employees.length === 0) || (isSyncing && !isInitialLoadComplete)) {
    return <SkeletonListPage rows={6} cols={6} />;
  }

  return (
    <div className="salary-page">
      {/* Header */}
      <div className="salary-header">
        <div>
          <h1 className="salary-title">Payroll System</h1>
          <p className="salary-sub">Process payment and sync employee calculations</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="sal-btn sal-btn-outline" onClick={load}><RefreshCw size={15} /> Refresh</button>
          {showStructuresTab && (
            <>
              <button className="sal-btn sal-btn-secondary" onClick={() => setShowStructureModal(true)}><Plus size={15} /> Salary Structure</button>
              <button className="sal-btn sal-btn-primary" onClick={() => setShowPeriodModal(true)}><Plus size={15} /> New Period</button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="sal-tabs">
        {[
          ['dashboard', 'Dashboard'],
          ['payments', 'Payments'],
          showStructuresTab ? ['structures', 'Salary Structures'] : null,
          ['salary-payment', '💳 Salary Payments']
        ].filter(Boolean).map(([k, l]) => (
          <button key={k} className={`sal-tab ${activeTab === k ? 'active' : ''}`} onClick={() => setActiveTab(k)}>{l}</button>
        ))}
      </div>

      {/* Dashboard cards */}
      {activeTab === 'dashboard' && (
        <>
          <div className="sal-cards">
            {[
              { label: 'Total Employees', value: dashData.totalEmployees || 0, icon: <Users size={22} />, color: '#4361ee' },
              { label: 'Monthly Payroll', value: `ETB ${(dashData.monthlyPayrollCost || 0).toLocaleString()}`, icon: <DollarSign size={22} />, color: '#22c55e' },
              { label: 'Paid Salaries', value: `ETB ${(dashData.totalSalaryPaid || 0).toLocaleString()}`, icon: <CreditCard size={22} />, color: '#6366f1' },
              { label: 'Pending Payments', value: `ETB ${(dashData.pendingPayments || 0).toLocaleString()}`, icon: <Clock size={22} />, color: '#f59e0b' },
              { label: 'Approved PayrollsCount', value: dashData.approvedPayroll || 0, icon: <CheckCircle size={22} />, color: '#06b6d4' },
              { label: 'Paid PayrollsCount', value: dashData.paidPayroll || 0, icon: <TrendingUp size={22} />, color: '#8b5cf6' },
              { label: 'Total Bonuses Distributed', value: `ETB ${(dashData.totalBonuses || 0).toLocaleString()}`, icon: <TrendingUp size={22} />, color: '#ec4899' },
              { label: 'Total Deductions', value: `ETB ${(dashData.totalDeductions || 0).toLocaleString()}`, icon: <AlertCircle size={22} />, color: '#ef4444' }
            ].map(card => (
              <div key={card.label} className="sal-card" style={{ borderTop: `3px solid ${card.color}` }}>
                <div className="sal-card-icon" style={{ background: card.color + '20', color: card.color }}>{card.icon}</div>
                <div className="sal-card-body">
                  <div className="sal-card-value">{loading ? '—' : card.value}</div>
                  <div className="sal-card-label">{card.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24 }}>
            {/* Trend */}
            <div className="sal-chart-card">
              <h3 className="sal-section-title">6-Month Payroll Cost Trends</h3>
              <div className="sal-bar-chart">
                {trend.map((t, i) => (
                  <div key={i} className="sal-bar-group">
                    <div className="sal-bar" style={{ height: `${(t.total / maxTrend) * 100}%` }} title={`ETB ${t.total?.toLocaleString()}`} />
                    <div className="sal-bar-label">{t.month?.split(' ')[0]}</div>
                    <div className="sal-bar-val">ETB {(t.total / 1000).toFixed(0)}k</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Department */}
            <div className="sal-chart-card">
              <h3 className="sal-section-title">Department Salaries Cost Distribution</h3>
              {deptCosts.length === 0 ? (
                <div style={{ opacity: 0.4, textAlign: 'center', paddingTop: 40 }}>No breakdown data</div>
              ) : deptCosts.map((d, i) => (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.85rem' }}>
                    <span>{d.department}</span><span style={{ fontWeight: 700 }}>ETB {d.total?.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--border)', borderRadius: 4 }}>
                    <div style={{ height: '100%', background: '#4361ee', borderRadius: 4, width: `${(d.total / maxDept) * 100}%`, transition: 'width 0.6s' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Payroll calculations tab */}
      {activeTab === 'payroll' && (
        <div className="sal-section">
          <div className="sal-payroll-toolbar">
            <select className="sal-select" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
              <option value="">Select Period</option>
              {periods.map(p => <option key={p.id} value={p.id}>{p.periodName} ({p.status})</option>)}
            </select>
            <div className="sal-search">
              <Search size={14} />
              <input placeholder="Search employee..." value={searchCalc} onChange={e => setSearchCalc(e.target.value)} />
            </div>
            
            {/* Generate options */}
            {filterPeriod && (
              <button className="sal-btn sal-btn-primary" onClick={handleGeneratePayroll} disabled={saving}><TrendingUp size={15} /> {saving ? 'Processing...' : 'Run Calculations'}</button>
            )}

            {/* Admin options lock / unlock / mark paid */}
            {filterPeriod && (userRole === 'admin' || userRole === 'coder') && (
              <>
                {periods.find(p => p.id === filterPeriod)?.status === 'Locked' ? (
                  <button className="sal-btn sal-btn-outline" onClick={() => handleUnlockPeriod(filterPeriod)}><Unlock size={14} /> Unlock Period</button>
                ) : (
                  <button className="sal-btn sal-btn-outline" onClick={() => handleLockPeriod(filterPeriod)}><Lock size={14} /> Lock Period</button>
                )}
                {periods.find(p => p.id === filterPeriod)?.status !== 'Paid' && (
                  <button className="sal-btn sal-btn-secondary" onClick={() => handleMarkPaid(filterPeriod)}><CreditCard size={14} /> Mark Paid</button>
                )}
              </>
            )}
          </div>

          <div className="sal-periods-row">
            {periods.slice(0, 6).map(p => (
              <div key={p.id} className={`sal-period-chip ${filterPeriod === p.id ? 'active' : ''}`} onClick={() => setFilterPeriod(p.id)}>
                <strong>{p.periodName}</strong>
                <span className="sal-badge" style={{ background: STATUS_COLORS[p.status]?.bg, color: STATUS_COLORS[p.status]?.text }}>{p.status}</span>
              </div>
            ))}
          </div>

          <div className="sal-table-wrap">
            <table className="sal-table">
              <thead>
                <tr>
                  <th>Employee</th><th>Base</th><th>Gross</th><th>Deductions</th><th>Net Salary</th>
                  <th>Present</th><th>Absent</th><th>Late Occurrences</th><th>Excused</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!filterPeriod ? (
                  <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, opacity: 0.4 }}>Select a salary period to view payroll calculations</td></tr>
                ) : filteredCalcs.length === 0 ? (
                  <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, opacity: 0.4 }}>No calculations found. Click "Run Calculations" to compile.</td></tr>
                ) : filteredCalcs.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.employee?.fullName}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{c.employee?.employeeNumber} · {c.employee?.department}</div>
                    </td>
                    <td>ETB {c.baseSalary?.toLocaleString()}</td>
                    <td style={{ color: '#22c55e', fontWeight: 600 }}>ETB {c.grossSalary?.toLocaleString()}</td>
                    <td style={{ color: '#ef4444' }}>ETB {c.totalDeduction?.toLocaleString()}</td>
                    <td style={{ fontWeight: 700, color: '#4361ee' }}>ETB {c.netSalary?.toLocaleString()}</td>
                    <td>{c.presentDays}/{c.workingDays}</td>
                    <td style={{ color: c.absentDays > 0 ? '#ef4444' : 'inherit' }}>{c.absentDays}d</td>
                    <td style={{ color: c.lateDeduction > 0 ? '#f59e0b' : 'inherit' }}>{Math.round(c.lateDeduction / (structures.find(s => s.employeeId === c.employeeId)?.latePenaltyPerOccurrence || 1))} occ</td>
                    <td style={{ color: c.leaveDays > 0 ? '#6366f1' : 'inherit' }}>{c.leaveDays}d</td>
                    <td>
                      <span className="sal-badge" style={{ background: STATUS_COLORS[c.status]?.bg, color: STATUS_COLORS[c.status]?.text }}>{c.status}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <button className="sal-btn sal-btn-xs sal-btn-outline" onClick={() => handleViewSlip(c.id)}><Eye size={12} /></button>
                        {c.status === 'Pending' && (userRole === 'admin' || userRole === 'coder') && (
                          <>
                            <button className="sal-btn sal-btn-xs sal-btn-success" onClick={() => handleApprove(c.id)}>Approve</button>
                            <button className="sal-btn sal-btn-xs sal-btn-danger" onClick={() => handleReject(c.id)}>Reject</button>
                          </>
                        )}
                        {c.status === 'Approved' && (
                          <button className="sal-btn sal-btn-xs sal-btn-primary" onClick={() => { setShowPayModal(c); setPayForm({ paymentMethod: 'Cash', paymentReference: '', notes: '' }); }}><CreditCard size={12} /> Pay</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Global payments tab */}
      {activeTab === 'payments' && (
        <div className="sal-section">
          <div className="sal-table-wrap">
            <table className="sal-table">
              <thead>
                <tr><th>Employee</th><th>Period</th><th>Method</th><th>Amount</th><th>Receipt</th><th>Date</th><th>Notes</th></tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, opacity: 0.4 }}>No payments registered yet</td></tr>
                ) : payments.map(p => (
                  <tr key={p.id}>
                    <td><div style={{ fontWeight: 600 }}>{p.employee?.fullName}</div><div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{p.employee?.employeeNumber}</div></td>
                    <td>{p.salaryCalculation?.salaryPeriod?.periodName || '—'}</td>
                    <td>{p.paymentMethod}</td>
                    <td style={{ fontWeight: 700, color: '#22c55e' }}>ETB {p.amount?.toLocaleString()}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.receiptNumber}</td>
                    <td>{p.paymentDate?.split('T')[0]}</td>
                    <td style={{ opacity: 0.6, fontSize: '0.82rem' }}>{p.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Salary Structures tab */}
      {activeTab === 'structures' && showStructuresTab && (
        <div className="sal-section">
          <div style={{ marginBottom: 16 }}>
            <button className="sal-btn sal-btn-primary" onClick={() => { setEditingStructure(null); setStructureForm({ employeeId: '', baseSalary: '', absencePenaltyPerDay: '', latePenaltyPerOccurrence: '' }); setShowStructureModal(true); }}><Plus size={15} /> Add Salary Structure</button>
          </div>
          <div className="sal-table-wrap">
            <table className="sal-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Base Salary (ETB)</th>
                  <th>Absent Deduction (ETB/day)</th>
                  <th>Late Deduction (ETB/occurrence)</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {structures.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, opacity: 0.4 }}>No salary structures configured</td></tr>
                ) : structures.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.employee?.fullName}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{s.employee?.employeeNumber}</div>
                    </td>
                    <td style={{ fontWeight: 600, color: '#4361ee' }}>ETB {(s.baseSalary || 0).toLocaleString()}</td>
                    <td style={{ color: '#ef4444' }}>ETB {(s.absencePenaltyPerDay || 0).toLocaleString()}<span style={{ opacity: 0.5, fontSize: '0.75rem' }}>/day</span></td>
                    <td style={{ color: '#f59e0b' }}>ETB {(s.latePenaltyPerOccurrence || 0).toLocaleString()}<span style={{ opacity: 0.5, fontSize: '0.75rem' }}>/occurrence</span></td>
                    <td>{s.active ? <span style={{ color: '#22c55e', fontWeight: 700 }}>✓ Active</span> : <span style={{ opacity: 0.4 }}>Inactive</span>}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="sal-btn sal-btn-xs sal-btn-outline"
                          onClick={() => openEditStructure(s)}
                        >
                          <Edit2 size={13} /> Edit
                        </button>
                        <button
                          className="sal-btn sal-btn-xs sal-btn-danger"
                          style={{ background: '#ef444420', color: '#ef4444' }}
                          onClick={() => handleDeleteStructure(s.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SALARY PAYMENT TAB ── */}
      {activeTab === 'salary-payment' && (
        <div className="sal-section">
          {/* ── 4 Summary Cards ── */}
          <div className="sal-pay-stats-bar">
            {[
              {
                label: 'Total Employees',
                value: payTotal,
                etb: `${paymentEmployees.length} staff`,
                icon: <Users size={18} />,
                color: '#4361ee'
              },
              {
                label: 'Salary Payable',
                value: payPayable,
                etb: `ETB ${payPayableETB.toLocaleString()}`,
                icon: <Wallet size={18} />,
                color: '#f59e0b'
              },
              {
                label: 'Salary Paid',
                value: payPaid,
                etb: `ETB ${payTotalETB.toLocaleString()}`,
                icon: <CheckCircle size={18} />,
                color: '#22c55e'
              },
              {
                label: 'Processing',
                value: payProcessing,
                etb: `ETB ${payProcessingETB.toLocaleString()}`,
                icon: <Clock size={18} />,
                color: '#8b5cf6'
              },
            ].map(s => (
              <div key={s.label} className="sal-pay-stat-box" style={{ borderLeft: `4px solid ${s.color}` }}>
                <div className="sal-pay-stat-icon" style={{ color: s.color, background: s.color + '18' }}>{s.icon}</div>
                <div>
                  <div className="sal-pay-stat-value" style={{ color: s.color }}>{paymentLoading ? '—' : s.value}</div>
                  <div className="sal-pay-stat-label">{s.label}</div>
                  <div className="sal-pay-stat-etb">{paymentLoading ? '' : s.etb}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Toolbar ── */}
          <div className="sal-pay-toolbar">
            <div className="sal-search" style={{ flex: 1, minWidth: 220 }}>
              <Search size={14} />
              <input
                placeholder="Search name, ID, or department..."
                value={paymentSearch}
                onChange={e => setPaymentSearch(e.target.value)}
              />
            </div>
            <select
              className="sal-pay-select-filter"
              value={paymentFilter}
              onChange={e => setPaymentFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="payable">Payable</option>
              <option value="processing">Processing</option>
              <option value="waiting_approval">Pending Approval</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
            </select>
            <button className="sal-btn sal-btn-outline" onClick={loadPaymentEmployees} disabled={paymentLoading}>
              <RefreshCw size={14} style={{ animation: paymentLoading ? 'spin 1s linear infinite' : 'none' }} />
              {paymentLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {/* ── Card Grid Workspace ── */}
          <div className="sal-pay-workspace">
            <div className="sal-pay-workspace-left">
              {paymentLoading ? (
                <div className="sal-pay-loading">
                  {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="sal-pay-skeleton" />)}
                </div>
              ) : filteredPaymentEmployees.length === 0 ? (
                <div className="sal-pay-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', color: 'var(--text-secondary)', gap: '10px', textAlign: 'center' }}>
                  <Users size={48} style={{ opacity: 0.3 }} />
                  <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>No employees matching filters</p>
                  <span style={{ fontSize: '0.85rem', opacity: 0.6 }}>Try changing the search term or status filter</span>
                </div>
              ) : (
                <div className="sal-pay-grid">
                  {filteredPaymentEmployees.map(emp => {
                    const calc = emp.latestCalculation;
                    const lastPay = calc?.latestPayment;
                    const cardStatus = emp.cardStatus || 'idle';
                    const badge = CARD_STATUS_BADGE[cardStatus] || CARD_STATUS_BADGE.idle;
                    const avatarColor = nameToColor(emp.fullName);
                    const initials = getInitials(emp.fullName);

                    return (
                      <div key={emp.id} className={`sal-pay-card state-${cardStatus}`}>
                        <div className="sal-pay-card-main-info">
                          <div className="sal-pay-card-left">
                            <div className="sal-pay-card-avatar-wrap">
                              <div className="sal-pay-card-avatar" style={{ background: avatarColor }}>{initials}</div>
                              <span className={`sal-pay-card-avatar-dot ${cardStatus === 'idle' ? 'inactive' : ''}`} />
                            </div>
                            <div className="sal-pay-card-meta">
                              <div className="sal-pay-card-name">{emp.fullName}</div>
                              <div className="sal-pay-card-id">{emp.employeeNumber}</div>
                              <div className="sal-pay-card-role">{emp.department || 'General Staff'}</div>
                            </div>
                          </div>

                          <div className="sal-pay-card-salary-block">
                            <span className="sal-pay-card-salary-label">Net Salary</span>
                            <span className="sal-pay-card-salary-value">
                              {calc ? `ETB ${calc.netSalary?.toLocaleString()}` : `ETB ${emp.baseSalary?.toLocaleString()}`}
                            </span>
                            {calc?.periodName && (
                              <div className="sal-pay-card-period"><Clock size={11} /> {calc.periodName}</div>
                            )}
                          </div>

                          <div className="sal-pay-card-right">
                            <span className={`sp-badge ${badge.cls}`}>
                              <span className="sp-badge-dot" />
                              {badge.label}
                            </span>
                            
                            {cardStatus === 'payable' && (
                              <button className="sal-pay-btn-action btn-blue" onClick={() => openPaymentDialog(emp)}>
                                <CreditCard size={13} /> Process Payment
                              </button>
                            )}
                            {cardStatus === 'processing' && (
                              <button className="sal-pay-btn-action btn-dark" onClick={() => openPaymentDialog(emp)}>
                                <Eye size={13} /> View Payment
                              </button>
                            )}
                            {cardStatus === 'waiting_approval' && (
                              <button className="sal-pay-btn-action btn-dark" onClick={() => openPaymentDialog(emp)}>
                                <Eye size={13} /> View Payment
                              </button>
                            )}
                            {cardStatus === 'paid' && (
                              <button className="sal-pay-btn-action btn-green-outline" onClick={() => openPaymentDialog(emp)}>
                                <FileText size={13} /> View Receipt
                              </button>
                            )}
                            {cardStatus === 'rejected' && (
                              <button className="sal-pay-btn-action btn-red-outline" onClick={() => openPaymentDialog(emp)}>
                                <RotateCcw size={13} /> Reprocess Payment
                              </button>
                            )}
                            {cardStatus === 'idle' && (
                              <button className="sal-pay-btn-action btn-blue" onClick={() => openPaymentDialog(emp)}>
                                <CreditCard size={13} /> Process Payment
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Card bottom row bar */}
                        <div className="sal-pay-card-bottom-bar">
                          <div className="sal-pay-card-bottom-col">
                            <span className="sal-pay-card-bottom-label">Payment Method</span>
                            <span className="sal-pay-card-bottom-value">
                              {lastPay ? lastPay.paymentMethod : '—'}
                            </span>
                          </div>
                          
                          <div className="sal-pay-card-bottom-col">
                            <span className="sal-pay-card-bottom-label">Payment Status</span>
                            {cardStatus === 'paid' && <span className="sal-pay-card-bottom-value approved">Approved</span>}
                            {cardStatus === 'waiting_approval' && <span className="sal-pay-card-bottom-value waiting">Waiting Approval</span>}
                            {cardStatus === 'processing' && <span className="sal-pay-card-bottom-value processing">Processing</span>}
                            {cardStatus === 'rejected' && <span className="sal-pay-card-bottom-value rejected">Rejected</span>}
                            {cardStatus === 'payable' && <span className="sal-pay-card-bottom-value not-paid">Not Paid</span>}
                            {cardStatus === 'idle' && <span className="sal-pay-card-bottom-value not-paid">—</span>}
                          </div>

                          {cardStatus === 'paid' && lastPay?.paymentDate && (
                            <div className="sal-pay-card-paid-date">
                              Paid On: {lastPay.paymentDate?.split('T')[0]}
                            </div>
                          )}
                          {cardStatus === 'rejected' && lastPay?.issueReason && (
                            <div className="sp-rejected-note" style={{ margin: 0 }}>
                              ⚠ {lastPay.issueReason}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Stepped workflow timeline footer ── */}
              <div className="sal-pay-workflow-footer">
                <h4 className="sal-pay-workflow-title">Payment Workflow</h4>
                <div className="sal-pay-workflow-steps">
                  <div className="sal-pay-workflow-step">
                    <div className="sal-pay-workflow-step-num">1</div>
                    <div className="sal-pay-workflow-step-info">
                      <div className="sal-pay-workflow-step-title">Admin Processes</div>
                      <div className="sal-pay-workflow-step-desc">Payment initiated by admin</div>
                    </div>
                  </div>
                  <div className="sal-pay-workflow-arrow">→</div>
                  <div className="sal-pay-workflow-step">
                    <div className="sal-pay-workflow-step-num">2</div>
                    <div className="sal-pay-workflow-step-info">
                      <div className="sal-pay-workflow-step-title">Employee Approval</div>
                      <div className="sal-pay-workflow-step-desc">Reviews and approves</div>
                    </div>
                  </div>
                  <div className="sal-pay-workflow-arrow">→</div>
                  <div className="sal-pay-workflow-step">
                    <div className="sal-pay-workflow-step-num">3</div>
                    <div className="sal-pay-workflow-step-info">
                      <div className="sal-pay-workflow-step-title">Payment Completed</div>
                      <div className="sal-pay-workflow-step-desc">Payout finalized and closed</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* ── inline right panel details layout ── */}
            {renderPaymentPanel()}
          </div>
        </div>
      )}

      {/* ── MODALS: Admin / Cashier ── */}
      {showPeriodModal && (
        <div className="sal-modal-overlay" onClick={() => setShowPeriodModal(false)}>
          <div className="sal-modal" onClick={e => e.stopPropagation()}>
            <div className="sal-modal-header"><h3>New Salary Period</h3><button className="sal-modal-close" onClick={() => setShowPeriodModal(false)}>✕</button></div>
            <div className="sal-modal-body">
              {[['periodName', 'Period Name', 'text', 'e.g. July 2026'], ['startDate', 'Start Date', 'date', ''], ['endDate', 'End Date', 'date', '']].map(([k, l, t, p]) => (
                <div className="sal-form-row" key={k}><label>{l}</label><input className="sal-input" type={t} placeholder={p} value={periodForm[k]} onChange={e => setPeriodForm(f => ({ ...f, [k]: e.target.value }))} /></div>
              ))}
              <div className="sal-form-row"><label>Salary Type</label>
                <select className="sal-select w-full" value={periodForm.salaryType} onChange={e => setPeriodForm(f => ({ ...f, salaryType: e.target.value }))}>
                  {['Monthly', 'Weekly', 'Daily'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="sal-modal-footer">
              <button className="sal-btn sal-btn-outline" onClick={() => setShowPeriodModal(false)}>Cancel</button>
              <button className="sal-btn sal-btn-primary" disabled={saving} onClick={handleCreatePeriod}>{saving ? 'Creating...' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {showStructureModal && (
        <div className="sal-modal-overlay" onClick={closeStructureModal}>
          <div className="sal-modal" onClick={e => e.stopPropagation()}>
            <div className="sal-modal-header">
              <h3>{editingStructure ? 'Edit Salary Structure' : 'Add Salary Structure'}</h3>
              <button className="sal-modal-close" onClick={closeStructureModal}>✕</button>
            </div>
            <div className="sal-modal-body">
              <div className="sal-form-row">
                <label>Employee</label>
                <select
                  className="sal-select w-full"
                  value={structureForm.employeeId}
                  onChange={e => setStructureForm(f => ({ ...f, employeeId: e.target.value }))}
                  disabled={!!editingStructure}
                >
                  <option value="">Select Employee</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </select>
              </div>

              <div className="sal-form-row">
                <label>Base Salary (ETB)</label>
                <input
                  className="sal-input"
                  type="number"
                  placeholder="e.g. 5000.00"
                  value={structureForm.baseSalary}
                  onChange={e => setStructureForm(f => ({ ...f, baseSalary: e.target.value }))}
                />
              </div>

              <div className="sal-form-row">
                <label>Absent Deduction (ETB per day)</label>
                <input
                  className="sal-input"
                  type="number"
                  placeholder="e.g. 200.00"
                  value={structureForm.absencePenaltyPerDay}
                  onChange={e => setStructureForm(f => ({ ...f, absencePenaltyPerDay: e.target.value }))}
                />
              </div>

              <div className="sal-form-row">
                <label>Late Deduction (ETB per occurrence)</label>
                <input
                  className="sal-input"
                  type="number"
                  placeholder="e.g. 50.00"
                  value={structureForm.latePenaltyPerOccurrence}
                  onChange={e => setStructureForm(f => ({ ...f, latePenaltyPerOccurrence: e.target.value }))}
                />
              </div>
            </div>
            <div className="sal-modal-footer">
              <button className="sal-btn sal-btn-outline" onClick={closeStructureModal}>Cancel</button>
              <button className="sal-btn sal-btn-primary" disabled={saving} onClick={handleSaveStructure}>
                {saving ? 'Processing...' : 'Save Structures'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPayModal && (
        <div className="sal-modal-overlay" onClick={() => setShowPayModal(null)}>
          <div className="sal-modal" onClick={e => e.stopPropagation()}>
            <div className="sal-modal-header"><h3>Process Payout</h3><button className="sal-modal-close" onClick={() => setShowPayModal(null)}>✕</button></div>
            <div className="sal-modal-body">
              <div className="sal-slip-preview">
                <div className="sal-slip-line"><span>Name</span><strong>{showPayModal.employee?.fullName}</strong></div>
                <div className="sal-slip-line"><span>Gross Salary</span><strong>ETB {showPayModal.grossSalary?.toLocaleString()}</strong></div>
                <div className="sal-slip-line"><span>Deductions</span><strong style={{ color: '#ef4444' }}>ETB {showPayModal.totalDeduction?.toLocaleString()}</strong></div>
                <div className="sal-slip-line sal-slip-net"><span>Net Pay</span><strong>ETB {showPayModal.netSalary?.toLocaleString()}</strong></div>
              </div>
              <div className="sal-form-row">
                <label>Payment Method</label>
                <select className="sal-select w-full" value={payForm.paymentMethod} onChange={e => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                  {['Cash', 'Bank Transfer', 'Mobile Banking'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="sal-form-row"><label>Transaction ID / Signature</label><input className="sal-input" placeholder="Ref Reference" value={payForm.paymentReference} onChange={e => setPayForm(f => ({ ...f, paymentReference: e.target.value }))} /></div>
              <div className="sal-form-row"><label>Optional Notes</label><input className="sal-input" placeholder="" value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} /></div>
            </div>
            <div className="sal-modal-footer">
              <button className="sal-btn sal-btn-outline" onClick={() => setShowPayModal(null)}>Cancel</button>
              <button className="sal-btn sal-btn-primary" disabled={saving} onClick={handlePay}>{saving ? 'Saving...' : 'Disburse'}</button>
            </div>
          </div>
        </div>
      )}


      {showSlip && renderSlipModal()}
    </div>
  );

  function renderPaymentPanel() {
    if (!showPaymentDialog) return null;
    const dlgE = showPaymentDialog;
    const calc = dlgE.latestCalculation;
    const panelHasBank = dlgE.bankName || dlgE.bankAccount;
    const panelHasMobile = dlgE.mobileBank || dlgE.mobileAccount;
    const panelHasAny = panelHasBank || panelHasMobile;
    const avatarCol = nameToColor(dlgE.fullName);

    return (
      <>
        <div className="sp-panel-overlay" onClick={() => setShowPaymentDialog(null)} />
        <div className="sp-panel">
          {/* Header */}
          <div className="sp-panel-header">
            <div className="sp-panel-emp-avatar" style={{ background: avatarCol }}>
              {getInitials(dlgE.fullName)}
            </div>
            <div className="sp-panel-emp-info">
              <div className="sp-panel-emp-name">{dlgE.fullName}</div>
              <div className="sp-panel-emp-meta">{dlgE.employeeNumber} · {dlgE.department || 'Staff'}</div>
            </div>
            <button className="sp-panel-close" onClick={() => setShowPaymentDialog(null)}><X size={16} /></button>
          </div>

          {/* Body */}
          <div className="sp-panel-body">
            {/* Net Salary Display */}
            <div className="sp-salary-display">
              <div className="sp-salary-display-label">Net Salary to Disburse</div>
              <div className="sp-salary-display-amount">
                ETB {calc?.netSalary?.toLocaleString() ?? dlgE.baseSalary?.toLocaleString()}
              </div>
              {calc?.periodName && (
                <div className="sp-salary-display-period">Period: {calc.periodName}</div>
              )}
            </div>

            {/* Employee Payment Accounts */}
            <div className="sp-section-header"><Building2 size={13} /> Payment Accounts</div>
            {!panelHasAny ? (
              <div className="sp-no-account">
                <AlertCircle size={18} />
                No payment account configured for this employee.
              </div>
            ) : (
              <div className="sp-accounts-grid">
                {panelHasBank && (
                  <div className="sp-account-box bank">
                    <div className="sp-account-box-title"><Building2 size={13} /> Bank Transfer</div>
                    <div className="sp-account-row"><span>Bank</span><strong>{dlgE.bankName}</strong></div>
                    <div className="sp-account-row"><span>Account</span><strong style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{dlgE.bankAccount}</strong></div>
                    <div className="sp-account-row"><span>Holder</span><strong>{dlgE.fullName}</strong></div>
                  </div>
                )}
                {panelHasMobile && (
                  <div className="sp-account-box mobile">
                    <div className="sp-account-box-title"><Smartphone size={13} /> Mobile Money</div>
                    <div className="sp-account-row"><span>Provider</span><strong>{dlgE.mobileBank}</strong></div>
                    <div className="sp-account-row"><span>Phone</span><strong style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{dlgE.mobileAccount}</strong></div>
                  </div>
                )}
              </div>
            )}

            {/* Payment Method */}
            <div className="sp-section-header"><CreditCard size={13} /> Payment Method</div>
            <div className="sp-method-tabs">
              {[
                { key: 'Cash', icon: '💵', label: 'Cash' },
                { key: 'Bank Transfer', icon: '🏦', label: 'Bank Transfer', disabled: !panelHasBank },
                { key: 'Mobile Banking', icon: '📱', label: 'Mobile', disabled: !panelHasMobile },
              ].map(m => (
                <button
                  key={m.key}
                  className={`sp-method-tab ${payDialogMethod === m.key ? 'active' : ''}`}
                  onClick={() => !m.disabled && setPayDialogMethod(m.key)}
                  disabled={m.disabled}
                >
                  <span className="sp-method-icon">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>

            {/* Payment Details */}
            <div className="sp-section-header"><FileText size={13} /> Payment Details</div>
            <div className="sp-field">
              <label>Payment Date</label>
              <input
                type="date"
                value={payDialogDate}
                onChange={e => setPayDialogDate(e.target.value)}
              />
            </div>
            <div className="sp-field">
              <label>Transaction Reference Number</label>
              <input
                type="text"
                placeholder="e.g. TXN-2026-0071 (optional)"
                value={payDialogReference}
                onChange={e => setPayDialogReference(e.target.value)}
              />
            </div>
            <div className="sp-field">
              <label>Payment Note (optional)</label>
              <textarea
                placeholder="Add any notes or remarks..."
                value={payDialogNotes}
                onChange={e => setPayDialogNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="sp-panel-footer">
            <button className="sp-btn-cancel" onClick={() => setShowPaymentDialog(null)}>Cancel</button>
            <button
              className="sp-btn-confirm"
              onClick={handleDialogPay}
              disabled={dialogProcessing}
            >
              {dialogProcessing
                ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</>
                : <><Send size={14} /> Confirm Payment · ETB {(calc?.netSalary ?? dlgE.baseSalary)?.toLocaleString()}</>
              }
            </button>
          </div>
        </div>
      </>
    );
  }

  function renderSlipModal() {
    return (
      <div className="sal-modal-overlay" onClick={() => setShowSlip(null)}>
        <div className="sal-modal sal-slip-modal" onClick={e => e.stopPropagation()}>
          <div className="sal-slip-header">
            <h2>GARAGE SALARY SYSTEM</h2>
            <div style={{ opacity: 0.6, fontSize: '0.85rem' }}>PAYROLL STATEMENT</div>
            <div style={{ fontSize: '0.8rem', marginTop: 4 }}>Period: {showSlip.salaryPeriod?.periodName}</div>
          </div>
          <div className="sal-slip-employee">
            <div>
              <strong>{showSlip.employee?.fullName}</strong>
              <div style={{ opacity: 0.6, fontSize: '0.82rem', marginTop: 3 }}>
                Details: {showSlip.employee?.employeeNumber} · {showSlip.employee?.department}
              </div>
            </div>
            {showSlip.payments?.[0] && (
              <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                <span className="sal-badge" style={{ background: '#22c55e20', color: '#22c55e' }}>Receipt Generated</span>
                <div style={{ fontFamily: 'monospace', opacity: 0.7, marginTop: 4 }}>No: {showSlip.payments[0].receiptNumber}</div>
              </div>
            )}
          </div>
          <table className="sal-slip-table">
            <tbody>
              <tr><td>Base Rate Salary</td><td>ETB {showSlip.baseSalary?.toLocaleString()}</td></tr>
              <tr><td>Earnings / Bonuses</td><td>ETB {showSlip.bonus?.toLocaleString()}</td></tr>
              <tr className="sal-slip-subtotal"><td>Gross Remuneration</td><td>ETB {showSlip.grossSalary?.toLocaleString()}</td></tr>
              <tr style={{ color: '#ef4444' }}><td>Absence Penalties ({showSlip.absentDays} days)</td><td>− ETB {showSlip.absenceDeduction?.toLocaleString()}</td></tr>
              <tr style={{ color: '#ef4444' }}><td>Tardiness / Late Penalties ({showSlip.lateHours?.toFixed(1)} hrs)</td><td>− ETB {showSlip.lateDeduction?.toLocaleString()}</td></tr>
              <tr style={{ color: '#ef4444' }}><td>Other Account Adjustments</td><td>− ETB {showSlip.otherDeduction?.toLocaleString()}</td></tr>
              <tr className="sal-slip-net-row"><td><strong>NET DISBURSEMENT</strong></td><td><strong>ETB {showSlip.netSalary?.toLocaleString()}</strong></td></tr>
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 28 }}>
            <button className="sal-btn sal-btn-outline" onClick={() => setShowSlip(null)}>Close View</button>
            <button className="sal-btn sal-btn-primary" onClick={printSlip}><Download size={14} /> Send to Print / PDF</button>
          </div>
        </div>
      </div>
    );
  }
}
