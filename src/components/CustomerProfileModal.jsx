import React from 'react';
import { 
  X, User, MapPin, Phone, Mail, Car, Wrench, 
  History, CreditCard, ExternalLink, Calendar, CheckCircle2
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const CustomerProfileModal = ({ customer, onClose, onGenerateBill, isSubmitting, isBillSent }) => {
  const { vehicles, repairs, invoices, language, t, formatDate } = useAppContext();

  if (!customer) return null;

  const customerVehicles = customer.vehicles || vehicles.filter(v => v.customerId === customer.id);
  const customerRepairs = customer.repairs || repairs.filter(r => {
    const v = r.vehicle || vehicles.find(veh => veh.id === r.vehicleId);
    return v && v.customerId === customer.id;
  });
  const customerInvoices = customer.invoices || invoices.filter(inv => inv.customerId === customer.id);

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="modal-content modal-lg" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="profile-photo-circle" style={{ width: 48, height: 48, background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: '1.2rem', fontWeight: 'bold' }}>
              {customer.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 style={{ marginBottom: 0 }}>{customer.name}</h2>
              <span className="status-badge status-paid">{t('customer')}</span>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="profile-grid" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
            {/* Sidebar Column */}
            <div className="profile-contact-info">
              <section className="info-block" style={{ background: 'var(--bg-main)', padding: 16, borderRadius: 12, marginBottom: 16 }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <User size={18} /> {t('contactInfo')}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
                    <Phone size={14} color="var(--text-secondary)" /> {customer.phone}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
                    <Mail size={14} color="var(--text-secondary)" /> {customer.email || 'No email provided'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
                    <MapPin size={14} color="var(--text-secondary)" /> {customer.address || 'No address'}
                  </div>
                </div>
              </section>

              <section className="vehicle-block">
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                   <Car size={18} /> {t('vehicles')} ({customerVehicles.length})
                </h4>
                {customerVehicles.length === 0 ? (
                  <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>No vehicles registered.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {customerVehicles.map(v => (
                      <div key={v.id} style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', padding: 12, borderRadius: 10 }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{v.year} {v.make} {v.model}</div>
                        <span className="plate-badge-small" style={{ marginTop: 6, display: 'inline-block' }}>{v.plate}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Main Column */}
            <div className="profile-history">
              <section className="history-tabs">
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
                  <div style={{ padding: '10px 20px', borderBottom: '2px solid var(--primary)', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>
                    {t('repairHistory')} / {t('materialRequests')}
                  </div>
                </div>

                <div className="history-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {customerRepairs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>
                      <Wrench size={48} style={{ marginBottom: 12 }} />
                      <p>No job history found.</p>
                    </div>
                  ) : (
                    customerRepairs.map(repair => (
                      <div key={repair.id} style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', padding: 16, borderRadius: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Job #{repair.id}</span>
                          <span className={`status-badge status-${repair.status}`}>{t(repair.status)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                           <Calendar size={14} /> {formatDate(repair.dateIn)}
                        </div>
                        <p style={{ margin: '8px 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{repair.notes}</p>
                      </div>
                    ))
                  )}
                </div>

                <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '24px 0 16px' }}>
                   <CreditCard size={18} /> {t('billingHistory')}
                </h4>
                <div className="billing-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {customerInvoices.length === 0 ? (
                    <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>No invoices issued.</p>
                  ) : (
                    customerInvoices.map(inv => (
                      <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-main)', borderRadius: 8, fontSize: '0.9rem' }}>
                        <span>{inv.id} - {formatDate(inv.date)}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontWeight: 600 }}>{inv.total.toLocaleString()} ETB</span>
                          <span className={`status-badge status-${inv.status}`}>{t(inv.status)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>

        <div className="modal-actions" style={{ position: 'sticky', bottom: 0, background: 'var(--bg-card)', borderTop: '1px solid var(--border)', padding: 20 }}>
          <button className="btn-text" onClick={onClose}>{t('close')}</button>
          <button 
            className={`btn-primary ${isSubmitting || isBillSent ? 'disabled' : ''}`} 
            onClick={onGenerateBill}
            disabled={isSubmitting || isBillSent}
            style={{ 
              background: isBillSent ? '#64748b' : 'var(--primary)',
              opacity: (isSubmitting || isBillSent) ? 0.8 : 1,
              cursor: (isSubmitting || isBillSent) ? 'not-allowed' : 'pointer'
            }}
          >
            {isSubmitting ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="spinner-small" /> {t("Generating...")}
              </span>
            ) : isBillSent ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={18} /> {t("Sent Bill")}
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FilePlus size={18} /> {t("Generate New Invoice")}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Generic icon for generate bill
const FilePlus = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
);

export default CustomerProfileModal;
