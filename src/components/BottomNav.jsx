import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, MessageCircle, Bell, User, Menu } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import './BottomNav.css';

const BottomNav = () => {
  const { 
    notifications, setIsSidebarOpen, 
    showNotifs, setShowNotifs, 
    t 
  } = useAppContext();
  const unreadNotifs = notifications.filter(n => !n.read && n.type !== 'message').length;
  const unreadMessages = notifications.filter(n => !n.read && n.type === 'message').length;

  return (
    <nav className="bottom-nav">
      <NavLink to="/dashboard" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <LayoutDashboard size={24} />
        <span>{t('dashboard')}</span>
      </NavLink>
      
      <NavLink to="/messaging" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <div className="icon-badge-wrapper">
          <MessageCircle size={24} />
          {unreadMessages > 0 && <span className="bottom-badge">{unreadMessages}</span>}
        </div>
        <span>{t('chats')}</span>
      </NavLink>

      <button className="bottom-nav-item" onClick={() => {
        setIsSidebarOpen(true);
        setShowNotifs(false);
      }}>
        <Menu size={24} />
        <span>{t('menu') || 'Menu'}</span>
      </button>

      <button className={`bottom-nav-item ${showNotifs ? 'active' : ''}`} onClick={() => setShowNotifs(!showNotifs)}>
        <div className="icon-badge-wrapper">
          <Bell size={24} />
          {unreadNotifs > 0 && <span className="bottom-badge">{unreadNotifs}</span>}
        </div>
        <span>{t('notifications')}</span>
      </button>

      <NavLink to="/settings" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <User size={24} />
        <span>{t('profile') || 'Profile'}</span>
      </NavLink>
    </nav>
  );
};

export default BottomNav;
