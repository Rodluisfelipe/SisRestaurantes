const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Admin = require('./Models/Admin');
  const admins = await Admin.find({}).select('username businessId name').lean();
  admins.forEach(a => console.log(JSON.stringify(a)));
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
