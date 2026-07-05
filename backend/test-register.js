const signupData = {
  name: "Test Garage Owner",
  email: `testowner_${Date.now()}@test.com`,
  phone: `2519${Math.floor(10000000 + Math.random() * 90000000)}`,
  password: "password123",
  role: "admin",
  garageName: "Automated Test Garage " + Date.now(),
  address: "Bole Road, Addis Ababa"
};

async function test() {
  try {
    const res = await fetch("http://localhost:5000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signupData)
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
