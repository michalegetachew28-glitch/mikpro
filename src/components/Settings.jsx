import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Settings as SettingsIcon, Globe, ShieldAlert, Trash2, Download, Upload, Briefcase, FileText, User as UserIcon, Camera, Key, Phone, MapPin, Save, Plus } from 'lucide-react';
import { compressImage } from '../utils/imageUtils';
import { generateBackupPDF } from '../utils/pdfUtils';
import PhoneInput from './PhoneInput';
import './Settings.css';

const Settings = () => {
  const { 
    language, setLanguage, clearAllData, t, customers, vehicles, repairs, inventory, staff, 
    appointments, notifications, messages, setCustomers, setVehicles, setRepairs, setInventory, 
    setStaff, setAppointments, setNotifications, setMessages, requestConfirmation,
    mechanicPaymentDetails, addItem, deleteItem
  } = useAppContext();
  const { currentUser, updateAccountInfo, updateGarageInfo, verifyPassword } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const isMechanic = currentUser?.role === 'mechanic';

  const [profileData, setProfileData] = useState({
    name: currentUser?.name || '',
    phone: currentUser?.phone || '',
    address: currentUser?.address || '',
    oldPassword: '',
    password: '',
    confirmPassword: ''
  });
  const [isPhoneValid, setIsPhoneValid] = useState(true);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error' | null

  const [showMechanicAccountModal, setShowMechanicAccountModal] = useState(false);
  const [newMechanicAccount, setNewMechanicAccount] = useState({ provider: '', accName: '', accNumber: '' });

  const handleAddMechanicAccount = (e) => {
    e.preventDefault();
    addItem('mechanicPaymentDetails', {
      ...newMechanicAccount,
      mechanicId: currentUser.id,
      mechanicName: currentUser.name, // Save name for robust lookups
      type: 'mobile' // Assume mobile for now
    });
    setShowMechanicAccountModal(false);
    setNewMechanicAccount({ provider: '', accName: '', accNumber: '' });
    alert(t("Account added successfully!"));
  };

  const handleExport = () => {
    const data = { customers, vehicles, repairs, inventory, staff, appointments, notifications, messages };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `garage_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check if confirmingAction is already active if you want, but simple override is okay
    requestConfirmation(
      t("This will OVERWRITE your current data with the backup. Continue?"),
      () => {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target.result);
            if (data.customers) setCustomers(data.customers);
            if (data.vehicles) setVehicles(data.vehicles);
            if (data.repairs) setRepairs(data.repairs);
            if (data.inventory) setInventory(data.inventory);
            if (data.staff) setStaff(data.staff);
            if (data.appointments) setAppointments(data.appointments);
            if (data.notifications) setNotifications(data.notifications);
            if (data.messages) setMessages(data.messages);
            alert(t("Data imported successfully!"));
          } catch (err) {
            alert('Invalid backup file!');
          }
        };
        reader.readAsText(file);
      }
    );
    e.target.value = null;
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (!isPhoneValid) {
        setSaveStatus('error');
        alert(t("Invalid phone number format."));
        return;
    }

    if (profileData.password && profileData.password !== profileData.confirmPassword) {
        setSaveStatus('error');
        alert(t('passwordsDoNotMatch'));
        return;
    }
    
    if (profileData.password) {
        if (!profileData.oldPassword) {
            setSaveStatus('error');
            alert(t('oldPasswordRequired'));
            return;
        }
        if (!verifyPassword(profileData.oldPassword)) {
            setSaveStatus('error');
            alert(t('currentPasswordIncorrect'));
            return;
        }
    }

    const updates = {
        name: profileData.name,
        phone: profileData.phone,
        address: profileData.address
    };

    if (profileData.password) {
        updates.password = profileData.password;
    }

    requestConfirmation(
        t("Are you sure you want to update your profile data?"),
        () => {
            updateAccountInfo(updates);
            setSaveStatus('success');
            setProfileData(prev => ({ ...prev, oldPassword: '', password: '', confirmPassword: '' }));
            alert(t("Profile updated successfully!"));
            setTimeout(() => setSaveStatus(null), 3000);
        }
    );
  };

  return (
    <div className="page-content settings-page">
      <div className="page-header">
        <div className="header-title">
          <div className="icon-wrapper"><SettingsIcon size={28} /></div>
          <div>
            <h1>{t('settings') || 'Settings'}</h1>
            <p className="subtitle">{t("Manage your application preferences and data.")}</p>
          </div>
        </div>
      </div>

      <div className="settings-section profile-management-section">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <UserIcon size={20} /> {t("Edit Profile")}
        </h2>
        
        <div className="profile-grid">
           
            <div className="profile-pic-sidebar">
               <div className="profile-avatar-wrapper">
                  {currentUser?.profilePic || (currentUser?.profilePics && currentUser.profilePics[0]) ? (
                    <img src={currentUser.profilePics?.[0] || currentUser.profilePic} alt="Profile" className="profile-avatar-img" />
                  ) : (
                    <div className="profile-avatar-placeholder">
                      {currentUser?.name?.charAt(0) || 'U'}
                    </div>
                  )}
               </div>
               
               <div className="profile-static-info">
                  <h3>{currentUser?.name}</h3>
                  <span className="role-tag">{currentUser?.role?.toUpperCase()}</span>
               </div>

               <div className="profile-gallery-container">
                  <div className="gallery-header">
                     <span style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.7 }}>{t("Photo Gallery")}</span>
                  </div>
                  <div className="gallery-grid">
                     {(currentUser?.profilePics || (currentUser?.profilePic ? [currentUser.profilePic] : [])).map((pic, idx) => (
                        <div key={idx} className={`gallery-item ${idx === 0 ? 'active' : ''}`} title={idx === 0 ? 'Primary Photo' : ''}>
                           <img src={pic} alt={`Profile ${idx}`} onClick={() => {
                              const pics = currentUser.profilePics ? [...currentUser.profilePics] : (currentUser.profilePic ? [currentUser.profilePic] : []);
                              if (idx !== 0) {
                                 const temp = pics[0];
                                 pics[0] = pics[idx];
                                 pics[idx] = temp;
                                 updateAccountInfo({ profilePics: pics, profilePic: pics[0] });
                              }
                           }} />
                           <div className="gallery-item-overlay">
                              <button type="button" className="delete-photo-btn" onClick={(e) => {
                                 e.stopPropagation();
                                 const pics = currentUser.profilePics ? [...currentUser.profilePics] : (currentUser.profilePic ? [currentUser.profilePic] : []);
                                 pics.splice(idx, 1);
                                 updateAccountInfo({ profilePics: pics, profilePic: pics[0] || null });
                              }}>
                                 <Trash2 size={12} />
                              </button>
                           </div>
                        </div>
                     ))}
                     
                     <label className="add-photo-card">
                        <Plus size={20} />
                        <span>{t('add') || 'Add'}</span>
                        <input 
                           type="file" 
                           accept="image/*" 
                           multiple
                           onChange={async (e) => {
                              const files = Array.from(e.target.files);
                              const newPics = [];
                              for (const file of files) {
                                 const reader = new FileReader();
                                 const promise = new Promise(resolve => {
                                    reader.onloadend = async () => resolve(await compressImage(reader.result));
                                    reader.readAsDataURL(file);
                                 });
                                 newPics.push(await promise);
                              }
                              const currentPics = currentUser.profilePics ? [...currentUser.profilePics] : (currentUser.profilePic ? [currentUser.profilePic] : []);
                              const updatedPics = [...currentPics, ...newPics];
                              updateAccountInfo({ profilePics: updatedPics, profilePic: updatedPics[0] });
                           }} 
                           style={{ display: 'none' }} 
                        />
                     </label>
                  </div>
               </div>
            </div>
           </div>

           <form className="profile-form" onSubmit={handleSaveProfile}>
              <div className="form-row">
                 <div className="form-group flex-1">
                    <label><UserIcon size={14} /> {t('name')}</label>
                    <input 
                        type="text" 
                        value={profileData.name} 
                        onChange={(e) => setProfileData({ ...profileData, name: e.target.value })} 
                        className="auth-input"
                        required
                    />
                 </div>
                 <div className="form-group flex-1">
                    <label><Phone size={14} /> {t('phone')}</label>
                    <PhoneInput 
                        value={profileData.phone}
                        onChange={(val, valid) => {
                            setProfileData({ ...profileData, phone: val });
                            setIsPhoneValid(valid);
                        }}
                    />
                 </div>
              </div>

              <div className="form-group">
                 <label><MapPin size={14} /> {t('address')}</label>
                 <textarea 
                    value={profileData.address} 
                    onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                    className="auth-input"
                    placeholder="Enter your physical address..."
                 />
              </div>

              <div className="form-group">
                 <label><Key size={14} /> {t('oldPassword')}</label>
                 <input 
                     type="password" 
                     value={profileData.oldPassword} 
                     onChange={(e) => setProfileData({ ...profileData, oldPassword: e.target.value })} 
                     className="auth-input"
                     placeholder="••••••••"
                 />
                 {profileData.password && !profileData.oldPassword && <small style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: 4 }}>*{t('oldPasswordRequired')}</small>}
              </div>

              <div className="form-row">
                 <div className="form-group flex-1">
                    <label><Key size={14} /> {t("New Password")}</label>
                    <input 
                        type="password" 
                        value={profileData.password} 
                        onChange={(e) => setProfileData({ ...profileData, password: e.target.value })} 
                        className="auth-input"
                        placeholder="••••••••"
                    />
                 </div>
                 <div className="form-group flex-1">
                    <label><Key size={14} /> {t('confirmPassword')}</label>
                    <input 
                        type="password" 
                        value={profileData.confirmPassword} 
                        onChange={(e) => setProfileData({ ...profileData, confirmPassword: e.target.value })} 
                        className="auth-input"
                        placeholder="••••••••"
                    />
                 </div>
              </div>

              <button type="submit" className={`btn-primary save-profile-btn ${saveStatus}`}>
                 <Save size={18} />
                 {t("Update Profile")}
              </button>
           </form>
         </div>

         {isMechanic && (
          <div className="settings-section">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Globe size={20} /> {t("My Payment Accounts (For Tips/Bonuses)")}
            </h2>
            <div style={{ marginBottom: 20 }}>
              <button className="btn-primary" onClick={() => setShowMechanicAccountModal(true)} style={{ display: 'inline-flex' }}>
                <Plus size={16} /> {t("Add Mobile Payment")}
              </button>
            </div>
            
            <div className="grid-3-col" style={{ gap: 16 }}>
              {mechanicPaymentDetails?.filter(acc => String(acc.mechanicId) === String(currentUser.id)).map(acc => (
                <div key={acc.id} className="payment-method-box" style={{ background: 'var(--bg-main)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                     <h4 style={{ margin: 0, color: 'var(--primary)' }}>{acc.provider}</h4>
                     <button className="btn-icon-danger" onClick={() => requestConfirmation('Delete this payment method?', () => deleteItem('mechanicPaymentDetails', acc.id))} style={{ padding: 4, background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                       <Trash2 size={16} />
                     </button>
                   </div>
                   <p style={{ margin: '0 0 4px 0', fontSize: '0.9rem', fontWeight: 600 }}>{acc.accName}</p>
                   <p style={{ margin: 0, fontSize: '0.9rem', fontFamily: 'monospace' }}>{acc.accNumber}</p>
                </div>
              ))}
              {(!mechanicPaymentDetails || mechanicPaymentDetails.filter(acc => String(acc.mechanicId) === String(currentUser.id)).length === 0) && (
                <div style={{ gridColumn: '1 / -1', padding: 20, textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--bg-main)', borderRadius: 12, border: '1px dashed var(--border)' }}>
                  {t("No payment accounts added yet. Add one to receive bonuses from customers!")}
                </div>
              )}
            </div>
          </div>
         )}

         <div className="settings-section">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Briefcase size={20} /> {t("Garage Profile")}
        </h2>
        <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 15 }}>
          <div style={{ width: '100%' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 5, opacity: 0.8 }}>
              {t("Garage Name")}
            </label>
            <input 
              type="text" 
              className="auth-input" 
              defaultValue={currentUser?.garageName}
              id="settings-garage-name"
              placeholder="e.g. Miky Garage"
              style={{ margin: 0, maxWidth: 'none' }}
              disabled={!isAdmin}
            />
          </div>
          {isAdmin && (
            <button 
              className="btn-primary" 
              onClick={() => {
                const newName = document.getElementById('settings-garage-name').value.trim();
                if (newName) {
                  updateGarageInfo(currentUser.ownerId, { garageName: newName });
                  // Save to permanent metadata that survives "Clear Data"
                  const metaKey = `garage_${currentUser.ownerId}_metadata`;
                  const meta = JSON.parse(localStorage.getItem(metaKey) || '{}');
                  localStorage.setItem(metaKey, JSON.stringify({ ...meta, garageName: newName }));
                  alert(t("Garage name updated for all staff!"));
                }
              }}
              style={{ padding: '8px 24px' }}
            >
              {t("Save Changes")}
            </button>
          )}
        </div>
      </div>

      <div className="settings-section">
        <h2><Globe size={20} /> {t("Preferences")}</h2>
        <div className="setting-item">
          <div className="setting-info">
            <h4>{t("Language")}</h4>
            <p>{t("Select your preferred language.")}</p>
          </div>
          <div>
            <select 
              value={language} 
              onChange={(e) => setLanguage(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-main)', color: 'var(--text-primary)' }}
            >
              <option value="en">English</option>
              <option value="am">አማርኛ (Amharic)</option>
              <option value="om">Afaan Oromoo</option>
              <option value="so">Soomaali (Somali)</option>
              <option value="ti">ትግርኛ (Tigrinya)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2><Download size={20} /> {t("Data Backup")}</h2>
        
        <div className="setting-item">
          <div className="setting-info">
            <h4>{t("Export Data")}</h4>
            <p>{t("Download a backup of all your garage data to a file. Keep this safe!")}</p>
          </div>
          <div>
            <button className="btn-primary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Download size={16} /> JSON
            </button>
            <button className="btn-primary" onClick={() => generateBackupPDF({ customers, repairs, inventory, vehicles, staff }, currentUser?.garageName)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--success)', borderColor: 'var(--success)' }}>
              <FileText size={16} /> {t("PDF Report")}
            </button>
          </div>
        </div>

        {isAdmin && (
          <div className="setting-item">
            <div className="setting-info">
              <h4>{t("Import Data")}</h4>
              <p>{t("Restore your garage data from a previously downloaded backup file.")}</p>
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 16px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-main)', color: 'var(--text-primary)', fontWeight: '600', fontSize: '14px' }}>
                <Upload size={16} /> {t("Upload JSON")}
                <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
              </label>
            </div>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="settings-section settings-danger-zone">
          <h2><ShieldAlert size={20} /> {t("Danger Zone")}</h2>
          <div className="setting-item">
            <div className="setting-info">
              <h4>{t("Reset Application Data")}</h4>
              <p>{t("Warning: This will permanently delete all customers, vehicles, repairs, inventory, and staff associated with your garage. This action cannot be undone.")}</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn-primary" 
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}
                onClick={() => requestConfirmation(
                  t("Are you absolutely sure you want to delete ALL data? This cannot be undone."),
                  () => {
                    clearAllData();
                    alert(t("All data has been reset."));
                  }
                )}
              >
                <Trash2 size={16} />
                {t('resetData') || 'Reset Data'}
              </button>
              
              <button 
                className="btn-nuclear" 
                onClick={() => requestConfirmation(
                  t("NUCLEAR FIX: This will wipe EVERYTHING (Settings, Accounts, Data) and reload. Are you sure?"),
                  () => {
                    localStorage.clear();
                    window.location.reload();
                  }
                )}
              >
                <ShieldAlert size={16} />
                {t("Nuclear Fix")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="settings-section">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><FileText size={20} /> {t("System Health Logs")}</h2>
        <p className="subtitle" style={{ marginBottom: 15 }}>{t("Recent data operations (Last 20 operations)")}</p>
        <div style={{ background: 'var(--bg-main)', borderRadius: 12, border: '1px solid var(--border)', maxHeight: 300, overflowY: 'auto', padding: 10 }}>
          {(() => {
            try {
              const logs = JSON.parse(localStorage.getItem('garage_debug_logs') || '[]');
              return (Array.isArray(logs) ? logs : []).map((log, i) => (
                <div key={i} style={{ 
                  display: 'flex', gap: 15, padding: '8px 12px', 
                  fontSize: '0.8rem', borderBottom: '1px solid var(--border)',
                  opacity: (log.op || '').includes('FAIL') || (log.op || '').includes('REJECTED') ? 1 : 0.7 
                }}>
                  <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{new Date(log.time).toLocaleTimeString()}</span>
                  <span style={{ 
                    fontWeight: 700, minWidth: 100,
                    color: (log.op || '').includes('SUCCESS') ? 'var(--success)' : (log.op || '').includes('FAIL') || (log.op || '').includes('REJECTED') ? 'var(--danger)' : 'var(--primary)'
                  }}>{log.op}</span>
                  <span style={{ flex: 1 }}>{log.key}: {log.details}</span>
                </div>
              ));
            } catch (e) {
              return <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Log format error.</div>;
            }
          })()}
          {(!localStorage.getItem('garage_debug_logs') || localStorage.getItem('garage_debug_logs') === '[]') && (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>No logs recorded yet.</div>
          )}
        </div>
      </div>

      {showMechanicAccountModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2>{t("Add Payment Account")}</h2>
              <button className="icon-btn" onClick={() => setShowMechanicAccountModal(false)}><Plus size={24} style={{ transform: 'rotate(45deg)' }} /></button>
            </div>
            <form className="modal-body" onSubmit={handleAddMechanicAccount}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                 <label>{t("Provider (e.g. Telebirr, CBE Birr)")}</label>
                 <select 
                   className="auth-input" 
                   required 
                   value={newMechanicAccount.provider}
                   onChange={(e) => setNewMechanicAccount({...newMechanicAccount, provider: e.target.value})}
                 >
                    <option value="">-- {t("Select Provider")} --</option>
                    <option value="Telebirr">Telebirr</option>
                    <option value="CBE Birr">CBE Birr</option>
                    <option value="Awash Birr">Awash Birr</option>
                    <option value="M-Pesa">M-Pesa</option>
                    <option value="Zemen">Zemen</option>
                    <option value="Other">Other (Bank)</option>
                 </select>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                 <label>{t("Account Name")}</label>
                 <input 
                   type="text" 
                   className="auth-input" 
                   required 
                   value={newMechanicAccount.accName}
                   onChange={(e) => setNewMechanicAccount({...newMechanicAccount, accName: e.target.value})}
                   placeholder="Abebe Kebede"
                 />
              </div>
              <div className="form-group" style={{ marginBottom: 24 }}>
                 <label>{t("Account/Phone Number")}</label>
                 <PhoneInput 
                   value={newMechanicAccount.accNumber}
                   onChange={(val, valid) => {
                     setNewMechanicAccount({...newMechanicAccount, accNumber: val});
                     // Note: validity checking could be added here if needed
                   }}
                   required={true}
                 />
              </div>
              <button type="submit" className="btn-primary w-full">{t("Save Account")}</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Settings;


