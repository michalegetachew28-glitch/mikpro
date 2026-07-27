import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Car, Search, Plus, Edit2, Trash2, Calendar, Hash, Wrench, User, Navigation, MessageSquare } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SkeletonListPage } from './SkeletonLoader';
import './Vehicles.css';

const APPROVED_REGIONS = [
  { name: 'Addis Ababa',      abbreviation: 'AA', amharic: 'አአ'  },
  { name: 'Oromia',           abbreviation: 'OR', amharic: 'ኦሮ'  },
  { name: 'Amhara',           abbreviation: 'AM', amharic: 'አማ'  },
  { name: 'Tigray',           abbreviation: 'TG', amharic: 'ትግ'  },
  { name: 'Sidama',           abbreviation: 'SD', amharic: 'ሲዳ' },
  { name: 'South Ethiopia',   abbreviation: 'SE', amharic: 'ደኢ'  },
  { name: 'Somali',           abbreviation: 'SM', amharic: 'ሶማ' },
  { name: 'Afar',             abbreviation: 'AF', amharic: 'አፋ'  },
  { name: 'Benishangul-Gumuz',abbreviation: 'BG', amharic: 'ቤጉ'  },
  { name: 'Gambela',          abbreviation: 'GB', amharic: 'ጋም'  },
  { name: 'Harari',           abbreviation: 'HR', amharic: 'ሐረ'  },
  { name: 'Dire Dawa',        abbreviation: 'DR', amharic: 'ድሬ'  },
];

const CODES = [1, 2, 3, 4, 5];

const Vehicles = () => {
  const { vehicles, repairs, customers, deleteItem, addItem, updateItem, t, language, requestConfirmation, openChatWith, isSyncing, isInitialLoadComplete } = useAppContext();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ 
    customerId: '', make: '', model: '', year: new Date().getFullYear(), plate: '', mileage: '',
    regionName: 'Addis Ababa', regionAbbreviation: 'AA', regionCode: 1, amharicLetters: 'አአ', vehicleNumber: ''
  });

  React.useEffect(() => {
    if (location.state?.showAddModal) {
      handleOpenModal();
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
    if (currentUser?.role === 'mechanic') {
      const hasAssignedRepair = (repairs || []).some(r => r.vehicleId === v.id && r.mechanicId === currentUser.id);
      if (!hasAssignedRepair) return false;
    }
    if (currentUser?.role === 'customer') {
      if (v.customerId !== currentUser.id) return false;
    }

    const owner = (customers || []).find(c => c.id === v.customerId);
    const ownerName = owner ? owner.name.toLowerCase() : '';
    const query = searchTerm.toLowerCase();

    return (v.make || '').toLowerCase().includes(query) || 
           (v.model || '').toLowerCase().includes(query) ||
           (v.plate || '').toLowerCase().includes(query) ||
           (v.regionName || '').toLowerCase().includes(query) ||
           (v.regionAbbreviation || '').toLowerCase().includes(query) ||
           (v.vehicleNumber || '').toLowerCase().includes(query) ||
           String(v.regionCode || '').includes(query) ||
           ownerName.includes(query);
  });

  const handleOpenModal = (vehicle = null) => {
    setErrorMsg('');
    if (vehicle) {
      const fixedAbbrev = vehicle.regionAbbreviation === 'DD' ? 'DR' : (vehicle.regionAbbreviation || 'AA');
      const regionMatch = APPROVED_REGIONS.find(r => r.abbreviation === fixedAbbrev);
      setFormData({ 
        customerId: vehicle.customerId, 
        make: vehicle.make, 
        model: vehicle.model, 
        year: vehicle.year, 
        plate: vehicle.plate, 
        mileage: vehicle.mileage,
        regionName: regionMatch ? regionMatch.name : (vehicle.regionName || 'Addis Ababa'),
        regionAbbreviation: fixedAbbrev,
        regionCode: vehicle.regionCode || 1,
        amharicLetters: vehicle.amharicLetters || (regionMatch ? regionMatch.amharic : 'አአ'),
        vehicleNumber: vehicle.vehicleNumber || ''
      });
      setEditingId(vehicle.id);
    } else {
      const defaultRegion = APPROVED_REGIONS[0]; // Addis Ababa
      setFormData({ 
        customerId: customers[0]?.id || '', 
        make: '', 
        model: '', 
        year: new Date().getFullYear(), 
        plate: '', 
        mileage: '',
        regionName: defaultRegion.name,
        regionAbbreviation: defaultRegion.abbreviation,
        regionCode: 1,
        amharicLetters: defaultRegion.amharic,
        vehicleNumber: ''
      });
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
    setErrorMsg('');

    // --- Validation ---
    if (!formData.customerId) {
      setErrorMsg('Please select a customer.');
      return;
    }

    if (!formData.model || !formData.model.trim()) {
      setErrorMsg('Vehicle model is required.');
      return;
    }

    const targetAbbrev = formData.regionAbbreviation === 'DD' ? 'DR' : formData.regionAbbreviation;
    const regionMatch = APPROVED_REGIONS.find(r => r.abbreviation === targetAbbrev);
    if (!regionMatch) {
      setErrorMsg('Please select a valid region.');
      return;
    }

    const codeVal = parseInt(formData.regionCode, 10);
    if (isNaN(codeVal) || codeVal < 1 || codeVal > 5) {
      setErrorMsg('Region code must be between 1 and 5.');
      return;
    }

    if (!formData.vehicleNumber || !/^\d+$/.test(formData.vehicleNumber.trim())) {
      setErrorMsg('Vehicle number is required and must contain only digits.');
      return;
    }

    // amharicLetters is auto-filled from region; ensure it's set
    const amharic = formData.amharicLetters || regionMatch.amharic;

    const constructedPlate = `${regionMatch.abbreviation} ${codeVal} ${amharic} ${formData.vehicleNumber.trim()}`;

    // Front-end duplicate check (handles both plate and plateNumber fields)
    const duplicate = (vehicles || []).some(v => {
      if (v.id === editingId) return false;
      const vPlate = (v.plate || v.plateNumber || '').toUpperCase().replace(/\s+/g, '');
      return vPlate === constructedPlate.toUpperCase().replace(/\s+/g, '');
    });

    if (duplicate) {
      setErrorMsg('A vehicle with this plate number already exists.');
      return;
    }

    const updatedFormData = {
      ...formData,
      regionAbbreviation: regionMatch.abbreviation,
      regionName: regionMatch.name,
      regionCode: codeVal,
      amharicLetters: amharic,
      vehicleNumber: formData.vehicleNumber.trim(),
      plate: constructedPlate,
      year: parseInt(formData.year),
      mileage: parseInt(formData.mileage) || 0
    };

    try {
      setSubmitting(true);
      if (editingId) {
        await updateItem('vehicles', editingId, updatedFormData);
      } else {
        const newVehicle = {
          id: `v${Date.now()}`,
          ...updatedFormData
        };
        await addItem('vehicles', newVehicle);
      }
      handleCloseModal();
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to save vehicle. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isSyncing && !isInitialLoadComplete) {
    return <SkeletonListPage rows={6} cols={5} />;
  }

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

              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '16px', background: 'rgba(255, 255, 255, 0.02)' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: '12px', fontWeight: 'bold', color: 'var(--text-primary)' }}>Ethiopian Plate Details</h3>
                
                {errorMsg && (
                  <div className="error-message" style={{ color: 'var(--danger)', marginBottom: '12px', fontSize: '0.85rem' }}>
                    {errorMsg}
                  </div>
                )}

                <div className="form-group grid-2-col" style={{ marginBottom: '12px' }}>
                  <div>
                    <label>Region *</label>
                    <select 
                      value={formData.regionAbbreviation} 
                      onChange={(e) => {
                        const abbrev = e.target.value;
                        const match = APPROVED_REGIONS.find(r => r.abbreviation === abbrev);
                        if (match) {
                          setFormData(prev => {
                            const newAmharic = match.amharic;
                            const plate = `${match.abbreviation} ${prev.regionCode} ${newAmharic} ${prev.vehicleNumber}`;
                            return { ...prev, regionAbbreviation: match.abbreviation, regionName: match.name, amharicLetters: newAmharic, plate };
                          });
                        }
                      }}
                      required
                    >
                      {APPROVED_REGIONS.map(r => (
                        <option key={r.abbreviation} value={r.abbreviation}>{r.name} ({r.abbreviation})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Code (1-5) *</label>
                    <select 
                      value={formData.regionCode} 
                      onChange={(e) => {
                        const codeVal = parseInt(e.target.value, 10);
                        setFormData(prev => {
                          const plate = `${prev.regionAbbreviation} ${codeVal} ${prev.amharicLetters} ${prev.vehicleNumber}`;
                          return { ...prev, regionCode: codeVal, plate };
                        });
                      }}
                      required
                    >
                      {CODES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group grid-2-col" style={{ marginBottom: '12px' }}>
                  <div>
                    <label>Amharic Abbreviation</label>
                    <input 
                      type="text" 
                      value={formData.amharicLetters} 
                      readOnly
                      style={{ background: 'var(--bg-main)', cursor: 'not-allowed', opacity: 0.8, fontFamily: 'inherit', fontSize: '1.05rem', letterSpacing: '0.04em' }}
                      title="Auto-filled when you select a region"
                    />
                  </div>
                  <div>
                    <label>Vehicle Number *</label>
                    <input 
                      type="text" 
                      value={formData.vehicleNumber} 
                      onChange={(e) => {
                        const num = e.target.value.replace(/\D/g, ''); // Digits only
                        setFormData(prev => {
                          const plate = `${prev.regionAbbreviation} ${prev.regionCode} ${prev.amharicLetters} ${num}`;
                          return { ...prev, vehicleNumber: num, plate };
                        });
                      }}
                      placeholder="e.g. 12345"
                      required
                    />
                  </div>
                </div>

                {/* Live Plate Preview Box */}
                <div className="plate-preview-container">
                  <div className="plate-preview-title">{t("Live Plate Preview")}</div>
                  <div className="ethiopian-plate-preview">
                    <div className="plate-region">{formData.regionAbbreviation || 'AA'}</div>
                    <div className="plate-code">{formData.regionCode || '1'}</div>
                    <div className="plate-amharic">{formData.amharicLetters || '—'}</div>
                    <div className="plate-number">{formData.vehicleNumber || '—————'}</div>
                  </div>
                </div>
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
                <button type="button" className="btn-text" onClick={handleCloseModal} disabled={submitting}>{t('cancel')}</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : (editingId ? t('save') : t("Register Vehicle"))}
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
