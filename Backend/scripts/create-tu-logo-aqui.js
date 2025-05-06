/**
 * Script to create a business with slug 'tu_logo_aqui'
 * 
 * This script checks if a business with the slug 'tu_logo_aqui' exists
 * and creates one if it doesn't.
 */

const mongoose = require('mongoose');
require('dotenv').config();
const BusinessConfig = require('../Models/BusinessConfig');

async function createTuLogoAquiBusiness() {
  try {
    console.log('Conectando a la base de datos...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Conexión exitosa a MongoDB');
    
    // Check if business with this slug already exists
    const existingBusiness = await BusinessConfig.findOne({ slug: 'tu_logo_aqui' });
    
    if (existingBusiness) {
      console.log('El negocio con slug "tu_logo_aqui" ya existe:', existingBusiness._id);
      process.exit(0);
    }
    
    // Create a new business with slug 'tu_logo_aqui'
    const newBusiness = new BusinessConfig({
      slug: 'tu_logo_aqui',
      businessName: 'Mi Restaurante Demo',
      logo: '', // Add your logo URL here if desired
      coverImage: '', // Add cover image URL if desired
      isOpen: true,
      whatsappNumber: '',
      address: 'Dirección de demostración',
      googleMapsUrl: '',
      socialMedia: {
        facebook: { url: '', isVisible: false },
        instagram: { url: '', isVisible: false },
        tiktok: { url: '', isVisible: false }
      },
      extraLink: { url: '', isVisible: false },
      theme: {
        buttonColor: '#2563eb',
        buttonTextColor: '#ffffff'
      },
      isActive: true
    });
    
    await newBusiness.save();
    console.log('Negocio creado exitosamente con slug "tu_logo_aqui" y ID:', newBusiness._id);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createTuLogoAquiBusiness(); 