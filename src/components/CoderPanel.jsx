import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Terminal, Database, Users, ShieldAlert, Trash2, Cpu, Globe, Activity, HardDrive, UserCircle } from 'lucide-react';
import './CoderPanel.css';

const CoderPanel = () => {
    const { currentUser, getAccounts } = useAuth();
    const { addNotification, requestConfirmation } = useAppContext();
    const [garages, setGarages] = useState([]);
    const [allAccounts, setAllAccounts] = useState([]);
    const [debugLogs, setDebugLogs] = useState([]);
    const [stats, setStats] = useState({ totalGarages: 0, totalUsers: 0, storageUsed: '0 KB' });
    const [searchTerm, setSearchTerm] = useState('');
    const [garageSearch, setGarageSearch] = useState('');

    const refreshData = useCallback(() => {
        const accounts = getAccounts() || [];
        
        // Derive unique garages (ownerIds) from accounts
        const ownerIds = new Set(accounts.filter(a => a && a.ownerId).map(a => a.ownerId));
        
        const foundGarages = Array.from(ownerIds).map(id => {
            // Find most descriptive info for this garage (usually from Admin account)
            const admin = accounts.find(a => a.ownerId === id && a.role === 'admin');
            const garageAccounts = accounts.filter(a => a.ownerId === id);
            
            return {
                id,
                name: admin?.garageName || 'Untitled Space',
                admin: admin?.name || 'No Root Admin',
                userCount: garageAccounts.length,
                roleCounts: garageAccounts.reduce((acc, curr) => {
                    acc[curr.role] = (acc[curr.role] || 0) + 1;
                    return acc;
                }, {})
            };
        }).filter(g => g.id !== 'system');

        setGarages(foundGarages);
        setAllAccounts(accounts);

        // Stats
        const storage = JSON.stringify(localStorage).length;
        setStats({
            totalGarages: foundGarages.length,
            totalUsers: accounts.length,
            storageUsed: `${(storage / 1024).toFixed(2)} KB`
        });

        // Debug Logs
        const logs = JSON.parse(localStorage.getItem('garage_debug_logs') || '[]');
        setDebugLogs(logs);
    }, [getAccounts]);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    const handleGlobalWipe = () => {
        requestConfirmation(
            "COMPLETE SYSTEM PURGE: This will erase all data, all accounts, and all logs across entire storage. This action is terminal.",
            () => {
                localStorage.clear();
                alert("System Purged. Redirecting to setup...");
                window.location.reload();
            }
        );
    };

    const handleDeleteUser = (userId) => {
        if (userId === currentUser.id) {
            alert("Cannot terminate own root session.");
            return;
        }
        requestConfirmation(
            `SECURE DELETION: Revoke access for ID: ${userId}? (This skips role-based checks and deletes account payload)`,
            () => {
                const accounts = JSON.parse(localStorage.getItem('garage_accounts') || '[]');
                const updated = accounts.filter(a => a.id !== userId);
                localStorage.setItem('garage_accounts', JSON.stringify(updated));
                refreshData();
                addNotification(`User ${userId} access revoked globally.`, "warning");
            }
        );
    };

    const handlePurgeGarage = (ownerId) => {
        requestConfirmation(
            `GARAGE PURGE: Wipe all accounts, repairs, and records for Garage ID: ${ownerId}?`,
            () => {
                const accounts = JSON.parse(localStorage.getItem('garage_accounts') || '[]');
                const updatedAccounts = accounts.filter(a => a.ownerId !== ownerId);
                localStorage.setItem('garage_accounts', JSON.stringify(updatedAccounts));
                
                // Clear specific data blocks
                Object.keys(localStorage).forEach(key => {
                    if (key.includes(`_${ownerId}_`)) {
                        localStorage.removeItem(key);
                    }
                });

                refreshData();
                addNotification(`Garage ${ownerId} and its associated blocks purged.`, "danger");
            }
        );
    };

    const handleClearLogs = () => {
        localStorage.removeItem('garage_debug_logs');
        setDebugLogs([]);
        addNotification("System logs cleared.", "info");
    };

    if (currentUser?.role !== 'coder') {
        return (
            <div className="coder-access-denied">
                <ShieldAlert size={64} />
                <h1>Access Denied</h1>
                <p>Unauthorized entry detected. Root privileges required.</p>
            </div>
        );
    }

    return (
        <div className="coder-panel-page">
            <header className="coder-header">
                <div className="header-left">
                    <Terminal className="coder-logo" />
                    <div>
                        <h1>MechPro <span className="dev-tag">CORE_SYSTEM_RECOVERY</span></h1>
                        <p className="system-status">STATUS: <span className="status-online">ONLINE</span> | KERNEL: 5.1.0-NODE | LOC: ADDIS_CENTER</p>
                    </div>
                </div>
                <div className="header-stats">
                    <div className="stat-pill"><Database size={14} /> {stats.totalGarages} GARAGES</div>
                    <div className="stat-pill"><Users size={14} /> {stats.totalUsers} USERS</div>
                    <div className="stat-pill"><HardDrive size={14} /> {stats.storageUsed}</div>
                </div>
            </header>

            <div className="coder-grid">
                {/* Garage Universe */}
                <section className="coder-box garage-manager">
                    <div className="box-header">
                        <h2><Globe size={20} /> REGISTERED_GARAGES</h2>
                        <input 
                            type="text" 
                            className="coder-input-inline" 
                            placeholder="Find garage ID/name..." 
                            value={garageSearch}
                            onChange={(e) => setGarageSearch(e.target.value)}
                        />
                    </div>
                    <div className="coder-table-wrapper">
                        <table className="coder-table">
                            <thead>
                                <tr>
                                    <th>OP_ID</th>
                                    <th>GARAGE_NAME</th>
                                    <th>ROOT_ADMIN</th>
                                    <th>USER_COUNT</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {garages.filter(g => g.id.includes(garageSearch) || g.name.toLowerCase().includes(garageSearch.toLowerCase())).map(g => (
                                    <tr key={g.id}>
                                        <td className="mono">{g.id}</td>
                                        <td>{g.name}</td>
                                        <td>{g.admin}</td>
                                        <td className="mono">{g.userCount}</td>
                                        <td>
                                            <button className="btn-table-danger" onClick={() => handlePurgeGarage(g.id)} title="Purge Garage">
                                                <Trash2 size={12} /> PURGE
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Global Users */}
                <section className="coder-box user-manager">
                    <div className="box-header">
                        <h2><UserCircle size={20} /> GLOBAL_USERS</h2>
                        <input 
                            type="text" 
                            className="coder-input-inline" 
                            placeholder="Find ID, name, email, role..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="coder-table-wrapper" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <table className="coder-table">
                            <thead>
                                <tr>
                                    <th>USER_ID</th>
                                    <th>NAME</th>
                                    <th>ID_FIELD</th>
                                    <th>ROLE</th>
                                    <th>GARAGE</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allAccounts.filter(u => 
                                    (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                                    (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                                    (u.phone || '').includes(searchTerm) ||
                                    (u.id || '').includes(searchTerm) ||
                                    (u.role?.toLowerCase() || '').includes(searchTerm.toLowerCase())
                                ).map(user => (
                                    <tr key={user.id}>
                                        <td className="mono" style={{ fontSize: '11px' }}>{user.id}</td>
                                        <td>{user.name}</td>
                                        <td style={{ fontSize: '12px' }}>{user.email || user.phone || 'N/A'}</td>
                                        <td><span className={`dev-tag`}>{user.role}</span></td>
                                        <td className="mono" style={{ fontSize: '11px' }}>{user.ownerId}</td>
                                        <td>
                                            <button 
                                                className="btn-table-danger" 
                                                disabled={user.id === currentUser.id}
                                                onClick={() => handleDeleteUser(user.id)}
                                            >
                                                REMOVE
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* System Logs */}
                <section className="coder-box log-viewer">
                    <div className="box-header">
                        <h2><Activity size={20} /> SYSTEM_DEBUG_LOGS</h2>
                        <button className="btn-small-coder" onClick={handleClearLogs}>CLEAR_LOGS</button>
                    </div>
                    <div className="log-scroll">
                        {debugLogs.length === 0 ? (
                            <p className="empty-logs">NO ACTIVE TRACE LOGS FOUND.</p>
                        ) : (
                            debugLogs.map((log, i) => (
                                <div key={i} className="log-entry">
                                    <span className="log-time">[{new Date(log.time).toLocaleTimeString()}]</span>
                                    <span className={`log-op op-${log.op}`}>{log.op}</span>
                                    <span className="log-msg">[{log.key}] {log.details}</span>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* Danger Zone */}
                <section className="coder-box danger-zone">
                    <h2><ShieldAlert size={20} /> SEVERE_ACTIONS</h2>
                    <p>Execute destructive commands across the entire system. Access tokens will be revoked.</p>
                    <div className="danger-actions">
                        <button className="btn-wipe" onClick={handleGlobalWipe}>
                            <Trash2 size={18} /> PURGE_ALL_DATA_STORES
                        </button>
                        <button className="btn-wipe outline" onClick={refreshData}>
                            <Cpu size={18} /> REFRESH_SYSTEM_CACHE
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default CoderPanel;
