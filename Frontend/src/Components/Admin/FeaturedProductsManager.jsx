import ProductOrderSelector from '../ProductOrderSelector';
import {
  FaStar, FaChevronLeft, FaGripVertical, FaArrowUp, FaArrowDown
} from 'react-icons/fa';
import { useBusinessConfig } from '../../Context/BusinessContext';
import PopularSectionManager from './PopularSectionManager';
import { pesos } from '../../utils/pedidos';

/**
 * Pestaña "product-order": muestra productos destacados con drag-and-drop
 * y el selector de orden de productos.
 *
 * Extraído de Admin.jsx (~200 líneas).
 */
export default function FeaturedProductsManager({
  products,
  categories,
  businessId,
  setProducts,
  setActiveTab,
  handleToggleFeatured,
  handleReorderFeatured,
  handleFeaturedDragStart,
  handleFeaturedDragOver,
  handleFeaturedDragEnd,
  draggedFeaturedItem,
}) {
  const featuredProducts = Array.isArray(products)
    ? products.filter(p => p.isFeatured).sort((a, b) => (a.featuredOrder || 0) - (b.featuredOrder || 0))
    : [];
  const { businessConfig } = useBusinessConfig();
  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);

  /* Flechas para subir y bajar: arrastrar solo funciona con mouse, en el
     celular no había forma de cambiar el orden. */
  const mover = (index, delta) => {
    const destino = index + delta;
    if (destino < 0 || destino >= featuredProducts.length) return;
    const nuevo = [...featuredProducts];
    const [item] = nuevo.splice(index, 1);
    nuevo.splice(destino, 0, item);
    handleReorderFeatured(nuevo);
  };

  return (
    <div className="space-y-4">
      {/* Botón Volver - Solo móvil */}
      <button
        onClick={() => setActiveTab('dashboard')}
        className="lg:hidden flex items-center gap-2 text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-sm"
      >
        <FaChevronLeft className="text-xs" />
        <span className="font-medium">Volver</span>
      </button>

      {/* Sección de Productos Destacados */}
      <div className="bg-white rounded-2xl lg:rounded-xl border border-slate-100 lg:border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:shadow-none overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaStar className="text-amber-500 text-sm" />
            <div>
              <h3 className="text-sm font-semibold text-slate-800">{isService ? 'Servicios destacados' : 'Productos destacados'}</h3>
              <p className="text-xs text-slate-500">
                Salen primero en tu menú &bull; {featuredProducts.length} de 5
              </p>
            </div>
          </div>
        </div>

        {featuredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <FaStar className="text-2xl text-slate-300 mb-2" />
            <p className="text-sm text-slate-500 font-medium">{isService ? 'Sin servicios destacados' : 'Sin productos destacados'}</p>
            <p className="text-xs text-slate-500 mt-1">
              En {isService ? 'Servicios' : 'Productos'}, toca la estrella <FaStar className="inline text-amber-500 -mt-0.5" /> de hasta 5 para destacarlos.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {featuredProducts.map((product, index) => (
              <div
                key={product._id}
                draggable
                onDragStart={(e) => handleFeaturedDragStart(e, index)}
                onDragOver={(e) => handleFeaturedDragOver(e, index, featuredProducts)}
                onDragEnd={handleFeaturedDragEnd}
                className={`flex items-center gap-3 px-4 py-2.5 transition-all lg:cursor-grab lg:active:cursor-grabbing ${
                  draggedFeaturedItem === index
                    ? 'bg-amber-50 opacity-50'
                    : 'hover:bg-slate-50'
                }`}
              >
                <FaGripVertical className="hidden lg:block text-slate-300 hover:text-slate-500 text-xs flex-shrink-0 transition-colors" />

                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  index === 0 ? 'bg-amber-100 text-amber-700' :
                  index === 1 ? 'bg-slate-200 text-slate-600' :
                  index === 2 ? 'bg-orange-100 text-orange-600' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {index + 1}
                </span>

                {product.image && (
                  <img src={product.image} alt="" className="w-10 h-10 object-cover rounded-lg flex-shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 break-words">{product.name}</p>
                  <p className="text-xs text-slate-500">{pesos(product.price)}</p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button type="button" onClick={() => mover(index, -1)} disabled={index === 0} aria-label="Subir"
                    className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center">
                    <FaArrowUp className="text-xs" />
                  </button>
                  <button type="button" onClick={() => mover(index, 1)} disabled={index === featuredProducts.length - 1} aria-label="Bajar"
                    className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center">
                    <FaArrowDown className="text-xs" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleFeatured(product._id)}
                    className="h-9 px-2.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Quitar de destacados"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sección premium: Los más pedidos */}
      <PopularSectionManager businessId={businessId} products={products} />

      <ProductOrderSelector
        products={products}
        categories={categories}
        businessId={businessId}
        onOrderChange={(newOrderedProducts) => setProducts(newOrderedProducts)}
      />
    </div>
  );
}
