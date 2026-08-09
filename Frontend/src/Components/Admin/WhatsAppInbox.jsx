/**
 * Bandeja de WhatsApp — los chats del número propio del negocio.
 *
 * Dos estados que mandan sobre todo lo demás:
 *   1. Si el complemento no está contratado, el backend responde 402 y acá se
 *      muestra la oferta en vez de una pantalla rota.
 *   2. La ventana de atención de Meta: solo se puede escribir libremente dentro
 *      de las 24 horas siguientes al último mensaje del cliente. No es un
 *      detalle a explicar en un error después de fallar el envío; el cuadro de
 *      respuesta se bloquea y se dice por qué.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FaWhatsapp, FaPaperPlane, FaSpinner, FaLock, FaPlug, FaEye, FaEyeSlash,
  FaCheck, FaCheckDouble, FaExclamationTriangle, FaImage, FaMapMarkerAlt,
  FaFileAlt, FaMicrophone, FaVideo, FaArrowLeft, FaSyncAlt,
  FaUser, FaShoppingBag, FaGift, FaHome, FaClock, FaUserPlus
} from 'react-icons/fa';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';
import QuickOrderModal from '../QuickOrderModal';

const ICONO_TIPO = {
  image: FaImage, video: FaVideo, audio: FaMicrophone,
  document: FaFileAlt, sticker: FaImage, location: FaMapMarkerAlt,
};

function tiempoRelativo(fecha) {
  const min = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d} d` : new Date(fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

const pesos = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');

const ESTADO_PEDIDO = {
  pending: 'Pendiente', pending_payment: 'Esperando pago', payment_uploaded: 'Por cobrar',
  payment_confirmed: 'Pago confirmado', confirmed: 'Confirmado', preparing: 'En preparación',
  inProgress: 'En preparación', ready: 'Listo', completed: 'Completado',
  delivered: 'Entregado', cancelled: 'Cancelado',
};

function telefonoLegible(p) {
  const s = String(p || '');
  if (s.startsWith('57') && s.length === 12) {
    return `${s.slice(2, 5)} ${s.slice(5, 8)} ${s.slice(8)}`;
  }
  return s;
}

/* Los dos chulos, igual que en WhatsApp: el estado del mensaje se lee de un
   vistazo sin tener que explicarlo. */
function EstadoMensaje({ estado }) {
  if (estado === 'failed') return <FaExclamationTriangle className="text-red-400 text-[10px]" title="No se entregó" />;
  if (estado === 'read') return <FaCheckDouble className="text-sky-400 text-[10px]" title="Leído" />;
  if (estado === 'delivered') return <FaCheckDouble className="text-slate-400 text-[10px]" title="Entregado" />;
  if (estado === 'sent') return <FaCheck className="text-slate-400 text-[10px]" title="Enviado" />;
  return <FaSpinner className="text-slate-300 text-[10px] animate-spin" title="Enviando" />;
}

export default function WhatsAppInbox() {
  /* El negocio se manda explícito, como hace el resto del panel. Confiar solo
     en `req.user.businessId` dejaba la petición sin negocio, el backend
     respondía error, y la pantalla caía en el formulario de conectar como si
     el número no existiera. */
  const { businessConfig } = useBusinessConfig();
  const businessId = businessConfig?._id;

  const [cargando, setCargando] = useState(true);
  const [sinComplemento, setSinComplemento] = useState(false);
  const [cuenta, setCuenta] = useState(null);
  const [chats, setChats] = useState([]);
  const [chatActivo, setChatActivo] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [puedeResponder, setPuedeResponder] = useState(false);
  const [cargandoChat, setCargandoChat] = useState(false);
  const [borrador, setBorrador] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [falloCarga, setFalloCarga] = useState(false);
  const [ficha, setFicha] = useState(null);
  const [cargandoFicha, setCargandoFicha] = useState(false);
  const [tomandoPedido, setTomandoPedido] = useState(false);
  const [reconectando, setReconectando] = useState(false);
  const [vista, setVista] = useState('chats');
  const finRef = useRef(null);

  // ── Carga inicial ──
  const cargarCuenta = useCallback(async () => {
    try {
      const { data } = await api.get(`/whatsapp-inbox/account?businessId=${businessId}`);
      setCuenta(data.account);
      setSinComplemento(false);
      setFalloCarga(false);
      return true;
    } catch (e) {
      if (e?.response?.status === 402) { setSinComplemento(true); return false; }
      /* Se marca el fallo para NO mostrar el formulario de conectar: pedirle
         los datos otra vez a alguien que ya conectó su número, solo porque una
         petición falló, hace pensar que se perdió la configuración. */
      setFalloCarga(true);
      setError(e?.response?.data?.message || 'No se pudo cargar la configuración');
      return false;
    }
  }, [businessId]);

  const cargarChats = useCallback(async () => {
    try {
      const { data } = await api.get(`/whatsapp-inbox/chats?businessId=${businessId}`);
      setChats(data.chats || []);
    } catch (e) {
      if (e?.response?.status !== 402) {
        setError(e?.response?.data?.message || 'No se pudieron cargar los chats');
      }
    }
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    (async () => {
      setCargando(true);
      const ok = await cargarCuenta();
      if (ok) await cargarChats();
      setCargando(false);
    })();
  }, [businessId, cargarCuenta, cargarChats]);

  /* Se refresca solo cada 15 segundos. No es tiempo real por websocket a
     propósito: un chat que llega con 15 segundos de retraso no rompe nada y
     evita sumarle otra conexión abierta al servidor por cada panel abierto. */
  useEffect(() => {
    if (sinComplemento || !cuenta) return undefined;
    const t = setInterval(() => {
      cargarChats();
      if (chatActivo) abrirChat(chatActivo, { silencioso: true });
    }, 15000);
    return () => clearInterval(t);
  }, [sinComplemento, cuenta, chatActivo, cargarChats]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  async function abrirChat(telefono, { silencioso = false } = {}) {
    if (!silencioso) {
      setCargandoChat(true);
      setChatActivo(telefono);
      setFicha(null);
      cargarFicha(telefono);
    }
    try {
      const { data } = await api.get(`/whatsapp-inbox/chats/${telefono}?businessId=${businessId}`);
      setMensajes(data.messages || []);
      setPuedeResponder(!!data.canReply);
      if (!silencioso) {
        // Al abrirlo dejan de contar como sin leer.
        setChats((prev) => prev.map((c) => (c.contactPhone === telefono ? { ...c, sinLeer: 0 } : c)));
      }
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo abrir la conversación');
    } finally {
      setCargandoChat(false);
    }
  }

  /* La ficha va en su propia petición y no bloquea el chat: si tarda o falla,
     los mensajes se leen igual. Saber quién escribe es útil, pero poder
     contestar es lo indispensable. */
  async function cargarFicha(telefono) {
    setCargandoFicha(true);
    try {
      const { data } = await api.get(`/whatsapp-inbox/chats/${telefono}/context?businessId=${businessId}`);
      setFicha(data);
    } catch {
      setFicha(null);
    } finally {
      setCargandoFicha(false);
    }
  }

  async function enviar(e) {
    e?.preventDefault();
    const texto = borrador.trim();
    if (!texto || enviando || !chatActivo) return;

    setEnviando(true);
    setError('');
    try {
      const { data } = await api.post(`/whatsapp-inbox/chats/${chatActivo}`, { text: texto, businessId });
      setMensajes((prev) => [...prev, data.message]);
      setBorrador('');
      cargarChats();
    } catch (e) {
      const r = e?.response?.data;
      setError(r?.message || 'No se pudo enviar');
      // La ventana se pudo cerrar mientras escribía: se refleja de inmediato.
      if (r?.code === 'OUTSIDE_WINDOW') setPuedeResponder(false);
    } finally {
      setEnviando(false);
    }
  }

  // ── Complemento no contratado ──
  if (sinComplemento) return <OfertaComplemento />;

  if (cargando || !businessId) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <FaSpinner className="animate-spin mr-2" /> Cargando…
      </div>
    );
  }

  // ── No se pudo consultar: se dice, en vez de fingir que no hay número ──
  if (falloCarga) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/70 p-8 max-w-md mx-auto text-center">
        <FaExclamationTriangle className="mx-auto text-2xl text-amber-500 mb-3" />
        <p className="text-sm font-semibold text-slate-700">No pudimos consultar tu WhatsApp</p>
        <p className="text-xs text-slate-500 mt-1">{error}</p>
        <button
          onClick={async () => { setCargando(true); const ok = await cargarCuenta(); if (ok) await cargarChats(); setCargando(false); }}
          className="mt-5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  /* Número sin conectar, o el negocio pidió reconectar.
     Un número en estado 'error' —token vencido, típicamente— NO cae acá: los
     mensajes siguen entrando y se pueden leer, así que se muestra la bandeja
     con el aviso arriba en vez de esconderla detrás de un formulario. */
  if (!cuenta || cuenta.status === 'pending' || reconectando) {
    return <ConectarNumero businessId={businessId} cuenta={cuenta} onConectado={async () => {
      setReconectando(false);
      await cargarCuenta(); await cargarChats();
    }} />;
  }

  const chatSeleccionado = chats.find((c) => c.contactPhone === chatActivo);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-emerald-500 text-white grid place-items-center shrink-0">
            <FaWhatsapp />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">WhatsApp del negocio</p>
            <p className="text-[11px] text-slate-400 truncate">
              {cuenta.displayNumber || cuenta.phoneNumberId}
              {cuenta.verifiedName ? ` · ${cuenta.verifiedName}` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => { cargarChats(); if (chatActivo) abrirChat(chatActivo, { silencioso: true }); }}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
          title="Actualizar"
        >
          <FaSyncAlt className="text-xs" />
        </button>
      </div>

      {/* Las plantillas viven acá y no en otra sección del menú: son parte de
          atender WhatsApp, y separarlas obliga a buscarlas cuando hacen falta. */}
      <div className="flex border-b border-slate-100 px-2">
        {[
          { id: 'chats', txt: 'Conversaciones' },
          { id: 'plantillas', txt: 'Plantillas' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setVista(t.id)}
            className={`px-3.5 py-2.5 text-xs font-bold border-b-2 -mb-px transition-colors ${
              vista === t.id
                ? 'border-emerald-500 text-slate-800'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.txt}
          </button>
        ))}
      </div>

      {/* Si Meta rechazó las credenciales, se dice arriba de todo: el negocio
          puede seguir viendo los chats que entran pero no responder ninguno, y
          sin este aviso la única señal sería que nadie contesta. */}
      {cuenta.lastError && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-start gap-2">
          <FaExclamationTriangle className="text-red-500 mt-0.5 shrink-0 text-xs" />
          <div className="text-xs text-red-700">
            <p className="font-bold">No podemos enviar mensajes.</p>
            <p className="mt-0.5">{cuenta.lastError}</p>
            <p className="mt-1 text-red-500">
              Suele ser el token vencido. Genera uno nuevo en Meta y vuelve a conectar el número.
            </p>
            <button
              onClick={() => setReconectando(true)}
              className="mt-2 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold transition-colors"
            >
              Reconectar número
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 text-xs text-red-600 flex items-start gap-2">
          <FaExclamationTriangle className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 font-bold">×</button>
        </div>
      )}

      {vista === 'plantillas' && <Plantillas businessId={businessId} />}

      <div className={`grid lg:grid-cols-[300px_1fr] min-h-[520px] ${vista === 'plantillas' ? 'hidden' : ''}`}>
        {/* Lista de chats */}
        <div className={`border-r border-slate-100 ${chatActivo ? 'hidden lg:block' : ''}`}>
          {chats.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <FaWhatsapp className="mx-auto text-3xl mb-3 opacity-40" />
              <p className="text-sm font-medium text-slate-500">Todavía no hay chats</p>
              <p className="text-xs mt-1">Cuando un cliente le escriba a tu número, aparecerá acá.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-50 max-h-[520px] overflow-y-auto">
              {chats.map((c) => {
                const activo = c.contactPhone === chatActivo;
                const Icono = ICONO_TIPO[c.lastType];
                return (
                  <li key={c.contactPhone}>
                    <button
                      onClick={() => abrirChat(c.contactPhone)}
                      className={`w-full text-left px-4 py-3 transition-colors ${activo ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {c.contactName || telefonoLegible(c.contactPhone)}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0">{tiempoRelativo(c.lastAt)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                          {c.lastDirection === 'out' && <span className="text-slate-300">Tú:</span>}
                          {Icono && <Icono className="text-[10px] shrink-0" />}
                          {c.lastText || (Icono ? 'Archivo adjunto' : '—')}
                        </p>
                        {c.sinLeer > 0 && (
                          <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold grid place-items-center">
                            {c.sinLeer}
                          </span>
                        )}
                      </div>
                      <Marcas chat={c} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Conversación */}
        <div className={`flex flex-col ${chatActivo ? '' : 'hidden lg:flex'}`}>
          {!chatActivo ? (
            /* Con ningún chat abierto, el espacio se aprovecha para lo que el
               negocio no va a ir a buscar por su cuenta: qué canal le está
               trayendo pedidos. */
            <OrigenPedidos businessId={businessId} />
          ) : (
            <>
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 lg:hidden">
                <button onClick={() => setChatActivo(null)} className="p-1.5 text-slate-500 hover:text-slate-700">
                  <FaArrowLeft className="text-sm" />
                </button>
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {chatSeleccionado?.contactName || telefonoLegible(chatActivo)}
                </p>
              </div>

              <FichaCliente
                ficha={ficha}
                cargando={cargandoFicha}
                onTomarPedido={() => setTomandoPedido(true)}
              />

              <div className="flex-1 p-4 space-y-2 overflow-y-auto max-h-[400px] bg-slate-50/40">
                {cargandoChat ? (
                  <div className="grid place-items-center py-12 text-slate-300"><FaSpinner className="animate-spin" /></div>
                ) : (
                  mensajes.map((m) => {
                    const mio = m.direction === 'out';
                    const Icono = ICONO_TIPO[m.type];
                    return (
                      <div key={m._id || m.wamid} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 ${
                          mio ? 'bg-emerald-500 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'
                        }`}>
                          {Icono && (
                            <p className={`text-[11px] mb-1 flex items-center gap-1.5 ${mio ? 'text-emerald-100' : 'text-slate-400'}`}>
                              <Icono /> {m.type === 'location' ? 'Ubicación' : 'Archivo adjunto'}
                            </p>
                          )}
                          {m.text && <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>}
                          <div className={`flex items-center gap-1 justify-end mt-0.5 ${mio ? 'text-emerald-100' : 'text-slate-300'}`}>
                            <span className="text-[10px]">
                              {new Date(m.sentAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {mio && <EstadoMensaje estado={m.status} />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={finRef} />
              </div>

              {/* Responder — o la razón por la que no se puede */}
              {puedeResponder ? (
                <form onSubmit={enviar} className="flex items-end gap-2 p-3 border-t border-slate-100">
                  <textarea
                    value={borrador}
                    onChange={(e) => setBorrador(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(e); }
                    }}
                    rows={1}
                    placeholder="Escribe tu respuesta…"
                    className="flex-1 resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 max-h-32"
                  />
                  <button
                    type="submit"
                    disabled={!borrador.trim() || enviando}
                    className="w-10 h-10 shrink-0 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:cursor-not-allowed text-white grid place-items-center transition-colors"
                  >
                    {enviando ? <FaSpinner className="animate-spin text-sm" /> : <FaPaperPlane className="text-sm" />}
                  </button>
                </form>
              ) : (
                <div className="p-3 border-t border-slate-100 bg-amber-50/60">
                  <p className="text-xs text-amber-700 flex items-start gap-2">
                    <FaLock className="mt-0.5 shrink-0" />
                    <span>
                      <strong>Pasaron más de 24 horas</strong> desde el último mensaje de este cliente.
                      WhatsApp solo permite retomar la conversación con una plantilla aprobada por Meta.
                      Si el cliente vuelve a escribir, se abre otra vez por 24 horas.
                    </span>
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tomar el pedido sin salir del chat, con los datos ya puestos.
          Se reutiliza el pedido rápido a propósito: los precios, las zonas de
          envío y los extras ya están resueltos ahí, y duplicar ese cálculo es
          justo como aparecen las diferencias de totales. */}
      <QuickOrderModal
        isOpen={tomandoPedido}
        onClose={() => setTomandoPedido(false)}
        channel="whatsapp"
        prefill={{
          name: ficha?.cliente?.name || chatSeleccionado?.contactName || '',
          phone: chatActivo || '',
          address: ficha?.cliente?.address || '',
          orderType: ficha?.cliente?.address ? 'delivery' : 'inSite',
        }}
        onOrderCreated={(pedido) => {
          setTomandoPedido(false);
          // La ficha se recarga para que el pedido nuevo salga como "en curso".
          if (chatActivo) cargarFicha(chatActivo);
          setBorrador(
            `Listo, tu pedido quedó registrado con el número #${pedido?.orderNumber}. `
            + 'Te avisamos apenas esté en camino.'
          );
        }}
      />
    </div>
  );
}

/**
 * Quién es el que está escribiendo.
 *
 * Es lo que separa esta bandeja de tener WhatsApp abierto en otra pestaña: al
 * responder se ve si es un cliente de siempre o alguien nuevo, qué pidió antes
 * y si tiene algo en curso ahora mismo.
 */
function FichaCliente({ ficha, cargando, onTomarPedido }) {
  if (cargando) {
    return (
      <div className="p-4 border-b border-slate-100 bg-slate-50/60 text-center text-slate-300">
        <FaSpinner className="animate-spin mx-auto" />
      </div>
    );
  }
  if (!ficha) return null;

  const { cliente, fidelidad, pedidosEnCurso = [], ultimosPedidos = [], esConocido } = ficha;

  const BotonPedido = () => (
    <button
      onClick={onTomarPedido}
      className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors active:scale-[0.97] shrink-0"
    >
      <FaShoppingBag className="text-[10px]" /> Tomar pedido
    </button>
  );

  // Cliente nuevo: se dice, porque cambia cómo se le contesta.
  if (!esConocido) {
    return (
      <div className="px-4 py-2.5 border-b border-slate-100 bg-sky-50/70 flex items-center gap-3">
        <FaUserPlus className="text-sky-500 shrink-0 text-xs" />
        <p className="text-xs text-sky-700 flex-1">
          <strong>Cliente nuevo.</strong> No tiene pedidos anteriores en tu negocio.
        </p>
        <BotonPedido />
      </div>
    );
  }

  return (
    <div className="border-b border-slate-100 bg-slate-50/60">
      {/* Resumen */}
      <div className="px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
        {cliente?.name && (
          <span className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
            <FaUser className="text-slate-400 text-[10px]" /> {cliente.name}
          </span>
        )}
        {cliente?.totalOrders > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <FaShoppingBag className="text-slate-400 text-[10px]" />
            {cliente.totalOrders} pedido{cliente.totalOrders === 1 ? '' : 's'}
            {cliente.totalSpent > 0 && <strong className="text-slate-700">· {pesos(cliente.totalSpent)}</strong>}
          </span>
        )}
        {fidelidad?.points > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-amber-600">
            <FaGift className="text-[10px]" /> {fidelidad.points} pts
            {fidelidad.currentTier && ` · ${fidelidad.currentTier}`}
          </span>
        )}
        {cliente?.address && (
          <span className="flex items-center gap-1.5 text-xs text-slate-500 min-w-0">
            <FaHome className="text-slate-400 text-[10px] shrink-0" />
            <span className="truncate max-w-[220px]" title={cliente.address}>{cliente.address}</span>
          </span>
        )}
        <div className="ml-auto"><BotonPedido /></div>
      </div>

      {/* Un pedido en curso es lo primero que hay que saber al contestar */}
      {pedidosEnCurso.length > 0 && (
        <div className="px-4 pb-3 space-y-1.5">
          {pedidosEnCurso.map((p) => (
            <div key={p._id} className="flex items-center gap-2 bg-amber-50 border border-amber-200/70 rounded-lg px-3 py-2">
              <FaClock className="text-amber-500 text-[10px] shrink-0" />
              <span className="text-xs text-amber-800 font-semibold">#{p.orderNumber}</span>
              <span className="text-xs text-amber-700">{ESTADO_PEDIDO[p.status] || p.status}</span>
              <span className="text-xs text-amber-600 ml-auto font-semibold">{pesos(p.total)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Lo último que pidió — para no tener que preguntárselo */}
      {ultimosPedidos.length > 0 && (
        <details className="px-4 pb-3 group">
          <summary className="text-[11px] text-slate-400 cursor-pointer hover:text-slate-600 select-none">
            Ver últimos pedidos ({ultimosPedidos.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {ultimosPedidos.map((p) => (
              <li key={p._id} className="text-xs bg-white border border-slate-200/70 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700">#{p.orderNumber}</span>
                  <span className="text-slate-400 text-[10px]">
                    {new Date(p.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                  </span>
                  <span className="font-semibold text-slate-600 ml-auto">{pesos(p.total)}</span>
                </div>
                {p.items?.length > 0 && (
                  <p className="text-slate-400 text-[11px] mt-0.5 truncate">
                    {p.items.join(', ')}{p.masItems > 0 ? ` y ${p.masItems} más` : ''}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/**
 * Qué pasó en esta conversación, de un vistazo.
 *
 * Sin esto hay que abrir cada chat y leerlo entero para saber si ya lo
 * atendieron, si se le mandó el menú o si terminó en pedido. Con veinte chats
 * abiertos eso no lo hace nadie.
 */
function Marcas({ chat }) {
  const a = chat.agente;
  const marcas = [];

  if (chat.esperandoRespuesta) {
    marcas.push({ txt: 'Sin responder', clase: 'bg-amber-100 text-amber-700' });
  } else {
    marcas.push({ txt: 'Contestado', clase: 'bg-slate-100 text-slate-500' });
  }

  if (a?.orderNumber) {
    marcas.push({ txt: `Pedido #${a.orderNumber}`, clase: 'bg-emerald-100 text-emerald-700' });
  }
  if (a?.menuEnviado) {
    marcas.push({ txt: 'Menú enviado', clase: 'bg-sky-100 text-sky-700' });
  }
  if (a?.estado === 'con_humano') {
    marcas.push({ txt: 'Lo tomó alguien', clase: 'bg-violet-100 text-violet-700' });
  } else if (a?.estado === 'activa') {
    marcas.push({ txt: 'Atiende el bot', clase: 'bg-slate-100 text-slate-500' });
  }

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {marcas.map((m) => (
        <span key={m.txt} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${m.clase}`}>
          {m.txt}
        </span>
      ))}
    </div>
  );
}

/**
 * De qué enlace vinieron los pedidos.
 *
 * Es lo que cambia la conversación del precio: en vez de discutir cuánto cuesta
 * MenuBy, se ve cuánto trajo cada canal.
 */
function OrigenPedidos({ businessId }) {
  const [datos, setDatos] = useState(null);
  const [dias, setDias] = useState(30);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    api.get(`/whatsapp-inbox/origen?businessId=${businessId}&dias=${dias}`)
      .then(({ data }) => { if (vivo) setDatos(data); })
      .catch(() => { if (vivo) setDatos(null); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [businessId, dias]);

  const ETIQUETAS = {
    whatsapp: 'WhatsApp', instagram: 'Instagram', facebook: 'Facebook',
    qr: 'Código QR', google: 'Google', 'sin-marcar': 'Sin marcar',
  };

  if (cargando) {
    return <div className="p-6 text-center text-slate-300"><FaSpinner className="animate-spin mx-auto" /></div>;
  }
  if (!datos?.origenes?.length) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-slate-500 font-medium">Todavía no hay pedidos que medir</p>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Comparte tu menú con un enlace marcado —por ejemplo <code className="text-slate-500">?source=instagram</code>—
          y acá verás cuántos pedidos trajo cada canal.
        </p>
      </div>
    );
  }

  const { origenes, totales } = datos;
  const mayor = Math.max(...origenes.map((o) => o.ventas), 1);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-bold text-slate-800">De dónde vienen tus pedidos</p>
          <p className="text-[11px] text-slate-400">
            {totales.pedidos} pedidos · {pesos(totales.ventas)} en ventas
          </p>
        </div>
        <select
          value={dias}
          onChange={(e) => setDias(Number(e.target.value))}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600"
        >
          <option value={7}>7 días</option>
          <option value={30}>30 días</option>
          <option value={90}>90 días</option>
        </select>
      </div>

      <ul className="space-y-2.5">
        {origenes.map((o) => (
          <li key={o.origen}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-700">
                {ETIQUETAS[o.origen] || o.origen}
              </span>
              <span className="text-slate-500">
                {o.pedidos} pedido{o.pedidos === 1 ? '' : 's'} · <strong className="text-slate-700">{pesos(o.ventas)}</strong>
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
              <div
                className={`h-full rounded-full ${o.origen === 'sin-marcar' ? 'bg-slate-300' : 'bg-emerald-500'}`}
                style={{ width: `${Math.max(2, (o.ventas / mayor) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Ticket promedio {pesos(o.ticketPromedio)}
            </p>
          </li>
        ))}
      </ul>

      {origenes.some((o) => o.origen === 'sin-marcar') && (
        <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
          <strong className="text-slate-500">Sin marcar</strong> son los pedidos que entraron por un enlace
          sin identificar. Para medirlos, comparte el menú añadiéndole <code>?source=</code> y el nombre del canal.
        </p>
      )}
    </div>
  );
}

/**
 * Plantillas de Meta.
 *
 * Son la única forma de escribirle a un cliente fuera de las 24 horas: "tu
 * pedido salió", "dejaste tu carrito". Meta las revisa una por una, y rechaza
 * sin explicar cosas que el negocio no tiene por qué saber —el nombre solo
 * admite minúsculas y guion bajo, las variables necesitan un ejemplo—, así que
 * la pantalla se encarga de eso en vez de dejarlo adivinar.
 */
const ESTADO_PLANTILLA = {
  APPROVED: { texto: 'Aprobada', clase: 'bg-emerald-100 text-emerald-700' },
  PENDING: { texto: 'En revisión', clase: 'bg-amber-100 text-amber-700' },
  REJECTED: { texto: 'Rechazada', clase: 'bg-red-100 text-red-700' },
};

function Plantillas({ businessId }) {
  const [plantillas, setPlantillas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [creando, setCreando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');

  const [nombre, setNombre] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [categoria, setCategoria] = useState('UTILITY');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await api.get(`/whatsapp-inbox/plantillas?businessId=${businessId}`);
      setPlantillas(data.plantillas || []);
      setError('');
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudieron cargar las plantillas');
    } finally {
      setCargando(false);
    }
  }, [businessId]);

  useEffect(() => { cargar(); }, [cargar]);

  /* Las variables van como {{1}}, {{2}}… y Meta exige un ejemplo de cada una.
     Se cuentan solas para no pedirle al negocio que entienda el formato. */
  const variables = [...new Set((cuerpo.match(/\{\{(\d+)\}\}/g) || []))];

  async function crear(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    setAviso('');
    try {
      const { data } = await api.post('/whatsapp-inbox/plantillas', {
        businessId,
        nombre,
        cuerpo,
        categoria,
        idioma: 'es',
        // Un ejemplo por variable: sin esto Meta la rechaza sin decir por qué.
        ejemplos: variables.map((_, i) => `ejemplo ${i + 1}`),
      });
      setAviso(data.aviso || 'Enviada a revisión.');
      setNombre(''); setCuerpo(''); setCreando(false);
      cargar();
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo crear');
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(p) {
    if (!window.confirm(`¿Borrar la plantilla "${p.name}"?`)) return;
    try {
      await api.delete(`/whatsapp-inbox/plantillas/${encodeURIComponent(p.name)}?businessId=${businessId}`);
      cargar();
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo borrar');
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-bold text-slate-800">Plantillas</p>
          <p className="text-[11.5px] text-slate-400 leading-relaxed max-w-md mt-0.5">
            WhatsApp solo deja escribirle a un cliente dentro de las 24 horas siguientes a su
            último mensaje. Pasado ese tiempo, una plantilla aprobada es la única forma de
            avisarle que su pedido salió.
          </p>
        </div>
        {!creando && (
          <button
            onClick={() => { setCreando(true); setAviso(''); }}
            className="shrink-0 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-colors"
          >
            Nueva plantilla
          </button>
        )}
      </div>

      {error && (
        <p className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}
      {aviso && (
        <p className="mb-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{aviso}</p>
      )}

      {creando && (
        <form onSubmit={crear} className="mb-5 p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre</label>
            <input
              value={nombre}
              /* Meta solo acepta minúsculas, números y guion bajo, y cuando no
                 se cumple devuelve un error que no lo dice. Se corrige mientras
                 escribe en vez de rechazarlo después. */
              onChange={(e) => setNombre(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              placeholder="pedido_en_camino"
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Mensaje</label>
            <textarea
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              rows={3}
              placeholder="Hola {{1}}, tu pedido {{2}} ya va en camino."
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Usa <code>{'{{1}}'}</code>, <code>{'{{2}}'}</code>… para lo que cambia en cada envío.
              {variables.length > 0 && ` Detectamos ${variables.length}.`}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="UTILITY">Aviso sobre un pedido</option>
              <option value="MARKETING">Promoción</option>
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Meta aprueba más rápido los avisos sobre pedidos que las promociones.
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={guardando}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 text-white text-xs font-bold transition-colors"
            >
              {guardando ? 'Enviando…' : 'Enviar a revisión'}
            </button>
            <button
              type="button"
              onClick={() => { setCreando(false); setError(''); }}
              className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {cargando ? (
        <div className="py-10 text-center text-slate-300"><FaSpinner className="animate-spin mx-auto" /></div>
      ) : plantillas.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          Todavía no tienes plantillas.
        </p>
      ) : (
        <ul className="space-y-2">
          {plantillas.map((p) => {
            const e = ESTADO_PLANTILLA[p.status] || { texto: p.status, clase: 'bg-slate-100 text-slate-500' };
            return (
              <li key={p.id || p.name} className="border border-slate-200 rounded-xl px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-700 truncate">{p.name}</span>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${e.clase}`}>{e.texto}</span>
                </div>
                {p.cuerpo && <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{p.cuerpo}</p>}
                {/* El motivo de Meta se muestra tal cual: es la única pista para corregirla. */}
                {p.motivoRechazo && (
                  <p className="text-[11px] text-red-600 mt-1.5">Motivo: {p.motivoRechazo}</p>
                )}
                <button
                  onClick={() => borrar(p)}
                  className="text-[11px] text-slate-400 hover:text-red-500 mt-2 font-medium transition-colors"
                >
                  Borrar
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ── Complemento no contratado ── */
function OfertaComplemento() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-8 max-w-lg mx-auto text-center">
      <span className="w-14 h-14 rounded-2xl bg-emerald-500 text-white grid place-items-center mx-auto mb-4 text-2xl">
        <FaWhatsapp />
      </span>
      <h2 className="text-lg font-bold text-slate-800">WhatsApp del negocio</h2>
      <p className="text-sm text-slate-500 mt-2 leading-relaxed">
        Conecta el número propio de tu negocio y atiende todos sus chats desde acá,
        sin cambiar de aplicación y sin que nadie tenga que prestarte el celular.
      </p>
      <ul className="text-sm text-slate-600 text-left mt-5 space-y-2">
        {[
          'Los mensajes de tus clientes llegan al panel',
          'Respondes desde el mismo lugar donde ves los pedidos',
          'Queda el historial completo de cada cliente',
        ].map((t) => (
          <li key={t} className="flex items-start gap-2">
            <FaCheck className="text-emerald-500 mt-1 shrink-0 text-xs" /> {t}
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-400 mt-6">
        Es un complemento que se contrata aparte de tu plan. Escríbenos para activarlo.
      </p>
    </div>
  );
}

/* ── Conectar el número ── */
function ConectarNumero({ businessId, cuenta, onConectado }) {
  const [phoneNumberId, setPhoneNumberId] = useState(cuenta?.phoneNumberId || '');
  const [wabaId, setWabaId] = useState(cuenta?.wabaId || '');
  const [token, setToken] = useState('');
  const [verToken, setVerToken] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  /* Lo manual queda plegado a propósito: pedirle a un dueño de restaurante tres
     identificadores de Meta es cómo se pierde una conexión. El camino de un
     toque va primero y este queda para cuando algo falle. */
  const [verManual, setVerManual] = useState(false);
  const [pidiendoEnlace, setPidiendoEnlace] = useState(false);

  async function conectarConMeta() {
    setPidiendoEnlace(true);
    setError('');
    try {
      const { data } = await api.get(`/whatsapp-inbox/oauth/enlace?businessId=${businessId}`);
      // Se sale del panel: Meta pide la sesión de Facebook del dueño.
      window.location.href = data.enlace;
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo abrir la conexión con Meta');
      setPidiendoEnlace(false);
      setVerManual(true);   // si falla, al menos queda el camino manual a la vista
    }
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true); setError(''); setAviso('');
    try {
      const { data } = await api.post('/whatsapp-inbox/account', {
        businessId,
        phoneNumberId: phoneNumberId.trim(),
        wabaId: wabaId.trim(),
        accessToken: token.trim(),
      });
      if (data.warning) setAviso(data.warning);
      else await onConectado();
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo conectar');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <span className="w-10 h-10 rounded-xl bg-emerald-500 text-white grid place-items-center">
          <FaPlug />
        </span>
        <div>
          <h2 className="text-base font-bold text-slate-800">Conecta tu WhatsApp</h2>
          <p className="text-xs text-slate-400">Tus clientes te escriben a tu número de siempre y tú respondes desde acá.</p>
        </div>
      </div>

      {error && <p className="mb-4 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      {aviso && <p className="mb-4 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{aviso}</p>}

      {/* El camino de un toque. Antes solo estaba el manual, que pide tres
          identificadores de la consola de Meta: eso no lo hace un dueño de
          restaurante, lo termina haciendo el equipo por cada cliente. */}
      <button
        onClick={conectarConMeta}
        disabled={pidiendoEnlace}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#1877F2] hover:bg-[#166fe0] disabled:bg-slate-200 text-white font-bold text-sm transition-colors active:scale-[0.98]"
      >
        {pidiendoEnlace ? <><FaSpinner className="animate-spin" /> Abriendo…</> : 'Conectar con Facebook'}
      </button>
      <p className="text-[11.5px] text-slate-400 mt-2 leading-relaxed">
        Te lleva a Meta para que autorices tu número. Vuelves acá conectado, sin
        copiar ni pegar nada.
      </p>

      {!verManual && (
        <button
          onClick={() => setVerManual(true)}
          className="w-full mt-4 pt-3 border-t border-slate-100 text-[11.5px] text-slate-400 hover:text-slate-600 transition-colors"
        >
          ¿Ya tienes los datos de Meta? Conectar a mano
        </button>
      )}

      {/* `autoComplete="off"` en el formulario y nombres que no suenan a
          credenciales: Chrome estaba rellenando el correo del usuario y una
          contraseña guardada en estos campos, porque veía un formulario con un
          input de tipo password. */}
      <form onSubmit={guardar} className={`space-y-4 ${verManual ? 'mt-5 pt-5 border-t border-slate-100' : 'hidden'}`} autoComplete="off">
        <p className="text-[11.5px] text-slate-400 -mb-1">
          Estos tres datos salen de tu cuenta de WhatsApp Business en Meta.
        </p>
        <Campo
          label="Identificador del número"
          hint="Meta lo llama Phone number ID"
          name="wa-phone-number-id"
          inputMode="numeric"
          value={phoneNumberId}
          onChange={setPhoneNumberId}
          required
        />
        <Campo
          label="Identificador de la cuenta"
          hint="WhatsApp Business Account ID — hace falta para autorizarnos a recibir tus mensajes"
          name="wa-account-id"
          inputMode="numeric"
          value={wabaId}
          onChange={setWabaId}
        />
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Token de acceso</label>
          <div className="relative">
            <input
              /* `new-password` es lo único que Chrome respeta de verdad para no
                 ofrecer contraseñas guardadas en un campo enmascarado. */
              type={verToken ? 'text' : 'password'}
              name="wa-access-token"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              placeholder={cuenta?.tokenHint ? `Actual: ${cuenta.tokenHint}` : ''}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
            />
            <button
              type="button"
              onClick={() => setVerToken((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {verToken ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Se guarda cifrado. Usa un token permanente: los temporales caducan en 24 horas.
          </p>
        </div>

        <button
          type="submit"
          disabled={guardando}
          className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
        >
          {guardando ? <><FaSpinner className="animate-spin" /> Comprobando con Meta…</> : 'Conectar'}
        </button>
      </form>
    </div>
  );
}

function Campo({ label, hint, name, inputMode, value, onChange, required }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <input
        name={name}
        inputMode={inputMode}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
      />
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}
