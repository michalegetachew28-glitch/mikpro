import React, { useState, useMemo, useEffect } from 'react';
import { CreditCard, History, Banknote, ShieldCheck, Image as ImageIcon, CheckCircle2, Clock, X, AlertCircle, Save, Landmark, Smartphone, Plus, Trash2, Globe, Edit2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import './Bonus.css';

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
  "Enat Bank",
  "Gadaa Bank",
  "Amhara Bank",
  "Siinqee Bank",
  "Tsedey Bank",
  "ZamZam Bank (Interest Free)",
  "Hijra Bank (Interest Free)"
];

const ETHIOPIAN_MOBILE_SERVICES = [
  "Telebirr",
  "CBE Birr",
  "M-Pesa",
  "Awash Birr",
  "HelloCash",
  "Amole"
];

const Bonus = () => {
  const {
    bonuses, setBonuses, mechanicPaymentDetails, setMechanicPaymentDetails,
    t, language, formatDate, addNotification, staff, customers, invoices,
    addItem, deleteItem, sendMessage, logActivity, updateItem, requestConfirmation
  } = useAppContext();
  const { currentUser } = useAuth();

  const [activeScreenshot, setActiveScreenshot] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAccount, setNewAccount] = useState({ type: 'bank', provider: '', accountName: '', accountNumber: '' });
  const [editingAccount, setEditingAccount] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'Paid', 'Pending', 'Tips' (count)

  const isMechanic = currentUser?.role === 'mechanic';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'coder';

  // Filter bonuses based on role and active dashboard filter
  const filteredBonuses = useMemo(() => {
    let base = bonuses;
    if (isAdmin) {
      // Prompt says Admin cannot access or view this module. 
      // But if they somehow get here (e.g. coder), we show nothing or just errors.
      // However, we already restricted routing. 
      return [];
    }

    if (isMechanic) {
      base = bonuses.filter(b => String(b.mechanicId) === String(currentUser.id));
    } else {
      return [];
    }

    if (filter === 'Paid') return base.filter(b => b.status === 'Paid');
    if (filter === 'Pending') return base.filter(b => b.status === 'Pending' || b.status === 'Submitted' || b.status === 'Verified');

    return base;
  }, [bonuses, isAdmin, isMechanic, currentUser?.id, filter]);

  // Mechanic's own payment details (Multiple)
  const myAccounts = useMemo(() => {
    return mechanicPaymentDetails.filter(d => String(d.mechanicId) === String(currentUser?.id));
  }, [mechanicPaymentDetails, currentUser?.id]);

  const handleAddAccount = (e) => {
    e.preventDefault();

    // Validation
    if (!newAccount.provider) {
      addNotification('Please select a bank or service provider', 'error');
      return;
    }

    if (newAccount.type === 'mobile') {
      const phoneRegex = /^(09|07)\d{8}$/;
      if (!phoneRegex.test(newAccount.accountNumber)) {
        addNotification('Please enter a valid Ethiopian phone number (09... or 07...)', 'error');
        return;
      }
    } else {
      if (newAccount.accountNumber.length < 8) {
        addNotification('Account number seems too short', 'error');
        return;
      }
    }

    const accountData = {
      ...newAccount,
      mechanicId: currentUser.id,
      mechanicName: currentUser.name, // Save name for robust lookups
      updatedAt: new Date().toISOString()
    };

    if (editingAccount) {
      updateItem('mechanicPaymentDetails', editingAccount.id, accountData);
      addNotification('Payment method updated successfully', 'success');
    } else {
      accountData.createdAt = new Date().toISOString();
      addItem('mechanicPaymentDetails', accountData);
      addNotification('Payment method added successfully', 'success');
    }

    setShowAddModal(false);
    setEditingAccount(null);
    setNewAccount({ type: 'bank', provider: '', accountName: '', accountNumber: '' });
  };

  const handleEditAccount = (acc) => {
    setEditingAccount(acc);
    setNewAccount({
      type: acc.type || 'bank',
      provider: acc.provider || '',
      accountName: acc.accountName || '',
      accountNumber: acc.accountNumber || ''
    });
    setShowAddModal(true);
  };

  const handleRemoveAccount = (id) => {
    requestConfirmation(
      t("Are you sure you want to remove this payment method?"),
      () => {
        deleteItem('mechanicPaymentDetails', id);
        addNotification('Payment method removed', 'info');
      }
    );
  };

  const updateBonusStatus = (bonusId, newStatus) => {
    setBonuses(prev => prev.map(b =>
      b.id === bonusId ? { ...b, status: newStatus, updatedAt: new Date().toISOString() } : b
    ));

    const bonus = bonuses.find(b => b.id === bonusId);
    if (bonus) {
      if (newStatus === 'Verified') {
        addNotification(`Bonus verified for ${bonus.amount} ETB`, 'success', bonus.mechanicId);
        logActivity('Bonus Verified', `Mechanic ${currentUser.name} verified a bonus of ${bonus.amount} ETB (ID: ${bonus.id})`);
      }

      if (newStatus === 'Paid') {
        logActivity('Bonus Paid', `Bonus (ID: ${bonus.id}) marked as paid to mechanic ${bonus.mechanicName || bonus.mechanicId}`);

        // Automated Thank-You Message to Customer
        const customer = customers.find(c => c.id === bonus.customerId);
        if (customer) {
          const thanksText = language === 'en'
            ? `Thank you for your bonus to the mechanic! Your support is greatly appreciated. (Amount: ${bonus.amount} ETB)`
            : `ለሜካኒኩ ለሰጡት ጉርሻ እናመሰግናለን! የእርስዎ ድጋፍ በጣም ይደነቃል። (መጠን: ${bonus.amount} ETB)`;

          addNotification(t("Thank you message sent to customer"), 'info');

          // Actually sending the message to the customer
          sendMessage(customer.id, thanksText, 'text');
        }
      }
    }
  };

  const stats = useMemo(() => {
    const myTotalBonuses = bonuses.filter(b => String(b.mechanicId) === String(currentUser?.id));
    const total = myTotalBonuses.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    const paid = myTotalBonuses.filter(b => b.status === 'Paid').reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    const pending = myTotalBonuses.filter(b => b.status !== 'Paid').reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

    return { total, paid, pending, count: myTotalBonuses.length };
  }, [bonuses, currentUser?.id]);

  return (
    <div className="bonus-container">
      <div className="page-header">
        <div className="header-title">
          <div className="icon-wrapper">
            <Landmark size={28} />
          </div>
          <div>
            <h1>{t("Bonus Management")}</h1>
            <p className="subtitle">{t("Track your tips and manage payment methods")}</p>
          </div>
        </div>
      </div>

      <div className="bonus-stats">
        <div
          className={`bonus-stat-card clickable ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          <span className="bonus-stat-label">{t("Total Earned")}</span>
          <span className="bonus-stat-value">{stats.total.toLocaleString()} ETB</span>
        </div>
        <div
          className={`bonus-stat-card clickable ${filter === 'Paid' ? 'active' : ''}`}
          onClick={() => setFilter('Paid')}
        >
          <span className="bonus-stat-label">{t("Total Paid")}</span>
          <span className="bonus-stat-value" style={{ color: 'var(--success)' }}>{stats.paid.toLocaleString()} ETB</span>
        </div>
        <div
          className={`bonus-stat-card clickable ${filter === 'Pending' ? 'active' : ''}`}
          onClick={() => setFilter('Pending')}
        >
          <span className="bonus-stat-label">{t("Pending")}</span>
          <span className="bonus-stat-value" style={{ color: 'var(--warning)' }}>{stats.pending.toLocaleString()} ETB</span>
        </div>
        <div
          className="bonus-stat-card"
        >
          <span className="bonus-stat-label">{t("Total Tips")}</span>
          <span className="bonus-stat-value">{stats.count}</span>
        </div>
      </div>

      <div className="bonus-grid">
        <div className="bonus-history-card">
          <h3 className="card-title">
            <History size={20} />
            {t("Bonus History")}
          </h3>

          <div className="bonus-list">
            {filteredBonuses.length === 0 ? (
              <div className="empty-bonus">
                <AlertCircle size={40} style={{ opacity: 0.3, marginBottom: 10 }} />
                <p>{t("No bonus records found.")}</p>
              </div>
            ) : (
              filteredBonuses.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(bonus => {
                const customer = customers.find(c => c.id === bonus.customerId);
                const mechanic = staff.find(s => s.id === bonus.mechanicId);

                return (
                  <div key={bonus.id} className="bonus-record-item">
                    <div className="bonus-info">
                      <span className="bonus-customer">
                        {isAdmin ? `From: ${customer?.name || 'Unknown'} To: ${mechanic?.name || 'Unknown'}` : (customer?.name || 'Customer')}
                      </span>
                      <span className="bonus-date">{formatDate(bonus.timestamp)}</span>
                      {bonus.jobId && <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Job ID: {bonus.jobId}</span>}
                    </div>

                    <div className="bonus-amount-status">
                      <span className="bonus-amount">{bonus.amount} ETB</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {bonus.screenshot && (
                          <img
                            src={bonus.screenshot}
                            className="screenshot-preview"
                            alt="Proof"
                            onClick={() => setActiveScreenshot(bonus)}
                          />
                        )}
                        <span className={`status-tag status-${bonus.status.toLowerCase()}`}>
                          {bonus.status}
                        </span>
                      </div>

                      {isMechanic && (bonus.status === 'Submitted' || bonus.status === 'Verified') && (
                        <div className="bonus-actions">
                          {bonus.status === 'Submitted' && (
                            <button
                              className="btn-outline-small"
                              onClick={() => updateBonusStatus(bonus.id, 'Verified')}
                              style={{ color: 'var(--success)', borderColor: 'var(--success)' }}
                            >
                              <CheckCircle2 size={14} /> {t("Verify Proof")}
                            </button>
                          )}
                          {bonus.status === 'Verified' && (
                            <button
                              className="btn-outline-small"
                              onClick={() => updateBonusStatus(bonus.id, 'Paid')}
                              style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}
                            >
                              <Banknote size={14} /> {t("Mark as Paid")}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {isMechanic && (
          <div className="payment-details-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 className="card-title" style={{ marginBottom: 0 }}>
                <CreditCard size={20} />
                {t("My Payment Options")}
              </h3>
              <button className="btn-primary" style={{ padding: '8px 12px' }} onClick={() => setShowAddModal(true)}>
                <Plus size={18} />
              </button>
            </div>

            <div className="payment-display">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {myAccounts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px', opacity: 0.5, fontStyle: 'italic', background: 'var(--bg-main)', borderRadius: 12 }}>
                    {t("No payment methods added yet. Click + to add.")}
                  </div>
                ) : (
                  myAccounts.map(acc => (
                    <div key={acc.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 16,
                      background: 'var(--bg-main)',
                      borderRadius: 12,
                      border: '1px solid var(--border)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {acc.type === 'bank' ? <Landmark size={20} style={{ color: 'var(--primary)' }} /> : <Smartphone size={20} style={{ color: 'var(--success)' }} />}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{acc.provider}</div>
                          <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{acc.accountNumber}</div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{acc.accountName}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="icon-btn" onClick={() => handleEditAccount(acc)} style={{ color: 'var(--primary)', padding: 8 }}>
                          <Edit2 size={16} />
                        </button>
                        <button className="icon-btn-danger" onClick={() => handleRemoveAccount(acc.id)} style={{ color: 'var(--danger)', padding: 8 }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ marginTop: 20, padding: 15, background: 'rgba(67, 97, 238, 0.05)', borderRadius: 12, fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', gap: 8, color: 'var(--primary)', marginBottom: 5 }}>
                <ShieldCheck size={16} />
                <span style={{ fontWeight: 700 }}>Privacy & Security</span>
              </div>
              Your details are only visible to customers during bonus payment. We support all major Ethiopian banks and mobile money services.
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {editingAccount ? <Edit2 size={20} /> : <Plus size={20} />}
                {editingAccount
                  ? (t("Edit Payment Method"))
                  : (t("Add Payment Method"))}
              </h3>
              <button className="btn-text" onClick={() => { setShowAddModal(false); setEditingAccount(null); }}><X size={20} /></button>
            </div>
            <form className="modal-body" onSubmit={handleAddAccount} style={{ padding: 20 }}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Method Type</label>
                <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                  <button
                    type="button"
                    className={`btn-outline-small ${newAccount.type === 'bank' ? 'active' : ''}`}
                    onClick={() => setNewAccount({ ...newAccount, type: 'bank', provider: '' })}
                    style={{ flex: 1, padding: 10, background: newAccount.type === 'bank' ? 'var(--primary)' : 'transparent', color: newAccount.type === 'bank' ? 'white' : 'inherit' }}
                  >
                    Bank Account
                  </button>
                  <button
                    type="button"
                    className={`btn-outline-small ${newAccount.type === 'mobile' ? 'active' : ''}`}
                    onClick={() => setNewAccount({ ...newAccount, type: 'mobile', provider: '' })}
                    style={{ flex: 1, padding: 10, background: newAccount.type === 'mobile' ? 'var(--primary)' : 'transparent', color: newAccount.type === 'mobile' ? 'white' : 'inherit' }}
                  >
                    Mobile Money
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>{newAccount.type === 'bank' ? 'Select Bank' : 'Select Service'}</label>
                <select
                  className="auth-input"
                  value={newAccount.provider}
                  onChange={e => setNewAccount({ ...newAccount, provider: e.target.value })}
                  required
                >
                  <option value="">-- Choose {newAccount.type === 'bank' ? 'Bank' : 'Service'} --</option>
                  {(newAccount.type === 'bank' ? ETHIOPIAN_BANKS : ETHIOPIAN_MOBILE_SERVICES).map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>{newAccount.type === 'bank' ? 'Account Name' : 'Recipient Name'}</label>
                <input
                  type="text"
                  className="auth-input"
                  value={newAccount.accountName}
                  onChange={e => setNewAccount({ ...newAccount, accountName: e.target.value })}
                  placeholder="Full Legal Name"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 24 }}>
                <label>{newAccount.type === 'bank' ? 'Account Number' : 'Phone Number'}</label>
                <input
                  type="text"
                  className="auth-input"
                  value={newAccount.accountNumber}
                  onChange={e => setNewAccount({ ...newAccount, accountNumber: e.target.value })}
                  placeholder={newAccount.type === 'bank' ? "1000..." : "09..."}
                  required
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: 14 }}>
                <Save size={18} /> Save Payment Method
              </button>
            </form>
          </div>
        </div>
      )}

      {activeScreenshot && (
        <div className="modal-overlay" onClick={() => setActiveScreenshot(null)}>
          <div className="modal-content screenshot-modal" onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <h3>Payment Proof</h3>
              <button className="btn-text" onClick={() => setActiveScreenshot(null)}><X size={20} /></button>
            </div>
            <div style={{ padding: 20, textAlign: 'center' }}>
              <img src={activeScreenshot.screenshot} className="screenshot-img" alt="Proof" />
              <div style={{ textAlign: 'left', background: 'var(--bg-main)', padding: 15, borderRadius: 12 }}>
                <div style={{ fontWeight: 600 }}>Amount: {activeScreenshot.amount} ETB</div>
                <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Date: {formatDate(activeScreenshot.timestamp)}</div>
                <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Customer: {customers.find(c => c.id === activeScreenshot.customerId)?.name}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bonus;
