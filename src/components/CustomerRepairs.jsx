import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import {
  Wrench, Car, AlertCircle, CheckCircle2, Clock, Package,
  ChevronDown, ChevronUp, FileText, RefreshCw, Bell,
  User, Calendar, ClipboardList, Truck
} from 'lucide-react';
import './CustomerRepairs.css';

// ─── Progress Timeline Steps ────────────────────────────────────────────────
const TIMELINE_STEPS = [
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'material_request', label: 'Material Request', icon: Package },
  { key: 'in-progress', label: 'In Progress', icon: Wrench },
  { key: 'completed', label: 'Completed', icon: CheckCircle2 }
];

function getActiveStep(repair) {
  const { status, materialRequests = [] } = repair;
  const hasRequests = materialRequests.length > 0;

  if (status === 'completed' || status === 'delivered') {
    return 3; // Completed
  }
  if (status === 'in-progress') {
    return 2; // In Progress
  }
  if (status === 'waiting-for-parts' || hasRequests) {
    return 1; // Material Request
  }
  return 0; // Pending / Accepted
}

// ─── Status Config ───────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  accepted: { label: 'Accepted', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  'in-progress': { label: 'In Progress', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  'waiting-for-parts': { label: 'Waiting for Parts', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  completed: { label: 'Completed', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  delivered: { label: 'Delivered', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  cancelled: { label: 'Cancelled', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

const MR_STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#f59e0b' },
  approved: { label: 'Approved', color: '#3b82f6' },
  rejected: { label: 'Rejected', color: '#ef4444' },
  'picked-up': { label: 'Issued', color: '#10b981' },
  completed: { label: 'Completed', color: '#8b5cf6' },
};

// ─── Sub-component: Material Requests Table ──────────────────────────────────
const MaterialTable = ({ requests }) => {
  if (!requests || requests.length === 0) {
    return (
      <div className="cr-empty-mr">
        <Package size={28} opacity={0.3} />
        <span>No material requests for this repair</span>
      </div>
    );
  }
  return (
    <div className="cr-mr-table-wrap">
      <table className="cr-mr-table">
        <thead>
          <tr>
            <th>Material</th>
            <th>Requested</th>
            <th>Approved</th>
            <th>Issued</th>
            <th>Status</th>
            <th>Requested On</th>
            <th>Last Updated</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {requests.map(mr => {
            const cfg = MR_STATUS_CONFIG[mr.status] || { label: mr.status, color: '#64748b' };
            return (
              <tr key={mr.id}>
                <td className="cr-mr-name">{mr.partName}</td>
                <td className="cr-mr-qty">{mr.requestedQty}</td>
                <td className="cr-mr-qty">{mr.approvedQty || '—'}</td>
                <td className="cr-mr-qty">{mr.issuedQty || '—'}</td>
                <td>
                  <span className="cr-status-chip" style={{ color: cfg.color, background: cfg.color + '18', border: `1px solid ${cfg.color}44` }}>
                    {cfg.label}
                  </span>
                </td>
                <td className="cr-mr-date">{mr.timestamp ? new Date(mr.timestamp).toLocaleDateString() : '—'}</td>
                <td className="cr-mr-date">{mr.reviewedAt ? new Date(mr.reviewedAt).toLocaleDateString() : '—'}</td>
                <td className="cr-mr-notes">{mr.notes || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── Sub-component: Progress Timeline ────────────────────────────────────────
const ProgressTimeline = ({ repair }) => {
  const activeIdx = getActiveStep(repair);
  return (
    <div className="cr-timeline">
      {TIMELINE_STEPS.map((step, i) => {
        const Icon = step.icon;
        const done = i < activeIdx;
        const current = i === activeIdx;
        return (
          <div key={step.key} className={`cr-timeline-step ${done ? 'done' : ''} ${current ? 'current' : ''}`}>
            <div className="cr-step-line-before" />
            <div className="cr-step-dot">
              <Icon size={14} />
            </div>
            <div className="cr-step-line-after" />
            <div className="cr-step-label">{step.label}</div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Sub-component: Repair Card ───────────────────────────────────────────────
const RepairCard = ({ repair, navigate }) => {
  const [expanded, setExpanded] = useState(false);
  const { status, vehicle, mechanic, materialRequests = [], statusHistory = [] } = repair;
  const cfg = STATUS_CONFIG[status] || { label: status, color: '#64748b', bg: 'rgba(100,116,139,0.1)' };

  const plate = vehicle?.plateNumber || vehicle?.plate || '—';
  const vehicleName = vehicle ? `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim() : 'Unknown Vehicle';

  return (
    <div className={`cr-card ${status === 'completed' || status === 'delivered' ? 'cr-card-complete' : ''}`}>
      {/* Card Header */}
      <div className="cr-card-header">
        <div className="cr-card-id-row" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <span className="cr-order-id" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{plate}</span>
          <span className="cr-status-badge" style={{ color: cfg.color, background: cfg.bg, border: `1.5px solid ${cfg.color}55` }}>
            {cfg.label}
          </span>
        </div>

        <div className="cr-card-vehicle">
          <Car size={18} color="var(--primary)" />
          <div>
            <div className="cr-vehicle-name">{vehicleName}</div>
          </div>
        </div>

        <div className="cr-card-meta-row">
          {mechanic && (
            <div className="cr-meta-chip">
              <User size={13} />
              <span>{mechanic.name}</span>
            </div>
          )}
          <div className="cr-meta-chip">
            <Calendar size={13} />
            <span>In: {new Date(repair.entryDate).toLocaleDateString()}</span>
          </div>
          {repair.exitDate && (
            <div className="cr-meta-chip cr-meta-green">
              <CheckCircle2 size={13} />
              <span>Done: {new Date(repair.exitDate).toLocaleDateString()}</span>
            </div>
          )}
          {materialRequests.length > 0 && (
            <div className="cr-meta-chip">
              <Package size={13} />
              <span>{materialRequests.length} material{materialRequests.length > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Timeline */}
      <ProgressTimeline repair={repair} />

      {/* Service Description */}
      {repair.description && (
        <div className="cr-description">
          <div className="cr-section-label">Service Description</div>
          <p>{repair.description}</p>
        </div>
      )}

      {/* Completion Notes */}
      {repair.completionNotes && (
        <div className="cr-completion-notes">
          <CheckCircle2 size={14} color="#10b981" />
          <div>
            <div className="cr-section-label" style={{ color: '#059669' }}>Mechanic Notes</div>
            <p>{repair.completionNotes}</p>
          </div>
        </div>
      )}

      {/* Expand/Collapse toggle */}
      <button className="cr-expand-btn" onClick={() => setExpanded(e => !e)}>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        {expanded ? 'Hide details' : 'View material requests & history'}
      </button>

      {expanded && (
        <div className="cr-expanded-section">
          {/* Material Requests */}
          <div className="cr-section-label" style={{ marginBottom: 10 }}>
            <Package size={14} /> Material Requests
          </div>
          <MaterialTable requests={materialRequests} />

          {/* Status History */}
          {statusHistory.length > 0 && (
            <div className="cr-history-section">
              <div className="cr-section-label" style={{ marginTop: 20, marginBottom: 10 }}>
                <ClipboardList size={14} /> Repair History
              </div>
              <div className="cr-history-list">
                {statusHistory.map((h, i) => (
                  <div key={h.id || i} className="cr-history-item">
                    <div className="cr-history-dot" />
                    <div className="cr-history-info">
                      <span className="cr-history-status">{h.status?.replace('-', ' ').toUpperCase()}</span>
                      {h.notes && <span className="cr-history-note"> — {h.notes}</span>}
                      <div className="cr-history-date">
                        {h.changedBy && <span>{h.changedBy}</span>}
                        {h.createdAt && <span> · {new Date(h.createdAt).toLocaleString()}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoice button for completed repairs */}
          {(status === 'completed' || status === 'delivered') && (
            <button className="cr-invoice-btn" onClick={() => navigate('/billing#invoices')}>
              <FileText size={15} /> View Invoice
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const CustomerRepairs = () => {
  const { currentUser } = useAuth();
  const { addNotification, t } = useAppContext();
  const navigate = useNavigate();

  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');

  const fetchRepairs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.getCustomerRepairs();
      setRepairs(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
    } catch (err) {
      if (!silent) addNotification('Failed to load your repair orders.', 'error');
      console.error('CustomerRepairs fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  // Initial load
  useEffect(() => { fetchRepairs(); }, [fetchRepairs]);

  // Real-time polling every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchRepairs(true), 30000);
    return () => clearInterval(interval);
  }, [fetchRepairs]);

  // Distinct vehicles for filter strip
  const vehicles = [...new Map(
    repairs.filter(r => r.vehicle).map(r => [r.vehicleId, r.vehicle])
  ).values()];

  // Only show these 3 statuses to customers
  const VISIBLE_STATUSES = ['pending', 'in-progress', 'completed'];
  const statuses = ['all', 'pending', 'in-progress', 'completed'];

  const filtered = repairs
    .filter(r => VISIBLE_STATUSES.includes(r.status))   // only show relevant statuses
    .filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (vehicleFilter !== 'all' && r.vehicleId !== vehicleFilter) return false;
      if (search) {
        const plate = r.vehicle?.plateNumber || r.vehicle?.plate || '';
        const make = r.vehicle?.make || '';
        const model = r.vehicle?.model || '';
        const desc = r.description || '';
        const q = search.toLowerCase();
        if (![plate, make, model, desc].some(s => s.toLowerCase().includes(q))) return false;
      }
      return true;
    });


  return (
    <div className="page-content cr-page">
      {/* ── Header ── */}
      <div className="cr-page-header">
        <div className="cr-header-title">
          <div className="icon-wrapper"><Wrench size={26} /></div>
          <div>
            <h1>My Repairs</h1>
            <p className="subtitle">Track your vehicle repair history and live status</p>
          </div>
        </div>
        <div className="cr-header-actions">
          {lastUpdated && (
            <span className="cr-last-updated">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button className="cr-refresh-btn" onClick={() => fetchRepairs()} title="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* ── Vehicle Filter Strip ── */}
      {vehicles.length > 1 && (
        <div className="cr-vehicle-strip">
          <button
            className={`cr-vehicle-chip ${vehicleFilter === 'all' ? 'active' : ''}`}
            onClick={() => setVehicleFilter('all')}
          >
            All Vehicles
          </button>
          {vehicles.map(v => (
            <button
              key={v.id}
              className={`cr-vehicle-chip ${vehicleFilter === v.id ? 'active' : ''}`}
              onClick={() => setVehicleFilter(v.id)}
            >
              <Car size={13} />
              {v.plateNumber || v.plate} — {v.make} {v.model}
            </button>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="cr-filter-bar">
        <div className="search-box" style={{ flex: 1, minWidth: 220 }}>
          <AlertCircle size={16} className="search-icon" style={{ opacity: 0.4 }} />
          <input
            type="text"
            placeholder="Search by plate, make, model..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="cr-status-chips">
          {statuses.map(s => (
            <button
              key={s}
              className={`cr-status-chip ${statusFilter === s ? 'active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label || s}
              <span className="cr-count-badge">
                {s === 'all'
                  ? repairs.length
                  : repairs.filter(r => r.status === s).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="cr-loading">
          <div className="spinner-large" />
          <p>Loading your repair history…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="cr-empty">
          <Wrench size={56} opacity={0.2} />
          <h3>{repairs.length === 0 ? 'No repair orders found' : 'No repairs match your filters'}</h3>
          <p>{repairs.length === 0 ? 'Your repair orders will appear here once created by the garage.' : 'Try adjusting your search or filter.'}</p>
        </div>
      ) : (
        <div className="cr-cards-grid">
          {filtered.map(repair => (
            <RepairCard key={repair.id} repair={repair} navigate={navigate} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerRepairs;
