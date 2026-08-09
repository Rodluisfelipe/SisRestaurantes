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
  FaFileAlt, FaMicrophone, FaVideo, FaArrowLeft, FaArrowDown, FaSyncAlt,
  FaUser, FaShoppingBag, FaGift, FaHome, FaClock, FaUserPlus, FaSearch,
  FaUtensils, FaMotorcycle, FaRegSmile
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

/* ── Buscar y filtrar la lista ── */

/* Lo que de verdad se busca en una bandeja de restaurante: a quién le falta
   respuesta, quién ya tiene un pedido andando, y a quién dejó colgado el bot. */
const COINCIDE = {
  todos: () => true,
  sin_responder: (c) => !!c.esperandoRespuesta,
  con_pedido: (c) => !!c.agente?.orderNumber,
  humano: (c) => c.agente?.estado === 'con_humano',
};

const FILTROS = [
  { id: 'todos', txt: 'Todos' },
  { id: 'sin_responder', txt: 'Sin responder' },
  { id: 'con_pedido', txt: 'Con pedido' },
  { id: 'humano', txt: 'Lo tomó alguien' },
];

/* Sin tildes y en minúscula: nadie escribe "Andrés" con tilde en un buscador. */
const plano = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '');

function filtrarChats(chats, busqueda, filtro) {
  const q = plano(busqueda).trim();
  const pasaFiltro = COINCIDE[filtro] || COINCIDE.todos;
  return chats.filter((c) => {
    if (!pasaFiltro(c)) return false;
    if (!q) return true;
    // El teléfono se busca solo por dígitos: da igual cómo esté formateado.
    const soloDigitos = String(c.contactPhone || '').replace(/\D/g, '');
    return (
      plano(c.contactName).includes(q)
      || soloDigitos.includes(q.replace(/\D/g, ''))
      || plano(c.lastText).includes(q)
    );
  });
}

/* ── Los mensajes ── */

function cambioDeDia(anterior, actual) {
  if (!anterior) return true;
  return new Date(anterior.sentAt).toDateString() !== new Date(actual.sentAt).toDateString();
}

function SeparadorDia({ fecha }) {
  const d = new Date(fecha);
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);

  let texto;
  if (d.toDateString() === hoy.toDateString()) texto = 'Hoy';
  else if (d.toDateString() === ayer.toDateString()) texto = 'Ayer';
  else texto = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });

  /* Pegado arriba: al recorrer un chat largo siempre se ve en qué día se está,
     sin tener que volver a subir hasta el separador. */
  return (
    <div className="sticky top-0 z-10 flex justify-center py-2 pointer-events-none">
      <span className="px-3 py-1 rounded-full bg-white/95 backdrop-blur border border-slate-200/80 text-[11px] font-bold text-slate-500 capitalize shadow-sm">
        {texto}
      </span>
    </div>
  );
}

/* Un mensaje muy largo —a alguien le pasa: pega un documento entero— dejaba la
   conversación imposible de recorrer. Se corta y se abre si de verdad se quiere
   leer. */
const LARGO_MAXIMO = 600;

function Burbuja({ mensaje: m, pegado }) {
  const [abierto, setAbierto] = useState(false);
  const mio = m.direction === 'out';
  const Icono = ICONO_TIPO[m.type];
  const largo = (m.text || '').length > LARGO_MAXIMO;
  const texto = largo && !abierto ? `${m.text.slice(0, LARGO_MAXIMO)}…` : m.text;

  /* La esquina en punta solo la lleva el primero del grupo: es lo que hace que
     varios mensajes seguidos se lean como un bloque y no como una escalera. */
  const esquina = pegado
    ? 'rounded-2xl'
    : mio ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-bl-md';

  return (
    <div className={`flex ${mio ? 'justify-end' : 'justify-start'} ${pegado ? 'mt-0.5' : 'mt-2.5'}`}>
      <div
        className={`max-w-[85%] sm:max-w-[75%] px-3.5 py-2 shadow-sm ${esquina} ${
          mio
            ? 'bg-[#d9fdd3] text-slate-800'
            : 'bg-white border border-slate-200/70 text-slate-700'
        }`}
      >
        {Icono && (
          <p className={`text-[11.5px] mb-1 flex items-center gap-1.5 font-semibold ${mio ? 'text-emerald-700' : 'text-slate-400'}`}>
            <Icono /> {m.type === 'location' ? 'Ubicación' : 'Archivo adjunto'}
          </p>
        )}
        {texto && <p className="text-[14.5px] leading-[1.45] whitespace-pre-wrap break-words">{texto}</p>}
        {largo && (
          <button
            onClick={() => setAbierto((v) => !v)}
            className={`text-[11.5px] font-bold mt-1 ${mio ? 'text-emerald-700 hover:text-emerald-800' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {abierto ? 'Ver menos' : 'Ver mensaje completo'}
          </button>
        )}
        <div className={`flex items-center gap-1 justify-end -mb-0.5 mt-0.5 ${mio ? 'text-emerald-800/50' : 'text-slate-400/70'}`}>
          <span className="text-[10.5px]">
            {new Date(m.sentAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {mio && <EstadoMensaje estado={m.status} />}
        </div>
      </div>
    </div>
  );
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
  /* Un borrador por chat, no uno solo. Con uno compartido, lo que se escribía
     para un cliente quedaba en el cuadro al abrir otro: un mensaje enviado a
     quien no era. */
  const [borradores, setBorradores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [falloCarga, setFalloCarga] = useState(false);
  const [ficha, setFicha] = useState(null);
  const [cargandoFicha, setCargandoFicha] = useState(false);
  const [tomandoPedido, setTomandoPedido] = useState(false);
  const [reconectando, setReconectando] = useState(false);
  const [vista, setVista] = useState('chats');
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const scrollRef = useRef(null);
  const areaRef = useRef(null);
  const pegadoAbajo = useRef(true);
  const ultimoVisto = useRef(null);
  const [lejosDelFinal, setLejosDelFinal] = useState(false);

  const borrador = borradores[chatActivo] || '';
  const setBorrador = (texto) => {
    if (!chatActivo) return;
    setBorradores((prev) => ({ ...prev, [chatActivo]: texto }));
  };

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

  /* Bajar al final, pero solo cuando corresponde.
     Antes esto era un `scrollIntoView` sobre cada cambio de `mensajes`. Dos
     problemas: `scrollIntoView` arrastra a TODOS los contenedores con scroll,
     así que movía la página entera del panel; y el refresco de cada 15 segundos
     reemplaza el arreglo aunque no haya mensajes nuevos, así que el tirón se
     repetía solo, incluso mientras alguien estaba escribiendo. Ahora se mueve
     únicamente el contenedor de los mensajes, y solo si de verdad llegó algo
     nuevo y quien atiende ya estaba mirando el final. */
  useEffect(() => {
    const cont = scrollRef.current;
    if (!cont) return;
    const ultimo = mensajes[mensajes.length - 1];
    const id = ultimo ? (ultimo._id || ultimo.wamid) : null;
    if (id === ultimoVisto.current) return;

    const abriendo = ultimoVisto.current === null;
    ultimoVisto.current = id;

    if (abriendo || pegadoAbajo.current) {
      cont.scrollTo({ top: cont.scrollHeight, behavior: abriendo ? 'auto' : 'smooth' });
    } else {
      // Llegó algo y estaba leyendo más arriba: se avisa, no se le mueve la vista.
      setLejosDelFinal(true);
    }
  }, [mensajes]);

  /* El cuadro crece con lo que se escribe. Con `rows={1}` fijo, un mensaje de
     tres líneas se leía por una rendija con scroll propio. */
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [borrador, chatActivo]);

  function alDesplazar(e) {
    const el = e.currentTarget;
    const cerca = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    pegadoAbajo.current = cerca;
    if (cerca) setLejosDelFinal(false);
  }

  function bajarAlFinal() {
    const cont = scrollRef.current;
    if (!cont) return;
    cont.scrollTo({ top: cont.scrollHeight, behavior: 'smooth' });
    pegadoAbajo.current = true;
    setLejosDelFinal(false);
  }

  async function abrirChat(telefono, { silencioso = false } = {}) {
    if (!silencioso) {
      setCargandoChat(true);
      setChatActivo(telefono);
      setFicha(null);
      // Chat nuevo: la posición del anterior no sirve, hay que caer al final.
      ultimoVisto.current = null;
      pegadoAbajo.current = true;
      setLejosDelFinal(false);
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
      // Lo propio siempre baja: acaba de escribirlo, quiere verlo salir.
      pegadoAbajo.current = true;
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
  const sinLeerTotal = chats.reduce((n, c) => n + (c.sinLeer || 0), 0);
  const chatsVisibles = filtrarChats(chats, busqueda, filtro);

  return (
    /* Alto de pantalla, como un cliente de correo. Antes era una caja de 600px
       suelta en medio del panel: quedaba una conversación diminuta con el resto
       de la página vacía alrededor. */
    /* Los descuentos salen del armazón del panel: cabecera móvil + relleno +
       la barra inferior de navegación en celular; en escritorio, la cabecera
       fija y el relleno de 1.5rem. `min-h` evita que en una pantalla corta
       quede una rendija. */
    <div className="flex flex-col h-[calc(100dvh-12.5rem)] md:h-[calc(100dvh-14rem)] lg:h-[calc(100dvh-9rem)] min-h-[520px] bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 to-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-emerald-500 text-white grid place-items-center shrink-0 shadow-sm shadow-emerald-500/30 text-lg">
            <FaWhatsapp />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-slate-800 truncate leading-tight">
              WhatsApp del negocio
            </p>
            <p className="text-xs text-slate-500 truncate flex items-center gap-1.5">
              {/* El punto verde dice, sin leerlo, que el número está vivo. */}
              <span className={`w-1.5 h-1.5 rounded-full ${cuenta.lastError ? 'bg-red-500' : 'bg-emerald-500'}`} />
              {cuenta.displayNumber || cuenta.phoneNumberId}
              {cuenta.verifiedName ? ` · ${cuenta.verifiedName}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {sinLeerTotal > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[11px] font-bold">
              {sinLeerTotal} sin leer
            </span>
          )}
          <button
            onClick={() => { cargarChats(); if (chatActivo) abrirChat(chatActivo, { silencioso: true }); }}
            className="p-2.5 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
            title="Actualizar"
          >
            <FaSyncAlt className="text-sm" />
          </button>
        </div>
      </div>

      {/* Las plantillas viven acá y no en otra sección del menú: son parte de
          atender WhatsApp, y separarlas obliga a buscarlas cuando hacen falta. */}
      <div className="flex gap-1 border-b border-slate-100 px-3 shrink-0">
        {[
          { id: 'chats', txt: 'Conversaciones', icono: FaWhatsapp },
          { id: 'plantillas', txt: 'Plantillas', icono: FaFileAlt },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setVista(t.id)}
            className={`flex items-center gap-2 px-3.5 py-3 text-[13px] font-bold border-b-2 -mb-px transition-colors ${
              vista === t.id
                ? 'border-emerald-500 text-emerald-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <t.icono className="text-xs" /> {t.txt}
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

      {vista === 'plantillas' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <Plantillas businessId={businessId} />
        </div>
      )}

      {/* Tres columnas en pantalla ancha: lista, conversación y la ficha del
          cliente a la derecha. La ficha era una tira horizontal encima de los
          mensajes, y con dos pedidos en curso empujaba la conversación fuera de
          la vista. */}
      <div className={`grid lg:grid-cols-[336px_1fr] xl:grid-cols-[336px_1fr_312px] flex-1 min-h-0 ${vista === 'plantillas' ? 'hidden' : ''}`}>
        {/* Lista de chats */}
        <div className={`border-r border-slate-100 min-h-0 flex flex-col bg-slate-50/40 ${chatActivo ? 'hidden lg:flex' : 'flex'}`}>
          {/* Buscar y filtrar. Con veinte conversaciones, encontrar la de un
              cliente que llamó hace un rato era ir bajando y leyendo nombres. */}
          <div className="p-3 border-b border-slate-100 bg-white shrink-0 space-y-2.5">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o número…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 py-2.5 text-[13px] focus:outline-none focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/25 transition-colors"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 font-bold"
                >
                  ×
                </button>
              )}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {FILTROS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFiltro(f.id)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                    filtro === f.id
                      ? 'bg-slate-800 border-slate-800 text-white'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {f.txt}
                  {f.id !== 'todos' && (
                    <span className={filtro === f.id ? 'text-slate-300' : 'text-slate-400'}>
                      {' '}{chats.filter((c) => COINCIDE[f.id](c)).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {chats.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <FaWhatsapp className="mx-auto text-4xl mb-3 opacity-30" />
              <p className="text-sm font-semibold text-slate-500">Todavía no hay chats</p>
              <p className="text-xs mt-1 leading-relaxed">Cuando un cliente le escriba a tu número, aparecerá acá.</p>
            </div>
          ) : chatsVisibles.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold text-slate-500">Nada coincide</p>
              <p className="text-xs text-slate-400 mt-1">
                {busqueda ? `No hay chats con "${busqueda}".` : 'Ningún chat en este filtro.'}
              </p>
              <button
                onClick={() => { setBusqueda(''); setFiltro('todos'); }}
                className="mt-3 text-xs font-bold text-emerald-600 hover:text-emerald-700"
              >
                Ver todos
              </button>
            </div>
          ) : (
            <ul className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
              {chatsVisibles.map((c) => {
                const activo = c.contactPhone === chatActivo;
                const Icono = ICONO_TIPO[c.lastType];
                const sinLeer = c.sinLeer > 0;
                return (
                  <li key={c.contactPhone}>
                    <button
                      onClick={() => abrirChat(c.contactPhone)}
                      className={`w-full text-left p-2.5 rounded-xl flex gap-3 transition-all ${
                        activo
                          ? 'bg-white shadow-sm ring-1 ring-emerald-500/30'
                          : 'hover:bg-white hover:shadow-sm'
                      }`}
                    >
                      <Avatar nombre={c.contactName} telefono={c.contactPhone} punto={sinLeer} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className={`text-[14px] truncate ${sinLeer ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                            {c.contactName || telefonoLegible(c.contactPhone)}
                          </p>
                          <span className={`text-[10.5px] shrink-0 ${sinLeer ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                            {tiempoRelativo(c.lastAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className={`text-[12.5px] truncate flex items-center gap-1 ${sinLeer ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                            {c.lastDirection === 'out' && <span className="text-slate-300 shrink-0">Tú:</span>}
                            {Icono && <Icono className="text-[10px] shrink-0" />}
                            {c.lastText || (Icono ? 'Archivo adjunto' : '—')}
                          </p>
                          {sinLeer && (
                            <span className="shrink-0 min-w-[19px] h-[19px] px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold grid place-items-center">
                              {c.sinLeer}
                            </span>
                          )}
                        </div>
                        <Marcas chat={c} />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Conversación */}
        <div className={`flex flex-col min-h-0 ${chatActivo ? '' : 'hidden lg:flex'}`}>
          {!chatActivo ? (
            /* Con ningún chat abierto, el espacio se aprovecha para lo que el
               negocio no va a ir a buscar por su cuenta: qué canal le está
               trayendo pedidos. */
            <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50/40">
              <div className="px-5 pt-6 pb-2 text-center">
                <span className="w-12 h-12 rounded-2xl bg-white border border-slate-200 grid place-items-center mx-auto mb-3 text-slate-300 text-xl shadow-sm">
                  <FaWhatsapp />
                </span>
                <p className="text-[15px] font-bold text-slate-600">Elige una conversación</p>
                <p className="text-xs text-slate-400 mt-1">
                  Mientras tanto, mira qué canal te está trayendo pedidos.
                </p>
              </div>
              <div className="max-w-xl mx-auto w-full">
                <OrigenPedidos businessId={businessId} />
              </div>
            </div>
          ) : (
            <>
              {/* Con quién se está hablando, también en pantalla grande. Antes
                  esto solo salía en el celular: en el computador, si el cliente
                  era nuevo, no aparecía su número por ningún lado. */}
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 bg-white shrink-0">
                <button
                  onClick={() => setChatActivo(null)}
                  className="p-1.5 -ml-1.5 text-slate-500 hover:text-slate-700 lg:hidden"
                >
                  <FaArrowLeft className="text-sm" />
                </button>
                <Avatar nombre={chatSeleccionado?.contactName} telefono={chatActivo} grande />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold text-slate-800 truncate leading-tight">
                    {chatSeleccionado?.contactName || telefonoLegible(chatActivo)}
                  </p>
                  <p className="text-[11.5px] text-slate-400 truncate">
                    {telefonoLegible(chatActivo)}
                    {puedeResponder && <span className="text-emerald-600 font-semibold"> · ventana abierta</span>}
                  </p>
                </div>
                {/* En pantalla ancha este botón vive en la ficha de la derecha;
                    acá se repite porque esa columna no existe. */}
                <button
                  onClick={() => setTomandoPedido(true)}
                  className="xl:hidden flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors active:scale-95 shrink-0"
                >
                  <FaShoppingBag className="text-[10px]" /> Tomar pedido
                </button>
              </div>

              {/* Debajo de la cabecera solo en pantallas donde no cabe la
                  columna de la derecha. */}
              <div className="xl:hidden shrink-0 max-h-[38%] overflow-y-auto">
                <FichaCliente ficha={ficha} cargando={cargandoFicha} />
              </div>

              <div className="relative flex-1 min-h-0">
                <div
                  ref={scrollRef}
                  onScroll={alDesplazar}
                  className="h-full overflow-y-auto px-4 sm:px-6 py-4 bg-[#f2f0ea]"
                  /* El papel tramado de WhatsApp, dibujado con un degradado en
                     vez de una imagen: no suma una petición ni un archivo al
                     bundle, y sobre blanco liso las burbujas blancas no se
                     distinguían del fondo. */
                  style={{
                    backgroundImage:
                      'radial-gradient(circle at 1px 1px, rgba(15,23,42,0.045) 1px, transparent 0)',
                    backgroundSize: '22px 22px',
                  }}
                >
                  {cargandoChat ? (
                    <div className="grid place-items-center py-12 text-slate-300"><FaSpinner className="animate-spin text-xl" /></div>
                  ) : mensajes.length === 0 ? (
                    <div className="grid place-items-center h-full text-center px-6">
                      <div>
                        <FaWhatsapp className="mx-auto text-4xl text-slate-300 mb-3" />
                        <p className="text-sm font-semibold text-slate-500">Esta conversación está vacía</p>
                        <p className="text-xs text-slate-400 mt-1">Escribe abajo para empezar.</p>
                      </div>
                    </div>
                  ) : (
                    mensajes.map((m, i) => {
                      const previo = mensajes[i - 1];
                      const dia = cambioDeDia(previo, m);
                      // Mensajes seguidos del mismo lado se agrupan: menos aire
                      // muerto y se lee como un bloque, igual que en WhatsApp.
                      const pegado = !dia && previo && previo.direction === m.direction;
                      return (
                        <React.Fragment key={m._id || m.wamid}>
                          {/* Sin esto, un mensaje de ayer a las 6 y uno de hoy a
                              las 10 se leen seguidos y parecen la misma charla. */}
                          {dia && <SeparadorDia fecha={m.sentAt} />}
                          <Burbuja mensaje={m} pegado={pegado} />
                        </React.Fragment>
                      );
                    })
                  )}
                </div>

                {/* Llegó algo mientras leía más arriba. Se avisa acá en vez de
                    tirarle la vista al final, que es lo que hacía perder el
                    renglón que estaba leyendo. */}
                {lejosDelFinal && (
                  <button
                    onClick={bajarAlFinal}
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/90 hover:bg-slate-900 text-white text-[11px] font-bold shadow-lg backdrop-blur transition-colors"
                  >
                    <FaArrowDown className="text-[9px]" /> Mensajes nuevos
                  </button>
                )}
              </div>

              {/* Responder — o la razón por la que no se puede */}
              {puedeResponder ? (
                <div className="border-t border-slate-100 bg-white shrink-0">
                  {/* Lo que más se escribe en un restaurante, en un toque. Se
                      pone en el cuadro en vez de enviarse solo: casi siempre hay
                      que rematarlo con la hora o el valor del domicilio. */}
                  <RespuestasRapidas
                    slug={businessConfig?.slug}
                    nombre={ficha?.cliente?.name || chatSeleccionado?.contactName}
                    onElegir={(t) => { setBorrador(t); areaRef.current?.focus(); }}
                  />

                  <form onSubmit={enviar} className="px-3 pb-2.5">
                    <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1.5 transition-colors focus-within:border-emerald-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-400/25">
                      <textarea
                        ref={areaRef}
                        value={borrador}
                        onChange={(e) => setBorrador(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(e); }
                        }}
                        rows={1}
                        placeholder="Escribe tu respuesta…"
                        className="flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-relaxed text-slate-700 placeholder:text-slate-400 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!borrador.trim() || enviando}
                        title="Enviar"
                        className="w-10 h-10 mb-0.5 shrink-0 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:cursor-not-allowed text-white grid place-items-center transition-all active:scale-90 shadow-sm shadow-emerald-500/30 disabled:shadow-none"
                      >
                        {enviando ? <FaSpinner className="animate-spin text-sm" /> : <FaPaperPlane className="text-sm" />}
                      </button>
                    </div>
                    {/* Enter envía. Quien no lo sabe manda el mensaje a medias al
                        intentar bajar de renglón, y eso le llega al cliente. */}
                    <p className="text-[10.5px] text-slate-300 mt-1.5 px-1.5 hidden sm:block">
                      <kbd className="font-sans font-semibold text-slate-400">Enter</kbd> envía ·{' '}
                      <kbd className="font-sans font-semibold text-slate-400">Shift+Enter</kbd> salta de línea
                    </p>
                  </form>
                </div>
              ) : (
                <div className="p-4 border-t border-slate-100 bg-amber-50/70 shrink-0">
                  <p className="text-[13px] text-amber-800 flex items-start gap-2.5 max-w-2xl">
                    <FaLock className="mt-0.5 shrink-0 text-amber-500" />
                    <span className="leading-relaxed">
                      <strong>Pasaron más de 24 horas</strong> desde el último mensaje de este cliente.
                      WhatsApp solo permite retomar la conversación con una plantilla aprobada por Meta.
                      Si el cliente vuelve a escribir, se abre otra vez por 24 horas.
                    </span>
                  </p>
                  <button
                    onClick={() => setVista('plantillas')}
                    className="mt-2.5 ml-6 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors"
                  >
                    Ver mis plantillas
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Ficha del cliente — columna propia en pantalla ancha */}
        <aside className="hidden xl:flex flex-col min-h-0 border-l border-slate-100 bg-slate-50/50">
          {chatActivo ? (
            <FichaRail
              ficha={ficha}
              cargando={cargandoFicha}
              telefono={chatActivo}
              nombreChat={chatSeleccionado?.contactName}
              onTomarPedido={() => setTomandoPedido(true)}
            />
          ) : (
            <div className="p-6 text-center text-slate-400 grid place-items-center h-full">
              <div>
                <FaUser className="mx-auto text-2xl mb-2 opacity-30" />
                <p className="text-xs leading-relaxed">
                  Abre una conversación y acá verás quién es, qué ha pedido y si tiene algo en curso.
                </p>
              </div>
            </div>
          )}
        </aside>
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
 * Lo que un restaurante escribe veinte veces al día.
 *
 * No se envían solas: se ponen en el cuadro. Casi siempre hay que rematarlas
 * con la hora, el valor del domicilio o el nombre, y un botón que dispara el
 * mensaje tal cual termina mandando "tu pedido va en camino" a quien todavía
 * no ha pedido nada.
 */
function RespuestasRapidas({ slug, nombre, onElegir }) {
  const [abierto, setAbierto] = useState(false);
  const quien = (nombre || '').trim().split(' ')[0];
  const hola = quien ? `Hola ${quien}` : 'Hola';

  const opciones = [
    { icono: FaRegSmile, txt: 'Saludo', mensaje: `${hola}, ¡gracias por escribirnos! ¿En qué te ayudamos?` },
    slug && {
      icono: FaUtensils,
      txt: 'Enviar menú',
      mensaje: `${hola}, este es nuestro menú 🍔\nhttps://www.menuby.tech/${slug}?source=whatsapp`,
    },
    { icono: FaClock, txt: 'Ya lo preparamos', mensaje: 'Tu pedido ya está en preparación. Te avisamos apenas salga.' },
    { icono: FaMotorcycle, txt: 'Va en camino', mensaje: 'Tu pedido ya va en camino 🛵' },
    { icono: FaHome, txt: 'Pedir dirección', mensaje: '¿Me confirmas la dirección de entrega y un punto de referencia?' },
  ].filter(Boolean);

  return (
    <div className="px-3 pt-2.5">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setAbierto((v) => !v)}
          className="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          {abierto ? '× Ocultar' : '⚡ Respuestas rápidas'}
        </button>
        {abierto && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {opciones.map((o) => (
              <button
                key={o.txt}
                onClick={() => { onElegir(o.mensaje); setAbierto(false); }}
                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-[11.5px] font-semibold text-slate-600 hover:text-emerald-700 transition-colors"
              >
                <o.icono className="text-[10px]" /> {o.txt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * La ficha del cliente como columna propia, en pantalla ancha.
 *
 * Es la misma información que la tira de arriba, pero vertical: acá cabe entera
 * sin robarle alto a la conversación, que era el problema de tenerla encima de
 * los mensajes.
 */
function FichaRail({ ficha, cargando, telefono, nombreChat, onTomarPedido }) {
  if (cargando) {
    return <div className="p-6 text-center text-slate-300"><FaSpinner className="animate-spin mx-auto" /></div>;
  }

  const { cliente, fidelidad, pedidosEnCurso = [], ultimosPedidos = [], esConocido } = ficha || {};
  const nombre = cliente?.name || nombreChat;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="p-5 text-center border-b border-slate-100">
        <div className="flex justify-center mb-3">
          <Avatar nombre={nombre} telefono={telefono} enorme />
        </div>
        <p className="text-[15px] font-bold text-slate-800 truncate">
          {nombre || telefonoLegible(telefono)}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">{telefonoLegible(telefono)}</p>

        {ficha && !esConocido && (
          <span className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full bg-sky-100 text-sky-700 text-[11px] font-bold">
            <FaUserPlus className="text-[9px]" /> Cliente nuevo
          </span>
        )}

        <button
          onClick={onTomarPedido}
          className="w-full mt-4 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-3 py-2.5 rounded-xl text-[13px] font-bold transition-colors active:scale-[0.98]"
        >
          <FaShoppingBag className="text-[11px]" /> Tomar pedido
        </button>
      </div>

      {ficha && esConocido && (
        <>
          <div className="grid grid-cols-2 gap-px bg-slate-100 border-b border-slate-100">
            <Dato valor={cliente?.totalOrders || 0} etiqueta="pedidos" />
            <Dato valor={pesos(cliente?.totalSpent || 0)} etiqueta="gastado" />
            {fidelidad?.points > 0 && (
              <Dato valor={fidelidad.points} etiqueta="puntos" resalta />
            )}
            {fidelidad?.currentTier && (
              <Dato valor={fidelidad.currentTier} etiqueta="nivel" resalta />
            )}
          </div>

          {cliente?.address && (
            <div className="px-5 py-3.5 border-b border-slate-100">
              <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wide mb-1">Dirección</p>
              <p className="text-[13px] text-slate-600 leading-relaxed flex items-start gap-2">
                <FaHome className="text-slate-300 mt-0.5 shrink-0 text-[11px]" />
                {cliente.address}
              </p>
            </div>
          )}

          {/* Un pedido en curso es lo primero que hay que saber al contestar */}
          {pedidosEnCurso.length > 0 && (
            <div className="px-5 py-3.5 border-b border-slate-100">
              <p className="text-[10.5px] font-bold text-amber-600 uppercase tracking-wide mb-2">En curso</p>
              <div className="space-y-1.5">
                {pedidosEnCurso.map((p) => (
                  <div key={p._id} className="bg-amber-50 border border-amber-200/70 rounded-xl px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-bold text-amber-800">#{p.orderNumber}</span>
                      <span className="text-[13px] font-bold text-amber-700">{pesos(p.total)}</span>
                    </div>
                    <p className="text-[11.5px] text-amber-600 mt-0.5">{ESTADO_PEDIDO[p.status] || p.status}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ultimosPedidos.length > 0 && (
            <div className="px-5 py-3.5">
              <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wide mb-2">
                Últimos pedidos
              </p>
              <ul className="space-y-1.5">
                {ultimosPedidos.map((p) => (
                  <li key={p._id} className="bg-white border border-slate-200/70 rounded-xl px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-bold text-slate-600">#{p.orderNumber}</span>
                      <span className="text-[10.5px] text-slate-400">
                        {new Date(p.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                      </span>
                      <span className="text-[12.5px] font-bold text-slate-600 ml-auto">{pesos(p.total)}</span>
                    </div>
                    {p.items?.length > 0 && (
                      <p className="text-slate-400 text-[11.5px] mt-1 leading-snug">
                        {p.items.join(', ')}{p.masItems > 0 ? ` y ${p.masItems} más` : ''}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Dato({ valor, etiqueta, resalta }) {
  return (
    <div className="bg-slate-50/60 px-3 py-3 text-center">
      <p className={`text-[15px] font-bold truncate ${resalta ? 'text-amber-600' : 'text-slate-700'}`}>{valor}</p>
      <p className="text-[10.5px] text-slate-400 uppercase tracking-wide mt-0.5">{etiqueta}</p>
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
function FichaCliente({ ficha, cargando }) {
  if (cargando) {
    return (
      <div className="p-4 border-b border-slate-100 bg-slate-50/60 text-center text-slate-300">
        <FaSpinner className="animate-spin mx-auto" />
      </div>
    );
  }
  if (!ficha) return null;

  const { cliente, fidelidad, pedidosEnCurso = [], ultimosPedidos = [], esConocido } = ficha;

  /* El botón de tomar pedido vive en la cabecera del chat, no acá: tenerlo en
     los dos sitios dejaba dos botones idénticos a dos centímetros. */

  // Cliente nuevo: se dice, porque cambia cómo se le contesta.
  if (!esConocido) {
    return (
      <div className="px-4 py-2.5 border-b border-slate-100 bg-sky-50/70 flex items-center gap-2.5">
        <FaUserPlus className="text-sky-500 shrink-0 text-xs" />
        <p className="text-[12.5px] text-sky-700 flex-1">
          <strong>Cliente nuevo.</strong> No tiene pedidos anteriores en tu negocio.
        </p>
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

  /* "Contestado" ya no se pinta: era una etiqueta gris en casi todas las filas
     —o sea, ruido en veinte chats— y no decía nada que no dijera la ausencia de
     "Sin responder". */
  if (chat.esperandoRespuesta) {
    marcas.push({ txt: 'Sin responder', clase: 'bg-amber-100 text-amber-700' });
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

  if (marcas.length === 0) return null;

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

/* La inicial en un círculo. Con solo texto, veinte filas de nombres se leen
   como un párrafo; el círculo da dónde apoyar la vista al recorrer la lista. */
const COLORES_AVATAR = [
  'bg-emerald-100 text-emerald-700', 'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700', 'bg-teal-100 text-teal-700',
];

function Avatar({ nombre, telefono, grande, enorme, punto }) {
  const base = (nombre || '').trim();
  const inicial = base ? base[0].toUpperCase() : '#';
  // El color sale del teléfono: el mismo contacto se ve igual siempre.
  const suma = String(telefono || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const color = COLORES_AVATAR[suma % COLORES_AVATAR.length];
  const tam = enorme ? 'w-16 h-16 text-2xl' : grande ? 'w-10 h-10 text-base' : 'w-11 h-11 text-[15px]';

  return (
    <span className="relative shrink-0">
      <span className={`${tam} rounded-full grid place-items-center font-bold ${color}`}>
        {inicial}
      </span>
      {punto && (
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white" />
      )}
    </span>
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
