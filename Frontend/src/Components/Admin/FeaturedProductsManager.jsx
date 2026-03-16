import ProductOrderSelector from '../ProductOrderSelector';
import {
  FaStar, FaChevronLeft, FaGripVertical, FaTimes
} from 'react-icons/fa';
import { useBusinessConfig } from '../../Context/BusinessContext';

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
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaStar className="text-amber-500 text-sm" />
            <div>
              <h3 className="text-sm font-semibold text-slate-800">{isService ? 'Servicios Destacados' : 'Productos Destacados'}</h3>
              <p className="text-[11px] text-slate-500">
                Arrastra para reordenar &bull; {featuredProducts.length}/5
              </p>
            </div>
          </div>
        </div>

        {featuredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <FaStar className="text-2xl text-slate-300 mb-2" />
            <p className="text-sm text-slate-500 font-medium">{isService ? 'Sin servicios destacados' : 'Sin productos destacados'}</p>
            <p className="text-xs text-slate-400 mt-1">{isService ? 'Marca hasta 5 servicios como destacados desde Gestión de Servicios' : 'Marca hasta 5 productos como destacados desde Gestión de Productos'}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {featuredProducts.map((product, index) => (
              <div
                key={product._id}
                draggable
                onDragStart={(e) => handleFeaturedDragStart(e, index)}
                onDragOver={(e) => handleFeaturedDragOver(e, index, featuredProducts)}
                onDragEnd={handleFeaturedDragEnd}
                className={`flex items-center gap-3 px-4 py-2.5 transition-all cursor-grab active:cursor-grabbing ${
                  draggedFeaturedItem === index
                    ? 'bg-amber-50 opacity-50'
                    : 'hover:bg-slate-50'
                }`}
              >
                <FaGripVertical className="text-slate-300 hover:text-slate-500 text-xs flex-shrink-0 transition-colors" />

                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                  index === 0 ? 'bg-amber-100 text-amber-700' :
                  index === 1 ? 'bg-slate-200 text-slate-600' :
                  index === 2 ? 'bg-orange-100 text-orange-600' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {index + 1}
                </span>

                {product.image && (
                  <img src={product.image} alt={product.name} className="w-9 h-9 object-cover rounded-lg flex-shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{product.name}</p>
                  <p className="text-xs text-slate-500">${product.price.toLocaleString()}</p>
                </div>

                <button
                  onClick={() => handleToggleFeatured(product._id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                  title="Quitar de destacados"
                >
                  <FaTimes className="text-xs" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ProductOrderSelector
        products={products}
        categories={categories}
        businessId={businessId}
        onOrderChange={(newOrderedProducts) => setProducts(newOrderedProducts)}
      />
    </div>
  );
}
