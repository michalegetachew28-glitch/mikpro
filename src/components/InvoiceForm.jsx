import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { X, Plus, Trash2, Save, FileText, User, Car, Wrench } from 'lucide-react';

const InvoiceForm = ({ onClose, onSave }) => {
  const { customers, vehicles, repairs, t, language, billingSettings, formatDate, requestConfirmation } = useAppContext();
  const { currentUser } = useAuth();
  
  const [customerId, setCustomerId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [repairId, setRepairId] = useState('');
  const [laborCost, setLaborCost] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(billingSettings.taxRate || 15);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  // Auto-set due date to 7 days from now
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setDueDate(d.toISOString().split('T')[0]);
  }, []);

  const customerVehicles = vehicles.filter(v => v.customerId === customerId);
  const vehicleRepairs = repairs.filter(r => r.vehicleId === vehicleId && r.status === 'completed');

  const handleRepairChange = (id) => {
    setRepairId(id);
    const repair = repairs.find(r => r.id === id);
    if (repair) {
      setLaborCost(repair.laborCost || 0);
    }
  };

  const calculateSubtotal = () => {
    return parseFloat(laborCost || 0);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!customerId || !vehicleId) {
      alert(t('Please select a customer and vehicle.'));
      return;
    }

    const selectedCustomer = customers.find(c => c.id === customerId);
    const selectedVehicle = vehicles.find(v => v.id === vehicleId);
    
    const subtotal = calculateSubtotal();
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax - parseFloat(discount || 0);

    const newInvoice = {
      id: `INV-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      customerId,
      customerName: selectedCustomer?.name,
      customerPhone: selectedCustomer?.phone,
      customerAddress: selectedCustomer?.address,
      vehicleId,
      vehicleInfo: `${selectedVehicle?.year} ${selectedVehicle?.make} ${selectedVehicle?.model}`,
      vehiclePlate: selectedVehicle?.plate,
      date: new Date().toISOString(),
      dueDate,
      laborCost,
      discount,
      tax,
      subtotal,
      total,
      status: 'unpaid',
      notes,
      repairId,
      invoice_type: 'repair',
      owner_id: currentUser.id,
      managerId: currentUser.id,
      managerName: currentUser.name
    };

    onSave(newInvoice);
  };

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

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="grid-2-col" style={{ marginBottom: 24 }}>
            <div className="form-group">
              <label><User size={16} /> {t('selectCustomer')}</label>
              <select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setVehicleId(''); }} required className="auth-input">
                <option value="">-- {t('selectCustomer')} --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label><Car size={16} /> {t('selectVehicle')}</label>
              <select value={vehicleId} onChange={(e) => { setVehicleId(e.target.value); setRepairId(''); }} required disabled={!customerId} className="auth-input">
                <option value="">-- {t('selectVehicle')} --</option>
                {customerVehicles.map(v => <option key={v.id} value={v.id}>{v.plate} - {v.make} {v.model}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 24 }}>
            <label><Wrench size={16} /> {t("Link to Repair Job")}</label>
            <select value={repairId} onChange={(e) => handleRepairChange(e.target.value)} disabled={!vehicleId} className="auth-input">
              <option value="">-- {t("Select Completed Repair (Optional)")} --</option>
              {vehicleRepairs.map(r => (
                <option key={r.id} value={r.id}>
                  #{r.id.toUpperCase()} - {r.notes.substring(0, 30)}... ({formatDate(r.dateIn)})
                </option>
              ))}
            </select>
            <p style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: 4 }}>
              {t("Selecting a repair will auto-fill labor cost.")}
            </p>
          </div>

          <div className="form-group" style={{ marginBottom: 24 }}>
            <label>{t('laborCost')}</label>
            <input type="number" value={laborCost || ''} onChange={(e) => setLaborCost(e.target.value)} className="auth-input" placeholder="0.00" /> ETB
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

          <div className="form-group" style={{ marginTop: 24 }}>
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
                <button type="submit" className="btn-primary"><Save size={18} /> {t('save')}</button>
             </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InvoiceForm;
