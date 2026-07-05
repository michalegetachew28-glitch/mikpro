const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Resetting platform settings...");
  const plans = [
    { id: 'monthly', name: '1-Month Plan', price: 1500, duration: 30, status: 'active' },
    { id: '3month', name: '3-Month Plan', price: 4000, duration: 90, status: 'active' },
    { id: '6month', name: '6-Month Plan', price: 7500, duration: 180, status: 'active' },
    { id: 'yearly', name: '1-Year Plan', price: 14000, duration: 365, status: 'active' }
  ];
  
  const settings = await prisma.platformSettings.upsert({
    where: { id: 'singleton' },
    update: {
      plans,
      paymentMethods: [],
      taxRate: 15.0,
      platformFees: 0.0,
      trialDays: 7
    },
    create: {
      id: 'singleton',
      plans,
      paymentMethods: [],
      taxRate: 15.0,
      platformFees: 0.0,
      trialDays: 7,
      garageIdCounter: 1
    }
  });
  console.log("Upserted platform settings SUCCESSFULLY:", settings);
}

main()
  .catch((e) => {
    console.error("Error resetting settings:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
