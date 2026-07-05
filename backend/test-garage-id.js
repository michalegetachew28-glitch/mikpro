const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
  console.log('Testing concurrent garage creation...');
  const promises = [];
  
  for (let i = 0; i < 5; i++) {
    promises.push((async () => {
      // Simulate the logic in auth.js
      let settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
      if (!settings) {
        try {
          settings = await prisma.platformSettings.create({
            data: { id: "singleton", plans: [], paymentMethods: [], taxRate: 15.0, platformFees: 0.0, trialDays: 7, garageIdCounter: 1 }
          });
        } catch (e) {
          settings = await prisma.platformSettings.update({
            where: { id: "singleton" },
            data: { garageIdCounter: { increment: 1 } }
          });
        }
      } else {
        settings = await prisma.platformSettings.update({
          where: { id: "singleton" },
          data: { garageIdCounter: { increment: 1 } }
        });
      }
      
      const countStr = settings.garageIdCounter.toString().padStart(7, '0');
      const customGarageId = `12-${countStr.slice(0, 4)}-${countStr.slice(4)}`;
      
      const garage = await prisma.garage.create({
        data: {
          displayId: customGarageId,
          ownerId: `test_concurrent_${i}_${Date.now()}@test.com`,
          name: `Concurrent Garage ${i}`,
          status: 'active'
        }
      });
      return garage.displayId;
    })());
  }
  
  const results = await Promise.all(promises);
  console.log('Generated IDs:', results.sort());
  console.log('Test complete. Unique IDs check:', new Set(results).size === 5 ? 'PASSED' : 'FAILED');
}

runTest()
  .catch(e => { console.error('Error during test:', e); })
  .finally(() => { prisma.$disconnect(); });
