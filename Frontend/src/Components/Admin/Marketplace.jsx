import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const CATEGORIES = [
  { value: '', label: 'Todos' },
  { value: 'ingredients', label: 'Insumos / Ingredientes' },
  { value: 'beverages', label: 'Bebidas' },
  { value: 'equipment', label: 'Equipos y utensilios' },
  { value: 'packaging', label: 'Empaques y desechables' },
  { value: 'other', label: 'Otros' }
];

const STATUS_COLORS = {
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800'
};

const STATUS_LABELS = {
  pending_approval: 'Pendiente aprobación',
  approved: 'Aprobado',
  processing: 'En proceso',
  delivered: 'Entregado',
  cancelled: 'Cancelado'
};

export default function Marketplace({ businessId, businessName }) {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [buyerNote, setBuyerNote] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [productsRes, suppliersRes] = await Promise.all([
        api.get('/marketplace/products'),
        api.get('/marketplace/suppliers')
      ]);
      setProducts(productsRes.data.products || []);
      setSuppliers(suppliersRes.data.suppliers || []);
    } catch {
      setErrorMsg('Error al cargar el marketplace');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredProducts = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchSupplier = !selectedSupplier || String(p.businessId) === selectedSupplier;
    return matchSearch && matchSupplier;
  });

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => String(i.productId) === String(product._id));
      if (existing) return prev.map(i => String(i.productId) === String(product._id) ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, {
        productId: product._id,
        name: product.name,
        unitPrice: product.price,
        unit: 'unidad',
        qty: 1,
        supplierId: String(product.businessId),
        supplierName: product.supplier?.businessName || ''
      }];
    });
  };

  const updateQty = (productId, qty) => {
    if (qty < 1) return removeFromCart(productId);
    setCart(prev => prev.map(i => String(i.productId) === String(productId) ? { ...i, qty } : i));
  };

  const removeFromCart = (productId) => setCart(prev => prev.filter(i => String(i.productId) !== String(productId)));

  const cartTotal = cart.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);

  // Agrupar carrito por proveedor
  const cartBySupplier = cart.reduce((acc, item) => {
    if (!acc[item.supplierId]) acc[item.supplierId] = { supplierName: item.supplierName, items: [] };
    acc[item.supplierId].items.push(item);
    return acc;
  }, {});

  const placeOrders = async () => {
    if (!cart.length) return;
    setPlacingOrder(true);
    setErrorMsg('');
    try {
      // Un pedido por proveedor
      await Promise.all(
        Object.entries(cartBySupplier).map(([supplierId, { items }]) =>
          api.post('/supplier-orders', {
            supplierBusinessId: supplierId,
            items: items.map(i => ({ productId: i.productId, qty: i.qty, unit: i.unit })),
            deliveryAddress,
            buyerNote
          })
        )
      );
      setCart([]);
      setShowCart(false);
      setSuccessMsg(`Pedido${Object.keys(cartBySupplier).length > 1 ? 's' : ''} enviado${Object.keys(cartBySupplier).length > 1 ? 's' : ''} — esperando aprobación del administrador`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (e) {
      setErrorMsg(e.response?.data?.message || 'Error al enviar el pedido');
    } finally {
      setPlacingOrder(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Marketplace de Proveedores</h2>
          <p className="text-sm text-slate-500 mt-0.5">Compra insumos, equipos y más directamente a proveedores</p>
        </div>
        {cart.length > 0 && (
          <button
            onClick={() => setShowCart(true)}
            className="relative flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            🛒 Carrito
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {cart.reduce((s, i) => s + i.qty, 0)}
            </span>
          </button>
        )}
      </div>

      {successMsg && <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm">{successMsg}</div>}
      {errorMsg && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{errorMsg}</div>}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Buscar productos..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={selectedSupplier}
          onChange={e => setSelectedSupplier(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los proveedores</option>
          {suppliers.map(s => <option key={s._id} value={s._id}>{s.businessName}</option>)}
        </select>
      </div>

      {/* Proveedores */}
      {!selectedSupplier && suppliers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {suppliers.map(s => (
            <button
              key={s._id}
              onClick={() => setSelectedSupplier(String(s._id))}
              className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
            >
              {s.logo
                ? <img src={s.logo} alt={s.businessName} className="w-8 h-8 rounded-full object-cover" />
                : <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">{s.businessName[0]}</div>
              }
              <span className="text-sm font-medium text-slate-700 line-clamp-1">{s.businessName}</span>
            </button>
          ))}
        </div>
      )}

      {/* Productos */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-2">🏪</p>
          <p className="font-medium">No hay productos disponibles</p>
          <p className="text-sm mt-1">Los proveedores aparecerán aquí una vez sean aprobados por el administrador</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map(product => (
            <div key={product._id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
              {product.image && (
                <img src={product.image} alt={product.name} className="w-full h-36 object-cover" />
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-slate-900 text-sm line-clamp-2">{product.name}</h3>
                  <span className="text-blue-600 font-bold text-sm whitespace-nowrap">
                    ${product.price?.toLocaleString('es-CO')}
                  </span>
                </div>
                {product.description && (
                  <p className="text-xs text-slate-500 mb-3 line-clamp-2">{product.description}</p>
                )}
                {product.supplier && (
                  <p className="text-xs text-slate-400 mb-3">🏭 {product.supplier.businessName}</p>
                )}
                <button
                  onClick={() => addToCart(product)}
                  className="w-full bg-blue-600 text-white text-xs font-medium py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  + Agregar al carrito
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Carrito */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-slate-900">🛒 Confirmar pedido</h3>
              <button onClick={() => setShowCart(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {Object.entries(cartBySupplier).map(([supplierId, { supplierName, items }]) => (
                <div key={supplierId}>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">🏭 {supplierName}</p>
                  {items.map(item => (
                    <div key={String(item.productId)} className="flex items-center gap-3 py-2 border-b last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                        <p className="text-xs text-slate-500">${item.unitPrice?.toLocaleString('es-CO')} c/u</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(item.productId, item.qty - 1)} className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm hover:bg-slate-200">−</button>
                        <span className="text-sm font-medium w-5 text-center">{item.qty}</span>
                        <button onClick={() => updateQty(item.productId, item.qty + 1)} className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm hover:bg-slate-200">+</button>
                        <button onClick={() => removeFromCart(item.productId)} className="text-red-400 hover:text-red-600 ml-1 text-xs">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              <div className="pt-3 space-y-3">
                <input
                  type="text"
                  placeholder="Dirección de entrega (opcional)"
                  value={deliveryAddress}
                  onChange={e => setDeliveryAddress(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <textarea
                  placeholder="Nota para el proveedor (opcional)"
                  value={buyerNote}
                  onChange={e => setBuyerNote(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Total estimado</span>
                <span className="text-lg font-bold text-slate-900">${cartTotal.toLocaleString('es-CO')}</span>
              </div>

              <p className="text-xs text-slate-400 text-center">
                El pedido quedará pendiente de aprobación del administrador antes de ser enviado al proveedor
              </p>
            </div>

            <div className="p-5 border-t flex gap-3">
              <button onClick={() => setShowCart(false)} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={placeOrders}
                disabled={placingOrder}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {placingOrder ? 'Enviando...' : 'Enviar pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
