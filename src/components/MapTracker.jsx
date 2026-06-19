import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Navigation, MapPin, Truck, AlertTriangle, CheckCircle2, User, Wrench, Clock, Check, Trash2, Edit2 } from 'lucide-react';
import './MapTracker.css';

// Fix for default Leaflet icons in Webpack/Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Icons
const customerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [30, 46],
  iconAnchor: [15, 46],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const mechanicIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [30, 46],
  iconAnchor: [15, 46],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const garageIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [30, 46],
  iconAnchor: [15, 46],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Auto-center map component
const MapUpdater = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom || map.getZoom());
  }, [center, zoom, map]);
  return null;
};

// Location Picker Component
const LocationPicker = ({ onLocationSelect }) => {
  const map = useMap();
  useEffect(() => {
    const handleClick = (e) => {
      onLocationSelect([e.latlng.lat, e.latlng.lng]);
    };
    map.on('click', handleClick);
    return () => map.off('click', handleClick);
  }, [map, onLocationSelect]);
  return null;
};

// Main Component
const MapTracker = () => {
  const { activeTrackers, setActiveTrackers, addItem, updateItem, deleteItem, customers, staff, language, t, addNotification } = useAppContext();
  const { currentUser } = useAuth();

  const [selectedTrackerId, setSelectedTrackerId] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [pinningLocation, setPinningLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTrackerId, setEditingTrackerId] = useState(null);

  // Stabilize location selection callback to prevent listener leaks
  const handleLocationSelect = useCallback((coords) => {
    console.log("[DEBUG Live Tracking] Map clicked at:", coords);
    setPinningLocation(coords);
  }, []);

  // Auto-locate when user starts requesting assistance
  useEffect(() => {
    if (isSelectingLocation && !pinningLocation) {
      setIsLocating(true);
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coords = [position.coords.latitude, position.coords.longitude];
            setPinningLocation(coords);
            setIsLocating(false);
            addNotification(t("GPS location found!"), 'success');
          },
          (error) => {
            console.warn("Geolocation error:", error);
            setIsLocating(false);
            // Fallback to Addis Ababa center if GPS fails so the user can still confirm
            const fallback = [9.03, 38.74];
            setPinningLocation(fallback);
            addNotification(t("Could not get GPS. Using default location. Please click on map to adjust."), 'warning');
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      } else {
        setIsLocating(false);
        // Fallback to Addis Ababa center if Geolocation is not supported
        setPinningLocation([9.03, 38.74]);
        addNotification(t("Geolocation not supported. Please click on map to adjust."), 'warning');
      }
    }
  }, [isSelectingLocation, pinningLocation, t, addNotification]);

  // Helper to get coordinates from address using Nominatim (OSM)
  const geocodeAddress = async (address) => {
    if (!address) return null;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      }
    } catch (error) {
      console.error("Geocoding failed:", error);
    }
    return null;
  };

  // Filter trackers based on role - Memoized to prevent effect re-runs
  const myTrackers = useMemo(() => {
    console.log("[DEBUG Live Tracking] Computing myTrackers. Total activeTrackers:", activeTrackers?.length || 0);
    console.log("[DEBUG Live Tracking] Current User:", currentUser?.id, "Role:", currentUser?.role);

    return (activeTrackers || []).filter(t => {
      const role = currentUser?.role?.toLowerCase();

      // Allow ALL garage staff roles to see the active jobs list
      const isStaff = ['admin', 'manager', 'coder', 'receptionist', 'cashier', 'storekeeper', 'inventorymanager'].includes(role);

      const isVisible = isStaff ? true
        : (role === 'mechanic') ? String(t.mechanicId) === String(currentUser?.id)
          : String(t.customerId) === String(currentUser?.id);

      console.log(`[DEBUG Live Tracking] Evaluated tracker ${t.id} for role ${role}. Visible: ${isVisible}, Customer: ${t.customerId}, Owner: ${t.ownerId}`);
      return isVisible;
    });
  }, [activeTrackers, currentUser?.role, currentUser?.id]);

  const selectedTracker = useMemo(() => {
    return myTrackers.find(t => t.id === selectedTrackerId) || myTrackers[0];
  }, [myTrackers, selectedTrackerId]);

  const handleRequestAssistance = () => {
    console.log("[DEBUG Live Tracking] Confirm Location button clicked. pinningLocation:", pinningLocation);
    if (pinningLocation) {
      const repairId = `r_${Date.now()}`;

      // FORCE CONSISTENT OWNER ID FOR ROADSIDE (Default to primary garage '0001')
      const targetOwnerId = currentUser?.ownerId || '0001';
      const prefix = `garage_${targetOwnerId}_`;

      // Create Repair Entry
      const newRepair = {
        id: repairId,
        customerId: currentUser?.id || `guest_${Date.now()}`,
        ownerId: targetOwnerId,
        vehicleId: '',
        status: 'pending',
        notes: 'Roadside Assistance Request (via Map)',
        isRoadside: true,
        location: pinningLocation,
        dateIn: new Date().toISOString(),
        laborCost: 0,
        parts: []
      };

      // Create Tracker Entry
      const newTracker = {
        id: `tr_${repairId}`,
        repairId: repairId,
        customerId: currentUser?.id || `guest_${Date.now()}`,
        mechanicId: null, // Initially unassigned
        customerLocation: pinningLocation,
        mechanicLocation: [9.03, 38.74], // Default garage location
        status: 'pending',
        ownerId: targetOwnerId,
        timestamp: new Date().toISOString()
      };

      console.log("[DEBUG Live Tracking] Finalizing request assistance submission for owner:", targetOwnerId);

      // DISPATCH TO CONTEXT (Already handles BroadCastChannel sync and LocalStorage persistence)
      if (editingTrackerId) {
        // UPDATE Existing Tracker
        updateItem('trackers', editingTrackerId, {
          customerLocation: pinningLocation,
          timestamp: new Date().toISOString()
        });

        // Also update associated repair if possible
        const tracker = activeTrackers.find(t => t.id === editingTrackerId);
        if (tracker && tracker.repairId) {
          updateItem('repairs', tracker.repairId, { location: pinningLocation });
        }

        addNotification(t("Location updated successfully!"), 'success');
      } else {
        // ADD New Tracker
        addItem('repairs', newRepair);
        addItem('trackers', newTracker);
        addNotification(t("Repair request sent with location!"), 'success');
      }

      // RESET UI STATE
      setIsSelectingLocation(false);
      setPinningLocation(null);
      setEditingTrackerId(null);
      if (!editingTrackerId) setSelectedTrackerId(editingTrackerId || newTracker.id);
      setViewMode('list'); // Automatically switch to list view to show the new tracking card

      console.log("[DEBUG Live Tracking] handleRequestAssistance completed successfully.");
    } else {
      setIsSelectingLocation(true);
    }
  };

  const handleEditLocation = (trackerId) => {
    const tracker = activeTrackers.find(t => t.id === trackerId);
    if (!tracker) return;

    setEditingTrackerId(trackerId);
    setPinningLocation(tracker.customerLocation);
    setIsSelectingLocation(true);
    addNotification(t("Click on map to update your location."), 'info');
  };

  const handleCancelRequest = (trackerId) => {
    const tracker = activeTrackers.find(t => t.id === trackerId);
    if (!tracker) return;

    if (window.confirm(t("Are you sure you want to cancel this assistance request?"))) {
      deleteItem('trackers', trackerId);
      if (tracker.repairId) {
        deleteItem('repairs', tracker.repairId);
      }
      addNotification(t("Request cancelled."), 'info');
    }
  };

  const handleStartJourney = (trackerId) => {
    const garageCoords = [9.02, 38.75]; // Ethiopia Garage center
    updateItem('trackers', trackerId, {
      status: 'started',
      mechanicLocation: garageCoords,
      journeyStartTime: new Date().toISOString()
    });
    addNotification(t("Journey started! Tracking is live."), 'info');
    setSimulating(true);
  };

  const handleArrived = (trackerId) => {
    const tracker = activeTrackers.find(t => t.id === trackerId);
    if (!tracker) return;

    updateItem('trackers', trackerId, {
      status: 'arrived',
      mechanicLocation: tracker.customerLocation
    });

    // Update Repair Status to In-Progress
    if (tracker.repairId) {
      updateItem('repairs', tracker.repairId, { status: 'in-progress' });
    }

    addNotification(t("Mechanic has arrived at your location!"), 'success', tracker.customerId);
    setSimulating(false);
  };

  const handleCompleteRepair = (trackerId) => {
    updateItem('trackers', trackerId, { status: 'completed' });
    addNotification(t("Repair completed successfully."), 'success');
  };

  const handleAssignMechanic = (trackerId, mechanicId) => {
    const mechanicStart = [9.03, 38.74]; // Ethiopia Garage center
    updateItem('trackers', trackerId, {
      mechanicId,
      status: 'assigned',
      mechanicLocation: mechanicStart
    });

    // Also update the repair record to match
    const tracker = activeTrackers.find(t => t.id === trackerId);
    if (tracker && tracker.repairId) {
      updateItem('repairs', tracker.repairId, { mechanicId });
    }

    addNotification(t("Mechanic assigned to roadside job."), 'success');
  };

  // Simulate movement automatically (Driven by Mechanic's tab)
  useEffect(() => {
    if (currentUser?.role !== 'mechanic') return;

    // Find my active started jobs
    const activeJobs = activeTrackers.filter(t => t.mechanicId === currentUser.id && t.status === 'started');
    if (activeJobs.length === 0) {
      if (simulating) setSimulating(false);
      return;
    }

    setSimulating(true);

    const interval = setInterval(() => {
      activeJobs.forEach(job => {
        const { customerLocation, mechanicLocation } = job;
        if (!customerLocation || !mechanicLocation) return;

        const latDiff = customerLocation[0] - mechanicLocation[0];
        const lngDiff = customerLocation[1] - mechanicLocation[1];
        const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

        // If arrived (tolerance)
        if (distance < 0.0005) {
          handleArrived(job.id);
          return;
        }

        // Move 2% per tick (every 1s) for much smoother motion
        const step = 0.02;
        const newLocation = [
          mechanicLocation[0] + latDiff * step,
          mechanicLocation[1] + lngDiff * step
        ];

        updateItem('trackers', job.id, { mechanicLocation: newLocation });
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTrackers, updateItem, simulating, currentUser?.id]);

  // Calculate ETA mock purely based on distance
  const calculateETA = (tracker) => {
    if (!tracker || !tracker.customerLocation || !tracker.mechanicLocation) return '--';
    if (tracker.status === 'arrived') return '0 mins';

    const latDiff = tracker.customerLocation[0] - tracker.mechanicLocation[0];
    const lngDiff = tracker.customerLocation[1] - tracker.mechanicLocation[1];
    const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

    // Completely mocked time (distance * huge multiplier for minutes)
    const mins = Math.max(1, Math.round(distance * 500));
    return `${mins} mins`;
  };

  const mechanics = staff.filter(s => s.role === 'mechanic');

  const getStatusStep = (status) => {
    const steps = ['pending', 'assigned', 'started', 'arrived', 'in-progress', 'completed'];
    return steps.indexOf(status);
  };

  return (
    <div className="page-content map-tracker-container">
      <div className="map-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Navigation size={28} className="text-primary" /> {t("Live Ethiopia Tracking")}
          </h1>
          <p className="subtitle">
            {t("Monitor real-time repair progress across Ethiopia.")}
          </p>
        </div>

        <div className="map-actions">
          {currentUser.role === 'customer' && !isSelectingLocation && (
            <button
              className="btn-primary danger-btn"
              onClick={() => setIsSelectingLocation(true)}
              disabled={isLocating}
            >
              <AlertTriangle size={18} /> {t("Request Roadside Assistance")}
            </button>
          )}

          {isSelectingLocation && (
            <div className="pinning-controls">
              <span className="pinning-label">
                <MapPin size={16} /> {pinningLocation ? t("Location Selected!") : t("Click on map to pin location")}
              </span>
              <button
                className="btn-primary"
                onClick={handleRequestAssistance}
                disabled={!pinningLocation || isLocating}
              >
                {t("Confirm Location")}
              </button>
              <button className="btn-outline" onClick={() => setIsSelectingLocation(false)}>
                {t("Cancel")}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="map-layout">
        <aside className="tracker-sidebar glass-panel">
          <div className="sidebar-header">
            <h3>{t("Active Jobs")}</h3>
            <div className="tracker-stats" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="btn-icon small"
                onClick={() => window.location.reload()}
                title={t("Refresh Page")}
                style={{ padding: '4px', background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}
              >
                <Clock size={14} />
              </button>
              <span>{myTrackers.length} {t("Active")}</span>
            </div>
          </div>

          <div className="tracker-list">
            {myTrackers.length === 0 ? (
              <div className="empty-tracker">
                <Truck size={32} style={{ opacity: 0.2 }} />
                <p>{t("No active tracking sessions.")}</p>
              </div>
            ) : (
              myTrackers.map(tracker => {
                const customer = customers.find(c => c.id === tracker.customerId);
                const isSelected = selectedTrackerId === tracker.id;
                const step = getStatusStep(tracker.status);

                return (
                  <div
                    key={tracker.id}
                    className={`tracker-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedTrackerId(tracker.id)}
                  >
                    <div className="tracker-card-header">
                      <div className="user-info">
                        <div className="avatar-small">{customer?.name?.charAt(0) || 'C'}</div>
                        <div>
                          <strong>{customer?.name || 'Customer'}</strong>
                          <span className="tracker-id">#{tracker.id.slice(-4)}</span>
                        </div>
                      </div>
                      <span className={`status-dot ${tracker.status}`}></span>
                    </div>

                    <div className="status-progress">
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${(step / 5) * 100}%` }}></div>
                      </div>
                      <div className="progress-labels">
                        <span>{t("Assigned")}</span>
                        <span>{t("Arrived")}</span>
                        <span>{t("Done")}</span>
                      </div>
                    </div>

                    {['admin', 'coder', 'manager', 'receptionist'].includes(currentUser?.role?.toLowerCase()) && (tracker.status === 'pending' || (tracker.status === 'assigned' && !tracker.mechanicId)) && (
                      <div className="assignment-box">
                        <select
                          className="auth-input small"
                          onChange={(e) => handleAssignMechanic(tracker.id, e.target.value)}
                          value=""
                        >
                          <option value="" disabled>{t("Assign Mechanic")}</option>
                          {mechanics.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </div>
                    )}

                    {currentUser.role === 'mechanic' && tracker.mechanicId === currentUser.id && (
                      <div className="mechanic-actions">
                        {tracker.status === 'assigned' && (
                          <button className="btn-primary w-100" onClick={() => handleStartJourney(tracker.id)}>
                            <Navigation size={14} /> {t("Start Journey")}
                          </button>
                        )}
                        {tracker.status === 'started' && (
                          <button className="btn-success w-100" onClick={() => handleArrived(tracker.id)}>
                            <CheckCircle2 size={14} /> {t("I Have Arrived")}
                          </button>
                        )}
                        {tracker.status === 'arrived' && (
                          <button className="btn-primary w-100" onClick={() => updateItem('trackers', tracker.id, { status: 'in-progress' })}>
                            <Wrench size={14} /> {t("Start Repair")}
                          </button>
                        )}
                        {tracker.status === 'in-progress' && (
                          <button className="btn-success w-100" onClick={() => handleCompleteRepair(tracker.id)}>
                            <Check size={14} /> {t("Complete Job")}
                          </button>
                        )}
                      </div>
                    )}

                    {currentUser.role === 'customer' && tracker.status === 'pending' && (
                      <div className="customer-actions" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button className="btn-outline w-100" style={{ padding: '8px', fontSize: '0.8rem' }} onClick={(e) => { e.stopPropagation(); handleEditLocation(tracker.id); }}>
                          <Navigation size={14} /> {t("Edit Location")}
                        </button>
                        <button className="btn-outline-danger w-100" style={{ padding: '8px', fontSize: '0.8rem' }} onClick={(e) => { e.stopPropagation(); handleCancelRequest(tracker.id); }}>
                          <Trash2 size={14} /> {t("Cancel")}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <main className="map-container-main glass-panel">
          <div className="map-overlay-info">
            {selectedTracker && selectedTracker.status !== 'assigned' && (
              <div className="eta-card">
                <Clock size={16} />
                <span>{t("ETA")}: <strong>{calculateETA(selectedTracker)}</strong></span>
              </div>
            )}
            <div className="region-badge">
              <MapPin size={14} />
              <span>Ethiopia, Addis Ababa</span>
            </div>
          </div>

          <MapContainer
            center={[9.03, 38.74]}
            zoom={12}
            scrollWheelZoom={true}
            className="leaflet-main-map"
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {isSelectingLocation && (
              <LocationPicker onLocationSelect={handleLocationSelect} />
            )}

            <MapUpdater center={pinningLocation || selectedTracker?.mechanicLocation || selectedTracker?.customerLocation} />

            {pinningLocation && (
              <Marker position={pinningLocation} icon={customerIcon}>
                <Popup>{t("New Request Location")}</Popup>
              </Marker>
            )}

            {/* Render all trackers for Admins, or just relevant ones for others */}
            {myTrackers.map(tracker => (
              <React.Fragment key={tracker.id}>
                {tracker.customerLocation && Array.isArray(tracker.customerLocation) && (
                  <Marker
                    position={[parseFloat(tracker.customerLocation[0]), parseFloat(tracker.customerLocation[1])]}
                    icon={customerIcon}
                  >
                    <Popup>
                      <div className="popup-info">
                        <strong>{t("Customer")}: {customers.find(c => String(c.id) === String(tracker.customerId))?.name || t("Guest")}</strong><br />
                        <span>{t("Status")}: <span className={`badge-${tracker.status}`}>{t(tracker.status)}</span></span><br />
                        <small>{new Date(tracker.timestamp).toLocaleString()}</small>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {tracker.mechanicLocation && (
                  <Marker position={tracker.mechanicLocation} icon={mechanicIcon}>
                    <Popup>
                      <strong>{t("Mechanic")}: {staff.find(s => s.id === tracker.mechanicId)?.name}</strong><br />
                      {t("Live Tracking Active")}
                    </Popup>
                  </Marker>
                )}

                {tracker.customerLocation && tracker.mechanicLocation && (
                  <Polyline
                    positions={[tracker.mechanicLocation, tracker.customerLocation]}
                    color={tracker.id === selectedTrackerId ? "var(--primary)" : "rgba(67, 97, 238, 0.3)"}
                    dashArray="5, 10"
                    weight={tracker.id === selectedTrackerId ? 4 : 2}
                  />
                )}
              </React.Fragment>
            ))}
          </MapContainer>
        </main>
      </div>
    </div>
  );
};

export default MapTracker;
