const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const hashed = await bcrypt.hash("password123", 10);
  const r = await prisma.user.updateMany({
    where: { email: 'yechale1210@gmail.com' },
    data: { password: hashed, status: 'active' }
  });
  console.log("Updated:", r.count);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
