import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  CreditCard, FileText, CheckCircle, CheckCircle2, Search, Download, Printer,
  Settings, BarChart3, Plus, Trash2, Building, Smartphone, Edit2,
  DollarSign, Landmark, Wallet, History, AlertCircle, Share2,
  FilePlus, Save, ArrowLeft, X, Image as ImageIcon, Package
} from 'lucide-react';
import InvoiceForm from './InvoiceForm';
import { generateInvoicePDF } from '../utils/pdfUtils';
import { toEthiopian, toGregorian, formatEthiopianDate, ETHIOPIAN_MONTHS, getDaysInMonth } from '../utils/ethiopianDate';
import EthiopianSelector from './EthiopianSelector';
import './Billing.css';

const Billing = () => {
  const {
    invoices, setInvoices,
    adminPaymentDetails, setAdminPaymentDetails,
    billingSettings, setBillingSettings,
    customers, materialRequests, setMaterialRequests,
    repairs, staff, mechanicPaymentDetails, bonuses, setBonuses,
    t, language, formatDate, requestConfirmation,
    addNotification, logActivity
  } = useAppContext();
  const { currentUser } = useAuth();

  const location = useLocation();
  const [activeTab, setActiveTab] = useState('invoices'); // invoices, settings, reports
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [currency, setCurrency] = useState(billingSettings.currency || 'ETB');
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(null); // 'bank' or 'phone' or null
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [proofData, setProofData] = useState({ txId: '', note: '' });
  const [newAccount, setNewAccount] = useState({ provider: '', accountName: '', accountNumber: '', branch: '' });
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [bonusAmount, setBonusAmount] = useState('');
  const [bonusScreenshot, setBonusScreenshot] = useState(null);
  const [showImageModal, setShowImageModal] = useState(null);
  const [dateFilter, setDateFilter] = useState({ from: '', to: '', exact: '' }); // URL of image to zoom or null
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (['invoices', 'settings', 'reports'].includes(hash)) {
      setActiveTab(hash);
    }

    // Auto-select invoice if ID is in query params
    const params = new URLSearchParams(location.search);
    const invId = params.get('id');
    if (invId) {
      const inv = invoices.find(i => String(i.id) === String(invId));
      if (inv) {
        setSelectedInvoice(inv);
        setShowMobileDetail(true);
      }
    }
  }, [location.hash, location.search, invoices]);

  const [billingForm, setBillingForm] = useState({
    taxRate: billingSettings.taxRate || 15,
    currency: billingSettings.currency || 'ETB'
  });

  // Derived state for reports
  const stats = useMemo(() => {
    const invs = invoices || [];
    return {
      total: invs.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0),
      paid: invs.filter(i => i.status === 'paid').reduce((sum, inv) => sum + (Number(inv.total) || 0), 0),
      unpaid: invs.filter(i => i.status !== 'paid').reduce((sum, inv) => sum + (Number(inv.total) || 0), 0),
    };
  }, [invoices]);

  // Role-based invoice filtering
  const visibleInvoices = useMemo(() => {
    const invs = invoices || [];
    return invs.filter(inv => {
      // 1. Search term filtering
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        inv.id.toLowerCase().includes(searchLower) ||
        inv.customerName?.toLowerCase().includes(searchLower) ||
        inv.vehiclePlate?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;

      // 3. Date filtering (Hardened Range Check)
      if (dateFilter.exact || dateFilter.from || dateFilter.to) {
        const invDay = inv.date;

        if (dateFilter.exact) {
          if (invDay !== dateFilter.exact) return false;
        } else {
          if (dateFilter.from && invDay < dateFilter.from) return false;
          if (dateFilter.to && invDay > dateFilter.to) return false;
        }
      }

      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [invoices, currentUser, searchTerm, dateFilter]);

  useEffect(() => {
    if (visibleInvoices.length > 0 && !selectedInvoice) {
      setSelectedInvoice(visibleInvoices[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleInvoices.length, selectedInvoice]);

  // DATA FLOW FIX: Keep selectedInvoice synced with global invoices array
  useEffect(() => {
    if (selectedInvoice) {
      const latest = invoices.find(i => String(i.id) === String(selectedInvoice.id));
      if (latest && (
        latest.status !== selectedInvoice.status ||
        latest.hasProof !== selectedInvoice.hasProof ||
        JSON.stringify(latest.proofDetails) !== JSON.stringify(selectedInvoice.proofDetails)
      )) {
        setSelectedInvoice(latest);
      }
    }
  }, [invoices, selectedInvoice]);

  const convertAmount = (amount, toCurrency) => {
    if (toCurrency === 'ETB') return amount;
    // Static mock rates relative to ETB
    const rates = { USD: 0.018, EUR: 0.017, GBP: 0.014, AED: 0.066, SAR: 0.068 };
    const rate = rates[toCurrency] || 1;
    return amount * rate;
  };

  const getCurrencySymbol = (curr) => {
    const symbols = { ETB: 'Br', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SAR: 'ر.س' };
    return symbols[curr] || curr;
  };

  const formatCurrency = (amount) => {
    return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${t('ETB')}`;
  };

  const handleSaveInvoice = (newInvoice) => {
    setInvoices(prev => [newInvoice, ...prev]);
    setShowInvoiceForm(false);
    setSelectedInvoice(newInvoice);

    // Notify customer
    addNotification(
      `${t('newInvoice')} #${newInvoice.id}: ${formatCurrency(newInvoice.total)}`,
      'info',
      newInvoice.customerId,
      '/billing'
    );
  };



  const updateInvoiceStatus = (id, newStatus, paymentMethod = 'transfer') => {
    // 1. Update Invoices
    setInvoices(prev => prev.map(inv => {
      if (inv.id === id) {
        const updated = { ...inv, status: newStatus };
        if (newStatus === 'paid') {
          updated.hasProof = false;
          updated.paymentMethod = paymentMethod;
          updated.verifiedAt = new Date().toISOString();
          updated.verifiedBy = currentUser?.name;
          addNotification(`${t('paymentConfirmed')} : ${inv.id}`, 'success', inv.customerId, '/billing');

          if (paymentMethod === 'cash') {
            logActivity('Cash Payment Received', `Invoice ${inv.id} marked as paid in cash by ${currentUser?.name} (${formatCurrency(inv.total)})`);
          } else {
            logActivity('Payment Verified', `Invoice ${inv.id} verified by ${currentUser?.name}`);
          }
        } else if (newStatus === 'rejected') {
          updated.hasProof = false; // Allow re-upload
          addNotification(`${t('paymentRejected')} : ${inv.id}. Please re-upload proof.`, 'warning', inv.customerId, '/billing');
        } else if (newStatus === 'unpaid') {
          updated.hasProof = false;
        }
        return updated;
      }
      return inv;
    }));

    // SYNC LOCAL STATE: Update selectedInvoice immediately
    if (selectedInvoice?.id === id) {
      setSelectedInvoice(prev => ({
        ...prev,
        status: newStatus,
        hasProof: (newStatus === 'paid' || newStatus === 'rejected' || newStatus === 'unpaid') ? false : prev.hasProof,
        paymentMethod: newStatus === 'paid' ? paymentMethod : prev.paymentMethod,
        verifiedAt: newStatus === 'paid' ? new Date().toISOString() : prev.verifiedAt,
        verifiedBy: newStatus === 'paid' ? currentUser?.name : prev.verifiedBy
      }));
    }

    // 2. Sync Payment Status to Material Requests
    const targetInvoice = invoices.find(inv => inv.id === id);
    if (targetInvoice && targetInvoice.materialRequestId) {
      setMaterialRequests(prev => prev.map(req =>
        req.id === targetInvoice.materialRequestId
          ? { ...req, paymentStatus: newStatus }
          : req
      ));
    }
  };

  const handleSubmitProof = (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    setInvoices(prev => prev.map(inv =>
      inv.id === selectedInvoice.id ? {
        ...inv,
        hasProof: true,
        status: 'payment-submitted',
        proofDetails: { ...proofData, date: new Date().toISOString() }
      } : inv
    ));

    // SYNC LOCAL STATE: Update selectedInvoice immediately
    const updatedProof = { ...proofData, date: new Date().toISOString() };
    setSelectedInvoice(prev => ({
      ...prev,
      hasProof: true,
      status: 'payment-submitted',
      proofDetails: updatedProof
    }));

    // Notify Inventory Manager/Admin specifically
    const managerId = selectedInvoice.managerId || null;
    addNotification(
      `${t("Payment Proof Submitted")} - ${selectedInvoice.id}`,
      'payment',
      managerId,
      `/billing?id=${selectedInvoice.id}`
    );

    setShowProofModal(false);
    setProofData({ txId: '', note: '' });
    alert('Payment proof submitted for review!');
  };

  const handleSendBonus = (e) => {
    e.preventDefault();
    if (!selectedInvoice || !bonusAmount || !bonusScreenshot) return;

    // Find the mechanic for this job
    let mechanicId = selectedInvoice.mechanicId;
    if (!mechanicId && selectedInvoice.repairId) {
      const repair = repairs.find(r => String(r.id) === String(selectedInvoice.repairId));
      mechanicId = repair?.mechanicId;
    }

    if (!mechanicId) {
      alert("No mechanic assigned to this job.");
      return;
    }

    const newBonus = {
      id: `b${Date.now()}`,
      jobId: selectedInvoice.repairId || selectedInvoice.id,
      invoiceId: selectedInvoice.id,
      customerId: currentUser?.id,
      mechanicId: mechanicId,
      amount: Number(bonusAmount),
      status: 'Submitted',
      screenshot: bonusScreenshot,
      timestamp: new Date().toISOString()
    };

    setBonuses(prev => [...prev, newBonus]);
    addNotification(
      `🎉 New Bonus Received: ${bonusAmount} ETB from ${currentUser?.name}`,
      'success',
      mechanicId,
      '/bonus'
    );

    setShowBonusModal(false);
    setBonusAmount('');
    setBonusScreenshot(null);
    alert('Thank you! Your bonus has been submitted to the mechanic.');
  };

  const deletePaymentDetail = (id) => {
    requestConfirmation(t('confirmDelete'), () => {
      setAdminPaymentDetails(prev => prev.filter(d => d.id !== id));
    });
  };

  const handleEditAccount = (account) => {
    setNewAccount({
      provider: account.provider,
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      branch: account.branch || ''
    });
    setEditingAccountId(account.id);
    setShowAccountModal(account.type);
  };

  const handleSaveGlobalSettings = (e) => {
    e.preventDefault();
    setBillingSettings({
      ...billingSettings,
      taxRate: parseFloat(billingForm.taxRate),
      currency: billingForm.currency
    });
    alert(t("Global billing settings saved!"));
  };

  const handleAddAccount = (e) => {
    e.preventDefault();
    if (editingAccountId) {
      setAdminPaymentDetails(prev => prev.map(d =>
        d.id === editingAccountId
          ? { ...d, ...newAccount }
          : d
      ));
    } else {
      const detail = {
        id: `acc_${Date.now()}`,
        type: showAccountModal,
        ...newAccount,
        isDefault: adminPaymentDetails.length === 0,
        managerId: currentUser?.id,
        managerRole: currentUser?.role // Store role directly for reliable filtering
      };
      setAdminPaymentDetails(prev => [...prev, detail]);
    }
    setShowAccountModal(null);
    setEditingAccountId(null);
    setNewAccount({ provider: '', accountName: '', accountNumber: '', branch: '' });
  };

  const renderTabs = () => (
    <div className="billing-tabs">
      <button className={`billing-tab ${activeTab === 'invoices' ? 'active' : ''}`} onClick={() => setActiveTab('invoices')}>
        <FileText size={18} /> {t('invoices')}
      </button>
      {(currentUser?.permissions?.includes('all') || (currentUser?.permissions?.includes('billing_manage') && currentUser?.role !== 'cashier')) && (
        <>
          <button className={`billing-tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <Settings size={18} /> {t('paymentSettings')}
          </button>
          <button className={`billing-tab ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>
            <BarChart3 size={18} /> {t('financialReports')}
          </button>
        </>
      )}
    </div>
  );



  const renderInvoiceList = () => (
    <div className="invoice-list-section">
      <div className="controls-bar" style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder={t("Search Invoice ID, Name...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="date-filters" style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 12 }}>
            {language === 'am' ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <EthiopianSelector
                  label="በተወሰነ ቀን ብቻ ፈልግ"
                  value={dateFilter.exact}
                  language={language}
                  onChange={(val) => setDateFilter({ ...dateFilter, exact: val, from: '', to: '' })}
                />
                {dateFilter.exact && (
                  <button
                    className="icon-btn"
                    onClick={() => setDateFilter({ ...dateFilter, exact: '' })}
                    style={{ height: '38px', color: 'var(--danger)', background: 'rgba(230,57,70,0.1)', flexShrink: 0, alignSelf: 'flex-end' }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ) : (
              <>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  {t('FILTER BY SPECIFIC DAY')}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="date"
                    className="auth-input"
                    style={{ padding: '8px', fontSize: '0.85rem', height: '38px', flex: 1 }}
                    value={dateFilter.exact}
                    onChange={(e) => setDateFilter({ ...dateFilter, exact: e.target.value, from: '', to: '' })}
                  />
                  {dateFilter.exact && (
                    <button
                      className="icon-btn"
                      onClick={() => setDateFilter({ ...dateFilter, exact: '' })}
                      style={{ height: '38px', color: 'var(--danger)', background: 'rgba(230,57,70,0.1)' }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          <div style={{ margin: '8px 0', height: '1px', background: 'var(--border)', opacity: 0.2 }}></div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 6,
            marginBottom: 4,
            opacity: dateFilter.exact ? 0.3 : 1,
            pointerEvents: dateFilter.exact ? 'none' : 'auto'
          }}>
            {language === 'am' ? (
              <>
                <EthiopianSelector
                  label="ከ"
                  size="small"
                  value={dateFilter.from}
                  language={language}
                  onChange={(val) => setDateFilter({ ...dateFilter, from: val, exact: '' })}
                />
                <EthiopianSelector
                  label="እስከ"
                  size="small"
                  value={dateFilter.to}
                  language={language}
                  onChange={(val) => setDateFilter({ ...dateFilter, to: val, exact: '' })}
                />
              </>
            ) : (
              <>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{t('From').toUpperCase()}</label>
                  <input
                    type="date"
                    className="auth-input"
                    style={{ padding: '8px', fontSize: '0.8rem', height: '36px' }}
                    value={dateFilter.from}
                    onChange={(e) => setDateFilter({ ...dateFilter, from: e.target.value, exact: '' })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{t('To').toUpperCase()}</label>
                  <input
                    type="date"
                    className="auth-input"
                    style={{ padding: '8px', fontSize: '0.8rem', height: '36px' }}
                    value={dateFilter.to}
                    onChange={(e) => setDateFilter({ ...dateFilter, to: e.target.value, exact: '' })}
                  />
                </div>
              </>
            )}
          </div>
          {(dateFilter.from || dateFilter.to) && (
            <button
              className="icon-btn"
              onClick={() => setDateFilter({ ...dateFilter, from: '', to: '' })}
              style={{ alignSelf: 'flex-end', height: '36px', color: 'var(--danger)', background: 'rgba(230,57,70,0.1)' }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="invoice-list">
        {visibleInvoices.length === 0 ? (
          <div className="empty-state">
            <AlertCircle size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p>{t('noGaragesFound')}</p>
          </div>
        ) : (
          visibleInvoices.map(inv => (
            <div
              key={inv.id}
              className={`invoice-card ${selectedInvoice?.id === inv.id ? 'active' : ''}`}
              onClick={() => {
                setSelectedInvoice(inv);
                if (window.innerWidth <= 1100) {
                  setShowMobileDetail(true);
                  setTimeout(() => {
                    document.getElementById('top-of-billing')?.scrollIntoView({ behavior: 'smooth' });
                  }, 10);
                }
              }}
            >
              <div className="invoice-card-header">
                <span className="invoice-id">{inv.id}</span>
                <span className={`status-badge status-${inv.status}`}>
                  {inv.status === 'paid'
                    ? (inv.paymentMethod === 'cash' ? (t("Paid (Cash)")) : t('paidStatus'))
                    : t(inv.status === 'payment-submitted' ? 'Payment Submitted' : 'unpaid')}
                </span>
              </div>
              <div className="invoice-card-body">
                <h4>{inv.customerName}</h4>
                <p className="date-text">{formatDate(inv.date)}</p>
              </div>
              <div className="invoice-card-footer">
                <span className="invoice-total-small">{inv.total?.toLocaleString()} {t('ETB')}</span>
                {inv.hasProof && <div className="proof-indicator" title="Payment proof uploaded"><Smartphone size={14} /></div>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderInvoiceDetail = () => {
    if (!selectedInvoice) return (
      <div className="invoice-detail-section empty-viewer">
        <FileText size={64} style={{ opacity: 0.1, marginBottom: 20 }} />
        <h3>{t('noInvoiceSelected')}</h3>
      </div>
    );

    return (
      <div className="invoice-detail-section" id="invoice-detail-view">
        <div className="viewer-header">
          <div className="mobile-only-back" style={{ display: 'none' }}>
            <button className="btn-text" onClick={() => setShowMobileDetail(false)}>
              <ArrowLeft size={16} /> {t('back')}
            </button>
          </div>
          <div className="currency-selector" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t('currency')}:</span>
            <select 
              value={currency} 
              onChange={(e) => setCurrency(e.target.value)} 
              className="btn-outline-small"
              style={{ backgroundColor: '#ffffff', color: '#000000', border: '1px solid var(--border)' }}
            >
              <option value="ETB">{t('etb')}</option>
            </select>
          </div>
          <div className="viewer-actions">
            <button className="btn-outline-small" onClick={() => window.print()}><Printer size={16} /> {t('print')}</button>
            <button
              className="btn-primary"
              onClick={() => {
                const customer = customers.find(c => c.id === selectedInvoice?.customerId);
                generateInvoicePDF(selectedInvoice, customer, currentUser?.garageName);
              }}
            >
              <Download size={16} /> {t('downloadPDF')}
            </button>
            {(currentUser?.role === 'admin' || currentUser?.role === 'coder' || selectedInvoice.managerId === currentUser?.id) && (
              <button
                className="btn-outline-small"
                style={{ color: 'var(--danger)', borderColor: 'rgba(230,57,70,0.3)' }}
                onClick={() => requestConfirmation(t("Delete this invoice permanently?"), () => {
                  setInvoices(prev => prev.filter(inv => inv.id !== selectedInvoice.id));
                  setSelectedInvoice(null);
                  setShowMobileDetail(false);
                })}
              >
                <Trash2 size={16} /> {t('deleteBtn')}
              </button>
            )}
          </div>
        </div>

        <div className="invoice-paper-wrapper">
          <div className="invoice-paper">
            <div className="invoice-header-grid">
              <div className="invoice-logo-section">
                <h1>{currentUser?.garageName || 'MechPro Garage'}</h1>
                <p>
                  Addis Ababa, Ethiopia<br />
                  Phone: {currentUser?.phone || '+251 911 001122'}<br />
                  Email: {currentUser?.email || 'contact@garage.com'}
                </p>
              </div>
              <div className="invoice-info-section">
                <div className="invoice-title-big">{selectedInvoice.status === 'paid' ? t('receipt') : t('invoice')}</div>
                <div className="info-item"><label>{t('invoiceId')}:</label> {selectedInvoice.id}</div>
                <div className="info-item"><label>{t('invoiceDate')}:</label> {formatDate(selectedInvoice.date)}</div>
                <div className="info-item"><label>{t('dueDate')}:</label> {formatDate(selectedInvoice.dueDate)}</div>
                {selectedInvoice.managerName && (
                  <div className="info-item"><label>{t("Issued By")}:</label> {selectedInvoice.managerName}</div>
                )}
                {(() => {
                  const isMaterialInvoice = !!selectedInvoice.materialRequestId;
                  const isRepairInvoice = !isMaterialInvoice;

                  if (!isRepairInvoice) return null;

                  let mechanicId = selectedInvoice.mechanicId;
                  if (!mechanicId && selectedInvoice.repairId) {
                    const repair = repairs.find(r => String(r.id) === String(selectedInvoice.repairId));
                    if (repair) mechanicId = repair.mechanicId;
                  }

                  let mechanic = staff.find(s => String(s.id) === String(mechanicId));
                  if (!mechanic && selectedInvoice.mechanicName) {
                    mechanic = staff.find(s => s.name?.toLowerCase() === selectedInvoice.mechanicName?.toLowerCase());
                  }
                  if (!mechanic && selectedInvoice.mechanicName) {
                    mechanic = { id: mechanicId, name: selectedInvoice.mechanicName };
                  }

                  if (!mechanic) return null;
                  return (
                    <div className="info-item">
                      <label>{t("Assigned Mechanic")}:</label> {mechanic.name}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="invoice-billing-grid">
              <div className="bill-to">
                <h3>{t('billTo')}</h3>
                <p><strong>{selectedInvoice.customerName}</strong></p>
                <p>{selectedInvoice.customerPhone}</p>
                <p>{selectedInvoice.customerAddress}</p>
              </div>
              <div className="vehicle-details">
                <h3>{t('vehicle')}</h3>
                <p><strong>{selectedInvoice.vehicleInfo}</strong></p>
                <p>{t('plate')}: {selectedInvoice.vehiclePlate}</p>
              </div>
            </div>

            <table className="invoice-table">
              <thead>
                <tr>
                  <th>{t("Item Description")}</th>
                  <th className="text-right">{t("Cost")}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>{t('labor')}</strong><br />
                    <small style={{ color: '#64748b' }}>Technical service and diagnostics</small>
                  </td>
                  <td className="text-right">{formatCurrency(selectedInvoice.laborCost || 0)}</td>
                </tr>
                {/* Hide inventory items on repair invoices */}
                {!!selectedInvoice.materialRequestId && selectedInvoice.items && selectedInvoice.items.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong>{item.description}</strong><br />
                      <small style={{ color: '#64748b' }}>{item.quantity} unit(s) x {item.price}</small>
                    </td>
                    <td className="text-right">{formatCurrency(item.quantity * item.price)}</td>
                  </tr>
                ))}
                {(selectedInvoice.additionalCharges || 0) > 0 && (
                  <tr>
                    <td><strong>{t('additionalCharges')}</strong></td>
                    <td className="text-right">{formatCurrency(selectedInvoice.additionalCharges)}</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="invoice-summary">
              <div className="summary-row">
                <span>{t('subtotal')}</span>
                <span>{formatCurrency(selectedInvoice.subtotal || 0)}</span>
              </div>
              <div className="summary-row">
                <span>{t('tax')} (15%)</span>
                <span>{formatCurrency(selectedInvoice.tax || 0)}</span>
              </div>
              <div className="summary-row">
                <span>{t('discount')}</span>
                <span className="text-success">-{formatCurrency(selectedInvoice.discount || 0)}</span>
              </div>
              <div className="summary-row grand-total">
                <span>{t('total')}</span>
                <span>{formatCurrency(selectedInvoice.total || 0)}</span>
              </div>
            </div>

            <div className="payment-section">
              {(() => {
                const isMaterialInvoice = !!selectedInvoice.materialRequestId;
                const isRepairInvoice = !isMaterialInvoice; // More inclusive

                // ROLE SECURITY: Hide payment account details from Admins/Staff. Only Customer should see them to pay.
                if (currentUser?.role !== 'customer' && currentUser?.role !== 'coder') return null;

                // 1. Identify which accounts to show based on invoice type
                let displayAdminAccounts = adminPaymentDetails.filter(detail => {
                  let role = detail.managerRole;
                  if (!role) {
                    // Check staff list
                    const staffMember = staff.find(s => String(s.id) === String(detail.managerId));
                    role = staffMember?.role;

                    // Critical Fix: Also check against current user if staff lookup fails
                    if (!role && currentUser && String(detail.managerId) === String(currentUser.id)) {
                      role = currentUser.role;
                    }
                  }

                  if (isMaterialInvoice) {
                    return role === 'inventoryManager' || role === 'storekeeper';
                  } else {
                    // Standard repair/service invoice: Show Admins, Cashiers, and anyone NOT inventory-focused
                    return role !== 'inventoryManager' && role !== 'storekeeper';
                  }
                });

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                    {/* Partition 1: Official Payment Target */}
                    {displayAdminAccounts.length > 0 ? (
                      <div className="payment-partition-group">
                        <div style={{
                          padding: '12px 20px',
                          background: isMaterialInvoice ? 'var(--secondary)' : 'var(--primary)',
                          color: 'white',
                          borderRadius: '12px 12px 0 0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontWeight: '700',
                          fontSize: '0.95rem',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}>
                          {isMaterialInvoice ? <Package size={20} /> : <Building size={20} />}
                          {isMaterialInvoice
                            ? (t("Pay to: Inventory Manager"))
                            : (t("Pay to: Admin"))}
                        </div>
                        <div style={{
                          padding: '20px',
                          background: 'white',
                          borderRadius: '0 0 12px 12px',
                          border: `2px solid ${isMaterialInvoice ? 'var(--secondary)' : 'var(--primary)'}`,
                          borderTop: 'none',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: '16px'
                        }}>
                          {displayAdminAccounts.map(detail => (
                            <div key={detail.id} style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                {detail.type === 'bank' ? <Landmark size={14} color={isMaterialInvoice ? 'var(--secondary)' : 'var(--primary)'} /> : <Smartphone size={14} color={isMaterialInvoice ? 'var(--secondary)' : 'var(--primary)'} />}
                                <span style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: '#64748b' }}>{detail.provider}</span>
                              </div>
                              <div style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '4px' }}>{detail.accountName}</div>
                              <div style={{
                                fontFamily: 'monospace',
                                fontSize: '1.15rem',
                                fontWeight: '800',
                                color: isMaterialInvoice ? 'var(--secondary)' : 'var(--primary)',
                                letterSpacing: '0.5px'
                              }}>
                                {currentUser?.role === 'admin'
                                  ? `****${detail.accountNumber?.slice(-4)}`
                                  : detail.accountNumber}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p style={{ opacity: 0.5, fontStyle: 'italic', padding: '10px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                        {t("Please add payment accounts in settings.")}
                      </p>
                    )}

                    {/* Partition 2: Mechanic Bonus (Explicitly separated and strictly for customers) */}
                    {isRepairInvoice && (currentUser?.role === 'customer' || currentUser?.role === 'coder') && (() => {
                      let mechanicId = selectedInvoice.mechanicId;
                      if (!mechanicId && selectedInvoice.repairId) {
                        const repair = repairs.find(r => String(r.id) === String(selectedInvoice.repairId));
                        if (repair) mechanicId = repair.mechanicId;
                      }

                      let mechanic = staff.find(s => String(s.id) === String(mechanicId));
                      if (!mechanic && selectedInvoice.mechanicName) {
                        mechanic = staff.find(s => s.name?.toLowerCase() === selectedInvoice.mechanicName?.toLowerCase());
                      }
                      if (!mechanic && selectedInvoice.mechanicName) {
                        mechanic = { id: mechanicId, name: selectedInvoice.mechanicName };
                      }

                      if (!mechanic) return null;

                      const mechanicAccounts = mechanicPaymentDetails.filter(d => String(d.mechanicId) === String(mechanic.id));
                      if (mechanicAccounts.length === 0) return null;

                      return (
                        <div className="payment-partition-group">
                          <div style={{
                            padding: '10px 20px',
                            background: '#10b981',
                            color: 'white',
                            borderRadius: '12px 12px 0 0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontWeight: '700',
                            fontSize: '0.9rem'
                          }}>
                            <DollarSign size={18} />
                            {t("Optional: Tip for Mechanic", { name: mechanic.name })}
                          </div>
                          <div style={{
                            padding: '16px',
                            background: 'rgba(16, 185, 129, 0.04)',
                            borderRadius: '0 0 12px 12px',
                            border: '2px solid #10b981',
                            borderTop: 'none',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                            gap: '12px'
                          }}>
                            {mechanicAccounts.map(acc => (
                              <div key={acc.id} style={{ padding: '10px', background: 'white', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                  {acc.type === 'bank' ? <Landmark size={12} color="#059669" /> : <Smartphone size={12} color="#059669" />}
                                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#059669' }}>{acc.provider}</span>
                                </div>
                                <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{acc.accountName}</div>
                                <div style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: '700', color: '#059669' }}>{acc.accountNumber}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {displayAdminAccounts.length === 0 && (
                      <p style={{ opacity: 0.5, fontStyle: 'italic', padding: '10px', textAlign: 'center' }}>
                        {t("Please contact us for payment details.")}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            {selectedInvoice.status === 'paid' && (
              <div className="payment-confirmation" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-15deg)', zIndex: 10, border: '5px solid var(--success)', padding: '20px 40px', background: 'rgba(255,255,255,0.9)', opacity: 0.8 }}>
                <h1 style={{ color: 'var(--success)', fontSize: '4rem', fontWeight: 900, margin: 0 }}>
                  {selectedInvoice.paymentMethod === 'cash' ? (t("PAID (CASH)")) : t('paid').toUpperCase()}
                </h1>
                <p style={{ fontWeight: 800 }}>{t("Verified on")} {formatDate(selectedInvoice.verifiedAt || new Date())}</p>
                {selectedInvoice.verifiedBy && <p style={{ fontWeight: 600, fontSize: '0.9rem', color: '#64748b', marginTop: 4, textAlign: 'center' }}>{t("By:")} {selectedInvoice.verifiedBy}</p>}
              </div>
            )}

            {selectedInvoice.hasProof && selectedInvoice.status !== 'paid' && (
              <div style={{ marginTop: 40, padding: 20, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', marginBottom: 12 }}>
                  <Smartphone size={18} /> {t('pendingApproval')}
                </h4>
                <div style={{ fontSize: '0.9rem', color: '#475569' }}>
                  <p><strong>{t('transactionId')}:</strong> {selectedInvoice.proofDetails?.txId || '-'}</p>
                  <p><strong>{t('notes')}:</strong> {selectedInvoice.proofDetails?.note || '-'}</p>
                  <p><strong>Date:</strong> {formatDate(selectedInvoice.proofDetails?.date)}</p>
                  {selectedInvoice.proofDetails?.screenshot && (
                    <div style={{ marginTop: 12 }}>
                      <p style={{ fontWeight: 600, marginBottom: 8 }}>{t("Attached Photo:")}</p>
                      <img src={selectedInvoice.proofDetails.screenshot} alt="Payment Proof" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: 8, border: '1px solid var(--border)' }} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons (Strictly for Customer only) */}
            {['customer', 'coder'].includes(currentUser?.role) && (
              <div className="paper-actions" style={{ marginTop: '10px', padding: '10px', borderTop: '1px dashed #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'payment-submitted' && (
                  <button className="btn-primary" style={{ width: '100%', padding: '14px' }} onClick={() => setShowProofModal(true)}>
                    <Smartphone size={18} /> {t("Upload Payment Screenshot")}
                  </button>
                )}

                {/* STRICT: Only show Bonus button for repair invoices, NEVER for material invoices */}
                {(!selectedInvoice.materialRequestId) && (
                  (() => {
                    const hasSentBonus = bonuses.some(b => String(b.invoiceId) === String(selectedInvoice.id));

                    if (hasSentBonus) {
                      return (
                        <div style={{ textAlign: 'center', padding: 12, background: 'rgba(187, 247, 208, 0.2)', borderRadius: 8, color: '#166534', fontWeight: 600, border: '1px solid #86efac' }}>
                          <CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                          {t("Bonus already sent for this job")}
                        </div>
                      );
                    }

                    return (
                      <button
                        className="give-bonus-btn"
                        style={{ width: '100%', padding: '14px' }}
                        onClick={() => setShowBonusModal(true)}
                      >
                        <DollarSign size={18} />
                        {(() => {
                          let mechanicId = selectedInvoice.mechanicId;
                          if (!mechanicId && selectedInvoice.repairId) {
                            const repair = repairs.find(r => String(r.id) === String(selectedInvoice.repairId));
                            if (repair) mechanicId = repair.mechanicId;
                          }
                          const mechanic = staff.find(s => String(s.id) === String(mechanicId));
                          if (mechanic) {
                            return language === 'en' ? `Give ${mechanic.name} a Bonus` : `ለ${mechanic.name} ጉርሻ ይስጡ`;
                          }
                          return t("Give Mechanic Bonus (Optional)");
                        })()}
                      </button>
                    );
                  })()
                )}

                {selectedInvoice.status === 'payment-submitted' && (
                  <div style={{ textAlign: 'center', padding: 12, background: '#f0fdf4', borderRadius: 8, color: '#16a34a', fontWeight: 600, border: '1px solid #bbf7d0' }}>
                    {t("Payment submitted. Awaiting verification.")}
                  </div>
                )}
              </div>
            )}
            {(selectedInvoice.hasProof || selectedInvoice.status === 'payment-submitted') &&
              (currentUser?.role === 'admin' || currentUser?.role === 'coder' || currentUser?.permissions?.includes('all') || currentUser?.permissions?.includes('billing_manage') || currentUser?.role === 'inventoryManager') && (
                <div className="verification-panel glass-panel" style={{
                  width: '100%',
                  maxWidth: '800px',
                  padding: 20,
                  border: '2px solid var(--primary)',
                  borderRadius: 16,
                  background: 'white',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
                  marginTop: '10px'
                }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--primary)', marginBottom: 15, fontSize: '1.1rem' }}>
                    <CheckCircle size={20} /> {t("Payment Verification")}
                  </h4>

                  <div style={{ marginBottom: 15, fontSize: '0.95rem', background: 'var(--bg-main)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: 12 }}>
                      <p style={{ margin: 0 }}><strong>TX ID:</strong> {selectedInvoice.proofDetails?.txId || 'N/A'}</p>
                      <p style={{ margin: 0, textAlign: 'right' }}><strong>Time:</strong> {formatDate(selectedInvoice.proofDetails?.date)}</p>
                    </div>

                    {selectedInvoice.proofDetails?.screenshot ? (
                      <div style={{ marginTop: 12 }}>
                        <p style={{ fontWeight: 700, marginBottom: 10, color: 'var(--text-main)', fontSize: '0.85rem', textTransform: 'uppercase', opacity: 0.7 }}>
                          {t("Payment Screenshot (Click to View)")}
                        </p>
                        <div
                          onClick={() => setShowImageModal(selectedInvoice.proofDetails.screenshot)}
                          style={{
                            position: 'relative',
                            borderRadius: 12,
                            cursor: 'zoom-in',
                            width: 'fit-content',
                            margin: '0 auto',
                            padding: '4px',
                            background: 'white',
                            border: '2px solid var(--primary)',
                            transition: 'transform 0.2s ease'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          <img
                            src={selectedInvoice.proofDetails.screenshot}
                            alt="Payment Proof"
                            style={{ width: '150px', height: '150px', borderRadius: 8, objectFit: 'cover' }}
                          />
                          <div style={{
                            position: 'absolute',
                            top: -10,
                            right: -10,
                            background: 'var(--primary)',
                            color: 'white',
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                          }}>
                            <Search size={18} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '20px', textAlign: 'center', background: '#fef2f2', borderRadius: '12px', border: '1px dashed #ef4444', color: '#b91c1c' }}>
                        <AlertCircle size={24} style={{ marginBottom: 8 }} />
                        <p style={{ fontWeight: 700, margin: 0 }}>{t("No screenshot uploaded!")}</p>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn-primary flex-1" style={{ padding: '14px', borderRadius: '12px', fontWeight: 800, background: 'var(--success)', border: 'none', fontSize: '1rem' }} onClick={() => updateInvoiceStatus(selectedInvoice.id, 'paid')}>
                      {t("Verify")}
                    </button>
                    <button className="btn-outline-danger" style={{ padding: '14px', borderRadius: '12px', fontWeight: 800, fontSize: '1rem' }} onClick={() => updateInvoiceStatus(selectedInvoice.id, 'rejected')}>
                      {t("Reject")}
                    </button>
                  </div>
                </div>
              )}

            {selectedInvoice.status !== 'paid' && (() => {
              const isRepairInv = selectedInvoice.invoice_type === 'repair' || (!selectedInvoice.materialRequestId && selectedInvoice.invoice_type !== 'inventory');
              const isInventoryInv = selectedInvoice.invoice_type === 'inventory' || !!selectedInvoice.materialRequestId;
              const role = currentUser?.role;

              const canProcessCash = (isRepairInv && ['admin', 'cashier', 'coder'].includes(role)) ||
                (isInventoryInv && ['inventoryManager', 'storekeeper', 'manager'].includes(role));

              if (!canProcessCash) return null;

              return (
                <div className="cash-payment-panel glass-panel" style={{
                  marginTop: '20px',
                  padding: '20px',
                  border: '2px dashed #10b981',
                  borderRadius: '16px',
                  background: '#f0fdf4',
                  width: '100%',
                  maxWidth: '800px',
                }}>
                  <h4 style={{ color: '#059669', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                    <Wallet size={20} /> {t("Direct Cash Payment")}
                  </h4>
                  <p style={{ fontSize: '0.9rem', color: '#166534', marginBottom: '15px' }}>
                    {t("Mark this invoice as paid immediately via cash. No screenshot required.")}
                  </p>
                  <button
                    className="btn-primary"
                    style={{ width: '100%', padding: '14px', background: '#10b981', border: 'none', fontWeight: 'bold', fontSize: '1.05rem', color: 'white', borderRadius: '10px' }}
                    onClick={() => requestConfirmation(t("Confirm cash payment?"), () => updateInvoiceStatus(selectedInvoice.id, 'paid', 'cash'))}
                  >
                    <CheckCircle size={18} style={{ marginRight: '8px' }} />
                    {language === 'en' ? `Mark as Paid (Cash) - ${getCurrencySymbol(currency)} ${selectedInvoice.total?.toLocaleString()}` : `በጥሬ ገንዘብ ተከፍሏል - ${getCurrencySymbol(currency)} ${selectedInvoice.total?.toLocaleString()}`}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  const renderSettings = () => (
    <div className="settings-grid">
      <div className="settings-card" style={{ gridColumn: '1 / -1' }}>
        <h2><Settings size={24} /> {t("Global Billing Preferences")}</h2>
        <form onSubmit={handleSaveGlobalSettings} className="glass-panel" style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, alignItems: 'end' }}>
          <div className="form-group">
            <label style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{t('tax')} (%)</label>
            <input
              type="number"
              className="auth-input"
              value={billingForm.taxRate || ''}
              onChange={(e) => setBillingForm({ ...billingForm, taxRate: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{t('currency')}</label>
            <select
              className="auth-input"
              value={billingForm.currency}
              onChange={(e) => setBillingForm({ ...billingForm, currency: e.target.value })}
              style={{ backgroundColor: '#ffffff', color: '#000000' }}
            >
              <option value="ETB">ETB (Birr)</option>
            </select>
          </div>
          <button type="submit" className="btn-primary" style={{ padding: '12px' }}>
            <Save size={18} /> {t('saveChanges')}
          </button>
        </form>
      </div>

      <div className="settings-card">
        <h2><Landmark size={24} /> {t('bankTransfer')}</h2>
        <div className="payment-details-list">
          {adminPaymentDetails.filter(d => d.type === 'bank' && (currentUser.role === 'admin' || currentUser.role === 'coder' || d.managerId === currentUser.id)).map(detail => (
            <div key={detail.id} className="detail-item glass-panel" style={{ padding: 16, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{detail.provider}</strong>
                <p>{detail.accountName}</p>
                <p>{currentUser?.role === 'admin' && detail.managerId !== currentUser.id ? `****${detail.accountNumber?.slice(-4)}` : detail.accountNumber}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(currentUser.role === 'coder' || detail.managerId === currentUser.id) && (
                  <button className="billing-action-btn" onClick={() => handleEditAccount(detail)}><Edit2 size={16} /></button>
                )}
                <button className="billing-action-btn delete-btn" onClick={() => deletePaymentDetail(detail.id)}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
          <button className="btn-outline" style={{ width: '100%' }} onClick={() => { setEditingAccountId(null); setShowAccountModal('bank'); }}><Plus size={16} /> {t('addAccount')}</button>
        </div>
      </div>
      <div className="settings-card">
        <h2><Smartphone size={24} /> {t('phonePayment')}</h2>
        <div className="payment-details-list">
          {adminPaymentDetails.filter(d => d.type === 'phone' && (currentUser.role === 'admin' || currentUser.role === 'coder' || d.managerId === currentUser.id)).map(detail => (
            <div key={detail.id} className="detail-item glass-panel" style={{ padding: 16, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{detail.provider}</strong>
                <p>{detail.accountName}</p>
                <p>{detail.accountNumber}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="billing-action-btn" onClick={() => handleEditAccount(detail)}><Edit2 size={16} /></button>
                <button className="billing-action-btn delete-btn" onClick={() => deletePaymentDetail(detail.id)}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
          <button className="btn-outline" style={{ width: '100%' }} onClick={() => { setEditingAccountId(null); setShowAccountModal('phone'); }}><Plus size={16} /> {t('addAccount')}</button>
        </div>
      </div>
    </div>
  );

  const renderReports = () => (
    <div className="reports-dashboard">
      <div className="stat-card">
        <div className="stat-label">{t('TOTAL BILLED (ETB)')}</div>
        <div className="stat-value">{stats.total.toLocaleString()}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">{t('TOTAL PAID (ETB)')}</div>
        <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.paid.toLocaleString()}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">{t('OUTSTANDING (ETB)')}</div>
        <div className="stat-value" style={{ color: 'var(--danger)' }}>{stats.unpaid.toLocaleString()}</div>
      </div>
    </div>
  );

  return (
    <div className="page-content billing-page" id="top-of-billing">
      <div className="page-header">
        <div className="header-title">
          <div className="icon-wrapper"><CreditCard size={28} /></div>
          <div>
            <h1>{t('billing')}</h1>
            <p className="subtitle">{t("Manage invoices and multi-currency payments.")}</p>
          </div>
        </div>
        {renderTabs()}
      </div>

      <div className="billing-content">
        {activeTab === 'invoices' && (
          <div className={`billing-layout ${showMobileDetail ? 'viewing-detail' : ''}`}>
            <div className="invoice-list-section">
              <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
                {(currentUser?.permissions?.includes('all') || (currentUser?.permissions?.includes('billing_manage') && !['inventoryManager', 'storekeeper'].includes(currentUser?.role))) && (
                    <button className="btn-primary" style={{ width: '100%', padding: '12px' }} onClick={() => setShowInvoiceForm(true)}>
                      <FilePlus size={20} /> {t("Create New Invoice")}
                    </button>
                )}
              </div>
              <div className="invoice-list">
                {renderInvoiceList()}
              </div>
            </div>
            {renderInvoiceDetail()}
          </div>
        )}

        {/* --- Full Image Zoom Modal --- */}
        {showImageModal && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <button
              onClick={() => setShowImageModal(null)}
              style={{
                position: 'absolute',
                top: 20, right: 20,
                background: 'white',
                border: 'none',
                borderRadius: '50%',
                width: 40, height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
            >
              <X size={24} />
            </button>
            <div style={{
              flex: 1,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              <img
                src={showImageModal}
                alt="Zoomed"
                style={{
                  maxWidth: '95vw',
                  maxHeight: '85vh',
                  objectFit: 'contain',
                  borderRadius: 8,
                  boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                }}
              />
            </div>
            <div style={{ marginTop: 20, display: 'flex', gap: 15 }}>
              <a
                href={showImageModal}
                download="payment_proof.png"
                className="btn-primary"
                style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
              >
                <Download size={18} /> {t("Download Full Image")}
              </a>
            </div>
          </div>
        )}

        {showInvoiceForm && (
          <InvoiceForm
            onClose={() => setShowInvoiceForm(false)}
            onSave={handleSaveInvoice}
          />
        )}

        {showProofModal && (
          <div className="modal-overlay" onClick={() => setShowProofModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
              maxWidth: '400px',
              width: '92%',
              height: '500px',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              backgroundColor: 'var(--bg-card)',
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
              margin: 'auto'
            }}>

              <div className="modal-header" style={{
                flexShrink: 0,
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--primary)',
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 10
              }}>
                <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700, color: 'white' }}>{t('uploadProof')}</h2>
                <button type="button" className="close-modal-btn" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => setShowProofModal(false)}>
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Body container with minHeight: 0 to force flexbox shrinking */}
              <div className="modal-body" style={{
                flex: 1,
                overflowY: 'auto',
                minHeight: 0,
                padding: '20px',
                WebkitOverflowScrolling: 'touch'
              }}>
                <form id="perfect-proof-form" onSubmit={handleSubmitProof}>
                  <div className="form-group" style={{ marginBottom: 20 }}>
                    <label style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>{t('transactionId')}</label>
                    <input
                      type="text"
                      className="auth-input"
                      placeholder="e.g. TXN1000200"
                      value={proofData.txId}
                      onChange={(e) => setProofData({ ...proofData, txId: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 20 }}>
                    <label style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>{t('notes')}</label>
                    <textarea
                      className="auth-input"
                      rows="2"
                      placeholder={t("Sender name, details...")}
                      value={proofData.note}
                      onChange={(e) => setProofData({ ...proofData, note: e.target.value })}
                    ></textarea>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      {t('screenshot')} *
                      {proofData.screenshot && (
                        <button type="button" onClick={() => setProofData({ ...proofData, screenshot: null })} style={{ color: 'var(--danger)', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                          {t("Remove")}
                        </button>
                      )}
                    </label>

                    <label
                      htmlFor="perfect-file-input"
                      style={{
                        border: '2px dashed var(--primary)',
                        borderRadius: '12px',
                        padding: '16px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: proofData.screenshot ? 'rgba(67, 97, 238, 0.05)' : 'var(--bg-main)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '120px',
                        overflow: 'hidden'
                      }}
                    >
                      <input
                        id="perfect-file-input"
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        required={!proofData.screenshot}
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => setProofData({ ...proofData, screenshot: reader.result });
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      {proofData.screenshot ? (
                        <div style={{ textAlign: 'center', width: '100%' }}>
                          <img src={proofData.screenshot} style={{ maxWidth: '100%', maxHeight: '160px', borderRadius: '8px', objectFit: 'contain' }} alt="Receipt" />
                          <p style={{ marginTop: 8, color: 'var(--success)', fontWeight: 700, fontSize: '0.85rem' }}>✓ {t("Ready to Send")}</p>
                        </div>
                      ) : (
                        <div style={{ opacity: 0.6, textAlign: 'center' }}>
                          <Smartphone size={36} style={{ marginBottom: 8, color: 'var(--primary)' }} />
                          <p style={{ fontWeight: 600, fontSize: '0.9rem', margin: 0 }}>{t("Tap to pick receipt photo")}</p>
                        </div>
                      )}
                    </label>
                  </div>
                </form>
              </div>

              {/* Fixed Footer */}
              <div className="modal-footer" style={{
                flexShrink: 0,
                padding: '16px 20px',
                borderTop: '1px solid var(--border)',
                background: 'var(--bg-card)',
                display: 'flex',
                zIndex: 10
              }}>
                <button
                  type="submit"
                  form="perfect-proof-form"
                  className="btn-primary"
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '12px',
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    boxShadow: '0 4px 12px rgba(67, 97, 238, 0.2)'
                  }}
                >
                  {t('submitConfirmation')}
                </button>
              </div>

            </div>
          </div>
        )}

        {showAccountModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header" style={{ flexShrink: 0, padding: '20px', borderBottom: '1px solid var(--border)' }}>
                <h2 style={{ margin: 0 }}>{editingAccountId ? (t("Edit Account")) : (showAccountModal === 'bank' ? t('addAccount') : t('phonePayment'))}</h2>
                <button type="button" className="icon-btn" onClick={() => { setShowAccountModal(null); setEditingAccountId(null); }}><Plus size={24} style={{ transform: 'rotate(45deg)' }} /></button>
              </div>
              <form className="modal-body" onSubmit={handleAddAccount}>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>{showAccountModal === 'bank' ? t('bankName') : t('appType')}</label>
                  <select
                    className="auth-input"
                    required
                    value={newAccount.provider}
                    onChange={(e) => setNewAccount({ ...newAccount, provider: e.target.value })}
                  >
                    <option value="">-- {t('select')} --</option>
                    {showAccountModal === 'bank' ? (
                      <>
                        <option value="Commercial Bank of Ethiopia (CBE)">Commercial Bank of Ethiopia (CBE)</option>
                        <option value="Awash Bank">Awash Bank</option>
                        <option value="Dashen Bank">Dashen Bank</option>
                        <option value="Bank of Abyssinia">Bank of Abyssinia</option>
                        <option value="Hibret Bank">Hibret Bank</option>
                        <option value="Zemen Bank">Zemen Bank</option>
                        <option value="Wegagen Bank">Wegagen Bank</option>
                        <option value="Cooperative Bank of Oromia">Cooperative Bank of Oromia</option>
                        <option value="Nib International Bank">Nib International Bank</option>
                        <option value="Other Bank">Other</option>
                      </>
                    ) : (
                      <>
                        <option value="Telebirr">Telebirr</option>
                        <option value="CBE Birr">CBE Birr</option>
                        <option value="M-Pesa">M-Pesa</option>
                        <option value="Awash Birr">Awash Birr</option>
                        <option value="HelloCash">HelloCash</option>
                        <option value="Other Mobile Money">Other</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>{showAccountModal === 'bank' ? t('accountHolder') : t('receiverName')}</label>
                  <input
                    type="text"
                    className="auth-input"
                    placeholder="Name"
                    required
                    value={newAccount.accountName}
                    onChange={(e) => setNewAccount({ ...newAccount, accountName: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>{t('accountNumber')} / {t('phone')}</label>
                  <input
                    type="text"
                    className="auth-input"
                    placeholder={showAccountModal === 'bank' ? "1000..." : "09..."}
                    required
                    value={newAccount.accountNumber}
                    onChange={(e) => setNewAccount({ ...newAccount, accountNumber: e.target.value })}
                  />
                </div>
                {showAccountModal === 'bank' && (
                  <div className="form-group" style={{ marginBottom: 24 }}>
                    <label>{t('branch')} ({t("Opt.")})</label>
                    <input
                      type="text"
                      className="auth-input"
                      placeholder="e.g. Bole Branch"
                      value={newAccount.branch}
                      onChange={(e) => setNewAccount({ ...newAccount, branch: e.target.value })}
                    />
                  </div>
                )}
                <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px' }}>
                  {editingAccountId ? t('saveChanges') : t('add')}
                </button>
              </form>
            </div>
          </div>
        )}

        {showBonusModal && (
          <div className="modal-overlay" onClick={() => setShowBonusModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
              maxWidth: '400px',
              width: '92%',
              height: '500px',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              backgroundColor: 'var(--bg-card)',
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
              margin: 'auto'
            }}>

              <div className="modal-header" style={{
                flexShrink: 0,
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                background: '#10b981',
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 10
              }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0, fontSize: '1.1rem', color: 'white' }}>
                  <DollarSign size={20} />
                  {t("Pay to Mechanic")}
                </h2>
                <button type="button" className="close-modal-btn" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => setShowBonusModal(false)}>
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="modal-body" style={{
                flex: 1,
                overflowY: 'auto',
                minHeight: 0,
                padding: '20px',
                WebkitOverflowScrolling: 'touch'
              }}>
                {(() => {
                  let mechanicId = selectedInvoice.mechanicId;
                  if (!mechanicId && selectedInvoice.repairId) {
                    const repair = repairs.find(r => String(r.id) === String(selectedInvoice.repairId));
                    if (repair) mechanicId = repair.mechanicId;
                  }

                  let mechanic = staff.find(s => String(s.id) === String(mechanicId));

                  // New Robust Fallback: Search by name if ID fails
                  if (!mechanic && selectedInvoice.mechanicName) {
                    mechanic = staff.find(s => s.name?.toLowerCase() === selectedInvoice.mechanicName?.toLowerCase());
                  }

                  // Final Fallback: Fake object for old invoices/missing staff
                  if (!mechanic && selectedInvoice.mechanicName) {
                    mechanic = { id: mechanicId, name: selectedInvoice.mechanicName };
                  }

                  if (!mechanic) return (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                      <AlertCircle size={64} style={{ opacity: 0.1, marginBottom: 20, color: 'var(--danger)' }} />
                      <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)' }}>
                        {t("Mechanic Not Found")}
                      </h3>
                      <p style={{ fontWeight: 500, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                        {t("We couldn\'t find the assigned mechanic for this job. Please contact the front desk to give a bonus.")}
                      </p>
                      <button
                        className="btn-text"
                        onClick={() => setShowBonusModal(false)}
                        style={{ marginTop: 24, fontWeight: 700, color: 'var(--primary)' }}
                      >
                        {t("← Back to Invoice")}
                      </button>
                    </div>
                  );

                  // PERFECT FIX: Hybrid lookup (ID + Name) to catch all edge cases
                  const accounts = mechanicPaymentDetails.filter(d => {
                    // 1. Primary: Direct ID match
                    const idMatch = d.mechanicId && mechanic.id && String(d.mechanicId) === String(mechanic.id);
                    if (idMatch) return true;

                    // 2. Secondary: Name match (if name is stored on account)
                    const nameOnAccountMatch = d.mechanicName && mechanic.name && d.mechanicName.toLowerCase() === mechanic.name.toLowerCase();
                    if (nameOnAccountMatch) return true;

                    // 3. Tertiary: Cross-reference (if ID points to a staff member with the same name)
                    if (d.mechanicId && mechanic.name) {
                      const staffMember = staff.find(s => String(s.id) === String(d.mechanicId));
                      if (staffMember && staffMember.name?.toLowerCase() === mechanic.name.toLowerCase()) return true;
                    }

                    return false;
                  });

                  return (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', padding: '12px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                        <div style={{ width: '40px', height: '40px', background: '#10b981', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', flexShrink: 0 }}>
                          {mechanic.name?.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'black' }}>{mechanic.name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#059669' }}>{t("Assigned Mechanic")}</div>
                        </div>
                      </div>

                      {accounts.length > 0 ? (
                        <div style={{ display: 'grid', gap: '16px', marginBottom: '20px' }}>
                          {accounts.map(acc => (
                            <div key={acc.id} className="glass-panel" style={{
                              padding: '20px',
                              background: 'white',
                              borderRadius: '16px',
                              border: '2px solid #e2e8f0',
                              position: 'relative',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}>
                              <div style={{
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                padding: '6px 12px',
                                background: acc.type === 'bank' ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'linear-gradient(135deg, #10b981, #059669)',
                                color: 'white',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                borderRadius: '0 0 0 12px'
                              }}>
                                {acc.type === 'bank' ? (t("BANK")) : (t("MOBILE"))}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                <div style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '8px',
                                  background: '#f1f5f9',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  {acc.type === 'bank' ? <Landmark size={18} color="#3b82f6" /> : <Smartphone size={18} color="#10b981" />}
                                </div>
                                <span style={{ fontWeight: 800, color: '#475569', fontSize: '1rem' }}>{acc.provider}</span>
                              </div>

                              <div style={{
                                background: '#f8fafc',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '10px'
                              }}>
                                <div style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'monospace', color: '#1e293b', letterSpacing: '1px' }}>
                                  {currentUser?.role === 'admin'
                                    ? `****${acc.accountNumber?.slice(-4)}`
                                    : acc.accountNumber}
                                </div>
                                {currentUser?.role !== 'admin' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(acc.accountNumber);
                                      addNotification(t("Account number copied!"), 'success');
                                    }}
                                    style={{
                                      background: 'var(--primary)',
                                      color: 'white',
                                      border: 'none',
                                      padding: '6px 10px',
                                      borderRadius: '6px',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {t("COPY")}
                                  </button>
                                )}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#64748b' }}>
                                  {acc.accountName}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '30px 20px', background: '#fff1f2', borderRadius: '12px', border: '1px solid #fecaca', marginBottom: '20px' }}>
                          <AlertCircle size={32} color="#e11d48" style={{ marginBottom: 12 }} />
                          <p style={{ fontWeight: 600, color: '#9f1239' }}>{t("Mechanic has not added payment details yet.")}</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <form id="perfect-bonus-form" onSubmit={handleSendBonus}>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 8, display: 'block' }}>{t('Bonus Amount (ETB)')}</label>
                    <input
                      type="number"
                      className="auth-input"
                      placeholder={t("Enter amount")}
                      value={bonusAmount}
                      onChange={(e) => setBonusAmount(e.target.value)}
                      required
                      style={{ background: 'var(--bg-main)' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      {t('Payment Screenshot')}
                      {bonusScreenshot && (
                        <button type="button" onClick={() => setBonusScreenshot(null)} style={{ color: 'var(--danger)', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                          {t('Remove')}
                        </button>
                      )}
                    </label>
                    <label
                      style={{
                        border: '2px dashed var(--primary)',
                        borderRadius: 12,
                        padding: 16,
                        textAlign: 'center',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '120px',
                        background: bonusScreenshot ? 'rgba(67, 97, 238, 0.05)' : 'var(--bg-main)'
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        required={!bonusScreenshot}
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => setBonusScreenshot(reader.result);
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      {bonusScreenshot ? (
                        <div style={{ position: 'relative', width: '100%' }}>
                          <img src={bonusScreenshot} style={{ maxWidth: '100%', maxHeight: '160px', borderRadius: 8, objectFit: 'contain' }} alt="Bonus Proof" />
                          <div style={{ marginTop: 8, color: 'var(--success)', fontWeight: 700, fontSize: '0.8rem' }}>✓ {t('Image Selected')}</div>
                        </div>
                      ) : (
                        <div style={{ opacity: 0.6 }}>
                          <ImageIcon size={32} style={{ marginBottom: 8, color: 'var(--primary)' }} />
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t('Tap to upload proof of transfer')}</div>
                        </div>
                      )}
                    </label>
                  </div>
                </form>
              </div>

              {/* Fixed Footer */}
              <div className="modal-footer" style={{
                flexShrink: 0,
                padding: '16px 20px',
                borderTop: '1px solid var(--border)',
                background: 'var(--bg-card)',
                display: 'flex',
                zIndex: 10
              }}>
                <button
                  type="submit"
                  form="perfect-bonus-form"
                  className="btn-primary"
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '12px',
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    background: '#10b981',
                    border: 'none',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                  }}
                >
                  {t("Send Bonus")}
                </button>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'settings' && renderSettings()}
        {activeTab === 'reports' && renderReports()}
      </div>
    </div>
  );
};

export default Billing;
