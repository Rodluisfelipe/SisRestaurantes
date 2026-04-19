import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useInView, useScroll, useTransform } from 'framer-motion';
import { Smartphone, Monitor, ChevronDown, Check, X, ArrowRight, Star, Clock, BarChart3, Bell, QrCode, UtensilsCrossed, MapPin, Gift, ShieldCheck, Zap, Users, CreditCard, Palette, CalendarCheck, MessageSquare, Printer } from 'lucide-react';
import useLandingSEO from '../../hooks/useLandingSEO';

/* === DESIGN SYSTEM === */
const C = {
  accent: '#E8002D',
  bg: '#FAFAFA',
  surface: '#F5F5F5',
  card: '#FFFFFF',
  dark: '#0A0A0A',
  text: '#0A0A0A',
  textSecondary: '#3A3A3A',
  muted: '#6B7280',
  border: '#E2E2E2',
  borderLight: '#F0F0F0',
  elevated: '#ECECEC',
  green: '#059669',
  greenSoft: '#D1FAE5',
};

const fmtCOP = (n) => {
  if (n == null) return '';
  return '$' + n.toLocaleString('es-CO');
};

/* === ANIMATION HELPERS === */
const FadeInWhenVisible = ({ children, delay = 0, y = 30, className = '' }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const StaggerContainer = ({ children, className = '', stagger = 0.08 }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={{ visible: { transition: { staggerChildren: stagger } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const staggerChild = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const MagneticButton = ({ children }) => {
  const ref = useRef(null);
  const handleMouse = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * 0.15;
    const y = (e.clientY - rect.top - rect.height / 2) * 0.15;
    el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  };
  const reset = () => { if (ref.current) ref.current.style.transform = 'translate(0,0)'; };
  return <div ref={ref} onMouseMove={handleMouse} onMouseLeave={reset} className="inline-block transition-transform duration-200">{children}</div>;
};

/* === SECTION WRAPPER === */
const Section = ({ children, id, className = '', style = {} }) => (
  <section id={id} className={`px-5 sm:px-6 lg:px-8 ${className}`} style={style}>
    <div className="max-w-6xl mx-auto">{children}</div>
  </section>
);

/* === COUNTER HOOK === */
function useCounter(end, duration = 2000, active = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    const startTime = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.floor(eased * end));
      if (progress >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [end, duration, active]);
  return val;
}

function CounterValue({ end, active }) {
  const val = useCounter(end, 2000, active);
  return <>{val}</>;
}

/* ===============================================================
   REAL PHONE MOCKUP — Loads iframe only on click to avoid slowing page load
   =============================================================== */
function RealMenuMockup() {
  const [activated, setActivated] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '200px' });

  return (
    <div className="relative select-none" ref={ref}>
      <motion.div
        className="w-[290px] sm:w-[310px] mx-auto"
        animate={{ rotateY: [0, 1, -1, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ perspective: '1200px', transformStyle: 'preserve-3d' }}
      >
        <div className="rounded-[2.8rem] p-[10px]" style={{ background: 'linear-gradient(145deg, #2a2a2a, #1a1a1a, #0a0a0a)', boxShadow: '0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)' }}>
          <div className="rounded-[2.2rem] overflow-hidden relative" style={{ background: '#FAFAFA', height: '580px' }}>
            {!activated ? (
              <button
                onClick={() => setActivated(true)}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 cursor-pointer group w-full"
                style={{ background: '#FAFAFA' }}
              >
                {/* Static menu preview */}
                <div className="w-full px-4 space-y-3">
                  {/* Header bar */}
                  <div className="h-14 rounded-xl overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #DC2626, #E8002D)' }}>
                    <div className="absolute inset-0 flex items-end px-3 pb-2">
                      <div>
                        <p className="text-white text-[11px] font-extrabold">McDonald's</p>
                        <p className="text-white/70 text-[8px]">Abierto ahora</p>
                      </div>
                    </div>
                  </div>
                  {/* Category pills */}
                  <div className="flex gap-1.5">
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-semibold text-white" style={{ background: C.accent }}>Hamburguesas</span>
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-semibold" style={{ background: '#F3F4F6', color: '#6B7280' }}>Pollo</span>
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-semibold" style={{ background: '#F3F4F6', color: '#6B7280' }}>Bebidas</span>
                  </div>
                  {/* Product cards */}
                  {[
                    { name: 'Big Mac', price: '$28.900', badge: 'Popular' },
                    { name: 'McPollo', price: '$22.900', badge: null },
                    { name: 'Cuarto de Libra', price: '$26.900', badge: null },
                  ].map(p => (
                    <div key={p.name} className="flex items-center gap-2.5 p-2.5 rounded-xl" style={{ background: '#fff', border: '1px solid #F0F0F0' }}>
                      <div className="w-12 h-12 rounded-lg shrink-0 flex items-center justify-center text-xl" style={{ background: 'rgba(232,0,45,0.05)' }}>🍔</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-[10px] font-bold truncate" style={{ color: C.text }}>{p.name}</p>
                          {p.badge && <span className="text-[7px] font-bold px-1 py-0.5 rounded" style={{ background: '#FEF3C7', color: '#92400E' }}>{p.badge}</span>}
                        </div>
                        <p className="text-[9px] font-extrabold mt-0.5" style={{ color: C.text }}>{p.price}</p>
                      </div>
                      <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: C.accent }}>+</div>
                    </div>
                  ))}
                </div>
                {/* Play overlay */}
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-[2.2rem]"
                >
                  <div className="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-xl">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill={C.accent}><path d="M8 5v14l11-7z"/></svg>
                  </div>
                </motion.div>
                <p className="text-[10px] font-semibold absolute bottom-4 left-0 right-0 text-center" style={{ color: C.muted }}>
                  Toca para ver el menu real
                </p>
              </button>
            ) : (
              <>
                {!iframeLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-10" style={{ background: '#FAFAFA' }}>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-8 h-8 rounded-full border-2 border-transparent mb-3"
                      style={{ borderTopColor: C.accent, borderRightColor: C.accent }}
                    />
                    <p className="text-[11px] font-medium" style={{ color: C.muted }}>Cargando menu real...</p>
                  </div>
                )}
                {isInView && (
                  <iframe
                    src="/macdonalds/"
                    title="Menu demo - Menuby"
                    className="w-full h-full border-0"
                    style={{ borderRadius: '2.2rem', opacity: iframeLoaded ? 1 : 0, transition: 'opacity 0.5s ease' }}
                    onLoad={() => setIframeLoaded(true)}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ===============================================================
   KDS MOCKUP
   =============================================================== */
function KDSMockup() {
  const [now, setNow] = useState(new Date());
  const initialOrders = [
    { id: 1, table: 'Mesa 4', items: ['Big Mac x1', 'Coca-Cola x2'], startSecs: 263, priority: 'high' },
    { id: 2, table: 'Mesa 7', items: ['McNuggets x10', 'McFlurry x1'], startSecs: 131, priority: 'normal' },
    { id: 3, table: 'Domicilio #38', items: ['Cuarto de Libra x2', 'Papas Grandes x2'], startSecs: 475, priority: 'urgent' },
  ];
  const [orders, setOrders] = useState(initialOrders);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setOrders(prev => prev.map(o => ({ ...o, startSecs: o.startSecs + 1 })));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m + ':' + String(sec).padStart(2, '0');
  };

  const priorityStyle = (p) => {
    if (p === 'urgent') return { bg: '#FEE2E2', border: '#FECACA', dot: '#EF4444', text: '#991B1B' };
    if (p === 'high') return { bg: '#FEF3C7', border: '#FDE68A', dot: '#F59E0B', text: '#92400E' };
    return { bg: '#F0FDF4', border: '#BBF7D0', dot: '#10B981', text: '#064E3B' };
  };

  const handleDone = (id) => {
    setOrders(prev => prev.filter(o => o.id !== id));
    setTimeout(() => {
      setOrders(prev => [...prev, { id: Date.now(), table: 'Mesa ' + (Math.floor(Math.random() * 12) + 1), items: ['Producto nuevo x1'], startSecs: 0, priority: 'normal' }]);
    }, 1500);
  };

  const time = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className="relative select-none">
      <motion.div className="w-[340px] sm:w-[380px] mx-auto">
        <div className="rounded-2xl overflow-hidden" style={{ background: '#111827', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-bold text-white/90">KDS — Cocina</span>
            </div>
            <span className="text-[10px] font-mono text-white/40">{time}</span>
          </div>
          <div className="p-3 space-y-2.5" style={{ minHeight: '320px' }}>
            <AnimatePresence>
              {orders.map(order => {
                const ps = priorityStyle(order.priority);
                const isLate = order.startSecs > 300;
                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, x: 100, scale: 0.9 }}
                    layout
                    className="rounded-xl p-3 relative"
                    style={{ background: ps.bg, border: '1px solid ' + ps.border }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: ps.dot }} />
                        <span className="text-[12px] font-extrabold" style={{ color: ps.text }}>{order.table}</span>
                      </div>
                      <span className={`text-[11px] font-mono font-bold ${isLate ? 'text-red-600 animate-pulse' : ''}`} style={{ color: isLate ? '#DC2626' : ps.text }}>
                        {fmtTime(order.startSecs)}
                      </span>
                    </div>
                    <div className="space-y-1 mb-2.5">
                      {order.items.map((item, idx) => (
                        <p key={idx} className="text-[11px] font-medium" style={{ color: ps.text + 'CC' }}>{item}</p>
                      ))}
                    </div>
                    <button
                      onClick={() => handleDone(order.id)}
                      className="w-full py-1.5 rounded-lg text-[10px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.97]"
                      style={{ background: '#10B981' }}
                    >
                      Marcar como Listo
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ===============================================================
   DASHBOARD MOCKUP
   =============================================================== */
function DashboardMockup() {
  const kpis = [
    { label: 'Ventas hoy', value: '$1.2M', change: '+12%', up: true },
    { label: 'Pedidos', value: '47', change: '+8%', up: true },
    { label: 'Ticket promedio', value: '$25.5K', change: '-3%', up: false },
    { label: 'Clientes nuevos', value: '12', change: '+24%', up: true },
  ];

  const barData = [
    { day: 'Lun', h: 45, val: '320K' },
    { day: 'Mar', h: 62, val: '440K' },
    { day: 'Mie', h: 55, val: '390K' },
    { day: 'Jue', h: 78, val: '560K' },
    { day: 'Vie', h: 92, val: '660K' },
    { day: 'Sab', h: 100, val: '720K' },
    { day: 'Dom', h: 70, val: '500K' },
  ];

  const topProducts = [
    { name: 'Big Mac', sold: 156, pct: 100 },
    { name: 'McNuggets x10', sold: 98, pct: 63 },
    { name: 'McFlurry Oreo', sold: 87, pct: 56 },
    { name: 'Cuarto de Libra', sold: 72, pct: 46 },
  ];

  return (
    <div className="relative select-none">
      <motion.div className="w-full max-w-[480px] mx-auto">
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.12)', border: '1px solid #E5E7EB' }}>
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <div>
              <p className="text-[13px] font-extrabold" style={{ color: C.text }}>Dashboard</p>
              <p className="text-[10px]" style={{ color: C.muted }}>Hoy, Abril 2026</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-2.5">
              {kpis.map(k => (
                <div key={k.label} className="rounded-xl p-3" style={{ background: '#F9FAFB', border: '1px solid #F3F4F6' }}>
                  <p className="text-[9px] font-medium mb-1" style={{ color: C.muted }}>{k.label}</p>
                  <p className="text-[16px] font-extrabold" style={{ color: C.text }}>{k.value}</p>
                  <span className={`text-[9px] font-bold ${k.up ? 'text-emerald-600' : 'text-red-500'}`}>{k.change}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl p-3" style={{ background: '#F9FAFB', border: '1px solid #F3F4F6' }}>
              <p className="text-[10px] font-bold mb-3" style={{ color: C.text }}>Ventas esta semana</p>
              <div className="flex items-end justify-between gap-1.5" style={{ height: '80px' }}>
                {barData.map((b, i) => (
                  <div key={b.day} className="flex flex-col items-center gap-1 flex-1">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: b.h + '%' }}
                      transition={{ duration: 0.8, delay: i * 0.08, ease: 'easeOut' }}
                      className="w-full rounded-t-md"
                      style={{ background: i === 5 ? C.accent : C.accent + '30', minHeight: '4px' }}
                    />
                    <span className="text-[8px] font-medium" style={{ color: C.muted }}>{b.day}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl p-3" style={{ background: '#F9FAFB', border: '1px solid #F3F4F6' }}>
              <p className="text-[10px] font-bold mb-2" style={{ color: C.text }}>Productos top</p>
              <div className="space-y-2">
                {topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-2">
                    <span className="text-[9px] font-bold w-4 text-center" style={{ color: C.muted }}>{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-semibold" style={{ color: C.text }}>{p.name}</span>
                        <span className="text-[9px] font-medium" style={{ color: C.muted }}>{p.sold}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#E5E7EB' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: p.pct + '%' }}
                          transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
                          className="h-full rounded-full"
                          style={{ background: i === 0 ? C.accent : C.accent + '60' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ===============================================================
   FAQ
   =============================================================== */
const FAQ_DATA = [
  { q: 'Necesito tarjeta de credito para empezar?', a: 'No. El plan Gratis es completamente gratis, sin tarjeta ni prueba temporal. Solo creas tu cuenta y empiezas.' },
  { q: 'Cuanto se demora configurar mi menu?', a: 'En promedio 5 minutos. Solo necesitas tu logo, los nombres de tus productos y los precios. Puedes agregar fotos despues.' },
  { q: 'Funciona sin internet en el restaurante?', a: 'El menu del cliente funciona con la conexion del celular del cliente. Tu panel de admin necesita internet, pero tiene modo offline para emergencias.' },
  { q: 'Cobran comision por pedido?', a: 'Jamas. Todos los planes tienen 0% de comision. Pagas una tarifa fija mensual y cada peso que vendes es tuyo.' },
  { q: 'Puedo cancelar en cualquier momento?', a: 'Si. Sin contratos, sin penalidades. Tu cuenta queda activa en plan Gratis y no pierdes tus datos.' },
  { q: 'Funciona con impresoras termicas?', a: 'Si. Menuby tiene Autoprint: los pedidos se imprimen automaticamente en tu impresora termica. Compatible con las principales marcas.' },
];

function FAQAccordion() {
  const [open, setOpen] = useState(null);
  return (
    <div className="max-w-2xl mx-auto space-y-2">
      {FAQ_DATA.map((item, i) => (
        <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid ' + C.borderLight, background: C.card }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <span className="text-[13px] font-semibold pr-4" style={{ color: C.text }}>{item.q}</span>
            <motion.div animate={{ rotate: open === i ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={16} style={{ color: C.muted }} />
            </motion.div>
          </button>
          <AnimatePresence>
            {open === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <p className="px-5 pb-4 text-[12px] leading-relaxed" style={{ color: C.muted }}>{item.a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

/* === PLAN DATA === */
const PLANS = [
  { id: 'free', name: 'Gratis', desc: '20 productos, 30 pedidos/mes', monthly: 0, annual: 0, popular: false, features: ['Menu digital con QR', '5 categorias, 5 mesas', 'Carrito basico', 'Logo y portada', '1 zona de entrega'], cta: 'Empezar gratis' },
  { id: 'starter', name: 'Starter', desc: '60 productos, 350 pedidos/mes', monthly: 39900, annual: 34900, popular: false, features: ['Todo de Gratis', 'Push notifications', 'Zonas de entrega ilimitadas', 'Toppings y extras', 'KDS basico + Autoprint'], cta: 'Comenzar con Starter' },
  { id: 'pro', name: 'Pro', desc: 'Ilimitado en todo', monthly: 59900, annual: 49900, popular: true, features: ['Todo de Starter', 'Pedidos ilimitados', 'Reservas y recordatorios', 'Lealtad con tiers', 'Analytics completo + IA'], cta: 'Elegir Pro' },
  { id: 'promax', name: 'Pro Max', desc: 'Lo mejor de Menuby', monthly: 89900, annual: 74900, popular: false, features: ['Todo de Pro', 'Soporte prioritario', 'Acceso anticipado a funciones', 'Eventos exclusivos', 'Tutoriales premium'], cta: 'Ir con Pro Max' },
];

const MARQUEE = [
  'Burger Joint 🍔', 'Sushi Express 🍗', 'Pizza Place 🥤', 'La Taqueria 🍰',
  'El Corral 🍔', 'Crepes & Waffles 🍰', 'Frisby 🍗', 'Presto 🍔',
  'Archies 🍔', 'Sandwich Cubano 🍔', 'Creppes 🍰', 'Wok 🍗',
];

/* ===============================================================
   FEATURE FLASH SECTIONS — iPhone-style full-viewport cards
   =============================================================== */
const FLASH_FEATURES = [
  {
    icon: QrCode,
    label: 'Menu Digital',
    title: 'Tu menu completo en el celular de tus clientes',
    desc: 'Categorias con emojis, fotos en alta resolucion, toppings personalizables, buscador inteligente y favoritos. Todo accesible desde un QR en cada mesa.',
    color: '#E8002D',
    details: ['Categorias ilimitadas', 'Toppings y extras', 'Busqueda y favoritos', 'QR por mesa', 'Productos destacados', 'Splash screen personalizado'],
    visual: 'menu',
  },
  {
    icon: Bell,
    label: 'Pedidos en Tiempo Real',
    title: 'Cada pedido llega al instante con notificacion push',
    desc: 'Tus clientes piden desde su mesa o desde casa. Tu recibes el pedido en tiempo real con sonido, push notification y el comprobante de pago adjunto.',
    color: '#7C3AED',
    details: ['Push al admin y cliente', 'Seguimiento en vivo', 'Comprobante de pago', 'Domicilio + en sitio', 'Historial completo', 'Carritos abandonados'],
    visual: 'orders',
  },
  {
    icon: Monitor,
    label: 'Pantalla de Cocina',
    title: 'Cocina organizada. Sin gritos, sin papeles',
    desc: 'Tu equipo de cocina ve los pedidos en una pantalla con timers de preparacion, prioridad por tiempo y el boton para marcar como listo que notifica al cliente.',
    color: '#0891B2',
    details: ['Timers en tiempo real', 'Prioridad automatica', 'Marcar como listo', 'Multi-pantalla', 'Notifica al cliente', 'Autoprint a impresora'],
    visual: 'kds',
  },
  {
    icon: Gift,
    label: 'Programa de Lealtad',
    title: 'Haz que vuelvan una y otra vez',
    desc: 'Configura puntos por compra, niveles de fidelidad con beneficios exclusivos, cupones de descuento y recompensas canjeables directamente desde el menu.',
    color: '#D97706',
    details: ['Puntos por compra', 'Tiers de lealtad', 'Cupones y descuentos', 'Canje de recompensas', 'Balance visible en menu', 'Cupones ilimitados (Pro)'],
    visual: 'loyalty',
  },
  {
    icon: BarChart3,
    label: 'Analytics e IA',
    title: 'Datos reales. Decisiones inteligentes',
    desc: 'Dashboard con ventas por periodo, productos mas vendidos, ticket promedio, clientes nuevos, carritos abandonados y herramientas de IA para generar contenido.',
    color: '#059669',
    details: ['Ventas en tiempo real', 'Productos top', 'Ticket promedio', 'Clientes nuevos', 'Generador de nombres IA', 'Respuestas IA a resenas'],
    visual: 'analytics',
  },
  {
    icon: MapPin,
    label: 'Delivery y Zonas',
    title: 'Delivery propio. Sin intermediarios',
    desc: 'Define tus zonas de entrega con costos diferenciados, ofrece tracking publico en tiempo real y genera QR especificos para cada zona.',
    color: '#DC2626',
    details: ['Zonas geograficas', 'Costos por zona', 'Tracking en vivo', 'QR para delivery', 'Sin comisiones', 'Mapa interactivo'],
    visual: 'delivery',
  },
  {
    icon: CalendarCheck,
    label: 'Reservas y Citas',
    title: 'Agenda inteligente para tu negocio',
    desc: 'Tus clientes reservan desde el menu. Configura horarios, asigna staff y enviarecordatorios automaticos por push y WhatsApp 24h y 1h antes.',
    color: '#8B5CF6',
    details: ['Slots configurables', 'Asignacion de staff', 'Recordatorios auto', 'Confirmacion WhatsApp', 'Historial por cliente', 'Vista calendario'],
    visual: 'bookings',
  },
  {
    icon: Palette,
    label: 'Personalizacion Total',
    title: 'Tu marca. Tu estilo. Tu menu',
    desc: 'Personaliza colores, logo, portada, banners promocionales y splash screen. Cada detalle refleja la identidad de tu negocio.',
    color: '#EC4899',
    details: ['Colores personalizados', 'Logo y portada', 'Banners promocionales', 'Splash screen', 'Redes sociales', 'Horarios visibles'],
    visual: 'brand',
  },
];

/* ===============================================================
   TESTIMONIALS
   =============================================================== */
const TESTIMONIALS = [
  { name: 'Carlos M.', role: 'Dueno, Burger Lab', city: 'Bogota', text: 'Pasamos de recibir pedidos por WhatsApp a tener todo organizado en un solo lugar. Los pedidos ya no se pierden y la cocina funciona mucho mejor con el KDS.', stars: 5 },
  { name: 'Laura P.', role: 'Administradora, Sabor Criollo', city: 'Medellin', text: 'Lo que mas me gusto es que no cobran comision. Con las plataformas de delivery perdiamos el 25%. Ahora cada peso es nuestro y los clientes piden directo.', stars: 5 },
  { name: 'Diego R.', role: 'Chef ejecutivo, Wok & Roll', city: 'Cali', text: 'El programa de lealtad ha sido increible. Los clientes acumulan puntos y vuelven. Hemos visto un aumento del 30% en clientes recurrentes.', stars: 5 },
  { name: 'Maria F.', role: 'Duena, Dulce Tentacion', city: 'Barranquilla', text: 'Configurar el menu me tomo literalmente 5 minutos. Subi las fotos, puse los precios, genere el QR y listo. Mis clientes quedaron encantados.', stars: 4 },
];

/* ===============================================================
   HOW IT WORKS STEPS
   =============================================================== */
const STEPS = [
  { num: '01', title: 'Crea tu cuenta', desc: 'Registrate gratis en 30 segundos. Sin tarjeta de credito, sin compromisos.', icon: Zap },
  { num: '02', title: 'Arma tu menu', desc: 'Sube tus productos con fotos, precios y toppings. El asistente te guia paso a paso.', icon: Smartphone },
  { num: '03', title: 'Recibe pedidos', desc: 'Comparte tu QR o link. Los pedidos llegan en tiempo real a tu panel y a la cocina.', icon: Bell },
];

/* ===============================================================
   MAIN HOME COMPONENT
   =============================================================== */
export default function Home() {
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [demoTab, setDemoTab] = useState(0);
  const [hoveredFeature, setHoveredFeature] = useState(null);

  const statsRef = useRef(null);
  const statsInView = useInView(statsRef, { once: true, margin: '-80px' });

  useLandingSEO({
    title: 'Menuby — Menu Digital y Pedidos para Restaurantes en Colombia',
    description: 'Menu digital, pedidos en tiempo real, pantalla de cocina, programa de fidelizacion y analytics. Todo en uno. Sin comisiones. Desde $0.',
    canonical: '/',
    keywords: 'menu digital restaurante colombia, sistema restaurantes, software restaurantes, menu QR, pedidos en linea, KDS cocina',
  });

  const demoTabs = [
    { label: 'Menu del cliente', icon: Smartphone },
    { label: 'Pantalla de Cocina', icon: UtensilsCrossed },
    { label: 'Dashboard', icon: BarChart3 },
  ];

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: C.text, background: C.bg, overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap');
        .hd { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 900; letter-spacing: -0.04em; line-height: 1; }
        .hd-sub { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; letter-spacing: -0.03em; line-height: 1.05; }
        @keyframes marquee-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .marquee-track { animation: marquee-scroll 35s linear infinite; }
        .marquee-track:hover { animation-play-state: paused; }
        @keyframes grain { 0%,100% { transform: translate(0,0) } 10% { transform: translate(-5%,-10%) } 30% { transform: translate(3%,-15%) } 50% { transform: translate(-15%,5%) } 70% { transform: translate(8%,10%) } 90% { transform: translate(-10%,15%) } }
        .noise::after { content: ''; position: absolute; inset: -50%; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E"); animation: grain 8s steps(10) infinite; pointer-events: none; }
      `}</style>

      {/* ========== HERO ========== */}
      <div className="relative overflow-hidden noise">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.07] blur-[120px] pointer-events-none" style={{ background: C.accent }} />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-[0.04] blur-[100px] pointer-events-none" style={{ background: '#7C3AED' }} />

        <Section className="pt-28 sm:pt-36 lg:pt-40 pb-20 sm:pb-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <FadeInWhenVisible delay={0}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold mb-7 backdrop-blur-sm"
                  style={{ background: 'rgba(232,0,45,0.06)', color: C.accent, border: '1px solid rgba(232,0,45,0.12)' }}
                >
                  <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} className="text-sm">🔥</motion.span>
                  +500 restaurantes en Colombia
                </motion.div>
              </FadeInWhenVisible>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
                className="hd text-[2.5rem] sm:text-[3.2rem] lg:text-[3.8rem] mb-6"
                style={{ color: C.text }}
              >
                Tu restaurante<br />
                merece <span className="relative inline-block">
                  <span style={{ color: C.accent }}>mas</span>
                  <motion.svg
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.2, delay: 0.8, ease: 'easeOut' }}
                    className="absolute -bottom-2 left-0 w-full"
                    viewBox="0 0 100 8" fill="none"
                  >
                    <motion.path d="M2 6C20 2 40 2 50 4C60 6 80 3 98 2" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" fill="none" />
                  </motion.svg>
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.25 }}
                className="text-base sm:text-lg leading-relaxed mb-9 max-w-md"
                style={{ color: C.textSecondary }}
              >
                Menu digital, pedidos en tiempo real, pantalla de cocina y programa de fidelizacion. Todo desde una sola plataforma. <span className="font-semibold" style={{ color: C.text }}>Sin comisiones.</span>
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="flex flex-wrap gap-3 mb-6"
              >
                <MagneticButton>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.97]"
                    style={{ background: C.accent, boxShadow: '0 8px 40px rgba(232,0,45,0.3), 0 2px 4px rgba(232,0,45,0.2)' }}
                  >
                    Crear Mi Menu Gratis <ArrowRight size={16} strokeWidth={2.5} />
                  </Link>
                </MagneticButton>
                <Link
                  to="/demo"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-semibold transition-all hover:bg-white/80 backdrop-blur-sm group"
                  style={{ color: C.text, border: '1px solid ' + C.border, background: 'rgba(255,255,255,0.6)' }}
                >
                  Ver Demo
                  <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }} className="inline-block">→</motion.span>
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]"
                style={{ color: C.muted }}
              >
                {['Sin tarjeta de credito', 'Listo en 5 minutos', 'Cancela cuando quieras'].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: C.greenSoft }}>
                      <Check size={8} style={{ color: C.green }} strokeWidth={3} />
                    </span>
                    {t}
                  </span>
                ))}
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 50, rotateY: -5 }}
              animate={{ opacity: 1, y: 0, rotateY: 0 }}
              transition={{ duration: 1, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="hidden lg:block"
            >
              <RealMenuMockup />
            </motion.div>
          </div>
        </Section>
      </div>

      {/* ========== MARQUEE ========== */}
      <div className="py-7 overflow-hidden relative" style={{ background: C.surface, borderTop: '1px solid ' + C.borderLight, borderBottom: '1px solid ' + C.borderLight }}>
        <div className="absolute left-0 top-0 bottom-0 w-20 z-10" style={{ background: `linear-gradient(90deg, ${C.surface}, transparent)` }} />
        <div className="absolute right-0 top-0 bottom-0 w-20 z-10" style={{ background: `linear-gradient(270deg, ${C.surface}, transparent)` }} />
        <div className="flex marquee-track w-max">
          {[...MARQUEE, ...MARQUEE].map((item, i) => (
            <span key={i} className="shrink-0 mx-2 px-4 py-2 rounded-full text-[11px] font-semibold" style={{ background: C.bg, border: '1px solid ' + C.borderLight, color: C.text }}>
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ========== HOW IT WORKS ========== */}
      <Section className="py-20 sm:py-28">
        <FadeInWhenVisible>
          <p className="text-center text-[11px] font-bold tracking-widest uppercase mb-3" style={{ color: C.accent }}>Como funciona</p>
          <h2 className="hd-sub text-3xl sm:text-4xl lg:text-[2.8rem] text-center mb-4" style={{ color: C.text }}>
            En 3 pasos estas operando
          </h2>
          <p className="text-center text-sm mb-14 max-w-lg mx-auto" style={{ color: C.muted }}>
            No necesitas tecnico, ni capacitacion, ni hardware especial
          </p>
        </FadeInWhenVisible>

        <StaggerContainer className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto" stagger={0.12}>
          {STEPS.map((step, i) => (
            <motion.div key={step.num} variants={staggerChild} className="relative text-center group">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center transition-transform duration-300 group-hover:scale-110" style={{ background: C.accent + '08' }}>
                <step.icon size={28} style={{ color: C.accent }} />
              </div>
              <span className="text-[40px] font-black absolute top-0 right-4 md:right-2 opacity-[0.04] pointer-events-none" style={{ color: C.text }}>{step.num}</span>
              <h3 className="text-lg font-extrabold mb-2" style={{ color: C.text }}>{step.title}</h3>
              <p className="text-[13px] leading-relaxed max-w-[260px] mx-auto" style={{ color: C.muted }}>{step.desc}</p>
              {i < 2 && (
                <div className="hidden md:block absolute top-8 -right-3 w-6">
                  <ArrowRight size={18} style={{ color: C.border }} />
                </div>
              )}
            </motion.div>
          ))}
        </StaggerContainer>
      </Section>

      {/* ========== ANTES / DESPUES ========== */}
      <div style={{ background: C.surface, borderTop: '1px solid ' + C.borderLight }}>
        <Section className="py-20 sm:py-28">
          <FadeInWhenVisible>
            <p className="text-center text-[11px] font-bold tracking-widest uppercase mb-3" style={{ color: C.accent }}>El problema</p>
            <h2 className="hd-sub text-3xl sm:text-4xl lg:text-[2.8rem] text-center mb-4" style={{ color: C.text }}>
              Como opera tu restaurante hoy?
            </h2>
            <p className="text-center text-sm mb-12 max-w-lg mx-auto" style={{ color: C.muted }}>
              Compara tu operacion actual con lo que podrias tener en 5 minutos
            </p>
          </FadeInWhenVisible>

          <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            <FadeInWhenVisible delay={0.1}>
              <div className="rounded-2xl p-7 h-full relative overflow-hidden" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 blur-2xl" style={{ background: '#EF4444' }} />
                <p className="font-extrabold text-sm mb-5 flex items-center gap-2" style={{ color: '#DC2626' }}>
                  <span className="w-6 h-6 rounded-lg bg-red-100 flex items-center justify-center"><X size={14} className="text-red-500" /></span>
                  Sin Menuby
                </p>
                <ul className="space-y-3.5">
                  {[
                    'Pedidos por WhatsApp que se pierden en el chat',
                    'Comisiones del 15-30% a plataformas de delivery',
                    'Sin datos: no sabes que se vendio ni cuanto',
                    'Cocina desorganizada, pedidos a gritos',
                    'Clientes que no vuelven porque no los fidelizas',
                  ].map(t => (
                    <li key={t} className="flex items-start gap-2.5 text-[13px] leading-snug" style={{ color: '#991B1B' }}>
                      <X size={13} className="mt-0.5 shrink-0 text-red-400" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
            </FadeInWhenVisible>

            <FadeInWhenVisible delay={0.2}>
              <div className="rounded-2xl p-7 h-full relative overflow-hidden" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 blur-2xl" style={{ background: '#10B981' }} />
                <p className="font-extrabold text-sm mb-5 flex items-center gap-2" style={{ color: C.green }}>
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center"><Check size={14} className="text-emerald-600" /></span>
                  Con Menuby
                </p>
                <ul className="space-y-3.5">
                  {[
                    'Pedidos llegan en tiempo real a tu panel con push',
                    '0% comision — tus ventas son completamente tuyas',
                    'Analytics completo: ventas, productos top, ticket',
                    'KDS con timers para cocina organizada',
                    'Programa de lealtad con puntos y recompensas',
                  ].map(t => (
                    <li key={t} className="flex items-start gap-2.5 text-[13px] leading-snug" style={{ color: '#064E3B' }}>
                      <Check size={13} className="mt-0.5 shrink-0 text-emerald-500" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
            </FadeInWhenVisible>
          </div>
        </Section>
      </div>

      {/* ========== FEATURE FLASH SECTIONS — Full viewport, iPhone-style ========== */}
      {FLASH_FEATURES.map((feat, idx) => {
        const isEven = idx % 2 === 0;
        return (
          <div key={feat.label} className="relative overflow-hidden" style={{ background: isEven ? C.bg : C.surface, borderTop: '1px solid ' + C.borderLight }}>
            {/* Ambient glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04] blur-[150px] pointer-events-none" style={{ background: feat.color }} />

            <Section className="py-24 sm:py-32 lg:py-40">
              <div className={`grid lg:grid-cols-2 gap-12 lg:gap-20 items-center ${isEven ? '' : 'direction-rtl'}`} style={{ direction: isEven ? 'ltr' : 'rtl' }}>
                {/* Text side */}
                <div style={{ direction: 'ltr' }}>
                  <FadeInWhenVisible>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wide uppercase mb-6" style={{ background: feat.color + '0D', color: feat.color, border: '1px solid ' + feat.color + '20' }}>
                      <feat.icon size={12} />
                      {feat.label}
                    </div>

                    <h2 className="hd text-[1.8rem] sm:text-[2.4rem] lg:text-[2.8rem] mb-5" style={{ color: C.text, lineHeight: 1.05 }}>
                      {feat.title}
                    </h2>

                    <p className="text-sm sm:text-base leading-relaxed mb-8 max-w-lg" style={{ color: C.textSecondary }}>
                      {feat.desc}
                    </p>

                    <div className="grid grid-cols-2 gap-2.5">
                      {feat.details.map((d) => (
                        <div key={d} className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: C.card, border: '1px solid ' + C.borderLight }}>
                          <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background: feat.color + '10' }}>
                            <Check size={10} style={{ color: feat.color }} strokeWidth={3} />
                          </div>
                          <span className="text-[11px] font-semibold" style={{ color: C.text }}>{d}</span>
                        </div>
                      ))}
                    </div>
                  </FadeInWhenVisible>
                </div>

                {/* Visual side */}
                <FadeInWhenVisible delay={0.2}>
                  <div style={{ direction: 'ltr' }}>
                    <div className="relative">
                      {/* Big icon visual */}
                      <div className="w-full aspect-square max-w-[400px] mx-auto rounded-3xl flex items-center justify-center relative overflow-hidden" style={{ background: `linear-gradient(145deg, ${feat.color}08, ${feat.color}03)`, border: '1px solid ' + feat.color + '15' }}>
                        {/* Decorative circles */}
                        <div className="absolute top-6 right-6 w-20 h-20 rounded-full opacity-[0.06]" style={{ background: feat.color }} />
                        <div className="absolute bottom-8 left-8 w-14 h-14 rounded-full opacity-[0.04]" style={{ background: feat.color }} />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full opacity-[0.05] blur-2xl" style={{ background: feat.color }} />

                        {/* Central icon cluster */}
                        <div className="text-center relative z-10">
                          <motion.div
                            animate={{ y: [0, -8, 0] }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                          >
                            <div className="w-24 h-24 rounded-3xl mx-auto mb-6 flex items-center justify-center" style={{ background: feat.color + '12', boxShadow: '0 20px 60px ' + feat.color + '15' }}>
                              <feat.icon size={48} style={{ color: feat.color }} strokeWidth={1.5} />
                            </div>
                          </motion.div>

                          {/* Feature mini pills */}
                          <div className="flex flex-wrap justify-center gap-1.5 max-w-[280px] mx-auto">
                            {feat.details.slice(0, 3).map((d, di) => (
                              <motion.span
                                key={d}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.5 + di * 0.1 }}
                                className="text-[9px] font-bold px-2.5 py-1 rounded-full"
                                style={{ background: feat.color + '12', color: feat.color }}
                              >
                                {d}
                              </motion.span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </FadeInWhenVisible>
              </div>
            </Section>
          </div>
        );
      })}

      {/* ========== INTERACTIVE DEMO ========== */}
      <div className="relative overflow-hidden noise" style={{ background: C.dark }}>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(232,0,45,0.5), transparent 70%)' }} />

        <Section id="demo" className="py-20 sm:py-28 relative z-10">
          <FadeInWhenVisible>
            <p className="text-center text-[11px] font-bold tracking-widest uppercase mb-3" style={{ color: C.accent }}>Demo en vivo</p>
            <h2 className="hd-sub text-3xl sm:text-4xl lg:text-[2.8rem] text-center mb-4 text-white">
              Asi se ve Menuby en accion
            </h2>
            <p className="text-center text-sm mb-10 max-w-lg mx-auto text-white/50">
              Interactivo. Haz clic, agrega productos, marca pedidos como listos.
            </p>
          </FadeInWhenVisible>

          <div className="flex justify-center mb-10">
            <div className="inline-flex rounded-2xl p-1.5 gap-1" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {demoTabs.map((tab, i) => (
                <button
                  key={tab.label}
                  onClick={() => setDemoTab(i)}
                  className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-[12px] sm:text-[13px] font-semibold transition-all duration-200"
                  style={{
                    background: demoTab === i ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: demoTab === i ? '#fff' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  <tab.icon size={14} style={{ color: demoTab === i ? C.accent : 'rgba(255,255,255,0.3)' }} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="max-w-2xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={demoTab}
                initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -16, filter: 'blur(4px)' }}
                transition={{ duration: 0.35 }}
              >
                {demoTab === 0 && <RealMenuMockup />}
                {demoTab === 1 && <KDSMockup />}
                {demoTab === 2 && <DashboardMockup />}
              </motion.div>
            </AnimatePresence>
          </div>
        </Section>
      </div>

      {/* ========== TESTIMONIALS ========== */}
      <Section className="py-20 sm:py-28">
        <FadeInWhenVisible>
          <p className="text-center text-[11px] font-bold tracking-widest uppercase mb-3" style={{ color: C.accent }}>Testimonios</p>
          <h2 className="hd-sub text-3xl sm:text-4xl lg:text-[2.8rem] text-center mb-4" style={{ color: C.text }}>
            Lo que dicen nuestros restaurantes
          </h2>
          <p className="text-center text-sm mb-14 max-w-lg mx-auto" style={{ color: C.muted }}>
            Restaurantes reales, resultados reales
          </p>
        </FadeInWhenVisible>

        <StaggerContainer className="grid sm:grid-cols-2 gap-5 max-w-4xl mx-auto" stagger={0.1}>
          {TESTIMONIALS.map((t) => (
            <motion.div
              key={t.name}
              variants={staggerChild}
              className="rounded-2xl p-6 relative overflow-hidden group hover:shadow-lg transition-shadow duration-300"
              style={{ background: C.card, border: '1px solid ' + C.borderLight }}
            >
              <div className="flex items-center gap-0.5 mb-4">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <Star key={i} size={14} fill="#F59E0B" color="#F59E0B" />
                ))}
                {t.stars < 5 && Array.from({ length: 5 - t.stars }).map((_, i) => (
                  <Star key={i + 'e'} size={14} fill="none" color="#D1D5DB" />
                ))}
              </div>
              <p className="text-[13px] leading-relaxed mb-5" style={{ color: C.textSecondary }}>
                "{t.text}"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white" style={{ background: C.accent }}>
                  {t.name.charAt(0)}
                </div>
                <div>
                  <p className="text-[12px] font-bold" style={{ color: C.text }}>{t.name}</p>
                  <p className="text-[10px]" style={{ color: C.muted }}>{t.role} — {t.city}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </StaggerContainer>
      </Section>

      {/* ========== STATS ========== */}
      <div ref={statsRef} className="relative overflow-hidden noise" style={{ background: C.dark }}>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(232,0,45,0.5), transparent 70%)' }} />
        <Section className="py-16 sm:py-24">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { end: 500, suffix: '+', label: 'Restaurantes activos' },
              { end: 0, suffix: '%', label: 'Comision por pedido' },
              { end: 5, suffix: ' min', label: 'Tiempo de setup' },
              { end: 15, suffix: '+', label: 'Ciudades en Colombia' },
            ].map((s, i) => (
              <FadeInWhenVisible key={s.label} delay={i * 0.1} y={20}>
                <p className="hd text-3xl sm:text-5xl text-white mb-1">
                  <CounterValue end={s.end} active={statsInView} />{s.suffix}
                </p>
                <p className="text-[11px] sm:text-xs text-white/40 font-medium">{s.label}</p>
              </FadeInWhenVisible>
            ))}
          </div>
        </Section>
      </div>

      {/* ========== PRICING ========== */}
      <Section id="pricing" className="py-20 sm:py-28">
        <FadeInWhenVisible>
          <p className="text-center text-[11px] font-bold tracking-widest uppercase mb-3" style={{ color: C.accent }}>Precios</p>
          <h2 className="hd-sub text-3xl sm:text-4xl lg:text-[2.8rem] text-center mb-3">
            Planes sin comisiones ocultas
          </h2>
          <p className="text-center text-sm mb-8 max-w-md mx-auto" style={{ color: C.muted }}>
            Tarifa fija mensual. Sin castigo por crecer. Sin letra pequena.
          </p>
        </FadeInWhenVisible>

        <div className="flex justify-center items-center gap-3 mb-12">
          <div className="inline-flex rounded-xl p-1" style={{ background: C.elevated, border: '1px solid ' + C.border }}>
            {['monthly', 'annual'].map(c => (
              <button
                key={c}
                onClick={() => setBillingCycle(c)}
                className="px-5 py-2.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: billingCycle === c ? C.surface : 'transparent',
                  color: billingCycle === c ? C.text : C.muted,
                  boxShadow: billingCycle === c ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {c === 'monthly' ? 'Mensual' : 'Anual'}
              </button>
            ))}
          </div>
          <AnimatePresence>
            {billingCycle === 'annual' && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-[10px] font-bold px-2.5 py-1 rounded-full text-white"
                style={{ background: C.green }}
              >
                Ahorra 2 meses
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <StaggerContainer className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 max-w-5xl mx-auto" stagger={0.06}>
          {PLANS.map((plan) => {
            const price = billingCycle === 'annual' ? plan.annual : plan.monthly;
            const isPop = plan.popular;
            return (
              <motion.div
                key={plan.id}
                variants={staggerChild}
                whileHover={{ y: -4 }}
                className={`relative rounded-2xl p-6 flex flex-col transition-shadow duration-300 ${isPop ? 'shadow-xl' : 'shadow-sm hover:shadow-lg'}`}
                style={{
                  background: C.surface,
                  border: isPop ? '2px solid ' + C.accent : '1px solid ' + C.border,
                }}
              >
                {isPop && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold text-white" style={{ background: C.accent }}>
                    Mas popular
                  </span>
                )}

                <h3 className="text-base font-extrabold" style={{ color: C.text }}>{plan.name}</h3>
                <p className="text-[11px] mt-1 mb-4" style={{ color: C.muted }}>{plan.desc}</p>

                <div className="mb-5">
                  <span className="hd text-3xl" style={{ color: C.text }}>
                    {plan.id === 'free' ? '$0' : fmtCOP(price)}
                  </span>
                  <span className="text-[11px] ml-1" style={{ color: C.muted }}>
                    {plan.id === 'free' ? ' siempre' : '/mes'}
                  </span>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-[12px]" style={{ color: C.textSecondary }}>
                      <Check size={13} style={{ color: C.accent }} strokeWidth={2.5} /> {f}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/register"
                  className="block w-full text-center py-3 rounded-xl text-[13px] font-bold transition-all hover:shadow-md active:scale-[0.97]"
                  style={
                    isPop
                      ? { background: C.accent, color: '#fff', boxShadow: '0 4px 20px rgba(232,0,45,0.25)' }
                      : { background: 'transparent', color: C.text, border: '1px solid ' + C.border }
                  }
                >
                  {plan.cta}
                </Link>
              </motion.div>
            );
          })}
        </StaggerContainer>
      </Section>

      {/* ========== FAQ ========== */}
      <div style={{ background: C.surface, borderTop: '1px solid ' + C.borderLight }}>
        <Section className="py-20 sm:py-28">
          <FadeInWhenVisible>
            <p className="text-center text-[11px] font-bold tracking-widest uppercase mb-3" style={{ color: C.accent }}>FAQ</p>
            <h2 className="hd-sub text-3xl sm:text-4xl text-center mb-3">Preguntas frecuentes</h2>
            <p className="text-center text-sm mb-12" style={{ color: C.muted }}>Todo lo que necesitas saber</p>
          </FadeInWhenVisible>
          <FAQAccordion />
        </Section>
      </div>

      {/* ========== TRUST / SECURITY ========== */}
      <Section className="py-16 sm:py-20">
        <div className="flex flex-wrap justify-center items-center gap-8 sm:gap-12">
          {[
            { icon: ShieldCheck, text: 'Datos protegidos SSL' },
            { icon: CreditCard, text: '0% comisiones' },
            { icon: Clock, text: 'Soporte en horario laboral' },
            { icon: Users, text: '+500 restaurantes confian' },
          ].map((t) => (
            <div key={t.text} className="flex items-center gap-2 text-[12px] font-medium" style={{ color: C.muted }}>
              <t.icon size={16} style={{ color: C.accent }} />
              {t.text}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
