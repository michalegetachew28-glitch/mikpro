const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  const result = {};

  result.garages = await prisma.garage.findMany({
    include: {
      users: true
    }
  });

  result.admins = await prisma.user.findMany({
    where: { role: 'admin' }
  });

  result.paymentRequests = await prisma.paymentRequest.findMany();

  const garageCount = await prisma.garage.count();
  const userCount = await prisma.user.count();
  const repairCount = await prisma.repair.count();
  const customerCount = await prisma.customer.count();
  const paymentSum = await prisma.paymentRequest.aggregate({
    where: { status: 'approved' },
    _sum: { amount: true }
  });

  result.stats = {
    garageCount,
    userCount,
    repairCount,
    customerCount,
    paymentSum
  };

  fs.writeFileSync('backend/diag.json', JSON.stringify(result, null, 2), 'utf-8');
  console.log("Wrote backend/diag.json successfully");
}

main()
  .catch(err => {
    console.error(err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
