import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBusinessConfig } from '../../Context/BusinessContext';
import DashboardMetrics from './DashboardMetrics';
import AnnouncementInlineBar from './AnnouncementInlineBar';
import api from '../../services/api';

/* ═══ Icon System ═══ */
const I = {
  orders:    (c) => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>,
  completed: (c) => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>,
  payment:   (c) => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>,
  customers: (c) => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  reviews:   (c) => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  products:  (c) => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>,
  categories:(c) => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
  toppings:  (c) => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="10"/></svg>,
  reorder:   (c) => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/></svg>,
  coupons:   (c) => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><circle cx="7" cy="7" r="1"/></svg>,
  catalog:   (c) => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
  tables:    (c) => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7zM14 14h3v3h-3z"/></svg>,
  zones:     (c) => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 10-16 0c0 3 2.7 7 8 11.7z"/></svg>,
  whatsapp:  (c) => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>,
  business:  (c) => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  theme:     (c) => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/></svg>,
  location:  (c) => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  subscription:(c) => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22M7 15h4"/></svg>,
  password:  (c) => <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
};

/* Color tokens */
const COLORS = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    icon: 'bg-blue-100 text-blue-600',    ring: 'ring-blue-500/20' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'bg-emerald-100 text-emerald-600', ring: 'ring-emerald-500/20' },
  teal:    { bg: 'bg-teal-50',    text: 'text-teal-600',    icon: 'bg-teal-100 text-teal-600',    ring: 'ring-teal-500/20' },
  cyan:    { bg: 'bg-cyan-50',    text: 'text-cyan-600',    icon: 'bg-cyan-100 text-cyan-600',    ring: 'ring-cyan-500/20' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   icon: 'bg-amber-100 text-amber-600',  ring: 'ring-amber-500/20' },
  orange:  { bg: 'bg-orange-50',  text: 'text-orange-600',  icon: 'bg-orange-100 text-orange-600', ring: 'ring-orange-500/20' },
  yellow:  { bg: 'bg-yellow-50',  text: 'text-yellow-600',  icon: 'bg-yellow-100 text-yellow-600', ring: 'ring-yellow-500/20' },
  purple:  { bg: 'bg-purple-50',  text: 'text-purple-600',  icon: 'bg-purple-100 text-purple-600', ring: 'ring-purple-500/20' },
  pink:    { bg: 'bg-pink-50',    text: 'text-pink-600',    icon: 'bg-pink-100 text-pink-600',    ring: 'ring-pink-500/20' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  icon: 'bg-violet-100 text-violet-600', ring: 'ring-violet-500/20' },
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600',  icon: 'bg-indigo-100 text-indigo-600', ring: 'ring-indigo-500/20' },
  green:   { bg: 'bg-green-50',   text: 'text-green-600',   icon: 'bg-green-100 text-green-600',  ring: 'ring-green-500/20' },
  slate:   { bg: 'bg-slate-50',   text: 'text-slate-600',   icon: 'bg-slate-100 text-slate-600',  ring: 'ring-slate-500/20' },
  fuchsia: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-600', icon: 'bg-fuchsia-100 text-fuchsia-600', ring: 'ring-fuchsia-500/20' },
  red:     { bg: 'bg-red-50',     text: 'text-red-600',     icon: 'bg-red-100 text-red-600',      ring: 'ring-red-500/20' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-600',    icon: 'bg-rose-100 text-rose-600',    ring: 'ring-rose-500/20' },
  gray:    { bg: 'bg-gray-50',    text: 'text-gray-600',    icon: 'bg-gray-100 text-gray-600',    ring: 'ring-gray-500/20' },
};

/* ═══ Section Data (desktop) ═══ */
const getSections = (isService, isHotel) => [
  {
    id: 'ops',
    label: 'Operaciones',
    items: [
      { tab: 'orders',           svgKey: 'orders',    title: isService ? 'Citas' : 'Pedidos',       desc: isService ? 'Gestión de citas' : 'Gestión en tiempo real', color: 'blue',    hasBadge: true },
      ...(isService ? [
        { tab: 'bookings',       svgKey: 'catalog',   title: 'Agenda',         desc: 'Calendario de citas',   color: 'indigo' },
        { tab: 'team',           svgKey: 'customers', title: 'Equipo',         desc: 'Profesionales',         color: 'violet' },
      ] : []),
      { tab: 'completed_orders', svgKey: 'completed', title: 'Completados',   desc: isService ? 'Historial de citas' : 'Historial de pedidos',  color: 'emerald' },
      { tab: 'payment-config',   svgKey: 'payment',   title: 'Pagos',         desc: 'Métodos de cobro',       color: 'teal' },
      { tab: 'customers',        svgKey: 'customers', title: 'Clientes',      desc: isHotel ? 'Huéspedes' : 'Base de datos',         color: 'cyan' },
      { tab: 'reviews',          svgKey: 'reviews',   title: 'Reseñas',       desc: 'Calificaciones',        color: 'amber' },
      { tab: 'pos',               svgKey: 'reorder',   title: 'Punto de Venta', desc: 'Sistema de caja',       color: 'purple', isRoute: true, routePath: 'pos', isBeta: true },
      { tab: 'waiter',            svgKey: 'orders',    title: 'Comanda',        desc: 'Pedidos desde celular',  color: 'rose',   isRoute: true, routePath: 'waiter' },
    ],
  },
  {
    id: 'menu',
    label: isService ? 'Servicios' : isHotel ? 'Room Service' : 'Menú',
    items: [
      { tab: 'products',         svgKey: 'products',   title: isService ? 'Servicios' : 'Productos',    desc: isService ? 'Administra tus servicios' : isHotel ? 'Menú de habitaciones' : 'Administra tu carta',    color: 'orange' },
      { tab: 'categories',       svgKey: 'categories', title: 'Categorías',   desc: isService ? 'Organiza servicios' : 'Organiza productos',     color: 'yellow' },
      { tab: 'toppings',         svgKey: 'toppings',   title: isService ? 'Opciones' : 'Extras',       desc: isService ? 'Variantes y opciones' : 'Toppings y opciones',    color: 'amber' },
      { tab: 'product-order',    svgKey: 'reorder',    title: 'Orden',        desc: isService ? 'Reordenar servicios' : 'Reordenar productos',    color: 'purple' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    items: [
      { tab: 'coupons',          svgKey: 'coupons',   title: 'Cupones',      desc: 'Descuentos y ofertas',   color: 'pink' },
      { tab: 'catalog',          svgKey: 'catalog',   title: 'Catálogo',     desc: 'Banners y promos',       color: 'violet' },
      ...(!isService ? [{ tab: 'tables',           svgKey: 'tables',    title: isHotel ? 'Habitaciones' : 'Mesas',        desc: isHotel ? 'QR por habitación' : 'Códigos QR',             color: 'indigo' }] : []),
      ...(!isService && !isHotel ? [{ tab: 'delivery-zones',   svgKey: 'zones',     title: 'Zonas',        desc: 'Áreas de entrega',       color: 'green' }] : []),
      { tab: 'whatsapp',         svgKey: 'whatsapp',  title: 'WhatsApp',     desc: 'Mensajería automática', color: 'green' },
      { tab: 'referrals',        svgKey: 'customers', title: 'Referidos',    desc: 'Invita y gana créditos', color: 'rose' },
      { tab: 'crew',             svgKey: 'customers', title: 'Crew',         desc: 'Personal por turnos',   color: 'fuchsia', isBeta: true },
    ],
  },
  {
    id: 'config',
    label: 'Configuración',
    items: [
      { tab: 'business',         svgKey: 'business',     title: 'Negocio',      desc: isService ? 'Info del negocio' : isHotel ? 'Info del hotel' : 'Info del restaurante',   color: 'slate' },
      { tab: 'theme',            svgKey: 'theme',        title: 'Tema',         desc: 'Personalización',        color: 'fuchsia' },
      { tab: 'location',         svgKey: 'location',     title: 'Ubicación',    desc: 'Dirección y mapa',        color: 'red' },
      { tab: 'subscription',     svgKey: 'subscription', title: 'Suscripción',  desc: 'Plan y facturación',      color: 'blue' },
      { tab: 'change-password',  svgKey: 'password',     title: 'Contraseña',   desc: 'Seguridad',              color: 'gray' },
    ],
  },
];

/* ═══ Onboarding Steps ═══ */
const getOnboarding = (isService, isHotel) => [
  { level: 1, label: 'Crear tu cuenta',  desc: '¡Listo! Ya tienes acceso', svgKey: 'completed' },
  { level: 2, label: isService ? 'Agrega servicios' : 'Agrega productos', desc: isService ? 'Crea tu primer servicio' : isHotel ? 'Crea tu menú de Room Service' : 'Crea tu primer plato', svgKey: 'products', tab: 'products' },
  { level: 3, label: 'Modo de pedidos',  desc: 'WhatsApp, app o ambos',    svgKey: 'business', tab: 'business' },
  { level: 4, label: isService ? 'Primeras citas' : 'Primeros pedidos', desc: isService ? 'Comparte y agenda' : isHotel ? 'Comparte el QR en habitaciones' : 'Comparte y empieza a vender', svgKey: 'orders', tab: 'orders' },
  { level: 5, label: 'Personaliza tema', desc: isService ? 'Dale estilo a tu página' : isHotel ? 'Personaliza tu Room Service' : 'Dale estilo a tu menú', svgKey: 'theme', tab: 'theme' },
  { level: 6, label: 'Herramientas pro', desc: isHotel ? 'Cupones, QR por habitación y más' : 'Cupones, zonas, QR y más', svgKey: 'coupons' },
];

/* ═══ Helpers ═══ */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

const fmtRevenue = (n) => {
  if (!n && n !== 0) return '—';
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${n}`;
};

/* ═══ Desktop sub-components (unchanged) ═══ */

function DashCard({ item, onClick, pendingOrdersCount }) {
  const clr = COLORS[item.color] || COLORS.slate;
  const SvgIcon = I[item.svgKey];
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="relative flex items-center gap-3 sm:flex-col sm:items-center sm:text-center
                 p-3 sm:p-4 rounded-2xl bg-white border border-slate-100
                 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.03)]
                 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:border-slate-200/80 hover:-translate-y-px
                 active:scale-[0.97] active:shadow-sm transition-all duration-200
                 text-left sm:min-h-[108px] group w-full"
    >
      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${clr.icon} flex items-center justify-center flex-shrink-0 group-hover:scale-105 group-hover:shadow-sm transition-all duration-200`}>
        {SvgIcon && SvgIcon('w-5 h-5 sm:w-[22px] sm:h-[22px]')}
      </div>
      <div className="flex-1 min-w-0 sm:flex-initial">
        <p className="text-[13px] sm:text-xs font-bold text-slate-800 leading-tight truncate sm:whitespace-normal">{item.title}</p>
        <p className="text-xs text-slate-400 font-medium mt-0.5 leading-tight truncate sm:whitespace-normal">{item.desc}</p>
      </div>
      <svg className="w-4 h-4 text-slate-300 flex-shrink-0 sm:hidden" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
      {item.hasBadge && pendingOrdersCount > 0 && (
        <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-extrabold rounded-full flex items-center justify-center shadow-lg shadow-red-500/25 ring-2 ring-white">
          {pendingOrdersCount > 99 ? '99+' : pendingOrdersCount}
        </span>
      )}
    </motion.button>
  );
}

function HeroCard({ svgKey, title, subtitle, onClick, count, colorClass }) {
  const SvgIcon = I[svgKey];
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`relative flex-1 min-w-0 p-4 sm:p-5 rounded-2xl ${colorClass} text-white shadow-lg overflow-hidden group active:opacity-90 transition-opacity`}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.07] rounded-full blur-2xl translate-x-8 -translate-y-8" />
      <div className="absolute bottom-0 left-0 w-16 h-16 bg-black/[0.04] rounded-full blur-xl -translate-x-4 translate-y-4" />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
            {SvgIcon && SvgIcon('w-5 h-5 text-white')}
          </div>
          <h3 className="text-sm sm:text-base font-bold leading-tight">{title}</h3>
          <p className="text-xs text-white/60 mt-0.5 font-medium">{subtitle}</p>
        </div>
        {count > 0 && (
          <div className="flex-shrink-0 ml-2 bg-white/15 backdrop-blur-sm rounded-2xl px-3.5 py-2 text-center">
            <span className="text-xl sm:text-2xl font-extrabold block leading-none">{count > 99 ? '99+' : count}</span>
            <span className="text-xs text-white/50 font-semibold tracking-wide uppercase">Activos</span>
          </div>
        )}
      </div>
      <div className="absolute bottom-3 right-3 w-7 h-7 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors">
        <svg className="w-3.5 h-3.5 text-white/70" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
      </div>
    </motion.button>
  );
}

function StatusBadge({ businessConfig }) {
  const isOpen = businessConfig?.isOpen !== false;
  return (
    <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${isOpen ? 'bg-emerald-400/15 text-emerald-400' : 'bg-red-400/15 text-red-400'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-400' : 'bg-red-400'}`} />
      {isOpen ? 'Abierto' : 'Cerrado'}
    </div>
  );
}

/* ═══ Mobile Quick Action Card ═══ */
function MobileActionCard({ tab, gradient, icon, label, sublabel, badge, onClick }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className="relative flex flex-col items-center gap-2 py-4 px-1 bg-white rounded-2xl border border-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
    >
      {badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-sm ring-2 ring-white z-10">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      <div className={`w-[52px] h-[52px] bg-gradient-to-br ${gradient} rounded-[16px] flex items-center justify-center shadow-sm`}>
        {icon}
      </div>
      <div className="text-center px-0.5">
        <p className="text-[12.5px] font-bold text-slate-800 leading-tight">{label}</p>
        <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-tight">{sublabel}</p>
      </div>
    </motion.button>
  );
}

/* ═══ MAIN COMPONENT ═══ */
export default function AdminDashboard({ setActiveTab, pendingOrdersCount = 0, onboarding, onOpenModoOp }) {
  const { businessConfig, updateConfig } = useBusinessConfig();
  const [search, setSearch] = useState('');
  const [toggling, setToggling] = useState(false);
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);

  const isService = ['salon', 'spa', 'clinic', 'services'].includes(businessConfig?.businessType);
  const isHotel = businessConfig?.businessType === 'hotel';
  const isOpen = businessConfig?.isOpen !== false;
  const isNewUser = onboarding && !onboarding.isLegacy && onboarding.level < 6;
  const greeting = useMemo(() => getGreeting(), []);
  const slug = businessConfig?.slug;

  /* Fetch today's stats for mobile header bar */
  useEffect(() => {
    if (!businessConfig?._id) return;
    api.get(`/dashboard/stats?businessId=${businessConfig._id}`)
      .then(r => setStats(r.data))
      .catch(() => {});
  }, [businessConfig?._id]);

  const handleToggle = async () => {
    if (toggling) return;
    setToggling(true);
    try { await updateConfig({ isOpen: !isOpen }); } catch {}
    finally { setToggling(false); }
  };

  const copyLink = async () => {
    if (!slug) return;
    try {
      await navigator.clipboard.writeText(`https://menuby.tech/${slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {}
  };

  /* Desktop search */
  const q = search.trim().toLowerCase();
  const posBetaOn = businessConfig?.features?.posBetaEnabled;
  const SECTIONS = useMemo(() => getSections(isService, isHotel), [isService, isHotel]);
  const ALL_ITEMS = useMemo(() => SECTIONS.flatMap(s => s.items), [SECTIONS]);
  const filteredSections = useMemo(() => {
    const filterBeta = (items) => items.filter(i => !i.isBeta || posBetaOn);
    if (!q) return SECTIONS.map(s => ({ ...s, items: filterBeta(s.items) }));
    const results = ALL_ITEMS.filter(i =>
      (i.title.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q)) && (!i.isBeta || posBetaOn)
    );
    return [{ id: 'search', label: 'Resultados', items: results }];
  }, [q, posBetaOn, SECTIONS, ALL_ITEMS]);

  const handleNav = useCallback((tab) => setActiveTab(tab), [setActiveTab]);

  /* Desktop animation variants */
  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.035 } } };
  const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } } };

  /* Onboarding next step for mobile */
  const STEPS = [
    { level: 2, label: isService ? 'Agrega servicios' : 'Agrega productos', desc: isService ? 'Crea tu primer servicio' : 'Crea tu primer plato', tab: 'products' },
    { level: 3, label: 'Modo de pedidos', desc: 'WhatsApp, app o ambos', tab: 'business' },
    { level: 4, label: isService ? 'Primeras citas' : 'Primeros pedidos', desc: 'Comparte y empieza a vender', tab: 'orders' },
    { level: 5, label: 'Personaliza tema', desc: 'Dale estilo a tu menú', tab: 'theme' },
    { level: 6, label: 'Herramientas pro', desc: 'Cupones, zonas, QR y más', tab: null },
  ];
  const nextStep = STEPS.find(s => s.level > (onboarding?.level || 0));

  /* Mobile quick actions */
  const mobileActions = [
    {
      tab: 'orders', label: isService ? 'Citas' : 'Pedidos', sublabel: pendingOrdersCount > 0 ? `${pendingOrdersCount} nueva${pendingOrdersCount !== 1 ? 's' : ''}` : 'Ver todos',
      gradient: 'from-blue-500 to-blue-600', badge: pendingOrdersCount,
      icon: <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>,
    },
    {
      tab: 'products', label: isService ? 'Servicios' : 'Menú', sublabel: 'Tu carta',
      gradient: 'from-orange-500 to-orange-600',
      icon: <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>,
    },
    {
      tab: 'completed_orders', label: 'Completados', sublabel: 'Historial',
      gradient: 'from-emerald-500 to-emerald-600',
      icon: <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>,
    },
    {
      tab: 'reviews', label: 'Reseñas', sublabel: 'Calificaciones',
      gradient: 'from-amber-500 to-amber-600',
      icon: <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    },
    {
      tab: 'customers', label: 'Clientes', sublabel: 'Base de datos',
      gradient: 'from-cyan-500 to-cyan-600',
      icon: <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
    },
    {
      tab: 'whatsapp', label: 'WhatsApp', sublabel: 'Mensajería',
      gradient: 'from-green-500 to-green-600',
      icon: <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>,
    },
  ];

  return (
    <div className="pb-6">
      {/* ═══ ANNOUNCEMENT ═══ */}
      <AnnouncementInlineBar />

      {/* ════════════════════════════════════════
          MOBILE SECTION (lg:hidden)
          ════════════════════════════════════════ */}
      <div className="lg:hidden space-y-3.5 mt-1">

        {/* Header: name + open/close toggle */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{greeting}</p>
            <h1 className="text-[21px] font-black text-slate-900 leading-tight truncate">
              {businessConfig?.businessName || 'Tu negocio'}
            </h1>
          </div>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-[13px] shrink-0 transition-all active:scale-95 ${
              isOpen ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
            } ${toggling ? 'opacity-60' : ''}`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`} />
            {toggling ? '...' : isOpen ? 'Abierto' : 'Cerrado'}
          </button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Ventas hoy', value: fmtRevenue(stats?.today?.revenue), color: 'text-emerald-600' },
            { label: 'Pedidos', value: stats?.today?.orders !== undefined ? String(stats.today.orders) : '—', color: 'text-blue-600' },
            {
              label: 'Calificación',
              value: businessConfig?.reviewStats?.averageRating
                ? businessConfig.reviewStats.averageRating.toFixed(1) + ' ★'
                : '—',
              color: 'text-amber-500',
            },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl px-3 py-3 border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
              <p className={`text-[18px] font-black ${s.color} leading-none truncate`}>{s.value}</p>
              <p className="text-[10px] text-slate-400 font-semibold mt-1 uppercase tracking-wide leading-tight">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Hero: pending orders CTA or all-clear */}
        <AnimatePresence mode="wait">
          {pendingOrdersCount > 0 ? (
            <motion.button
              key="pending"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              whileTap={{ scale: 0.97 }}
              onClick={onOpenModoOp}
              className="w-full relative overflow-hidden flex items-center gap-4 px-5 py-5 bg-gradient-to-r from-red-500 to-rose-600 rounded-2xl shadow-lg shadow-red-500/25"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.07] rounded-full blur-2xl translate-x-12 -translate-y-12 pointer-events-none" />
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-sm"
              >
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
              </motion.div>
              <div className="flex-1 text-left relative">
                <p className="text-white text-[22px] font-black leading-tight">
                  {pendingOrdersCount} {pendingOrdersCount === 1
                    ? (isService ? 'cita nueva' : 'pedido nuevo')
                    : (isService ? 'citas nuevas' : 'pedidos nuevos')}
                </p>
                <p className="text-white/70 text-[13px] font-semibold mt-0.5">Toca para gestionar en modo servicio</p>
              </div>
              <svg className="w-5 h-5 text-white/50 shrink-0 relative" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            </motion.button>
          ) : (
            <motion.div
              key="clear"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 px-4 py-4 bg-emerald-50 rounded-2xl border border-emerald-100"
            >
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <div>
                <p className="text-emerald-800 font-bold text-[14px]">Todo al día</p>
                <p className="text-emerald-600 text-[12px] font-medium">Los nuevos pedidos aparecerán aquí</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick actions 3×2 grid */}
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Acciones rápidas</p>
          <div className="grid grid-cols-3 gap-2.5">
            {mobileActions.map(item => (
              <MobileActionCard
                key={item.tab}
                tab={item.tab}
                gradient={item.gradient}
                icon={item.icon}
                label={item.label}
                sublabel={item.sublabel}
                badge={item.badge}
                onClick={() => handleNav(item.tab)}
              />
            ))}
          </div>
        </div>

        {/* Share link */}
        {slug && (
          <button
            onClick={copyLink}
            className="w-full flex items-center gap-3 px-4 py-3.5 bg-white rounded-2xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.05)] active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center shrink-0 shadow-sm shadow-red-500/20">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{isService ? 'Tu página de servicios' : 'Tu menú digital'}</p>
              <p className="text-[13px] font-bold text-slate-800 truncate">menuby.tech/{slug}</p>
            </div>
            <span className={`text-[12px] font-bold px-3 py-1.5 rounded-xl shrink-0 transition-all ${
              copied ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white shadow-sm shadow-red-500/20'
            }`}>
              {copied ? '✓' : 'Copiar'}
            </span>
          </button>
        )}

        {/* Onboarding progress (new users) */}
        {isNewUser && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <p className="text-[14px] font-bold text-slate-800">Primeros pasos</p>
              <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {onboarding?.level || 0}/6
              </span>
            </div>
            <div className="mx-4 mb-3 h-1 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${((onboarding?.level || 0) / 6) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            {nextStep && (
              <button
                onClick={() => nextStep.tab && handleNav(nextStep.tab)}
                className="w-full flex items-center gap-3 px-4 pb-4 text-left"
              >
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-900">{nextStep.label}</p>
                  <p className="text-[11px] text-slate-400">{nextStep.desc}</p>
                </div>
                {nextStep.tab && (
                  <span className="text-[11px] font-bold text-red-500 bg-red-50 px-2.5 py-1 rounded-full shrink-0">Ir →</span>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════
          DESKTOP SECTION (hidden lg:block)
          ════════════════════════════════════════ */}
      <div className="hidden lg:block space-y-5">

        {/* Desktop greeting + status */}
        <div className="flex items-center justify-between px-1">
          <p className="text-sm font-bold text-slate-700">{greeting}</p>
          <StatusBadge businessConfig={businessConfig} />
        </div>

        {/* Desktop metrics */}
        {!q && <DashboardMetrics setActiveTab={handleNav} businessId={businessConfig?._id} businessConfig={businessConfig} />}

        {/* Desktop hero cards */}
        {!q && (
          <div className="flex gap-3">
            <HeroCard
              svgKey="orders"
              title={isService ? 'Citas' : 'Pedidos'}
              subtitle={isService ? 'Gestión de citas' : 'Gestión en tiempo real'}
              onClick={() => handleNav('orders')}
              count={pendingOrdersCount}
              colorClass="bg-gradient-to-br from-blue-600 to-blue-700"
            />
            <HeroCard
              svgKey="products"
              title={isService ? 'Servicios' : 'Productos'}
              subtitle={isService ? 'Administra tus servicios' : 'Administra tu carta'}
              onClick={() => handleNav('products')}
              count={0}
              colorClass="bg-gradient-to-br from-orange-500 to-orange-600"
            />
          </div>
        )}

        {/* Desktop onboarding */}
        {isNewUser && !q && (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-slate-900">Primeros pasos</h2>
                <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {onboarding?.level || 0}/6
                </span>
              </div>
              <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${((onboarding?.level || 0) / 6) * 100}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </div>
            <div className="px-4 pb-4">
              <div className="relative">
                <div className="absolute left-[15px] top-4 bottom-4 w-px bg-slate-100" />
                <div className="space-y-1">
                  {getOnboarding(isService, isHotel).map((step) => {
                    const done = (onboarding?.level || 0) >= step.level;
                    const isNext = (onboarding?.level || 0) === step.level - 1;
                    const SvgIcon = I[step.svgKey];
                    return (
                      <motion.button
                        key={step.level}
                        whileTap={step.tab ? { scale: 0.98 } : {}}
                        onClick={() => step.tab && handleNav(step.tab)}
                        className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-xl transition-all text-left ${done ? '' : isNext ? 'bg-red-50/60' : ''}`}
                      >
                        <div className={`relative z-10 w-[28px] h-[28px] rounded-full flex items-center justify-center flex-shrink-0 transition-all ${done ? 'bg-emerald-500' : isNext ? 'bg-red-500' : 'bg-slate-200'}`}>
                          {done ? (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                          ) : SvgIcon ? (
                            SvgIcon(`w-3 h-3 ${isNext ? 'text-white' : 'text-slate-400'}`)
                          ) : (
                            <span className={`text-[10px] font-bold ${isNext ? 'text-white' : 'text-slate-400'}`}>{step.level}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-semibold leading-tight ${done ? 'text-emerald-600 line-through' : isNext ? 'text-slate-900' : 'text-slate-400'}`}>
                            {step.label}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{step.desc}</p>
                        </div>
                        {isNext && step.tab && (
                          <span className="text-[11px] font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full flex-shrink-0">Ir →</span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Desktop section grids */}
        <AnimatePresence mode="wait">
          <motion.div
            key={q || 'all'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-5 sm:space-y-6"
          >
            {filteredSections.map((section) => {
              if (!section.items.length) return null;
              return (
                <motion.div key={section.id} variants={stagger} initial="hidden" animate="show">
                  <div className="flex items-center gap-2.5 mb-2.5 sm:mb-3">
                    <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-[0.1em]">{section.label}</h2>
                    <div className="flex-1 h-px bg-gradient-to-r from-slate-100 to-transparent" />
                    <span className="text-xs text-slate-300 font-bold bg-slate-50 px-2 py-0.5 rounded-full">{section.items.length}</span>
                  </div>
                  <motion.div className="grid grid-cols-4 xl:grid-cols-5 gap-2.5">
                    {section.items.map((item) => (
                      <motion.div key={item.tab} variants={fadeUp}>
                        <DashCard
                          item={item}
                          onClick={() => {
                            if (item.isRoute) {
                              window.location.href = `/${businessConfig?.slug || businessConfig?._id}/${item.routePath || 'pos'}`;
                            } else {
                              handleNav(item.tab);
                            }
                          }}
                          pendingOrdersCount={pendingOrdersCount}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>
              );
            })}
            {q && filteredSections[0]?.items.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-slate-400">Sin resultados</p>
                <p className="text-xs text-slate-300 mt-1">Intenta con "pedidos", "productos" o "pagos"</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
