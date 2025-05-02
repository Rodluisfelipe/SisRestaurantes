const express = require("express");
const router = express.Router();
const BusinessConfig = require("../Models/BusinessConfig");

// Obtener la configuración
router.get("/", async (req, res) => {
  try {
    const config = await BusinessConfig.getConfig();
    res.json(config);
  } catch (error) {
    console.error("Error al obtener la configuración:", error);
    res.status(500).json({ message: "Error al obtener la configuración" });
  }
});

// Actualizar la configuración
router.put("/", async (req, res) => {
  try {
    console.log('Datos recibidos para actualización:', req.body);
    
    const updateData = {
      businessName: req.body.businessName,
      logo: req.body.logo,
      coverImage: req.body.coverImage,
      isOpen: req.body.isOpen !== undefined ? req.body.isOpen : true,
      socialMedia: {
        facebook: {
          url: req.body.socialMedia?.facebook?.url || "",
          isVisible: req.body.socialMedia?.facebook?.isVisible || false
        },
        instagram: {
          url: req.body.socialMedia?.instagram?.url || "",
          isVisible: req.body.socialMedia?.instagram?.isVisible || false
        },
        tiktok: {
          url: req.body.socialMedia?.tiktok?.url || "",
          isVisible: req.body.socialMedia?.tiktok?.isVisible || false
        }
      },
      extraLink: {
        url: req.body.extraLink?.url || "",
        isVisible: req.body.extraLink?.isVisible || false
      }
    };

    console.log('Datos a actualizar:', updateData);

    const config = await BusinessConfig.findOneAndUpdate(
      {},
      updateData,
      { 
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    console.log('Configuración actualizada:', config);
    res.json(config);
  } catch (error) {
    console.error("Error al actualizar la configuración:", error);
    res.status(500).json({ message: "Error al actualizar la configuración" });
  }
});

// Ruta específica para actualizar solo el estado del negocio (para actualizaciones rápidas)
router.put("/status", async (req, res) => {
  try {
    const { isOpen } = req.body;
    
    if (isOpen === undefined) {
      return res.status(400).json({ message: "Se requiere el estado del negocio" });
    }
    
    const config = await BusinessConfig.findOneAndUpdate(
      {},
      { isOpen },
      { new: true, upsert: true }
    );
    
    res.json(config);
  } catch (error) {
    console.error("Error al actualizar el estado del negocio:", error);
    res.status(500).json({ message: "Error al actualizar el estado del negocio" });
  }
});

module.exports = router;
