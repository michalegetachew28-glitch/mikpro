const prisma = require('./db');

async function main() {
  try {
    const cols = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'MaterialRequest' OR table_name = 'material_request'
    `);
    console.log('MATERIAL_REQUEST_DB_COLUMNS:', JSON.stringify(cols.map(c => c.column_name)));
  } catch (err) {
    console.error('DB QUERY ERROR:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
