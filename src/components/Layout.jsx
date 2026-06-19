import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Wrench, Users, Car, ClipboardList, Package, CreditCard, LayoutDashboard, Calendar, CalendarClock } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';
import CallOverlay from './CallOverlay';
import GlobalConfirmationBar from './GlobalConfirmationBar';
import BottomNav from './BottomNav';
import { useAppContext } from '../context/AppContext';

const Layout = () => {
  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-wrapper">
        <Header />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <CallOverlay />
      <GlobalConfirmationBar />
      <GlobalToasts />
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
