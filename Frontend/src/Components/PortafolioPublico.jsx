import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

/**
 * La vitrina de un dueño con varios negocios.
 *
 * Es "MenuBy Tura": una página con los negocios de una misma persona, cada uno
 * llevando a su menú. No es un marketplace —no hay negocios de terceros— ni un
 * selector de sucursales: son negocios distintos, con cartas distintas.
 *
 * La página está construida alrededor de cómo llega la gente: por un enlace de
 * WhatsApp, en el celular, con hambre y con prisa. De ahí salen las tres
 * decisiones que la ordenan:
 *
 * - **Compartir es lo primero, no una opción escondida.** Esta página se
 *   difunde de teléfono en teléfono; el botón está en la barra, siempre.
 * - **Lo abierto manda.** Con media carta cerrada a las once de la noche, el
 *   filtro de abiertos ahorra recorrer tarjetas que no sirven.
 * - **Nada de scroll sin referencia.** La barra superior conserva el nombre y
 *   el camino de vuelta.
 */

/** Cuánto hay que bajar para que la barra se vuelva sólida. */
const UMBRAL_STICKY = 90;

/** A partir de cuántos negocios vale la pena filtrar. */
const MINIMO_PARA_FILTRAR = 3;

export default function PortafolioPublico() {
  const { slug } = useParams();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [solida, setSolida] = useState(false);
  const [soloAbiertos, setSoloAbiertos] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vigente = true;
    setCargando(true);

    api.get(`/portafolios/${slug}`)
      .then((r) => { if (vigente) setDatos(r.data); })
      .catch((e) => {
        if (!vigente) return;
        /* Se distingue "no existe" de "algo falló". Un 404 es definitivo y hay
           que decirlo; lo demás puede ser la red y vale la pena reintentar. */
        setError(e?.response?.status === 404 ? 'no-existe' : 'fallo');
      })
      .finally(() => { if (vigente) setCargando(false); });

    return () => { vigente = false; };
  }, [slug]);

  useEffect(() => {
    if (datos?.portafolio?.nombre) document.title = datos.portafolio.nombre;
  }, [datos]);

  useEffect(() => {
    const alBajar = () => setSolida(window.scrollY > UMBRAL_STICKY);
    alBajar();
    window.addEventListener('scroll', alBajar, { passive: true });
    return () => window.removeEventListener('scroll', alBajar);
  }, []);

  const p = datos?.portafolio;
  const todos = datos?.negocios || [];
  const abiertos = useMemo(() => todos.filter((n) => n.isOpen).length, [todos]);
  const visibles = soloAbiertos ? todos.filter((n) => n.isOpen) : todos;

  /* Compartir usa la hoja del sistema cuando existe —en un celular es la que
     lleva directo a WhatsApp, que es por donde esto viaja— y cae a copiar el
     enlace en escritorio, donde esa hoja no existe. */
  const compartir = async () => {
    const url = window.location.href;
    const texto = `${p.nombre} — mira los menús`;

    if (navigator.share) {
      try {
        await navigator.share({ title: p.nombre, text: texto, url });
        return;
      } catch {
        /* El usuario canceló. No es un error y no se le dice nada. */
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCompartiendo(true);
    }
  };

  if (cargando) return <Esqueleto />;

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl">
          {error === 'no-existe' ? '🔍' : '📡'}
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">
            {error === 'no-existe' ? 'Esta página no existe' : 'No pudimos cargar la página'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {error === 'no-existe'
              ? 'Revisa la dirección, puede tener un error'
              : 'Revisa tu conexión e inténtalo de nuevo'}
          </p>
        </div>
        {error === 'fallo' ? (
          <button
            onClick={() => window.location.reload()}
            className="h-11 px-6 rounded-xl bg-gray-900 text-white text-sm font-bold"
          >
            Reintentar
          </button>
        ) : (
          <Link to="/restaurantes" className="h-11 px-6 rounded-xl bg-gray-900 text-white text-sm font-bold flex items-center">
            Ver todos los restaurantes
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── La barra ──────────────────────────────────────────────────────
          Siempre presente. Arriba del todo es transparente sobre la portada;
          al bajar se vuelve sólida y saca el nombre, para que nunca se pierda
          de vista dónde está uno. */}
      <nav
        className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${
          solida ? 'shadow-lg shadow-black/5' : ''
        }`}
        style={{ backgroundColor: solida ? p.colorPrincipal : 'transparent' }}
      >
        <div className="max-w-3xl mx-auto px-3 h-14 flex items-center gap-2" style={{ color: p.colorTexto }}>
          <Link
            to="/restaurantes"
            aria-label="Ver todos los restaurantes"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-black/20 backdrop-blur-sm hover:bg-black/30 transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          <div
            className={`flex-1 min-w-0 flex items-center gap-2 transition-all duration-300 ${
              solida ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'
            }`}
          >
            {p.logo && <img src={p.logo} alt="" className="w-8 h-8 rounded-lg object-cover ring-1 ring-white/20" />}
            <span className="font-bold truncate">{p.nombre}</span>
          </div>

          <button
            onClick={compartir}
            aria-label="Compartir"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-black/20 backdrop-blur-sm hover:bg-black/30 transition-colors flex-shrink-0"
          >
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342a3 3 0 100-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684zm0-12.632a3 3 0 105.368-2.684 3 3 0 00-5.368 2.684z" />
            </svg>
          </button>
        </div>
      </nav>

      {/* ── Portada ──────────────────────────────────────────────────────
          Termina en una curva sobre el fondo. Un borde recto parte la pantalla
          en dos bloques que no se hablan; la curva los cose. */}
      <header className="relative overflow-hidden" style={{ backgroundColor: p.colorPrincipal }}>
        {p.portada ? (
          <>
            <img src={p.portada} alt="" className="absolute inset-0 w-full h-full object-cover" />
            {/* Sin el degradado, un texto claro sobre una foto clara no se lee
                —y la foto la sube el dueño—. */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/55 to-black/75" />
          </>
        ) : (
          /* Sin portada, dos manchas de luz para que el color plano no se vea
             como un error de carga. */
          <>
            <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-24 -left-10 w-72 h-72 rounded-full bg-white/[0.07] blur-3xl" />
          </>
        )}

        <div
          className="relative max-w-3xl mx-auto px-6 pt-24 pb-24 text-center"
          style={{ color: p.colorTexto }}
        >
          {p.logo && (
            <motion.img
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              src={p.logo}
              alt=""
              className="w-24 h-24 rounded-[24px] object-cover mx-auto mb-5 shadow-2xl shadow-black/40 ring-4 ring-white/20"
            />
          )}

          <motion.h1
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.06 }}
            className="text-[32px] sm:text-[40px] font-black tracking-tight leading-none"
          >
            {p.nombre}
          </motion.h1>

          {p.descripcion && (
            <motion.p
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.12 }}
              className="mt-3 text-[15px] opacity-90 max-w-sm mx-auto leading-relaxed"
            >
              {p.descripcion}
            </motion.p>
          )}

          {todos.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 backdrop-blur-md text-[13px] font-semibold ring-1 ring-white/10"
            >
              <span className="relative flex w-2 h-2">
                {abiertos > 0 && (
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                )}
                <span className={`relative w-2 h-2 rounded-full ${abiertos ? 'bg-emerald-400' : 'bg-white/50'}`} />
              </span>
              {abiertos > 0
                ? `${abiertos} de ${todos.length} abierto${abiertos === 1 ? '' : 's'} ahora`
                : 'Todos cerrados por ahora'}
            </motion.div>
          )}
        </div>

        <svg
          className="absolute -bottom-px inset-x-0 w-full h-[42px] text-gray-50"
          viewBox="0 0 1440 42"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path fill="currentColor" d="M0 42h1440V0c-240 28-480 42-720 42S240 28 0 0v42z" />
        </svg>
      </header>

      {/* ── Los negocios ─────────────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-4 pb-16">
        {todos.length >= MINIMO_PARA_FILTRAR && (
          /* Solo con tres o más. Con dos, el filtro esconde la mitad de la
             página para ahorrar un vistazo que no cuesta nada. */
          <div className="flex gap-2 mb-4">
            {[
              { id: false, texto: `Todos (${todos.length})` },
              { id: true, texto: `Abiertos (${abiertos})` },
            ].map((f) => (
              <button
                key={String(f.id)}
                onClick={() => setSoloAbiertos(f.id)}
                className={`h-9 px-4 rounded-full text-[13px] font-bold transition-colors ${
                  soloAbiertos === f.id
                    ? 'text-white'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
                }`}
                style={soloAbiertos === f.id ? { backgroundColor: p.colorPrincipal } : undefined}
              >
                {f.texto}
              </button>
            ))}
          </div>
        )}

        {visibles.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-2xl mx-auto mb-3">
              {soloAbiertos ? '🌙' : '🍽️'}
            </div>
            <p className="font-bold text-gray-900">
              {soloAbiertos ? 'Ninguno está abierto ahora' : 'Todavía no hay negocios aquí'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {soloAbiertos ? 'Puedes ver las cartas de todos modos' : 'Vuelve pronto'}
            </p>
            {soloAbiertos && (
              <button
                onClick={() => setSoloAbiertos(false)}
                className="mt-4 h-10 px-5 rounded-xl bg-gray-900 text-white text-[13px] font-bold"
              >
                Ver todos
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {visibles.map((n, i) => (
              <Tarjeta key={n._id} negocio={n} orden={i} />
            ))}
          </div>
        )}
      </main>

      {/* ── Pie ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-8 text-center">
          <button
            onClick={compartir}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-xl border-2 border-gray-200 text-[13.5px] font-bold text-gray-600 hover:border-gray-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342a3 3 0 100-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684zm0-12.632a3 3 0 105.368-2.684 3 3 0 00-5.368 2.684z" />
            </svg>
            Compartir esta página
          </button>

          <p className="text-[11.5px] text-gray-400 mt-6">
            Hecho con{' '}
            <a href="/" className="font-bold text-gray-500 hover:text-gray-700">MenuBy</a>
          </p>
        </div>
      </footer>

      {/* El aviso de "copiado". Abajo y flotante: confirma sin tapar nada ni
          pedir que lo cierren. */}
      <AnimatePresence>
        {copiado && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="fixed bottom-6 inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
          >
            <span className="bg-gray-900 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl shadow-xl">
              Enlace copiado
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Último recurso: ni hoja del sistema ni portapapeles. Pasa en
          navegadores viejos y sobre http. */}
      {compartiendo && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setCompartiendo(false)}
        >
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-gray-900 mb-2">Copia el enlace</p>
            <input
              readOnly
              value={window.location.href}
              onFocus={(e) => e.target.select()}
              className="w-full h-11 px-3 rounded-xl border-2 border-gray-200 text-[13px] text-gray-600"
            />
            <button
              onClick={() => setCompartiendo(false)}
              className="mt-3 w-full h-11 rounded-xl bg-gray-900 text-white text-sm font-bold"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Un negocio.
 *
 * Misma forma que las tarjetas del catálogo general —16:9, logo montado sobre
 * la portada, badge de estado— para que quien viene de allá no tenga que
 * aprender nada nuevo.
 */
function Tarjeta({ negocio: n, orden }) {
  const [cargada, setCargada] = useState(false);
  const [fallo, setFallo] = useState(false);
  const acento = n.theme?.buttonColor || '#111827';

  /* Un negocio cerrado se atenúa pero **se deja entrar**: el cliente quiere ver
     la carta aunque no pueda pedir todavía, y bloquearlo lo manda a buscar el
     menú por otro lado. */
  const hayPortada = n.coverImage && !fallo;

  return (
    <motion.a
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, delay: Math.min(orden * 0.06, 0.3) }}
      href={`/${n.slug}`}
      className="group block"
    >
      <div
        className={`bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm transition-all duration-200 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 ${
          n.isOpen ? '' : 'opacity-75'
        }`}
      >
        <div className="relative aspect-[16/9] overflow-hidden bg-gray-100">
          {hayPortada ? (
            <>
              {!cargada && (
                <div className="absolute inset-0 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-gray-100 via-white to-gray-100" />
              )}
              <img
                src={n.coverImage}
                alt={n.businessName}
                loading="lazy"
                onLoad={() => setCargada(true)}
                onError={() => setFallo(true)}
                className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${
                  cargada ? '' : 'opacity-0'
                }`}
              />
            </>
          ) : (
            /* Sin portada, el color del propio negocio: mejor su identidad que
               un gris que no dice nada. */
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${acento}22, ${acento}0d)` }}
            >
              {n.logo ? (
                <img src={n.logo} alt="" className="w-16 h-16 object-contain rounded-2xl" />
              ) : (
                <span className="text-5xl font-black" style={{ color: `${acento}40` }}>
                  {(n.businessName || '?').charAt(0)}
                </span>
              )}
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent" />

          <span
            className={`absolute top-3 right-3 px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-sm ${
              n.isOpen ? 'bg-emerald-500 text-white' : 'bg-white/95 text-gray-600'
            }`}
          >
            {n.isOpen ? 'Abierto' : 'Cerrado'}
          </span>
        </div>

        <div className="p-4 pt-0 flex gap-3">
          {n.logo && (
            <img
              src={n.logo}
              alt=""
              className="w-14 h-14 rounded-xl object-cover flex-shrink-0 -mt-7 ring-4 ring-white shadow-lg shadow-black/10 relative z-10"
            />
          )}

          <div className="min-w-0 flex-1 pt-3">
            <p className="font-black text-gray-900 truncate leading-tight">{n.businessName}</p>
            {n.description && (
              /* Dos líneas y corta. La descripción la escribe el dueño y hay
                 quien pone un párrafo entero; sin tope, una tarjeta mide el
                 triple que la de al lado y la rejilla se desbarata. */
              <p className="text-[12.5px] text-gray-500 leading-snug line-clamp-2 mt-0.5">
                {n.description}
              </p>
            )}
          </div>

          <span
            className="flex-shrink-0 self-center w-9 h-9 rounded-full flex items-center justify-center text-white transition-transform group-hover:translate-x-0.5"
            style={{ backgroundColor: acento }}
            aria-hidden
          >
            ›
          </span>
        </div>
      </div>
    </motion.a>
  );
}

/**
 * Lo que se ve mientras carga.
 *
 * Con la forma de lo que va a llegar, no un girador centrado: el salto de una
 * pantalla vacía a la página completa se siente más lento que esto, aunque
 * tarde lo mismo.
 */
function Esqueleto() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-200 animate-pulse">
        <div className="max-w-3xl mx-auto px-6 pt-14 pb-16 flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-[22px] bg-gray-300" />
          <div className="h-8 w-52 rounded-lg bg-gray-300" />
          <div className="h-4 w-72 rounded bg-gray-300/70" />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-8 grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100">
            <div className="aspect-[16/9] bg-gray-200 animate-pulse" />
            <div className="p-4 flex gap-3">
              <div className="w-14 h-14 rounded-xl bg-gray-200 animate-pulse -mt-7 ring-4 ring-white" />
              <div className="flex-1 pt-3 space-y-2">
                <div className="h-4 w-28 rounded bg-gray-200 animate-pulse" />
                <div className="h-3 w-40 rounded bg-gray-100 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
