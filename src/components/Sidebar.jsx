import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Car, Wrench, Package, CreditCard, CalendarClock, BriefcaseBusiness, LogOut, Settings as SettingsIcon, Navigation, Briefcase, Download, History, ClipboardList, Moon, Sun, Globe, Landmark, MessageSquare, LayoutGrid, Zap, Plus } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import InstallPWA from './InstallPWA';
import './InstallPWA.css';

const Sidebar = () => {
  const { 
    t, language, setLanguage, isSidebarOpen, setIsSidebarOpen, 
    darkMode, toggleDarkMode, requestConfirmation, messages, internalMessages
  } = useAppContext();
  const { currentUser, logout } = useAuth();
  const location = useLocation();

  const isItemActive = (path) => {
    const currentPath = location.pathname;
    const currentHash = location.hash;

    if (path.includes('#')) {
      const [base, hash] = path.split('#');
      const isBaseMatch = currentPath === base;
      const isHashMatch = currentHash === '#' + hash;
      
      // Default case: if no hash on /billing, highlight 'invoices'
      if (isBaseMatch && !currentHash && hash === 'invoices') return true;
      
      return isBaseMatch && isHashMatch;
    }
    return currentPath === path;
  };

  const role = currentUser?.role || 'customer';
  const isAdmin = role === 'admin' || role === 'coder';
  
  const unreadMessagesCount = (messages || []).filter(m => 
    m.recipientId === currentUser?.id && !m.read
  ).length;
  
  const unreadInternalCount = (internalMessages || []).filter(m => 
    m.recipientId === currentUser?.id && !m.read
  ).length;

  const getSubBadge = () => {
    if (!currentUser || currentUser.role !== 'admin') return null;
    const sub = currentUser.subscription;
    if (!sub) return { text: 'Free', color: '#64748b' };
    if (sub.type === 'unlimited') return { text: 'Unlimited', color: '#8b5cf6' };
    if (sub.status === 'suspended') return { text: 'Expired', color: '#ef4444' };
    
    // Check if there's a pending request
    const pendingReq = JSON.parse(localStorage.getItem('garage_payment_requests') || '[]')
      .find(r => r.adminId === currentUser.id && r.status === 'pending');
    if (pendingReq) return { text: 'Pending', color: '#f59e0b' };

    if (sub.type === 'trial') return { text: 'Trial', color: '#3b82f6' };
    return { text: 'Active', color: '#10b981' };
  };

  const subBadge = getSubBadge();

  const sections = [
    {
      title: t("GENERAL"),
      items: [
        { path: '/dashboard', label: t('dashboard'), icon: <LayoutDashboard size={20} />, roles: ['admin', 'mechanic', 'customer', 'manager', 'coder', 'receptionist', 'cashier', 'storekeeper', 'inventoryManager'] },
        { path: '/subscription', label: t('Subscription'), icon: <Zap size={20} />, badge: subBadge?.text, badgeColor: subBadge?.color, roles: ['admin', 'coder'] },
        { path: '/messages', label: t('Messages'), icon: <MessageSquare size={20} />, badge: unreadMessagesCount > 0 ? unreadMessagesCount : null, roles: ['admin', 'mechanic', 'customer', 'manager', 'coder', 'receptionist', 'cashier', 'storekeeper', 'inventoryManager'] },
        { path: '/support', label: t('Support'), icon: <Briefcase size={20} />, badge: unreadInternalCount > 0 ? unreadInternalCount : null, roles: ['admin'] },
        { path: '/tracker', label: t('Live Tracking'), icon: <Navigation size={20} />, roles: ['admin', 'mechanic', 'customer', 'manager', 'coder', 'cashier'] },
        { path: '/', label: t('homeLanding'), icon: <Navigation size={20} rotate={180} />, roles: ['admin', 'mechanic', 'customer', 'manager', 'coder', 'receptionist', 'cashier', 'storekeeper', 'inventoryManager'] },
      ]
    },
    {
      title: t("OPERATIONS"),
      items: [
        { path: '/appointments', label: t('appointments'), icon: <CalendarClock size={20} />, roles: ['admin', 'receptionist', 'customer', 'manager', 'coder'] },
        { path: '/customers', label: t('customers'), icon: <Users size={20} />, roles: ['admin', 'receptionist', 'manager', 'coder', 'cashier'] },
        { path: '/vehicles', label: t('vehicles'), icon: <Car size={20} />, roles: ['admin', 'mechanic', 'receptionist', 'manager', 'coder', 'cashier'] },
        { path: '/repairs', label: t('repairs'), icon: <Wrench size={20} />, roles: ['admin', 'mechanic', 'receptionist', 'manager', 'coder'] },
        { path: '/attendance', label: t('Attendance'), icon: <ClipboardList size={20} />, roles: ['admin', 'manager', 'coder'] },
        { path: '/bonus', label: t("Bonus"), icon: <Landmark size={20} />, roles: ['mechanic', 'coder'] },
      ]
    },
    {
      title: t("INVENTORY"),
      items: [
        { path: '/inventory', label: t('inventory'), icon: <Package size={20} />, roles: ['storekeeper', 'inventoryManager', 'coder'] },
        { path: '/material-requests', label: t('materialRequests'), icon: <ClipboardList size={20} />, roles: ['storekeeper', 'inventoryManager', 'manager', 'mechanic', 'coder'] },
      ]
    },
    {
      title: t("BILLING"),
      items: [
        { path: '/billing#invoices', label: t('invoices'), icon: <ClipboardList size={20} />, roles: ['admin', 'cashier', 'customer', 'coder'] },
        { path: '/billing#reports', label: t('financialReports'), icon: <History size={20} />, roles: ['admin', 'coder'] },
      ]
    },
    {
      title: t("PAYMENTS"),
      items: [
        { path: '/billing#settings', label: t("Payment Accounts"), icon: <CreditCard size={20} />, roles: ['admin', 'coder'] },
        { path: '/salary', label: t("Salary Management"), icon: <Landmark size={20} />, roles: ['admin', 'mechanic', 'cashier', 'receptionist', 'storekeeper', 'manager', 'coder'] },
      ]
    },
    {
      title: t("SYSTEM"),
      items: [
        { path: '/staff', label: t('staff'), icon: <BriefcaseBusiness size={20} />, roles: ['admin', 'coder'] },
        { path: '/activity', label: t('activityLogs'), icon: <History size={20} />, roles: ['coder'] },
        { path: '/backup', label: t("Backup Data"), icon: <Download size={20} />, roles: ['admin', 'coder'] },
      ]
    },
    {
      title: t("SETTINGS"),
      items: [
        { path: '/settings', label: t('settings'), icon: <SettingsIcon size={20} />, roles: ['admin', 'mechanic', 'customer', 'manager', 'inventoryManager', 'coder', 'receptionist', 'cashier', 'storekeeper'] },
        { path: '/coder-portal', label: t('platform'), icon: <LayoutGrid size={20} />, roles: ['coder'] },
      ]
    }
  ];

  const roleLabelsMap = {
    admin: t('administrator'),
    mechanic: t('mechanic'),
    receptionist: t("Receptionist"),
    cashier: t("Cashier"),
    storekeeper: t("Storekeeper"),
    customer: t('customer'),
    manager: t('manager'),
    inventoryManager: t('inventoryManager'),
    coder: t('System Admin')
  };

  const roleLabel = roleLabelsMap[role] || role;

  const renderNavSection = (section) => {
    const visibleItems = section.items.filter(item => item.roles.includes(role));
    if (visibleItems.length === 0) return null;

    return (
      <div key={section.title} className="sidebar-section">
        <h3 className="section-title">{section.title}</h3>
        {visibleItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${isItemActive(item.path) ? 'active' : ''}`}
            onClick={() => setIsSidebarOpen(false)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {item.badge && (
              <span className="nav-badge" style={{
                background: item.badgeColor || 'var(--primary)',
                color: 'white',
                fontSize: '0.65rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '8px',
                marginLeft: 'auto',
                boxShadow: item.badgeColor ? `0 4px 10px ${item.badgeColor}44` : 'none',
                textTransform: 'uppercase'
              }}>{item.badge}</span>
            )}
          </Link>
        ))}
      </div>
    );
  };

  return (
    <>
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-container">
            <div className="logo-icon"><Wrench size={24} /></div>
            <div>
              <h2 style={{ marginBottom: 2 }}>{currentUser?.garageName || 'Miky Garage'}</h2>
              <div style={{ fontSize: '10px', opacity: 0.6, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                ID: {currentUser?.ownerId || '0001'}
              </div>
            </div>
          </div>
        </div>
        
        {/* Contextual Quick Actions (Mobile/Sidebar focus) */}
        {(location.pathname === '/repairs' || location.pathname === '/customers' || location.pathname === '/vehicles') && (
          <div className="sidebar-context-actions" style={{ padding: '0 16px', marginBottom: 16 }}>
            {location.pathname === '/repairs' && (role === 'manager' || role === 'coder') && (
              <button 
                className="btn-primary" 
                style={{ width: '100%', fontSize: '0.85rem', padding: '10px' }}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('sidebar-action', { detail: { type: 'new-repair' } }));
                  setIsSidebarOpen(false);
                }}
              >
                <Plus size={16} /> {t('newRepairOrder')}
              </button>
            )}
            {location.pathname === '/customers' && (role === 'manager' || role === 'cashier' || role === 'coder') && (
              <button 
                className="btn-primary" 
                style={{ width: '100%', fontSize: '0.85rem', padding: '10px' }}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('sidebar-action', { detail: { type: 'add-customer' } }));
                  setIsSidebarOpen(false);
                }}
              >
                <Plus size={16} /> {t('Add New Customer')}
              </button>
            )}
            {location.pathname === '/vehicles' && (role === 'manager' || role === 'cashier' || role === 'coder') && (
              <button 
                className="btn-primary" 
                style={{ width: '100%', fontSize: '0.85rem', padding: '10px' }}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('sidebar-action', { detail: { type: 'add-vehicle' } }));
                  setIsSidebarOpen(false);
                }}
              >
                <Plus size={16} /> {t("Add Vehicle")}
              </button>
            )}
          </div>
        )}

        <nav className="sidebar-nav">
          {sections.map(renderNavSection)}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="avatar">
              {currentUser?.profilePic ? (
                <img src={currentUser.profilePic} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} alt="Avatar" />
              ) : (
                currentUser?.name?.charAt(0)?.toUpperCase() || 'U'
              )}
            </div>
            <div className="user-details">
              <span className="user-name" title={currentUser?.name}>{currentUser?.name || 'User'}</span>
              <div className="user-subinfo">
                <span className="user-role">{roleLabel}</span>
                <span className="user-divider">|</span>
                <span className="user-contact" title={currentUser?.email || currentUser?.phone}>
                  {currentUser?.email || currentUser?.phone || '—'}
                </span>
              </div>
            </div>
          </div>
          <div className="sidebar-mobile-settings" style={{ marginTop: 15, paddingTop: 12, borderTop: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <button 
                onClick={toggleDarkMode}
                className="nav-item"
                style={{ flex: 1, border: '1px solid var(--glass-border)', borderRadius: 10, padding: 8, justifyContent: 'center' }}
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                <span style={{ fontSize: '0.8rem' }}>{darkMode ? t('Light') : t('Dark')}</span>
              </button>
              <button 
                onClick={() => setLanguage(language === 'am' ? 'en' : 'am')}
                className="nav-item"
                style={{ flex: 1, border: '1px solid var(--glass-border)', borderRadius: 10, padding: 8, justifyContent: 'center' }}
              >
                <Globe size={18} />
                <span style={{ fontSize: '0.8rem' }}>{language === 'am' ? 'English' : 'አማርኛ'}</span>
              </button>
            </div>
          </div>
          
          <div className="sidebar-install-container" style={{ marginTop: 15 }}>
            <InstallPWA className="sidebar-install-btn" />
          </div>

          <button
            onClick={() => {
              requestConfirmation(
                t("Are you sure you want to sign out?"),
                () => {
                  logout();
                  setIsSidebarOpen(false);
                }
              );
            }}
            className="logout-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 10,
              width: '100%',
              padding: '10px 12px',
              background: 'rgba(230,57,70,0.08)',
              border: '1px solid rgba(230,57,70,0.2)',
              borderRadius: 10,
              color: 'var(--danger)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              fontFamily: 'inherit',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(230,57,70,0.15)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(230,57,70,0.08)'}
          >
            <LogOut size={16} />
            {t('Sign Out')}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
