const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const invoice = await prisma.invoice.findFirst();
  
  if (!invoice) {
    console.log("No invoices found at all.");
    return;
  }
  
  console.log("Found an invoice to test with:", invoice.orderId);
  
  // Directly update this invoice in the DB to have a proof
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: 'payment-submitted',
      hasProof: true,
      proofDetails: {
        txId: 'TEST-12345',
        note: 'Direct DB update test',
        date: new Date().toISOString(),
        screenshot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' // 1x1 pixel base64
      }
    }
  });
  
  console.log("Updated invoice in DB!", updated.orderId);
  console.log("proofDetails stored:", updated.proofDetails);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
