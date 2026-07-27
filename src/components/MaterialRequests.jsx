import React, { useState, useMemo, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { 
  ClipboardList, Search, Filter, CheckCircle2, XCircle, Clock, 
  Package, User, Car, Wrench, AlertCircle, ArrowRight, Plus, ShoppingCart,
  Check, Edit3, Trash2, MoreVertical, Eye, Truck, AlertTriangle, X, FileText, Smartphone, ChevronRight, DollarSign, Store
} from 'lucide-react';
import CustomerProfileModal from './CustomerProfileModal';
import { SkeletonPageHeader, SkeletonCardGrid } from './SkeletonLoader';
import './MaterialRequests.css';

const MaterialRequests = () => {
  const { 
    materialRequests, inventory, repairs, vehicles, customers, staff, invoices,
    updateItem, deleteItem, addItem, addNotification, logActivity,
    t, language, formatDate, formatTime, requestConfirmation, generateInvoice,
    isSyncing, isInitialLoadComplete
  } = useAppContext();
  const { currentUser } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [mechanicFilter, setMechanicFilter] = useState('all');
  const [partFilter, setPartFilter] = useState('all');
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

  // New Material Request Creation Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRepairId, setSelectedRepairId] = useState('');
  const [partSearchTerm, setPartSearchTerm] = useState('');
  const [partCategoryFilter, setPartCategoryFilter] = useState('all');
  const [partAvailabilityFilter, setPartAvailabilityFilter] = useState('in-stock');
  const [requestBasket, setRequestBasket] = useState([]);
  const [requestNotes, setRequestNotes] = useState('');
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);

  const userRole = currentUser?.role?.toLowerCase() || '';
  const isStorekeeper = ['storekeeper', 'inventorymanager', 'inventory manager', 'manager', 'admin', 'coder'].includes(userRole);
  const isMechanic = userRole === 'mechanic';

  // Derived categories from inventory
  const inventoryCategories = useMemo(() => {
    const cats = new Set((inventory || []).map(i => i.category).filter(Boolean));
    return Array.from(cats);
  }, [inventory]);

  // Derived available inventory matching search & filters
  const filteredInventory = useMemo(() => {
    return (inventory || []).filter(item => {
      const partName = (item.name || item.partName || '').toLowerCase();
      const catName = (item.category || '').toLowerCase();
      const sTerm = partSearchTerm.toLowerCase();
      
      const searchMatch = !partSearchTerm || partName.includes(sTerm) || catName.includes(sTerm);
      const catMatch = partCategoryFilter === 'all' || item.category === partCategoryFilter;

      const qty = parseInt(item.quantity || 0, 10);
      const minStock = parseInt(item.minStock || item.threshold || 5, 10);

      let availMatch = true;
      if (partAvailabilityFilter === 'in-stock') {
        availMatch = qty > 0;
      } else if (partAvailabilityFilter === 'low-stock') {
        availMatch = qty > 0 && qty <= minStock;
      }

      return searchMatch && catMatch && availMatch;
    });
  }, [inventory, partSearchTerm, partCategoryFilter, partAvailabilityFilter]);

  // Mechanic's active repair orders
  const mechanicRepairs = useMemo(() => {
    return (repairs || []).filter(r => {
      if (isMechanic) {
        return String(r.mechanicId) === String(currentUser?.id) && r.status !== 'completed' && r.status !== 'delivered' && r.status !== 'cancelled';
      }
      return r.status !== 'completed' && r.status !== 'delivered' && r.status !== 'cancelled';
    });
  }, [repairs, isMechanic, currentUser]);

  const handleAddToBasket = (part, qty = 1) => {
    const stock = parseInt(part.quantity || 0, 10);
    if (stock <= 0) {
      alert(t("This part is out of stock."));
      return;
    }

    setRequestBasket(prev => {
      const existing = prev.find(item => String(item.partId) === String(part.id));
      if (existing) {
        const newQty = Math.min(existing.requestedQty + qty, stock);
        return prev.map(item => String(item.partId) === String(part.id) ? { ...item, requestedQty: newQty } : item);
      }
      return [...prev, {
        partId: part.id,
        partName: part.name || part.partName || 'Part',
        category: part.category || 'General',
        price: parseFloat(part.price || 0),
        availableStock: stock,
        requestedQty: Math.min(qty, stock)
      }];
    });
  };

  const handleUpdateBasketQty = (partId, qty) => {
    setRequestBasket(prev => prev.map(item => {
      if (String(item.partId) === String(partId)) {
        const parsed = parseInt(qty, 10);
        const validQty = isNaN(parsed) ? 1 : Math.max(1, Math.min(parsed, item.availableStock));
        return { ...item, requestedQty: validQty };
      }
      return item;
    }));
  };

  const handleRemoveFromBasket = (partId) => {
    setRequestBasket(prev => prev.filter(item => String(item.partId) !== String(partId)));
  };

  const handleSubmitBatchRequest = async (e) => {
    e.preventDefault();
    if (!selectedRepairId) {
      alert(t("Please select a Repair Order for this material request."));
      return;
    }
    if (requestBasket.length === 0) {
      alert(t("Please select at least one available part to request."));
      return;
    }

    setIsSubmittingBatch(true);
    try {
      for (const item of requestBasket) {
        await addItem('materialRequests', {
          partId: item.partId,
          repairId: selectedRepairId,
          requestedQty: item.requestedQty,
          notes: requestNotes.trim()
        });
      }

      addNotification(
        `📦 ${t("Submitted")} ${requestBasket.length} ${t("material requests for Repair")} #${selectedRepairId}`,
        'success',
        null,
        '/material-requests'
      );

      // Notify Storekeepers / Managers
      const managers = (staff || []).filter(s => ['storekeeper', 'inventorymanager', 'inventory manager', 'manager', 'admin'].includes(s.role?.toLowerCase()));
      managers.forEach(mgr => {
        addNotification(
          `🔔 ${currentUser?.name || 'Mechanic'} submitted ${requestBasket.length} new material request(s) for Repair #${selectedRepairId}`,
          'info',
          mgr.id,
          '/material-requests'
        );
      });

      logActivity('Material Requests Created', `${currentUser?.name} requested ${requestBasket.length} parts for Repair #${selectedRepairId}`);

      // Reset modal state
      setRequestBasket([]);
      setRequestNotes('');
      setShowCreateModal(false);
    } catch (err) {
      console.error("Failed to submit batch material request", err);
      alert(t("Failed to submit material request. Please try again."));
    } finally {
      setIsSubmittingBatch(false);
    }
  };
  
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
      const mechanic = (staff || []).find(s => s.id === req.mechanicId);
      const mechanicName = mechanic ? mechanic.name.toLowerCase() : '';
      
      const searchMatch = partName.includes(searchTerm.toLowerCase()) || 
                          vehicleName.includes(searchTerm.toLowerCase()) ||
                          mechanicName.includes(searchTerm.toLowerCase()) ||
                          (req.repairId || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      // Status filter
      const statusMatch = statusFilter === 'all' || req.status === statusFilter;
      
      // Mechanic filter
      const mechMatch = mechanicFilter === 'all' || String(req.mechanicId) === String(mechanicFilter);

      // Part filter
      const partMatch = partFilter === 'all' || String(req.partId) === String(partFilter);
      
      return searchMatch && statusMatch && mechMatch && partMatch;
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [materialRequests, inventory, repairs, vehicles, staff, searchTerm, statusFilter, mechanicFilter, partFilter, currentUser, isMechanic, isStorekeeper, userRole]);

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

    const qty = parseInt(reviewData.approvedQty) || 0;
    const isIssuingNow = reviewData.status === 'picked-up' && selectedRequest.status !== 'picked-up';

    if (isIssuingNow) {
      const currentStock = parseInt(part.quantity || 0, 10);
      if (currentStock < qty) {
        alert(language === 'en' ? `Insufficient stock. Available: ${currentStock}` : `በቂ እቃ የለም። ያለው፡ ${currentStock}`);
        return; // Stop if inventory check fails
      }
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
    const part = inventory.find(i => String(i.id) === String(req.partId));
    if (!part) {
      alert(t("Error: Part not found in inventory."));
      return;
    }

    const currentStock = parseInt(part.quantity || 0, 10);
    const finalQty = parseInt(req.approvedQty ?? req.requestedQty ?? 0, 10);

    if (currentStock < finalQty) {
      alert(`${t('insufficientStock')}: ${part.name} (Available: ${currentStock})`);
      return;
    }

    const updatedRequest = {
      ...req,
      status: 'picked-up',
      approvedQty: finalQty,
      pickedUpAt: new Date().toISOString(),
      pickedUpBy: currentUser.id
    };
    updateItem('materialRequests', req.id, updatedRequest);
  };

  const getStatusBadge = (status) => {
    const config = getStatusConfig(status);
    return (
      <span className={`status-badge status-fill-${config.color}`}>
        {config.icon} {config.label}
      </span>
    );
  };

  // Skeleton guard — only show skeleton on very first load
  if (isSyncing && !isInitialLoadComplete) {
    return (
      <div className="page-content material-requests-page">
        <SkeletonPageHeader />
        <div style={{ marginTop: 16 }}>
          <SkeletonCardGrid count={4} />
        </div>
      </div>
    );
  }

  // Mechanic guard — mechanics cannot manage requests here, they submit via Repair Orders
  if (isMechanic) {
    return (
      <div className="page-content material-requests-page">
        <div className="page-header">
          <div className="header-title">
            <div className="icon-wrapper"><ClipboardList size={28} /></div>
            <div>
              <h1>{t('materialRequests')}</h1>
              <p className="subtitle">{t('Your submitted material requests.')}</p>
            </div>
          </div>
        </div>
        <div style={{ background: 'rgba(67,97,238,0.06)', border: '1px solid rgba(67,97,238,0.2)', borderRadius: 14, padding: '18px 22px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <Package size={24} color="var(--primary)" />
          <div>
            <strong style={{ color: 'var(--primary)', display: 'block', marginBottom: 4 }}>
              {t('To request materials, go to your Repair Order card and tap "Request Materials".')}
            </strong>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {t('Below are your submitted requests and their current status.')}
            </span>
          </div>
        </div>
        <div className="requests-grid">
          {filteredRequests.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <Package size={48} />
              <p>{t('No material requests found.')}</p>
            </div>
          ) : (
            filteredRequests.map(req => {
              const part = (inventory || []).find(i => String(i.id) === String(req.partId));
              const repair = (repairs || []).find(r => String(r.id) === String(req.repairId));
              const vehicle = repair ? (vehicles || []).find(v => String(v.id) === String(repair.vehicleId)) : null;
              return (
                <div className={`request-card status-border-${getStatusConfig(req.status).color}`} key={req.id}>
                  <div className="card-header" style={{ paddingBottom: 0 }}>
                    <div className="part-info">
                      <h3 style={{ fontSize: '0.95rem', margin: 0 }}>{part?.name || 'Unknown Part'}</h3>
                      <span className="req-id">#{req.id.slice(-6).toUpperCase()}</span>
                    </div>
                    {getStatusBadge(req.status)}
                  </div>
                  <div className="card-body">
                    <div className="info-grid">
                      <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                        <Car size={13} />
                        <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                          {vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown Vehicle'}
                          {vehicle?.plate && (
                            <span style={{ marginLeft: 6, color: 'var(--primary)', background: 'rgba(67,97,238,0.1)', padding: '1px 5px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 800 }}>
                              {vehicle.plate}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="info-item">
                        <Clock size={13} />
                        <span style={{ fontSize: '0.78rem' }}>{formatDate(req.timestamp)}</span>
                      </div>
                      <div className="info-item">
                        <Package size={13} />
                        <span style={{ fontSize: '0.78rem' }}>{t('Qty')}: {req.requestedQty}</span>
                      </div>
                    </div>
                    <div className="qty-tracking">
                      <div className="qty-item">
                        <span className="label">{t('Requested')}</span>
                        <span className="value">{req.requestedQty}</span>
                      </div>
                      <div className="qty-item highlight">
                        <span className="label">{t('approvedQty')}</span>
                        <span className="value">{req.approvedQty || 0}</span>
                      </div>
                      <div className="qty-item success">
                        <span className="label">{t('Total Cost')}</span>
                        <span className="value">${(req.approvedQty || 0) * (part?.price || 0)}</span>
                      </div>
                    </div>
                    {req.notes && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: 4 }}>
                        {req.notes}
                      </div>
                    )}
                  </div>
                  {req.status === 'pending' && (
                    <div className="card-footer">
                      <button className="btn-outline-danger" style={{ fontSize: '0.8rem', padding: '7px 14px' }} onClick={() => requestConfirmation(t('areYouSure'), () => deleteItem('materialRequests', req.id))}>
                        <Trash2 size={14} /> {t('cancel')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // Unique parts for filter dropdown
  const partOptions = Array.from(
    new Map(
      (materialRequests || []).map(r => {
        const p = (inventory || []).find(i => i.id === r.partId);
        return [r.partId, p?.name || r.partId];
      })
    ).entries()
  );

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

          <div className="filter-item">
            <Package size={16} />
            <select value={partFilter} onChange={(e) => setPartFilter(e.target.value)}>
              <option value="all">{t('All Parts')}</option>
              {partOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
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
            const part = (inventory || []).find(i => String(i.id) === String(req.partId));
            const repair = (repairs || []).find(r => String(r.id) === String(req.repairId));
            const vehicle = repair ? (vehicles || []).find(v => String(v.id) === String(repair.vehicleId)) : null;
            const mechanic = (staff || []).find(s => String(s.id) === String(req.mechanicId));
            const customer = vehicle ? (customers || []).find(c => String(c.id) === String(vehicle.customerId)) : null;

            return (
              <div className={`request-card status-border-${getStatusConfig(req.status).color}`} key={req.id}>
                <div className="card-header" style={{ paddingBottom: 0 }}>
                  <div className="part-info">
                    <h3 style={{ fontSize: '0.95rem', margin: 0 }}>{part?.name || 'Unknown Part'}</h3>
                    <span className="req-id">#{req.id.slice(-6).toUpperCase()}</span>
                  </div>
                  {getStatusBadge(req.status)}
                </div>

                <div className="card-body">
                  <div className="info-grid">
                    <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                      <Car size={13} style={{ flexShrink: 0 }} />
                      {vehicle ? (
                        <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                          {vehicle.make} {vehicle.model}
                          {vehicle.plate && (
                            <span style={{ marginLeft: 6, color: 'var(--primary)', background: 'rgba(67,97,238,0.1)', padding: '1px 5px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 800 }}>
                              {vehicle.plate || vehicle.plateNumber}
                            </span>
                          )}
                        </span>
                      ) : <span>Unknown Vehicle</span>}
                    </div>
                    <div className="info-item">
                      <User size={13} />
                      <span style={{ fontSize: '0.78rem' }}>{mechanic?.name || '—'}</span>
                    </div>
                    <div className="info-item">
                      <Clock size={13} />
                      <span style={{ fontSize: '0.78rem' }}>{formatDate(req.timestamp)}</span>
                    </div>
                    <div className="info-item" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      <Store size={13} />
                      <span style={{ fontSize: '0.78rem' }}>{staff.find(s => String(s.id) === String(req.managerId))?.name || t('Unassigned Shop')}</span>
                    </div>
                    {req.status === 'picked-up' && (
                      <div className="info-item">
                        <DollarSign size={13} />
                        <span className={`payment-status ${req.paymentStatus || 'unpaid'}`} style={{ fontSize: '0.78rem' }}>
                          {t(req.paymentStatus === 'paid' ? 'paymentPaid' : req.paymentStatus === 'partial' ? 'paymentPartiallyPaid' : 'paymentUnpaid')}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="qty-tracking">
                    <div className="qty-item">
                      <span className="label">{t('Unit Price')}</span>
                      <span className="value" style={{ fontSize: '0.95rem' }}>${part?.price || 0}</span>
                    </div>
                    <div className="qty-item highlight">
                      <span className="label">{t('approvedQty')}</span>
                      <span className="value" style={{ fontSize: '0.95rem' }}>{req.approvedQty || 0}</span>
                    </div>
                    <div className="qty-item success">
                      <span className="label">{t('Total Cost')}</span>
                      <span className="value" style={{ fontSize: '0.95rem' }}>${(req.approvedQty || 0) * (part?.price || 0)}</span>
                    </div>
                  </div>

                  {/* Customer clickable button — shows name + vehicle plate */}
                  <div
                    className="customer-link"
                    onClick={() => handleOpenCustomer(req)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="label">{t('customer')}:</span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <span className="name" style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: '0.88rem' }}>
                        <User size={13} />
                        {customer?.name || 'Walk-in'}
                        {vehicle && (
                          <span style={{ marginLeft: 4, color: 'var(--primary)', background: 'rgba(67,97,238,0.1)', padding: '1px 5px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 800 }}>
                            {vehicle.plate || vehicle.plateNumber}
                          </span>
                        )}
                      </span>
                      <ChevronRight size={13} color="var(--primary)" />
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

      {/* CREATE MATERIAL REQUEST MODAL FOR MECHANICS / STOREKEEPERS */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content create-material-modal">
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Package size={22} color="var(--primary)" />
                {t('Request Materials')}
              </h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleSubmitBatchRequest} className="modal-form create-material-form">
              {/* Repair Order Selector */}
              <div className="form-group highlight-form-group">
                <label className="section-label" style={{ fontWeight: 700 }}>
                  <Wrench size={16} /> {t('Select Repair Order')} <span className="required">*</span>
                </label>
                <select 
                  value={selectedRepairId} 
                  onChange={(e) => setSelectedRepairId(e.target.value)}
                  required
                  className="custom-select"
                >
                  <option value="">-- {t('Choose Active Repair Order')} --</option>
                  {mechanicRepairs.map(r => {
                    const vehicle = (vehicles || []).find(v => String(v.id) === String(r.vehicleId));
                    return (
                      <option key={r.id} value={r.id}>
                        #{r.id.slice(-6).toUpperCase()} — {vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.plate || vehicle.plateNumber})` : `Repair #${r.id}`}
                      </option>
                    );
                  })}
                </select>
                {mechanicRepairs.length === 0 && (
                  <small className="help-text text-warning">
                    ⚠️ {t("No active assigned repairs found. You must be assigned to an active repair order to request materials.")}
                  </small>
                )}
              </div>

              {/* Parts Browser Filters */}
              <div className="parts-browser-section">
                <div className="section-header">
                  <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Search size={16} /> {t("Browse In-Stock Parts")}
                  </h4>
                </div>

                <div className="parts-filter-bar">
                  <div className="search-box mini-search">
                    <Search size={15} />
                    <input 
                      type="text" 
                      placeholder={t("Search part name or category...")} 
                      value={partSearchTerm}
                      onChange={(e) => setPartSearchTerm(e.target.value)}
                    />
                  </div>

                  <div className="filter-item mini-filter">
                    <Filter size={14} />
                    <select value={partCategoryFilter} onChange={(e) => setPartCategoryFilter(e.target.value)}>
                      <option value="all">{t("All Categories")}</option>
                      {inventoryCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="filter-item mini-filter">
                    <Package size={14} />
                    <select value={partAvailabilityFilter} onChange={(e) => setPartAvailabilityFilter(e.target.value)}>
                      <option value="in-stock">{t("In Stock Only")}</option>
                      <option value="low-stock">{t("Low Stock Only")}</option>
                      <option value="all">{t("All Parts (Incl. Out of Stock)")}</option>
                    </select>
                  </div>
                </div>

                {/* Available Inventory Grid */}
                <div className="available-parts-list">
                  {filteredInventory.length === 0 ? (
                    <div className="empty-parts-state">
                      <AlertCircle size={24} />
                      <p>{t("No matching available inventory parts found.")}</p>
                    </div>
                  ) : (
                    filteredInventory.map(part => {
                      const stock = parseInt(part.quantity || 0, 10);
                      const inBasket = requestBasket.find(b => String(b.partId) === String(part.id));
                      const isOutOfStock = stock <= 0;

                      return (
                        <div key={part.id} className={`part-browser-card ${isOutOfStock ? 'out-of-stock-card' : ''}`}>
                          <div className="part-card-main">
                            <div className="part-title-area">
                              <span className="part-name-text">{part.name || part.partName}</span>
                              <span className="part-category-tag">{part.category || 'General'}</span>
                            </div>
                            <div className="part-meta-area">
                              <span className="part-price-tag">${parseFloat(part.price || 0).toFixed(2)}</span>
                              <span className={`stock-badge ${isOutOfStock ? 'badge-out' : stock <= 5 ? 'badge-low' : 'badge-in'}`}>
                                {isOutOfStock ? t("Out of Stock") : `${stock} ${t("in stock")}`}
                              </span>
                            </div>
                          </div>

                          <div className="part-action-area">
                            {isOutOfStock ? (
                              <span className="unavailable-text">{t("Not Selectable")}</span>
                            ) : (
                              <button 
                                type="button" 
                                className={`btn-add-part ${inBasket ? 'in-basket' : ''}`}
                                onClick={() => handleAddToBasket(part, 1)}
                              >
                                {inBasket ? <Check size={14} /> : <Plus size={14} />}
                                {inBasket ? `${t("In Cart")} (${inBasket.requestedQty})` : t("Add to Request")}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Request Basket Summary */}
              {requestBasket.length > 0 && (
                <div className="request-basket-summary">
                  <div className="basket-header">
                    <span className="basket-title">
                      <ShoppingCart size={16} /> {t("Selected Parts Basket")} ({requestBasket.length})
                    </span>
                    <span className="basket-total">
                      {t("Total Cost")}: ${requestBasket.reduce((sum, item) => sum + (item.price * item.requestedQty), 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="basket-items-list">
                    {requestBasket.map(item => (
                      <div key={item.partId} className="basket-item-row">
                        <div className="basket-part-info">
                          <span className="basket-part-name">{item.partName}</span>
                          <span className="basket-part-sub">${item.price} / unit — Max: {item.availableStock}</span>
                        </div>
                        <div className="basket-qty-controls">
                          <input 
                            type="number" 
                            min="1" 
                            max={item.availableStock}
                            value={item.requestedQty}
                            onChange={(e) => handleUpdateBasketQty(item.partId, e.target.value)}
                            className="basket-qty-input"
                          />
                          <button 
                            type="button" 
                            className="basket-remove-btn"
                            onClick={() => handleRemoveFromBasket(item.partId)}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Notes */}
              <div className="form-group">
                <label>{t("Request Notes / Reason")}</label>
                <textarea 
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder={t("Enter any notes for the Inventory Manager (e.g. urgent, specific brand)...")}
                  rows={2}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-text" onClick={() => setShowCreateModal(false)}>
                  {t('cancel')}
                </button>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  disabled={isSubmittingBatch || requestBasket.length === 0 || !selectedRepairId}
                >
                  {isSubmittingBatch ? (
                    <><div className="spinner-small" style={{ marginRight: 8 }} /> {t("Submitting...")}</>
                  ) : (
                    <><Plus size={16} style={{ marginRight: 6 }} /> {t("Submit Material Request")}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialRequests;
