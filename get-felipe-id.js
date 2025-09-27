const mongoose = require('mongoose');

async function getFelipeId() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sisrestaurantes');
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const collection = db.collection('businessconfigs');
    
    const business = await collection.findOne({ slug: 'felipe' });
    if (business) {
      console.log('Business felipe found with ID:', business._id);
    } else {
      console.log('Business felipe not found');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

getFelipeId();
