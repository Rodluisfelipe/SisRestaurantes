import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MAP_ATTRIBUTION, MAP_TILE_URL } from '../../utils/mapTiles';
import { pesos, repartoApi } from '../../services/repartoApi';

/**
 * El seguimiento de un envío, para quien lo recibe (sin cuenta ni sesión).
 * Lo más importante arriba y grande: en qué va y el código que le tiene que
 * dictar al domi. Se actualiza solo cada 10 segundos.
 */
const PASOS = [
  { id: 'buscando', texto: 'Buscando domiciliario' },
  { id: 'va_a_recoger', texto: 'Va a recoger tu envío' },
  { id: 'en_camino', texto: 'En camino hacia ti' },
  { id: 'entregado', texto: 'Entregado' },
];
const ORDEN = { buscando: 0, va_a_recoger: 1, recogiendo: 1, en_camino: 2, llegando: 2, entregado: 3 };

const icono = (html) => L.divIcon({ className: '', html, iconSize: [36, 36], iconAnchor: [18, 18] });

export default function SeguimientoEnvio() {
  const { token } = useParams();
  const [s, setS] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const api = repartoApi();
    const cargar = () => api.get(`/seguimiento/${token}`).then(({ data }) => setS(data)).catch((e) => setError(e.response?.data?.message || 'No encontramos este envío.'));
    cargar();
    const t = setInterval(cargar, 10000);
    return () => clearInterval(t);
  }, [token]);

  const moto = useMemo(() => icono('<div style="width:36px;height:36px;border-radius:50%;background:#0E0E10;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 12px rgba(0,0,0,.3)">🛵</div>'), []);
  const casa = useMemo(() => icono('<div style="width:36px;height:36px;border-radius:50%;background:#fff;border:3px solid #0E0E10;display:flex;align-items:center;justify-content:center;font-size:18px">🏠</div>'), []);

  if (error) return <div className="min-h-screen flex items-center justify-center p-6 text-center"><div><p className="text-5xl" aria-hidden>📦</p><h1 className="mt-3 text-xl font-extrabold">{error}</h1></div></div>;
  if (!s) return <div className="min-h-screen bg-slate-50 animate-pulse" />;

  const color = s.empresa?.color || '#E11D2A';
  const paso = ORDEN[s.etapa] ?? 0;
  const final = ['entregado', 'no_entregado', 'cancelado'].includes(s.etapa);
  const titulo = {
    buscando: 'Estamos buscando un domiciliario', va_a_recoger: `${s.domi?.nombre || 'El domiciliario'} va a recoger tu envío`,
    recogiendo: `${s.domi?.nombre || 'El domiciliario'} está recogiendo tu envío`, en_camino: `${s.domi?.nombre || 'Tu domiciliario'} va en camino`,
    llegando: `${s.domi?.nombre || 'Tu domiciliario'} está llegando`, entregado: '¡Entregado!', no_entregado: 'No se pudo entregar', cancelado: 'Este envío se canceló',
  }[s.etapa] || 'Tu envío';
  const wa = (s.empresa?.telefono || '').replace(/\D/g, '');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" data-testid="seguimiento">
      <header className="text-white" style={{ background: color }}>
        <div className="max-w-md mx-auto px-5 pt-6 pb-16">
          <p className="text-sm font-semibold text-white/80">{s.empresa?.nombre} · Envío #{s.numero}</p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight">{titulo}</h1>
        </div>
      </header>
      <main className="max-w-md mx-auto px-5 -mt-10 pb-10 space-y-4">
        {s.codigoEntrega && !final && (
          <div className="bg-white rounded-2xl p-5 shadow-lg text-center" data-testid="codigo-entrega">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Tu código de entrega</p>
            <p className="mt-1 text-5xl font-black tracking-[0.3em] tabular-nums">{s.codigoEntrega}</p>
            <p className="mt-2 text-sm text-slate-500">Díselo al domiciliario cuando te entregue. No lo compartas antes.</p>
            {s.valorACobrar > 0 && <p className="mt-3 inline-block px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 text-sm font-bold">Ten listos {pesos(s.valorACobrar)}</p>}
          </div>
        )}

        {!['no_entregado', 'cancelado'].includes(s.etapa) && (
          <div className="bg-white rounded-2xl p-5 border border-slate-100">
            <ol className="space-y-3">
              {PASOS.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i <= paso ? 'text-white' : 'bg-slate-100 text-slate-400'}`} style={i <= paso ? { background: color } : undefined}>{i < paso || (i === paso && final) ? '✓' : i + 1}</span>
                  <span className={`text-[15px] ${i === paso ? 'font-extrabold' : i < paso ? 'text-slate-500' : 'text-slate-400'}`}>{p.texto}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {s.motivoFalla && <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-sm text-rose-700">{s.motivoFalla}</div>}

        {s.domi && !final && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 flex items-center gap-3">
            {s.domi.foto ? <img src={s.domi.foto} alt="" className="w-14 h-14 rounded-full object-cover" /> : <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-2xl" aria-hidden>🛵</div>}
            <div className="flex-1">
              <p className="font-extrabold">{s.domi.nombre}</p>
              <p className="text-sm text-slate-500">★ {Number(s.domi.calificacion || 5).toFixed(1)}{s.domi.vehiculo?.placa ? ` · ${s.domi.vehiculo.placa}` : ''}</p>
            </div>
          </div>
        )}

        {(s.ubicacionDomi || s.destino?.ubicacion) && !final && (
          <div className="h-64 rounded-2xl overflow-hidden border border-slate-100">
            <MapContainer center={[(s.ubicacionDomi || s.destino.ubicacion).lat, (s.ubicacionDomi || s.destino.ubicacion).lng]} zoom={15} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
              <TileLayer url={MAP_TILE_URL} attribution={MAP_ATTRIBUTION} />
              {s.destino?.ubicacion && <Marker position={[s.destino.ubicacion.lat, s.destino.ubicacion.lng]} icon={casa} />}
              {s.ubicacionDomi && <Marker position={[s.ubicacionDomi.lat, s.ubicacionDomi.lng]} icon={moto} />}
            </MapContainer>
          </div>
        )}

        <div className="bg-white rounded-2xl p-4 border border-slate-100 text-sm space-y-1">
          <p><span className="text-slate-400">De</span> {s.origen?.nombre || s.origen?.direccion}</p>
          <p><span className="text-slate-400">Para</span> {s.destino?.nombre} · {s.destino?.direccion}</p>
        </div>

        {wa && <a href={`https://wa.me/${wa.length === 10 ? `57${wa}` : wa}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-12 rounded-xl border-2 border-slate-200 font-bold text-slate-700">Escribir a {s.empresa?.nombre}</a>}
        <p className="text-center text-xs text-slate-400">Tecnología de <a href="https://menuby.tech" className="font-bold">MenuBy</a></p>
      </main>
    </div>
  );
}
