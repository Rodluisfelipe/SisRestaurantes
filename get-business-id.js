const mongoose = require('mongoose');
const BusinessConfig = require('./Models/BusinessConfig');

async function getBusinessId() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sisrestaurantes');
    console.log('Connected to MongoDB');
    
    const business = await BusinessConfig.findOne({ slug: 'felipe' });
    if (business) {
      console.log('Business felipe found:', business._id);
    } else {
      console.log('Business felipe not found');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

getBusinessId();
