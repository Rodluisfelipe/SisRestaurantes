const express = require("express");
const router = express.Router();
const ComboGroup = require("../Models/ComboGroup");
const { emitToBusiness } = require("../services/socketService");
const { tenantAuth } = require("../middleware/tenantAuth");

// Obtener todos los grupos de combos
router.get("/", async (req, res) => {
  try {
    const { businessId } = req.query;
    const filter = { active: true };
    if (businessId) filter.businessId = businessId;
    const comboGroups = await ComboGroup.find(filter);
    res.json(comboGroups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Crear un nuevo grupo de combo
router.post("/", tenantAuth, async (req, res) => {
  const comboGroup = new ComboGroup({
    name: req.body.name,
    basePrice: req.body.basePrice,
    description: req.body.description,
    subGroups: req.body.subGroups,
    businessId: req.body.businessId
  });

  try {
    const newComboGroup = await comboGroup.save();
    emitToBusiness(newComboGroup.businessId?.toString(), 'combo_groups_update', await ComboGroup.find({ active: true, businessId: newComboGroup.businessId }));
    res.status(201).json(newComboGroup);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Actualizar un grupo de combo
router.patch("/:id", tenantAuth, async (req, res) => {
  try {
    const comboGroup = await ComboGroup.findById(req.params.id);
    if (!comboGroup) {
      return res.status(404).json({ message: "Combo no encontrado" });
    }

    Object.assign(comboGroup, req.body);
    const updatedComboGroup = await comboGroup.save();
    emitToBusiness(updatedComboGroup.businessId?.toString(), 'combo_groups_update', await ComboGroup.find({ active: true, businessId: updatedComboGroup.businessId }));
    res.json(updatedComboGroup);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Eliminar un grupo de combo (soft delete)
router.delete("/:id", tenantAuth, async (req, res) => {
  try {
    const comboGroup = await ComboGroup.findById(req.params.id);
    if (!comboGroup) {
      return res.status(404).json({ message: "Combo no encontrado" });
    }

    comboGroup.active = false;
    await comboGroup.save();
    emitToBusiness(comboGroup.businessId?.toString(), 'combo_groups_update', await ComboGroup.find({ active: true, businessId: comboGroup.businessId }));
    res.json({ message: "Combo eliminado" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 