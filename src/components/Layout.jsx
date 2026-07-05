import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Wrench, Users, Car, ClipboardList, Package, CreditCard, LayoutDashboard, Calendar, CalendarClock } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';
import SubscriptionHeaderAlert from './SubscriptionHeaderAlert';
import CallOverlay from './CallOverlay';
import GlobalConfirmationBar from './GlobalConfirmationBar';
import BottomNav from './BottomNav';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

const Layout = () => {
  const { currentUser, getPaymentRequests } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // REAL-TIME ACCESS CONTROL
  const isSuspended = currentUser?.role === 'admin' && 
                     (currentUser.status === 'suspended' || currentUser.subscription?.status === 'suspended') &&
                     currentUser.subscription?.type !== 'unlimited';

  const pendingPayment = isSuspended ? getPaymentRequests().find(req => req.adminId === currentUser.id && req.status === 'pending') : null;

  // Intercept all clicks to blocked action buttons
  useEffect(() => {
    if (!isSuspended) return;

    const handleCapture = (e) => {
      const el = e.target.closest('button, a, input[type="submit"]');
      if (!el) return;

      // Unblock structural layers: Sidebar, BottomNav, TopHeader, and the Confirmation Bar
      const inSafeArea = el.closest('.sidebar, .bottom-nav, .top-header, .global-confirm-bar');
      
      // Specifically Block normal messaging view routing if suspended
      if (inSafeArea && el.getAttribute('href') === '/messaging') {
         e.stopPropagation();
         e.preventDefault();
         setShowTooltip(true);
         setTooltipPos({ x: e.clientX, y: e.clientY });
         return;
      }

      // Allow navigation clicks to standard read-only views and structural elements
      if (inSafeArea || el.classList.contains('allow-suspended')) return;

      // Allow SubscriptionPage operations implicitly
      const inSubscription = el.closest('.sub-page-root');
      if (inSubscription) return;

      // Allow Support/Internal Messaging implicitly
      const inSupport = el.closest('.internal-msg-root');
      if (inSupport) return;

      // Otherwise, block any button clicks globally and show tooltip
      e.stopPropagation();
      e.preventDefault();
      
      setShowTooltip(true);
      setTooltipPos({ x: e.clientX, y: e.clientY });
    };

    document.addEventListener('click', handleCapture, true);
    return () => document.removeEventListener('click', handleCapture, true);
  }, [isSuspended]);

  // Hide tooltip after a short delay
  useEffect(() => {
    if (showTooltip) {
      const timer = setTimeout(() => setShowTooltip(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showTooltip]);

  // If suspended, force route away from /messaging to /support or dashboard
  useEffect(() => {
    if (isSuspended && location.pathname === '/messaging') {
      navigate('/support');
    }
  }, [isSuspended, location, navigate]);

  return (
    <div className={`app-container ${isSuspended ? 'app-suspended-mode' : ''}`}>
      <Sidebar />
      <div className="main-wrapper">
        {isSuspended && (
          <div className="suspension-global-banner" style={{
            background: pendingPayment ? '#f59e0b' : '#ef4444',
            color: 'white',
            padding: '12px 20px',
            textAlign: 'center',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '15px',
            position: 'sticky',
            top: 0,
            zIndex: 9999
          }}>
            {pendingPayment ? (
              <span>Payment Under Review — Your access will be restored once approved.</span>
            ) : (
              <>
                <span>Account Suspended – Subscription Renewal Required.</span>
                <button className="allow-suspended" onClick={() => navigate('/subscription')} style={{
                  background: 'white', color: '#ef4444', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer'
                }}>Renew Subscription</button>
              </>
            )}
          </div>
        )}

        <SubscriptionHeaderAlert />
        <Header />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      {/* If suspended, hide CallOverlay to prevent incoming global calls outside messaging */}
      {!isSuspended && <CallOverlay />}
      <GlobalConfirmationBar />
      <GlobalToasts />
      
      {/* Dynamic Tooltip for Blocked Actions */}
      {showTooltip && (
        <div style={{
          position: 'fixed',
          left: tooltipPos.x,
          top: tooltipPos.y - 40,
          background: '#1e293b',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: '500',
          zIndex: 100000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          pointerEvents: 'none',
          transform: 'translateX(-50%)'
        }}>
          Subscription Required to Continue.
        </div>
      )}
    </div>
  );
};

const GlobalToasts = () => {
  const context = useAppContext();
  const navigate = useNavigate();
  if (!context) return null;
  const { toasts } = context;
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div 
          key={t.id} 
          className={`toast ${t.type} ${t.link ? 'clickable' : ''}`}
          onClick={() => t.link && navigate(t.link)}
          style={{ cursor: t.link ? 'pointer' : 'default' }}
        >
          <div className="toast-message">{t.message}</div>
        </div>
      ))}
    </div>
  );
};

export default Layout;
