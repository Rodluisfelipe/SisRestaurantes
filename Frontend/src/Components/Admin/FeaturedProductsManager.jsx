import { motion } from "framer-motion";
import ProductOrderSelector from '../ProductOrderSelector';

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Botón Volver - Solo móvil */}
      <button
        onClick={() => setActiveTab('dashboard')}
        className="lg:hidden flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-4 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span className="font-medium">Volver al inicio</span>
      </button>

      {/* Sección de Productos Destacados */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl shadow-xl border-2 border-yellow-200 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-400 p-2 rounded-lg">
              <span className="text-2xl">⭐</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Productos Destacados</h3>
              <p className="text-sm text-gray-600">
                Arrastra y suelta para cambiar el orden &bull; {featuredProducts.length} de 5 productos
              </p>
            </div>
          </div>
        </div>

        {featuredProducts.length === 0 ? (
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-8 text-center">
            <div className="text-6xl mb-4">⭐</div>
            <p className="text-gray-600 font-medium">No hay productos destacados</p>
            <p className="text-sm text-gray-500 mt-2">Ve a la sección de productos y marca hasta 5 productos como destacados</p>
          </div>
        ) : (
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 space-y-2">
            {featuredProducts.map((product, index) => (
              <motion.div
                key={product._id}
                draggable
                onDragStart={(e) => handleFeaturedDragStart(e, index)}
                onDragOver={(e) => handleFeaturedDragOver(e, index, featuredProducts)}
                onDragEnd={handleFeaturedDragEnd}
                className={`flex items-center gap-3 bg-white p-3 rounded-lg shadow-sm border-2 transition-all ${
                  draggedFeaturedItem === index
                    ? 'border-yellow-400 opacity-50'
                    : 'border-gray-200 hover:border-yellow-300'
                } cursor-move`}
                whileHover={{ scale: 1.02 }}
              >
                {/* Drag Handle */}
                <div className="text-gray-400 hover:text-yellow-500 transition-colors cursor-grab active:cursor-grabbing">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"></path>
                  </svg>
                </div>

                <div className="flex items-center gap-2 flex-1">
                  <span className="text-2xl font-bold text-yellow-600 w-8 text-center">{index + 1}</span>
                  {product.image && (
                    <img src={product.image} alt={product.name} className="w-12 h-12 object-cover rounded-lg" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{product.name}</p>
                    <p className="text-sm text-gray-500">${product.price.toLocaleString()}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleFeatured(product._id)}
                  className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                  title="Quitar de destacados"
                >
                  ❌
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      <ProductOrderSelector
        products={products}
        categories={categories}
        businessId={businessId}
        onOrderChange={(newOrderedProducts) => setProducts(newOrderedProducts)}
      />
    </motion.div>
  );
}
