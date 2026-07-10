import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTT, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { useBusinessConfig } from '../../Context/BusinessContext';
import api from '../../services/api';
import { BACKEND_URL } from '../../config';
import AssignDeliveryModal from './AssignDeliveryModal';
import DeliverySettingsModal from './DeliverySettingsModal';
import DeliveryTimeline from './DeliveryTimeline';

/* ── SVG Icons ── */
const IC = {
  moto: (cls = 'w-5 h-5') => (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="17.5" r="2.5"/><circle cx="18.5" cy="17.5" r="2.5"/>
      <path d="M15 17.5H8M15 6h2l3 5-4 1.5M8 17.5l-2-6h7l2 6M10 6l-2 6"/>
    </svg>
  ),
  plus: (cls = 'w-4 h-4') => (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
  x: (cls = 'w-4 h-4') => (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  ),
  check: (cls = 'w-3.5 h-3.5') => (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  ),
  clock: (cls = 'w-4 h-4') => (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
    </svg>
  ),
  map: (cls = 'w-4 h-4') => (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  phone: (cls = 'w-3.5 h-3.5') => (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.8 19.8 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
    </svg>
  ),
  bag: (cls = 'w-3.5 h-3.5') => (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  ),
  key: (cls = 'w-3.5 h-3.5') => (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  ),
  power: (cls = 'w-3.5 h-3.5') => (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18.36 6.64a9 9 0 11-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>
    </svg>
  ),
  refresh: (cls = 'w-4 h-4') => (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
    </svg>
  ),
  link: (cls = 'w-3.5 h-3.5') => (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
    </svg>
  ),
  gear: (cls = 'w-4 h-4') => (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  ),
  bolt: (cls = 'w-3.5 h-3.5') => (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M13 2L4.5 12.5c-.4.5-.05 1.5.6 1.5H11l-1 8 8.5-10.5c.4-.5.05-1.5-.6-1.5H12l1-8z"/>
    </svg>
  ),
};

/* ── Helpers ── */
const statusLabel = (online, dbStatus) => {
  if (online === 'on_delivery') return { label: 'En ruta', cls: 'bg-blue-100 text-blue-700' };
  if (online === 'online')      return { label: 'Conectado', cls: 'bg-emerald-100 text-emerald-700' };
  if (dbStatus === 'on_delivery') return { label: 'En ruta', cls: 'bg-blue-100 text-blue-700' };
  return { label: 'Desconectado', cls: 'bg-slate-100 text-slate-500' };
};

const fmtTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
};

const fmtCOP = (n) => `$${(n || 0).toLocaleString('es-CO')}`;

/* ── Component ── */
export default function DomiStats() {
  const { businessConfig } = useBusinessConfig();
  const slug = businessConfig?.slug;

  /* data */
  const [domis, setDomis]               = useState([]);
  const [pending, setPending]           = useState([]);
  const [stats, setStats]               = useState(null);
  const [loading, setLoading]           = useState(true);

  /* daily mode */
  const [dailyCode, setDailyCode]       = useState('');
  const [dailySession, setDailySession] = useState(null);

  /* live socket status per domi */
  const [onlineMap, setOnlineMap]       = useState({}); // { [deliveryPersonId]: 'online'|'on_delivery'|'offline' }

  /* assign modal */
  const [assignOrder, setAssignOrder]   = useState(null);

  /* settings + assignment mode */
  const [showSettings, setShowSettings] = useState(false);
  const [assignMode, setAssignMode]     = useState('manual');
  const [autoAssigning, setAutoAssigning] = useState(null);

  /* timeline */
  const [timelineOrder, setTimelineOrder] = useState(null);

  /* create domi */
  const [showCreate, setShowCreate]     = useState(false);
  const [newName, setNewName]           = useState('');
  const [newCode, setNewCode]           = useState('');
  const [newPhone, setNewPhone]         = useState('');
  const [newPassword, setNewPassword]   = useState('');

  /* toggling active */
  const [togglingId, setTogglingId]     = useState(null);

  const socketRef = useRef(null);
  const pollRef   = useRef(null);

  /* ── fetch ── */
  const fetchDomis = useCallback(async () => {
    if (!slug) return;
    const res = await api.get(`/delivery-admin/restaurants/${slug}/delivery-persons`);
    setDomis(res.data);
  }, [slug]);

  const fetchPending = useCallback(async () => {
    if (!slug) return;
    const res = await api.get(`/delivery-admin/restaurants/${slug}/pending-delivery-orders`);
    setPending(res.data);
  }, [slug]);

  const fetchStats = useCallback(async () => {
    if (!slug) return;
    const res = await api.get(`/delivery-admin/restaurants/${slug}/delivery-stats`);
    setStats(res.data);
  }, [slug]);

  const fetchDailySession = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await api.get(`/delivery-admin/restaurants/${slug}/delivery-session/today`);
      setDailySession(res.data);
      if (res.data?.dailyCode) setDailyCode(res.data.dailyCode);
    } catch { /* 404 = no session today — normal */ }
  }, [slug]);

  const fetchMode = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await api.get(`/delivery-admin/restaurants/${slug}/delivery-settings`);
      setAssignMode(res.data.assignmentMode || 'manual');
    } catch { /* default manual */ }
  }, [slug]);

  const handleAutoAssign = async (order) => {
    setAutoAssigning(order._id);
    try {
      const res = await api.post(`/delivery-admin/restaurants/${slug}/orders/${order._id}/auto-assign`);
      if (res.data.assigned) toast.success(`Asignado a ${res.data.driverName}${res.data.distanceKm ? ` (${res.data.distanceKm.toFixed(1)} km)` : ''}`);
      else if (res.data.offered) toast.success(`Ofrecido a ${res.data.partnerName}`);
      else toast.error('No hay domiciliarios disponibles cerca');
      fetchPending(); fetchDomis(); fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error en asignación automática');
    } finally {
      setAutoAssigning(null);
    }
  };

  /* full refresh */
  const refresh = useCallback(async () => {
    try {
      await Promise.all([fetchDomis(), fetchPending(), fetchStats()]);
    } catch {
      toast.error('Error cargando datos de entrega');
    } finally {
      setLoading(false);
    }
  }, [fetchDomis, fetchPending, fetchStats]);

  /* ── socket ── */
  useEffect(() => {
    if (!slug) return;
    const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken');
    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('joinBusiness', { slug, token });
    });

    socket.on('domi:status', ({ deliveryPersonId, status }) => {
      if (!deliveryPersonId) return;
      const id = String(deliveryPersonId);
      setOnlineMap(prev => ({
        ...prev,
        [id]: status === 'on_delivery' ? 'on_delivery' : status === 'connected' ? 'online' : 'offline',
      }));
    });

    socket.on('delivery:assigned', () => {
      fetchPending();
      fetchDomis();
    });

    socket.on('delivery:confirmed', () => {
      fetchPending();
      fetchDomis();
      fetchStats();
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [slug, fetchPending, fetchDomis, fetchStats]);

  /* ── initial load + polling ── */
  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    refresh();
    fetchDailySession();
    fetchMode();
    pollRef.current = setInterval(refresh, 15_000);
    return () => clearInterval(pollRef.current);
  }, [slug, refresh, fetchDailySession, fetchMode]);

  /* ── handlers ── */
  const handleGenerateDaily = async () => {
    const code = dailyCode || Math.random().toString(36).substr(2, 6).toUpperCase();
    try {
      const res = await api.post(`/delivery-admin/restaurants/${slug}/delivery-session/generate`, { code });
      setDailySession(res.data);
      setDailyCode(code);
      toast.success('Pase diario activado');
    } catch { toast.error('Error generando pase diario'); }
  };

  const handleCreateDomi = async (e) => {
    e.preventDefault();
    if (newCode.length !== 4) return toast.error('El código debe ser de 4 dígitos');
    if (newPassword && newPassword.length < 6) return toast.error('La contraseña debe tener al menos 6 caracteres');
    if (newPassword && !newPhone) return toast.error('Para la contraseña, ingresa también el teléfono');
    try {
      await api.post(`/delivery-admin/restaurants/${slug}/delivery-persons`, {
        name: newName, code: newCode,
        phone: newPhone || undefined,
        password: newPassword || undefined,
      });
      toast.success('Perfil creado');
      setNewName(''); setNewCode(''); setNewPhone(''); setNewPassword(''); setShowCreate(false);
      fetchDomis();
    } catch (err) { toast.error(err.response?.data?.message || 'Error al crear perfil'); }
  };

  const handleToggleActive = async (domi) => {
    setTogglingId(domi._id);
    try {
      await api.patch(`/delivery-admin/restaurants/${slug}/delivery-persons/${domi._id}`, { active: !domi.active });
      fetchDomis();
      toast.success(domi.active ? 'Domi desactivado' : 'Domi activado');
    } catch { toast.error('Error al actualizar'); }
    finally { setTogglingId(null); }
  };

  const handleAssigned = () => {
    setAssignOrder(null);
    fetchPending();
    fetchDomis();
    fetchStats();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  const domiLink = `https://menuby.tech/${slug}/domi`;

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-20">

      {/* ── Header ── */}
      <div className="flex items-center justify-between bg-white border border-slate-100 rounded-2xl p-4 lg:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
            {IC.moto('w-5 h-5')}
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Módulo de Domicilios</h1>
            <p className="text-[12px] text-slate-400 mt-0.5">Gestiona tu equipo y asigna pedidos en tiempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[12px] font-bold transition-colors">
            {IC.gear('w-4 h-4')}
            <span className="hidden sm:inline">
              {assignMode === 'manual' ? 'Manual' : assignMode === 'auto_nearest' ? 'Auto: cercano' : 'Auto: inteligente'}
            </span>
          </button>
          <button onClick={refresh} className="p-2 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors">
            {IC.refresh('w-4 h-4')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Left col (2/3): Pending queue + Stats ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Pending delivery orders */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-slate-800">Cola de pedidos</span>
                {pending.length > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {pending.length}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400">Actualiza cada 15 s</span>
            </div>

            {pending.length === 0 ? (
              <div className="py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3 text-slate-300">
                  {IC.moto('w-6 h-6')}
                </div>
                <p className="text-[13px] font-semibold text-slate-500">Sin pedidos pendientes</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Los pedidos de domicilio aparecerán aquí</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                <AnimatePresence>
                  {pending.map(order => (
                    <motion.div
                      key={order._id}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-4 hover:bg-slate-50/60 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Order number + time */}
                          <div className="flex items-center gap-2 mb-1">
                            <button
                              onClick={() => setTimelineOrder(order)}
                              className="text-[11px] font-bold text-slate-400 hover:text-slate-700 underline decoration-dotted underline-offset-2 transition-colors"
                            >
                              #{order.orderNumber}
                            </button>
                            <span className="text-[10px] text-slate-300">•</span>
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              {IC.clock('w-3 h-3')}{fmtTime(order.createdAt)}
                            </span>
                          </div>
                          {/* Customer */}
                          <p className="text-[13px] font-bold text-slate-800 truncate">{order.customerName}</p>
                          {/* Address */}
                          {order.address && (
                            <p className="text-[11.5px] text-slate-500 mt-0.5 flex items-start gap-1">
                              <span className="mt-0.5 shrink-0">{IC.map('w-3 h-3')}</span>
                              <span className="truncate">{order.address}</span>
                            </p>
                          )}
                          {/* Items summary */}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              {IC.bag('w-3 h-3')}
                              {order.items?.length || 0} {order.items?.length === 1 ? 'ítem' : 'ítems'}
                            </span>
                            <span className="text-[11px] font-bold text-slate-700">{fmtCOP(order.totalAmount)}</span>
                          </div>
                        </div>

                        <div className="shrink-0 flex flex-col gap-1.5">
                          {assignMode !== 'manual' && (
                            <button
                              onClick={() => handleAutoAssign(order)}
                              disabled={autoAssigning === order._id}
                              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-[12px] font-bold px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-60"
                            >
                              {IC.bolt('w-3.5 h-3.5')} {autoAssigning === order._id ? '...' : 'Auto'}
                            </button>
                          )}
                          <button
                            onClick={() => setAssignOrder(order)}
                            className="bg-slate-900 hover:bg-slate-700 text-white text-[12px] font-bold px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5"
                          >
                            {IC.moto('w-3.5 h-3.5')} Asignar
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Activas', value: stats?.activeOrders ?? 0, color: 'text-red-600', bg: 'bg-red-50', icon: IC.moto },
              { label: 'Hoy', value: stats?.todayDeliveries ?? 0, color: 'text-blue-600', bg: 'bg-blue-50', icon: IC.clock },
              { label: 'Total', value: stats?.totalDeliveries ?? 0, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: IC.check },
              { label: 'Prom.', value: `${stats?.avgMinutes ?? 0} min`, color: 'text-violet-600', bg: 'bg-violet-50', icon: IC.clock },
            ].map(({ label, value, color, bg, icon }) => (
              <div key={label} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center mb-2 ${color}`}>
                  {icon('w-4 h-4')}
                </div>
                <p className="text-[11px] font-medium text-slate-400">{label}</p>
                <p className={`text-xl font-black ${color} leading-tight`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          {stats?.chartData?.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl p-4 lg:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <p className="text-[13px] font-bold text-slate-800 mb-4">Entregas — últimos 7 días</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <RechartsTT
                      cursor={{ fill: '#F8FAFC' }}
                      contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
                    />
                    <Bar dataKey="count" name="Entregas" fill="#EF4444" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* ── Right col (1/3): Domis + Daily mode ── */}
        <div className="space-y-4">

          {/* Domi profiles */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
              <span className="text-[13px] font-bold text-slate-800">Domiciliarios</span>
              <button
                onClick={() => setShowCreate(v => !v)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
              >
                {showCreate ? IC.x('w-3.5 h-3.5') : IC.plus('w-3.5 h-3.5')}
              </button>
            </div>

            {/* Create form */}
            <AnimatePresence>
              {showCreate && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <form onSubmit={handleCreateDomi} className="p-4 border-b border-slate-100 space-y-2.5">
                    <input
                      className="w-full text-[13px] px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-slate-400 bg-slate-50 focus:bg-white transition-colors"
                      placeholder="Nombre del domiciliario"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      required
                    />
                    <input
                      type="password"
                      maxLength={4}
                      inputMode="numeric"
                      className="w-full text-[13px] px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-slate-400 bg-slate-50 focus:bg-white transition-colors font-mono tracking-widest text-center"
                      placeholder="PIN de 4 dígitos"
                      value={newCode}
                      onChange={e => setNewCode(e.target.value.replace(/\D/g, ''))}
                      required
                    />

                    {/* Cuenta con contraseña (opcional, recomendado) */}
                    <div className="pt-1 border-t border-dashed border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 mb-2">Cuenta con contraseña · opcional</p>
                      <input
                        type="tel"
                        inputMode="numeric"
                        className="w-full text-[13px] px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-slate-400 bg-slate-50 focus:bg-white transition-colors mb-2"
                        placeholder="Teléfono (ingreso a la app)"
                        value={newPhone}
                        onChange={e => setNewPhone(e.target.value.replace(/\D/g, ''))}
                      />
                      <input
                        type="password"
                        className="w-full text-[13px] px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-slate-400 bg-slate-50 focus:bg-white transition-colors"
                        placeholder="Contraseña (mín. 6 caracteres)"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                      />
                      <p className="text-[10px] text-slate-400 mt-1.5">Con teléfono y contraseña, el domi entra con su cuenta real. Sin ellos, usa solo el PIN.</p>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-slate-900 text-white text-[12px] font-bold py-2.5 rounded-xl hover:bg-slate-700 transition-colors"
                    >
                      Crear perfil
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Domi list */}
            <div className="divide-y divide-slate-50 max-h-[380px] overflow-y-auto">
              {domis.length === 0 ? (
                <p className="text-[12px] text-slate-400 text-center py-8">Sin perfiles registrados</p>
              ) : (
                domis.map(d => {
                  const online = onlineMap[String(d._id)];
                  const { label, cls } = statusLabel(online, d.status);
                  return (
                    <div key={d._id} className={`p-3.5 transition-colors ${!d.active ? 'opacity-50' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-[13px] font-bold text-slate-800 truncate">{d.name}</p>
                            {/* live dot */}
                            {online === 'online' || online === 'on_delivery' ? (
                              <span className="relative flex w-2 h-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className={`relative inline-flex rounded-full w-2 h-2 ${online === 'on_delivery' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                              </span>
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-slate-200" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
                            <span className="text-[10px] text-slate-400">{d.totalDeliveries || 0} entregas</span>
                            {d.hasAccount && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 inline-flex items-center gap-1">
                                {IC.key('w-2.5 h-2.5')} cuenta
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleToggleActive(d)}
                          disabled={togglingId === d._id}
                          title={d.active ? 'Desactivar' : 'Activar'}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            d.active
                              ? 'bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                          } ${togglingId === d._id ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                          {IC.power('w-3.5 h-3.5')}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Daily mode */}
          <div className="bg-slate-900 rounded-2xl p-4 text-white">
            <p className="text-[12px] font-bold text-slate-300 uppercase tracking-widest mb-1">Modo diario</p>
            <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
              Para un solo domi hoy: activa un pase temporal y comparte el código.
            </p>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                maxLength={6}
                value={dailyCode}
                onChange={e => setDailyCode(e.target.value.toUpperCase())}
                placeholder="DOMI24"
                disabled={!!dailySession}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-[13px] font-bold font-mono tracking-widest text-center outline-none focus:border-slate-500 disabled:opacity-50 transition-colors"
              />
              {!dailySession ? (
                <button onClick={handleGenerateDaily} className="bg-red-500 hover:bg-red-600 text-white text-[12px] font-bold px-3.5 py-2.5 rounded-xl transition-colors whitespace-nowrap">
                  Activar
                </button>
              ) : (
                <div className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold px-3 py-2.5 rounded-xl flex items-center gap-1.5 whitespace-nowrap">
                  {IC.check('w-3 h-3')} Activo
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 bg-slate-800/60 rounded-xl px-3 py-2.5">
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                {IC.link('w-3 h-3')} Link de acceso
              </span>
              <button
                onClick={() => { navigator.clipboard.writeText(domiLink); toast.success('Link copiado'); }}
                className="text-[10px] font-bold text-slate-300 hover:text-white transition-colors truncate"
              >
                {domiLink}
              </button>
            </div>
            {dailySession && <p className="text-[10px] text-slate-500 mt-2 text-center">Expira a medianoche</p>}
          </div>
        </div>
      </div>

      {/* Assign modal */}
      <AssignDeliveryModal
        isOpen={!!assignOrder}
        order={assignOrder}
        onClose={() => setAssignOrder(null)}
        onAssigned={handleAssigned}
      />

      {/* Settings modal */}
      <DeliverySettingsModal
        slug={slug}
        isOpen={showSettings}
        onClose={(saved) => { setShowSettings(false); if (saved) fetchMode(); }}
      />

      {/* Delivery timeline */}
      <DeliveryTimeline
        slug={slug}
        orderId={timelineOrder?._id}
        orderNumber={timelineOrder?.orderNumber}
        isOpen={!!timelineOrder}
        onClose={() => setTimelineOrder(null)}
      />
    </div>
  );
}
