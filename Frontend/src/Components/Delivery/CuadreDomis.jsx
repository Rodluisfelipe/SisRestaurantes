import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';

/**
 * Cuadre de efectivo con los domiciliarios.
 *
 * Cada domi trae en la mano el efectivo de sus entregas y se queda con lo
 * suyo. Aquí el negocio ve, por domi, cuánto le tienen que entregar (o cuánto
 * le debe él, si todo se pagó en línea) y lo cierra con un clic. Los montos
 * los calcula el servidor con las entregas reales: el navegador no manda
 * cifras, solo "liquidar a este domi".
 *
 * Arriba, las reglas: cómo se le paga a cada domi y cuántos pedidos puede
 * llevar a la vez (la app del domi arma la ruta cuando son varios).
 */
const fmt = (n) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n || 0)).toLocaleString('es-CO')}`;
const hora = (iso) => (iso ? new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');

const MODOS = [
  { id: 'domicilio', texto: 'Se queda con el domicilio', ayuda: 'Lo que pagó el cliente por el envío' },
  { id: 'fijo', texto: 'Valor fijo por entrega', ayuda: 'Ej. $4.000 por cada pedido' },
  { id: 'porcentaje', texto: 'Porcentaje del domicilio', ayuda: 'Ej. 80 % de lo que pagó el cliente' },
  { id: 'ninguno', texto: 'No se le paga por entrega', ayuda: 'Tiene sueldo fijo' },
];

const MAX_FOTOS = 3;

/** Fotos de la fachada: la app del domi las muestra al ir a recoger. */
function FotosLocal({ fotos, alCambiar }) {
  const { businessId } = useBusinessConfig();
  const [subiendo, setSubiendo] = useState(false);

  const subir = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setSubiendo(true);
    try {
      const datos = new FormData();
      datos.append('image', archivo);
      datos.append('folder', 'fachadas');
      datos.append('maxWidth', '1200');
      const { data } = await api.post('/upload/image', datos, { headers: { 'Content-Type': 'multipart/form-data' }, params: { businessId } });
      await alCambiar([...fotos, data.url].slice(0, MAX_FOTOS));
    } catch {
      toast.error('No se pudo subir la foto');
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="lg:col-span-3">
      <p className="text-[12px] font-bold text-slate-700">Fotos de tu local</p>
      <p className="text-[11px] text-slate-400 mb-2">La fachada o la entrada, como se ve desde la calle. El domiciliario las ve al ir a recoger y encuentra el local más rápido.</p>
      <div className="flex flex-wrap gap-2">
        {fotos.map((url) => (
          <div key={url} className="relative w-28 h-20 rounded-xl overflow-hidden border border-slate-100">
            <img src={url} alt="Foto del local" className="w-full h-full object-cover" />
            <button
              onClick={() => alCambiar(fotos.filter((f) => f !== url))}
              aria-label="Quitar foto"
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-[13px] leading-none"
            >
              ×
            </button>
          </div>
        ))}
        {fotos.length < MAX_FOTOS && (
          <label className={`w-28 h-20 rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-400 flex flex-col items-center justify-center text-[11.5px] font-bold text-slate-500 cursor-pointer ${subiendo ? 'opacity-50 pointer-events-none' : ''}`}>
            <span className="text-[18px] leading-none">+</span>
            {subiendo ? 'Subiendo…' : 'Agregar foto'}
            <input type="file" accept="image/*" onChange={subir} className="hidden" />
          </label>
        )}
      </div>
    </div>
  );
}

export default function CuadreDomis() {
  // businessId en cada llamada: desde el superadmin la sesión no trae negocio
  const { businessId } = useBusinessConfig();
  const [cuadre, setCuadre] = useState(null);
  const [reglas, setReglas] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [abierto, setAbierto] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [c, r, h] = await Promise.all([
        api.get('/domi-app/negocio/cuadre', { params: { businessId } }),
        api.get('/domi-app/negocio/reglas', { params: { businessId } }),
        api.get('/domi-app/negocio/liquidaciones', { params: { limite: 15, businessId } }),
      ]);
      setCuadre(c.data);
      setReglas(r.data);
      setHistorial(h.data);
    } catch {
      setCuadre([]);
    }
  }, [businessId]);

  useEffect(() => { cargar(); }, [cargar]);

  const guardarReglas = async (cambio) => {
    const nuevas = { ...reglas, ...cambio, driverPay: { ...reglas.driverPay, ...(cambio.driverPay || {}) } };
    setReglas(nuevas);
    try {
      const { data } = await api.put('/domi-app/negocio/reglas', { ...nuevas, businessId });
      setReglas(data);
      toast.success('Guardado');
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.message || 'No se pudo guardar');
      cargar();
    }
  };

  const liquidar = async () => {
    if (!confirmar) return;
    setGuardando(true);
    try {
      await api.post('/domi-app/negocio/liquidar', { driverId: confirmar.driverId, nota, businessId });
      toast.success(`Cuadre de ${confirmar.nombre} cerrado`);
      setConfirmar(null);
      setNota('');
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.message || 'No se pudo liquidar');
    } finally {
      setGuardando(false);
    }
  };

  const conPendiente = (cuadre || []).filter((c) => c.entregas > 0);
  const totalEntregar = conPendiente.reduce((s, c) => s + c.debeEntregar, 0);
  const totalDeber = conPendiente.reduce((s, c) => s + c.leDeben, 0);

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-4 lg:px-6 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-slate-800">Cuadre de efectivo</h2>
          <p className="text-[12px] text-slate-400 mt-0.5">Lo que cada domiciliario trae en la mano y lo que le toca</p>
        </div>
        <div className="flex gap-2">
          {totalEntregar > 0 && (
            <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
              <p className="text-2xs font-bold uppercase tracking-wide text-amber-700">Te deben entregar</p>
              <p className="text-[15px] font-extrabold text-amber-800">{fmt(totalEntregar)}</p>
            </div>
          )}
          {totalDeber > 0 && (
            <div className="px-3 py-2 rounded-xl bg-sky-50 border border-sky-100">
              <p className="text-2xs font-bold uppercase tracking-wide text-sky-700">Les debes</p>
              <p className="text-[15px] font-extrabold text-sky-800">{fmt(totalDeber)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Reglas */}
      {reglas && (
        <div className="px-4 lg:px-6 py-4 border-b border-slate-100 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p className="text-[12px] font-bold text-slate-700 mb-2">¿Cómo le pagas a cada domiciliario?</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {MODOS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => guardarReglas({ driverPay: { modo: m.id } })}
                  className={`text-left px-3 py-2.5 rounded-xl border-2 transition-colors ${reglas.driverPay.modo === m.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100 hover:border-slate-300 text-slate-700'}`}
                >
                  <p className="text-[12.5px] font-bold">{m.texto}</p>
                  <p className={`text-[11px] ${reglas.driverPay.modo === m.id ? 'text-white/70' : 'text-slate-400'}`}>{m.ayuda}</p>
                </button>
              ))}
            </div>
            {(reglas.driverPay.modo === 'fijo' || reglas.driverPay.modo === 'porcentaje') && (
              <label className="mt-3 flex items-center gap-2 text-[12.5px] text-slate-600">
                {reglas.driverPay.modo === 'fijo' ? 'Valor por entrega: $' : 'Porcentaje:'}
                <input
                  type="number"
                  min="0"
                  max={reglas.driverPay.modo === 'porcentaje' ? 100 : undefined}
                  defaultValue={reglas.driverPay.valor}
                  key={reglas.driverPay.modo}
                  onBlur={(e) => guardarReglas({ driverPay: { valor: Number(e.target.value) || 0 } })}
                  className="w-28 h-9 px-3 rounded-lg border border-slate-200 text-[13px] font-bold"
                />
                {reglas.driverPay.modo === 'porcentaje' && '%'}
              </label>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-[12px] font-bold text-slate-700 mb-2">Pedidos a la vez por domiciliario</p>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => guardarReglas({ maxActivePerDriver: n })}
                    className={`w-10 h-10 rounded-xl text-[14px] font-bold border-2 transition-colors ${reglas.maxActivePerDriver === n ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100 text-slate-600 hover:border-slate-300'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Con 2 o más, la app le arma la ruta más corta.</p>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={!!reglas.requirePickupCode} onChange={(e) => guardarReglas({ requirePickupCode: e.target.checked })} className="mt-0.5 w-4 h-4 accent-slate-900" />
              <span className="text-[12px] text-slate-600">
                <b className="text-slate-700">Pedir el código del día al recoger.</b> Prueba de que el domi pasó por el local.
              </span>
            </label>
          </div>
          <FotosLocal fotos={reglas.fotosLocal || []} alCambiar={(fotosLocal) => guardarReglas({ fotosLocal })} />
        </div>
      )}

      {/* Por domiciliario */}
      <div className="divide-y divide-slate-50">
        {cuadre === null && <p className="px-6 py-8 text-center text-[13px] text-slate-400">Cargando…</p>}
        {cuadre && !conPendiente.length && (
          <p className="px-6 py-8 text-center text-[13px] text-slate-400">Todos los domiciliarios están a paz y salvo.</p>
        )}
        {conPendiente.map((c) => (
          <div key={c.driverId} className="px-4 lg:px-6 py-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => setAbierto(abierto === c.driverId ? null : c.driverId)} className="flex items-center gap-3 flex-1 min-w-[200px] text-left">
                {c.foto
                  ? <img src={c.foto} alt="" className="w-10 h-10 rounded-full object-cover" />
                  : <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-[14px] font-bold text-slate-500">{c.nombre?.[0] || '?'}</div>}
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold text-slate-800 truncate">
                    {c.nombre}{c.externo && <span className="ml-1.5 text-2xs font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">Red</span>}
                  </p>
                  <p className="text-[11.5px] text-slate-400">
                    {c.entregas} {c.entregas === 1 ? 'entrega' : 'entregas'} · cobró {fmt(c.efectivo)} · le toca {fmt(c.ganancias)}
                  </p>
                </div>
              </button>
              <div className="text-right">
                <p className={`text-[15px] font-extrabold ${c.debeEntregar ? 'text-amber-700' : 'text-sky-700'}`}>
                  {c.debeEntregar ? `Te entrega ${fmt(c.debeEntregar)}` : `Le debes ${fmt(c.leDeben)}`}
                </p>
              </div>
              <button
                onClick={() => setConfirmar(c)}
                className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[12px] font-bold"
              >
                Liquidar
              </button>
            </div>
            {abierto === c.driverId && (
              <div className="mt-3 ml-[52px] rounded-xl bg-slate-50 divide-y divide-slate-100">
                {c.detalle.map((d) => (
                  <div key={d.orderId} className="flex items-center gap-3 px-3 py-2 text-[12px]">
                    <span className="font-bold text-slate-700">#{d.numero}</span>
                    <span className="text-slate-500 flex-1 truncate">{d.cliente} · {hora(d.entregadoAt)}</span>
                    <span className="text-slate-500">{d.efectivo ? `efectivo ${fmt(d.efectivo)}` : 'pagado en línea'}</span>
                    <span className="font-bold text-emerald-700 w-20 text-right">+{fmt(d.ganancia)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {!!historial.length && (
        <div className="px-4 lg:px-6 py-4 border-t border-slate-100">
          <p className="text-[12px] font-bold text-slate-700 mb-2">Últimos cuadres cerrados</p>
          <div className="space-y-1">
            {historial.map((h) => (
              <div key={h._id} className="flex items-center gap-3 text-[12px] text-slate-500">
                <span className="w-28 shrink-0">{hora(h.createdAt)}</span>
                <span className="font-semibold text-slate-700 flex-1 truncate">{h.domi}</span>
                <span>{h.entregas} entregas</span>
                <span className="font-bold text-slate-700 w-28 text-right">{h.neto >= 0 ? `recibiste ${fmt(h.neto)}` : `pagaste ${fmt(-h.neto)}`}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmar && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !guardando && setConfirmar(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="text-[16px] font-bold text-slate-800">Cerrar cuadre de {confirmar.nombre}</p>
              <p className="text-[12.5px] text-slate-500 mt-1">
                {confirmar.entregas} {confirmar.entregas === 1 ? 'entrega' : 'entregas'}: cobró {fmt(confirmar.efectivo)} y le tocan {fmt(confirmar.ganancias)}.
              </p>
            </div>
            <div className={`rounded-xl p-4 text-center ${confirmar.debeEntregar ? 'bg-amber-50' : 'bg-sky-50'}`}>
              <p className="text-2xs font-bold uppercase tracking-wide text-slate-500">{confirmar.debeEntregar ? 'Confirma que recibiste' : 'Confirma que le pagaste'}</p>
              <p className="text-[26px] font-extrabold text-slate-900">{fmt(confirmar.debeEntregar || confirmar.leDeben)}</p>
            </div>
            <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} placeholder="Nota (opcional)" className="w-full h-10 px-3 rounded-xl border border-slate-200 text-[13px]" />
            <div className="flex gap-2">
              <button disabled={guardando} onClick={() => setConfirmar(null)} className="flex-1 h-11 rounded-xl bg-slate-100 text-slate-600 text-[13px] font-bold">Cancelar</button>
              <button disabled={guardando} onClick={liquidar} className="flex-1 h-11 rounded-xl bg-slate-900 text-white text-[13px] font-bold disabled:opacity-50">
                {guardando ? 'Cerrando…' : 'Sí, cerrar cuadre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
