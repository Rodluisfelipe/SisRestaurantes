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
  FaFileAlt, FaMicrophone, FaVideo, FaArrowLeft, FaSyncAlt
} from 'react-icons/fa';
import api from '../../services/api';

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
  const finRef = useRef(null);

  // ── Carga inicial ──
  const cargarCuenta = useCallback(async () => {
    try {
      const { data } = await api.get('/whatsapp-inbox/account');
      setCuenta(data.account);
      setSinComplemento(false);
      return true;
    } catch (e) {
      if (e?.response?.status === 402) { setSinComplemento(true); return false; }
      setError(e?.response?.data?.message || 'No se pudo cargar la configuración');
      return false;
    }
  }, []);

  const cargarChats = useCallback(async () => {
    try {
      const { data } = await api.get('/whatsapp-inbox/chats');
      setChats(data.chats || []);
    } catch (e) {
      if (e?.response?.status !== 402) {
        setError(e?.response?.data?.message || 'No se pudieron cargar los chats');
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      const ok = await cargarCuenta();
      if (ok) await cargarChats();
      setCargando(false);
    })();
  }, [cargarCuenta, cargarChats]);

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
    if (!silencioso) { setCargandoChat(true); setChatActivo(telefono); }
    try {
      const { data } = await api.get(`/whatsapp-inbox/chats/${telefono}`);
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

  async function enviar(e) {
    e?.preventDefault();
    const texto = borrador.trim();
    if (!texto || enviando || !chatActivo) return;

    setEnviando(true);
    setError('');
    try {
      const { data } = await api.post(`/whatsapp-inbox/chats/${chatActivo}`, { text: texto });
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

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <FaSpinner className="animate-spin mr-2" /> Cargando…
      </div>
    );
  }

  // ── Número aún sin conectar ──
  if (!cuenta || cuenta.status !== 'active') {
    return <ConectarNumero cuenta={cuenta} onConectado={async () => {
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

      {error && (
        <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 text-xs text-red-600 flex items-start gap-2">
          <FaExclamationTriangle className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 font-bold">×</button>
        </div>
      )}

      <div className="grid lg:grid-cols-[300px_1fr] min-h-[520px]">
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
            <div className="flex-1 grid place-items-center text-slate-300 p-8">
              <div className="text-center">
                <FaWhatsapp className="mx-auto text-4xl mb-2 opacity-30" />
                <p className="text-sm">Elige una conversación</p>
              </div>
            </div>
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
function ConectarNumero({ cuenta, onConectado }) {
  const [phoneNumberId, setPhoneNumberId] = useState(cuenta?.phoneNumberId || '');
  const [wabaId, setWabaId] = useState(cuenta?.wabaId || '');
  const [token, setToken] = useState('');
  const [verToken, setVerToken] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true); setError(''); setAviso('');
    try {
      const { data } = await api.post('/whatsapp-inbox/account', {
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
          <h2 className="text-base font-bold text-slate-800">Conecta tu número</h2>
          <p className="text-xs text-slate-400">Estos datos salen de tu cuenta de WhatsApp Business en Meta.</p>
        </div>
      </div>

      {error && <p className="mb-4 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      {aviso && <p className="mb-4 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{aviso}</p>}

      <form onSubmit={guardar} className="space-y-4">
        <Campo
          label="Identificador del número"
          hint="Meta lo llama Phone number ID"
          value={phoneNumberId}
          onChange={setPhoneNumberId}
          required
        />
        <Campo
          label="Identificador de la cuenta"
          hint="WhatsApp Business Account ID — hace falta para autorizarnos a recibir tus mensajes"
          value={wabaId}
          onChange={setWabaId}
        />
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Token de acceso</label>
          <div className="relative">
            <input
              type={verToken ? 'text' : 'password'}
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

function Campo({ label, hint, value, onChange, required }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
      />
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}
