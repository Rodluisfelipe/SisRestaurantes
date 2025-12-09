const mongoose = require('mongoose');

const Product = require('../Models/Product');

async function checkProduct() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    console.log('🔗 MongoDB URI definido:', mongoUri ? 'Sí' : 'No');
    
    if (!mongoUri) {
      console.log('❌ No se encontró MONGO_URI ni MONGODB_URI');
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB');

    const productId = '6820c19e0c5ba4efc49ec0a3';
    const product = await Product.findById(productId);

    if (!product) {
      console.log('❌ Producto no encontrado');
      process.exit(1);
    }

    console.log('\n📦 PRODUCTO:');
    console.log('Name:', product.name);
    console.log('isFeatured:', product.isFeatured);
    console.log('featuredOrder:', product.featuredOrder);
    console.log('businessId:', product.businessId);
    
    console.log('\n📋 Documento completo:');
    console.log(JSON.stringify(product, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkProduct();
