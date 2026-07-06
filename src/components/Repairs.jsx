import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Wrench, Search, Plus, Edit2, Trash2, Calendar as CalendarIcon, DollarSign, Clock, CheckCircle2, MessageSquare, Package, Check, X, Mic, Square, Play, Store, ShoppingCart, ChevronDown, ChevronUp, Filter, Car, AlertCircle as AlertCircleIcon, Navigation, MapPin, History, Layout, List } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { storeMedia, getMedia } from '../utils/idbStorage';
import { toEthiopian, formatEthiopianDate } from '../utils/ethiopianDate';
import './Repairs.css';

const Repairs = () => {
  const { 
    repairs, vehicles, customers, staff, inventory,
    deleteItem, addItem, updateItem, addNotification,
    t, language, formatDate, handleRepairStatusChange,
    requestConfirmation, openChatWith, logActivity
  } = useAppContext();
  const { currentUser } = useAuth();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ 
    vehicleId: '', mechanicId: '', dateIn: new Date().toISOString().split('T')[0], status: 'pending', notes: '', laborCost: 0,
    isRoadside: false, location: null
  });
  
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestTarget, setRequestTarget] = useState(null); // The repair job
  
  // Multi-Shop Request State
  const [shopSearchTerm, setShopSearchTerm] = useState('');
  const [selectedShopId, setSelectedShopId] = useState('all'); // 'all' or specific managerId
  const [requestBasket, setRequestBasket] = useState([]); // Array of { partId, qty, managerId }
  const [expandedShop, setExpandedShop] = useState(null);
  const [fullscreenImage, setFullscreenImage] = useState(null);

  // Job Approval State
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineTarget, setDeclineTarget] = useState(null);
  const [declineText, setDeclineText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingStreamRef = useRef(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('history'); // 'kanban' or 'history'
  const [dateFilter, setDateFilter] = useState('today'); // 'today', 'week', 'month', 'year', 'custom'
  const [customRange, setCustomRange] = useState({ 
    start: new Date().toISOString().split('T')[0], 
    end: new Date().toISOString().split('T')[0] 
  });
  const [custSearch, setCustSearch] = useState('');
  const [showVehResults, setShowVehResults] = useState(false);
  const [specificDate, setSpecificDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (location.state?.preselectCustomerId) {
      const customer = customers.find(c => String(c.id) === String(location.state.preselectCustomerId));
      if (customer) {
        handleOpenModal();
        setCustSearch(customer.name);
        setShowVehResults(true);
      }
    } else if (location.state?.showAddModal) {
      handleOpenModal();
    }
    
    // Listen for sidebar actions
    const handleSidebarAction = (e) => {
      if (e.detail?.type === 'new-repair') {
        handleOpenModal();
      }
    };
    window.addEventListener('sidebar-action', handleSidebarAction);

    // Clear state to avoid re-opening on refresh
    window.history.replaceState({}, document.title);
    
    return () => window.removeEventListener('sidebar-action', handleSidebarAction);
  }, [location.state, customers]);

  const filteredRepairs = (repairs || []).filter(r => {
    // 1. Garage ID isolation (Multitenancy)
    if (r.ownerId && currentUser?.ownerId && r.ownerId !== currentUser.ownerId && currentUser.role !== 'coder') return false;

    // 2. Role based filtering
    if (currentUser?.role === 'mechanic') {
      return String(r.mechanicId) === String(currentUser?.id);
    }
    if (currentUser?.role === 'customer') {
      const vehicle = (vehicles || []).find(v => v.id === r.vehicleId);
      return vehicle && String(vehicle.customerId) === String(currentUser?.id);
    }
    
    // Admin, Receptionist, Cashier see all in their garage
    return true;
  }).filter(r => {
    // 3. Status Filter
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    if (!matchesStatus) return false;

    // 4. Search Filter
    const vehicle = (vehicles || []).find(v => v.id === r.vehicleId);
    const vMatch = vehicle ? `${vehicle.make || ''} ${vehicle.model || ''} ${vehicle.plate || vehicle.plateNumber || ''}`.toLowerCase() : '';
    const matchesSearch = vMatch.includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    // 5. Date Filter (New)
    if (viewMode === 'history') {
      const repairDate = new Date(r.dateIn);
      const now = new Date();
      now.setHours(23, 59, 59, 999); // End of today

      if (dateFilter === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        return r.dateIn === todayStr;
      }
      if (dateFilter === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        return r.dateIn === yesterdayStr;
      }
      if (dateFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return repairDate >= weekAgo && repairDate <= now;
      }
      if (dateFilter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(now.getMonth() - 1);
        return repairDate >= monthAgo && repairDate <= now;
      }
      if (dateFilter === 'year') {
        const yearAgo = new Date();
        yearAgo.setFullYear(now.getFullYear() - 1);
        return repairDate >= yearAgo && repairDate <= now;
      }
      if (dateFilter === 'earlier') {
        const monthAgo = new Date();
        monthAgo.setMonth(now.getMonth() - 1);
        return repairDate < monthAgo;
      }
      if (dateFilter === 'specific' && specificDate) {
        return r.dateIn === specificDate;
      }
      if (dateFilter === 'custom') {
        return r.dateIn >= customRange.start && r.dateIn <= customRange.end;
      }
    }

    return true;
  }).sort((a, b) => {
    // Sort by latest activity (dateIn descending, and assuming newer IDs are more recent activity if dates match)
    const dateCompare = new Date(b.dateIn) - new Date(a.dateIn);
    if (dateCompare !== 0) return dateCompare;
    // Secondary sort by ID string length or value if format allows, 
    // but usually Date objects would have timestamps if we had an updatedAt field.
    // For now, b.id - a.id if they are timestamps prefixed
    return b.id.localeCompare(a.id);
  });

  const handleOpenModal = (repair = null) => {
    if (repair) {
      setFormData({ 
        vehicleId: repair.vehicleId, mechanicId: repair.mechanicId, dateIn: repair.dateIn, 
        status: repair.status, notes: repair.notes, laborCost: repair.laborCost,
        ownerId: repair.ownerId, isRoadside: repair.isRoadside || false, location: repair.location || null
      });
      setEditingId(repair.id);
    } else {
      setFormData({ 
        vehicleId: '', mechanicId: staff.find(s => s.role === 'mechanic' || s.role === 'manager')?.id || '', 
        dateIn: new Date().toISOString().split('T')[0], status: 'pending', notes: '', laborCost: 0,
        ownerId: currentUser?.ownerId, isRoadside: false, location: null
      });
      setEditingId(null);
    }
    setCustSearch('');
    setShowVehResults(false);
    setShowModal(true);
  };

  const handleCloseModal = () => setShowModal(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return; // Prevent duplicate submissions
    setSubmitting(true);
    try {
      if (editingId) {
        await updateItem('repairs', editingId, formData);
      } else {
        const newRepair = {
          id: `r${Date.now()}`,
          ...formData,
          ownerId: currentUser?.ownerId,
          laborCost: parseFloat(formData.laborCost) || 0,
          parts: [],
          assignmentStatus: formData.mechanicId ? 'pending' : null,
          isRoadside: formData.isRoadside,
          location: formData.location
        };
        await addItem('repairs', newRepair);

        if (formData.isRoadside && formData.location) {
          addItem('trackers', {
            id: `tr_${newRepair.id}`,
            repairId: newRepair.id,
            mechanicId: formData.mechanicId,
            customerId: currentUser?.id,
            customerLocation: formData.location,
            mechanicLocation: [9.03, 38.74],
            status: formData.mechanicId ? 'assigned' : 'pending',
            timestamp: new Date().toISOString()
          });
          addNotification(t("Repair request sent with location!"), 'success');
        }

        if (formData.mechanicId) {
          handleRepairStatusChange(newRepair, 'pending', formData.mechanicId);
        }
      }
      handleCloseModal();
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenRequestModal = (repair) => {
    setRequestTarget(repair);
    setRequestBasket([]);
    setShopSearchTerm('');
    setSelectedShopId('all');
    setShowRequestModal(true);
  };

  const toggleBasketItem = (part, managerId) => {
    const existing = requestBasket.find(item => item.partId === part.id);
    if (existing) {
      setRequestBasket(requestBasket.filter(item => item.partId !== part.id));
    } else {
      setRequestBasket([...requestBasket, { partId: part.id, qty: 1, managerId, price: part.price, name: part.name }]);
    }
  };

  const updateBasketQty = (partId, qtyStr) => {
    setRequestBasket(requestBasket.map(item => 
      item.partId === partId ? { ...item, qty: qtyStr === '' ? '' : parseInt(qtyStr) || 0 } : item
    ));
  };

  const submitMaterialRequest = (e) => {
    e.preventDefault();
    if (!requestTarget || requestBasket.length === 0) return;

    // Group items by manager to send separate requests
    const itemsByManager = requestBasket.reduce((acc, item) => {
      const mId = item.managerId === 'undefined' ? 'warehouse' : String(item.managerId);
      if (!acc[mId]) acc[mId] = [];
      acc[mId].push(item);
      return acc;
    }, {});

    Object.keys(itemsByManager).forEach(mId => {
      itemsByManager[mId].forEach(item => {
        const newRequest = {
          id: `mr${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          repairId: requestTarget.id,
          mechanicId: currentUser.id,
          managerId: mId === 'warehouse' ? null : mId, 
          partId: item.partId,
          requestedQty: item.qty,
          status: 'pending',
          timestamp: new Date().toISOString(),
          ownerId: currentUser.ownerId
        };
        addItem('materialRequests', newRequest);
      });

      // Notify the specific Manager
      if (mId !== 'warehouse') {
        addNotification(`New Material Request from ${currentUser.name}`, 'info', mId, '/material-requests');
      } else {
        // Notify Admins for main warehouse
        staff.filter(s => s.role === 'admin' || s.role === 'manager').forEach(admin => {
          addNotification(`New Warehouse Material Request from ${currentUser.name}`, 'info', admin.id, '/material-requests');
        });
      }
    });

    logActivity('Materials Requested', `${currentUser.name} requested ${requestBasket.length} items from ${Object.keys(itemsByManager).length} shops`);
    setShowRequestModal(false);
  };

  const handleAssignmentAction = async (repair, action) => {
    if (action === 'accept') {
      try {
        // Mark as accepted + move to in-progress
        await updateItem('repairs', repair.id, {
          assignmentStatus: 'accepted',
          status: 'in-progress'
        });

        // Notify admins & managers
        const recipients = staff.filter(s => s.role === 'admin' || s.role === 'manager');
        const recipientIds = new Set([...recipients.map(s => s.id), currentUser.ownerId].filter(Boolean));
        recipientIds.forEach(id => {
          if (String(id) !== String(currentUser.id)) {
            addNotification(
              `✅ ${currentUser.name} accepted Repair #${repair.id} and started work`,
              'success', id, '/repairs'
            );
          }
        });
        logActivity('Job Accepted', `${currentUser.name} accepted Repair #${repair.id}`);
      } catch (err) {
        addNotification('Failed to accept job. Please try again.', 'error');
      }
    } else {
      // Open decline modal
      setDeclineTarget(repair);
      setDeclineText('');
      setAudioBlob(null);
      setAudioUrl(null);
      setShowDeclineModal(true);
    }
  };

  // Voice Recording Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) { alert("Mic access denied"); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const submitDecline = async (e) => {
    e.preventDefault();
    if (!declineTarget || submitting) return;
    if (!declineText.trim() && !audioBlob) {
      addNotification('Please provide a reason or voice note.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      let voiceId = null;
      if (audioBlob) {
        voiceId = `voice_decline_${Date.now()}`;
        await storeMedia(voiceId, audioBlob, { name: 'decline_reason.webm', type: 'audio/webm' });
      }

      await updateItem('repairs', declineTarget.id, {
        assignmentStatus: 'declined',
        declineReason: declineText.trim(),
        declineVoice: voiceId
      });

      // Notify admins & managers
      const recipients = staff.filter(s => s.role === 'admin' || s.role === 'manager');
      const recipientIds = new Set([...recipients.map(s => s.id), currentUser.ownerId].filter(Boolean));
      recipientIds.forEach(id => {
        if (String(id) !== String(currentUser.id)) {
          addNotification(
            `⚠️ ${currentUser.name} declined Repair #${declineTarget.id}`,
            'warning', id, '/repairs'
          );
        }
      });
      logActivity('Job Declined', `${currentUser.name} declined Repair #${declineTarget.id}. Reason: ${declineText.trim() || 'Voice Note'}`);

      setShowDeclineModal(false);
      setDeclineTarget(null);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setDeclineText('');
      setAudioBlob(null);
    } catch (err) {
      console.error('Decline failed', err);
      addNotification('Failed to submit decline. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Permission checks for UI
  const p = currentUser?.permissions || [];
  const canCreate = (p.includes('all') || p.includes('repairs_manage')) && currentUser?.role !== 'mechanic';
  const canEditCost = p.includes('all') || p.includes('billing_manage');
  const canDelete = p.includes('all');
  const canAssign = p.includes('all') || p.includes('repairs_manage');

  return (
    <div className="page-content repairs-page">
      <div className="page-header">
        <div className="header-title">
          <div className="icon-wrapper"><Wrench size={28} /></div>
          <div>
            <h1>{t('repairs')}</h1>
            <p className="subtitle">{t("Manage repair orders, track status, and assign mechanics.")}</p>
          </div>
        </div>
        {canCreate && (
          <button className="btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={18} /> {t('newRepairOrder')}
          </button>
        )}
        <div className="header-actions">
          <div className="view-mode-tabs" style={{ marginBottom: 12 }}>
            <button 
              className={`status-tab ${viewMode === 'history' ? 'active' : ''}`}
              onClick={() => setViewMode('history')}
            >
              <History size={16} /> {t("Daily Activity")}
            </button>
            <button 
              className={`status-tab ${viewMode === 'kanban' ? 'active' : ''}`}
              onClick={() => setViewMode('kanban')}
            >
              <Layout size={16} /> {t("Status Board")}
            </button>
          </div>

          <div className="status-tabs">
            {['all', 'pending', 'in-progress', 'completed'].map(status => (
              <button 
                key={status}
                className={`status-tab ${statusFilter === status ? 'active' : ''}`}
                onClick={() => setStatusFilter(status)}
              >
                {status === 'all' ? (t("All Jobs")) : 
                 status === 'pending' ? t('pending') : 
                 status === 'in-progress' ? t('inProgress') : 
                 t('completed')}
                <span className="count-badge">
                  {status === 'all' 
                    ? (repairs || []).filter(r => currentUser?.role === 'mechanic' ? String(r.mechanicId) === String(currentUser?.id) : true).length 
                    : (repairs || []).filter(r => (currentUser?.role === 'mechanic' ? String(r.mechanicId) === String(currentUser?.id) : true) && r.status === status).length
                  }
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="controls-bar" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div className="search-box" style={{ flex: 1, minWidth: '300px' }}>
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder={t("Search by vehicle, plate, or status...")} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {viewMode === 'history' && (
            <div className="date-filters-container" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Filter size={16} color="var(--text-secondary)" />
              <div className="date-filter-chips">
                {['today', 'yesterday', 'week', 'month', 'year', 'earlier', 'specific', 'custom'].map(f => (
                  <button
                    key={f}
                    className={`chip-mini ${dateFilter === f ? 'active' : ''}`}
                    onClick={() => setDateFilter(f)}
                    style={{ 
                      padding: '8px 16px', 
                      borderRadius: '20px', 
                      border: '1px solid var(--border)',
                      background: dateFilter === f ? 'var(--primary)' : 'var(--bg-card)',
                      color: dateFilter === f ? 'white' : 'var(--text-secondary)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    {f === 'specific' ? t('specificDay') : (t(f) || t(f.charAt(0).toUpperCase() + f.slice(1)))}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {viewMode === 'history' && dateFilter === 'specific' && (
          <div className="custom-date-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border)', width: 'fit-content' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarIcon size={16} />
              <input 
                type="date" 
                value={specificDate}
                onChange={(e) => setSpecificDate(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: 600, color: 'var(--text-primary)' }}
              />
            </div>
          </div>
        )}

        {viewMode === 'history' && dateFilter === 'custom' && (
          <div className="custom-date-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border)', width: 'fit-content' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>{t('From')}:</label>
              <input 
                type="date" 
                value={customRange.start} 
                onChange={(e) => setCustomRange({...customRange, start: e.target.value})}
                style={{ padding: '6px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>{t('To')}:</label>
              <input 
                type="date" 
                value={customRange.end} 
                onChange={(e) => setCustomRange({...customRange, end: e.target.value})}
                style={{ padding: '6px', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            </div>
          </div>
        )}
      </div>

      {viewMode === 'kanban' ? (
        <div className="repairs-kanban">
          {['pending', 'in-progress', 'completed'].map(statusType => (
            <div className="kanban-column" key={statusType}>
              <div className="kanban-header">
                <h3 className="capitalize">{t(statusType === 'in-progress' ? 'inProgress' : statusType)}</h3>
                <span className="count-badge">{filteredRepairs.filter(r => r.status === statusType).length}</span>
              </div>
              <div className="kanban-body">
                {filteredRepairs.filter(r => r.status === statusType).map(repair => (
                  <RepairHistoryCard 
                    key={repair.id}
                    repair={repair}
                    vehicles={vehicles}
                    customers={customers}
                    staff={staff}
                    currentUser={currentUser}
                    t={t}
                    formatDate={formatDate}
                    handleOpenModal={handleOpenModal}
                    handleOpenRequestModal={handleOpenRequestModal}
                    handleAssignmentAction={handleAssignmentAction}
                    canDelete={canDelete}
                    canEditCost={canEditCost}
                    requestConfirmation={requestConfirmation}
                    deleteItem={deleteItem}
                    openChatWith={openChatWith}
                    language={language}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="repairs-history-list">
          {filteredRepairs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--bg-card)', borderRadius: '20px', border: '1px solid var(--border)' }}>
              <div style={{ background: 'var(--bg-main)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <History size={40} opacity={0.3} />
              </div>
              <h3>{t("No activity found for this period")}</h3>
              <p style={{ color: 'var(--text-secondary)' }}>{t("Try adjusting your filters or search terms.")}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
              {filteredRepairs.map(repair => (
                <RepairHistoryCard 
                  key={repair.id}
                  repair={repair}
                  vehicles={vehicles}
                  customers={customers}
                  staff={staff}
                  currentUser={currentUser}
                  t={t}
                  formatDate={formatDate}
                  handleOpenModal={handleOpenModal}
                  handleOpenRequestModal={handleOpenRequestModal}
                  handleAssignmentAction={handleAssignmentAction}
                  canDelete={canDelete}
                  canEditCost={canEditCost}
                  requestConfirmation={requestConfirmation}
                  deleteItem={deleteItem}
                  openChatWith={openChatWith}
                  language={language}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-lg">
            <div className="modal-header">
              <h2>{editingId ? (t("Edit Repair Order")) : (t("New Repair Order"))}</h2>
              <button className="close-btn" onClick={handleCloseModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group grid-2-col">
                <div>
                  <label>{t('vehicle')} *</label>
                  <div className="custom-picker" style={{ position: 'relative' }}>
                    {/* Selected Vehicle "Bar" */}
                    {!formData.vehicleId ? (
                      <div 
                        onClick={() => setShowVehResults(!showVehResults)}
                        style={{ 
                          padding: '14px 18px', 
                          background: 'var(--bg-main)', 
                          border: '1px solid var(--border)', 
                          borderRadius: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          color: 'var(--text-secondary)',
                          transition: 'all 0.2s ease',
                          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                        }}
                        onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                        onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Car size={18} />
                          <span style={{ fontWeight: 500 }}>{t("Select vehicle...")}</span>
                        </div>
                        <Search size={18} style={{ opacity: 0.5 }} />
                      </div>
                    ) : (() => {
                      const selectedVeh = vehicles.find(v => v.id === formData.vehicleId);
                      const selectedCust = customers.find(c => String(c.id) === String(selectedVeh?.customerId));
                      return (
                        <div 
                          onClick={() => {
                            setFormData({...formData, vehicleId: ''});
                            setShowVehResults(true);
                          }}
                          style={{ 
                            padding: '12px 16px', 
                            background: 'rgba(67, 97, 238, 0.08)', 
                            border: '1px solid var(--primary)', 
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ color: 'var(--primary)' }}>{selectedVeh?.plate}</strong>
                            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{selectedVeh?.make} {selectedVeh?.model} - {selectedCust?.name}</span>
                          </div>
                          <X size={16} />
                        </div>
                      );
                    })()}

                    {/* Search & Results Dropdown */}
                    {showVehResults && (
                      <div style={{ 
                        position: 'absolute', 
                        top: '100%', 
                        left: 0, 
                        right: 0, 
                        background: 'var(--bg-card)', 
                        border: '1px solid var(--primary)', 
                        borderRadius: '12px', 
                        marginTop: '8px', 
                        zIndex: 100, 
                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                        overflow: 'hidden'
                      }}>
                        <div style={{ padding: '12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-main)' }}>
                          <div style={{ position: 'relative' }}>
                            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                            <input 
                              autoFocus
                              type="text" 
                              placeholder={t("Type plate or customer name...")}
                              value={custSearch}
                              onChange={(e) => setCustSearch(e.target.value)}
                              style={{ paddingLeft: '32px', width: '100%', background: 'var(--bg-card)' }}
                            />
                          </div>
                        </div>
                        <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                          {vehicles
                            .filter(v => {
                              const c = customers.find(cust => String(cust.id) === String(v.customerId));
                              const search = custSearch.toLowerCase();
                              return (v.plate || v.plateNumber || '').toLowerCase().includes(search) || 
                                     (c?.name || '').toLowerCase().includes(search) || 
                                     (v.model || '').toLowerCase().includes(search);
                            })
                            .map(v => {
                              const c = customers.find(cust => String(cust.id) === String(v.customerId));
                              return (
                                <div 
                                  key={v.id}
                                  onClick={() => {
                                    setFormData({...formData, vehicleId: v.id});
                                    setShowVehResults(false);
                                    setCustSearch('');
                                  }}
                                  style={{ 
                                    padding: '12px 16px', 
                                    cursor: 'pointer',
                                    borderBottom: '1px solid var(--border)',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseOver={e => e.currentTarget.style.background = 'rgba(67, 97, 238, 0.05)'}
                                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{c?.name || t('Walk-in')}</div>
                                    <div className="plate-badge-small" style={{ margin: 0 }}>{v.plate}</div>
                                  </div>
                                  <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: 4 }}>{v.year} {v.make} {v.model}</div>
                                </div>
                              );
                            })}
                          {vehicles.filter(v => {
                            const c = customers.find(cust => String(cust.id) === String(v.customerId));
                            const search = custSearch.toLowerCase();
                            return (v.plate || v.plateNumber || '').toLowerCase().includes(search) || (c?.name || '').toLowerCase().includes(search) || (v.model || '').toLowerCase().includes(search);
                          }).length === 0 && (
                            <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5, fontSize: '0.9rem' }}>
                              {t("No vehicles found")}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label>{t("Assigned Mechanic")}</label>
                  <select name="mechanicId" value={formData.mechanicId} onChange={handleChange} disabled={!canAssign}>
                    <option value="">{t("— Unassigned —")}</option>
                    {staff.filter(s => s.role === 'mechanic' || s.role === 'manager').map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                    ))}
                  </select>

                  <div className="roadside-toggle-group" style={{ marginTop: '15px', padding: '12px', background: 'rgba(67, 97, 238, 0.05)', borderRadius: '10px', border: '1px solid rgba(67, 97, 238, 0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Navigation size={18} color="var(--primary)" />
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t("Roadside Assistance")}</span>
                      </div>
                      <label className="switch">
                        <input 
                          type="checkbox" 
                          name="isRoadside" 
                          checked={formData.isRoadside} 
                          onChange={(e) => setFormData({ ...formData, isRoadside: e.target.checked })} 
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>
                    {formData.isRoadside && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed rgba(67, 97, 238, 0.2)' }}>
                        <button 
                          type="button"
                          className="btn-outline w-100"
                          onClick={() => {
                            handleCloseModal();
                            window.location.href = '/tracker'; // Navigate to tracker
                          }}
                          style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                          <MapPin size={14} />
                          {formData.location ? t("Location Selected!") : t("Open Map to Pin Location")}
                        </button>
                        {formData.location && (
                          <small style={{ display: 'block', textAlign: 'center', marginTop: '6px', color: 'var(--success)', fontWeight: 600 }}>
                            ✓ {t("GPS Coordinates Captured")}
                          </small>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Mechanic Workload Preview */}
                  {formData.mechanicId && (currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'coder') && (() => {
                    const mechRepairs = repairs.filter(r => String(r.mechanicId) === String(formData.mechanicId));
                    const stats = {
                      pending: mechRepairs.filter(r => r.status === 'pending').length,
                      inProgress: mechRepairs.filter(r => r.status === 'in-progress').length,
                      completed: mechRepairs.filter(r => r.status === 'completed').length
                    };
                    return (
                      <div className="mechanic-stats-preview" style={{ 
                        marginTop: '10px', 
                        padding: '12px', 
                        background: 'var(--bg-main)', 
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                          {t("Mechanic's Current Load")}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                            <Clock size={14} color="#f59e0b" />
                            <span><strong>{stats.pending}</strong> {t("pending")}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                            <Wrench size={14} color="var(--primary)" />
                            <span><strong>{stats.inProgress}</strong> {t("inProgress")}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                            <CheckCircle2 size={14} color="var(--success)" />
                            <span><strong>{stats.completed}</strong> {t("Done")}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="form-group grid-2-col">
                <div>
                  <label>{t('dateIn')} *</label>
                  {language === 'am' ? (
                    <EthiopianSelector
                      value={formData.dateIn}
                      onChange={(val) => setFormData({ ...formData, dateIn: val })}
                      size="small"
                      language="am"
                    />
                  ) : (
                    <input type="date" name="dateIn" value={formData.dateIn} onChange={handleChange} required disabled={!canAssign} />
                  )}
                  {formData.dateIn && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '600', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <CalendarIcon size={12} />
                      {formatEthiopianDate(formData.dateIn, language)}
                    </div>
                  )}
                </div>
                <div>
                  <label>{t('status')}</label>
                  <select name="status" value={formData.status} onChange={handleChange} disabled={currentUser?.role === 'customer'}>
                    <option value="pending">{t('pending')}</option>
                    <option value="in-progress">{t('inProgress')}</option>
                    <option value="completed">{t('completed')}</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>{t("Problem Description / Service Notes")} *</label>
                <textarea name="notes" value={formData.notes} onChange={handleChange} required placeholder={t("Describe the issue...")} disabled={currentUser?.role === 'customer'}></textarea>
              </div>

              <div className="form-group">
                <label>{t("Estimated / Actual Labor Cost")} ($)</label>
                <input type="number" name="laborCost" value={formData.laborCost || ''} onChange={handleChange} min="0" step="1" disabled={!canEditCost} />
              </div>
              
              <div className="modal-actions">
                <button type="button" className="btn-text" onClick={handleCloseModal} disabled={submitting}>{t('cancel')}</button>
                <button type="submit" className="btn-primary" disabled={submitting} style={{ opacity: submitting ? 0.7 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                  {submitting ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="spinner-small" /> {t('saving')}...
                    </span>
                  ) : (
                    editingId ? t('save') : t('Create Order')
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRequestModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '900px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Store size={26} color="var(--primary)" /> {t("Multi-Shop Material Browser")}
              </h2>
              <button className="close-btn" onClick={() => setShowRequestModal(false)}>&times;</button>
            </div>
            
            <div className="material-browser-grid">
              <div className="shop-selection-column">
                <div className="search-box" style={{ marginBottom: '10px', position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg-card)' }}>
                  <Search size={18} className="search-icon" />
                  <input 
                    type="text" 
                    placeholder={t("Search materials across all shops...")} 
                    value={shopSearchTerm}
                    onChange={(e) => setShopSearchTerm(e.target.value)}
                  />
                </div>

                {[...new Set(inventory.filter(p => p.managerId).map(p => String(p.managerId)))].map(mId => {
                  const manager = staff.find(s => String(s.id) === mId);
                  const shopName = manager ? manager.name : `Shop ${mId}`;
                  
                  const shopParts = inventory.filter(p => {
                    return String(p.managerId) === mId && p.name.toLowerCase().includes(shopSearchTerm.toLowerCase());
                  });
                  
                  if (shopParts.length === 0) return null;

                  return (
                    <div key={mId} className="shop-section" style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-card)', marginBottom: '15px' }}>
                      <div 
                        onClick={() => setExpandedShop(expandedShop === mId ? null : mId)}
                        style={{ padding: '12px 15px', background: 'rgba(67, 97, 238, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Package size={18} color="var(--primary)" />
                          <strong style={{ fontSize: '1rem' }}>{shopName}</strong>
                          <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>({shopParts.length} {t('items')})</span>
                        </div>
                        {expandedShop === mId ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>

                      {(expandedShop === mId || shopSearchTerm) && (
                        <div style={{ padding: '10px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                            {shopParts.map(part => {
                              const isInBasket = requestBasket.find(b => b.partId === part.id);
                              return (
                                <div 
                                  key={part.id} 
                                  onClick={() => toggleBasketItem(part, mId)}
                                  className="material-item-card"
                                  style={{ 
                                    padding: '10px', 
                                    borderRadius: '12px', 
                                    border: `2px solid ${isInBasket ? 'var(--primary)' : 'var(--border)'}`,
                                    background: isInBasket ? 'rgba(67, 97, 238, 0.08)' : 'var(--bg-main)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    position: 'relative',
                                    display: 'flex',
                                    gap: '12px',
                                    alignItems: 'center'
                                  }}
                                >
                                  {part.image && (
                                    <div className="material-thumb-wrapper">
                                      <ItemImage mediaId={part.image} onFullscreen={setFullscreenImage} />
                                    </div>
                                  )}
                                  {!part.image && (
                                    <div style={{ width: '70px', height: '70px', borderRadius: '8px', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)', flexShrink: 0 }}>
                                      <Package size={24} opacity={0.3} />
                                    </div>
                                  )}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '2px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{part.name}</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: '1rem' }}>${part.price}</div>
                                      <div style={{ fontSize: '0.75rem', color: part.quantity <= part.threshold ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: 600 }}>
                                        {part.quantity} {t("in stock")}
                                      </div>
                                    </div>
                                  </div>
                                  {isInBasket && <div style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--primary)', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)', border: '2px solid white' }}><Check size={14} strokeWidth={3} /></div>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Right Side: Request Basket */}
              <div className="request-basket-column">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', fontSize: '1.1rem' }}>
                  <ShoppingCart size={20} color="var(--primary)" /> {t("Request Basket")}
                </h3>

                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '15px' }}>
                  {requestBasket.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 10px', opacity: 0.5 }}>
                      <Package size={40} style={{ marginBottom: '10px' }} />
                      <p>{t("Select materials from shops on the left")}</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {requestBasket.map(item => (
                        <div key={item.partId} style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: 'var(--shadow-sm)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{item.name}</div>
                            <button onClick={() => setRequestBasket(requestBasket.filter(b => b.partId !== item.partId))} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#374151' }}>Qty:</span>
                            <input 
                              type="number" 
                              value={item.qty} 
                              onChange={(e) => updateBasketQty(item.partId, e.target.value)}
                              style={{ 
                                width: '70px', 
                                padding: '8px', 
                                borderRadius: '8px', 
                                border: '2px solid var(--primary)', 
                                background: '#f9fafb', 
                                color: '#111827', 
                                fontWeight: 700,
                                textAlign: 'center'
                              }}
                              min="1"
                            />
                            <span style={{ marginLeft: 'auto', fontWeight: 800, color: 'var(--success)', fontSize: '1.1rem' }}>${(item.price * (parseInt(item.qty) || 0)).toFixed(0)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '2px solid var(--border)', paddingTop: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '1.1rem', fontWeight: 800 }}>
                    <span>{t('Total Estimate')}:</span>
                    <span style={{ color: 'var(--primary)' }}>{requestBasket.reduce((sum, item) => sum + (item.price * (parseInt(item.qty) || 0)), 0).toFixed(0)} {t('ETB')}</span>
                  </div>
                  <button 
                    onClick={submitMaterialRequest}
                    disabled={requestBasket.length === 0}
                    className="btn-primary w-full"
                    style={{ padding: '15px' }}
                  >
                    {t('sendRequestsCount', { count: requestBasket.length })}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showDeclineModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>{t("Decline Job")}</h3>
              <button className="close-btn" onClick={() => setShowDeclineModal(false)}>&times;</button>
            </div>
            <form onSubmit={submitDecline} className="modal-body" style={{ padding: '20px' }}>
              <p style={{ fontSize: '0.9rem', marginBottom: '15px', color: 'var(--text-secondary)' }}>
                {t("Please provide a reason for declining this job.")}
              </p>
              
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>{t('Reason (Text)')}</label>
                <textarea 
                  className="auth-input" 
                  style={{ height: '80px', paddingTop: '10px' }}
                  placeholder={t("Type your reason...")}
                  value={declineText}
                  onChange={(e) => setDeclineText(e.target.value)}
                />
              </div>

              <div className="voice-recorder-section" style={{ 
                background: 'var(--bg-main)', 
                padding: '15px', 
                borderRadius: '12px', 
                textAlign: 'center',
                marginBottom: '20px',
                border: isRecording ? '2px solid var(--danger)' : '1px solid var(--border)'
              }}>
                <div style={{ marginBottom: '10px', fontSize: '0.85rem', fontWeight: 600 }}>
                  {isRecording ? t('RECORDING...') : audioBlob ? t('VOICE RECORDED') : t('VOICE NOTE (OPTIONAL)')}
                </div>
                
                {!isRecording && !audioBlob ? (
                  <button type="button" className="voice-btn" onClick={startRecording} style={{ background: 'var(--primary)', color: 'white', border: 'none', width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
                    <Mic size={24} />
                  </button>
                ) : isRecording ? (
                  <button type="button" className="voice-btn pulse" onClick={stopRecording} style={{ background: 'var(--danger)', color: 'white', border: 'none', width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
                    <Square size={20} fill="white" />
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                    <audio src={audioUrl} controls style={{ width: '100%', height: '35px' }} />
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button type="button" className="btn-outline-small" onClick={() => { setAudioBlob(null); setAudioUrl(null); }}>{t('Redo')}</button>
                      <div style={{ background: 'var(--success)', color: 'white', padding: '10px 15px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Check size={16} /> {t('Recorded')}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button 
                type="submit" 
                className="btn-primary w-full" 
                disabled={(!declineText.trim() && !audioBlob) || isRecording || submitting}
                style={{ marginTop: '10px' }}
              >
                {isRecording ? t('Stop Recording first...') : submitting ? t('Processing...') : t('Submit Response')}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Fullscreen Image Lightbox */}
      {fullscreenImage && (
        <div className="image-lightbox-overlay" onClick={() => setFullscreenImage(null)}>
          <button className="lightbox-close" onClick={() => setFullscreenImage(null)}><X size={32} /></button>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={fullscreenImage} alt="Fullscreen" />
          </div>
        </div>
      )}
    </div>
  );
};

const RepairHistoryCard = ({ 
  repair, vehicles, customers, staff, currentUser, t, formatDate, 
  handleOpenModal, handleOpenRequestModal, handleAssignmentAction, 
  canDelete, canEditCost, requestConfirmation, deleteItem, openChatWith, language 
}) => {
  const vehicle = repair.vehicle || (vehicles || []).find(v => String(v.id) === String(repair.vehicleId));
  const owner = vehicle?.customer || (vehicle ? (customers || []).find(c => String(c.id) === String(vehicle.customerId)) : null);
  const mechanic = repair.mechanic || (staff || []).find(s => String(s.id) === String(repair.mechanicId));

  return (
    <div className={`repair-card ${repair.assignmentStatus === 'declined' ? 'card-declined' : ''}`} key={repair.id}>
      <div className="repair-card-header">
        <span className="repair-id">#{(repair.id || '').toUpperCase()}</span>
        <div className="action-buttons">
          {owner && (
            <button className="icon-btn-small chat-btn" style={{ color: 'white', background: 'var(--primary)' }} onClick={() => openChatWith(owner)} title={t('chat')}>
              <MessageSquare size={16} />
            </button>
          )}
          {repair.assignmentStatus !== 'declined' && (
            <button className="icon-btn-small" onClick={() => handleOpenModal(repair)} title={t('edit')}>
              <Edit2 size={16} />
            </button>
          )}
          {canDelete && (
            <button 
              className="icon-btn-small delete-btn" 
              onClick={() => requestConfirmation(t('confirmDeleteRepair'), () => deleteItem('repairs', repair.id))}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
      
      <h4 className="vehicle-name">{vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : t('Unknown')}</h4>
      <span className="plate-badge-small">{vehicle?.plate}</span>

      <div className="repair-details">
        <div className="detail-row">
          <CalendarIcon size={14} /> <span>{formatDate(repair.dateIn)}</span>
        </div>
        <div className="detail-row">
          <Wrench size={14} /> <span>{mechanic ? mechanic.name : (t("Unassigned"))}</span>
        </div>
      </div>

      <div className="repair-notes">
        {repair.notes}
      </div>

      {(repair.status === 'completed' || canEditCost) && (
        <div className="repair-cost">
          <DollarSign size={14} /> <span style={{ fontWeight: 700 }}>{t("Labor")} : {repair.laborCost || 0} {t('ETB')}</span>
        </div>
      )}

      {currentUser.role === 'mechanic' && repair.status === 'in-progress' && (
        <button className="btn-secondary w-full mt-10" onClick={() => handleOpenRequestModal(repair)}>
          <Package size={14} /> {t('requestMaterials')}
        </button>
      )}

      {repair.isRoadside && (
        <button 
          className="btn-primary w-full mt-10" 
          onClick={() => window.location.href = '/tracker'}
          style={{ 
            background: 'linear-gradient(135deg, var(--primary) 0%, #4cc9f0 100%)', 
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 15px rgba(67, 97, 238, 0.2)'
          }}
        >
          <Navigation size={14} />
          {t("Live Tracking")}
        </button>
      )}

      {/* Accept / Decline buttons — shown to assigned mechanic while status is pending */}
      {currentUser.role === 'mechanic' &&
        String(repair.mechanicId) === String(currentUser.id) &&
        !repair.assignmentStatus && (
        <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
          <button
            onClick={() => handleAssignmentAction(repair, 'accept')}
            style={{
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 0',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
              transition: 'transform 0.15s, opacity 0.15s'
            }}
            onMouseOver={e => e.currentTarget.style.opacity = '0.88'}
            onMouseOut={e => e.currentTarget.style.opacity = '1'}
          >
            <Check size={16} /> {t('Accept Job')}
          </button>
          <button
            onClick={() => handleAssignmentAction(repair, 'decline')}
            style={{
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 0',
              background: 'transparent',
              color: '#ef4444',
              border: '2px solid #ef4444',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s'
            }}
            onMouseOver={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ef4444'; }}
          >
            <X size={16} /> {t('Decline')}
          </button>
        </div>
      )}

      {/* Show mechanic their accepted status + complete action */}
      {currentUser.role === 'mechanic' && repair.assignmentStatus === 'accepted' && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Accepted badge */}
          <div style={{
            padding: '8px 12px', borderRadius: 10,
            background: 'rgba(16,185,129,0.12)', color: '#059669',
            fontWeight: 700, fontSize: '0.85rem',
            display: 'flex', alignItems: 'center', gap: 6,
            border: '1px solid rgba(16,185,129,0.3)'
          }}>
            <Check size={14} />
            {repair.status === 'completed'
              ? '✅ Job Completed'
              : '🔧 Accepted — You are working on this'}
          </div>

          {/* Mark as Completed button — only shows while work not done */}
          {repair.status !== 'completed' && (
            <button
              onClick={() => updateItem('repairs', repair.id, { status: 'completed' })}
              style={{
                width: '100%',
                padding: '10px 0',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: 'linear-gradient(135deg,#10b981,#059669)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
                transition: 'opacity 0.15s'
              }}
              onMouseOver={e => e.currentTarget.style.opacity = '0.88'}
              onMouseOut={e => e.currentTarget.style.opacity = '1'}
            >
              <CheckCircle2 size={16} /> Mark as Completed
            </button>
          )}
        </div>
      )}

      {/* Admin / Manager view of mechanic response */}
      {(currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'coder') && (
        <div style={{ marginTop: 14 }}>
          {/* No response yet */}
          {!repair.assignmentStatus && repair.mechanicId && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 8,
              background: 'rgba(245,158,11,0.08)',
              border: '1px dashed rgba(245,158,11,0.5)',
              color: '#d97706', fontSize: '0.8rem', fontWeight: 600
            }}>
              <Clock size={13} /> Awaiting mechanic response…
            </div>
          )}

          {/* ACCEPTED */}
          {repair.assignmentStatus === 'accepted' && (
            <div style={{
              borderRadius: 12, overflow: 'hidden',
              border: '2px solid #10b981'
            }}>
              {/* Header bar */}
              <div style={{
                background: 'linear-gradient(135deg,#10b981,#059669)',
                color: '#fff', padding: '8px 14px',
                display: 'flex', alignItems: 'center', gap: 8,
                fontWeight: 700, fontSize: '0.85rem'
              }}>
                <Check size={15} /> ACCEPTED BY MECHANIC
              </div>
              {/* Status pill row */}
              <div style={{
                padding: '10px 14px',
                background: 'rgba(16,185,129,0.07)',
                display: 'flex', alignItems: 'center', gap: 8
              }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Work Status:
                </span>
                {/* pending pill */}
                <span style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
                  background: repair.status === 'pending' ? '#f59e0b' : 'rgba(0,0,0,0.06)',
                  color: repair.status === 'pending' ? '#fff' : 'var(--text-secondary)',
                  border: repair.status === 'pending' ? '2px solid #f59e0b' : '2px solid var(--border)'
                }}>
                  Pending
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>→</span>
                {/* in-progress pill */}
                <span style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
                  background: repair.status === 'in-progress' ? 'var(--primary)' : 'rgba(0,0,0,0.06)',
                  color: repair.status === 'in-progress' ? '#fff' : 'var(--text-secondary)',
                  border: repair.status === 'in-progress' ? '2px solid var(--primary)' : '2px solid var(--border)'
                }}>
                  In Progress
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>→</span>
                {/* completed pill */}
                <span style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
                  background: repair.status === 'completed' ? '#10b981' : 'rgba(0,0,0,0.06)',
                  color: repair.status === 'completed' ? '#fff' : 'var(--text-secondary)',
                  border: repair.status === 'completed' ? '2px solid #10b981' : '2px solid var(--border)'
                }}>
                  Completed
                </span>
              </div>
            </div>
          )}

          {/* DECLINED */}
          {repair.assignmentStatus === 'declined' && (
            <div style={{
              borderRadius: 12, overflow: 'hidden',
              border: '2px solid #ef4444'
            }}>
              {/* Header bar */}
              <div style={{
                background: 'linear-gradient(135deg,#ef4444,#dc2626)',
                color: '#fff', padding: '8px 14px',
                display: 'flex', alignItems: 'center', gap: 8,
                fontWeight: 700, fontSize: '0.85rem'
              }}>
                <X size={15} /> DECLINED BY MECHANIC
              </div>
              {/* Reason */}
              {(repair.declineReason || repair.declineVoice) && (
                <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.06)' }}>
                  {repair.declineReason && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                      <strong style={{ color: '#dc2626' }}>Reason: </strong>
                      {repair.declineReason}
                    </div>
                  )}
                  {repair.declineVoice && <DeclineVoicePlayer mediaId={repair.declineVoice} />}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {repair.assignmentStatus === 'declined' && (
        <div className="declined-watermark">{t('declined').toUpperCase()}</div>
      )}
    </div>
  );
};

const DeclineVoicePlayer = ({ mediaId }) => {
  const { t } = useAppContext();
  const [url, setUrl] = useState(null);
  useEffect(() => {
    getMedia(mediaId).then(data => {
      if (data && data.blob) setUrl(URL.createObjectURL(data.blob));
    });
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [mediaId]);

  if (!url) return <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{t('Loading audio...')}</div>;

  return (
    <div style={{ marginTop: '8px' }}>
      <audio src={url} controls style={{ width: '100%', height: '32px' }} />
    </div>
  );
};

export default Repairs;

const ItemImage = ({ mediaId, onFullscreen }) => {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mediaId) return;
    getMedia(mediaId).then(data => {
      if (data && data.blob) {
        setUrl(URL.createObjectURL(data.blob));
      }
      setLoading(false);
    });
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [mediaId]);

  if (!mediaId) return null;
  if (loading) return <div className="img-skeleton-small" style={{ width: '100%', height: '100%', background: '#eee' }} />;
  return <img src={url} alt="part" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} onClick={(e) => {
    e.stopPropagation();
    onFullscreen(url);
  }} />;
};
