import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { guardarSesionReparto, pesos, repartoApi, sesionReparto } from '../../services/repartoApi';

/**
 * La página pública de una empresa de reparto: menuby.tech/reparto/<slug>.
 *
 * Presenta la empresa (qué hace, dónde, desde cuánto) y deja entrar a sus
 * clientes con el usuario que ella misma les dio. Pedir es solo para
 * clientes: la empresa decide a quién le trabaja.
 */
export default function EmpresaReparto() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [empresa, setEmpresa] = useState(null);
  const [error, setError] = useState('');
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [errorEntrar, setErrorEntrar] = useState('');
  const yaEntro = !!sesionReparto(slug)?.token;

  useEffect(() => {
    repartoApi(slug).get(`/empresa/${slug}`)
      .then(({ data }) => { setEmpresa(data); document.title = `${data.nombre} · Domicilios`; })
      .catch((e) => setError(e.response?.data?.message || 'No pudimos cargar esta página.'));
  }, [slug]);

  const entrar = async (e) => {
    e.preventDefault();
    setEntrando(true);
    setErrorEntrar('');
    try {
      const { data } = await repartoApi(slug).post(`/empresa/${slug}/entrar`, { usuario, clave });
      guardarSesionReparto(slug, { token: data.token, cliente: data.cliente });
      navigate(`/reparto/${slug}/panel`);
    } catch (err) {
      setErrorEntrar(err.response?.data?.message || 'No se pudo entrar. Intenta de nuevo.');
    } finally {
      setEntrando(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="text-center max-w-sm">
          <p className="text-5xl mb-3" aria-hidden>🛵</p>
          <h1 className="text-xl font-extrabold text-slate-900">{error}</h1>
          <p className="text-sm text-slate-500 mt-2">Revisa el enlace que te compartieron.</p>
        </div>
      </div>
    );
  }
  if (!empresa) return <div className="min-h-screen bg-slate-50 animate-pulse" />;

  const color = empresa.landing?.color || '#E11D2A';
  const wa = (empresa.landing?.whatsapp || empresa.telefono || '').replace(/\D/g, '');
  const waUrl = wa ? `https://wa.me/${wa.length === 10 ? `57${wa}` : wa}?text=${encodeURIComponent(`Hola ${empresa.nombre}, quiero ser cliente para mis envíos.`)}` : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" data-testid="empresa-reparto">
      <header className="relative overflow-hidden text-white" style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}>
        <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-white/10" aria-hidden />
        <div className="absolute right-24 bottom-[-80px] w-56 h-56 rounded-full bg-white/10" aria-hidden />
        <div className="relative max-w-5xl mx-auto px-5 pt-8 pb-14">
          <div className="flex items-center gap-3">
            {empresa.logo
              ? <img src={empresa.logo} alt="" className="w-12 h-12 rounded-xl object-cover bg-white" />
              : <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl" aria-hidden>🛵</div>}
            <p className="font-bold text-lg">{empresa.nombre}</p>
          </div>
          <h1 className="mt-8 text-3xl sm:text-5xl font-extrabold leading-tight max-w-2xl">
            {empresa.landing?.descripcion || `Domicilios rápidos con ${empresa.nombre}`}
          </h1>
          <div className="mt-5 flex flex-wrap gap-2 text-[13px] font-semibold">
            {empresa.landing?.ciudad && <span className="px-3 py-1.5 rounded-full bg-white/15">📍 {empresa.landing.ciudad}</span>}
            {empresa.landing?.horario && <span className="px-3 py-1.5 rounded-full bg-white/15">🕘 {empresa.landing.horario}</span>}
            {empresa.domiciliarios > 0 && <span className="px-3 py-1.5 rounded-full bg-white/15">🛵 {empresa.domiciliarios} {empresa.domiciliarios === 1 ? 'domiciliario' : 'domiciliarios'}</span>}
            {empresa.desde && <span className="px-3 py-1.5 rounded-full bg-white text-slate-900">Envíos desde {pesos(empresa.desde)}</span>}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-5 -mt-8 pb-16 grid lg:grid-cols-5 gap-5">
        <section className="lg:col-span-3 space-y-5">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <h2 className="text-lg font-extrabold">Así funciona</h2>
            <ol className="mt-4 space-y-4">
              {[
                ['Pides desde aquí', 'Pones dónde recoger y a quién entregar. Ves el precio antes de pedir.'],
                ['Un domiciliario lo recoge', `El más cercano de ${empresa.nombre} sale a tu dirección.`],
                ['Quien recibe lo sigue en vivo', 'Le mandas un enlace con el mapa y su código de entrega.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="w-8 h-8 shrink-0 rounded-full text-white font-bold flex items-center justify-center" style={{ background: color }}>{i + 1}</span>
                  <div><p className="font-bold">{t}</p><p className="text-sm text-slate-500">{d}</p></div>
                </li>
              ))}
            </ol>
          </div>

          {(empresa.zonas?.length > 0 || empresa.porKm) && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <h2 className="text-lg font-extrabold">Precios</h2>
              {empresa.zonas?.length > 0 && (
                <div className="mt-3 divide-y divide-slate-100">
                  {empresa.zonas.map((z) => (
                    <div key={z.nombre} className="flex justify-between py-2.5 text-[15px]"><span>{z.nombre}</span><span className="font-bold">{pesos(z.precio)}</span></div>
                  ))}
                </div>
              )}
              {empresa.porKm && (
                <p className="mt-3 text-sm text-slate-500">
                  Fuera de las zonas: desde {pesos(empresa.desde)} + {pesos(empresa.porKm)} por km{empresa.maximoKm ? `, hasta ${empresa.maximoKm} km` : ''}.
                </p>
              )}
              {empresa.landing?.cobertura && <p className="mt-2 text-sm text-slate-500">Cubrimos: {empresa.landing.cobertura}</p>}
            </div>
          )}
        </section>

        <aside className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100 lg:sticky lg:top-5">
            {yaEntro ? (
              <>
                <h2 className="text-lg font-extrabold">¡Hola de nuevo!</h2>
                <p className="text-sm text-slate-500 mt-1">Ya tienes tu sesión abierta.</p>
                <button onClick={() => navigate(`/reparto/${slug}/panel`)} className="mt-4 w-full h-12 rounded-xl text-white font-bold" style={{ background: color }}>Pedir un domi</button>
              </>
            ) : (
              <form onSubmit={entrar} className="space-y-3">
                <h2 className="text-lg font-extrabold">Soy cliente</h2>
                <p className="text-sm text-slate-500 -mt-1">Entra con el usuario que te dio {empresa.nombre}.</p>
                <input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="Celular o correo" autoComplete="username"
                  className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-slate-400 outline-none" data-testid="usuario" />
                <input value={clave} onChange={(e) => setClave(e.target.value)} type="password" placeholder="Clave" autoComplete="current-password"
                  className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-slate-400 outline-none" data-testid="clave" />
                {errorEntrar && <p className="text-sm font-semibold text-rose-600">{errorEntrar}</p>}
                <button disabled={entrando || !usuario || !clave} className="w-full h-12 rounded-xl text-white font-bold disabled:opacity-50" style={{ background: color }} data-testid="entrar">
                  {entrando ? 'Entrando…' : 'Entrar'}
                </button>
              </form>
            )}
            {waUrl && (
              <a href={waUrl} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-slate-200 text-sm font-bold text-slate-700">
                ¿Aún no eres cliente? Escríbenos
              </a>
            )}
          </div>
        </aside>
      </main>
      <footer className="text-center text-xs text-slate-400 pb-8">Tecnología de <a href="https://menuby.tech" className="font-bold text-slate-500">MenuBy</a></footer>
    </div>
  );
}
