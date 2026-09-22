import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { menuCssVars, derivePalette, shade } from '../utils/menuTokens';
import { formatCurrency } from '../utils/currency';

/**
 * La vitrina de un dueño con varios negocios.
 *
 * Es "MenuBy Tura": una página con los negocios de una misma persona, cada uno
 * llevando a su menú. No es un marketplace —no hay negocios de terceros— ni un
 * selector de sucursales: son negocios distintos, con cartas distintas.
 *
 * Usa el mismo sistema visual del menú (`menuCssVars`) y su patrón de perfil:
 * banner delgado, avatar con anillo, fila de stats tocables. No es un parecido
 * hecho a mano —son los mismos tokens—, así que el día que el menú cambie de
 * superficies o de radios, esta página cambia con él.
 *
 * Lo que la ordena:
 *
 * - **Abierto primero, siempre.** El orden que puso el dueño se respeta, pero
 *   dentro de cada grupo: a las once de la noche, lo que sirve es lo que está
 *   abierto, no lo que él puso de primero.
 * - **Las reseñas se ven antes de entrar.** Calificación y número de reseñas
 *   en la tarjeta, como en el perfil del menú: es lo que decide a cuál entrar.
 * - **Lo más pedido de cada uno, con foto.** Un logo no da hambre.
 * - **No hay salida al catálogo general.** Esta página es del dueño, no una
 *   puerta a la competencia.
 */

/* ── Iconos (mismo patrón que el resto del menú: SVG inline, sin librería) ── */
const IC = {
  star: (cls = 'w-4 h-4') => (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  share: (cls = 'w-4 h-4') => (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51L8.59 10.49" />
    </svg>
  ),
  mapPin: (cls = 'w-3 h-3') => (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  arrow: (cls = 'w-4 h-4') => (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 5l7 7-7 7M21 12H3" />
    </svg>
  ),
};

/** A partir de cuántos negocios vale la pena filtrar. */
const MINIMO_PARA_FILTRAR = 3;

/** Cuánto dura cada banner antes de pasar al siguiente. */
const MS_POR_BANNER = 5000;

/** Cuánto hay que arrastrar para que cuente como pasar de banner. */
const ARRASTRE_MINIMO = 45;

/** El ancho del menú. La identidad se pierde si la página se estira sin tope. */
const ANCHO = 'max-w-[880px] mx-auto w-full';

const vidrio = {
  background: 'rgba(0,0,0,0.34)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
};

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

  /* Abierto primero. El `sort` de JavaScript es estable, así que dentro de
     cada grupo se conserva el orden que el dueño configuró: no se pierde su
     curaduría, solo se hunde lo que ahora mismo no sirve. */
  const ordenados = useMemo(
    () => [...todos].sort((a, b) => (b.isOpen ? 1 : 0) - (a.isOpen ? 1 : 0)),
    [todos],
  );

  const abiertos = useMemo(() => todos.filter((n) => n.isOpen).length, [todos]);

  /* La calificación de la vitrina: el promedio de los negocios que tienen
     reseñas, pesado por cuántas tiene cada uno. Un negocio con 200 reseñas no
     puede contar lo mismo que uno con 2. */
  const calificacion = useMemo(() => {
    let suma = 0;
    let cuenta = 0;
    for (const n of todos) {
      const nota = n.reviewStats?.averageRating || 0;
      const cuantas = n.reviewStats?.totalReviews || 0;
      if (nota > 0 && cuantas > 0) { suma += nota * cuantas; cuenta += cuantas; }
    }
    return cuenta ? { nota: suma / cuenta, total: cuenta } : null;
  }, [todos]);

  const visibles = soloAbiertos ? ordenados.filter((n) => n.isOpen) : ordenados;

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
    <main
      className="min-h-screen pb-10"
      style={{ ...menuCssVars(p.colorPrincipal), background: 'var(--mb-surface)' }}
    >
      {/* ── Banner ─────────────────────────────────────────────────────
          Delgado, como el del menú. En escritorio crece: a lo ancho, 128px se
          ve como una franja suelta arriba de la página. */}
      <div className="relative h-32 md:h-56 overflow-hidden">
        {p.portada ? (
          <>
            <img src={p.portada} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.35)' }} />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg, var(--mb-accent-soft), var(--mb-accent-softer))' }}
          />
        )}
        {/* Funde hacia el fondo: un borde recto parte la pantalla en dos. */}
        <div
          className="absolute inset-x-0 bottom-0 h-14"
          style={{ background: 'linear-gradient(to bottom, transparent, var(--mb-surface))' }}
        />

        <div className="absolute top-3 left-3 md:left-[max(0.75rem,calc(50%-440px))]">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold text-white" style={vidrio}>
            <span className={`w-1.5 h-1.5 rounded-full ${abiertos ? 'bg-emerald-400' : 'bg-red-400'}`} />
            {todos.length === 0
              ? 'Sin negocios todavía'
              : abiertos > 0
                ? `${abiertos} de ${todos.length} abierto${abiertos === 1 ? '' : 's'}`
                : 'Todos cerrados ahora'}
          </span>
        </div>

        <div className="absolute top-3 right-3 md:right-[max(0.75rem,calc(50%-440px))]">
          <button
            onClick={compartir}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-colors"
            style={vidrio}
            aria-label="Compartir"
            title="Compartir"
          >
            {IC.share()}
          </button>
        </div>
      </div>

      {/* ── Perfil de la vitrina ───────────────────────────────────── */}
      <section className={`px-4 ${ANCHO}`}>
        <div className="-mt-[38px] sm:-mt-[42px] relative z-10 flex items-end justify-between">
          {/* Más pequeño en el celular: a 360px, 92px de avatar más tres datos
              al lado dejaban las etiquetas cortadas. */}
          <div
            className="w-[76px] h-[76px] sm:w-[92px] sm:h-[92px] rounded-full p-[3px] flex-shrink-0"
            style={{ background: 'conic-gradient(from 180deg, var(--mb-accent), var(--mb-ring-partner), var(--mb-accent))' }}
          >
            <div
              className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
              style={{ border: '3.5px solid var(--mb-surface)', background: 'var(--mb-card)' }}
            >
              {p.logo ? (
                <img src={p.logo} alt={`Logo de ${p.nombre}`} className="w-full h-full object-cover" loading="eager" />
              ) : (
                <span className="text-[26px] sm:text-[30px] font-black" style={{ color: 'var(--mb-accent)' }}>
                  {(p.nombre || '?').charAt(0)}
                </span>
              )}
            </div>
          </div>

          {/* Stats. Se reparten el espacio para que la fila no quede cargada a
              la derecha cuando hay menos de tres. */}
          <div className="flex-1 flex items-center justify-around pb-1.5 pl-2 sm:pl-3 min-w-0">
            <Dato valor={todos.length} etiqueta={todos.length === 1 ? 'negocio' : 'negocios'} />
            <Dato valor={abiertos} etiqueta="abiertos" resaltado={abiertos > 0} />
            {calificacion && (
              <Dato
                valor={
                  <span className="flex items-center justify-center gap-1">
                    <span className="text-amber-400">{IC.star('w-3.5 h-3.5')}</span>
                    {calificacion.nota.toFixed(1)}
                  </span>
                }
                etiqueta={`${calificacion.total} reseñas`}
              />
            )}
          </div>
        </div>

        <h1 className="mt-2.5 text-[21px] md:text-[25px] font-extrabold tracking-tight leading-tight" style={{ color: 'var(--mb-ink)' }}>
          {p.nombre}
        </h1>

        {p.descripcion && (
          /* Sin recorte: es lo que el dueño quiere contar de su vitrina. */
          <p className="text-[13.5px] leading-snug mt-0.5" style={{ color: 'var(--mb-ink-2)' }}>
            {p.descripcion}
          </p>
        )}

        {todos.length >= MINIMO_PARA_FILTRAR && (
          /* Solo con tres o más. Con dos, el filtro esconde la mitad de la
             página para ahorrar un vistazo que no cuesta nada. */
          <div className="flex gap-2 mt-3.5">
            {[
              { id: false, texto: `Todos (${todos.length})` },
              { id: true, texto: `Abiertos (${abiertos})` },
            ].map((f) => (
              <button
                key={String(f.id)}
                onClick={() => setSoloAbiertos(f.id)}
                className="h-9 px-4 rounded-full text-[13px] font-bold active:scale-[0.98] transition-transform"
                style={
                  soloAbiertos === f.id
                    ? { background: 'var(--mb-accent)', color: 'var(--mb-on-accent)' }
                    : { background: 'var(--mb-surface-2)', color: 'var(--mb-ink-2)', border: '1px solid var(--mb-line)' }
                }
              >
                {f.texto}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Banners ────────────────────────────────────────────────
          Debajo de la identidad y encima de los negocios: quien llega quiere
          saber primero de quién es la página, y después qué hay de nuevo. */}
      {(p.banners || []).length > 0 && (
        <section className={`px-4 mt-4 ${ANCHO}`}>
          <Carrusel banners={p.banners} />
        </section>
      )}

      {/* ── Los negocios ───────────────────────────────────────────── */}
      <section className={`px-4 mt-5 ${ANCHO} space-y-5`}>
        {visibles.length === 0 ? (
          <div
            className="rounded-[var(--mb-radius-card)] p-10 text-center"
            style={{ background: 'var(--mb-card)', border: '1px solid var(--mb-line)' }}
          >
            <div className="text-3xl mb-2">{soloAbiertos ? '🌙' : '🍽️'}</div>
            <p className="font-bold" style={{ color: 'var(--mb-ink)' }}>
              {soloAbiertos ? 'Ninguno está abierto ahora' : 'Todavía no hay negocios aquí'}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--mb-ink-2)' }}>
              {soloAbiertos ? 'Puedes ver las cartas de todos modos' : 'Vuelve pronto'}
            </p>
            {soloAbiertos && (
              <button
                onClick={() => setSoloAbiertos(false)}
                className="mt-4 h-10 px-5 rounded-[var(--mb-radius-btn)] text-[13px] font-extrabold"
                style={{ background: 'var(--mb-accent)', color: 'var(--mb-on-accent)' }}
              >
                Ver todos
              </button>
            )}
          </div>
        ) : (
          visibles.map((n, i) => (
            <TarjetaNegocio key={n._id} negocio={n} tops={tops[String(n._id)]} orden={i} />
          ))
        )}
      </section>

      {/* ── Pie ────────────────────────────────────────────────────── */}
      <footer className={`px-4 mt-10 ${ANCHO}`}>
        <div className="pt-6 text-center" style={{ borderTop: '1px solid var(--mb-line)' }}>
          <button
            onClick={compartir}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--mb-radius-btn)] text-[13.5px] font-bold active:scale-[0.98] transition-transform"
            style={{ background: 'var(--mb-surface-2)', color: 'var(--mb-ink)', border: '1px solid var(--mb-line)' }}
          >
            {IC.share()}
            Compartir esta página
          </button>

          <a
            href="https://www.menuby.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-1.5 text-[12.5px] font-medium group"
            style={{ color: 'var(--mb-ink-3)' }}
          >
            <span>Hecho con</span>
            <span className="font-extrabold" style={{ color: 'var(--mb-accent)' }}>MenuBy</span>
            <span className="transition-transform group-hover:translate-x-0.5">{IC.arrow('w-3.5 h-3.5')}</span>
          </a>
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
          <div
            className="rounded-[var(--mb-radius-sheet)] p-5 w-full max-w-sm"
            style={{ background: 'var(--mb-card)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-bold mb-2" style={{ color: 'var(--mb-ink)' }}>Copia el enlace</p>
            <input
              readOnly
              value={window.location.href}
              onFocus={(e) => e.target.select()}
              className="w-full h-11 px-3 rounded-xl text-[13px]"
              style={{ background: 'var(--mb-surface-2)', color: 'var(--mb-ink-2)', border: '1px solid var(--mb-line)' }}
            />
            <button
              onClick={() => setCompartiendo(false)}
              className="mt-3 w-full h-11 rounded-[var(--mb-radius-btn)] text-sm font-extrabold"
              style={{ background: 'var(--mb-accent)', color: 'var(--mb-on-accent)' }}
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

/**
 * Los banners.
 *
 * Pasan solos cada cinco segundos y se arrastran con el dedo. El automático
 * se apaga en cuanto alguien toca: si está leyendo uno, moverlo debajo del
 * dedo es quitárselo.
 *
 * Un banner sin enlace se dibuja igual pero no es clicable —hay quien los usa
 * para anunciar un horario, no para llevar a ningún lado— y así no se come un
 * toque que no lleva a nada.
 */
function Carrusel({ banners }) {
  const [actual, setActual] = useState(0);
  const [detenido, setDetenido] = useState(false);
  const inicioX = useRef(0);
  const arrastre = useRef(0);

  useEffect(() => {
    if (detenido || banners.length <= 1) return;
    const t = window.setInterval(() => setActual((i) => (i + 1) % banners.length), MS_POR_BANNER);
    return () => window.clearInterval(t);
  }, [detenido, banners.length]);

  /* Si el dueño quita banners mientras alguien tiene la página abierta, el
     índice puede quedar apuntando a uno que ya no está. */
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
    ? {
        href: b.enlace,
        /* Un enlace de afuera abre aparte; uno a un negocio propio, en la
           misma pestaña, para no dejarle al cliente un reguero de ventanas. */
        ...(/^https?:\/\//i.test(b.enlace) ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
      }
    : {};

  return (
    <div>
      <div
        className="relative rounded-[var(--mb-radius-card)] overflow-hidden"
        style={{ background: 'var(--mb-surface-2)' }}
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
              {/* Alto fijo por proporción: sin él, el carrusel pega un salto
                  cada vez que cambia a una imagen de otro tamaño. */}
              <div className="aspect-[16/7]">
                <img src={b.imagen} alt={b.titulo || ''} className="w-full h-full object-cover" />
              </div>
              {b.titulo && (
                <div className="absolute inset-x-0 bottom-0 p-3.5 bg-gradient-to-t from-black/75 to-transparent">
                  <p className="text-white font-extrabold text-[15px] leading-tight drop-shadow">{b.titulo}</p>
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
                background: i === indice ? 'var(--mb-accent)' : 'var(--mb-line)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Un número de la fila de stats. */
function Dato({ valor, etiqueta, resaltado }) {
  return (
    <div className="text-center px-0.5 sm:px-1 min-w-0">
      <span
        className="block text-[15.5px] sm:text-[17px] font-extrabold tabular-nums leading-tight"
        style={{ color: resaltado ? 'var(--mb-accent)' : 'var(--mb-ink)' }}
      >
        {valor}
      </span>
      <span className="block text-[10.5px] sm:text-[11px] font-medium truncate" style={{ color: 'var(--mb-ink-2)' }}>
        {etiqueta}
      </span>
    </div>
  );
}

/**
 * Un negocio, con la misma forma de perfil que usa el menú.
 *
 * Portada delgada, avatar con anillo montado encima, calificación y reseñas al
 * lado del nombre, y debajo su fila de lo más pedido. La idea es que el
 * cliente pueda decidir a cuál entrar sin entrar a ninguno.
 *
 * Un negocio cerrado se atenúa pero **se deja entrar**: quiere ver la carta
 * aunque no pueda pedir todavía, y bloquearlo lo manda a buscar el menú por
 * otro lado.
 */
function TarjetaNegocio({ negocio: n, tops, orden }) {
  const nota = n.reviewStats?.averageRating || 0;
  const reseñas = n.reviewStats?.totalReviews || 0;
  const direccion = [n.address, n.city].filter(Boolean).join(', ');

  /* El color del negocio, no el del portafolio.
   *
   * Antes la tarjeta usaba el acento de la vitrina para todo, así que
   * DOGGITOS —que es amarillo— salía con un botón rojo enorme que no es suyo.
   *
   * `derivePalette` además oscurece el color hasta que su propio texto se lea
   * con contraste AA, que es justo lo que hace falta con un amarillo: el
   * botón queda legible sin que nadie tenga que acordarse de elegir el color
   * de la letra. */
  const paleta = useMemo(
    () => derivePalette(n.theme?.buttonColor || '#111827'),
    [n.theme?.buttonColor],
  );

  return (
    <motion.article
      initial={{ y: 14, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, delay: Math.min(orden * 0.06, 0.24) }}
      className="rounded-[var(--mb-radius-card)] overflow-hidden"
      style={{ background: 'var(--mb-card)', border: '1px solid var(--mb-line)', boxShadow: 'var(--mb-shadow-card)' }}
    >
      <a href={`/${n.slug}`} className={`block group ${n.isOpen ? '' : 'opacity-80'}`}>
        {/* La portada es el color del negocio, no su foto.
            La foto de portada viene apaisada y aquí la franja mide 64px: el
            recorte le cortaba la cabeza al muñeco de DOGGITOS. El color se
            recorta bien a cualquier tamaño y de paso cada tarjeta se lee como
            de quién es. */}
        <div
          className="relative h-[68px] sm:h-[84px]"
          style={{ background: `linear-gradient(135deg, ${paleta.accent}, ${shade(paleta.accent, -0.3)})` }}
        >
          <span
            className="absolute top-2.5 right-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold text-white"
            style={vidrio}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${n.isOpen ? 'bg-emerald-400' : 'bg-red-400'}`} />
            {n.isOpen ? 'Abierto' : 'Cerrado'}
          </span>
        </div>

        {/* `relative z-10` no es decoración: la franja de arriba está
            posicionada y, sin esto, se pinta encima del logo aunque venga
            antes en el HTML —un elemento posicionado gana a uno que no lo
            está—. Se veía media foto de perfil tapada por el color. */}
        <div className="px-3 sm:px-4 pb-3.5 relative z-10">
          <div className="-mt-8 flex items-end gap-2.5">
            {/* La foto de perfil de cada negocio, sobre su propio color. El
                anillo va del color de la tarjeta para separarla de la franja:
                un logo con fondo claro sobre amarillo se perdía. */}
            <div
              className="w-[62px] h-[62px] sm:w-[68px] sm:h-[68px] rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center"
              style={{ border: '3px solid var(--mb-card)', background: 'var(--mb-card)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
            >
              {n.logo ? (
                <img src={n.logo} alt={`Logo de ${n.businessName}`} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <span className="text-xl font-black" style={{ color: paleta.accent }}>
                  {(n.businessName || '?').charAt(0)}
                </span>
              )}
            </div>

            {/* La calificación, a la altura del avatar: es lo que el cliente
                mira antes de decidir, igual que en el perfil del menú. Sin
                reseñas no se dibuja nada —ni "sin calificación", que se lee
                como una mala. */}
            {nota > 0 && (
              <div className="flex items-baseline gap-1 pb-1 min-w-0">
                <span className="flex items-center gap-1 text-[14.5px] font-extrabold tabular-nums" style={{ color: 'var(--mb-ink)' }}>
                  <span className="text-amber-400">{IC.star('w-3.5 h-3.5')}</span>
                  {nota.toFixed(1)}
                </span>
                {reseñas > 0 && (
                  <span className="text-[11.5px] font-medium truncate" style={{ color: 'var(--mb-ink-2)' }}>
                    ({reseñas})
                  </span>
                )}
              </div>
            )}
          </div>

          <h2 className="mt-2 text-[16.5px] sm:text-[18px] font-extrabold tracking-tight leading-tight" style={{ color: 'var(--mb-ink)' }}>
            {n.businessName}
          </h2>

          {n.description && (
            /* Dos líneas y corta. La descripción la escribe el dueño y hay
               quien pone un párrafo entero; sin tope, una tarjeta mide el
               triple que la de al lado. */
            <p className="text-[12.5px] sm:text-[13px] leading-snug line-clamp-2 mt-0.5" style={{ color: 'var(--mb-ink-2)' }}>
              {n.description}
            </p>
          )}

          {direccion && (
            <p className="flex items-center gap-1 mt-1 text-[12px] font-semibold min-w-0" style={{ color: 'var(--mb-ink-3)' }}>
              {IC.mapPin()}
              <span className="truncate">{direccion}</span>
            </p>
          )}

          {/* Con el color del negocio y no con el de la vitrina. `accent` ya
              viene con contraste garantizado contra `onAccent`, así que el
              amarillo de DOGGITOS sale con letra oscura y el rojo de FRAISE
              con letra blanca sin decidir nada acá. */}
          <span
            className="mt-3 flex items-center justify-center gap-1.5 h-10 rounded-[var(--mb-radius-btn)] text-[13.5px] font-extrabold active:scale-[0.98] transition-transform"
            style={{ background: paleta.accent, color: paleta.onAccent }}
          >
            Ver carta {IC.arrow('w-3.5 h-3.5')}
          </span>
        </div>
      </a>

      <FilaDeTops negocio={n} tops={tops} />
    </motion.article>
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
    <div className="pb-3.5" style={{ borderTop: '1px solid var(--mb-line)' }}>
      <p className="text-[12.5px] font-extrabold px-3.5 pt-3 pb-2" style={{ color: 'var(--mb-ink)' }}>
        Lo más pedido esta semana
      </p>

      {/* Desliza en horizontal y corta contra el borde: que se vea medio
          producto asomando es lo que le dice al dedo que hay más. */}
      <div className="flex gap-3 overflow-x-auto scrollbar-hide px-3.5 snap-x">
        {tops.productos.map((pr) => (
          <a key={pr._id} href={`/${negocio.slug}`} className="flex-shrink-0 w-[112px] snap-start group">
            <div
              className="relative w-[112px] h-[112px] rounded-[var(--mb-radius-btn)] overflow-hidden"
              style={{ background: 'var(--mb-surface-2)' }}
            >
              {pr.image ? (
                <img
                  src={pr.image}
                  alt={pr.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl" style={{ color: 'var(--mb-ink-3)' }}>
                  🍽️
                </div>
              )}

              {pr.esTop && (
                <span
                  className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9.5px] font-black tracking-wide"
                  style={{ background: 'var(--mb-accent)', color: 'var(--mb-on-accent)' }}
                >
                  TOP {pr.rank}
                </span>
              )}
            </div>

            <p className="text-[12.5px] font-bold leading-tight mt-1.5 line-clamp-2" style={{ color: 'var(--mb-ink)' }}>
              {pr.name}
            </p>
            <p className="text-[12.5px] font-semibold" style={{ color: 'var(--mb-ink-2)' }}>
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
      <div className="h-32 md:h-56 bg-gray-200 animate-pulse" />

      <div className={`px-4 ${ANCHO}`}>
        <div className="-mt-[42px] relative z-10 flex items-end justify-between">
          <div className="w-[92px] h-[92px] rounded-full bg-gray-300 border-[3.5px] border-gray-50 animate-pulse" />
          <div className="flex-1 flex justify-around pb-2 pl-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-4 w-10 rounded bg-gray-200 animate-pulse mx-auto" />
                <div className="h-2.5 w-12 rounded bg-gray-100 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        <div className="h-6 w-44 rounded-lg bg-gray-200 animate-pulse mt-3" />
        <div className="h-3 w-64 rounded bg-gray-100 animate-pulse mt-2" />
      </div>

      <div className={`px-4 mt-5 space-y-5 ${ANCHO}`}>
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl overflow-hidden border border-gray-100 bg-white">
            <div className="h-24 md:h-32 bg-gray-200 animate-pulse" />
            <div className="px-3.5 pb-3.5">
              <div className="-mt-7 w-[64px] h-[64px] rounded-full bg-gray-300 border-[3px] border-white animate-pulse" />
              <div className="h-4 w-36 rounded bg-gray-200 animate-pulse mt-2" />
              <div className="h-3 w-52 rounded bg-gray-100 animate-pulse mt-2" />
            </div>
            <div className="flex gap-3 px-3.5 pb-3.5 border-t border-gray-100 pt-3">
              {[0, 1, 2].map((j) => (
                <div key={j} className="space-y-1.5">
                  <div className="w-[112px] h-[112px] rounded-xl bg-gray-200 animate-pulse" />
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
