import ProductFormToppingSelector from '../Components/ProductFormToppingSelector';

// Luego, dentro del formulario de productos, 
// justo antes del botón de submit, añadir:

<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Grupos de Toppings
  </label>
  <ProductFormToppingSelector 
    toppingGroups={toppingGroups}
    selectedToppings={form.toppingGroups}
    onChange={newSelected => setForm({...form, toppingGroups: newSelected})}
  />
</div> 