import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { rtdb } from '../services/firebase';
import { ref, set, update } from 'firebase/database';
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
  const { activeTrackers, setActiveTrackers, addItem, updateItem, deleteItem, customers, staff, t, addNotification, wsRef } = useAppContext();
  const { currentUser } = useAuth();

  const [selectedTrackerId, setSelectedTrackerId] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [pinningLocation, setPinningLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTrackerId, setEditingTrackerId] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const gpsWatchId = useRef(null);

  // Allow map click to refine location
  const handleLocationSelect = useCallback((coords) => {
    setPinningLocation(coords);
  }, []);

  // Start continuous GPS watch when customer opens the request panel
  useEffect(() => {
    if (!isSelectingLocation) {
      // Stop watching when panel is closed
      if (gpsWatchId.current != null) {
        navigator.geolocation.clearWatch(gpsWatchId.current);
        gpsWatchId.current = null;
      }
      return;
    }

    setIsLocating(true);
    setPinningLocation(null);
    setGpsAccuracy(null);

    if (!('geolocation' in navigator)) {
      setIsLocating(false);
      setPinningLocation([9.03, 38.74]);
      addNotification(t('Geolocation not supported. Tap the map to set your location.'), 'warning');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords = [position.coords.latitude, position.coords.longitude];
        setPinningLocation(coords);
        setGpsAccuracy(Math.round(position.coords.accuracy));
        setIsLocating(false);
      },
      (error) => {
        console.warn('[GPS] watchPosition error:', error);
        setIsLocating(false);
        if (!pinningLocation) {
          setPinningLocation([9.03, 38.74]);
          addNotification(t('GPS unavailable. Default location set — tap map to adjust.'), 'warning');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    gpsWatchId.current = watchId;
    return () => {
      navigator.geolocation.clearWatch(watchId);
      gpsWatchId.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelectingLocation]);

  const stopGpsWatch = () => {
    if (gpsWatchId.current != null) {
      navigator.geolocation.clearWatch(gpsWatchId.current);
      gpsWatchId.current = null;
    }
  };

  // Helper to get coordinates from address using Nominatim (OSM)
  const geocodeAddress = async (address) => {
    if (!address) return null;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
      const data = await response.json();
      if (data && data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    } catch (error) {
      console.error('Geocoding failed:', error);
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

  const handleRequestAssistance = async () => {
    if (!pinningLocation) return;

    if (editingTrackerId) {
      // UPDATE existing tracker location
      try {
        await api.updateTracker(editingTrackerId, { customerLocation: pinningLocation });
        updateItem('trackers', editingTrackerId, { customerLocation: pinningLocation, timestamp: new Date().toISOString() });
        addNotification(t('Location updated successfully!'), 'success');
      } catch (e) {
        addNotification(t('Failed to update location. Please try again.'), 'danger');
        console.error('[MapTracker] updateTracker failed', e);
      }
    } else {
      // CREATE new tracker — backend persists to PostgreSQL, Firebase delivers in real time
      try {
        const savedTracker = await api.createTracker({
          customerId: currentUser?.id,
          customerLocation: pinningLocation,
          status: 'pending'
        });

        if (savedTracker?.id) {
          const normalized = {
            ...savedTracker,
            customerLocation: pinningLocation,
            mechanicLocation: savedTracker.mechanicLat != null
              ? [savedTracker.mechanicLat, savedTracker.mechanicLng]
              : [9.03, 38.74],
          };

          // 1. Add to local state immediately (customer sees it right away)
          setActiveTrackers(prev => {
            const exists = prev.find(t => t.id === normalized.id);
            return exists ? prev : [...prev, normalized];
          });
          setSelectedTrackerId(savedTracker.id);

          // 2. Write to Firebase RTDB so Admin/Mechanic gets it instantly
          const trackerRTDBRef = ref(rtdb, `liveTrackers/${savedTracker.id}`);
          await set(trackerRTDBRef, {
            lat: pinningLocation[0],
            lng: pinningLocation[1],
            status: 'pending',
            customerId: currentUser?.id,
            timestamp: new Date().toISOString(),
            // Include full tracker so AppContext can add it to the list
            fullTracker: savedTracker
          });

          addNotification(t('Roadside assistance request sent! Help is on the way.'), 'success');
        }
      } catch (e) {
        addNotification(t('Failed to send request. Please try again.'), 'danger');
        console.error('[MapTracker] createTracker failed', e);
      }
    }

    stopGpsWatch();
    setIsSelectingLocation(false);
    setPinningLocation(null);
    setEditingTrackerId(null);
    setViewMode('list');
  };

  const handleEditLocation = (trackerId) => {
    const tracker = activeTrackers.find(t => t.id === trackerId);
    if (!tracker) return;

    setEditingTrackerId(trackerId);
    setPinningLocation(tracker.customerLocation);
    setIsSelectingLocation(true);
    addNotification(t("Click on map to update your location."), 'info');
  };

  const handleCancelRequest = async (trackerId) => {
    const tracker = activeTrackers.find(t => t.id === trackerId);
    if (!tracker) return;

    if (window.confirm(t('Are you sure you want to cancel this assistance request?'))) {
      try {
        await api.updateTracker(trackerId, { status: 'cancelled' });
        // Update RTDB status
        const trackerRTDBRef = ref(rtdb, `liveTrackers/${trackerId}`);
        await update(trackerRTDBRef, { status: 'cancelled', timestamp: new Date().toISOString() });
      } catch (e) {
        console.warn('[MapTracker] API cancel tracker failed', e);
      }
      deleteItem('trackers', trackerId);
      addNotification(t('Request cancelled.'), 'info');
    }
  };

  const handleStartJourney = async (trackerId) => {
    const garageCoords = [9.02, 38.75];
    try {
      await api.updateTracker(trackerId, { status: 'started', mechanicLocation: garageCoords });
      // Update RTDB status & coords
      const trackerRTDBRef = ref(rtdb, `liveTrackers/${trackerId}`);
      await update(trackerRTDBRef, { 
        status: 'started', 
        mechanicLat: garageCoords[0],
        mechanicLng: garageCoords[1],
        timestamp: new Date().toISOString() 
      });
    } catch (e) {
      console.warn('[MapTracker] API handleStartJourney failed', e);
    }
    updateItem('trackers', trackerId, {
      status: 'started',
      mechanicLocation: garageCoords,
      journeyStartTime: new Date().toISOString()
    });
    addNotification(t('Journey started! Tracking is live.'), 'info');
    setSimulating(true);
  };

  const handleArrived = async (trackerId) => {
    const tracker = activeTrackers.find(t => t.id === trackerId);
    if (!tracker) return;

    try {
      await api.updateTracker(trackerId, { status: 'arrived', mechanicLocation: tracker.customerLocation });
      // Update RTDB status & coords
      if (tracker.customerLocation) {
        const trackerRTDBRef = ref(rtdb, `liveTrackers/${trackerId}`);
        await update(trackerRTDBRef, { 
          status: 'arrived', 
          mechanicLat: tracker.customerLocation[0],
          mechanicLng: tracker.customerLocation[1],
          timestamp: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn('[MapTracker] API handleArrived failed', e);
    }
    updateItem('trackers', trackerId, {
      status: 'arrived',
      mechanicLocation: tracker.customerLocation
    });
    if (tracker.repairId) {
      updateItem('repairs', tracker.repairId, { status: 'in-progress' });
    }
    addNotification(t('Mechanic has arrived at your location!'), 'success', tracker.customerId);
    setSimulating(false);
  };

  const handleCompleteRepair = async (trackerId) => {
    try {
      await api.updateTracker(trackerId, { status: 'completed' });
      // Update RTDB status
      const trackerRTDBRef = ref(rtdb, `liveTrackers/${trackerId}`);
      await update(trackerRTDBRef, { status: 'completed', timestamp: new Date().toISOString() });
    } catch (e) {
      console.warn('[MapTracker] API completeRepair failed', e);
    }
    updateItem('trackers', trackerId, { status: 'completed' });
    addNotification(t('Repair completed successfully.'), 'success');
  };

  const handleAssignMechanic = async (trackerId, mechanicId) => {
    const mechanicStart = [9.03, 38.74];
    try {
      await api.updateTracker(trackerId, { mechanicId, status: 'assigned', mechanicLocation: mechanicStart });
      // Update RTDB status & coords
      const trackerRTDBRef = ref(rtdb, `liveTrackers/${trackerId}`);
      await update(trackerRTDBRef, { 
        status: 'assigned', 
        mechanicId,
        mechanicLat: mechanicStart[0],
        mechanicLng: mechanicStart[1],
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.warn('[MapTracker] API assignMechanic failed', e);
    }
    updateItem('trackers', trackerId, {
      mechanicId,
      status: 'assigned',
      mechanicLocation: mechanicStart
    });
    const tracker = activeTrackers.find(t => t.id === trackerId);
    if (tracker?.repairId) {
      updateItem('repairs', tracker.repairId, { mechanicId });
    }
    addNotification(t('Mechanic assigned to roadside job.'), 'success');
  };

  // Simulate movement automatically (Driven by Mechanic's tab)
  useEffect(() => {
    if (currentUser?.role !== 'mechanic') return;

    const activeJobs = activeTrackers.filter(t => t.mechanicId === currentUser.id && t.status === 'started');
    if (activeJobs.length === 0) {
      if (simulating) setSimulating(false);
      return;
    }

    setSimulating(true);

    const interval = setInterval(() => {
      activeJobs.forEach(async (job) => {
        const { customerLocation, mechanicLocation } = job;
        if (!customerLocation || !mechanicLocation) return;

        const latDiff = customerLocation[0] - mechanicLocation[0];
        const lngDiff = customerLocation[1] - mechanicLocation[1];
        const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

        if (distance < 0.0005) {
          handleArrived(job.id);
          return;
        }

        const step = 0.02;
        const newLocation = [
          mechanicLocation[0] + latDiff * step,
          mechanicLocation[1] + lngDiff * step
        ];

        // Update local state instantly
        updateItem('trackers', job.id, { mechanicLocation: newLocation });

        // Write to Firebase RTDB so customer gets it instantly
        try {
          const trackerRTDBRef = ref(rtdb, `liveTrackers/${job.id}`);
          update(trackerRTDBRef, {
            mechanicLat: newLocation[0],
            mechanicLng: newLocation[1],
            timestamp: new Date().toISOString()
          });
        } catch (e) {
          console.warn('[MapTracker] Firebase mechanic location update failed', e);
        }

        // Broadcast mechanic's real-time position via WebSocket/REST
        try {
          const ws = wsRef?.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'mechanic_location_update',
              trackerId: job.id,
              lat: newLocation[0],
              lng: newLocation[1]
            }));
          } else {
            // Fallback: persist to backend REST
            await api.updateTracker(job.id, { mechanicLocation: newLocation });
          }
        } catch (e) {
          console.warn('[MapTracker] mechanic_location_update failed', e);
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTrackers, updateItem, simulating, currentUser?.id]);

  // ── Customer GPS heartbeat: continuously stream live position to all watchers ──
  useEffect(() => {
    if (currentUser?.role !== 'customer') return;

    const myActiveTracker = myTrackers.find(t =>
      String(t.customerId) === String(currentUser.id) &&
      !['completed', 'cancelled'].includes(t.status)
    );
    if (!myActiveTracker) return;

    const interval = setInterval(() => {
      if (!('geolocation' in navigator)) return;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          // Write to Firebase RTDB so Admin/Mechanic gets it instantly
          try {
            const trackerRTDBRef = ref(rtdb, `liveTrackers/${myActiveTracker.id}`);
            update(trackerRTDBRef, {
              lat,
              lng,
              timestamp: new Date().toISOString()
            });
          } catch (e) {
            console.warn('[MapTracker] Firebase customer location update failed', e);
          }

          // Send via WebSocket first (fastest)
          const ws = wsRef?.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'location_update',
              trackerId: myActiveTracker.id,
              lat, lng,
              speed: position.coords.speed || 0,
              heading: position.coords.heading || 0
            }));
          } else {
            // Fallback to REST if WS not connected
            api.updateTracker(myActiveTracker.id, { customerLocation: [lat, lng] }).catch(() => {});
          }

          // Also update local state so the customer sees their own dot move
          updateItem('trackers', myActiveTracker.id, { customerLocation: [lat, lng] });
        },
        (err) => console.warn('[GPS Heartbeat]', err),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 2000 }
      );
    }, 3000); // every 3 seconds

    return () => clearInterval(interval);
  }, [myTrackers, currentUser?.id, currentUser?.role, updateItem, wsRef]);

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
            <div className="pinning-controls" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {isLocating ? (
                <span className="pinning-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: '#f59e0b', display: 'inline-block',
                    animation: 'pulse 1s infinite'
                  }} />
                  {t('Detecting your GPS location...')}
                </span>
              ) : (
                <span className="pinning-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: '#22c55e', display: 'inline-block',
                    animation: 'pulse 1.5s infinite'
                  }} />
                  <MapPin size={15} />
                  {pinningLocation
                    ? `${t('Location ready')}${gpsAccuracy ? ` (±${gpsAccuracy}m)` : ''} — ${t('tap map to adjust')}`
                    : t('Tap map to pick manually')}
                </span>
              )}
              <button
                className="btn-primary"
                onClick={handleRequestAssistance}
                disabled={!pinningLocation || isLocating}
                style={{ minWidth: 150 }}
              >
                <CheckCircle2 size={16} /> {t('Confirm Location')}
              </button>
              <button className="btn-outline" onClick={() => { stopGpsWatch(); setIsSelectingLocation(false); setPinningLocation(null); }}>
                {t('Cancel')}
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
