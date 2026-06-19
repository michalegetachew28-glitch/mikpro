import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { BriefcaseBusiness, Plus, Edit2, Trash2, MessageSquare, Navigation, Shield, UserX, UserCheck, Settings2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PhoneInput from './PhoneInput';
import './Staff.css';

const ALL_PERMISSIONS = [
  'repairs_view', 'repairs_manage',
  'customers_manage', 'vehicles_manage',
  'appointments_manage', 'billing_manage',
  'inventory_manage', 'staff_manage',
  'activity_view'
];

const STAFF_SYNC_ROLES = ['admin', 'mechanic', 'receptionist', 'cashier', 'storekeeper', 'manager', 'inventoryManager'];

const Staff = () => {
  const { 
    deleteItem, addItem, updateItem, openChatWith, t, language, logActivity, requestConfirmation, customers,
    salaries, salaryPayments, attendance, repairs, appointments, notifications, messages,
    setSalaries, setSalaryPayments, setAttendance, setRepairs, setAppointments, setNotifications, setMessages
  } = useAppContext();
  const navigate = useNavigate();
  const { register, currentUser, getAccounts, updateOtherAccount, deleteAccount } = useAuth();

  const [showModal, setShowModal] = useState(false);
  const [showPermModal, setShowPermModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [targetAccount, setTargetAccount] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('staff'); // staff, customers
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [formData, setFormData] = useState({
    name: '', role: 'mechanic', phone: '', address: '', password: '', confirmPassword: ''
  });
  const [isPhoneValid, setIsPhoneValid] = useState(true);

  // Fetch all accounts from AuthContext and filter by ownerId
  const allAccounts = useMemo(() => {
    const accs = getAccounts() || [];
    return accs.filter(a => a && a.ownerId === currentUser?.ownerId && a.id !== currentUser?.id && a.status !== 'deleted');
  }, [getAccounts, currentUser?.ownerId, currentUser?.id, refreshTrigger]);

  const filteredUsers = useMemo(() => {
    const list = allAccounts || [];
    if (activeTab === 'staff') {
      return list.filter(a => a && ['admin', 'mechanic', 'receptionist', 'cashier', 'storekeeper', 'manager', 'inventoryManager'].includes(a.role));
    }
    return list.filter(a => a && a.role === 'customer');
  }, [allAccounts, activeTab]);

  const handleOpenModal = (person = null) => {
    setError('');
    if (person) {
      setFormData({
        name: person.name, role: person.role, phone: person.phone || '',
        address: person.address || '',
        password: '', confirmPassword: ''
      });
      setEditingId(person.id);
    } else {
      setFormData({
        name: '', role: 'mechanic', phone: '',
        address: '',
        password: '', confirmPassword: ''
      });
      setEditingId(null);
    }
    setShowModal(true);
  };

  const handleOpenPermModal = (person) => {
    setTargetAccount(person);
    setShowPermModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setShowPermModal(false);
    setTargetAccount(null);
  };

  const handleToggleStatus = (person) => {
    if (!person?.id) return;
    try {
      const newStatus = person.status === 'inactive' ? 'active' : 'inactive';
      updateOtherAccount(person.id, { status: newStatus });
      logActivity(`Status Change`, `User: ${person.name || person.id} is now ${newStatus}`);
      // AppContext `staff` mirrors employees only — never write customers into that array
      if (person.role && STAFF_SYNC_ROLES.includes(person.role)) {
        updateItem('staff', person.id, { status: newStatus });
      }
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error('[Staff] handleToggleStatus failed', err);
      setError('Could not update status. Check the browser console for details.');
    }
  };

  const handleTogglePermission = (perm) => {
    if (!targetAccount) return;
    const hasPerm = targetAccount.permissions?.includes(perm);
    let newPerms;
    if (hasPerm) {
      newPerms = targetAccount.permissions.filter(p => p !== perm);
    } else {
      newPerms = [...(targetAccount.permissions || []), perm];
    }

    updateOtherAccount(targetAccount.id, { permissions: newPerms });
    setTargetAccount(prev => ({ ...prev, permissions: newPerms }));
  };
  // Cascade delete: remove employee and all related data across the app
  const handleDeletePerson = (person) => {
    const id = person.id;
    const isCustomer = person.role === 'customer';

    if (isCustomer) {
      deleteItem('customers', id);
      logActivity('Deleted Customer', `${person.name} removed.`);
    } else {
      // 1. Permanently block login in AuthContext
      deleteAccount(id);

      // 2. Remove from operational staff list
      deleteItem('staff', id);

      // 3. Purge financial records (Salaries & Payments)
      if (Array.isArray(salaries)) {
        salaries.filter(s => String(s.employeeId) === String(id))
          .forEach(s => deleteItem('salaries', s.id));
      }
      if (Array.isArray(salaryPayments)) {
        salaryPayments.filter(p => String(p.employeeId) === String(id))
          .forEach(p => deleteItem('salaryPayments', p.id));
      }

      // 4. Purge attendance logs
      if (Array.isArray(attendance)) {
        setAttendance(prev => prev.filter(a => String(a.staffId) !== String(id)));
      }

      // 5. Safe unassign from repair orders
      if (Array.isArray(repairs)) {
        repairs.forEach(r => {
          if (String(r.mechanicId) === String(id)) {
            updateItem('repairs', r.id, { mechanicId: null, mechanicName: '' });
          }
        });
      }

      // 6. Safe unassign from appointments
      if (Array.isArray(appointments)) {
        appointments.forEach(a => {
          if (String(a.staffId) === String(id) || String(a.mechanicId) === String(id)) {
            updateItem('appointments', a.id, { staffId: null, mechanicId: null, mechanicName: '' });
          }
        });
      }

      // 7. Cleanup communications
      if (Array.isArray(messages)) {
        setMessages(prev => prev.filter(m => String(m.senderId) !== String(id) && String(m.recipientId) !== String(id)));
      }
      if (Array.isArray(notifications)) {
        setNotifications(prev => prev.filter(n => String(n.userId) !== String(id) || String(n.senderId) === String(id)));
      }

      logActivity('Full Cascade Delete', `Employee ${person.name} and all associated records removed.`);
    }

    setRefreshTrigger(prev => prev + 1);
  };


  const handleSubmit = (e) => {
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
        name: formData.name, role: formData.role, phone: formData.phone, address: formData.address
      };
      if (formData.password) {
        updates.password = formData.password;
      }

      updateOtherAccount(editingId, updates);
      if (formData.role === 'customer') {
        const inCustomers = Array.isArray(customers) && customers.some(c => c && String(c.id) === String(editingId));
        if (inCustomers) {
          updateItem('customers', editingId, {
            name: formData.name, phone: formData.phone, address: formData.address
          });
        }
      } else if (STAFF_SYNC_ROLES.includes(formData.role)) {
        updateItem('staff', editingId, {
          name: formData.name, role: formData.role, phone: formData.phone, address: formData.address
        });
      }
      logActivity(`Updated User`, `Name: ${formData.name}, Role: ${formData.role}`);
      setRefreshTrigger(prev => prev + 1);
      handleCloseModal();
    } else {
      if (!formData.phone || !formData.password) {
        setError(t("Phone and password are required for new accounts."));
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setError(t('passwordsDoNotMatch'));
        return;
      }

      const result = register(
        formData.name,
        null,
        formData.phone,
        formData.password,
        formData.role,
        currentUser?.garageName,
        currentUser?.ownerId,
        false
      );

      if (result?.success && result.user?.id) {
        if (formData.role !== 'customer' && STAFF_SYNC_ROLES.includes(formData.role)) {
          const newStaff = {
            id: result.user.id,
            name: formData.name || result.user.name || 'Staff',
            role: formData.role,
            phone: formData.phone || result.user.phone || '',
            address: formData.address || '',
            status: 'active'
          };
          addItem('staff', newStaff);
        }
        logActivity(`Added User`, `Name: ${formData.name}, Role: ${formData.role}`);
        setRefreshTrigger(prev => prev + 1);
        handleCloseModal();
      } else {
        setError(result?.message || 'Registration failed. Check the console for details.');
      }
    }
  };

  return (
    <div className="page-content staff-page">
      <div className="page-header">
        <div className="header-title">
          <div className="icon-wrapper"><BriefcaseBusiness size={28} /></div>
          <div>
            <h1>{t('staff')}</h1>
            <p className="subtitle">
              {t("Manage mechanics, admins, and permissions securely.")}
            </p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => handleOpenModal()}>
          <Plus size={18} /> {t("Add Employee")}
        </button>
      </div>

      <div className="billing-tabs" style={{ marginBottom: '24px' }}>
        <button
          className={`billing-tab ${activeTab === 'staff' ? 'active' : ''}`}
          onClick={() => setActiveTab('staff')}
        >
          {t("Employees")}
        </button>
        <button
          className={`billing-tab ${activeTab === 'customers' ? 'active' : ''}`}
          onClick={() => setActiveTab('customers')}
        >
          {t('customers')}
        </button>
      </div>

      <div className="staff-grid">
        {filteredUsers.filter(Boolean).map(person => (
          <div className={`staff-card ${person.status === 'inactive' ? 'inactive' : ''}`} key={person.id || person.phone}>
            <div className="staff-actions">
              <button
                className="icon-btn-small"
                onClick={() => handleToggleStatus(person)}
                title={person.status === 'inactive' ? 'Activate' : 'Deactivate'}
                style={{ color: person.status === 'inactive' ? 'var(--success)' : 'var(--danger)' }}
              >
                {person.status === 'inactive' ? <UserCheck size={16} /> : <UserX size={16} />}
              </button>
              <button className="icon-btn-small" onClick={() => handleOpenPermModal(person)} title="Manage Permissions">
                <Shield size={16} />
              </button>
              <button className="icon-btn-small" onClick={() => handleOpenModal(person)} title={t('edit')}>
                <Edit2 size={16} />
              </button>
              <button
                className="icon-btn-small delete-btn"
                onClick={() => requestConfirmation(t('confirmDeleteStaff'), () => handleDeletePerson(person))}
                disabled={person.id === currentUser?.id}
                title={t('deleteBtn')}
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="staff-avatar">
              {person.profilePic ? (
                <img src={person.profilePic} alt={person.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              ) : (
                String(person.name || '?').charAt(0).toUpperCase()
              )}
              <div className={`status-indicator status-${person.status || 'active'}`}></div>
            </div>

            <div className="staff-info">
              <h3>{person.name}</h3>
              <p className="staff-phone">{person.phone}</p>
              <span className={`role-badge role-${person.role}`}>{t(person.role)}</span>

              <div className="permissions-tag-cloud">
                {(person.permissions || []).map(p => (
                  <span key={p} className="perm-tag">{p}</span>
                ))}
              </div>
            </div>

            <div className="staff-footer" style={{ marginTop: '20px', display: 'flex', gap: '8px', width: '100%', justifyContent: 'center' }}>
              <button className="btn-outline-small" onClick={() => navigate('/tracker')} style={{ flex: 1 }}>
                <Navigation size={14} /> Track
              </button>
              <button className="btn-primary-small" onClick={() => openChatWith(person)} style={{ flex: 1 }}>
                <MessageSquare size={14} /> Chat
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingId ? (t("Edit Account")) : (t("New Account"))}</h2>
              <button className="close-btn" onClick={handleCloseModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              {error && <div className="auth-error" style={{ marginBottom: '15px' }}>{error}</div>}

              <div className="form-group">
                <label>{t('name')} *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>

              <div className="form-group">
                <label>{t('phone')} *</label>
                <PhoneInput
                  value={formData.phone}
                  onChange={(val, valid) => {
                    setFormData({ ...formData, phone: val });
                    setIsPhoneValid(valid);
                  }}
                  required={true}
                />
              </div>

              <div className="form-group">
                <label>{t('address')}</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder={t("Flat/Street/Area")}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label>{editingId ? (t("New Password")) : t('password')} {!editingId && '*'}</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingId}
                    placeholder="••••••••"
                  />
                </div>
                <div className="form-group">
                  <label>{t('confirmPassword')} {!editingId && '*'}</label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required={!editingId}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>{t("Role")} *</label>
                <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} required>
                  <option value="mechanic">{t('mechanic')}</option>
                  <option value="receptionist">{t('receptionist')}</option>
                  <option value="cashier">{t('cashier')}</option>
                  <option value="storekeeper">{t('storekeeper')}</option>
                  <option value="inventoryManager">{t('inventoryManager')}</option>
                  <option value="manager">{t('manager') || 'Manager'}</option>
                  <option value="admin">{t('admin')}</option>
                  <option value="customer">{t('customer')}</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-text" onClick={handleCloseModal}>{t('cancel')}</button>
                <button type="submit" className="btn-primary">{editingId ? t('save') : t('add')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPermModal && targetAccount && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Shield size={20} color="var(--primary)" />
                <h2>Manage Permissions</h2>
              </div>
              <button className="close-btn" onClick={handleCloseModal}>&times;</button>
            </div>
            <div className="modal-body" style={{ padding: '20px 0' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Assigning permissions to <strong>{targetAccount.name}</strong>
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {ALL_PERMISSIONS.map(perm => {
                  const isActive = targetAccount.permissions?.includes(perm) || targetAccount.permissions?.includes('all');
                  return (
                    <div
                      key={perm}
                      className={`perm-item ${isActive ? 'active' : ''}`}
                      onClick={() => handleTogglePermission(perm)}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        background: isActive ? 'rgba(67, 97, 238, 0.05)' : 'transparent',
                        borderColor: isActive ? 'var(--primary)' : 'var(--border)'
                      }}
                    >
                      <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{perm.replace('_', ' ')}</span>
                      <div style={{
                        width: '40px',
                        height: '20px',
                        borderRadius: '10px',
                        background: isActive ? 'var(--primary)' : '#e2e8f0',
                        position: 'relative',
                        transition: 'var(--transition)'
                      }}>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          background: 'white',
                          position: 'absolute',
                          top: '2px',
                          left: isActive ? '22px' : '2px',
                          transition: 'var(--transition)'
                        }}></div>
                      </div>
                    </div>
                  );
                })}

                <div
                  className={`perm-item ${targetAccount.permissions?.includes('all') ? 'active' : ''}`}
                  onClick={() => handleTogglePermission('all')}
                  style={{
                    padding: '10px 16px',
                    marginTop: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: targetAccount.permissions?.includes('all') ? 'rgba(247, 37, 133, 0.05)' : 'transparent'
                  }}
                >
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent)' }}>SUPER ADMIN (ALL)</span>
                  <Settings2 size={18} color="var(--accent)" />
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={handleCloseModal} style={{ width: '100%' }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Staff;
