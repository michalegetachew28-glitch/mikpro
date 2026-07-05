require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function testUrl(name, url) {
  console.log(`\nTesting ${name}: ${url.replace(/:[^:]*@/, ':****@')}`);
  const prisma = new PrismaClient({
    datasources: {
      db: { url }
    }
  });

  try {
    await prisma.$connect();
    console.log(`✅ ${name} connection successful!`);
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log(`PostgreSQL version: ${result[0].version}`);
  } catch (e) {
    console.error(`❌ ${name} failed:`, e.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await testUrl('DATABASE_URL', process.env.DATABASE_URL);
  if (process.env.POOLER_URL) {
    await testUrl('POOLER_URL', process.env.POOLER_URL);
  }
  if (process.env.DIRECT_URL) {
    await testUrl('DIRECT_URL', process.env.DIRECT_URL);
  }
}

main();
