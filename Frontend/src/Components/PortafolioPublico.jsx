import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { enlaceWhatsApp } from '../utils/whatsapp';
import { formatCurrency } from '../utils/currency';

/**
 * La vitrina de un dueño con varios negocios.
 *
 * Es "MenuBy Tura": una página con los negocios de una misma persona, cada uno
 * llevando a su menú. No es un marketplace —no hay negocios de terceros— ni un
 * selector de sucursales: son negocios distintos, con cartas distintas.
 *
 * Antes esto abría con una portada de pantalla completa. Se ve bien en una
 * captura y estorba en un teléfono: el cliente llega por un enlace de WhatsApp
 * a ver dónde pedir, y lo primero que encontraba era un título gigante y una
 * curva decorativa. Ahora abre como abre una app de domicilios —barra
 * compacta, banners, y los negocios de una— porque eso es lo que es.
 *
 * Las decisiones que la ordenan:
 *
 * - **Lo primero que se ve es dónde pedir.** La barra mide 56px y debajo
 *   empieza el contenido.
 * - **Compartir está siempre a mano.** Esta página viaja de teléfono en
 *   teléfono; el botón vive en la barra.
 * - **Cada negocio trae su fila de lo más pedido.** Es lo que convierte una
 *   lista de logos en algo que da hambre.
 * - **Lo abierto manda.** Con media carta cerrada a las once de la noche, el
 *   filtro ahorra recorrer tarjetas que no sirven.
 */

/** A partir de cuántos negocios vale la pena filtrar. */
const MINIMO_PARA_FILTRAR = 3;

/** Cuánto dura cada banner antes de pasar al siguiente. */
const MS_POR_BANNER = 5000;

/** Cuánto hay que arrastrar para que cuente como pasar de banner. */
const ARRASTRE_MINIMO = 45;

export default function PortafolioPublico() {
  const { slug } = useParams();
  const [datos, setDatos] = useState(null);
  const [tops, setTops] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
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

  const banners = p.banners || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Barra portafolio={p} abiertos={abiertos} total={todos.length} alCompartir={compartir} />

      <main className="max-w-3xl mx-auto px-4 pb-24">
        {banners.length > 0 && <Carrusel banners={banners} acento={p.colorPrincipal} />}

        {todos.length >= MINIMO_PARA_FILTRAR && (
          /* Solo con tres o más. Con dos, el filtro esconde la mitad de la
             página para ahorrar un vistazo que no cuesta nada. */
          <div className="flex gap-2 pt-4">
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
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100 mt-4">
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
          <div className="pt-4 space-y-7">
            {visibles.map((n, i) => (
              <section key={n._id}>
                <Tarjeta negocio={n} orden={i} />
                <FilaDeTops negocio={n} tops={tops[String(n._id)]} />
              </section>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-gray-100 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-8 text-center">
          <button
            onClick={compartir}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-xl border-2 border-gray-200 text-[13.5px] font-bold text-gray-600 hover:border-gray-300 transition-colors"
          >
            <IconoCompartir className="w-4 h-4" />
            Compartir esta página
          </button>

          <p className="text-[11.5px] text-gray-400 mt-6">
            Hecho con{' '}
            <a href="/" className="font-bold text-gray-500 hover:text-gray-700">MenuBy</a>
          </p>
        </div>
      </footer>

      {p.ayuda && <BurbujaAyuda ayuda={p.ayuda} />}

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
 * La barra de arriba.
 *
 * Compacta y sólida desde el primer píxel, como la de cualquier app de
 * domicilios. No se esconde al bajar: es el único sitio donde vive el botón de
 * compartir, que es la acción que hace crecer esta página.
 *
 * La portada, si el dueño subió una, va detrás en una franja baja. Ocupando
 * toda la pantalla era bonita y empujaba los negocios fuera de la vista.
 */
function Barra({ portafolio: p, abiertos, total, alCompartir }) {
  return (
    <header
      className="sticky top-0 z-40 shadow-sm"
      style={{ backgroundColor: p.colorPrincipal, color: p.colorTexto }}
    >
      <div className="relative overflow-hidden">
        {p.portada && (
          <>
            <img src={p.portada} alt="" className="absolute inset-0 w-full h-full object-cover" />
            {/* Sin el degradado, un texto claro sobre una foto clara no se lee
                —y la foto la sube el dueño—. */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/60" />
          </>
        )}

        <div className="relative max-w-3xl mx-auto px-3 h-14 flex items-center gap-2.5">
          <Link
            to="/restaurantes"
            aria-label="Ver todos los restaurantes"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          {p.logo && (
            <img
              src={p.logo}
              alt=""
              className="w-9 h-9 rounded-xl object-cover flex-shrink-0 ring-1 ring-white/25"
            />
          )}

          <div className="flex-1 min-w-0">
            <p className="font-black text-[16px] leading-tight truncate">{p.nombre}</p>
            {total > 0 && (
              <p className="flex items-center gap-1.5 text-[11.5px] leading-tight opacity-90">
                <span className="relative flex w-1.5 h-1.5">
                  {abiertos > 0 && (
                    <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-70" />
                  )}
                  <span className={`relative w-1.5 h-1.5 rounded-full ${abiertos ? 'bg-emerald-400' : 'bg-white/50'}`} />
                </span>
                {abiertos > 0
                  ? `${abiertos} de ${total} abierto${abiertos === 1 ? '' : 's'} ahora`
                  : 'Todos cerrados por ahora'}
              </p>
            )}
          </div>

          <button
            onClick={alCompartir}
            aria-label="Compartir"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors flex-shrink-0"
          >
            <IconoCompartir className="w-[17px] h-[17px]" />
          </button>
        </div>

        {p.descripcion && (
          <div className="relative max-w-3xl mx-auto px-3 pb-2.5 -mt-0.5">
            <p className="text-[12.5px] opacity-85 leading-snug line-clamp-2">{p.descripcion}</p>
          </div>
        )}
      </div>
    </header>
  );
}

/**
 * Los banners.
 *
 * Pasan solos cada cinco segundos y se pueden arrastrar con el dedo. El
 * autoplay se apaga en cuanto alguien toca: si el cliente está leyendo uno,
 * moverlo debajo del dedo es quitárselo.
 *
 * Un banner sin enlace se dibuja igual pero no es clicable —hay quien los usa
 * para anunciar un horario, no para llevar a ningún lado— y así no se come un
 * toque que no lleva a nada.
 */
function Carrusel({ banners, acento }) {
  const [actual, setActual] = useState(0);
  const [detenido, setDetenido] = useState(false);
  const inicioX = useRef(0);
  const arrastre = useRef(0);

  useEffect(() => {
    if (detenido || banners.length <= 1) return;
    const t = window.setInterval(
      () => setActual((i) => (i + 1) % banners.length),
      MS_POR_BANNER,
    );
    return () => window.clearInterval(t);
  }, [detenido, banners.length]);

  /* Si el dueño quita banners mientras alguien mira la página, el índice puede
     quedar apuntando a uno que ya no está. */
  const indice = Math.min(actual, banners.length - 1);
  const b = banners[indice];

  const alSoltar = () => {
    if (Math.abs(arrastre.current) > ARRASTRE_MINIMO) {
      const paso = arrastre.current < 0 ? 1 : -1;
      setActual((i) => (i + paso + banners.length) % banners.length);
    }
    arrastre.current = 0;
  };

  const Contenedor = b.enlace ? 'a' : 'div';
  const props = b.enlace
    ? { href: b.enlace, ...(/^https?:\/\//i.test(b.enlace) ? { target: '_blank', rel: 'noopener noreferrer' } : {}) }
    : {};

  return (
    <div className="pt-4">
      <div
        className="relative rounded-2xl overflow-hidden bg-gray-200 shadow-sm"
        onTouchStart={(e) => { setDetenido(true); inicioX.current = e.touches[0].clientX; }}
        onTouchMove={(e) => { arrastre.current = e.touches[0].clientX - inicioX.current; }}
        onTouchEnd={alSoltar}
        onMouseEnter={() => setDetenido(true)}
        onMouseLeave={() => setDetenido(false)}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={indice}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <Contenedor {...props} className="block">
              {/* 16:7, que es la proporción de banner que la gente ya conoce
                  de las apps de domicilios. Alto fijo para que el carrusel no
                  dé saltos al cambiar de imagen. */}
              <div className="aspect-[16/7]">
                <img
                  src={b.imagen}
                  alt={b.titulo || ''}
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              </div>
              {b.titulo && (
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/75 to-transparent">
                  <p className="text-white font-black text-[15px] leading-tight drop-shadow">{b.titulo}</p>
                </div>
              )}
            </Contenedor>
          </motion.div>
        </AnimatePresence>
      </div>

      {banners.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2.5">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => { setActual(i); setDetenido(true); }}
              aria-label={`Ver banner ${i + 1}`}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === indice ? 18 : 6,
                backgroundColor: i === indice ? acento : '#d1d5db',
              }}
            />
          ))}
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
      <p className="text-[12px] font-black text-gray-400 uppercase tracking-wide px-1 mb-2">
        {tops.titulo} en {negocio.businessName}
      </p>

      {/* Desliza en horizontal y corta contra el borde: que se vea medio
          producto asomando es lo que le dice al dedo que hay más. */}
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide snap-x">
        {tops.productos.map((pr) => (
          <a
            key={pr._id}
            href={`/${negocio.slug}`}
            className="flex-shrink-0 w-[116px] snap-start group"
          >
            <div className="relative w-[116px] h-[116px] rounded-xl overflow-hidden bg-gray-100">
              {pr.image ? (
                <img
                  src={pr.image}
                  alt={pr.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl text-gray-300">🍽️</div>
              )}

              {pr.esTop && (
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-amber-400 text-[10px] font-black text-amber-950 shadow">
                  TOP {pr.rank}
                </span>
              )}
            </div>

            <p className="text-[12.5px] font-bold text-gray-800 leading-tight mt-1.5 line-clamp-2">
              {pr.name}
            </p>
            <p className="text-[12.5px] font-black text-gray-900">
              {formatCurrency(pr.price, tops.moneda)}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}

/**
 * La burbuja de ayuda.
 *
 * Un WhatsApp flotante con el número del dueño de la vitrina, no el de
 * ninguno de sus negocios: quien escribe desde aquí todavía no eligió a cuál
 * ir, y mandarlo al chat de uno de ellos es contestarle algo que no preguntó.
 *
 * Abre cerrada y se expande al tocarla. Una burbuja con texto siempre visible
 * tapa media pantalla en un teléfono.
 */
function BurbujaAyuda({ ayuda }) {
  const [abierta, setAbierta] = useState(false);
  const enlace = enlaceWhatsApp(ayuda.telefono, ayuda.mensaje || undefined);

  /* Sin un número utilizable no se dibuja nada: un botón de ayuda que lleva a
     un error de WhatsApp es peor que no ofrecer ayuda. */
  if (!enlace) return null;

  return (
    <div className="fixed bottom-5 right-4 z-40 flex items-center gap-2">
      <AnimatePresence>
        {abierta && (
          <motion.div
            initial={{ opacity: 0, x: 10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-xl shadow-black/10 border border-gray-100 p-3 max-w-[210px]"
          >
            <p className="text-[13px] font-bold text-gray-800 leading-snug">
              {ayuda.etiqueta || '¿Necesitas ayuda?'}
            </p>
            <a
              href={enlace}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-[#25D366] text-white text-[12.5px] font-black"
            >
              Escríbenos
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setAbierta((v) => !v)}
        aria-label={abierta ? 'Cerrar ayuda' : 'Abrir ayuda'}
        className="w-[52px] h-[52px] rounded-full bg-[#25D366] text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center active:scale-95 transition-transform"
      >
        {abierta ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" />
          </svg>
        )}
      </button>
    </div>
  );
}

function IconoCompartir({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342a3 3 0 100-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684zm0-12.632a3 3 0 105.368-2.684 3 3 0 00-5.368 2.684z" />
    </svg>
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
      <div className="h-[72px] bg-gray-300 animate-pulse" />

      <div className="max-w-3xl mx-auto px-4 pt-4 space-y-7">
        <div className="aspect-[16/7] rounded-2xl bg-gray-200 animate-pulse" />

        {[0, 1].map((i) => (
          <div key={i}>
            <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
              <div className="aspect-[16/9] bg-gray-200 animate-pulse" />
              <div className="p-4 flex gap-3">
                <div className="w-14 h-14 rounded-xl bg-gray-200 animate-pulse -mt-7 ring-4 ring-white" />
                <div className="flex-1 pt-3 space-y-2">
                  <div className="h-4 w-28 rounded bg-gray-200 animate-pulse" />
                  <div className="h-3 w-40 rounded bg-gray-100 animate-pulse" />
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 mt-3">
              {[0, 1, 2].map((j) => (
                <div key={j} className="w-[116px] space-y-1.5">
                  <div className="w-[116px] h-[116px] rounded-xl bg-gray-200 animate-pulse" />
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
