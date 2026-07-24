const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const prisma = require('./db');

const STAFF_ROLES = ['admin', 'manager', 'coder', 'receptionist', 'cashier', 'storekeeper', 'inventorymanager'];

module.exports = function(server) {
  const wss = new WebSocket.Server({ noServer: true });

  // trackerId -> Set<ws>  (for per-tracker updates)
  const rooms = new Map();

  // garageId -> Set<ws>  (admins/managers listening to ALL garage events)
  const garageRooms = new Map();

  // ── Helpers ───────────────────────────────────────────────────────────────
  function broadcast(trackerId, msgPayload) {
    const msg = JSON.stringify(msgPayload);

    // 1. Notify tracker-room subscribers
    if (rooms.has(trackerId)) {
      rooms.get(trackerId).forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
      });
    }

    // 2. Also notify ALL admin/manager garage subscribers
    const tracker = msgPayload.tracker;
    if (tracker && tracker.garageId && garageRooms.has(tracker.garageId)) {
      garageRooms.get(tracker.garageId).forEach(client => {
        // Don't double-send to clients already in the tracker room
        const alreadyInRoom = rooms.has(trackerId) && rooms.get(trackerId).has(client);
        if (!alreadyInRoom && client.readyState === WebSocket.OPEN) {
          client.send(msg);
        }
      });
    }
  }

  function broadcastNewTracker(tracker) {
    const msg = JSON.stringify({ type: 'new_tracker', tracker });
    if (tracker.garageId && garageRooms.has(tracker.garageId)) {
      garageRooms.get(tracker.garageId).forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
      });
    }
    // Coder sees everything
    wss.clients.forEach(client => {
      if (client.user?.role?.toLowerCase() === 'coder' && client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }

  function joinGarageRoom(ws, garageId) {
    if (!garageId) return;
    if (!garageRooms.has(garageId)) garageRooms.set(garageId, new Set());
    garageRooms.get(garageId).add(ws);
    ws.garageId = garageId;
    console.log(`[WS Garage Room] ${ws.user.name} subscribed to garage ${garageId}`);
  }

  function leaveGarageRoom(ws) {
    if (ws.garageId && garageRooms.has(ws.garageId)) {
      garageRooms.get(ws.garageId).delete(ws);
      if (garageRooms.get(ws.garageId).size === 0) garageRooms.delete(ws.garageId);
    }
  }

  // ── Connection handler ────────────────────────────────────────────────────
  wss.on('connection', (ws, req, user) => {
    console.log(`[WS] Connected: ${user.name} (${user.role})`);
    ws.user = user;

    // Auto-subscribe admins/managers to their garage room so they receive all updates
    const role = user.role?.toLowerCase();
    if (STAFF_ROLES.includes(role) && user.garageId) {
      joinGarageRoom(ws, user.garageId);
    }
    if (role === 'coder') {
      // Coders see everything — mark but don't restrict to one garage
      ws.isCoder = true;
    }

    ws.send(JSON.stringify({
      type: 'connection_established',
      user: { id: user.id, role: user.role, name: user.name }
    }));

    ws.on('message', async (message) => {
      try {
        const payload = JSON.parse(message);
        const { type } = payload;

        // ── Subscribe to a specific tracker ─────────────────────────────
        if (type === 'subscribe_tracker') {
          const { trackerId } = payload;
          if (!trackerId) return;

          const tracker = await prisma.tracker.findUnique({ where: { id: trackerId } });
          if (!tracker) {
            ws.send(JSON.stringify({ type: 'error', message: 'Tracker not found' }));
            return;
          }

          const userRole = user.role.toLowerCase();
          let allowed = STAFF_ROLES.includes(userRole)
            || (userRole === 'mechanic' && String(tracker.mechanicId) === String(user.id))
            || (userRole === 'customer' && String(tracker.customerId) === String(user.id));

          if (!allowed) {
            ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
            return;
          }

          if (!rooms.has(trackerId)) rooms.set(trackerId, new Set());
          rooms.get(trackerId).add(ws);
          ws.subscribedTrackers = ws.subscribedTrackers || new Set();
          ws.subscribedTrackers.add(trackerId);

          ws.send(JSON.stringify({ type: 'subscribed', trackerId }));
          ws.send(JSON.stringify({ type: 'tracker_update', tracker }));
        }

        // ── Customer sends live GPS location ─────────────────────────────
        else if (type === 'location_update') {
          const { trackerId, lat, lng, speed, heading } = payload;
          if (!trackerId || lat == null || lng == null) return;

          const userRole = user.role.toLowerCase();
          if (!['customer', 'coder'].includes(userRole)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Only customers can update live location' }));
            return;
          }

          const updated = await prisma.tracker.update({
            where: { id: trackerId },
            data: {
              customerLat: parseFloat(lat),
              customerLng: parseFloat(lng),
              speed: parseFloat(speed || 0),
              heading: parseFloat(heading || 0),
              timestamp: new Date()
            }
          });

          broadcast(trackerId, { type: 'tracker_update', tracker: updated });
        }

        // ── Mechanic sends live GPS location ──────────────────────────────
        else if (type === 'mechanic_location_update') {
          const { trackerId, lat, lng } = payload;
          if (!trackerId || lat == null || lng == null) return;

          const userRole = user.role.toLowerCase();
          if (!['mechanic', 'coder'].includes(userRole)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Only mechanics can update mechanic location' }));
            return;
          }

          const updated = await prisma.tracker.update({
            where: { id: trackerId },
            data: {
              mechanicLat: parseFloat(lat),
              mechanicLng: parseFloat(lng),
              timestamp: new Date()
            }
          });

          broadcast(trackerId, { type: 'tracker_update', tracker: updated });
        }
      } catch (err) {
        console.error('[WS Message Error]', err);
        ws.send(JSON.stringify({ type: 'error', message: 'Server error' }));
      }
    });

    ws.on('close', () => {
      console.log(`[WS] Disconnected: ${user.name}`);
      leaveGarageRoom(ws);
      if (ws.subscribedTrackers) {
        ws.subscribedTrackers.forEach(trackerId => {
          if (rooms.has(trackerId)) {
            rooms.get(trackerId).delete(ws);
            if (rooms.get(trackerId).size === 0) rooms.delete(trackerId);
          }
        });
      }
    });
  });

  // ── JWT upgrade ───────────────────────────────────────────────────────────
  server.on('upgrade', (request, socket, head) => {
    try {
      const urlParams = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      const token = urlParams.searchParams.get('token');

      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        if (err || !decoded) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        try {
          const user = await prisma.user.findUnique({ where: { id: decoded.id } });
          if (!user) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }
          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request, user);
          });
        } catch (e) {
          socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
          socket.destroy();
        }
      });
    } catch (e) {
      console.error('[WS Upgrade Error]', e);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });

  // ── Public API for REST routes ────────────────────────────────────────────
  server.broadcastTrackerUpdate = (trackerId, tracker) => {
    broadcast(trackerId, { type: 'tracker_update', tracker });
  };

  server.broadcastNewTracker = (tracker) => {
    broadcastNewTracker(tracker);
  };
};
