const express = require("express");
const router = express.Router();
const ToppingGroup = require("../Models/ToppingGroup");
const eventService = require('../services/eventService');
const { emitToBusiness } = require("../services/socketService");
const mongoose = require('mongoose');
const { findBusinessByIdentifier, createBusinessFilter } = require("../utils/businessHelper");

// Middleware para debugging
router.use((req, res, next) => {
  console.log(`[ToppingGroups] ${req.method} ${req.originalUrl}`);
  next();
});

// Get all topping groups
router.get("/", async (req, res) => {
  console.log('[ToppingGroups] Iniciando GET /topping-groups');
  try {
    let { businessId } = req.query;
    
    // Crear filtro basado en businessId o slug
    const filter = await createBusinessFilter(businessId);
    
    console.log('[ToppingGroups] Buscando grupos con filtro:', filter);
    
    // Obtener todos los grupos activos del negocio
    const groups = await ToppingGroup.find(filter);
    
    // Transformar los datos para asegurar que basePrice siempre esté presente
    const transformedGroups = groups.map(group => {
      // Convertir el documento Mongoose a un objeto simple
      const plainGroup = group.toObject();
      
      // Asegurar que basePrice exista y sea un número
      if (plainGroup.basePrice === undefined) {
        plainGroup.basePrice = 0;
      } else {
        plainGroup.basePrice = Number(plainGroup.basePrice);
      }
      
      return plainGroup;
    });
    
    console.log('[ToppingGroups] Grupos procesados con basePrice:', 
      transformedGroups.map(g => ({
        id: g._id,
        name: g.name,
        basePrice: g.basePrice,
        type: typeof g.basePrice
      }))
    );

    // Enviar los grupos transformados
    res.json(transformedGroups);
  } catch (error) {
    console.error("[ToppingGroups] Error al obtener grupos:", error);
    res.status(500).json({ 
      message: "Error al obtener grupos de toppings",
      error: error.message 
    });
  }
});

// Create new topping group
router.post("/", async (req, res) => {
  console.log("Datos recibidos para crear grupo:", req.body);
  try {
    // Manejar businessId si viene como slug
    if (req.body.businessId && typeof req.body.businessId === 'string') {
      // Buscar el businessId real
      const business = await findBusinessByIdentifier(req.body.businessId);
      if (business) {
        req.body.businessId = business._id;
      } else {
        return res.status(404).json({ 
          message: 'Negocio no encontrado',
          detail: `No se encontró un negocio con el identificador '${req.body.businessId}'`
        });
      }
    }
    
    const group = new ToppingGroup(req.body);
    await group.save();
    // Emitir evento de WebSocket
    emitToBusiness(group.businessId?.toString(), "topping_groups_update", { type: "created" });
    res.status(201).json(group);
  } catch (error) {
    console.error("Error al crear grupo:", error);
    res.status(500).json({ message: "Error al crear el grupo de toppings" });
  }
});

// Update topping group
router.put("/:id", async (req, res) => {
  console.log("Datos recibidos para actualizar grupo:", req.body);
  try {
    // Manejar businessId si viene como slug
    if (req.body.businessId && typeof req.body.businessId === 'string') {
      // Buscar el businessId real
      const business = await findBusinessByIdentifier(req.body.businessId);
      if (business) {
        req.body.businessId = business._id;
      }
    }
    
    // Asegúrate de que basePrice sea un número
    const basePrice = Number(req.body.basePrice || 0);
    console.log("BasePrice a guardar:", basePrice);
    
    // Usar updateOne con $set para asegurar que el campo se añada
    const result = await ToppingGroup.updateOne(
      { _id: req.params.id },
      { 
        $set: { 
          ...req.body,
          basePrice: basePrice 
        }
      }
    );
    
    console.log("Resultado de la actualización:", result);
    
    // Obtener el documento actualizado
    const toppingGroup = await ToppingGroup.findById(req.params.id);
    
    // Convertir a objeto simple y asegurar basePrice
    const plainGroup = toppingGroup.toObject();
    if (plainGroup.basePrice === undefined) {
      plainGroup.basePrice = basePrice;
    }
    
    console.log("Grupo actualizado con basePrice:", plainGroup.basePrice);
    
    // Emitir evento de WebSocket
    emitToBusiness(toppingGroup.businessId?.toString(), "topping_groups_update", { type: "updated" });
    
    res.json(plainGroup);
  } catch (error) {
    console.error("Error al actualizar grupo:", error);
    res.status(500).json({ message: "Error al actualizar el grupo de toppings" });
  }
});

// Delete topping group (soft delete)
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await ToppingGroup.findByIdAndDelete(req.params.id);
    // Emitir evento de WebSocket
    if (deleted) {
      emitToBusiness(deleted.businessId?.toString(), "topping_groups_update", { type: "deleted" });
    }
    res.json({ message: "Grupo de toppings eliminado" });
  } catch (error) {
    console.error("Error eliminando grupo:", error);
    res.status(500).json({ message: "Error al eliminar el grupo de toppings" });
  }
});

module.exports = router; 