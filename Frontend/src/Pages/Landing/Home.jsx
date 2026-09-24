import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  Smartphone, Monitor, ChevronDown, Check, X, ArrowRight, Star, BarChart3,
  Bell, QrCode, MapPin, ShieldCheck, Zap, CreditCard, Palette, CalendarCheck,
  Printer, TrendingUp, Store, Nfc, MessageCircle, Receipt,
  Navigation, Heart, Award,
} from 'lucide-react';
import api from '../../services/api';
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

const GoogleGLogo = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z" />
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);

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
                <span className="text-2xs font-semibold absolute bottom-3 left-0 right-0 text-center px-2 py-1" style={{ color: C.text }}>
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

/* Clip corto grabado en un local, sin sonido y en bucle. No se descarga
   hasta que entra en pantalla, y se pausa al salir. */
function ClipReal({ src, poster, alt, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.25 });
    obs.observe(v);
    return () => obs.disconnect();
  }, []);
  return (
    <video ref={ref} src={src} poster={poster} muted loop playsInline preload="none" aria-label={alt} width="560" height="700" className={className} />
  );
}

/* Un testimonio en video, grabado en el local del cliente. Arranca solo al
   tocarlo (con sonido y subtítulos); en celular se abre en pantalla completa
   porque el recuadro es chico. */
function Testimonio({ t }) {
  const ref = useRef(null);
  const [sonando, setSonando] = useState(false);
  const reproducir = () => {
    const v = ref.current;
    if (!v) return;
    setSonando(true);
    v.muted = false;
    v.play().catch(() => {});
    if (window.innerWidth < 640) {
      try { (v.requestFullscreen || v.webkitEnterFullscreen || v.webkitRequestFullscreen)?.call(v); } catch { /* sigue en línea */ }
    }
  };
  return (
    <figure className="rounded-[24px] overflow-hidden bg-white grid grid-cols-[124px_1fr] sm:grid-cols-[210px_1fr] h-full" style={{ border: '1px solid ' + C.border }}>
      <div className="relative bg-stone-200 aspect-[9/16] self-start">
        <video
          ref={ref}
          src={t.video}
          poster={t.poster}
          playsInline
          preload="none"
          controls={sonando}
          onEnded={() => setSonando(false)}
          className="absolute inset-0 w-full h-full object-cover"
        >
          <track kind="captions" src={t.subtitulos} srcLang="es" label="Español" default />
        </video>
        {!sonando && (
          <button type="button" onClick={reproducir} className="absolute inset-0 flex items-end p-2 sm:p-3" aria-label={`Ver el video de ${t.negocio}`}>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white pl-1 pr-3 py-1 text-[12.5px] font-bold shadow-md" style={{ color: C.text }}>
              <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: C.accent }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg>
              </span>
              {t.duracion}
            </span>
          </button>
        )}
      </div>
      <figcaption className="p-4 sm:p-6 flex flex-col min-w-0">
        <blockquote className="text-[15.5px] sm:text-[19px] leading-snug font-semibold" style={{ color: C.text, fontFamily: DISPLAY, letterSpacing: '-0.01em' }}>
          “{t.cita}”
        </blockquote>
        {t.cita2 && <p className="mt-3 text-[14px] leading-relaxed hidden sm:block" style={{ color: C.textSecondary }}>“{t.cita2}”</p>}
        <div className="mt-auto pt-4 flex items-center gap-2.5">
          {t.logo && <img src={t.logo} alt="" className="w-9 h-9 rounded-lg object-contain shrink-0" style={{ border: '1px solid ' + C.borderLight }} loading="lazy" />}
          <div className="min-w-0">
            <p className="text-[14px] font-bold leading-tight" style={{ color: C.text }}>{t.negocio}</p>
            {t.slug
              ? <a href={`/${t.slug}`} target="_blank" rel="noopener noreferrer" className="text-[12.5px] underline underline-offset-2" style={{ color: C.muted }}>Ver su menú en Menuby</a>
              : <p className="text-[12.5px]" style={{ color: C.muted }}>Cliente de Menuby</p>}
          </div>
        </div>
      </figcaption>
    </figure>
  );
}

/* ===============================================================
   DATOS — todo lo que se afirma aquí tiene que poder sostenerse si un
   cliente o un jurado pregunta. Las cifras vivas salen de /stats/public.
   =============================================================== */

/* Reconocimiento. Texto, sin logo de terceros. */
const RECONOCIMIENTO = {
  titulo: 'Top 60 entre más de 800 negocios del país · Desafío de Creadores Nestlé 2026',
  detalle: 'Top 60 entre más de 800 negocios del país',
};

/* Lo que dicen en sus videos, casi palabra por palabra (los subtítulos
   completos están en /landing/real/*.vtt). */
const TESTIMONIOS = [
  {
    negocio: 'Fraise',
    logo: '/customers/fraise.webp',
    slug: 'fraise',
    video: '/landing/real/testimonio-fraise.mp4',
    poster: '/landing/real/testimonio-fraise.webp',
    subtitulos: '/landing/real/testimonio-fraise.vtt',
    duracion: '0:48',
    cita: 'Gracias a la plataforma, el negocio ha incrementado sus ventas.',
    cita2: 'Manualmente es un caos: de tanto escribir, la mano duele. Con el sistema tenemos todo ahí, nada más es seleccionar y ya.',
  },
  {
    negocio: 'Doggitos',
    logo: '/customers/doggitos.webp',
    slug: 'doggitos',
    video: '/landing/real/testimonio-doggitos.mp4',
    poster: '/landing/real/testimonio-doggitos.webp',
    subtitulos: '/landing/real/testimonio-doggitos.vtt',
    duracion: '0:35',
    cita: 'Desde que trabajamos con ellos todo ha mejorado: los pedidos se toman mucho más rápido y los clientes se sienten más satisfechos.',
    cita2: 'Antes tomábamos los pedidos a mano, y eso nos frenaba mucho.',
  },
];

const FAQ_DATA = [
  { q: '¿Necesito tarjeta de crédito para empezar?', a: 'No. El plan Gratis es gratis de verdad: sin tarjeta y sin prueba que se vence. Creas tu cuenta y empiezas.' },
  { q: '¿Cuánto se demora configurar mi menú?', a: '5 minutos si lo haces tú. Si no tienes tiempo, mándanos tu carta por WhatsApp (una foto sirve) y te la montamos gratis en menos de 24 horas.' },
  { q: '¿Cobran comisión por pedido?', a: 'Nunca. Todos los planes tienen 0% de comisión. Pagas una tarifa fija mensual y cada peso que vendes es tuyo.' },
  { q: '¿Mis clientes tienen que descargar una app?', a: 'No. Tu menú abre en el navegador desde un QR, un link o un toque NFC. Pueden pedir, pagar y seguir su pedido en vivo sin instalar nada.' },
  { q: '¿Y si mis clientes ya me piden por WhatsApp?', a: 'Perfecto: el pedido llega ordenado a tu panel y, si quieres, también a tu WhatsApp. Se acaban los pedidos perdidos en el chat y el cliente ve el estado de su pedido sin preguntar.' },
  { q: '¿Funciona sin internet en el restaurante?', a: 'Sí. El POS tiene modo offline: sigues cobrando y registrando ventas sin conexión, y todo se sincroniza solo cuando vuelve el internet.' },
  { q: '¿Funciona con impresoras térmicas?', a: 'Sí. Con MenuBy Print los pedidos se imprimen solos en tu impresora térmica (44 a 80 mm): comanda a cocina y recibo al cliente.' },
  { q: '¿Puedo cancelar cuando quiera?', a: 'Sí. Sin contratos ni penalidades. Tu cuenta vuelve al plan Gratis y no pierdes tus datos.' },
];

const PLANS = [
  { id: 'free', name: 'Gratis', desc: '20 productos · 30 pedidos/mes', monthly: 0, quarterly: 0, semiannual: 0, annual: 0, popular: false, features: ['Menú digital con QR', '5 categorías, 5 mesas', 'Carrito básico', 'Logo y portada', '1 zona de entrega'], cta: 'Empezar gratis' },
  { id: 'starter', name: 'Starter', desc: '60 productos · 350 pedidos/mes', monthly: 39900, quarterly: 37900, semiannual: 35900, annual: 34900, popular: false, features: ['Todo de Gratis', 'Push notifications', 'Zonas de entrega ilimitadas', 'Toppings y extras', 'KDS básico + Autoprint'], cta: 'Comenzar con Starter' },
  { id: 'pro', name: 'Pro', desc: 'Ilimitado en todo', monthly: 59900, quarterly: 56900, semiannual: 52900, annual: 49900, popular: true, features: ['Todo de Starter', 'Pedidos ilimitados', 'Reservas y recordatorios', 'Lealtad con niveles', 'Analytics completo + IA'], cta: 'Elegir Pro' },
  { id: 'promax', name: 'Pro Max', desc: 'Para operaciones serias y multi-sede', monthly: 89900, quarterly: 84900, semiannual: 79900, annual: 74900, popular: false, features: ['Todo de Pro', 'POS completo: caja, cuenta por mesa y modo offline', 'Webapp de mesero', 'Multi-sucursal con panel consolidado', 'Campañas masivas de WhatsApp', 'Soporte prioritario'], cta: 'Ir con Pro Max' },
];

const CYCLES = [
  { id: 'monthly', label: 'Mensual', months: 1, badge: null },
  { id: 'quarterly', label: 'Trimestral', months: 3, badge: 'Ahorra 5%' },
  { id: 'semiannual', label: 'Semestral', months: 6, badge: 'Ahorra 10%' },
  { id: 'annual', label: 'Anual', months: 12, badge: 'Ahorra 2 meses' },
];

/* Clientes reales usando Menuby. */
/* `slug`: el logo abre su menú en vivo. Solo los que tienen el menú activo. */
const CUSTOMERS = [
  { name: 'GO BURGER', logo: '/customers/go-burger.png', slug: 'go-burger' },
  { name: 'Fraise', logo: '/customers/fraise.webp', slug: 'fraise' },
  { name: 'Doggitos', logo: '/customers/doggitos.webp', slug: 'doggitos' },
  { name: 'Cremu', logo: '/customers/cremu.webp' },
  { name: 'Las 4 en Punto', logo: '/customers/las-4-en-punto.webp' },
  { name: 'Kalunga', logo: '/customers/kalunga.webp', slug: 'kalunga' },
  { name: 'Caprichosos', logo: '/customers/caprichosos.webp', slug: 'caprichosos' },
];

/* Funciones: la principal ocupa 2×2 y las otras ocho llenan la cuadrícula
   exacta (2 al lado + 2 filas de 3). Con nueve quedaba una tarjeta sola. */
const FEATURES = [
  { icon: Receipt, label: 'Punto de venta', title: 'Tu caja, tus mesas y el cuadre sin Excel', desc: 'Apertura y cierre de caja, ventas POS y web en un solo lugar, cuenta abierta por mesa y propina o descuento al cobrar. Funciona incluso sin internet.', color: '#0E7A4F', details: ['Apertura, cierre y movimientos', 'Cuenta abierta por mesa', 'Modo offline', 'Webapp de mesero'] },
  { icon: Monitor, label: 'Pantalla de cocina', title: 'Cocina sin gritos ni papeles', desc: 'Timers, prioridad automática y un botón de listo que le avisa al cliente.', color: '#0891B2' },
  { icon: QrCode, label: 'Menú digital', title: 'Tu carta en el celular de cada cliente', desc: 'Fotos, toppings y extras, buscador y favoritos. Desde un QR, un link o un toque NFC.', color: '#E8002D' },
  { icon: Navigation, label: 'Pedido en vivo', title: 'Menos "¿ya viene mi pedido?"', desc: 'El cliente ve su pedido en vivo: recibido, en preparación, en camino y entregado.', color: '#FF5A1F' },
  { icon: MapPin, label: 'Domicilios propios', title: 'Delivery sin intermediarios', desc: 'Zonas con tarifa propia, dirección con mapa y 0% de comisión por pedido.', color: '#7C3AED' },
  { icon: Heart, label: 'Clientes que vuelven', title: 'Puntos, niveles y favoritos', desc: 'Programa de lealtad y "Mi cuenta" para repetir su pedido de siempre en dos toques.', color: '#D97706' },
  { icon: BarChart3, label: 'Analytics e IA', title: 'Sabes dónde se caen tus ventas', desc: 'Ventas, productos top, horas pico y el embudo del menú: en qué paso se van los clientes.', color: '#0E7A4F' },
  { icon: CalendarCheck, label: 'Reservas', title: 'Agenda que se llena sola', desc: 'Reservan desde el menú y les llega el recordatorio. Tú lo ves en calendario.', color: '#DB2777' },
  { icon: Store, label: 'Multi-sucursal', title: 'Varias sedes, una marca', desc: 'Menú compartido, panel por sede y la vista consolidada para el dueño.', color: '#2563EB' },
];

/* Una sola comparativa, tres columnas. Antes eran dos tablas casi iguales
   más un bloque "Sin/Con Menuby" que decía lo mismo. */
const COMPARE = [
  { label: 'Comisión por pedido', menuby: '0%', apps: '15% – 30%', qr: 'Varía' },
  { label: 'Tus clientes y sus datos', menuby: 'Son tuyos', apps: 'De la app', qr: 'Parcial' },
  { label: 'Menú digital con QR', menuby: true, apps: true, qr: true },
  { label: 'Pedido en vivo para el cliente', menuby: true, apps: true, qr: false },
  { label: 'POS con caja y cuenta por mesa', menuby: true, apps: false, qr: false },
  { label: 'Pantalla de cocina', menuby: true, apps: false, qr: 'Parcial' },
  { label: 'Comandas que se imprimen solas', menuby: true, apps: false, qr: false },
  { label: 'Lealtad con puntos y niveles', menuby: true, apps: false, qr: 'Parcial' },
  { label: 'Embudo de reseñas a Google', menuby: true, apps: false, qr: false },
  { label: 'Funciona sin internet', menuby: true, apps: false, qr: false },
];

const STEPS = [
  { num: '1', title: 'Crea tu cuenta', desc: 'Gratis en 30 segundos. Sin tarjeta.', icon: Zap },
  { num: '2', title: 'Arma tu menú', desc: 'Fotos, precios y toppings con un asistente. O te lo montamos nosotros.', icon: Smartphone },
  { num: '3', title: 'Recibe pedidos', desc: 'Comparte tu QR o link y los pedidos llegan al instante a tu panel.', icon: Bell },
];

/* Concierge: montamos el menú por ti */
const WA_NUMBER = '573028181520';
const WA_CONCIERGE = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Hola! Quiero que me monten mi menú en Menuby. Les envío mi carta.')}`;
const WA_NFC = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Hola! Quiero cotizar los soportes NFC + QR para mis mesas.')}`;

/* ===== Métricas públicas agregadas (contador vivo) ===== */
function usePublicStats() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let alive = true;
    api.get('/stats/public')
      .then((res) => { if (alive && res.data) setStats(res.data); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return stats;
}

function FAQAccordion() {
  const [open, setOpen] = useState(0);
  return (
    <div className="max-w-2xl mx-auto space-y-2.5">
      {FAQ_DATA.map((item, i) => (
        <div key={i} className="rounded-2xl overflow-hidden transition-shadow" style={{ border: '1px solid ' + (open === i ? C.border : C.borderLight), background: C.card, boxShadow: open === i ? '0 8px 30px rgba(23,18,15,0.05)' : 'none' }}>
          <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left" aria-expanded={open === i}>
            <span className="text-[14.5px] font-semibold pr-4" style={{ color: C.text }}>{item.q}</span>
            <motion.div animate={{ rotate: open === i ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: open === i ? C.accent : C.surface }}>
              <ChevronDown size={15} style={{ color: open === i ? '#fff' : C.muted }} />
            </motion.div>
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
                <p className="px-5 pb-4 text-[14px] leading-relaxed" style={{ color: C.muted }}>{item.a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

/* ===== Calculadora de ahorro =====
   Lo que hoy se lleva una app de delivery contra Menuby (0%). El resultado
   va en el rojo de la marca: nada de bloques negros en una página clara. */
const COMMISSIONS = [15, 25, 30];

function SavingsCalculator() {
  const [sales, setSales] = useState(8000000);
  const [rate, setRate] = useState(25);
  const monthlyLoss = Math.round(sales * (rate / 100));
  const yearlySaving = monthlyLoss * 12;

  return (
    <div className="rounded-[28px] overflow-hidden" style={{ background: '#fff', border: '1px solid ' + C.border, boxShadow: '0 24px 70px -30px rgba(23,18,15,0.28)' }}>
      <div className="grid md:grid-cols-[1.05fr_0.95fr]">
        <div className="p-6 sm:p-8">
          <label htmlFor="ventas-mes" className="block text-[13px] font-bold mb-2" style={{ color: C.muted }}>¿Cuánto vendes al mes?</label>
          <div className="text-[2rem] sm:text-[2.4rem] font-black tabular-nums mb-3" style={{ color: C.text, fontFamily: DISPLAY }}>{fmtCOP(sales)}</div>
          <input
            id="ventas-mes"
            type="range"
            min={1000000}
            max={60000000}
            step={500000}
            value={sales}
            onChange={(e) => setSales(Number(e.target.value))}
            className="w-full mb-1 cursor-pointer"
            style={{ accentColor: C.accent }}
          />
          <div className="flex justify-between text-[11px] font-semibold mb-7" style={{ color: C.muted }}><span>$1M</span><span>$60M</span></div>
          <p className="block text-[13px] font-bold mb-2.5" style={{ color: C.muted }}>Comisión que pagas hoy</p>
          <div className="flex gap-2" role="radiogroup" aria-label="Comisión que pagas hoy">
            {COMMISSIONS.map((r) => {
              const on = rate === r;
              return (
                <button
                  key={r}
                  role="radio"
                  aria-checked={on}
                  onClick={() => setRate(r)}
                  className="flex-1 py-3 rounded-2xl text-[15px] font-bold transition-all active:scale-[0.97]"
                  style={on ? { background: C.accent, color: '#fff', boxShadow: '0 10px 26px -10px ' + C.accent } : { background: C.bg, color: C.textSecondary, border: '1px solid ' + C.border }}
                >
                  {r}%
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6 sm:p-8 flex flex-col justify-center text-center relative overflow-hidden" style={{ background: `linear-gradient(150deg, ${C.accent} 0%, ${C.accentDeep} 100%)` }}>
          <p className="relative text-[14px] font-semibold mb-2 text-white/80">Lo que te ahorras en un año</p>
          <motion.div
            key={yearlySaving}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            className="relative text-[2.3rem] sm:text-[3.1rem] leading-none font-black tabular-nums mb-4 text-white"
            style={{ fontFamily: DISPLAY }}
            aria-live="polite"
          >
            {fmtCOP(yearlySaving)}
          </motion.div>
          <p className="relative text-[14px] leading-relaxed mb-6 text-white/85">
            Hoy le dejas <strong className="text-white">{fmtCOP(monthlyLoss)}</strong> al mes a las apps.
            <br />Con Menuby: <strong className="text-white">$0</strong>.
          </p>
          <Link to="/register" className="relative inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full text-[15px] font-bold transition-transform active:scale-[0.97]" style={{ background: '#fff', color: C.accent, boxShadow: '0 12px 30px rgba(80,0,15,0.25)' }}>
            Quiero vender sin comisiones <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    </div>
  );
}

/* Una celda de la comparativa */
function Celda({ v, fuerte }) {
  if (v === true) return <Check size={17} strokeWidth={3} style={{ color: C.green }} aria-label="Sí" />;
  if (v === false) return <X size={16} strokeWidth={2.5} style={{ color: '#CBBFB4' }} aria-label="No" />;
  return <span className={`text-[12px] leading-tight ${fuerte ? 'font-extrabold' : 'font-medium'}`} style={{ color: fuerte ? C.text : C.muted }}>{v}</span>;
}

/* Maqueta del embudo de reseñas: lo que pasa según las estrellas. */
function EmbudoResenas() {
  return (
    <div className="relative rounded-[24px] bg-white p-5 sm:p-6 mx-auto w-full max-w-[400px]" style={{ border: '1px solid ' + C.border, boxShadow: '0 24px 56px rgba(23,18,15,0.12)' }}>
      <p className="text-[13px] font-semibold mb-3" style={{ color: C.muted }}>Cuando el cliente califica su pedido:</p>
      <div className="space-y-2.5">
        <div className="rounded-2xl p-3.5 flex items-center gap-3" style={{ background: C.greenSoft }}>
          <div className="flex gap-0.5 shrink-0">{[0, 1, 2, 3, 4].map((i) => <Star key={i} size={14} fill="#FBBC05" style={{ color: '#FBBC05' }} />)}</div>
          <ArrowRight size={15} style={{ color: C.green }} className="shrink-0" />
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold leading-tight flex items-center gap-1.5" style={{ color: C.text }}><GoogleGLogo size={14} /> Reseña en Google</p>
            <p className="text-[12px] leading-snug" style={{ color: C.textSecondary }}>Los felices te suben el rating</p>
          </div>
        </div>
        <div className="rounded-2xl p-3.5 flex items-center gap-3" style={{ background: '#FEF3C7' }}>
          <div className="flex gap-0.5 shrink-0">
            {[0, 1, 2].map((i) => <Star key={i} size={14} fill="#FBBC05" style={{ color: '#FBBC05' }} />)}
            {[0, 1].map((i) => <Star key={i} size={14} style={{ color: '#E5D9C3' }} />)}
          </div>
          <ArrowRight size={15} style={{ color: '#B45309' }} className="shrink-0" />
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold leading-tight" style={{ color: C.text }}>Te llega a ti, en privado</p>
            <p className="text-[12px] leading-snug" style={{ color: C.textSecondary }}>Lo arreglas antes de que sea público</p>
          </div>
        </div>
      </div>
      <div className="mt-4 pt-4 flex items-center gap-3" style={{ borderTop: '1px solid ' + C.borderLight }}>
        <GoogleGLogo size={22} />
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-extrabold" style={{ color: C.text, fontFamily: DISPLAY }}>4.8</span>
          <span className="text-[12px]" style={{ color: C.muted }}>tu rating, visible en el menú</span>
        </div>
      </div>
    </div>
  );
}

/* ===============================================================
   MAIN
   =============================================================== */
export default function Home() {
  const stats = usePublicStats();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [demoTab, setDemoTab] = useState(0);
  const [showSticky, setShowSticky] = useState(false);

  // CTA fijo en celular: aparece cuando el hero ya pasó.
  const heroEndRef = useRef(null);
  useEffect(() => {
    const el = heroEndRef.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(([e]) => setShowSticky(e.boundingClientRect.top < 0), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useLandingSEO({
    title: 'Menuby — Menú Digital, POS y Pedidos para Restaurantes en Colombia',
    description: 'Menú digital con QR, pedidos en tiempo real, caja (POS), pantalla de cocina, domicilios propios y fidelización. Todo en uno, 0% comisiones. Empieza gratis.',
    canonical: '/',
    keywords: 'menu digital restaurante colombia, sistema restaurantes, software restaurantes, pos restaurante, menu QR, pedidos en linea, KDS cocina',
  });

  const demoTabs = [
    { label: 'En un local', icon: Store },
    { label: 'Menú del cliente', icon: Smartphone },
    { label: 'Panel', icon: BarChart3 },
  ];

  const flagship = FEATURES[0];
  const rest = FEATURES.slice(1);
  const pedidosTotales = stats?.ordersTotal > 0 ? stats.ordersTotal : null;

  return (
    <div style={{ fontFamily: BODY, color: C.text, background: C.bg, overflowX: 'hidden' }}>
      <style>{`
        .hd { font-family: ${DISPLAY}; font-weight: 800; letter-spacing: -0.035em; line-height: 0.98; }
        .hd-sub { font-family: ${DISPLAY}; font-weight: 800; letter-spacing: -0.03em; line-height: 1.04; }
      `}</style>

      {/* ========== HERO ========== */}
      <div
        className="relative"
        style={{ background: C.bg }}
      >
        <Section className="pt-20 sm:pt-24 lg:pt-28 pb-14 sm:pb-20">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
            <div className="lg:-mt-10">
              <FadeInWhenVisible delay={0}>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold mb-6" style={{ background: '#fff', color: C.text, border: '1px solid ' + C.border, boxShadow: '0 2px 12px rgba(23,18,15,0.04)' }}>
                  <Award size={14} style={{ color: C.accent }} />
                  {RECONOCIMIENTO.titulo}
                </div>
              </FadeInWhenVisible>

              <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.05, ease: [0.22, 1, 0.36, 1] }} className="hd text-[2.7rem] sm:text-[3.6rem] lg:text-[4.1rem] mb-6" style={{ color: C.text }}>
                El sistema completo<br />de tu restaurante.{' '}
<span style={{ color: C.accent }}>Sin comisiones.</span>
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }} className="text-[16.5px] sm:text-[17.5px] leading-relaxed mb-8 max-w-lg" style={{ color: C.textSecondary }}>
                Menú digital, pedidos en tiempo real, caja, pantalla de cocina, domicilios propios y clientes que vuelven. Todo en un mismo lugar y <strong style={{ color: C.text }}>desde $0</strong>.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.32 }} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
                <Link to="/register" className="group inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full text-white text-[15.5px] font-bold transition-transform active:scale-[0.97]" style={{ background: C.accent, boxShadow: '0 12px 34px rgba(232,0,45,0.28)' }}>
                  Crear mi cuenta gratis
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
                <a href="#demo" className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full text-[15px] font-bold transition-colors hover:bg-white" style={{ background: 'rgba(255,255,255,0.7)', color: C.text, border: '1px solid ' + C.border }}>
                  Ver cómo funciona
                </a>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.5 }} className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-medium" style={{ color: C.muted }}>
                {['0% comisiones, siempre', 'Sin tarjeta de crédito', 'Te montamos el menú en 24h'].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5"><Check size={14} style={{ color: C.green }} strokeWidth={3} />{t}</span>
                ))}
              </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }} className="relative sm:pr-16 lg:pr-20 sm:pb-10">
              <figure className="relative rounded-[26px] overflow-hidden" style={{ boxShadow: '0 30px 70px rgba(23,18,15,0.20)' }}>
                <img
                  src="/landing/real/las4-panel.webp"
                  alt="El panel de pedidos de Menuby abierto en el computador de la caja de Las 4 en Punto, junto a la impresora de comandas"
                  width="1200"
                  height="1020"
                  className="w-full h-auto block"
                  loading="eager"
                  fetchpriority="high"
                />
                <figcaption className="absolute left-3 bottom-3 rounded-full px-3 py-1.5 text-[12.5px] font-semibold" style={{ background: 'rgba(255,255,255,0.94)', color: C.text }}>
                  La caja de Las 4 en Punto, un día normal
                </figcaption>
              </figure>
              {/* El otro lado: lo que ve el cliente en su celular */}
              <div className="hidden sm:block absolute right-0 bottom-0 w-[150px] lg:w-[168px] rounded-[1.9rem] p-[6px]" style={{ background: '#1d1714', boxShadow: '0 24px 50px rgba(23,18,15,0.35)' }}>
                <img src="/screenshots/fraise-menu.webp" alt="Menú digital de Fraise en el celular de un cliente" width="804" height="1720" className="w-full h-auto rounded-[1.5rem] block" loading="eager" />
              </div>
            </motion.div>
          </div>
        </Section>

        {/* Clientes reales + contador vivo */}
        <div className="py-9 sm:py-11" style={{ borderTop: '1px solid ' + C.borderLight, borderBottom: '1px solid ' + C.borderLight, background: '#fff' }}>
          <div className="max-w-5xl mx-auto px-5">
            <p className="text-center text-[14px] font-semibold mb-6" style={{ color: C.muted }}>
              Algunos negocios que ya venden con Menuby
            </p>
            <StaggerContainer className="flex flex-wrap justify-center gap-3" stagger={0.05}>
              {CUSTOMERS.map((c) => {
                const cls = 'h-16 sm:h-[76px] rounded-2xl flex items-center justify-center p-2.5 sm:p-3 transition-shadow hover:shadow-[0_8px_24px_rgba(23,18,15,0.08)]';
                const st = { background: C.bg, border: '1px solid ' + C.borderLight };
                const logo = <img src={c.logo} alt={c.name} loading="lazy" className="max-h-full max-w-full object-contain" style={{ borderRadius: '8px' }} />;
                return (
                  <motion.div key={c.name} variants={staggerChild} title={c.slug ? `Ver el menú de ${c.name}` : c.name} className="basis-[calc(33.333%-8px)] sm:basis-[calc(14.285%-11px)]">
                    {c.slug
                      ? <a href={`/${c.slug}`} target="_blank" rel="noopener noreferrer" className={cls} style={st}>{logo}</a>
                      : <div className={cls} style={st}>{logo}</div>}
                  </motion.div>
                );
              })}
            </StaggerContainer>

            {stats && stats.ordersThisMonth > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mt-7 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[13.5px] font-semibold"
                style={{ color: C.textSecondary }}
              >
                <span className="inline-flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70" style={{ background: C.accent }} />
                    <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: C.accent }} />
                  </span>
                  <strong className="tabular-nums" style={{ color: C.text }}>{stats.ordersThisMonth.toLocaleString('es-CO')}</strong>
                  pedidos este mes
                </span>
                {pedidosTotales && (
                  <span className="inline-flex items-center gap-1.5">
                    <strong className="tabular-nums" style={{ color: C.text }}>{pedidosTotales.toLocaleString('es-CO')}</strong> pedidos procesados en total
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <strong style={{ color: C.text }}>0%</strong> de comisión en todos
                </span>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <div ref={heroEndRef} aria-hidden="true" />

      {/* ========== LO CUENTAN ELLOS ========== */}
      <Section id="clientes" className="py-20 sm:py-24">
        <FadeInWhenVisible>
          <div className="mb-10 max-w-2xl">
            <h2 className="hd-sub text-[2rem] sm:text-[2.7rem] mb-3" style={{ color: C.text }}>Mejor que lo cuenten ellos</h2>
            <p className="text-[16px] max-w-xl" style={{ color: C.muted }}>Grabado en sus propios locales. Dale play (tiene subtítulos).</p>
          </div>
        </FadeInWhenVisible>
        <div className="grid lg:grid-cols-2 gap-4">
          {TESTIMONIOS.map((t, i) => (
            <FadeInWhenVisible key={t.negocio} delay={i * 0.08} className="h-full">
              <Testimonio t={t} />
            </FadeInWhenVisible>
          ))}
        </div>
      </Section>

      {/* ========== DEMO: el producto, primero ========== */}
      <div style={{ background: C.surface, borderBottom: '1px solid ' + C.borderLight }}>
        <Section id="demo" className="py-20 sm:py-24">
          <FadeInWhenVisible>
            <div className="mb-9 max-w-2xl">
              <h2 className="hd-sub text-[2rem] sm:text-[2.7rem] mb-3" style={{ color: C.text }}>Así se ve Menuby en acción</h2>
              <p className="text-[16px] max-w-xl" style={{ color: C.muted }}>Un rato en la caja de Fraise, el menú que usan sus clientes y el panel donde llega todo.</p>
            </div>
          </FadeInWhenVisible>

          <div className="flex mb-10">
            <div className="inline-flex flex-wrap rounded-2xl p-1.5 gap-1" role="tablist" style={{ background: '#fff', border: '1px solid ' + C.border, boxShadow: '0 4px 18px rgba(23,18,15,0.05)' }}>
              {demoTabs.map((tab, i) => (
                <button key={tab.label} role="tab" aria-selected={demoTab === i} onClick={() => setDemoTab(i)} className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors duration-200" style={{ background: demoTab === i ? C.accent : 'transparent', color: demoTab === i ? '#fff' : C.textSecondary }}>
                  <tab.icon size={15} style={{ color: demoTab === i ? '#fff' : C.muted }} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-w-4xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div key={demoTab} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: 0.3 }}>
                {demoTab === 0 && (
                  <figure className="max-w-[420px] mx-auto">
                    <div className="rounded-[26px] overflow-hidden aspect-[4/5] bg-stone-200" style={{ boxShadow: '0 30px 70px rgba(23,18,15,0.18)' }}>
                      <ClipReal src="/landing/real/fraise-caja.mp4" poster="/landing/real/fraise-caja.webp" alt="La caja de Fraise con el panel de Menuby abierto y las comandas impresas" className="w-full h-full object-cover" />
                    </div>
                    <figcaption className="mt-3 text-center text-[14px]" style={{ color: C.muted }}>El pedido llega al computador y la comanda sale sola.</figcaption>
                  </figure>
                )}
                {demoTab === 1 && <RealMenuMockup />}
                {demoTab === 2 && <BrowserFrame src="/screenshots/macdonalds-panel.webp" alt="Panel de control de Menuby" url="menuby.tech/panel" />}
              </motion.div>
            </AnimatePresence>
          </div>
        </Section>
      </div>

      {/* ========== FUNCIONES — BENTO ========== */}
      <Section id="funciones" className="py-20 sm:py-28">
        <FadeInWhenVisible>
          <div className="mb-12 max-w-2xl">
            <h2 className="hd-sub text-[2rem] sm:text-[2.8rem] mb-3" style={{ color: C.text }}>Todo tu restaurante en un solo lugar</h2>
            <p className="text-[15.5px]" style={{ color: C.muted }}>Lo que hoy tienes regado entre WhatsApp, un cuaderno y una app de delivery, junto y conectado.</p>
          </div>
        </FadeInWhenVisible>

        <StaggerContainer className="grid md:grid-cols-3 gap-4" stagger={0.05}>
          <motion.div variants={staggerChild} className="md:col-span-2 md:row-span-2 rounded-[28px] p-7 sm:p-8 relative overflow-hidden flex flex-col justify-between" style={{ background: `linear-gradient(155deg, #fff, ${C.blush})`, border: '1px solid ' + C.border, minHeight: '400px' }}>
            <img
              src="/landing/menu-lifestyle.webp"
              alt=""
              className="hidden md:block absolute right-0 top-0 h-full w-[54%] object-cover pointer-events-none select-none"
              style={{ objectPosition: '60% center', WebkitMaskImage: 'linear-gradient(to right, transparent 0%, #000 38%)', maskImage: 'linear-gradient(to right, transparent 0%, #000 38%)' }}
              loading="lazy"
            />
            <div className="relative z-10 max-w-sm">
              <p className="inline-flex items-center gap-2 text-[14px] font-semibold mb-3" style={{ color: C.textSecondary }}>
                <flagship.icon size={18} strokeWidth={1.8} /> {flagship.label}
              </p>
              <h3 className="hd-sub text-[1.7rem] sm:text-[2rem] mb-3" style={{ color: C.text }}>{flagship.title}</h3>
              <p className="text-[15px] leading-relaxed mb-5" style={{ color: C.textSecondary }}>{flagship.desc}</p>
              <div className="flex flex-wrap gap-2">
                {flagship.details.map((d) => (
                  <span key={d} className="text-[12.5px] font-semibold px-3 py-1.5 rounded-full" style={{ background: '#fff', border: '1px solid ' + C.borderLight, color: C.text }}>{d}</span>
                ))}
              </div>
            </div>
          </motion.div>

          {rest.map((feat) => (
            <motion.div
              key={feat.label}
              variants={staggerChild}
              className="rounded-[20px] p-6"
              style={{ background: C.card, border: '1px solid ' + C.borderLight }}
            >
              <p className="inline-flex items-center gap-2 text-[13px] font-semibold mb-3" style={{ color: C.muted }}>
                <feat.icon size={17} strokeWidth={1.8} style={{ color: C.text }} /> {feat.label}
              </p>
              <h3 className="text-[16px] font-extrabold mb-1.5 leading-snug" style={{ color: C.text, fontFamily: DISPLAY, letterSpacing: '-0.02em' }}>{feat.title}</h3>
              <p className="text-[13.5px] leading-relaxed" style={{ color: C.muted }}>{feat.desc}</p>
            </motion.div>
          ))}
        </StaggerContainer>

        <FadeInWhenVisible delay={0.1}>
          <div className="mt-4 rounded-[24px] p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6" style={{ background: `linear-gradient(120deg, #fff, ${C.blush})`, border: '1px solid ' + C.border }}>
            <Palette size={20} strokeWidth={1.8} className="shrink-0" style={{ color: C.text }} />
            <div className="flex-1 min-w-0">
              <h3 className="text-[16px] font-extrabold mb-1" style={{ color: C.text, fontFamily: DISPLAY, letterSpacing: '-0.02em' }}>Con la cara de tu negocio</h3>
              <p className="text-[13.5px] leading-relaxed" style={{ color: C.muted }}>Tus colores, tu logo y tus fotos en cada pantalla que ve el cliente.</p>
            </div>
          </div>
        </FadeInWhenVisible>
      </Section>

      {/* ========== LO QUE TE HACE CRECER: autoprint + reseñas ========== */}
      <Section className="pb-20 sm:pb-28">
        <div className="grid lg:grid-cols-2 gap-4">
          <FadeInWhenVisible className="h-full">
            <div className="h-full rounded-[28px] p-7 sm:p-9 flex flex-col" style={{ background: `linear-gradient(160deg, #fff, ${C.blush})`, border: '1px solid ' + C.border }}>
              <div className="inline-flex self-start items-center gap-2 px-3 py-1.5 rounded-full text-[12.5px] font-semibold mb-4" style={{ background: C.accent + '10', color: C.accent, border: '1px solid ' + C.accent + '20' }}>
                <Printer size={13} /> Autoprint
              </div>
              <h2 className="hd-sub text-[1.7rem] sm:text-[2.1rem] mb-3" style={{ color: C.text }}>Tus comandas se imprimen solas</h2>
              <p className="text-[15px] leading-relaxed mb-5" style={{ color: C.textSecondary }}>
                Cada pedido sale en tu impresora térmica apenas llega: la comanda para cocina y el recibo para el cliente. Nadie tiene que copiar nada a mano.
              </p>
              <ul className="grid sm:grid-cols-2 gap-x-5 gap-y-2.5 mb-6">
                {['Se imprime al llegar el pedido', 'Térmicas de 44 a 80 mm', 'Reimprime con un clic', 'Se reconecta solo'].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-[14px] leading-snug" style={{ color: C.text }}>
                    <Check size={15} className="mt-0.5 shrink-0" strokeWidth={3} style={{ color: C.green }} /> {t}
                  </li>
                ))}
              </ul>
              <div className="relative mt-auto pt-2">
                <figure className="relative ml-auto w-[68%] max-w-[300px]">
                  <div className="rounded-[20px] overflow-hidden aspect-[4/5] bg-stone-200" style={{ boxShadow: '0 24px 50px rgba(23,18,15,0.22)' }}>
                    <ClipReal src="/landing/real/fraise-impresora.mp4" poster="/landing/real/fraise-impresora.webp" alt="Una comanda saliendo sola de la impresora en Fraise" className="w-full h-full object-cover" />
                  </div>
                  <figcaption className="mt-2 text-right text-[12.5px]" style={{ color: C.muted }}>Así sale una comanda en Fraise</figcaption>
                </figure>
                <div className="absolute bottom-10 left-0 flex items-center gap-3 rounded-2xl pl-2.5 pr-4 py-2.5" style={{ background: '#fff', border: '1px solid ' + C.border, boxShadow: '0 18px 44px rgba(23,18,15,0.14)' }}>
                  <img src="/printagent/logo.webp" alt="" className="w-11 h-11 rounded-xl object-contain" style={{ border: '1px solid ' + C.borderLight }} loading="lazy" />
                  <div>
                    <p className="text-[14px] font-extrabold leading-tight" style={{ color: C.text, fontFamily: DISPLAY }}>MenuBy Print</p>
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: C.green }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.green }} /> Conectado · Windows
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </FadeInWhenVisible>

          <FadeInWhenVisible delay={0.08} className="h-full">
            <div className="h-full rounded-[28px] p-7 sm:p-9 flex flex-col" style={{ background: `linear-gradient(160deg, #fff, ${C.surface})`, border: '1px solid ' + C.border }}>
              <div className="inline-flex self-start items-center gap-2 px-3 py-1.5 rounded-full text-[12.5px] font-semibold mb-4" style={{ background: '#fff', color: C.textSecondary, border: '1px solid ' + C.border }}>
                <GoogleGLogo size={13} /> Google Reseñas
              </div>
              <h2 className="hd-sub text-[1.7rem] sm:text-[2.1rem] mb-3" style={{ color: C.text }}>Más estrellas en Google, sin sustos</h2>
              <p className="text-[15px] leading-relaxed mb-6" style={{ color: C.textSecondary }}>
                Conecta tu negocio de Google y muestra tu rating en el menú. Después de cada pedido, los clientes felices van a Google y las quejas te llegan primero a ti.
              </p>
              <div className="mt-auto">
                <EmbudoResenas />
              </div>
            </div>
          </FadeInWhenVisible>
        </div>
      </Section>

      {/* ========== CALCULADORA ========== */}
      <div style={{ background: C.surface, borderTop: '1px solid ' + C.borderLight, borderBottom: '1px solid ' + C.borderLight }}>
        <Section id="calculadora" className="py-20 sm:py-24">
          <div className="max-w-5xl mx-auto">
            <FadeInWhenVisible>
              <div className="mb-10 max-w-2xl">
                <h2 className="hd-sub text-[2rem] sm:text-[2.7rem] mb-3" style={{ color: C.text }}>Deja de regalar una parte de cada venta</h2>
                <p className="text-[16px] leading-relaxed max-w-xl" style={{ color: C.textSecondary }}>
                  Las apps de delivery se quedan con el 15% a 30% de cada pedido. Mueve la barra y mira cuánto es en tu caso.
                </p>
              </div>
            </FadeInWhenVisible>
            <FadeInWhenVisible delay={0.1}>
              <SavingsCalculator />
            </FadeInWhenVisible>
          </div>
        </Section>
      </div>

      {/* ========== COMPARATIVA (una sola) ========== */}
      <Section id="comparativa" className="py-20 sm:py-28">
        <FadeInWhenVisible>
          <div className="mb-10 max-w-2xl">
            <h2 className="hd-sub text-[2rem] sm:text-[2.7rem] mb-3" style={{ color: C.text }}>Míranos al lado de los demás</h2>
            <p className="text-[16px] max-w-xl" style={{ color: C.muted }}>Frente a las apps de delivery y a otros menús QR.</p>
          </div>
        </FadeInWhenVisible>

        <FadeInWhenVisible delay={0.08}>
          <div className="max-w-3xl mx-auto rounded-[26px] p-2 sm:p-3" style={{ background: C.card, border: '1px solid ' + C.border, boxShadow: '0 16px 44px rgba(23,18,15,0.06)' }}>
            <div role="table" aria-label="Comparativa de Menuby con apps de delivery y otros menús QR">
              <div role="row" className="grid grid-cols-[1.35fr_1fr_1fr_1fr] sm:grid-cols-[1.8fr_1fr_1fr_1fr] items-end text-center">
                <div role="columnheader" className="px-2 py-3" />
                <div role="columnheader" className="px-1 pt-3 pb-2.5 rounded-t-2xl" style={{ background: C.accent + '0E', borderLeft: '1.5px solid ' + C.accent + '2A', borderRight: '1.5px solid ' + C.accent + '2A', borderTop: '1.5px solid ' + C.accent + '2A' }}>
                  <span className="inline-flex items-center gap-1 text-[13px] sm:text-[14px] font-extrabold" style={{ color: C.accent, fontFamily: DISPLAY }}>Menuby</span>
                </div>
                <div role="columnheader" className="px-1 py-3"><span className="text-[11.5px] sm:text-[12.5px] font-bold leading-tight" style={{ color: C.muted }}>Apps de delivery</span></div>
                <div role="columnheader" className="px-1 py-3"><span className="text-[11.5px] sm:text-[12.5px] font-bold leading-tight" style={{ color: C.muted }}>Otros menús QR</span></div>
              </div>
              {COMPARE.map((row, i) => {
                const last = i === COMPARE.length - 1;
                return (
                  <div role="row" key={row.label} className="grid grid-cols-[1.35fr_1fr_1fr_1fr] sm:grid-cols-[1.8fr_1fr_1fr_1fr] items-stretch text-center">
                    <div role="rowheader" className="px-2 sm:px-3 py-3 text-left text-[12.5px] sm:text-[13.5px] font-semibold flex items-center leading-snug" style={{ color: C.text, borderTop: '1px solid ' + C.borderLight }}>{row.label}</div>
                    <div role="cell" className="px-1 py-3 flex items-center justify-center" style={{ background: C.accent + '0E', borderLeft: '1.5px solid ' + C.accent + '2A', borderRight: '1.5px solid ' + C.accent + '2A', borderTop: '1px solid ' + C.accent + '18', ...(last ? { borderBottom: '1.5px solid ' + C.accent + '2A', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 } : {}) }}>
                      <Celda v={row.menuby} fuerte />
                    </div>
                    <div role="cell" className="px-1 py-3 flex items-center justify-center" style={{ borderTop: '1px solid ' + C.borderLight }}><Celda v={row.apps} /></div>
                    <div role="cell" className="px-1 py-3 flex items-center justify-center" style={{ borderTop: '1px solid ' + C.borderLight }}><Celda v={row.qr} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </FadeInWhenVisible>
      </Section>

      {/* ========== CÓMO EMPIEZAS + CONCIERGE ========== */}
      <div style={{ background: C.blush, borderTop: '1px solid ' + C.borderLight, borderBottom: '1px solid ' + C.borderLight }}>
        <Section id="como-funciona" className="py-20 sm:py-24">
          <FadeInWhenVisible>
            <div className="mb-12 max-w-2xl">
              <h2 className="hd-sub text-[2rem] sm:text-[2.7rem] mb-3" style={{ color: C.text }}>Hoy mismo estás vendiendo</h2>
              <p className="text-[16px] max-w-xl" style={{ color: C.textSecondary }}>Con el celular y el computador que ya tienes. No hace falta técnico.</p>
            </div>
          </FadeInWhenVisible>

          <StaggerContainer className="grid md:grid-cols-3 gap-5 pt-6">
            {STEPS.map((step) => (
              <motion.div key={step.num} variants={staggerChild} className="relative rounded-[24px] p-6 pt-9" style={{ background: C.card, border: '1px solid ' + C.borderLight, boxShadow: '0 10px 34px rgba(23,18,15,0.05)' }}>
                <div className="absolute -top-5 left-6 w-11 h-11 rounded-2xl flex items-center justify-center text-[20px] font-extrabold text-white select-none" style={{ background: C.accent, fontFamily: DISPLAY, boxShadow: '0 8px 20px rgba(232,0,45,0.30)', border: '3px solid ' + C.blush, lineHeight: 1 }}>
                  {step.num}
                </div>
                <step.icon size={20} style={{ color: C.accent }} className="absolute top-5 right-5" aria-hidden="true" />
                <h3 className="hd-sub text-[1.3rem] mb-1.5" style={{ color: C.text }}>{step.title}</h3>
                <p className="text-[14px] leading-relaxed" style={{ color: C.muted }}>{step.desc}</p>
              </motion.div>
            ))}
          </StaggerContainer>

          <FadeInWhenVisible delay={0.1}>
            <div className="mt-6 rounded-[24px] p-6 sm:p-7 flex flex-col md:flex-row md:items-center gap-5" style={{ background: '#fff', border: '1px solid ' + C.border }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: '#25D366' }}>
                <MessageCircle size={24} color="#fff" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[18px] font-extrabold leading-snug" style={{ color: C.text, fontFamily: DISPLAY, letterSpacing: '-0.02em' }}>¿Sin tiempo? Te montamos el menú gratis</h3>
                <p className="text-[14px] leading-relaxed" style={{ color: C.textSecondary }}>Mándanos tu carta por WhatsApp, aunque sea una foto, y en menos de 24 horas la tienes lista para vender.</p>
              </div>
              <a href={WA_CONCIERGE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full text-white text-[15px] font-bold shrink-0 transition-transform active:scale-[0.97]" style={{ background: '#25D366', boxShadow: '0 10px 28px rgba(37,211,102,0.3)' }}>
                <MessageCircle size={17} /> Enviar mi carta
              </a>
            </div>
          </FadeInWhenVisible>
        </Section>
      </div>

      {/* ========== NFC ========== */}
      <Section className="py-16 sm:py-20">
        <FadeInWhenVisible>
          <div className="max-w-5xl mx-auto rounded-[28px] overflow-hidden grid md:grid-cols-[1.2fr_0.8fr] items-center" style={{ background: '#fff', border: '1px solid ' + C.border, boxShadow: '0 16px 44px rgba(23,18,15,0.06)' }}>
            <div className="p-7 sm:p-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11.5px] font-bold mb-4" style={{ background: C.blush, color: C.accent }}>
                <Nfc size={14} /> Sin app y sin cámara
              </div>
              <h2 className="hd-sub text-[1.8rem] sm:text-[2.3rem] mb-3" style={{ color: C.text }}>Un toque en la mesa y el menú se abre</h2>
              <p className="text-[15px] leading-relaxed mb-6" style={{ color: C.textSecondary }}>
                Con los soportes NFC + QR de Menuby el cliente acerca su celular y tu menú abre al instante. El QR queda de respaldo para todos los demás.
              </p>
              <a href={WA_NFC} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full text-[15px] font-bold transition-colors hover:bg-slate-50" style={{ background: '#fff', color: C.text, border: '1px solid ' + C.border }}>
                <MessageCircle size={17} style={{ color: '#25D366' }} /> Cotizar NFC para mis mesas
              </a>
            </div>
            <div className="relative h-full min-h-[220px] hidden md:flex items-center justify-center p-8" style={{ background: `linear-gradient(160deg, ${C.blush}, #fff)` }} aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="absolute rounded-full"
                  style={{ border: '2px solid ' + C.accent + '40' }}
                  initial={{ width: 70, height: 70, opacity: 0 }}
                  animate={{ width: [70, 200], height: [70, 200], opacity: [0.6, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
                />
              ))}
              <div className="relative w-[80px] h-[80px] rounded-3xl flex items-center justify-center" style={{ background: C.accent, boxShadow: '0 18px 46px rgba(232,0,45,0.35)' }}>
                <Nfc size={36} color="#fff" strokeWidth={1.8} />
              </div>
            </div>
          </div>
        </FadeInWhenVisible>
      </Section>

      {/* ========== PRECIOS ========== */}
      <div id="pricing" style={{ background: C.surface, borderTop: '1px solid ' + C.borderLight, borderBottom: '1px solid ' + C.borderLight }}>
        <Section className="py-20 sm:py-28">
          <FadeInWhenVisible>
            <div className="mb-8 max-w-2xl">
              <h2 className="hd-sub text-[2rem] sm:text-[2.8rem] mb-3" style={{ color: C.text }}>Planes sin comisiones ocultas</h2>
              <p className="text-[16px] max-w-xl" style={{ color: C.muted }}>Pagas lo mismo si vendes 10 pedidos o 10.000.</p>
            </div>
          </FadeInWhenVisible>

          <div className="flex flex-wrap items-center gap-3 mb-12">
            <div className="inline-flex flex-wrap justify-center rounded-2xl p-1 gap-0.5" role="radiogroup" aria-label="Ciclo de pago" style={{ background: '#fff', border: '1px solid ' + C.border }}>
              {CYCLES.map((c) => (
                <button key={c.id} role="radio" aria-checked={billingCycle === c.id} onClick={() => setBillingCycle(c.id)} className="px-4 sm:px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all" style={{ background: billingCycle === c.id ? C.accent : 'transparent', color: billingCycle === c.id ? '#fff' : C.muted }}>
                  {c.label}
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              {(() => {
                const cyc = CYCLES.find((c) => c.id === billingCycle);
                return cyc?.badge ? (
                  <motion.span key={cyc.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="text-[11.5px] font-bold px-2.5 py-1 rounded-full text-white" style={{ background: C.green }}>{cyc.badge}</motion.span>
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
                  className={`relative rounded-[26px] p-6 flex flex-col transition-transform duration-300 hover:-translate-y-1 ${isPop ? 'xl:-my-2 xl:py-8' : ''}`}
                  style={{
                    background: isPop ? `linear-gradient(180deg, #fff, ${C.blush})` : C.card,
                    border: isPop ? '2px solid ' + C.accent : '1px solid ' + C.border,
                    boxShadow: isPop ? '0 28px 64px rgba(232,0,45,0.20)' : '0 2px 14px rgba(23,18,15,0.04)',
                  }}
                >
                  {isPop && (
                    <span className="absolute -top-3 left-6 px-3 py-1 rounded-full text-[12px] font-bold text-white whitespace-nowrap" style={{ background: C.accent }}>
                      El que recomendamos
                    </span>
                  )}
                  <h3 className="text-[18px] font-extrabold" style={{ color: isPop ? C.accent : C.text, fontFamily: DISPLAY }}>{plan.name}</h3>
                  <p className="text-[12.5px] mt-1 mb-4" style={{ color: C.muted }}>{plan.desc}</p>
                  <div className="mb-5">
                    <span className="hd text-[2.1rem]" style={{ color: C.text }}>{plan.id === 'free' ? '$0' : fmtCOP(price)}</span>
                    <span className="text-[12px] ml-1" style={{ color: C.muted }}>{plan.id === 'free' ? ' siempre' : '/mes'}</span>
                    {plan.id !== 'free' && cyc.months > 1 && (
                      <p className="text-[11.5px] mt-1" style={{ color: C.muted }}>Facturado {fmtCOP(price * cyc.months)} cada {cyc.months} meses</p>
                    )}
                  </div>
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[13.5px] leading-snug" style={{ color: C.textSecondary }}>
                        <span className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: isPop ? C.accent + '16' : C.surface }}>
                          <Check size={11} style={{ color: C.accent }} strokeWidth={3} />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/register" className="block w-full text-center py-3 rounded-xl text-[14px] font-bold transition-all hover:shadow-lg active:scale-[0.97]" style={isPop ? { background: C.accent, color: '#fff', boxShadow: '0 8px 26px rgba(232,0,45,0.3)' } : { background: '#fff', color: C.text, border: '1px solid ' + C.border }}>
                    {plan.cta}
                  </Link>
                </motion.div>
              );
            })}
          </StaggerContainer>
        </Section>
      </div>

      {/* ========== FAQ ========== */}
      <Section id="preguntas" className="py-20 sm:py-28">
        <FadeInWhenVisible>
          <div className="mb-12 max-w-2xl">
            <h2 className="hd-sub text-[2rem] sm:text-[2.6rem]" style={{ color: C.text }}>Lo que todos preguntan</h2>
          </div>
        </FadeInWhenVisible>
        <FAQAccordion />
      </Section>

      {/* ========== CTA FINAL ========== */}
      <Section className="pb-24">
        <FadeInWhenVisible>
          <div className="relative rounded-[32px] px-6 py-14 sm:py-20 text-center overflow-hidden" style={{ background: `linear-gradient(150deg, ${C.accent} 0%, ${C.accentDeep} 100%)`, boxShadow: '0 30px 70px rgba(232,0,45,0.25)' }}>
            <div className="relative z-10">
              <h2 className="hd text-[2.1rem] sm:text-[3rem] mb-4 text-white max-w-3xl mx-auto">Empieza hoy, gratis. Y si no tienes tiempo, te montamos la carta.</h2>
              <p className="text-[16px] mb-8 max-w-lg mx-auto text-white/85">No te pedimos tarjeta y te vas cuando quieras.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link to="/register" className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full text-[15.5px] font-bold transition-transform active:scale-[0.97] w-full sm:w-auto" style={{ background: '#fff', color: C.accent, boxShadow: '0 14px 36px rgba(80,0,15,0.25)' }}>
                  Crear mi cuenta gratis
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
                <a href={WA_CONCIERGE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full text-[15px] font-bold text-white transition-colors hover:bg-white/10 w-full sm:w-auto" style={{ border: '1.5px solid rgba(255,255,255,0.55)' }}>
                  <MessageCircle size={17} />
                  Montar mi menú por WhatsApp
                </a>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-9 text-[13px] font-medium text-white/85">
                {[
                  { icon: ShieldCheck, text: 'Datos protegidos' },
                  { icon: CreditCard, text: '0% comisiones' },
                  { icon: Award, text: RECONOCIMIENTO.detalle },
                  ...(pedidosTotales ? [{ icon: TrendingUp, text: `${pedidosTotales.toLocaleString('es-CO')} pedidos procesados` }] : []),
                ].map((t) => (
                  <span key={t.text} className="inline-flex items-center gap-1.5"><t.icon size={14} />{t.text}</span>
                ))}
              </div>
            </div>
          </div>
        </FadeInWhenVisible>
      </Section>

      {/* ========== CTA FIJO EN CELULAR ========== */}
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
              Crear mi menú gratis <ArrowRight size={17} />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========== WHATSAPP FLOTANTE ========== */}
      <a href="https://wa.me/573138178003?text=Hola%2C%20me%20interesa%20Menuby%20para%20mi%20restaurante" target="_blank" rel="noopener noreferrer" aria-label="Contactar por WhatsApp" className={`fixed right-5 z-50 flex items-center gap-2.5 group transition-[bottom] duration-300 ${showSticky ? 'bottom-[88px] md:bottom-6' : 'bottom-6'}`} style={{ filter: 'drop-shadow(0 4px 16px rgba(37,211,102,0.4))' }}>
        <span className="hidden sm:block px-3 py-1.5 rounded-xl text-[12.5px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap" style={{ background: '#fff', color: C.text, border: '1px solid ' + C.border }}>Escríbenos</span>
        <div className="w-14 h-14 rounded-full flex items-center justify-center transition-transform duration-200 hover:scale-110 active:scale-95" style={{ background: '#25D366' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
        </div>
      </a>
    </div>
  );
}
