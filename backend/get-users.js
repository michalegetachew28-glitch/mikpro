const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, phone: true, role: true } });
  fs.writeFileSync('users-list.txt', JSON.stringify(users, null, 2));
}

main().catch(err => {
  fs.writeFileSync('users-list.txt', err.message);
}).finally(() => prisma.$disconnect());
