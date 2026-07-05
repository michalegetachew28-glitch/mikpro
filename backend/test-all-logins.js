async function testLogin(identifier, password, label) {
  try {
    const res = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailOrPhone: identifier, password })

    });
    const data = await res.json();
    console.log(`\n[${label}] Status: ${res.status}`);
    if (res.ok) {
      console.log(`✅ Login SUCCESS - role: ${data.user?.role}, garage: ${data.user?.garageName}`);
    } else {
      console.log(`❌ Login FAILED - Error: ${data.error || data.message}`);
    }
  } catch (err) {
    console.error(`[${label}] ❌ Network Error:`, err.message);
  }
}

async function testCustomerCreate(token, garageId) {
  try {
    const res = await fetch("http://localhost:5000/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        name: "Test Customer AI",
        phone: "251911000099",
        email: "testai_unique@gmail.com",
        address: "Bole, Addis Ababa",
        password: "testcust123",
        garageId
      })
    });
    const data = await res.json();
    console.log(`\n[Customer Create] Status: ${res.status}`);
    if (res.ok) {
      console.log(`✅ Customer created - id: ${data.id || data.customer?.id}`);
    } else {
      console.log(`❌ Customer create FAILED - Error: ${data.error || JSON.stringify(data)}`);
    }
  } catch (err) {
    console.error(`[Customer Create] ❌ Network Error:`, err.message);
  }
}

async function run() {
  console.log("=== Testing role logins ===");
  await testLogin("demoadmin@garage.com",    "admin123",    "Admin");
  await testLogin("251986666666",            "password123", "Manager (phone)");
  await testLogin("251987888888",            "password123", "Cashier (phone)");
  await testLogin("251984444444",            "password123", "Mechanic (phone)");
  await testLogin("251985555555",            "password123", "InventoryMgr (phone)");
  await testLogin("yechale20@gmail.com",     "password123", "Customer (email)");

  // Get admin token for customer creation test
  console.log("\n=== Testing customer creation ===");
  try {
    const loginRes = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailOrPhone: "yechale1210@gmail.com", password: "password123" })

    });
    const loginData = await loginRes.json();
    if (loginRes.ok) {
      await testCustomerCreate(loginData.token, loginData.user.garageId);
    } else {
      console.log("Couldn't get admin token for customer test:", loginData);
    }
  } catch(e) {
    console.error("Admin login for customer test failed:", e.message);
  }
}

run();
