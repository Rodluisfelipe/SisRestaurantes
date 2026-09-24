import { useEffect, useRef, useState } from 'react';
import { MessageCircle, RotateCcw, ChevronRight } from 'lucide-react';
import { Capa } from './ui';
import api from '../services/api';
import { imageAt } from '../utils/imageCdn';
import { formatCurrency } from '../utils/currency';

/**
 * La pantalla de "pedido confirmado", a pantalla completa.
 *
 * Primero el momento: un check verde que crece y se dibuja, y el número del
 * pedido. Si el pedido va por WhatsApp, abajo una tarjeta con la cuenta
 * regresiva que lo abre sola ("vuelve aquí para ver el estado"). Antes se
 * abría WhatsApp de inmediato, sin que la persona viera que su pedido había
 * quedado, y de hecho antes de guardarlo: si el celular cortaba la página al
 * saltar a WhatsApp, el negocio recibía el mensaje pero el pedido no quedaba.
 *
 * Debajo, lo que pidió con su foto, y cómo seguirlo.
 */

const SEGUNDOS_WHATSAPP = 4;
const MINUTOS_PARA_CANCELAR = 2;
const esCelular = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export default function PedidoConfirmado({ datos, negocio, moneda = 'COP', color = '#16a34a', onCerrar, onVerEstado }) {
  const [restante, setRestante] = useState(SEGUNDOS_WHATSAPP);
  const [abierto, setAbierto] = useState(false);
  const [puedeCancelar, setPuedeCancelar] = useState(true);
  const [cancelando, setCancelando] = useState(false);
  const [aviso, setAviso] = useState('');
  const abrirRef = useRef(null);

  const abrirWhatsApp = () => {
    if (!datos?.whatsappUrl) return;
    setAbierto(true);
    setRestante(0);
    if (esCelular()) window.location.href = datos.whatsappUrl;
    else window.open(datos.whatsappUrl, '_blank', 'noopener,noreferrer');
  };
  abrirRef.current = abrirWhatsApp;

  // La cuenta regresiva: deja ver la confirmación y luego abre WhatsApp sola.
  useEffect(() => {
    if (!datos?.whatsappUrl || abierto) return undefined;
    if (restante <= 0) {
      // En el computador una ventana nueva sin toque la bloquea el navegador: ahí espera el botón.
      if (esCelular()) abrirRef.current?.();
      return undefined;
    }
    const t = setTimeout(() => setRestante((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [restante, abierto, datos?.whatsappUrl]);

  // Cancelar solo en los primeros minutos.
  useEffect(() => {
    if (!datos?.orderId || !datos?.token || datos?.isBooking) { setPuedeCancelar(false); return undefined; }
    const t = setTimeout(() => setPuedeCancelar(false), MINUTOS_PARA_CANCELAR * 60000);
    return () => clearTimeout(t);
  }, [datos?.orderId, datos?.token, datos?.isBooking]);

  const cancelar = async () => {
    if (!window.confirm('¿Cancelar tu pedido? El negocio lo verá como cancelado.')) return;
    setCancelando(true);
    try {
      await api.post(`/orders/${datos.orderId}/cancelar-cliente`, {}, { headers: { 'X-Customer-Token': datos.token } });
      setAviso('Tu pedido quedó cancelado.');
      setPuedeCancelar(false);
      setTimeout(onCerrar, 1400);
    } catch (e) {
      setAviso(e.response?.data?.message || 'No se pudo cancelar. Escríbele al negocio.');
      setPuedeCancelar(false);
    } finally {
      setCancelando(false);
    }
  };

  if (!datos) return null;
  const titulo = datos.isBooking ? '¡Cita agendada!' : '¡Pedido confirmado!';
  const conWhatsApp = !!datos.whatsappUrl;

  const items = datos.items || [];
  const cantidad = items.reduce((n, it) => n + (Number(it.cantidad) || 1), 0);
  const visibles = items.slice(0, 4);
  const sobran = items.length - visibles.length;

  /* Todo en una pantalla, sin scroll: el momento arriba, WhatsApp si aplica,
     lo que pidió en una tira de fotitos, y las salidas abajo. */
  return (
    <div
      className="fixed inset-0 z-[160] bg-white overflow-hidden animate-aparecer"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <Capa onCerrar={onCerrar} />
      <div
        className="h-full max-w-md mx-auto flex flex-col px-5"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 28px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        {/* El momento: el check crece y se dibuja */}
        <div className="flex flex-col items-center text-center">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-emerald-100 animate-agregado" />
            <span className="relative w-[72px] h-[72px] rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 animate-agregado">
              <svg viewBox="0 0 24 24" className="w-9 h-9" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray="48" className="animate-trazo" />
              </svg>
            </span>
          </div>
          <h1 className="mt-3 text-[26px] leading-tight font-black text-slate-900 animate-subir" style={{ animationDelay: '250ms' }}>{titulo}</h1>
          {datos.numero && (
            <p className="mt-0.5 text-sm font-bold text-slate-500 animate-subir" style={{ animationDelay: '320ms' }}>
              {datos.isBooking ? 'Reserva' : 'Pedido'} #{datos.numero}{negocio ? ` · ${negocio}` : ''}
            </p>
          )}
          {datos.mensaje && !conWhatsApp && (
            <p className="mt-2 text-sm text-slate-600 leading-snug animate-subir" style={{ animationDelay: '380ms' }}>{datos.mensaje}</p>
          )}
        </div>

        {/* WhatsApp: se abre solo, con tiempo para ver lo de arriba */}
        {conWhatsApp && (
          <div className="mt-5 rounded-3xl border-2 border-[#25D366]/40 bg-[#25D366]/5 p-3.5 animate-subir" style={{ animationDelay: '450ms' }}>
            <p className="text-[15px] font-black text-slate-900 text-center">Último paso: envíalo por WhatsApp</p>
            <button
              type="button"
              onClick={abrirWhatsApp}
              className="relative mt-2.5 w-full h-13 min-h-[52px] rounded-full bg-[#25D366] text-white font-black text-[16px] flex items-center justify-center gap-2 overflow-hidden active:scale-[0.98] transition-transform"
            >
              {!abierto && esCelular() && (
                // animate-vaciar dura lo mismo que SEGUNDOS_WHATSAPP (4 s, tailwind.config).
                <span className="absolute inset-0 bg-black/10 origin-left animate-vaciar" aria-hidden="true" />
              )}
              <MessageCircle className="relative w-5 h-5" />
              <span className="relative">
                {abierto ? 'Abrir WhatsApp de nuevo' : esCelular() && restante > 0 ? `Abriendo WhatsApp en ${restante}…` : 'Abrir WhatsApp'}
              </span>
            </button>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[13px] text-slate-600">
              <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
              <span><b>Vuelve aquí</b> para ver el estado de tu pedido</span>
            </p>
          </div>
        )}

        {/* Lo que pidió, en una tira de fotitos */}
        {items.length > 0 && (
          <div className="mt-5 rounded-2xl border border-slate-200 p-3 flex items-center gap-3 animate-subir" style={{ animationDelay: '520ms' }}>
            <div className="flex -space-x-2 flex-shrink-0">
              {visibles.map((it, i) => (
                <span key={i} className="w-11 h-11 rounded-xl bg-slate-100 overflow-hidden ring-2 ring-white">
                  {it.imagen && <img src={imageAt(it.imagen, 96)} alt="" className="w-full h-full object-cover" />}
                </span>
              ))}
              {sobran > 0 && (
                <span className="w-11 h-11 rounded-xl bg-slate-100 ring-2 ring-white flex items-center justify-center text-xs font-black text-slate-600">+{sobran}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-slate-500 truncate">{items.map((it) => it.nombre).join(', ')}</p>
              <p className="text-[15px] font-black text-slate-900">
                {cantidad} {cantidad === 1 ? 'producto' : 'productos'} · {formatCurrency(datos.total, moneda)}
              </p>
            </div>
          </div>
        )}

        {aviso && <p role="status" className="mt-3 text-center text-sm font-semibold text-slate-700">{aviso}</p>}

        {/* Salidas, siempre abajo */}
        <div className="mt-auto pt-4 space-y-1.5">
          {datos.token && onVerEstado && (
            <button
              type="button"
              onClick={onVerEstado}
              className={`w-full h-13 min-h-[52px] rounded-full font-black text-[15px] flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform ${conWhatsApp ? 'border-2 border-slate-200 text-slate-800 bg-white' : 'text-white'}`}
              style={conWhatsApp ? undefined : { backgroundColor: color }}
            >
              {datos.esApp ? 'Ver mi pedido y pagar' : 'Ver el estado de mi pedido'} <ChevronRight className="w-4 h-4" />
            </button>
          )}
          <button type="button" onClick={onCerrar} className="w-full h-11 rounded-full font-bold text-[15px] text-slate-600">
            Volver al menú
          </button>
          {puedeCancelar && (
            <button type="button" onClick={cancelar} disabled={cancelando} className="w-full text-center text-[13px] text-slate-400 underline underline-offset-4 py-1">
              {cancelando ? 'Cancelando…' : '¿Te equivocaste? Cancelar pedido'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
