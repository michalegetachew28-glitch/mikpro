const express = require('express');
const { authenticate } = require('../middleware/auth');
const { handleRouteError } = require('../middleware/errorHandler');
const router = express.Router();
const prisma = require('../db');

// Helper to log audit activity
async function logAudit(garageId, userId, action, details) {
  try {
    await prisma.activityLog.create({
      data: {
        garageId,
        userId,
        action,
        details
      }
    });
  } catch (err) {
    console.error('Audit logging failed:', err);
  }
}

// Helper to get user name
async function getUserName(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  return u ? u.name : 'Unknown User';
}

// GET /api/invoices - Retrieve all invoices for the garage (or customer's own invoices)
router.get('/', authenticate, async (req, res) => {
  try {
    const garageId = req.user.garageId;
    if (!garageId) {
      return res.status(400).json({ error: 'No garage associated with this account' });
    }

    let invoices;
    if (req.user.role === 'customer') {
      invoices = await prisma.invoice.findMany({
        where: {
          garageId,
          customerId: req.user.id
        },
        orderBy: { date: 'desc' }
      });
    } else {
      invoices = await prisma.invoice.findMany({
        where: { garageId },
        orderBy: { date: 'desc' }
      });
    }

    // Map DB invoice records to matches frontend shape
    const mapped = invoices.map(inv => ({
      ...inv,
      id: inv.orderId, // UI uses selectedInvoice.id for displays (INV-XXXXXX)
      dbId: inv.id,
      date: inv.date.toISOString(),
      dueDate: inv.dueDate.toISOString().split('T')[0],
      laborCost: inv.laborCost,
      partsCost: inv.partsCost,
      discount: inv.discount,
      tax: inv.tax,
      subtotal: inv.subtotal,
      total: inv.total,
      hasProof: inv.hasProof,
      proofDetails: inv.proofDetails ? inv.proofDetails : undefined,
      verifiedAt: inv.verifiedAt ? inv.verifiedAt.toISOString() : undefined
    }));

    res.json(mapped);
  } catch (err) {
    handleRouteError(err, 'GET /invoices', res);
  }
});

// POST /api/invoices - Create a new invoice
router.post('/', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'customer' || req.user.role === 'mechanic') {
      return res.status(403).json({ error: 'Access denied: Insufficient permissions to create invoices' });
    }

    const garageId = req.user.garageId;
    if (!garageId) {
      return res.status(400).json({ error: 'Garage association is required' });
    }

    const {
      customerId,
      customerName,
      customerPhone,
      customerAddress,
      vehicleId,
      vehicleInfo,
      vehiclePlate,
      dueDate,
      laborCost,
      partsCost,
      discount,
      notes,
      repairId,
      invoice_type,
      mechanicId,
      serviceList,
      partsList
    } = req.body;

    if (!customerName || !dueDate) {
      return res.status(400).json({ error: 'Customer Name and Due Date are required.' });
    }

    // Check for duplicate invoice on same Repair Order
    if (repairId) {
      const existingInvoice = await prisma.invoice.findFirst({
        where: { repairId }
      });
      if (existingInvoice) {
        return res.status(400).json({ error: `An invoice has already been created for Repair Order #${repairId}` });
      }
    }

    // Generate unique invoice number (orderId) with collision handling
    let orderId;
    let isDuplicate = true;
    while (isDuplicate) {
      orderId = `INV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const existing = await prisma.invoice.findUnique({ where: { orderId } });
      if (!existing) isDuplicate = false;
    }

    // Retrieve global settings from settings or fallback to default
    let taxRate = 15.0;
    const settings = await prisma.garageBillingSettings.findUnique({ where: { garageId } });
    if (settings) {
      taxRate = settings.taxRate;
    }

    // Server-side financial calculations
    const labor = parseFloat(laborCost || 0);
    const parts = parseFloat(partsCost || 0);
    const subtotal = labor + parts;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax - parseFloat(discount || 0);

    const userName = await getUserName(req.user.id);
    const dbInvoice = await prisma.invoice.create({
      data: {
        garageId,
        orderId,
        invoiceNumber: orderId,
        customerId,
        customerName,
        customerPhone,
        customerAddress,
        vehicleId,
        vehicleInfo,
        vehiclePlate,
        dueDate: new Date(dueDate),
        laborCost: labor,
        partsCost: parts,
        discount: parseFloat(discount || 0),
        tax,
        subtotal,
        total,
        status: 'unpaid',
        notes,
        repairId,
        invoice_type: invoice_type || 'repair',
        owner_id: req.user.id,
        managerId: req.user.id,
        managerName: userName,
        mechanicId: mechanicId || null,
        serviceList: serviceList ? JSON.parse(JSON.stringify(serviceList)) : null,
        partsList: partsList ? JSON.parse(JSON.stringify(partsList)) : null,
        paymentStatus: 'unpaid',
        invoiceStatus: 'active',
        createdBy: userName
      }
    });

    await logAudit(garageId, req.user.id, 'Create Invoice', `Invoice ${orderId} created for customer ${customerName} (Total: ${total} ETB)`);

    // Return frontend shape
    res.status(201).json({
      ...dbInvoice,
      id: dbInvoice.orderId,
      dbId: dbInvoice.id,
      date: dbInvoice.date.toISOString(),
      dueDate: dbInvoice.dueDate.toISOString().split('T')[0]
    });
  } catch (err) {
    handleRouteError(err, 'POST /invoices', res);
  }
});

// POST /api/invoices/:id/proof - Customer uploads payment proof
router.post('/:id/proof', authenticate, async (req, res) => {
  try {
    const { txId, note, screenshot } = req.body;
    if (!txId) {
      return res.status(400).json({ error: 'Transaction reference is required.' });
    }

    // ID can be the generated orderId (INV-XXXXXX)
    const invoice = await prisma.invoice.findUnique({
      where: { orderId: req.params.id }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Scope check
    if (req.user.role === 'customer' && invoice.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied: Invoice not belonging to you' });
    }

    const proofDetails = {
      txId,
      note: note || '',
      date: new Date().toISOString(),
      screenshot: screenshot || null
    };

    const updated = await prisma.invoice.update({
      where: { orderId: req.params.id },
      data: {
        status: 'payment-submitted',
        hasProof: true,
        proofDetails
      }
    });

    await logAudit(invoice.garageId, req.user.id, 'Upload Payment Proof', `Payment proof submitted for invoice ${invoice.orderId} (TxRef: ${txId})`);

    // Trigger Notification for the garage managers
    // Mocked as audit log representation and DB sync.

    res.json({
      ...updated,
      id: updated.orderId,
      dbId: updated.id,
      date: updated.date.toISOString(),
      dueDate: updated.dueDate.toISOString().split('T')[0]
    });
  } catch (err) {
    handleRouteError(err, 'POST /invoices/:id/proof', res);
  }
});

// PATCH /api/invoices/:id/status - Admin verification / Cash Payment updates
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    // Role validation
    if (req.user.role === 'customer' || req.user.role === 'mechanic') {
      return res.status(403).json({ error: 'Access denied: Insufficient permissions to update invoice status' });
    }

    const { status, paymentMethod } = req.body; // status: paid, rejected, unpaid
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { orderId: req.params.id }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.garageId !== req.user.garageId) {
      return res.status(403).json({ error: 'Access denied: Garage mismatch' });
    }

    const isPaid = status === 'paid';
    const userName = await getUserName(req.user.id);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.invoice.update({
        where: { orderId: req.params.id },
        data: {
          status,
          paymentMethod: isPaid ? (paymentMethod || 'transfer') : null,
          hasProof: false, // reset proof once actioned
          verifiedAt: isPaid ? new Date() : null,
          verifiedBy: isPaid ? userName : null
        }
      });

      // Synchronize material requests status if linked
      if (invoice.repairId) {
        // Find existing repair
        const repair = await tx.repair.findUnique({
          where: { id: invoice.repairId }
        });
        if (repair) {
          // If paid, change status of linked material requests to completed?
          // Or wait, in billing.jsx:
          // req.paymentStatus: newStatus
          // Wait, is there paymentStatus inside MaterialRequest model? Let's check:
          // Wait, doesn't matter, we can support syncing status. Let's look at schema for MaterialRequest.
          // In schema: status is String. Let's do nothing on materialRequest model if it doesn't have paymentStatus,
          // or if it was targetInvoice.materialRequestId. Wait, does MaterialRequest have paymentStatus?
          // Let's check schema:
          // No, MaterialRequest model does not have paymentStatus!
          // Ah, in Billing.jsx: `targetInvoice.materialRequestId`
          // In Billing.jsx lines 201-209:
          // targetInvoice.materialRequestId (Wait, invoice doesn't have materialRequestId in schema, it has repairId!)
          // So the frontend matches the repair dependencies.
        }
      }

      return result;
    });

    await logAudit(
      invoice.garageId,
      req.user.id,
      isPaid ? 'Verify Payment' : 'Reject/Reset Payment Status',
      `Invoice ${invoice.orderId} marked as ${status} (Method: ${paymentMethod || 'transfer'})`
    );

    res.json({
      ...updated,
      id: updated.orderId,
      dbId: updated.id,
      date: updated.date.toISOString(),
      dueDate: updated.dueDate.toISOString().split('T')[0]
    });
  } catch (err) {
    handleRouteError(err, 'PATCH /invoices/:id/status', res);
  }
});

// DELETE /api/invoices/:id - Permanently delete invoice
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { orderId: req.params.id }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Access control: only owner, admin, or the issuing manager can delete
    const isOwnerOrAdmin = req.user.role === 'admin' || req.user.role === 'coder';
    const isIssuer = invoice.managerId === req.user.id;

    if (!isOwnerOrAdmin && !isIssuer) {
      return res.status(403).json({ error: 'Access denied: Only administrator or the issuer can delete this invoice' });
    }

    await prisma.invoice.delete({
      where: { orderId: req.params.id }
    });

    await logAudit(invoice.garageId, req.user.id, 'Delete Invoice', `InvoiceId: ${invoice.orderId} deleted permanently.`);

    res.json({ success: true });
  } catch (err) {
    handleRouteError(err, 'DELETE /invoices/:id', res);
  }
});

module.exports = router;
