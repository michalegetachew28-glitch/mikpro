const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Reactivate the demoadmin account
  const result = await prisma.user.updateMany({
    where: { email: 'demoadmin@garage.com' },
    data: { status: 'active' }
  });
  console.log("Reactivated demoadmin count:", result.count);

  // Also update "yechale1210@gmail.com" admin (used for customer creation tests)
  const result2 = await prisma.user.updateMany({
    where: { role: 'admin', status: { not: 'active' } },
    data: { status: 'active' }
  });
  console.log("Reactivated other suspended admins count:", result2.count);
  console.log("Done!");
}

main()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
