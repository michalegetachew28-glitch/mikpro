import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Users, Search, Plus, Edit2, Trash2, Phone, Mail, MapPin, Car, X, Navigation, MessageSquare } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import PhoneInput from './PhoneInput';
import './Customers.css';

const Customers = () => {
  const { customers, vehicles, deleteItem, addItem, updateItem, openChatWith, t, language, requestConfirmation } = useAppContext();
  const { register, currentUser, updateOtherAccount } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showVehiclesModal, setShowVehiclesModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(true);
  const [formData, setFormData] = useState({ 
    name: '', phone: '', email: '', address: '', password: '', confirmPassword: '' 
  });

  React.useEffect(() => {
    if (location.state?.showAddModal) {
      handleOpenModal();
      // Clear state
      window.history.replaceState({}, document.title);
    }

    const handleSidebarAction = (e) => {
      if (e.detail?.type === 'add-customer') {
        handleOpenModal();
      }
    };
    window.addEventListener('sidebar-action', handleSidebarAction);
    return () => window.removeEventListener('sidebar-action', handleSidebarAction);
  }, [location.state]);

  // ── Vehicle Registration State ──
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [vehicleFormData, setVehicleFormData] = useState({
    make: '', model: '', year: new Date().getFullYear(), plate: '', mileage: ''
  });
  const [vError, setVError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const permissions = currentUser?.permissions || [];
  const canManage = permissions.includes('all') || permissions.includes('customers_manage');
  const canDelete = permissions.includes('all');

  const filteredCustomers = (customers || []).filter(c =>
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone || '').includes(searchTerm) ||
    (c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (customer = null) => {
    setError('');
    if (customer) {
      setFormData({ 
        name: customer.name, 
        phone: customer.phone, 
        email: customer.email || '', 
        address: customer.address || '',
        password: '',
        confirmPassword: ''
      });
      setEditingId(customer.id);
    } else {
      setFormData({ name: '', phone: '', email: '', address: '', password: '', confirmPassword: '' });
      setEditingId(null);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => setShowModal(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isPhoneValid) {
      setError(t("Please enter a valid phone number."));
      return;
    }

    if (editingId) {
      if (formData.password && formData.password !== formData.confirmPassword) {
        setError(t('passwordsDoNotMatch'));
        return;
      }

      const updates = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        address: formData.address
      };

      if (formData.password) {
        updates.password = formData.password;
      }

      try {
        await updateItem('customers', editingId, updates);
        handleCloseModal();
      } catch (err) {
        setError(err.message || t("failedToSyncDatabase"));
      }
    } else {
      // Create auth account for the customer
      if (!formData.password) {
        setError(t("Password is required for new customers."));
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError(t('passwordsDoNotMatch'));
        return;
      }

      try {
        await addItem('customers', {
          name: formData.name,
          email: formData.email || '',
          phone: formData.phone,
          password: formData.password,
          address: formData.address || ''
        });
        handleCloseModal();
      } catch (err) {
        setError(err.message || t("failedToSyncDatabase"));
      }
    }
  };

  const customerVehicles = selectedCustomer
    ? vehicles.filter(v => v.customerId === selectedCustomer.id)
    : [];

  const handleViewVehicles = (customer) => {
    setSelectedCustomer(customer);
    setShowVehiclesModal(true);
  };

  const handleOpenAddVehicle = (customer) => {
    setSelectedCustomer(customer);
    setVehicleFormData({
      make: '', model: '', year: new Date().getFullYear(), plate: '', mileage: ''
    });
    setVError('');
    setShowAddVehicleModal(true);
  };

  const handleAddVehicleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    
    const newVehicle = {
      customerId: selectedCustomer.id,
      ...vehicleFormData,
      year: parseInt(vehicleFormData.year),
      mileage: parseInt(vehicleFormData.mileage) || 0
    };
    
    try {
      await addItem('vehicles', newVehicle);
      setShowAddVehicleModal(false);
      addNotification(t("Vehicle registered successfully!"), 'success');
    } catch (err) {
      setVError(err.message || t("failedToSyncDatabase"));
    }
  };

  const initiateRepairOrder = (customer) => {
    navigate('/repairs', { state: { preselectCustomerId: customer.id } });
  };

  return (
    <div className="page-content customers-page">
      <div className="page-header">
        <div className="header-title">
          <div className="icon-wrapper"><Users size={28} /></div>
          <div>
            <h1>{t('customers')}</h1>
            <p className="subtitle">{t("Manage client details and contact information.")}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {(permissions.includes('all') || permissions.includes('repairs_view') || currentUser?.role === 'cashier') && (
            <button className="btn-outline" onClick={() => navigate('/tracker')}>
              <Navigation size={18} /> {t("Live Map Tracking")}
            </button>
          )}
          {canManage && (
            <button className="btn-primary" onClick={() => handleOpenModal()}>
              <Plus size={18} /> {t("Add New Customer")}
            </button>
          )}
        </div>
      </div>

      <div className="controls-bar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder={t("Search by name, phone, or email...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="customers-grid">
        {filteredCustomers.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
            <Users size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p>{t("No customers found.")}</p>
          </div>
        ) : (
          filteredCustomers.map(customer => {
            const vehicleCount = vehicles.filter(v => v.customerId === customer.id).length;
            return (
              <div className="customer-card" key={customer.id}>
                <div className="card-top">
                  <div className="customer-avatar">
                    {customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="action-buttons">
                    <button className="icon-btn-small chat-btn" style={{ color: 'white', background: 'var(--primary)' }} title={t('chat')} onClick={() => openChatWith(customer)}>
                      <MessageSquare size={16} />
                    </button>
                    {(permissions.includes('all') || permissions.includes('repairs_manage')) && currentUser?.role !== 'mechanic' && currentUser?.role !== 'cashier' && (
                      <button 
                        className="icon-btn-small finish-btn" 
                        style={{ background: 'var(--success)', color: 'white', borderColor: 'var(--success)' }}
                        title={t('Create Repair Order')} 
                        onClick={() => initiateRepairOrder(customer)}
                      >
                        <Plus size={16} />
                      </button>
                    )}
                    {canManage && (
                      <button className="icon-btn-small edit-btn" onClick={() => handleOpenModal(customer)}>
                        <Edit2 size={16} />
                      </button>
                    )}
                    {canDelete && (
                      <button 
                        className="icon-btn-small delete-btn" 
                        onClick={() => requestConfirmation(t('confirmDeleteCustomer'), () => deleteItem('customers', customer.id))}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="customer-name">{customer.name}</h3>

                <div className="customer-details">
                  <div className="detail-item">
                    <Phone size={14} className="detail-icon" />
                    <span>{customer.phone}</span>
                  </div>
                  <div className="detail-item">
                    <span>{customer.email || t('notAvailable')}</span>
                  </div>
                  <div className="detail-item">
                    <div className="detail-row"><MapPin size={16} /> 
                  {customer.address ? (
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                      {customer.address}
                    </a>
                  ) : <span>—</span>}
                </div>
                  </div>
                </div>

                <div className="card-actions">
                  <button className="btn-outline mt-16" onClick={() => handleViewVehicles(customer)}>
                    <Car size={14} style={{ marginRight: 6 }} />
                    {t('viewVehiclesCount', { count: vehicleCount })}
                  </button>
                  <button className="btn-primary mt-16" style={{ background: 'var(--accent)' }} onClick={() => handleOpenAddVehicle(customer)}>
                    <Plus size={14} style={{ marginRight: 6 }} />
                    {t("Add Vehicle")}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Customer Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-lg">
            <div className="modal-header">
              <h2>{editingId ? (t("Edit Customer")) : (t("Add New Customer"))}</h2>
              <button className="close-btn" onClick={handleCloseModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form modern-form">
              {error && <div className="auth-error" style={{ marginBottom: '15px' }}>{error}</div>}
              
              <div className="form-section">
                <h4 className="section-title"><Users size={16} /> {t("Basic Information")}</h4>
                <div className="form-grid">
                  <div className="form-group has-icon">
                    <label>{t('name')} *</label>
                    <div className="input-wrap">
                      <Users size={18} className="input-icon" />
                      <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder={t("e.g. John Doe")} />
                    </div>
                  </div>
                  <div className="form-group has-icon">
                    <label>{t('phone')} *</label>
                    <div className="input-wrap">
                      <PhoneInput 
                        value={formData.phone}
                        onChange={(val, valid) => {
                          setFormData(prev => ({ ...prev, phone: val }));
                          setIsPhoneValid(valid);
                        }}
                        required={true}
                      />
                    </div>
                  </div>
                  <div className="form-group has-icon">
                    <label>{t('email')}</label>
                    <div className="input-wrap">
                      <Mail size={18} className="input-icon" />
                      <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder={t("e.g. info@example.com")} />
                    </div>
                  </div>
                  <div className="form-group has-icon">
                    <label>{t('address')}</label>
                    <div className="input-wrap">
                      <MapPin size={18} className="input-icon" />
                      <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder={t("e.g. Bole, Addis Ababa")} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h4 className="section-title">
                  <i className="fa fa-lock" style={{ marginRight: 8 }}></i>
                  {t("Access Credentials")}
                </h4>
                <div className="form-grid">
                  <div className="form-group has-icon">
                    <label>{editingId ? (t("New Password")) : t('password')} {!editingId && '*'}</label>
                    <div className="input-wrap">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        name="password" 
                        value={formData.password} 
                        onChange={handleChange} 
                        required={!editingId} 
                        placeholder="••••••••" 
                      />
                      <button type="button" className="pass-toggle" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? "🙈" : "👁️"}
                      </button>
                    </div>
                  </div>
                  <div className="form-group has-icon">
                    <label>{t('confirmPassword')} {!editingId && '*'}</label>
                    <div className="input-wrap">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        name="confirmPassword" 
                        value={formData.confirmPassword} 
                        onChange={handleChange} 
                        required={!editingId} 
                        placeholder="••••••••" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-actions mt-24">
                <button type="button" className="btn-text" onClick={handleCloseModal}>{t('cancel')}</button>
                <button type="submit" className="btn-primary">
                  {editingId ? t('save') : t('add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Vehicle Modal */}
      {showAddVehicleModal && selectedCustomer && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>
                <Car size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                {t("Add Vehicle")} — {selectedCustomer.name}
              </h2>
              <button className="close-btn" onClick={() => setShowAddVehicleModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddVehicleSubmit} className="modal-form">
              <div className="form-group">
                <label>{t('make')} *</label>
                <input 
                  type="text" 
                  value={vehicleFormData.make} 
                  onChange={e => setVehicleFormData({...vehicleFormData, make: e.target.value})} 
                  required 
                  placeholder={t("e.g. Toyota")} 
                />
              </div>
              <div className="form-group">
                <label>{t('model')} *</label>
                <input 
                  type="text" 
                  value={vehicleFormData.model} 
                  onChange={e => setVehicleFormData({...vehicleFormData, model: e.target.value})} 
                  required 
                  placeholder={t("e.g. Corolla")} 
                />
              </div>
              <div className="form-grid grid-2-col">
                <div className="form-group">
                  <label>{t('year')} *</label>
                  <input 
                    type="number" 
                    value={vehicleFormData.year} 
                    onChange={e => setVehicleFormData({...vehicleFormData, year: e.target.value})} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>{t('mileage')}</label>
                  <input 
                    type="number" 
                    value={vehicleFormData.mileage} 
                    onChange={e => setVehicleFormData({...vehicleFormData, mileage: e.target.value})} 
                  />
                </div>
              </div>
              <div className="form-group">
                <label>{t('plate')} *</label>
                <input 
                  type="text" 
                  value={vehicleFormData.plate} 
                  onChange={e => setVehicleFormData({...vehicleFormData, plate: e.target.value.toUpperCase()})} 
                  required 
                  placeholder="PLATE-123"
                  className="uppercase-input"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-text" onClick={() => setShowAddVehicleModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn-primary">{t("Register Vehicle")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Vehicles Modal */}
      {showVehiclesModal && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowVehiclesModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <Car size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                {t('vehiclesUser', { name: selectedCustomer.name })}
              </h2>
              <button className="close-btn" onClick={() => setShowVehiclesModal(false)}>&times;</button>
            </div>

            {customerVehicles.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <Car size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                <p>{t("No vehicles registered for this customer.")}</p>
                <p style={{ fontSize: '0.85rem', marginTop: 8 }}>
                  {t("Go to the Vehicles page to register one.")}
                </p>
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {customerVehicles.map(v => (
                  <div key={v.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '14px 0',
                    borderBottom: '1px solid var(--border)'
                  }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: 'rgba(67,97,238,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primary)',
                      flexShrink: 0
                    }}>
                      <Car size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {v.year} {v.make} {v.model}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        {t("Plate")}: <strong>{v.plate}</strong>
                        {v.mileage ? ` · ${Number(v.mileage).toLocaleString()} ${t('kilometersShort')}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn-text" onClick={() => setShowVehiclesModal(false)}>{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
