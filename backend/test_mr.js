const prisma = require('./db');

async function testMR() {
  try {
    console.log('Testing prisma.materialRequest.findMany()...');
    const reqs = await prisma.materialRequest.findMany({
      take: 5
    });
    console.log('SUCCESS! Found requests:', reqs.length);
  } catch (err) {
    console.error('FIND_MANY ERROR:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testMR();
