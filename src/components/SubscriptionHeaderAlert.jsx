import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertTriangle, Zap, X } from 'lucide-react';

const SubscriptionHeaderAlert = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  // Only relevant for Admin users
  if (!currentUser || currentUser.role !== 'admin' || currentUser.subscription?.type === 'unlimited' || dismissed) return null;
  
  // Don't show on the subscription page itself
  if (location.pathname === '/subscription' || location.pathname === '/subscription-required') return null;

  const sub = currentUser.subscription;
  if (!sub) return null;

  const expiry = new Date(sub.expiryDate);
  const diffTime = expiry - new Date();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Show if 3 days or less remaining
  if (diffDays > 3) return null;

  const isExpired = sub.status === 'suspended' || diffTime <= 0;

  return (
    <div className={`sub-header-alert ${isExpired ? 'expired' : 'warning'}`}>
      <div className="alert-content">
        <AlertTriangle size={18} />
        <div className="alert-text">
          {isExpired ? (
             <span><strong>Action Required:</strong> Your subscription has expired. Access is limited.</span>
          ) : (
             <span><strong>Trial Ending Soon:</strong> Your access expires in {diffDays} {diffDays === 1 ? 'day' : 'days'}.</span>
          )}
        </div>
      </div>
      <div className="alert-actions">
        <button className="alert-btn-main" onClick={() => navigate('/subscription')}>
          {isExpired ? 'Renew Now' : 'Upgrade Plan'} <Zap size={14} />
        </button>
        <button className="alert-close" onClick={() => setDismissed(true)}><X size={16} /></button>
      </div>
    </div>
  );
};

export default SubscriptionHeaderAlert;
