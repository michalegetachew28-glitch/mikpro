import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, User, Mail, Phone, Shield, Calendar, Edit2, Check, Trash2, LogOut, Lock, Globe, Bell, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import './UserProfileModal.css';

const UserProfileModal = ({ isOpen, onClose, userId = null }) => {
  const { currentUser, updateAccountInfo, getAccounts, verifyPassword, resetPassword } = useAuth();
  const { t, formatDate, userPresence } = useAppContext();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [editData, setEditData] = useState({});
  const [targetUser, setTargetUser] = useState(null);
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  
  const isOwnProfile = !userId || userId === currentUser?.id;

  useEffect(() => {
    if (isOpen) {
      if (isOwnProfile) {
        setTargetUser(currentUser);
        setEditData({
          name: currentUser?.name || '',
          username: currentUser?.username || '',
          email: currentUser?.email || '',
          phone: currentUser?.phone || '',
          bio: currentUser?.bio || '',
          profilePic: currentUser?.profilePic || null
        });
      } else {
        const accounts = getAccounts();
        const found = accounts.find(a => a.id === userId);
        setTargetUser(found);
      }
      setError('');
      setSuccess('');
      setIsEditing(false);
      setIsChangingPassword(false);
    }
  }, [isOpen, userId, currentUser, getAccounts, isOwnProfile]);

  if (!isOpen || !targetUser) return null;

  const handleSaveProfile = () => {
    if (!editData.name.trim()) return setError('Name is required');
    
    updateAccountInfo(editData);
    setSuccess('Profile updated successfully!');
    setTimeout(() => {
      setIsEditing(false);
      setSuccess('');
    }, 1500);
  };

  const handlePasswordChange = () => {
    if (!passwordData.current || !passwordData.new || !passwordData.confirm) {
      return setError('All fields are required');
    }
    if (passwordData.new !== passwordData.confirm) {
      return setError('Passwords do not match');
    }
    
    if (verifyPassword(passwordData.current)) {
      const res = resetPassword(currentUser.email || currentUser.phone, passwordData.new);
      if (res.success) {
        setSuccess('Password changed successfully!');
        setPasswordData({ current: '', new: '', confirm: '' });
        setTimeout(() => {
          setIsChangingPassword(false);
          setSuccess('');
        }, 1500);
      } else {
        setError(res.message);
      }
    } else {
      setError('Incorrect current password');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        // Simple Base64 storage for demo purposes, in real app would upload to S3/Firebase
        setEditData(prev => ({ ...prev, profilePic: event.target.result }));
        if (!isEditing) {
          updateAccountInfo({ profilePic: event.target.result });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeProfilePic = () => {
    setEditData(prev => ({ ...prev, profilePic: null }));
    if (!isEditing) {
      updateAccountInfo({ profilePic: null });
    }
  };

  const presence = userPresence[targetUser.id] || { online: false };

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal-content shadow-premium" onClick={e => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h2>{isOwnProfile ? t('My Profile') : t('User Profile')}</h2>
          <button className="close-profile-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="profile-modal-body">
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-error success">{success}</div>}

          {/* Top Section: Banner & Avatar */}
          <div className="profile-top-container">
            <div className="profile-header-banner">
              <div className={`profile-status-badge ${presence.online ? 'online' : 'offline'}`}>
                {presence.online ? t('Online Now') : t('Offline')}
              </div>
            </div>
            
            <div className="profile-avatar-wrapper">
              <div className="profile-avatar-container">
                {editData.profilePic || targetUser.profilePic ? (
                  <img src={editData.profilePic || targetUser.profilePic} alt="Profile" className="profile-avatar-img" />
                ) : (
                  <div className="profile-avatar-placeholder">
                    {targetUser.name?.charAt(0)}
                  </div>
                )}
                {isOwnProfile && (
                  <div className="edit-avatar-overlay" onClick={() => fileInputRef.current.click()}>
                    <Camera size={18} color="white" />
                  </div>
                )}
              </div>
            </div>

            <div className="profile-main-info text-center">
              <h3 className="profile-name">{targetUser.name}</h3>
              <p className="profile-username">@{targetUser.username || targetUser.id}</p>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*" 
              onChange={handleFileChange} 
            />
          </div>

          {!isEditing && !isChangingPassword ? (
            /* View Mode */
            <div className="profile-view-mode">
              <div className="profile-info-grid">
                <div className="info-item">
                  <label>{t('Role')}</label>
                  <div className="info-value flex items-center gap-2">
                    <Shield size={16} className="text-secondary" />
                    {t(targetUser.role)}
                  </div>
                </div>
                <div className="info-item">
                  <label>{t('Join Date')}</label>
                  <div className="info-value flex items-center gap-2">
                    <Calendar size={16} className="text-secondary" />
                    {formatDate(targetUser.createdAt)}
                  </div>
                </div>
                <div className="info-item">
                  <label>{t('Email')}</label>
                  <div className="info-value flex items-center gap-2">
                    <Mail size={16} className="text-secondary" />
                    {targetUser.email || '-'}
                  </div>
                </div>
                <div className="info-item">
                  <label>{t('Phone')}</label>
                  <div className="info-value flex items-center gap-2">
                    <Phone size={16} className="text-secondary" />
                    {targetUser.phone}
                  </div>
                </div>
                <div className="info-item full-width">
                  <label>{t('Bio / About')}</label>
                  <div className="profile-bio">
                    {targetUser.bio || t('No bio provided yet.')}
                  </div>
                </div>
              </div>

              {isOwnProfile && (
                <div className="profile-modal-actions">
                  <button className="btn-profile-secondary flex items-center gap-2" onClick={() => setIsChangingPassword(true)}>
                    <Lock size={16} /> {t('Password')}
                  </button>
                  <button className="btn-profile-primary flex items-center gap-2" onClick={() => setIsEditing(true)}>
                    <Edit2 size={16} /> {t('Edit Profile')}
                  </button>
                </div>
              )}
            </div>
          ) : isEditing ? (
            /* Edit Mode */
            <div className="edit-profile-form">
              <div className="form-row">
                <div className="form-group">
                  <label>{t('Full Name')}</label>
                  <input 
                    type="text" 
                    className="profile-input" 
                    value={editData.name} 
                    onChange={e => setEditData({...editData, name: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>{t('Username')}</label>
                  <input 
                    type="text" 
                    className="profile-input" 
                    value={editData.username} 
                    onChange={e => setEditData({...editData, username: e.target.value.replace(/\s+/g, '').toLowerCase()})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>{t('Bio')}</label>
                <textarea 
                  className="profile-input profile-textarea" 
                  value={editData.bio} 
                  onChange={e => setEditData({...editData, bio: e.target.value})}
                  placeholder={t('Tell us about yourself...')}
                />
              </div>
              
              <div className="avatar-actions flex gap-4 mt-2">
                <button className="btn-profile-danger flex-1 flex items-center justify-center gap-2" onClick={removeProfilePic}>
                  <Trash2 size={16} /> {t('Remove Photo')}
                </button>
                <button className="btn-profile-secondary flex-1 flex items-center justify-center gap-2" onClick={() => fileInputRef.current.click()}>
                  <Camera size={16} /> {t('Change Photo')}
                </button>
              </div>

              <div className="profile-modal-actions">
                <button className="btn-profile-secondary" onClick={() => setIsEditing(false)}>{t('Cancel')}</button>
                <button className="btn-profile-primary flex items-center gap-2" onClick={handleSaveProfile}>
                  <Check size={18} /> {t('Save Changes')}
                </button>
              </div>
            </div>
          ) : (
            /* Change Password Mode */
            <div className="edit-profile-form">
              <div className="form-group">
                <label>{t('Current Password')}</label>
                <input 
                  type="password" 
                  className="profile-input" 
                  value={passwordData.current} 
                  onChange={e => setPasswordData({...passwordData, current: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>{t('New Password')}</label>
                <input 
                  type="password" 
                  className="profile-input" 
                  value={passwordData.new} 
                  onChange={e => setPasswordData({...passwordData, new: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>{t('Confirm New Password')}</label>
                <input 
                  type="password" 
                  className="profile-input" 
                  value={passwordData.confirm} 
                  onChange={e => setPasswordData({...passwordData, confirm: e.target.value})}
                />
              </div>
              <div className="profile-modal-actions">
                <button className="btn-profile-secondary" onClick={() => setIsChangingPassword(false)}>{t('Cancel')}</button>
                <button className="btn-profile-primary flex items-center gap-2" onClick={handlePasswordChange}>
                  <Check size={18} /> {t('Update Password')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
