import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { X, Plus, Trash2, Save, FileText, User, Car, Wrench, AlertCircle } from 'lucide-react';

const InvoiceForm = ({ onClose, onSave, prefill }) => {
  const { customers, vehicles, repairs, t, language, billingSettings, formatDate, requestConfirmation, addNotification } = useAppContext();
  const { currentUser } = useAuth();

  const [customerId, setCustomerId] = useState(prefill?.customerId || '');
  const [vehicleId, setVehicleId] = useState(prefill?.vehicleId || '');
  const [repairId, setRepairId] = useState(prefill?.repairId || '');
  const [laborCost, setLaborCost] = useState(prefill?.laborCost || 0);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(billingSettings?.taxRate || 15);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Prefill-derived display info
  const [prefillInfo] = useState({
    customerName: prefill?.customerName || '',
    vehicleInfo: prefill?.vehicleInfo || '',
    vehiclePlate: prefill?.vehiclePlate || '',
    mechanicId: prefill?.mechanicId || '',
    mechanicName: prefill?.mechanicName || '',
    customerPhone: prefill?.customerPhone || '',
    customerAddress: prefill?.customerAddress || '',
  });

  // Auto-set due date to 7 days from now
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setDueDate(d.toISOString().split('T')[0]);
  }, []);

  // When repair changes, auto-fill labor
  const handleRepairChange = (id) => {
    setRepairId(id);
    const repair = repairs.find(r => r.id === id);
    if (repair) {
      setLaborCost(repair.laborCost || 0);
    }
  };

  const customerVehicles = vehicles.filter(v => v.customerId === customerId);
  const vehicleRepairs = repairs.filter(r => {
    if (vehicleId) return r.vehicleId === vehicleId;
    if (customerId) {
      const custVehIds = customerVehicles.map(v => v.id);
      return custVehIds.includes(r.vehicleId);
    }
    return false;
  });

  const calculateSubtotal = () => parseFloat(laborCost || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const selectedCustomer = prefill?.customerId ? null : customers.find(c => c.id === customerId);
    const selectedVehicle = prefill?.vehicleId ? null : vehicles.find(v => v.id === vehicleId);

    // Build resolved values (prefill > selected)
    const resolvedCustomerId = prefill?.customerId || customerId;
    const resolvedCustomerName = prefill?.customerName || selectedCustomer?.name || '';
    const resolvedCustomerPhone = prefill?.customerPhone || selectedCustomer?.phone || '';
    const resolvedCustomerAddress = prefill?.customerAddress || selectedCustomer?.address || '';
    const resolvedVehicleId = prefill?.vehicleId || vehicleId;
    const resolvedVehicleInfo = prefill?.vehicleInfo || (selectedVehicle ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}` : '');
    const resolvedVehiclePlate = prefill?.vehiclePlate || selectedVehicle?.plateNumber || selectedVehicle?.plate || '';

    if (!resolvedCustomerName || !dueDate) {
      setError(t('Please select a customer and set a due date.'));
      return;
    }

    if (submitting) return;
    setSubmitting(true);

    const subtotal = calculateSubtotal();
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax - parseFloat(discount || 0);

    const invoicePayload = {
      customerId: resolvedCustomerId,
      customerName: resolvedCustomerName,
      customerPhone: resolvedCustomerPhone,
      customerAddress: resolvedCustomerAddress,
      vehicleId: resolvedVehicleId,
      vehicleInfo: resolvedVehicleInfo,
      vehiclePlate: resolvedVehiclePlate,
      dueDate,
      laborCost: parseFloat(laborCost || 0),
      discount: parseFloat(discount || 0),
      notes,
      repairId: prefill?.repairId || repairId || null,
      invoice_type: 'repair',
      mechanicId: prefill?.mechanicId || null,
    };

    try {
      const data = await api.createInvoice(invoicePayload);

      // Map backend response to frontend shape
      const newInvoice = {
        id: data.orderId || data.id,
        ...data,
        status: 'unpaid',
        date: data.createdAt || new Date().toISOString()
      };

      onSave(newInvoice);
    } catch (err) {
      setError(err.message || 'Failed to create invoice. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isPrefilled = !!(prefill?.repairId);

  return (
    <div className="modal-overlay">
      <div className="modal-content invoice-form-modal">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
             <div className="icon-wrapper"><FileText size={20} /></div>
             <h2>{t("Create New Invoice")}</h2>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={24} /></button>
        </div>

        {error && (
          <div style={{ padding: '10px 20px', background: 'rgba(230,57,70,0.08)', borderBottom: '1px solid var(--danger)', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontSize: '0.88rem', fontWeight: 600 }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {isPrefilled && (
          <div style={{ padding: '10px 20px', background: 'rgba(16,185,129,0.08)', borderBottom: '1px solid rgba(16,185,129,0.3)', fontSize: '0.85rem', color: '#059669', fontWeight: 600 }}>
            ✓ {t('Auto-filled from Repair Order')} #{(prefill.repairId || '').slice(-8).toUpperCase()}
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="grid-2-col" style={{ marginBottom: 20 }}>
            <div className="form-group">
              <label><User size={16} /> {t('selectCustomer')}</label>
              {isPrefilled ? (
                <div style={{ padding: '10px 14px', background: 'rgba(67,97,238,0.07)', border: '1px solid rgba(67,97,238,0.3)', borderRadius: 8, fontWeight: 600 }}>
                  {prefillInfo.customerName || t('(from repair order)')}
                </div>
              ) : (
                <select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setVehicleId(''); }} required className="auth-input">
                  <option value="">-- {t('selectCustomer')} --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                </select>
              )}
            </div>
            <div className="form-group">
              <label><Car size={16} /> {t('selectVehicle')}</label>
              {isPrefilled ? (
                <div style={{ padding: '10px 14px', background: 'rgba(67,97,238,0.07)', border: '1px solid rgba(67,97,238,0.3)', borderRadius: 8, fontWeight: 600 }}>
                  {prefillInfo.vehiclePlate ? `${prefillInfo.vehiclePlate} – ${prefillInfo.vehicleInfo}` : t('(from repair order)')}
                </div>
              ) : (
                <select value={vehicleId} onChange={(e) => { setVehicleId(e.target.value); setRepairId(''); }} required={!isPrefilled} disabled={!customerId} className="auth-input">
                  <option value="">-- {t('selectVehicle')} --</option>
                  {customerVehicles.map(v => <option key={v.id} value={v.id}>{v.plateNumber || v.plate || 'No Plate'} - {v.make || ''} {v.model}</option>)}
                </select>
              )}
            </div>
          </div>

          {!isPrefilled && (
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label><Wrench size={16} /> {t("Link to Repair Job")}</label>
              <select value={repairId} onChange={(e) => handleRepairChange(e.target.value)} disabled={!vehicleId && !customerId} className="auth-input">
                <option value="">-- {t("Select Completed Repair (Optional)")} --</option>
                {vehicleRepairs.filter(r => r.status === 'completed').map(r => (
                  <option key={r.id} value={r.id}>
                    #{(r.id || '').slice(-8).toUpperCase()} - {(r.notes || r.description || '').substring(0, 30)} ({formatDate(r.dateIn || r.entryDate)})
                  </option>
                ))}
              </select>
              <p style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: 4 }}>
                {t("Selecting a repair will auto-fill labor cost.")}
              </p>
            </div>
          )}

          {isPrefilled && prefillInfo.mechanicName && (
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label><Wrench size={16} /> {t('Assigned Mechanic')}</label>
              <div style={{ padding: '10px 14px', background: 'rgba(67,97,238,0.07)', border: '1px solid rgba(67,97,238,0.3)', borderRadius: 8, fontWeight: 600 }}>
                {prefillInfo.mechanicName}
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label>{t('laborCost')}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" value={laborCost || ''} onChange={(e) => setLaborCost(e.target.value)} className="auth-input" placeholder="0.00" style={{ flex: 1 }} />
              <span style={{ fontWeight: 700 }}>ETB</span>
            </div>
          </div>

          <div className="grid-2-col">
            <div className="form-group">
              <label>{t('discount')}</label>
              <input type="number" value={discount || ''} onChange={(e) => setDiscount(e.target.value)} className="auth-input" />
            </div>
            <div className="form-group">
              <label>{t('dueDate')}</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="auth-input" required />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 20 }}>
            <label>{t('notes')}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="auth-input" rows="2" placeholder={t("Warranty info, payment terms, etc.")}></textarea>
          </div>

          <div className="modal-footer">
             <div className="total-preview">
                <span style={{ fontSize: '0.9rem', color: '#64748b' }}>{t("Total Preview:")}</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, marginLeft: 12, color: 'var(--primary)' }}>
                   {t('ETB')} {(calculateSubtotal() * (1 + taxRate/100) - parseFloat(discount || 0)).toLocaleString()}
                </span>
             </div>
             <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="btn-outline" onClick={onClose}>{t('cancel')}</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  <Save size={18} /> {submitting ? t('Saving...') : t('save')}
                </button>
             </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InvoiceForm;
