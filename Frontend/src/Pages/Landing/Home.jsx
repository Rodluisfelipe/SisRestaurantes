import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  Smartphone, Monitor, ChevronDown, Check, X, ArrowRight, Star, Clock, BarChart3,
  Bell, QrCode, UtensilsCrossed, MapPin, Gift, ShieldCheck, Zap, Users, CreditCard,
  Palette, CalendarCheck, Printer, Coffee, Pizza, Beef, IceCreamCone, Croissant,
  Wine, Sandwich, ChefHat, Soup, TrendingUp, Sparkles,
} from 'lucide-react';
import useLandingSEO from '../../hooks/useLandingSEO';

/* ===============================================================
   DESIGN SYSTEM — "Apetito": warm, editorial, light.
   Display: Bricolage Grotesque · Body: Geist · Data: Geist Mono
   =============================================================== */
const C = {
  accent: '#E8002D',      // brand red
  accentDeep: '#A80020',  // depth
  ember: '#FF5A1F',       // warm secondary
  bg: '#FBFAF8',          // warm paper
  surface: '#F4F0EB',     // warm surface
  blush: '#FBEEE9',       // warm tint panel
  card: '#FFFFFF',
  dark: '#17120F',        // warm ink (text)
  text: '#17120F',
  textSecondary: '#463F39',
  muted: '#6E655C',
  border: '#E4DDD5',
  borderLight: '#EFEAE3',
  elevated: '#EDE7E0',
  green: '#0E7A4F',
  greenSoft: '#DDF3E7',
};

const DISPLAY = "'Bricolage Grotesque', sans-serif";
const BODY = "'Geist', system-ui, sans-serif";

const fmtCOP = (n) => (n == null ? '' : '$' + n.toLocaleString('es-CO'));

/* === ANIMATION HELPERS === */
const FadeInWhenVisible = ({ children, delay = 0, y = 24, className = '' }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
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
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

const Section = ({ children, id, className = '', style = {} }) => (
  <section id={id} className={`px-5 sm:px-6 lg:px-8 ${className}`} style={style}>
    <div className="max-w-6xl mx-auto">{children}</div>
  </section>
);

const Eyebrow = ({ children, color = C.accent }) => (
  <p className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color }}>{children}</p>
);

/* === COUNTER === */
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
  return <>{useCounter(end, 1800, active)}</>;
}

/* Image with a magnifier lens that follows the cursor (desktop only) */
function ZoomImage({ src, alt, zoom = 1.8, lens = 320 }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height) { setPos(null); return; }
    setPos({ x, y, bgX: -(x * zoom - lens / 2), bgY: -(y * zoom - lens / 2), bw: r.width * zoom, bh: r.height * zoom });
  };
  return (
    <div ref={ref} className="relative cursor-zoom-in" onMouseMove={onMove} onMouseLeave={() => setPos(null)}>
      <img src={src} alt={alt} className="w-full block" loading="lazy" />
      {/* Hint (hidden while zooming) */}
      <div className={`hidden md:flex absolute bottom-3 right-3 items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold pointer-events-none transition-opacity duration-200 ${pos ? 'opacity-0' : 'opacity-100'}`} style={{ background: 'rgba(23,18,15,0.72)', color: '#fff' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3M11 8v6M8 11h6" /></svg>
        Pasa el cursor para ampliar
      </div>
      {pos && (
        <div
          className="hidden md:block pointer-events-none absolute rounded-xl"
          style={{
            width: lens, height: lens, left: pos.x - lens / 2, top: pos.y - lens / 2,
            backgroundImage: `url(${src})`, backgroundRepeat: 'no-repeat',
            backgroundSize: `${pos.bw}px ${pos.bh}px`, backgroundPosition: `${pos.bgX}px ${pos.bgY}px`,
            border: '3px solid #fff', boxShadow: '0 16px 48px rgba(23,18,15,0.38)',
          }}
        />
      )}
    </div>
  );
}

/* Browser window frame with a real desktop screenshot */
function BrowserFrame({ src, alt, url = 'menuby.tech/panel' }) {
  return (
    <div className="rounded-2xl overflow-hidden mx-auto w-full" style={{ background: '#fff', border: '1px solid ' + C.border, boxShadow: '0 34px 80px rgba(23,18,15,0.18)', maxWidth: '820px' }}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: C.surface, borderBottom: '1px solid ' + C.borderLight }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#F87171' }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#FBBF24' }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#34D399' }} />
        <div className="mx-auto text-[11px] px-4 py-1 rounded-full" style={{ background: '#fff', border: '1px solid ' + C.borderLight, color: C.muted }}>{url}</div>
      </div>
      <ZoomImage src={src} alt={alt} />
    </div>
  );
}

/* Phone frame with a real product screenshot (no fake mockup) */
function PhoneShot({ src, alt }) {
  return (
    <div className="w-[280px] sm:w-[300px] mx-auto">
      <div className="rounded-[2.8rem] p-[10px]" style={{ background: 'linear-gradient(145deg, #2a2320, #171210, #0a0806)', boxShadow: '0 40px 90px rgba(23,18,15,0.32), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
        <div className="rounded-[2.2rem] overflow-hidden relative" style={{ background: C.bg, height: '560px' }}>
          <img src={src} alt={alt} className="w-full h-full object-cover object-top" width="804" height="1720" loading="eager" fetchpriority="high" />
        </div>
      </div>
    </div>
  );
}

/* ===============================================================
   REAL PHONE MOCKUP — live iframe of the actual menu, on click
   =============================================================== */
function RealMenuMockup() {
  const [activated, setActivated] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '200px' });

  return (
    <div className="relative select-none" ref={ref}>
      <div className="w-[280px] sm:w-[300px] mx-auto">
        <div className="rounded-[2.8rem] p-[10px]" style={{ background: 'linear-gradient(145deg, #2a2320, #171210, #0a0806)', boxShadow: '0 40px 90px rgba(23,18,15,0.32), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
          <div className="rounded-[2.2rem] overflow-hidden relative" style={{ background: C.bg, height: '560px' }}>
            {!activated ? (
              <button
                onClick={() => setActivated(true)}
                className="absolute inset-0 z-10 cursor-pointer group w-full"
                style={{ background: C.bg }}
              >
                <img src="/screenshots/fraise-menu.webp" alt="Menú de Fraise en Menuby" className="absolute inset-0 w-full h-full object-cover object-top" loading="lazy" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-[2.2rem]">
                  <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-xl">
                    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill={C.accent}><path d="M8 5v14l11-7z" /></svg>
                  </div>
                </div>
                <span className="text-[10px] font-semibold absolute bottom-3 left-0 right-0 text-center px-2 py-1" style={{ color: C.text }}>
                  <span className="px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.9)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>Toca para probar el menú real →</span>
                </span>
              </button>
            ) : (
              <>
                {!iframeLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-10" style={{ background: C.bg }}>
                    <div className="w-8 h-8 rounded-full border-2 border-transparent mb-3 animate-spin" style={{ borderTopColor: C.accent, borderRightColor: C.accent }} />
                    <p className="text-[11px] font-medium" style={{ color: C.muted }}>Cargando menú real…</p>
                  </div>
                )}
                {isInView && (
                  <iframe
                    src="/macdonalds/"
                    title="Menú demo - Menuby"
                    className="w-full h-full border-0"
                    style={{ borderRadius: '2.2rem', opacity: iframeLoaded ? 1 : 0, transition: 'opacity 0.5s ease' }}
                    onLoad={() => setIframeLoaded(true)}
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* === KDS MOCKUP === */
function KDSMockup() {
  const [now, setNow] = useState(new Date());
  const [orders, setOrders] = useState([
    { id: 1, table: 'Mesa 4', items: ['Big Mac x1', 'Coca-Cola x2'], startSecs: 263, priority: 'high' },
    { id: 2, table: 'Mesa 7', items: ['McNuggets x10', 'McFlurry x1'], startSecs: 131, priority: 'normal' },
    { id: 3, table: 'Domicilio #38', items: ['Cuarto de Libra x2', 'Papas Grandes x2'], startSecs: 475, priority: 'urgent' },
  ]);

  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
      setOrders((prev) => prev.map((o) => ({ ...o, startSecs: o.startSecs + 1 })));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const fmtTime = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const priorityStyle = (p) =>
    p === 'urgent' ? { bg: '#FEE2E2', border: '#FECACA', dot: '#EF4444', text: '#991B1B' }
    : p === 'high' ? { bg: '#FEF3C7', border: '#FDE68A', dot: '#F59E0B', text: '#92400E' }
    : { bg: '#F0FDF4', border: '#BBF7D0', dot: '#10B981', text: '#064E3B' };
  const handleDone = (id) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
    setTimeout(() => setOrders((prev) => [...prev, { id: Date.now(), table: 'Mesa ' + (Math.floor(Math.random() * 12) + 1), items: ['Producto nuevo x1'], startSecs: 0, priority: 'normal' }]), 1500);
  };
  const time = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className="relative select-none">
      <div className="w-[340px] sm:w-[380px] mx-auto">
        <div className="rounded-2xl overflow-hidden" style={{ background: '#151210', boxShadow: '0 30px 70px rgba(23,18,15,0.35)' }}>
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[11px] font-bold text-white/90">KDS — Cocina</span>
            </div>
            <span className="text-[10px] text-white/70" style={{ fontFamily: "'Geist Mono', monospace" }}>{time}</span>
          </div>
          <div className="p-3 space-y-2.5" style={{ minHeight: '320px' }}>
            <AnimatePresence>
              {orders.map((order) => {
                const ps = priorityStyle(order.priority);
                const isLate = order.startSecs > 300;
                return (
                  <motion.div key={order.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: 100, scale: 0.9 }} layout className="rounded-xl p-3" style={{ background: ps.bg, border: '1px solid ' + ps.border }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: ps.dot }} />
                        <span className="text-[12px] font-extrabold" style={{ color: ps.text }}>{order.table}</span>
                      </div>
                      <span className="text-[11px] font-bold" style={{ color: isLate ? '#DC2626' : ps.text, fontFamily: "'Geist Mono', monospace" }}>{fmtTime(order.startSecs)}</span>
                    </div>
                    <div className="space-y-1 mb-2.5">
                      {order.items.map((item, idx) => <p key={idx} className="text-[11px] font-medium" style={{ color: ps.text + 'CC' }}>{item}</p>)}
                    </div>
                    <button onClick={() => handleDone(order.id)} className="w-full py-1.5 rounded-lg text-[10px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.97]" style={{ background: '#10B981' }}>Marcar como listo</button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

/* === DASHBOARD MOCKUP === */
function DashboardMockup() {
  const kpis = [
    { label: 'Ventas hoy', value: '$1.2M', change: '+12%', up: true },
    { label: 'Pedidos', value: '47', change: '+8%', up: true },
    { label: 'Ticket promedio', value: '$25.5K', change: '-3%', up: false },
    { label: 'Clientes nuevos', value: '12', change: '+24%', up: true },
  ];
  const barData = [
    { day: 'Lun', h: 45 }, { day: 'Mar', h: 62 }, { day: 'Mié', h: 55 }, { day: 'Jue', h: 78 },
    { day: 'Vie', h: 92 }, { day: 'Sáb', h: 100 }, { day: 'Dom', h: 70 },
  ];
  const topProducts = [
    { name: 'Big Mac', sold: 156, pct: 100 }, { name: 'McNuggets x10', sold: 98, pct: 63 },
    { name: 'McFlurry Oreo', sold: 87, pct: 56 }, { name: 'Cuarto de Libra', sold: 72, pct: 46 },
  ];
  return (
    <div className="relative select-none">
      <div className="w-full max-w-[480px] mx-auto">
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', boxShadow: '0 30px 70px rgba(23,18,15,0.14)', border: '1px solid ' + C.border }}>
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid ' + C.borderLight }}>
            <div>
              <p className="text-[13px] font-extrabold" style={{ color: C.text }}>Dashboard</p>
              <p className="text-[10px]" style={{ color: C.muted }}>Hoy · Abril 2026</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-2.5">
              {kpis.map((k) => (
                <div key={k.label} className="rounded-xl p-3" style={{ background: C.bg, border: '1px solid ' + C.borderLight }}>
                  <p className="text-[9px] font-medium mb-1" style={{ color: C.muted }}>{k.label}</p>
                  <p className="text-[16px] font-extrabold" style={{ color: C.text, fontFamily: "'Geist Mono', monospace" }}>{k.value}</p>
                  <span className={`text-[9px] font-bold ${k.up ? 'text-emerald-600' : 'text-red-500'}`}>{k.change}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl p-3" style={{ background: C.bg, border: '1px solid ' + C.borderLight }}>
              <p className="text-[10px] font-bold mb-3" style={{ color: C.text }}>Ventas esta semana</p>
              <div className="flex items-end justify-between gap-1.5" style={{ height: '80px' }}>
                {barData.map((b, i) => (
                  <div key={b.day} className="flex flex-col items-center gap-1 flex-1">
                    <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.8, delay: i * 0.08, ease: 'easeOut' }} className="w-full rounded-t-md" style={{ background: i === 5 ? C.accent : C.accent + '2E', minHeight: '4px', height: b.h + '%', transformOrigin: 'bottom' }} />
                    <span className="text-[8px] font-medium" style={{ color: C.muted }}>{b.day}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl p-3" style={{ background: C.bg, border: '1px solid ' + C.borderLight }}>
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
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.elevated }}>
                        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1, delay: 0.3 + i * 0.1 }} className="h-full rounded-full" style={{ background: i === 0 ? C.accent : C.accent + '60', width: p.pct + '%', transformOrigin: 'left' }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* === DATA === */
const FAQ_DATA = [
  { q: '¿Necesito tarjeta de crédito para empezar?', a: 'No. El plan Gratis es completamente gratis, sin tarjeta ni prueba temporal. Solo creas tu cuenta y empiezas.' },
  { q: '¿Cuánto se demora configurar mi menú?', a: 'En promedio 5 minutos. Solo necesitas tu logo, los nombres de tus productos y los precios. Puedes agregar fotos después.' },
  { q: '¿Funciona sin internet en el restaurante?', a: 'El menú del cliente funciona con la conexión del celular del cliente. Tu panel de admin necesita internet, pero tiene modo offline para emergencias.' },
  { q: '¿Cobran comisión por pedido?', a: 'Jamás. Todos los planes tienen 0% de comisión. Pagas una tarifa fija mensual y cada peso que vendes es tuyo.' },
  { q: '¿Puedo cancelar en cualquier momento?', a: 'Sí. Sin contratos, sin penalidades. Tu cuenta queda activa en plan Gratis y no pierdes tus datos.' },
  { q: '¿Funciona con impresoras térmicas?', a: 'Sí. Menuby tiene Autoprint: los pedidos se imprimen automáticamente en tu impresora térmica. Compatible con las principales marcas.' },
];

/* ===== Comparación Sin/Con Menuby + confeti en hover ===== */
const CONFETTI_COLORS = ['#E8002D', '#0E7A4F', '#F5A623', '#FF6B9D', '#3B82F6', '#A855F7', '#FFC94A'];

function Confetti({ fire }) {
  const pieces = React.useMemo(
    () => Array.from({ length: 22 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 360,
      y: -70 - Math.random() * 180,
      rot: (Math.random() - 0.5) * 640,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      delay: Math.random() * 0.1,
      dur: 0.9 + Math.random() * 0.5,
      round: Math.random() > 0.6,
    })),
    [fire]
  );
  return (
    <div className="absolute inset-x-0 top-0 h-0 pointer-events-none flex justify-center z-20" aria-hidden="true">
      <AnimatePresence>
        {fire > 0 &&
          pieces.map((p) => (
            <motion.span
              key={`${fire}-${p.id}`}
              initial={{ opacity: 1, x: 0, y: 40, rotate: 0 }}
              animate={{ opacity: [1, 1, 0], x: p.x, y: p.y, rotate: p.rot }}
              transition={{ duration: p.dur, delay: p.delay, ease: [0.2, 0.7, 0.3, 1] }}
              style={{ position: 'absolute', width: p.w, height: p.h, background: p.color, borderRadius: p.round ? '50%' : 2 }}
            />
          ))}
      </AnimatePresence>
    </div>
  );
}

const SIN_ITEMS = ['Pedidos por WhatsApp que se pierden en el chat', 'Comisiones del 15–30% a plataformas de delivery', 'Sin datos: no sabes qué se vendió ni cuánto', 'Cocina desorganizada, pedidos a gritos', 'Clientes que no vuelven porque no los fidelizas'];
const CON_ITEMS = ['Pedidos en tiempo real a tu panel con push', '0% comisión — tus ventas son 100% tuyas', 'Analytics completo: ventas, productos top, ticket', 'KDS con timers para una cocina organizada', 'Programa de lealtad con puntos y recompensas'];

function ComparisonCards() {
  const [fire, setFire] = useState(0);
  return (
    <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto items-stretch">
      {/* --- SIN MENUBY (estado apagado) --- */}
      <FadeInWhenVisible>
        <div className="rounded-3xl p-7 h-full" style={{ background: C.surface, border: '1px solid ' + C.border }}>
          <div className="inline-flex items-center gap-2 mb-6 text-[12px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>
            <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: C.elevated }}><X size={13} style={{ color: C.muted }} /></span>
            Sin Menuby
          </div>
          <ul className="space-y-3.5">
            {SIN_ITEMS.map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-[13.5px] leading-snug" style={{ color: C.muted }}>
                <span className="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background: C.elevated }}><X size={13} style={{ color: '#B7ABA0' }} /></span> {t}
              </li>
            ))}
          </ul>
        </div>
      </FadeInWhenVisible>

      {/* --- CON MENUBY (premium claro + confeti) --- */}
      <FadeInWhenVisible delay={0.1}>
        <motion.div
          onHoverStart={() => setFire((f) => f + 1)}
          whileHover={{ y: -4 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          className="rounded-3xl p-7 h-full relative overflow-visible cursor-default"
          style={{ background: `linear-gradient(158deg, #FFFFFF 0%, ${C.blush} 100%)`, border: '1px solid ' + C.border, boxShadow: '0 20px 50px rgba(232,0,45,0.12), 0 6px 18px rgba(23,18,15,0.06)' }}
        >
          <Confetti fire={fire} />
          {/* halo cálido esquina */}
          <div className="absolute -top-14 -right-14 w-48 h-48 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(232,0,45,0.10), transparent 68%)' }} aria-hidden="true" />
          <div className="relative">
            <div className="flex items-center justify-between mb-6">
              <div className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide" style={{ color: C.accent }}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ background: C.accent, boxShadow: '0 0 0 4px rgba(232,0,45,0.14)' }}><Check size={13} strokeWidth={3} /></span>
                Con Menuby
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full text-white" style={{ background: C.accent, boxShadow: '0 4px 12px rgba(232,0,45,0.28)' }}>Recomendado</span>
            </div>
            <ul className="space-y-3.5">
              {CON_ITEMS.map((t) => (
                <li key={t} className="flex items-start gap-3 text-[13.5px] leading-snug font-semibold" style={{ color: C.text }}>
                  <span className="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background: 'rgba(14,122,79,0.12)' }}><Check size={13} strokeWidth={3} style={{ color: C.green }} /></span> {t}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </FadeInWhenVisible>
    </div>
  );
}

function FAQAccordion() {
  const [open, setOpen] = useState(0);
  return (
    <div className="max-w-2xl mx-auto space-y-2.5">
      {FAQ_DATA.map((item, i) => (
        <div key={i} className="rounded-2xl overflow-hidden transition-shadow" style={{ border: '1px solid ' + (open === i ? C.border : C.borderLight), background: C.card, boxShadow: open === i ? '0 8px 30px rgba(23,18,15,0.05)' : 'none' }}>
          <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left" aria-expanded={open === i}>
            <span className="text-[14px] font-semibold pr-4" style={{ color: C.text }}>{item.q}</span>
            <motion.div animate={{ rotate: open === i ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: open === i ? C.accent : C.surface }}>
              <ChevronDown size={14} style={{ color: open === i ? '#fff' : C.muted }} />
            </motion.div>
          </button>
          <AnimatePresence>
            {open === i && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
                <p className="px-5 pb-4 text-[13px] leading-relaxed" style={{ color: C.muted }}>{item.a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

const PLANS = [
  { id: 'free', name: 'Gratis', desc: '20 productos · 30 pedidos/mes', monthly: 0, quarterly: 0, semiannual: 0, annual: 0, popular: false, features: ['Menú digital con QR', '5 categorías, 5 mesas', 'Carrito básico', 'Logo y portada', '1 zona de entrega'], cta: 'Empezar gratis' },
  { id: 'starter', name: 'Starter', desc: '60 productos · 350 pedidos/mes', monthly: 39900, quarterly: 37900, semiannual: 35900, annual: 34900, popular: false, features: ['Todo de Gratis', 'Push notifications', 'Zonas de entrega ilimitadas', 'Toppings y extras', 'KDS básico + Autoprint'], cta: 'Comenzar con Starter' },
  { id: 'pro', name: 'Pro', desc: 'Ilimitado en todo', monthly: 59900, quarterly: 56900, semiannual: 52900, annual: 49900, popular: true, features: ['Todo de Starter', 'Pedidos ilimitados', 'Reservas y recordatorios', 'Lealtad con niveles', 'Analytics completo + IA'], cta: 'Elegir Pro' },
  { id: 'promax', name: 'Pro Max', desc: 'Lo mejor de Menuby', monthly: 89900, quarterly: 84900, semiannual: 79900, annual: 74900, popular: false, features: ['Todo de Pro', 'Soporte prioritario', 'Acceso anticipado', 'Eventos exclusivos', 'Tutoriales premium'], cta: 'Ir con Pro Max' },
];

const CYCLES = [
  { id: 'monthly', label: 'Mensual', months: 1, badge: null },
  { id: 'quarterly', label: 'Trimestral', months: 3, badge: 'Ahorra 5%' },
  { id: 'semiannual', label: 'Semestral', months: 6, badge: 'Ahorra 10%' },
  { id: 'annual', label: 'Anual', months: 12, badge: 'Ahorra 2 meses' },
];

/* Honest "made for" categories — real business types, not fabricated customer logos */
const CATEGORIES = [
  { label: 'Hamburgueserías', icon: Beef }, { label: 'Pizzerías', icon: Pizza },
  { label: 'Cafés', icon: Coffee }, { label: 'Bares', icon: Wine },
  { label: 'Heladerías', icon: IceCreamCone }, { label: 'Panaderías', icon: Croissant },
  { label: 'Sushi', icon: UtensilsCrossed }, { label: 'Asaderos', icon: ChefHat },
  { label: 'Sándwiches', icon: Sandwich }, { label: 'Sopas y cazuelas', icon: Soup },
  { label: 'Food trucks', icon: UtensilsCrossed }, { label: 'Comida rápida', icon: Beef },
];

/* Real customers already using Menuby — honest, named social proof */
const CUSTOMERS = [
  { name: 'GO BURGER', logo: '/customers/go-burger.png' },
  { name: 'Fraise', logo: '/customers/fraise.webp' },
  { name: 'Cremu', logo: '/customers/cremu.webp' },
  { name: 'Las 4 en Punto', logo: '/customers/las-4-en-punto.webp' },
  { name: 'Kalunga', logo: '/customers/kalunga.webp' },
  { name: 'Caprichosos', logo: '/customers/caprichosos.webp' },
];

/* Features — first is the flagship (big bento cell), rest fill the grid */
const FEATURES = [
  { icon: QrCode, label: 'Menú digital', title: 'Tu carta completa en el celular de cada cliente', desc: 'Categorías, fotos en alta resolución, toppings, buscador y favoritos — todo desde un QR en la mesa.', color: '#E8002D', details: ['Categorías ilimitadas', 'Toppings y extras', 'Búsqueda y favoritos', 'QR por mesa'] },
  { icon: Bell, label: 'Tiempo real', title: 'Cada pedido llega al instante', desc: 'Con sonido, notificación push y el comprobante de pago adjunto. En sitio o a domicilio.', color: '#FF5A1F', details: ['Push al admin y cliente', 'Seguimiento en vivo', 'Comprobante de pago'] },
  { icon: Monitor, label: 'Pantalla de cocina', title: 'Cocina sin gritos ni papeles', desc: 'Timers, prioridad automática y botón para marcar como listo que avisa al cliente.', color: '#0891B2', details: ['Timers en vivo', 'Autoprint', 'Multi-pantalla'] },
  { icon: Gift, label: 'Fidelización', title: 'Haz que vuelvan', desc: 'Puntos por compra, niveles con beneficios y recompensas canjeables desde el menú.', color: '#D97706', details: ['Puntos y niveles', 'Cupones', 'Canje directo'] },
  { icon: BarChart3, label: 'Analytics e IA', title: 'Datos que deciden por ti', desc: 'Ventas, productos top, ticket promedio y herramientas de IA para tu contenido.', color: '#0E7A4F', details: ['Ventas en vivo', 'Productos top', 'IA integrada'] },
  { icon: MapPin, label: 'Delivery propio', title: 'Sin intermediarios', desc: 'Zonas con costos diferenciados, tracking en vivo y QR por zona. 0% comisión.', color: '#7C3AED', details: ['Zonas geográficas', 'Tracking en vivo', 'Sin comisiones'] },
  { icon: CalendarCheck, label: 'Reservas', title: 'Agenda inteligente', desc: 'Tus clientes reservan desde el menú. Recordatorios automáticos por push y WhatsApp.', color: '#DB2777', details: ['Slots configurables', 'Recordatorios auto', 'Vista calendario'] },
  { icon: Palette, label: 'Tu marca', title: 'Tu estilo, tu menú', desc: 'Colores, logo, portada, banners y splash — cada detalle con la identidad de tu negocio.', color: '#2563EB', details: ['Colores propios', 'Banners', 'Splash screen'] },
];

const COMPARE = [
  { label: 'Comisión por pedido', menuby: '0%, siempre', apps: '15% – 30%' },
  { label: 'Tus clientes y sus datos', menuby: 'Son tuyos', apps: 'De la plataforma' },
  { label: 'Tu marca y tu menú', menuby: 'Tu marca, tu link y QR', apps: 'Dentro de su app' },
  { label: 'Fidelización (puntos, cupones)', menuby: true, apps: false },
  { label: 'Pantalla de cocina (KDS)', menuby: true, apps: false },
  { label: 'Pedidos en sitio y para llevar', menuby: true, apps: false },
  { label: 'Control de precios y promociones', menuby: 'Total', apps: 'Limitado' },
  { label: 'Costo', menuby: 'Tarifa fija desde $0', apps: 'Comisión sobre cada venta' },
];

const STEPS = [
  { num: '1', title: 'Crea tu cuenta', desc: 'Regístrate gratis en 30 segundos. Sin tarjeta, sin compromisos.', icon: Zap },
  { num: '2', title: 'Arma tu menú', desc: 'Sube productos con fotos, precios y toppings. El asistente te guía.', icon: Smartphone },
  { num: '3', title: 'Recibe pedidos', desc: 'Comparte tu QR o link. Los pedidos llegan en tiempo real a tu panel.', icon: Bell },
];

const TESTIMONIALS = [
  { name: 'Carlos M.', role: 'Dueño · Burger Lab', city: 'Bogotá', text: 'Pasamos de recibir pedidos por WhatsApp a tener todo organizado en un solo lugar. Los pedidos ya no se pierden y la cocina funciona mucho mejor con el KDS.', stars: 5 },
  { name: 'Laura P.', role: 'Administradora · Sabor Criollo', city: 'Medellín', text: 'Lo que más me gustó es que no cobran comisión. Con las plataformas de delivery perdíamos el 25%. Ahora cada peso es nuestro.', stars: 5 },
  { name: 'Diego R.', role: 'Chef · Wok & Roll', city: 'Cali', text: 'El programa de lealtad ha sido increíble. Los clientes acumulan puntos y vuelven. Vimos un aumento del 30% en clientes recurrentes.', stars: 5 },
];

/* ===============================================================
   MAIN
   =============================================================== */
export default function Home() {
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [demoTab, setDemoTab] = useState(0);
  const [showSticky, setShowSticky] = useState(false);
  const [monthlySales, setMonthlySales] = useState(12000000);
  const [commissionPct, setCommissionPct] = useState(25);

  const statsRef = useRef(null);
  const statsInView = useInView(statsRef, { once: true, margin: '-80px' });

  // Sticky mobile CTA — appears once the hero has scrolled past (IntersectionObserver, no scroll listener)
  const heroEndRef = useRef(null);
  useEffect(() => {
    const el = heroEndRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => setShowSticky(e.boundingClientRect.top < 0),
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useLandingSEO({
    title: 'Menuby — Menú Digital y Pedidos para Restaurantes en Colombia',
    description: 'Menú digital, pedidos en tiempo real, pantalla de cocina, fidelización y analytics. Todo en uno. Sin comisiones. Desde $0.',
    canonical: '/',
    keywords: 'menu digital restaurante colombia, sistema restaurantes, software restaurantes, menu QR, pedidos en linea, KDS cocina',
  });

  const demoTabs = [
    { label: 'Menú del cliente', icon: Smartphone },
    { label: 'Panel de control', icon: BarChart3 },
  ];

  const flagship = FEATURES[0];
  const rest = FEATURES.slice(1);

  const lossMonth = Math.round(monthlySales * commissionPct / 100);
  const savingsYear = lossMonth * 12;
  const salesPct = ((monthlySales - 1000000) / 59000000) * 100;

  return (
    <div style={{ fontFamily: BODY, color: C.text, background: C.bg, overflowX: 'hidden' }}>
      <style>{`
        .hd { font-family: ${DISPLAY}; font-weight: 800; letter-spacing: -0.035em; line-height: 0.98; }
        .hd-sub { font-family: ${DISPLAY}; font-weight: 700; letter-spacing: -0.03em; line-height: 1.02; }
        @keyframes marquee-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .marquee-track { animation: marquee-scroll 40s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .marquee-track { animation: none; } }
        .range-red { -webkit-appearance: none; appearance: none; height: 8px; border-radius: 999px; outline: none; }
        .range-red::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 26px; height: 26px; border-radius: 50%; background: #fff; border: 3px solid ${C.accent}; box-shadow: 0 4px 12px rgba(232,0,45,0.35); cursor: pointer; margin-top: -1px; transition: transform .15s ease; }
        .range-red::-webkit-slider-thumb:active { transform: scale(1.12); }
        .range-red::-moz-range-thumb { width: 26px; height: 26px; border-radius: 50%; background: #fff; border: 3px solid ${C.accent}; box-shadow: 0 4px 12px rgba(232,0,45,0.35); cursor: pointer; }
      `}</style>

      {/* ========== HERO ========== */}
      <div
        className="relative"
        style={{ background: `radial-gradient(1100px 620px at 82% -8%, rgba(232,0,45,0.07), transparent 62%), radial-gradient(760px 520px at 8% 30%, rgba(255,90,31,0.045), transparent 60%), ${C.bg}` }}
      >
        <Section className="pt-20 sm:pt-24 lg:pt-28 pb-16 sm:pb-24">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
            <div className="lg:-mt-16">
              <FadeInWhenVisible delay={0}>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold mb-6" style={{ background: '#fff', color: C.accent, border: '1px solid ' + C.border, boxShadow: '0 2px 12px rgba(23,18,15,0.04)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.green }} />
                  0% comisiones · para siempre
                </div>
              </FadeInWhenVisible>

              <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.05, ease: [0.22, 1, 0.36, 1] }} className="hd text-[3rem] sm:text-[4rem] lg:text-[4.6rem] mb-6" style={{ color: C.text }}>
                Tu restaurante<br />merece{' '}
                <span className="relative inline-block" style={{ color: C.accent }}>
                  más
                  <motion.svg initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.7, ease: 'easeOut' }} className="absolute -bottom-2 left-0 w-full" viewBox="0 0 100 8" fill="none" aria-hidden="true">
                    <motion.path d="M2 6C20 2 40 2 50 4C60 6 80 3 98 2" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" fill="none" />
                  </motion.svg>
                </span>
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }} className="text-[16px] sm:text-[17px] leading-relaxed mb-8 max-w-lg" style={{ color: C.textSecondary }}>
                Menú digital, pedidos en tiempo real, pantalla de cocina y fidelización — en una sola plataforma hecha en Colombia. Sin comisiones, sin intermediarios.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.32 }} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
                <Link to="/register" className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full text-white text-[15px] font-bold transition-transform active:scale-[0.97]" style={{ background: C.accent, boxShadow: '0 12px 34px rgba(232,0,45,0.28)' }}>
                  Crear mi menú gratis
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
                <a href="#demo" className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full text-[15px] font-bold transition-colors" style={{ background: '#fff', color: C.text, border: '1px solid ' + C.border }}>
                  Ver demo en vivo
                </a>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.5 }} className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] font-medium" style={{ color: C.muted }}>
                {['Sin tarjeta de crédito', 'Listo en 5 minutos', 'Cancela cuando quieras'].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5"><Check size={14} style={{ color: C.green }} strokeWidth={3} />{t}</span>
                ))}
              </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.9, delay: 0.25, ease: [0.22, 1, 0.36, 1] }} className="relative">
              <PhoneShot src="/screenshots/fraise-menu.webp" alt="Menú digital de Fraise en Menuby" />

              {/* Floating "new order" toast */}
              <motion.div
                initial={{ opacity: 0, y: 12, x: -8 }} animate={{ opacity: 1, y: 0, x: 0 }} transition={{ delay: 1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="hidden sm:flex absolute top-16 -left-4 lg:-left-8 items-center gap-2.5 rounded-2xl pl-2.5 pr-4 py-2.5 z-10"
                style={{ background: '#fff', border: '1px solid ' + C.borderLight, boxShadow: '0 16px 40px rgba(23,18,15,0.14)' }}
              >
                <span className="relative flex w-9 h-9">
                  <span className="absolute inline-flex h-full w-full rounded-xl opacity-40 animate-ping" style={{ background: C.green }} />
                  <span className="relative inline-flex rounded-xl w-9 h-9 items-center justify-center" style={{ background: C.green + '18' }}><Bell size={16} style={{ color: C.green }} /></span>
                </span>
                <div>
                  <p className="text-[12px] font-extrabold leading-tight" style={{ color: C.text }}>Nuevo pedido · Mesa 4</p>
                  <p className="text-[10.5px] leading-tight" style={{ color: C.muted }}>$28.900 · hace 3s</p>
                </div>
              </motion.div>

              {/* Floating sales stat */}
              <motion.div
                initial={{ opacity: 0, y: 12, x: 8 }} animate={{ opacity: 1, y: 0, x: 0 }} transition={{ delay: 1.25, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="hidden sm:block absolute bottom-20 -right-3 lg:-right-7 rounded-2xl px-4 py-3 z-10"
                style={{ background: '#fff', border: '1px solid ' + C.borderLight, boxShadow: '0 16px 40px rgba(23,18,15,0.14)' }}
              >
                <p className="text-[9.5px] font-bold uppercase tracking-wider mb-0.5" style={{ color: C.muted }}>Ventas hoy</p>
                <p className="hd text-[1.35rem] leading-none mb-1" style={{ color: C.text }}>$1.240.000</p>
                <p className="text-[10px] font-bold inline-flex items-center gap-1" style={{ color: C.green }}><TrendingUp size={11} /> 12% vs. ayer</p>
              </motion.div>
            </motion.div>
          </div>
        </Section>

        {/* Real customer logos — social proof */}
        <div className="py-9 sm:py-11" style={{ borderTop: '1px solid ' + C.borderLight, borderBottom: '1px solid ' + C.borderLight, background: '#fff' }}>
          <div className="max-w-5xl mx-auto px-5">
            <p className="text-center text-[11px] font-bold tracking-[0.16em] uppercase mb-6" style={{ color: C.muted }}>
              Restaurantes que ya venden con Menuby
            </p>
            <StaggerContainer className="grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4" stagger={0.06}>
              {CUSTOMERS.map((c) => (
                <motion.div
                  key={c.name}
                  variants={staggerChild}
                  className="h-16 sm:h-[76px] rounded-2xl flex items-center justify-center p-2.5 sm:p-3 transition-shadow duration-300 hover:shadow-[0_8px_24px_rgba(23,18,15,0.08)]"
                  style={{ background: C.bg, border: '1px solid ' + C.borderLight }}
                  title={c.name}
                >
                  <img src={c.logo} alt={c.name} loading="lazy" className="max-h-full max-w-full object-contain" style={{ borderRadius: '8px' }} />
                </motion.div>
              ))}
            </StaggerContainer>
          </div>
        </div>
      </div>

      {/* Sentinel: marks the end of the hero for the sticky mobile CTA */}
      <div ref={heroEndRef} aria-hidden="true" />

      {/* ========== CÓMO FUNCIONA ========== */}
      <Section id="como-funciona" className="py-20 sm:py-28">
        <FadeInWhenVisible>
          <div className="text-center mb-14">
            <Eyebrow>Cómo funciona</Eyebrow>
            <h2 className="hd-sub text-[2rem] sm:text-[2.6rem] mb-3" style={{ color: C.text }}>En 3 pasos estás operando</h2>
            <p className="text-[15px] max-w-md mx-auto" style={{ color: C.muted }}>Sin técnico, sin capacitación, sin hardware especial.</p>
          </div>
        </FadeInWhenVisible>

        <StaggerContainer className="grid md:grid-cols-3 gap-6 relative pt-7">
          {STEPS.map((step) => (
            <motion.div key={step.num} variants={staggerChild} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }} className="relative rounded-3xl p-7 pt-9" style={{ background: C.card, border: '1px solid ' + C.borderLight, boxShadow: '0 10px 34px rgba(23,18,15,0.05)' }}>
              {/* número flotante sobrepuesto */}
              <div className="absolute -top-5 left-7 w-12 h-12 rounded-2xl flex items-center justify-center text-[22px] font-extrabold text-white select-none" style={{ background: C.accent, fontFamily: DISPLAY, boxShadow: '0 8px 20px rgba(232,0,45,0.30)', border: '3px solid ' + C.bg, lineHeight: 1 }}>
                {step.num}
              </div>
              <div className="flex justify-end mb-4">
                <span className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: C.blush }}><step.icon size={20} style={{ color: C.accent }} /></span>
              </div>
              <h3 className="hd-sub text-[1.35rem] mb-2" style={{ color: C.text }}>{step.title}</h3>
              <p className="text-[14px] leading-relaxed" style={{ color: C.muted }}>{step.desc}</p>
            </motion.div>
          ))}
        </StaggerContainer>
      </Section>

      {/* ========== COMPARACIÓN ========== */}
      <div style={{ background: C.surface, borderTop: '1px solid ' + C.borderLight, borderBottom: '1px solid ' + C.borderLight }}>
        <Section className="py-20 sm:py-28">
          <FadeInWhenVisible>
            <div className="text-center mb-14">
              <Eyebrow>El cambio</Eyebrow>
              <h2 className="hd-sub text-[2rem] sm:text-[2.6rem]" style={{ color: C.text }}>De caos a control en 5 minutos</h2>
            </div>
          </FadeInWhenVisible>

          <ComparisonCards />
        </Section>
      </div>

      {/* ========== FUNCIONES — BENTO ========== */}
      <Section id="funciones" className="py-20 sm:py-28">
        <FadeInWhenVisible>
          <div className="mb-14 max-w-2xl">
            <Eyebrow>Funciones</Eyebrow>
            <h2 className="hd-sub text-[2rem] sm:text-[2.8rem] mb-3" style={{ color: C.text }}>Todo lo que tu restaurante necesita, en un solo lugar</h2>
            <p className="text-[15px]" style={{ color: C.muted }}>Ocho módulos que trabajan juntos. Sin integraciones, sin dolores de cabeza.</p>
          </div>
        </FadeInWhenVisible>

        <StaggerContainer className="grid md:grid-cols-3 gap-4" stagger={0.06}>
          {/* Flagship cell */}
          <motion.div variants={staggerChild} className="md:col-span-2 md:row-span-2 rounded-[28px] p-8 relative overflow-hidden flex flex-col justify-between" style={{ background: `linear-gradient(155deg, #fff, ${C.blush})`, border: '1px solid ' + C.border, minHeight: '400px' }}>
            {/* Lifestyle photo bleeding on the right, masked to blend into the card */}
            <img
              src="/landing/menu-lifestyle.webp"
              alt="Cliente viendo el menú digital de un restaurante en su celular"
              className="hidden md:block absolute right-0 top-0 h-full w-[54%] object-cover pointer-events-none select-none"
              style={{ objectPosition: '60% center', WebkitMaskImage: 'linear-gradient(to right, transparent 0%, #000 38%)', maskImage: 'linear-gradient(to right, transparent 0%, #000 38%)' }}
              loading="lazy"
            />
            <div className="relative z-10 max-w-sm">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ background: flagship.color + '14' }}>
                <flagship.icon size={24} style={{ color: flagship.color }} />
              </div>
              <p className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: flagship.color }}>{flagship.label}</p>
              <h3 className="hd-sub text-[1.7rem] sm:text-[2rem] mb-3" style={{ color: C.text }}>{flagship.title}</h3>
              <p className="text-[14.5px] leading-relaxed mb-5" style={{ color: C.textSecondary }}>{flagship.desc}</p>
              <div className="flex flex-wrap gap-2">
                {flagship.details.map((d) => (
                  <span key={d} className="text-[12px] font-semibold px-3 py-1.5 rounded-full" style={{ background: '#fff', border: '1px solid ' + C.borderLight, color: C.text }}>{d}</span>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Remaining cells */}
          {rest.map((feat) => (
            <motion.div
              key={feat.label}
              variants={staggerChild}
              whileHover={{ y: -5 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="group rounded-[28px] p-6 transition-shadow duration-300 hover:shadow-[0_22px_50px_rgba(23,18,15,0.09)]"
              style={{ background: C.card, border: '1px solid ' + C.borderLight }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3" style={{ background: feat.color + '14' }}>
                <feat.icon size={21} style={{ color: feat.color }} />
              </div>
              <p className="text-[10.5px] font-bold tracking-[0.12em] uppercase mb-1.5" style={{ color: feat.color }}>{feat.label}</p>
              <h3 className="text-[15px] font-extrabold mb-1.5" style={{ color: C.text, fontFamily: DISPLAY, letterSpacing: '-0.02em' }}>{feat.title}</h3>
              <p className="text-[13px] leading-relaxed" style={{ color: C.muted }}>{feat.desc}</p>
            </motion.div>
          ))}
        </StaggerContainer>
      </Section>

      {/* ========== AUTOPRINT ========== */}
      <Section className="pb-4 sm:pb-8">
        <FadeInWhenVisible>
          <div className="rounded-[36px] p-7 sm:p-12 relative overflow-hidden" style={{ background: `linear-gradient(160deg, #fff, ${C.blush})`, border: '1px solid ' + C.border }}>
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
              {/* Text */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-[0.12em] uppercase mb-5" style={{ background: C.accent + '10', color: C.accent, border: '1px solid ' + C.accent + '20' }}>
                  <Printer size={13} /> Autoprint
                </div>
                <h2 className="hd-sub text-[1.9rem] sm:text-[2.4rem] mb-4" style={{ color: C.text }}>Tus comandas se imprimen solas</h2>
                <p className="text-[15px] leading-relaxed mb-7 max-w-lg" style={{ color: C.textSecondary }}>
                  Instala el Print Agent en tu computador de la caja y cada pedido se imprime automáticamente en tu impresora térmica — comanda para la cocina y recibo para el cliente. Sin copiar, sin reescribir, sin errores.
                </p>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 mb-7">
                  {[
                    'Se imprime solo al llegar el pedido',
                    'Compatible con térmicas 44, 58, 76 y 80mm',
                    'Comanda de cocina + recibo del cliente',
                    'Reimprime cualquier ticket con un clic',
                    'Reconexión automática si se cae la red',
                    'Historial completo de impresiones',
                  ].map((t) => (
                    <div key={t} className="flex items-start gap-2.5 text-[13.5px] leading-snug" style={{ color: C.text }}>
                      <Check size={15} className="mt-0.5 shrink-0" strokeWidth={3} style={{ color: C.green }} /> {t}
                    </div>
                  ))}
                </div>
                <span className="inline-flex items-center gap-2 text-[12px] font-semibold" style={{ color: C.muted }}>
                  <Monitor size={14} /> App para Windows · incluida en tu plan
                </span>
              </div>

              {/* Visual: floating printer + Print Agent in a phone */}
              <div className="relative pt-2 pb-4">
                {/* soft glow */}
                <div className="absolute right-[6%] top-[10%] w-64 h-64 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${C.accent}10, transparent 70%)` }} />
                {/* Printer (transparent bg, floating) */}
                <img
                  src="/printagent/impresora-nobg.webp"
                  alt="Impresora térmica compatible con Menuby"
                  className="relative w-[76%] max-w-[400px] ml-auto block"
                  style={{ filter: 'drop-shadow(0 28px 44px rgba(23,18,15,0.28))' }}
                  loading="lazy"
                />
                {/* MenuBy Print app badge (logo) */}
                <div className="absolute bottom-1 left-0 flex items-center gap-3 rounded-2xl pl-2.5 pr-4 py-2.5" style={{ background: '#fff', border: '1px solid ' + C.border, boxShadow: '0 18px 44px rgba(23,18,15,0.16)' }}>
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden flex items-center justify-center shrink-0" style={{ background: '#fff', border: '1px solid ' + C.borderLight }}>
                    <img src="/printagent/logo.webp" alt="MenuBy Print" className="w-full h-full object-contain" loading="lazy" />
                  </div>
                  <div>
                    <p className="text-[14px] font-extrabold leading-tight" style={{ color: C.text, fontFamily: DISPLAY }}>MenuBy Print</p>
                    <p className="text-[11px] leading-tight mb-1" style={{ color: C.muted }}>Impresión automática</p>
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold" style={{ color: C.green }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.green }} /> Conectado
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeInWhenVisible>
      </Section>

      {/* ========== DEMO INTERACTIVO (light) ========== */}
      <div style={{ background: C.surface, borderTop: '1px solid ' + C.borderLight, borderBottom: '1px solid ' + C.borderLight }}>
        <Section id="demo" className="py-20 sm:py-28">
          <FadeInWhenVisible>
            <div className="text-center mb-10">
              <Eyebrow>Demo en vivo</Eyebrow>
              <h2 className="hd-sub text-[2rem] sm:text-[2.6rem] mb-3" style={{ color: C.text }}>Así se ve Menuby en acción</h2>
              <p className="text-[15px] max-w-md mx-auto" style={{ color: C.muted }}>El menú que ven tus clientes y el panel con el que administras — reales, no maquetas.</p>
            </div>
          </FadeInWhenVisible>

          <div className="flex justify-center mb-12">
            <div className="inline-flex rounded-2xl p-1.5 gap-1" style={{ background: '#fff', border: '1px solid ' + C.border, boxShadow: '0 4px 18px rgba(23,18,15,0.05)' }}>
              {demoTabs.map((tab, i) => (
                <button key={tab.label} onClick={() => setDemoTab(i)} className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-[12px] sm:text-[13px] font-semibold transition-colors duration-200" style={{ background: demoTab === i ? C.accent : 'transparent', color: demoTab === i ? '#fff' : C.textSecondary }} aria-pressed={demoTab === i}>
                  <tab.icon size={14} style={{ color: demoTab === i ? '#fff' : C.muted }} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="max-w-4xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div key={demoTab} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: 0.3 }}>
                {demoTab === 0 && <RealMenuMockup />}
                {demoTab === 1 && <BrowserFrame src="/screenshots/macdonalds-panel.webp" alt="Panel de control de Menuby" url="menuby.tech/panel" />}
              </motion.div>
            </AnimatePresence>
          </div>
        </Section>
      </div>

      {/* ========== STATS ========== */}
      <div ref={statsRef}>
        <Section className="py-16 sm:py-20">
          <div className="rounded-[32px] px-6 py-12 sm:py-14" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDeep})`, boxShadow: '0 24px 60px rgba(232,0,45,0.24)' }}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { end: 500, suffix: '+', label: 'Restaurantes activos' },
                { end: 0, suffix: '%', label: 'Comisión por pedido' },
                { end: 5, suffix: ' min', label: 'Tiempo de setup' },
                { end: 15, suffix: '+', label: 'Ciudades en Colombia' },
              ].map((s, i) => (
                <FadeInWhenVisible key={s.label} delay={i * 0.08} y={16}>
                  <p className="hd text-[2.6rem] sm:text-[3.4rem] text-white mb-1"><CounterValue end={s.end} active={statsInView} />{s.suffix}</p>
                  <p className="text-[12px] sm:text-[13px] font-medium text-white/80">{s.label}</p>
                </FadeInWhenVisible>
              ))}
            </div>
          </div>
        </Section>
      </div>

      {/* ========== TESTIMONIOS ========== */}
      <Section className="py-20 sm:py-28">
        <FadeInWhenVisible>
          <div className="text-center mb-14">
            <Eyebrow>Testimonios</Eyebrow>
            <h2 className="hd-sub text-[2rem] sm:text-[2.6rem]" style={{ color: C.text }}>Lo que dicen nuestros restaurantes</h2>
          </div>
        </FadeInWhenVisible>

        <StaggerContainer className="grid md:grid-cols-3 gap-5" stagger={0.1}>
          {TESTIMONIALS.map((t) => (
            <motion.div key={t.name} variants={staggerChild} className="rounded-3xl p-7 flex flex-col" style={{ background: C.card, border: '1px solid ' + C.borderLight }}>
              <div className="flex items-center gap-0.5 mb-4">
                {Array.from({ length: t.stars }).map((_, i) => <Star key={i} size={15} fill="#F5A623" color="#F5A623" />)}
              </div>
              <p className="text-[14px] leading-relaxed mb-6 flex-1" style={{ color: C.textSecondary }}>"{t.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.ember})` }}>{t.name.charAt(0)}</div>
                <div>
                  <p className="text-[13px] font-bold" style={{ color: C.text }}>{t.name}</p>
                  <p className="text-[11px]" style={{ color: C.muted }}>{t.role} · {t.city}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </StaggerContainer>
      </Section>

      {/* ========== VS DELIVERY APPS ========== */}
      <div style={{ background: C.bg }}>
        <Section className="py-20 sm:py-28">
          <FadeInWhenVisible>
            <div className="text-center mb-12">
              <Eyebrow>Menuby vs. apps de delivery</Eyebrow>
              <h2 className="hd-sub text-[2rem] sm:text-[2.8rem] mb-3" style={{ color: C.text }}>Deja de regalar una parte de cada venta</h2>
              <p className="text-[15px] max-w-xl mx-auto" style={{ color: C.muted }}>
                Apps como Rappi o Didi cobran entre 15% y 30% por pedido. Con Menuby vendes directo, sin intermediarios y con 0% de comisión — para siempre.
              </p>
            </div>
          </FadeInWhenVisible>

          <div className="grid lg:grid-cols-2 gap-6 items-stretch max-w-5xl mx-auto">
            {/* Savings calculator */}
            <FadeInWhenVisible>
              <div className="rounded-[28px] p-7 sm:p-8 h-full flex flex-col" style={{ background: C.card, border: '1px solid ' + C.border, boxShadow: '0 16px 44px rgba(23,18,15,0.06)' }}>
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: C.accent + '12' }}>
                    <TrendingUp size={16} style={{ color: C.accent }} />
                  </div>
                  <p className="text-[12px] font-bold tracking-[0.12em] uppercase" style={{ color: C.accent }}>Calculadora de ahorro</p>
                </div>

                <div className="flex items-end justify-between mb-2">
                  <label className="text-[13px] font-semibold" style={{ color: C.textSecondary }}>¿Cuánto vendes al mes?</label>
                  <span className="hd text-[1.5rem]" style={{ color: C.text }}>{fmtCOP(monthlySales)}</span>
                </div>
                <input
                  type="range" min={1000000} max={60000000} step={500000} value={monthlySales}
                  onChange={(e) => setMonthlySales(Number(e.target.value))}
                  className="range-red w-full mb-1.5" aria-label="Ventas mensuales"
                  style={{ background: `linear-gradient(90deg, ${C.accent} ${salesPct}%, ${C.elevated} ${salesPct}%)` }}
                />
                <div className="flex justify-between text-[10.5px] mb-6" style={{ color: C.muted }}>
                  <span>$1M</span><span>$60M</span>
                </div>

                <div className="flex items-center gap-3 mb-7">
                  <label className="text-[13px] font-semibold" style={{ color: C.textSecondary }}>Comisión</label>
                  <div className="inline-flex rounded-xl p-1" style={{ background: C.surface, border: '1px solid ' + C.borderLight }}>
                    {[15, 25, 30].map((p) => (
                      <button key={p} onClick={() => setCommissionPct(p)} className="px-3.5 py-1.5 rounded-lg text-[12.5px] font-bold transition-all" style={{ background: commissionPct === p ? C.accent : 'transparent', color: commissionPct === p ? '#fff' : C.muted }}>{p}%</button>
                    ))}
                  </div>
                </div>

                {/* Hero result */}
                <div className="rounded-2xl p-5 mt-auto relative overflow-hidden" style={{ background: `linear-gradient(150deg, ${C.accent}, ${C.accentDeep})`, boxShadow: '0 14px 36px rgba(232,0,45,0.28)' }}>
                  <div className="absolute -right-6 -top-8 w-32 h-32 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/70 mb-1">Ahorras al año con Menuby</p>
                  <p className="hd text-[2.4rem] sm:text-[2.8rem] text-white leading-none mb-2">{fmtCOP(savingsYear)}</p>
                  <p className="text-[12px] text-white/80">
                    Hoy le dejas <span className="font-bold text-white">{fmtCOP(lossMonth)}/mes</span> a las apps en comisiones. Con Menuby: <span className="font-bold text-white">$0</span>.
                  </p>
                </div>
              </div>
            </FadeInWhenVisible>

            {/* Comparison table */}
            <FadeInWhenVisible delay={0.1}>
              <div className="rounded-[28px] p-2 h-full" style={{ background: C.card, border: '1px solid ' + C.border, boxShadow: '0 16px 44px rgba(23,18,15,0.06)' }}>
                {/* Header */}
                <div className="grid grid-cols-[1.5fr_1fr_1fr] items-end text-center">
                  <div className="px-3 py-3" />
                  <div className="px-1.5 pt-3 pb-2.5 rounded-t-2xl" style={{ background: C.accent + '0E', borderLeft: '1.5px solid ' + C.accent + '2A', borderRight: '1.5px solid ' + C.accent + '2A', borderTop: '1.5px solid ' + C.accent + '2A' }}>
                    <span className="inline-flex items-center gap-1 text-[13px] font-extrabold" style={{ color: C.accent, fontFamily: DISPLAY }}>
                      <Sparkles size={12} /> Menuby
                    </span>
                  </div>
                  <div className="px-1.5 py-3">
                    <span className="text-[12px] font-bold" style={{ color: C.muted }}>Delivery apps</span>
                  </div>
                </div>
                {/* Rows */}
                {COMPARE.map((row, i) => {
                  const last = i === COMPARE.length - 1;
                  return (
                    <div key={row.label} className="grid grid-cols-[1.5fr_1fr_1fr] items-stretch text-center">
                      <div className="px-3 py-3 text-left text-[12.5px] font-semibold flex items-center" style={{ color: C.text, borderTop: '1px solid ' + C.borderLight }}>{row.label}</div>
                      <div className="px-1.5 py-3 flex items-center justify-center" style={{ background: C.accent + '0E', borderLeft: '1.5px solid ' + C.accent + '2A', borderRight: '1.5px solid ' + C.accent + '2A', borderTop: '1px solid ' + C.accent + '18', ...(last ? { borderBottom: '1.5px solid ' + C.accent + '2A', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 } : {}) }}>
                        {row.menuby === true ? <Check size={17} strokeWidth={3} style={{ color: C.green }} />
                          : <span className="text-[11.5px] font-bold leading-tight" style={{ color: C.text }}>{row.menuby}</span>}
                      </div>
                      <div className="px-1.5 py-3 flex items-center justify-center" style={{ borderTop: '1px solid ' + C.borderLight }}>
                        {row.apps === false ? <X size={16} strokeWidth={2.5} style={{ color: '#CBBFB4' }} />
                          : <span className="text-[11.5px] font-medium leading-tight" style={{ color: C.muted }}>{row.apps}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </FadeInWhenVisible>
          </div>

          <FadeInWhenVisible>
            <div className="text-center mt-10">
              <Link to="/register" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-white text-[15px] font-bold transition-transform active:scale-[0.97]" style={{ background: C.accent, boxShadow: '0 12px 34px rgba(232,0,45,0.26)' }}>
                Quiero vender sin comisiones <ArrowRight size={17} />
              </Link>
            </div>
          </FadeInWhenVisible>
        </Section>
      </div>

      <div id="pricing" style={{ background: C.surface, borderTop: '1px solid ' + C.borderLight, borderBottom: '1px solid ' + C.borderLight }}>
        <Section className="py-20 sm:py-28">
          <FadeInWhenVisible>
            <div className="text-center mb-8">
              <Eyebrow>Precios</Eyebrow>
              <h2 className="hd-sub text-[2rem] sm:text-[2.8rem] mb-3" style={{ color: C.text }}>Planes sin comisiones ocultas</h2>
              <p className="text-[15px] max-w-md mx-auto" style={{ color: C.muted }}>Tarifa fija mensual. Sin castigo por crecer. Sin letra pequeña.</p>
            </div>
          </FadeInWhenVisible>

          <div className="flex flex-col items-center gap-3 mb-12">
            <div className="inline-flex flex-wrap justify-center rounded-2xl p-1 gap-0.5" style={{ background: '#fff', border: '1px solid ' + C.border }}>
              {CYCLES.map((c) => (
                <button key={c.id} onClick={() => setBillingCycle(c.id)} className="px-4 sm:px-5 py-2.5 rounded-xl text-[12.5px] font-semibold transition-all" aria-pressed={billingCycle === c.id} style={{ background: billingCycle === c.id ? C.accent : 'transparent', color: billingCycle === c.id ? '#fff' : C.muted }}>
                  {c.label}
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              {(() => {
                const cyc = CYCLES.find((c) => c.id === billingCycle);
                return cyc?.badge ? (
                  <motion.span key={cyc.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white" style={{ background: C.green }}>{cyc.badge}</motion.span>
                ) : <span className="h-[22px]" />;
              })()}
            </AnimatePresence>
          </div>

          <StaggerContainer className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 max-w-5xl mx-auto" stagger={0.06}>
            {PLANS.map((plan) => {
              const cyc = CYCLES.find((c) => c.id === billingCycle) || CYCLES[0];
              const price = plan[billingCycle] ?? plan.monthly;
              const isPop = plan.popular;
              return (
                <motion.div
                  key={plan.id}
                  variants={staggerChild}
                  whileHover={{ y: -6 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                  className={`relative rounded-[26px] p-6 flex flex-col ${isPop ? 'xl:-my-2 xl:py-8' : ''}`}
                  style={{
                    background: isPop ? `linear-gradient(180deg, #fff, ${C.blush})` : C.card,
                    border: isPop ? '2px solid ' + C.accent : '1px solid ' + C.border,
                    boxShadow: isPop ? '0 28px 64px rgba(232,0,45,0.20)' : '0 2px 14px rgba(23,18,15,0.04)',
                  }}
                >
                  {isPop && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[10.5px] font-bold text-white whitespace-nowrap" style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.ember})`, boxShadow: '0 6px 18px rgba(232,0,45,0.35)' }}>
                      <Sparkles size={11} /> Más popular
                    </span>
                  )}
                  <h3 className="text-[17px] font-extrabold" style={{ color: isPop ? C.accent : C.text, fontFamily: DISPLAY }}>{plan.name}</h3>
                  <p className="text-[11.5px] mt-1 mb-4" style={{ color: C.muted }}>{plan.desc}</p>
                  <div className="mb-5">
                    <span className="hd text-[2.1rem]" style={{ color: C.text }}>{plan.id === 'free' ? '$0' : fmtCOP(price)}</span>
                    <span className="text-[11px] ml-1" style={{ color: C.muted }}>{plan.id === 'free' ? ' siempre' : '/mes'}</span>
                    {plan.id !== 'free' && cyc.months > 1 && (
                      <p className="text-[10.5px] mt-1" style={{ color: C.muted }}>Facturado {fmtCOP(price * cyc.months)} cada {cyc.months} meses</p>
                    )}
                  </div>
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-[12.5px]" style={{ color: C.textSecondary }}>
                        <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: isPop ? C.accent + '16' : C.surface }}>
                          <Check size={11} style={{ color: C.accent }} strokeWidth={3} />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/register" className="block w-full text-center py-3 rounded-xl text-[13px] font-bold transition-all hover:shadow-lg active:scale-[0.97]" style={isPop ? { background: C.accent, color: '#fff', boxShadow: '0 8px 26px rgba(232,0,45,0.3)' } : { background: '#fff', color: C.text, border: '1px solid ' + C.border }}>
                    {plan.cta}
                  </Link>
                </motion.div>
              );
            })}
          </StaggerContainer>
        </Section>
      </div>

      {/* ========== FAQ ========== */}
      <Section className="py-20 sm:py-28">
        <FadeInWhenVisible>
          <div className="text-center mb-12">
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="hd-sub text-[2rem] sm:text-[2.6rem]" style={{ color: C.text }}>Preguntas frecuentes</h2>
          </div>
        </FadeInWhenVisible>
        <FAQAccordion />
      </Section>

      {/* ========== CTA FINAL ========== */}
      <Section className="pb-24">
        <FadeInWhenVisible>
          <div className="relative rounded-[36px] px-6 py-16 sm:py-20 text-center overflow-hidden" style={{ background: `linear-gradient(165deg, #fff, ${C.blush})`, border: '1px solid ' + C.border, boxShadow: '0 24px 60px rgba(232,0,45,0.08)' }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(680px 360px at 50% -6%, rgba(232,0,45,0.10), transparent 62%)` }} />
            <div className="relative z-10">
              <h2 className="hd text-[2.4rem] sm:text-[3.4rem] mb-4" style={{ color: C.text }}>Empieza gratis hoy</h2>
              <p className="text-[15px] sm:text-[16px] mb-8 max-w-lg mx-auto" style={{ color: C.textSecondary }}>Crea tu menú digital en 5 minutos. Sin tarjeta, sin comisiones, sin compromisos.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link to="/register" className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full text-[15px] font-bold text-white transition-transform active:scale-[0.97]" style={{ background: C.accent, boxShadow: '0 14px 40px rgba(232,0,45,0.32)' }}>
                  Crear mi menú gratis
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
                <a href="#demo" className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full text-[15px] font-bold transition-colors" style={{ background: '#fff', color: C.text, border: '1px solid ' + C.border }}>
                  Ver demo
                </a>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-9 text-[12px] font-medium" style={{ color: C.muted }}>
                {[{ icon: ShieldCheck, text: 'Datos protegidos SSL' }, { icon: CreditCard, text: '0% comisiones' }, { icon: Clock, text: 'Soporte en horario laboral' }, { icon: Users, text: '+500 restaurantes' }].map((t) => (
                  <span key={t.text} className="inline-flex items-center gap-1.5"><t.icon size={14} style={{ color: C.accent }} />{t.text}</span>
                ))}
              </div>
            </div>
          </div>
        </FadeInWhenVisible>
      </Section>

      {/* ========== STICKY MOBILE CTA ========== */}
      <AnimatePresence>
        {showSticky && (
          <motion.div
            initial={{ y: 90 }}
            animate={{ y: 0 }}
            exit={{ y: 90 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-4 pt-3"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)', background: C.bg, borderTop: '1px solid ' + C.borderLight, boxShadow: '0 -8px 30px rgba(23,18,15,0.08)' }}
          >
            <Link to="/register" className="flex items-center justify-center gap-2 w-full py-3.5 rounded-full text-white text-[15px] font-bold active:scale-[0.98] transition-transform" style={{ background: C.accent, boxShadow: '0 8px 26px rgba(232,0,45,0.3)' }}>
              Crear menú gratis <ArrowRight size={17} />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========== WHATSAPP FLOAT ========== */}
      <a href="https://wa.me/573138178003?text=Hola%2C%20me%20interesa%20Menuby%20para%20mi%20restaurante" target="_blank" rel="noopener noreferrer" aria-label="Contactar por WhatsApp" className={`fixed right-6 z-50 flex items-center gap-2.5 group transition-[bottom] duration-300 ${showSticky ? 'bottom-[88px] md:bottom-6' : 'bottom-6'}`} style={{ filter: 'drop-shadow(0 4px 16px rgba(37,211,102,0.4))' }}>
        <span className="hidden sm:block px-3 py-1.5 rounded-xl text-[12px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap" style={{ background: C.dark }}>Escríbenos</span>
        <div className="w-14 h-14 rounded-full flex items-center justify-center transition-transform duration-200 hover:scale-110 active:scale-95" style={{ background: '#25D366' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
        </div>
      </a>
    </div>
  );
}
