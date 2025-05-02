const express = require("express");
const router = express.Router();
const ToppingGroup = require("../Models/ToppingGroup");

// Add debugging middleware for this router
router.use((req, res, next) => {
  console.log(`[ToppingGroups] ${req.method} ${req.originalUrl}`);
  next();
});

// Get all topping groups
router.get("/", async (req, res) => {
  console.log('[ToppingGroups] GET / called');
  try {
    const toppingGroups = await ToppingGroup.find({ active: true });
    console.log('[ToppingGroups] Found:', toppingGroups);
    res.json(toppingGroups);
  } catch (error) {
    console.error("[ToppingGroups] Error:", error);
    res.status(500).json({ message: "Error al obtener los grupos de toppings" });
  }
});

// Create new topping group
router.post("/", async (req, res) => {
  try {
    const toppingGroup = new ToppingGroup(req.body);
    await toppingGroup.save();
    res.status(201).json(toppingGroup);
  } catch (error) {
    console.error("Error al crear grupo de toppings:", error);
    res.status(500).json({ message: "Error al crear el grupo de toppings" });
  }
});

// Update topping group
router.put("/:id", async (req, res) => {
  try {
    const toppingGroup = await ToppingGroup.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(toppingGroup);
  } catch (error) {
    console.error("Error al actualizar grupo de toppings:", error);
    res.status(500).json({ message: "Error al actualizar el grupo de toppings" });
  }
});

// Delete topping group (soft delete)
router.delete("/:id", async (req, res) => {
  try {
    const toppingGroup = await ToppingGroup.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );
    res.json(toppingGroup);
  } catch (error) {
    console.error("Error al eliminar grupo de toppings:", error);
    res.status(500).json({ message: "Error al eliminar el grupo de toppings" });
  }
});

module.exports = router; 