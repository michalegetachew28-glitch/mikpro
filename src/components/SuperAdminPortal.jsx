import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import InstallPWA from './InstallPWA';
import './InstallPWA.css';
import {
  LayoutDashboard, Building2, Users, BarChart3, Settings2,
  Radio, ShieldAlert, Trash2, RefreshCw, Download, Search,
  ChevronDown, ChevronRight, X, Check, AlertTriangle, Bell,
  Database, HardDrive, Activity, UserCircle, Zap, Globe,
  Power, Edit3, Eye, EyeOff, Plus, Send, Filter,
  TrendingUp, Wrench, Car, DollarSign, Clock, CheckCircle2,
  LogOut, Shield, LayoutGrid, Landmark, CreditCard, MessageSquare,
  Paperclip, Image as ImageIcon, FileText, Mic
} from 'lucide-react';
import './SuperAdminPortal.css';

/* ─── helpers ─────────────────────────────────────── */
const fmt = (n) => Number(n || 0).toLocaleString();
const fmtKB = (bytes) => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(2)} MB`;
const storageSize = (key) => { try { const v = localStorage.getItem(key); return v ? new Blob([v]).size : 0; } catch { return 0; } };
const totalStorageSize = () => { let s = 0; try { for (let k of Object.keys(localStorage)) s += storageSize(k); } catch { } return s; };

const ROLE_COLORS = {
  admin: '#6366f1', mechanic: '#f59e0b', receptionist: '#10b981',
  cashier: '#3b82f6', storekeeper: '#8b5cf6', manager: '#ec4899',
  customer: '#64748b', inventoryManager: '#06b6d4', coder: '#f43f5e'
};

const ETHIOPIAN_BANKS = [
  "Commercial Bank of Ethiopia (CBE)", "Awash Bank", "Dashen Bank", "Bank of Abyssinia",
  "Wegagen Bank", "Hibret Bank", "Nib International Bank", "Cooperative Bank of Oromia",
  "Oromia Bank", "Abay Bank", "Addis International Bank", "Bunna Bank", "ZamZam Bank",
  "Hijra Bank", "Shabelle Bank", "Siinqee Bank", "Tsehay Bank", "Enat Bank",
  "Global Bank Ethiopia", "Ahadu Bank", "Goh Betoch Bank", "Amhara Bank",
  "Lion International Bank", "Berhan Bank"
];

const MOBILE_PROVIDERS = [
  "Telebirr", "CBE Birr", "M-Pesa Ethiopia", "Amole", "HelloCash"
];

/* ─── STATUS BADGE ────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const map = {
    active: { label: 'Active', cls: 'badge-active' },
    inactive: { label: 'Suspended', cls: 'badge-suspended' },
    deleted: { label: 'Purged', cls: 'badge-purged' },
  };
  const { label, cls } = map[status] || { label: status || 'Unknown', cls: 'badge-suspended' };
  return <span className={`sap-badge ${cls}`}>{label}</span>;
};

/* ─── ROLE CHIP ───────────────────────────────────── */
const RoleChip = ({ role }) => (
  <span className="sap-role-chip" style={{ background: ROLE_COLORS[role] + '22', color: ROLE_COLORS[role], border: `1px solid ${ROLE_COLORS[role]}44` }}>
    {role}
  </span>
);

/* ════════════════════════════════════════════════════
   1.  OVERVIEW PANEL
════════════════════════════════════════════════════ */
const OverviewPanel = ({ accounts, garages, requests, onNavigate, stats }) => {
  const { t } = useAppContext();
  
  const subscriptionStats = useMemo(() => {
    // All values sourced directly from the backend platform-stats endpoint
    const ss = stats?.subscriptionStats || {};
    return {
      totalClients:          stats?.garages               ?? garages.length,
      active:                ss.active                    ?? 0,
      suspended:             ss.suspended                 ?? 0,
      expired:               ss.expired                   ?? 0,
      trial:                 ss.trial                     ?? 0,
      unlimited:             ss.unlimited                 ?? 0,
      pending:               ss.pending                   ?? 0,
      rejected:              ss.rejected                  ?? 0,
      totalRevenue:          stats?.totalRevenue           ?? 0,
      approvedRevenue:       stats?.approvedRevenue        ?? 0,
      pendingRevenue:        stats?.pendingRevenue         ?? 0,
      pendingSubscriptions:  stats?.pendingSubscriptions   ?? 0,
      approvedSubscriptions: stats?.approvedSubscriptions  ?? 0,
    };
  }, [accounts, requests, stats, garages]);

  const kpis = [
    { label: 'Total Clients',           value: subscriptionStats.totalClients,                          icon: <Building2 size={22} />,    color: '#6366f1', nav: { tab: 'clients',       filter: 'all'      } },
    { label: 'Active Clients',           value: subscriptionStats.active,                                icon: <CheckCircle2 size={22} />, color: '#10b981', nav: { tab: 'clients',       filter: 'active'   } },
    { label: 'Pending Clients',          value: subscriptionStats.pending,                               icon: <Clock size={22} />,        color: '#f59e0b', nav: { tab: 'clients',       filter: 'pending'  } },
    { label: 'Suspended Clients',        value: subscriptionStats.suspended,                             icon: <Activity size={22} />,     color: '#ef4444', nav: { tab: 'clients',       filter: 'suspended'} },
    { label: 'Rejected Clients',         value: subscriptionStats.rejected,                              icon: <ShieldAlert size={22} />,  color: '#dc2626', nav: { tab: 'clients',       filter: 'rejected' } },
    { label: 'Expired Clients',          value: subscriptionStats.expired,                               icon: <LogOut size={22} />,       color: '#7f1d1d', nav: { tab: 'clients',       filter: 'expired'  } },
    { label: 'Pending Subscriptions',    value: subscriptionStats.pendingSubscriptions,                  icon: <FileText size={22} />,     color: '#f87171', nav: { tab: 'subscriptions', filter: 'pending'  } },
    { label: 'Approved Subscriptions',   value: subscriptionStats.approvedSubscriptions,                 icon: <Check size={22} />,        color: '#34d399', nav: { tab: 'subscriptions', filter: 'approved' } },
    { label: 'Total Revenue',            value: `${fmt(subscriptionStats.totalRevenue)} ETB`,            icon: <Landmark size={22} />,     color: '#8b5cf6', nav: { tab: 'revenue',       filter: 'all'      } },
    { label: 'Pending Revenue',          value: `${fmt(subscriptionStats.pendingRevenue)} ETB`,          icon: <CreditCard size={22} />,   color: '#f59e0b', nav: { tab: 'subscriptions', filter: 'pending'  } },
    { label: 'Approved Revenue',         value: `${fmt(subscriptionStats.approvedRevenue)} ETB`,         icon: <DollarSign size={22} />,   color: '#ec4899', nav: { tab: 'revenue',       filter: 'approved' } },
  ];

  const healthData = [
    { key: 'Repairs', count: stats?.repairs || 0 },
    { key: 'Customers', count: stats?.customers || 0 },
    { key: 'Vehicles', count: stats?.vehicles || 0 },
    { key: 'Inventory Items', count: stats?.inventory || 0 },
    { key: 'Users', count: stats?.users || 0 }
  ];
  const maxCount = Math.max(...healthData.map(d => d.count), 1);
  const storage = totalStorageSize();
  const maxStorage = 5 * 1024 * 1024; // 5MB limit approximation

  return (
    <div className="sap-panel">
      <div className="sap-panel-header">
        <div>
          <h2 className="sap-panel-title">{t("Platform Overview")}</h2>
          <p className="sap-panel-sub">{t("Your MechPro SaaS platform at a glance")}</p>
        </div>
        <div className="sap-online-pill"><span className="sap-dot-green" />{t("System Online")}</div>
      </div>

      <div className="sap-kpi-grid">
        {kpis.map((k, i) => (
          <div key={i} className="sap-kpi-card clickable" style={{ '--accent': k.color, cursor: 'pointer' }} onClick={() => onNavigate(k.nav.tab, k.nav.filter)}>
            <div className="sap-kpi-icon" style={{ background: k.color + '22', color: k.color }}>{k.icon}</div>
            <div className="sap-kpi-body">
              <div className="sap-kpi-value">{k.value}</div>
              <div className="sap-kpi-label">{k.label}</div>
              <div className="sap-kpi-delta" style={{ color: k.color, opacity: 0.8, fontSize: '0.75rem', fontWeight: 600 }}>Manage platform analytics</div>
            </div>
          </div>
        ))}
      </div>

      <div className="sap-health-section">
        <div className="sap-section-label"><Activity size={16} /> {t("Platform Data Health")}</div>
        <div className="sap-health-grid">
          {healthData.map(({ key, count }) => (
            <div key={key} className="sap-health-row">
              <span className="sap-health-key">{key}</span>
              <div className="sap-health-bar-wrap">
                <div className="sap-health-bar" style={{ width: `${Math.max((count / maxCount) * 100, 2)}%` }} />
              </div>
              <span className="sap-health-count">{fmt(count)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sap-storage-card">
        <div className="sap-section-label"><HardDrive size={16} /> Storage Usage</div>
        <div className="sap-storage-bar-wrap">
          <div className="sap-storage-bar" style={{ width: `${Math.min((storage / maxStorage) * 100, 100)}%` }} />
        </div>
        <div className="sap-storage-info">
          <span>{fmtKB(storage)} used</span>
          <span>~5 MB limit</span>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════
   2.  CLIENTS PANEL
════════════════════════════════════════════════════ */
const ClientsPanel = ({ accounts, garages, onRefresh, filterStatus, setFilterStatus, requests, deleteClientAsync }) => {
  const { t } = useAppContext();
  const { 
    registerAsync, reinstateUserAsync, suspendUserAsync,
    grantUnlimitedAsync, revokeUnlimitedAsync
  } = useAuth();
  const { addNotification, showToast } = useAppContext();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [showOnboard, setShowOnboard] = useState(false);
  const [onboardForm, setOnboardForm] = useState({ name: '', garageName: '', email: '', phone: '', password: '' });
  const [onboardErr, setOnboardErr] = useState('');
  const [confirmPurge, setConfirmPurge] = useState(null);

  const enrichedGarages = garages;

  const filtered = enrichedGarages.filter(g => {
    if (search && !g.name.toLowerCase().includes(search.toLowerCase()) &&
      !g.id.toLowerCase().includes(search.toLowerCase())) return false;

    if (filterStatus === 'all') return true;

    if (filterStatus === 'active') return g.status === 'active';
    if (filterStatus === 'suspended') return g.status === 'suspended';
    
    return true;
  });

  const handleOnboard = async () => {
    setOnboardErr('');
    if (!onboardForm.name || !onboardForm.garageName || (!onboardForm.email && !onboardForm.phone) || !onboardForm.password) {
      setOnboardErr('Please fill all required fields.');
      return;
    }
    const result = await registerAsync(onboardForm.name, onboardForm.email, onboardForm.phone, onboardForm.password, 'admin', onboardForm.garageName);
    if (result.success) {
      showToast(`New client "${onboardForm.garageName}" onboarded successfully!`, 'success');
      setShowOnboard(false);
      setOnboardForm({ name: '', garageName: '', email: '', phone: '', password: '' });
      onRefresh();
    } else {
      setOnboardErr(result.message);
    }
  };

  const handlePurge = async (garageId) => {
    try {
      const res = await deleteClientAsync(garageId);
      if (res.success) {
        showToast("Garage and all related data purged successfully.", "success");
        setConfirmPurge(null);
        onRefresh();
      } else {
        showToast(res.message || "Failed to purge client.", "danger");
      }
    } catch (err) {
      showToast(err.message || "Failed to purge client.", "danger");
    }
  };

  const handleSuspendToggle = async (acct) => {
    if (acct.status === 'inactive' || acct.status === 'suspended') {
      if (!window.confirm(`Reinstate full access for ${acct.name || acct.id}?`)) return;
      const res = await reinstateUserAsync(acct.id);
      if (res.success) {
        showToast(`Access reinstated for ${acct.name || acct.id}`, 'success');
        onRefresh();
      } else {
        showToast(res.message || "Failed to reinstate.", "danger");
      }
    } else {
      if (!window.confirm(`Suspend access for ${acct.name || acct.id}? They will be locked out immediately.`)) return;
      const res = await suspendUserAsync(acct.id);
      if (res.success) {
        showToast(`Access suspended for ${acct.name || acct.id}`, 'success');
        onRefresh();
      } else {
        showToast(res.message || "Failed to suspend.", "danger");
      }
    }
  };

  return (
    <div className="sap-panel">
      <div className="sap-panel-header">
        <div>
          <h2 className="sap-panel-title">{t("Client Garages")}</h2>
          <p className="sap-panel-sub">{garages.length} {t("registered businesses on your platform")}</p>
        </div>
        <button className="sap-btn-primary" onClick={() => setShowOnboard(true)}>
          <Plus size={16} /> Onboard New Client
        </button>
      </div>

      <div className="sap-search-row" style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
        <div className="sap-search-wrap" style={{ flex: 1 }}>
          <Search size={16} className="sap-search-icon" />
          <input className="sap-search" placeholder="Search by name, ID, owner…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {filterStatus !== 'all' && (
          <button className="sap-btn-danger sap-btn-outline" onClick={() => setFilterStatus('all')}>
            Clear Filter: {filterStatus.toUpperCase()}
          </button>
        )}
      </div>

      <div className="sap-table-wrap">
        <table className="sap-table">
          <thead>
            <tr>
              <th>{t("Client ID")}</th>
              <th>{t("Business Name")}</th>
              <th>{t("Owner / Admin")}</th>
              <th>{t("Staff")}</th>
              <th>{t("Repairs")}</th>
              <th>{t("Status")}</th>
              <th>{t("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(g => {
              const adminAcct = (g.accounts || []).find(a => a.role === 'admin');
              const isExpanded = expandedId === g.id;
              return (
                <React.Fragment key={g.id}>
                  <tr className={isExpanded ? 'sap-row-expanded' : ''}>
                    <td className="sap-mono">{g.displayId || g.id}</td>
                    <td className="sap-fw600">
                      {g.name}
                      {(g.accounts || []).some(a => a.role === 'admin' && a.subscription?.type === 'unlimited') && (
                        <span className="sap-badge badge-unlimited" style={{ marginLeft: 8 }}>
                          <Shield size={10} fill="currentColor" /> Lifetime
                        </span>
                      )}
                    </td>
                    <td>{g.admin}</td>
                    <td>{(g.accounts || []).filter(a => a.role !== 'customer').length}</td>
                    <td>{g._count?.repairs || 0}</td>
                    <td><StatusBadge status={g.status || 'active'} /></td>
                    <td>
                      <div className="sap-action-row">
                        <button className="sap-icon-btn sap-icon-btn--blue" title="View details" onClick={() => setExpandedId(isExpanded ? null : g.id)}>
                          {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>
                        {adminAcct && (
                          <button className="sap-icon-btn sap-icon-btn--amber" title={adminAcct.status === 'inactive' ? 'Reinstate' : 'Suspend'} onClick={() => handleSuspendToggle(adminAcct)}>
                            <Power size={15} />
                          </button>
                        )}
                        <button className="sap-icon-btn sap-icon-btn--red" title="Purge client" onClick={() => setConfirmPurge(g)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="sap-expand-row">
                      <td colSpan={7}>
                        <div className="sap-expand-body">
                          <div className="sap-expand-label">{t("Team Members")}</div>
                          <div className="sap-member-list">
                            {(g.accounts || []).map(a => (
                              <div key={a.id} className="sap-member-pill">
                                <div className="sap-member-avatar" style={{ background: ROLE_COLORS[a.role] + '22', color: ROLE_COLORS[a.role] }}>
                                  {(a.name || '?').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="sap-member-name">{a.name}</div>
                                  <RoleChip role={a.role} />
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="sap-sys-grid" style={{ marginTop: 24 }}>
                            <div className="sap-storage-card" style={{ flex: 1, border: '1px solid rgba(99, 102, 241, 0.2)', background: 'rgba(99, 102, 241, 0.03)' }}>
                              <div className="sap-section-label" style={{ color: '#6366f1' }}><Zap size={14} /> Subscription Control</div>
                              {adminAcct?.subscription ? (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div>
                                    <div className="sap-fw600" style={{ fontSize: '1rem' }}>{adminAcct.subscription.type.toUpperCase()} PLAN</div>
                                    <div className="sap-text-sm">Expires: {new Date(adminAcct.subscription.expiryDate).toLocaleDateString()}</div>
                                    <div className="sap-text-sm" style={{ color: adminAcct.subscription.status === 'active' ? '#10b981' : '#f43f5e' }}> Status: {adminAcct.subscription.status}</div>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <button
                                      className={`sap-btn-xs ${adminAcct.subscription.type === 'unlimited' ? 'sap-btn-danger' : 'sap-btn-primary'}`}
                                      onClick={async () => {
                                        const isCurrentlyUnlimited = adminAcct.subscription.type === 'unlimited';
                                        const action = isCurrentlyUnlimited ? 'Revoke' : 'Grant';
                                        if (!window.confirm(`${action} Unlimited Lifetime Access for ${g.name}?`)) return;

                                        const res = isCurrentlyUnlimited 
                                          ? await revokeUnlimitedAsync(adminAcct.id)
                                          : await grantUnlimitedAsync(adminAcct.id);
                                        
                                        if (res.success) {
                                          showToast(`Unlimited access ${isCurrentlyUnlimited ? 'revoked' : 'granted'} successfully.`, "success");
                                          onRefresh();
                                        } else {
                                          showToast(res.message || "Operation failed", "danger");
                                        }
                                      }}
                                    >
                                      {adminAcct.subscription.type === 'unlimited' ? 'Revoke Lifetime Access' : 'Grant Lifetime Access'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="sap-text-sm sap-opacity-70">No subscription data found for this admin.</div>
                              )}
                            </div>
                            <div className="sap-storage-card" style={{ flex: 1 }}>
                              <div className="sap-section-label"><BarChart3 size={14} /> Usage Overview</div>
                              <div className="sap-health-grid">
                                <div className="sap-health-row">
                                  <div className="sap-health-key">Inventory Items</div>
                                  <div className="sap-health-bar-wrap"><div className="sap-health-bar" style={{ width: '45%' }} /></div>
                                  <div className="sap-health-count">124</div>
                                </div>
                                <div className="sap-health-row">
                                  <div className="sap-health-key">Staff Accounts</div>
                                  <div className="sap-health-bar-wrap"><div className="sap-health-bar" style={{ width: '30%' }} /></div>
                                  <div className="sap-health-count">{g.accounts.length}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="sap-empty">No clients match your search</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Onboard Modal */}
      {showOnboard && (
        <div className="sap-modal-overlay" onClick={() => setShowOnboard(false)}>
          <div className="sap-modal" onClick={e => e.stopPropagation()}>
            <div className="sap-modal-header">
              <h3>Onboard New Client</h3>
              <button className="sap-modal-close" onClick={() => setShowOnboard(false)}><X size={18} /></button>
            </div>
            <div className="sap-modal-body">
              {onboardErr && <div className="sap-error-box">{onboardErr}</div>}
              {[
                { label: 'Owner Name *', key: 'name', type: 'text', placeholder: 'E.g. Abebe Girma' },
                { label: 'Garage / Business Name *', key: 'garageName', type: 'text', placeholder: 'E.g. Abebe Auto Center' },
                { label: 'Email', key: 'email', type: 'email', placeholder: 'owner@garage.com' },
                { label: 'Phone', key: 'phone', type: 'text', placeholder: '0911000000' },
                { label: 'Password *', key: 'password', type: 'password', placeholder: 'Strong password' },
              ].map(f => (
                <div key={f.key} className="sap-form-group">
                  <label className="sap-form-label">{f.label}</label>
                  <input className="sap-form-input" type={f.type} placeholder={f.placeholder}
                    value={onboardForm[f.key]} onChange={e => setOnboardForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="sap-modal-footer">
              <button className="sap-btn-ghost" onClick={() => setShowOnboard(false)}>Cancel</button>
              <button className="sap-btn-primary" onClick={handleOnboard}><Check size={16} /> Onboard Client</button>
            </div>
          </div>
        </div>
      )}

      {/* Purge Confirm Modal */}
      {confirmPurge && (
        <div className="sap-modal-overlay" onClick={() => setConfirmPurge(null)}>
          <div className="sap-modal sap-modal--danger" onClick={e => e.stopPropagation()}>
            <div className="sap-modal-header">
              <h3><AlertTriangle size={18} style={{ color: '#f43f5e' }} /> Confirm Purge</h3>
              <button className="sap-modal-close" onClick={() => setConfirmPurge(null)}><X size={18} /></button>
            </div>
            <div className="sap-modal-body">
              <p>This will permanently delete all accounts, repairs, invoices, and data belonging to:</p>
              <div className="sap-danger-name">{confirmPurge.name} <span className="sap-mono">({confirmPurge.id})</span></div>
              <p style={{ color: '#f43f5e', fontSize: '0.85rem' }}>⚠ This action cannot be undone.</p>
            </div>
            <div className="sap-modal-footer">
              <button className="sap-btn-ghost" onClick={() => setConfirmPurge(null)}>Cancel</button>
              <button className="sap-btn-danger" onClick={() => handlePurge(confirmPurge.id)}><Trash2 size={16} /> Purge Client</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════════════════
   3.  USERS PANEL
════════════════════════════════════════════════════ */
const UsersPanel = ({ accounts, garages, onRefresh }) => {
  const { t, showToast } = useAppContext();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [garageFilter, setGarageFilter] = useState('all');
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const { currentUser, suspendUserAsync } = useAuth();

  const allRoles = [...new Set(accounts.map(a => a.role))].sort();

  const filtered = accounts.filter(a => {
    if (a.id === 'devroot' || a.role === 'coder') return false;
    const matchSearch = !search ||
      (a.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.phone || '').includes(search) ||
      (a.id || '').includes(search);
    const matchRole = roleFilter === 'all' || a.role === roleFilter;
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    const matchGarage = garageFilter === 'all' || a.ownerId === garageFilter;
    return matchSearch && matchRole && matchStatus && matchGarage;
  });

  const openEdit = (u) => {
    setEditUser(u);
    setEditForm({ name: u.name, role: u.role, status: u.status || 'active', password: '' });
  };

  const saveEdit = async () => {
    // Note: Need a general User Update endpoint on backend for name/role changes
    showToast("Server-side user updates not yet implemented in API.", "info");
    setEditUser(null);
  };

  const deleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to suspend this user?")) return;
    const res = await suspendUserAsync(userId);
    if (res.success) {
      showToast("User suspended successfully.", "success");
      onRefresh();
    } else {
      showToast(res.message || "Failed to suspend user.", "danger");
    }
  };

  return (
    <div className="sap-panel">
      <div className="sap-panel-header">
        <div>
          <h2 className="sap-panel-title">Platform Users</h2>
          <p className="sap-panel-sub">{filtered.length} users shown</p>
        </div>
      </div>

      <div className="sap-filter-row">
        <div className="sap-search-wrap">
          <Search size={15} className="sap-search-icon" />
          <input className="sap-search" placeholder="Name, email, phone, ID…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="sap-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="all">All Roles</option>
          {allRoles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="sap-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Suspended</option>
          <option value="deleted">Deleted</option>
        </select>
        <select className="sap-select" value={garageFilter} onChange={e => setGarageFilter(e.target.value)}>
          <option value="all">All Clients</option>
          {garages.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      <div className="sap-table-wrap">
        <table className="sap-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Role</th>
              <th>Client</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => {
              const garage = garages.find(g => g.id === u.ownerId);
              return (
                <tr key={u.id}>
                  <td>
                    <div className="sap-user-cell">
                      <div className="sap-avatar-sm" style={{ background: ROLE_COLORS[u.role] + '22', color: ROLE_COLORS[u.role] }}>
                        {(u.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <span className="sap-fw600">{u.name}</span>
                    </div>
                  </td>
                  <td className="sap-text-sm">{u.email || u.phone || '—'}</td>
                  <td><RoleChip role={u.role} /></td>
                  <td className="sap-text-sm">{garage?.name || u.ownerId}</td>
                  <td><StatusBadge status={u.status || 'active'} /></td>
                  <td>
                    <div className="sap-action-row">
                      <button className="sap-icon-btn sap-icon-btn--blue" title="Edit" onClick={() => openEdit(u)}><Edit3 size={15} /></button>
                      {u.id !== currentUser?.id && (
                        <button className="sap-icon-btn sap-icon-btn--red" title="Delete" onClick={() => setConfirmDelete(u)}><Trash2 size={15} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={6} className="sap-empty">No users match your filters</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editUser && (
        <div className="sap-modal-overlay" onClick={() => setEditUser(null)}>
          <div className="sap-modal" onClick={e => e.stopPropagation()}>
            <div className="sap-modal-header">
              <h3><Edit3 size={16} /> Edit User</h3>
              <button className="sap-modal-close" onClick={() => setEditUser(null)}><X size={18} /></button>
            </div>
            <div className="sap-modal-body">
              <div className="sap-form-group">
                <label className="sap-form-label">Full Name</label>
                <input className="sap-form-input" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="sap-form-group">
                <label className="sap-form-label">Role</label>
                <select className="sap-form-input" value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}>
                  {['admin', 'manager', 'mechanic', 'receptionist', 'cashier', 'storekeeper', 'inventoryManager', 'customer'].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="sap-form-group">
                <label className="sap-form-label">Status</label>
                <select className="sap-form-input" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Suspended</option>
                  <option value="deleted">Deleted</option>
                </select>
              </div>
              <div className="sap-form-group">
                <label className="sap-form-label">New Password <span style={{ opacity: 0.5 }}>(leave blank to keep)</span></label>
                <div className="sap-pw-wrap">
                  <input className="sap-form-input" type={showPw ? 'text' : 'password'} placeholder="••••••••"
                    value={editForm.password} onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))} />
                  <button className="sap-pw-toggle" onClick={() => setShowPw(p => !p)}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="sap-modal-footer">
              <button className="sap-btn-ghost" onClick={() => setEditUser(null)}>Cancel</button>
              <button className="sap-btn-primary" onClick={saveEdit}><Check size={16} /> Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <div className="sap-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="sap-modal sap-modal--danger" onClick={e => e.stopPropagation()}>
            <div className="sap-modal-header">
              <h3><AlertTriangle size={18} style={{ color: '#f43f5e' }} /> Confirm Deletion</h3>
              <button className="sap-modal-close" onClick={() => setConfirmDelete(null)}><X size={18} /></button>
            </div>
            <div className="sap-modal-body">
              <p>Permanently remove <strong>{confirmDelete.name}</strong> from the platform?</p>
            </div>
            <div className="sap-modal-footer">
              <button className="sap-btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="sap-btn-danger" onClick={() => deleteUser(confirmDelete.id)}><Trash2 size={16} /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════════════════
   4.  ANALYTICS PANEL
════════════════════════════════════════════════════ */
const AnalyticsPanel = ({ garages, accounts, stats }) => {
  const garageStats = useMemo(() => garages.map(g => {
    // Note: Backend currently doesn't provide per-garage revenue in platform-stats
    // We can estimate or show zero until the backend is further extended
    return { ...g, revenue: 0, repairCount: g._count?.repairs || 0 };
  }).sort((a, b) => b.revenue - a.revenue).slice(0, 6), [garages]);

  const maxRevenue = Math.max(...garageStats.map(g => g.revenue), 1);

  const statusCounts = useMemo(() => {
    const total = stats?.repairs || 0;
    // Mock distribution for now or update backend to provide this
    return [
      { label: 'Completed', count: Math.round(total * 0.7), pct: 70, color: '#10b981' },
      { label: 'In Progress', count: Math.round(total * 0.2), pct: 20, color: '#f59e0b' },
      { label: 'Pending', count: Math.round(total * 0.1), pct: 10, color: '#6366f1' },
    ];
  }, [stats]);

  const roleCounts = useMemo(() => {
    const map = {};
    accounts.forEach(a => { if (a.role !== 'coder') map[a.role] = (map[a.role] || 0) + 1; });
    const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(map).map(([role, count]) => ({ role, count, pct: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count);
  }, [accounts]);

  // Donut
  const total = statusCounts.reduce((s, c) => s + c.count, 0);
  let cumPct = 0;
  const donutSegments = statusCounts.map(s => {
    const stroke = (s.pct / 100) * (2 * Math.PI * 36);
    const offset = (cumPct / 100) * (2 * Math.PI * 36);
    cumPct += s.pct;
    return { ...s, stroke, offset };
  });

  return (
    <div className="sap-panel">
      <div className="sap-panel-header">
        <div>
          <h2 className="sap-panel-title">Platform Analytics</h2>
          <p className="sap-panel-sub">Revenue, repairs, and user insights</p>
        </div>
      </div>

      <div className="sap-analytics-grid">
        {/* Revenue Bar Chart */}
        <div className="sap-chart-card">
          <div className="sap-chart-title"><DollarSign size={16} /> Revenue by Client</div>
          <div className="sap-bar-chart">
            {garageStats.map((g, i) => (
              <div key={g.id} className="sap-bar-row">
                <span className="sap-bar-label" title={g.name}>{g.name.length > 14 ? g.name.slice(0, 14) + '…' : g.name}</span>
                <div className="sap-bar-track">
                  <div className="sap-bar-fill" style={{ width: `${(g.revenue / maxRevenue) * 100}%`, background: `hsl(${i * 47 + 230}, 70%, 65%)` }} />
                </div>
                <span className="sap-bar-val">{fmt(Math.round(g.revenue))} ETB</span>
              </div>
            ))}
            {garageStats.length === 0 && <div className="sap-empty">No revenue data yet</div>}
          </div>
        </div>

        {/* Donut */}
        <div className="sap-chart-card">
          <div className="sap-chart-title"><Wrench size={16} /> Repair Status</div>
          <div className="sap-donut-wrap">
            <svg width="130" height="130" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" fill="none" stroke="#1e293b" strokeWidth="8" />
              {donutSegments.map((s, i) => (
                <circle key={i} cx="40" cy="40" r="36" fill="none"
                  stroke={s.color} strokeWidth="8"
                  strokeDasharray={`${s.stroke} ${2 * Math.PI * 36 - s.stroke}`}
                  strokeDashoffset={-(s.offset - (2 * Math.PI * 36 * 0.25))}
                  style={{ transition: 'stroke-dasharray 0.5s ease' }} />
              ))}
              <text x="40" y="38" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="700">{total}</text>
              <text x="40" y="50" textAnchor="middle" fill="#94a3b8" fontSize="7">repairs</text>
            </svg>
            <div className="sap-donut-legend">
              {statusCounts.map(s => (
                <div key={s.label} className="sap-legend-item">
                  <span className="sap-legend-dot" style={{ background: s.color }} />
                  <span>{s.label}</span>
                  <span className="sap-legend-val">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Role Distribution */}
        <div className="sap-chart-card sap-chart-card--wide">
          <div className="sap-chart-title"><Users size={16} /> User Role Distribution</div>
          <div className="sap-role-chart">
            {roleCounts.map(({ role, count, pct }) => (
              <div key={role} className="sap-role-row">
                <RoleChip role={role} />
                <div className="sap-role-bar-track">
                  <div className="sap-role-bar-fill" style={{ width: `${pct}%`, background: ROLE_COLORS[role] }} />
                </div>
                <span className="sap-role-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════
   5.  SYSTEM PANEL
════════════════════════════════════════════════════ */
const SystemPanel = ({ onRefresh, platformPurgeAsync }) => {
  const { t, showToast } = useAppContext();
  const [logs, setLogs] = useState([]);
  const [storageKeys, setStorageKeys] = useState([]);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [purgeInput, setPurgeInput] = useState('');

  const loadData = useCallback(() => {
    try {
      setLogs(JSON.parse(localStorage.getItem('garage_debug_logs') || '[]'));
    } catch { setLogs([]); }

    const keys = [];
    try {
      for (const k of Object.keys(localStorage)) {
        const size = storageSize(k);
        if (size > 0) keys.push({ key: k, size });
      }
    } catch { }
    keys.sort((a, b) => b.size - a.size);
    setStorageKeys(keys);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const clearLogs = () => { localStorage.removeItem('garage_debug_logs'); loadData(); };

  const exportAll = () => {
    try {
      const dump = {};
      for (const k of Object.keys(localStorage)) { try { dump[k] = JSON.parse(localStorage.getItem(k)); } catch { dump[k] = localStorage.getItem(k); } }
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `mechpro_export_${Date.now()}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert('Export failed: ' + e.message); }
  };

  const globalWipe = async () => {
    if (purgeInput !== 'PURGE ALL') {
      showToast("Please type PURGE ALL to confirm platform purge.", "warning");
      return;
    }
    setConfirmWipe(false);
    try {
      const res = await platformPurgeAsync();
      if (res.success) {
        showToast("Platform data purged successfully. Reloading platform...", "success");
        setTimeout(() => {
          localStorage.clear();
          window.location.reload();
        }, 1500);
      } else {
        showToast(res.message || "Failed to purge database.", "danger");
      }
    } catch (err) {
      showToast(err.message || "Failed to purge database.", "danger");
    }
  };

  const LOG_COLORS = {
    SAVE_SUCCESS: '#10b981', LOAD_MISSING: '#94a3b8', SAVE_ERROR: '#f43f5e',
    LOAD_ERROR: '#f43f5e', RECOVERY_SUCCESS: '#f59e0b', SAVE_REJECTED: '#f59e0b',
    INIT_LOAD_COMPLETE: '#6366f1', INIT_LOAD_START: '#6366f1',
  };

  const maxKeySize = Math.max(...storageKeys.map(k => k.size), 1);

  return (
    <div className="sap-panel">
      <div className="sap-panel-header">
        <div>
          <h2 className="sap-panel-title">System Operations</h2>
          <p className="sap-panel-sub">Storage, debug logs, and platform controls</p>
        </div>
        <div className="sap-action-row">
          <button className="sap-btn-ghost" onClick={loadData}><RefreshCw size={15} /> Refresh</button>
          <button className="sap-btn-ghost" onClick={exportAll}><Download size={15} /> Export All</button>
        </div>
      </div>

      <div className="sap-sys-grid">
        {/* Storage Breakdown */}
        <div className="sap-chart-card">
          <div className="sap-chart-title"><HardDrive size={16} /> Storage Breakdown</div>
          <div className="sap-storage-table">
            {storageKeys.slice(0, 15).map(({ key, size }) => (
              <div key={key} className="sap-storage-row">
                <span className="sap-storage-key" title={key}>{key.length > 32 ? '…' + key.slice(-30) : key}</span>
                <div className="sap-storage-mini-bar-track">
                  <div className="sap-storage-mini-bar" style={{ width: `${(size / maxKeySize) * 100}%` }} />
                </div>
                <span className="sap-storage-sz">{fmtKB(size)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Debug Logs */}
        <div className="sap-chart-card">
          <div className="sap-chart-title" style={{ justifyContent: 'space-between' }}>
            <span><Activity size={16} /> Debug Logs</span>
            <button className="sap-btn-ghost sap-btn-xs" onClick={clearLogs}>Clear</button>
          </div>
          <div className="sap-log-scroll">
            {logs.length === 0 ? (
              <div className="sap-empty">No debug logs</div>
            ) : logs.map((log, i) => (
              <div key={i} className="sap-log-entry">
                <span className="sap-log-time">{new Date(log.time).toLocaleTimeString()}</span>
                <span className="sap-log-op" style={{ color: LOG_COLORS[log.op] || '#94a3b8' }}>{log.op}</span>
                <span className="sap-log-msg">[{log.key}] {log.details}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="sap-danger-zone">
        <div className="sap-danger-header"><AlertTriangle size={18} /> Danger Zone</div>
        <p className="sap-danger-desc">Irreversible destructive actions. Proceed with extreme caution.</p>
        <div className="sap-danger-actions">
          <button className="sap-btn-danger sap-btn-outline" onClick={clearLogs}><Activity size={15} /> Clear All Logs</button>
          <button className="sap-btn-danger" onClick={() => setConfirmWipe(true)}><Trash2 size={15} /> Global Platform Purge</button>
        </div>
      </div>

      {confirmWipe && (
        <div className="sap-modal-overlay" onClick={() => { setConfirmWipe(false); setPurgeInput(''); }}>
          <div className="sap-modal sap-modal--danger" onClick={e => e.stopPropagation()}>
            <div className="sap-modal-header">
              <h3><AlertTriangle size={18} style={{ color: '#f43f5e' }} /> GLOBAL PURGE</h3>
              <button className="sap-modal-close" onClick={() => { setConfirmWipe(false); setPurgeInput(''); }}><X size={18} /></button>
            </div>
            <div className="sap-modal-body">
              <p>This will erase <strong>ALL data</strong> across the entire platform — all clients, users, repairs, messages, and logs.</p>
              <p style={{ color: '#f43f5e', marginTop: 8, fontWeight: 600 }}>This action is terminal and cannot be undone.</p>
              <div className="sap-form-group" style={{ marginTop: 15 }}>
                <label className="sap-form-label" style={{ color: '#e2e8f0' }}>Type <strong>PURGE ALL</strong> to confirm:</label>
                <input
                  type="text"
                  className="sap-form-input"
                  style={{ borderColor: '#f43f5e', background: 'rgba(244, 63, 94, 0.05)' }}
                  placeholder="PURGE ALL"
                  value={purgeInput}
                  onChange={e => setPurgeInput(e.target.value)}
                />
              </div>
            </div>
            <div className="sap-modal-footer">
              <button className="sap-btn-ghost" onClick={() => { setConfirmWipe(false); setPurgeInput(''); }}>Cancel</button>
              <button className="sap-btn-danger" onClick={globalWipe} disabled={purgeInput !== 'PURGE ALL'}><Trash2 size={16} /> Confirm Purge Everything</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════════════════
   6.  BROADCAST PANEL
════════════════════════════════════════════════════ */
// ... (existing BroadcastPanel code)

/* ════════════════════════════════════════════════════
   7.  SUBSCRIPTIONS PANEL
════════════════════════════════════════════════════ */
const SubscriptionsPanel = ({ accounts, garages, requests, onApprove, onReject, revenueFilter, setRevenueFilter }) => {
  const { t } = useAppContext();
  const { updateOtherAccount } = useAuth();
  const filter = revenueFilter && revenueFilter !== 'all' ? revenueFilter : 'pending';
  const setFilter = setRevenueFilter || (() => { });
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [approvingId, setApprovingId] = useState(null);

  const handleApproveWithIndicator = (r) => {
    setApprovingId(r.id);
    setTimeout(() => {
      onApprove(r);
      setApprovingId(null);
    }, 800);
  };



  return (
    <div className="sap-panel">
      <div className="sap-panel-header">
        <div>
          <h2 className="sap-panel-title">Subscription Requests</h2>
          <p className="sap-panel-sub">Verify payments and activate client accounts</p>
        </div>
      </div>

      <div className="sap-filter-row">
        <button className={`sap-btn-ghost ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>Pending</button>
        <button className={`sap-btn-ghost ${filter === 'approved' ? 'active' : ''}`} onClick={() => setFilter('approved')}>Approved</button>
        <button className={`sap-btn-ghost ${filter === 'rejected' ? 'active' : ''}`} onClick={() => setFilter('rejected')}>Rejected</button>
      </div>

      <div className="sap-table-wrap">
        <table className="sap-table">
          <thead>
            <tr>
              <th>Client / Garage</th>
              <th>Plan</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Receipt</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr><td colSpan="6" className="sap-empty">No pending payment requests</td></tr>
            ) : (
              requests.filter(r => r.status === filter).map(r => (
                <tr key={r.id}>
                  <td>
                    <div className="sap-user-cell">
                      <div>
                        <div className="sap-fw600">{garages.find(g => g.id === r.garageId)?.name || r.admin?.garageName || 'Unknown Garage'}</div>
                        <div className="sap-text-sm">{r.admin?.name || ''} &bull; ID: {r.garageId?.slice(0, 12) || '-'}</div>
                      </div>
                    </div>
                  </td>
                  <td><RoleChip role={r.planId} /></td>
                  <td className="sap-fw600">{r.amount} ETB</td>
                  <td className="sap-text-sm">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="sap-icon-btn sap-icon-btn--blue"
                      title="View Receipt"
                      onClick={() => setViewingReceipt(r)}
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                  <td>
                    <div className="sap-action-row">
                      {approvingId === r.id ? (
                        <div className="sap-success-indicator">
                          <CheckCircle2 size={18} color="#10b981" />
                          <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 600 }}>Approved</span>
                        </div>
                      ) : (
                        <>
                          {(r.status === 'pending' || r.status === 'rejected') && (
                            <button className="sap-btn-xs sap-btn-primary" onClick={() => handleApproveWithIndicator(r)}>
                              {r.status === 'rejected' ? 'Approve Again' : 'Approve'}
                            </button>
                          )}
                          {(r.status === 'pending' || r.status === 'approved') && (
                            <button className="sap-btn-xs sap-btn-danger sap-btn-outline" onClick={() => onReject(r)}>
                              {r.status === 'approved' ? 'Reject & Suspend' : 'Reject'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* RECEIPT VIEWER MODAL */}
      {viewingReceipt && (
        <div className="sap-modal-overlay" onClick={() => setViewingReceipt(null)}>
          <div className="sap-modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="sap-modal-header">
              <div>
                <h3 className="sap-modal-title">Payment Verification</h3>
                <p className="sap-modal-sub">Submitted by {garages.find(g => g.id === viewingReceipt.garageId)?.name || viewingReceipt.admin?.garageName || 'Unknown Garage'}</p>
              </div>
              <button className="sap-modal-close" onClick={() => setViewingReceipt(null)}><X size={20} /></button>
            </div>
            <div className="sap-modal-body" style={{ background: '#0a0f18' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                <div className="sap-chart-card" style={{ padding: 15 }}>
                  <div className="sap-text-xs sap-opacity-60">Plan Selected</div>
                  <div className="sap-fw600" style={{ color: '#6366f1' }}>{viewingReceipt.planName || viewingReceipt.planId}</div>
                </div>
                <div className="sap-chart-card" style={{ padding: 15 }}>
                  <div className="sap-text-xs sap-opacity-60">Amount Paid</div>
                  <div className="sap-fw600" style={{ color: '#10b981' }}>{viewingReceipt.amount} ETB</div>
                </div>
              </div>

              {viewingReceipt.referenceNumber && (
                <div className="sap-chart-card" style={{ padding: 15, marginBottom: 20 }}>
                  <div className="sap-text-xs sap-opacity-60">Reference Number</div>
                  <div className="sap-fw600" style={{ fontFamily: 'monospace' }}>{viewingReceipt.referenceNumber}</div>
                </div>
              )}

              {viewingReceipt.notes && (
                <div className="sap-chart-card" style={{ padding: 15, marginBottom: 20 }}>
                  <div className="sap-text-xs sap-opacity-60">Client Notes</div>
                  <div className="sap-text-sm">{viewingReceipt.notes}</div>
                </div>
              )}

              <div className="sap-section-label" style={{ marginBottom: 10 }}>Evidence Screenshot</div>
              <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: '#000' }}>
                <img
                  src={viewingReceipt.receipt}
                  alt="Receipt"
                  style={{ width: '100%', maxHeight: 400, objectFit: 'contain', display: 'block' }}
                />
              </div>
            </div>
            <div className="sap-modal-footer">
              <button className="sap-btn-ghost" onClick={() => setViewingReceipt(null)}>Close</button>
              {viewingReceipt && (
                <>
                  {(viewingReceipt.status === 'pending' || viewingReceipt.status === 'approved') && (
                    <button className="sap-btn-danger sap-btn-outline" onClick={() => { onReject(viewingReceipt); setViewingReceipt(null); }}>
                      {viewingReceipt.status === 'approved' ? 'Reject (Override)' : 'Reject'}
                    </button>
                  )}
                  {(viewingReceipt.status === 'pending' || viewingReceipt.status === 'rejected') && (
                    <button className="sap-btn-primary" onClick={() => { handleApproveWithIndicator(viewingReceipt); setViewingReceipt(null); }}>
                      {viewingReceipt.status === 'rejected' ? 'Approve (Override)' : 'Approve & Activate'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════════════════
   8.  FINANCE PANEL
════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════
   8.  FINANCE PANEL
════════════════════════════════════════════════════ */
const FinancePanel = () => {
  const { t } = useAppContext();
  const { getPlatformSettingsAsync, updatePlatformSettingsAsync, showToast } = useAuth();
  const [settings, setSettings] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showAddAcc, setShowAddAcc] = useState(false);
  const [editingAcc, setEditingAcc] = useState(null);
  const [accForm, setAccForm] = useState({
    type: 'bank', provider: ETHIOPIAN_BANKS[0], accountName: '', accountNumber: '',
    branchName: '', mobileNumber: '', instructions: '', status: 'active'
  });

  // Plans Management States
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({
    name: '', duration: 30, price: 0, status: 'active'
  });

  const loadData = useCallback(async () => {
    const s = await getPlatformSettingsAsync();
    setSettings(s);
  }, [getPlatformSettingsAsync]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveSettings = async (newSettings) => {
    const s = newSettings || settings;
    const res = await updatePlatformSettingsAsync(s);
    if (res.success) {
      setSettings({ ...s });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      showToast(res.message || "Failed to save settings.", "danger");
    }
  };

  // Plans Handlers
  const handleAddPlan = () => {
    if (!planForm.name || planForm.duration <= 0 || planForm.price < 0) {
      showToast("Please fill all plan fields correctly.", "warning");
      return;
    }
    const newId = planForm.name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    const newPlan = {
      id: newId,
      name: planForm.name,
      duration: Number(planForm.duration),
      price: Number(planForm.price),
      status: planForm.status
    };
    const updated = {
      ...settings,
      plans: [...(settings.plans || []), newPlan]
    };
    saveSettings(updated);
    setShowAddPlan(false);
    setPlanForm({ name: '', duration: 30, price: 0, status: 'active' });
  };

  const handleEditPlan = () => {
    if (!editingPlan.name || editingPlan.duration <= 0 || editingPlan.price < 0) {
      showToast("Please fill all plan fields correctly.", "warning");
      return;
    }
    const updated = {
      ...settings,
      plans: (settings?.plans || []).map(p => p.id === editingPlan.id ? { ...editingPlan, price: Number(editingPlan.price), duration: Number(editingPlan.duration) } : p)
    };
    saveSettings(updated);
    setEditingPlan(null);
  };

  const togglePlanStatus = (id) => {
    const updated = {
      ...settings,
      plans: (settings?.plans || []).map(p =>
        p.id === id ? { ...p, status: p.status === 'active' ? 'inactive' : 'active' } : p
      )
    };
    saveSettings(updated);
  };

  const deletePlan = (id) => {
    if (!confirm("Are you sure you want to delete this subscription plan?")) return;
    const updated = {
      ...settings,
      plans: (settings?.plans || []).filter(p => p.id !== id)
    };
    saveSettings(updated);
  };

  // Payment Methods Handlers
  const toggleAccountStatus = (id) => {
    const updated = {
      ...settings,
      paymentMethods: (settings?.paymentMethods || []).map(m =>
        m.id === id ? { ...m, status: m.status === 'active' ? 'inactive' : 'active' } : m
      )
    };
    saveSettings(updated);
  };

  const deleteAccount = (id) => {
    if (!confirm("Are you sure you want to delete this payment account?")) return;
    const updated = {
      ...settings,
      paymentMethods: (settings?.paymentMethods || []).filter(m => m.id !== id)
    };
    saveSettings(updated);
  };

  const handleAddAccount = () => {
    const newAcc = {
      ...accForm,
      id: `acc_${Date.now()}`
    };
    const updated = {
      ...settings,
      paymentMethods: [...(settings?.paymentMethods || []), newAcc]
    };
    saveSettings(updated);
    setShowAddAcc(false);
    setAccForm({ type: 'bank', provider: ETHIOPIAN_BANKS[0], accountName: '', accountNumber: '', branchName: '', mobileNumber: '', instructions: '', status: 'active' });
  };

  const handleEditAccountSubmit = () => {
    const updated = {
      ...settings,
      paymentMethods: (settings?.paymentMethods || []).map(m => m.id === editingAcc.id ? { ...editingAcc } : m)
    };
    saveSettings(updated);
    setEditingAcc(null);
  };

  if (!settings) return null;

  return (
    <div className="sap-panel">
      <div className="sap-panel-header">
        <div>
          <h2 className="sap-panel-title">Finance Configuration</h2>
          <p className="sap-panel-sub">Manage subscription plans, pricing, and bank accounts</p>
        </div>
        {success && <div className="sap-badge badge-active">Settings Saved Successfully!</div>}
      </div>

      <div className="sap-sys-grid" style={{ gap: 24 }}>
        {/* SUBSCRIPTION PLANS SECTION */}
        <div className="sap-chart-card">
          <div className="sap-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><DollarSign size={14} /> Subscription Plans</div>
            <button className="sap-btn-ghost sap-btn-xs" onClick={() => setShowAddPlan(true)}><Plus size={14} /> Add Plan</button>
          </div>
          
          <div className="sap-member-list" style={{ marginTop: 15, maxHeight: 310, overflowY: 'auto', paddingRight: 5 }}>
            {(settings?.plans || []).length === 0 ? (
              <div className="sap-empty" style={{ padding: 20 }}>No subscription plans configured</div>
            ) : (
              (settings?.plans || []).map(p => (
                <div key={p.id} className="sap-member-pill" style={{ width: '100%', justifyContent: 'space-between', padding: 12, background: p.status === 'inactive' ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)', opacity: p.status === 'inactive' ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="sap-member-avatar" style={{ background: p.status === 'inactive' ? '#475569' : 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                      <Zap size={15} />
                    </div>
                    <div>
                      <div className="sap-member-name" style={{ fontSize: '0.95rem' }}>{p.name}</div>
                      <div className="sap-text-sm" style={{ fontWeight: 700, color: '#10b981' }}>{p.price} ETB <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>({p.duration} days)</span></div>
                    </div>
                  </div>
                  <div className="sap-action-row">
                    <button className="sap-icon-btn sap-icon-btn--blue" title="Edit Plan" onClick={() => setEditingPlan(p)}>
                      <Edit3 size={13} />
                    </button>
                    <button className={`sap-icon-btn ${p.status === 'active' ? 'sap-icon-btn--amber' : 'sap-icon-btn--green'}`} title={p.status === 'active' ? 'Disable' : 'Enable'} onClick={() => togglePlanStatus(p.id)}>
                      <Power size={13} />
                    </button>
                    <button className="sap-icon-btn sap-icon-btn--red" title="Delete Plan" onClick={() => deletePlan(p.id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PAYMENT ACCOUNTS SECTION */}
        <div className="sap-chart-card">
          <div className="sap-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Landmark size={14} /> Payment Accounts</div>
            <button className="sap-btn-ghost sap-btn-xs" onClick={() => setShowAddAcc(true)}><Plus size={14} /> Add Account</button>
          </div>
          
          <div className="sap-member-list" style={{ marginTop: 15, maxHeight: 310, overflowY: 'auto', paddingRight: 5 }}>
            {(settings?.paymentMethods || []).length === 0 ? (
              <div className="sap-empty" style={{ padding: 20 }}>No payment accounts configured</div>
            ) : (
              (settings?.paymentMethods || []).map(m => (
                <div key={m.id} className="sap-member-pill" style={{ width: '100%', justifyContent: 'space-between', padding: 12, background: m.status === 'inactive' ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)', opacity: m.status === 'inactive' ? 0.6 : 1, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="sap-member-avatar" style={{ background: m.type === 'bank' ? '#6366f1' : '#10b981' }}>
                        {m.type === 'bank' ? <Landmark size={15} /> : <Radio size={15} />}
                      </div>
                      <div>
                        <div className="sap-member-name" style={{ fontSize: '0.95rem' }}>{m.provider}</div>
                        <div className="sap-text-sm" style={{ fontFamily: 'monospace', color: '#6366f1', fontWeight: 600 }}>{m.type === 'bank' ? m.accountNumber : m.mobileNumber}</div>
                        <div className="sap-text-xs sap-opacity-60">{m.accountName}</div>
                      </div>
                    </div>
                    <div className="sap-action-row">
                      <button className="sap-icon-btn sap-icon-btn--blue" title="Edit Account" onClick={() => setEditingAcc(m)}>
                        <Edit3 size={13} />
                      </button>
                      <button className={`sap-icon-btn ${m.status === 'active' ? 'sap-icon-btn--amber' : 'sap-icon-btn--green'}`} title={m.status === 'active' ? 'Deactivate' : 'Activate'} onClick={() => toggleAccountStatus(m.id)}>
                        <Power size={13} />
                      </button>
                      <button className="sap-icon-btn sap-icon-btn--red" title="Delete Account" onClick={() => deleteAccount(m.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  {m.instructions && (
                    <div className="sap-text-xs sap-opacity-70" style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', borderLeft: '3px solid #6366f1' }}>
                      <strong>Instructions:</strong> {m.instructions}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* POLICY SECTION */}
      <div className="sap-storage-card" style={{ marginTop: 24 }}>
        <div className="sap-section-label" style={{ marginBottom: 15 }}><Zap size={14} /> Global Subscription Policy</div>
        <div className="sap-form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
          <div className="sap-form-group">
            <label className="sap-form-label">Default Free Trial (Days)</label>
            <input
              type="number"
              className="sap-form-input"
              value={settings?.trialDays ?? ''}
              onChange={(e) => setSettings({ ...settings, trialDays: Number(e.target.value) })}
            />
          </div>
          <div className="sap-form-group">
            <label className="sap-form-label">Global Tax Rate (%)</label>
            <input
              type="number"
              className="sap-form-input"
              value={settings?.taxRate ?? ''}
              onChange={(e) => setSettings({ ...settings, taxRate: parseFloat(e.target.value) })}
            />
          </div>
          <div className="sap-form-group">
            <label className="sap-form-label">Platform Service Fee (ETB)</label>
            <input
              type="number"
              className="sap-form-input"
              value={settings?.platformFees ?? ''}
              onChange={(e) => setSettings({ ...settings, platformFees: parseFloat(e.target.value) })}
            />
          </div>
        </div>
        <div className="sap-form-group" style={{ marginTop: 20 }}>
          <label className="sap-form-label">System Enforcement Status</label>
          <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
            <StatusBadge status="active" />
            <span className="sap-text-sm sap-opacity-70">Monitors all garage accounts every 5 minutes. Suspends access instantly upon expiry.</span>
          </div>
        </div>
        <button className="sap-btn-primary" style={{ marginTop: 24, padding: '10px 24px' }} onClick={() => saveSettings()}>
          Update Platform Policy
        </button>
      </div>

      {/* ADD PLAN MODAL */}
      {showAddPlan && (
        <div className="sap-modal-overlay">
          <div className="sap-modal" style={{ maxWidth: 460 }}>
            <div className="sap-modal-header">
              <h3 className="sap-modal-title">Add Subscription Plan</h3>
              <button className="sap-modal-close" onClick={() => setShowAddPlan(false)}><X size={20} /></button>
            </div>
            <div className="sap-modal-body">
              <div className="sap-form-group">
                <label className="sap-form-label">Plan Name</label>
                <input
                  type="text" className="sap-form-input"
                  placeholder="e.g. 3-Month Plan"
                  value={planForm.name}
                  onChange={e => setPlanForm({ ...planForm, name: e.target.value })}
                />
              </div>
              <div className="sap-form-group">
                <label className="sap-form-label">Duration (Days)</label>
                <input
                  type="number" className="sap-form-input"
                  placeholder="e.g. 90"
                  value={planForm.duration}
                  onChange={e => setPlanForm({ ...planForm, duration: Number(e.target.value) })}
                />
              </div>
              <div className="sap-form-group">
                <label className="sap-form-label">Price (ETB)</label>
                <input
                  type="number" className="sap-form-input"
                  placeholder="e.g. 4000"
                  value={planForm.price}
                  onChange={e => setPlanForm({ ...planForm, price: Number(e.target.value) })}
                />
              </div>
              <div className="sap-form-group">
                <label className="sap-form-label">Status</label>
                <select className="sap-select" value={planForm.status} onChange={e => setPlanForm({ ...planForm, status: e.target.value })} style={{ width: '100%', height: 42 }}>
                  <option value="active">Active (Visible to Admins)</option>
                  <option value="inactive">Disabled (Hidden)</option>
                </select>
              </div>
            </div>
            <div className="sap-modal-footer">
              <button className="sap-btn-ghost" onClick={() => setShowAddPlan(false)}>Cancel</button>
              <button className="sap-btn-primary" onClick={handleAddPlan} disabled={!planForm.name}>
                <Check size={16} /> Confirm & Add Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PLAN MODAL */}
      {editingPlan && (
        <div className="sap-modal-overlay">
          <div className="sap-modal" style={{ maxWidth: 460 }}>
            <div className="sap-modal-header">
              <h3 className="sap-modal-title">Edit Subscription Plan</h3>
              <button className="sap-modal-close" onClick={() => setEditingPlan(null)}><X size={20} /></button>
            </div>
            <div className="sap-modal-body">
              <div className="sap-form-group">
                <label className="sap-form-label">Plan Name</label>
                <input
                  type="text" className="sap-form-input"
                  value={editingPlan.name}
                  onChange={e => setEditingPlan({ ...editingPlan, name: e.target.value })}
                />
              </div>
              <div className="sap-form-group">
                <label className="sap-form-label">Duration (Days)</label>
                <input
                  type="number" className="sap-form-input"
                  value={editingPlan.duration}
                  onChange={e => setEditingPlan({ ...editingPlan, duration: Number(e.target.value) })}
                />
              </div>
              <div className="sap-form-group">
                <label className="sap-form-label">Price (ETB)</label>
                <input
                  type="number" className="sap-form-input"
                  value={editingPlan.price}
                  onChange={e => setEditingPlan({ ...editingPlan, price: Number(e.target.value) })}
                />
              </div>
              <div className="sap-form-group">
                <label className="sap-form-label">Status</label>
                <select className="sap-select" value={editingPlan.status} onChange={e => setEditingPlan({ ...editingPlan, status: e.target.value })} style={{ width: '100%', height: 42 }}>
                  <option value="active">Active (Visible to Admins)</option>
                  <option value="inactive">Disabled (Hidden)</option>
                </select>
              </div>
            </div>
            <div className="sap-modal-footer">
              <button className="sap-btn-ghost" onClick={() => setEditingPlan(null)}>Cancel</button>
              <button className="sap-btn-primary" onClick={handleEditPlan}>
                <Check size={16} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD ACCOUNT MODAL */}
      {showAddAcc && (
        <div className="sap-modal-overlay">
          <div className="sap-modal" style={{ maxWidth: 460 }}>
            <div className="sap-modal-header">
              <h3 className="sap-modal-title">Add Payment Account</h3>
              <button className="sap-modal-close" onClick={() => setShowAddAcc(false)}><X size={20} /></button>
            </div>
            <div className="sap-modal-body">
              <div className="sap-form-group">
                <label className="sap-form-label">Payment Type</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className={`sap-btn-ghost sap-btn-sm ${accForm.type === 'bank' ? 'active' : ''}`}
                    style={{ flex: 1, padding: '10px' }}
                    onClick={() => setAccForm({ ...accForm, type: 'bank', provider: ETHIOPIAN_BANKS[0] })}
                  >
                    <Landmark size={14} /> Bank Account
                  </button>
                  <button
                    className={`sap-btn-ghost sap-btn-sm ${accForm.type === 'mobile' ? 'active' : ''}`}
                    style={{ flex: 1, padding: '10px' }}
                    onClick={() => setAccForm({ ...accForm, type: 'mobile', provider: MOBILE_PROVIDERS[0] })}
                  >
                    <Radio size={14} /> Mobile Banking
                  </button>
                </div>
              </div>

              <div className="sap-form-group">
                <label className="sap-form-label">{accForm.type === 'bank' ? 'Select Bank' : 'Select Provider'}</label>
                <select
                  className="sap-select"
                  style={{ width: '100%', height: 42 }}
                  value={accForm.provider}
                  onChange={(e) => setAccForm({ ...accForm, provider: e.target.value })}
                >
                  {(accForm.type === 'bank' ? ETHIOPIAN_BANKS : MOBILE_PROVIDERS).map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="sap-form-group">
                <label className="sap-form-label">Account Holder Name</label>
                <input
                  type="text" className="sap-form-input"
                  placeholder="e.g. MECHPRO TECHNOLOGY PLC"
                  value={accForm.accountName}
                  onChange={e => setAccForm({ ...accForm, accountName: e.target.value })}
                />
              </div>

              {accForm.type === 'bank' ? (
                <>
                  <div className="sap-form-group">
                    <label className="sap-form-label">Account Number</label>
                    <input
                      type="text" className="sap-form-input"
                      placeholder="Enter bank account number"
                      value={accForm.accountNumber}
                      onChange={e => setAccForm({ ...accForm, accountNumber: e.target.value })}
                    />
                  </div>
                  <div className="sap-form-group">
                    <label className="sap-form-label">Branch Name (Optional)</label>
                    <input
                      type="text" className="sap-form-input"
                      placeholder="e.g. Bole Branch"
                      value={accForm.branchName}
                      onChange={e => setAccForm({ ...accForm, branchName: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <div className="sap-form-group">
                  <label className="sap-form-label">Mobile Number</label>
                  <input
                    type="text" className="sap-form-input"
                    placeholder="e.g. 0911001122"
                    value={accForm.mobileNumber}
                    onChange={e => setAccForm({ ...accForm, mobileNumber: e.target.value })}
                  />
                </div>
              )}

              <div className="sap-form-group">
                <label className="sap-form-label">Payment Instructions (Optional)</label>
                <textarea
                  className="sap-form-input"
                  placeholder="e.g. Please transfer to this account and upload transfer confirmation screenshot."
                  rows={2}
                  value={accForm.instructions}
                  onChange={e => setAccForm({ ...accForm, instructions: e.target.value })}
                />
              </div>

              <div className="sap-form-group">
                <label className="sap-form-label">Initial Status</label>
                <select className="sap-select" value={accForm.status} onChange={e => setAccForm({ ...accForm, status: e.target.value })} style={{ width: '100%', height: 42 }}>
                  <option value="active">Active (Visible to Clients)</option>
                  <option value="inactive">Inactive (Hidden)</option>
                </select>
              </div>
            </div>
            <div className="sap-modal-footer">
              <button className="sap-btn-ghost" onClick={() => setShowAddAcc(false)}>Cancel</button>
              <button className="sap-btn-primary" onClick={handleAddAccount} disabled={!accForm.accountName || (!accForm.accountNumber && !accForm.mobileNumber)}>
                <Check size={16} /> Confirm & Add Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT ACCOUNT MODAL */}
      {editingAcc && (
        <div className="sap-modal-overlay">
          <div className="sap-modal" style={{ maxWidth: 460 }}>
            <div className="sap-modal-header">
              <h3 className="sap-modal-title">Edit Payment Account</h3>
              <button className="sap-modal-close" onClick={() => setEditingAcc(null)}><X size={20} /></button>
            </div>
            <div className="sap-modal-body">
              <div className="sap-form-group">
                <label className="sap-form-label">Payment Type</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className={`sap-btn-ghost sap-btn-sm ${editingAcc.type === 'bank' ? 'active' : ''}`}
                    style={{ flex: 1, padding: '10px' }}
                    onClick={() => setEditingAcc({ ...editingAcc, type: 'bank', provider: ETHIOPIAN_BANKS[0], mobileNumber: '' })}
                  >
                    <Landmark size={14} /> Bank Account
                  </button>
                  <button
                    className={`sap-btn-ghost sap-btn-sm ${editingAcc.type === 'mobile' ? 'active' : ''}`}
                    style={{ flex: 1, padding: '10px' }}
                    onClick={() => setEditingAcc({ ...editingAcc, type: 'mobile', provider: MOBILE_PROVIDERS[0], accountNumber: '', branchName: '' })}
                  >
                    <Radio size={14} /> Mobile Banking
                  </button>
                </div>
              </div>

              <div className="sap-form-group">
                <label className="sap-form-label">{editingAcc.type === 'bank' ? 'Select Bank' : 'Select Provider'}</label>
                <select
                  className="sap-select"
                  style={{ width: '100%', height: 42 }}
                  value={editingAcc.provider}
                  onChange={(e) => setEditingAcc({ ...editingAcc, provider: e.target.value })}
                >
                  {(editingAcc.type === 'bank' ? ETHIOPIAN_BANKS : MOBILE_PROVIDERS).map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="sap-form-group">
                <label className="sap-form-label">Account Holder Name</label>
                <input
                  type="text" className="sap-form-input"
                  value={editingAcc.accountName}
                  onChange={e => setEditingAcc({ ...editingAcc, accountName: e.target.value })}
                />
              </div>

              {editingAcc.type === 'bank' ? (
                <>
                  <div className="sap-form-group">
                    <label className="sap-form-label">Account Number</label>
                    <input
                      type="text" className="sap-form-input"
                      value={editingAcc.accountNumber || ''}
                      onChange={e => setEditingAcc({ ...editingAcc, accountNumber: e.target.value })}
                    />
                  </div>
                  <div className="sap-form-group">
                    <label className="sap-form-label">Branch Name (Optional)</label>
                    <input
                      type="text" className="sap-form-input"
                      value={editingAcc.branchName || ''}
                      onChange={e => setEditingAcc({ ...editingAcc, branchName: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <div className="sap-form-group">
                  <label className="sap-form-label">Mobile Number</label>
                  <input
                    type="text" className="sap-form-input"
                    value={editingAcc.mobileNumber || ''}
                    onChange={e => setEditingAcc({ ...editingAcc, mobileNumber: e.target.value })}
                  />
                </div>
              )}

              <div className="sap-form-group">
                <label className="sap-form-label">Payment Instructions (Optional)</label>
                <textarea
                  className="sap-form-input"
                  rows={2}
                  value={editingAcc.instructions || ''}
                  onChange={e => setEditingAcc({ ...editingAcc, instructions: e.target.value })}
                />
              </div>

              <div className="sap-form-group">
                <label className="sap-form-label">Status</label>
                <select className="sap-select" value={editingAcc.status} onChange={e => setEditingAcc({ ...editingAcc, status: e.target.value })} style={{ width: '100%', height: 42 }}>
                  <option value="active">Active (Visible to Clients)</option>
                  <option value="inactive">Inactive (Hidden)</option>
                </select>
              </div>
            </div>
            <div className="sap-modal-footer">
              <button className="sap-btn-ghost" onClick={() => setEditingAcc(null)}>Cancel</button>
              <button className="sap-btn-primary" onClick={handleEditAccountSubmit} disabled={!editingAcc.accountName || (!editingAcc.accountNumber && !editingAcc.mobileNumber)}>
                <Check size={16} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
const BroadcastPanel = ({ garages }) => {
  const { t } = useAppContext();
  const [form, setForm] = useState({ subject: '', body: '', severity: 'info', target: 'ALL' });
  const [sent, setSent] = useState(false);
  const { addNotification } = useAppContext();

  const handleSend = () => {
    if (!form.body.trim()) return;
    const msg = form.subject ? `${form.subject}: ${form.body}` : form.body;
    const signal = { type: 'NOTIFICATION', to: 'ALL', message: msg, notifType: form.severity, time: Date.now() };
    localStorage.setItem('garage_realtime_signal', JSON.stringify(signal));
    addNotification(msg, form.severity, form.target === 'ALL' ? 'ALL' : form.target);
    setSent(true);
    setTimeout(() => setSent(false), 3000);
    setForm({ subject: '', body: '', severity: 'info', target: 'ALL' });
  };

  const severityOpts = [
    { value: 'info', label: 'ℹ Info', color: '#6366f1' },
    { value: 'warning', label: '⚠ Warning', color: '#f59e0b' },
    { value: 'danger', label: '🚨 Critical', color: '#f43f5e' },
    { value: 'success', label: '✅ Success', color: '#10b981' },
  ];

  const previewColor = severityOpts.find(s => s.value === form.severity)?.color || '#6366f1';

  return (
    <div className="sap-panel">
      <div className="sap-panel-header">
        <div>
          <h2 className="sap-panel-title">Broadcast</h2>
          <p className="sap-panel-sub">Send announcements to clients and platform users</p>
        </div>
      </div>

      <div className="sap-broadcast-grid">
        <div className="sap-chart-card sap-broadcast-form">
          <div className="sap-chart-title"><Send size={16} /> Compose Message</div>
          <div className="sap-form-group">
            <label className="sap-form-label">Subject <span style={{ opacity: 0.5 }}>(optional)</span></label>
            <input className="sap-form-input" placeholder="E.g. Scheduled maintenance tonight"
              value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} />
          </div>
          <div className="sap-form-group">
            <label className="sap-form-label">Message *</label>
            <textarea className="sap-form-input sap-textarea" rows={4} placeholder="Type your platform announcement…"
              value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} />
          </div>
          <div className="sap-form-row">
            <div className="sap-form-group" style={{ flex: 1 }}>
              <label className="sap-form-label">Severity</label>
              <select className="sap-form-input" value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}>
                {severityOpts.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="sap-form-group" style={{ flex: 1 }}>
              <label className="sap-form-label">Audience</label>
              <select className="sap-form-input" value={form.target} onChange={e => setForm(p => ({ ...p, target: e.target.value }))}>
                <option value="ALL">All Clients</option>
                {garages.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>
          {sent
            ? <div className="sap-sent-success"><CheckCircle2 size={18} /> Broadcast sent successfully!</div>
            : <button className="sap-btn-primary sap-btn-full" onClick={handleSend} disabled={!form.body.trim()}><Send size={16} /> Send Broadcast</button>
          }
        </div>

        <div className="sap-chart-card">
          <div className="sap-chart-title"><Bell size={16} /> Preview</div>
          {form.body ? (
            <div className="sap-broadcast-preview" style={{ borderColor: previewColor + '44', background: previewColor + '11' }}>
              <div className="sap-preview-badge" style={{ background: previewColor }}>{form.severity.toUpperCase()}</div>
              {form.subject && <div className="sap-preview-subject">{form.subject}</div>}
              <div className="sap-preview-body">{form.body}</div>
              <div className="sap-preview-meta">
                To: {form.target === 'ALL' ? 'All Clients' : garages.find(g => g.id === form.target)?.name || form.target}
              </div>
            </div>
          ) : (
            <div className="sap-empty">Your preview will appear here</div>
          )}
        </div>
      </div>
    </div>
  );
};

const MessagesPanel = ({ garages, requests, onApprove, onReject }) => {
  const { internalMessages, sendInternalMessage, t, language, formatDate, formatTime, markInternalMessagesRead } = useAppContext();
  const { currentUser } = useAuth();

  const [activeGarageId, setActiveGarageId] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  // Group messages by garageId
  const conversationStats = useMemo(() => {
    const stats = {};

    // Initialize with all garages
    garages.forEach(g => {
      stats[g.id] = {
        garageId: g.id,
        garageName: g.name,
        adminName: g.admin,
        lastMessage: null,
        unreadCount: 0
      };
    });

    // Populate with messages
    internalMessages.forEach(m => {
      const gId = m.garageId;
      if (stats[gId]) {
        if (!stats[gId].lastMessage || new Date(m.time) > new Date(stats[gId].lastMessage.time)) {
          stats[gId].lastMessage = m;
        }
        if (m.recipientId === currentUser.id && !m.read) {
          stats[gId].unreadCount++;
        }
      }
    });

    return Object.values(stats).sort((a, b) => {
      if (!a.lastMessage && !b.lastMessage) return a.garageName.localeCompare(b.garageName);
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.time) - new Date(a.lastMessage.time);
    });
  }, [internalMessages, garages, currentUser.id]);

  const handleApproveWithIndicator = (r) => {
    setApprovingId(r.id);
    setTimeout(() => {
      onApprove(r);
      setApprovingId(null);
    }, 800);
  };

  const activeRequest = useMemo(() => {
    if (!activeGarageId || !requests) return null;
    return requests.find(r => (r.id === activeGarageId || r.garageId === activeGarageId));
  }, [activeGarageId, requests]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result;
          await sendInternalMessage(activeGarageId, base64Audio, 'audio', 'voice_note.webm');
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const activeGarage = garages.find(g => g.id === activeGarageId);
  const activeMessages = internalMessages.filter(m => m.garageId === activeGarageId);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    // Mark messages from the active garage's admin as read
    if (activeGarageId) {
      // Use the garageId as the senderId since admin messages originate from that ID
      markInternalMessagesRead(activeGarageId);
    }
  }, [activeMessages, activeGarageId, markInternalMessagesRead]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeGarageId) return;

    // Recipient is the Admin of the active garage
    // We need to find the admin user ID for this garage. 
    // In our system, the Admin ID is often the same as the garageId or we can look it up.
    // For this simulation, we'll assume the Admin ID is the garageId.
    const success = await sendInternalMessage(activeGarageId, messageInput, 'text', null, activeGarageId);
    if (success) setMessageInput('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeGarageId) return;
    setIsUploading(true);
    try {
      let fileData;
      let type = file.type.startsWith('image/') ? 'image' : 'file';
      try {
        const { uploadAttachment } = await import('../services/supabase');
        fileData = await uploadAttachment(file, 'chat');
      } catch {
        fileData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target.result);
          reader.readAsDataURL(file);
        });
      }
      await sendInternalMessage(activeGarageId, fileData, type, file.name, activeGarageId);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filteredConversations = conversationStats.filter(c =>
    c.garageName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.adminName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="sap-panel sap-messages-panel">
      <div className="sap-messages-layout">

        {/* Left: Conversation List */}
        <div className="sap-messages-sidebar">
          <div className="sap-sidebar-header">
            <h3>Conversations</h3>
            <div className="sap-search-compact">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="sap-conversation-list">
            {filteredConversations.length === 0 ? (
              <div className="sap-empty-state">No conversations found</div>
            ) : (
              filteredConversations.map(conv => (
                <div
                  key={conv.garageId}
                  className={`sap-conv-item ${activeGarageId === conv.garageId ? 'active' : ''}`}
                  onClick={() => setActiveGarageId(conv.garageId)}
                >
                  <div className="sap-conv-avatar">
                    {conv.garageName.charAt(0)}
                    {conv.unreadCount > 0 && <div className="sap-unread-dot"></div>}
                  </div>
                  <div className="sap-conv-info">
                    <div className="sap-conv-name-row">
                      <span className="sap-conv-name">{conv.garageName}</span>
                      {conv.lastMessage && <span className="sap-conv-time">{formatTime(conv.lastMessage.time)}</span>}
                    </div>
                    <div className="sap-conv-last-msg">
                      {!conv.lastMessage ? 'No messages yet' : (
                        <>
                          {conv.lastMessage.senderId === currentUser.id ? 'You: ' : ''}
                          {conv.lastMessage.type === 'text' ? conv.lastMessage.text : `[${conv.lastMessage.type}]`}
                        </>
                      )}
                    </div>
                  </div>
                  {conv.unreadCount > 0 && (
                    <div className="sap-unread-badge">{conv.unreadCount}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Message Area */}
        <div className="sap-messages-main">
          {activeGarageId ? (
            <>
              <div className="sap-chat-header">
                <div className="sap-chat-title-info">
                  <h4>{activeGarage?.name}</h4>
                  <span>Admin: {activeGarage?.admin}</span>
                </div>
                <div className="sap-chat-actions">
                  <button className="sap-icon-btn"><Clock size={18} /></button>
                </div>
              </div>

              <div className="sap-chat-body" ref={scrollRef}>
                {activeMessages.map((msg, idx) => {
                  const isMe = msg.senderId === currentUser.id;
                  const prevMsg = activeMessages[idx - 1];
                  const showDate = !prevMsg || msg.time.split('T')[0] !== prevMsg.time.split('T')[0];

                  return (
                    <React.Fragment key={msg.id}>
                      {showDate && (
                        <div className="sap-date-sep">
                          <span>{formatDate(msg.time)}</span>
                        </div>
                      )}
                      <div className={`sap-msg-row ${isMe ? 'msg-me' : 'msg-them'}`}>
                        <div className={`sap-msg-bubble ${msg.type === 'image' ? 'sap-msg-bubble-image' : ''}`}>
                          {msg.type === 'text' && <div className="sap-msg-text">{msg.text}</div>}
                          {msg.type === 'image' && (
                            <div className="sap-msg-image" onClick={() => setFullscreenImage(msg)}>
                              <img src={msg.fileData} alt="Platform Media" />
                            </div>
                          )}
                          {msg.type === 'file' && (
                            <div className="sap-msg-file">
                              <FileText size={20} />
                              <div className="sap-file-details">
                                <span>{msg.fileName}</span>
                                <a href={msg.fileData} download={msg.fileName}><Download size={16} /></a>
                              </div>
                            </div>
                          )}
                          {msg.type === 'audio' && (
                            <div className="sap-msg-audio">
                              <audio src={msg.fileData} controls style={{ width: '100%', height: 32 }} />
                            </div>
                          )}
                          <div className="sap-msg-meta">
                            <span>{formatTime(msg.time)}</span>
                            {isMe && (
                              <span className="sap-msg-status">
                                {msg.read ? '✓✓' : '✓'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="sap-chat-footer">
                <form onSubmit={handleSend} className="sap-input-row">
                  <button type="button" className="sap-action-btn" onClick={() => fileInputRef.current?.click()}>
                    <Paperclip size={20} />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                  <input
                    type="text"
                    className="sap-msg-input"
                    placeholder="Reply to admin..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="sap-send-btn"
                    disabled={(!messageInput.trim() && !isRecording) || isUploading}
                  >
                    {messageInput.trim() ? <Send size={20} /> : (
                      isRecording ? (
                        <div className="stop-btn" onClick={stopRecording}>
                          <div className="stop-icon"></div>
                        </div>
                      ) : (
                        <div className="mic-btn" onClick={startRecording}>
                          <Mic size={20} />
                        </div>
                      )
                    )}
                  </button>
                </form>
                {isRecording && (
                  <div className="sap-recording-status">
                    <div className="recording-dot"></div>
                    <span>Recording... {formatDuration(recordingTime)}</span>
                    <button className="sap-btn-xs sap-btn-danger" onClick={() => {
                      if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
                      setIsRecording(false);
                      clearInterval(timerRef.current);
                      audioChunksRef.current = [];
                    }}>Cancel</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="sap-chat-placeholder">
              <MessageSquare size={64} />
              <h3>Select a conversation</h3>
              <p>Choose an admin from the left to start chatting</p>
            </div>
          )}
        </div>
      </div>

      {fullscreenImage && (
        <div className="sap-lightbox" onClick={() => setFullscreenImage(null)}>
          <button className="sap-lightbox-close" onClick={() => setFullscreenImage(null)}>
            <X size={28} />
          </button>
          <div className="sap-lightbox-content" onClick={e => e.stopPropagation()}>
            <img src={fullscreenImage.fileData} alt="Fullscreen View" />
            <div className="sap-lightbox-footer">
              <div className="sap-lightbox-actions">
                {activeRequest && (
                  approvingId === activeRequest.id ? (
                    <div className="sap-success-indicator">
                      <CheckCircle2 size={24} color="#10b981" />
                      <span style={{ color: '#10b981', fontSize: '14px', fontWeight: 600 }}>Action Completed</span>
                    </div>
                  ) : (
                    <>
                      {(activeRequest.status === 'pending' || activeRequest.status === 'approved') && (
                        <button className="sap-btn-danger" onClick={() => { onReject(activeRequest); setFullscreenImage(null); }}>
                          {activeRequest.status === 'approved' ? 'Reject & Suspend' : 'Reject'}
                        </button>
                      )}
                      {(activeRequest.status === 'pending' || activeRequest.status === 'rejected') && (
                        <button className="sap-btn-primary" onClick={() => { handleApproveWithIndicator(activeRequest); setFullscreenImage(null); }}>
                          {activeRequest.status === 'rejected' ? 'Approve Again' : 'Approve & Activate'}
                        </button>
                      )}
                    </>
                  )
                )}
              </div>
              <a href={fullscreenImage.fileData} download={fullscreenImage.fileName} className="sap-lightbox-download">
                <Download size={20} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════════════════
   9.  REVENUE HISTORY & ANALYTICS PANEL
════════════════════════════════════════════════════ */
const RevenuePanel = ({ requests, garages, accounts, settings, initialStatus = 'all', initialTime = 'all' }) => {
  const [statusFilter, setStatusFilter] = useState(initialStatus || 'all');
  const [timeFilter, setTimeFilter] = useState(initialTime || 'all');
  const [bankFilter, setBankFilter] = useState('all');
  const [chartPeriod, setChartPeriod] = useState('month'); // day, month, year
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  const { t } = useAppContext();

  useEffect(() => {
    if (initialStatus) setStatusFilter(initialStatus);
    if (initialTime) setTimeFilter(initialTime);
  }, [initialStatus, initialTime]);

  const filtered = useMemo(() => {
    return requests.filter(r => {
      // History view shows only concluded records (Approved, Rejected)
      if (r.status === 'pending') return false;

      if (statusFilter !== 'all') {
        if (statusFilter === 'expired') {
          if (r.status !== 'approved') return false;
          const admin = accounts.find(a => a.id === r.adminId);
          const isExpired = admin?.subscription?.expiryDate && new Date(admin.subscription.expiryDate) < new Date();
          if (!isExpired) return false;
        } else if (r.status !== statusFilter) {
          return false;
        }
      }

      if (bankFilter !== 'all' && (r.bankId || 'unknown') !== bankFilter) return false;

      const date = new Date(r.approvedAt || r.rejectedAt || r.createdAt);
      const now = new Date();
      if (timeFilter === 'today') return date.toDateString() === now.toDateString();
      if (timeFilter === 'week') {
        const d = new Date(); d.setDate(d.getDate() - 7);
        return date >= d;
      }
      if (timeFilter === 'month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      if (timeFilter === '3months') {
        const d = new Date(); d.setMonth(d.getMonth() - 3);
        return date >= d;
      }
      if (timeFilter === '6months') {
        const d = new Date(); d.setMonth(d.getMonth() - 6);
        return date >= d;
      }
      if (timeFilter === 'year') return date.getFullYear() === now.getFullYear();
      if (timeFilter === 'custom' && customRange.start && customRange.end) {
        return date >= new Date(customRange.start) && date <= new Date(customRange.end);
      }
      return true;
    });
  }, [requests, statusFilter, timeFilter, customRange, bankFilter, accounts]);

  const approvedOnly = useMemo(() => filtered.filter(r => r.status === 'approved'), [filtered]);

  const stats = useMemo(() => {
    const totalRev = approvedOnly.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const planCounts = {};
    approvedOnly.forEach(r => {
      const p = r.planName || r.planId || 'Standard';
      planCounts[p] = (planCounts[p] || 0) + 1;
    });
    const popular = Object.entries(planCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    let active = 0, expired = 0;
    accounts.forEach(a => {
      if (a.role === 'admin' && a.subscription) {
        if (a.subscription.status === 'active' || a.subscription.type === 'unlimited') active++;
        else if (a.subscription.status === 'suspended') expired++;
      }
    });

    const uniqueClients = new Set(approvedOnly.map(r => r.garageId)).size || 1;

    return {
      totalTransactions: approvedOnly.length,
      totalRevenue: totalRev,
      avgRevenue: totalRev / uniqueClients,
      popularPlan: popular,
      activeSubscribers: active,
      expiredSubscribers: expired
    };
  }, [approvedOnly, accounts]);

  const bankStats = useMemo(() => {
    const statsMap = {};

    // Get all unique banks from settings or requests
    const bankMethods = settings?.paymentMethods?.filter(m => m.status === 'active') || [];
    bankMethods.forEach(b => {
      statsMap[b.id] = {
        id: b.id,
        name: b.provider,
        account: b.accountNumber || b.mobileNumber,
        total: 0, pending: 0, approved: 0, rejected: 0, count: 0
      };
    });

    // Aggregate from filtered requests
    filtered.forEach(r => {
      const bid = r.bankId || 'unknown';
      if (!statsMap[bid]) {
        statsMap[bid] = {
          id: bid,
          name: r.bankName || 'Unknown Bank',
          account: r.bankAccount || 'N/A',
          total: 0, pending: 0, approved: 0, rejected: 0, count: 0
        };
      }
      statsMap[bid].count++;
      const amt = Number(r.amount) || 0;
      if (r.status === 'approved') {
        statsMap[bid].approved += amt;
        statsMap[bid].total += amt;
      } else if (r.status === 'pending') {
        statsMap[bid].pending += amt;
      } else if (r.status === 'rejected') {
        statsMap[bid].rejected += amt;
      }
    });

    return Object.values(statsMap);
  }, [filtered, settings]);

  const chartData = useMemo(() => {
    const map = {};
    filtered.slice(-30).forEach(r => {
      const date = new Date(r.approvedAt || r.createdAt);
      let key = '';
      if (chartPeriod === 'day') key = date.toLocaleDateString(undefined, { weekday: 'short' });
      else if (chartPeriod === 'month') key = date.toLocaleString('default', { month: 'short' });
      else if (chartPeriod === 'year') key = date.getFullYear().toString();
      map[key] = (map[key] || 0) + (Number(r.amount) || 0);
    });
    return Object.entries(map).map(([label, value]) => ({ label, value }));
  }, [requests, chartPeriod]);

  const maxVal = Math.max(...chartData.map(d => d.value), 1);

  return (
    <div className="sap-panel">
      <div className="sap-panel-header">
        <div>
          <h2 className="sap-panel-title">Revenue History & Analytics</h2>
          <p className="sap-panel-sub">Financial performance and transaction audit</p>
        </div>
      </div>

      <div className="sap-kpi-grid">
        <div className="sap-kpi-card" style={{ '--accent': '#6366f1' }}>
          <div className="sap-kpi-icon" style={{ background: '#6366f122', color: '#6366f1' }}><DollarSign size={20} /></div>
          <div className="sap-kpi-body">
            <div className="sap-kpi-value">{fmt(Math.round(stats.totalRevenue))} ETB</div>
            <div className="sap-kpi-label">Total Revenue</div>
          </div>
        </div>
        <div className="sap-kpi-card" style={{ '--accent': '#10b981' }}>
          <div className="sap-kpi-icon" style={{ background: '#10b98122', color: '#10b981' }}><TrendingUp size={20} /></div>
          <div className="sap-kpi-body">
            <div className="sap-kpi-value">{fmt(Math.round(stats.avgRevenue))} ETB</div>
            <div className="sap-kpi-label">Avg. Revenue / Client</div>
          </div>
        </div>
        <div className="sap-kpi-card" style={{ '--accent': '#f59e0b' }}>
          <div className="sap-kpi-icon" style={{ background: '#f59e0b22', color: '#f59e0b' }}><Zap size={20} /></div>
          <div className="sap-kpi-body">
            <div className="sap-kpi-value">{stats.popularPlan}</div>
            <div className="sap-kpi-label">Most Popular Plan</div>
          </div>
        </div>
        <div className="sap-kpi-card" style={{ '--accent': '#3b82f6' }}>
          <div className="sap-kpi-icon" style={{ background: '#3b82f622', color: '#3b82f6' }}><Users size={20} /></div>
          <div className="sap-kpi-body">
            <div className="sap-kpi-value">{stats.activeSubscribers}</div>
            <div className="sap-kpi-label">Active Subscribers</div>
          </div>
        </div>
      </div>

      <div className="sap-section-label" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Landmark size={14} /> Revenue by Bank</div>
        {bankFilter !== 'all' && (
          <button className="sap-btn-xs sap-btn-ghost" onClick={() => setBankFilter('all')} style={{ color: '#f43f5e' }}>
            Clear Bank Filter
          </button>
        )}
      </div>
      <div className="sap-bank-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 28 }}>
        {bankStats.map(b => (
          <div
            key={b.id}
            className={`sap-bank-card ${bankFilter === b.id ? 'active' : ''}`}
            onClick={() => setBankFilter(b.id === bankFilter ? 'all' : b.id)}
            style={{ cursor: 'pointer' }}
          >
            <div className="sap-bank-header">
              <div className="sap-bank-info">
                <div className="sap-bank-name">{b.name}</div>
                <div className="sap-bank-acc">{b.account}</div>
              </div>
              <div className="sap-bank-total">{fmt(Math.round(b.approved))} ETB</div>
            </div>
            <div className="sap-bank-metrics">
              <div
                className={`sap-bm-item hover-effect ${bankFilter === b.id && statusFilter === 'all' ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setBankFilter(b.id); setStatusFilter('all'); }}
                title="View All Transactions"
              >
                <div className="sap-bm-val">{b.count}</div>
                <div className="sap-bm-label">Trx</div>
              </div>
              <div
                className={`sap-bm-item warning hover-effect ${bankFilter === b.id && statusFilter === 'pending' ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setBankFilter(b.id); setStatusFilter('pending'); }}
                title="View Pending Revenue"
              >
                <div className="sap-bm-val">{fmt(Math.round(b.pending))} ETB</div>
                <div className="sap-bm-label">Pending</div>
              </div>
              <div
                className={`sap-bm-item danger hover-effect ${bankFilter === b.id && statusFilter === 'rejected' ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setBankFilter(b.id); setStatusFilter('rejected'); }}
                title="View Rejected Revenue"
              >
                <div className="sap-bm-val">{fmt(Math.round(b.rejected))} ETB</div>
                <div className="sap-bm-label">Rejected</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="sap-chart-card" style={{ marginBottom: 24, padding: '24px' }}>
        <div className="sap-chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div className="sap-chart-title"><BarChart3 size={16} /> Revenue Trends</div>
          <div className="sap-filter-row" style={{ margin: 0 }}>
            {['day', 'month', 'year'].map(p => (
              <button key={p} className={`sap-btn-xs sap-btn-ghost ${chartPeriod === p ? 'active' : ''}`} onClick={() => setChartPeriod(p)}>
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="sap-rev-chart">
          {chartData.length === 0 ? (
            <div className="sap-empty">No data for selected period</div>
          ) : chartData.map((d, i) => (
            <div key={i} className="sap-rev-bar-wrap">
              <div className="sap-rev-bar" style={{ height: `${(d.value / maxVal) * 100}%` }}>
                <div className="sap-rev-tooltip">{fmt(d.value)} ETB</div>
              </div>
              <span className="sap-rev-label">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sap-panel-header" style={{ marginBottom: 15 }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Subscription History</h3>
        <div className="sap-filter-row" style={{ margin: 0 }}>
          <select className="sap-select sap-select-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All History</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
          </select>
          <select className="sap-select sap-select-sm" value={timeFilter} onChange={e => setTimeFilter(e.target.value)}>
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="3months">Last Quarter</option>
            <option value="year">This Year</option>
            <option value="custom">Custom</option>
          </select>
          {timeFilter === 'custom' && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="date"
                className="sap-select sap-select-sm"
                style={{ width: 'auto' }}
                value={customRange.start}
                onChange={e => setCustomRange({ ...customRange, start: e.target.value })}
              />
              <span className="sap-text-xs sap-opacity-60">to</span>
              <input
                type="date"
                className="sap-select sap-select-sm"
                style={{ width: 'auto' }}
                value={customRange.end}
                onChange={e => setCustomRange({ ...customRange, end: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>

      <div className="sap-table-wrap">
        <table className="sap-table">
          <thead>
            <tr>
              <th>Client / Business</th>
              <th>Plan Type</th>
              <th>Amount</th>
              <th>Bank Used</th>
              <th>Submitted</th>
              <th>Action Date</th>
              <th>Status</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const garage = garages.find(g => g.id === r.garageId);
              const admin = accounts.find(a => a.id === r.adminId);
              return (
                <tr key={r.id}>
                  <td>
                    <div className="sap-user-cell">
                      <div>
                        <div className="sap-fw600">{garage?.name || r.garageId}</div>
                        <div className="sap-text-xs sap-opacity-60">{admin?.name || 'Admin'}</div>
                      </div>
                    </div>
                  </td>
                  <td><RoleChip role={r.planId} /></td>
                  <td className="sap-fw600">{fmt(r.amount)} ETB</td>
                  <td>
                    <div className="sap-fw600" style={{ fontSize: '0.8rem' }}>{r.bankName || 'N/A'}</div>
                    <div className="sap-text-xs sap-opacity-60">{r.bankAccount || '—'}</div>
                  </td>
                  <td className="sap-text-sm">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="sap-text-sm">{r.approvedAt || r.rejectedAt ? new Date(r.approvedAt || r.rejectedAt).toLocaleDateString() : '—'}</td>
                  <td>
                    {r.status === 'approved' ? (
                       admin?.subscription?.expiryDate && new Date(admin.subscription.expiryDate) < new Date() ? (
                         <span className="sap-badge badge-expired">expired</span>
                       ) : (
                         <span className="sap-badge badge-active">approved</span>
                       )
                    ) : (
                       <span className="sap-badge badge-suspended">rejected</span>
                    )}
                  </td>
                  <td>
                    {r.status === 'rejected' && r.rejectionReason ? (
                      <div className="sap-text-xs" style={{ color: '#f43f5e', maxWidth: '120px', fontStyle: 'italic' }}>
                        {r.rejectionReason}
                      </div>
                    ) : (
                      <span className="sap-opacity-40">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════
   ROOT — PLATFORM OWNER PORTAL
════════════════════════════════════════════════════ */
const NAV = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
  { id: 'clients', label: 'Clients', icon: <Building2 size={18} /> },
  { id: 'users', label: 'Users', icon: <Users size={18} /> },
  { id: 'subscriptions', label: 'Subscriptions', icon: <CreditCard size={18} /> },
  { id: 'revenue', label: 'Revenue History', icon: <Landmark size={18} /> },
  { id: 'finance', label: 'Finance', icon: <DollarSign size={18} /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
  { id: 'system', label: 'System', icon: <Settings2 size={18} /> },
  { id: 'broadcast', label: 'Broadcast', icon: <Radio size={18} /> },
  { id: 'messages', label: 'Messages', icon: <MessageSquare size={18} /> },
];

const SuperAdminPortal = () => {
  const { 
    currentUser, logout, getPlatformSettings,
    approvePaymentRequestAsync, rejectPaymentRequestAsync,
    getAllUsersAsync, suspendUserAsync, reinstateUserAsync, registerAsync,
    getClientsAsync, getPlatformStatsAsync, deleteClientAsync, platformPurgeAsync,
    getAllPaymentRequestsAsync
  } = useAuth();
  const { internalMessages, showToast, sendInternalMessage, t } = useAppContext();
  const [activeTab, setActiveTab] = useState('overview');
  const [clientFilter, setClientFilter] = useState('all');
  const [revenueFilter, setRevenueFilter] = useState('all');
  const [revenueTime, setRevenueTime] = useState('all');

  const handleNavigate = (tab, filter = null, time = 'all') => {
    setActiveTab(tab);
    if (tab === 'clients' && filter) setClientFilter(filter);
    if (tab === 'subscriptions' && filter) setRevenueFilter(filter);
    if (tab === 'revenue') {
      setRevenueFilter(filter || 'all');
      setRevenueTime(time);
    }
  };

  const [accounts, setAccounts] = useState([]);
  const [garages, setGarages] = useState([]);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [rejectionForm, setRejectionForm] = useState({ show: false, req: null, reason: '', type: 'reject' });
  const menuRef = useRef(null);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const [loading, setLoading] = useState(true);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [users, reqs, clients, platformStats] = await Promise.all([
        getAllUsersAsync(),
        getAllPaymentRequestsAsync(),
        getClientsAsync(),
        getPlatformStatsAsync()
      ]);
      setAccounts(users || []);
      setRequests(reqs || []);
      setGarages(clients || []);
      setStats(platformStats);
    } catch (err) {
      console.error("Load failed", err);
    } finally {
      setLoading(false);
    }
  }, [getAllUsersAsync, getAllPaymentRequestsAsync, getClientsAsync, getPlatformStatsAsync]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleApprove = async (req) => {
    const res = await approvePaymentRequestAsync(req.id);
    if (res.success) {
      showToast(`Subscription for client ${req.admin?.garageName || req.garageId} activated successfully.`, 'success');
      loadInitialData();
    } else {
      showToast(res.message || "Failed to approve payment.", "danger");
    }
  };

  const handleReject = (req) => {
    const isApproved = req.status === 'approved';
    setRejectionForm({ show: true, req, reason: '', type: isApproved ? 'suspend' : 'reject' });
  };

  const confirmReject = async () => {
    const { req, reason } = rejectionForm;
    if (!reason.trim()) return showToast("Please provide a rejection reason.", "info");
    if (!req) return showToast("No request selected.", "danger");

    const res = await rejectPaymentRequestAsync(req.id, reason);
    if (res.success) {
      if (rejectionForm.type === 'suspend') {
        await suspendUserAsync(req.adminId);
      }

      setRejectionForm({ show: false, req: null, reason: '' });
      loadInitialData();
      showToast(`Payment request rejected for ${req.admin?.garageName || req.garageId}.`, 'info');
    } else {
      showToast(res.message || "Failed to reject payment.", "danger");
    }
  };

  // Close menu on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const refresh = loadInitialData;

  useEffect(() => { refresh(); }, [refresh]);

  if (currentUser?.role !== 'coder') {
    return (
      <div className="sap-access-denied">
        <Shield size={64} />
        <h2>Access Denied</h2>
        <p>This area is restricted to the MechPro platform owner only.</p>
      </div>
    );
  }

  const panels = {
    overview: <OverviewPanel accounts={accounts} garages={garages} requests={requests} onNavigate={handleNavigate} stats={stats} />,
    clients: <ClientsPanel accounts={accounts} garages={garages} onRefresh={refresh} filterStatus={clientFilter} setFilterStatus={setClientFilter} requests={requests} deleteClientAsync={deleteClientAsync} />,
    users: <UsersPanel accounts={accounts} garages={garages} onRefresh={refresh} />,
    analytics: <AnalyticsPanel accounts={accounts} garages={garages} stats={stats} />,
    system: <SystemPanel onRefresh={refresh} platformPurgeAsync={platformPurgeAsync} />,
    broadcast: <BroadcastPanel garages={garages} />,
    subscriptions: <SubscriptionsPanel
      accounts={accounts}
      garages={garages}
      requests={requests}
      onApprove={handleApprove}
      onReject={handleReject}
      revenueFilter={revenueFilter}
      setRevenueFilter={setRevenueFilter}
    />,
    finance: <FinancePanel />,
    revenue: <RevenuePanel
      requests={requests}
      garages={garages}
      accounts={accounts}
      settings={getPlatformSettings()}
      initialStatus={revenueFilter}
      initialTime={revenueTime}
    />,
    messages: <MessagesPanel
      garages={garages}
      requests={requests}
      onApprove={handleApprove}
      onReject={handleReject}
    />
  };

  return (
    <div className="sap-root">
      {/* Top Header */}
      <header className="sap-header">
        <div className="sap-header-left">
          <div className="sap-header-logo"><LayoutGrid size={24} /></div>
          <div>
            <div className="sap-header-title">MECHPRO PLATFORM</div>
            <div className="sap-header-sub">Super-Admin Operations Center</div>
          </div>
          <div style={{ marginLeft: 20 }}>
            <InstallPWA />
          </div>
        </div>
        <div className="sap-header-right">
          <div className="sap-user-container" ref={menuRef}>
            <div className={`sap-header-user ${showUserMenu ? 'active' : ''}`} onClick={() => setShowUserMenu(!showUserMenu)}>
              <div className="sap-header-avatar">{(currentUser?.name || 'S').charAt(0)}</div>
              <div className="sap-header-user-text">
                <div className="sap-header-uname">{currentUser?.name || 'System Developer'}</div>
                <div className="sap-header-urole">Platform Owner</div>
              </div>
              <ChevronDown size={14} className={`sap-menu-arrow ${showUserMenu ? 'open' : ''}`} />
            </div>

            {showUserMenu && (
              <div className="sap-user-dropdown">
                <div className="sap-dropdown-header">
                  <div className="sap-dropdown-avatar">{(currentUser?.name || 'S').charAt(0)}</div>
                  <div>
                    <div className="sap-dropdown-name">{currentUser?.name || 'System Developer'}</div>
                    <div className="sap-dropdown-email">{currentUser?.email || 'coder@mechpro.com'}</div>
                  </div>
                </div>
                <div className="sap-dropdown-divider" />
                <button className="sap-dropdown-item sap-logout-btn" onClick={handleLogout}>
                  <LogOut size={16} />
                  <span>Log Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="sap-body">
        {/* Left Sidebar Nav */}
        <nav className="sap-nav">
          <div className="sap-nav-section-label">NAVIGATION</div>
          {NAV.map(n => {
            let badge = null;
            if (n.id === 'messages') {
              const count = (internalMessages || []).filter(m => m.recipientId === currentUser.id && !m.read).length;
              if (count > 0) badge = count;
            }

            return (
              <button key={n.id} className={`sap-nav-item ${activeTab === n.id ? 'active' : ''}`} onClick={() => setActiveTab(n.id)}>
                {n.icon}
                <span>{n.label}</span>
                {badge !== null && <div className="sap-nav-badge">{badge}</div>}
              </button>
            );
          })}
          <div className="sap-nav-stats">
            <div className="sap-nav-stat"><Building2 size={13} />{garages.length} Clients</div>
            <div className="sap-nav-stat"><Users size={13} />{accounts.filter(a => a.role !== 'coder').length} Users</div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="sap-main">
          {panels[activeTab]}
        </main>

        {/* REJECTION / SUSPENSION MODAL */}
        {rejectionForm.show && (
          <div className="sap-modal-overlay">
            <div className="sap-modal" style={{ maxWidth: '450px' }}>
              <div className="sap-modal-header">
                <h3 className="sap-modal-title">
                  {rejectionForm.type === 'suspend' ? 'Reject & Suspend Account' : 'Reject Payment Request'}
                </h3>
                <button className="sap-modal-close" onClick={() => setRejectionForm(p => ({ ...p, show: false }))}>
                  <X size={20} />
                </button>
              </div>
              <div className="sap-modal-body">
                <p className="sap-modal-sub">
                  {rejectionForm.type === 'suspend'
                    ? 'You are about to reject a previously approved payment and suspend the client\'s access. Please provide a reason.'
                    : 'Please describe why you are rejecting this payment request. The client will see this feedback.'}
                </p>
                <div className="sap-form-group" style={{ marginTop: '16px' }}>
                  <label className="sap-form-label">Rejection / Suspension Reason</label>
                  <textarea
                    className="sap-form-input sap-textarea"
                    placeholder={rejectionForm.type === 'suspend' ? "e.g., Chargeback detected, policy violation..." : "e.g., Transfer ID mismatch, blurred receipt image..."}
                    value={rejectionForm.reason}
                    onChange={e => setRejectionForm(p => ({ ...p, reason: e.target.value }))}
                    autoFocus
                  />
                </div>
              </div>
              <div className="sap-modal-footer">
                <button className="sap-btn-ghost" onClick={() => setRejectionForm(p => ({ ...p, show: false }))}>Cancel</button>
                <button
                  className="sap-btn-danger"
                  onClick={confirmReject}
                >
                  {rejectionForm.type === 'suspend' ? 'Confirm Suspension' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminPortal;
