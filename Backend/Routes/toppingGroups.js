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

// Endpoint de prueba para verificar que el servidor esté funcionando
router.get("/test", (req, res) => {
  res.json({ 
    message: "ToppingGroups API funcionando correctamente", 
    timestamp: new Date().toISOString(),
    mongoose: mongoose.connection.readyState === 1 ? "conectado" : "desconectado"
  });
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
    // Validar datos requeridos
    if (!req.body.name || req.body.name.trim() === '') {
      return res.status(400).json({ message: "El nombre del grupo es requerido" });
    }

    if (!req.body.businessId) {
      return res.status(400).json({ message: "El businessId es requerido" });
    }

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
    
    console.log("Grupo creado:", {
      id: group._id,
      name: group.name,
      basePrice: group.basePrice
    });
    
    // Emitir evento de WebSocket
    emitToBusiness(group.businessId?.toString(), "topping_groups_update", { type: "created" });
    res.status(201).json(group);
  } catch (error) {
    console.error("Error al crear grupo:", error);
    
    // Manejar errores específicos de validación
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: "Error de validación", 
        errors: validationErrors 
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({ message: "Formato de datos inválido" });
    }
    
    if (error.name === 'MongoServerError' && error.code === 11000) {
      console.log("ERROR DE CLAVE DUPLICADA EN POST");
      console.log("Detalles:", error.keyValue);
      return res.status(409).json({ 
        message: "Ya existe un grupo con este nombre para este negocio",
        duplicateField: error.keyPattern,
        duplicateValue: error.keyValue
      });
    }
    
    res.status(500).json({ 
      message: "Error al crear el grupo de toppings",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update topping group - Versión simplificada y robusta
router.put("/:id", async (req, res) => {
  console.log("=== INICIO UPDATE TOPPING GROUP ===");
  console.log("ID recibido:", req.params.id);
  console.log("Datos recibidos:", JSON.stringify(req.body, null, 2));
  
  try {
    // Validar que el ID sea válido
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log("ERROR: ID inválido");
      return res.status(400).json({ message: "ID de grupo inválido" });
    }
    console.log("✓ ID válido");

    // Verificar conexión a la base de datos
    if (mongoose.connection.readyState !== 1) {
      console.log("ERROR: Base de datos no conectada");
      return res.status(500).json({ message: "Error de conexión a la base de datos" });
    }
    console.log("✓ Base de datos conectada");

    // Buscar el grupo existente primero
    const existingGroup = await ToppingGroup.findById(req.params.id);
    if (!existingGroup) {
      console.log("ERROR: Grupo no encontrado");
      return res.status(404).json({ message: "Grupo de toppings no encontrado" });
    }
    console.log("✓ Grupo encontrado:", existingGroup.name);

    // Preparar datos de actualización de forma más segura
    const updateData = {
      name: req.body.name || existingGroup.name,
      description: req.body.description || existingGroup.description,
      basePrice: Number(req.body.basePrice || existingGroup.basePrice || 0),
      isMultipleChoice: Boolean(req.body.isMultipleChoice),
      isRequired: Boolean(req.body.isRequired),
      options: Array.isArray(req.body.options) ? req.body.options : existingGroup.options,
      subGroups: Array.isArray(req.body.subGroups) ? req.body.subGroups : existingGroup.subGroups,
      businessId: existingGroup.businessId // Mantener el businessId original
    };

    console.log("Datos de actualización preparados:", JSON.stringify(updateData, null, 2));

    // Validar datos requeridos
    if (!updateData.name || updateData.name.trim() === '') {
      console.log("ERROR: Nombre requerido");
      return res.status(400).json({ message: "El nombre del grupo es requerido" });
    }
    console.log("✓ Nombre válido");

    // Actualizar usando save() en lugar de findByIdAndUpdate para mejor control
    Object.assign(existingGroup, updateData);
    const updatedGroup = await existingGroup.save();
    
    console.log("✓ Grupo actualizado exitosamente");
    console.log("Grupo actualizado:", {
      id: updatedGroup._id,
      name: updatedGroup.name,
      basePrice: updatedGroup.basePrice,
      businessId: updatedGroup.businessId
    });
    
    // Emitir evento WebSocket con manejo de errores
    try {
      emitToBusiness(updatedGroup.businessId?.toString(), "topping_groups_update", { type: "updated" });
      console.log("✓ Evento WebSocket emitido");
    } catch (wsError) {
      console.error("Error emitiendo WebSocket (no crítico):", wsError);
    }
    
    console.log("=== FIN UPDATE TOPPING GROUP - ÉXITO ===");
    res.json(updatedGroup);
  } catch (error) {
    console.error("=== ERROR EN UPDATE TOPPING GROUP ===");
    console.error("Error completo:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    
    // Manejar errores específicos
    if (error.name === 'ValidationError') {
      console.log("ERROR DE VALIDACIÓN");
      const validationErrors = Object.values(error.errors).map(err => err.message);
      console.log("Errores de validación:", validationErrors);
      return res.status(400).json({ 
        message: "Error de validación", 
        errors: validationErrors 
      });
    }
    
    if (error.name === 'CastError') {
      console.log("ERROR DE CAST");
      return res.status(400).json({ message: "Formato de datos inválido" });
    }
    
    if (error.name === 'MongoServerError' && error.code === 11000) {
      console.log("ERROR DE CLAVE DUPLICADA");
      console.log("Detalles:", error.keyValue);
      return res.status(409).json({ 
        message: "Ya existe un grupo con este nombre para este negocio",
        duplicateField: error.keyPattern,
        duplicateValue: error.keyValue
      });
    }
    
    console.log("ERROR GENÉRICO - Enviando 500");
    res.status(500).json({ 
      message: "Error al actualizar el grupo de toppings",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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

// Toggle active status of a specific option
router.patch("/:groupId/options/:optionId/toggle", async (req, res) => {
  try {
    const { groupId, optionId } = req.params;
    
    console.log(`[ToppingGroups] Toggling option ${optionId} in group ${groupId}`);
    
    // Encontrar el grupo
    const group = await ToppingGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Grupo de toppings no encontrado" });
    }
    
    // Buscar la opción en las opciones principales
    let optionFound = false;
    group.options.forEach(option => {
      if (option._id.toString() === optionId) {
        option.active = !option.active;
        optionFound = true;
        console.log(`[ToppingGroups] Option ${option.name} toggled to ${option.active}`);
      }
    });
    
    // Si no se encontró en opciones principales, buscar en subgrupos
    if (!optionFound) {
      group.subGroups.forEach(subGroup => {
        subGroup.options.forEach(option => {
          if (option._id.toString() === optionId) {
            option.active = !option.active;
            optionFound = true;
            console.log(`[ToppingGroups] Subgroup option ${option.name} toggled to ${option.active}`);
          }
        });
      });
    }
    
    if (!optionFound) {
      return res.status(404).json({ message: "Opción no encontrada" });
    }
    
    // Guardar los cambios
    await group.save();
    
    // Emitir evento de actualización por WebSocket
    emitToBusiness(group.businessId?.toString(), "topping_groups_update", { 
      type: "option_toggled", 
      groupId: group._id,
      optionId 
    });
    
    res.json({ success: true, message: "Estado de la opción actualizado", group });
  } catch (error) {
    console.error("Error toggling option:", error);
    res.status(500).json({ message: "Error al cambiar el estado de la opción" });
  }
});

module.exports = router; 