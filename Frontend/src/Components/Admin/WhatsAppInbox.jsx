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
  FaUtensils, FaMotorcycle, FaRegSmile, FaSignOutAlt, FaExpand, FaPaperclip, FaRobot
} from 'react-icons/fa';
import api from '../../services/api';
import { socket, joinBusiness } from '../../services/socket';
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

function Filtros({ chats, filtro, setFiltro }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 min-w-0">
      {FILTROS.map((f) => (
        <button
          key={f.id}
          onClick={() => setFiltro(f.id)}
          className={`shrink-0 px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors ${
            filtro === f.id
              ? 'bg-[#d9fdd3] text-[#027d69]'
              : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
          }`}
        >
          {f.txt}
          {f.id !== 'todos' && (
            <span className="opacity-60">
              {' '}{chats.filter((c) => COINCIDE[f.id](c)).length}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

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

/**
 * El archivo que mandó un cliente.
 *
 * No se puede poner la dirección de Meta en un `<img>`: es temporal y exige el
 * token del negocio. Así que se pide al backend, que lo trae y lo entrega, y
 * acá se convierte en una dirección local del navegador.
 *
 * Se baja solo cuando la burbuja aparece en pantalla. Con un chat de doscientos
 * mensajes, cargarlos todos al abrirlo son doscientas descargas para ver tres.
 */
function Adjunto({ mensaje: m, businessId }) {
  const [url, setUrl] = useState(null);
  const [estado, setEstado] = useState('espera');   // espera | cargando | listo | error
  const cajaRef = useRef(null);
  const urlRef = useRef(null);

  useEffect(() => {
    const caja = cajaRef.current;
    if (!caja || estado !== 'espera') return undefined;
    const observador = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) {
        setEstado('cargando');
        observador.disconnect();
      }
    }, { rootMargin: '200px' });
    observador.observe(caja);
    return () => observador.disconnect();
  }, [estado]);

  useEffect(() => {
    if (estado !== 'cargando') return undefined;
    let vivo = true;
    api.get(`/whatsapp-inbox/media/${m.mediaId}?businessId=${businessId}`, { responseType: 'blob' })
      .then(({ data }) => {
        if (!vivo) return;
        const creada = URL.createObjectURL(data);
        urlRef.current = creada;
        setUrl(creada);
        setEstado('listo');
      })
      .catch(() => { if (vivo) setEstado('error'); });
    return () => { vivo = false; };
  }, [estado, m.mediaId, businessId]);

  /* La dirección se libera SOLO al desmontar.
     Estaba en la limpieza del efecto de arriba, y ahí se rompía: ese efecto
     depende de `estado`, así que al pasar a 'listo' se volvía a ejecutar, su
     limpieza revocaba la dirección recién creada, y la imagen fallaba con
     ERR_FILE_NOT_FOUND antes de alcanzar a pintarse. */
  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const Icono = ICONO_TIPO[m.type] || FaFileAlt;

  if (estado === 'error') {
    return (
      <p className="text-[12.5px] text-slate-400 flex items-center gap-2 py-1">
        <Icono /> El archivo ya no está disponible
      </p>
    );
  }

  if (estado !== 'listo') {
    return (
      <div ref={cajaRef} className="w-52 h-32 rounded-lg bg-black/5 grid place-items-center text-slate-400">
        <FaSpinner className="animate-spin" />
      </div>
    );
  }

  if (m.type === 'image' || m.type === 'sticker') {
    return (
      <a href={url} target="_blank" rel="noreferrer" title="Abrir en grande">
        <img
          src={url}
          alt={m.text || 'Foto'}
          className={`rounded-lg max-w-full ${m.type === 'sticker' ? 'w-32' : 'max-h-80'}`}
        />
      </a>
    );
  }
  if (m.type === 'video') {
    return <video src={url} controls className="rounded-lg max-w-full max-h-80" />;
  }
  if (m.type === 'audio') {
    return <audio src={url} controls className="w-60 max-w-full" />;
  }

  return (
    <a
      href={url}
      download={m.text || 'archivo'}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-black/5 hover:bg-black/10 transition-colors"
    >
      <FaFileAlt className="text-slate-500 shrink-0" />
      <span className="text-[13px] text-slate-700 truncate">{m.text || 'Descargar archivo'}</span>
    </a>
  );
}

/* Un mensaje muy largo —a alguien le pasa: pega un documento entero— dejaba la
   conversación imposible de recorrer. Se corta y se abre si de verdad se quiere
   leer. */
const LARGO_MAXIMO = 600;

function Burbuja({ mensaje: m, pegado, businessId }) {
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

  /* Los stickers van sin globo, como en WhatsApp: son recortes con fondo
     transparente, y meterlos en una caja verde deja un cuadro alrededor del
     dibujo que se ve como un error. */
  const desnudo = m.type === 'sticker';

  return (
    <div className={`flex ${mio ? 'justify-end' : 'justify-start'} ${pegado ? 'mt-0.5' : 'mt-2.5'}`}>
      <div
        className={desnudo
          ? 'max-w-[60%]'
          : `max-w-[85%] sm:max-w-[75%] px-3.5 py-2 shadow-sm ${esquina} ${
            mio
              ? 'bg-[#d9fdd3] text-slate-800'
              : 'bg-white border border-slate-200/70 text-slate-700'
          }`}
      >
        {/* El archivo se pinta; solo la ubicación queda como etiqueta, porque
            no es un archivo que se pueda bajar. */}
        {m.mediaId ? (
          <div className={desnudo ? '' : 'mb-1'}><Adjunto mensaje={m} businessId={businessId} /></div>
        ) : m.type === 'unsupported' ? (
          /* Meta a veces no entrega el contenido y solo avisa. Se dice, con su
             motivo: una burbuja muda parece un fallo nuestro. */
          <p className="text-[13px] italic text-slate-400 flex items-start gap-1.5">
            <FaExclamationTriangle className="mt-0.5 shrink-0 text-[11px]" />
            <span>
              WhatsApp no entregó este mensaje
              {m.errorMessage ? <span className="not-italic"> — {m.errorMessage}</span> : null}
            </span>
          </p>
        ) : Icono && (
          <p className={`text-[11.5px] mb-1 flex items-center gap-1.5 font-semibold ${mio ? 'text-emerald-700' : 'text-slate-400'}`}>
            <Icono /> {m.type === 'location' ? 'Ubicación' : 'Archivo adjunto'}
          </p>
        )}
        {texto && <p className="text-[14.5px] leading-[1.45] whitespace-pre-wrap break-words">{texto}</p>}

        {/* Lo que dijo la nota de voz. Se marca como transcripción y no se
            pinta como si el cliente lo hubiera escrito: la máquina se equivoca,
            y quien atiende tiene que saber que puede estar leyendo un error. */}
        {m.transcripcion && (
          <p className="text-[13.5px] italic leading-snug text-slate-500 mt-1.5 pl-2 border-l-2 border-slate-300">
            {m.transcripcion}
          </p>
        )}
        {largo && (
          <button
            onClick={() => setAbierto((v) => !v)}
            className={`text-[11.5px] font-bold mt-1 ${mio ? 'text-emerald-700 hover:text-emerald-800' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {abierto ? 'Ver menos' : 'Ver mensaje completo'}
          </button>
        )}
        <div className={`flex items-center gap-1 justify-end -mb-0.5 mt-0.5 ${
          desnudo ? 'text-slate-500' : mio ? 'text-emerald-800/50' : 'text-slate-400/70'
        }`}>
          <span className="text-[10.5px]">
            {new Date(m.sentAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {mio && <EstadoMensaje estado={m.status} />}
        </div>
      </div>
    </div>
  );
}

export default function WhatsAppInbox({ pleno = false, onSalir, onVerPerfil }) {
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
  const [subiendo, setSubiendo] = useState(false);
  const [reactivandoBot, setReactivandoBot] = useState(false);
  const [error, setError] = useState('');
  const [falloCarga, setFalloCarga] = useState(false);
  const [ficha, setFicha] = useState(null);
  const [cargandoFicha, setCargandoFicha] = useState(false);
  const [tomandoPedido, setTomandoPedido] = useState(false);
  const [reconectando, setReconectando] = useState(false);
  const [vista, setVista] = useState('chats');
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todos');
  /* La ficha del cliente arranca cerrada, como el panel de contacto de
     WhatsApp Web: al atender lo que importa es la conversación, y esa columna
     le quitaba un tercio de ancho todo el tiempo para algo que se mira de vez
     en cuando. Se recuerda la elección: a quien la quiere abierta, no se la
     cerramos en cada visita. */
  const [fichaAbierta, setFichaAbierta] = useState(
    () => localStorage.getItem('menuby.waFichaAbierta') === '1'
  );
  const alternarFicha = () => setFichaAbierta((v) => {
    localStorage.setItem('menuby.waFichaAbierta', v ? '0' : '1');
    return !v;
  });
  const scrollRef = useRef(null);
  const areaRef = useRef(null);
  const archivoRef = useRef(null);
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

  /* Los mensajes llegan por socket, no preguntando.
     El backend avisa cuando entra uno, cuando el agente contesta y cuando Meta
     confirma la entrega. Antes esto solo se refrescaba cada quince segundos:
     un cliente escribía y su mensaje podía pasar un cuarto de minuto sin que
     nadie lo viera. Se usa el mismo socket que ya tiene el panel para los
     pedidos, así que no suma una conexión por pantalla. */
  useEffect(() => {
    if (sinComplemento || !cuenta || !businessId) return undefined;

    if (!socket.connected) socket.connect();
    joinBusiness(businessId);

    const alLlegarMensaje = ({ contactPhone } = {}) => {
      cargarChats();
      // El chat abierto se recarga solo si el mensaje es de esa conversación.
      if (chatActivo && (!contactPhone || contactPhone === chatActivo)) {
        abrirChat(chatActivo, { silencioso: true });
      }
    };
    const alCambiarEstado = () => {
      if (chatActivo) abrirChat(chatActivo, { silencioso: true });
    };

    socket.on('whatsapp:mensaje', alLlegarMensaje);
    socket.on('whatsapp:estado', alCambiarEstado);

    /* Red de seguridad, mucho más espaciada: si el socket se cae o un aviso se
       pierde, la bandeja se pone al día sola en vez de quedarse congelada. */
    const t = setInterval(() => {
      cargarChats();
      if (chatActivo) abrirChat(chatActivo, { silencioso: true });
    }, 60000);

    return () => {
      socket.off('whatsapp:mensaje', alLlegarMensaje);
      socket.off('whatsapp:estado', alCambiarEstado);
      clearInterval(t);
    };
  }, [sinComplemento, cuenta, chatActivo, cargarChats, businessId]);

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

  /**
   * Mandar una foto o un archivo.
   *
   * El tope se comprueba acá y no solo en el servidor: subir 20 MB por una red
   * de restaurante para que lo rechacen al final es peor que no dejar empezar.
   */
  async function enviarArchivo(archivo) {
    if (!archivo || !chatActivo || subiendo) return;
    if (archivo.size > 16 * 1024 * 1024) {
      setError('El archivo pesa más de 16 MB. WhatsApp no lo acepta.');
      return;
    }

    setSubiendo(true);
    setError('');
    try {
      const cuerpo = new FormData();
      cuerpo.append('archivo', archivo);
      // Lo escrito en el cuadro viaja como pie de foto y se limpia al enviarse.
      if (borrador.trim()) cuerpo.append('caption', borrador.trim());

      const { data } = await api.post(`/whatsapp-inbox/chats/${chatActivo}/media?businessId=${businessId}`, cuerpo, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,   // el de siempre son 5s: no alcanza para subir nada
      });
      pegadoAbajo.current = true;
      setMensajes((prev) => [...prev, data.message]);
      setBorrador('');
      cargarChats();
    } catch (e) {
      const r = e?.response?.data;
      setError(r?.message || 'No se pudo enviar el archivo');
      if (r?.code === 'OUTSIDE_WINDOW') setPuedeResponder(false);
    } finally {
      setSubiendo(false);
    }
  }

  /**
   * Devolverle la conversación al bot.
   *
   * El backend, además de reactivarlo, le hace contestar lo que quedó
   * pendiente: si no, reactivar no producía nada visible y el cliente seguía
   * esperando hasta volver a escribir.
   */
  async function devolverAlBot() {
    if (!chatActivo || reactivandoBot) return;
    setReactivandoBot(true);
    setError('');
    try {
      await api.post(`/whatsapp-inbox/chats/${chatActivo}/retomar`, {
        businessId,
        devolverAlAgente: true,
      });
      await cargarChats();
      /* La respuesta del agente tarda unos segundos en llegar; el socket la
         traerá sola, pero se refresca ya para que el estado cambie al toque. */
      abrirChat(chatActivo, { silencioso: true });
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo devolver la conversación al bot');
    } finally {
      setReactivandoBot(false);
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
  const chatsVisibles = filtrarChats(chats, busqueda, filtro);

  const bandeja = (
    /* Alto de pantalla, como un cliente de correo. Antes era una caja de 600px
       suelta en medio del panel: quedaba una conversación diminuta con el resto
       de la página vacía alrededor. */
    /* En pantalla completa el contenedor ya trae el alto: se toma entero.
       Fuera de ahí hay que descontar el armazón del panel — cabecera móvil,
       relleno y la barra inferior en celular; en escritorio, la cabecera fija
       y el relleno de 1.5rem. `min-h` evita que en una pantalla corta quede
       una rendija. */
    <div className={`flex flex-col bg-white overflow-hidden h-full min-h-0 ${
      pleno ? 'shadow-2xl lg:rounded-lg' : ''
    }`}>
      {/* La franja de arriba, donde iba el título de la sección. Vacía no
          servía de nada; los filtros sí, y desde acá cruzan toda la pantalla
          en vez de apretarse en la columna de la izquierda. */}
      {!pleno && (
        <div className="hidden lg:flex items-center gap-3 px-4 h-[42px] bg-white border-b border-[#e9edef] shrink-0">
          <span className="text-[13px] font-bold text-slate-700 shrink-0">Chats de WhatsApp</span>
          <span className="w-px h-4 bg-slate-200 shrink-0" />
          <Filtros chats={chats} filtro={filtro} setFiltro={setFiltro} />
        </div>
      )}
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

      {/* Tres columnas, como WhatsApp Web: lista, conversación y —lo que él no
          tiene— la ficha del cliente a la derecha. */}
      <div className={`grid lg:grid-cols-[minmax(300px,30%)_1fr] flex-1 min-h-0 ${
        fichaAbierta ? 'xl:grid-cols-[minmax(300px,26%)_1fr_320px]' : ''
      }`}>
        {/* Lista de chats */}
        {/* En celular solo cabe una columna: con un chat abierto —o con las
            plantillas— la lista se aparta. */}
        <div className={`border-r border-[#e9edef] min-h-0 flex flex-col bg-white ${
          chatActivo || vista === 'plantillas' ? 'hidden lg:flex' : 'flex'
        }`}>
          {/* La cabecera del negocio va acá dentro y no cruzando toda la
              pantalla: es la barra de perfil de WhatsApp Web, y así la
              conversación empieza en el borde de arriba. */}
          <div className="flex items-center gap-2.5 px-4 py-2 bg-[#f0f2f5] shrink-0 h-[59px]">
            <span className="w-10 h-10 rounded-full bg-[#00a884] text-white grid place-items-center shrink-0 text-lg">
              <FaWhatsapp />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-[#111b21] truncate leading-tight">
                {cuenta.verifiedName || 'WhatsApp del negocio'}
              </p>
              <p className="text-[12px] text-[#667781] truncate flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${cuenta.lastError ? 'bg-red-500' : 'bg-[#00a884]'}`} />
                {cuenta.displayNumber || cuenta.phoneNumberId}
              </p>
            </div>

            <button
              onClick={() => setVista(vista === 'plantillas' ? 'chats' : 'plantillas')}
              title="Plantillas"
              className={`w-9 h-9 rounded-full grid place-items-center transition-colors ${
                vista === 'plantillas' ? 'bg-[#00a884] text-white' : 'text-[#54656f] hover:bg-black/5'
              }`}
            >
              <FaFileAlt className="text-[15px]" />
            </button>
            <button
              onClick={() => { cargarChats(); if (chatActivo) abrirChat(chatActivo, { silencioso: true }); }}
              title="Actualizar"
              className="w-9 h-9 rounded-full grid place-items-center text-[#54656f] hover:bg-black/5 transition-colors"
            >
              <FaSyncAlt className="text-[14px]" />
            </button>
            {onSalir ? (
              <button
                onClick={onSalir}
                title="Volver al panel"
                className="w-9 h-9 rounded-full grid place-items-center text-[#54656f] hover:bg-black/5 transition-colors"
              >
                <FaSignOutAlt className="text-[15px]" />
              </button>
            ) : (
              /* Dentro del panel: pasar a pantalla completa, que es la vista
                 pensada para dejar en una pestaña del navegador toda la
                 jornada. */
              businessConfig?.slug && (
                <a
                  href={`/${businessConfig.slug}/whatsapp`}
                  title="Abrir a pantalla completa"
                  className="w-9 h-9 rounded-full grid place-items-center text-[#54656f] hover:bg-black/5 transition-colors"
                >
                  <FaExpand className="text-[14px]" />
                </a>
              )
            )}
          </div>

          {/* Buscar y filtrar. Con veinte conversaciones, encontrar la de un
              cliente que llamó hace un rato era ir bajando y leyendo nombres. */}
          <div className="px-3 py-2 bg-white shrink-0 space-y-2 border-b border-[#e9edef]">
            <div className="relative">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#54656f] text-xs" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar un chat"
                className="w-full rounded-lg bg-[#f0f2f5] pl-11 pr-8 py-2 text-[14px] text-[#111b21] placeholder:text-[#667781] focus:outline-none focus:ring-1 focus:ring-[#00a884]/40"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#667781] hover:text-[#111b21] font-bold"
                >
                  ×
                </button>
              )}
            </div>
            {/* En el panel los filtros van arriba, cruzando la pantalla; acá
                solo aparecen a pantalla completa, donde no hay esa franja. */}
            {pleno && <Filtros chats={chats} filtro={filtro} setFiltro={setFiltro} />}
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
            /* Filas al ancho completo y separadas por una línea que arranca
               después del avatar — la lista de WhatsApp Web. */
            <ul className="flex-1 min-h-0 overflow-y-auto">
              {chatsVisibles.map((c) => {
                const activo = c.contactPhone === chatActivo;
                const Icono = ICONO_TIPO[c.lastType];
                const sinLeer = c.sinLeer > 0;
                return (
                  <li key={c.contactPhone}>
                    <button
                      onClick={() => abrirChat(c.contactPhone)}
                      className={`w-full text-left pl-4 pr-0 flex gap-3 transition-colors ${
                        activo ? 'bg-[#f0f2f5]' : 'hover:bg-[#f5f6f6]'
                      }`}
                    >
                      <div className="py-3">
                        <Avatar nombre={c.contactName} telefono={c.contactPhone} punto={sinLeer} />
                      </div>
                      <div className="min-w-0 flex-1 py-3 pr-4 border-b border-[#e9edef]">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-[16px] text-[#111b21] truncate leading-tight">
                            {c.contactName || telefonoLegible(c.contactPhone)}
                          </p>
                          <span className={`text-[12px] shrink-0 ${sinLeer ? 'text-[#00a884] font-medium' : 'text-[#667781]'}`}>
                            {tiempoRelativo(c.lastAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className={`text-[13.5px] truncate flex items-center gap-1 ${sinLeer ? 'text-[#111b21]' : 'text-[#667781]'}`}>
                            {c.lastDirection === 'out' && <span className="text-[#8696a0] shrink-0">Tú:</span>}
                            {Icono && <Icono className="text-[11px] shrink-0" />}
                            {c.lastText || (Icono ? 'Archivo adjunto' : '—')}
                          </p>
                          {sinLeer && (
                            <span className="shrink-0 min-w-[20px] h-[20px] px-1.5 rounded-full bg-[#00a884] text-white text-[11px] font-medium grid place-items-center">
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
        <div className={`flex flex-col min-h-0 ${chatActivo || vista === 'plantillas' ? '' : 'hidden lg:flex'}`}>
          {vista === 'plantillas' ? (
            /* Las plantillas ocupan el lado de la conversación, como los
               paneles de ajustes de WhatsApp Web: la lista se queda visible. */
            <>
              {/* En celular la lista está oculta, así que el botón de volver a
                  los chats tiene que estar acá o no hay salida. */}
              <div className="lg:hidden flex items-center gap-3 px-4 h-[59px] bg-[#f0f2f5] shrink-0">
                <button onClick={() => setVista('chats')} className="p-1.5 -ml-1.5 text-[#54656f]">
                  <FaArrowLeft className="text-sm" />
                </button>
                <p className="text-[16px] text-[#111b21]">Plantillas</p>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto bg-[#f0f2f5] border-l border-[#e9edef]">
                <Plantillas businessId={businessId} />
              </div>
            </>
          ) : !chatActivo ? (
            /* Con ningún chat abierto, el espacio se aprovecha para lo que el
               negocio no va a ir a buscar por su cuenta: qué canal le está
               trayendo pedidos. */
            <div className="flex-1 min-h-0 overflow-y-auto bg-[#f0f2f5] border-b-4 border-[#00a884]">
              <div className="px-5 pt-10 pb-2 text-center">
                <span className="w-16 h-16 rounded-full bg-[#e9edef] grid place-items-center mx-auto mb-4 text-[#54656f] text-3xl">
                  <FaWhatsapp />
                </span>
                <p className="text-[24px] font-light text-[#41525d]">Elige una conversación</p>
                <p className="text-[13px] text-[#667781] mt-2">
                  Mientras tanto, mira qué canal te está trayendo pedidos.
                </p>
              </div>
              <div className="max-w-xl mx-auto w-full pb-6">
                <OrigenPedidos businessId={businessId} />
              </div>
            </div>
          ) : (
            <>
              {/* Con quién se está hablando, también en pantalla grande. Antes
                  esto solo salía en el celular: en el computador, si el cliente
                  era nuevo, no aparecía su número por ningún lado. */}
              <div className="flex items-center gap-3 px-4 py-2 bg-[#f0f2f5] shrink-0 h-[59px] border-l border-[#e9edef]">
                <button
                  onClick={() => setChatActivo(null)}
                  className="p-1.5 -ml-1.5 text-[#54656f] hover:text-[#111b21] lg:hidden"
                >
                  <FaArrowLeft className="text-sm" />
                </button>
                {/* Tocar el nombre abre la ficha, igual que en WhatsApp Web
                    se toca la cabecera para ver los datos del contacto. */}
                <button
                  onClick={alternarFicha}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  title={fichaAbierta ? 'Ocultar los datos del cliente' : 'Ver los datos del cliente'}
                >
                  <Avatar nombre={chatSeleccionado?.contactName} telefono={chatActivo} grande />
                  <div className="min-w-0">
                    <p className="text-[16px] text-[#111b21] truncate leading-tight">
                      {chatSeleccionado?.contactName || telefonoLegible(chatActivo)}
                    </p>
                    <p className="text-[13px] text-[#667781] truncate">
                      {telefonoLegible(chatActivo)}
                      {puedeResponder && <span className="text-[#00a884]"> · puedes responder</span>}
                    </p>
                  </div>
                </button>

                {/* Estado del bot en esta conversación, y cómo devolvérselo.
                    Contestar a mano lo calla —dos voces confunden al cliente—
                    pero hasta ahora no había forma de deshacerlo: el bot se
                    quedaba mudo sin que nadie supiera por qué. */}
                {cuenta.agente?.activo && (
                  <EstadoDelBot
                    estado={chatSeleccionado?.agente?.estado}
                    reactivando={reactivandoBot}
                    onReactivar={devolverAlBot}
                  />
                )}

                {/* Con la ficha cerrada este botón es la única forma de tomar
                    el pedido, así que se queda a la vista. */}
                <button
                  onClick={() => setTomandoPedido(true)}
                  className={`items-center gap-1.5 bg-[#00a884] hover:bg-[#029072] text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors active:scale-95 shrink-0 ${
                    fichaAbierta ? 'flex xl:hidden' : 'flex'
                  }`}
                >
                  <FaShoppingBag className="text-[10px]" /> Tomar pedido
                </button>

                <button
                  onClick={alternarFicha}
                  title={fichaAbierta ? 'Ocultar los datos del cliente' : 'Ver los datos del cliente'}
                  className={`w-9 h-9 shrink-0 rounded-full grid place-items-center transition-colors ${
                    fichaAbierta ? 'bg-[#00a884] text-white' : 'text-[#54656f] hover:bg-black/5'
                  }`}
                >
                  <FaUser className="text-[14px]" />
                </button>
              </div>

              {/* Solo si la pidieron, y solo donde no cabe la columna de la
                  derecha: en pantalla ancha esos datos ya están en la ficha. */}
              {fichaAbierta && (
                <div className="xl:hidden shrink-0 max-h-[38%] overflow-y-auto">
                  <FichaCliente ficha={ficha} cargando={cargandoFicha} />
                </div>
              )}

              <div className="relative flex-1 min-h-0">
                <div
                  ref={scrollRef}
                  onScroll={alDesplazar}
                  className="h-full overflow-y-auto px-4 sm:px-8 lg:px-16 py-4 bg-[#efeae2] border-l border-[#e9edef]"
                  /* El papel tramado de WhatsApp, dibujado con un degradado en
                     vez de una imagen: no suma una petición ni un archivo al
                     bundle, y sobre blanco liso las burbujas blancas no se
                     distinguían del fondo. */
                  style={{
                    backgroundImage:
                      'radial-gradient(circle at 1px 1px, rgba(17,27,33,0.045) 1px, transparent 0)',
                    backgroundSize: '24px 24px',
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
                          <Burbuja mensaje={m} pegado={pegado} businessId={businessId} />
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
                <div className="bg-[#f0f2f5] shrink-0 border-l border-[#e9edef]">
                  {/* Lo que más se escribe en un restaurante, en un toque. Se
                      pone en el cuadro en vez de enviarse solo: casi siempre hay
                      que rematarlo con la hora o el valor del domicilio. */}
                  <RespuestasRapidas
                    slug={businessConfig?.slug}
                    nombre={ficha?.cliente?.name || chatSeleccionado?.contactName}
                    onElegir={(t) => { setBorrador(t); areaRef.current?.focus(); }}
                  />

                  <form onSubmit={enviar} className="flex items-end gap-2 px-4 py-2.5">
                    {/* Adjuntar. El pie de foto sale de lo que haya escrito en
                        el cuadro, así se manda foto y explicación de una vez. */}
                    <input
                      ref={archivoRef}
                      type="file"
                      className="hidden"
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';   // permite volver a elegir el mismo
                        if (f) enviarArchivo(f);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => archivoRef.current?.click()}
                      disabled={subiendo}
                      title="Adjuntar una foto o un archivo"
                      className="w-11 h-11 shrink-0 rounded-full text-[#54656f] hover:bg-black/5 disabled:opacity-40 grid place-items-center transition-colors"
                    >
                      {subiendo ? <FaSpinner className="animate-spin text-lg" /> : <FaPaperclip className="text-lg" />}
                    </button>
                    <textarea
                      ref={areaRef}
                      value={borrador}
                      onChange={(e) => setBorrador(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(e); }
                      }}
                      rows={1}
                      placeholder="Escribe un mensaje"
                      className="flex-1 resize-none rounded-lg bg-white px-4 py-2.5 text-[15px] leading-relaxed text-[#111b21] placeholder:text-[#8696a0] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!borrador.trim() || enviando}
                      title="Enviar"
                      className="w-11 h-11 shrink-0 rounded-full text-[#54656f] hover:bg-black/5 disabled:opacity-40 disabled:hover:bg-transparent grid place-items-center transition-colors"
                    >
                      {enviando ? <FaSpinner className="animate-spin text-lg" /> : <FaPaperPlane className="text-lg" />}
                    </button>
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

        {/* Ficha del cliente — columna propia en pantalla ancha, y solo si la
            abrieron. Cerrada es el estado normal: al atender manda la
            conversación. */}
        <aside className={`flex-col min-h-0 border-l border-[#e9edef] bg-[#f0f2f5] ${
          fichaAbierta ? 'hidden xl:flex' : 'hidden'
        }`}>
          {chatActivo ? (
            <FichaRail
              ficha={ficha}
              cargando={cargandoFicha}
              telefono={chatActivo}
              nombreChat={chatSeleccionado?.contactName}
              onTomarPedido={() => setTomandoPedido(true)}
              onVerPerfil={onVerPerfil}
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

  /* A pantalla completa manda la conversación y nada más. Dentro del panel, en
     cambio, se está mirando el negocio: ahí abajo van los números de lo que
     WhatsApp está produciendo, que es lo que nadie va a ir a buscar aparte. */
  if (pleno) return bandeja;

  /* La bandeja se queda con todo el alto que sobre y el resumen se ancla
     abajo: así los cuatro números están siempre a la vista, sin desplazar, y
     la conversación no queda encogida para hacerles sitio. */
  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0">{bandeja}</div>
      <ResumenWhatsApp chats={chats} businessId={businessId} />
    </div>
  );
}

/**
 * Qué está produciendo WhatsApp.
 *
 * Los tres primeros números salen de los chats que ya están cargados, así que
 * no cuestan una petición. Las ventas vienen del mismo sitio que la pantalla
 * de origen de pedidos.
 */
function ResumenWhatsApp({ chats, businessId }) {
  const [origen, setOrigen] = useState(null);

  useEffect(() => {
    let vivo = true;
    api.get(`/whatsapp-inbox/origen?businessId=${businessId}&dias=30`)
      .then(({ data }) => { if (vivo) setOrigen(data); })
      .catch(() => { if (vivo) setOrigen(null); });
    return () => { vivo = false; };
  }, [businessId]);

  const sinResponder = chats.filter((c) => c.esperandoRespuesta).length;
  const conPedido = chats.filter((c) => c.agente?.orderNumber).length;
  const porWhatsapp = origen?.origenes?.find((o) => o.origen === 'whatsapp');

  /* De cada cien conversaciones, cuántas terminaron en pedido. Es el número
     que dice si esto sirve o solo entretiene. */
  const conversion = chats.length ? Math.round((conPedido / chats.length) * 100) : 0;

  const tarjetas = [
    { txt: 'Conversaciones', valor: chats.length, pie: 'en la bandeja' },
    {
      txt: 'Sin responder',
      valor: sinResponder,
      pie: sinResponder ? 'esperando respuesta' : 'todo contestado',
      alerta: sinResponder > 0,
    },
    { txt: 'Terminaron en pedido', valor: conPedido, pie: `${conversion}% de las conversaciones` },
    {
      txt: 'Ventas por WhatsApp',
      valor: porWhatsapp ? pesos(porWhatsapp.ventas) : '—',
      pie: porWhatsapp ? `${porWhatsapp.pedidos} pedidos · 30 días` : 'últimos 30 días',
    },
  ];

  return (
    <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 bg-white border-t border-[#e9edef]">
      {tarjetas.map((t) => (
        <div
          key={t.txt}
          className={`px-4 py-3 border-r border-[#e9edef] last:border-r-0 ${
            t.alerta ? 'bg-amber-50/70' : ''
          }`}
        >
          <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wide">{t.txt}</p>
          <p className={`text-xl font-bold leading-tight mt-0.5 ${t.alerta ? 'text-amber-600' : 'text-slate-800'}`}>
            {t.valor}
          </p>
          <p className="text-[11px] text-slate-400">{t.pie}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * En qué anda el bot en esta conversación.
 *
 * Cuando alguien del negocio contesta a mano, el bot se calla —dos voces
 * respondiendo confunden al cliente— pero eso pasaba en silencio: el bot
 * quedaba mudo y nadie sabía por qué, ni cómo deshacerlo.
 */
function EstadoDelBot({ estado, reactivando, onReactivar }) {
  if (estado === 'con_humano') {
    return (
      <button
        onClick={onReactivar}
        disabled={reactivando}
        title="El bot dejó de contestar porque respondió una persona. Devuélvele la conversación."
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 text-[11.5px] font-bold transition-colors shrink-0 disabled:opacity-60"
      >
        {reactivando
          ? <><FaSpinner className="animate-spin text-[10px]" /> Devolviendo…</>
          : <><FaRobot className="text-[11px]" /> Bot en pausa · Reactivar</>}
      </button>
    );
  }

  return (
    <span
      title="El bot está atendiendo esta conversación"
      className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#d9fdd3] text-[#027d69] text-[11.5px] font-bold shrink-0"
    >
      <FaRobot className="text-[11px]" /> Atiende el bot
    </span>
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
function FichaRail({ ficha, cargando, telefono, nombreChat, onTomarPedido, onVerPerfil }) {
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

        {/* Las dos cosas que se hacen desde acá, una al lado de la otra:
            tomarle el pedido, o irse a su ficha completa de cliente. */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={onTomarPedido}
            className="flex-1 flex items-center justify-center gap-2 bg-[#00a884] hover:bg-[#029072] text-white px-3 py-2.5 rounded-xl text-[13px] font-bold transition-colors active:scale-[0.98]"
          >
            <FaShoppingBag className="text-[11px]" /> Tomar pedido
          </button>
          {onVerPerfil && (
            <button
              onClick={() => onVerPerfil(telefono)}
              title="Abrir su ficha en Clientes"
              className="shrink-0 w-11 grid place-items-center bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-500 rounded-xl transition-colors active:scale-95"
            >
              <FaUser className="text-[13px]" />
            </button>
          )}
        </div>
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
