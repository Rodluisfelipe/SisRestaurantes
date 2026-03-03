const mongoose = require('mongoose');
const SA = require('../Models/SuperAdmin');
const jwt = require('jsonwebtoken');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  // List all SuperAdmins
  const all = await SA.find({}).select('_id email');
  console.log('SuperAdmins in DB:', JSON.stringify(all, null, 2));

  // Check if we can find by _id
  for (const sa of all) {
    const exists = await SA.exists({ _id: sa._id });
    console.log(`SA ${sa._id} exists check:`, !!exists);
    
    // Generate test token same way as login
    const token = jwt.sign({ id: sa._id, role: 'superadmin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);
    
    // Now check with decoded.id (string)
    const existsByString = await SA.exists({ _id: decoded.id });
    console.log(`SA exists by decoded.id (${decoded.id}):`, !!existsByString);
  }
  
  process.exit(0);
}).catch(e => { console.error('ERROR:', e.message); process.exit(1); });
