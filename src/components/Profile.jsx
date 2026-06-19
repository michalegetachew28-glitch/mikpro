import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  X, Camera, User, Mail, Phone, Shield, Calendar, Edit2,
  Check, Trash2, Lock, ArrowLeft, Save, Info, MapPin, Globe
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import './Profile.css';

const Profile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { currentUser, updateAccountInfo, getAccounts, verifyPassword, resetPassword, addProfilePhoto, removeProfilePhoto } = useAuth();
  const { t, formatDate, userPresence, ensureEntityArray, staff, customers, groups, updateGroup } = useAppContext();

  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [editData, setEditData] = useState({});
  const [targetUser, setTargetUser] = useState(null);
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showLightbox, setShowLightbox] = useState(false);

  const fileInputRef = useRef(null);

  const isOwnProfile = !userId || String(userId) === String(currentUser?.id);
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'coder' || currentUser?.role === 'manager';
  const canEdit = isOwnProfile || isAdmin;

  useEffect(() => {
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
      const allEntities = [
        ...accounts,
        ...ensureEntityArray(staff, 'staff'),
        ...ensureEntityArray(customers, 'customers'),
        ...ensureEntityArray(groups, 'groups')
      ];
      const found = allEntities.find(a => String(a.id) === String(userId));

      if (found) {
        setTargetUser(found);
        setEditData({
          name: found.name || found.username || '',
          username: found.username || '',
          email: found.email || '',
          phone: found.phone || '',
          bio: found.bio || found.description || '',
          profilePic: found.profilePic || found.image || null
        });
      }
    }
    setError('');
    setSuccess('');
    setIsEditing(false);
    setIsChangingPassword(false);
  }, [userId, currentUser, getAccounts, isOwnProfile, staff, customers, groups]);

  if (!targetUser) {
    return (
      <div className="profile-page-loading">
        <div className="loader-spinner"></div>
      </div>
    );
  }

  const handleSaveProfile = () => {
    if (!editData.name?.trim()) return setError(t('Name is required'));

    if (isOwnProfile) {
      updateAccountInfo(editData);
    } else if (targetUser.type === 'group') {
      updateGroup(targetUser.id, {
        name: editData.name,
        description: editData.bio,
        image: editData.profilePic
      });
      setTargetUser({ ...targetUser, ...editData });
    } else {
      updateOtherAccount(targetUser.id, editData);
      setTargetUser({ ...targetUser, ...editData });
    }

    setSuccess(t('Profile updated successfully!'));
    setTimeout(() => {
      setIsEditing(false);
      setSuccess('');
    }, 1500);
  };

  const handlePasswordChange = () => {
    if (!passwordData.current || !passwordData.new || !passwordData.confirm) {
      return setError(t('All fields are required'));
    }
    if (passwordData.new !== passwordData.confirm) {
      return setError(t('Passwords do not match'));
    }

    if (verifyPassword(passwordData.current)) {
      const res = resetPassword(currentUser.email || currentUser.phone, passwordData.new);
      if (res.success) {
        setSuccess(t('Password changed successfully!'));
        setPasswordData({ current: '', new: '', confirm: '' });
        setTimeout(() => {
          setIsChangingPassword(false);
          setSuccess('');
        }, 1500);
      } else {
        setError(res.message);
      }
    } else {
      setError(t('Incorrect current password'));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const picData = event.target.result;
        setEditData(prev => ({ ...prev, profilePic: picData }));
        if (!isEditing) {
          if (isOwnProfile) {
            updateAccountInfo({ profilePic: picData });
          } else if (targetUser.type === 'group') {
            updateGroup(targetUser.id, { image: picData });
            setTargetUser(prev => ({ ...prev, image: picData }));
          } else {
            updateOtherAccount(targetUser.id, { profilePic: picData });
            setTargetUser(prev => ({ ...prev, profilePic: picData }));
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeProfilePic = () => {
    setEditData(prev => ({ ...prev, profilePic: null }));
    if (!isEditing) {
      if (isOwnProfile) {
        updateAccountInfo({ profilePic: null });
      } else {
        updateOtherAccount(targetUser.id, { profilePic: null });
        setTargetUser(prev => ({ ...prev, profilePic: null }));
      }
    }
  };

  const presence = userPresence[targetUser.id] || { online: false };

  return (
    <div className="profile-page-container fade-in">
      <div className="profile-page-header">
        <button className="back-btn-premium" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
          <span>{t('Back')}</span>
        </button>
        <h1>{isOwnProfile ? t('My Account') : targetUser?.type === 'group' ? t('Group Profile') : t('User Profile')}</h1>
      </div>

      <div className="profile-page-content shadow-premium">
        <div className="profile-banner-full">
          <div className="banner-overlay-gradient"></div>
          {targetUser.type !== 'group' && (
            <div className={`page-status-badge ${presence.online ? 'online' : 'offline'}`}>
              <span className="status-dot"></span>
              {presence.online ? t('Online Now') : t('Offline')}
            </div>
          )}
          {targetUser.type === 'group' && (
            <div className="page-status-badge online">
              <span className="status-dot"></span>
              {targetUser.members?.length || 0} {t('Members')}
            </div>
          )}
        </div>

        <div className="profile-main-section">
          <div className="profile-avatar-wrapper-page">
            <div className="profile-avatar-container-page" onClick={() => setShowLightbox(true)} style={{ cursor: 'pointer' }}>
              {editData.profilePic || targetUser.profilePic ? (
                <img src={editData.profilePic || targetUser.profilePic} alt="Profile" className="profile-avatar-img-page" />
              ) : (
                <div className="profile-avatar-placeholder-page">
                  {targetUser.name?.charAt(0)}
                </div>
              )}
              {isOwnProfile && (
                <div className="edit-avatar-overlay-page" onClick={(e) => { e.stopPropagation(); fileInputRef.current.click(); }}>
                  <Camera size={22} color="white" />
                </div>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>

          <div className="profile-essential-info">
            <h2 className="profile-full-name">{targetUser.name}</h2>
            <p className="profile-handle">{targetUser.type === 'group' ? t('Group') : `@${targetUser.username || targetUser.id}`}</p>
            <span className="profile-role-badge">{targetUser.type === 'group' ? t('Chat Group') : t(targetUser.role)?.toUpperCase()}</span>
          </div>
        </div>

        <div className="profile-details-section">
          {error && <div className="profile-msg-error">{error}</div>}
          {success && <div className="profile-msg-success">{success}</div>}

          {!isEditing && !isChangingPassword ? (
            <div className="profile-view-layout">
              <div className="info-grid-premium">
                {targetUser.type !== 'group' && (
                  <div className="info-card-premium">
                    <div className="info-card-icon"><Mail size={20} /></div>
                    <div className="info-card-text">
                      <label>{t('Email Address')}</label>
                      <p>{targetUser.email || '-'}</p>
                    </div>
                  </div>
                )}
                {targetUser.type !== 'group' && (
                  <div className="info-card-premium">
                    <div className="info-card-icon"><Phone size={20} /></div>
                    <div className="info-card-text">
                      <label>{t('Phone Number')}</label>
                      <p>{targetUser.phone}</p>
                    </div>
                  </div>
                )}
                <div className="info-card-premium">
                  <div className="info-card-icon"><Calendar size={20} /></div>
                  <div className="info-card-text">
                    <label>{targetUser.type === 'group' ? t('Created On') : t('Member Since')}</label>
                    <p>{formatDate(targetUser.createdAt)}</p>
                  </div>
                </div>
                {targetUser.type !== 'group' && (
                  <div className="info-card-premium">
                    <div className="info-card-icon"><Shield size={20} /></div>
                    <div className="info-card-text">
                      <label>{t('Account Status')}</label>
                      <p>{t('Verified Professional')}</p>
                    </div>
                  </div>
                )}
                {targetUser.type === 'group' && (
                  <div className="info-card-premium">
                    <div className="info-card-icon"><User size={20} /></div>
                    <div className="info-card-text">
                      <label>{t('Created By')}</label>
                      <p>{[...ensureEntityArray(staff, 'staff'), ...ensureEntityArray(customers, 'customers')].find(u => String(u.id) === String(targetUser.createdBy))?.name || t('Admin')}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bio-container-premium">
                <div className="section-title-premium">
                  <Info size={18} />
                  <h3>{targetUser.type === 'group' ? t('Group Description') : t('About Me')}</h3>
                </div>
                <div className="bio-box-premium">
                  {targetUser.type === 'group'
                    ? (targetUser.description || t('No description available.'))
                    : (targetUser.bio || t('This user has not shared a bio yet.'))}
                </div>
              </div>


              {canEdit && (
                <div className="profile-cta-row">
                  {targetUser.type !== 'group' && (
                    <button className="btn-premium-outline" onClick={() => setIsChangingPassword(true)}>
                      <Lock size={18} /> {t('Security Settings')}
                    </button>
                  )}
                  <button className="btn-premium-primary" onClick={() => setIsEditing(true)}>
                    <Edit2 size={18} /> {t(targetUser.type === 'group' ? 'Edit Group' : 'Personalize Profile')}
                  </button>
                </div>
              )}
            </div>
          ) : isEditing ? (
            <div className="profile-edit-layout">
              <div className="edit-form-grid">
                <div className="edit-field full-width">
                  <label>{t('Display Name')}</label>
                  <div className="input-with-icon">
                    <User size={18} />
                    <input
                      type="text"
                      value={editData.name}
                      onChange={e => setEditData({ ...editData, name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="edit-field full-width">
                  <label>{t('Bio / Summary')}</label>
                  <textarea
                    value={editData.bio}
                    onChange={e => setEditData({ ...editData, bio: e.target.value })}
                    placeholder={t('Share a little bit about yourself...')}
                  />
                </div>
              </div>

              <div className="avatar-edit-controls">
                <button className="btn-premium-secondary" onClick={() => fileInputRef.current.click()}>
                  <Camera size={18} /> {t('Update Photo')}
                </button>
              </div>

              <div className="profile-cta-buttons">
                <button className="btn-premium-ghost" onClick={() => setIsEditing(false)}>{t('Discard Changes')}</button>
                <button className="btn-premium-primary" onClick={handleSaveProfile}>
                  <Check size={20} /> {t('Publish Updates')}
                </button>
              </div>
            </div>
          ) : (
            <div className="profile-security-layout">
              <div className="security-form">
                <div className="edit-field">
                  <label>{t('Current Password')}</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={passwordData.current}
                    onChange={e => setPasswordData({ ...passwordData, current: e.target.value })}
                  />
                </div>
                <div className="edit-field">
                  <label>{t('New Password')}</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={passwordData.new}
                    onChange={e => setPasswordData({ ...passwordData, new: e.target.value })}
                  />
                </div>
                <div className="edit-field">
                  <label>{t('Verify New Password')}</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={passwordData.confirm}
                    onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                  />
                </div>

                <div className="profile-cta-buttons">
                  <button className="btn-premium-ghost" onClick={() => setIsChangingPassword(false)}>{t('Go Back')}</button>
                  <button className="btn-premium-primary" onClick={handlePasswordChange}>
                    <Check size={20} /> {t('Commit Password Change')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Lightbox Overlay ──────────────────────────────────────── */}
      {showLightbox && (editData.profilePic || targetUser.profilePic) && (
        <div className="lightbox-overlay" onClick={() => setShowLightbox(false)}>
          <button className="lightbox-close" onClick={() => setShowLightbox(false)}>
            <X size={32} />
          </button>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <img src={editData.profilePic || targetUser.profilePic} alt={targetUser.name} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
