const express = require("express");
const router = express.Router();
const ToppingGroup = require("../Models/ToppingGroup");
const eventService = require('../services/eventService');
const { emitToBusiness } = require("../services/socketService");
const mongoose = require('mongoose');
const { createBusinessFilter } = require("../utils/businessHelper");
const { resolveBusinessId } = require("../utils/businessResolver");
const logger = require("../utils/logger");
const { formatHttpError } = require("../utils/errorFormatter");
const { tenantAuth } = require("../middleware/tenantAuth");
const { audit } = require('../utils/auditLog');
const BusinessConfig = require('../Models/BusinessConfig');
const { getSubscriptionForBusiness, isFeatureEnabledForPlan } = require('../utils/subscriptionHelper');

const ensureToppingsFeatureEnabled = async (businessId, req, res) => {
  const { planConfig, commercialPlan } = await getSubscriptionForBusiness(businessId);
  if (isFeatureEnabledForPlan(planConfig, 'toppings')) {
    return true;
  }

  res.status(403).json(
    formatHttpError(req, 'Tu plan actual no incluye toppings/extras.', 403, {
      code: 'PLAN_FEATURE_NOT_AVAILABLE',
      feature: 'toppings',
      plan: commercialPlan
    })
  );
  return false;
};

// Get all topping groups
router.get("/", async (req, res) => {
  try {
    let { businessId } = req.query;
    
    // Crear filtro basado en businessId o slug
    const filter = await createBusinessFilter(businessId);
    
    logger.debug('Buscando topping groups con filtro', filter, req);
    
    // Obtener todos los grupos activos del negocio
    const groups = await ToppingGroup.find(filter).lean();
    
    // Transformar los datos para asegurar que basePrice siempre esté presente
    const transformedGroups = groups.map(group => {
      // Con .lean() ya es un objeto plano
      if (group.basePrice === undefined) {
        group.basePrice = 0;
      } else {
        group.basePrice = Number(group.basePrice);
      }
      
      return group;
    });
    
    logger.info(`Retrieved ${transformedGroups.length} topping groups for business ${businessId}`, { count: transformedGroups.length }, req);

    // Enviar los grupos transformados
    res.json(transformedGroups);
  } catch (error) {
    logger.error("Error obteniendo topping groups", error, req);
    res.status(500).json(formatHttpError(req, "Error al obtener grupos de toppings", 500));
  }
});

// Create new topping group
router.post("/", tenantAuth, async (req, res) => {
  try {
    logger.debug('Creating topping group', { name: req.body.name }, req);
    
    // Validar datos requeridos
    if (!req.body.name || req.body.name.trim() === '') {
      return res.status(400).json(formatHttpError(req, "El nombre del grupo es requerido", 400));
    }

    if (!req.body.businessId) {
      return res.status(400).json(formatHttpError(req, "El businessId es requerido", 400));
    }

    // Manejar businessId si viene como slug
    if (req.body.businessId && typeof req.body.businessId === 'string') {
      try {
        req.body.businessId = await resolveBusinessId(req.body.businessId);
      } catch (error) {
        return res.status(404).json(formatHttpError(req, "Negocio no encontrado", 404, { detail: error.message }));
      }
    }

    if (!(await ensureToppingsFeatureEnabled(req.body.businessId, req, res))) {
      return;
    }
    
    // Filtrar opciones vacías (sin nombre) antes de crear
    if (Array.isArray(req.body.options)) {
      req.body.options = req.body.options.filter(opt => opt && opt.name && opt.name.trim() !== '');
    }
    if (Array.isArray(req.body.subGroups)) {
      req.body.subGroups = req.body.subGroups.map(sg => {
        if (sg && Array.isArray(sg.options)) {
          return { ...sg, options: sg.options.filter(opt => opt && opt.name && opt.name.trim() !== '') };
        }
        return sg;
      });
    }

    const group = new ToppingGroup(req.body);
    await group.save();
    
    // Audit log
    const biz = await BusinessConfig.findById(group.businessId).select('name').lean();
    audit({ action: 'create', resource: 'toppingGroup', resourceId: group._id, resourceName: group.name, businessId: group.businessId, businessName: biz?.name, after: group.toObject(), req });
    
    logger.info('Topping group created', { id: group._id, name: group.name }, req);
    
    // Emitir evento de WebSocket
    emitToBusiness(group.businessId?.toString(), "topping_groups_update", { type: "created" });
    res.status(201).json(group);
  } catch (error) {
    logger.error("Error creating topping group", error, req);
    
    // Manejar errores específicos de validación
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({ field: err.path, message: err.message }));
      return res.status(400).json(formatHttpError(req, "Error de validación", 400, validationErrors));
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json(formatHttpError(req, "Formato de datos inválido", 400));
    }
    
    if (error.name === 'MongoServerError' && error.code === 11000) {
      logger.warn('Duplicate key error on topping group creation', { keyValue: error.keyValue }, req);
      return res.status(409).json(formatHttpError(req, "Ya existe un grupo con este nombre para este negocio", 409, {
        duplicateField: error.keyPattern,
        duplicateValue: error.keyValue
      }));
    }
    
    res.status(500).json(formatHttpError(req, "Error al crear el grupo de toppings", 500));
  }
});

// Update topping group - Versión simplificada y robusta
router.put("/:id", tenantAuth, async (req, res) => {
  try {
    // Validar que el ID sea válido
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(formatHttpError(req, "ID de grupo inválido", 400));
    }

    // Verificar conexión a la base de datos
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json(formatHttpError(req, "Error de conexión a la base de datos", 500));
    }

    // Buscar el grupo existente primero
    const existingGroup = await ToppingGroup.findById(req.params.id);
    if (!existingGroup) {
      return res.status(404).json(formatHttpError(req, "Grupo de toppings no encontrado", 404));
    }

    if (!(await ensureToppingsFeatureEnabled(existingGroup.businessId, req, res))) {
      return;
    }

    const beforeUpdate = existingGroup.toObject();

    // Preparar datos de actualización de forma más segura
    // Filtrar opciones vacías (sin nombre) que el frontend puede enviar al agregar una opción nueva sin completarla
    let cleanOptions = existingGroup.options;
    if (Array.isArray(req.body.options)) {
      cleanOptions = req.body.options.filter(opt => opt && opt.name && opt.name.trim() !== '');
    }
    let cleanSubGroups = existingGroup.subGroups;
    if (Array.isArray(req.body.subGroups)) {
      cleanSubGroups = req.body.subGroups.map(sg => {
        if (sg && Array.isArray(sg.options)) {
          return { ...sg, options: sg.options.filter(opt => opt && opt.name && opt.name.trim() !== '') };
        }
        return sg;
      });
    }

    const updateData = {
      name: req.body.name || existingGroup.name,
      description: req.body.description || existingGroup.description,
      basePrice: Number(req.body.basePrice || existingGroup.basePrice || 0),
      isMultipleChoice: Boolean(req.body.isMultipleChoice),
      isRequired: Boolean(req.body.isRequired),
      options: cleanOptions,
      subGroups: cleanSubGroups,
      businessId: existingGroup.businessId // Mantener el businessId original
    };

    // Validar datos requeridos
    if (!updateData.name || updateData.name.trim() === '') {
      return res.status(400).json(formatHttpError(req, "El nombre del grupo es requerido", 400));
    }

    // Actualizar usando save() en lugar de findByIdAndUpdate para mejor control
    Object.assign(existingGroup, updateData);
    const updatedGroup = await existingGroup.save();
    
    // Audit log
    const biz = await BusinessConfig.findById(updatedGroup.businessId).select('name').lean();
    audit({ action: 'update', resource: 'toppingGroup', resourceId: updatedGroup._id, resourceName: updatedGroup.name, businessId: updatedGroup.businessId, businessName: biz?.name, before: beforeUpdate, after: updatedGroup.toObject(), req });
    
    logger.info('Topping group updated', { id: updatedGroup._id, name: updatedGroup.name }, req);
    
    // Emitir evento WebSocket con manejo de errores
    try {
      emitToBusiness(updatedGroup.businessId?.toString(), "topping_groups_update", { type: "updated" });
    } catch (wsError) {
      logger.error("Error emitiendo WebSocket (no crítico)", wsError, req);
    }
    
    res.json(updatedGroup);
  } catch (error) {
    logger.error("Error updating topping group", error, req);
    
    // Manejar errores específicos
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({ field: err.path, message: err.message }));
      return res.status(400).json(formatHttpError(req, "Error de validación", 400, validationErrors));
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json(formatHttpError(req, "Formato de datos inválido", 400));
    }
    
    if (error.name === 'MongoServerError' && error.code === 11000) {
      logger.warn('Duplicate key error on topping group update', { keyValue: error.keyValue }, req);
      return res.status(409).json(formatHttpError(req, "Ya existe un grupo con este nombre para este negocio", 409, {
        duplicateField: error.keyPattern,
        duplicateValue: error.keyValue
      }));
    }
    
    res.status(500).json(formatHttpError(req, "Error al actualizar el grupo de toppings", 500));
  }
});

// Delete topping group
router.delete("/:id", tenantAuth, async (req, res) => {
  try {
    // Validar que el ID sea válido
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(formatHttpError(req, "ID de grupo inválido", 400));
    }

    // Resolver businessId: query param > JWT > skip filter
    const rawBusinessId = req.query.businessId || req.user?.businessId;
    let filter = { _id: req.params.id };
    if (rawBusinessId) {
      try {
        const resolvedBusinessId = await resolveBusinessId(rawBusinessId);
        filter.businessId = resolvedBusinessId;
      } catch (err) {
        // Si no se puede resolver, buscar solo por _id
        logger.warn('Could not resolve businessId for delete, using _id only', { rawBusinessId }, req);
      }
    }

    const existingGroup = await ToppingGroup.findOne(filter);
    if (!existingGroup) {
      return res.status(404).json(formatHttpError(req, "Grupo de toppings no encontrado (puede que ya fue eliminado)", 404));
    }

    if (!(await ensureToppingsFeatureEnabled(existingGroup.businessId, req, res))) {
      return;
    }

    const deleted = await ToppingGroup.findOneAndDelete({ _id: existingGroup._id });

    // Audit log
    const biz = await BusinessConfig.findById(deleted.businessId).select('name').lean();
    audit({ action: 'delete', resource: 'toppingGroup', resourceId: deleted._id, resourceName: deleted.name, businessId: deleted.businessId, businessName: biz?.name, before: deleted.toObject(), req });

    // Emitir evento de WebSocket
    try {
      emitToBusiness(deleted.businessId?.toString(), "topping_groups_update", { type: "deleted" });
    } catch (wsError) {
      logger.error("Error emitiendo WebSocket (no crítico)", wsError, req);
    }
    logger.info('Topping group deleted', { id: deleted._id, name: deleted.name }, req);
    res.json({ message: "Grupo de toppings eliminado" });
  } catch (error) {
    logger.error("Error eliminando topping group", error, req);
    res.status(500).json(formatHttpError(req, "Error al eliminar el grupo de toppings", 500));
  }
});

// Toggle active status of a specific option
router.patch("/:groupId/options/:optionId/toggle", tenantAuth, async (req, res) => {
  try {
    const { groupId, optionId } = req.params;
    
    // Encontrar el grupo
    const group = await ToppingGroup.findById(groupId);
    if (!group) {
      return res.status(404).json(formatHttpError(req, "Grupo de toppings no encontrado", 404));
    }

    if (!(await ensureToppingsFeatureEnabled(group.businessId, req, res))) {
      return;
    }
    
    // Buscar la opción en las opciones principales
    let optionFound = false;
    group.options.forEach(option => {
      if (option._id.toString() === optionId) {
        option.active = !option.active;
        optionFound = true;
        logger.debug(`Option toggled to ${option.active}`, { groupId, optionId, optionName: option.name }, req);
      }
    });
    
    // Si no se encontró en opciones principales, buscar en subgrupos
    if (!optionFound) {
      group.subGroups.forEach(subGroup => {
        subGroup.options.forEach(option => {
          if (option._id.toString() === optionId) {
            option.active = !option.active;
            optionFound = true;
            logger.debug(`Subgroup option toggled to ${option.active}`, { groupId, optionId, optionName: option.name }, req);
          }
        });
      });
    }
    
    if (!optionFound) {
      return res.status(404).json(formatHttpError(req, "Opción no encontrada", 404));
    }
    
    // Guardar los cambios
    await group.save();
    
    // Emitir evento de actualización por WebSocket
    emitToBusiness(group.businessId?.toString(), "topping_groups_update", { 
      type: "option_toggled", 
      groupId: group._id,
      optionId 
    });
    
    logger.info('Option toggled successfully', { groupId, optionId }, req);
    res.json({ success: true, message: "Estado de la opción actualizado", group });
  } catch (error) {
    logger.error("Error toggling option", error, req);
    res.status(500).json(formatHttpError(req, "Error al cambiar el estado de la opción", 500));
  }
});

module.exports = router; 