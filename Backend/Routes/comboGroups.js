const express = require("express");
const router = express.Router();
const ComboGroup = require("../Models/ComboGroup");

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
router.post("/", async (req, res) => {
  const comboGroup = new ComboGroup({
    name: req.body.name,
    basePrice: req.body.basePrice,
    description: req.body.description,
    subGroups: req.body.subGroups
  });

  try {
    const newComboGroup = await comboGroup.save();
    req.emitEvent('combo_groups_update', await ComboGroup.find({ active: true }));
    res.status(201).json(newComboGroup);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Actualizar un grupo de combo
router.patch("/:id", async (req, res) => {
  try {
    const comboGroup = await ComboGroup.findById(req.params.id);
    if (!comboGroup) {
      return res.status(404).json({ message: "Combo no encontrado" });
    }

    Object.assign(comboGroup, req.body);
    const updatedComboGroup = await comboGroup.save();
    req.emitEvent('combo_groups_update', await ComboGroup.find({ active: true }));
    res.json(updatedComboGroup);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Eliminar un grupo de combo (soft delete)
router.delete("/:id", async (req, res) => {
  try {
    const comboGroup = await ComboGroup.findById(req.params.id);
    if (!comboGroup) {
      return res.status(404).json({ message: "Combo no encontrado" });
    }

    comboGroup.active = false;
    await comboGroup.save();
    req.emitEvent('combo_groups_update', await ComboGroup.find({ active: true }));
    res.json({ message: "Combo eliminado" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 