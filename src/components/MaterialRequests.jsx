import React, { useState, useMemo, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { 
  ClipboardList, Search, Filter, CheckCircle2, XCircle, Clock, 
  Package, User, Car, Wrench, AlertCircle, ArrowRight,
  Check, Edit3, Trash2, MoreVertical, Eye, Truck, AlertTriangle, X, FileText, Smartphone, ChevronRight, DollarSign, Store
} from 'lucide-react';
import CustomerProfileModal from './CustomerProfileModal';
import './MaterialRequests.css';

const MaterialRequests = () => {
  const { 
    materialRequests, inventory, repairs, vehicles, customers, staff, invoices,
    updateItem, deleteItem, addItem, addNotification, logActivity,
    t, language, formatDate, formatTime, requestConfirmation, generateInvoice
  } = useAppContext();
  const { currentUser } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [mechanicFilter, setMechanicFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const isGeneratingRef = useRef(false);
  const [reviewData, setReviewData] = useState({
    status: '',
    approvedQty: 0,
    notes: ''
  });
  const [generatingId, setGeneratingId] = useState(null);

  const userRole = currentUser?.role?.toLowerCase() || '';
  const isStorekeeper = ['storekeeper', 'inventorymanager', 'inventory manager', 'manager', 'admin', 'coder'].includes(userRole);
  const isMechanic = userRole === 'mechanic';
  
  const getStatusConfig = (status) => {
    const s = status?.toLowerCase();
    switch(s) {
      case 'pending':            return { label: t('pending'), icon: <Clock size={14}/>, color: 'pending' };
      case 'approved':           return { label: t('approved'), icon: <CheckCircle2 size={14}/>, color: 'approved' };
      case 'ordered':            return { label: t("Ordered"), icon: <ClipboardList size={14}/>, color: 'ordered' };
      case 'in-transit':         return { label: t("In-Transit"), icon: <Truck size={14}/>, color: 'transit' };
      case 'waiting-for-parts':  return { label: t("Waiting for Parts"), icon: <Clock size={14}/>, color: 'waiting' };
      case 'delayed':            return { label: t("Delayed"), icon: <AlertTriangle size={14}/>, color: 'delayed' };
      case 'ready-for-pickup':   return { label: t('readyForPickup'), icon: <Package size={14}/>, color: 'ready' };
      case 'picked-up':          return { label: t('pickedUp'), icon: <Check size={14}/>, color: 'picked' };
      case 'rejected':           return { label: t('rejected'), icon: <XCircle size={14}/>, color: 'rejected' };
      case 'insufficient':       return { label: t('insufficient'), icon: <AlertTriangle size={14}/>, color: 'rejected' };
      case 'cancelled':          return { label: t("Cancelled"), icon: <X size={14}/>, color: 'cancelled' };
      default:                   return { label: s, icon: <AlertCircle size={14}/>, color: 'pending' };
    }
  };

  const filteredRequests = useMemo(() => {
    return (materialRequests || []).filter(req => {
      // Role filtering
      if (isMechanic && String(req.mechanicId) !== String(currentUser.id)) return false;

      // Multi-Shop Filtering: Inventory Managers only see their own shop's requests
      if (isStorekeeper && userRole !== 'admin' && userRole !== 'coder' && userRole !== 'manager') {
        if (req.managerId && String(req.managerId) !== String(currentUser.id)) return false;
        if (!req.managerId) return false; // Main Warehouse requests only for Admins
      }
      
      // Search term
      const part = (inventory || []).find(i => i.id === req.partId);
      const partName = part ? part.name.toLowerCase() : '';
      const repair = (repairs || []).find(r => r.id === req.repairId);
      const vehicle = repair ? (vehicles || []).find(v => v.id === repair.vehicleId) : null;
      const vehicleName = vehicle ? `${vehicle.make || ''} ${vehicle.model || ''} ${vehicle.plate || vehicle.plateNumber || ''}`.toLowerCase() : '';
      
      const searchMatch = partName.includes(searchTerm.toLowerCase()) || 
                          vehicleName.includes(searchTerm.toLowerCase()) ||
                          (req.repairId || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      // Status filter
      const statusMatch = statusFilter === 'all' || req.status === statusFilter;
      
      // Mechanic filter
      const mechMatch = mechanicFilter === 'all' || String(req.mechanicId) === String(mechanicFilter);
      
      return searchMatch && statusMatch && mechMatch;
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [materialRequests, inventory, repairs, vehicles, searchTerm, statusFilter, mechanicFilter, currentUser, isMechanic]);

  const handleReview = (req) => {
    setSelectedRequest(req);
    setReviewData({
      status: req.status || 'pending',
      approvedQty: req.approvedQty || req.requestedQty || 1,
      notes: req.notes || ''
    });
    setShowReviewModal(true);
  };


  const handleIssueMaterial = (req, approvedQtyOverride = null) => {
    const part = inventory.find(i => String(i.id) === String(req.partId));
    if (!part) {
      alert(t("Error: Part not found in inventory."));
      return false;
    }

    const currentStock = parseInt(part.quantity || 0, 10);
    const finalQty = parseInt(approvedQtyOverride ?? req.approvedQty ?? req.requestedQty ?? 0, 10);

    if (isNaN(finalQty) || finalQty <= 0) {
      alert(t("Invalid quantity."));
      return false;
    }

    if (isNaN(currentStock) || currentStock < finalQty) {
      alert(`${t('insufficientStock')}: ${part.name} (Available: ${currentStock || 0})`);
      return false;
    }

    // 1. Reduce Inventory
    const newQty = currentStock - finalQty;
    updateItem('inventory', part.id, { ...part, quantity: newQty });

    // 2. Add to Repair Record for Billing
    const repair = repairs.find(r => String(r.id) === String(req.repairId));
    if (repair) {
      const partsList = repair.parts || [];
      const partPrice = parseFloat(part.price || 0);
      const newPartEntry = {
        name: part.name,
        qty: finalQty,
        price: isNaN(partPrice) ? 0 : partPrice,
        total: finalQty * (isNaN(partPrice) ? 0 : partPrice),
        date: new Date().toISOString(),
        requestId: req.id
      };
      updateItem('repairs', repair.id, { ...repair, parts: [...partsList, newPartEntry] });
    }

    addNotification(
      `${t('materialIssued')}: ${part.name} (${finalQty})`,
      'success',
      req.mechanicId,
      '/repairs'
    );

    alert(language === 'en' ? `Material issued: ${part.name} (Qty: ${finalQty})` : `ዕቃ ተሰጥቷል፡ ${part.name} (ብዛት፡ ${finalQty})`);
    logActivity('Material Issued & Inventory Reduced', `${part.name} x${finalQty} for Repair ${req.repairId}`);
    return true;
  };

  const submitReview = () => {
    if (!selectedRequest) return;
    
    const part = inventory.find(i => i.id === selectedRequest.partId);
    if (!part) return;

    const isIssuingNow = reviewData.status === 'picked-up' && selectedRequest.status !== 'picked-up';
    
    if (isIssuingNow) {
      const qty = parseInt(reviewData.approvedQty) || 0;
      if (part.stock < qty) {
        alert(language === 'en' ? `Insufficient stock. Available: ${part.stock}` : `በቂ እቃ የለም። ያለው፡ ${part.stock}`);
        return; // Stop if inventory check fails
      }
      
      // Deduct from inventory
      updateItem('inventory', part.id, {
        ...part,
        stock: part.stock - qty,
        lastUpdated: new Date().toISOString()
      });
    }

    const newRequest = {
      ...selectedRequest,
      status: reviewData.status,
      approvedQty: parseInt(reviewData.approvedQty),
      notes: reviewData.notes,
      reviewedBy: currentUser.id,
      reviewedAt: new Date().toISOString()
    };

    if (reviewData.status === 'picked-up' && !newRequest.pickedUpAt) {
      newRequest.pickedUpAt = new Date().toISOString();
      newRequest.pickedUpBy = currentUser.id;
    }

    updateItem('materialRequests', selectedRequest.id, newRequest);
    
    // Notifications
    let notifMsg = `${t('materialRequest')} ${t(reviewData.status)}: ${part.name}`;
    
    if (reviewData.status === 'approved' || reviewData.status === 'partially-approved') {
      notifMsg = `✅ ${part.name}: come here pick your order and viwe price that material for customer and mechanic order material (Price: $${part.price})`;
    } else if (reviewData.status === 'insufficient') {
      notifMsg = `⚠️ ${t('insufficientStock')}: ${part.name}. Please check with the Inventory Manager.`;
    } else if (['ordered', 'in-transit', 'ready-for-pickup', 'delayed', 'waiting-for-parts', 'cancelled'].includes(reviewData.status)) {
       notifMsg = `📋 ${t('materialRequest')} Update: ${part.name} is now ${t(reviewData.status)}`;
    }

    addNotification(
      notifMsg,
      (reviewData.status === 'approved' || reviewData.status === 'picked-up') ? 'success' : 
      (reviewData.status === 'insufficient' || reviewData.status === 'delayed' || reviewData.status === 'cancelled') ? 'warning' : 'info',
      selectedRequest.mechanicId,
      '/material-requests'
    );

    logActivity('Material Request Updated', `Request ID: ${selectedRequest.id}, Status: ${reviewData.status}`);
    setShowReviewModal(false);
  };

  const handleOpenCustomer = (req) => {
    const repair = repairs.find(r => r.id === req.repairId);
    const vehicle = repair ? vehicles.find(v => v.id === repair.vehicleId) : null;
    const cust = vehicle ? customers.find(c => c.id === vehicle.customerId) : null;
    
    if (cust) {
      setSelectedCustomer(cust);
      setSelectedRequest(req);
      setShowCustomerModal(true);
    } else {
      // Fallback for requests that might have direct customerId (if any)
      const directCust = customers.find(c => c.id === req.customerId);
      if (directCust) {
        setSelectedCustomer(directCust);
        setSelectedRequest(req);
        setShowCustomerModal(true);
      } else {
        alert(t("Customer information not found for this request."));
      }
    }
  };

  const handleGenerateBill = async (req) => {
    if (isGeneratingRef.current) return;
    
    // Final safety check before starting
    const alreadySent = invoices.some(inv => String(inv.materialRequestId) === String(req.id));
    if (alreadySent) {
      alert(t("Bill already generated for this request."));
      return;
    }

    isGeneratingRef.current = true;
    setGeneratingId(req.id);

    const repair = repairs.find(r => r.id === req.repairId);
    const vehicle = repair ? vehicles.find(v => v.id === repair.vehicleId) : null;
    let cust = vehicle ? customers.find(c => c.id === vehicle.customerId) : null;
    
    if (!cust && req.customerId) {
      cust = customers.find(c => c.id === req.customerId);
    }

    const part = inventory.find(i => i.id === req.partId);
    
    try {
      if (cust && part) {
        const inv = generateInvoice(req, cust, part, vehicle);
        if (inv) {
          addNotification(
            `${t('invoiceGenerated')} : ${inv.id}`, 
            'success',
            currentUser.id,
            '/billing'
          );
          // Close modal if open
          setShowCustomerModal(false);
        }
      } else {
        alert(t("Could not generate invoice: Missing customer or part data."));
      }
    } catch (err) {
      console.error(err);
      alert(t("Failed to generate invoice. Please try again."));
    } finally {
      // Keep disabled for a bit to prevent double clicks even if ref resets
      setTimeout(() => {
        isGeneratingRef.current = false;
        setGeneratingId(null);
      }, 500);
    }
  };

  const confirmPickup = (req) => {
    const success = handleIssueMaterial(req);
    if (success) {
      const updatedRequest = {
        ...req,
        status: 'picked-up',
        pickedUpAt: new Date().toISOString(),
        pickedUpBy: currentUser.id
      };
      updateItem('materialRequests', req.id, updatedRequest);
    }
  };

  const getStatusBadge = (status) => {
    const config = getStatusConfig(status);
    return (
      <span className={`status-badge status-fill-${config.color}`}>
        {config.icon} {config.label}
      </span>
    );
  };

  return (
    <div className="page-content material-requests-page">
      <div className="page-header">
        <div className="header-title">
          <div className="icon-wrapper"><ClipboardList size={28} /></div>
          <div>
            <h1>{t('materialRequests')}</h1>
            <p className="subtitle">{t("Manage and track spare parts requests for repairs.")}</p>
          </div>
        </div>
      </div>

      <div className="controls-bar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder={t('searchRequests')} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filters-group">
          <div className="filter-item">
            <Filter size={16} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">{t('allStatuses')}</option>
              <option value="pending">{t('pending')}</option>
              <option value="approved">{t('approved')}</option>
              <option value="ordered">{t('ordered')}</option>
              <option value="in-transit">{t('inTransit')}</option>
              <option value="waiting-for-parts">{t('waitingForParts')}</option>
              <option value="delayed">{t('delayed')}</option>
              <option value="ready-for-pickup">{t('readyForPickup')}</option>
              <option value="picked-up">{t('pickedUp')}</option>
              <option value="insufficient">{t('insufficientStock')}</option>
              <option value="rejected">{t('rejected')}</option>
              <option value="cancelled">{t('cancelled')}</option>
            </select>
          </div>

          {!isMechanic && (
            <div className="filter-item">
              <User size={16} />
              <select value={mechanicFilter} onChange={(e) => setMechanicFilter(e.target.value)}>
                <option value="all">{t('allMechanics')}</option>
                {(staff || []).filter(s => s.role === 'mechanic').map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="requests-grid">
        {filteredRequests.length === 0 ? (
          <div className="empty-state">
            <Package size={48} />
            <p>{t("No material requests found.")}</p>
          </div>
        ) : (
          filteredRequests.map(req => {
            const part = (inventory || []).find(i => i.id === req.partId);
            const repair = (repairs || []).find(r => r.id === req.repairId);
            const vehicle = repair ? (vehicles || []).find(v => v.id === repair.vehicleId) : null;
            const mechanic = (staff || []).find(s => s.id === req.mechanicId);
            const customer = vehicle ? (customers || []).find(c => c.id === vehicle.customerId) : null;

            return (
              <div className={`request-card status-border-${getStatusConfig(req.status).color}`} key={req.id}>
                <div className="card-header">
                  <div className="part-info">
                    <h3>{part?.name || 'Unknown Part'}</h3>
                    <span className="req-id">#{req.id.slice(-6).toUpperCase()}</span>
                  </div>
                  {getStatusBadge(req.status)}
                </div>

                <div className="card-body">
                  <div className="info-grid">
                    <div className="info-item">
                      <Wrench size={14} />
                      <span>{t('repair')}: #{req.repairId}</span>
                    </div>
                    <div className="info-item" title={vehicle ? `${vehicle.plate} - ${vehicle.make} ${vehicle.model}` : 'Unknown Vehicle'}>
                      <Car size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', width: '100%' }}>
                        {vehicle ? (
                          <>
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: 600 }}>
                              {vehicle.make} {vehicle.model}
                            </span>
                            <span style={{ color: 'var(--primary)', fontWeight: 800, background: 'rgba(67, 97, 238, 0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', width: 'fit-content' }}>
                              {vehicle.plate}
                            </span>
                          </>
                        ) : <span>Unknown Vehicle</span>}
                      </div>
                    </div>
                    <div className="info-item">
                      <User size={14} />
                      <span>{mechanic?.name || 'Unknown Mechanic'}</span>
                    </div>
                    <div className="info-item">
                      <Clock size={14} />
                      <span>{formatDate(req.timestamp)} {formatTime(req.timestamp)}</span>
                    </div>
                    {req.status === 'picked-up' && (
                      <div className="info-item">
                        <DollarSign size={14} />
                        <span className={`payment-status ${req.paymentStatus || 'unpaid'}`}>
                          {t(req.paymentStatus === 'paid' ? 'paymentPaid' : req.paymentStatus === 'partial' ? 'paymentPartiallyPaid' : 'paymentUnpaid')}
                        </span>
                      </div>
                    )}
                    <div className="info-item" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      <Store size={14} />
                      <span>{staff.find(s => String(s.id) === String(req.managerId))?.name || (t("Unassigned Shop"))}</span>
                    </div>
                  </div>

                  <div className="qty-tracking">
                    <div className="qty-item">
                      <span className="label">{t("Unit Price")}</span>
                      <span className="value">${part?.price || 0}</span>
                    </div>
                    <div className="qty-item highlight">
                      <span className="label">{t('approvedQty')}</span>
                      <span className="value">{req.approvedQty || 0}</span>
                    </div>
                    <div className="qty-item success">
                      <span className="label">{t("Total Cost")}</span>
                      <span className="value">${(req.approvedQty || 0) * (part?.price || 0)}</span>
                    </div>
                  </div>

                  <div className="customer-link" onClick={() => handleOpenCustomer(req)}>
                    <span className="label">{t('customer')}:</span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <span className="name">
                         <User size={14} /> {customer?.name || 'Walk-in'}
                       </span>
                       <ChevronRight size={14} color="var(--primary)" />
                    </div>
                  </div>
                </div>

                <div className="card-footer">
                  {isStorekeeper && req.status !== 'picked-up' && (
                    <button className={`btn-status status-bg-${getStatusConfig(req.status).color} w-full`} onClick={() => handleReview(req)}>
                      <Edit3 size={16} /> {t('reviewRequest')}
                    </button>
                  )}
                  
                  {isStorekeeper && (req.status === 'approved' || req.status === 'partially-approved') && (
                    <button className="btn-status status-bg-ordered w-full" onClick={() => updateItem('materialRequests', req.id, { ...req, status: 'ready-for-pickup' })}>
                      <Package size={16} /> {t('readyForPickup')}
                    </button>
                  )}

                  {isStorekeeper && req.status === 'ready-for-pickup' && (
                    <button className="btn-status status-bg-ready w-full" onClick={() => confirmPickup(req)}>
                      <Check size={16} /> {t('confirmPickup')}
                    </button>
                  )}

                   {(isStorekeeper || isMechanic) && req.status === 'picked-up' && (() => {
                     const isBillSent = invoices.some(inv => String(inv.materialRequestId) === String(req.id));
                     const isThisLoading = generatingId === req.id;
                     return (
                       <button 
                         className={`btn-primary w-full ${(generatingId || isBillSent) ? 'disabled' : ''}`} 
                         style={{ 
                           background: isBillSent ? '#64748b' : 'linear-gradient(135deg, #10b981, #059669)',
                           cursor: (generatingId || isBillSent) ? 'not-allowed' : 'pointer',
                           opacity: (generatingId || isBillSent) ? 0.8 : 1
                         }} 
                         onClick={() => !isBillSent && !generatingId && handleGenerateBill(req)}
                         disabled={!!generatingId || isBillSent}
                       >
                         {isThisLoading ? (
                           <><div className="spinner-small" style={{ marginRight: 8 }} /> {t("Sending...")}</>
                         ) : isBillSent ? (
                           <><CheckCircle2 size={16} style={{ marginRight: 8 }} /> {t("Sent Bill")}</>
                         ) : (
                           <><FileText size={16} style={{ marginRight: 8 }} /> {t("Generate & Send Bill")}</>
                         )}
                       </button>
                     );
                   })()}

                   {isMechanic && req.status === 'pending' && (
                    <div className="mechanic-actions">
                      <button className="btn-outline-danger" onClick={() => requestConfirmation(t('areYouSure'), () => deleteItem('materialRequests', req.id))}>
                        <Trash2 size={16} />
                      </button>
                      <button className="btn-outline-primary flex-1" onClick={() => handleReview(req)}>
                        <Edit3 size={16} /> {t('editRequest')}
                      </button>
                    </div>
                  )}

                  {req.status === 'picked-up' && (
                    <div className="pickup-info">
                      <CheckCircle2 size={14} /> 
                      <span>{t('materialIssued')} {formatDate(req.pickedUpAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {showReviewModal && selectedRequest && (
        <div className="modal-overlay">
          <div className={`modal-content status-modal-${getStatusConfig(reviewData.status || selectedRequest.status).color}`}>
            <div className="modal-header">
              <h2 style={{ color: `var(--status-${getStatusConfig(reviewData.status || selectedRequest.status).color})`, display: 'flex', alignItems: 'center', gap: '10px' }}>
                {getStatusConfig(reviewData.status || selectedRequest.status).icon}
                {isStorekeeper ? t('reviewRequest') : t('editRequest')}
              </h2>
              <button className="close-btn" onClick={() => setShowReviewModal(false)}>&times;</button>
            </div>
            <div className="modal-form">
              <div className="form-group">
                <label>{t('status')}</label>
                <select 
                  value={reviewData.status} 
                  onChange={(e) => setReviewData({...reviewData, status: e.target.value})}
                  disabled={!isStorekeeper}
                  className="status-select"
                >
                  <option value="pending">{t('pending')}</option>
                  <option value="approved">{t('approved')}</option>
                  <option value="partially-approved">{t('partiallyApproved')}</option>
                  <option value="ordered">{t('ordered')}</option>
                  <option value="in-transit">{t('inTransit')}</option>
                  <option value="waiting-for-parts">{t('waitingForParts')}</option>
                  <option value="delayed">{t('delayed')}</option>
                  <option value="ready-for-pickup">{t('readyForPickup')}</option>
                  <option value="picked-up">{t('pickedUp')}</option>
                  <option value="insufficient">{t('insufficientStock')}</option>
                  <option value="rejected">{t('rejected')}</option>
                  <option value="cancelled">{t('cancelled')}</option>
                </select>
              </div>

              <div className="form-group">
                <label>{t('approvedQty')}</label>
                <input 
                  type="number" 
                  value={reviewData.approvedQty || ''} 
                  onChange={(e) => setReviewData({...reviewData, approvedQty: e.target.value})}
                  min="0"
                  max={selectedRequest?.requestedQty}
                  disabled={!isStorekeeper && reviewData.status !== 'pending'}
                />
                <small className="help-text">{t('requestedQty')}: {selectedRequest?.requestedQty}</small>
              </div>

              <div className="form-group">
                <label>{t('notes')}</label>
                <textarea 
                  value={reviewData.notes} 
                  onChange={(e) => setReviewData({...reviewData, notes: e.target.value})}
                  placeholder={t("Add any notes for the mechanic...")}
                />
              </div>

              <div className="modal-actions">
                <button className="btn-text" onClick={() => setShowReviewModal(false)}>{t('cancel')}</button>
                <button 
                  className={`btn-status status-bg-${getStatusConfig(reviewData.status || selectedRequest.status).color}`} 
                  onClick={submitReview}
                >
                  {t('save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showCustomerModal && (
        <CustomerProfileModal 
          customer={selectedCustomer} 
          onClose={() => setShowCustomerModal(false)}
          onGenerateBill={() => handleGenerateBill(selectedRequest)}
          isSubmitting={generatingId === selectedRequest?.id}
          isBillSent={invoices.some(inv => String(inv.materialRequestId) === String(selectedRequest?.id))}
        />
      )}
    </div>
  );
};

export default MaterialRequests;
