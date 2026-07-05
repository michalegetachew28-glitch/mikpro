import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  Users, Car, Wrench, DollarSign, TrendingUp, AlertTriangle,
  CheckCircle2, Clock, Trash2, CalendarClock, Package, Receipt, FileText, MessageSquare, Navigation, History, ClipboardList, Plus, Briefcase
} from 'lucide-react';
import './Dashboard.css';

/* ─────────────────────────────────────────────
   ADMIN DASHBOARD
───────────────────────────────────────────── */
const AdminDashboard = ({ navigate, context, user }) => {
  const { customers, vehicles, repairs, inventory, t, language, formatDate } = context;
  const activeRepairs = (repairs || []).filter(r => r.status === 'in-progress' || r.status === 'pending').length;
  const lowStockItems = (inventory || []).filter(i => i.quantity <= i.threshold);
  const totalRevenue = (repairs || [])
    .filter(r => r.status === 'completed')
    .reduce((sum, r) => sum + (Number(r.laborCost) || 0) + (Array.isArray(r.parts) ? r.parts.reduce((s, p) => s + (Number(p.cost) * Number(p.quantity) || 0), 0) : 0), 0);
  
  const todayDate = new Date().toISOString().split('T')[0];
  const { attendance, salaries } = context;
  const todayAttendance = (attendance || []).filter(r => r.date === todayDate);
  const presentToday = todayAttendance.filter(r => r.status === 'present').length;

  const statCards = [
    { title: t('totalRevenue'), value: `ETB ${(totalRevenue || 0).toLocaleString()}`, icon: <DollarSign size={24} />, color: 'var(--success)', trend: t('thisMonthGrowth'), link: '/billing' },
    { title: t('activeRepairs'), value: activeRepairs || 0, icon: <Wrench size={24} />, color: 'var(--primary)', trend: t('dueTodayCount'), link: '/repairs' },
    { title: t('totalCustomers'), value: (customers || []).length, icon: <Users size={24} />, color: 'var(--secondary)', trend: t('weeklyGrowth'), link: '/customers' },
    { title: t("Live Trackers"), value: (context.activeTrackers || []).length, icon: <Navigation size={24} />, color: 'var(--danger)', trend: t("Active"), link: '/tracker' },
    { title: t("Total Vehicles"), value: (vehicles || []).length, icon: <Car size={24} />, color: 'var(--primary)', trend: t("Registered"), link: '/vehicles' },
    { title: t("Take Attendance"), value: presentToday || 0, icon: <ClipboardList size={24} />, color: 'var(--accent)', trend: t("Summary"), link: '/attendance' },
  ];

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>{t('dashboard')}</h1>
          <p className="subtitle">{t('welcome')}! {t('dashboardSubtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {user?.garage?.displayId && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 20,
              background: 'var(--primary-subtle, rgba(99,102,241,0.12))',
              border: '1.5px solid var(--primary)',
              color: 'var(--primary)', fontWeight: 700,
              fontSize: '0.85rem', letterSpacing: '0.04em',
              userSelect: 'all', cursor: 'text',
            }} title="Garage ID">
              🆔 {user.garage.displayId}
            </div>
          )}
          {user?.ownerId && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 20,
              background: 'var(--primary-subtle, rgba(99,102,241,0.12))',
              border: '1.5px solid var(--primary)',
              color: 'var(--primary)', fontWeight: 700,
              fontSize: '0.85rem', letterSpacing: '0.04em',
              userSelect: 'all', cursor: 'text',
            }}>
              🏢 {user.ownerId}
            </div>
          )}
          <button className="btn-outline" onClick={() => navigate('/attendance')}>
            <ClipboardList size={18} />{t('Take Attendance')}
          </button>
          <button className="btn-primary" onClick={() => navigate('/repairs')}>
            <Wrench size={18} />{t('newRepairOrder')}
          </button>
        </div>
      </div>

      <div className="stats-grid">
        {statCards.map((s, i) => (
          <div className="stat-card clickable" key={i} onClick={() => navigate(s.link)}>
            <div className="stat-header">
              <span className="stat-title">{s.title}</span>
              <div className="stat-icon" style={{ background: s.color }}>{React.cloneElement(s.icon, { color: "#ffffff", strokeWidth: 2.2 })}</div>
            </div>
            <div className="stat-body">
              <h2 className="stat-value">{s.value}</h2>
              <span className="stat-trend"><TrendingUp size={14} />{s.trend}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-content-grid">
        <div className="content-card">
          <div className="card-header">
            <h3>{t('recentRepairs')}</h3>
            <button className="btn-text" onClick={() => navigate('/repairs')}>{t('viewAll')}</button>
          </div>
          <div className="table-responsive">
            <table className="modern-table">
              <thead><tr><th>{t('vehicle')}</th><th>{t('customer')}</th><th>{t('dateIn')}</th><th>{t('status')}</th></tr></thead>
              <tbody>
                {[...(repairs || [])].reverse().slice(0, 5).map(repair => {
                  const vehicle = repair.vehicle || (vehicles || []).find(v => v.id === repair.vehicleId);
                  const customer = vehicle?.customer || (customers || []).find(c => c.id === vehicle?.customerId);
                  const statusMap = {
                    'pending': { icon: <Clock size={14} />, cls: 'status-pending' },
                    'in-progress': { icon: <Wrench size={14} />, cls: 'status-progress' },
                    'completed': { icon: <CheckCircle2 size={14} />, cls: 'status-completed' },
                  };
                  const s = statusMap[repair.status] || statusMap['pending'];
                  return (
                    <tr key={repair.id} className="clickable-row" onClick={() => navigate('/repairs')}>
                      <td><div className="td-content"><Car size={16} className="td-icon" />{vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : t('Unknown')}</div></td>
                      <td>{customer?.name || t('Unknown')}</td>
                      <td>{formatDate(repair.dateIn)}</td>
                      <td><span className={`status-badge ${s.cls}`}>{s.icon}{t(repair.status)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          <div className="content-card">
            <div className="card-header">
              <h3>{t("Recent Activity")}</h3>
              <button className="btn-text" onClick={() => navigate('/activity')}>{t('viewAll')}</button>
            </div>
            <div className="alert-list" style={{ gap: 12 }}>
              {context.activityLogs?.slice(0, 5).map(log => (
                <div key={log.id} style={{
                  display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)',
                  alignItems: 'flex-start', fontSize: '0.85rem'
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-body)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    color: 'var(--text-secondary)'
                  }}>
                    <History size={14} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{log.userName}</div>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>{log.action}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{context.formatTime(log.timestamp)}</div>
                  </div>
                </div>
              ))}
              {(!context.activityLogs || context.activityLogs.length === 0) && (
                <div className="empty-state">{t("No recent activity")}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   MECHANIC DASHBOARD
───────────────────────────────────────────── */
const MechanicDashboard = ({ navigate, context, user }) => {
  const { repairs, vehicles, customers, t, language, formatDate } = context;

  const myMessages = (context.messages || []).filter(m => String(m.recipientId) === String(user.id));
  const myRepairs = (repairs || []).filter(r => String(r.mechanicId) === String(user.id));
  const pending = (myRepairs || []).filter(r => r.status === 'pending').length;
  const inProgress = (myRepairs || []).filter(r => r.status === 'in-progress').length;

  const stats = [
    { title: t("My Active Jobs"), value: inProgress, icon: <Wrench size={24} />, color: 'var(--primary)', link: '/repairs' },
    { title: t("Pending Queue"), value: pending, icon: <Clock size={24} />, color: 'var(--warning)', link: '/repairs' },
    { title: t("Commands"), value: myMessages.filter(m => !m.read).length, icon: <MessageSquare size={24} />, color: 'var(--danger)', link: '/dashboard' },
    { title: t("Live Map"), value: context.activeTrackers?.filter(t => t.mechanicId === user.id).length || 0, icon: <Navigation size={24} />, color: 'var(--accent)', link: '/tracker' },
    { title: t("Vehicles"), value: [...new Set(myRepairs.map(r => r.vehicleId))].length, icon: <Car size={24} />, color: 'var(--secondary)', link: '/vehicles' },
    { title: t("Part Requests"), value: context.materialRequests?.filter(r => String(r.mechanicId) === String(user.id) && r.status !== 'picked-up').length || 0, icon: <ClipboardList size={24} />, color: 'var(--accent)', link: '/material-requests' },
  ];

  const adminUser = (context.staff || []).find(s => s.role === 'admin' || s.role === 'coder');
  const managerUser = (context.staff || []).find(s => s.role === 'manager');

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>{t('welcomeUser', { name: user.name })}</h1>
          <p className="subtitle">{t("Connected to Admin Command Center")}</p>
        </div>
      </div>
      <div className="stats-grid">
        {stats.map((s, i) => (
          <div className="stat-card clickable" key={i} onClick={() => navigate(s.link)}>
            <div className="stat-header">
              <span className="stat-title">{s.title}</span>
              <div className="stat-icon" style={{ background: s.color }}>{React.cloneElement(s.icon, { color: "#ffffff", strokeWidth: 2.2 })}</div>
            </div>
            <div className="stat-body">
              <h2 className="stat-value">{s.value}</h2>
            </div>
          </div>
        ))}
      </div>

      <div className="quick-actions-carousel">
        <button className="quick-action-card" onClick={() => {
          navigate('/messages');
          setTimeout(() => {
            const btn = document.querySelector('[data-type="create-group-btn"]');
            if (btn) btn.click();
          }, 100);
        }}>
          <div className="qa-icon" style={{ background: 'var(--primary)' }}><Users size={20} /></div>
          <span style={{ fontWeight: 600 }}>{t("Create Group")}</span>
        </button>

        {adminUser && (
          <button className="quick-action-card" onClick={() => {
            context.openChatWith(adminUser);
            navigate('/messages');
          }}>
            <div className="qa-icon" style={{ background: 'var(--accent)' }}><Briefcase size={20} /></div>
            <span style={{ fontWeight: 600 }}>{t("Contact Admin")}</span>
          </button>
        )}

        {managerUser && (
          <button className="quick-action-card" onClick={() => {
            context.openChatWith(managerUser);
            navigate('/messages');
          }}>
            <div className="qa-icon" style={{ background: 'var(--secondary)' }}><Users size={20} /></div>
            <span style={{ fontWeight: 600 }}>{t("Contact Manager")}</span>
          </button>
        )}
      </div>

      <div className="dashboard-content-grid" style={{ marginTop: 24 }}>
        <div className="content-card">
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={18} /> {t("Admin Commands")}
            </h3>
          </div>
          <div className="command-list">
            {myMessages.length === 0 ? (
              <div className="empty-state" style={{ padding: '20px 0' }}>{t("No recent commands")}</div>
            ) : myMessages.slice(0, 5).map(msg => (
              <div
                key={msg.id}
                className={`command-item clickable ${msg.read ? 'read' : 'unread'}`}
                onClick={() => {
                  context.markMessagesRead(msg.senderId);
                  context.openChatWith({ id: msg.senderId, name: 'Admin', role: 'admin' });
                }}
              >
                <div className="command-text">{msg.text}</div>
                <div className="command-meta">
                  <span>{new Date(msg.time).toLocaleTimeString()}</span>
                  {!msg.read && <span className="new-badge">{t('statusNew')}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="content-card">
          <div className="card-header">
            <h3>{t("Assigned Jobs")}</h3>
            <button className="btn-text" onClick={() => navigate('/repairs')}>{t('viewAll')}</button>
          </div>
          <div className="table-responsive">
            <table className="modern-table">
              <thead><tr><th>{t('vehicle')}</th><th>{t('customer')}</th><th>{t('status')}</th><th>{t('actions')}</th></tr></thead>
              <tbody>
                  {[...(myRepairs || [])].reverse().filter(r => r.status !== 'completed').slice(0, 5).map(repair => {
                    const vehicle = repair.vehicle || (vehicles || []).find(v => v.id === repair.vehicleId);
                    const customer = vehicle?.customer || (customers || []).find(c => c.id === vehicle?.customerId);
                    const statusMap = {
                      'pending': { icon: <Clock size={14} />, cls: 'status-pending' },
                      'assigned': { icon: <Clock size={14} />, cls: 'status-pending' },
                      'in-progress': { icon: <Wrench size={14} />, cls: 'status-progress' },
                    };
                    const s = statusMap[repair.status] || statusMap['pending'];
                    return (
                      <tr key={repair.id} className="clickable-row">
                        <td onClick={() => navigate('/repairs')}><div className="td-content">{vehicle ? `${vehicle.make} ${vehicle.model}` : '—'}</div></td>
                        <td onClick={() => navigate('/repairs')}>{customer?.name || '—'}</td>
                        <td onClick={() => navigate('/repairs')}><span className={`status-badge ${s.cls}`}>{s.icon} {t(repair.status === 'in-progress' ? 'inProgress' : repair.status)}</span></td>
                        <td>
                          {repair.status === 'pending' || repair.status === 'assigned' ? (
                            <button
                              className="btn-primary-small"
                              style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                context.updateItem('repairs', repair.id, { status: 'in-progress' });
                              }}
                            >
                              {t('acceptJob')}
                            </button>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   CUSTOMER DASHBOARD
───────────────────────────────────────────── */
const CustomerDashboard = ({ navigate, context, user }) => {
  const { vehicles, repairs, customers, staff, language, t, formatDate, notifications, markNotifRead, openChatWith } = context;

  // Use current user ID for reliable filtering
  const myVehicles = (vehicles || []).filter(v => String(v.customerId) === String(user.id));
  const myVehicleIds = (myVehicles || []).map(v => v.id);
  const myRepairs = (repairs || []).filter(r => (myVehicleIds || []).includes(r.vehicleId));
  const myNotifications = (notifications || []).filter(n => String(n.recipientId) === String(user.id));

  const activeRepairs = (myRepairs || []).filter(r => r.status !== 'completed').length;
  const completedRepairs = (myRepairs || []).filter(r => r.status === 'completed').length;

  const quickLinks = [
    { label: t("My Bills"), icon: <Receipt size={24} />, path: '/billing', color: 'var(--accent)' },
    { label: t("Service History"), icon: <FileText size={24} />, path: '/billing', color: 'var(--primary)' },
    { label: t("Live Tracking"), icon: <Navigation size={24} />, path: '/tracker', color: 'var(--danger)' },
  ];

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>{t('helloUser', { name: user.name })} 👋</h1>
          <p className="subtitle">{t("Track your vehicles and repair status.")}</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {[
          { title: t("My Vehicles"), value: (myVehicles || []).length, icon: <Car size={24} />, color: 'var(--primary)', link: '/dashboard' },
          { title: t("Active Repairs"), value: activeRepairs || 0, icon: <Wrench size={24} />, color: 'var(--warning)', link: '/dashboard' },
          { title: t("Completed Repairs"), value: completedRepairs || 0, icon: <CheckCircle2 size={24} />, color: 'var(--success)', link: '/billing' },
        ].map((s, i) => (
          <div className="stat-card clickable" key={i} onClick={() => navigate(s.link)}>
            <div className="stat-header">
              <span className="stat-title">{s.title}</span>
              <div className="stat-icon" style={{ background: s.color }}>{React.cloneElement(s.icon, { color: "#ffffff", strokeWidth: 2.2 })}</div>
            </div>
            <div className="stat-body"><h2 className="stat-value">{s.value}</h2></div>
          </div>
        ))}
      </div>

      <div className="dashboard-content-grid">
        {/* Vehicles */}
        <div className="content-card">
          <div className="card-header">
            <h3>{t("My Vehicles")}</h3>
          </div>
          {myVehicles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>
              <Car size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>{t("No vehicles registered under your account yet.")}</p>
            </div>
          ) : (myVehicles || []).map(v => {
            const activeR = (myRepairs || []).filter(r => r.vehicleId === v.id && r.status !== 'completed');
            return (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(67,97,238,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                  <Car size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{v.year} {v.make} {v.model}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {t("Plate")}: <strong>{v.plate}</strong>
                  </div>
                </div>
                {activeR.length > 0 ? (
                  <span className={`status-badge ${activeR[0].status === 'in-progress' ? 'status-progress' : 'status-pending'}`}>
                    {activeR[0].status === 'in-progress' ? <Wrench size={13} /> : <Clock size={13} />}
                    {t(activeR[0].status)}
                  </span>
                ) : (
                  (myRepairs || []).filter(r => r.vehicleId === v.id && r.status === 'completed').length > 0 && (
                    <span className="status-badge status-completed"><CheckCircle2 size={13} /> {t('completed')}</span>
                  )
                )}
              </div>
            );
          })}
        </div>

        {/* Right Column: Notifications & Quick Access */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          <div className="content-card">
            <div className="card-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {t("Notifications")}
              </h3>
            </div>
            <div className="alert-list">
              {myNotifications.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 0' }}>{t("No recent notifications")}</div>
              ) : myNotifications.slice(0, 5).map(notif => (
                <div
                  key={notif.id}
                  className={`alert-item ${!notif.read ? 'unread' : ''} ${notif.link ? 'clickable' : ''} ${notif.type === 'success' ? 'success-alert' : 'info-alert'}`}
                  onClick={() => {
                    markNotifRead(notif.id);
                    if (notif.type === 'message' && notif.senderId) {
                      const contact = [...customers, ...staff].find(c => String(c.id) === String(notif.senderId));
                      if (contact) {
                        openChatWith(contact);
                      }
                    }
                    if (notif.link) navigate(notif.link);
                  }}
                >
                  <div className="alert-details" style={{ flex: 1 }}>
                    <h4 className="notif-title">{notif.message}</h4>
                    <span className="notif-time-stamp">{new Date(notif.time).toLocaleTimeString()}</span>
                  </div>
                  {!notif.read && (
                    <div className="unread-indicator"></div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="content-card">
            <div className="card-header"><h3>{t("Quick Access")}</h3></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {quickLinks.map((ql, i) => (
                <button key={i} onClick={() => navigate(ql.path)} style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px',
                  background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: 14,
                  cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit', textAlign: 'left'
                }}
                  onMouseOver={e => e.currentTarget.style.borderColor = ql.color}
                  onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: ql.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {ql.icon}
                  </div>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{ql.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   RECEPTIONIST DASHBOARD
───────────────────────────────────────────── */
const ReceptionistDashboard = ({ navigate, context, user }) => {
  const { customers, vehicles, repairs, appointments, t, language, formatDate } = context;
  const todayAppointments = (appointments || []).filter(a => formatDate(a.date) === formatDate(new Date()));

  const stats = [
    { title: t('appointments'), value: (todayAppointments || []).length, icon: <CalendarClock size={24} />, color: 'var(--primary)', link: '/appointments' },
    { title: t('totalCustomers'), value: (customers || []).length, icon: <Users size={24} />, color: 'var(--secondary)', link: '/customers' },
    { title: t('activeRepairs'), value: (repairs || []).filter(r => r.status !== 'completed').length, icon: <Wrench size={24} />, color: 'var(--warning)', link: '/repairs' },
  ];

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>{t("Reception Desk")}</h1>
          <p className="subtitle">{t('welcome')}, {user.name}!</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-primary" onClick={() => navigate('/appointments')}>
            <CalendarClock size={18} /> {t("New Appointment")}
          </button>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map((s, i) => (
          <div className="stat-card clickable" key={i} onClick={() => navigate(s.link)}>
            <div className="stat-header">
              <span className="stat-title">{s.title}</span>
              <div className="stat-icon" style={{ background: s.color }}>{React.cloneElement(s.icon, { color: "#ffffff", strokeWidth: 2.2 })}</div>
            </div>
            <div className="stat-body"><h2 className="stat-value">{s.value}</h2></div>
          </div>
        ))}
      </div>

      <div className="dashboard-content-grid">
        <div className="content-card">
          <div className="card-header">
            <h3>{t("Today's Appointments")}</h3>
            <button className="btn-text" onClick={() => navigate('/appointments')}>{t('viewAll')}</button>
          </div>
          <div className="table-responsive">
            <table className="modern-table">
              <thead><tr><th>{t('customer')}</th><th>{t('time')}</th><th>{t('status')}</th></tr></thead>
              <tbody>
                {todayAppointments.slice(0, 5).map(app => (
                  <tr key={app.id}>
                    <td>{app.customerName}</td>
                    <td>{app.time}</td>
                    <td><span className={`status-badge status-pending`}>{t(app.status)}</span></td>
                  </tr>
                ))}
                {todayAppointments.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center', padding: 20 }}>{t("No appointments today")}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   CASHIER DASHBOARD
───────────────────────────────────────────── */
const CashierDashboard = ({ navigate, context, user }) => {
  const { repairs, t, language } = context;
  const pendingInvoices = (repairs || []).filter(r => r.status === 'completed' && !r.paid);

  const stats = [
    { title: t("Pending Payments"), value: (pendingInvoices || []).length, icon: <DollarSign size={24} />, color: 'var(--danger)', link: '/billing' },
    { title: t('totalRevenue'), value: `ETB ${(repairs || []).filter(r => r.paid).reduce((s, r) => s + (r.total || 0), 0).toLocaleString()}`, icon: <TrendingUp size={24} />, color: 'var(--success)', link: '/billing' },
  ];

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>{t("Cashier Station")}</h1>
          <p className="subtitle">{t("Manage invoices and payments.")}</p>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map((s, i) => (
          <div className="stat-card clickable" key={i} onClick={() => navigate(s.link)}>
            <div className="stat-header">
              <span className="stat-title">{s.title}</span>
              <div className="stat-icon" style={{ background: s.color }}>{React.cloneElement(s.icon, { color: "#ffffff", strokeWidth: 2.2 })}</div>
            </div>
            <div className="stat-body"><h2 className="stat-value">{s.value}</h2></div>
          </div>
        ))}
      </div>

      <div className="manager-quick-actions">
        <button className="action-card secondary" onClick={() => navigate('/customers', { state: { showAddModal: true } })}>
          <div className="action-icon"><Users size={32} /></div>
          <div className="action-info">
            <h3>{t('Add New Customer')}</h3>
            <p>{t("Register a new client to the garage system.")}</p>
          </div>
        </button>

        <button className="action-card accent" onClick={() => navigate('/vehicles', { state: { showAddModal: true } })}>
          <div className="action-icon"><Car size={32} /></div>
          <div className="action-info">
            <h3>{t("Add Vehicle")}</h3>
            <p>{t("Register a new vehicle under an existing customer.")}</p>
          </div>
        </button>
      </div>

      <div className="dashboard-content-grid">
        <div className="content-card">
          <div className="card-header">
            <h3>{t("Recent Completed Repairs (Unpaid)")}</h3>
          </div>
          <div className="table-responsive">
            <table className="modern-table">
              <thead><tr><th>{t('customer')}</th><th>{t('amount')}</th><th>{t('action')}</th></tr></thead>
              <tbody>
                {pendingInvoices.slice(0, 5).map(inv => (
                  <tr key={inv.id}>
                    <td>{inv.customerName || t('Walk-in')}</td>
                    <td>ETB {inv.total || 0}</td>
                    <td><button className="btn-primary-small" onClick={() => navigate('/billing')}>{t("Collect")}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   STOREKEEPER DASHBOARD
───────────────────────────────────────────── */
const StorekeeperDashboard = ({ navigate, context, user }) => {
  const { inventory, t, language } = context;
  const lowStock = (inventory || []).filter(i => (i.quantity || 0) <= (i.threshold || 0));

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>{t("Inventory Store")}</h1>
          <p className="subtitle">{t("Track stock and spare parts.")}</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/inventory')}>
          <Package size={18} /> {t("Add Part")}
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card clickable" style={{ borderLeft: '4px solid var(--warning)' }} onClick={() => navigate('/material-requests')}>
          <div className="stat-header">
            <span className="stat-title" style={{ color: 'var(--warning)' }}>{t("Pending Requests")}</span>
            <Clock color="var(--warning)" />
          </div>
          <div className="stat-body"><h2 className="stat-value">{context.materialRequests?.filter(r => r.status === 'pending').length || 0}</h2></div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="stat-header">
            <span className="stat-title" style={{ color: 'var(--danger)' }}>{t('lowStockAlerts')}</span>
            <AlertTriangle color="var(--danger)" />
          </div>
          <div className="stat-body"><h2 className="stat-value">{lowStock.length}</h2></div>
        </div>
        <div className="stat-card">
          <div className="stat-header"><span className="stat-title">{t("Total Items")}</span><Package /></div>
          <div className="stat-body"><h2 className="stat-value">{(inventory || []).length}</h2></div>
        </div>
      </div>

      <div className="dashboard-content-grid">
        <div className="content-card">
          <div className="card-header">
            <h3>{t("New Material Requests")}</h3>
            <button className="btn-text" onClick={() => navigate('/material-requests')}>{t('viewAll')}</button>
          </div>
          <div className="table-responsive">
            <table className="modern-table">
              <thead><tr><th>{t('part')}</th><th>{t('mechanic')}</th><th>{t('qty')}</th><th>{t('status')}</th></tr></thead>
              <tbody>
                {context.materialRequests?.filter(r => r.status === 'pending').slice(0, 5).map(req => {
                  const part = (inventory || []).find(i => i.id === req.partId);
                  const mech = (context.staff || []).find(s => s.id === req.mechanicId);
                  return (
                    <tr key={req.id} className="clickable-row" onClick={() => navigate('/material-requests')}>
                      <td>{part?.name || t('Unknown')}</td>
                      <td>{mech?.name || t('Unknown')}</td>
                      <td>{req.requestedQty}</td>
                      <td><span className="status-badge status-pending">{t(req.status)}</span></td>
                    </tr>
                  );
                })}
                {context.materialRequests?.filter(r => r.status === 'pending').length === 0 && (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: 20 }}>{t("No pending requests")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="content-card">
            <div className="card-header">
              <h3>{t("Notifications")}</h3>
            </div>
            <div className="alert-list">
              {context.notifications?.filter(n => String(n.recipientId) === String(user.id) || !n.recipientId).length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 0' }}>{t("No recent notifications")}</div>
              ) : context.notifications?.filter(n => String(n.recipientId) === String(user.id) || !n.recipientId).slice(0, 5).map(notif => (
                <div
                  key={notif.id}
                  className={`alert-item ${!notif.read ? 'unread' : ''} ${notif.link ? 'clickable' : ''} ${notif.type === 'success' ? 'success-alert' : 'info-alert'}`}
                  onClick={() => {
                    context.markNotifRead(notif.id);
                    if (notif.link) navigate(notif.link);
                  }}
                >
                  <div className="alert-details" style={{ flex: 1 }}>
                    <h4 className="notif-title">{notif.message}</h4>
                    <span className="notif-time-stamp">{new Date(notif.time).toLocaleTimeString()}</span>
                  </div>
                  {!notif.read && <div className="unread-indicator"></div>}
                </div>
              ))}
            </div>
          </div>

          <div className="content-card">
            <div className="card-header"><h3>{t('lowStockAlerts')}</h3></div>
            <div className="alert-list">
              {(lowStock || []).map(item => (
                <div key={item.id} className="alert-item">
                  <div className="alert-details">
                    <h4>{item.name}</h4>
                    <span>{t('stockLevel')}: {item.quantity} ({t('threshold')}: {item.threshold})</span>
                  </div>
                  <button className="btn-outline-small" onClick={() => navigate('/inventory')}>{t('reorder')}</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   MANAGER DASHBOARD
───────────────────────────────────────────── */
const ManagerDashboard = ({ navigate, context, user }) => {
  const { customers, repairs, t, language, formatDate } = context;
  const activeRepairs = (repairs || []).filter(r => r.status === 'in-progress' || r.status === 'pending').length;

  const statCards = [
    { title: t('activeRepairs'), value: activeRepairs || 0, icon: <Wrench size={24} />, color: 'var(--primary)', trend: '4 due today', link: '/repairs' },
    { title: t('totalCustomers'), value: (customers || []).length, icon: <Users size={24} />, color: 'var(--secondary)', trend: '+3 this week', link: '/customers' },
    { title: t("Live Trackers"), value: (context.activeTrackers || []).length, icon: <Navigation size={24} />, color: 'var(--danger)', trend: t("Active"), link: '/tracker' },
    { title: t('appointments'), value: (context.appointments || []).length, icon: <CalendarClock size={24} />, color: 'var(--accent)', trend: 'Today', link: '/appointments' },
  ];

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>{t('dashboard')}</h1>
          <p className="subtitle">{t('welcome')}! {user.name} ({t('manager') || 'Manager'})</p>
        </div>
      </div>

      <div className="stats-grid">
        {statCards.map((s, i) => (
          <div className="stat-card clickable" key={i} onClick={() => navigate(s.link)}>
            <div className="stat-header">
              <span className="stat-title">{s.title}</span>
              <div className="stat-icon" style={{ background: s.color }}>{React.cloneElement(s.icon, { color: "#ffffff", strokeWidth: 2.2 })}</div>
            </div>
            <div className="stat-body">
              <h2 className="stat-value">{s.value}</h2>
              <span className="stat-trend"><TrendingUp size={14} />{s.trend}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Modern Quick Action Cards */}
      <div className="manager-quick-actions">
        <button className="action-card primary" onClick={() => navigate('/repairs', { state: { showAddModal: true } })}>
          <div className="action-icon"><Plus size={32} /></div>
          <div className="action-info">
            <h3>{t('newRepairOrder')}</h3>
            <p>{t("Initiate a new repair job and assign mechanics.")}</p>
          </div>
        </button>

        <button className="action-card secondary" onClick={() => navigate('/customers', { state: { showAddModal: true } })}>
          <div className="action-icon"><Users size={32} /></div>
          <div className="action-info">
            <h3>{t('Add New Customer')}</h3>
            <p>{t("Register a new client to the garage system.")}</p>
          </div>
        </button>

        <button className="action-card accent" onClick={() => navigate('/vehicles', { state: { showAddModal: true } })}>
          <div className="action-icon"><Car size={32} /></div>
          <div className="action-info">
            <h3>{t("Add Vehicle")}</h3>
            <p>{t("Register a new vehicle under an existing customer.")}</p>
          </div>
        </button>
      </div>

      <div className="dashboard-content-grid">
        <div className="content-card">
          <div className="card-header">
            <h3>{t('recentRepairs')}</h3>
            <button className="btn-text" onClick={() => navigate('/repairs')}>{t('viewAll')}</button>
          </div>
          <div className="table-responsive">
            <table className="modern-table">
              <thead><tr><th>{t('vehicle')}</th><th>{t('customer')}</th><th>{t('dateIn')}</th><th>{t('status')}</th></tr></thead>
              <tbody>
                {[...(repairs || [])].reverse().slice(0, 5).map(repair => {
                  const vehicle = repair.vehicle || (context.vehicles || []).find(v => v.id === repair.vehicleId);
                  const customer = vehicle?.customer || (customers || []).find(c => c.id === vehicle?.customerId);
                  const statusMap = {
                    'pending': { icon: <Clock size={14} />, cls: 'status-pending' },
                    'in-progress': { icon: <Wrench size={14} />, cls: 'status-progress' },
                    'completed': { icon: <CheckCircle2 size={14} />, cls: 'status-completed' },
                  };
                  const s = statusMap[repair.status] || statusMap['pending'];
                  return (
                    <tr key={repair.id} className="clickable-row" onClick={() => navigate('/repairs')}>
                      <td><div className="td-content"><Car size={16} className="td-icon" />{vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : t('Unknown')}</div></td>
                      <td>{customer?.name || t('Unknown')}</td>
                      <td>{formatDate(repair.dateIn)}</td>
                      <td><span className={`status-badge ${s.cls}`}>{s.icon}{t(repair.status)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="content-card">
          <div className="card-header">
            <h3>{t("Recent Activity")}</h3>
            <button className="btn-text" onClick={() => navigate('/activity')}>{t('viewAll')}</button>
          </div>
          <div className="alert-list" style={{ gap: 12 }}>
            {context.activityLogs?.slice(0, 5).map(log => (
              <div key={log.id} style={{
                display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)',
                alignItems: 'flex-start', fontSize: '0.85rem'
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-body)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  color: 'var(--text-secondary)'
                }}>
                  <History size={14} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{log.userName}</div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>{log.action}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{context.formatTime(log.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   ROOT DASHBOARD — picks the right one
───────────────────────────────────────────── */
const Dashboard = () => {
  const navigate = useNavigate();
  const context = useAppContext();
  const { currentUser } = useAuth();

  if (!currentUser) return null;

  const dashboards = {
    admin: <AdminDashboard navigate={navigate} context={context} user={currentUser} />,
    mechanic: <MechanicDashboard navigate={navigate} context={context} user={currentUser} />,
    customer: <CustomerDashboard navigate={navigate} context={context} user={currentUser} />,
    receptionist: <ReceptionistDashboard navigate={navigate} context={context} user={currentUser} />,
    cashier: <CashierDashboard navigate={navigate} context={context} user={currentUser} />,
    storekeeper: <StorekeeperDashboard navigate={navigate} context={context} user={currentUser} />,
    inventoryManager: <StorekeeperDashboard navigate={navigate} context={context} user={currentUser} />,
    manager: <ManagerDashboard navigate={navigate} context={context} user={currentUser} />,
    coder: <AdminDashboard navigate={navigate} context={context} />
  };

  return dashboards[currentUser.role] || dashboards.admin;
};

export default Dashboard;
