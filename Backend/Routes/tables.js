const express = require("express");
const router = express.Router();
const Table = require("../Models/Table");
const BusinessConfig = require("../Models/BusinessConfig");
const mongoose = require("mongoose");
// Import the validators utilities
const { isValidObjectId, isValidBusinessIdentifier } = require("../utils/validators");
const { tenantAuth } = require("../middleware/tenantAuth");
const logger = require("../utils/logger");
const { getPlanLimitStatus } = require('../utils/subscriptionHelper');
const {
  validateCreateTable,
  validateUpdateTable,
  validateDeleteTable,
  validateBatchPositions,
} = require('../middleware/validators/tableValidators');

// Middleware to validate businessId
router.use(async (req, res, next) => {
  try {
    const businessId = req.query.businessId || req.body.businessId;
    
    if (!businessId) {
      return res.status(400).json({ message: "BusinessId is required" });
    }
    
    // Store the original businessId value (useful for QR code generation)
    req.originalBusinessId = businessId;
    

    
    // If it's already a valid ObjectId, proceed
    if (isValidObjectId(businessId)) {

      return next();
    }
    
    // At this point, we're dealing with a slug

    
    try {
      // First check if the slug exists in any business
      const business = await BusinessConfig.findOne({ slug: businessId });
      
      if (!business) {
        return res.status(404).json({ message: 'Negocio no encontrado' });
      }
      

      
      // Replace the slug with the _id of the business document
      if (req.query.businessId) {
        req.query.businessId = business._id.toString();
      }
      if (req.body.businessId) {
        req.body.businessId = business._id.toString();
      }
      
      return next();
    } catch (innerError) {
      logger.error("Error during business lookup:", innerError);
      return res.status(500).json({ message: 'Error al buscar negocio' });
    }
  } catch (error) {
    logger.error("Error in businessId middleware:", error);
    return res.status(500).json({ 
      message: "Error processing businessId"
    });
  }
});

// Get all tables for a business
router.get("/", async (req, res) => {
  try {
    const { businessId } = req.query;

    
    // El middleware ya deberÃ­a haber convertido el slug a ObjectId si es necesario
    if (!isValidObjectId(businessId)) {

      return res.status(400).json({ message: "Invalid businessId" });
    }
    
    // Normal query with validated businessId
    const tables = await Table.find({ businessId });

    res.status(200).json(tables);
  } catch (error) {
    logger.error("Error fetching tables:", error);
    res.status(500).json({ message: "Error fetching tables" });
  }
});

// Validate if a table exists by tableNumber
router.get("/validate", async (req, res) => {
  try {
    const { businessId, tableNumber } = req.query;
    
    if (!businessId || !tableNumber) {
      return res.status(400).json({ message: "BusinessId and tableNumber are required" });
    }
    

    
    // Buscar el negocio primero si no es un ObjectId vÃ¡lido
    let finalBusinessId = businessId;
    if (!isValidObjectId(businessId)) {

      const business = await BusinessConfig.findOne({ slug: businessId });
      if (business) {
        finalBusinessId = business._id;

      } else {

        return res.status(404).json({ 
          message: "Business not found",
          exists: false 
        });
      }
    }
    
    // Check if table exists - make sure we're comparing strings
    // El tableNumber no es un ObjectId, es simplemente un nÃºmero de mesa (string o nÃºmero)

    const table = await Table.findOne({ 
      businessId: finalBusinessId, 
      tableNumber: tableNumber.toString().trim() 
    });
    
    if (!table) {


      
      return res.status(404).json({ 
        message: "Table not found",
        exists: false 
      });
    }
    

    res.status(200).json({ 
      message: "Table found",
      exists: true,
      table
    });
    
  } catch (error) {
    logger.error("Error validating table:", error);
    res.status(500).json({ message: "Error validating table" });
  }
});

// Get a single table by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { businessId } = req.query;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid table ID format" });
    }
    
    const table = await Table.findOne({ _id: id, businessId });
    
    if (!table) {
      return res.status(404).json({ message: "Table not found" });
    }
    
    res.status(200).json(table);
  } catch (error) {
    logger.error("Error fetching table:", error);
    res.status(500).json({ message: "Error fetching table" });
  }
});

// Create a new table
router.post("/", tenantAuth, validateCreateTable, async (req, res) => {
  try {
    const { businessId, tableNumber, tableName, notes } = req.body;
    // Use the original slug for the QR code URL but the ObjectId for database operations
    const originalBusinessId = req.originalBusinessId || businessId;
    

    
    // Ensure businessId is a valid ObjectId for DB operations
    if (!isValidObjectId(businessId)) {
      return res.status(400).json({ 
        message: "Invalid businessId format for table creation. The businessId might not have been properly converted from slug to ObjectId."
      });
    }
    
    // Check if this table number already exists for this business
    const existingTable = await Table.findOne({ businessId, tableNumber });
    if (existingTable) {
      return res.status(400).json({ message: "A table with this number already exists" });
    }

    const currentCount = await Table.countDocuments({ businessId, isActive: true });
    const limitStatus = await getPlanLimitStatus({
      businessId,
      resourceKey: 'tables',
      currentCount
    });

    if (limitStatus.limitReached) {
      return res.status(403).json({
        message: limitStatus.message,
        code: 'PLAN_LIMIT_REACHED',
        plan: limitStatus.commercialPlan,
        limit: limitStatus.limitValue,
        current: currentCount
      });
    }
    
    // Generate the QR code URL - use the original slug for better readability
    const baseUrl = process.env.FRONTEND_URL || 'https://sisrestaurantes.com';
    const qrCodeUrl = `${baseUrl}/${originalBusinessId}/mesa/${tableNumber}`;
    
    const { floorId, posX, posY, shape, width, height, capacity, rotation } = req.body;
    const newTable = new Table({
      businessId,
      tableNumber,
      tableName: tableName || `Mesa ${tableNumber}`,
      qrCodeUrl,
      notes: notes || '',
      isActive: true,
      floorId: floorId || null,
      posX: posX ?? 10,
      posY: posY ?? 10,
      shape: shape || 'square',
      width: width ?? 10,
      height: height ?? 10,
      capacity: capacity ?? 4,
      rotation: rotation ?? 0
    });
    
    await newTable.save();
    res.status(201).json(newTable);
  } catch (error) {
    logger.error("Error creating table:", error);
    res.status(500).json({ message: "Error creating table" });
  }
});

// Update a table
router.put("/:id", tenantAuth, validateUpdateTable, async (req, res) => {
  try {
    const { id } = req.params;
    const { businessId, tableNumber, tableName, notes, isActive, floorId, posX, posY, shape, width, height, capacity, rotation } = req.body;
    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid table ID format" });
    }
    
    // Check if updating to a table number that already exists (excluding this table)
    if (tableNumber) {
      const existingTable = await Table.findOne({ 
        businessId, 
        tableNumber, 
        _id: { $ne: id } 
      });
      
      if (existingTable) {
        return res.status(400).json({ message: "A table with this number already exists" });
      }
    }
    
    const update = {};
    if (tableNumber !== undefined) update.tableNumber = tableNumber;
    if (tableName !== undefined) update.tableName = tableName;
    if (notes !== undefined) update.notes = notes;
    if (isActive !== undefined) update.isActive = isActive;
    if (floorId !== undefined) update.floorId = floorId || null;
    if (posX !== undefined) update.posX = posX;
    if (posY !== undefined) update.posY = posY;
    if (shape !== undefined) update.shape = shape;
    if (width !== undefined) update.width = width;
    if (height !== undefined) update.height = height;
    if (capacity !== undefined) update.capacity = capacity;
    if (rotation !== undefined) update.rotation = rotation;

    // Find the table and update it
    const updatedTable = await Table.findOneAndUpdate(
      { _id: id, businessId },
      update,
      { new: true, runValidators: true }
    );
    
    if (!updatedTable) {
      return res.status(404).json({ message: "Table not found" });
    }
    
    res.status(200).json(updatedTable);
  } catch (error) {
    logger.error("Error updating table:", error);
    res.status(500).json({ message: "Error updating table" });
  }
});

// Delete a table
router.delete("/:id", tenantAuth, validateDeleteTable, async (req, res) => {
  try {
    const { id } = req.params;
    const { businessId } = req.query;
    

    
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid table ID format" });
    }
    
    // El middleware ya deberÃ­a haber convertido el slug a ObjectId si es necesario
    if (!isValidObjectId(businessId)) {

      return res.status(400).json({ 
        message: "Invalid businessId format. The businessId might not have been properly converted from slug to ObjectId."
      });
    }
    

    const result = await Table.findOneAndDelete({ _id: id, businessId });
    
    if (!result) {

      return res.status(404).json({ message: "Table not found" });
    }
    

    res.status(200).json({ message: "Table deleted successfully" });
  } catch (error) {
    logger.error("Error deleting table:", error);
    res.status(500).json({ message: "Error deleting table" });
  }
});

// Batch update positions (drag & drop)
router.put("/batch/positions", tenantAuth, validateBatchPositions, async (req, res) => {
  try {
    const { businessId, updates } = req.body;
    if (!businessId || !isValidObjectId(businessId)) {
      return res.status(400).json({ message: "businessId vÃ¡lido es requerido" });
    }
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: "updates array es requerido" });
    }
    const ops = updates.map(u => ({
      updateOne: {
        filter: { _id: u._id, businessId },
        update: { $set: { posX: u.posX, posY: u.posY } }
      }
    }));
    await Table.bulkWrite(ops);
    res.json({ message: "Posiciones actualizadas" });
  } catch (error) {
    logger.error("Error batch updating positions:", error);
    res.status(500).json({ message: "Error al actualizar posiciones" });
  }
});

module.exports = router; 
