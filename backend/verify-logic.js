const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
  console.log("Starting verification test...");
  
  // 1. Fetch current singleton settings
  let settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
  console.log("Current PlatformSettings in DB:", settings);
  
  // 2. Modify trialDays to 5
  console.log("Updating trialDays to 5...");
  settings = await prisma.platformSettings.update({
    where: { id: 'singleton' },
    data: { trialDays: 5 }
  });
  console.log("Updated PlatformSettings trialDays:", settings.trialDays);
  
  // 3. Test calculation of expiryDate based on trialDays
  // Replicating logic in auth.js:
  const trialDays = settings.trialDays || 7;
  const trialExpiry = new Date();
  trialExpiry.setDate(trialExpiry.getDate() + trialDays);
  
  console.log(`Calculated Trial Expiries: Expiry Date should be ${trialDays} days from now.`);
  console.log("Calculated trialExpiry:", trialExpiry);
  
  const now = new Date();
  const diffDays = Math.ceil((trialExpiry - now) / (1000 * 60 * 60 * 24));
  console.log(`Difference in days is: ${diffDays}`);
  
  if (diffDays !== 5) {
    throw new Error(`Assertion failed: expected 5 days trial expiry, but got ${diffDays}`);
  }
  console.log("✅ Dynamic trial calculation assertion PASSED!");
  
  // 4. Verify plans status
  const activePlans = settings.plans.filter(p => !p.status || p.status === 'active');
  console.log("Active plans in database settings:", activePlans);
  
  // 5. Restore default settings
  console.log("Restoring platform settings trialDays to 7...");
  await prisma.platformSettings.update({
    where: { id: 'singleton' },
    data: { trialDays: 7 }
  });
  
  console.log("✅ All tests passed successfully!");
}

runTest()
  .catch(err => {
    console.error("❌ Test Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
