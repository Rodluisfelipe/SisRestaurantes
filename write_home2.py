# -*- coding: utf-8 -*-
import os

# All emoji used as Python string with real characters
fire = '\U0001F525'
burger_e = '\U0001F354'
chicken_e = '\U0001F357'
drink_e = '\U0001F964'
cake_e = '\U0001F370'
money_e = '\U0001F4B0'
package_e = '\U0001F4E6'
target_e = '\U0001F3AF'
person_e = '\U0001F464'
beer_e = '\U0001F37A'
pizza_e = '\U0001F355'
taco_e = '\U0001F32E'
sushi_e = '\U0001F363'
salad_e = '\U0001F957'
icecream_e = '\U0001F366'
burrito_e = '\U0001F32F'
croissant_e = '\U0001F950'

content = f'''import React, {{ useState, useEffect, useRef, useMemo }} from 'react';
import {{ Link }} from 'react-router-dom';
import {{ motion, AnimatePresence, useInView, useScroll, useTransform, useSpring, useMotionValue }} from 'framer-motion';
import {{ Smartphone, Monitor, TrendingUp, ChevronDown, Check, X, ArrowRight, Zap, Star, ShieldCheck, Clock, Users, BarChart3, Bell, QrCode, UtensilsCrossed, MapPin, Gift }} from 'lucide-react';
import useLandingSEO from '../../hooks/useLandingSEO';

/* === DESIGN SYSTEM === */
const C = {{
  bg: '#FAFAFA',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  elevated: '#F3F3F3',
  border: '#E8E8E8',
  borderLight: '#F0F0F0',
  text: '#0A0A0A',
  textSecondary: '#404040',
  muted: '#737373',
  accent: '#E8002D',
  accentDark: '#B80024',
  accentSoft: 'rgba(232,0,45,0.06)',
  accentGlow: 'rgba(232,0,45,0.12)',
  green: '#059669',
  greenSoft: 'rgba(5,150,105,0.08)',
  dark: '#0A0A0A',
  darkSurface: '#141414',
  darkCard: '#1C1C1C',
  gold: '#D97706',
}};

const fmtCOP = (n) => {{
  if (n === 0) return '$0';
  return '$' + n.toLocaleString('es-CO');
}};

/* === ANIMATED COMPONENTS === */

function FadeInWhenVisible({{ children, delay = 0, y = 40, className = '' }}) {{
  const ref = useRef(null);
  const isInView = useInView(ref, {{ once: true, margin: '-80px' }});
  return (
    <motion.div
      ref={{ref}}
      initial={{{{ opacity: 0, y }}}}
      animate={{isInView ? {{ opacity: 1, y: 0 }} : {{}}}}
      transition={{{{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}}}
      className={{className}}
    >
      {{children}}
    </motion.div>
  );
}}

function StaggerContainer({{ children, className = '', stagger = 0.08 }}) {{
  const ref = useRef(null);
  const isInView = useInView(ref, {{ once: true, margin: '-60px' }});
  return (
    <motion.div
      ref={{ref}}
      initial="hidden"
      animate={{isInView ? 'visible' : 'hidden'}}
      variants={{{{ visible: {{ transition: {{ staggerChildren: stagger }} }} }}}}
      className={{className}}
    >
      {{children}}
    </motion.div>
  );
}}

const staggerChild = {{
  hidden: {{ opacity: 0, y: 30 }},
  visible: {{ opacity: 1, y: 0, transition: {{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }} }},
}};

/* === MAGNETIC BUTTON === */
function MagneticButton({{ children, className = '', style = {{}}, ...props }}) {{
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, {{ stiffness: 300, damping: 20 }});
  const springY = useSpring(y, {{ stiffness: 300, damping: 20 }});

  return (
    <motion.div
      ref={{ref}}
      style={{{{ x: springX, y: springY }}}}
      onMouseMove={{(e) => {{
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        x.set((e.clientX - rect.left - rect.width / 2) * 0.15);
        y.set((e.clientY - rect.top - rect.height / 2) * 0.15);
      }}}}
      onMouseLeave={{() => {{ x.set(0); y.set(0); }}}}
      className={{className}}
      {{...props}}
    >
      {{children}}
    </motion.div>
  );
}}

/* === SECTION WRAPPER === */
const Section = ({{ children, id, className = '', style = {{}} }}) => (
  <section id={{id}} className={{`px-5 sm:px-6 lg:px-8 ${{className}}`}} style={{style}}>
    <div className="max-w-6xl mx-auto">{{children}}</div>
  </section>
);

/* === COUNTER HOOK === */
function useCounter(end, duration = 2000, active = false) {{
  const [val, setVal] = useState(0);
  useEffect(() => {{
    if (!active) return;
    const startTime = Date.now();
    const id = setInterval(() => {{
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.floor(eased * end));
      if (progress >= 1) clearInterval(id);
    }}, 16);
    return () => clearInterval(id);
  }}, [end, duration, active]);
  return val;
}}

function CounterValue({{ end, active }}) {{
  const val = useCounter(end, 2000, active);
  return <>{{val}}</>;
}}

/* ===============================================================
   REAL PHONE MOCKUP
   Uses actual Menuby UI patterns: cinematic cards, category emojis,
   gradient overlays, hero product, sticky categories
   =============================================================== */
function RealMenuMockup() {{
  const [now, setNow] = useState(new Date());
  const [activeCategory, setActiveCategory] = useState(0);
  const [cartCount, setCartCount] = useState(2);
  const [cartTotal, setCartTotal] = useState(47800);
  const [addedProduct, setAddedProduct] = useState(null);
  const [showNotif, setShowNotif] = useState(false);

  useEffect(() => {{
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }}, []);

  useEffect(() => {{
    const loop = setInterval(() => {{
      setShowNotif(true);
      setTimeout(() => setShowNotif(false), 2800);
    }}, 6000);
    return () => clearInterval(loop);
  }}, []);

  const time = now.toLocaleTimeString('es-CO', {{ hour: '2-digit', minute: '2-digit', hour12: false }});

  const categories = [
    {{ name: 'Hamburguesas', emoji: '{burger_e}', count: 5 }},
    {{ name: 'Pollo', emoji: '{chicken_e}', count: 3 }},
    {{ name: 'Bebidas', emoji: '{drink_e}', count: 4 }},
    {{ name: 'Postres', emoji: '{cake_e}', count: 2 }},
  ];

  const menuItems = [
    [
      {{ name: 'Big Mac', desc: 'Doble carne, salsa especial, lechuga', price: 28900, badge: 'Popular', hero: true }},
      {{ name: 'McPollo', desc: 'Pechuga empanizada, mayo, lechuga', price: 22900, badge: null, hero: false }},
      {{ name: 'Cuarto de Libra', desc: 'Carne 100%, queso cheddar fundido', price: 26900, badge: 'Personalizable', hero: false }},
    ],
    [
      {{ name: 'McNuggets x10', desc: 'Pollo crujiente con salsa BBQ', price: 18900, badge: 'Popular', hero: true }},
      {{ name: 'McPepper Pollo', desc: 'Pollo a la parrilla, pimienta negra', price: 24900, badge: null, hero: false }},
    ],
    [
      {{ name: 'Coca-Cola', desc: 'Mediana 400ml', price: 6900, badge: null, hero: false }},
      {{ name: 'McFlurry Oreo', desc: 'Helado suave con trozos de Oreo', price: 12900, badge: 'Favorito', hero: true }},
      {{ name: 'Jugo Hit', desc: 'Mango o lulo 300ml', price: 5900, badge: null, hero: false }},
    ],
    [
      {{ name: 'Sundae Chocolate', desc: 'Helado con salsa de chocolate', price: 7900, badge: null, hero: true }},
      {{ name: 'Cono Sencillo', desc: 'Helado suave clasico', price: 3900, badge: null, hero: false }},
    ],
  ];

  const currentItems = menuItems[activeCategory] || menuItems[0];

  const handleAdd = (item) => {{
    setAddedProduct(item.name);
    setCartCount(c => c + 1);
    setCartTotal(t => t + item.price);
    setTimeout(() => setAddedProduct(null), 800);
  }};

  const badgeColor = (b) => {{
    if (b === 'Popular') return {{ bg: '#FEF3C7', text: '#92400E' }};
    if (b === 'Personalizable') return {{ bg: '#EDE9FE', text: '#5B21B6' }};
    if (b === 'Favorito') return {{ bg: '#FCE7F3', text: '#9D174D' }};
    return {{ bg: '#F3F4F6', text: '#374151' }};
  }};

  return (
    <div className="relative select-none">
      {{/* Floating notification */}}
      <AnimatePresence>
        {{showNotif && (
          <motion.div
            initial={{{{ opacity: 0, y: -16, scale: 0.9, filter: 'blur(4px)' }}}}
            animate={{{{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}}}
            exit={{{{ opacity: 0, y: -10, scale: 0.95, filter: 'blur(4px)' }}}}
            transition={{{{ type: 'spring', stiffness: 400, damping: 25 }}}}
            className="absolute -top-5 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap rounded-2xl px-4 py-2.5 text-[11px] font-semibold text-white shadow-2xl flex items-center gap-2"
            style={{{{ background: 'linear-gradient(135deg, #E8002D, #B80024)', boxShadow: '0 8px 32px rgba(232,0,45,0.4)' }}}}
          >
            <span className="w-2 h-2 rounded-full bg-white/60 animate-pulse" />
            Nuevo pedido — Mesa 4
          </motion.div>
        )}}
      </AnimatePresence>

      {{/* Phone frame */}}
      <motion.div
        className="w-[290px] sm:w-[310px] mx-auto"
        animate={{{{ rotateY: [0, 1, -1, 0] }}}}
        transition={{{{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}}}
        style={{{{ perspective: '1200px', transformStyle: 'preserve-3d' }}}}
      >
        <div className="rounded-[2.8rem] p-[10px]" style={{{{ background: 'linear-gradient(145deg, #2a2a2a, #1a1a1a, #0a0a0a)', boxShadow: '0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)' }}}}>
          <div className="rounded-[2.2rem] overflow-hidden" style={{{{ background: C.bg }}}}>
            {{/* Status bar */}}
            <div className="flex items-center justify-between px-6 pt-2 pb-1 text-[9px] font-bold" style={{{{ color: '#fff', background: '#000' }}}}>
              <span>{{time}}</span>
              <div className="w-[76px] h-[22px] rounded-full bg-black border border-gray-800 mx-auto" />
              <div className="flex items-center gap-0.5">
                <svg width="12" height="9" viewBox="0 0 12 9"><path d="M1 7h1.5v2H1zM3.5 5H5v4H3.5zM6 3h1.5v6H6zM8.5 1H10v8H8.5z" fill="#fff"/></svg>
                <svg width="14" height="9" viewBox="0 0 14 9"><rect x="0.5" y="0.5" width="10" height="6" rx="1" stroke="#fff" fill="none" strokeWidth="0.8"/><rect x="2" y="2" width="6" height="3" rx="0.5" fill="#34D399"/><rect x="11" y="2" width="1.5" height="3" rx="0.5" fill="#fff"/></svg>
              </div>
            </div>

            {{/* Restaurant header */}}
            <div className="relative overflow-hidden">
              <div className="h-16" style={{{{ background: 'linear-gradient(135deg, #DC2626, #E8002D, #FF1744)' }}}}>
                <div className="absolute inset-0 opacity-20" style={{{{ backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.3), transparent 50%)' }}}} />
              </div>
              <div className="absolute bottom-0 left-0 right-0 px-4 pb-2 pt-1 flex items-end justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-white text-[13px] font-extrabold tracking-tight">McDonald's</p>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#3B82F6"/><path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <p className="flex items-center gap-1 text-[9px] text-white/80 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Abierto ahora
                    <span className="mx-1 text-white/40">{chr(183)}</span>
                    <span>{chr(9733)} 4.7</span>
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                  </div>
                </div>
              </div>
            </div>

            {{/* Category pills */}}
            <div className="flex gap-1.5 px-3 py-2.5 overflow-hidden">
              {{categories.map((cat, i) => (
                <button
                  key={{cat.name}}
                  onClick={{() => setActiveCategory(i)}}
                  className="whitespace-nowrap px-2.5 py-1.5 rounded-full text-[10px] font-semibold shrink-0 transition-all duration-200 flex items-center gap-1"
                  style={{{{
                    background: activeCategory === i ? C.accent : '#fff',
                    color: activeCategory === i ? '#fff' : C.text,
                    border: activeCategory === i ? 'none' : '1px solid ' + C.border,
                    boxShadow: activeCategory === i ? '0 2px 8px rgba(232,0,45,0.25)' : 'none',
                  }}}}
                >
                  <span className="text-[11px]">{{cat.emoji}}</span> {{cat.name}}
                </button>
              ))}}
            </div>

            {{/* Products */}}
            <div className="px-3 pb-2 space-y-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={{activeCategory}}
                  initial={{{{ opacity: 0, x: 10 }}}}
                  animate={{{{ opacity: 1, x: 0 }}}}
                  exit={{{{ opacity: 0, x: -10 }}}}
                  transition={{{{ duration: 0.2 }}}}
                  className="space-y-2"
                >
                  {{/* Category header */}}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-sm">{{categories[activeCategory].emoji}}</span>
                    <p className="text-[11px] font-bold" style={{{{ color: C.text }}}}>{{categories[activeCategory].name}}</p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{{{ background: C.elevated, color: C.muted }}}}>{{currentItems.length}}</span>
                    <div className="flex-1 h-px ml-2" style={{{{ background: 'linear-gradient(90deg, rgba(232,0,45,0.19), transparent)' }}}} />
                  </div>

                  {{/* Product cards */}}
                  {{currentItems.map((item, idx) => (
                    <motion.div
                      key={{item.name}}
                      initial={{{{ opacity: 0, y: 8 }}}}
                      animate={{{{ opacity: 1, y: 0 }}}}
                      transition={{{{ delay: idx * 0.05 }}}}
                      className="relative rounded-xl overflow-hidden group"
                      style={{{{
                        background: '#fff',
                        border: '1px solid ' + C.borderLight,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}}}
                    >
                      {{item.hero ? (
                        <div className="relative">
                          <div className="h-[72px] overflow-hidden" style={{{{ background: 'linear-gradient(135deg, rgba(232,0,45,0.08), rgba(232,0,45,0.03))' }}}}>
                            <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-30 select-none">
                              {{categories[activeCategory].emoji}}
                            </div>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2.5">
                            <p className="text-white text-[10px] font-extrabold">{{fmtCOP(item.price)}}</p>
                          </div>
                          {{item.badge && (
                            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[8px] font-bold" style={{{{ background: badgeColor(item.badge).bg, color: badgeColor(item.badge).text }}}}>
                              {{item.badge}}
                            </span>
                          )}}
                          <div className="px-2.5 py-2 flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-bold truncate" style={{{{ color: C.text }}}}>{{item.name}}</p>
                              <p className="text-[9px] truncate" style={{{{ color: C.muted }}}}>{{item.desc}}</p>
                            </div>
                            <motion.button
                              whileTap={{{{ scale: 0.85 }}}}
                              onClick={{(e) => {{ e.stopPropagation(); handleAdd(item); }}}}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0 ml-2"
                              style={{{{ background: C.accent, boxShadow: '0 2px 8px rgba(232,0,45,0.3)' }}}}
                            >
                              {{addedProduct === item.name ? '{chr(10003)}' : '+'}}
                            </motion.button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5 p-2.5">
                          <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 flex items-center justify-center text-2xl" style={{{{ background: 'linear-gradient(135deg, rgba(232,0,45,0.05), rgba(232,0,45,0.02))' }}}}>
                            {{categories[activeCategory].emoji}}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="text-[11px] font-bold truncate" style={{{{ color: C.text }}}}>{{item.name}}</p>
                              {{item.badge && (
                                <span className="px-1 py-0.5 rounded text-[7px] font-bold shrink-0" style={{{{ background: badgeColor(item.badge).bg, color: badgeColor(item.badge).text }}}}>
                                  {{item.badge}}
                                </span>
                              )}}
                            </div>
                            <p className="text-[9px] truncate" style={{{{ color: C.muted }}}}>{{item.desc}}</p>
                            <p className="text-[10px] font-extrabold mt-0.5" style={{{{ color: C.text }}}}>{{fmtCOP(item.price)}}</p>
                          </div>
                          <motion.button
                            whileTap={{{{ scale: 0.85 }}}}
                            onClick={{(e) => {{ e.stopPropagation(); handleAdd(item); }}}}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                            style={{{{ background: C.accent }}}}
                          >
                            {{addedProduct === item.name ? '{chr(10003)}' : '+'}}
                          </motion.button>
                        </div>
                      )}}
                    </motion.div>
                  ))}}
                </motion.div>
              </AnimatePresence>
            </div>

            {{/* Cart bar */}}
            <div className="mx-3 mb-3">
              <motion.div
                layout
                className="rounded-xl px-4 py-2.5 flex items-center justify-between text-white"
                style={{{{ background: 'linear-gradient(135deg, #E8002D, #B80024)', boxShadow: '0 4px 20px rgba(232,0,45,0.35)' }}}}
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center text-[10px] font-bold">{{cartCount}}</span>
                  <span className="text-[11px] font-semibold">Ver carrito</span>
                </div>
                <span className="text-[12px] font-extrabold">{{fmtCOP(cartTotal)}} {chr(8594)}</span>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}}

/* ===============================================================
   KDS MOCKUP
   =============================================================== */
function KDSMockup() {{
  const [now, setNow] = useState(new Date());
  const initialOrders = [
    {{ id: 1, table: 'Mesa 4', items: ['Big Mac x1', 'Coca-Cola x2'], startSecs: 263, priority: 'high' }},
    {{ id: 2, table: 'Mesa 7', items: ['McNuggets x10', 'McFlurry x1'], startSecs: 131, priority: 'normal' }},
    {{ id: 3, table: 'Domicilio #38', items: ['Cuarto de Libra x2', 'Papas Grandes x2'], startSecs: 475, priority: 'urgent' }},
  ];
  const [orders, setOrders] = useState(initialOrders);

  useEffect(() => {{
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }}, []);

  useEffect(() => {{
    const t = setInterval(() => {{
      setOrders(prev => prev.map(o => ({{ ...o, startSecs: o.startSecs + 1 }})));
    }}, 1000);
    return () => clearInterval(t);
  }}, []);

  const fmtTimer = (s) => `${{Math.floor(s / 60)}}:${{String(s % 60).padStart(2, '0')}}`;
  const timerColor = (s) => s > 300 ? '#EF4444' : s > 180 ? '#F59E0B' : '#10B981';
  const priorityBorder = (p) => p === 'urgent' ? '#EF4444' : p === 'high' ? '#F59E0B' : '#333';
  const timeStr = now.toLocaleTimeString('es-CO', {{ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }});

  return (
    <div className="rounded-2xl overflow-hidden" style={{{{ background: '#0C0C0C', border: '1px solid #222', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}}}>
      <div className="flex items-center justify-between px-5 py-3" style={{{{ background: '#111', borderBottom: '1px solid #222' }}}}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-white text-sm font-bold">Cocina — McDonald's</p>
        </div>
        <p className="text-white/40 text-xs font-mono tracking-wider">{{timeStr}}</p>
      </div>

      <div className="p-4 min-h-[220px]">
        {{orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px]">
            <motion.div animate={{{{ scale: [1, 1.1, 1] }}}} transition={{{{ duration: 2, repeat: Infinity }}}}>
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                <Check size={{24}} className="text-emerald-500" />
              </div>
            </motion.div>
            <p className="text-white/70 text-sm font-medium">Cocina al dia</p>
            <button onClick={{() => setOrders(initialOrders)}} className="mt-3 text-[10px] px-3 py-1.5 rounded-lg text-white/30 hover:text-white/60 border border-white/10 hover:border-white/20 transition-all">
              Reiniciar demo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <AnimatePresence>
              {{orders.map(o => (
                <motion.div
                  key={{o.id}}
                  layout
                  exit={{{{ opacity: 0, scale: 0.8, filter: 'blur(4px)' }}}}
                  transition={{{{ duration: 0.4 }}}}
                  className="rounded-xl p-3.5 relative overflow-hidden"
                  style={{{{ background: '#161616', borderLeft: `3px solid ${{priorityBorder(o.priority)}}`, border: '1px solid #222' }}}}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-white text-xs font-bold">{{o.table}}</p>
                    <motion.span
                      animate={{o.startSecs > 300 ? {{ opacity: [1, 0.5, 1] }} : {{}}}}
                      transition={{{{ duration: 0.8, repeat: Infinity }}}}
                      className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md"
                      style={{{{ color: timerColor(o.startSecs), background: `${{timerColor(o.startSecs)}}15` }}}}
                    >
                      {{fmtTimer(o.startSecs)}}
                    </motion.span>
                  </div>
                  <div className="space-y-1 mb-3">
                    {{o.items.map(it => (
                      <p key={{it}} className="text-white/50 text-[10px] font-medium">{{it}}</p>
                    ))}}
                  </div>
                  <motion.button
                    whileTap={{{{ scale: 0.92 }}}}
                    onClick={{() => setOrders(p => p.filter(x => x.id !== o.id))}}
                    className="w-full py-1.5 rounded-lg text-[10px] font-bold text-white transition-all"
                    style={{{{ background: C.green }}}}
                  >
                    {chr(10003)} Listo
                  </motion.button>
                </motion.div>
              ))}}
            </AnimatePresence>
          </div>
        )}}
      </div>
    </div>
  );
}}

/* ===============================================================
   DASHBOARD MOCKUP
   =============================================================== */
function DashboardMockup() {{
  const today = new Date().toLocaleDateString('es-CO', {{ weekday: 'long', day: 'numeric', month: 'long' }});

  const kpis = [
    {{ icon: '{money_e}', label: 'Ventas hoy', value: '$1.247.300', change: '+18%', up: true }},
    {{ icon: '{package_e}', label: 'Pedidos', value: '47', change: '+12', up: true }},
    {{ icon: '{target_e}', label: 'Ticket prom.', value: '$26.540', change: '+$2.1K', up: true }},
    {{ icon: '{person_e}', label: 'Nuevos', value: '14', change: '+6', up: true }},
  ];

  const barData = [
    {{ day: 'L', val: 580 }}, {{ day: 'M', val: 720 }}, {{ day: 'X', val: 640 }},
    {{ day: 'J', val: 830 }}, {{ day: 'V', val: 1050 }}, {{ day: 'S', val: 1300 }},
    {{ day: 'D', val: 1247 }},
  ];
  const maxBar = Math.max(...barData.map(d => d.val));

  return (
    <div className="rounded-2xl overflow-hidden" style={{{{ background: C.surface, border: '1px solid ' + C.border, boxShadow: '0 20px 60px rgba(0,0,0,0.08)' }}}}>
      <div className="flex items-center justify-between px-5 py-3" style={{{{ borderBottom: '1px solid ' + C.border }}}}>
        <div className="flex items-center gap-2">
          <BarChart3 size={{14}} style={{{{ color: C.accent }}}} />
          <p className="text-xs font-bold" style={{{{ color: C.text }}}}>Dashboard</p>
        </div>
        <p className="text-[10px] capitalize" style={{{{ color: C.muted }}}}>{{today}}</p>
      </div>

      <div className="p-4 space-y-3.5">
        <div className="grid grid-cols-2 gap-2">
          {{kpis.map(k => (
            <div key={{k.label}} className="rounded-xl p-2.5" style={{{{ background: C.bg, border: '1px solid ' + C.borderLight }}}}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">{{k.icon}}</span>
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{{{ background: C.greenSoft, color: C.green }}}}>
                  {chr(9650)} {{k.change}}
                </span>
              </div>
              <p className="text-[9px]" style={{{{ color: C.muted }}}}>{{k.label}}</p>
              <p className="text-sm font-extrabold" style={{{{ color: C.text }}}}>{{k.value}}</p>
            </div>
          ))}}
        </div>

        <div className="rounded-xl p-3" style={{{{ background: C.bg, border: '1px solid ' + C.borderLight }}}}>
          <p className="text-[9px] font-bold mb-2" style={{{{ color: C.text }}}}>Ventas ultimos 7 dias</p>
          <svg viewBox="0 0 280 80" className="w-full h-auto">
            {{barData.map((d, i) => {{
              const bw = 24;
              const gap = (280 - barData.length * bw) / (barData.length + 1);
              const x = gap + i * (bw + gap);
              const h = (d.val / maxBar) * 55;
              const isToday = i === barData.length - 1;
              return (
                <g key={{d.day}}>
                  <rect x={{x}} y={{65 - h}} width={{bw}} height={{h}} rx={{5}} fill={{isToday ? C.accent : C.accent + '30'}} />
                  <text x={{x + bw / 2}} y={{76}} textAnchor="middle" fontSize="7" fill={{C.muted}} fontWeight="600">{{d.day}}</text>
                </g>
              );
            }})}}
          </svg>
        </div>

        {{/* Top products */}}
        <div className="rounded-xl overflow-hidden" style={{{{ border: '1px solid ' + C.borderLight }}}}>
          <p className="text-[9px] font-bold px-3 py-2" style={{{{ background: C.bg, color: C.text }}}}>Productos top hoy</p>
          {{[
            {{ name: 'Big Mac', qty: 18, total: '$520.200' }},
            {{ name: 'McNuggets x10', qty: 12, total: '$226.800' }},
            {{ name: 'McFlurry Oreo', qty: 15, total: '$193.500' }},
          ].map((p, i) => (
            <div key={{p.name}} className="flex items-center gap-2 px-3 py-2 text-[10px]" style={{{{ borderTop: '1px solid ' + C.borderLight }}}}>
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{{{ background: i === 0 ? C.accent : i === 1 ? C.gold : C.muted }}}}>{{i + 1}}</span>
              <span className="flex-1 font-semibold truncate" style={{{{ color: C.text }}}}>{{p.name}}</span>
              <span style={{{{ color: C.muted }}}}>{{p.qty}} uds</span>
              <span className="font-bold" style={{{{ color: C.text }}}}>{{p.total}}</span>
            </div>
          ))}}
        </div>
      </div>
    </div>
  );
}}

/* ===============================================================
   FAQ
   =============================================================== */
const FAQ_DATA = [
  {{ q: '\\u00bfCobran comision por pedido?', a: 'Cero comisiones en todos los planes, incluyendo el gratuito. Lo que vendes es 100% tuyo. Sin letra peque\\u00f1a.' }},
  {{ q: '\\u00bfCuanto tardo en configurar mi menu?', a: 'Menos de 5 minutos. Te guiamos paso a paso con un asistente de configuracion que hace todo simple.' }},
  {{ q: '\\u00bfFunciona sin internet en el restaurante?', a: 'Si. El POS y KDS tienen soporte offline. Los pedidos se sincronizan cuando vuelve la conexion.' }},
  {{ q: '\\u00bfPuedo cancelar cuando quiera?', a: 'Si. Sin contratos, sin penalidades, sin preguntas. Cancelas desde tu panel en un clic.' }},
  {{ q: '\\u00bfQue metodos de pago aceptan mis clientes?', a: 'Nequi, Daviplata, PSE, efectivo, transferencia bancaria y tarjeta de credito. Tu configuras cuales mostrar.' }},
  {{ q: '\\u00bfNecesito un dispositivo especial?', a: 'No. Funciona en cualquier celular, tablet o computador con navegador web. Sin apps, sin descargas.' }},
];

function FAQAccordion() {{
  const [open, setOpen] = useState(null);
  return (
    <div className="space-y-2 max-w-3xl mx-auto">
      {{FAQ_DATA.map((item, i) => (
        <motion.div
          key={{i}}
          layout
          className="rounded-xl overflow-hidden"
          style={{{{ background: open === i ? C.surface : 'transparent', border: '1px solid ' + (open === i ? C.border : C.borderLight) }}}}
        >
          <button
            onClick={{() => setOpen(open === i ? null : i)}}
            className="flex items-center justify-between w-full px-5 py-4 text-left group"
          >
            <span className="text-sm font-semibold pr-4 group-hover:translate-x-1 transition-transform" style={{{{ color: C.text }}}}>{{item.q}}</span>
            <motion.div animate={{{{ rotate: open === i ? 180 : 0 }}}} transition={{{{ duration: 0.3 }}}}>
              <ChevronDown size={{16}} style={{{{ color: C.muted }}}} />
            </motion.div>
          </button>
          <AnimatePresence>
            {{open === i && (
              <motion.div
                initial={{{{ height: 0, opacity: 0 }}}}
                animate={{{{ height: 'auto', opacity: 1 }}}}
                exit={{{{ height: 0, opacity: 0 }}}}
                transition={{{{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}}}
                className="overflow-hidden"
              >
                <p className="px-5 pb-4 text-sm leading-relaxed" style={{{{ color: C.muted }}}}>{{item.a}}</p>
              </motion.div>
            )}}
          </AnimatePresence>
        </motion.div>
      ))}}
    </div>
  );
}}

/* ===============================================================
   PRICING
   =============================================================== */
const PLANS = [
  {{ id: 'free', name: 'Gratis', monthly: 0, annual: 0, desc: 'Para validar tu idea', features: ['20 productos', 'Menu QR', '30 pedidos/mes', '1 zona de entrega', 'Resenas'], cta: 'Empezar Gratis', popular: false }},
  {{ id: 'starter', name: 'Starter', monthly: 39900, annual: 34900, desc: 'Para crecer con automatizacion', features: ['60 productos', 'Push notifications', 'KDS basico', 'Toppings/extras', 'Zonas ilimitadas'], cta: 'Elegir Starter', popular: false }},
  {{ id: 'pro', name: 'Pro', monthly: 59900, annual: 49900, desc: 'Para operaciones serias', features: ['Todo ilimitado', 'Reservas + recordatorios', 'Programa de lealtad', 'Analytics + IA', 'Carritos abandonados'], cta: 'Elegir Pro', popular: true }},
  {{ id: 'pro_max', name: 'Pro Max', monthly: 89900, annual: 74900, desc: 'Para alto volumen', features: ['Todo de Pro', 'Soporte prioritario', 'Acceso anticipado', 'Eventos exclusivos', 'IA avanzada'], cta: 'Elegir Pro Max', popular: false }},
];

/* === MARQUEE === */
const MARQUEE = [
  '{burger_e} Burger House', '{chr(9749)} Cafe Central', '{pizza_e} La Lena', '{taco_e} Taqueria MX',
  '{sushi_e} Sushi Mar', '{chicken_e} Asadero Don Carlos', '{salad_e} Saludable Co', '{cake_e} Dulce & Cafe',
  '{beer_e} Bar 58', '{croissant_e} Pan & Mantequilla', '{icecream_e} Helados Gourmet', '{burrito_e} Wrap House',
];

/* ===============================================================
   FEATURE CARDS
   =============================================================== */
const FEATURES = [
  {{
    icon: QrCode, title: 'Menu Digital & QR', color: '#E8002D',
    desc: 'Tus clientes escanean, ven tu menu y piden desde su celular. Sin apps, sin esperas.',
    details: ['Categorias con emojis', 'Toppings y extras', 'Favoritos y busqueda', 'QR por mesa'],
  }},
  {{
    icon: Bell, title: 'Pedidos en Tiempo Real', color: '#7C3AED',
    desc: 'Cada pedido llega instantaneamente a tu panel con notificacion push y sonido.',
    details: ['Push al admin y cliente', 'Seguimiento de estados', 'Comprobante de pago', 'Domicilio + en sitio'],
  }},
  {{
    icon: Monitor, title: 'Pantalla de Cocina (KDS)', color: '#0891B2',
    desc: 'Tu equipo ve los pedidos con timers de preparacion. Sin gritos, sin papeles.',
    details: ['Timers por pedido', 'Prioridad por tiempo', 'Marcar como listo', 'Multi-pantalla'],
  }},
  {{
    icon: Gift, title: 'Programa de Lealtad', color: '#D97706',
    desc: 'Puntos, niveles y recompensas para que tus clientes vuelvan una y otra vez.',
    details: ['Puntos por compra', 'Tiers de lealtad', 'Cupones y descuentos', 'Canje de recompensas'],
  }},
  {{
    icon: BarChart3, title: 'Analytics & IA', color: '#059669',
    desc: 'Sabe que se vende, cuando y a quien. Decisiones con datos, no con intuicion.',
    details: ['Ventas por periodo', 'Productos top', 'Ticket promedio', 'Carritos abandonados'],
  }},
  {{
    icon: MapPin, title: 'Delivery & Zonas', color: '#DC2626',
    desc: 'Define zonas de entrega con costos diferenciados y tracking en tiempo real.',
    details: ['Zonas geograficas', 'Costos por zona', 'Tracking publico', 'QR para delivery'],
  }},
];

/* ===============================================================
   MAIN HOME COMPONENT
   =============================================================== */
export default function Home() {{
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [demoTab, setDemoTab] = useState(0);
  const [ctaSubmitted, setCtaSubmitted] = useState(false);
  const [ctaEmail, setCtaEmail] = useState('');
  const [hoveredFeature, setHoveredFeature] = useState(null);

  const heroRef = useRef(null);
  const statsRef = useRef(null);
  const statsInView = useInView(statsRef, {{ once: true, margin: '-80px' }});
  const {{ scrollYProgress }} = useScroll();
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '15%']);

  useLandingSEO({{
    title: 'Menuby — Menu Digital y Pedidos para Restaurantes en Colombia',
    description: 'Menu digital, pedidos en tiempo real, pantalla de cocina, programa de fidelizacion y analytics. Todo en uno. Sin comisiones. Desde $0.',
    canonical: '/',
    keywords: 'menu digital restaurante colombia, sistema restaurantes, software restaurantes, menu QR, pedidos en linea, KDS cocina',
  }});

  const handleCtaSubmit = (e) => {{
    e.preventDefault();
    if (ctaEmail.trim()) setCtaSubmitted(true);
  }};

  const demoTabs = [
    {{ label: 'Menu del cliente', icon: Smartphone }},
    {{ label: 'Pantalla de Cocina', icon: UtensilsCrossed }},
    {{ label: 'Dashboard', icon: BarChart3 }},
  ];

  return (
    <div style={{{{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: C.text, background: C.bg, overflowX: 'hidden' }}}}>
      <style>{{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap');
        .hd {{ font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 900; letter-spacing: -0.04em; line-height: 1; }}
        .hd-sub {{ font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; letter-spacing: -0.03em; line-height: 1.05; }}
        @keyframes marquee-scroll {{ 0% {{ transform: translateX(0); }} 100% {{ transform: translateX(-50%); }} }}
        .marquee-track {{ animation: marquee-scroll 35s linear infinite; }}
        .marquee-track:hover {{ animation-play-state: paused; }}
        @keyframes grain {{ 0%,100% {{ transform: translate(0,0) }} 10% {{ transform: translate(-5%,-10%) }} 30% {{ transform: translate(3%,-15%) }} 50% {{ transform: translate(-15%,5%) }} 70% {{ transform: translate(8%,10%) }} 90% {{ transform: translate(-10%,15%) }} }}
        .noise::after {{ content: ''; position: absolute; inset: -50%; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E"); animation: grain 8s steps(10) infinite; pointer-events: none; }}
      `}}</style>

      {{/* ========== HERO ========== */}}
      <div className="relative overflow-hidden noise" ref={{heroRef}}>
        {{/* Ambient glow */}}
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.07] blur-[120px] pointer-events-none" style={{{{ background: C.accent }}}} />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-[0.04] blur-[100px] pointer-events-none" style={{{{ background: '#7C3AED' }}}} />

        <Section className="pt-28 sm:pt-36 lg:pt-40 pb-20 sm:pb-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              {{/* Badge */}}
              <FadeInWhenVisible delay={{0}}>
                <motion.div
                  initial={{{{ opacity: 0, y: 20 }}}}
                  animate={{{{ opacity: 1, y: 0 }}}}
                  transition={{{{ duration: 0.6 }}}}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold mb-7 backdrop-blur-sm"
                  style={{{{ background: 'rgba(232,0,45,0.06)', color: C.accent, border: '1px solid rgba(232,0,45,0.12)' }}}}
                >
                  <motion.span animate={{{{ scale: [1, 1.2, 1] }}}} transition={{{{ duration: 2, repeat: Infinity }}}} className="text-sm">{fire}</motion.span>
                  +500 restaurantes en Colombia
                </motion.div>
              </FadeInWhenVisible>

              {{/* Headline */}}
              <motion.h1
                initial={{{{ opacity: 0, y: 30 }}}}
                animate={{{{ opacity: 1, y: 0 }}}}
                transition={{{{ duration: 0.8, delay: 0.1 }}}}
                className="hd text-[2.5rem] sm:text-[3.2rem] lg:text-[3.8rem] mb-6"
                style={{{{ color: C.text }}}}
              >
                Tu restaurante<br />
                merece <span className="relative inline-block">
                  <span style={{{{ color: C.accent }}}}>mas</span>
                  <motion.svg
                    initial={{{{ pathLength: 0 }}}}
                    animate={{{{ pathLength: 1 }}}}
                    transition={{{{ duration: 1.2, delay: 0.8, ease: 'easeOut' }}}}
                    className="absolute -bottom-2 left-0 w-full"
                    viewBox="0 0 100 8" fill="none"
                  >
                    <motion.path d="M2 6C20 2 40 2 50 4C60 6 80 3 98 2" stroke={{C.accent}} strokeWidth="2.5" strokeLinecap="round" fill="none" />
                  </motion.svg>
                </span>
              </motion.h1>

              <motion.p
                initial={{{{ opacity: 0, y: 20 }}}}
                animate={{{{ opacity: 1, y: 0 }}}}
                transition={{{{ duration: 0.7, delay: 0.25 }}}}
                className="text-base sm:text-lg leading-relaxed mb-9 max-w-md"
                style={{{{ color: C.textSecondary }}}}
              >
                Menu digital, pedidos en tiempo real, pantalla de cocina y programa de fidelizacion. Todo desde una sola plataforma. <span className="font-semibold" style={{{{ color: C.text }}}}>Sin comisiones.</span>
              </motion.p>

              {{/* CTAs */}}
              <motion.div
                initial={{{{ opacity: 0, y: 20 }}}}
                animate={{{{ opacity: 1, y: 0 }}}}
                transition={{{{ duration: 0.6, delay: 0.4 }}}}
                className="flex flex-wrap gap-3 mb-6"
              >
                <MagneticButton>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.97]"
                    style={{{{ background: C.accent, boxShadow: '0 8px 40px rgba(232,0,45,0.3), 0 2px 4px rgba(232,0,45,0.2)' }}}}
                  >
                    Crear Mi Menu Gratis <ArrowRight size={{16}} strokeWidth={{2.5}} />
                  </Link>
                </MagneticButton>
                <Link
                  to="/demo"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-semibold transition-all hover:bg-white/80 backdrop-blur-sm group"
                  style={{{{ color: C.text, border: '1px solid ' + C.border, background: 'rgba(255,255,255,0.6)' }}}}
                >
                  Ver Demo
                  <motion.span animate={{{{ x: [0, 4, 0] }}}} transition={{{{ duration: 1.5, repeat: Infinity }}}} className="inline-block">{chr(8594)}</motion.span>
                </Link>
              </motion.div>

              {{/* Trust signals */}}
              <motion.div
                initial={{{{ opacity: 0 }}}}
                animate={{{{ opacity: 1 }}}}
                transition={{{{ delay: 0.6 }}}}
                className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]"
                style={{{{ color: C.muted }}}}
              >
                {{['Sin tarjeta de credito', 'Listo en 5 minutos', 'Cancela cuando quieras'].map((t, i) => (
                  <span key={{t}} className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{{{ background: C.greenSoft }}}}>
                      <Check size={{8}} style={{{{ color: C.green }}}} strokeWidth={{3}} />
                    </span>
                    {{t}}
                  </span>
                ))}}
              </motion.div>
            </div>

            {{/* Phone mockup */}}
            <motion.div
              initial={{{{ opacity: 0, y: 50, rotateY: -5 }}}}
              animate={{{{ opacity: 1, y: 0, rotateY: 0 }}}}
              transition={{{{ duration: 1, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}}}
              className="hidden lg:block"
            >
              <RealMenuMockup />
            </motion.div>
          </div>
        </Section>
      </div>

      {{/* ========== MARQUEE ========== */}}
      <div className="py-7 overflow-hidden relative" style={{{{ background: C.surface, borderTop: '1px solid ' + C.borderLight, borderBottom: '1px solid ' + C.borderLight }}}}>
        <div className="absolute left-0 top-0 bottom-0 w-20 z-10" style={{{{ background: `linear-gradient(90deg, ${{C.surface}}, transparent)` }}}} />
        <div className="absolute right-0 top-0 bottom-0 w-20 z-10" style={{{{ background: `linear-gradient(270deg, ${{C.surface}}, transparent)` }}}} />
        <div className="flex marquee-track w-max">
          {{[...MARQUEE, ...MARQUEE].map((item, i) => (
            <span key={{i}} className="shrink-0 mx-2 px-4 py-2 rounded-full text-[11px] font-semibold" style={{{{ background: C.bg, border: '1px solid ' + C.borderLight, color: C.text }}}}>
              {{item}}
            </span>
          ))}}
        </div>
      </div>

      {{/* ========== ANTES / DESPUES ========== */}}
      <Section className="py-20 sm:py-28">
        <FadeInWhenVisible>
          <p className="text-center text-[11px] font-bold tracking-widest uppercase mb-3" style={{{{ color: C.accent }}}}>El problema</p>
          <h2 className="hd-sub text-3xl sm:text-4xl lg:text-[2.8rem] text-center mb-4" style={{{{ color: C.text }}}}>
            Como opera tu restaurante hoy?
          </h2>
          <p className="text-center text-sm mb-12 max-w-lg mx-auto" style={{{{ color: C.muted }}}}>
            Compara tu operacion actual con lo que podrias tener en 5 minutos
          </p>
        </FadeInWhenVisible>

        <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
          <FadeInWhenVisible delay={{0.1}}>
            <div className="rounded-2xl p-7 h-full relative overflow-hidden" style={{{{ background: '#FEF2F2', border: '1px solid #FECACA' }}}}>
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 blur-2xl" style={{{{ background: '#EF4444' }}}} />
              <p className="font-extrabold text-sm mb-5 flex items-center gap-2" style={{{{ color: '#DC2626' }}}}>
                <span className="w-6 h-6 rounded-lg bg-red-100 flex items-center justify-center"><X size={{14}} className="text-red-500" /></span>
                Sin Menuby
              </p>
              <ul className="space-y-3.5">
                {{[
                  'Pedidos por WhatsApp que se pierden en el chat',
                  'Comisiones del 15-30% a plataformas de delivery',
                  'Sin datos: no sabes que se vendio ni cuanto',
                  'Cocina desorganizada, pedidos a gritos',
                  'Clientes que no vuelven porque no los fidelizas',
                ].map(t => (
                  <li key={{t}} className="flex items-start gap-2.5 text-[13px] leading-snug" style={{{{ color: '#991B1B' }}}}>
                    <X size={{13}} className="mt-0.5 shrink-0 text-red-400" /> {{t}}
                  </li>
                ))}}
              </ul>
            </div>
          </FadeInWhenVisible>

          <FadeInWhenVisible delay={{0.2}}>
            <div className="rounded-2xl p-7 h-full relative overflow-hidden" style={{{{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}}}>
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 blur-2xl" style={{{{ background: '#10B981' }}}} />
              <p className="font-extrabold text-sm mb-5 flex items-center gap-2" style={{{{ color: C.green }}}}>
                <span className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center"><Check size={{14}} className="text-emerald-600" /></span>
                Con Menuby
              </p>
              <ul className="space-y-3.5">
                {{[
                  'Pedidos llegan en tiempo real a tu panel con push',
                  '0% comision — tus ventas son completamente tuyas',
                  'Analytics completo: ventas, productos top, ticket',
                  'KDS con timers para cocina organizada',
                  'Programa de lealtad con puntos y recompensas',
                ].map(t => (
                  <li key={{t}} className="flex items-start gap-2.5 text-[13px] leading-snug" style={{{{ color: '#064E3B' }}}}>
                    <Check size={{13}} className="mt-0.5 shrink-0 text-emerald-500" /> {{t}}
                  </li>
                ))}}
              </ul>
            </div>
          </FadeInWhenVisible>
        </div>
      </Section>

      {{/* ========== FEATURES ========== */}}
      <div style={{{{ background: C.surface, borderTop: '1px solid ' + C.borderLight }}}}>
        <Section className="py-20 sm:py-28">
          <FadeInWhenVisible>
            <p className="text-center text-[11px] font-bold tracking-widest uppercase mb-3" style={{{{ color: C.accent }}}}>Funciones</p>
            <h2 className="hd-sub text-3xl sm:text-4xl lg:text-[2.8rem] text-center mb-4">
              Todo lo que necesitas en un solo lugar
            </h2>
            <p className="text-center text-sm mb-14 max-w-lg mx-auto" style={{{{ color: C.muted }}}}>
              Desde el menu digital hasta el programa de fidelizacion. Una plataforma completa.
            </p>
          </FadeInWhenVisible>

          <StaggerContainer className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" stagger={{0.06}}>
            {{FEATURES.map((f, i) => (
              <motion.div
                key={{f.title}}
                variants={{staggerChild}}
                onMouseEnter={{() => setHoveredFeature(i)}}
                onMouseLeave={{() => setHoveredFeature(null)}}
                className="rounded-2xl p-6 relative overflow-hidden transition-all duration-300 group cursor-default"
                style={{{{
                  background: C.card,
                  border: '1px solid ' + (hoveredFeature === i ? f.color + '30' : C.borderLight),
                  boxShadow: hoveredFeature === i ? `0 8px 40px ${{f.color}}10` : '0 1px 3px rgba(0,0,0,0.04)',
                }}}}
              >
                {{/* Hover glow */}}
                <div
                  className="absolute top-0 right-0 w-28 h-28 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-3xl pointer-events-none"
                  style={{{{ background: f.color }}}}
                />

                <div className="relative z-10">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                    style={{{{ background: f.color + '10' }}}}
                  >
                    <f.icon size={{20}} style={{{{ color: f.color }}}} />
                  </div>
                  <h3 className="text-[15px] font-extrabold mb-2" style={{{{ color: C.text }}}}>{{f.title}}</h3>
                  <p className="text-[12px] leading-relaxed mb-4" style={{{{ color: C.muted }}}}>{{f.desc}}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {{f.details.map(d => (
                      <span key={{d}} className="text-[10px] font-medium px-2 py-0.5 rounded-md" style={{{{ background: f.color + '08', color: f.color }}}}>
                        {{d}}
                      </span>
                    ))}}
                  </div>
                </div>
              </motion.div>
            ))}}
          </StaggerContainer>
        </Section>
      </div>

      {{/* ========== INTERACTIVE DEMO ========== */}}
      <Section id="demo" className="py-20 sm:py-28">
        <FadeInWhenVisible>
          <p className="text-center text-[11px] font-bold tracking-widest uppercase mb-3" style={{{{ color: C.accent }}}}>Demo en vivo</p>
          <h2 className="hd-sub text-3xl sm:text-4xl lg:text-[2.8rem] text-center mb-4">
            Asi se ve Menuby en accion
          </h2>
          <p className="text-center text-sm mb-10 max-w-lg mx-auto" style={{{{ color: C.muted }}}}>
            Interactivo. Haz clic, agrega productos, marca pedidos como listos.
          </p>
        </FadeInWhenVisible>

        {{/* Tab bar */}}
        <div className="flex justify-center mb-10">
          <div className="inline-flex rounded-2xl p-1.5 gap-1" style={{{{ background: C.elevated, border: '1px solid ' + C.border }}}}>
            {{demoTabs.map((tab, i) => (
              <button
                key={{tab.label}}
                onClick={{() => setDemoTab(i)}}
                className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-[12px] sm:text-[13px] font-semibold transition-all duration-200"
                style={{{{
                  background: demoTab === i ? C.surface : 'transparent',
                  color: demoTab === i ? C.text : C.muted,
                  boxShadow: demoTab === i ? '0 2px 12px rgba(0,0,0,0.06)' : 'none',
                }}}}
              >
                <tab.icon size={{14}} style={{{{ color: demoTab === i ? C.accent : C.muted }}}} />
                <span className="hidden sm:inline">{{tab.label}}</span>
              </button>
            ))}}
          </div>
        </div>

        {{/* Demo content */}}
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={{demoTab}}
              initial={{{{ opacity: 0, y: 16, filter: 'blur(4px)' }}}}
              animate={{{{ opacity: 1, y: 0, filter: 'blur(0px)' }}}}
              exit={{{{ opacity: 0, y: -16, filter: 'blur(4px)' }}}}
              transition={{{{ duration: 0.35 }}}}
            >
              {{demoTab === 0 && <RealMenuMockup />}}
              {{demoTab === 1 && <KDSMockup />}}
              {{demoTab === 2 && <DashboardMockup />}}
            </motion.div>
          </AnimatePresence>
        </div>
      </Section>

      {{/* ========== STATS ========== */}}
      <div ref={{statsRef}} className="relative overflow-hidden noise" style={{{{ background: C.dark }}}}>
        <div className="absolute inset-0 opacity-[0.03]" style={{{{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(232,0,45,0.5), transparent 70%)' }}}} />
        <Section className="py-16 sm:py-24">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {{[
              {{ end: 500, suffix: '+', label: 'Restaurantes activos' }},
              {{ end: 0, suffix: '%', label: 'Comision por pedido' }},
              {{ end: 5, suffix: ' min', label: 'Tiempo de setup' }},
              {{ end: 15, suffix: '+', label: 'Ciudades en Colombia' }},
            ].map((s, i) => (
              <FadeInWhenVisible key={{s.label}} delay={{i * 0.1}} y={{20}}>
                <p className="hd text-3xl sm:text-5xl text-white mb-1">
                  <CounterValue end={{s.end}} active={{statsInView}} />{{s.suffix}}
                </p>
                <p className="text-[11px] sm:text-xs text-white/40 font-medium">{{s.label}}</p>
              </FadeInWhenVisible>
            ))}}
          </div>
        </Section>
      </div>

      {{/* ========== PRICING ========== */}}
      <Section id="pricing" className="py-20 sm:py-28">
        <FadeInWhenVisible>
          <p className="text-center text-[11px] font-bold tracking-widest uppercase mb-3" style={{{{ color: C.accent }}}}>Precios</p>
          <h2 className="hd-sub text-3xl sm:text-4xl lg:text-[2.8rem] text-center mb-3">
            Planes sin comisiones ocultas
          </h2>
          <p className="text-center text-sm mb-8 max-w-md mx-auto" style={{{{ color: C.muted }}}}>
            Tarifa fija mensual. Sin castigo por crecer. Sin letra pequena.
          </p>
        </FadeInWhenVisible>

        {{/* Toggle */}}
        <div className="flex justify-center items-center gap-3 mb-12">
          <div className="inline-flex rounded-xl p-1" style={{{{ background: C.elevated, border: '1px solid ' + C.border }}}}>
            {{['monthly', 'annual'].map(c => (
              <button
                key={{c}}
                onClick={{() => setBillingCycle(c)}}
                className="px-5 py-2.5 rounded-lg text-xs font-semibold transition-all"
                style={{{{
                  background: billingCycle === c ? C.surface : 'transparent',
                  color: billingCycle === c ? C.text : C.muted,
                  boxShadow: billingCycle === c ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                }}}}
              >
                {{c === 'monthly' ? 'Mensual' : 'Anual'}}
              </button>
            ))}}
          </div>
          <AnimatePresence>
            {{billingCycle === 'annual' && (
              <motion.span
                initial={{{{ opacity: 0, scale: 0.8 }}}}
                animate={{{{ opacity: 1, scale: 1 }}}}
                exit={{{{ opacity: 0, scale: 0.8 }}}}
                className="text-[10px] font-bold px-2.5 py-1 rounded-full text-white"
                style={{{{ background: C.green }}}}
              >
                Ahorra 2 meses
              </motion.span>
            )}}
          </AnimatePresence>
        </div>

        {{/* Plan cards */}}
        <StaggerContainer className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 max-w-5xl mx-auto" stagger={{0.06}}>
          {{PLANS.map((plan) => {{
            const price = billingCycle === 'annual' ? plan.annual : plan.monthly;
            const isPop = plan.popular;
            return (
              <motion.div
                key={{plan.id}}
                variants={{staggerChild}}
                whileHover={{{{ y: -4 }}}}
                className={{`relative rounded-2xl p-6 flex flex-col transition-shadow duration-300 ${{isPop ? 'shadow-xl' : 'shadow-sm hover:shadow-lg'}}`}}
                style={{{{
                  background: C.surface,
                  border: isPop ? '2px solid ' + C.accent : '1px solid ' + C.border,
                }}}}
              >
                {{isPop && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold text-white" style={{{{ background: C.accent }}}}>
                    Mas popular
                  </span>
                )}}

                <h3 className="text-base font-extrabold" style={{{{ color: C.text }}}}>{{plan.name}}</h3>
                <p className="text-[11px] mt-1 mb-4" style={{{{ color: C.muted }}}}>{{plan.desc}}</p>

                <div className="mb-5">
                  <span className="hd text-3xl" style={{{{ color: C.text }}}}>
                    {{plan.id === 'free' ? '$0' : fmtCOP(price)}}
                  </span>
                  <span className="text-[11px] ml-1" style={{{{ color: C.muted }}}}>
                    {{plan.id === 'free' ? ' siempre' : '/mes'}}
                  </span>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {{plan.features.map(f => (
                    <li key={{f}} className="flex items-center gap-2 text-[12px]" style={{{{ color: C.textSecondary }}}}>
                      <Check size={{13}} style={{{{ color: C.accent }}}} strokeWidth={{2.5}} /> {{f}}
                    </li>
                  ))}}
                </ul>

                <Link
                  to="/register"
                  className="block w-full text-center py-3 rounded-xl text-[13px] font-bold transition-all hover:shadow-md active:scale-[0.97]"
                  style={{
                    isPop
                      ? {{ background: C.accent, color: '#fff', boxShadow: '0 4px 20px rgba(232,0,45,0.25)' }}
                      : {{ background: 'transparent', color: isPop ? '#fff' : C.text, border: '1px solid ' + C.border }}
                  }}
                >
                  {{plan.cta}}
                </Link>
              </motion.div>
            );
          }})}}
        </StaggerContainer>
      </Section>

      {{/* ========== FAQ ========== */}}
      <div style={{{{ background: C.surface, borderTop: '1px solid ' + C.borderLight }}}}>
        <Section className="py-20 sm:py-28">
          <FadeInWhenVisible>
            <p className="text-center text-[11px] font-bold tracking-widest uppercase mb-3" style={{{{ color: C.accent }}}}>FAQ</p>
            <h2 className="hd-sub text-3xl sm:text-4xl text-center mb-3">Preguntas frecuentes</h2>
            <p className="text-center text-sm mb-12" style={{{{ color: C.muted }}}}>Todo lo que necesitas saber</p>
          </FadeInWhenVisible>
          <FAQAccordion />
        </Section>
      </div>

      {{/* ========== CTA FINAL ========== */}}
      <div className="relative overflow-hidden noise">
        <div className="absolute inset-0" style={{{{ background: 'linear-gradient(135deg, #E8002D, #B80024, #8B0000)' }}}} />
        <div className="absolute inset-0 opacity-10" style={{{{ backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.3), transparent 60%)' }}}} />

        <Section className="py-20 sm:py-28 relative z-10">
          <div className="max-w-2xl mx-auto text-center">
            <FadeInWhenVisible>
              <h2 className="hd text-3xl sm:text-4xl lg:text-5xl text-white mb-5">
                Empieza hoy.<br />Tu primer menu es gratis.
              </h2>
              <p className="text-sm sm:text-base text-white/70 mb-10 max-w-md mx-auto">
                Unete a mas de 500 restaurantes colombianos que ya operan con Menuby
              </p>

              {{ctaSubmitted ? (
                <motion.div
                  initial={{{{ opacity: 0, scale: 0.9 }}}}
                  animate={{{{ opacity: 1, scale: 1 }}}}
                  className="flex items-center justify-center gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Check size={{20}} className="text-white" />
                  </div>
                  <p className="text-white text-lg font-bold">Listo! En menos de 24h te contactamos.</p>
                </motion.div>
              ) : (
                <form onSubmit={{handleCtaSubmit}} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                  <input
                    type="email"
                    required
                    placeholder="tu@email.com"
                    value={{ctaEmail}}
                    onChange={{(e) => setCtaEmail(e.target.value)}}
                    className="flex-1 px-5 py-4 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                    style={{{{ background: 'rgba(255,255,255,0.95)', color: C.text }}}}
                  />
                  <MagneticButton>
                    <button
                      type="submit"
                      className="px-7 py-4 rounded-xl text-sm font-bold transition-all hover:shadow-xl active:scale-[0.97] shrink-0"
                      style={{{{ background: '#fff', color: C.accent }}}}
                    >
                      Crear cuenta gratis
                    </button>
                  </MagneticButton>
                </form>
              )}}

              <div className="flex justify-center gap-5 mt-8 text-[11px] text-white/40">
                <a href="tel:+573028181520" className="hover:text-white/80 transition-colors">+57 302 818 1520</a>
                <span>{chr(183)}</span>
                <a href="mailto:hola@menuby.tech" className="hover:text-white/80 transition-colors">hola@menuby.tech</a>
              </div>
            </FadeInWhenVisible>
          </div>
        </Section>
      </div>
    </div>
  );
}}
'''

target = r'c:\Users\TECNOPHONE\Desktop\SisRestaurantes\Frontend\src\Pages\Landing\Home.jsx'
with open(target, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Written {{len(content)}} chars to Home.jsx')
