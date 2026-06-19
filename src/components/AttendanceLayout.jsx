import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ClipboardList, History, BarChart2, Users, Play, ClipboardCheck
} from 'lucide-react';
import './AttendanceNavigation.css';
import { useAppContext } from '../context/AppContext';

const AttendanceLayout = () => {
  const navigate = useNavigate();
  const { t } = useAppContext();

  const navItems = [
    {
      to: '/attendance',
      end: true,
      icon: <ClipboardList size={18} />,
      label: t('Daily Attendance'),
    },
    {
      to: '/attendance/history',
      icon: <History size={18} />,
      label: t('History'),
    },
    {
      to: '/attendance/reports',
      icon: <BarChart2 size={18} />,
      label: t('Reports'),
    },
    {
      to: '/attendance/summary',
      icon: <Users size={18} />,
      label: t('Employee Summary'),
    },
  ];

  return (
    <div className="att-layout">
      {/* ─── Desktop Sidebar ─── */}
      <aside className="att-sidebar">
        <div className="att-sidebar-header">
          <div className="att-icon-badge">
            <ClipboardCheck size={20} />
          </div>
          <div>
            <h2>{t('Attendance')}</h2>
            <span>{t('Management')}</span>
          </div>
        </div>

        {/* Primary CTA */}
        <NavLink to="/attendance" end className="att-cta-btn">
          <Play size={16} fill="white" />
          {t('Take Attendance')}
        </NavLink>

        <div className="att-nav-section-label">{t('Navigation')}</div>

        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `att-nav-item ${isActive ? 'active' : ''}`
            }
          >
            <div className="att-nav-icon">{item.icon}</div>
            {item.label}
          </NavLink>
        ))}
      </aside>

      {/* ─── Main Content ─── */}
      <main className="att-content">
        <Outlet />
      </main>

      {/* ─── Mobile Bottom Navigation ─── */}
      <nav className="att-mobile-nav">
        <div className="att-mobile-nav-inner">
          <NavLink
            to="/attendance"
            end
            className={({ isActive }) => `att-mob-item ${isActive ? 'active' : ''}`}
          >
            <ClipboardList size={22} />
            <span>{t('Daily')}</span>
          </NavLink>

          <NavLink
            to="/attendance/history"
            className={({ isActive }) => `att-mob-item ${isActive ? 'active' : ''}`}
          >
            <History size={22} />
            <span>{t('History')}</span>
          </NavLink>

          {/* Central CTA */}
          <NavLink to="/attendance" end className="att-mob-cta">
            <div className="att-mob-cta-btn">
              <Play size={20} fill="white" />
            </div>
            <span>{t('Take')}</span>
          </NavLink>

          <NavLink
            to="/attendance/reports"
            className={({ isActive }) => `att-mob-item ${isActive ? 'active' : ''}`}
          >
            <BarChart2 size={22} />
            <span>{t('Reports')}</span>
          </NavLink>

          <NavLink
            to="/attendance/summary"
            className={({ isActive }) => `att-mob-item ${isActive ? 'active' : ''}`}
          >
            <Users size={22} />
            <span>{t('Summary')}</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
};

export default AttendanceLayout;
