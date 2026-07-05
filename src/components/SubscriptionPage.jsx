import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import {
   Zap, Clock, CheckCircle2, AlertTriangle, Send,
   Upload, Camera, X, CreditCard, Landmark, Radio,
   History, Calendar, Copy, ChevronRight, Info
} from 'lucide-react';
import './SubscriptionPage.css';

const SubscriptionPage = () => {
   const {
      currentUser, getPlatformSettingsAsync, getPaymentRequestsAsync,
      submitPaymentRequestAsync, updateAccountInfo
   } = useAuth();
   const { t } = useAppContext();

   const [settings, setSettings] = useState(null);
   const [requests, setRequests] = useState([]);
   const [selectedPlan, setSelectedPlan] = useState(null);
   const [payType, setPayType] = useState('bank');
   const [receipt, setReceipt] = useState(null);
   const [notes, setNotes] = useState('');
   const [refNum, setRefNum] = useState('');
   const [showPayModal, setShowPayModal] = useState(false);
   const [copyStatus, setCopyStatus] = useState(null);
   const [selectedBankId, setSelectedBankId] = useState(null);
   const [bankError, setBankError] = useState(false);
   const [showReceiptView, setShowReceiptView] = useState(null);

   const [loading, setLoading] = useState(true);

   useEffect(() => {
      const loadData = async () => {
         setLoading(true);
         try {
            const [setts, reqs] = await Promise.all([
               getPlatformSettingsAsync(),
               getPaymentRequestsAsync()
            ]);
            setSettings(setts);
            setRequests(reqs.filter(r => r.adminId === currentUser.id));
         } finally {
            setLoading(false);
         }
      };
      loadData();
   }, [getPlatformSettingsAsync, getPaymentRequestsAsync, currentUser.id]);

   const handleCopy = (text, id) => {
      navigator.clipboard.writeText(text);
      setCopyStatus(id);
      setTimeout(() => setCopyStatus(null), 2000);
   };

   const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (file) {
         const reader = new FileReader();
         reader.onloadend = () => setReceipt(reader.result);
         reader.readAsDataURL(file);
      }
   };

   const handleSubmitPayment = async () => {
      if (!selectedBankId) {
         setBankError(true);
         return;
      }
      if (!selectedPlan || !receipt) return;

      setLoading(true);
      try {
         const selectedBank = (settings?.paymentMethods || []).find(m => m.id === selectedBankId);

         const result = await submitPaymentRequestAsync({
            adminId: currentUser.id,
            garageId: currentUser.ownerId,
            planId: selectedPlan.id,
            amount: selectedPlan.price,
            receipt: receipt,
            referenceNumber: refNum,
            notes: notes,
            planName: selectedPlan.name,
            bankId: selectedBankId,
            bankName: selectedBank?.provider,
            bankAccount: selectedBank?.accountNumber || selectedBank?.mobileNumber
         });

         if (result.success) {
            const updatedReqs = await getPaymentRequestsAsync();
            setRequests(updatedReqs.filter(r => r.adminId === currentUser.id));
            setShowPayModal(false);
            setSelectedPlan(null);
            setReceipt(null);
            setRefNum('');
            setNotes('');
            setSelectedBankId(null);
            setBankError(false);
         }
      } finally {
         setLoading(false);
      }
   };

   if (loading && !settings) return <div className="sub-page-loading">Loading subscription details...</div>;

   const trialDays = settings?.trialDays || 14;
   const sub = currentUser.subscription || {
      type: 'trial',
      status: 'active',
      startDate: currentUser.createdAt || new Date().toISOString(),
      expiryDate: new Date(new Date(currentUser.createdAt || Date.now()).getTime() + trialDays * 86400000).toISOString()
   };

   const parseDate = (d) => {
      const parsed = new Date(d);
      return isNaN(parsed) ? new Date() : parsed;
   };

   const expiry = parseDate(sub.expiryDate);
   const start = parseDate(sub.startDate);
   const diffTime = expiry - new Date();
   const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
   const isExpiringSoon = sub.status === 'active' && diffDays <= 3 && sub.type !== 'unlimited';
   const isExpired = sub.status === 'suspended' || (sub.type !== 'unlimited' && diffTime <= 0);

   const totalDays = Math.max(0, Math.ceil((expiry - start) / (1000 * 60 * 60 * 24)));

   const pendingRequests = requests.filter(r => r.status === 'pending');
   const rejectedRequests = requests.filter(r => r.status === 'rejected');
   const approvedRequests = requests.filter(r => r.status === 'approved');

   return (
      <div className="sub-page-root">
         <div className="sub-page-header">
            <div>
               <h1 className="sub-page-title">{t("Subscription Management")}</h1>
               <p className="sub-page-sub">{t("Manage your plan, payments, and account status")} {currentUser?.garage?.displayId ? ` | Garage ID: ${currentUser.garage.displayId}` : ''}</p>
            </div>
            <div className="sub-status-header">
               <div className={`sub-status-pill ${isExpired ? 'expired' : sub.type}`}>
                  {isExpired ? t('EXPIRED') : (sub.type === 'unlimited' ? t('UNLIMITED ACCESS') : `${t(sub.type.toUpperCase() + ' PLAN')}`)}
               </div>
            </div>
         </div>

         {(isExpiringSoon || isExpired) && (
            <div className={`sub-alert ${isExpired ? 'danger' : 'warning'}`}>
               <AlertTriangle size={20} />
               <div>
                  <strong>{isExpired ? t('Account Suspended!') : t('Plan Expiring Soon!')}</strong>
                  <p>{isExpired ? t('Your access has been limited. Please renew your subscription to continue.') : `${t('Plan Expiring Soon!')}`}</p>
               </div>
            </div>
         )}

         {pendingRequests.length > 0 && (
            <div className="sub-alert info">
               <Clock size={20} />
               <div>
                  <strong>{t("Payment Verification Pending")}</strong>
                  <p>{t("We received your payment. Verification is usually completed within 1-2 hours.")}</p>
               </div>
            </div>
         )}

         <div className="sub-grid">
            {/* CURRENT SUBSCRIPTION CARD */}
            <div className="sub-main-card">
               <div className="card-inner">
                  <div className="card-top">
                     <div className="plan-icon">
                        {sub.type === 'active' ? <CheckCircle2 size={32} /> : (sub.type === 'unlimited' ? <Zap size={32} /> : <Clock size={32} />)}
                     </div>
                     <div>
                        <h3 className="curr-plan-name">{sub.type === 'unlimited' ? t('Lifetime Access') : (sub.type === 'trial' ? t('Free Trial') : t('Professional Plan'))}</h3>
                        <p className="curr-plan-desc">{sub.type === 'unlimited' ? t('Lifetime Access') : `Access expires on ${expiry.toLocaleDateString()}`}</p>
                     </div>
                  </div>

                  <div className="card-stats">
                     <div className="stat-item">
                        <span className="stat-label">{t("Status")}</span>
                        <span className={`stat-value status-${isExpired ? 'suspended' : 'active'}`}>
                           {sub?.type === 'unlimited' ? t('Lifetime Access') : (isExpired ? t('EXPIRED') : t('Operational'))}
                        </span>
                     </div>
                     <div className="stat-item">
                        <span className="stat-label">{t("Remaining Time")}</span>
                        <span className="stat-value">
                           {sub?.type === 'unlimited' ? '∞' : (
                              <div className="days-breakdown">
                                 <span className="days-current">{diffDays}</span>
                                 <span className="days-separator">/</span>
                                 <span className="days-total">{totalDays}</span>
                                 <span className="days-unit">{t('days')}</span>
                              </div>
                           )}
                        </span>
                     </div>
                     <div className="stat-item">
                        <span className="stat-label">{t("Access Type")}</span>
                        <span className="stat-value" style={{ color: sub?.type === 'unlimited' ? '#fbbf24' : 'inherit' }}>
                           {sub?.type === 'unlimited' ? t('Lifetime Access') : (sub?.type === 'trial' ? t('Free Trial') : t('Professional Plan'))}
                        </span>
                     </div>
                     <div className="stat-item">
                        <span className="stat-label">{t("Started On")}</span>
                        <span className="stat-value">{start.toLocaleDateString()}</span>
                     </div>
                  </div>

                  {sub.type !== 'unlimited' && (
                     <div className="auto-renew-notice">
                        <Info size={14} />
                        <span>{t("Automatic suspension applies if not renewed by")} {expiry.toLocaleDateString()}</span>
                     </div>
                  )}
               </div>
            </div>

            {/* PENDING & REJECTED REQUESTS */}
            <div className="sub-history-card">
               <div className="card-header">
                  <h3><Clock size={18} /> {t("Pending & Rejected Requests")}</h3>
               </div>
               <div className="history-list">
                  {pendingRequests.length === 0 && rejectedRequests.length === 0 ? (
                     <div className="history-empty">No active requests.</div>
                  ) : (
                     <>
                        {pendingRequests.map(req => (
                           <div key={req.id} className="history-item">
                              <div className="hist-main">
                                 <div className="hist-info">
                                    <div className="hist-plan">{req.planName}</div>
                                    <div className="hist-date">{new Date(req.createdAt).toLocaleDateString()}</div>
                                 </div>
                                 <div className="hist-status pending">{t('pending')}</div>
                              </div>
                           </div>
                        ))}
                        {rejectedRequests.map(req => (
                           <div key={req.id} className="history-item">
                              <div className="hist-main">
                                 <div className="hist-info">
                                    <div className="hist-plan">{req.planName}</div>
                                    <div className="hist-date">{new Date(req.createdAt).toLocaleDateString()}</div>
                                 </div>
                                 <div className="hist-status rejected">{t('rejected')}</div>
                              </div>
                              <div className="hist-reason">Reason: {req.rejectionReason}</div>
                           </div>
                        ))}
                     </>
                  )}
               </div>
            </div>
         </div>

         <div className="sub-section-header">
            <h2>{t("Upgrade or Renew Your Plan")}</h2>
            <p>{t("Select a tiered plan that fits your business needs.")}</p>
         </div>

         <div className="plans-cards-grid">
            {(settings?.plans || []).filter(p => !p.status || p.status === 'active').map(p => (
               <div key={p.id} className="plan-offer-card">
                  <div className="offer-header">
                     <h3>{p.name}</h3>
                     <div className="offer-price">{p.price} ETB</div>
                     <div className="offer-duration">{p.duration} Days Access</div>
                  </div>
                  <ul className="offer-features">
                     <li><Check size={14} /> Full Dashboard Access</li>
                     <li><Check size={14} /> Unlimited Staff Accounts</li>
                     <li><Check size={14} /> SMS & Email Notifications</li>
                     <li><Check size={14} /> Priority Support</li>
                  </ul>
                  <button
                     className="select-plan-btn"
                     onClick={() => { setSelectedPlan(p); setShowPayModal(true); }}
                     disabled={pendingRequests.length > 0}
                  >
                     {pendingRequests.length > 0 ? t('Verification in Progress') : t('Select Plan')}
                  </button>
               </div>
            ))}
         </div>

         {/* SUBSCRIPTION HISTORY (APPROVED) */}
         <div className="sub-section-header" style={{ marginTop: '60px' }}>
            <h2><History size={20} /> {t("Subscription History")}</h2>
            <p>{t("Full record of your approved subscription plans.")}</p>
         </div>

         <div className="sub-table-container">
            <table className="sub-history-table">
               <thead>
                  <tr>
                     <th>{t("Plan Name")}</th>
                     <th>{t("Amount")}</th>
                     <th>{t("Submission Date")}</th>
                     <th>{t("Approval Date")}</th>
                     <th>{t("Status")}</th>
                     <th style={{ textAlign: 'right' }}>{t("Actions")}</th>
                  </tr>
               </thead>
               <tbody>
                  {approvedRequests.length === 0 ? (
                     <tr><td colSpan="6" className="empty-row">{t("No approved subscriptions found.")}</td></tr>
                  ) : (
                     approvedRequests.slice().reverse().map(req => (
                        <tr key={req.id}>
                           <td>
                              <div className="hist-plan-cell">
                                 <Zap size={14} className="cell-icon" />
                                 {req.planName}
                              </div>
                           </td>
                           <td className="fw-700">{req.amount} ETB</td>
                           <td className="text-muted">{new Date(req.createdAt).toLocaleDateString()}</td>
                           <td className="text-success fw-600">{req.approvedAt ? new Date(req.approvedAt).toLocaleDateString() : '—'}</td>
                           <td><span className="badge-active-sub">{t('Active History')}</span></td>
                           <td style={{ textAlign: 'right' }}>
                              <button className="view-receipt-btn" onClick={() => { setReceipt(req.receipt); setShowPayModal(false); /* Using a different modal state or similar */ setNotes(req.notes || ''); setRefNum(req.referenceNumber || ''); setSelectedPlan({name: req.planName, price: req.amount}); /* Reusing modal for view */ setShowReceiptView(req); }}>
                                 <Camera size={14} /> {t("Receipt")}
                              </button>
                           </td>
                        </tr>
                     ))
                  )}
               </tbody>
            </table>
         </div>

         {showPayModal && (
            <div className="sap-modal-overlay">
               <div className="sap-modal" style={{ maxWidth: 540 }}>
                  <div className="sap-modal-header">
                     <div>
                        <h3 className="sap-modal-title">{t("Payment Submission")}</h3>
                        <p className="sap-modal-sub">{t("Step 2: Pay & Upload Receipt")}</p>
                     </div>
                     <button className="sap-modal-close" onClick={() => setShowPayModal(false)}><X size={20} /></button>
                  </div>
                  <div className="sap-modal-body">
                     <div className="plan-summary-bar">
                        <span>Selected Plan: <strong>{selectedPlan.name}</strong></span>
                        <span>Amount: <strong>{selectedPlan.price} ETB</strong></span>
                     </div>

                     <div className="pay-tabs">
                        <button className={`pay-tab ${payType === 'bank' ? 'active' : ''}`} onClick={() => setPayType('bank')}>
                           <Landmark size={14} /> {t("Bank Accounts")}
                        </button>
                        <button className={`pay-tab ${payType === 'mobile' ? 'active' : ''}`} onClick={() => setPayType('mobile')}>
                           <Radio size={14} /> {t("Mobile Banking")}
                        </button>
                     </div>

                     <div style={{ margin: '16px 0 12px', paddingBottom: 8, borderBottom: '1px solid var(--glass-border)' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#4361ee', display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                           <span style={{ background: '#4361ee', color: '#fff', width: 22, height: 22, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>01</span>
                           {t("Select Chosen Bank Account")}
                        </div>
                     </div>

                     <div className="pay-accounts-list">
                        {bankError && (
                           <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <AlertCircle size={14} /> Please select a bank account to continue.
                           </div>
                        )}
                        {(settings?.paymentMethods || []).filter(m => m.type === payType && m.status === 'active').map(m => (
                           <div
                              key={m.id}
                              className={`pay-account-card ${selectedBankId === m.id ? 'selected' : ''}`}
                              onClick={() => { setSelectedBankId(m.id); setBankError(false); }}
                              style={{
                                 cursor: 'pointer',
                                 position: 'relative',
                                 border: selectedBankId === m.id ? '2px solid #4361ee' : '1px solid var(--glass-border)',
                                 background: selectedBankId === m.id ? 'rgba(67, 97, 238, 0.05)' : 'rgba(255, 255, 255, 0.03)'
                              }}
                           >
                              <div className="acc-main">
                                 <div>
                                    <div className="acc-provider" style={{ color: selectedBankId === m.id ? '#4361ee' : 'inherit', fontWeight: 700 }}>{m.provider}</div>
                                    <div className="acc-number" style={{ fontSize: '1.1rem', fontWeight: 800, color: '#4361ee' }}>{m.type === 'bank' ? m.accountNumber : m.mobileNumber}</div>
                                    <div className="acc-name">{m.accountName}</div>
                                 </div>
                                 <button className="copy-btn" onClick={(e) => { e.stopPropagation(); handleCopy(m.type === 'bank' ? m.accountNumber : m.mobileNumber, m.id); }}>
                                    {copyStatus === m.id ? <Check size={14} /> : <Copy size={14} />}
                                 </button>
                              </div>
                              {m.instructions && (
                                 <div style={{
                                    marginTop: 8,
                                    padding: '6px 10px',
                                    borderRadius: 4,
                                    background: selectedBankId === m.id ? 'rgba(67, 97, 238, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                                    fontSize: '0.8rem',
                                    borderLeft: '2px solid #4361ee',
                                    color: 'rgba(255, 255, 255, 0.8)',
                                    textAlign: 'left'
                                 }}>
                                    <strong>Instructions:</strong> {m.instructions}
                                 </div>
                              )}
                              {selectedBankId === m.id && (
                                 <div style={{ position: 'absolute', top: 10, right: 10, color: '#4361ee' }}>
                                    <CheckCircle2 size={18} />
                                 </div>
                              )}
                           </div>
                        ))}
                     </div>

                     <div className="sap-form-row">
                        <div className="sap-form-group" style={{ flex: 1 }}>
                           <label className="sap-form-label">{t("Transfer Reference #")}</label>
                           <input
                              type="text" className="sap-form-input"
                              placeholder={t("Opt.")}
                              value={refNum}
                              onChange={e => setRefNum(e.target.value)}
                           />
                        </div>
                        <div className="sap-form-group" style={{ flex: 1 }}>
                           <label className="sap-form-label">{t("notes")}</label>
                           <input
                              type="text" className="sap-form-input"
                              placeholder={t("Opt.")}
                              value={notes}
                              onChange={e => setNotes(e.target.value)}
                           />
                        </div>
                     </div>

                     <div className="sap-form-group">
                        <label className="sap-form-label">{t("Payment Receipt Screenshot")}</label>
                        <div className="receipt-dropzone">
                           {receipt ? (
                              <div className="receipt-preview-wrap">
                                 <img src={receipt} alt="Preview" />
                                 <button className="remove-preview" onClick={() => setReceipt(null)}><X size={14} /></button>
                              </div>
                           ) : (
                              <label className="dropzone-label">
                                 <input type="file" accept="image/*" onChange={handleFileChange} hidden />
                                 <Camera size={24} />
                                 <span>{t("Click to upload payment screenshot")}</span>
                              </label>
                           )}
                        </div>
                     </div>
                  </div>
                  <div className="sap-modal-footer">
                     <button className="sap-btn-ghost" onClick={() => setShowPayModal(false)}>{t("cancel")}</button>
                     <button
                        className="sap-btn-primary"
                        disabled={!receipt || !selectedBankId}
                        onClick={handleSubmitPayment}
                     >
                        <Send size={16} /> {t("Submit Payment Request")}
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* RECEIPT VIEW MODAL */}
         {showReceiptView && (
            <div className="sap-modal-overlay">
               <div className="sap-modal" style={{ maxWidth: 480 }}>
                  <div className="sap-modal-header">
                     <div>
                        <h3 className="sap-modal-title">{t("Payment Proof")}</h3>
                        <p className="sap-modal-sub">{showReceiptView.planName} - {showReceiptView.amount} ETB</p>
                     </div>
                     <button className="sap-modal-close" onClick={() => setShowReceiptView(null)}><X size={20} /></button>
                  </div>
                  <div className="sap-modal-body">
                     <div className="receipt-view-container">
                        <img src={showReceiptView.receipt} alt="Receipt" className="full-receipt-img" />
                     </div>
                     <div className="receipt-details-list">
                        <div className="rd-item"><strong>{t("Reference #")}:</strong> {showReceiptView.referenceNumber || 'N/A'}</div>
                        <div className="rd-item"><strong>{t("Bank")}:</strong> {showReceiptView.bankName || 'N/A'}</div>
                        <div className="rd-item"><strong>{t("Notes")}:</strong> {showReceiptView.notes || 'No notes provided'}</div>
                     </div>
                  </div>
                  <div className="sap-modal-footer">
                     <button className="sap-btn-primary" onClick={() => setShowReceiptView(null)}>{t("Close")}</button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};

const Check = ({ size }) => (
   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
   </svg>
);

export default SubscriptionPage;
