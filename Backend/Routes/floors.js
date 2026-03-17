const express = require("express");
const router = express.Router();
const Floor = require("../Models/Floor");
const { isValidObjectId } = require("../utils/validators");
const { tenantAuth } = require("../middleware/tenantAuth");
const logger = require("../utils/logger");

// Get all floors for a business
router.get("/", async (req, res) => {
  try {
    const { businessId } = req.query;
    if (!businessId || !isValidObjectId(businessId)) {
      return res.status(400).json({ message: "businessId válido es requerido" });
    }
    const floors = await Floor.find({ businessId }).sort({ order: 1 });
    res.json(floors);
  } catch (error) {
    logger.error("Error fetching floors:", error);
    res.status(500).json({ message: "Error al obtener salones" });
  }
});

// Create a floor
router.post("/", tenantAuth, async (req, res) => {
  try {
    const { businessId, name } = req.body;
    if (!businessId || !isValidObjectId(businessId)) {
      return res.status(400).json({ message: "businessId válido es requerido" });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "El nombre es requerido" });
    }
    const count = await Floor.countDocuments({ businessId });
    const floor = new Floor({ businessId, name: name.trim(), order: count });
    await floor.save();
    res.status(201).json(floor);
  } catch (error) {
    logger.error("Error creating floor:", error);
    res.status(500).json({ message: "Error al crear salón" });
  }
});

// Update a floor
router.put("/:id", tenantAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "ID inválido" });
    }
    const { name, order, isActive } = req.body;
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (order !== undefined) update.order = order;
    if (isActive !== undefined) update.isActive = isActive;

    const floor = await Floor.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!floor) return res.status(404).json({ message: "Salón no encontrado" });
    res.json(floor);
  } catch (error) {
    logger.error("Error updating floor:", error);
    res.status(500).json({ message: "Error al actualizar salón" });
  }
});

// Delete a floor
router.delete("/:id", tenantAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "ID inválido" });
    }
    const floor = await Floor.findByIdAndDelete(id);
    if (!floor) return res.status(404).json({ message: "Salón no encontrado" });
    // Unlink tables from this floor
    const Table = require("../Models/Table");
    await Table.updateMany({ floorId: id }, { $set: { floorId: null } });
    res.json({ message: "Salón eliminado" });
  } catch (error) {
    logger.error("Error deleting floor:", error);
    res.status(500).json({ message: "Error al eliminar salón" });
  }
});

module.exports = router;
