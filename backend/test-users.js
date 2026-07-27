const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log(JSON.stringify(users.map(u => ({
    id: u.id,
    role: u.role,
    name: u.name,
    garageId: u.garageId
  })), null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
