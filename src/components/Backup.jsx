import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Download, Upload, ShieldCheck, Database, History, AlertCircle, FileJson, User, ShieldAlert } from 'lucide-react';
import './Backup.css';

const Backup = () => {
  const {
    language, t,
    customers, vehicles, repairs, inventory, staff, appointments, notifications, messages, activeTrackers,
    setCustomers, setVehicles, setRepairs, setInventory, setStaff, setAppointments, setNotifications, setMessages, setActiveTrackers,
    requestConfirmation
  } = useAppContext();
  const { currentUser, updateAccountInfo } = useAuth();
  const [lastBackup, setLastBackup] = useState(localStorage.getItem(`garage_${currentUser?.ownerId}_last_backup`) || 'Never');

  const handleExport = () => {
    const data = {
      version: '2.0',
      ownerId: currentUser?.ownerId,
      garageName: currentUser?.garageName,
      timestamp: new Date().toISOString(),
      payload: {
        customers, vehicles, repairs, inventory, staff,
        appointments, notifications, messages, activeTrackers
      }
    };

    // Validate data before export
    if (!data.payload.customers || !Array.isArray(data.payload.customers)) {
      alert("Critical Error: Core data is corrupted. Please refresh and try again.");
      return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(currentUser?.garageName || 'Garage').replace(/\s+/g, '_')}_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    const now = new Date().toLocaleString();
    setLastBackup(now);
    localStorage.setItem(`garage_${currentUser?.ownerId}_last_backup`, now);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    requestConfirmation(
      t("Restore this backup? This will replace your current data."),
      () => {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const wrapper = JSON.parse(event.target.result);

            // Data validation
            const data = wrapper.payload || wrapper;
            if (!data || typeof data !== 'object') throw new Error("Invalid format");

            if (wrapper.garageName && wrapper.garageName !== currentUser.garageName) {
              requestConfirmation(`Update garage name to "${wrapper.garageName}"?`, () => {
                updateAccountInfo({ garageName: wrapper.garageName });
              });
            }

            if (wrapper.ownerId && wrapper.ownerId !== currentUser?.ownerId) {
              const idMismatch = language === 'en'
                ? `Note: This backup is from Garage ID ${wrapper.ownerId}, but you are logged into ID ${currentUser?.ownerId}. Restoring will transplant this data into your current ID. Continue?`
                : `ማሳሰቢያ፡ ይህ ፋይል የጋራዥ መለያው ${wrapper.ownerId} ነው፣ እርስዎ ግን መለያ ${currentUser?.ownerId} ላይ ነዎት። ይቀጥሉ?`;
              requestConfirmation(idMismatch, () => finalizeImport(data));
              return;
            }

            finalizeImport(data);
          } catch (err) {
            console.error("Import error", err);
            alert('Error: Failed to restore backup. The file may be corrupted.');
          }
        };
        reader.readAsText(file);
      }
    );

    function finalizeImport(data) {
      // Batch updates
      if (Array.isArray(data.customers)) setCustomers(data.customers);
      if (Array.isArray(data.vehicles)) setVehicles(data.vehicles);
      if (Array.isArray(data.repairs)) setRepairs(data.repairs);
      if (Array.isArray(data.inventory)) setInventory(data.inventory);
      if (Array.isArray(data.staff)) setStaff(data.staff);
      if (Array.isArray(data.appointments)) setAppointments(data.appointments);
      if (Array.isArray(data.notifications)) setNotifications(data.notifications);
      if (Array.isArray(data.messages)) setMessages(data.messages);
      if (Array.isArray(data.activeTrackers)) setActiveTrackers(data.activeTrackers);

      alert(t("Data restored successfully!"));
    }
    e.target.value = null;
  };

  return (
    <div className="page-content backup-page">
      <div className="backup-hero">
        <div className="hero-content">
          <h1>{t("Data Vault")}</h1>
          <p>{t("Secure, transportable backups for your entire garage.")}</p>
        </div>
        <div className="status-badge healthy">
          <ShieldCheck size={18} />
          {t("Protected")}
        </div>
      </div>

      <div className="backup-grid">
        <div className="backup-card main-action" onClick={handleExport}>
          <div className="card-icon download"><Download size={32} /></div>
          <h3>{t("Create Backup")}</h3>
          <p>{t("Download all customers, vehicles, and records to a secure JSON file.")}</p>
          <div className="card-footer">
            <span className="last-hint">{t("Last backup:")} {lastBackup}</span>
          </div>
        </div>

        <div className="backup-card main-action secondary">
          <label className="import-label">
            <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
            <div className="card-icon upload"><Upload size={32} /></div>
            <h3>{t("Restore Data")}</h3>
            <p>{t("Upload a previously saved backup to restore your garage system.")}</p>
          </label>
        </div>
      </div>

      <div className="info-sections">
        <div className="info-card">
          <Database size={24} className="info-icon" />
          <div className="info-text">
            <h4>{t("Current Workspace")}</h4>
            <p>
              {language === 'en'
                ? `You are currently viewing data for "${currentUser?.garageName}" (ID: ${currentUser?.ownerId}).`
                : `አሁን የ"${currentUser?.garageName}" (መታወቂያ: ${currentUser?.ownerId}) መረጃዎችን እያዩ ነው።`}
            </p>
          </div>
        </div>

        <div className="info-card warning">
          <AlertCircle size={24} className="info-icon" />
          <div className="info-text">
            <h4>{t("Data Persistence")}</h4>
            <p>
              {t("Data is stored in this browser. To prevent loss when switching devices or clearing browser cache, always keep a recent backup file.")}
            </p>
          </div>
        </div>
      </div>



      <div className="backup-section disaster-recovery" style={{ marginTop: 40, padding: 25, background: 'rgba(239, 68, 68, 0.05)', borderRadius: 16, border: '1px solid rgba(239, 68, 68, 0.1)' }}>
        <h3 style={{ color: 'var(--danger)', marginBottom: 15, display: 'flex', alignItems: 'center', gap: 10 }}>
          <History size={20} /> {t("Deep Scan & Recovery (Search Storage)")}
        </h3>
        <p style={{ fontSize: '0.9rem', marginBottom: 20 }}>
          {t("If your data is completely missing, the system can scan the browser for \"ghost\" data from other sessions or IDs. Found data can be migrated here.")}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            className="btn-primary"
            style={{ width: 'fit-content' }}
            onClick={() => {
              const allKeys = Object.keys(localStorage);
              const prefixes = new Set();
              allKeys.forEach(k => {
                if (k.startsWith('garage_') && !k.startsWith('garage_accounts') && !k.startsWith('garage_current_user')) {
                  const parts = k.split('_');
                  if (parts.length >= 2) prefixes.add(parts[0] + '_' + parts[1]);
                }
              });

              const results = [];
              prefixes.forEach(p => {
                const customers = localStorage.getItem(p + '_customers');
                if (customers && customers !== '[]') {
                  results.push({ prefix: p, count: JSON.parse(customers).length });
                }
              });

              if (results.length === 0) {
                alert(t("No hidden data found in this browser."));
                return;
              }

              const msg = language === 'en'
                ? `Found data for ${results.length} workspace(s):\n\n` + results.map(r => `ID Prefix: ${r.prefix} (${r.count} customers)`).join('\n') + `\n\nWould you like to try migrating data from the first one found (${results[0].prefix})?`
                : `ለ${results.length} የስራ ቦታዎች መረጃ ተገኝቷል:\n\n` + results.map(r => `መለያ: ${r.prefix} (${r.count} ደንበኞች)`).join('\n') + `\n\nከተገኘው የመጀመሪያው (${results[0].prefix}) መረጃ መመለስ ይፈልጋሉ?`;

              if (window.confirm(msg)) {
                const target = results[0].prefix + '_';
                const keys = ['customers', 'vehicles', 'repairs', 'inventory', 'staff', 'appointments', 'notifications', 'messages', 'trackers', 'invoices'];

                keys.forEach(k => {
                  const val = localStorage.getItem(target + k);
                  if (val) {
                    localStorage.setItem(`garage_${currentUser.ownerId}_${k}`, val);
                    localStorage.setItem(`garage_${currentUser.ownerId}_${k}_backup`, val);
                  }
                });

                alert(t("Data migrated! Reloading app..."));
                window.location.reload();
              }
            }}
          >
            <Database size={18} /> {t("Scan Browser for Ghost Data")}
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginTop: 10 }}>
            {['customers', 'vehicles', 'repairs', 'inventory', 'staff', 'appointments', 'notifications', 'messages'].map(key => (
              <button
                key={key}
                className="btn-outline-small"
                style={{ justifyContent: 'center', borderColor: 'rgba(239, 68, 68, 0.3)', color: 'var(--danger)' }}
                onClick={() => {
                  const shadow = localStorage.getItem(`garage_${currentUser.ownerId}_${key}_backup`);
                  if (!shadow) {
                    alert(`No shadow backup found for ${key}`);
                    return;
                  }
                  requestConfirmation(`Restore ${key} from shadow backup?`, () => {
                    const data = JSON.parse(shadow);
                    const setterMap = {
                      customers: setCustomers, vehicles: setVehicles, repairs: setRepairs, inventory: setInventory,
                      staff: setStaff, appointments: setAppointments, notifications: setNotifications, messages: setMessages
                    };
                    setterMap[key](data);
                    alert(`Restored ${data.length} items to ${key}`);
                  });
                }}
              >
                Restore {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="backup-section nuclear-zone" style={{ marginTop: 40, padding: 25, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 16, border: '2px dashed var(--danger)' }}>
        <h3 style={{ color: 'var(--danger)', marginBottom: 15, display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldAlert size={20} /> {t("Nuclear Fix (Master Reset)")}
        </h3>
        <p style={{ fontSize: '0.9rem', marginBottom: 20, fontWeight: 600 }}>
          {t("CRITICAL: This will wipe all data, all accounts, and all settings from this browser. Use this only if the app is completely broken.")}
        </p>
        <button
          className="btn-nuclear"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => requestConfirmation(
            t("NUCLEAR FIX: This will wipe EVERYTHING and reload. This cannot be undone. Proceed?"),
            () => {
              localStorage.clear();
              window.location.reload();
            }
          )}
        >
          <ShieldAlert size={20} /> {t("Perform Nuclear Fix & Reload")}
        </button>
      </div>
    </div>
  );
};

export default Backup;
