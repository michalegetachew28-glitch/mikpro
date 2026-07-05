require('dotenv').config();
const bcrypt = require('bcryptjs');
async function test() {
  try {
    const hash = await bcrypt.hash('testpass', 10);
    console.log('bcrypt works:', hash);
    const valid = await bcrypt.compare('testpass', hash);
    console.log('compare works:', valid);
  } catch(e) {
    console.error('bcrypt error:', e.message);
  }
}
test();
