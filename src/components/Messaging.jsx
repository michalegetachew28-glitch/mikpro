import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Send, Paperclip, Smile, Mic, MoreVertical, Check, CheckCheck,
  ArrowLeft, User, Users, Settings, MessageSquare, Pin, Trash2, Reply,
  ImageIcon, FileText, Phone, Video, X, Download, Clock,
  Shield, Lock, ChevronRight, Star, Bell, BellOff, Info,
  Camera, Edit3, Eye, Maximize, Play, Pause, Volume2, Square,
  MicOff, VideoOff, PhoneOff, ScreenShare, Maximize2, Minimize2, CornerUpLeft, UserPlus, Bluetooth,
  PhoneIncoming, PhoneCall, Slash
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import GroupCallBanner from './GroupCallBanner';
import './Messaging.css';

// ── helpers ──────────────────────────────────────────────────────────────────
const initial = (name) => (name || 'U').charAt(0).toUpperCase();
const roleColor = (role) => {
  const map = { admin: '#6c63ff', mechanic: '#0ea5e9', receptionist: '#f59e0b', cashier: '#10b981', storekeeper: '#3b82f6', customer: '#ec4899', coder: '#ef4444', manager: '#8b5cf6' };
  return map[role] || '#6c63ff';
};

const generateVideoThumbnail = (file) => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    video.onloadeddata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      video.currentTime = 1; // get frame at 1s
    };

    video.onseeked = () => {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };

    video.onerror = () => resolve(null);
    video.src = URL.createObjectURL(file);
  });
};

// ── Voice Message Bubble ──────────────────────────────────────────────────
const VoiceMessageBubble = ({ msg, isOwn, formatTime }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(msg.duration || 0);
  const waveform = useMemo(() => msg.waveform || Array.from({ length: 40 }, () => Math.floor(Math.random() * 15 + 5)), [msg.waveform]);

  const togglePlay = (e) => {
    e?.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => console.warn("Audio play blocked", err));
    }
    setIsPlaying(!isPlaying);
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current && !msg.duration) {
      setAudioDuration(audioRef.current.duration);
    }
  };

  const onEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const seek = (index, e) => {
    e.stopPropagation();
    if (!audioRef.current || !audioDuration) return;
    const seekTime = (index / waveform.length) * audioDuration;
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const formatSeconds = (secs) => {
    if (isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className={`voice-bubble ${isOwn ? 'own' : ''}`}>
      <audio
        ref={audioRef}
        src={msg.fileData || msg.text}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
        preload="metadata"
      />
      <button className="voice-play-btn" onClick={togglePlay} type="button">
        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: '2px' }} />}
      </button>

      <div className="voice-content">
        <div className="voice-waveform">
          {waveform.map((h, i) => {
            const progress = audioDuration > 0 ? (currentTime / audioDuration) * waveform.length : 0;
            const active = i <= progress;
            return (
              <div
                key={i}
                className={`w-bar ${active ? 'active' : ''}`}
                style={{ height: `${h}px` }}
                onClick={(e) => seek(i, e)}
              />
            );
          })}
        </div>
        <div className="voice-info">
          <span className="voice-duration">
            {isPlaying ? formatSeconds(currentTime) : formatSeconds(audioDuration)}
          </span>
        </div>
      </div>
    </div>
  );
};

// ── Call Status Card ──────────────────────────────────────────────────────
const CallStatusCard = ({ msg, isOwn, initiateCall, formatDate, formatTime, currentUser }) => {
  const isVideo = msg.callType === 'video';
  const isDeclined = msg.type === 'declined_call';
  const isCanceled = msg.text?.toLowerCase().includes('canceled');
  
  return (
    <div className={`compact-call-card ${isOwn ? 'own' : 'other'} ${isDeclined ? 'declined' : (isCanceled ? 'canceled' : 'missed')}`}>
      <div className="ccc-main">
        <div className="ccc-icon">
          {isDeclined ? <PhoneOff size={16} /> : (isCanceled ? <Slash size={16} /> : (isVideo ? <Video size={16} /> : <PhoneIncoming size={16} />))}
        </div>
        <div className="ccc-details">
          <div className="ccc-text">
            {isDeclined ? 'Declined' : (isCanceled ? 'Canceled' : 'Missed')} {isVideo ? 'Video' : 'Voice'}
          </div>
          <div className="ccc-time">{formatTime(msg.time)}</div>
        </div>
      </div>
      <button 
        className="ccc-callback-btn" 
        onClick={() => initiateCall({id: msg.senderId === currentUser.id ? msg.recipientId : msg.senderId, name: msg.senderName}, isVideo ? 'video' : 'audio')}
      >
        Call Back
      </button>
    </div>
  );
};

const GroupCallInterface = ({ activeCall, onLeave, currentUser }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(activeCall.type !== 'video');
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  return (
    <div className="group-call-overlay">
      <div className="gc-header">
        <div className="gc-info">
          <h3>Group Call - {activeCall.participants?.length || 0} participants</h3>
          <span className="gc-status">Live</span>
        </div>
        <button className="gc-minimize-btn"><Minimize2 size={20} /></button>
      </div>

      <div className={`gc-participants-grid ${activeCall.participants?.length > 4 ? 'compact' : ''}`}>
        {activeCall.participants?.map(p => (
          <div key={p.id} className="gc-participant-card">
            <div className="gc-avatar-xl">
              {initial(p.name)}
            </div>
            <div className="gc-p-info">
              <span className="gc-p-name">{p.name} {p.id === currentUser.id && '(You)'}</span>
              <div className="gc-p-status-icons">
                {!p.audio && <MicOff size={14} color="#ef4444" />}
                {!p.video && <VideoOff size={14} color="#ef4444" />}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="gc-controls">
        <button className={`gc-btn ${isMuted ? 'active' : ''}`} onClick={() => setIsMuted(!isMuted)}>
          {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
        </button>
        <button className={`gc-btn ${isVideoOff ? 'active' : ''}`} onClick={() => setIsVideoOff(!isVideoOff)}>
          {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
        </button>
        <button className={`gc-btn ${isScreenSharing ? 'active' : ''}`} onClick={() => setIsScreenSharing(!isScreenSharing)}>
          <ScreenShare size={24} />
        </button>
        <button className="gc-btn-end" onClick={onLeave}>
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  );
};

const ProfilePanel = ({
  contact, onClose, messages, currentUser, formatTime, formatDate, initiateCall,
  updateGroup, addMembersToGroup, removeMemberFromGroup, promoteMember, demoteAdmin,
  leaveGroup, deleteGroup, staff, customers, t, moderateGroupMember,
  startGroupCall, joinGroupCall, activeCall, callState, initialTab
}) => {
  const avatarColor = roleColor(contact.role);
  const isGroup = contact.type === 'group';
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(contact.name || '');
  const [editDesc, setEditDesc] = useState(contact.description || '');
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState([]);
  const [activeMemberMenu, setActiveMemberMenu] = useState(null);
  const [activeTab, setActiveTab] = useState(initialTab || 'overview');
  const [searchMember, setSearchMember] = useState('');
  const [addMemberSearch, setAddMemberSearch] = useState('');

  // Update tab when initialTab changes (e.g. from header menu click)
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Permission helpers
  const isOwner = isGroup && (String(contact.ownerId) === String(currentUser?.id) || String(contact.createdBy) === String(currentUser?.id));
  const isAdmin = isGroup && (contact.admins || []).includes(String(currentUser?.id));
  const canManage = isOwner || isAdmin;

  const handleSaveInfo = () => {
    updateGroup(contact.id, { name: editName, description: editDesc });
    setIsEditing(false);
  };

  const getMemberDetails = (id) => {
    const all = [...staff, ...customers];
    const found = all.find(u => String(u.id) === String(id));
    if (found) return found;
    if (String(id) === String(currentUser?.id)) return currentUser;
    return { name: `User ${id}`, id };
  };

  const getUserRoleTag = (id) => {
    if (String(contact.ownerId || contact.createdBy) === String(id)) return <span className="role-tag owner">Owner</span>;
    if ((contact.admins || []).includes(String(id))) return <span className="role-tag admin">Admin</span>;
    return <span className="role-tag member">Member</span>;
  };

  const filteredMembers = (contact.members || []).filter(mId => {
    const m = getMemberDetails(mId);
    return m.name?.toLowerCase().includes(searchMember.toLowerCase());
  });

  return (
    <div className="profile-panel" onClick={e => e.stopPropagation()}>
      <div className="profile-panel-header">
        <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        <span>{isGroup ? 'Group Management' : 'Profile'}</span>
        {canManage && isGroup && !isEditing && (
          <button className="icon-btn" onClick={() => setIsEditing(true)}>
            <Edit3 size={18} />
          </button>
        )}
      </div>

      {isGroup && (
        <div className="profile-tabs">
          <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>Overview</button>
          <button className={activeTab === 'members' ? 'active' : ''} onClick={() => setActiveTab('members')}>Members</button>
          {canManage && <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>Settings</button>}
          {canManage && <button className={activeTab === 'moderation' ? 'active' : ''} onClick={() => setActiveTab('moderation')}>Moderation</button>}
        </div>
      )}

      <div className="profile-scroll-content">
        {activeTab === 'overview' && (
          <>
            <div className="profile-cover-modern" style={{ background: `linear-gradient(135deg, ${avatarColor}44 0%, ${avatarColor}11 100%)` }}>
              <div className="profile-avatar-xl">
                {isGroup ? (
                  contact.image ? (
                    <img
                      src={contact.image}
                      alt=""
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.1)'
                      }}
                    />
                  ) : <Users size={48} color="white" />
                ) : contact.profilePic ? (
                  <img
                    src={contact.profilePic}
                    alt=""
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.1)'
                    }}
                  />
                ) : initial(contact.name)}

                {isEditing && isGroup && (
                  <div className="avatar-edit-overlay" onClick={() => document.getElementById('group-image-upload-panel').click()}>
                    <Camera size={24} />
                    <input id="group-image-upload-panel" type="file" accept="image/*" hidden onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = r => updateGroup(contact.id, { image: r.target.result });
                        reader.readAsDataURL(file);
                      }
                    }} />
                  </div>
                )}
              </div>
              <h2 className="profile-name-large">{contact.name}</h2>
              <p className="profile-sub">{isGroup ? `${contact.members?.length} members` : (contact.role || 'User')}</p>
            </div>

            <div className="profile-body-content">
              {isGroup ? (
                <div className="profile-info-section">
                  <div className="section-title">Description</div>
                  <div className="section-text">{contact.description || 'No description provided.'}</div>
                </div>
              ) : (
                <>
                  {contact.phone && (
                    <div className="info-item-modern">
                      <Phone size={18} />
                      <div className="info-texts">
                        <span className="label">Phone</span>
                        <span className="value">{contact.phone}</span>
                      </div>
                    </div>
                  )}
                  {contact.email && (
                    <div className="info-item-modern">
                      <MessageSquare size={18} />
                      <div className="info-texts">
                        <span className="label">Email</span>
                        <span className="value">{contact.email}</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="profile-quick-actions">
                {isGroup ? (
                  <>
                    <button className="qa-btn" onClick={() => startGroupCall(contact.id, 'video')}>
                      <Video size={18} /> Video Call
                    </button>
                    <button className="qa-btn" onClick={() => startGroupCall(contact.id, 'audio')}>
                      <Phone size={18} /> Voice Call
                    </button>
                  </>
                ) : (
                  <>
                    <button className="qa-btn" onClick={() => initiateCall(contact, 'video')}>
                      <Video size={18} /> Video
                    </button>
                    <button className="qa-btn" onClick={() => initiateCall(contact, 'audio')}>
                      <Phone size={18} /> Call
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'members' && isGroup && (
          <div className="members-tab-content">

            {/* Search + Add */}
            <div className="members-toolbar">
              <div className="members-search-bar">
                <Search size={15} className="msb-icon" />
                <input
                  placeholder="Search members..."
                  value={searchMember}
                  onChange={e => setSearchMember(e.target.value)}
                  className="msb-input"
                />
              </div>
              {canManage && (
                <button className="add-members-btn" onClick={() => setShowAddMembers(true)}>
                  <Users size={15} />
                  <span>Add</span>
                </button>
              )}
            </div>

            <div className="members-count-label">
              {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}
            </div>

            <div className="members-list-modern">
              {filteredMembers.map(mId => {
                const m = getMemberDetails(mId);
                const mIsAdmin = (contact.admins || []).includes(String(mId));
                const mIsOwner = String(contact.ownerId || contact.createdBy) === String(mId);
                const isYou = String(mId) === String(currentUser?.id);

                return (
                  <div key={mId} className="member-row">
                    <div className="mr-avatar" style={{ background: roleColor(m.role) }}>
                      {initial(m.name)}
                    </div>
                    <div className="mr-info">
                      <div className="mr-top">
                        <span className="mr-name">{m.name}{isYou ? ' (You)' : ''}</span>
                        {mIsOwner
                          ? <span className="badge-owner">Owner</span>
                          : mIsAdmin
                            ? <span className="badge-admin">Admin</span>
                            : <span className="badge-member">Member</span>
                        }
                      </div>
                      <span className="mr-sub">{m.role || 'Member'}</span>
                    </div>
                    {canManage && !isYou && !mIsOwner && (
                      <div className="mr-menu-wrap">
                        <button
                          className="mr-menu-btn"
                          onClick={() => setActiveMemberMenu(activeMemberMenu === mId ? null : mId)}
                        >
                          <MoreVertical size={16} />
                        </button>
                        {activeMemberMenu === mId && (
                          <div className="mr-dropdown" onClick={e => e.stopPropagation()}>
                            {mIsAdmin ? (
                              <button onClick={() => { demoteAdmin(contact.id, mId); setActiveMemberMenu(null); }}>
                                <ArrowLeft size={13} /> Demote
                              </button>
                            ) : (
                              <button onClick={() => { promoteMember(contact.id, mId); setActiveMemberMenu(null); }}>
                                <Shield size={13} /> Promote to Admin
                              </button>
                            )}
                            <button onClick={() => { moderateGroupMember(contact.id, mId, 'mute'); setActiveMemberMenu(null); }}>
                              <BellOff size={13} /> Mute
                            </button>
                            <button className="danger" onClick={() => { removeMemberFromGroup(contact.id, mId); setActiveMemberMenu(null); }}>
                              <Trash2 size={13} /> Remove
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'settings' && isGroup && (
          <div className="settings-tab-content">
            <div className="setting-group">
              <div className="sg-title">Privacy & Type</div>
              <div className="setting-row">
                <div className="setting-info">
                  <span className="s-label">Public Group</span>
                  <span className="s-desc">Anyone can find and join via link</span>
                </div>
                <input type="checkbox" checked={contact.settings?.isPublic} onChange={e => updateGroup(contact.id, { settings: { ...contact.settings, isPublic: e.target.checked } })} />
              </div>
              <div className="setting-row">
                <div className="setting-info">
                  <span className="s-label">Join Approval</span>
                  <span className="s-desc">Owner must approve new members</span>
                </div>
                <input type="checkbox" checked={contact.settings?.requireJoinApproval} onChange={e => updateGroup(contact.id, { settings: { ...contact.settings, requireJoinApproval: e.target.checked } })} />
              </div>
            </div>

            <div className="setting-group">
              <div className="sg-title">Content Controls</div>
              <div className="setting-row">
                <div className="setting-info">
                  <span className="s-label">Slow Mode</span>
                  <span className="s-desc">Delay between messages (seconds)</span>
                </div>
                <select value={contact.settings?.slowMode || 0} onChange={e => updateGroup(contact.id, { settings: { ...contact.settings, slowMode: parseInt(e.target.value) } })}>
                  <option value={0}>Off</option>
                  <option value={10}>10s</option>
                  <option value={30}>30s</option>
                  <option value={60}>1m</option>
                </select>
              </div>
              <div className="setting-row">
                <div className="setting-info">
                  <span className="s-label">Read-Only Mode</span>
                  <span className="s-desc">Only admins can post messages</span>
                </div>
                <input type="checkbox" checked={contact.settings?.readOnly} onChange={e => updateGroup(contact.id, { settings: { ...contact.settings, readOnly: e.target.checked } })} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'moderation' && isGroup && (
          <div className="moderation-tab-content">
            <div className="section-header">Restricted Users</div>
            <div className="restricted-list">
              {(contact.mutedUsers || []).map(id => (
                <div key={id} className="restricted-item">
                  <span>{getMemberDetails(id).name} (Muted)</span>
                  <button className="link-btn" onClick={() => moderateGroupMember(contact.id, id, 'unmute')}>Unmute</button>
                </div>
              ))}
              {(contact.bannedUsers || []).map(id => (
                <div key={id} className="restricted-item">
                  <span className="danger">{getMemberDetails(id).name} (Banned)</span>
                  <button className="link-btn" onClick={() => moderateGroupMember(contact.id, id, 'unban')}>Unban</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="profile-panel-footer">
        {isGroup ? (
          isOwner ? (
            <button className="footer-btn danger" onClick={() => { if (confirm('Delete Group?')) { deleteGroup(contact.id); onClose(); } }}>Delete Group</button>
          ) : (
            <button className="footer-btn danger" onClick={() => { if (confirm('Leave Group?')) { leaveGroup(contact.id); onClose(); } }}>Leave Group</button>
          )
        ) : (
          <button className="footer-btn danger" onClick={() => { if (confirm('Clear Chat?')) { clearMessages(contact.id); onClose(); } }}>Clear History</button>
        )}
      </div>

      {showAddMembers && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content-sm add-members-modal">
            <div className="ms-header">
              <div className="ms-header-top">
                <h3>Add Members</h3>
                <button className="ms-close-btn" onClick={() => setShowAddMembers(false)}><X size={20} /></button>
              </div>

              {/* Modal Search Bar */}
              <div className="ms-search-container">
                <Search size={16} className="ms-search-icon" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={addMemberSearch}
                  onChange={e => setAddMemberSearch(e.target.value)}
                  className="ms-search-input"
                />
              </div>
            </div>

            <div className="ms-body">
              {[...staff, ...customers]
                .filter(u => !contact.members?.includes(String(u.id)))
                .filter(u => u.name?.toLowerCase().includes(addMemberSearch.toLowerCase()))
                .map(u => (
                  <label key={u.id} className="ms-member-row">
                    <div className="ms-avatar" style={{ background: roleColor(u.role) }}>{initial(u.name)}</div>
                    <div className="ms-info">
                      <span className="ms-name">{u.name}</span>
                      <span className="ms-role">{u.role || 'Member'}</span>
                    </div>
                    <div className="ms-checkbox-wrap">
                      <input
                        type="checkbox"
                        checked={selectedToAdd.includes(String(u.id))}
                        onChange={e => setSelectedToAdd(prev => e.target.checked ? [...prev, String(u.id)] : prev.filter(id => id !== String(u.id)))}
                      />
                    </div>
                  </label>
                ))}
              {([...staff, ...customers].filter(u => !contact.members?.includes(String(u.id))).filter(u => u.name?.toLowerCase().includes(addMemberSearch.toLowerCase())).length === 0) && (
                <div className="ms-empty">No contacts found</div>
              )}
            </div>

            <div className="ms-footer">
              <button className="btn-secondary" onClick={() => setShowAddMembers(false)}>Cancel</button>
              <button
                className={`btn-primary ${selectedToAdd.length > 0 ? 'active' : 'disabled'}`}
                disabled={selectedToAdd.length === 0}
                onClick={() => { addMembersToGroup(contact.id, selectedToAdd); setShowAddMembers(false); setSelectedToAdd([]); }}
              >
                Add {selectedToAdd.length > 0 ? `(${selectedToAdd.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Media Fullscreen Viewer (Premium Image Lightbox) ─────────────────────
const MediaFullscreenViewer = ({ media, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  if (!media) return null;

  const handleZoomIn = (e) => { e.stopPropagation(); setZoom(prev => Math.min(prev + 0.5, 4)); };
  const handleZoomOut = (e) => { e.stopPropagation(); setZoom(prev => Math.max(prev - 0.5, 1)); };
  const resetZoom = (e) => { e.stopPropagation(); setZoom(1); setPosition({ x: 0, y: 0 }); };

  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="premium-lightbox" onClick={onClose} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div className="lightbox-backdrop-blur" />
      <div className="lightbox-controls-top">
        <div className="zoom-controls">
          <button className="lb-icon-btn" onClick={handleZoomIn} title="Zoom In"><Maximize size={20} /></button>
          <button className="lb-icon-btn" onClick={handleZoomOut} title="Zoom Out"><Clock size={20} style={{ transform: 'rotate(45deg)' }} /></button>
          <button className="lb-icon-btn" onClick={resetZoom} title="Reset">Actual Size</button>
        </div>
        <button className="lightbox-close-btn-minimal" onClick={onClose}>
          <X size={28} />
        </button>
      </div>

      <div
        className="lightbox-main-content"
        onClick={e => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <img
          src={media.url}
          alt={media.name || 'Fullscreen Media'}
          className="lightbox-img-premium"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0, 0.2, 1)'
          }}
          draggable="false"
        />

        <div className="lightbox-premium-footer">
          <div className="lightbox-meta">
            <span className="lb-filename">{media.name || 'Image'}</span>
          </div>
          <div className="lightbox-action-row">
            <a href={media.url} download={media.name || 'image.jpg'} className="lb-btn-action" onClick={e => e.stopPropagation()}>
              <Download size={20} />
              <span>Save to Device</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
const WaveformVisualizer = ({ analyser, isRecording }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!isRecording || !analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let animationId;
    const draw = () => {
      if (!isRecording) return;
      animationId = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      // Gradient for premium look
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#4361ee');
      gradient.addColorStop(1, '#f72585');

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / 40) - 1;
      let barHeight;
      let x = 0;

      // Draw middle-out visualizer
      for (let i = 0; i < 40; i++) {
        // Sample buffer for 40 bars
        const index = Math.floor((i / 40) * bufferLength);
        barHeight = (dataArray[index] / 255) * canvas.height;

        ctx.fillStyle = gradient;
        // Center the bar vertically
        const y = (canvas.height - barHeight) / 2;

        // Rounded rect draw
        const r = 2; // radius
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, r);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();

        x += barWidth + 1;
      }
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [isRecording, analyser]);

  return (
    <canvas
      ref={canvasRef}
      width={160}
      height={32}
      className="recording-canvas"
    />
  );
};

// ── Recording Overlay (Horizontal Telegram-style) ──────────────────────────
const RecordingOverlay = ({
  isRecording,
  isLocked,
  time,
  onCancel,
  onLock,
  analyser,
  onStop
}) => {
  const formatTime = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`recording-horizontal-overlay ${isRecording ? 'active' : ''}`}>
      <div className="rec-indicator-group">
        <div className="rec-dot-animated" />
        <span className="rec-timer">{formatTime(time)}</span>
      </div>

      <div className="rec-visualizer-container">
        <WaveformVisualizer analyser={analyser} isRecording={isRecording} />
      </div>

      {!isLocked && <span className="slide-to-cancel">Slide left to cancel</span>}

      <div className="rec-actions-group">
        <div className="rec-action-group-inner">
          <button className="rec-action-btn delete" onClick={onCancel} title="Delete">
            <Trash2 size={18} />
          </button>

          {!isLocked && (
            <div className="rec-lock-indicator-inline" onClick={onLock} title="Lock Recording">
              <Lock size={14} />
            </div>
          )}
        </div>

        <button className="rec-action-btn send-rec" onClick={() => onStop(true)} title="Send Voice Message">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

// ── Phone Confirm Modal ───────────────────────────────────────────────────────
const PhoneConfirmModal = ({ contact, onClose }) => {
  if (!contact) return null;
  const color = roleColor(contact.role);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="phone-confirm-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close-x" onClick={onClose}><X size={20} /></button>
        <div className="pcm-avatar" style={{ background: `linear-gradient(135deg, ${color}, ${color}88)` }}>
          {initial(contact.name)}
        </div>
        <h3>{contact.name}</h3>
        {contact.role && <span className="pcm-role" style={{ background: color }}>{contact.role}</span>}
        <p className="pcm-label">Phone Number</p>
        <div className="pcm-phone">{contact.phone || 'No phone number stored'}</div>
        {contact.phone ? (
          <a href={`tel:${contact.phone}`} className="pcm-dial-btn" onClick={onClose}>
            <Phone size={20} />
            Dial {contact.phone}
          </a>
        ) : (
          <div className="pcm-no-phone">No phone number available for this contact.</div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const Messaging = () => {
  const {
    staff, customers, messages, groups, sendMessage, markMessagesRead,
    setTypingSignal, typingStatus, userPresence, activeChatContact,
    setActiveChatContact, t, formatDate, formatTime, blockedUsers, blockUser,
    unblockUser, privacySettings, setPrivacySettings, deleteMessage, editMessage,
    reactToMessage, initiateCall, acceptCall, endCall, callState, activeCall,
    createGroup, updateGroup, addMembersToGroup, removeMemberFromGroup, promoteMember, demoteAdmin,
    leaveGroup, deleteGroup, pinMessage, unpinMessage, moderateGroupMember,
    startGroupCall, joinGroupCall, leaveGroupCall,
    isChatOpen, setIsChatOpen, clearMessages
  } = useAppContext();

  const { currentUser, getAccounts } = useAuth();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [messageInput, setMessageInput] = useState('');
  const [isMobileListOpen, setIsMobileListOpen] = useState(true);
  const [replyTo, setReplyTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeMenuMessage, setActiveMenuMessage] = useState(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [profilePanelTab, setProfilePanelTab] = useState('overview');
  const [showPhoneConfirm, setShowPhoneConfirm] = useState(false);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupImage, setGroupImage] = useState(null);
  const [fullScreenMedia, setFullScreenMedia] = useState(null); // { type, url, name }

  // ── Voice Recording State ──
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recorder, setRecorder] = useState(null);
  const [voicePreview, setVoicePreview] = useState(null); // { blob, url, waveform, duration }
  const [vData, setVData] = useState(Array.from({ length: 20 }, () => 5));
  const recInterval = useRef(null);
  const timerInterval = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const autoSendRef = useRef(false);
  const recordingTimeRef = useRef(0); // Use ref to avoid closure bugs with state
  const waveformDataRef = useRef([]);

  useEffect(() => {
    return () => {
      if (recInterval.current) clearInterval(recInterval.current);
      if (timerInterval.current) clearInterval(timerInterval.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const startRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm; codecs=opus')
        ? 'audio/webm; codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg; codecs=opus')
          ? 'audio/ogg; codecs=opus'
          : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      const chunks = [];

      // Setup Visualizer
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 64;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const duration = recordingTimeRef.current;

        // Prevent 0:00 or too-short recordings
        if (duration < 1 && !autoSendRef.current) {
          console.warn("Recording too short, discarding");
          cleanupRecording(stream);
          return;
        }

        const blob = new Blob(chunks, { type: chunks[0]?.type || mediaRecorder.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);

        // Finalize waveform from collected data
        let waveform = Array.from({ length: 40 }, () => Math.floor(Math.random() * 15 + 5));
        if (waveformDataRef.current.length > 0) {
          const bucketSize = Math.max(1, Math.floor(waveformDataRef.current.length / 40));
          waveform = [];
          for (let i = 0; i < waveformDataRef.current.length; i += bucketSize) {
            const bucket = waveformDataRef.current.slice(i, i + bucketSize);
            const avg = bucket.reduce((a, b) => a + b, 0) / bucket.length;
            waveform.push(Math.max(5, Math.min(25, Math.floor(avg / 4))));
          }
          // Ensure exactly 40 bars for consistent UI
          while (waveform.length < 40) waveform.push(5);
          waveform = waveform.slice(0, 40);
        }

        const preview = { blob, url, waveform, duration };

        if (autoSendRef.current && duration >= 1) {
          await sendVoiceMessage(preview);
        } else if (duration >= 1) {
          setVoicePreview(preview);
        }

        cleanupRecording(stream);
      };

      mediaRecorder.start(200); // Collect data every 200ms
      setRecorder(mediaRecorder);
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimeRef.current = 0;
      waveformDataRef.current = [];

      timerInterval.current = setInterval(() => {
        setRecordingTime(prev => {
          const next = prev + 1;
          recordingTimeRef.current = next;
          return next;
        });
      }, 1000);

      recInterval.current = setInterval(() => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const volume = Array.from(dataArray).reduce((a, b) => a + b, 0) / dataArray.length;
          waveformDataRef.current.push(volume);
        }
      }, 100);

    } catch (err) {
      console.error("Mic access denied", err);
      alert("Microphone access denied. Please check your browser permissions.");
    }
  };

  const cleanupRecording = (stream) => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => { });
    }
    setRecorder(null);
    setIsRecording(false);
    setIsLocked(false);
    autoSendRef.current = false;
    clearInterval(timerInterval.current);
    clearInterval(recInterval.current);
  };

  const stopRecording = (autoSend = false) => {
    if (recorder && recorder.state !== 'inactive') {
      autoSendRef.current = autoSend;
      recorder.stop();
    }
  };

  const cancelRecording = () => {
    if (recorder) {
      if (recorder.state !== 'inactive') recorder.stop();
      setRecorder(null);
      setIsRecording(false);
      setIsLocked(false);
      setVoicePreview(null);
      clearInterval(timerInterval.current);
      clearInterval(recInterval.current);
    }
  };

  const sendVoiceMessage = async (previewOverride = null) => {
    const preview = previewOverride || voicePreview;
    if (!preview || !activeChatContact) return;

    if (preview.blob.size < 100) {
      alert("Recording was too short or silent. Please try again.");
      if (!previewOverride) setVoicePreview(null);
      return;
    }

    const msgId = 'msg_' + Date.now();
    setIsUploading(true);

    try {
      const reader = new FileReader();
      const fileData = await new Promise((resolve) => {
        reader.onload = e => resolve(e.target.result);
        reader.readAsDataURL(preview.blob);
      });

      await sendMessage(
        activeChatContact.id,
        fileData,
        'audio',
        'voice_message.ogg',
        replyTo?.id,
        msgId,
        null,
        'sent',
        { waveform: preview.waveform, duration: preview.duration }
      );

      if (!previewOverride) setVoicePreview(null);
      setIsUploading(false);
    } catch (err) {
      console.error("Voice upload failed", err);
      setIsUploading(false);
    }
  };

  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const groupImageInputRef = useRef(null);
  const messageRefs = useRef({});

  // ── Contacts ─────────────────────────────────────────────────────────────
  const allContacts = useMemo(() => {
    // 1. All registered accounts for this garage (admin, manager, mechanic, etc.)
    const accounts = (getAccounts() || []);
    const sameGarageAccounts = accounts
      .filter(a => a.ownerId === currentUser?.ownerId && a.id !== currentUser?.id && a.role !== 'coder')
      .map(a => ({
        id: a.id,
        name: a.name || a.username || a.email,
        role: a.role,
        phone: a.phone,
        email: a.email,
        profilePic: a.profilePic,
        type: a.role === 'customer' ? 'customer' : 'staff'
      }));

    // 2. Customers (from AppContext state — includes customers added via the app)
    const customerList = (customers || []).map(c => ({ ...c, type: 'customer' }));

    // 3. Groups
    const groupList = (groups || []).map(g => ({ ...g, type: 'group' }));

    // 4. Merge: prefer accounts data over staff state (accounts are authoritative for auth users)
    const accountIds = new Set(sameGarageAccounts.map(a => String(a.id)));
    const staffFallback = (staff || [])
      .filter(s => !accountIds.has(String(s.id)) && String(s.id) !== String(currentUser?.id))
      .map(s => ({ ...s, type: 'staff' }));

    const customerIds = new Set([...sameGarageAccounts, ...staffFallback].map(a => String(a.id)));
    const extraCustomers = customerList.filter(c => !customerIds.has(String(c.id)));

    const merged = [...groupList, ...sameGarageAccounts, ...staffFallback, ...extraCustomers];

    // 5. Sort by recency (last message time)
    return merged.map(c => {
      const lastMsg = messages.filter(m =>
        c.type === 'group'
          ? m.recipientId === c.id
          : (m.senderId === currentUser?.id && m.recipientId === c.id) || (m.senderId === c.id && m.recipientId === currentUser?.id)
      ).sort((a, b) => new Date(b.time) - new Date(a.time))[0];

      return { ...c, lastMessageTime: lastMsg ? new Date(lastMsg.time).getTime() : 0 };
    }).sort((a, b) => {
      if (b.lastMessageTime !== a.lastMessageTime) return b.lastMessageTime - a.lastMessageTime;
      return (a.name || '').localeCompare(b.name || '');
    }).filter(c =>
      (String(c.name || c.username || '')).toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [staff, customers, groups, currentUser?.id, currentUser?.ownerId, searchTerm, getAccounts, messages]);

  const filteredContacts = useMemo(() => {
    if (roleFilter === 'all') return allContacts;
    if (roleFilter === 'group') return allContacts.filter(c => c.type === 'group');
    if (roleFilter === 'admin') return allContacts.filter(c => c.role === 'admin' || c.role === 'manager' || c.role === 'coder');
    if (roleFilter === 'staff') return allContacts.filter(c => c.type === 'staff' && c.role !== 'admin' && c.role !== 'manager' && c.role !== 'coder');
    if (roleFilter === 'customer') return allContacts.filter(c => c.type === 'customer');
    return allContacts;
  }, [allContacts, roleFilter]);

  const activeMessages = useMemo(() => {
    if (!activeChatContact) return [];
    if (activeChatContact.type === 'group') {
      return messages.filter(m => m.recipientId === activeChatContact.id);
    }
    return messages.filter(m =>
      (m.senderId === currentUser?.id && m.recipientId === activeChatContact.id) ||
      (m.senderId === activeChatContact.id && m.recipientId === currentUser?.id)
    );
  }, [messages, activeChatContact, currentUser?.id]);

  useEffect(() => {
    setIsChatOpen(true);
    return () => setIsChatOpen(false);
  }, [setIsChatOpen]);

  useEffect(() => {
    if (activeChatContact) {
      markMessagesRead(activeChatContact.id);
    }
  }, [activeChatContact, messages.length, markMessagesRead]);

  useEffect(() => {
    if (activeChatContact && scrollRef.current) {
      const scrollContainer = scrollRef.current;
      // Instant scroll
      scrollContainer.scrollTop = scrollContainer.scrollHeight;

      // Secondary checks to handle dynamic content like images loading
      const timer = setTimeout(() => {
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }, 50);

      const heavyTimer = setTimeout(() => {
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }, 250);

      return () => {
        clearTimeout(timer);
        clearTimeout(heavyTimer);
      };
    }
  }, [activeChatContact?.id, activeMessages.length]);

  const getUnreadCount = (contactId) =>
    messages.filter(m => m.senderId === String(contactId) && m.recipientId === currentUser?.id && !m.read).length;

  const getLastMessage = (contactId) => {
    const ms = messages.filter(m =>
      (m.senderId === currentUser?.id && m.recipientId === String(contactId)) ||
      (m.senderId === String(contactId) && m.recipientId === currentUser?.id)
    );
    return ms[ms.length - 1];
  };

  const lastMsgPreview = (msg) => {
    if (!msg) return 'No messages yet';
    if (msg.type === 'image') return '📷 Photo';
    if (msg.type === 'video') return '🎬 Video';
    if (msg.type === 'file') return `📎 ${msg.fileName || 'File'}`;
    if (msg.type === 'audio') return '🎤 Voice Message';
    return msg.text?.substring(0, 40) || '';
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeChatContact) return;
    sendMessage(activeChatContact.id, messageInput, 'text', null, replyTo?.id);
    setMessageInput('');
    setReplyTo(null);
    setTypingSignal(activeChatContact.id, false);
  };

  const [uploadProgress, setUploadProgress] = useState({}); // msgId -> progress
  const [failedUploads, setFailedUploads] = useState([]); // Array of msgIds

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeChatContact) return;

    const msgId = 'msg_' + Date.now() + Math.random().toString(36).substr(2, 5);
    setIsUploading(true);
    setUploadProgress(prev => ({ ...prev, [msgId]: 0 }));

    let type = 'file';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';
    else if (file.type.startsWith('audio/')) type = 'audio';

    try {
      const reader = new FileReader();

      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(prev => ({ ...prev, [msgId]: progress }));
        }
      };

      const fileData = await new Promise((resolve, reject) => {
        reader.onload = (ev) => resolve(ev.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      let thumbnail = null;
      if (type === 'video') {
        thumbnail = await generateVideoThumbnail(file);
      }

      // Single sendMessage call — sendMessage saves to IndexedDB and broadcasts to all tabs
      await sendMessage(activeChatContact.id, fileData, type, file.name, replyTo?.id, msgId, thumbnail, 'sent');

      setIsUploading(false);
      setReplyTo(null);
      setUploadProgress(prev => { const n = { ...prev }; delete n[msgId]; return n; });
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (err) {
      console.error("Upload failed", err);
      setIsUploading(false);
      setFailedUploads(prev => [...prev, msgId]);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'failed' } : m));
      alert("Failed to read file. Please try again.");
    }
  };

  const handleRetryUpload = (msgId) => {
    // In a real app we'd need the file object again, but for this simulation we'll just re-trigger
    alert("Please re-select the file to retry.");
    setFailedUploads(prev => prev.filter(id => id !== msgId));
    setMessages(prev => prev.filter(id => id !== msgId));
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const scrollToMessage = (msgId) => {
    const el = messageRefs.current[msgId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-flash');
      setTimeout(() => el.classList.remove('highlight-flash'), 2000);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) handleSend(e);
  };

  const handleInputChange = (e) => {
    setMessageInput(e.target.value);
    if (activeChatContact && activeChatContact.type !== 'group')
      setTypingSignal(activeChatContact.id, e.target.value.length > 0);
  };

  const addEmoji = (emoji) => {
    setMessageInput(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const EMOJIS = ['😀', '😂', '😍', '🥰', '😎', '🤔', '👍', '❤️', '🔥', '🎉', '😢', '🙏'];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`messaging-container ${isRecording ? 'is-recording' : ''}`} onClick={() => { setActiveMenuMessage(null); setShowChatMenu(false); setShowEmojiPicker(false); }}>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <div className={`messaging-sidebar ${activeChatContact ? 'mobile-hidden' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-title-row">
            <h2>Chats</h2>
          </div>
          <div className="search-wrapper">
            <input type="text" placeholder="Search conversations..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>


        <div className="role-filters">
          {[['all', 'All'], ['group', 'Groups'], ['admin', 'Admin / Manager'], ['staff', 'Staff'], ['customer', 'Client']].map(([v, l]) => (
            <button key={v} className={roleFilter === v ? 'active' : ''} onClick={() => setRoleFilter(v)}>{l}</button>
          ))}
          <button className="create-group-chip" onClick={() => setShowGroupModal(true)}>
            <Users size={16} />
            <span>New Group</span>
          </button>
        </div>

        <div className="contacts-list">
          {filteredContacts.length === 0 ? (
            <div className="empty-contacts">
              <MessageSquare size={32} />
              <p>No conversations found</p>
            </div>
          ) : filteredContacts.map(contact => {
            const lastMsg = getLastMessage(contact.id);
            const unread = getUnreadCount(contact.id);
            const isTyping = typingStatus[contact.id]?.isTyping;
            const online = userPresence[contact.id]?.online;
            const color = roleColor(contact.role);

            return (
              <div
                key={contact.id}
                className={`contact-item ${activeChatContact?.id === contact.id ? 'active' : ''} ${unread > 0 ? 'has-unread' : ''} ${blockedUsers.includes(String(contact.id)) ? 'contact-blocked' : ''}`}
                onClick={() => { setActiveChatContact(contact); setIsMobileListOpen(false); setShowProfilePanel(false); }}
              >
                <div className="contact-avatar-wrapper" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${contact.id}`); }}>
                  <div className="contact-avatar" style={{ background: (contact.type === 'group' ? contact.image : contact.profilePic) ? 'none' : `linear-gradient(135deg, ${color}, ${color}88)` }}>
                    {contact.type === 'group' ? (
                      contact.image ? (
                        <img src={contact.image} alt="" className="avatar-img-small" />
                      ) : <Users size={20} color="white" />
                    ) : contact.profilePic ? (
                      <img src={contact.profilePic} alt="" className="avatar-img-small" />
                    ) : (
                      <span style={{ color: 'white' }}>{initial(contact.name)}</span>
                    )}
                  </div>
                  {online && !blockedUsers.includes(String(contact.id)) && <div className="online-dot" />}
                  {blockedUsers.includes(String(contact.id)) && <div className="blocked-mini-dot"><Shield size={8} /></div>}
                </div>
                <div className="contact-info">
                  <div className="contact-name-row">
                    <span className="contact-name">{contact.name || contact.username}</span>
                    {lastMsg && <span className="last-time">{formatTime(lastMsg.time)}</span>}
                  </div>
                  <div className="contact-message-row">
                    <span className={`last-message ${isTyping ? 'typing' : ''}`}>
                      {blockedUsers.includes(String(contact.id))
                        ? <span style={{ color: '#ef4444' }}>🚫 Blocked</span>
                        : isTyping ? '✍️ typing...' : lastMsgPreview(lastMsg)
                      }
                    </span>
                    {unread > 0 && !blockedUsers.includes(String(contact.id)) && <span className="unread-badge">{unread}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main Chat ───────────────────────────────────────────── */}
      <div className={`messaging-main ${!activeChatContact ? 'no-chat' : ''}`}>
        {activeChatContact ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <button className="back-btn icon-btn" onClick={() => { setActiveChatContact(null); setShowProfilePanel(false); }}>
                <ArrowLeft size={22} />
              </button>
              <div className="chat-contact-info" onClick={() => navigate(`/profile/${activeChatContact.id}`)} style={{ cursor: 'pointer' }}>
                <div className="compact-avatar" style={{ background: (activeChatContact.type === 'group' ? activeChatContact.image : activeChatContact.profilePic) ? 'none' : `linear-gradient(135deg, ${roleColor(activeChatContact.role)}, ${roleColor(activeChatContact.role)}88)` }}>
                  {activeChatContact.type === 'group' ? (
                    activeChatContact.image ? (
                      <img src={activeChatContact.image} alt="" className="avatar-img-small" />
                    ) : <Users size={16} color="white" />
                  ) : activeChatContact.profilePic ? (
                    <img src={activeChatContact.profilePic} alt="" className="avatar-img-small" />
                  ) : (
                    <span style={{ color: 'white' }}>{initial(activeChatContact.name)}</span>
                  )}
                </div>
                <div>
                  <div className="chat-name">{activeChatContact.name || activeChatContact.username}</div>
                  <div className="chat-status">
                    {activeChatContact.type === 'group'
                      ? `${activeChatContact.members?.length || 0} members`
                      : blockedUsers.includes(String(activeChatContact.id))
                        ? <span style={{ color: '#ef4444', fontWeight: 'bold' }}>🚫 Blocked</span>
                        : typingStatus[activeChatContact.id]?.isTyping
                          ? '✍️ typing...'
                          : userPresence[activeChatContact.id]?.online
                            ? '🟢 online'
                            : 'last seen recently'
                    }
                  </div>
                </div>
              </div>
              <div className="header-actions">
                {activeChatContact.type !== 'group' ? (
                  <>
                    <button className="icon-btn" onClick={() => setShowPhoneConfirm(true)} title="Phone Call">
                      <Phone size={20} />
                    </button>
                    <button className="icon-btn" onClick={() => initiateCall(activeChatContact, 'voice')} title="Voice Call">
                      <Mic size={20} />
                    </button>
                    <button className="icon-btn" onClick={() => initiateCall(activeChatContact, 'video')} title="Video Call">
                      <Video size={20} />
                    </button>
                  </>
                ) : (
                  <>
                    <button className="icon-btn" onClick={() => startGroupCall(activeChatContact.id, 'audio')} title="Start Audio Call">
                      <Phone size={20} />
                    </button>
                    <button className="icon-btn" onClick={() => startGroupCall(activeChatContact.id, 'video')} title="Start Video Call">
                      <Video size={20} />
                    </button>
                  </>
                )}
                <div className="menu-container" onClick={e => e.stopPropagation()}>
                  <button className="icon-btn" onClick={() => setShowChatMenu(!showChatMenu)}>
                    <MoreVertical size={20} />
                  </button>
                  {showChatMenu && (
                    <div className="dropdown-menu header-menu">
                      {activeChatContact.type === 'group' ? (
                        /* ── Group dropdown ── */
                        <>
                          <button onClick={() => { setProfilePanelTab('overview'); setShowProfilePanel(true); setShowChatMenu(false); }}>
                            <Users size={14} /> Manage Group
                          </button>
                          <button onClick={() => { setProfilePanelTab('members'); setShowProfilePanel(true); setShowChatMenu(false); }}>
                            <UserPlus size={14} /> Add Members
                          </button>
                          <button onClick={() => { setShowChatMenu(false); startGroupCall(activeChatContact.id, 'audio'); }}>
                            <Phone size={14} /> Voice Call
                          </button>
                          <button onClick={() => { setShowChatMenu(false); startGroupCall(activeChatContact.id, 'video'); }}>
                            <Video size={14} /> Video Call
                          </button>
                          <button className="danger" onClick={() => { if (confirm('Clear chat history?')) { clearMessages(activeChatContact.id); setShowChatMenu(false); } }}>
                            <Trash2 size={14} /> Clear Chat
                          </button>
                          <button className="danger" onClick={() => { if (confirm('Leave this group?')) { leaveGroup(activeChatContact.id); setActiveChatContact(null); setShowChatMenu(false); } }}>
                            <ArrowLeft size={14} /> Leave Group
                          </button>
                        </>
                      ) : (
                        /* ── DM dropdown ── */
                        <>
                          <button onClick={() => { setShowProfilePanel(true); setShowChatMenu(false); }}>
                            <Eye size={14} /> View Profile
                          </button>
                          <button onClick={() => {
                            if (blockedUsers.includes(String(activeChatContact.id))) unblockUser(activeChatContact.id);
                            else blockUser(activeChatContact.id);
                            setShowChatMenu(false);
                          }}>
                            <Shield size={14} /> {blockedUsers.includes(String(activeChatContact.id)) ? 'Unblock Contact' : 'Block Contact'}
                          </button>
                          <button onClick={() => { setShowPrivacyModal(true); setShowChatMenu(false); }}>
                            <Lock size={14} /> Privacy Settings
                          </button>
                          <button className="danger" onClick={() => { if (confirm('Clear chat history?')) { clearMessages(activeChatContact.id); setShowChatMenu(false); } }}>
                            <Trash2 size={14} /> Clear Chat
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Banners Area */}
            <div className="chat-banners">
              {/* Group Call Banner */}
              {activeChatContact.activeCall && (
                <div className="call-join-banner" onClick={() => joinGroupCall(activeChatContact.id)}>
                  <div className="cjb-icon"><Video size={16} color="white" /></div>
                  <div className="cjb-info">
                    <span className="cjb-title">Active Group Call</span>
                    <span className="cjb-sub">{activeChatContact.activeCall.participants?.length || 0} participants</span>
                  </div>
                  <button className="join-btn-pill">Join</button>
                </div>
              )}

              {/* Pinned Message Banner */}
              {activeChatContact.pins?.length > 0 && (
                <div className="pinned-banner" onClick={() => scrollToMessage(activeChatContact.pins[activeChatContact.pins.length - 1])}>
                  <Pin size={14} className="pin-icon-animated" />
                  <div className="pinned-info">
                    <span className="pinned-label">Pinned Message</span>
                    <span className="pinned-text">
                      {messages.find(m => m.id === activeChatContact.pins[activeChatContact.pins.length - 1])?.text || 'Media'}
                    </span>
                  </div>
                  <button className="pin-close-icon" onClick={(e) => { e.stopPropagation(); unpinMessage(activeChatContact.id, activeChatContact.pins[activeChatContact.pins.length - 1]); }}>
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Messages */}
            {activeChatContact.type === 'group' && <GroupCallBanner groupId={activeChatContact.id} />}
            <div className="chat-messages" ref={scrollRef}>
              <div className="messages-inner">
                {activeMessages.length === 0 ? (
                  <div className="chat-welcome">
                    <div className="welcome-icon">
                      <Lock size={28} />
                    </div>
                    <h3>Start messaging with {activeChatContact.name}</h3>
                    <p>Messages are end-to-end encrypted</p>
                  </div>
                ) : activeMessages.map((msg, idx) => {
                  const isOwn = msg.senderId === currentUser?.id;
                  const prevMsg = activeMessages[idx - 1];
                  const showDate = !prevMsg || new Date(msg.time).toDateString() !== new Date(prevMsg.time).toDateString();
                  const isGroup = activeChatContact.type === 'group';

                  return (
                    <React.Fragment key={msg.id}>
                      {showDate && (
                        <div className="date-separator">
                          <span>{formatDate(msg.time)}</span>
                        </div>
                      )}

                      {isGroup && !isOwn && (
                        <div className="message-avatar-container" onClick={() => navigate(`/profile/${msg.senderId}`)}>
                          {(() => {
                            const sender = [...allContacts, currentUser].find(c => String(c.id) === String(msg.senderId));
                            return sender?.profilePic ? (
                              <img src={sender.profilePic} alt="" className="msg-avatar-img" />
                            ) : (
                              <div className="msg-avatar-placeholder" style={{ background: roleColor(sender?.role || 'member') }}>
                                {initial(sender?.name)}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      <div className={`message-row ${isOwn ? 'own' : 'other'}`}>
                        <div className="message-bubble-wrapper" ref={el => messageRefs.current[msg.id] = el}>
                          <div
                            className={`message-bubble ${((msg.type === 'image' || msg.type === 'video') || (msg.type === 'text' && msg.text && (msg.text.match(/\.(jpeg|jpg|gif|png|webp|bmp)$|^data:image\//i) || msg.text.includes('image-medium.jpeg')))) ? 'media-bubble' : ''} ${isOwn ? 'own' : 'other'}`}
                            onContextMenu={(e) => { e.preventDefault(); setActiveMenuMessage(msg.id); scrollToMessage(msg.id); }}
                          >
                            {isGroup && !isOwn && (
                              <div
                                className="msg-sender-inside"
                                style={{
                                  color: roleColor([...staff, ...customers].find(u => String(u.id) === String(msg.senderId))?.role),
                                  fontWeight: '700',
                                  fontSize: '0.8rem',
                                  marginBottom: '3px',
                                  cursor: 'pointer'
                                }}
                                onClick={() => navigate(`/profile/${msg.senderId}`)}
                              >
                                {msg.senderName}
                              </div>
                            )}
                            {/* Reply Preview */}
                            {msg.replyTo && (
                              <div className="reply-preview" onClick={() => scrollToMessage(msg.replyTo)}>
                                <div className="reply-bar" />
                                <div className="reply-content">
                                  <strong>{messages.find(m => m.id === msg.replyTo)?.senderName || 'Original'}</strong>
                                  <p>{messages.find(m => m.id === msg.replyTo)?.text || 'Message deleted'}</p>
                                </div>
                              </div>
                            )}

                            {/* Media / Text */}
                            {msg.type === 'image' ? (
                              <div className="msg-media image-container no-hover-effect">
                                <img
                                  src={msg.fileData || msg.text}
                                  alt={msg.fileName || 'Image'}
                                  onClick={() => setFullScreenMedia({ type: 'image', url: msg.fileData || msg.text, name: msg.fileName })}
                                  onLoad={() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }}
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'https://via.placeholder.com/200x150?text=Image+Load+Failed';
                                  }}
                                  style={{
                                    opacity: (msg.status === 'uploading' || msg.status === 'processing') ? 0.6 : 1,
                                    cursor: 'pointer'
                                  }}
                                />
                                {msg.text && msg.fileData?.startsWith?.('data:') === false && (
                                  <div className="msg-caption">{msg.text}</div>
                                )}
                                {(msg.status === 'uploading' || msg.status === 'processing') && (
                                  <div className="media-upload-overlay">
                                    <div className="upload-spinner" />
                                    <span className="status-label">
                                      {msg.status === 'uploading' ? `Uploading ${uploadProgress[msg.id] || 0}%` : 'Processing...'}
                                    </span>
                                  </div>
                                )}
                                {msg.status === 'failed' && (
                                  <div className="media-upload-overlay failed">
                                    <X size={20} color="#ef4444" />
                                    <span>Failed</span>
                                    <button className="retry-btn" onClick={() => handleRetryUpload(msg.id)}>Retry</button>
                                  </div>
                                )}
                              </div>
                            ) : msg.type === 'video' ? (
                              <div className="msg-media video-container">
                                <video controls poster={msg.thumbnail} style={{ opacity: (msg.status === 'uploading' || msg.status === 'processing') ? 0.3 : 1 }}>
                                  <source src={msg.fileData || msg.text} />
                                  Your browser does not support video.
                                </video>
                                {(msg.status === 'uploading' || msg.status === 'processing') && (
                                  <div className="media-upload-overlay">
                                    <div className="upload-spinner" />
                                    <span className="status-label">
                                      {msg.status === 'uploading' ? `Uploading ${uploadProgress[msg.id] || 0}%` : 'Processing...'}
                                    </span>
                                  </div>
                                )}
                                {msg.status === 'failed' && (
                                  <div className="media-upload-overlay failed">
                                    <X size={20} color="#ef4444" />
                                    <span>Failed</span>
                                    <button className="retry-btn" onClick={() => handleRetryUpload(msg.id)}>Retry</button>
                                  </div>
                                )}
                              </div>
                            ) : msg.type === 'file' ? (
                              <div className="msg-media file-attachment">
                                <div className="file-info">
                                  <div className="file-icon-wrap">
                                    {(msg.status === 'uploading' || msg.status === 'processing') ? <Clock size={20} className="spin" /> :
                                      msg.status === 'failed' ? <X size={20} color="#ef4444" /> : <FileText size={20} />}
                                  </div>
                                  <div>
                                    <div className="file-name">{msg.fileName || 'Attachment'}</div>
                                    <div className="file-sub">
                                      {msg.status === 'uploading' ? `Uploading ${uploadProgress[msg.id] || 0}%` :
                                        msg.status === 'processing' ? 'Processing...' :
                                          msg.status === 'failed' ? 'Upload failed' : 'Tap to download'}
                                    </div>
                                  </div>
                                </div>
                                {msg.status === 'failed' && <button className="retry-btn small" onClick={() => handleRetryUpload(msg.id)}>Retry</button>}
                                {msg.status !== 'uploading' && msg.status !== 'processing' && msg.status !== 'failed' && (
                                  <a href={msg.fileData || msg.text} download={msg.fileName} className="file-download-btn" onClick={e => e.stopPropagation()}>
                                    <Download size={18} />
                                  </a>
                                )}
                              </div>
                            ) : (msg.type === 'voice' || msg.type === 'audio') ? (
                              <VoiceMessageBubble msg={msg} isOwn={isOwn} formatTime={formatTime} />
                            ) : (msg.type === 'missed_call' || msg.type === 'declined_call') ? (
                              <CallStatusCard 
                                msg={msg} 
                                isOwn={isOwn} 
                                currentUser={currentUser}
                                initiateCall={(dummy, type) => {
                                  // Back-reference: identify who we are calling back
                                  const sid = msg.senderId;
                                  const targetId = String(sid) === String(currentUser.id) ? msg.recipientId : sid;
                                  const contact = allContacts.find(c => String(c.id) === String(targetId));
                                  if (contact) initiateCall(contact, type);
                                  else if (activeChatContact && String(activeChatContact.id) === String(targetId)) initiateCall(activeChatContact, type);
                                }}
                                formatDate={formatDate}
                                formatTime={formatTime}
                              />
                            ) : (
                              (() => {
                                // Simple image detection for text messages
                                const isImageUrl = msg.text && (msg.text.match(/\.(jpeg|jpg|gif|png|webp|bmp)$|^data:image\//i) || msg.text.includes('image-medium.jpeg'));
                                if (isImageUrl && msg.type === 'text') {
                                  return (
                                    <div className="msg-media image-container no-hover-effect">
                                      <img
                                        src={msg.text}
                                        alt="Image"
                                        onClick={() => setFullScreenMedia({ type: 'image', url: msg.text, name: 'Image' })}
                                        onLoad={() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }}
                                        style={{ cursor: 'pointer' }}
                                      />
                                    </div>
                                  );
                                }
                                return <div className="msg-text">{msg.text}</div>;
                              })()
                            )}

                            {/* Reactions */}
                            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                              <div className="msg-reactions">
                                {(() => {
                                  const grouped = {};
                                  Object.values(msg.reactions).forEach(emoji => {
                                    grouped[emoji] = (grouped[emoji] || 0) + 1;
                                  });
                                  return Object.entries(grouped).map(([emoji, count]) => (
                                    <span key={emoji} className="reaction-badge">
                                      {emoji}
                                      {count > 1 && <span className="r-count">{count}</span>}
                                    </span>
                                  ));
                                })()}
                              </div>
                            )}

                            {/* Meta */}
                            <div className="msg-meta">
                              <span className="msg-time">{formatTime(msg.time)}</span>
                              {isOwn && (
                                <span className="msg-status-icon">
                                  {msg.status === 'seen' ? <CheckCheck size={14} className="status-seen" /> :
                                    msg.status === 'delivered' ? <CheckCheck size={14} className="status-delivered" /> :
                                      msg.status === 'sent' ? <Check size={14} /> :
                                        <Clock size={12} />}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Context Menu Trigger */}
                          <button
                            className="msg-menu-trigger icon-btn"
                            onClick={e => { e.stopPropagation(); setActiveMenuMessage(activeMenuMessage === msg.id ? null : msg.id); }}
                          >
                            <MoreVertical size={14} />
                          </button>

                          {/* Dropdown */}
                          {activeMenuMessage === msg.id && (
                            <div
                              className={`dropdown-menu message-menu ${messageRefs.current[msg.id]?.getBoundingClientRect().bottom > window.innerHeight * 0.7 ? 'up' : 'down'
                                }`}
                              onClick={e => e.stopPropagation()}
                            >
                              <div className="reaction-picker">
                                {['👍', '❤️', '😂', '🔥', '😢', '🙏'].map(emoji => (
                                  <button key={emoji} onClick={() => { reactToMessage(msg.id, emoji); setActiveMenuMessage(null); }}>{emoji}</button>
                                ))}
                              </div>
                              <hr />
                              <button onClick={() => { setReplyTo(msg); setActiveMenuMessage(null); }}><Reply size={14} /> Reply</button>
                              <button onClick={() => { navigator.clipboard.writeText(msg.text || ''); setActiveMenuMessage(null); }}><FileText size={14} /> Copy</button>
                              {isOwn && <button onClick={() => setActiveMenuMessage(null)}><Pin size={14} /> Pin</button>}
                              <button className="danger" onClick={() => { deleteMessage(msg.id); setActiveMenuMessage(null); }}><Trash2 size={14} /> Delete</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Reply Banner */}
            {replyTo && (
              <div className="reply-context">
                <div className="reply-context-bar" />
                <div className="reply-context-info">
                  <Reply size={14} />
                  <div>
                    <strong>{replyTo.senderName}</strong>
                    <p>{replyTo.type !== 'text' ? `📎 ${replyTo.fileName || replyTo.type}` : replyTo.text}</p>
                  </div>
                </div>
                <button className="icon-btn close-reply" onClick={() => setReplyTo(null)}><X size={18} /></button>
              </div>
            )}

            {/* Input */}
            <form className="chat-input-area" onSubmit={handleSend} onClick={e => e.stopPropagation()}>
              {isRecording ? (
                <RecordingOverlay
                  isRecording={isRecording}
                  isLocked={isLocked}
                  time={recordingTime}
                  onCancel={cancelRecording}
                  onLock={() => setIsLocked(true)}
                  analyser={analyserRef.current}
                  onStop={stopRecording}
                />
              ) : voicePreview ? (
                <div className="voice-preview-container">
                  <VoiceMessageBubble
                    msg={{
                      fileData: voicePreview.url,
                      time: Date.now(),
                      duration: voicePreview.duration,
                      waveform: voicePreview.waveform,
                      type: 'audio'
                    }}
                    isOwn={true}
                    formatTime={formatTime}
                  />
                  <button type="button" className="icon-btn" onClick={() => setVoicePreview(null)}><Trash2 size={20} color="#ef4444" /></button>
                  <button type="button" className="icon-btn success" onClick={sendVoiceMessage} style={{ background: 'var(--primary)', color: 'white', borderRadius: '12px', width: '40px', height: '40px' }}>
                    <Send size={20} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="emoji-container">
                    <button type="button" className="icon-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                      <Smile size={22} />
                    </button>
                    {showEmojiPicker && (
                      <div className="emoji-picker">
                        {EMOJIS.map(e => <button key={e} type="button" onClick={() => addEmoji(e)}>{e}</button>)}
                      </div>
                    )}
                  </div>
                  <div className="input-wrapper">
                    <textarea
                      placeholder="Message..."
                      value={messageInput}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      rows="1"
                    />
                  </div>
                  <button type="button" className="icon-btn attach-btn" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                    {isUploading ? <Clock size={22} className="spin" /> : <Paperclip size={22} />}
                  </button>
                  <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />

                  {messageInput.trim() ? (
                    <button type="submit" className="send-btn active">
                      <Send size={20} />
                    </button>
                  ) : (
                    <button type="button" className="icon-btn mic-btn" onClick={startRecording}>
                      <Mic size={22} color="var(--primary)" />
                    </button>
                  )}
                </>
              )}
            </form>
          </>
        ) : (
          <div className="no-chat-selected">
            <div className="ncs-logo">
              <div className="ncs-rings">
                <div className="ncs-ring r1" />
                <div className="ncs-ring r2" />
                <div className="ncs-ring r3" />
              </div>
              <MessageSquare size={48} />
            </div>
            <h2>MechPro Messenger</h2>
            <p>Select a conversation to start messaging your team</p>
            <div className="ncs-badges">
              <span><Lock size={12} /> Encrypted</span>
              <span><Shield size={12} /> Secure</span>
              <span><Star size={12} /> Premium</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Profile Panel Overlay ────────────────────────────────── */}
      {showProfilePanel && activeChatContact && (
        <ProfilePanel
          contact={activeChatContact}
          onClose={() => setShowProfilePanel(false)}
          messages={messages}
          currentUser={currentUser}
          formatTime={formatTime}
          formatDate={formatDate}
          initiateCall={initiateCall}
          updateGroup={updateGroup}
          addMembersToGroup={addMembersToGroup}
          removeMemberFromGroup={removeMemberFromGroup}
          promoteMember={promoteMember}
          demoteAdmin={demoteAdmin}
          leaveGroup={leaveGroup}
          deleteGroup={deleteGroup}
          staff={staff}
          customers={customers}
          t={t}
          moderateGroupMember={moderateGroupMember}
          startGroupCall={startGroupCall}
          joinGroupCall={joinGroupCall}
          activeCall={activeCall}
          callState={callState}
          initialTab={profilePanelTab}
        />
      )}

      {/* ── Phone Confirm Modal ──────────────────────────────────── */}
      {showPhoneConfirm && activeChatContact && (
        <PhoneConfirmModal contact={activeChatContact} onClose={() => setShowPhoneConfirm(false)} />
      )}

      {/* ── Group Modal ──────────────────────────────────────────── */}
      {showGroupModal && (
        <div className="modal-overlay" onClick={() => { setShowGroupModal(false); setGroupName(''); setSelectedGroupMembers([]); setGroupImage(null); }}>
          <div className="modal-content group-creation-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Group</h3>
              <button className="icon-btn" onClick={() => { setShowGroupModal(false); setGroupName(''); setSelectedGroupMembers([]); setGroupImage(null); }}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="group-image-section">
                <div
                  className="group-image-selector"
                  onClick={() => groupImageInputRef.current?.click()}
                  style={{ backgroundImage: groupImage ? `url(${groupImage})` : 'none' }}
                >
                  {!groupImage && <Camera size={32} />}
                  <div className="upload-overlay">
                    <Camera size={20} />
                  </div>
                </div>
                <input
                  type="file"
                  ref={groupImageInputRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setGroupImage(reader.result);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <p className="image-hint">Tap to set group icon</p>
              </div>

              <input
                type="text"
                placeholder="Group Name..."
                className="full-width-input"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                style={{ marginBottom: '10px' }}
              />
              <textarea
                placeholder="Description (optional)..."
                className="full-width-input"
                value={groupDescription}
                onChange={e => setGroupDescription(e.target.value)}
                style={{ minHeight: '80px', marginBottom: '20px' }}
              />
              <div className="member-selection">
                <h4>Select Members ({selectedGroupMembers.length} selected)</h4>
                <div className="member-list">
                  {allContacts.filter(c => c.type !== 'group').map(c => {
                    const checked = selectedGroupMembers.includes(c.id);
                    return (
                      <label key={c.id} className={`member-item ${checked ? 'checked' : ''}`}>
                        <div className="member-avatar" style={{ background: roleColor(c.role) }}>{initial(c.name)}</div>
                        <div className="member-details">
                          <span className="member-name">{c.name}</span>
                          <span className="member-role">{c.role}</span>
                        </div>
                        <input type="checkbox" checked={checked} onChange={e => {
                          setSelectedGroupMembers(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id));
                        }} style={{ marginLeft: 'auto' }} />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { setShowGroupModal(false); setGroupName(''); setSelectedGroupMembers([]); setGroupImage(null); }}>Cancel</button>
              <button
                className={`btn-primary ${(groupName.trim() && selectedGroupMembers.length > 0) ? 'active' : 'disabled'}`}
                onClick={() => {
                  if (!groupName.trim() || selectedGroupMembers.length === 0) return;
                  const newGroup = createGroup(groupName, selectedGroupMembers, groupImage, groupDescription);
                  if (newGroup) {
                    setActiveChatContact({ ...newGroup, type: 'group' });
                  }
                  setShowGroupModal(false);
                  setGroupName('');
                  setGroupDescription('');
                  setSelectedGroupMembers([]);
                  setGroupImage(null);
                }}
                disabled={!groupName.trim() || selectedGroupMembers.length === 0}
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Privacy Modal ────────────────────────────────────────── */}
      {showPrivacyModal && (
        <div className="modal-overlay" onClick={() => setShowPrivacyModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Privacy & Security</h3>
              <button className="icon-btn" onClick={() => setShowPrivacyModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="setting-group">
                <label>Last Seen & Online</label>
                <select value={privacySettings.lastSeen} onChange={e => setPrivacySettings({ ...privacySettings, lastSeen: e.target.value })}>
                  <option value="everyone">Everyone</option>
                  <option value="contacts">My Contacts</option>
                  <option value="nobody">Nobody</option>
                </select>
              </div>
              <div className="setting-group">
                <label className="checkbox-label">
                  <input type="checkbox" checked={privacySettings.readReceipts} onChange={e => setPrivacySettings({ ...privacySettings, readReceipts: e.target.checked })} />
                  <span>Read Receipts</span>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setShowPrivacyModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}


      {/* ── Media Fullscreen Viewer (Lightbox) ──────────────────── */}
      <MediaFullscreenViewer
        media={fullScreenMedia}
        onClose={() => setFullScreenMedia(null)}
      />
    </div>
  );
};

export default Messaging;
