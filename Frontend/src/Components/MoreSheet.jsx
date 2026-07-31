import React from 'react';
import { Star, Gift, MessageCircle, MapPin, CalendarCheck, ChevronRight, Share2 } from 'lucide-react';
import MenuScreen from './MenuScreen';
import { useBusinessConfig } from '../Context/BusinessContext';

/**
 * MoreSheet — hub "Mantente al día" del menú V2.
 * Regla: cada tile solo se dibuja si su dato existe. Nada de accesos muertos.
 */
export default function MoreSheet({ open, onClose, onRate, onShowLoyalty, loyaltySubtitle }) {
  const { businessConfig } = useBusinessConfig();

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
        {tiles.length === 0 ? (
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
