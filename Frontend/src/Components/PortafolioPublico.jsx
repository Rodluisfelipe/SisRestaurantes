import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import RestaurantCard from './Catalog/RestaurantCard';
import { formatCurrency } from '../utils/currency';

/**
 * La vitrina de un dueño con varios negocios.
 *
 * Es "MenuBy Tura": una página con los negocios de una misma persona, cada uno
 * llevando a su menú. No es un marketplace —no hay negocios de terceros— ni un
 * selector de sucursales: son negocios distintos, con cartas distintas.
 *
 * Se ve como el marketplace de MenuBy **a propósito**: misma barra, misma
 * tarjeta, mismas filas. El cliente llega por WhatsApp esperando una app de
 * domicilios, y esa es la que ya conoce. La tarjeta es literalmente la misma
 * pieza (`RestaurantCard`), no una copia: lo que se mejore allá se mejora acá.
 *
 * Lo único que cambia es a quién sirve. Un marketplace ordena por cercanía y
 * popularidad porque compiten negocios de terceros; aquí el orden lo puso el
 * dueño y se respeta, y **no hay salida hacia el catálogo general**: esta
 * página es la de él, no una puerta a la competencia.
 */

/** Cuánto hay que bajar para que la barra se compacte. */
const UMBRAL_COMPACTA = 40;

/** A partir de cuántos negocios vale la pena filtrar. */
const MINIMO_PARA_FILTRAR = 3;

export default function PortafolioPublico() {
  const { slug } = useParams();
  const [datos, setDatos] = useState(null);
  const [tops, setTops] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [compacta, setCompacta] = useState(false);
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

  /* Las filas de lo más pedido llegan aparte y después. Son una agregación de
     ventas por cada negocio: esperarlas retrasaría lo único que la gente vino
     a ver. Si no llegan, la página funciona igual. */
  useEffect(() => {
    let vigente = true;

    api.get(`/portafolios/${slug}/tops`)
      .then((r) => { if (vigente) setTops(r.data?.tops || {}); })
      .catch(() => { /* un añadido, no una parte */ });

    return () => { vigente = false; };
  }, [slug]);

  useEffect(() => {
    if (datos?.portafolio?.nombre) document.title = datos.portafolio.nombre;
  }, [datos]);

  useEffect(() => {
    const alBajar = () => setCompacta(window.scrollY > UMBRAL_COMPACTA);
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

    if (navigator.share) {
      try {
        await navigator.share({ title: p.nombre, text: `${p.nombre} — mira los menús`, url });
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
        {error === 'fallo' && (
          <button
            onClick={() => window.location.reload()}
            className="h-11 px-6 rounded-xl bg-gray-900 text-white text-sm font-bold"
          >
            Reintentar
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ═══ BARRA ═══
          Como la del marketplace: de color arriba del todo, y al bajar se
          vuelve blanca y se encoge. El color es el del portafolio y no el rojo
          de MenuBy, porque la página es del dueño. */}
      <header className="sticky top-0 z-40">
        <div
          className={`transition-all duration-300 ${compacta ? 'bg-white border-b border-gray-100' : ''}`}
          style={compacta ? undefined : { backgroundColor: p.colorPrincipal }}
        >
          <div className="max-w-3xl mx-auto px-4">
            <div className={`flex items-center gap-3 transition-all ${compacta ? 'py-2' : 'pt-3.5 pb-3'}`}>
              {p.logo && (
                <img
                  src={p.logo}
                  alt=""
                  className={`rounded-xl object-cover flex-shrink-0 transition-all ${
                    compacta ? 'w-8 h-8' : 'w-11 h-11 ring-2 ring-white/25'
                  }`}
                />
              )}

              <div className="flex-1 min-w-0" style={compacta ? undefined : { color: p.colorTexto }}>
                <p
                  className={`font-extrabold truncate leading-tight transition-all ${
                    compacta ? 'text-[15px] text-gray-900' : 'text-[19px]'
                  }`}
                >
                  {p.nombre}
                </p>

                {/* Compacta, el subtítulo estorba más de lo que informa. */}
                {!compacta && todos.length > 0 && (
                  <p className="flex items-center gap-1.5 text-[12px] leading-tight opacity-90 mt-0.5">
                    <span className="relative flex w-1.5 h-1.5">
                      {abiertos > 0 && (
                        <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-70" />
                      )}
                      <span className={`relative w-1.5 h-1.5 rounded-full ${abiertos ? 'bg-emerald-400' : 'bg-white/50'}`} />
                    </span>
                    {abiertos > 0
                      ? `${abiertos} de ${todos.length} abierto${abiertos === 1 ? '' : 's'} ahora`
                      : 'Todos cerrados por ahora'}
                  </p>
                )}
              </div>

              <button
                onClick={compartir}
                aria-label="Compartir"
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                  compacta ? 'bg-gray-100 text-gray-600' : 'bg-white/15'
                }`}
                style={compacta ? undefined : { color: p.colorTexto }}
              >
                <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342a3 3 0 100-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684zm0-12.632a3 3 0 105.368-2.684 3 3 0 00-5.368 2.684z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-4 pb-12">
        {p.descripcion && (
          <p className="text-[13.5px] text-gray-500 leading-snug mb-4">{p.descripcion}</p>
        )}

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
                className={`h-9 px-4 rounded-full text-[13px] font-bold transition-all ${
                  soloAbiertos === f.id
                    ? 'text-white shadow-md scale-[1.02]'
                    : 'bg-white text-gray-600 shadow-sm hover:shadow-md hover:text-gray-900'
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
          /* Uno debajo de otro y no en rejilla: cada negocio trae su fila de
             lo más pedido, y en dos columnas esa fila no cabe sin quedar
             apretada hasta volverse ilegible. */
          <div className="space-y-6">
            {visibles.map((n, i) => (
              <motion.section
                key={n._id}
                initial={{ y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.06, 0.3) }}
              >
                <RestaurantCard restaurant={n} />
                <FilaDeTops negocio={n} tops={tops[String(n._id)]} />
              </motion.section>
            ))}
          </div>
        )}
      </main>

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
 * Lo más pedido de un negocio, en una fila que se desliza.
 *
 * Es lo que diferencia esta página de una lista de logos: el cliente ve comida
 * antes de decidir a cuál entrar.
 *
 * No aparece nada si el negocio no tiene ventas de la semana, si apagó la
 * sección en su panel o si su plan no la incluye —las mismas reglas que en su
 * propia carta, porque es el mismo cálculo—. Una fila vacía con un título
 * encima se lee como que algo se rompió.
 */
function FilaDeTops({ negocio, tops }) {
  if (!tops?.productos?.length) return null;

  return (
    <div className="mt-3">
      <p className="text-[13px] font-extrabold text-gray-800 px-0.5 mb-2">
        Lo más pedido esta semana
      </p>

      {/* Desliza en horizontal y corta contra el borde: que se vea medio
          producto asomando es lo que le dice al dedo que hay más. */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 snap-x">
        {tops.productos.map((pr) => (
          <a
            key={pr._id}
            href={`/${negocio.slug}`}
            className="flex-shrink-0 w-[118px] snap-start group"
          >
            <div className="relative w-[118px] h-[118px] rounded-2xl overflow-hidden bg-gray-100 shadow-sm border border-gray-100/80">
              {pr.image ? (
                <img
                  src={pr.image}
                  alt={pr.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl text-gray-300">🍽️</div>
              )}

              {pr.esTop && (
                <span className="absolute top-2 left-2 bg-red-500 rounded-lg px-1.5 py-0.5 shadow-lg shadow-red-500/30">
                  <span className="text-[9px] font-bold text-white tracking-wide">TOP {pr.rank}</span>
                </span>
              )}
            </div>

            <p className="text-[13px] font-bold text-gray-900 leading-tight mt-1.5 line-clamp-2">
              {pr.name}
            </p>
            <p className="text-[12.5px] font-semibold text-gray-500">
              {formatCurrency(pr.price, tops.moneda)}
            </p>
          </a>
        ))}
      </div>
    </div>
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
      <div className="h-[68px] bg-gray-300 animate-pulse" />

      <div className="max-w-3xl mx-auto px-4 pt-4 space-y-6">
        {[0, 1].map((i) => (
          <div key={i}>
            <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
              <div className="aspect-[16/9] bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-gray-100 via-white to-gray-100" />
              <div className="p-3.5 flex gap-3 items-start">
                <div className="w-11 h-11 rounded-xl bg-gray-100 flex-shrink-0 -mt-8 shadow-sm" />
                <div className="flex-1 space-y-2 pt-0.5">
                  <div className="h-4 bg-gray-100 rounded-lg w-3/4 animate-pulse" />
                  <div className="h-3 bg-gray-100 rounded-lg w-1/2 animate-pulse" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-3">
              {[0, 1, 2].map((j) => (
                <div key={j} className="w-[118px] space-y-1.5">
                  <div className="w-[118px] h-[118px] rounded-2xl bg-gray-100 animate-pulse" />
                  <div className="h-3 w-20 rounded bg-gray-100 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
