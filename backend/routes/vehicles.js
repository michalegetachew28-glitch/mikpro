const express = require('express');
const { authenticate } = require('../middleware/auth');
const { handleRouteError } = require('../middleware/errorHandler');

const router = express.Router();
const prisma = require('../db');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Always resolve garageId from the DB.
 * JWT tokens can be stale (issued before garage was linked).
 */
async function resolveGarageId(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { garageId: true, garageName: true }
  });
  return user?.garageId || null;
}

/**
 * Verify garage exists in DB and return it.
 */
async function verifyGarage(garageId) {
  if (!garageId) return null;
  return prisma.garage.findUnique({ where: { id: garageId } });
}

// ─── Region / Plate helpers ──────────────────────────────────────────────────

const ALLOWED_REGIONS = [
  { name: 'Addis Ababa',        abbreviation: 'AA' },
  { name: 'Oromia',             abbreviation: 'OR' },
  { name: 'Amhara',             abbreviation: 'AM' },
  { name: 'Tigray',             abbreviation: 'TG' },
  { name: 'Sidama',             abbreviation: 'SD' },
  { name: 'South Ethiopia',     abbreviation: 'SE' },
  { name: 'Somali',             abbreviation: 'SM' },
  { name: 'Afar',               abbreviation: 'AF' },
  { name: 'Benishangul-Gumuz',  abbreviation: 'BG' },
  { name: 'Gambela',            abbreviation: 'GB' },
  { name: 'Harari',             abbreviation: 'HR' },
  { name: 'Dire Dawa',          abbreviation: 'DR' }
];

function processPlateData(body) {
  // Structured fields take priority
  if (body.regionName || body.regionAbbreviation || body.regionCode || body.amharicLetters || body.vehicleNumber) {
    let { regionName, regionAbbreviation, regionCode, amharicLetters, vehicleNumber } = body;

    // Normalize old DD → DR
    if (regionAbbreviation === 'DD') regionAbbreviation = 'DR';
    if (regionName === 'Dire Dawa' && regionAbbreviation !== 'DR') regionAbbreviation = 'DR';

    const cleanAbbrev = regionAbbreviation ? regionAbbreviation.trim().toUpperCase() : null;
    const cleanName   = regionName ? regionName.trim() : null;

    const regionMatch = ALLOWED_REGIONS.find(r =>
      (cleanAbbrev && r.abbreviation === cleanAbbrev) ||
      (cleanName   && r.name.toLowerCase() === cleanName.toLowerCase())
    );

    if (!regionMatch) throw new Error('Invalid region. Central and Southwest Ethiopia are not supported.');

    const code = parseInt(regionCode, 10);
    if (isNaN(code) || code < 1 || code > 5) throw new Error('Region code must be 1–5.');

    if (!amharicLetters || !amharicLetters.trim()) throw new Error('Amharic letters are required.');

    const num = String(vehicleNumber || '').trim();
    if (!num || !/^\d+$/.test(num)) throw new Error('Vehicle number must contain digits only.');

    const plate = `${regionMatch.abbreviation} ${code} ${amharicLetters.trim()} ${num}`;
    return {
      regionName: regionMatch.name,
      regionAbbreviation: regionMatch.abbreviation,
      regionCode: code,
      amharicLetters: amharicLetters.trim(),
      vehicleNumber: num,
      plateNumber: plate
    };
  }

  // Fall back to raw plateNumber string
  if (body.plateNumber) {
    let pNum = body.plateNumber.trim().replace(/^DD\b/i, 'DR').replace(/\bDD\b/gi, 'DR');
    const parts = pNum.split(/\s+/);
    if (parts.length < 4) throw new Error('Plate must be: [Region] [Code] [Amharic] [Number]');

    let abbrev = parts[0].toUpperCase();
    const regionMatch = ALLOWED_REGIONS.find(r => r.abbreviation === abbrev);
    if (!regionMatch) throw new Error('Invalid region abbreviation in plate number.');

    const code = parseInt(parts[1], 10);
    if (isNaN(code) || code < 1 || code > 5) throw new Error('Region code must be 1–5.');

    const amharic = parts[2];
    const num     = parts[3];
    if (!/^\d+$/.test(num)) throw new Error('Vehicle number must be digits only.');

    const plate = `${regionMatch.abbreviation} ${code} ${amharic} ${num}`;
    return {
      regionName: regionMatch.name,
      regionAbbreviation: regionMatch.abbreviation,
      regionCode: code,
      amharicLetters: amharic,
      vehicleNumber: num,
      plateNumber: plate
    };
  }

  throw new Error('Plate number information is required.');
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/vehicles
router.get('/', authenticate, async (req, res) => {
  try {
    const garageId = await resolveGarageId(req.user.id);
    if (!garageId) return res.status(400).json({ error: 'Your account has no linked garage. Please log out and log back in.' });

    const vehicles = await prisma.vehicle.findMany({
      where: { garageId },
      include: { customer: true }
    });
    res.json(vehicles);
  } catch (err) {
    handleRouteError(err, 'GET /vehicles', res);
  }
});

// POST /api/vehicles
router.post('/', authenticate, async (req, res) => {
  console.log(`[POST /vehicles] User: ${req.user.id} | role: ${req.user.role}`);
  try {
    // 1. Resolve garageId from DB (never trust JWT alone)
    const garageId = await resolveGarageId(req.user.id);
    console.log(`[POST /vehicles] Resolved garageId: ${garageId}`);

    if (!garageId) {
      return res.status(400).json({
        error: 'Your account has no linked garage. Please log out and log back in to refresh your session.'
      });
    }

    // 2. Verify garage exists in DB
    const garage = await verifyGarage(garageId);
    if (!garage) {
      return res.status(400).json({ error: `Garage (${garageId}) does not exist in the database. Contact support.` });
    }

    // 3. Validate required fields
    const { customerId, make, model, year, vin, color, type } = req.body;
    if (!customerId) return res.status(400).json({ error: 'customerId is required.' });
    if (!model)      return res.status(400).json({ error: 'Vehicle model is required.' });

    // 4. Verify customer exists and belongs to this garage
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return res.status(400).json({ error: `Customer (${customerId}) does not exist.` });
    }
    if (customer.garageId !== garageId) {
      return res.status(403).json({ error: 'Customer does not belong to your garage.' });
    }

    // 5. Parse + validate plate number
    let plateDetails;
    try {
      plateDetails = processPlateData(req.body);
    } catch (validationErr) {
      return res.status(400).json({ error: validationErr.message });
    }
    console.log(`[POST /vehicles] Plate: ${plateDetails.plateNumber}`);

    // 6. Duplicate plate check
    const duplicate = await prisma.vehicle.findUnique({
      where: { plateNumber: plateDetails.plateNumber }
    });
    if (duplicate) {
      return res.status(400).json({ error: `Plate number "${plateDetails.plateNumber}" already exists.` });
    }

    // 7. Create vehicle inside a transaction
    const vehicle = await prisma.$transaction(async (tx) => {
      return tx.vehicle.create({
        data: {
          garageId,
          customerId,
          make:  make  || '',
          model,
          year:  year  ? String(year) : null,
          vin:   vin   || null,
          color: color || null,
          type:  type  || 'car',
          ...plateDetails
        },
        include: { customer: true }
      });
    });

    console.log(`[POST /vehicles] Created vehicle: ${vehicle.id} plate: ${vehicle.plateNumber}`);
    res.status(201).json(vehicle);

  } catch (err) {
    if (err.code === 'P2003') {
      const field = err.meta?.field_name || 'unknown field';
      return res.status(400).json({
        error: `Database relationship error on ${field}. Ensure the customer and garage both exist, then try again.`
      });
    }
    handleRouteError(err, 'POST /vehicles', res);
  }
});

// PUT /api/vehicles/:id
router.put('/:id', authenticate, async (req, res) => {
  console.log(`[PUT /vehicles/${req.params.id}] User: ${req.user.id}`);
  try {
    const garageId = await resolveGarageId(req.user.id);
    if (!garageId) return res.status(400).json({ error: 'No garage linked. Please log out and log back in.' });

    const { id } = req.params;
    const { customerId, make, model, year, vin, color, type } = req.body;

    // Verify vehicle belongs to this garage
    const existing = await prisma.vehicle.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Vehicle not found.' });
    if (existing.garageId !== garageId) return res.status(403).json({ error: 'Unauthorized.' });

    // Validate plate
    let plateDetails;
    try {
      plateDetails = processPlateData(req.body);
    } catch (validationErr) {
      return res.status(400).json({ error: validationErr.message });
    }

    // Duplicate plate check (exclude current vehicle)
    const dup = await prisma.vehicle.findUnique({ where: { plateNumber: plateDetails.plateNumber } });
    if (dup && dup.id !== id) {
      return res.status(400).json({ error: `Plate "${plateDetails.plateNumber}" already exists.` });
    }

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        customerId,
        make:  make  || undefined,
        model: model || undefined,
        year:  year  ? String(year) : undefined,
        vin:   vin   ?? undefined,
        color: color ?? undefined,
        type:  type  ?? undefined,
        ...plateDetails
      },
      include: { customer: true }
    });

    res.json(vehicle);
  } catch (err) {
    handleRouteError(err, 'PUT /vehicles/:id', res);
  }
});

// DELETE /api/vehicles/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const garageId = await resolveGarageId(req.user.id);
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found.' });
    if (vehicle.garageId !== garageId) return res.status(403).json({ error: 'Unauthorized.' });

    await prisma.vehicle.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    handleRouteError(err, 'DELETE /vehicles/:id', res);
  }
});

module.exports = router;
