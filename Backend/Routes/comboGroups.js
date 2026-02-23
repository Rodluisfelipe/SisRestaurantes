const express = require("express");
const router = express.Router();
const ComboGroup = require("../Models/ComboGroup");
const { emitToBusiness } = require("../services/socketService");
const { tenantAuth } = require("../middleware/tenantAuth");

// Obtener todos los grupos de combos
router.get("/", async (req, res) => {
  try {
    const { businessId } = req.query;
    if (!businessId) {
      return res.status(400).json({ message: 'businessId es requerido' });
    }
    const filter = { active: true, businessId };
    const comboGroups = await ComboGroup.find(filter);
    res.json(comboGroups);
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Crear un nuevo grupo de combo
router.post("/", tenantAuth, async (req, res) => {
  const comboGroup = new ComboGroup({
    name: req.body.name,
    basePrice: req.body.basePrice,
    description: req.body.description,
    subGroups: req.body.subGroups,
    businessId: req.user.businessId || req.body.businessId  // Force from token, fallback for superadmin
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
    // Compound query: only find combos belonging to this tenant
    const tenantBizId = req.user.businessId || req.body.businessId;
    const comboGroup = await ComboGroup.findOne({ _id: req.params.id, ...(tenantBizId ? { businessId: tenantBizId } : {}) });
    if (!comboGroup) {
      return res.status(404).json({ message: "Combo no encontrado" });
    }

    // Whitelist allowed fields — prevent businessId override and mass assignment
    const { name, basePrice, description, subGroups } = req.body;
    if (name !== undefined) comboGroup.name = name;
    if (basePrice !== undefined) comboGroup.basePrice = basePrice;
    if (description !== undefined) comboGroup.description = description;
    if (subGroups !== undefined) comboGroup.subGroups = subGroups;

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
    // Compound query: only find combos belonging to this tenant
    const tenantBizIdDel = req.user.businessId || req.body.businessId || req.query.businessId;
    const comboGroup = await ComboGroup.findOne({ _id: req.params.id, ...(tenantBizIdDel ? { businessId: tenantBizIdDel } : {}) });
    if (!comboGroup) {
      return res.status(404).json({ message: "Combo no encontrado" });
    }

    comboGroup.active = false;
    await comboGroup.save();
    emitToBusiness(comboGroup.businessId?.toString(), 'combo_groups_update', await ComboGroup.find({ active: true, businessId: comboGroup.businessId }));
    res.json({ message: "Combo eliminado" });
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router; 