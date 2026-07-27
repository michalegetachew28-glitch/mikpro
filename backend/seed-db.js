const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Database for testing auth flow...");

  // Hashed passwords
  const hashedAdminPassword = await bcrypt.hash("admin123", 10);
  const hashedBasePassword = await bcrypt.hash("password123", 10);

  // 1. Create Platform Settings if not exists
  let settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  if (!settings) {
    settings = await prisma.platformSettings.create({
      data: {
        id: "singleton",
        plans: [
          { id: 'monthly', name: '1-Month Plan', price: 1500, duration: 30, status: 'active' },
          { id: '3month', name: '3-Month Plan', price: 4000, duration: 90, status: 'active' },
          { id: '6month', name: '6-Month Plan', price: 7500, duration: 180, status: 'active' },
          { id: 'yearly', name: '1-Year Plan', price: 14000, duration: 365, status: 'active' }
        ],
        paymentMethods: [],
        taxRate: 15.0,
        platformFees: 0.0,
        trialDays: 7,
        garageIdCounter: 1
      }
    });
    console.log("Created PlatformSettings");
  }

  // 2. Create a Garage
  let garage = await prisma.garage.findFirst({ where: { name: "Miky Garage" } });
  if (!garage) {
    garage = await prisma.garage.create({
      data: {
        displayId: "12-0001-000",
        ownerId: "demoadmin@garage.com",
        name: "Miky Garage",
        address: "Bole Road, Addis Ababa",
        ownerName: "Miky Owner",
        email: "demoadmin@garage.com",
        phone: "251912345678",
        status: "active"
      }
    });
    console.log("Created Garage: Miky Garage");
  }

  // 3. Define Users
  const userTemplates = [
    {
      email: "demoadmin@garage.com",
      phone: "251912345678",
      name: "Miky Owner",
      password: hashedAdminPassword,
      role: "admin",
      permissions: ["all"],
      garageName: "Miky Garage"
    },
    {
      email: "manager@garage.com",
      phone: "251986666666",
      name: "Telahun Manager",
      password: hashedBasePassword,
      role: "manager",
      permissions: ["repairs_manage", "repairs_view", "appointments_manage", "customers_manage", "vehicles_manage", "material_requests_manage", "tracker_view", "attendance_manage", "billing_manage"],
      garageName: "Miky Garage"
    },
    {
      email: "cashier@garage.com",
      phone: "251987888888",
      name: "Hirut Cashier",
      password: hashedBasePassword,
      role: "cashier",
      permissions: ["billing_view", "billing_edit", "customers_manage", "vehicles_manage"],
      garageName: "Miky Garage"
    },
    {
      email: "mechanic@garage.com",
      phone: "251984444444",
      name: "Samuel Mechanic",
      password: hashedBasePassword,
      role: "mechanic",
      permissions: ["repairs_view", "inventory_view", "vehicles_view"],
      garageName: "Miky Garage"
    },
    {
      email: "inventory@garage.com",
      phone: "251985555555",
      name: "Tadesse InvMgr",
      password: hashedBasePassword,
      role: "inventoryManager",
      permissions: ["inventory_manage", "inventory_view", "billing_manage"],
      garageName: "Miky Garage"
    },
    {
      email: "receptionist@garage.com",
      phone: "251944556677",
      name: "Almaz Receptionist",
      password: hashedBasePassword,
      role: "receptionist",
      permissions: ["customers_manage", "vehicles_manage", "appointments_manage", "repairs_view"],
      garageName: "Miky Garage"
    },
    {
      email: "storekeeper@garage.com",
      phone: "251966778899",
      name: "Storekeeper Tadesse",
      password: hashedBasePassword,
      role: "storekeeper",
      permissions: ["inventory_view", "inventory_manage"],
      garageName: "Miky Garage"
    },
    {
      email: "yechale20@gmail.com",
      phone: "251966666611",
      name: "Dawit Customer",
      password: hashedBasePassword,
      role: "customer",
      permissions: ["my_data_view"],
      garageName: "Miky Garage"
    }
  ];

  // Seed Users & Staff/Customers
  for (const u of userTemplates) {
    try {
      const existingUser = await prisma.user.findFirst({
        where: { OR: [{ email: u.email }, { phone: u.phone }] }
      });
      if (!existingUser) {
        const uExpiry = new Date();
        uExpiry.setFullYear(uExpiry.getFullYear() + 1); // 1-year expiry for test

        const createdUser = await prisma.user.create({
          data: {
            ownerId: garage.ownerId,
            name: u.name,
            email: u.email,
            phone: u.phone,
            password: u.password,
            role: u.role,
            garageName: u.garageName,
            address: "Addis Ababa",
            status: "active",
            permissions: u.permissions,
            expiryDate: uExpiry,
            garageId: garage.id
          }
        });
        console.log(`Created User: ${u.email} (${u.role})`);

        // If customer, we also need to create a Customer record linked
        if (u.role === 'customer') {
          await prisma.customer.create({
            data: {
              id: createdUser.id,
              garageId: garage.id,
              name: u.name,
              phone: u.phone,
              email: u.email,
              address: "Addis Ababa"
            }
          });
          console.log(`Created Customer record for: ${u.name}`);
        } else if (u.role !== 'admin') {
          // If staff, create Staff record
          await prisma.staff.create({
            data: {
              garageId: garage.id,
              userId: createdUser.id,
              name: u.name,
              role: u.role,
              phone: u.phone,
              status: "active"
            }
          });
          console.log(`Created Staff record for: ${u.name}`);
        }
      } else {
        console.log(`User already exists: ${u.email} (${u.role})`);
      }
    } catch (e) {
      console.error(`Error seeding user ${u.email}:`, e.message);
    }
  }

  console.log("Seeding complete successfully!");
}

main()
  .catch(e => {
    console.error("Master Seeding failed:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
