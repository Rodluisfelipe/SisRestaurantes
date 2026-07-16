import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTT, ResponsiveContainer } from 'recharts';
import {
  FaChartBar, FaClipboardList, FaCheckCircle, FaMotorcycle, FaStore,
  FaSignOutAlt, FaTruck, FaMapMarkerAlt, FaPhoneAlt, FaClock, FaStar,
  FaLock, FaBars, FaTimes, FaUserPlus, FaMoneyBillWave, FaChevronRight
} from 'react-icons/fa';
import api from '../../services/api';
import { BACKEND_URL } from '../../config';

const TOKEN_KEY = 'partner_token';

const fmtPrice = (n) => `$${(n || 0).toLocaleString('es-CO')}`;
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'P';

/* ═══════════════════════════ ROOT ═══════════════════════════ */
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
  return <PortalApp token={token} initialPartner={partner} onLogout={() => { localStorage.removeItem(TOKEN_KEY); setToken(null); setPartner(null); }} />;
}

/* ═══════════════════════════ LOGIN ═══════════════════════════ */
function LoginView({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/delivery-partners/portal/login', { email, password });
      toast.success(`Bienvenido, ${res.data.partner?.name || ''}`);
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
          <div className="relative mb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-md">
              <FaTruck className="text-white text-xl" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-slate-50" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Portal de Reparto</h1>
          <p className="text-slate-400 text-[13px] mt-0.5">Empresas asociadas · MenuBy</p>
        </div>

        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
              className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-slate-800 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
              placeholder="empresa@reparto.com"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Contraseña</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
              className="w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-slate-800 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm shadow-sm disabled:opacity-60 transition-colors">
            {loading ? 'Ingresando…' : 'Ingresar al portal'}
          </button>
        </form>
        <p className="text-center text-slate-300 text-xs mt-6">menuby.tech</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════ APP SHELL ═══════════════════════════ */
const NAV_SECTIONS = [
  {
    id: 'operations', label: 'Operaciones',
    items: [
      { id: 'dashboard', label: 'Dashboard', Icon: FaChartBar },
      { id: 'orders', label: 'Pedidos', Icon: FaClipboardList, badge: 'offered' },
      { id: 'history', label: 'Historial', Icon: FaCheckCircle },
    ]
  },
  {
    id: 'team', label: 'Equipo',
    items: [{ id: 'drivers', label: 'Repartidores', Icon: FaMotorcycle }]
  },
  {
    id: 'settings', label: 'Configuración',
    items: [{ id: 'company', label: 'Mi empresa', Icon: FaStore }]
  },
];

function PortalApp({ token, initialPartner, onLogout }) {
  const [partner, setPartner] = useState(initialPartner);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);

  const authCfg = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const handle401 = useCallback((err) => {
    if (err?.response?.status === 401) { toast.error('Sesión expirada'); onLogout(); return true; }
    return false;
  }, [onLogout]);

  const loadOrders = useCallback(async () => {
    try { const r = await api.get('/delivery-partners/portal/orders', authCfg); setOrders(r.data || []); }
    catch (err) { handle401(err); }
    finally { setLoading(false); }
  }, [authCfg, handle401]);

  const loadStats = useCallback(async () => {
    try { const r = await api.get('/delivery-partners/portal/stats', authCfg); setStats(r.data); }
    catch (err) { handle401(err); }
  }, [authCfg, handle401]);

  const loadDrivers = useCallback(async () => {
    try { const r = await api.get('/delivery-partners/portal/drivers', authCfg); setDrivers(r.data || []); }
    catch (err) { handle401(err); }
  }, [authCfg, handle401]);

  const refreshAll = useCallback(() => { loadOrders(); loadStats(); loadDrivers(); }, [loadOrders, loadStats, loadDrivers]);

  useEffect(() => {
    if (!partner) {
      api.get('/delivery-partners/portal/me', authCfg).then(r => setPartner(r.data)).catch(err => handle401(err));
    }
  }, [partner, authCfg, handle401]);

  useEffect(() => {
    refreshAll();
    const iv = setInterval(refreshAll, 25000);
    return () => clearInterval(iv);
  }, [refreshAll]);

  // Realtime: join partner room, refresh on new offers
  useEffect(() => {
    const pid = partner?.id || partner?._id;
    if (!pid) return;
    const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'], reconnection: true });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('partner:join', { partnerId: pid }));
    socket.on('partner:new_offer', () => {
      toast.info('Nuevo pedido ofrecido', { description: 'Tienes un pedido esperando respuesta' });
      loadOrders(); loadStats();
    });
    return () => socket.disconnect();
  }, [partner?.id, partner?._id, loadOrders, loadStats]);

  const offered = orders.filter(o => o.partnerStatus === 'offered');
  const accepted = orders.filter(o => o.partnerStatus === 'accepted');

  const view = (() => {
    switch (activeTab) {
      case 'dashboard': return <DashboardView stats={stats} offered={offered} accepted={accepted} onGoOrders={() => setActiveTab('orders')} />;
      case 'orders': return <OrdersView offered={offered} accepted={accepted} drivers={drivers} loading={loading} authCfg={authCfg} onChanged={refreshAll} handle401={handle401} />;
      case 'history': return <HistoryView authCfg={authCfg} handle401={handle401} />;
      case 'drivers': return <DriversView drivers={drivers} authCfg={authCfg} onChanged={loadDrivers} handle401={handle401} />;
      case 'company': return <CompanyView partner={partner} authCfg={authCfg} handle401={handle401} />;
      default: return null;
    }
  })();

  const sidebar = (
    <SidebarContent
      partner={partner}
      activeTab={activeTab}
      offeredCount={offered.length}
      onNavigate={(id) => { setActiveTab(id); setDrawerOpen(false); }}
      onLogout={onLogout}
    />
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex">
      {/* Sidebar desktop */}
      <div className="hidden lg:block w-64 bg-white min-h-screen border-r border-slate-200 sticky top-0 h-screen shadow-sm">
        {sidebar}
      </div>

      {/* Drawer móvil */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden"
            />
            <motion.div
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed left-0 top-0 bottom-0 w-[270px] bg-white z-50 shadow-xl lg:hidden"
            >
              {sidebar}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Contenido */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar móvil */}
        <div className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 flex items-center justify-between"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-2.5">
            <button onClick={() => setDrawerOpen(true)} className="p-2 -ml-1 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
              <FaBars />
            </button>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
              <FaTruck className="text-white text-xs" />
            </div>
            <span className="font-bold text-sm text-slate-800 truncate max-w-[150px]">{partner?.name || 'Partner'}</span>
          </div>
          {offered.length > 0 && (
            <button onClick={() => setActiveTab('orders')}
              className="flex items-center gap-1.5 bg-red-50 border border-red-200/80 text-red-600 text-xs font-bold px-2.5 py-1.5 rounded-lg">
              <FaClipboardList className="text-[10px]" /> {offered.length}
            </button>
          )}
        </div>

        <main className="flex-1 px-4 lg:px-8 py-5 lg:py-7 max-w-6xl w-full mx-auto">
          {view}
        </main>
      </div>
    </div>
  );
}

/* ═══════════════════════════ SIDEBAR ═══════════════════════════ */
function SidebarContent({ partner, activeTab, offeredCount, onNavigate, onLogout }) {
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-md">
              {partner?.logo
                ? <img src={partner.logo} alt={partner?.name || 'Logo'} className="w-10 h-10 rounded-lg object-cover" />
                : <FaTruck className="text-white text-lg" />}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-slate-800 truncate leading-tight">{partner?.name || 'Mi empresa'}</h1>
            <p className="text-[11px] text-slate-400 font-medium">Portal de reparto</p>
          </div>
        </div>
      </div>

      {/* Acceso rápido: pedidos ofrecidos */}
      <div className="px-4 pb-3">
        <button
          onClick={() => onNavigate('orders')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 ${
            offeredCount > 0
              ? 'bg-red-50 border-red-200/80 hover:bg-red-100'
              : activeTab === 'orders'
                ? 'bg-blue-50 border-blue-200/80'
                : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100'
          }`}
        >
          <FaClipboardList className={`text-sm shrink-0 ${offeredCount > 0 ? 'text-red-500' : 'text-slate-400'}`} />
          <span className="text-[11px] font-semibold text-slate-700 flex-1 text-left">Pedidos ofrecidos</span>
          {offeredCount > 0 ? (
            <motion.span key={offeredCount} initial={{ scale: 0.5 }} animate={{ scale: 1 }}
              className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-red-500 text-white">
              {offeredCount}
            </motion.span>
          ) : (
            <span className="text-[10px] font-medium text-slate-400">0</span>
          )}
        </button>
      </div>

      <div className="mx-4 border-t border-slate-100" />

      {/* Navegación */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {NAV_SECTIONS.map(section => (
          <div key={section.id} className="mb-2">
            <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{section.label}</p>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const isActive = activeTab === item.id;
                const badge = item.badge === 'offered' ? offeredCount : 0;
                return (
                  <motion.button
                    key={item.id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center justify-between pl-4 pr-3 py-2 rounded-lg text-left transition-all duration-150 relative ${
                      isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {isActive && (
                      <motion.div layoutId="partnerActiveIndicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-500 rounded-full"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }} />
                    )}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <item.Icon className={`text-sm shrink-0 ${isActive ? 'text-blue-500' : 'text-slate-400'}`} />
                      <span className={`text-[13px] truncate ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
                    </div>
                    {badge > 0 && (
                      <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-red-500 text-white shadow-sm">
                        {badge}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 pt-2 border-t border-slate-100">
        <motion.button
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200 group"
        >
          <FaSignOutAlt className="text-sm group-hover:translate-x-0.5 transition-transform" />
          <span className="text-[13px] font-medium">Cerrar Sesión</span>
        </motion.button>
      </div>
    </div>
  );
}

/* ═══════════════════════════ PAGE BITS ═══════════════════════════ */
function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div>
        <h2 className="text-lg lg:text-xl font-bold text-slate-800 leading-tight">{title}</h2>
        {subtitle && <p className="text-[13px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function Card({ children, className = '' }) {
  return <div className={`bg-white border border-slate-100 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${className}`}>{children}</div>;
}

function EmptyState({ Icon = FaClipboardList, title, text }) {
  return (
    <Card className="py-10 px-6 text-center">
      <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-300 flex items-center justify-center mx-auto mb-3">
        <Icon className="text-lg" />
      </div>
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {text && <p className="text-[13px] text-slate-400 mt-1">{text}</p>}
    </Card>
  );
}

function SectionLabel({ children }) {
  return <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">{children}</h3>;
}

function CountBadge({ value, tone = 'red' }) {
  const map = { red: 'bg-red-500', blue: 'bg-blue-500', slate: 'bg-slate-400' };
  return <span className={`${map[tone]} text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1.5 rounded-full inline-flex items-center justify-center`}>{value}</span>;
}

/* ═══════════════════════════ DASHBOARD ═══════════════════════════ */
function DashboardView({ stats, offered, accepted, onGoOrders }) {
  const tiles = [
    { label: 'Ofrecidos', value: stats?.offered ?? offered.length, Icon: FaClipboardList, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'En reparto', value: stats?.active ?? accepted.length, Icon: FaMotorcycle, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Hoy', value: stats?.todayDeliveries ?? 0, Icon: FaCheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total', value: stats?.totalDeliveries ?? 0, Icon: FaChartBar, color: 'text-violet-600', bg: 'bg-violet-50' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        subtitle="Resumen de tu operación de reparto"
        action={offered.length > 0 && (
          <button onClick={onGoOrders}
            className="flex items-center gap-2 bg-red-50 border border-red-200/80 hover:bg-red-100 text-red-600 text-xs font-bold px-3 py-2 rounded-lg transition-colors">
            {offered.length} pedido{offered.length > 1 ? 's' : ''} esperando <FaChevronRight className="text-[9px]" />
          </button>
        )}
      />

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map(({ label, value, Icon, color, bg }) => (
          <Card key={label} className="p-4">
            <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center mb-2 ${color}`}>
              <Icon className="text-sm" />
            </div>
            <p className="text-[11px] font-medium text-slate-400">{label}</p>
            <p className={`text-xl font-black ${color} leading-tight`}>{value}</p>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Chart */}
        <Card className="p-4 lg:p-5 lg:col-span-2">
          <p className="text-[13px] font-bold text-slate-800 mb-4">Entregas — últimos 7 días</p>
          <div className="h-52">
            {stats?.chartData?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData} barSize={26}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                  <RechartsTT
                    cursor={{ fill: '#F8FAFC' }}
                    contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', fontSize: 12 }}
                    formatter={(v) => [v, 'Entregas']}
                  />
                  <Bar dataKey="count" name="Entregas" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-300 text-sm">Sin datos aún</div>
            )}
          </div>
        </Card>

        {/* Equipo resumen */}
        <Card className="p-4 lg:p-5">
          <p className="text-[13px] font-bold text-slate-800 mb-4">Mi equipo</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><FaMotorcycle className="text-sm" /></div>
                <span className="text-[13px] text-slate-600 font-medium">En ruta ahora</span>
              </div>
              <span className="text-sm font-bold text-slate-800">{stats?.driversOnRoute ?? 0}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><FaCheckCircle className="text-sm" /></div>
                <span className="text-[13px] text-slate-600 font-medium">Repartidores activos</span>
              </div>
              <span className="text-sm font-bold text-slate-800">{stats?.driversTotal ?? 0}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center"><FaStar className="text-sm" /></div>
                <span className="text-[13px] text-slate-600 font-medium">Calificación</span>
              </div>
              <span className="text-sm font-bold text-slate-800">{(stats?.rating ?? 5).toFixed(1)}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════ PEDIDOS ═══════════════════════════ */
function OfferCountdown({ expiresAt }) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(expiresAt) - Date.now()));
  useEffect(() => {
    const iv = setInterval(() => setLeft(Math.max(0, new Date(expiresAt) - Date.now())), 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);
  if (!expiresAt) return null;
  const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
  const urgent = left < 2 * 60000;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
      urgent ? 'bg-red-50 text-red-600 border border-red-200/80' : 'bg-amber-50 text-amber-600 border border-amber-200/80'
    }`}>
      <FaClock className="text-[8px]" /> {m}:{String(s).padStart(2, '0')}
    </span>
  );
}

function PaymentChip({ order }) {
  const pm = (order.paymentMethod || '').toLowerCase();
  const total = order.finalAmount || order.totalAmount;
  if (['cash', 'efectivo', 'contraentrega'].includes(pm)) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full">
        <FaMoneyBillWave className="text-[9px]" /> Cobrar {fmtPrice(total)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
      <FaCheckCircle className="text-[9px]" /> Pago registrado
    </span>
  );
}

function OrderRow({ order, stripe = 'bg-amber-400', children, footer }) {
  return (
    <motion.div
      layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}
      className="bg-white border border-slate-100 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden"
    >
      <div className="flex">
        <div className={`w-1 ${stripe}`} />
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[11px] font-bold text-slate-400">#{order.orderNumber}</p>
                <span className="text-[11px] text-slate-300">·</span>
                <p className="text-[11px] font-semibold text-slate-500 truncate">{order.business?.businessName || 'Restaurante'}</p>
              </div>
              <p className="font-bold text-slate-800 text-[15px] mt-0.5 truncate">{order.customerName}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-slate-800">{fmtPrice(order.finalAmount || order.totalAmount)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{fmtTime(order.partnerOfferedAt || order.createdAt)}</p>
            </div>
          </div>

          {order.address && (
            <div className="flex items-start gap-1.5 text-slate-500 text-[13px] mb-2">
              <FaMapMarkerAlt className="mt-0.5 shrink-0 text-slate-300 text-xs" />
              <span className="min-w-0">{order.address}</span>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap mb-3">
            <PaymentChip order={order} />
            <span className="text-[11px] text-slate-400">{order.items?.length || 0} producto{(order.items?.length || 0) !== 1 ? 's' : ''}</span>
            {order.deliveryFee > 0 && <span className="text-[11px] text-slate-400">· Envío {fmtPrice(order.deliveryFee)}</span>}
            {order.phone && (
              <a href={`tel:${order.phone}`} className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700">
                <FaPhoneAlt className="text-[9px]" /> Llamar cliente
              </a>
            )}
            {children}
          </div>

          {footer}
        </div>
      </div>
    </motion.div>
  );
}

function OrdersView({ offered, accepted, drivers, loading, authCfg, onChanged, handle401 }) {
  const [actingId, setActingId] = useState(null);
  const [pickDriver, setPickDriver] = useState({});
  const activeDrivers = drivers.filter(d => d.active);

  const act = async (id, fn, okMsg) => {
    setActingId(id);
    try { await fn(); if (okMsg) toast.success(okMsg); onChanged(); }
    catch (err) { if (!handle401(err)) toast.error(err.response?.data?.message || 'Error'); }
    finally { setActingId(null); }
  };

  const doAccept = (id) => act(id, () => {
    const driverId = pickDriver[id] || undefined;
    return api.post(`/delivery-partners/portal/orders/${id}/accept`, driverId ? { driverId } : {}, authCfg);
  }, 'Pedido aceptado');

  const doReject = (id) => act(id, () => api.post(`/delivery-partners/portal/orders/${id}/reject`, {}, authCfg), 'Pedido rechazado');
  const doDeliver = (id) => act(id, () => api.post(`/delivery-partners/portal/orders/${id}/deliver`, {}, authCfg), 'Entrega confirmada');
  const doAssignDriver = (id, driverId) => act(id, () => api.post(`/delivery-partners/portal/orders/${id}/assign-driver`, { driverId }, authCfg), 'Repartidor asignado');

  const driverName = (id) => drivers.find(d => String(d._id) === String(id))?.name;

  return (
    <div>
      <PageHeader title="Pedidos" subtitle="Acepta, gestiona y entrega los pedidos que los restaurantes te ofrecen" />

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" /></div>
      ) : (
        <>
          <SectionLabel>Ofrecidos {offered.length > 0 && <CountBadge value={offered.length} />}</SectionLabel>
          {offered.length === 0 ? (
            <div className="mb-6"><EmptyState title="Sin pedidos nuevos" text="Cuando un restaurante te ofrezca un pedido aparecerá aquí al instante." /></div>
          ) : (
            <div className="space-y-3 mb-7">
              <AnimatePresence>
                {offered.map(o => (
                  <OrderRow key={o._id} order={o} stripe="bg-amber-400"
                    footer={
                      <div className="space-y-2">
                        {activeDrivers.length > 0 && (
                          <select
                            value={pickDriver[o._id] || ''}
                            onChange={e => setPickDriver(p => ({ ...p, [o._id]: e.target.value }))}
                            className="w-full sm:w-72 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                          >
                            <option value="">Asignar repartidor (opcional)</option>
                            {activeDrivers.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                          </select>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => doReject(o._id)} disabled={actingId === o._id}
                            className="flex-1 sm:flex-none sm:px-5 flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold py-2 rounded-lg text-[13px] transition-colors disabled:opacity-50">
                            <FaTimes className="text-[10px]" /> Rechazar
                          </button>
                          <button onClick={() => doAccept(o._id)} disabled={actingId === o._id}
                            className="flex-1 sm:flex-none sm:px-6 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg text-[13px] shadow-sm transition-colors disabled:opacity-50">
                            <FaCheckCircle className="text-[11px]" /> Aceptar pedido
                          </button>
                        </div>
                      </div>
                    }
                  >
                    {o.partnerOfferExpiresAt && <OfferCountdown expiresAt={o.partnerOfferExpiresAt} />}
                  </OrderRow>
                ))}
              </AnimatePresence>
            </div>
          )}

          <SectionLabel>En reparto {accepted.length > 0 && <CountBadge value={accepted.length} tone="blue" />}</SectionLabel>
          {accepted.length === 0 ? (
            <EmptyState Icon={FaMotorcycle} title="No tienes entregas activas" text="Los pedidos aceptados aparecerán aquí hasta que los marques entregados." />
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {accepted.map(o => (
                  <OrderRow key={o._id} order={o} stripe="bg-blue-500"
                    footer={
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          value={o.deliveryPersonId || ''}
                          onChange={e => e.target.value && doAssignDriver(o._id, e.target.value)}
                          disabled={actingId === o._id}
                          className="sm:w-64 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        >
                          <option value="">{o.deliveryPersonId ? 'Cambiar repartidor…' : 'Asignar repartidor…'}</option>
                          {activeDrivers.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                        </select>
                        <button onClick={() => doDeliver(o._id)} disabled={actingId === o._id}
                          className="flex-1 sm:flex-none sm:px-6 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-lg text-[13px] shadow-sm transition-colors disabled:opacity-50">
                          <FaCheckCircle className="text-[11px]" /> Marcar entregado
                        </button>
                      </div>
                    }
                  >
                    {o.deliveryPersonId && driverName(o.deliveryPersonId) && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-full">
                        <FaMotorcycle className="text-[9px]" /> {driverName(o.deliveryPersonId)}
                      </span>
                    )}
                  </OrderRow>
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════ HISTORIAL ═══════════════════════════ */
function HistoryView({ authCfg, handle401 }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    api.get('/delivery-partners/portal/history?limit=100', authCfg)
      .then(r => setRows(r.data || []))
      .catch(err => { if (!handle401(err)) setRows([]); });
  }, [authCfg, handle401]);

  return (
    <div>
      <PageHeader title="Historial" subtitle="Entregas completadas por tu empresa" />

      {rows === null ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" /></div>
      ) : rows.length === 0 ? (
        <EmptyState Icon={FaCheckCircle} title="Aún no hay entregas" text="Cuando completes tu primera entrega aparecerá aquí." />
      ) : (
        <>
          {/* Tabla desktop */}
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    {['Pedido', 'Restaurante', 'Cliente', 'Repartidor', 'Total', 'Entregado'].map(h => (
                      <th key={h} className="text-left font-semibold text-slate-400 text-[11px] uppercase tracking-wider px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(o => (
                    <tr key={o._id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-700">#{o.orderNumber}</td>
                      <td className="px-4 py-3 text-slate-600">{o.business?.businessName || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{o.customerName || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{o.driverName || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{fmtPrice(o.finalAmount || o.totalAmount)}</td>
                      <td className="px-4 py-3 text-slate-400">{fmtDate(o.deliveredAt || o.completedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Cards móvil */}
          <div className="md:hidden space-y-2">
            {rows.map(o => (
              <Card key={o._id} className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-400">#{o.orderNumber} · {o.business?.businessName || '—'}</p>
                    <p className="font-bold text-slate-800 text-sm mt-0.5 truncate">{o.customerName}</p>
                    {o.driverName && <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1"><FaMotorcycle className="text-[9px]" /> {o.driverName}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-slate-800 text-sm">{fmtPrice(o.finalAmount || o.totalAmount)}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(o.deliveredAt || o.completedAt)}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════ REPARTIDORES ═══════════════════════════ */
function DriversView({ drivers, authCfg, onChanged, handle401 }) {
  const [form, setForm] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);

  const addDriver = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Nombre requerido');
    setSaving(true);
    try {
      await api.post('/delivery-partners/portal/drivers', { name: form.name.trim(), phone: form.phone.trim() }, authCfg);
      toast.success('Repartidor agregado');
      setForm({ name: '', phone: '' });
      onChanged();
    } catch (err) { if (!handle401(err)) toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const toggleDriver = async (d) => {
    try { await api.patch(`/delivery-partners/portal/drivers/${d._id}`, { active: !d.active }, authCfg); onChanged(); }
    catch (err) { if (!handle401(err)) toast.error('Error'); }
  };

  return (
    <div>
      <PageHeader title="Repartidores" subtitle="Tu flota de mensajeros para entregar los pedidos aceptados" />

      <Card className="p-4 mb-5">
        <SectionLabel><FaUserPlus className="text-slate-300" /> Agregar repartidor</SectionLabel>
        <form onSubmit={addDriver} className="flex flex-col sm:flex-row gap-2">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Nombre completo"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all" />
          <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))}
            placeholder="Teléfono" inputMode="numeric"
            className="sm:w-44 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all" />
          <button type="submit" disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm whitespace-nowrap shadow-sm transition-colors disabled:opacity-50">
            {saving ? 'Guardando…' : 'Agregar'}
          </button>
        </form>
      </Card>

      <SectionLabel>Mi equipo {drivers.length > 0 && <CountBadge value={drivers.length} tone="slate" />}</SectionLabel>
      {drivers.length === 0 ? (
        <EmptyState Icon={FaMotorcycle} title="Aún no tienes repartidores" text="Agrega el primero con el formulario de arriba." />
      ) : (
        <Card className="divide-y divide-slate-50 overflow-hidden">
          {drivers.map(d => (
            <div key={d._id} className={`flex items-center justify-between gap-3 px-4 py-3 ${!d.active ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[11px] font-bold shrink-0">
                  {initials(d.name)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{d.name}</p>
                  <p className="text-slate-400 text-xs">{d.phone || 'Sin teléfono'} · {d.totalDeliveries || 0} entregas</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {d.status === 'on_delivery' && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-full">
                    <FaMotorcycle className="text-[9px]" /> En ruta
                  </span>
                )}
                <button onClick={() => toggleDriver(d)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                    d.active
                      ? 'text-slate-500 bg-white border-slate-200 hover:bg-slate-50'
                      : 'text-emerald-700 bg-emerald-50 border-emerald-200/80 hover:bg-emerald-100'
                  }`}>
                  {d.active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════ MI EMPRESA ═══════════════════════════ */
function CompanyView({ partner, authCfg, handle401 }) {
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const changePassword = async (e) => {
    e.preventDefault();
    if (pwd.next.length < 6) return toast.error('La nueva contraseña debe tener al menos 6 caracteres');
    if (pwd.next !== pwd.confirm) return toast.error('Las contraseñas no coinciden');
    setSaving(true);
    try {
      await api.post('/delivery-partners/portal/change-password', { currentPassword: pwd.current, newPassword: pwd.next }, authCfg);
      toast.success('Contraseña actualizada');
      setPwd({ current: '', next: '', confirm: '' });
    } catch (err) { if (!handle401(err)) toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const input = "w-full mt-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-slate-800 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all";

  return (
    <div>
      <PageHeader title="Mi empresa" subtitle="Información de tu cuenta en MenuBy" />

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <Card className="p-5">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-md shrink-0">
              {partner?.logo
                ? <img src={partner.logo} alt="" className="w-12 h-12 rounded-lg object-cover" />
                : <span className="text-white font-bold text-lg">{initials(partner?.name)}</span>}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-800 truncate">{partner?.name}</h3>
              <p className="text-[13px] text-slate-400 truncate">{partner?.email}</p>
            </div>
          </div>

          <div className="space-y-0 divide-y divide-slate-50">
            <InfoRow label="Teléfono" value={partner?.phone || '—'} />
            <InfoRow label="Entregas totales" value={partner?.totalDeliveries ?? 0} />
            <InfoRow label="Calificación" value={
              <span className="inline-flex items-center gap-1"><FaStar className="text-amber-400 text-xs" /> {(partner?.rating ?? 5).toFixed(1)}</span>
            } />
            {partner?.commissionValue > 0 && (
              <InfoRow label="Comisión acordada" value={partner.commissionType === 'percent' ? `${partner.commissionValue}%` : fmtPrice(partner.commissionValue)} />
            )}
            {partner?.coverageAreas?.length > 0 && (
              <InfoRow label="Zonas de cobertura" value={partner.coverageAreas.join(', ')} />
            )}
            {partner?.createdAt && <InfoRow label="Miembro desde" value={new Date(partner.createdAt).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })} />}
          </div>
        </Card>

        <Card className="p-5">
          <SectionLabel><FaLock className="text-slate-300" /> Cambiar contraseña</SectionLabel>
          <form onSubmit={changePassword} className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Contraseña actual</label>
              <input type="password" value={pwd.current} onChange={e => setPwd(p => ({ ...p, current: e.target.value }))} required autoComplete="current-password" className={input} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Nueva contraseña</label>
              <input type="password" value={pwd.next} onChange={e => setPwd(p => ({ ...p, next: e.target.value }))} required minLength={6} autoComplete="new-password" className={input} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Confirmar nueva contraseña</label>
              <input type="password" value={pwd.confirm} onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))} required minLength={6} autoComplete="new-password" className={input} />
            </div>
            <button type="submit" disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm shadow-sm transition-colors disabled:opacity-50">
              {saving ? 'Guardando…' : 'Actualizar contraseña'}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[13px] text-slate-400 font-medium">{label}</span>
      <span className="text-[13px] font-semibold text-slate-700 text-right">{value}</span>
    </div>
  );
}
