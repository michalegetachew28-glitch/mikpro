import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { History, Search, User, Filter, Calendar, Info, Shield } from 'lucide-react';
import './ActivityLogs.css';

const ActivityLogs = () => {
  const { activityLogs, t, language, formatDate, formatTime } = useAppContext();
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  const filteredLogs = useMemo(() => {
    return (activityLogs || []).filter(log => {
      const matchesSearch = 
        (log.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (log.action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.details || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = filterRole === 'all' || log.userRole === filterRole;
      
      return matchesSearch && matchesRole;
    });
  }, [activityLogs, searchTerm, filterRole]);

  if (!currentUser?.permissions?.includes('all') && !currentUser?.permissions?.includes('activity_view')) {
    return (
      <div className="page-content">
        <div className="empty-state">
           <Shield size={48} style={{ opacity: 0.2, marginBottom: 20 }} />
           <h2>Access Denied</h2>
           <p>You do not have permission to view system activity logs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content logs-page">
      <div className="page-header">
        <div className="header-title">
          <div className="icon-wrapper"><History size={28} /></div>
          <div>
            <h1>{t("System Activity Logs")}</h1>
            <p className="subtitle">
              {t("Track system-wide actions and security events.")}
            </p>
          </div>
        </div>
      </div>

      <div className="controls-bar" style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: '300px' }}>
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder={t("Search logs by user, action or details...")} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
           <Filter size={18} style={{ color: 'var(--text-secondary)' }} />
           <select 
             value={filterRole} 
             onChange={(e) => setFilterRole(e.target.value)}
             className="btn-outline-small"
             style={{ padding: '8px 12px', borderRadius: '8px' }}
           >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="mechanic">Mechanic</option>
              <option value="receptionist">Receptionist</option>
              <option value="cashier">Cashier</option>
              <option value="storekeeper">Storekeeper</option>
              <option value="customer">Customer</option>
           </select>
        </div>
      </div>

      <div className="logs-container glass-panel" style={{ padding: '0', borderRadius: '16px', overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="modern-table">
            <thead>
              <tr>
                <th>{t("Time")}</th>
                <th>{t("User")}</th>
                <th>{t("Action")}</th>
                <th>{t("Details")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ opacity: 0.5 }}>
                       <Info size={32} style={{ marginBottom: '12px' }} />
                       <p>No activity logs found matching your criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id}>
                    <td style={{ minWidth: '150px' }}>
                       <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{formatTime(log.timestamp)}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{formatDate(log.timestamp)}</span>
                       </div>
                    </td>
                    <td>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ 
                             width: '32px', height: '32px', borderRadius: '50%', 
                             background: 'var(--bg-body)', display: 'flex', alignItems: 'center', 
                             justifyContent: 'center', color: 'var(--primary)' 
                          }}>
                             <User size={16} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                             <span style={{ fontWeight: 600 }}>{log.userName}</span>
                             <span className={`role-badge role-${log.userRole}`} style={{ fontSize: '0.65rem', padding: '1px 6px' }}>{log.userRole}</span>
                          </div>
                       </div>
                    </td>
                    <td>
                       <span style={{ 
                          fontWeight: 700, 
                          color: log.action.includes('Delete') ? 'var(--danger)' : 'var(--text-primary)' 
                       }}>
                          {log.action}
                       </span>
                    </td>
                    <td>
                       <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '400px' }}>
                          {log.details}
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ActivityLogs;
