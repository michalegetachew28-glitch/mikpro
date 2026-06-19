/**
 * PDF Generation Utility for Garage Management System
 * Uses the global jspdf and jspdf-autotable libraries from CDNs.
 */

export const generateInvoicePDF = (invoice, customer, garageName = 'Garage Management System') => {
  if (!window.jspdf) {
    alert('PDF library is still loading. Please wait a few seconds and try again.');
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = jsPDF();

  // Header
  doc.setFontSize(22);
  doc.setTextColor(33, 150, 243); // Primary Blue
  doc.text(garageName, 105, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Invoice ID: ${invoice.id}`, 20, 40);
  doc.text(`Date: ${new Date(invoice.date).toLocaleDateString()}`, 20, 45);

  // Customer Info
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('Bill To:', 20, 60);
  doc.setFontSize(11);
  doc.text(customer?.name || invoice.customerName || 'Customer Name', 20, 67);
  doc.text(customer?.phone || invoice.customerPhone || '', 20, 72);

  // Table Data Preparation
  const tableData = [];
  
  // 1. Labor cost
  if (invoice.laborCost > 0) {
    tableData.push(['Technical Service & Labor', '1', `${invoice.laborCost.toLocaleString()} ETB`, `${invoice.laborCost.toLocaleString()} ETB`]);
  }

  // 2. Parts / Items
  (invoice.items || []).forEach(item => {
    tableData.push([
      item.description,
      item.quantity,
      `${item.price.toLocaleString()} ETB`,
      `${(item.quantity * item.price).toLocaleString()} ETB`
    ]);
  });

  // 3. Additional Charges
  if ((invoice.additionalCharges || 0) > 0) {
    tableData.push(['Additional Charges', '1', `${invoice.additionalCharges.toLocaleString()} ETB`, `${invoice.additionalCharges.toLocaleString()} ETB`]);
  }

  doc.autoTable({
    startY: 85,
    head: [['Description', 'Qty', 'Unit Price', 'Total']],
    body: tableData,
    foot: [
      ['', '', 'Subtotal', `${(invoice.subtotal || 0).toLocaleString()} ETB`],
      ['', '', 'Tax (15%)', `${(invoice.tax || 0).toLocaleString()} ETB`],
      ['', '', 'Discount', `-${(invoice.discount || 0).toLocaleString()} ETB`],
      ['', '', 'Total Amount', `${(invoice.total || 0).toLocaleString()} ETB`]
    ],
    theme: 'striped',
    headStyles: { fillColor: [33, 150, 243] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
  });

  // Footer
  const finalY = doc.lastAutoTable.finalY || 150;
  doc.setFontSize(10);
  doc.text('Thank you for choosing our service!', 105, finalY + 20, { align: 'center' });

  doc.save(`Invoice_${invoice.id}.pdf`);
};

export const generateBackupPDF = (data, garageName = 'Garage Management System') => {
  if (!window.jspdf) {
    alert('PDF library is still loading. Please wait a few seconds and try again.');
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = jsPDF();

  // Header
  doc.setFontSize(20);
  doc.text(`${garageName} - Full Business Report`, 105, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 28, { align: 'center' });

  // 1. Repairs Section
  doc.setFontSize(14);
  doc.text('1. Active & Historical Repairs', 20, 45);
  const repairData = (data.repairs || []).map(r => [
    r.id,
    r.plate || 'N/A',
    r.status.toUpperCase(),
    r.cost ? `${r.cost.toLocaleString()} ETB` : '0 ETB',
    new Date(r.date).toLocaleDateString()
  ]);

  doc.autoTable({
    startY: 50,
    head: [['Repair ID', 'Plate', 'Status', 'Cost', 'Date']],
    body: repairData,
    theme: 'grid',
    headStyles: { fillColor: [75, 75, 75] }
  });

  // 2. Customers Section
  let finalY = doc.lastAutoTable.finalY + 15;
  if (finalY > 250) { doc.addPage(); finalY = 20; }
  
  doc.setFontSize(14);
  doc.text('2. Customer Directory', 20, finalY);
  const customerData = (data.customers || []).map(c => [
    c.id,
    c.name,
    c.phone,
    c.activeRepairs || 0
  ]);

  doc.autoTable({
    startY: finalY + 5,
    head: [['ID', 'Name', 'Phone', 'Active Repairs']],
    body: customerData,
    theme: 'striped'
  });

  // 3. Vehicles Section
  finalY = doc.lastAutoTable.finalY + 15;
  if (finalY > 240) { doc.addPage(); finalY = 20; }
  
  doc.setFontSize(14);
  doc.text('3. Vehicle Fleet', 20, finalY);
  const vehicleData = (data.vehicles || []).map(v => [
    v.plate,
    v.make,
    v.model,
    v.year,
    v.ownerName || 'Unknown'
  ]);

  doc.autoTable({
    startY: finalY + 5,
    head: [['Plate', 'Make', 'Model', 'Year', 'Owner']],
    body: vehicleData,
    theme: 'grid'
  });

  // 4. Inventory Section
  finalY = doc.lastAutoTable.finalY + 15;
  if (finalY > 240) { doc.addPage(); finalY = 20; }
  
  doc.setFontSize(14);
  doc.text('4. Current Inventory Snapshot', 20, finalY);
  const inventoryData = (data.inventory || []).map(i => [
    i.name,
    i.category,
    i.stock,
    `${i.price.toLocaleString()} ETB`
  ]);

  doc.autoTable({
    startY: finalY + 5,
    head: [['Item', 'Category', 'Stock', 'Price']],
    body: inventoryData,
    theme: 'striped'
  });

  // 5. Staff Section
  finalY = doc.lastAutoTable.finalY + 15;
  if (finalY > 240) { doc.addPage(); finalY = 20; }
  
  doc.setFontSize(14);
  doc.text('5. Staff Directory', 20, finalY);
  const staffData = (data.staff || []).map(s => [
    s.name,
    s.role.toUpperCase(),
    s.phone,
    s.status || 'Active'
  ]);

  doc.autoTable({
    startY: finalY + 5,
    head: [['Name', 'Role', 'Phone', 'Status']],
    body: staffData,
    theme: 'grid',
    headStyles: { fillColor: [40, 167, 69] } // Success Green for staff section
  });

  doc.save(`Garage_Full_Export_${new Date().toISOString().split('T')[0]}.pdf`);
};
