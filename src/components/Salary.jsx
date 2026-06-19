import React, { useState, useMemo, useEffect } from 'react';
import {
  CreditCard, Banknote, History, CheckCircle2,
  Clock, X, AlertCircle, Save, Landmark as Bank,
  Smartphone, Plus, Trash2, Edit2, Search, Filter,
  ArrowUpRight, ArrowDownLeft, Wallet, Info, ChevronRight,
  TrendingDown, TrendingUp, Bell, Settings, Image, Eye,
  Sparkles, Star, AlertTriangle
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import PhoneInput from './PhoneInput';
import './Salary.css';

const ETHIOPIAN_BANKS = [
  "Commercial Bank of Ethiopia (CBE)",
  "Dashen Bank",
  "Awash Bank",
  "Bank of Abyssinia",
  "Cooperative Bank of Oromia",
  "Nib International Bank",
  "Hibret Bank",
  "Wegagen Bank",
  "Zemen Bank",
  "Oromia International Bank",
  "Bunna Bank",
  "Berhan Bank",
  "Abay Bank",
  "Addis International Bank",
  "Debub Global Bank",
  "Enat Bank"
];

const ETHIOPIAN_MOBILE_SERVICES = [
  "Telebirr",
  "CBE Birr",
  "M-Pesa",
  "Awash Birr",
  "HelloCash",
  "Amole"
];

const Salary = () => {
  const {
    salaries, setSalaries, salaryPayments, setSalaryPayments,
    t, language, formatDate, addNotification, staff, attendance,
    addItem, updateItem, logActivity, requestConfirmation,
    isInitialLoadComplete
  } = useAppContext();
  const { currentUser, getAccounts, updateOtherAccount } = useAuth();

  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, history, accounts
  const [showManageModal, setShowManageModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [selectedProof, setSelectedProof] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [salaryFilter, setSalaryFilter] = useState('all'); // all, paid, pending

  const [manageData, setManageData] = useState({
    amount: 5000,
    type: 'monthly',
    status: 'active',
    absentDeduction: 0,
    lateDeduction: 0,
    isDeductionEnabled: false
  });
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    method: 'Bank Transfer',
    screenshot: null
  });

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert(t('File too large'));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentData({ ...paymentData, screenshot: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const [accountData, setAccountData] = useState({
    type: 'bank',
    provider: '',
    accountName: '',
    accountNumber: '',
    branch: '',
    walletNumber: ''
  });

  // A. Helper to calculate deductions for an employee based on attendance (Define early to avoid ReferenceError)
  const getEmployeeDeductions = (empId) => {
    const sal = (salaries || []).find(s => String(s.employeeId) === String(empId));
    if (!sal || !sal.isDeductionEnabled) return { totalDeduction: 0, absentDays: 0, lateDays: 0 };

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Filter attendance for the current month
    const myMonthAttendance = (attendance || []).filter(a => {
      if (String(a.staffId) !== String(empId)) return false;
      const d = new Date(a.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const absentDays = myMonthAttendance.filter(a => a.status === 'absent').length;
    const lateDays = myMonthAttendance.filter(a => a.status === 'late').length;

    const totalDeduction = (absentDays * (sal.absentDeduction || 0)) + (lateDays * (sal.lateDeduction || 0));

    return { totalDeduction, absentDays, lateDays };
  };

  // B. Helper to determine payment status and next available date
  const getPaymentStatus = (empId) => {
    const sal = salaries.find(s => String(s.employeeId) === String(empId));
    if (!sal) return { status: 'none', nextDate: null, daysLeft: 0, lastPay: null };

    const myPayments = salaryPayments
      .filter(p => String(p.employeeId) === String(empId) && p.status === 'paid')
      .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

    const lastPay = myPayments[0];
    if (!lastPay) return { status: 'pending', nextDate: new Date(), daysLeft: 0, lastPay: null };

    const now = new Date();
    const lastDate = new Date(lastPay.paymentDate);

    // Safety check for invalid date in history
    if (isNaN(lastDate.getTime())) return { status: 'pending', nextDate: now, daysLeft: 0, lastPay: null };

    let nextDate = new Date(lastDate);

    if (sal.type === 'weekly') {
      nextDate.setDate(lastDate.getDate() + 7);
    } else {
      nextDate.setDate(lastDate.getDate() + 30);
    }

    const diffTime = nextDate - now;
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let status = 'paid'; // Already paid for this cycle
    if (now >= nextDate) {
      status = 'pending';
      const overdueThreshold = sal.type === 'weekly' ? 7 : 30;
      if (daysLeft < -overdueThreshold) status = 'overdue';
    }

    return { status, nextDate, daysLeft, lastPay };
  };

  const handleResetLock = (empId) => {
    if (!isAdmin) return;
    const myPayments = salaryPayments.filter(p => String(p.employeeId) === String(empId));
    if (myPayments.length === 0) return;

    // To 'reset' we just delete the last payment or modify it, 
    // but a cleaner way for demo is to just notify it's reset.
    // Real implementation: remove the lock by ignoring the last payment's date.
    addNotification(`Payment lock for ${employees.find(e => e.id === empId)?.name} has been reset.`, 'info');
  };

  const role = currentUser?.role || 'customer';
  const isAdmin = role === 'admin' || role === 'coder';
  const isCashier = role === 'cashier';
  const isEmployee = !isAdmin && !isCashier; // Mechanic, Receptionist, Storekeeper, Manager

  // 1. Get all employees (excluding customers and inventory managers)
  const employees = useMemo(() => {
    const allStaff = staff || [];
    return allStaff.filter(s => s && s.role !== 'inventoryManager' && s.role !== 'customer');
  }, [staff]);

  // 2. Filter employees for Admin/Cashier view
  const filteredEmployees = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return employees.filter(s => {
      if (!s) return false;
      const { status } = getPaymentStatus(s.id);
      const employeeId = String(s.ownerId || s.id || '').toLowerCase();
      const name = (s.name || '').toLowerCase();
      const role = (s.role || '').toLowerCase();
      const payStatus = status.toLowerCase();

      return name.includes(searchLower) ||
        role.includes(searchLower) ||
        employeeId.includes(searchLower) ||
        payStatus.includes(searchLower);
    });
  }, [employees, searchTerm, getPaymentStatus]);

  // 3. Get personal salary info for employee
  const mySalary = useMemo(() => {
    return salaries.find(s => String(s.employeeId) === String(currentUser?.id));
  }, [salaries, currentUser?.id]);

  // Salary record for the currently selected employee in the Pay modal
  const selectedEmployeeSal = useMemo(() => {
    if (!selectedEmployee) return null;
    return salaries.find(s => String(s.employeeId) === String(selectedEmployee.id));
  }, [salaries, selectedEmployee]);

  const myPayments = useMemo(() => {
    return salaryPayments
      .filter(p => String(p.employeeId) === String(currentUser?.id))
      .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
  }, [salaryPayments, currentUser?.id]);

  // 4. Stats
  const stats = useMemo(() => {
    if (isAdmin || isCashier) {
      const activeSalaries = salaries.filter(s => s.status === 'active');
      const totalLiability = activeSalaries.reduce((sum, s) => {
        const { totalDeduction } = getEmployeeDeductions(s.employeeId);
        return sum + (Number(s.amount) || 0) - totalDeduction;
      }, 0);
      const totalDeductions = activeSalaries.reduce((sum, s) => {
        const { totalDeduction } = getEmployeeDeductions(s.employeeId);
        return sum + totalDeduction;
      }, 0);
      const paidThisMonth = salaryPayments
        .filter(p => p.status === 'paid' && new Date(p.paymentDate).getMonth() === new Date().getMonth())
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const pendingCount = employees.filter(e => {
        const s = salaries.find(sal => String(sal.employeeId) === String(e.id));
        if (!s) return false;
        const lastPay = salaryPayments
          .filter(p => String(p.employeeId) === String(e.id))
          .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))[0];
        if (!lastPay) return true;
        const now = new Date();
        const last = new Date(lastPay.paymentDate);
        return s.type === 'monthly' ? (now.getMonth() !== last.getMonth() || now.getFullYear() !== last.getFullYear()) : (now - last > 7 * 24 * 60 * 60 * 1000);
      }).length;

      return { totalLiability, paidThisMonth, pendingCount, totalDeductions };
    } else {
      const paidTotal = myPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const lastPay = myPayments[0];
      return { paidTotal, lastPay };
    }
  }, [isAdmin, isCashier, salaries, salaryPayments, employees, myPayments]);

  // 5. Actions
  const handleOpenManage = (emp) => {
    setSelectedEmployee(emp);
    const existing = salaries.find(s => String(s.employeeId) === String(emp.id));
    setManageData({
      amount: existing?.amount || 5000,
      type: existing?.type || 'monthly',
      status: existing?.status || 'active',
      absentDeduction: existing?.absentDeduction || 0,
      lateDeduction: existing?.lateDeduction || 0,
      isDeductionEnabled: existing?.isDeductionEnabled || false
    });
    setShowManageModal(true);
  };

  const handleSaveSalary = (e) => {
    e.preventDefault();
    const existing = salaries.find(s => String(s.employeeId) === String(selectedEmployee.id));
    const newData = {
      employeeId: selectedEmployee.id,
      employeeName: selectedEmployee.name,
      ...manageData,
      absentDeduction: Number(manageData.absentDeduction) || 0,
      lateDeduction: Number(manageData.lateDeduction) || 0,
      isDeductionEnabled: !!manageData.isDeductionEnabled,
      updatedAt: new Date().toISOString()
    };

    if (existing) {
      updateItem('salaries', existing.id, newData);
      addNotification(`Salary configuration updated for ${selectedEmployee.name}`, 'success');
    } else {
      newData.id = `sal_${Date.now()}`;
      newData.createdAt = new Date().toISOString();
      addItem('salaries', newData);
      addNotification(`Salary configuration created for ${selectedEmployee.name}`, 'success');
    }
    logActivity('Salary Managed', `Admin updated salary for ${selectedEmployee.name} to ${manageData.amount} ETB (${manageData.type})`);
    setShowManageModal(false);
  };

  const handleOpenPay = (emp) => {
    setSelectedEmployee(emp);
    const sal = salaries.find(s => String(s.employeeId) === String(emp.id));
    const { totalDeduction } = getEmployeeDeductions(emp.id);
    const baseAmount = sal?.amount || 0;

    setPaymentData({
      amount: Math.max(0, baseAmount - totalDeduction),
      method: 'Bank Transfer'
    });
    setShowPayModal(true);
  };

  const handleProcessPayment = (e) => {
    e.preventDefault();
    const newPayment = {
      id: `pay_${Date.now()}`,
      employeeId: selectedEmployee.id,
      employeeName: selectedEmployee.name,
      amount: paymentData.amount,
      method: paymentData.method,
      paymentDate: new Date().toISOString(),
      status: paymentData.method === 'Cash' && isCashier ? 'pending' : 'paid',
      screenshot: paymentData.screenshot,
      processedBy: currentUser.name,
      processedById: currentUser.id
    };

    addItem('salaryPayments', newPayment);
    addNotification(`Salary payment of ${paymentData.amount} ETB processed for ${selectedEmployee.name}`, 'success');

    // Notify employee
    addNotification(`Your salary of ${paymentData.amount} ETB has been processed via ${paymentData.method}.`, 'success', selectedEmployee.id);

    logActivity('Salary Payment', `${currentUser.name} processed ${paymentData.amount} ETB for ${selectedEmployee.name}`);
    setShowPayModal(false);
  };

  const handleConfirmCashPayment = (payment) => {
    updateItem('salaryPayments', payment.id, {
      status: 'paid',
      confirmedBy: currentUser.name,
      confirmedById: currentUser.id,
      confirmedAt: new Date().toISOString()
    });
    addNotification(`Cash payment for ${payment.employeeName} confirmed.`, 'success');
    addNotification(`Your cash salary payment has been confirmed by the cashier.`, 'success', payment.employeeId);
    logActivity('Salary Confirmation', `Cashier confirmed payment for ${payment.employeeName}`);
  };

  // Employee account actions
  const handleOpenAccount = (type) => {
    const info = type === 'bank' ? mySalary?.bankInfo : mySalary?.mobileInfo;
    setAccountData({
      type: type,
      provider: info?.provider || '',
      accountName: info?.accountName || currentUser.name,
      accountNumber: info?.accountNumber || '',
      branch: info?.branch || '',
      walletNumber: info?.walletNumber || ''
    });
    setShowAccountModal(true);
  };

  const handleSaveAccount = (e) => {
    e.preventDefault();
    if (!mySalary) {
      addNotification('Admin must configure your salary first before you can add account details.', 'error');
      return;
    }

    const updates = {};
    if (accountData.type === 'bank') {
      updates.bankInfo = {
        provider: accountData.provider,
        accountName: accountData.accountName,
        accountNumber: accountData.accountNumber,
        branch: accountData.branch
      };
    } else {
      updates.mobileInfo = {
        provider: accountData.provider,
        accountName: accountData.accountName,
        walletNumber: accountData.walletNumber
      };
    }

    updateItem('salaries', mySalary.id, updates);
    addNotification('Account information updated successfully.', 'success');
    setShowAccountModal(false);
  };

  // Render Functions
  const renderAdminDashboard = () => (
    <div className="salary-admin-view">
      <div className="salary-stats">
        <div className="stat-card liability">
          <div className="stat-icon"><TrendingDown size={28} strokeWidth={2.5} /></div>
          <div className="stat-info">
            <span className="label">Net Liability</span>
            <span className="value">{stats.totalLiability.toLocaleString()} ETB</span>
          </div>
        </div>
        <div className="stat-card pending">
          <div className="stat-icon"><AlertCircle size={28} strokeWidth={2.5} /></div>
          <div className="stat-info">
            <span className="label">Total Deductions</span>
            <span className="value">{stats.totalDeductions.toLocaleString()} ETB</span>
          </div>
        </div>
        <div className="stat-card paid">
          <div className="stat-icon"><TrendingUp size={28} strokeWidth={2.5} /></div>
          <div className="stat-info">
            <span className="label">Paid This Month</span>
            <span className="value">{stats.paidThisMonth.toLocaleString()} ETB</span>
          </div>
        </div>
      </div>

      <div className="search-bar-container">
        <div className="search-input-wrapper">
          <input
            type="text"
            placeholder={t('Search by name, ID, role or status...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="btn-clear-search" onClick={() => setSearchTerm('')} title={t('Clear')}>
              <X size={16} />
            </button>
          )}
          <Search size={18} className="search-icon" />
        </div>
      </div>

      <div className="employee-salary-list">
        {filteredEmployees.map(emp => {
          const sal = salaries.find(s => String(s.employeeId) === String(emp.id));
          const { status, nextDate, daysLeft, lastPay } = getPaymentStatus(emp.id);
          const { totalDeduction, absentDays } = getEmployeeDeductions(emp.id);
          const isOwnSalary = String(currentUser.id) === String(emp.id);

          return (
            <div key={emp.id} className={`employee-salary-card ${status}-card`}>
              <div className="employee-base-info">
                <div className="emp-avatar">
                  {emp.name.charAt(0).toUpperCase()}
                </div>
                <div className="emp-meta">
                  <h3>{emp.name}</h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className={`role-tag role-${emp.role}`}>{t(emp.role)}</span>
                    <span className={`status-badge ${status}`}>
                      {status === 'paid' ? 'Active' : status === 'overdue' ? 'Overdue' : 'Due'}
                    </span>
                  </div>
                </div>
                {status === 'paid' && (
                  <div className="top-paid-badge">
                    <CheckCircle2 size={14} /> PAID
                  </div>
                )}
              </div>

              <div className="salary-details">
                <div className="detail-item">
                  <span className="label">Original Salary</span>
                  <span className="value">{sal ? sal.amount.toLocaleString() : 'Not Set'} {sal && 'ETB'}</span>
                </div>
                {sal?.isDeductionEnabled && totalDeduction > 0 && (
                  <div className="detail-item deduction">
                    <span className="label">Deductions ({absentDays} Abs)</span>
                    <span className="value text-danger">-{totalDeduction.toLocaleString()} ETB</span>
                  </div>
                )}
                <div className="detail-item">
                  <span className="label">Next Date</span>
                  <span className="value" style={{ color: status === 'paid' ? 'var(--success)' : 'inherit' }}>
                    {nextDate && !isNaN(nextDate.getTime()) ? formatDate(nextDate.toISOString()) : '—'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="label">{t('Status')}</span>
                  <span className="value" style={{ color: status === 'paid' ? 'var(--success)' : status === 'overdue' ? 'var(--danger)' : 'var(--warning)' }}>
                    {status === 'paid' ? `${t('Paid')} (${daysLeft}d)` : status === 'overdue' ? t('Overdue') : t('Payable')}
                  </span>
                </div>
              </div>

              <div className="salary-actions">
                {isAdmin && (
                  <button className="btn-manage" onClick={() => handleOpenManage(emp)}>
                    <Settings size={16} /> Manage
                  </button>
                )}
                {status === 'paid' ? (
                  <div className="paid-confirmation-striking">
                    <div className="striking-content">
                      <CheckCircle2 size={20} />
                      <div>
                        <strong>Salary Processed</strong>
                        <span>Next available in {daysLeft} days</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    className="btn-pay"
                    onClick={() => handleOpenPay(emp)}
                    disabled={!sal || (isCashier && isOwnSalary)}
                    title={isCashier && isOwnSalary ? "Cashiers cannot pay their own salary" : ""}
                  >
                    <Wallet size={16} /> Process Pay
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderEmployeeDashboard = () => {
    const { totalDeduction, absentDays, lateDays } = getEmployeeDeductions(currentUser.id);
    const { status, nextDate, daysLeft, lastPay } = getPaymentStatus(currentUser.id);
    const finalSalary = Math.max(0, (mySalary?.amount || 0) - totalDeduction);

    return (
      <div className="salary-employee-view">
        <div className="employee-welcome">
          <h1>Welcome, {currentUser.name}</h1>
          <p>Your personal salary and payment information</p>
        </div>

        <div className="employee-stats">
          <div className="stat-card current">
            <div className="stat-label">Remaining Salary</div>
            <div className="stat-value" style={{ color: 'var(--primary)' }}>{finalSalary.toLocaleString()} ETB</div>
            <div className="stat-sub">Base: {mySalary?.amount?.toLocaleString()} ETB</div>
          </div>
          <div className="stat-card earned">
            <div className="stat-label">Total Deductions</div>
            <div className="stat-value text-danger">-{totalDeduction.toLocaleString()} ETB</div>
            <div className="stat-sub">{absentDays} Abs / {lateDays} Late</div>
          </div>
          <div className="stat-card last">
            <div className="stat-label">{status === 'paid' ? 'Next Payment In' : 'Payment Status'}</div>
            <div className="stat-value" style={{ color: status === 'paid' ? 'var(--success)' : 'var(--warning)' }}>
              {status === 'paid' ? `${daysLeft} Days` : 'Due Now'}
            </div>
            <div className="stat-sub">
              {status === 'paid' && nextDate && !isNaN(nextDate.getTime())
                ? `Available: ${formatDate(nextDate.toISOString())}`
                : 'Contact Cashier'}
            </div>
          </div>
        </div>

        <div className="account-info-section">
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Banknote size={22} className="text-primary" /> {t('Payment Account')}
            </h2>
            <div style={{ display: 'flex', gap: '12px' }}>
              {(!mySalary?.bankInfo || !mySalary?.mobileInfo) ? (
                <button
                  className="btn-primary"
                  onClick={() => {
                    const type = !mySalary?.bankInfo ? 'bank' : 'mobile';
                    handleOpenAccount(type);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px', minWidth: '160px', justifyContent: 'center' }}
                >
                  <Plus size={18} />
                  <span>{!mySalary?.bankInfo ? t('Add Bank Account') : t('Add Mobile Banking')}</span>
                </button>
              ) : (
                <button
                  className="btn-outline"
                  onClick={() => handleOpenAccount('bank')}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px', minWidth: '160px', justifyContent: 'center' }}
                >
                  <Edit2 size={16} /> {t('Edit Information')}
                </button>
              )}
            </div>
          </div>

          {(!mySalary?.bankInfo || !mySalary?.mobileInfo) && (
            <div className="payout-completion-tip">
              <div className="tip-icon"><Sparkles size={24} /></div>
              <div className="tip-content">
                <strong>{t('Complete Your Payout Profile')}</strong>
                <p>{t("Adding a second account ensures you're always ready for payments.")}</p>
              </div>
            </div>
          )}

          <div className="account-details-grid">
            {/* Bank Account Slot */}
            <div className="account-slot">
              <div className="slot-label">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bank size={16} /> {t('Bank Account')}
                  {!mySalary?.bankInfo && <Star size={12} fill="var(--warning)" color="var(--warning)" />}
                </div>
                <span className={`status-badge ${mySalary?.bankInfo ? 'linked' : 'unlinked'}`}>
                  {mySalary?.bankInfo ? t('Linked') : t('Not Linked')}
                </span>
              </div>
              {mySalary?.bankInfo ? (
                <div className="account-card bank">
                  <div className="acc-icon"><Bank size={32} /></div>
                  <div className="acc-info">
                    <span className="acc-provider">{mySalary.bankInfo.provider}</span>
                    <span className="acc-number">{mySalary.bankInfo.accountNumber}</span>
                    <span className="acc-name">{mySalary.bankInfo.accountName}</span>
                    {mySalary.bankInfo.branch && <span className="acc-branch">{mySalary.bankInfo.branch}</span>}
                  </div>
                  <button className="edit-slot-btn" title="Edit Info" onClick={() => handleOpenAccount('bank')}>
                    <Edit2 size={14} />
                  </button>
                </div>
              ) : (
                <button className="setup-card mini bank" onClick={() => handleOpenAccount('bank')}>
                  <div className="setup-icon"><Plus size={24} /></div>
                  <span className="setup-text">{t('Link Bank Account')}</span>
                </button>
              )}
            </div>

            {/* Mobile Banking Slot */}
            <div className="account-slot">
              <div className="slot-label">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Smartphone size={16} /> {t('Mobile Banking')}
                  {!mySalary?.mobileInfo && <Star size={12} fill="var(--warning)" color="var(--warning)" />}
                </div>
                <span className={`status-badge ${mySalary?.mobileInfo ? 'linked' : 'unlinked'}`}>
                  {mySalary?.mobileInfo ? t('Linked') : t('Not Linked')}
                </span>
              </div>
              {mySalary?.mobileInfo ? (
                <div className="account-card mobile">
                  <div className="acc-icon"><Smartphone size={32} /></div>
                  <div className="acc-info">
                    <span className="acc-provider">{mySalary.mobileInfo.provider}</span>
                    <span className="acc-number">{mySalary.mobileInfo.walletNumber}</span>
                    <span className="acc-name">{mySalary.mobileInfo.accountName}</span>
                  </div>
                  <button className="edit-slot-btn" title="Edit Info" onClick={() => handleOpenAccount('mobile')}>
                    <Edit2 size={14} />
                  </button>
                </div>
              ) : (
                <button className="setup-card mini mobile" onClick={() => handleOpenAccount('mobile')}>
                  <div className="setup-icon"><Plus size={24} /></div>
                  <span className="setup-text">{t('Set Up Mobile Banking')}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="payment-history-section">
          <div className="section-header">
            <h2><History size={20} /> Payment History</h2>
          </div>
          <div className="history-table-container">
            {myPayments.length === 0 ? (
              <div className="empty-state">No payment history available.</div>
            ) : (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myPayments.map(p => (
                    <tr key={p.id}>
                      <td>{formatDate(p.paymentDate)}</td>
                      <td className="amount">{p.amount.toLocaleString()} ETB</td>
                      <td>{p.method}</td>
                      <td>
                        <div className="status-actions-cell">
                          <span className={`status-pill pill-${p.status}`}>
                            {p.status.toUpperCase()}
                          </span>
                          {p.screenshot && (
                            <button
                              className="btn-view-proof"
                              type="button"
                              onClick={() => { setSelectedProof(p.screenshot); setShowProofModal(true); }}
                              title={t('View Receipt')}
                            >
                              <Image size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCashierDashboard = () => {
    const pendingCashPayments = salaryPayments.filter(p => p.status === 'pending');

    return (
      <div className="salary-cashier-view">
        <div className="cashier-header">
          <h1>Pending Cash Payments</h1>
          <p>Confirm and process employee salaries paid in cash</p>
        </div>

        <div className="pending-payments-list">
          {pendingCashPayments.length === 0 ? (
            <div className="empty-state">No pending cash payments to confirm.</div>
          ) : (
            pendingCashPayments.map(p => (
              <div key={p.id} className="payment-confirmation-card">
                <div className="payment-main-info">
                  <div className="emp-info">
                    <h3>{p.employeeName}</h3>
                    <span className="pay-date">{formatDate(p.paymentDate)}</span>
                  </div>
                  <div className="pay-amount">
                    {Number(p.amount).toLocaleString()} ETB
                  </div>
                </div>
                <div className="payment-footer">
                  <span className="method-tag"><Banknote size={14} /> Cash Payment</span>
                  <button className="btn-confirm" onClick={() => handleConfirmCashPayment(p)}>
                    <CheckCircle2 size={16} /> Confirm Delivery
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="all-employees-access" style={{ marginTop: '40px' }}>
          <h2>Employee Account Access</h2>
          <p>View bank/mobile details for salary processing</p>
          <div className="cashier-employee-grid">
            {filteredEmployees.map(emp => {
              const sal = salaries.find(s => String(s.employeeId) === String(emp.id));
              const { status } = getPaymentStatus(emp.id);
              const isOwnSalary = String(currentUser.id) === String(emp.id);

              return (
                <div key={emp.id} className="cashier-emp-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <strong>{emp.name}</strong>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                      <span className="role-tag">{t(emp.role)}</span>
                      <span className={`status-badge ${status}`} style={{ fontSize: '0.6rem' }}>
                        {status === 'paid' ? 'Paid' : 'Due'}
                      </span>
                    </div>
                  </div>
                  {sal?.bankInfo ? (
                    <div className="acc-brief bank">
                      <Bank size={14} /> {sal.bankInfo.provider}: {sal.bankInfo.accountNumber}
                    </div>
                  ) : sal?.mobileInfo ? (
                    <div className="acc-brief mobile">
                      <Smartphone size={14} /> {sal.mobileInfo.provider}: {sal.mobileInfo.accountNumber}
                    </div>
                  ) : (
                    <div className="acc-none">No account info</div>
                  )}
                  {status === 'paid' ? (
                    <div className="paid-status-small">
                      <CheckCircle2 size={12} /> Paid
                    </div>
                  ) : (
                    <button
                      className="btn-pay-small"
                      onClick={() => handleOpenPay(emp)}
                      disabled={!sal || isOwnSalary}
                      title={isOwnSalary ? "You cannot pay your own salary" : ""}
                    >
                      <Wallet size={12} /> Process Salary
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="salary-page">
      <div className="salary-header-global">
        <div className="title-section">
          <Bank size={32} color="var(--primary)" />
          <div>
            <h1>Salary Management</h1>
            <p>{isAdmin ? "System-wide payroll and employee compensation" : "Track and manage your compensation"}</p>
          </div>
        </div>
        {(isAdmin || isCashier) && (
          <div className="header-tabs">
            <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>Overview</button>
            <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>Payment Logs</button>
          </div>
        )}
      </div>

      {activeTab === 'dashboard' && (
        <>
          {isAdmin && renderAdminDashboard()}
          {isCashier && renderCashierDashboard()}
          {isEmployee && renderEmployeeDashboard()}
        </>
      )}

      {activeTab === 'history' && (
        <div className="salary-history-full">
          <div className="section-header">
            <h2>System Payment History</h2>
            <div className="filters">
              <div className="search-input-wrapper animate-fadeIn">
                <input
                  type="text"
                  placeholder={t('Search history...')}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button className="btn-clear-search" onClick={() => setSearchTerm('')} title={t('Clear')}>
                    <X size={14} />
                  </button>
                )}
                <Search size={16} className="search-icon" />
              </div>
            </div>
          </div>
          <div className="history-table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Processed By</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {salaryPayments
                  .filter(p => p.employeeName.toLowerCase().includes(searchTerm.toLowerCase()))
                  .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))
                  .map(p => (
                    <tr key={p.id}>
                      <td>{formatDate(p.paymentDate)}</td>
                      <td>{p.employeeName}</td>
                      <td className="amount">{Number(p.amount).toLocaleString()} ETB</td>
                      <td>{p.method}</td>
                      <td>{p.processedBy}</td>
                      <td>
                        <div className="status-actions-cell">
                          <span className={`status-pill pill-${p.status}`}>
                            {p.status.toUpperCase()}
                          </span>
                          {p.screenshot && (
                            <button
                              className="btn-view-proof"
                              type="button"
                              onClick={() => { setSelectedProof(p.screenshot); setShowProofModal(true); }}
                              title={t('View Receipt')}
                            >
                              <Image size={14} />
                            </button>
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

      {/* Modals */}
      {showManageModal && selectedEmployee && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Manage Salary: {selectedEmployee.name}</h2>
              <button className="close-btn" onClick={() => setShowManageModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveSalary} className="modal-form">
              <div className="form-group">
                <label>Salary Amount (ETB): {manageData.amount.toLocaleString()}</label>
                <div className="slider-container">
                  <input
                    type="range"
                    min="1000"
                    max="100000"
                    step="500"
                    value={manageData.amount}
                    onChange={(e) => setManageData({ ...manageData, amount: parseInt(e.target.value) })}
                  />
                  <input
                    type="number"
                    value={manageData.amount}
                    onChange={(e) => setManageData({ ...manageData, amount: parseInt(e.target.value) })}
                    className="salary-amount-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Salary Type</label>
                <div className="type-selector">
                  <button
                    type="button"
                    className={manageData.type === 'weekly' ? 'active' : ''}
                    onClick={() => setManageData({ ...manageData, type: 'weekly' })}
                  >Weekly</button>
                  <button
                    type="button"
                    className={manageData.type === 'monthly' ? 'active' : ''}
                    onClick={() => setManageData({ ...manageData, type: 'monthly' })}
                  >Monthly</button>
                </div>
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  value={manageData.status}
                  onChange={(e) => setManageData({ ...manageData, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label>Absent Deduction (per day)</label>
                  <input
                    type="number"
                    value={manageData.absentDeduction}
                    onChange={(e) => setManageData({ ...manageData, absentDeduction: parseInt(e.target.value) || 0 })}
                    placeholder="e.g. 200"
                  />
                </div>
                <div className="form-group">
                  <label>Late Deduction (per day)</label>
                  <input
                    type="number"
                    value={manageData.lateDeduction}
                    onChange={(e) => setManageData({ ...manageData, lateDeduction: parseInt(e.target.value) || 0 })}
                    placeholder="e.g. 50"
                  />
                </div>
              </div>

              <div className="form-group checkbox-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={manageData.isDeductionEnabled}
                    onChange={(e) => setManageData({ ...manageData, isDeductionEnabled: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span>Enable Automatic Deductions</span>
                </label>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn-primary">Save Configuration</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPayModal && selectedEmployee && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Process Payment: {selectedEmployee.name}</h2>
              <button className="close-btn" onClick={() => setShowPayModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleProcessPayment} className="modal-form">
              <div className="form-group">
                <label>Amount to Pay (ETB)</label>
                <input
                  type="number"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: parseInt(e.target.value) })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Payment Method</label>
                <div className="method-grid">
                  <div
                    className={`method-card ${paymentData.method === 'Bank Transfer' ? 'active' : ''}`}
                    onClick={() => setPaymentData({ ...paymentData, method: 'Bank Transfer' })}
                  >
                    <Bank size={20} />
                    <span>Bank Transfer</span>
                  </div>
                  <div
                    className={`method-card ${paymentData.method === 'Mobile Banking' ? 'active' : ''}`}
                    onClick={() => setPaymentData({ ...paymentData, method: 'Mobile Banking' })}
                  >
                    <Smartphone size={20} />
                    <span>Mobile Banking</span>
                  </div>
                  <div
                    className={`method-card ${paymentData.method === 'Cash' ? 'active' : ''}`}
                    onClick={() => setPaymentData({ ...paymentData, method: 'Cash' })}
                  >
                    <Banknote size={20} />
                    <span>Cash Payment</span>
                  </div>
                </div>
              </div>

              {/* Account Verification Details */}
              {paymentData.method !== 'Cash' && (
                <div className="payment-target-info">
                  {paymentData.method === 'Bank Transfer' ? (
                    selectedEmployeeSal?.bankInfo ? (
                      <div className="target-account-card">
                        <span className="target-label">{t('Recipient Bank Details')}:</span>
                        <div className="target-details">
                          <strong>{selectedEmployeeSal.bankInfo.provider}</strong>
                          <span>{selectedEmployeeSal.bankInfo.accountNumber}</span>
                          <small>{selectedEmployeeSal.bankInfo.accountName}</small>
                        </div>
                      </div>
                    ) : (
                      <div className="target-account-card warning">
                        <AlertTriangle size={16} /> <span>{t('No Bank Account Linked by Staff')}</span>
                      </div>
                    )
                  ) : (
                    selectedEmployeeSal?.mobileInfo ? (
                      <div className="target-account-card">
                        <span className="target-label">{t('Recipient Mobile Wallet')}:</span>
                        <div className="target-details">
                          <strong>{selectedEmployeeSal.mobileInfo.provider}</strong>
                          <span>{selectedEmployeeSal.mobileInfo.walletNumber}</span>
                          <small>{selectedEmployeeSal.mobileInfo.accountName}</small>
                        </div>
                      </div>
                    ) : (
                      <div className="target-account-card warning">
                        <AlertTriangle size={16} /> <span>{t('No Mobile Wallet Linked by Staff')}</span>
                      </div>
                    )
                  )}
                </div>
              )}

              <div className="form-group">
                <label>{t('Upload Receipt/Screenshot')}</label>
                <div className="screenshot-upload-wrapper">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    id="screenshot-upload"
                    hidden
                  />
                  <label htmlFor="screenshot-upload" className="btn-upload-label">
                    <Image size={18} />
                    {paymentData.screenshot ? t('Change Screenshot') : t('Select Screenshot')}
                  </label>
                  {paymentData.screenshot && (
                    <div className="screenshot-preview-inline">
                      <img src={paymentData.screenshot} alt="Preview" />
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn-primary">Confirm Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAccountModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{accountData.type === 'bank' ? t('Link Bank Account') : t('Set Up Mobile Banking')}</h2>
              <button className="close-btn" onClick={() => setShowAccountModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveAccount} className="modal-form">
              <div className="account-type-toggle">
                <div
                  className={`type-option ${accountData.type === 'bank' ? 'active' : ''}`}
                  onClick={() => setAccountData({ ...accountData, type: 'bank', provider: '' })}
                >
                  <Bank size={18} />
                  <span>{t('Bank Account')}</span>
                </div>
                <div
                  className={`type-option ${accountData.type === 'mobile' ? 'active' : ''}`}
                  onClick={() => setAccountData({ ...accountData, type: 'mobile', provider: '' })}
                >
                  <Smartphone size={18} />
                  <span>{t('Mobile Banking')}</span>
                </div>
              </div>

              <div className="form-group">
                <label>{accountData.type === 'bank' ? t('Bank Name') : t('Mobile Banking Provider')}</label>
                <select
                  value={accountData.provider}
                  onChange={(e) => setAccountData({ ...accountData, provider: e.target.value })}
                  required
                >
                  <option value="">{t('Select Provider')}</option>
                  {(accountData.type === 'bank' ? ETHIOPIAN_BANKS : ETHIOPIAN_MOBILE_SERVICES).map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>{t('Account Holder Name')}</label>
                <input
                  type="text"
                  value={accountData.accountName}
                  onChange={(e) => setAccountData({ ...accountData, accountName: e.target.value })}
                  required
                  placeholder={t('Enter full name')}
                />
              </div>

              {accountData.type === 'bank' ? (
                <>
                  <div className="form-group">
                    <label>{t('Bank Account Number')}</label>
                    <input
                      type="text"
                      value={accountData.accountNumber}
                      onChange={(e) => setAccountData({ ...accountData, accountNumber: e.target.value })}
                      required
                      placeholder="1000..."
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('Branch (Optional)')}</label>
                    <input
                      type="text"
                      value={accountData.branch}
                      onChange={(e) => setAccountData({ ...accountData, branch: e.target.value })}
                      placeholder="e.g. Bole Branch"
                    />
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label>{t('Phone Number')}</label>
                  <PhoneInput
                    value={accountData.walletNumber}
                    onChange={(val, valid) => {
                      setAccountData({ ...accountData, walletNumber: val });
                      // Instant validity check if needed
                    }}
                    required={true}
                  />
                </div>
              )}
              <div className="modal-actions">
                <button type="submit" className="btn-primary">{t('Update Information')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showProofModal && selectedProof && (
        <div className="modal-overlay" onClick={() => setShowProofModal(false)}>
          <div className="modal-content proof-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('Payment Proof')}</h2>
              <button className="close-btn" onClick={() => setShowProofModal(false)}><X size={20} /></button>
            </div>
            <div className="proof-viewer">
              <img src={selectedProof} alt="Payment Proof" />
              <a href={selectedProof} download="salary_receipt.png" className="btn-primary download-btn">
                Download Screenshot
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Salary;
