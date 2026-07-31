import React, { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Star, Gift, MessageCircle, CalendarCheck, ChevronRight, Wifi, Check } from 'lucide-react';

/* Íconos de marca: los genéricos hacen que todo parezca el mismo enlace.
   Cada tile lleva además el color real de su marca. */
const BRAND = {
  instagram: (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.64.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.35-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 100 12.32 6.16 6.16 0 000-12.32zM12 16a4 4 0 110-8 4 4 0 010 8zm6.41-11.85a1.44 1.44 0 100 2.88 1.44 1.44 0 000-2.88z"/></svg>,
  tiktok: (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64c.3 0 .6.04.88.13V9.4a6.33 6.33 0 00-1-.08A6.34 6.34 0 003 15.66a6.34 6.34 0 0010.86 4.49v.02h3.45v-9.4a7.29 7.29 0 004.28 1.38V8.7a4.78 4.78 0 01-2-2.01z"/></svg>,
  facebook: (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><path d="M18.77 7.46H14.5v-1.9c0-.9.6-1.1 1-1.1h3V.5h-4.33C10.24.5 9.5 3.44 9.5 5.32v2.15h-3v4h3v12h5v-12h3.85l.42-4z"/></svg>,
  maps: (p) => <svg {...p} viewBox="0 0 24 24" fill="none"><path fill="#34A853" d="M12 23s2.2-3 3.9-5.6L12 14.3l-3.9 3.1C9.8 20 12 23 12 23z"/><path fill="#FBBC04" d="M6.3 13.2c-.6-1-1-1.9-1.2-2.6l4.6 3.6-3.4-1z"/><path fill="#4285F4" d="M17.7 13.2c1-1.6 1.5-2.8 1.5-4.2a7.2 7.2 0 00-1.6-4.5l-5.6 6.7 5.7 2z"/><path fill="#1A73E8" d="M12 1a7.2 7.2 0 016.1 3.3L12 11.2 5.9 4.3A7.2 7.2 0 0112 1z"/><path fill="#EA4335" d="M4.8 8.9c0-1.8.5-3.4 1.4-4.7l5.8 6.9-5.9 2.3a8.4 8.4 0 01-1.3-4.5z"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></svg>,
};
import MenuScreen from './MenuScreen';
import { useBusinessConfig } from '../Context/BusinessContext';

/**
 * MoreSheet — hub "Mantente al día" del menú V2.
 * Regla: cada tile solo se dibuja si su dato existe. Nada de accesos muertos.
 */
/* Wi-Fi del local: copiar la clave y QR para conectarse sin teclearla.
   El formato WIFI:T:WPA;S:red;P:clave;; lo entienden iOS y Android nativos. */
function WifiCard({ wifi }) {
  const [copied, setCopied] = useState(false);
  const payload = `WIFI:T:${wifi.password ? 'WPA' : 'nopass'};S:${wifi.ssid};P:${wifi.password || ''};;`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(wifi.password || wifi.ssid);
      setCopied(true);
      if (navigator.vibrate) navigator.vibrate(10);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* sin permisos de portapapeles */ }
  };

  return (
    <div className="rounded-2xl border p-4" style={{ background: 'var(--mb-card)', borderColor: 'var(--mb-line)' }}>
      <div className="flex items-center gap-3 mb-3">
        <span className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--mb-accent-soft)', color: 'var(--mb-accent-strong)' }}>
          <Wifi size={20} strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-bold truncate" style={{ color: 'var(--mb-ink)' }}>Wi-Fi del local</p>
          <p className="text-[12.5px] truncate" style={{ color: 'var(--mb-ink-2)' }}>{wifi.ssid}</p>
        </div>
      </div>

      {wifi.password && (
        <button
          onClick={copy}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl mb-3 active:scale-[0.99] transition-transform"
          style={{ background: 'var(--mb-surface-2)' }}
        >
          <span className="font-mono text-[15px] tracking-wide truncate" style={{ color: 'var(--mb-ink)' }}>{wifi.password}</span>
          <span className="flex items-center gap-1 text-[12px] font-bold shrink-0" style={{ color: copied ? '#059669' : 'var(--mb-accent-strong)' }}>
            {copied ? <><Check size={14} /> Copiada</> : 'Copiar'}
          </span>
        </button>
      )}

      <div className="flex flex-col items-center gap-2 py-1">
        <div className="p-2.5 rounded-xl bg-white">
          <QRCodeCanvas value={payload} size={136} level="M" includeMargin={false} />
        </div>
        <p className="text-[11.5px] text-center" style={{ color: 'var(--mb-ink-3)' }}>
          Escanea con la cámara para conectarte
        </p>
      </div>
    </div>
  );
}

export default function MoreSheet({ open, onClose, onRate, onShowLoyalty, loyaltySubtitle }) {
  const { businessConfig } = useBusinessConfig();
  const wifi = businessConfig?.wifi;
  const hasWifi = !!(wifi?.enabled && wifi?.ssid);

  const wa = (businessConfig?.whatsappNumber || '').replace(/\D/g, '');
  const waHref = wa
    ? `https://wa.me/${wa.length <= 10 ? (businessConfig?.phoneCountryCode || '+57').replace(/\D/g, '') + wa : wa}`
    : null;

  const mapsUrl = businessConfig?.googleMapsUrl
    || (businessConfig?.location?.coordinates?.lat
      ? `https://maps.google.com/?q=${businessConfig.location.coordinates.lat},${businessConfig.location.coordinates.lng}`
      : businessConfig?.address ? `https://maps.google.com/?q=${encodeURIComponent(businessConfig.address)}` : null);

  const social = businessConfig?.socialMedia || {};
  const SOCIAL_META = {
    instagram: { label: 'Instagram', sub: 'Mira nuestras fotos', brand: '#E4405F', Icon: BRAND.instagram },
    tiktok: { label: 'TikTok', sub: 'Míranos en video', brand: '#000000', Icon: BRAND.tiktok },
    facebook: { label: 'Facebook', sub: 'Síguenos', brand: '#1877F2', Icon: BRAND.facebook },
  };
  const socialLinks = ['instagram', 'tiktok', 'facebook']
    .filter((k) => social[k]?.isVisible && social[k]?.url)
    .map((k) => ({ key: k, url: social[k].url, ...SOCIAL_META[k] }));

  const tiles = [];

  // Calificar SIEMPRE pasa por el embudo interno: nunca link directo a Google.
  if (onRate) {
    tiles.push({
      key: 'rate',
      icon: Star,
      title: 'Calificar el negocio',
      subtitle: 'Cuéntanos cómo te fue',
      onClick: () => { onClose(); onRate(); },
    });
  }

  if (onShowLoyalty) {
    tiles.push({
      key: 'loyalty',
      icon: Gift,
      title: 'Tus puntos',
      subtitle: loyaltySubtitle || 'Acumula y canjea recompensas',
      onClick: () => { onClose(); onShowLoyalty(); },
    });
  }

  if (businessConfig?.enableBookings) {
    tiles.push({
      key: 'booking',
      icon: CalendarCheck,
      title: 'Reservar',
      subtitle: 'Aparta tu mesa',
      onClick: () => { onClose(); window.dispatchEvent(new CustomEvent('mb:open-booking')); },
    });
  }

  if (waHref) {
    tiles.push({ key: 'wa', icon: MessageCircle, brand: '#25D366', title: 'Escríbenos por WhatsApp', subtitle: 'Resolvemos al instante', href: waHref });
  }

  socialLinks.forEach((s) => {
    tiles.push({ key: s.key, icon: s.Icon, brand: s.brand, raw: true, title: s.label, subtitle: s.sub, href: s.url });
  });

  if (mapsUrl) {
    tiles.push({
      key: 'maps',
      icon: BRAND.maps,
      raw: true,
      title: 'Cómo llegar',
      subtitle: businessConfig?.address || 'Ver en el mapa',
      href: mapsUrl,
    });
  }

  return (
    <MenuScreen open={open} onClose={onClose} title="Más" subtitle="Mantente al día">
      <div className="p-4 space-y-2.5">
        {hasWifi && <WifiCard wifi={wifi} />}

        {tiles.length === 0 && !hasWifi ? (
          <div className="py-20 text-center">
            <Star size={44} className="mx-auto mb-3" style={{ color: 'var(--mb-accent)', opacity: 0.2 }} />
            <p className="font-bold" style={{ color: 'var(--mb-ink)' }}>Nada por aquí todavía</p>
            <p className="text-[13px] mt-1" style={{ color: 'var(--mb-ink-2)' }}>El negocio aún no ha publicado enlaces ni beneficios.</p>
          </div>
        ) : tiles.map((t) => {
          const Inner = (
            <>
              <span
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={t.brand
                  ? { background: `${t.brand}14`, color: t.brand }
                  : { background: 'var(--mb-accent-soft)', color: 'var(--mb-accent-strong)' }}
              >
                {/* Los íconos de marca son SVG propios y no aceptan strokeWidth */}
                {t.raw
                  ? <t.icon width={21} height={21} />
                  : <t.icon size={20} strokeWidth={1.8} />}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[15px] font-bold truncate" style={{ color: 'var(--mb-ink)' }}>{t.title}</span>
                <span className="block text-[12.5px] truncate" style={{ color: 'var(--mb-ink-2)' }}>{t.subtitle}</span>
              </span>
              <ChevronRight size={18} style={{ color: 'var(--mb-ink-3)' }} />
            </>
          );
          const cls = 'w-full flex items-center gap-3.5 p-3 rounded-2xl border active:scale-[0.99] transition-transform';
          const st = { background: 'var(--mb-card)', borderColor: 'var(--mb-line)' };
          return t.href ? (
            <a key={t.key} href={t.href} target="_blank" rel="noopener noreferrer" className={cls} style={st}>{Inner}</a>
          ) : (
            <button key={t.key} onClick={t.onClick} className={cls} style={st}>{Inner}</button>
          );
        })}
      </div>
    </MenuScreen>
  );
}
