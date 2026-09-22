import { useEffect, useState } from 'react';
import api from '../../services/api';
import ImageUploader from './ImageUploader';

/**
 * Armar la vitrina: "MenuBy Tura".
 *
 * Una página con los negocios de un mismo dueño. Aquí elige cuáles salen, en
 * qué orden, y cómo se ve.
 *
 * **No toca la configuración de ningún negocio.** Cada uno conserva su panel,
 * su carta, sus precios y sus impresoras. Esto solo los agrupa para mostrarlos.
 */
export default function PortafolioManager({ businessId }) {
  /* El negocio va como parámetro **para el superadmin**.

     Un dueño normal no lo necesita: su token ya dice a qué negocio entra. El
     superadmin no —su token es suyo, no de ningún negocio— y `tenantAuth` lo
     resuelve de `?businessId=`. Sin mandarlo, el servidor no sabe de qué
     cliente es la página que se está configurando.

     Se manda siempre para no tener dos caminos: al dueño no le estorba. */
  const conNegocio = (ruta) => (businessId ? `${ruta}?businessId=${businessId}` : ruta);
  const [form, setForm] = useState({
    nombre: '',
    slug: '',
    descripcion: '',
    logo: '',
    portada: '',
    colorPrincipal: '#111827',
    colorTexto: '#ffffff',
    negocios: [],
    banners: [],
    activo: true,
  });
  const [disponibles, setDisponibles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get(conNegocio('/portafolios')).catch(() => ({ data: { portafolio: null } })),
      api.get(conNegocio('/portafolios/mios/negocios')).catch(() => ({ data: { negocios: [] } })),
    ])
      .then(([mio, negocios]) => {
        setDisponibles(negocios.data.negocios || []);
        if (mio.data.portafolio) {
          const p = mio.data.portafolio;
          setForm({
            nombre: p.nombre || '',
            slug: p.slug || '',
            descripcion: p.descripcion || '',
            logo: p.logo || '',
            portada: p.portada || '',
            colorPrincipal: p.colorPrincipal || '#111827',
            colorTexto: p.colorTexto || '#ffffff',
            negocios: (p.negocios || []).map(String),
            banners: p.banners || [],
            activo: p.activo !== false,
          });
        }
      })
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  /* Entrar y salir de la vitrina. Al entrar se va **al final**: el orden lo
     decide el dueño moviéndolos, no el azar de en qué orden los tocó. */
  const alternar = (id) => {
    setForm((f) => ({
      ...f,
      negocios: f.negocios.includes(id)
        ? f.negocios.filter((x) => x !== id)
        : [...f.negocios, id],
    }));
  };

  const mover = (id, delta) => {
    setForm((f) => {
      const i = f.negocios.indexOf(id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= f.negocios.length) return f;
      const copia = [...f.negocios];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return { ...f, negocios: copia };
    });
  };

  /* ── Banners ────────────────────────────────────────────────────── */

  const agregarBanner = () =>
    setForm((f) => ({
      ...f,
      banners: [...f.banners, { imagen: '', titulo: '', enlace: '', activo: true }],
    }));

  const cambiarBanner = (i, campo, valor) =>
    setForm((f) => ({
      ...f,
      banners: f.banners.map((b, j) => (j === i ? { ...b, [campo]: valor } : b)),
    }));

  const quitarBanner = (i) =>
    setForm((f) => ({ ...f, banners: f.banners.filter((_, j) => j !== i) }));

  const moverBanner = (i, delta) => {
    setForm((f) => {
      const j = i + delta;
      if (j < 0 || j >= f.banners.length) return f;
      const copia = [...f.banners];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return { ...f, banners: copia };
    });
  };

  const guardar = async () => {
    setGuardando(true);
    setError('');
    setAviso('');
    try {
      /* Los banners sin imagen se caen acá y no solo en el servidor, para que
         el dueño vea desaparecer el que dejó a medias en vez de descubrir
         después que no se guardó. */
      const limpio = { ...form, banners: form.banners.filter((b) => b.imagen.trim()) };
      await api.put(conNegocio('/portafolios'), limpio);
      setForm(limpio);
      setAviso('Guardado');
      window.setTimeout(() => setAviso(''), 4000);
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-400" />
      </div>
    );
  }

  const enVitrina = form.negocios
    .map((id) => disponibles.find((n) => String(n._id) === id))
    .filter(Boolean);
  const fuera = disponibles.filter((n) => !form.negocios.includes(String(n._id)));

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      <div>
        <h2 className="text-xl font-black text-slate-800">Tu página de negocios</h2>
        <p className="text-sm text-slate-500">
          Una sola dirección donde tus clientes ven todos tus negocios y entran al que quieran.
        </p>
      </div>

      {disponibles.length <= 1 && (
        /* Sin al menos dos negocios esta pantalla no tiene nada que hacer, y
           decirlo es mejor que dejarlo armar una vitrina de uno solo. */
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-[13px] text-amber-800">
          Solo tienes un negocio a tu nombre. Esta página cobra sentido con dos o más;
          si administras otros, pide que los asocien a tu cuenta.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
        <label className="block">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nombre</span>
          <input
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="MenuBy Tura"
            className="mt-1 w-full h-11 px-3 rounded-xl border-2 border-slate-200 outline-none focus:border-slate-400"
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Dirección</span>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm text-slate-400 flex-shrink-0">menuby.tech/p/</span>
            <input
              value={form.slug}
              onChange={(e) =>
                /* Se limpia mientras escribe y no al guardar: así ve de una qué
                   dirección va a quedar, en vez de que el servidor se la
                   cambie por detrás. */
                setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })
              }
              placeholder="tura"
              className="flex-1 h-11 px-3 rounded-xl border-2 border-slate-200 outline-none focus:border-slate-400"
            />
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Descripción</span>
          <input
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Los sabores de Buenaventura"
            maxLength={300}
            className="mt-1 w-full h-11 px-3 rounded-xl border-2 border-slate-200 outline-none focus:border-slate-400"
          />
        </label>

        {/* Logo y portada ya los dibujaba la página pública, pero esta
            pantalla nunca los pidió: el logo se quedaba vacío para siempre y
            la portada era peor —al no venir en el formulario, cada "Guardar"
            la sobrescribía con vacío—. */}
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Logo</span>
            <p className="text-[11.5px] text-slate-400 leading-snug mb-1">
              Redondo, arriba del todo. Cuadrado se ve mejor.
            </p>
            <ImageUploader
              value={form.logo}
              onChange={(url) => setForm({ ...form, logo: url })}
              folder="logos"
              maxWidth={400}
              previewClassName="w-full h-28"
              previewFit="contain"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Portada</span>
            <p className="text-[11.5px] text-slate-400 leading-snug mb-1">
              La franja de arriba. Sin ella se usa tu color de fondo.
            </p>
            <ImageUploader
              value={form.portada}
              onChange={(url) => setForm({ ...form, portada: url })}
              folder="covers"
              maxWidth={1400}
              previewClassName="w-full h-28"
            />
          </label>
        </div>

        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Fondo</span>
            <input
              type="color"
              value={form.colorPrincipal}
              onChange={(e) => setForm({ ...form, colorPrincipal: e.target.value })}
              className="w-10 h-10 rounded-lg border border-slate-200"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Texto</span>
            <input
              type="color"
              value={form.colorTexto}
              onChange={(e) => setForm({ ...form, colorTexto: e.target.value })}
              className="w-10 h-10 rounded-lg border border-slate-200"
            />
          </label>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
          En la página ({enVitrina.length})
        </p>

        {enVitrina.length === 0 && (
          <p className="text-[13px] text-slate-400 py-2">
            Todavía no has agregado ninguno. Elígelos abajo.
          </p>
        )}

        {enVitrina.map((n, i) => (
          <div key={n._id} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50">
            <span className="w-6 text-center text-xs font-black text-slate-400 tabular-nums">
              {i + 1}
            </span>
            {n.logo && <img src={n.logo} alt="" className="w-9 h-9 rounded-lg object-cover" />}
            <span className="flex-1 min-w-0 text-[14px] font-bold truncate">{n.businessName}</span>

            <button
              onClick={() => mover(String(n._id), -1)}
              disabled={i === 0}
              aria-label="Subir"
              className="w-9 h-9 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30"
            >
              ↑
            </button>
            <button
              onClick={() => mover(String(n._id), 1)}
              disabled={i === enVitrina.length - 1}
              aria-label="Bajar"
              className="w-9 h-9 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30"
            >
              ↓
            </button>
            <button
              onClick={() => alternar(String(n._id))}
              className="w-9 h-9 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
              aria-label="Quitar"
            >
              ×
            </button>
          </div>
        ))}

        {fuera.length > 0 && (
          <>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide pt-2">
              Tus otros negocios
            </p>
            {fuera.map((n) => (
              <button
                key={n._id}
                onClick={() => alternar(String(n._id))}
                className="w-full flex items-center gap-2 p-2 rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-300 text-left"
              >
                {n.logo && <img src={n.logo} alt="" className="w-9 h-9 rounded-lg object-cover" />}
                <span className="flex-1 min-w-0 text-[14px] font-semibold text-slate-600 truncate">
                  {n.businessName}
                </span>
                <span className="text-xs font-bold text-slate-400">Agregar</span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* ── Banners ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
            Banners ({form.banners.length})
          </p>
          <p className="text-[12.5px] text-slate-500 mt-0.5">
            Van entre tu nombre y los negocios, y pasan solos cada 5 segundos.
            Para promociones, horarios especiales o para llevar a uno de tus negocios.
          </p>
        </div>

        {form.banners.map((b, i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-400 tabular-nums">#{i + 1}</span>
              <span className="flex-1" />
              <button
                onClick={() => moverBanner(i, -1)}
                disabled={i === 0}
                aria-label="Subir"
                className="w-9 h-9 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                onClick={() => moverBanner(i, 1)}
                disabled={i === form.banners.length - 1}
                aria-label="Bajar"
                className="w-9 h-9 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30"
              >
                ↓
              </button>
              <button
                onClick={() => quitarBanner(i)}
                aria-label="Quitar banner"
                className="w-9 h-9 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
              >
                ×
              </button>
            </div>

            <ImageUploader
              value={b.imagen}
              onChange={(url) => cambiarBanner(i, 'imagen', url)}
              folder="banners"
              maxWidth={1600}
              previewClassName="w-full h-32"
            />

            <input
              value={b.titulo}
              onChange={(e) => cambiarBanner(i, 'titulo', e.target.value)}
              placeholder="Texto sobre la imagen (opcional)"
              maxLength={80}
              className="w-full h-10 px-3 rounded-xl border-2 border-slate-200 text-[13.5px] outline-none focus:border-slate-400"
            />

            <input
              value={b.enlace}
              onChange={(e) => cambiarBanner(i, 'enlace', e.target.value)}
              placeholder="A dónde lleva: /doggitos o https://… (opcional)"
              maxLength={300}
              className="w-full h-10 px-3 rounded-xl border-2 border-slate-200 text-[13.5px] outline-none focus:border-slate-400"
            />

            <button
              onClick={() => cambiarBanner(i, 'activo', b.activo === false)}
              className="flex items-center gap-2.5 text-left w-full"
            >
              <span
                className={`w-10 h-6 rounded-full flex-shrink-0 relative transition-colors ${
                  b.activo !== false ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                    b.activo !== false ? 'left-[18px]' : 'left-0.5'
                  }`}
                />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-slate-700">
                  {b.activo !== false ? 'Visible' : 'Oculto'}
                </span>
                <span className="block text-[11.5px] text-slate-400 leading-snug">
                  Oculto se guarda pero no sale en la página. Sirve para dejar listo el de la próxima promoción.
                </span>
              </span>
            </button>
          </div>
        ))}

        {form.banners.length < 8 ? (
          <button
            onClick={agregarBanner}
            className="w-full h-11 rounded-xl border-2 border-dashed border-slate-200 text-[13.5px] font-bold text-slate-500 hover:border-slate-300"
          >
            + Agregar banner
          </button>
        ) : (
          <p className="text-[12.5px] text-slate-400">Ocho es el tope. Nadie desliza más que eso.</p>
        )}
      </div>

      {error && <p className="text-[13px] font-semibold text-red-600">{error}</p>}
      {aviso && <p className="text-[13px] font-semibold text-emerald-600">{aviso}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={guardar}
          disabled={guardando || !form.nombre.trim() || !form.slug.trim()}
          className="h-12 px-6 rounded-xl bg-slate-900 text-white font-black disabled:opacity-40"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>

        {form.slug && (
          <a
            href={`/p/${form.slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] font-semibold text-slate-500 underline"
          >
            Ver la página
          </a>
        )}
      </div>
    </div>
  );
}
