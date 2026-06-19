import React from 'react';
import { Bell, Search, Menu, Globe, X, User, Car, Wrench, Settings as SettingsIcon, Moon, Sun, MessageCircle, AlertTriangle, CreditCard, RefreshCw, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import './Header.css';

const Header = () => {
  const {
    language, setLanguage, t, notifications, markNotifRead, clearNotifications,
    customers, vehicles, repairs, staff, openChatWith, requestConfirmation,
    darkMode, toggleDarkMode, isSidebarOpen, setIsSidebarOpen, showNotifs, setShowNotifs,
    deferredPrompt, setDeferredPrompt
  } = useAppContext();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showSearchResults, setShowSearchResults] = React.useState(false);
  const [expandedNotifId, setExpandedNotifId] = React.useState(null);

  const filteredNotifs = (notifications || []).filter(n =>
    (!n.recipientId || String(n.recipientId) === String(currentUser?.id))
  );
  const unreadCount = filteredNotifs.filter(n => !n.read).length;

  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();

    const res = [];

    // Customers
    (customers || []).filter(c => (c.name || '').toLowerCase().includes(query) || (c.phone || '').includes(query))
      .slice(0, 3).forEach(c => res.push({ type: 'customer', id: c.id, title: c.name, sub: c.phone, icon: <User size={14} />, link: '/customers' }));

    // Vehicles
    (vehicles || []).filter(v => (v.make || '').toLowerCase().includes(query) || (v.model || '').toLowerCase().includes(query) || (v.plate || '').toLowerCase().includes(query))
      .slice(0, 3).forEach(v => res.push({ type: 'vehicle', id: v.id, title: `${v.year} ${v.make} ${v.model}`, sub: v.plate, icon: <Car size={14} />, link: '/vehicles' }));

    // Repairs
    (repairs || []).filter(r => (r.id || '').toLowerCase().includes(query) || (r.status || '').toLowerCase().includes(query))
      .slice(0, 3).forEach(r => {
        const v = (vehicles || []).find(v => v.id === r.vehicleId);
        res.push({ type: 'repair', id: r.id, title: v ? `${v.make} ${v.model}` : 'Repair', sub: `ID: ${r.id} (${r.status})`, icon: <Wrench size={14} />, link: '/repairs' });
      });

    // Staff
    (staff || []).filter(s => (s.name || '').toLowerCase().includes(query) || (s.role || '').toLowerCase().includes(query))
      .slice(0, 3).forEach(s => res.push({ type: 'staff', id: s.id, title: s.name, sub: s.role, icon: <User size={14} />, link: '/staff' }));

    return res;
  }, [searchQuery, customers, vehicles, repairs, staff]);

  const groupedNotifs = React.useMemo(() => {
    const groups = { today: [], yesterday: [], earlier: [] };
    const todayStr = new Date().toDateString();

    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toDateString();

    filteredNotifs.forEach(n => {
      const nStr = new Date(n.time).toDateString();
      if (nStr === todayStr) groups.today.push(n);
      else if (nStr === yesterdayStr) groups.yesterday.push(n);
      else groups.earlier.push(n);
    });

    return [
      { id: 'today', label: t("Today"), items: groups.today },
      { id: 'yesterday', label: t("Yesterday"), items: groups.yesterday },
      { id: 'earlier', label: t("Earlier"), items: groups.earlier }
    ].filter(g => g.items.length > 0);
  }, [filteredNotifs, language]);

  const getNotifDetails = (type) => {
    switch (type) {
      case 'message': return { icon: <MessageCircle size={18} />, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', title: t("New Message") };
      case 'payment': return { icon: <CreditCard size={18} />, color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', title: t("Payment") };
      case 'alert':
      case 'warning': return { icon: <AlertTriangle size={18} />, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', title: t("Alert") };
      case 'system':
      case 'update': return { icon: <RefreshCw size={18} />, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)', title: t("System Update") };
      case 'info':
      default: return { icon: <Info size={18} />, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', title: t("Information") };
    }
  };

  // Click outside search to close
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.search-bar')) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const toggleLanguage = () => {
    setLanguage(language === 'am' ? 'en' : 'am');
  };

  const getDayName = () => {
    const date = new Date();
    if (language === 'am') {
      // Amharic days
      const days = ['እሁድ', 'ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሐሙስ', 'ዓርብ', 'ቅዳሜ'];
      const months = ['ጃንዋሪ', 'ፌብሩዋሪ', 'ማርች', 'ኤፕሪል', 'ሜይ', 'ጁን', 'ጁላይ', 'ኦገስት', 'ሴፕቴምበር', 'ኦክቶበር', 'ኖቬምበር', 'ዲሴምበር'];
      return `${days[date.getDay()]}፣ ${months[date.getMonth()]} ${date.getDate()}`;
    }
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };
  return (
    <header className="top-header">
      <div className="header-left">
        <button className="mobile-menu-btn" onClick={(e) => {
          e.stopPropagation();
          setIsSidebarOpen(!isSidebarOpen);
        }}>
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchResults(true);
            }}
            onFocus={() => setShowSearchResults(true)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
              <X size={16} />
            </button>
          )}

          {showSearchResults && searchQuery.trim() && (
            <div className="search-results-dropdown shadow-glass">
              {searchResults.length > 0 ? (
                searchResults.map((res) => (
                  <div
                    key={`${res.type}-${res.id}`}
                    className="search-result-item"
                    onClick={() => {
                      navigate(res.link);
                      setSearchQuery('');
                      setShowSearchResults(false);
                    }}
                  >
                    <div className="result-icon-wrapper">{res.icon}</div>
                    <div className="result-info">
                      <div className="result-title">{res.title}</div>
                      <div className="result-subtitle">{res.sub}</div>
                    </div>
                    <div className="result-type-tag">{t(res.type)}</div>
                  </div>
                ))
              ) : (
                <div className="search-empty-state">
                  <Search size={20} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p>{t("No results matches your search")}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="header-right">
        {deferredPrompt && (
          <button
            className="btn-primary"
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            onClick={async () => {
              deferredPrompt.prompt();
              const { outcome } = await deferredPrompt.userChoice;
              if (outcome === 'accepted') {
                setDeferredPrompt(null);
              }
            }}
          >
            {t('Install App') || 'Install App'}
          </button>
        )}
        <button className="language-toggle" onClick={toggleLanguage} title={t('language')}>
          <Globe size={20} />
          <span>{language === 'am' ? 'English' : 'አማርኛ'}</span>
        </button>

        <button className="icon-btn theme-toggle" onClick={toggleDarkMode} title={darkMode ? t('Light Mode') : t('Dark Mode')}>
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className="notification-container">
          <button className="icon-btn notification-btn" onClick={() => setShowNotifs(!showNotifs)}>
            <Bell size={20} />
            {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
          </button>

          {showNotifs && (
            <div className="notification-dropdown">
              <div className="notification-header">
                <h4>{t('notifications')}</h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const isSure = window.confirm(t("Are you sure you want to clear all notifications?"));
                    if (isSure) {
                      clearNotifications();
                      setShowNotifs(false);
                    }
                  }}
                  className="clear-all-btn"
                >
                  {t("Clear all")}
                </button>
              </div>
              <div className="notification-list">
                {groupedNotifs.length === 0 ? (
                  <div className="notif-empty-state">
                    <Bell size={32} style={{ opacity: 0.2, marginBottom: 12 }} />
                    <p>{t("You’re all caught up!")}</p>
                  </div>
                ) : (
                  groupedNotifs.map(group => (
                    <div key={group.id} className="notif-group">
                      <div className="notif-group-header">{group.label}</div>
                      {group.items.map(n => {
                        const details = getNotifDetails(n.type);
                        return (
                          <div
                            key={n.id}
                            className={`notification-item ${n.read ? '' : 'unread'} ${expandedNotifId === n.id ? 'expanded' : ''}`}
                            onClick={(e) => {
                              // Expand on first click, navigate/action on second or if already expanded
                              if (expandedNotifId !== n.id) {
                                e.stopPropagation();
                                setExpandedNotifId(n.id);
                                markNotifRead(n.id);
                                return;
                              }
                              
                              markNotifRead(n.id);
                              if (n.type === 'message') {
                                const contact = [...customers, ...staff].find(c => n.message.includes(c.name));
                                if (contact) openChatWith(contact);
                              }
                              if (n.link) {
                                navigate(n.link);
                                setShowNotifs(false);
                              }
                            }}
                          >
                            <div className="notif-icon-box" style={{ color: details.color, backgroundColor: details.bg }}>
                              {details.icon}
                            </div>
                            <div className="notif-content-area">
                              <div className="notif-title-row">
                                <span className="notif-title">{details.title}</span>
                                <span className="notif-time">{new Date(n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p className="notif-desc">{n.message}</p>
                            </div>
                            {!n.read && <div className="notif-unread-dot" />}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button className="header-profile-btn" onClick={() => navigate('/profile')} title={t('settings') || 'Settings'}>
          {currentUser?.profilePic ? (
            <img src={currentUser.profilePic} alt="Profile" className="header-avatar-img" />
          ) : (
            <div className="header-avatar-placeholder">
              {currentUser?.name?.charAt(0) || 'U'}
            </div>
          )}
        </button>

        <div className="date-display">
          {getDayName()}
        </div>
      </div>

    </header>
  );
};

export default Header;
