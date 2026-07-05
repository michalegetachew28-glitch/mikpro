import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { ShieldAlert, CreditCard, Landmark, Radio, Send, CheckCircle2, Clock, Upload, Camera, X, AlertTriangle } from 'lucide-react';
import './SubscriptionRequired.css';

const SubscriptionRequired = () => {
  const { currentUser, getPlatformSettings, submitPaymentRequest, logout } = useAuth();
  const { t } = useAppContext();
  const [settings, setSettings] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [step, setStep] = useState(1); // 1: Plans, 2: Pay/Upload
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();
  // Use settings from platform instead of hardcoded
  const subscriptionPlans = settings?.plans || [];

  useEffect(() => {
    // Sync settings in real-time
    const syncSettings = (e) => {
      if (e.key === 'garage_platform_settings') {
        setSettings(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', syncSettings);
    return () => window.removeEventListener('storage', syncSettings);
  }, []);

  useEffect(() => {
    if (currentUser?.subscription?.status === 'active' || currentUser?.subscription?.type === 'unlimited') {
       navigate('/dashboard');
    }
    setSettings(getPlatformSettings());
  }, [currentUser, getPlatformSettings, navigate]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setReceipt(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (!selectedPlan || !receipt) return;
    
    submitPaymentRequest({
      adminId: currentUser.id,
      garageId: currentUser.ownerId,
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      amount: selectedPlan.price,
      receipt: receipt,
      createdAt: new Date().toISOString(),
      status: 'pending'
    });
    setSubmitted(true);
  };

  if (!settings) return null;

  if (submitted) {
    return (
      <div className="sub-req-root">
        <div className="sub-req-card sent-success">
          <CheckCircle2 size={64} color="#10b981" />
          <h2>{t("Payment Request Sent!")}</h2>
          <p>{t("Our team is verifying your payment. Your access will be restored automatically once approved (usually within 1-2 hours).")}</p>
          <button className="sub-btn-primary" onClick={() => navigate('/login')}>{t("Back to Login")}</button>
        </div>
      </div>
    );
  }

  const isSuspended = currentUser?.status === 'suspended' || currentUser?.subscription?.status === 'suspended';
  const suspensionReason = currentUser?.subscription?.lastRejectionReason || "Subscription period expired or payment verification failed.";

  return (
    <div className="sub-req-root">
      <div className="sub-req-card">
        <div className="sub-req-header">
           <div className={`status-icon-wrap ${isSuspended ? 'suspended' : 'expired'}`}>
             {isSuspended ? <ShieldAlert size={32} /> : <Clock size={32} />}
           </div>
           <div>
             <h2>{isSuspended ? t('Account Suspended') : t('Subscription Required')}</h2>
             <p className="status-badge-inline">{isSuspended ? t('Restricted Access') : t('Trial Expired')}</p>
           </div>
        </div>

        {isSuspended && (
          <div className="suspension-alert-box">
             <div className="alert-header">
               <AlertTriangle size={16} />
               <span>Reason for Restriction</span>
             </div>
             <p className="reason-text">{suspensionReason}</p>
             <p className="instruction-text">{t("Account access restricted until payment approval.")}</p>
          </div>
        )}

        {step === 1 ? (
          <div className="sub-step-content">
            <p className="step-desc">Select a subscription plan to restore full system access.</p>
            <div className="plans-grid">
              {subscriptionPlans.map(p => (
                <div 
                  key={p.id} 
                  className={`plan-card ${selectedPlan?.id === p.id ? 'active' : ''}`}
                  onClick={() => setSelectedPlan(p)}
                >
                  <div className="plan-name">{p.name}</div>
                  <div className="plan-price">{p.price} <span className="currency">ETB</span></div>
                  <div className="plan-duration">{p.duration} Days</div>
                </div>
              ))}
            </div>
            <div className="sub-card-footer">
               <button className="sub-btn-ghost" onClick={() => { logout(); navigate('/login'); }}>Sign Out</button>
               <button 
                 className="sub-btn-primary" 
                 disabled={!selectedPlan}
                 onClick={() => setStep(2)}
               >
                 {t("Next: Payment Details")} <Send size={16} />
               </button>
            </div>
          </div>
        ) : (
          <div className="sub-step-content">
             <div className="payment-instructions">
                <h4>1. Make payment (ETB) to one of our accounts:</h4>
                <div className="bank-list">
                  {settings.paymentMethods.filter(m => m.status === 'active').map(m => (
                    <div key={m.id} className="bank-item">
                      <div className="bank-icon">
                        {m.type === 'bank' ? <Landmark size={18} /> : <Radio size={18} />}
                      </div>
                      <div className="bank-details">
                        <div className="bank-name">{m.provider}</div>
                        <div className="bank-acc">{m.type === 'bank' ? m.accountNumber : m.mobileNumber}</div>
                        <div className="bank-owner">{m.accountName}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <h4 style={{ marginTop: 24 }}>2. Upload payment evidence:</h4>
                <div className="receipt-upload-area">
                  {receipt ? (
                    <div className="receipt-preview">
                      <img src={receipt} alt="Payment Receipt" />
                      <button className="remove-receipt" onClick={() => setReceipt(null)}><X size={16} /></button>
                    </div>
                  ) : (
                    <label className="upload-placeholder">
                      <input type="file" accept="image/*" onChange={handleFileChange} hidden />
                      <div className="upload-icon-circle"><Camera size={32} /></div>
                      <div className="upload-text">Upload Receipt Screenshot</div>
                      <div className="upload-subtext">JPG or PNG supported</div>
                    </label>
                  )}
                </div>
             </div>

             <div className="sub-card-footer">
               <button className="sub-btn-ghost" onClick={() => setStep(1)}>Back to Plans</button>
               <button 
                 className="sub-btn-primary" 
                 disabled={!receipt}
                 onClick={handleSubmit}
               >
                 {t("Submit Request")} <CheckCircle2 size={16} />
               </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionRequired;
