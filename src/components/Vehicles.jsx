import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Car, Search, Plus, Edit2, Trash2, Calendar, Hash, Wrench, User, Navigation, MessageSquare } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Vehicles.css';

const Vehicles = () => {
  const { vehicles, repairs, customers, deleteItem, addItem, updateItem, t, language, requestConfirmation, openChatWith } = useAppContext();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ 
    customerId: '', make: '', model: '', year: new Date().getFullYear(), plate: '', mileage: '' 
  });

  React.useEffect(() => {
    if (location.state?.showAddModal) {
      handleOpenModal();
      // Clear state
      window.history.replaceState({}, document.title);
    }

    const handleSidebarAction = (e) => {
      if (e.detail?.type === 'add-vehicle') {
        handleOpenModal();
      }
    };
    window.addEventListener('sidebar-action', handleSidebarAction);
    return () => window.removeEventListener('sidebar-action', handleSidebarAction);
  }, [location.state]);

  const permissions = currentUser?.permissions || [];
  const canManage = permissions.includes('all') || permissions.includes('vehicles_manage');
  const canDelete = permissions.includes('all');

  const filteredVehicles = (vehicles || []).filter(v => {
    // Role/Permission based filtering
    if (currentUser?.role === 'mechanic') {
      const hasAssignedRepair = (repairs || []).some(r => r.vehicleId === v.id && r.mechanicId === currentUser.id);
      if (!hasAssignedRepair) return false;
    }
    if (currentUser?.role === 'customer') {
      if (v.customerId !== currentUser.id) return false;
    }

    return (v.make || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
           (v.model || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
           (v.plate || '').toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleOpenModal = (vehicle = null) => {
    if (vehicle) {
      setFormData({ 
        customerId: vehicle.customerId, make: vehicle.make, model: vehicle.model, 
        year: vehicle.year, plate: vehicle.plate, mileage: vehicle.mileage 
      });
      setEditingId(vehicle.id);
    } else {
      setFormData({ customerId: customers[0]?.id || '', make: '', model: '', year: new Date().getFullYear(), plate: '', mileage: '' });
      setEditingId(null);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => setShowModal(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingId) {
      updateItem('vehicles', editingId, formData);
    } else {
      const newVehicle = {
        id: `v${Date.now()}`,
        ...formData,
        year: parseInt(formData.year),
        mileage: parseInt(formData.mileage) || 0
      };
      addItem('vehicles', newVehicle);
    }
    handleCloseModal();
  };

  return (
    <div className="page-content vehicles-page">
      <div className="page-header">
        <div className="header-title">
          <div className="icon-wrapper"><Car size={28} /></div>
          <div>
            <h1>{t("Vehicle Details & History")}</h1>
            <p className="subtitle">{t("Manage customer vehicles and view service history.")}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {(permissions.includes('all') || permissions.includes('repairs_view')) && (
            <button className="btn-outline" onClick={() => navigate('/tracker')}>
              <Navigation size={18} /> {t("Live Map Tracking")}
            </button>
          )}
          {canManage && (
            <button className="btn-primary" onClick={() => handleOpenModal()}>
              <Plus size={18} /> {t("Add New Vehicle")}
            </button>
          )}
        </div>
      </div>

      <div className="controls-bar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder={t("Search by make, model, or plate number...")} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="table-responsive">
        <table className="modern-table">
          <thead>
            <tr>
              <th>{t("Vehicle Info")}</th>
              <th>{t('owner')}</th>
              <th>{t('plate')}</th>
              <th>{t("Mileage")}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredVehicles.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-6">{t("No vehicles found.")}</td>
              </tr>
            ) : (
              filteredVehicles.map(vehicle => {
                const owner = (customers || []).find(c => c.id === vehicle.customerId);
                return (
                  <tr key={vehicle.id}>
                    <td>
                      <div className="vehicle-info-cell">
                        <div className="vehicle-avatar"><Car size={20} /></div>
                        <div>
                          <strong>{vehicle.year} {vehicle.make} {vehicle.model}</strong>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="td-content">
                        <User size={14} className="td-icon" />
                        <span>{owner ? owner.name : (t("Unknown Owner"))}</span>
                      </div>
                    </td>
                    <td>
                      <span className="plate-badge">{vehicle.plate}</span>
                    </td>
                    <td>{(vehicle.mileage || 0).toLocaleString()} {t('kilometersShort')}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="icon-btn-small" onClick={() => navigate('/tracker')} title={t("Live Track")}>
                          <Navigation size={16} />
                        </button>
                        <button className="icon-btn-small chat-btn" style={{ color: 'white', background: 'var(--primary)' }} onClick={() => owner && openChatWith(owner)} title={t('chat')}>
                          <MessageSquare size={16} />
                        </button>
                        {canManage && (
                          <button className="icon-btn-small" onClick={() => handleOpenModal(vehicle)} title={t('edit')}>
                            <Edit2 size={16} />
                          </button>
                        )}
                        <button className="icon-btn-small" title={t("History")}>
                          <Wrench size={16} />
                        </button>
                        {canDelete && (
                          <button 
                            className="icon-btn-small delete-btn" 
                            onClick={() => requestConfirmation(t('confirmDeleteVehicle'), () => deleteItem('vehicles', vehicle.id))} 
                            title={t('deleteBtn')}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingId ? (t("Edit Vehicle")) : (t("Register Vehicle"))}</h2>
              <button className="close-btn" onClick={handleCloseModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group grid-2-col">
                <div>
                  <label>{t('make')} *</label>
                  <input type="text" name="make" value={formData.make} onChange={handleChange} required placeholder={t("Toyota, Honda, etc.")} />
                </div>
                <div>
                  <label>{t('model')} *</label>
                  <input type="text" name="model" value={formData.model} onChange={handleChange} required placeholder={t("Camry, Civic, etc.")} />
                </div>
              </div>
              <div className="form-group grid-2-col">
                <div>
                  <label>{t('year')} *</label>
                  <input type="number" name="year" value={formData.year} onChange={handleChange} required min="1900" max={new Date().getFullYear() + 1} />
                </div>
                <div>
                  <label>{t("Mileage")}</label>
                  <input type="number" name="mileage" value={formData.mileage} onChange={handleChange} placeholder={t("e.g. 45000")} />
                </div>
              </div>
              <div className="form-group">
                <label>{t('plate')} *</label>
                <input type="text" name="plate" value={formData.plate} onChange={handleChange} required placeholder={t("ABC-123")} className="uppercase-input" />
              </div>
              <div className="form-group">
                <label>{t('owner')} ({t('customer')}) *</label>
                <select name="customerId" value={formData.customerId} onChange={handleChange} required>
                  <option value="" disabled>{t("Select a customer")}</option>
                  {(customers || []).map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
                </select>
              </div>
              
              <div className="modal-actions">
                <button type="button" className="btn-text" onClick={handleCloseModal}>{t('cancel')}</button>
                <button type="submit" className="btn-primary">
                  {editingId ? t('save') : (t("Register Vehicle"))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vehicles;
