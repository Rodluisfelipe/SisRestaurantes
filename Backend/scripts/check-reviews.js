require('dotenv').config();
const m = require('mongoose');
m.connect(process.env.MONGODB_URI).then(async () => {
  const reviews = await m.connection.db.collection('reviews').find({}).project({
    customerName: 1, businessId: 1, rating: 1, isVisible: 1, comment: 1, thumbsUp: 1
  }).toArray();
  console.log('Total reviews:', reviews.length);
  reviews.forEach(r => {
    console.log(JSON.stringify({
      id: r._id.toString(),
      name: r.customerName,
      biz: r.businessId.toString(),
      rating: r.rating,
      visible: r.isVisible,
      comment: (r.comment || '').substring(0, 40),
      thumbsUp: r.thumbsUp
    }));
  });
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
