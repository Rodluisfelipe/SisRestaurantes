const m=require('mongoose');require('dotenv').config();
m.connect(process.env.MONGODB_URI).then(async()=>{
  const db=m.connection.db;
  await db.collection('customers').createIndex({businessId:1,status:1});
  console.log('customers status index created');
  await db.collection('products').createIndex({businessId:1,isActive:1});
  console.log('products isActive index created');
  const ci=await db.collection('customers').indexes();
  const pi=await db.collection('products').indexes();
  console.log('customers indexes:',JSON.stringify(ci.map(i=>i.key)));
  console.log('products indexes:',JSON.stringify(pi.map(i=>i.key)));
  m.disconnect();
});
