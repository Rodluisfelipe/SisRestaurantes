import { useCallback, useEffect, useState } from 'react';
import superadminApi from '../../services/superadminApi';
import { SAToast } from './ui';

/**
 * La tarifa de la Red MenuBy: cuánto gana un domi independiente por pedido.
 *
 * Se ajusta viendo el efecto: el simulador calcula con los valores que están
 * en pantalla (aunque no se hayan guardado), con desglose, y la tabla de
 * ejemplos muestra de una vez distancias cortas y largas en hora normal, pico
 * y noche. Nadie debería cambiar una tarifa a ciegas.
 */
const fmt = (n) => `$${Math.round(n || 0).toLocaleString('es-CO')}`;

const CAMPOS = [
  { k: 'base', t: 'Tarifa base', u: '$' },
  { k: 'porKm', t: 'Por km de entrega', u: '$' },
  { k: 'kmIncluidos', t: 'Km incluidos en la base', u: 'km' },
  { k: 'porKmRecogida', t: 'Por km para ir a recoger', u: '$' },
  { k: 'recogidaGratisKm', t: 'Km de recogida sin cobro', u: 'km' },
  { k: 'minimo', t: 'Mínimo por pedido', u: '$' },
  { k: 'maximo', t: 'Máximo por pedido', u: '$' },
  { k: 'redondeo', t: 'Redondear a', u: '$' },
  { k: 'comisionPorcentaje', t: 'Comisión de MenuBy al negocio', u: '%' },
];

export default function TarifaRed() {
  const [tarifa, setTarifa] = useState(null);
  const [original, setOriginal] = useState('');
  const [lluviaHasta, setLluviaHasta] = useState(null);
  const [sim, setSim] = useState({ kmEntrega: 3.5, kmRecogida: 1.2, hora: '12:30', lluvia: false, demanda: 2, oferta: 3 });
  const [resultado, setResultado] = useState(null);
  const [ejemplos, setEjemplos] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState({ visible: false, type: 'success', message: '' });

  const cargar = useCallback(async () => {
    const { data } = await superadminApi.get('/red/config');
    setTarifa(data.tarifa);
    setOriginal(JSON.stringify(data.tarifa));
    setLluviaHasta(data.lluviaHasta);
  }, []);
  useEffect(() => { cargar().catch(() => {}); }, [cargar]);

  // Simulador y ejemplos con lo que está en pantalla
  useEffect(() => {
    if (!tarifa) return undefined;
    const t = setTimeout(async () => {
      try {
        const { data } = await superadminApi.post('/red/simular', { ...sim, tarifa });
        setResultado(data);
        const filas = [];
        for (const km of [1.5, 3, 5, 8]) {
          const fila = { km };
          for (const [nombre, hora] of [['normal', '16:00'], ['pico', '12:30'], ['noche', '23:00']]) {
            const r = await superadminApi.post('/red/simular', { kmEntrega: km, kmRecogida: 1, hora, tarifa });
            fila[nombre] = r.data.pagoDomi;
          }
          filas.push(fila);
        }
        setEjemplos(filas);
      } catch { /* sin conexión */ }
    }, 350);
    return () => clearTimeout(t);
  }, [tarifa, sim]);

  const guardar = async (extra = {}) => {
    setGuardando(true);
    try {
      const { data } = await superadminApi.put('/red/config', { tarifa, ...extra });
      setTarifa(data.tarifa);
      setOriginal(JSON.stringify(data.tarifa));
      setLluviaHasta(data.lluviaHasta);
      setToast({ visible: true, type: 'success', message: 'Tarifa guardada. Aplica a las próximas ofertas.' });
    } catch (e) {
      setToast({ visible: true, type: 'error', message: e?.response?.data?.message || 'No se pudo guardar' });
    } finally {
      setGuardando(false);
    }
  };

  if (!tarifa) return <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />;
  const cambio = JSON.stringify(tarifa) !== original;
  const poner = (k, v) => setTarifa((t) => ({ ...t, [k]: v }));

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 space-y-4">
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${lluviaHasta ? 'bg-sky-50 border-sky-200' : 'bg-white border-slate-200'}`}>
          <span className="text-2xl" aria-hidden>🌧️</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-800">{lluviaHasta ? 'Recargo por lluvia activo' : 'Recargo por lluvia apagado'}</p>
            <p className="text-xs text-slate-500">{lluviaHasta ? `Se apaga solo a las ${new Date(lluviaHasta).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}` : `Cuando llueve, los domis ganan ×${tarifa.lluvia} para que salgan igual.`}</p>
          </div>
          {lluviaHasta
            ? <button onClick={() => guardar({ lluviaHoras: 0 })} className="h-9 px-3 rounded-lg border border-sky-300 text-sky-800 text-xs font-bold">Apagar</button>
            : [2, 4].map((h) => <button key={h} onClick={() => guardar({ lluviaHoras: h })} className="h-9 px-3 rounded-lg bg-sky-600 text-white text-xs font-bold">Está lloviendo · {h} h</button>)}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-sm font-bold text-slate-800 mb-3">Valores</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {CAMPOS.map((c) => (
              <label key={c.k} className="text-xs text-slate-500">
                {c.t}
                <div className="mt-1 flex items-center rounded-lg border border-slate-200 focus-within:border-slate-400">
                  {c.u === '$' && <span className="pl-2 text-slate-400">$</span>}
                  <input type="number" min="0" step="any" value={tarifa[c.k]} onChange={(e) => poner(c.k, Number(e.target.value))} className="w-full h-9 px-2 text-sm font-semibold text-slate-800 rounded-lg outline-none" />
                  {c.u !== '$' && <span className="pr-2 text-slate-400">{c.u}</span>}
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-bold text-slate-800">Recargos (multiplican el total)</p>
          {tarifa.horasPico.map((f, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="w-24 font-semibold text-slate-700">Hora pico {i + 1}</span>
              <input type="time" value={f.desde} onChange={(e) => poner('horasPico', tarifa.horasPico.map((x, j) => (j === i ? { ...x, desde: e.target.value } : x)))} className="h-9 px-2 rounded-lg border border-slate-200" />
              a
              <input type="time" value={f.hasta} onChange={(e) => poner('horasPico', tarifa.horasPico.map((x, j) => (j === i ? { ...x, hasta: e.target.value } : x)))} className="h-9 px-2 rounded-lg border border-slate-200" />
              ×<input type="number" step="0.05" min="1" max="3" value={f.factor} onChange={(e) => poner('horasPico', tarifa.horasPico.map((x, j) => (j === i ? { ...x, factor: Number(e.target.value) } : x)))} className="w-20 h-9 px-2 rounded-lg border border-slate-200" />
              <button onClick={() => poner('horasPico', tarifa.horasPico.filter((_, j) => j !== i))} className="text-rose-600 font-semibold">Quitar</button>
            </div>
          ))}
          {tarifa.horasPico.length < 6 && <button onClick={() => poner('horasPico', [...tarifa.horasPico, { desde: '17:00', hasta: '19:00', factor: 1.1 }])} className="text-xs font-bold text-slate-700">+ Agregar hora pico</button>}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="w-24 font-semibold text-slate-700">Noche</span>
            <input type="time" value={tarifa.noche.desde} onChange={(e) => poner('noche', { ...tarifa.noche, desde: e.target.value })} className="h-9 px-2 rounded-lg border border-slate-200" />
            a
            <input type="time" value={tarifa.noche.hasta} onChange={(e) => poner('noche', { ...tarifa.noche, hasta: e.target.value })} className="h-9 px-2 rounded-lg border border-slate-200" />
            ×<input type="number" step="0.05" min="1" max="3" value={tarifa.noche.factor} onChange={(e) => poner('noche', { ...tarifa.noche, factor: Number(e.target.value) })} className="w-20 h-9 px-2 rounded-lg border border-slate-200" />
          </div>
          <div className="grid sm:grid-cols-4 gap-3 text-xs text-slate-500">
            <label>Lluvia ×<input type="number" step="0.05" min="1" max="3" value={tarifa.lluvia} onChange={(e) => poner('lluvia', Number(e.target.value))} className="mt-1 w-full h-9 px-2 rounded-lg border border-slate-200 text-slate-800 font-semibold" /></label>
            <label>Sensibilidad a la demanda<input type="number" step="0.05" min="0" max="1" value={tarifa.demanda.sensibilidad} onChange={(e) => poner('demanda', { ...tarifa.demanda, sensibilidad: Number(e.target.value) })} className="mt-1 w-full h-9 px-2 rounded-lg border border-slate-200 text-slate-800 font-semibold" /></label>
            <label>Demanda máx. ×<input type="number" step="0.05" min="1" max="3" value={tarifa.demanda.maximo} onChange={(e) => poner('demanda', { ...tarifa.demanda, maximo: Number(e.target.value) })} className="mt-1 w-full h-9 px-2 rounded-lg border border-slate-200 text-slate-800 font-semibold" /></label>
            <label>Techo total ×<input type="number" step="0.05" min="1" max="3" value={tarifa.multiplicadorMaximo} onChange={(e) => poner('multiplicadorMaximo', Number(e.target.value))} className="mt-1 w-full h-9 px-2 rounded-lg border border-slate-200 text-slate-800 font-semibold" /></label>
          </div>
          <p className="text-2xs text-slate-400">Pico y noche no se suman: manda el mayor. Con lluvia, hora y demanda a la vez, el total nunca pasa el techo.</p>
        </div>

        <div className="flex gap-2 justify-end">
          {cambio && <button onClick={() => setTarifa(JSON.parse(original))} className="h-10 px-4 rounded-lg border border-slate-200 text-xs font-bold text-slate-600">Descartar</button>}
          <button disabled={!cambio || guardando} onClick={() => guardar()} className="h-10 px-5 rounded-lg bg-slate-900 text-white text-xs font-bold disabled:opacity-40">{guardando ? 'Guardando…' : 'Guardar tarifa'}</button>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-bold text-slate-800">Simulador</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
            <label>Km al cliente<input type="number" step="0.1" value={sim.kmEntrega} onChange={(e) => setSim({ ...sim, kmEntrega: Number(e.target.value) })} className="mt-1 w-full h-9 px-2 rounded-lg border border-slate-200 text-slate-800 font-semibold" /></label>
            <label>Km para recoger<input type="number" step="0.1" value={sim.kmRecogida} onChange={(e) => setSim({ ...sim, kmRecogida: Number(e.target.value) })} className="mt-1 w-full h-9 px-2 rounded-lg border border-slate-200 text-slate-800 font-semibold" /></label>
            <label>Hora<input type="time" value={sim.hora} onChange={(e) => setSim({ ...sim, hora: e.target.value })} className="mt-1 w-full h-9 px-2 rounded-lg border border-slate-200 text-slate-800 font-semibold" /></label>
            <label className="flex items-end gap-2 pb-2"><input type="checkbox" checked={sim.lluvia} onChange={(e) => setSim({ ...sim, lluvia: e.target.checked })} className="w-4 h-4" /> Lloviendo</label>
            <label>Pedidos esperando<input type="number" min="0" value={sim.demanda} onChange={(e) => setSim({ ...sim, demanda: Number(e.target.value) })} className="mt-1 w-full h-9 px-2 rounded-lg border border-slate-200 text-slate-800 font-semibold" /></label>
            <label>Domis libres cerca<input type="number" min="0" value={sim.oferta} onChange={(e) => setSim({ ...sim, oferta: Number(e.target.value) })} className="mt-1 w-full h-9 px-2 rounded-lg border border-slate-200 text-slate-800 font-semibold" /></label>
          </div>
          {resultado && (
            <div className="rounded-xl bg-slate-900 text-white p-4">
              <p className="text-2xs uppercase tracking-wider text-white/60 font-bold">El domi gana</p>
              <p className="text-3xl font-extrabold">{fmt(resultado.pagoDomi)}</p>
              <div className="mt-3 space-y-1">
                {resultado.desglose.map((d) => (
                  <div key={d.concepto} className="flex justify-between text-xs"><span className="text-white/70">{d.concepto}</span><span className="font-semibold">{d.valor >= 0 ? '+' : ''}{fmt(d.valor)}</span></div>
                ))}
              </div>
              {resultado.comision > 0 && <p className="mt-3 text-xs text-white/70">El negocio paga {fmt(resultado.cobroNegocio)} (incluye {fmt(resultado.comision)} de comisión)</p>}
            </div>
          )}
        </div>

        {!!ejemplos.length && (
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-sm font-bold text-slate-800 mb-2">Ejemplos (1 km para recoger)</p>
            <table className="w-full text-xs">
              <thead><tr className="text-slate-400"><th className="text-left font-semibold py-1">Distancia</th><th className="text-right font-semibold">Normal</th><th className="text-right font-semibold">Pico</th><th className="text-right font-semibold">Noche</th></tr></thead>
              <tbody>
                {ejemplos.map((f) => (
                  <tr key={f.km} className="border-t border-slate-100"><td className="py-1.5 font-semibold text-slate-700">{f.km} km</td><td className="text-right">{fmt(f.normal)}</td><td className="text-right">{fmt(f.pico)}</td><td className="text-right">{fmt(f.noche)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <SAToast {...toast} onClose={() => setToast((t) => ({ ...t, visible: false }))} />
    </div>
  );
}
