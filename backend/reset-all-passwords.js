const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const passwordToSet = "password123";
  const hashedBasePassword = await bcrypt.hash(passwordToSet, 10);
  const hashedAdminPassword = await bcrypt.hash("admin123", 10);

  console.log("Starting password resets...");

  // Update demoadmin
  const adminUp = await prisma.user.updateMany({
    where: { phone: "251912345678" },
    data: { password: hashedAdminPassword }
  });
  console.log("Updated demoadmin password count:", adminUp.count);

  // Update manager
  const managerUp = await prisma.user.updateMany({
    where: { phone: "251986666666" },
    data: { password: hashedBasePassword }
  });
  console.log("Updated manager password count:", managerUp.count);

  // Update cashier
  const cashierUp = await prisma.user.updateMany({
    where: { phone: "251987888888" },
    data: { password: hashedBasePassword }
  });
  console.log("Updated cashier password count:", cashierUp.count);

  // Update mechanic
  const mechUp = await prisma.user.updateMany({
    where: { phone: "251984444444" },
    data: { password: hashedBasePassword }
  });
  console.log("Updated mechanic password count:", mechUp.count);

  // Update inventoryManager / spareparts
  const invUp = await prisma.user.updateMany({
    where: { phone: "251985555555" },
    data: { password: hashedBasePassword }
  });
  console.log("Updated inventoryManager password count:", invUp.count);

  // Update customer
  const custUp = await prisma.user.updateMany({
    where: { phone: "251966666611" },
    data: { password: hashedBasePassword }
  });
  console.log("Updated customer password count:", custUp.count);

  console.log("Password resets finished successful!");
}

main()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
