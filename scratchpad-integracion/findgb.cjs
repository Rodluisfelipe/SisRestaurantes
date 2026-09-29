require('dotenv').config();
const m = require('mongoose');
m.connect(process.env.MONGODB_URI).then(async () => {
  const B = m.connection.db.collection('businessconfigs');
  const d = await B.find({ $or: [ { businessName: /go\s*burger/i }, { slug: /go-?burger/i } ] })
    .project({ businessName: 1, slug: 1 }).limit(10).toArray();
  console.log(d.map(x => ({ id: String(x._id), nombre: x.businessName, slug: x.slug })));
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
