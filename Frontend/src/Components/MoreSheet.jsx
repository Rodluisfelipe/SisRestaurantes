import React, { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Star, Gift, MessageCircle, CalendarCheck, ChevronRight, Wifi, Check, UserRound, QrCode, MapPin, Copy } from 'lucide-react';
import MenuScreen from './MenuScreen';
import { useBusinessConfig } from '../Context/BusinessContext';
import { enlaceWhatsApp } from '../utils/whatsapp';
import useResumenCuenta from '../hooks/useResumenCuenta';

/* Íconos de marca: los genéricos hacen que todo parezca el mismo enlace. */
const BRAND = {
  instagram: (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.64.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.35-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 100 12.32 6.16 6.16 0 000-12.32zM12 16a4 4 0 110-8 4 4 0 010 8zm6.41-11.85a1.44 1.44 0 100 2.88 1.44 1.44 0 000-2.88z"/></svg>,
  tiktok: (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64c.3 0 .6.04.88.13V9.4a6.33 6.33 0 00-1-.08A6.34 6.34 0 003 15.66a6.34 6.34 0 0010.86 4.49v.02h3.45v-9.4a7.29 7.29 0 004.28 1.38V8.7a4.78 4.78 0 01-2-2.01z"/></svg>,
  facebook: (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><path d="M18.77 7.46H14.5v-1.9c0-.9.6-1.1 1-1.1h3V.5h-4.33C10.24.5 9.5 3.44 9.5 5.32v2.15h-3v4h3v12h5v-12h3.85l.42-4z"/></svg>,
  maps: (p) => <svg {...p} viewBox="0 0 24 24" fill="none"><path fill="#34A853" d="M12 23s2.2-3 3.9-5.6L12 14.3l-3.9 3.1C9.8 20 12 23 12 23z"/><path fill="#FBBC04" d="M6.3 13.2c-.6-1-1-1.9-1.2-2.6l4.6 3.6-3.4-1z"/><path fill="#4285F4" d="M17.7 13.2c1-1.6 1.5-2.8 1.5-4.2a7.2 7.2 0 00-1.6-4.5l-5.6 6.7 5.7 2z"/><path fill="#1A73E8" d="M12 1a7.2 7.2 0 016.1 3.3L12 11.2 5.9 4.3A7.2 7.2 0 0112 1z"/><path fill="#EA4335" d="M4.8 8.9c0-1.8.5-3.4 1.4-4.7l5.8 6.9-5.9 2.3a8.4 8.4 0 01-1.3-4.5z"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></svg>,
};

/**
 * "Más": todo lo que no es el menú, ordenado por lo que el cliente viene a
 * hacer. Arriba su cuenta (con sus puntos a la vista), luego los accesos
 * rápidos, el Wi-Fi, cómo llegar y las redes.
 *
 * Regla: cada cosa solo se dibuja si su dato existe. Nada de accesos muertos.
 */

const abrirCuenta = () => window.dispatchEvent(new Event('mb:abrir-cuenta'));

/* Wi-Fi: la clave para copiar a la vista; el QR, que ocupa media pantalla,
   detrás de un botón. El formato WIFI:… lo entienden iOS y Android. */
function WifiCard({ wifi }) {
  const [copiada, setCopiada] = useState(false);
  const [conQr, setConQr] = useState(false);
  const payload = `WIFI:T:${wifi.password ? 'WPA' : 'nopass'};S:${wifi.ssid};P:${wifi.password || ''};;`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(wifi.password || wifi.ssid);
      setCopiada(true);
      if (navigator.vibrate) navigator.vibrate(10);
      setTimeout(() => setCopiada(false), 2000);
    } catch { /* sin permiso de portapapeles */ }
  };

  return (
    <section className="rounded-2xl border border-linea bg-superficie-tarjeta p-4">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl bg-marca-suave text-marca-fuerte flex items-center justify-center shrink-0">
          <Wifi className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-tinta-2">Wi-Fi del local</p>
          <p className="font-bold text-tinta truncate">{wifi.ssid}</p>
        </div>
        <button
          type="button"
          onClick={() => setConQr((v) => !v)}
          className="w-11 h-11 rounded-xl border border-linea flex items-center justify-center text-tinta-2 shrink-0"
          aria-label={conQr ? 'Ocultar código QR' : 'Mostrar código QR'}
          aria-expanded={conQr}
        >
          <QrCode className="w-5 h-5" />
        </button>
      </div>

      {wifi.password ? (
        <button
          type="button"
          onClick={copiar}
          className="mt-3 w-full h-12 flex items-center justify-between gap-2 px-3.5 rounded-xl bg-superficie-2 active:scale-[0.99] transition-transform"
        >
          <span className="font-mono text-[15px] tracking-wide truncate text-tinta">{wifi.password}</span>
          <span className={`flex items-center gap-1 text-sm font-bold shrink-0 ${copiada ? 'text-exito' : 'text-marca-fuerte'}`}>
            {copiada ? <><Check className="w-4 h-4" /> Copiada</> : <><Copy className="w-4 h-4" /> Copiar</>}
          </span>
        </button>
      ) : (
        <p className="mt-3 text-sm text-tinta-2">Red abierta, sin clave.</p>
      )}

      {conQr && (
        <div className="mt-3 flex flex-col items-center gap-2">
          <div className="p-2.5 rounded-xl bg-white border border-linea">
            <QRCodeCanvas value={payload} size={160} level="M" includeMargin={false} />
          </div>
          <p className="text-xs text-tinta-3 text-center">Escanéalo con la cámara de otro celular para conectarlo</p>
        </div>
      )}
    </section>
  );
}

function Rapido({ icono, titulo, detalle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-linea bg-superficie-tarjeta p-3.5 text-left flex flex-col gap-2 min-h-[96px] active:scale-[0.98] transition-transform"
    >
      <span className="w-9 h-9 rounded-xl bg-marca-suave text-marca-fuerte flex items-center justify-center">{icono}</span>
      <span>
        <span className="block font-bold text-tinta leading-tight">{titulo}</span>
        {detalle && <span className="block text-xs text-tinta-2 mt-0.5">{detalle}</span>}
      </span>
    </button>
  );
}

function Enlace({ href, icono, titulo, detalle, color }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3.5 active:bg-superficie-2 transition-colors"
    >
      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}14`, color }}>{icono}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-tinta">{titulo}</span>
        {detalle && <span className="block text-xs text-tinta-2 truncate">{detalle}</span>}
      </span>
      <ChevronRight className="w-5 h-5 text-tinta-3 shrink-0" />
    </a>
  );
}

export default function MoreSheet({ open, onClose, onRate, onShowLoyalty }) {
  const { businessConfig } = useBusinessConfig();
  const { resumen } = useResumenCuenta();
  const wifi = businessConfig?.wifi;
  const hayWifi = !!(wifi?.enabled && wifi?.ssid);

  const waHref = enlaceWhatsApp(businessConfig?.whatsappNumber, undefined, businessConfig?.phoneCountryCode) || null;
  const mapsUrl = businessConfig?.googleMapsUrl
    || (businessConfig?.location?.coordinates?.lat
      ? `https://maps.google.com/?q=${businessConfig.location.coordinates.lat},${businessConfig.location.coordinates.lng}`
      : businessConfig?.address ? `https://maps.google.com/?q=${encodeURIComponent(businessConfig.address)}` : null);

  const social = businessConfig?.socialMedia || {};
  const REDES = {
    instagram: { etiqueta: 'Instagram', color: '#E4405F', Icono: BRAND.instagram },
    tiktok: { etiqueta: 'TikTok', color: '#000000', Icono: BRAND.tiktok },
    facebook: { etiqueta: 'Facebook', color: '#1877F2', Icono: BRAND.facebook },
  };
  const redes = ['instagram', 'tiktok', 'facebook']
    .filter((k) => social[k]?.isVisible && social[k]?.url)
    .map((k) => ({ clave: k, url: social[k].url, ...REDES[k] }));

  const nombre = resumen?.perfil?.nombre?.split(' ')[0] || '';
  const puntos = resumen?.puntos;
  const cerrarY = (fn) => () => { onClose(); fn?.(); };

  const rapidos = [];
  if (puntos && onShowLoyalty) {
    rapidos.push({ clave: 'puntos', icono: <Gift className="w-5 h-5" />, titulo: 'Mis puntos', detalle: `${puntos.puntos.toLocaleString('es-CO')} acumulados`, onClick: cerrarY(onShowLoyalty) });
  }
  if (businessConfig?.enableBookings) {
    rapidos.push({ clave: 'reservar', icono: <CalendarCheck className="w-5 h-5" />, titulo: 'Reservar', detalle: 'Aparta tu mesa', onClick: cerrarY(() => window.dispatchEvent(new CustomEvent('mb:open-booking'))) });
  }
  if (onRate) {
    // Calificar pasa por el embudo interno: nunca directo a Google.
    rapidos.push({ clave: 'calificar', icono: <Star className="w-5 h-5" />, titulo: 'Calificar', detalle: 'Cuéntanos cómo te fue', onClick: cerrarY(onRate) });
  }

  return (
    <MenuScreen open={open} onClose={onClose} title="Más" subtitle={businessConfig?.businessName || undefined}>
      <div className="p-4 space-y-4 pb-10">
        {/* Tu cuenta, con lo importante a la vista */}
        <button
          type="button"
          onClick={cerrarY(abrirCuenta)}
          className="w-full rounded-2xl border border-linea bg-superficie-tarjeta p-4 flex items-center gap-3.5 text-left active:scale-[0.99] transition-transform"
        >
          <span className="w-12 h-12 rounded-full bg-marca text-sobre-marca flex items-center justify-center text-lg font-black shrink-0">
            {nombre ? nombre.charAt(0).toUpperCase() : <UserRound className="w-6 h-6" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-black text-tinta leading-tight">{nombre ? `Hola, ${nombre}` : 'Mi cuenta'}</span>
            <span className="block text-sm text-tinta-2 mt-0.5">
              {resumen
                ? [
                    puntos ? `${puntos.puntos.toLocaleString('es-CO')} puntos` : null,
                    resumen.favoritos ? `${resumen.favoritos} favorito${resumen.favoritos === 1 ? '' : 's'}` : null,
                    'pedir de nuevo',
                  ].filter(Boolean).join(' · ')
                : 'Se activa con tu primer pedido'}
            </span>
          </span>
          <ChevronRight className="w-5 h-5 text-tinta-3 shrink-0" />
        </button>

        {rapidos.length > 0 && (
          <div className={`grid gap-2.5 ${rapidos.length === 1 ? 'grid-cols-1' : rapidos.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {rapidos.map((r) => <Rapido key={r.clave} {...r} />)}
          </div>
        )}

        {hayWifi && <WifiCard wifi={wifi} />}

        {(mapsUrl || waHref) && (
          <section className="rounded-2xl border border-linea bg-superficie-tarjeta divide-y divide-linea overflow-hidden">
            {mapsUrl && (
              <Enlace href={mapsUrl} icono={<MapPin className="w-5 h-5" />} color="#1A73E8" titulo="Cómo llegar" detalle={businessConfig?.address || 'Ver en el mapa'} />
            )}
            {waHref && (
              <Enlace href={waHref} icono={<MessageCircle className="w-5 h-5" />} color="#25D366" titulo="Escríbenos por WhatsApp" detalle="Te respondemos por ahí" />
            )}
          </section>
        )}

        {redes.length > 0 && (
          <section>
            <h3 className="text-xs font-black uppercase tracking-wide text-tinta-2 mb-2">Síguenos</h3>
            <div className="flex gap-2.5">
              {redes.map((r) => (
                <a
                  key={r.clave}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 h-14 rounded-2xl border border-linea bg-superficie-tarjeta flex items-center justify-center gap-2 font-bold text-tinta active:scale-[0.98] transition-transform"
                  aria-label={r.etiqueta}
                >
                  <span style={{ color: r.color }}><r.Icono width={20} height={20} /></span>
                  <span className="text-sm truncate">{r.etiqueta}</span>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </MenuScreen>
  );
}
