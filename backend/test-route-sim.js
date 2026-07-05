require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

// Simulate exactly what the register route does
async function simulateRegister() {
  const body = {
    name: 'Test Admin',
    email: 'testhttp@garage.com',
    phone: '251911556677',
    password: 'admin123',
    role: 'admin',
    garageName: 'Test Garage',
    address: ''
  };

  const { name, email, phone, password, role, garageName, address } = body;

  try {
    console.log('Step 1: checking existing user...');
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] }
    });
    if (existing) { console.log('User exists already'); return; }

    console.log('Step 2: hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('Step 3: computing trial expiry...');
    const trialExpiry = new Date();
    trialExpiry.setDate(trialExpiry.getDate() + 14);

    let garageId = null;
    console.log('Step 4: creating garage...');
    const garage = await prisma.garage.create({
      data: {
        ownerId: email,
        name: garageName || `${name}'s Garage`,
        address: address || '',
        ownerName: name,
        email,
        phone
      }
    });
    garageId = garage.id;
    console.log('Garage created:', garageId);

    console.log('Step 5: creating user...');
    const user = await prisma.user.create({
      data: {
        ownerId: email,
        name, email, phone,
        password: hashedPassword,
        role: role || 'admin',
        garageName: garageName || '',
        address: address || '',
        expiryDate: trialExpiry,
        garageId,
        permissions: role === 'admin' ? ['all'] : []
      }
    });
    console.log('✅ User created:', user.id);

    // Cleanup
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.garage.delete({ where: { id: garage.id } });
    console.log('✅ All steps passed! The register route should work.');
  } catch(e) {
    console.error('❌ Failed at step:', e.message);
    console.error(e.stack);
  } finally {
    await prisma.$disconnect();
  }
}

simulateRegister();
