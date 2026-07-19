import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { Package, Factory, MapPin, MessageSquare, Info, RotateCw, ClipboardList } from 'lucide-react';

const STATUS_COLORS = {
  pending_approval: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-blue-100 text-blue-800 border-blue-200',
  processing: 'bg-purple-100 text-purple-800 border-purple-200',
  delivered: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200'
};

const STATUS_LABELS = {
  pending_approval: 'Pendiente aprobación',
  approved: 'Aprobado',
  processing: 'En proceso',
  delivered: 'Entregado',
  cancelled: 'Cancelado'
};

function OrderCard({ order, isSupplier, onStatusUpdate }) {
  const [updating, setUpdating] = useState(false);

  const updateStatus = async (status) => {
    setUpdating(true);
    try {
      await api.patch(`/supplier-orders/${order._id}/status`, { status });
      onStatusUpdate(order._id, status);
    } catch (e) {
      alert(e.response?.data?.message || 'Error al actualizar estado');
    } finally {
      setUpdating(false);
    }
  };

  const total = order.total ?? order.items?.reduce((s, i) => s + i.unitPrice * i.qty, 0) ?? 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-slate-400">#{String(order._id).slice(-6).toUpperCase()}</p>
          <p className="font-semibold text-slate-900 text-sm truncate inline-flex items-center gap-1.5">
            {isSupplier ? <><Package className="w-3.5 h-3.5 shrink-0" /> {order.buyerBusinessName}</> : <><Factory className="w-3.5 h-3.5 shrink-0" /> {order.supplierBusinessName}</>}
          </p>
          <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full border whitespace-nowrap ${STATUS_COLORS[order.status]}`}>
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      {/* Items */}
      <div className="space-y-1">
        {order.items?.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-xs text-slate-600">
            <span className="truncate">{item.name} × {item.qty} {item.unit}</span>
            <span className="font-medium whitespace-nowrap ml-2">${(item.unitPrice * item.qty).toLocaleString('es-CO')}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <span className="text-sm font-bold text-slate-900">${total.toLocaleString('es-CO')}</span>

        {/* Acciones del proveedor */}
        {isSupplier && order.status === 'approved' && (
          <button
            onClick={() => updateStatus('processing')}
            disabled={updating}
            className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {updating ? '...' : 'Marcar en proceso'}
          </button>
        )}
        {isSupplier && order.status === 'processing' && (
          <button
            onClick={() => updateStatus('delivered')}
            disabled={updating}
            className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {updating ? '...' : 'Marcar entregado'}
          </button>
        )}
      </div>

      {/* Notas */}
      {(order.buyerNote || order.superadminNote || order.deliveryAddress) && (
        <div className="pt-2 border-t border-slate-100 space-y-1">
          {order.deliveryAddress && <p className="text-xs text-slate-500 inline-flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0" /> {order.deliveryAddress}</p>}
          {order.buyerNote && <p className="text-xs text-slate-500 inline-flex items-center gap-1"><MessageSquare className="w-3 h-3 shrink-0" /> {order.buyerNote}</p>}
          {order.superadminNote && <p className="text-xs text-blue-600 inline-flex items-center gap-1"><Info className="w-3 h-3 shrink-0" /> {order.superadminNote}</p>}
        </div>
      )}
    </div>
  );
}

export default function SupplierOrders({ businessId, isSupplier }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [error, setError] = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const endpoint = isSupplier ? '/supplier-orders/incoming' : '/supplier-orders/outgoing';
      const res = await api.get(endpoint);
      setOrders(res.data.orders || []);
    } catch {
      setError('Error al cargar los pedidos');
    } finally {
      setLoading(false);
    }
  }, [isSupplier]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleStatusUpdate = (orderId, newStatus) => {
    setOrders(prev => prev.map(o => String(o._id) === String(orderId) ? { ...o, status: newStatus } : o));
  };

  const filtered = filterStatus ? orders.filter(o => o.status === filterStatus) : orders;

  const counts = orders.reduce((acc, o) => ({ ...acc, [o.status]: (acc[o.status] || 0) + 1 }), {});

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {isSupplier ? 'Pedidos recibidos' : 'Mis pedidos a proveedores'}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {isSupplier ? 'Pedidos B2B de restaurantes que te compran' : 'Historial de tus compras a proveedores'}
          </p>
        </div>
        <button onClick={fetchOrders} className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"><RotateCw className="w-3 h-3" /> Actualizar</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      {/* Filtros por estado */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterStatus('')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${!filterStatus ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
        >
          Todos ({orders.length})
        </button>
        {Object.entries(STATUS_LABELS).map(([value, label]) =>
          counts[value] ? (
            <button
              key={value}
              onClick={() => setFilterStatus(value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterStatus === value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
            >
              {label} ({counts[value]})
            </button>
          ) : null
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <ClipboardList className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="font-medium">{filterStatus ? 'No hay pedidos con ese estado' : 'No hay pedidos aún'}</p>
          {!isSupplier && !filterStatus && (
            <p className="text-sm mt-1">Ve al Marketplace para hacer tu primer pedido a un proveedor</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(order => (
            <OrderCard
              key={order._id}
              order={order}
              isSupplier={isSupplier}
              onStatusUpdate={handleStatusUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
