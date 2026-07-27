const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const token = require('jsonwebtoken').sign(
    { id: 'cmrkpskj10003gc8azcwh20k0', garageId: 'cmrkpsj4k0000gc8alhyybhl3', role: 'admin' },
    'garage_management_system_2026_secret_key'
  );

  // Pick any valid vehicleId
  const vehicle = await prisma.vehicle.findFirst({ where: { garageId: 'cmrkpsj4k0000gc8alhyybhl3' } });
  if (!vehicle) {
    console.log("No vehicles found for garage. Attempting to create one just to test.");
    // Fake customer
    const customer = await prisma.customer.findFirst();
    if (customer) {
        await prisma.vehicle.create({ data: { plateNumber: 'TEST-123', make: 'Toyota', model: 'Corolla', customerId: customer.id, garageId: 'cmrkpsj4k0000gc8alhyybhl3' }});
    }
  }

  const vId = vehicle ? vehicle.id : (await prisma.vehicle.findFirst()).id;

  const body = {
    vehicleId: vId,
    mechanicId: '',
    description: 'Test Repair from Script',
    laborCost: 100,
    mileage: '120000',
    parts: []
  };

  const res = await fetch('http://localhost:5000/api/repairs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body)
  });

  const txt = await res.text();
  console.log("STATUS:", res.status);
  console.log("BODY:", txt);
}

main().catch(console.error).finally(()=>prisma.$disconnect());
