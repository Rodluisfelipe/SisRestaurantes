import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';

/**
 * La vitrina de un dueño con varios negocios.
 *
 * Es "MenuBy Tura": una página con los negocios de una misma persona, cada uno
 * llevando a su menú. No es un marketplace —no hay negocios de terceros— ni un
 * selector de sucursales: son negocios distintos, con cartas distintas.
 *
 * Se parece a las tarjetas del catálogo general a propósito. Un cliente que
 * llega aquí desde un WhatsApp y después entra a un menú tiene que sentir que
 * está en el mismo sitio: misma forma de tarjeta, mismo gesto para entrar,
 * mismos avisos de abierto y cerrado.
 */

/** Cuánto hay que bajar para que la cabecera se encoja. */
const UMBRAL_STICKY = 120;

export default function PortafolioPublico() {
  const { slug } = useParams();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [compacta, setCompacta] = useState(false);

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

    /* Si cambia de dirección antes de que responda, la respuesta vieja no
       puede pisar la nueva. */
    return () => { vigente = false; };
  }, [slug]);

  useEffect(() => {
    if (datos?.portafolio?.nombre) document.title = datos.portafolio.nombre;
  }, [datos]);

  /* La cabecera se encoge al bajar, como en los menús: el nombre y el logo
     siguen a la vista mientras se recorre la lista. */
  useEffect(() => {
    const alBajar = () => setCompacta(window.scrollY > UMBRAL_STICKY);
    window.addEventListener('scroll', alBajar, { passive: true });
    return () => window.removeEventListener('scroll', alBajar);
  }, []);

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

  const { portafolio: p, negocios } = datos;
  const abiertos = negocios.filter((n) => n.isOpen).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Barra que aparece al bajar ───────────────────────────────── */}
      <div
        className={`fixed top-0 inset-x-0 z-30 transition-all duration-300 ${
          compacta ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        }`}
        style={{ backgroundColor: p.colorPrincipal, color: p.colorTexto }}
      >
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          {p.logo && (
            <img src={p.logo} alt="" className="w-8 h-8 rounded-lg object-cover ring-1 ring-white/20" />
          )}
          <span className="font-bold truncate">{p.nombre}</span>
        </div>
      </div>

      {/* ── Portada ──────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden" style={{ backgroundColor: p.colorPrincipal }}>
        {p.portada && (
          <>
            <img src={p.portada} alt="" className="absolute inset-0 w-full h-full object-cover" />
            {/* El degradado no es decoración: sin él, un texto claro sobre una
                foto clara no se lee, y la foto la sube el dueño. */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/70" />
          </>
        )}

        <div
          className="relative max-w-3xl mx-auto px-6 pt-14 pb-16 text-center"
          style={{ color: p.colorTexto }}
        >
          {p.logo && (
            <motion.img
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              src={p.logo}
              alt=""
              className="w-24 h-24 rounded-[22px] object-cover mx-auto mb-5 shadow-2xl shadow-black/30 ring-4 ring-white/15"
            />
          )}

          <motion.h1
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="text-3xl sm:text-4xl font-black tracking-tight"
          >
            {p.nombre}
          </motion.h1>

          {p.descripcion && (
            <motion.p
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="mt-2.5 text-[15px] opacity-85 max-w-md mx-auto leading-snug"
            >
              {p.descripcion}
            </motion.p>
          )}

          {negocios.length > 0 && (
            <div className="mt-5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-[12.5px] font-semibold">
              <span className={`w-2 h-2 rounded-full ${abiertos ? 'bg-emerald-400' : 'bg-white/50'}`} />
              {abiertos > 0
                ? `${abiertos} de ${negocios.length} abierto${abiertos === 1 ? '' : 's'} ahora`
                : 'Todos cerrados por ahora'}
            </div>
          )}
        </div>
      </header>

      {/* ── Los negocios ─────────────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-4 -mt-8 pb-20 relative z-10">
        {negocios.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-2xl mx-auto mb-3">
              🍽️
            </div>
            <p className="font-bold text-gray-900">Todavía no hay negocios aquí</p>
            <p className="text-sm text-gray-500 mt-1">Vuelve pronto</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {negocios.map((n, i) => (
              <Tarjeta key={n._id} negocio={n} orden={i} />
            ))}
          </div>
        )}

        <p className="text-center text-[11px] text-gray-400 mt-10">
          Hecho con <span className="font-bold text-gray-500">MenuBy</span>
        </p>
      </main>
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
