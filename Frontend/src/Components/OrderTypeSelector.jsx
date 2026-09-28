import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, User, Phone, ArrowRight, Check, Home, ShoppingBag } from 'lucide-react';
import { useBusinessConfig } from '../Context/BusinessContext';
import * as SessionManager from '../utils/sessionManager';
import { menuCssVars } from '../utils/menuTokens';
import { ANILLO_MARCA } from '../utils/anilloMarca';
import useTarjetaSellos, { fidelidadPublica } from '../hooks/useTarjetaSellos';
import CarruselRazones from './CarruselRazones';
import { pesos } from '../utils/pedidos';
import { API_ENDPOINTS } from '../config';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Bienvenida del menú: antes de ver el menú se piden nombre y celular.
 *
 * Antes solo decía "Ingresa tus datos para ver el menú": pedía el teléfono
 * sin decir para qué ni por qué pedir aquí y no escribir directo al WhatsApp.
 * Ahora muestra cómo está el negocio (abierto, calificación) y las razones
 * para pedir por aquí, armadas con lo que ESTE negocio tiene activo: no se
 * promete nada que no tenga.
 */

const DIAS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const a12h = (hhmm) => {
  if (!hhmm || typeof hhmm !== 'string') return '';
  const [hStr, mStr = '00'] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return hhmm;
  const sufijo = h >= 12 ? 'p. m.' : 'a. m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const min = parseInt(mStr, 10) || 0;
  return min === 0 ? `${h12} ${sufijo}` : `${h12}:${String(min).padStart(2, '0')} ${sufijo}`;
};

const GoogleG = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
);

// El mismo sello de verificado del perfil del menú
const Verificado = () => (
  <svg className="w-[20px] h-[20px] shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-label="Negocio verificado" role="img"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
);

/* Las fotos de Google llegan como { name: 'places/.../photos/REF' } y pasan por
   el proxy del backend (igual que en las historias). */
const fotoGoogle = (photo, w = 400) => {
  const name = typeof photo === 'string' ? photo : photo?.name;
  if (!name || !String(name).includes('/photos/')) return null;
  return `${API_ENDPOINTS.BASE_URL}/places/photo?name=${encodeURIComponent(name)}&maxWidthPx=${w}`;
};

/* Una reseña corta y buena, completa (nunca cortada): la reseña entera si es
   breve o, si no, su primera frase cuando es breve. */
function resenaCorta(resenas = []) {
  for (const r of resenas) {
    if (!r?.text || (Number(r.rating) || 0) < 4) continue;
    const t = String(r.text).trim().replace(/\s+/g, ' ');
    if (t.length >= 18 && t.length <= 95) return { ...r, text: t };
    const frase = (t.match(/^[^.!?]{18,95}[.!?]/) || [])[0];
    if (frase) return { ...r, text: frase.trim() };
  }
  return null;
}

const NOMBRE_PAGO = { nequi: 'Nequi', daviplata: 'Daviplata', transferencia: 'transferencia', bold: 'tarjeta' };

function Campo({ icono: Icono, etiqueta, nota, valido, bajo = false, ...props }) {
  const [foco, setFoco] = useState(false);
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold" style={{ color: 'var(--mb-ink)' }}>{etiqueta}</span>
      {nota && <span className="flex items-center gap-1.5 text-[12px] mt-0.5" style={{ color: 'var(--mb-ink-2)' }}>{nota}</span>}
      <span className="block h-1.5" />
      <span
        className={`relative flex items-center rounded-2xl border-[1.5px] transition-all ${bajo ? 'h-[48px]' : 'h-[52px]'}`}
        style={{
          borderColor: foco ? 'var(--mb-accent)' : 'var(--mb-line)',
          background: 'var(--mb-card)',
          boxShadow: foco ? '0 0 0 4px var(--mb-accent-soft)' : 'none',
        }}
      >
        <Icono className="absolute left-4 w-[18px] h-[18px]" style={{ color: foco ? 'var(--mb-accent)' : 'var(--mb-ink-3)' }} />
        <input
          {...props}
          onFocus={() => setFoco(true)}
          onBlur={() => setFoco(false)}
          className="w-full h-full pl-11 pr-11 bg-transparent text-[16px] outline-none rounded-2xl"
          style={{ color: 'var(--mb-ink)' }}
        />
        <AnimatePresence>
          {valido && (
            <motion.span
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className="absolute right-3.5 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: 'var(--mb-accent)', color: 'var(--mb-on-accent)' }}
            >
              <Check className="w-3.5 h-3.5" strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </label>
  );
}

function OrderTypeSelector({ onComplete, initialTableNumber, products = [], plan = null }) {
  const isQRMode = Boolean(initialTableNumber);

  const [orderInfo, setOrderInfo] = useState(() => {
    const saved = SessionManager.getFromSession('orderInfo');
    if (saved) {
      if (isQRMode && initialTableNumber) return { ...saved, tableNumber: initialTableNumber };
      return saved;
    }
    const base = { customerName: '', orderType: '', tableNumber: initialTableNumber || '' };
    if (!isQRMode) {
      const n = SessionManager.getSavedCustomerName();
      if (n) base.customerName = n;
      const p = SessionManager.getFromLocalStorage('customerPhone');
      if (p) base.phone = p;
    }
    return base;
  });

  const isReturning = useRef(Boolean(SessionManager.getSavedCustomerName())).current;
  const [showOrderTypes, setShowOrderTypes] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  /* Sin scroll: la pantalla mide lo mismo que el celular y se acomoda a su
     alto. Amplio: las razones con explicación; medio: solo el título; bajo
     (iPhone SE y similares): las razones como etiquetas. La portada se lleva
     el espacio que sobre. */
  const [alto, setAlto] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800));
  const [altoVisible, setAltoVisible] = useState(null);   // con el teclado abierto
  useEffect(() => {
    const medir = () => { if (!keyboardOpen) setAlto(window.innerHeight); };
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [keyboardOpen]);
  const nivel = alto >= 800 ? 'amplio' : alto >= 690 ? 'medio' : 'bajo';
  const baja = nivel !== 'amplio';
  const { businessConfig, businessId, businessStatus } = useBusinessConfig();
  const tarjeta = useTarjetaSellos(businessId);
  const [conPuntos, setConPuntos] = useState(false);

  const cfg = businessConfig || {};
  const esServicio = ['salon', 'spa', 'clinic', 'services'].includes(cfg.businessType);
  const esHotel = cfg.businessType === 'hotel';
  const isInAppMode = cfg.orderingMode === 'inapp' || cfg.orderingMode === 'both';
  const urlDe = (u) => (u ? (u.startsWith('http') ? u : `${API_BASE_URL}${u}`) : null);
  const logoUrl = urlDe(cfg.logo);
  const coverUrl = urlDe(cfg.coverImage);
  const [sinLogo, setSinLogo] = useState(!logoUrl);

  // ¿Tiene programa de puntos? (si usa sellos, lo dice la tarjeta)
  useEffect(() => {
    if (!businessId) return undefined;
    let vivo = true;
    fidelidadPublica(businessId).then((data) => { if (vivo) setConPuntos(!!data?.puntos); });
    return () => { vivo = false; };
  }, [businessId]);

  /* ── Teclado abierto: la portada se encoge ── */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const onResize = () => {
      const abierto = vv.height < window.innerHeight * 0.75;
      setKeyboardOpen(abierto);
      setAltoVisible(abierto ? vv.height : null);
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (initialTableNumber && orderInfo.tableNumber !== initialTableNumber) {
      setOrderInfo((prev) => ({ ...prev, tableNumber: initialTableNumber }));
    }
  }, [initialTableNumber, orderInfo.tableNumber]);

  /* ── Estado y calificación, como en el perfil del menú ── */
  const abierto = !!businessStatus?.isOpen;
  const hoy = cfg.businessHours?.[DIAS[new Date().getDay()]];
  const estado = abierto
    ? (hoy?.closeTime ? `Abierto · cierra ${a12h(hoy.closeTime)}` : 'Abierto')
    : (businessStatus?.nextOpenTime?.time ? `Cerrado · abre ${a12h(businessStatus.nextOpenTime.time)}` : 'Cerrado');
  const verResenas = cfg.reviewsDisplay || 'both';
  const ratingGoogle = ['both', 'google'].includes(verResenas) ? cfg.google?.rating : null;
  const ratingInterno = ['both', 'internal'].includes(verResenas) && cfg.reviewStats?.totalReviews > 0 ? cfg.reviewStats.averageRating : null;
  const rating = ratingGoogle || ratingInterno;
  const numResenas = ratingGoogle ? cfg.google?.reviewCount : cfg.reviewStats?.totalReviews;

  /* ── Diapositivas: la misma idea que `beneficios`, contada con fotos y datos
     reales del negocio (su premio, sus productos, sus precios, sus pagos) ── */
  const diapositivas = useMemo(() => {
    const activos = (products || []).filter((p) => p.active !== false);
    const premioProd = tarjeta ? activos.find((p) => String(p._id) === String(tarjeta.premioProductId)) : null;
    const conFoto = activos.filter((p) => p.image && (!premioProd || p._id !== premioProd._id));
    const orden = [...conFoto.filter((p) => p.isFeatured), ...conFoto.filter((p) => !p.isFeatured)];
    const fotoCocina = orden[0];
    const prodPrecio = orden[1] || orden[0] || activos.find((p) => !premioProd || p._id !== premioProd._id);
    const out = [];

    if (tarjeta) {
      out.push({
        clave: 'sellos', kicker: 'Tarjeta de sellos',
        titulo: `Junta ${tarjeta.requeridos} sellos`,
        texto: `y llévate ${tarjeta.premio}. Solo suman los pedidos hechos aquí.`,
        visual: { tipo: 'sellos', foto: premioProd?.image, requeridos: tarjeta.requeridos },
      });
    } else if (conPuntos) {
      out.push({
        clave: 'puntos', kicker: 'Puntos',
        titulo: 'Cada pedido suma puntos',
        texto: 'Y los cambias por premios. Solo pidiendo por aquí.',
        visual: { tipo: 'icono', icono: Star },
      });
    }
    /* Reseña real de Google (si el negocio muestra las de Google). Con la foto
       del local; si no hay, la de un producto. */
    const resena = ['both', 'google'].includes(cfg.reviewsDisplay || 'both') ? resenaCorta(cfg.google?.reviews) : null;
    if (resena) {
      out.push({
        clave: 'resena', kicker: 'Lo que dicen en Google',
        titulo: `“${resena.text}”`,
        texto: resena.author || resena.authorName || 'Cliente',
        resena: { rating: Number(resena.rating) || 5 },
        visual: { tipo: 'foto', foto: fotoGoogle(cfg.google?.photos?.[0]) || fotoCocina?.image || prodPrecio?.image },
      });
    }
    if (isInAppMode) {
      out.push({
        clave: 'vivo', kicker: 'Pedido en vivo',
        titulo: esServicio ? 'Tu cita, confirmada al momento' : 'Ves cómo va tu pedido',
        texto: esServicio ? 'Sin esperar a que te respondan.' : 'Sin preguntar por WhatsApp si ya salió.',
        visual: { tipo: 'vivo', ultimo: esServicio ? 'Confirmada' : 'Listo' },
      });
    }
    out.push({
      clave: 'cocina', kicker: 'Sin esperar',
      titulo: esServicio || esHotel ? 'Directo al negocio' : 'Directo a la cocina',
      texto: 'Nadie tiene que leer y contestar tu WhatsApp primero.',
      visual: { tipo: 'foto', foto: fotoCocina?.image },
    });
    if (prodPrecio) {
      out.push({
        clave: 'precio', kicker: 'Precios reales',
        titulo: 'Lo que ves es lo que pagas',
        texto: `Fotos y precios al día. ${prodPrecio.name}: ${pesos(prodPrecio.price)}.`,
        visual: { tipo: 'precio', foto: prodPrecio.image, precio: pesos(prodPrecio.price) },
      });
    }
    const pm = cfg.paymentMethods || {};
    const modo = isInAppMode ? 'inapp' : 'whatsapp';
    const medios = ['nequi', 'daviplata', 'transferencia']
      .filter((id) => pm[id]?.enabled && pm[id].modes?.[modo] !== false)
      .map((id) => NOMBRE_PAGO[id].charAt(0).toUpperCase() + NOMBRE_PAGO[id].slice(1));
    if (cfg.boldActivo) medios.push('Tarjeta');
    if (medios.length) {
      out.push({
        clave: 'pagos', kicker: 'Pagos',
        titulo: 'Paga como prefieras',
        texto: `Efectivo o ${medios.join(', ').toLowerCase().replace(/, ([^,]*)$/, ' o $1')}.`,
        visual: { tipo: 'pagos', medios },
      });
    }
    return out;
  }, [products, tarjeta, conPuntos, isInAppMode, esServicio, esHotel, cfg.paymentMethods, cfg.boldActivo, cfg.google, cfg.reviewsDisplay]);

  /* ── Enviar ── */
  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (!orderInfo.customerName.trim()) return;
    if (isQRMode) {
      if (showOrderTypes) {
        if (!orderInfo.orderType) return;   // el botón ya queda apagado sin tipo
        const final = { ...orderInfo, tableNumber: initialTableNumber || '' };
        SessionManager.saveOrderInfo(final);
        onComplete(final);
      } else {
        setShowOrderTypes(true);
      }
    } else {
      const info = { customerName: orderInfo.customerName.trim(), phone: orderInfo.phone?.trim() || '', orderType: '', tableNumber: '' };
      SessionManager.saveCustomerName(info.customerName);
      if (orderInfo.phone) SessionManager.saveToLocalStorage('customerPhone', orderInfo.phone);
      SessionManager.saveOrderInfo(info);
      onComplete(info);
    }
  }, [orderInfo, isQRMode, showOrderTypes, initialTableNumber, onComplete]);

  const nameValid = orderInfo.customerName.trim().length > 0;
  const digitos = (orderInfo.phone || '').replace(/\D/g, '');
  const phoneValid = digitos.length >= 7;
  const isFormValid = nameValid && phoneValid;
  const primerNombre = orderInfo.customerName.trim().split(' ')[0];

  const opcionesQR = [
    { type: 'inSite', title: esHotel ? 'En la habitación' : 'Comer aquí', sub: esHotel ? 'Te lo llevamos' : 'Te lo llevamos a la mesa', Icono: Home },
    { type: 'takeaway', title: 'Para llevar', sub: 'Lo recoges empacado', Icono: ShoppingBag },
  ];

  const botonActivo = showOrderTypes ? !!orderInfo.orderType : isFormValid;

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 overflow-hidden overscroll-none"
      style={{
        ...menuCssVars(cfg.theme?.buttonColor, { on: cfg.theme?.buttonTextColor }),
        background: 'var(--mb-surface)',
        height: altoVisible ? `${altoVisible}px` : '100dvh',
      }}
    >
      <div className="h-full flex flex-col max-w-[520px] mx-auto">
        {/* ── Portada: se lleva el espacio que sobre ── */}
        <div className="relative flex-1 min-h-[116px]">
          {coverUrl ? (
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${coverUrl})` }} />
          ) : (
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, var(--mb-accent), var(--mb-accent-strong))' }} />
          )}
          {/* Estado y calificación sobre la portada, en vidrio claro */}
          {!keyboardOpen && (
            <div className="absolute inset-x-0 flex items-start justify-between gap-2 px-4"
              style={{ top: 'calc(12px + env(safe-area-inset-top, 0px))' }}>
              <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-bold backdrop-blur-md"
                style={{ background: 'rgba(255,255,255,0.88)', color: '#1f2937' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: abierto ? '#16a34a' : '#dc2626' }} />
                {estado}
              </span>
              {rating > 0 && (
                <span className="inline-flex items-center gap-1 h-8 px-3 rounded-full text-[12px] font-bold backdrop-blur-md"
                  style={{ background: 'rgba(255,255,255,0.88)', color: '#1f2937' }}>
                  {ratingGoogle ? <GoogleG /> : null}
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {Number(rating).toFixed(1)}
                  {numResenas > 0 && <span className="font-semibold" style={{ color: '#6b7280' }}>({numResenas})</span>}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Hoja que sube sobre la portada: todo lo demás va aquí ── */}
        <div className="relative shrink-0 -mt-7 rounded-t-[28px] flex flex-col"
          style={{ background: 'var(--mb-surface)', boxShadow: '0 -14px 34px -16px rgba(0,0,0,0.28)' }}>

        {/* ── Logo, nombre y estado ── */}
        <div className="relative shrink-0 px-5 text-center" style={{ marginTop: nivel === 'bajo' ? -36 : nivel === 'medio' ? -42 : -48 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 20, delay: 0.1 }}
            className={`mx-auto rounded-full p-[3px] ${nivel === 'bajo' ? 'w-[72px] h-[72px]' : nivel === 'medio' ? 'w-[84px] h-[84px]' : 'w-[96px] h-[96px]'}`}
            style={{ background: ANILLO_MARCA }}
          >
            <span className="block w-full h-full rounded-full overflow-hidden" style={{ border: '3px solid var(--mb-surface)', background: 'var(--mb-card)', boxShadow: '0 6px 18px -6px rgba(0,0,0,0.25)' }}>
              {!sinLogo ? (
                <img src={logoUrl} alt="" className="w-full h-full object-cover" onError={() => setSinLogo(true)} />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-3xl font-black" style={{ color: 'var(--mb-accent)' }}>
                  {(cfg.businessName || '?').trim().charAt(0).toUpperCase()}
                </span>
              )}
            </span>
          </motion.div>

          <h1 className={`${nivel === 'bajo' ? 'mt-1.5 text-[20px]' : baja ? 'mt-2 text-[22px]' : 'mt-3 text-[24px]'} font-black leading-tight tracking-tight break-words`} style={{ color: 'var(--mb-ink)' }}>
            {cfg.businessName || 'Bienvenido'}
            {['starter', 'pro', 'pro_max'].includes(String(plan || '').toLowerCase()) && (
              <span className="inline-block align-[-3px] ml-1.5" style={{ color: 'var(--mb-accent)' }}><Verificado /></span>
            )}
          </h1>
        </div>

        <div className={`shrink-0 px-5 pb-3 ${baja ? 'pt-3 space-y-3' : 'pt-5 space-y-5'}`}>
          <AnimatePresence mode="wait" initial={false}>
            {!showOrderTypes ? (
              <motion.div key="datos" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }} className={baja ? 'space-y-3' : 'space-y-5'}>
                {/* ── Por qué pedir por aquí ── */}
                {!keyboardOpen && (
                  <div style={{ height: nivel === 'bajo' ? 132 : nivel === 'medio' ? 150 : 162 }}>
                    <CarruselRazones diapositivas={diapositivas} logo={sinLogo ? null : logoUrl} compacto={nivel !== 'amplio'} />
                  </div>
                )}

                {/* ── Datos ── */}
                <form id="bienvenida" onSubmit={handleSubmit} className={baja ? 'space-y-2.5' : 'space-y-3.5'}>
                  {isReturning && primerNombre && (
                    <p className="text-[15px] font-semibold" style={{ color: 'var(--mb-ink)' }}>Hola de nuevo, {primerNombre} 👋</p>
                  )}
                  <Campo
                    icono={User}
                    etiqueta="Tu nombre"
                    valido={nameValid}
                    bajo={baja}
                    type="text"
                    value={orderInfo.customerName}
                    onChange={(e) => setOrderInfo({ ...orderInfo, customerName: e.target.value })}
                    placeholder="¿A nombre de quién?"
                    autoComplete="given-name"
                    enterKeyHint="next"
                    required
                  />
                  <div>
                    <Campo
                      icono={Phone}
                      etiqueta="Tu celular"
                      valido={phoneValid}
                      bajo={baja}
                      type="tel"
                      inputMode="tel"
                      value={orderInfo.phone || ''}
                      // Solo dígitos: el celular identifica al cliente; con espacios sería otro
                      onChange={(e) => setOrderInfo({ ...orderInfo, phone: e.target.value.replace(/[^\d+]/g, '').slice(0, 15) })}
                      placeholder="3001234567"
                      autoComplete="tel"
                      enterKeyHint="go"
                      required
                    />
                  </div>
                </form>
              </motion.div>
            ) : (
              /* ── Mesa (QR): cómo lo quiere ── */
              <motion.form key="tipo" id="bienvenida" onSubmit={handleSubmit}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }} className="space-y-3">
                <p className="text-[16px] font-bold" style={{ color: 'var(--mb-ink)' }}>
                  Hola {primerNombre}, estás en la {esHotel ? 'habitación' : 'mesa'}{' '}
                  <span style={{ color: 'var(--mb-accent)' }}>{initialTableNumber}</span>
                </p>
                <p className="text-[13px]" style={{ color: 'var(--mb-ink-2)' }}>¿Cómo lo quieres?</p>
                {opcionesQR.map(({ type, title, sub, Icono }) => {
                  const activo = orderInfo.orderType === type;
                  return (
                    <button key={type} type="button" onClick={() => setOrderInfo((prev) => ({ ...prev, orderType: type }))}
                      className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-[1.5px] text-left transition-all"
                      style={{
                        borderColor: activo ? 'var(--mb-accent)' : 'var(--mb-line)',
                        background: activo ? 'var(--mb-accent-soft)' : 'var(--mb-card)',
                      }}>
                      <span className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ background: activo ? 'var(--mb-accent)' : 'var(--mb-surface-2)', color: activo ? 'var(--mb-on-accent)' : 'var(--mb-ink-2)' }}>
                        <Icono className="w-5 h-5" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-[15px] font-bold" style={{ color: 'var(--mb-ink)' }}>{title}</span>
                        <span className="block text-[12.5px]" style={{ color: 'var(--mb-ink-2)' }}>{sub}</span>
                      </span>
                      {activo && <Check className="w-5 h-5" style={{ color: 'var(--mb-accent)' }} strokeWidth={3} />}
                    </button>
                  );
                })}
                <button type="button" onClick={() => setShowOrderTypes(false)} className="w-full text-center text-[13px] font-semibold py-2"
                  style={{ color: 'var(--mb-ink-2)' }}>
                  ← Cambiar mis datos
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* ── Botón fijo abajo: siempre a la vista, también con el teclado ── */}
        <div className="shrink-0 px-5 pt-1" style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))' }}>
          <motion.button
            type="submit"
            form="bienvenida"
            disabled={!botonActivo}
            whileTap={botonActivo ? { scale: 0.97 } : undefined}
            className="w-full h-[54px] rounded-2xl text-[16px] font-bold flex items-center justify-center gap-2 transition-all"
            style={{
              background: botonActivo ? 'var(--mb-accent)' : 'var(--mb-surface-2)',
              color: botonActivo ? 'var(--mb-on-accent)' : 'var(--mb-ink-3)',
              boxShadow: botonActivo ? '0 8px 24px -8px var(--mb-accent)' : 'none',
            }}
          >
            {isQRMode && !showOrderTypes ? 'Continuar' : esServicio ? 'Ver servicios' : 'Ver el menú'}
            <ArrowRight className="w-5 h-5" />
          </motion.button>
          {!keyboardOpen && (
            <p className="text-center text-[11px] pt-2" style={{ color: 'var(--mb-ink-3)' }}>
              Hecho con <span className="font-semibold">MenuBy</span>
            </p>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

export default OrderTypeSelector;
