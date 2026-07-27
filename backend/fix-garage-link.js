/**
 * fix-garage-link.js
 * Finds admin users with no garageId and links them to their garage.
 * Run: node fix-garage-link.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find all users with null garageId
  const brokenUsers = await prisma.user.findMany({
    where: { garageId: null, role: { not: 'coder' } },
    select: { id: true, name: true, email: true, role: true, ownerId: true, garageId: true }
  });

  if (brokenUsers.length === 0) {
    console.log('✅ All users already have a garageId. No fix needed.');
    return;
  }

  console.log(`⚠️  Found ${brokenUsers.length} user(s) with no garageId:`);
  brokenUsers.forEach(u => console.log(`  - ${u.name} (${u.email}) role=${u.role}`));

  for (const user of brokenUsers) {
    // Try to find a garage where ownerId matches the user's email or ownerId
    const garage = await prisma.garage.findFirst({
      where: {
        OR: [
          { ownerId: user.email },
          { ownerId: user.ownerId },
          { email: user.email }
        ]
      }
    });

    if (garage) {
      await prisma.user.update({
        where: { id: user.id },
        data: { garageId: garage.id }
      });
      console.log(`✅ Linked ${user.name} → Garage "${garage.name}" (${garage.id})`);
    } else {
      console.log(`❌ No matching garage found for ${user.name} (${user.email}) — manual fix needed.`);
      // List all garages for reference
      const allGarages = await prisma.garage.findMany({ select: { id: true, name: true, ownerId: true, email: true } });
      console.log('   Available garages:', JSON.stringify(allGarages, null, 2));
    }
  }

  console.log('\nDone. Please LOG OUT and LOG BACK IN to get a fresh token.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
