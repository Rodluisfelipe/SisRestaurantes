import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import { toast } from 'sonner';
import api from '../../services/api';
import { BACKEND_URL } from '../../config';

const TOKEN_KEY = 'partner_token';

/* ── Icons (stroke, light-friendly) ── */
const IC = {
  truck: (c = 'w-6 h-6') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  check: (c = 'w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
  x: (c = 'w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  pin: (c = 'w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  clock: (c = 'w-3.5 h-3.5') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  phone: (c = 'w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.8 19.8 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
  logout: (c = 'w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
  user: (c = 'w-4 h-4') => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0112 0v1"/></svg>,
};

const fmtPrice = (n) => `$${(n || 0).toLocaleString('es-CO')}`;
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';

export default function PartnerPortal() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [partner, setPartner] = useState(null);

  // Forzar modo claro: neutralizar cualquier clase dark heredada
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');
    const prevScheme = root.style.colorScheme;
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
    return () => {
      if (hadDark) root.classList.add('dark');
      root.style.colorScheme = prevScheme;
    };
  }, []);

  if (!token) return <LoginView onLogin={(t, p) => { localStorage.setItem(TOKEN_KEY, t); setToken(t); setPartner(p); }} />;
  return <Dashboard token={token} partner={partner} onLogout={() => { localStorage.removeItem(TOKEN_KEY); setToken(null); setPartner(null); }} />;
}

/* ═══════════ LOGIN ═══════════ */
function LoginView({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/delivery-partners/portal/login', { email, password });
      toast.success('Bienvenido');
      onLogin(res.data.token, res.data.partner);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-7">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/25 mb-4">
            {IC.truck('w-8 h-8')}
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Portal Partners</h1>
          <p className="text-slate-400 text-sm mt-1">Empresas de reparto asociadas</p>
        </div>

        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 space-y-4">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm outline-none focus:border-orange-400 focus:bg-white transition-colors"
              placeholder="empresa@reparto.com"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Contraseña</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm outline-none focus:border-orange-400 focus:bg-white transition-colors"
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-orange-500/20 disabled:opacity-60 transition-opacity">
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="text-center text-slate-300 text-xs mt-6">menuby.tech · Reparto asociado</p>
      </div>
    </div>
  );
}

/* ═══════════ DASHBOARD ═══════════ */
function Dashboard({ token, partner: initialPartner, onLogout }) {
  const [partner, setPartner] = useState(initialPartner);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [view, setView] = useState('orders'); // 'orders' | 'drivers'
  const [drivers, setDrivers] = useState([]);
  const [newDriver, setNewDriver] = useState({ name: '', phone: '' });
  const [pickDriver, setPickDriver] = useState({});
  const socketRef = useRef(null);

  const authGet = useCallback((url) => api.get(url, { headers: { Authorization: `Bearer ${token}` } }), [token]);
  const authPost = useCallback((url, body = {}) => api.post(url, body, { headers: { Authorization: `Bearer ${token}` } }), [token]);
  const authPatch = useCallback((url, body = {}) => api.patch(url, body, { headers: { Authorization: `Bearer ${token}` } }), [token]);

  const loadDrivers = useCallback(async () => {
    try { const res = await authGet('/delivery-partners/portal/drivers'); setDrivers(res.data || []); } catch { /* noop */ }
  }, [authGet]);

  const addDriver = async (e) => {
    e.preventDefault();
    if (!newDriver.name.trim()) return toast.error('Nombre requerido');
    try {
      await authPost('/delivery-partners/portal/drivers', { name: newDriver.name.trim(), phone: newDriver.phone.trim() });
      toast.success('Repartidor agregado');
      setNewDriver({ name: '', phone: '' });
      loadDrivers();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const toggleDriver = async (d) => {
    try { await authPatch(`/delivery-partners/portal/drivers/${d._id}`, { active: !d.active }); loadDrivers(); }
    catch { toast.error('Error'); }
  };

  const load = useCallback(async () => {
    try {
      const res = await authGet('/delivery-partners/portal/orders');
      setOrders(res.data);
    } catch (err) {
      if (err.response?.status === 401) { toast.error('Sesión expirada'); onLogout(); }
    } finally {
      setLoading(false);
    }
  }, [authGet, onLogout]);

  useEffect(() => {
    if (!partner) {
      authGet('/delivery-partners/portal/me').then(r => setPartner(r.data)).catch(() => {});
    }
  }, [partner, authGet]);

  useEffect(() => {
    load();
    loadDrivers();
    const iv = setInterval(load, 20000);
    return () => clearInterval(iv);
  }, [load, loadDrivers]);

  useEffect(() => {
    if (!partner?.id) return;
    const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'], reconnection: true });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('partner:join', { partnerId: partner.id }));
    socket.on('partner:new_offer', () => { toast.info('Nuevo pedido ofrecido'); load(); });
    return () => socket.disconnect();
  }, [partner?.id, load]);

  const doAccept = async (id) => {
    setActingId(id);
    try {
      const driverId = pickDriver[id] || undefined;
      await authPost(`/delivery-partners/portal/orders/${id}/accept`, driverId ? { driverId } : {});
      toast.success('Pedido aceptado');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setActingId(null); }
  };
  const doReject = async (id) => {
    setActingId(id);
    try { await authPost(`/delivery-partners/portal/orders/${id}/reject`); toast('Pedido rechazado'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setActingId(null); }
  };
  const doDeliver = async (id) => {
    setActingId(id);
    try { await authPost(`/delivery-partners/portal/orders/${id}/deliver`); toast.success('Entrega confirmada'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setActingId(null); }
  };

  const offered = orders.filter(o => o.partnerStatus === 'offered');
  const accepted = orders.filter(o => o.partnerStatus === 'accepted');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200 px-4 py-3.5 flex items-center justify-between" style={{ paddingTop: 'max(0.875rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white">{IC.truck('w-5 h-5')}</div>
          <div>
            <h1 className="font-bold text-[15px] leading-tight text-slate-800">{partner?.name || 'Partner'}</h1>
            <p className="text-slate-400 text-[11px]">{accepted.length} activos · {offered.length} ofrecidos</p>
          </div>
        </div>
        <button onClick={onLogout} className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-700 transition-colors">
          {IC.logout()}
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 pb-24">
        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
          <button onClick={() => setView('orders')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${view === 'orders' ? 'bg-orange-500 text-white' : 'text-slate-500 hover:text-slate-800'}`}>
            Pedidos
          </button>
          <button onClick={() => setView('drivers')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${view === 'drivers' ? 'bg-orange-500 text-white' : 'text-slate-500 hover:text-slate-800'}`}>
            Repartidores {drivers.length > 0 && <span className="opacity-70">({drivers.length})</span>}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-slate-200 border-t-orange-500 rounded-full animate-spin" /></div>
        ) : view === 'orders' ? (
          <>
            <SectionTitle>Pedidos ofrecidos {offered.length > 0 && <Badge>{offered.length}</Badge>}</SectionTitle>
            {offered.length === 0 ? (
              <Empty text="Sin pedidos nuevos por ahora" />
            ) : (
              <div className="space-y-3 mb-8">
                <AnimatePresence>
                  {offered.map(o => (
                    <OrderCard key={o._id} order={o} acting={actingId === o._id}
                      actions={
                        <div className="w-full space-y-2">
                          {drivers.filter(d => d.active).length > 0 && (
                            <select
                              value={pickDriver[o._id] || ''}
                              onChange={e => setPickDriver(p => ({ ...p, [o._id]: e.target.value }))}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-orange-400"
                            >
                              <option value="">Repartidor (opcional, lo asigno luego)</option>
                              {drivers.filter(d => d.active).map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                            </select>
                          )}
                          <div className="flex gap-2">
                            <button onClick={() => doReject(o._id)} disabled={actingId === o._id}
                              className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-xl text-sm transition-colors">
                              {IC.x()} Rechazar
                            </button>
                            <button onClick={() => doAccept(o._id)} disabled={actingId === o._id}
                              className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
                              {IC.check()} Aceptar
                            </button>
                          </div>
                        </div>
                      }
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            <SectionTitle>En reparto {accepted.length > 0 && <Badge tone="blue">{accepted.length}</Badge>}</SectionTitle>
            {accepted.length === 0 ? (
              <Empty text="No tienes entregas activas" />
            ) : (
              <div className="space-y-3">
                {accepted.map(o => (
                  <OrderCard key={o._id} order={o} acting={actingId === o._id} accent="blue"
                    actions={
                      <button onClick={() => doDeliver(o._id)} disabled={actingId === o._id}
                        className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-2.5 rounded-xl text-sm">
                        {IC.check()} Marcar entregado
                      </button>
                    }
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          /* ── Repartidores ── */
          <>
            <SectionTitle>Agregar repartidor</SectionTitle>
            <form onSubmit={addDriver} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-6 flex flex-col sm:flex-row gap-2">
              <input value={newDriver.name} onChange={e => setNewDriver(d => ({ ...d, name: e.target.value }))}
                placeholder="Nombre del repartidor" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-orange-400 focus:bg-white" />
              <input value={newDriver.phone} onChange={e => setNewDriver(d => ({ ...d, phone: e.target.value.replace(/\D/g, '') }))}
                placeholder="Teléfono" className="sm:w-40 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-orange-400 focus:bg-white" />
              <button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm whitespace-nowrap">+ Agregar</button>
            </form>

            <SectionTitle>Mis repartidores {drivers.length > 0 && <Badge>{drivers.length}</Badge>}</SectionTitle>
            {drivers.length === 0 ? (
              <Empty text="Aún no tienes repartidores. Agrega el primero arriba." />
            ) : (
              <div className="space-y-2">
                {drivers.map(d => (
                  <div key={d._id} className={`bg-white border border-slate-200 rounded-xl shadow-sm p-3.5 flex items-center justify-between ${!d.active ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">{IC.user()}</div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{d.name}</p>
                        <p className="text-slate-400 text-xs">{d.phone || 'Sin teléfono'} · {d.totalDeliveries || 0} entregas</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {d.status === 'on_delivery' && <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">En ruta</span>}
                      <button onClick={() => toggleDriver(d)} className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${d.active ? 'text-rose-600 bg-rose-50 hover:bg-rose-100' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'}`}>
                        {d.active ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── bits ── */
function SectionTitle({ children }) {
  return <h2 className="text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">{children}</h2>;
}
function Badge({ children, tone = 'orange' }) {
  const c = tone === 'blue' ? 'bg-blue-500' : 'bg-orange-500';
  return <span className={`${c} text-white text-[10px] font-bold px-2 py-0.5 rounded-full`}>{children}</span>;
}
function Empty({ text }) {
  return <div className="bg-white border border-slate-200 rounded-2xl shadow-sm py-8 text-center text-slate-400 text-sm mb-8">{text}</div>;
}

function OrderCard({ order, actions, acting, accent = 'orange' }) {
  const stripe = accent === 'blue' ? 'bg-blue-500' : 'bg-orange-500';
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
      className={`bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden ${acting ? 'opacity-60' : ''}`}
    >
      <div className="flex">
        <div className={`w-1.5 ${stripe}`} />
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-[11px] font-bold text-slate-400">#{order.orderNumber} · {order.business?.businessName || 'Restaurante'}</p>
              <p className="font-bold text-slate-800 text-[15px] mt-0.5">{order.customerName}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-800">{fmtPrice(order.totalAmount)}</p>
              <p className="text-[10px] text-slate-400 flex items-center gap-1 justify-end mt-0.5">{IC.clock('w-3 h-3')}{fmtTime(order.partnerOfferedAt || order.createdAt)}</p>
            </div>
          </div>

          {order.address && (
            <div className="flex items-start gap-1.5 text-slate-500 text-[13px] mb-2">
              <span className="mt-0.5 shrink-0 text-orange-500">{IC.pin('w-3.5 h-3.5')}</span>
              <span>{order.address}</span>
            </div>
          )}

          <div className="flex items-center gap-3 text-[11px] text-slate-400 mb-3">
            <span>{order.items?.length || 0} ítems</span>
            {order.phone && <a href={`tel:${order.phone}`} className="flex items-center gap-1 text-emerald-600">{IC.phone('w-3.5 h-3.5')} Llamar</a>}
            {order.deliveryFee > 0 && <span>Envío {fmtPrice(order.deliveryFee)}</span>}
          </div>

          <div className="flex gap-2">{actions}</div>
        </div>
      </div>
    </motion.div>
  );
}
