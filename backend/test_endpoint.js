const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const invoice = await prisma.invoice.findFirst();
  if (!invoice) {
    console.log("No invoice to test.");
    return;
  }
  
  // We need an admin user to generate a token, or we can just skip auth if we modify the route,
  // but it's easier to fetch an admin and make a token.
  const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: admin.id, role: admin.role, garageId: admin.garageId }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1d' });

  const payload = JSON.stringify({
    txId: 'TEST-POST-ENDPOINT',
    note: 'Testing from node script',
    screenshot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  });

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: `/api/invoices/${invoice.orderId}/proof`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', async () => {
      console.log('StatusCode:', res.statusCode);
      console.log('Response Body:', data);
      
      const dbInv = await prisma.invoice.findUnique({ where: { orderId: invoice.orderId } });
      console.log("Screenshot saved in DB?", !!dbInv.proofDetails?.screenshot);
      
      prisma.$disconnect();
    });
  });

  req.on('error', error => {
    console.error('Request error:', error);
    prisma.$disconnect();
  });

  req.write(payload);
  req.end();
}

main().catch(console.error);
