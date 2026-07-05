import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { CalendarClock, Plus, Search, Calendar as CalendarIcon, Clock, Car, Check, X, Trash2 } from 'lucide-react';
import { toEthiopian, formatEthiopianDate } from '../utils/ethiopianDate';
import EthiopianSelector from './EthiopianSelector';
import './Appointments.css';

const Appointments = () => {
  const { appointments, customers, vehicles, staff, deleteItem, addItem, updateItem, addNotification, t, language, formatDate, formatTime, requestConfirmation } = useAppContext();
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [viewDate, setViewDate] = useState(new Date().toISOString().split('T')[0]); // Default to today
  
  const permissions = currentUser?.permissions || [];
  const isCustomer = currentUser?.role === 'customer';
  const canManage = isCustomer || permissions.includes('all') || permissions.includes('appointments_manage');
  
  const [formData, setFormData] = useState({
    customerName: '', vehicleId: '', date: '', time: '09:00', reason: '', status: 'scheduled'
  });
  const [activeTab, setActiveTab] = useState('schedule'); // 'schedule' or 'requests'
  const [reschedulingId, setReschedulingId] = useState(null);

  const getFilteredAppointments = () => {
    return (appointments || []).filter(apt => {
      // 1. Role-based isolation
      if (isCustomer) {
        return String(apt.customerId) === String(currentUser.id);
      }

      // 2. Staff filtering by Tab
      if (activeTab === 'requests') {
        return apt.status === 'requested';
      }

      // 3. Staff Schedule view (only scheduled/arrived/rescheduled)
      const isVisibleStatus = ['scheduled', 'arrived', 'rescheduled'].includes(apt.status);
      if (!isVisibleStatus) return false;

      const aptDate = apt.date.split('T')[0];
      const matchesDate = aptDate === viewDate;
      const nameMatch = (apt.customerName || (customers || []).find(c => c.id === apt.customerId)?.name || '')
        .toLowerCase().includes(searchTerm.toLowerCase());
      return matchesDate && (searchTerm === '' || nameMatch);
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const filteredAppointments = getFilteredAppointments();

  const handleOpenModal = () => {
    setFormData({
      customerName: isCustomer ? currentUser.name : '', 
      vehicleId: '', 
      date: viewDate, time: '09:00', reason: '', status: 'scheduled'
    });
    setShowModal(true);
  };

  const handleCloseModal = () => setShowModal(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Find customer ID (either from current user or by matching name)
    let cId = isCustomer ? currentUser.id : '';
    let cName = formData.customerName; // Always keep the name for display

    if (!isCustomer) {
      const existingCustomer = customers.find(c => c.name.toLowerCase() === formData.customerName.toLowerCase());
      if (existingCustomer) {
        cId = existingCustomer.id;
        cName = ''; // Clear name if we have an ID
      }
    }

    const newApt = {
      id: `a${Date.now()}`,
      customerId: cId,
      customerName: cName,
      vehicleId: formData.vehicleId,
      date: `${formData.date}T${formData.time}:00`,
      reason: formData.reason,
      status: isCustomer ? 'requested' : 'scheduled',
      ownerId: currentUser?.ownerId
    };
    addItem('appointments', newApt);

    // Notify Admin/Receptionist/Manager when a customer books
    if (isCustomer) {
      (staff || []).filter(s => s.role === 'admin' || s.role === 'receptionist' || s.role === 'manager').forEach(s => {
        addNotification(
          t('appReqNotify', { name: currentUser.name, date: formatDate(formData.date), time: formData.time }),
          'info',
          s.id,
          '/appointments',
          currentUser.id
        );
      });
    }

    handleCloseModal();
  };
  const handleStatusChange = (id, newStatus) => {
    const apt = appointments.find(a => a.id === id);
    if (apt) {
      updateItem('appointments', id, { ...apt, status: newStatus });
      
      // Notify customer of status change
      if (apt.customerId) {
        const statusMessages = {
          scheduled: t('appointmentApproved'),
          rejected: t('appointmentRejected'),
          rescheduled: t('appointmentRescheduled'),
          arrived: t("Vehicle Arrived: Service is starting!")
        };
        
        if (statusMessages[newStatus]) {
          addNotification(
            statusMessages[newStatus],
            newStatus === 'rejected' ? 'warning' : 'success',
            apt.customerId,
            '/appointments',
            currentUser.id
          );
        }
      }
    }
  };

  const handleCancel = (apt) => {
    deleteItem('appointments', apt.id);
    
    // Notify Staff
    (staff || []).filter(s => s.role === 'admin' || s.role === 'receptionist' || s.role === 'manager').forEach(s => {
      addNotification(
        t('appCancelNotify', { name: currentUser.name, date: formatDate(apt.date) }),
        'warning',
        s.id,
        '/appointments',
        currentUser.id
      );
    });
  };

  const handleRescheduleSubmit = (e) => {
    e.preventDefault();
    const apt = appointments.find(a => a.id === reschedulingId);
    if (apt) {
      const newDate = `${formData.date}T${formData.time}:00`;
      updateItem('appointments', reschedulingId, { ...apt, date: newDate, status: 'rescheduled' });
      
      if (apt.customerId) {
        addNotification(
          `${t('appointmentRescheduled')} (${formatDate(formData.date)} @ ${formData.time})`,
          'info',
          apt.customerId,
          '/appointments',
          currentUser.id
        );
      }
    }
    setReschedulingId(null);
  };

  const handleDateChange = (days) => {
    const current = new Date(viewDate);
    current.setDate(current.getDate() + days);
    setViewDate(current.toISOString().split('T')[0]);
  };

  // Get customerId for vehicle filtering
  const currentCustomerId = isCustomer ? currentUser.id : ((customers || []).find(c => c.name.toLowerCase() === formData.customerName.toLowerCase())?.id || '');

  return (
    <div className="page-content appointments-page">
      <div className="page-header">
        <div className="header-title">
          <div className="icon-wrapper"><CalendarClock size={28} /></div>
          <div>
            <h1>{t('appointments')}</h1>
            <p className="subtitle">{t("Book service appointments and manage the daily schedule.")}</p>
          </div>
        </div>
        {canManage && (
          <button className="btn-primary" onClick={handleOpenModal}>
            <Plus size={18} /> {t('bookAppointment')}
          </button>
        )}
      </div>

        {!isCustomer && (
          <div className="tab-switcher" style={{ display: 'flex', gap: '20px', marginBottom: '20px', borderBottom: '1px solid var(--border)' }}>
            <button 
              className={`tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
              onClick={() => setActiveTab('schedule')}
              style={{ padding: '10px 5px', background: 'none', border: 'none', borderBottom: activeTab === 'schedule' ? '3px solid var(--primary)' : '3px solid transparent', color: activeTab === 'schedule' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer' }}
            >
              {t('scheduled')}
            </button>
            <button 
              className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
              onClick={() => setActiveTab('requests')}
              style={{ padding: '10px 5px', background: 'none', border: 'none', borderBottom: activeTab === 'requests' ? '3px solid var(--primary)' : '3px solid transparent', color: activeTab === 'requests' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {t('requested')}
              {(appointments || []).filter(a => a.status === 'requested').length > 0 && (
                <span className="count-badge" style={{ background: 'var(--danger)', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem' }}>
                  {(appointments || []).filter(a => a.status === 'requested').length}
                </span>
              )}
            </button>
          </div>
        )}

        <div className="date-nav-wrapper">
          <div className="date-nav">
            <button className="btn-outline-small" onClick={() => handleDateChange(-1)}>{t('prevDay')}</button>
            <div className="current-date-display">
              <CalendarIcon size={20} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: '700' }}>{formatDate(viewDate)}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--primary)', opacity: 0.8 }}>
                  {formatEthiopianDate(viewDate, language)}
                </span>
              </div>
            </div>
            <button className="btn-outline-small" onClick={() => handleDateChange(1)}>{t('nextDay')}</button>
          </div>
          
          <div className="date-nav-actions">
            <div className="date-picker-compact">
              <input 
                type="date" 
                value={viewDate} 
                onChange={(e) => setViewDate(e.target.value)}
                style={{ cursor: 'pointer' }}
              />
            </div>
            <button className="btn-text today-btn" onClick={() => setViewDate(new Date().toISOString().split('T')[0])}>{t('today')}</button>
          </div>
        </div>
        
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder={t('search')} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="schedule-timeline">
        {filteredAppointments.length === 0 ? (
          <div className="empty-schedule">
            <CalendarClock size={48} className="text-muted" />
            <h3>{t('noAppointments')}</h3>
            <p>{t("There are no bookings scheduled for this date.")}</p>
          </div>
        ) : (
          filteredAppointments.map(apt => {
            const customerName = apt.customerName || (customers || []).find(c => c.id === apt.customerId)?.name;
            const vehicle = (vehicles || []).find(v => v.id === apt.vehicleId);
            const timeString = formatTime(apt.date);
            
            return (
              <div className={`appointment-card status-${apt.status}`} key={apt.id}>
                <div className="apt-time">
                  <Clock size={18} />
                  <span>{timeString}</span>
                </div>
                
                <div className="apt-details-wrapper">
                  <div className="apt-main">
                    <h4>{customerName || apt.customerName || (isCustomer ? currentUser.name : (t("Unknown Customer")))}</h4>
                    <span className="vehicle-info">
                      <Car size={14} /> {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.plate})` : (t("No Vehicle Selected"))}
                    </span>
                    <p className="apt-reason">{apt.reason}</p>
                  </div>
                  
                  <div className="apt-actions">
                    <span className={`apt-status-badge ${apt.status}`}>{t(apt.status)}</span>
                    
                    {/* Admin Actions for Requested */}
                    {!isCustomer && apt.status === 'requested' && (
                      <div className="action-buttons" style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-success-small" onClick={() => handleStatusChange(apt.id, 'scheduled')}>
                          <Check size={14} /> {t('approve')}
                        </button>
                        <button className="btn-outline-danger-small" onClick={() => handleStatusChange(apt.id, 'rejected')}>
                          <X size={14} /> {t('reject')}
                        </button>
                        <button className="btn-outline-small" onClick={() => {
                          setReschedulingId(apt.id);
                          setFormData({ ...formData, date: apt.date.split('T')[0], time: apt.date.split('T')[1].substring(0,5) });
                        }}>
                          <Clock size={14} /> {t('reschedule')}
                        </button>
                      </div>
                    )}

                    {/* Standard Actions */}
                    {(apt.status === 'scheduled' || apt.status === 'rescheduled') && !isCustomer && canManage && (
                      <div className="action-buttons">
                        <button className="icon-btn-small check-btn" title={t('arrived')} onClick={() => handleStatusChange(apt.id, 'arrived')}>
                          <Check size={16} />
                        </button>
                        <button className="btn-outline-small" onClick={() => {
                          setReschedulingId(apt.id);
                          setFormData({ ...formData, date: apt.date.split('T')[0], time: apt.date.split('T')[1].substring(0,5) });
                        }}>
                          <Clock size={14} />
                        </button>
                        <button 
                          className="icon-btn-small delete-btn" 
                          title={t('deleteBtn')} 
                          onClick={() => requestConfirmation(t('confirmDeleteAppointment'), () => deleteItem('appointments', apt.id))}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                    {(apt.status === 'scheduled' || apt.status === 'requested') && isCustomer && (
                       <button 
                          className="btn-text-danger" 
                          style={{ fontSize: '0.8rem' }}
                          onClick={() => requestConfirmation(t('confirmDeleteAppointment'), () => handleCancel(apt))}
                        >
                          {t("cancel")}
                        </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{t('bookAppointment')}</h2>
              <button className="close-btn" onClick={handleCloseModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group grid-2-col">
                <div>
                  {language === 'am' ? (
                    <EthiopianSelector 
                      label={t('date')}
                      value={formData.date}
                      language={language}
                      onChange={(val) => setFormData({...formData, date: val})}
                    />
                  ) : (
                    <>
                      <label style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{t('date')} *</label>
                      <input type="date" name="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} required className="auth-input" />
                      {formData.date && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '600', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <CalendarIcon size={12} />
                          {formatEthiopianDate(formData.date, 'am')}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div>
                  <label style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{t('time')} *</label>
                  <input type="time" name="time" value={formData.time} onChange={(e) => setFormData({...formData, time: e.target.value})} required className="auth-input" />
                </div>
              </div>

              <div className="form-group">
                <label style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{t('customer')} *</label>
                <input 
                  list="customer-suggestions"
                  type="text" 
                  name="customerName" 
                  className="auth-input"
                  value={formData.customerName} 
                  onChange={(e) => setFormData({...formData, customerName: e.target.value})} 
                  required 
                  disabled={isCustomer}
                  placeholder={t("Type customer name")}
                  autoComplete="off"
                />
                {!isCustomer && (
                  <datalist id="customer-suggestions">
                    {(customers || []).map(c => <option key={c.id} value={c.name} />)}
                  </datalist>
                )}
              </div>

              <div className="form-group">
                <label style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{t('vehicle')} *</label>
                <select name="vehicleId" value={formData.vehicleId} className="auth-input" onChange={(e) => setFormData({...formData, vehicleId: e.target.value})} required>
                  <option value="">{t('selectVehicle')}</option>
                  {(vehicles || []).filter(v => v.customerId === currentCustomerId).map(v => (
                    <option key={v.id} value={v.id}>{v.year} {v.make} {v.model}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{t('reason')} *</label>
                <textarea name="reason" className="auth-input" value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} required placeholder={t("e.g. Oil change and tire rotation")} style={{ minHeight: 80, padding: 12 }}></textarea>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-text" onClick={handleCloseModal}>{t('cancel')}</button>
                <button type="submit" className="btn-primary">{t('bookAppointment')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {reschedulingId && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{t('reschedule')}</h2>
              <button className="close-btn" onClick={() => setReschedulingId(null)}>&times;</button>
            </div>
            <form onSubmit={handleRescheduleSubmit} className="modal-form">
              <div className="form-group grid-2-col">
                <div>
                  {language === 'am' ? (
                    <EthiopianSelector 
                      label={t('date')}
                      value={formData.date}
                      language={language}
                      onChange={(val) => setFormData({...formData, date: val})}
                    />
                  ) : (
                    <>
                      <label style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{t('date')} *</label>
                      <input type="date" name="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} required className="auth-input" />
                    </>
                  )}
                </div>
                <div>
                  <label style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{t('time')} *</label>
                  <input type="time" name="time" value={formData.time} onChange={(e) => setFormData({...formData, time: e.target.value})} required className="auth-input" />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-text" onClick={() => setReschedulingId(null)}>{t('cancel')}</button>
                <button type="submit" className="btn-primary">{t('reschedule')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
