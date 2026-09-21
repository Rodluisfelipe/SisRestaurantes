import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

/**
 * La vitrina de un dueño con varios negocios.
 *
 * Es "MenuBy Tura": una página con las tarjetas de los negocios de una misma
 * persona, cada una llevando a su menú de siempre. No es un marketplace —no
 * hay negocios de terceros— y no es un selector de sucursales: son negocios
 * distintos que no comparten carta ni precios.
 *
 * Lo único que hace es mostrarlos y dejar entrar. Toda la configuración de
 * cada uno sigue en su propio panel.
 */
export default function PortafolioPublico() {
  const { slug } = useParams();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;

    api.get(`/portafolios/${slug}`)
      .then((r) => { if (vigente) setDatos(r.data); })
      .catch((e) => {
        if (!vigente) return;
        setError(e?.response?.status === 404 ? 'Esta página no existe' : 'No se pudo cargar');
      })
      .finally(() => { if (vigente) setCargando(false); });

    /* Si el cajero cambia de dirección antes de que responda, la respuesta
       vieja no puede pisar la nueva. */
    return () => { vigente = false; };
  }, [slug]);

  useEffect(() => {
    if (datos?.portafolio?.nombre) document.title = datos.portafolio.nombre;
  }, [datos]);

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
        <p className="text-lg font-black text-slate-700">{error}</p>
        <Link to="/restaurantes" className="text-sm font-semibold text-slate-500 underline">
          Ver todos los restaurantes
        </Link>
      </div>
    );
  }

  const { portafolio: p, negocios } = datos;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* La cabecera lleva los colores del portafolio, no los de ninguno de
          sus negocios: tiene identidad propia, que es la razón de existir. */}
      <header
        className="px-6 pt-10 pb-12 text-center"
        style={{ backgroundColor: p.colorPrincipal, color: p.colorTexto }}
      >
        {p.logo && (
          <img
            src={p.logo}
            alt=""
            className="w-20 h-20 rounded-2xl object-cover mx-auto mb-4 shadow-lg ring-4 ring-white/20"
          />
        )}
        <h1 className="text-2xl sm:text-3xl font-black">{p.nombre}</h1>
        {p.descripcion && (
          <p className="mt-2 text-sm opacity-80 max-w-md mx-auto">{p.descripcion}</p>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-4 -mt-6 pb-16">
        {negocios.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Todavía no hay negocios para mostrar
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {negocios.map((n) => (
              /* Un enlace normal y no `Link`: el menú de cada negocio vive en
                 su propia dirección y puede estar en otro dominio. */
              <a
                key={n._id}
                href={`/${n.slug}`}
                className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="h-28 bg-slate-100 relative">
                  {n.coverImage && (
                    <img src={n.coverImage} alt="" className="w-full h-full object-cover" />
                  )}
                  {/* Abierto o cerrado, de un vistazo: es lo primero que
                      alguien con hambre necesita saber. */}
                  <span
                    className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      n.isOpen ? 'bg-emerald-500 text-white' : 'bg-slate-700/80 text-white'
                    }`}
                  >
                    {n.isOpen ? 'Abierto' : 'Cerrado'}
                  </span>
                </div>

                <div className="p-4 flex items-center gap-3">
                  {n.logo && (
                    <img
                      src={n.logo}
                      alt=""
                      className="w-12 h-12 rounded-xl object-cover flex-shrink-0 -mt-8 ring-4 ring-white shadow"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-slate-800 truncate">{n.businessName}</p>
                    {n.description && (
                      <p className="text-[12px] text-slate-400 truncate">{n.description}</p>
                    )}
                  </div>
                  <span className="text-slate-300 group-hover:text-slate-500 transition-colors">›</span>
                </div>
              </a>
            ))}
          </div>
        )}

        <p className="text-center text-[11px] text-slate-400 mt-8">
          Hecho con MenuBy
        </p>
      </main>
    </div>
  );
}
