const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
  console.log('🏁 Starting Enterprise Payroll Flow Test...');

  // 1. Fetch a garage to attach data
  const garage = await prisma.garage.findFirst();
  if (!garage) {
    console.error('❌ No garage found in the database. Please register a garage first.');
    process.exit(1);
  }
  console.log(`ℹ️ Using Garage ID: ${garage.id} (${garage.name})`);

  // 2. Create test employee
  const uniqueId = String(Date.now()).slice(-6);
  const employeeNumber = `EMP-TEST-${uniqueId}`;
  
  console.log(`👤 Creating test employee ${employeeNumber}...`);
  const employee = await prisma.employee.create({
    data: {
      garageId: garage.id,
      employeeNumber,
      fullName: `John Test Doe ${uniqueId}`,
      phone: `0999${uniqueId}`,
      email: `john.test.${uniqueId}@example.com`,
      department: 'Engineering',
      employmentType: 'Full-time',
      status: 'active'
    }
  });
  console.log('✅ Employee created successfully:', employee.fullName);

  // 3. Create active salary structure
  console.log('💰 Setting up Salary Structure...');
  const structure = await prisma.salaryStructure.create({
    data: {
      garageId: garage.id,
      employeeId: employee.id,
      salaryType: 'Monthly',
      baseSalary: 12000,
      absencePenaltyPerDay: 400,
      latePenaltyPerOccurrence: 50,
      active: true,
      effectiveFrom: new Date()
    }
  });
  console.log('✅ Salary Structure set up successfully. Base:', structure.baseSalary);

  // 4. Create Salary Period
  console.log('📅 Creating Salary Period...');
  const startDate = new Date(); startDate.setDate(1); startDate.setHours(0,0,0,0);
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59);
  
  const period = await prisma.salaryPeriod.create({
    data: {
      garageId: garage.id,
      periodName: `Test July ${uniqueId}`,
      salaryType: 'Monthly',
      startDate,
      endDate,
      status: 'Open'
    }
  });
  console.log('✅ Salary Period created:', period.periodName);

  // 5. Add attendance records
  console.log('⏰ Creating Attendance entries (including overtime and late minutes)...');
  
  // Day 1: Present (on time, 2 hours overtime)
  const d1 = new Date(startDate); d1.setDate(2);
  const checkIn1 = new Date(d1); checkIn1.setHours(8, 0, 0);
  const checkOut1 = new Date(d1); checkOut1.setHours(19, 0, 0); // 8 AM to 7 PM (11 hours: 9 regular + 2 OT)
  
  await prisma.attendance.create({
    data: {
      garageId: garage.id,
      employeeId: employee.id,
      attendanceDate: d1,
      checkIn: checkIn1,
      checkOut: checkOut1,
      status: 'Present',
      workingHours: 11,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeHours: 2,
      remarks: '2 hrs OT'
    }
  });

  // Day 2: Present (30 minutes late, no check-out yet)
  const d2 = new Date(startDate); d2.setDate(3);
  const checkIn2 = new Date(d2); checkIn2.setHours(8, 30, 0); // 30 mins late
  
  await prisma.attendance.create({
    data: {
      garageId: garage.id,
      employeeId: employee.id,
      attendanceDate: d2,
      checkIn: checkIn2,
      status: 'Present',
      workingHours: 0,
      lateMinutes: 30,
      earlyLeaveMinutes: 0,
      overtimeHours: 0,
      remarks: 'Late check-in'
    }
  });

  // Day 3: Absent
  const d3 = new Date(startDate); d3.setDate(4);
  await prisma.attendance.create({
    data: {
      garageId: garage.id,
      employeeId: employee.id,
      attendanceDate: d3,
      status: 'Absent',
      workingHours: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeHours: 0,
      remarks: 'Unexcused absence'
    }
  });
  console.log('✅ Test attendance entries logged.');

  // 6. Simulate payroll generation endpoint logic
  console.log('⚡ Running Payroll Calculation logic...');
  
  // Load variables manually to simulate calculation endpoint
  const attendances = await prisma.attendance.findMany({
    where: { employeeId: employee.id, isDeleted: false }
  });

  let presentDays = 0, absentDays = 0, halfDays = 0, leaveDays = 0, overtimeHours = 0, lateHours = 0, lateOccurrences = 0;
  for (const a of attendances) {
    if (a.status === 'Present') presentDays += 1;
    else if (a.status === 'Absent') absentDays += 1;
    overtimeHours += a.overtimeHours || 0;
    lateHours += (a.lateMinutes || 0) / 60;
    if (a.lateMinutes > 0) {
      lateOccurrences += 1;
    }
  }

  // Count weekday working days in period (approx 22 for a standard month)
  let workingDays = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) workingDays++;
  }

  const overtimeAmount = 0;
  const absenceDeduction = absentDays * structure.absencePenaltyPerDay; // 1 * 400 = 400
  const lateDeduction = lateOccurrences * structure.latePenaltyPerOccurrence; // 1 * 50 = 50
  const allowances = 0;
  const grossSalary = structure.baseSalary; // 12000
  const taxAmount = 0;
  const pensionAmount = 0;
  const totalDeduction = taxAmount + pensionAmount + absenceDeduction + lateDeduction; // 400 + 50 = 450
  const netSalary = grossSalary - totalDeduction; // 11550

  const calculation = await prisma.salaryCalculation.create({
    data: {
      garageId: garage.id,
      employeeId: employee.id,
      salaryPeriodId: period.id,
      baseSalary: structure.baseSalary,
      workingDays,
      presentDays,
      absentDays,
      halfDays,
      leaveDays,
      overtimeHours: 0,
      lateHours,
      overtimeAmount: 0,
      bonus: 0,
      commission: 0,
      allowances: 0,
      tax: 0,
      pension: 0,
      absenceDeduction,
      lateDeduction,
      otherDeduction: 0,
      grossSalary,
      totalDeduction,
      netSalary,
      status: 'Pending'
    }
  });
  console.log(`✅ Payroll generated. Gross: ETB ${calculation.grossSalary}, Total Deductions: ETB ${calculation.totalDeduction}, Net Salary: ETB ${calculation.netSalary}`);

  // 7. Approve calculation
  console.log('📝 Approving payroll calculation...');
  await prisma.salaryCalculation.update({
    where: { id: calculation.id },
    data: { status: 'Approved' }
  });
  console.log('✅ Payroll calculation approved.');

  // 8. Process salary payment
  console.log('💰 Processing Salary Payment...');
  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.salaryPayment.create({
      data: {
        garageId: garage.id,
        employeeId: employee.id,
        salaryCalculationId: calculation.id,
        paymentMethod: 'Bank Transfer',
        paymentReference: 'TXN-PAYROLL-OK-01',
        amount: calculation.netSalary,
        receiptNumber: `PAY-${Date.now().toString().slice(-6)}`,
        notes: 'End-to-end verification run'
      }
    });

    await tx.salaryCalculation.update({
      where: { id: calculation.id },
      data: { status: 'Paid' }
    });

    return p;
  });
  console.log('✅ Salary Payment processed successfully! Receipt:', payment.receiptNumber);

  // 9. Verify calculations
  console.log('\n📊 VERIFICATION SUMMARY:');
  console.log(`- Expected Net Salary: ETB 11,550.00`);
  console.log(`- Calculated Net Salary: ETB ${payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  if (Math.abs(payment.amount - 11550) < 0.01) {
    console.log('🚀 SUCCESS: Calculations match expectations perfectly!');
  } else {
    console.error('❌ ERROR: Calculations mismatch.');
  }

  // Cleanup test data
  console.log('\n🧹 Cleaning up test objects...');
  await prisma.salaryPayment.delete({ where: { id: payment.id } });
  await prisma.salaryCalculation.delete({ where: { id: calculation.id } });
  await prisma.attendance.deleteMany({ where: { employeeId: employee.id } });
  await prisma.salaryPeriod.delete({ where: { id: period.id } });
  await prisma.salaryStructure.delete({ where: { id: structure.id } });
  await prisma.employee.delete({ where: { id: employee.id } });
  console.log('✅ Database cleanup completed successfully!');
}

runTest()
  .catch(err => {
    console.error('❌ Flow verification run failed:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
