import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';
import Cajas from './Cajas';
import PersonalPos from './PersonalPos';

/**
 * Punto de venta: todo lo de la caja nativa en una sola sección.
 *
 * Antes estaba repartido —las cajas en un lado, sus cierres mezclados con los
 * del POS web (y escondidos si el negocio no tenía ese beta), la auditoría sin
 * pantalla— y el dueño no tenía dónde mirar "cómo va la caja". Los informes de
 * ventas siguen en Completados, donde se juntan la caja y el menú: esto es
 * para operar la caja, no para sumar el negocio.
 */

const pesos = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');

const MEDIO = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', mixto: 'Mixto', otro: 'Otro' };

const TIPO_AUDITORIA = {
  anular_borrador: 'Quitó antes de cocina',
  anular_item: 'Anuló después de cocina',
  descuento: 'Descuento',
  abrir_cajon: 'Abrió la gaveta sin venta',
  descartar_pausada: 'Descartó una venta en espera',
};

const PESTANAS = [
  { id: 'resumen', nombre: 'Resumen' },
  { id: 'cajas', nombre: 'Cajas' },
  { id: 'personal', nombre: 'Personal' },
  { id: 'cierres', nombre: 'Cierres' },
  { id: 'auditoria', nombre: 'Auditoría' },
  { id: 'devoluciones', nombre: 'Devoluciones' },
  { id: 'ventas', nombre: 'Ventas' },
];

/* Las fechas se piden como días de Colombia; el servidor arma el rango. */
const hoy = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
const haceDias = (n) => new Date(Date.now() - 5 * 3600 * 1000 - n * 86400000).toISOString().slice(0, 10);
const inicioDeMes = () => hoy().slice(0, 8) + '01';

const RAPIDOS = [
  { id: 'hoy', nombre: 'Hoy', desde: hoy, hasta: hoy },
  { id: 'ayer', nombre: 'Ayer', desde: () => haceDias(1), hasta: () => haceDias(1) },
  { id: '7', nombre: '7 días', desde: () => haceDias(6), hasta: hoy },
  { id: 'mes', nombre: 'Este mes', desde: inicioDeMes, hasta: hoy },
];

const fechaHora = (f) => (f ? new Date(f).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export default function PuntoDeVenta() {
  const { businessId } = useBusinessConfig();
  const [pestana, setPestana] = useState('resumen');
  const [rapido, setRapido] = useState('hoy');
  const [desde, setDesde] = useState(hoy());
  const [hasta, setHasta] = useState(hoy());

  const elegirRapido = (r) => {
    setRapido(r.id);
    setDesde(r.desde());
    setHasta(r.hasta());
  };

  const conFechas = pestana !== 'cajas' && pestana !== 'personal';

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPestana(p.id)}
            className={`h-10 px-4 rounded-xl text-[13px] font-bold transition-colors ${
              pestana === p.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {p.nombre}
          </button>
        ))}
      </div>

      {conFechas && (
        <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-2xl p-2">
          {RAPIDOS.map((r) => (
            <button
              key={r.id}
              onClick={() => elegirRapido(r)}
              className={`h-9 px-3 rounded-lg text-[12.5px] font-semibold ${
                rapido === r.id ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {r.nombre}
            </button>
          ))}
          <div className="flex items-center gap-1.5 ml-auto text-[12.5px] text-slate-500">
            <input type="date" value={desde} max={hasta} onChange={(e) => { setRapido(''); setDesde(e.target.value); }}
              className="h-9 px-2 rounded-lg border border-slate-200" />
            <span>a</span>
            <input type="date" value={hasta} min={desde} onChange={(e) => { setRapido(''); setHasta(e.target.value); }}
              className="h-9 px-2 rounded-lg border border-slate-200" />
          </div>
        </div>
      )}

      {pestana === 'resumen' && <Resumen businessId={businessId} desde={desde} hasta={hasta} irA={setPestana} />}
      {pestana === 'cajas' && <Cajas />}
      {pestana === 'personal' && <PersonalPos businessId={businessId} />}
      {pestana === 'cierres' && <Cierres businessId={businessId} desde={desde} hasta={hasta} />}
      {pestana === 'auditoria' && <Auditoria businessId={businessId} desde={desde} hasta={hasta} />}
      {pestana === 'devoluciones' && <Devoluciones businessId={businessId} desde={desde} hasta={hasta} />}
      {pestana === 'ventas' && <Ventas businessId={businessId} desde={desde} hasta={hasta} />}
    </div>
  );
}

/** Pide una ruta del panel del POS con el rango y avisa si falla. */
function useConsulta(ruta, businessId, desde, hasta, extra = '') {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    if (!businessId) return;
    setCargando(true);
    try {
      const res = await api.get(`/pos-panel/${ruta}?businessId=${businessId}&desde=${desde}&hasta=${hasta}${extra}`);
      setDatos(res.data);
      setError('');
    } catch (e) {
      setError(e.response?.data?.message || 'No se pudo cargar');
    } finally {
      setCargando(false);
    }
  }, [ruta, businessId, desde, hasta, extra]);

  useEffect(() => { cargar(); }, [cargar]);
  return { datos, error, cargando };
}

function Estado({ error, cargando, vacio, texto }) {
  if (error) return <p className="p-4 text-[13px] font-semibold text-red-600">{error}</p>;
  if (cargando) return <p className="p-4 text-[13px] text-slate-400">Cargando…</p>;
  if (vacio) return <p className="p-8 text-center text-[13px] text-slate-400">{texto}</p>;
  return null;
}

function Tarjeta({ titulo, valor, pie, tono = 'normal', onClick }) {
  const colores = {
    normal: 'bg-white border-slate-200',
    alerta: 'bg-amber-50 border-amber-200',
    mal: 'bg-red-50 border-red-200',
  };
  return (
    <button onClick={onClick} disabled={!onClick}
      className={`text-left rounded-2xl border p-4 ${colores[tono]} ${onClick ? 'hover:shadow-sm' : 'cursor-default'}`}>
      <p className="text-[11.5px] font-bold uppercase tracking-wide text-slate-400">{titulo}</p>
      <p className="text-2xl font-black tabular-nums text-slate-900 mt-1">{valor}</p>
      {pie && <p className="text-[12px] text-slate-500 mt-0.5">{pie}</p>}
    </button>
  );
}

function Resumen({ businessId, desde, hasta, irA }) {
  const { datos: d, error, cargando } = useConsulta('resumen', businessId, desde, hasta);
  if (!d) return <Estado error={error} cargando={cargando} />;

  const borrados = d.auditoria.find((a) => a.tipo === 'anular_borrador');
  const gaveta = d.auditoria.find((a) => a.tipo === 'abrir_cajon');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tarjeta titulo="Vendido en caja" valor={pesos(d.ventas.total)} pie={`${d.ventas.cantidad} ventas · promedio ${pesos(d.ventas.ticketPromedio)}`} onClick={() => irA('ventas')} />
        <Tarjeta titulo="Propinas" valor={pesos(d.ventas.propinas)} pie={`Descuentos: ${pesos(d.ventas.descuentos)}`} />
        <Tarjeta
          titulo="Cierres"
          valor={d.cierres.cantidad}
          pie={d.cierres.conDescuadre ? `${d.cierres.conDescuadre} con descuadre · ${pesos(d.cierres.diferencia)}` : 'Todos cuadrados'}
          tono={d.cierres.conDescuadre ? 'mal' : 'normal'}
          onClick={() => irA('cierres')}
        />
        <Tarjeta titulo="Devoluciones" valor={pesos(d.devoluciones.total)} pie={`${d.devoluciones.cantidad} en el periodo`} onClick={() => irA('devoluciones')} />
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-[13px] font-black text-slate-800 mb-3">Por medio de pago</p>
          {d.ventas.porMedio.length === 0 && <p className="text-[13px] text-slate-400">Sin ventas en el periodo</p>}
          {d.ventas.porMedio.map((m) => (
            <div key={m.metodo} className="flex justify-between py-1.5 text-[13px] border-b border-slate-100 last:border-0">
              <span className="text-slate-600">{MEDIO[m.metodo] ?? m.metodo}</span>
              <span className="font-bold tabular-nums">{pesos(m.total)}</span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-black text-slate-800">Lo que hay que mirar</p>
            <button onClick={() => irA('auditoria')} className="text-[12px] font-semibold text-slate-500 hover:text-slate-900">Ver auditoría</button>
          </div>
          <div className="space-y-1.5 text-[13px]">
            <Fila texto="Cajas conectadas" valor={d.cajas} />
            <Fila texto="Líneas quitadas antes de cocina" valor={borrados ? `${borrados.veces} · ${pesos(borrados.monto)}` : '0'} />
            <Fila texto="Gaveta abierta sin venta" valor={gaveta ? gaveta.veces : 0} alerta={gaveta && gaveta.veces > 5} />
            {d.auditoria.filter((a) => !['anular_borrador', 'abrir_cajon'].includes(a.tipo)).map((a) => (
              <Fila key={a.tipo} texto={TIPO_AUDITORIA[a.tipo] ?? a.tipo} valor={`${a.veces} · ${pesos(a.monto)}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Fila({ texto, valor, alerta }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-600">{texto}</span>
      <span className={`font-bold tabular-nums ${alerta ? 'text-amber-600' : 'text-slate-900'}`}>{valor}</span>
    </div>
  );
}

function Cierres({ businessId, desde, hasta }) {
  const [origen, setOrigen] = useState('');
  const { datos, error, cargando } = useConsulta('cierres', businessId, desde, hasta, origen ? `&origen=${origen}` : '');
  const [abierto, setAbierto] = useState(null);
  const cierres = datos?.cierres || [];

  return (
    <div className="space-y-3">
    {/* La caja nativa y el POS web, juntos mientras dura la migración. */}
    <div className="flex gap-1.5">
      {[['', 'Todos'], ['pos-nativo', 'Caja'], ['web', 'POS web']].map(([id, nombre]) => (
        <button key={id} onClick={() => setOrigen(id)}
          className={`h-8 px-3 rounded-lg text-[12px] font-semibold ${origen === id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
          {nombre}
        </button>
      ))}
    </div>
    <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
      <Estado error={error} cargando={cargando} vacio={!cierres.length} texto="No hay cierres de turno en este periodo" />
      {cierres.map((c) => {
        const dif = Math.round(Number(c.difference) || 0);
        const det = c.posDetalle || {};
        const verlo = abierto === c._id;
        return (
          <div key={c._id}>
            <button onClick={() => setAbierto(verlo ? null : c._id)} className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-slate-50">
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-bold text-slate-800 flex items-center gap-2">
                  {c.cajeroNombre || c.closedBy?.name || c.openedBy?.name || 'Sin nombre'}{c.cajaNombre ? ` · ${c.cajaNombre}` : ''}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    c.origen === 'pos-nativo' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {c.origen === 'pos-nativo' ? 'Caja' : 'POS web'}
                  </span>
                </p>
                <p className="text-[11.5px] text-slate-400">{fechaHora(c.openedAt)} → {fechaHora(c.closedAt)} · {c.salesSummary?.totalOrders ?? 0} ventas</p>
              </div>
              <div className="text-right">
                <p className="text-[13px] font-bold tabular-nums">{pesos(c.closingAmount)}</p>
                <p className={`text-[11.5px] font-bold ${dif === 0 ? 'text-emerald-600' : dif < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                  {dif === 0 ? 'Cuadró' : dif < 0 ? `Faltan ${pesos(-dif)}` : `Sobran ${pesos(dif)}`}
                </p>
              </div>
            </button>

            {verlo && (
              <div className="px-4 pb-4 grid md:grid-cols-2 gap-4 text-[12.5px]">
                <div className="space-y-1">
                  <Fila texto="Fondo inicial" valor={pesos(c.openingAmount)} />
                  {c.origen === 'pos-nativo' ? (
                    <>
                      <Fila texto="Ventas en efectivo" valor={pesos(det.ventasEfectivo)} />
                      <Fila texto="Ventas por otros medios" valor={pesos(det.ventasOtros)} />
                    </>
                  ) : (
                    <Fila texto="Ventas del turno" valor={pesos(c.salesSummary?.totalSales)} />
                  )}
                  <Fila texto="Devoluciones en efectivo" valor={pesos(det.devolucionesEfectivo)} />
                  <Fila texto="Esperado en gaveta" valor={pesos(c.expectedAmount)} />
                  <Fila texto="Contado" valor={pesos(c.closingAmount)} />
                  <Fila texto="Propina en efectivo (no es del negocio)" valor={pesos(det.propinaEfectivo)} />
                </div>
                <div className="space-y-1">
                  <p className="font-black text-slate-800">Entradas y salidas de efectivo</p>
                  {(c.movements || []).length === 0 && <p className="text-slate-400">Ninguna</p>}
                  {/* En el POS web los movimientos incluyen cada venta; aquí solo
                      interesan las entradas y salidas de efectivo. */}
                  {(c.movements || []).filter((m) => m.type === 'income' || m.type === 'expense').map((m, i) => (
                    <div key={i} className="flex justify-between gap-2">
                      <span className="text-slate-600 truncate">{m.type === 'income' ? '↑' : '↓'} {m.description}</span>
                      <span className={`font-bold tabular-nums ${m.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>{pesos(m.amount)}</span>
                    </div>
                  ))}
                  <p className="font-black text-slate-800 pt-2">Operación</p>
                  <Fila texto="Gaveta abierta sin venta" valor={det.aperturasSinVenta ?? '—'} />
                  <Fila texto="Quitadas antes de cocina" valor={typeof det.borradoresAnulados === 'number' ? `${det.borradoresAnulados} · ${pesos(det.borradoresMonto)}` : '—'} alerta={det.alertaBorradores} />
                  <Fila texto="Anuladas después de cocina" valor={typeof det.anulacionesComanda === 'number' ? `${det.anulacionesComanda} · ${pesos(det.anulacionesMonto)}` : '—'} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
    </div>
  );
}

function Auditoria({ businessId, desde, hasta }) {
  const [tipo, setTipo] = useState('');
  const { datos, error, cargando } = useConsulta('auditoria', businessId, desde, hasta, tipo ? `&tipo=${tipo}` : '');
  const lista = datos?.excepciones || [];

  return (
    <div className="space-y-3">
      {datos?.porCajero?.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {datos.porCajero.map((c) => (
            <Tarjeta key={c.cajero} titulo={c.cajero || 'Sin nombre'} valor={pesos(c.monto)} pie={`${c.veces} anulaciones, borrados o descuentos`} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {[['', 'Todo'], ...Object.entries(TIPO_AUDITORIA)].map(([id, nombre]) => (
          <button key={id} onClick={() => setTipo(id)}
            className={`h-8 px-3 rounded-lg text-[12px] font-semibold ${tipo === id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {nombre}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        <Estado error={error} cargando={cargando} vacio={!lista.length} texto="Nada registrado en este periodo" />
        {lista.map((x) => (
          <div key={x._id} className="flex items-center gap-3 p-3">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-slate-800">
                {TIPO_AUDITORIA[x.tipo] ?? x.tipo}{x.detalle ? ` · ${x.detalle}` : ''}
              </p>
              <p className="text-[11.5px] text-slate-400">
                {fechaHora(x.ocurridaEn)} · {x.cajero || 'Sin nombre'}
                {x.autorizo ? ` · autorizó ${x.autorizo}` : ''}
                {x.motivo ? ` · “${x.motivo}”` : ''}
              </p>
            </div>
            {x.monto > 0 && <span className="text-[13px] font-bold tabular-nums">{pesos(x.monto)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Devoluciones({ businessId, desde, hasta }) {
  const { datos, error, cargando } = useConsulta('devoluciones', businessId, desde, hasta);
  const lista = datos?.devoluciones || [];
  return (
    <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
      <Estado error={error} cargando={cargando} vacio={!lista.length} texto="No hubo devoluciones en este periodo" />
      {lista.map((d) => (
        <div key={d._id} className="flex items-center gap-3 p-3">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-slate-800">
              Venta #{d.orderNumber || '—'} · {(d.items || []).map((i) => `${i.quantity} ${i.name}`).join(', ')}
            </p>
            <p className="text-[11.5px] text-slate-400">
              {fechaHora(d.createdAt)} · {MEDIO[d.medio] ?? d.medio} · autorizó {d.autorizo}{d.motivo ? ` · “${d.motivo}”` : ''}
            </p>
          </div>
          <span className="text-[13px] font-bold tabular-nums text-red-600">−{pesos(d.total)}</span>
        </div>
      ))}
    </div>
  );
}

function Ventas({ businessId, desde, hasta }) {
  const [pagina, setPagina] = useState(1);
  useEffect(() => { setPagina(1); }, [desde, hasta]);
  const { datos, error, cargando } = useConsulta('ventas', businessId, desde, hasta, `&page=${pagina}`);
  const lista = datos?.ventas || [];

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-slate-500">
        Solo las ventas de la caja. El informe completo, junto con los pedidos del menú, está en Completados.
      </p>
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        <Estado error={error} cargando={cargando} vacio={!lista.length} texto="No hay ventas de caja en este periodo" />
        {lista.map((v) => (
          <div key={v._id} className="flex items-center gap-3 p-3">
            <div className="w-16 flex-shrink-0">
              <p className="text-[13px] font-black tabular-nums">#{v.orderNumber}</p>
              <p className="text-[11px] text-slate-400">{fechaHora(v.completedAt).split(' ').pop()}</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-semibold text-slate-700 truncate">
                {(v.items || []).map((i) => `${i.quantity} ${i.name}`).join(', ')}
              </p>
              <p className="text-[11.5px] text-slate-400">
                {v.posPagos?.length > 1
                  ? v.posPagos.map((p) => `${MEDIO[p.metodo] ?? p.metodo} ${pesos(p.monto)}`).join(' + ')
                  : MEDIO[v.paymentMethod] ?? v.paymentMethod}
                {v.discountAmount > 0 ? ` · descuento ${pesos(v.discountAmount)}${v.discountReason ? ` (${v.discountReason})` : ''}` : ''}
                {v.tipAmount > 0 ? ` · propina ${pesos(v.tipAmount)}` : ''}
              </p>
            </div>
            <span className="text-[14px] font-black tabular-nums">{pesos(v.finalAmount)}</span>
          </div>
        ))}
      </div>
      {datos?.paginas > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)} className="h-9 px-3 rounded-lg border border-slate-200 text-[12.5px] disabled:opacity-30">Anterior</button>
          <span className="text-[12.5px] text-slate-500">Página {pagina} de {datos.paginas}</span>
          <button disabled={pagina >= datos.paginas} onClick={() => setPagina(pagina + 1)} className="h-9 px-3 rounded-lg border border-slate-200 text-[12.5px] disabled:opacity-30">Siguiente</button>
        </div>
      )}
    </div>
  );
}
