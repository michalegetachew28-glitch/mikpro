require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET ✓' : 'MISSING ✗');
    await prisma.$connect();
    console.log('✅ Database connection successful!');
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log('PostgreSQL:', result[0].version);
  } catch (e) {
    console.error('❌ Connection failed:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
