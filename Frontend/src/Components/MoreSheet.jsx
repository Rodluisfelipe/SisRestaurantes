import React, { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Star, Gift, MessageCircle, MapPin, CalendarCheck, ChevronRight, Share2, Wifi, Check } from 'lucide-react';
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
  const socialLinks = ['instagram', 'tiktok', 'facebook']
    .filter((k) => social[k]?.isVisible && social[k]?.url)
    .map((k) => ({ key: k, url: social[k].url, label: k.charAt(0).toUpperCase() + k.slice(1) }));

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
    tiles.push({ key: 'wa', icon: MessageCircle, title: 'Escríbenos por WhatsApp', subtitle: 'Resolvemos al instante', href: waHref });
  }

  socialLinks.forEach((s) => {
    tiles.push({ key: s.key, icon: Share2, title: s.label, subtitle: 'Síguenos', href: s.url });
  });

  if (mapsUrl) {
    tiles.push({ key: 'maps', icon: MapPin, title: 'Cómo llegar', subtitle: businessConfig?.address || 'Ver en el mapa', href: mapsUrl });
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
                style={{ background: 'var(--mb-accent-soft)', color: 'var(--mb-accent-strong)' }}
              >
                <t.icon size={20} strokeWidth={1.8} />
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
