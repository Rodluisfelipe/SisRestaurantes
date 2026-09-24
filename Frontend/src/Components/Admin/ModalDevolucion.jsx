import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';
import { Capa } from '../ui';

/**
 * Registrar una devolución o un cambio sobre un pedido.
 *
 * El caso que se repite todos los días en una tienda de ropa es el mismo: la
 * compraron en M y la necesitan en L. Por eso un cambio no obliga a buscar
 * otro producto: ofrece las demás tallas del que ya trajeron, que es lo que el
 * vendedor va a hacer el 90% de las veces.
 *
 * Las cantidades y los precios los vuelve a calcular el servidor contra el
 * pedido; aquí no se decide nada que el backend no revise otra vez.
 */

const MOTIVOS = [
  { id: 'talla', label: 'Talla equivocada' },
  { id: 'defecto', label: 'Llegó defectuoso' },
  { id: 'no_era_lo_esperado', label: 'No era lo que esperaba' },
  { id: 'llego_tarde', label: 'Llegó tarde' },
  { id: 'arrepentimiento', label: 'Se arrepintió' },
  { id: 'otro', label: 'Otro' },
];

const pesos = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
const etiquetaLinea = (i) => (i.variante?.valores?.length ? `${i.name} (${i.variante.valores.join(' · ')})` : i.name);

export default function ModalDevolucion({ pedido, onClose, onListo }) {
  const { businessId } = useBusinessConfig();
  const [tipo, setTipo] = useState('devolucion');
  const [motivo, setMotivo] = useState('talla');
  const [nota, setNota] = useState('');
  const [reingresaStock, setReingresaStock] = useState(true);
  const [cantidades, setCantidades] = useState({});   // índice de la línea → cuántas devuelve
  const [reemplazos, setReemplazos] = useState({});   // índice → valores de la variante que se lleva
  const [catalogo, setCatalogo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const lineas = pedido?.items || [];

  /* Para un cambio hace falta saber qué otras tallas existen. Se pide solo
     cuando el vendedor elige "cambio": en una devolución normal es una
     consulta que nadie iba a usar. */
  useEffect(() => {
    if (tipo !== 'cambio' || catalogo) return;
    let vivo = true;
    api.get(`/products/inventory?businessId=${businessId}`)
      .then((res) => { if (vivo) setCatalogo(res.data?.productos || []); })
      .catch(() => { if (vivo) setCatalogo([]); });
    return () => { vivo = false; };
  }, [tipo, catalogo, businessId]);

  const variantesDe = (productId) => {
    const p = (catalogo || []).find((x) => String(x._id) === String(productId));
    return (p?.variantes || []).filter((v) => v.activo !== false);
  };

  const elegidas = lineas
    .map((linea, i) => ({ linea, i, cantidad: Number(cantidades[i]) || 0 }))
    .filter((x) => x.cantidad > 0);

  const valor = elegidas.reduce((t, x) => t + (Number(x.linea.price) || 0) * x.cantidad, 0);

  /* Lo que se lleva a cambio: la misma referencia en otra talla, así que vale
     lo mismo salvo que el negocio le haya puesto otro precio a esa variante. */
  const loQueSeLleva = tipo === 'cambio'
    ? elegidas.flatMap((x) => {
        const valores = reemplazos[x.i];
        if (!valores) return [];
        const v = variantesDe(x.linea.productId).find((c) => c.valores.join('|') === valores);
        return [{
          productId: x.linea.productId,
          name: x.linea.name,
          variante: { valores: valores.split('|'), sku: v?.sku || '' },
          quantity: x.cantidad,
          price: v?.precio != null && v.precio !== '' ? Number(v.precio) : Number(x.linea.price) || 0,
        }];
      })
    : [];

  const diferencia = loQueSeLleva.reduce((t, i) => t + i.price * i.quantity, 0) - valor;
  const faltaElegirTalla = tipo === 'cambio' && elegidas.length > 0 && loQueSeLleva.length < elegidas.length;

  const guardar = async () => {
    if (!elegidas.length) { setError('Marca qué producto se devuelve'); return; }
    if (faltaElegirTalla) { setError('Falta decir qué se lleva a cambio'); return; }

    setGuardando(true);
    setError('');
    try {
      await api.post('/devoluciones', {
        businessId,
        orderId: pedido._id,
        orderNumber: pedido.orderNumber,
        tipo,
        motivo,
        nota,
        reingresaStock,
        items: elegidas.map((x) => ({
          productId: x.linea.productId,
          name: x.linea.name,
          variante: x.linea.variante,
          quantity: x.cantidad,
        })),
        cambioPor: loQueSeLleva,
      });
      onListo?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo registrar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end lg:items-center justify-center lg:p-4" onClick={onClose}>
      <Capa onCerrar={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-lg rounded-t-2xl lg:rounded-2xl max-h-[92vh] overflow-hidden flex flex-col"
      >
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-[15px] font-bold text-slate-900">Devolución del pedido #{pedido.orderNumber}</h2>
          <p className="text-[11.5px] text-slate-400 mt-0.5">{pedido.customerName || 'Sin nombre'}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Devolver o cambiar */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'devolucion', label: 'Devolución', sub: 'Se le regresa la plata' },
              { id: 'cambio', label: 'Cambio', sub: 'Se lleva otra talla' },
            ].map((o) => (
              <button
                key={o.id}
                onClick={() => setTipo(o.id)}
                className={`rounded-xl border p-2.5 text-left transition-colors ${
                  tipo === o.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <p className="text-[13px] font-bold">{o.label}</p>
                <p className={`text-[11px] ${tipo === o.id ? 'text-white/70' : 'text-slate-400'}`}>{o.sub}</p>
              </button>
            ))}
          </div>

          {/* Qué trae de vuelta */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Qué devuelve</p>
            {lineas.map((linea, i) => {
              const maximo = Number(linea.quantity) || 1;
              const cantidad = Number(cantidades[i]) || 0;
              const opciones = tipo === 'cambio' ? variantesDe(linea.productId) : [];
              return (
                <div key={i} className="rounded-xl border border-slate-200 p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800 truncate">{etiquetaLinea(linea)}</p>
                      <p className="text-[11px] text-slate-400">
                        {maximo} × {pesos(linea.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCantidades((c) => ({ ...c, [i]: Math.max(0, cantidad - 1) }))}
                        className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30"
                        disabled={cantidad <= 0}
                      >−</button>
                      <span className="w-7 text-center text-[13px] font-bold tabular-nums">{cantidad}</span>
                      <button
                        onClick={() => setCantidades((c) => ({ ...c, [i]: Math.min(maximo, cantidad + 1) }))}
                        className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30"
                        disabled={cantidad >= maximo}
                      >+</button>
                    </div>
                  </div>

                  {/* Qué se lleva en su lugar */}
                  {tipo === 'cambio' && cantidad > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      {catalogo === null ? (
                        <p className="text-[11px] text-slate-400">Buscando las otras tallas…</p>
                      ) : opciones.length ? (
                        <select
                          value={reemplazos[i] || ''}
                          onChange={(e) => setReemplazos((r) => ({ ...r, [i]: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px]"
                        >
                          <option value="">Se lleva…</option>
                          {opciones.map((v) => (
                            <option key={v.valores.join('|')} value={v.valores.join('|')}>
                              {v.valores.join(' · ')}{Number(v.stock) > 0 ? '' : ' (sin stock)'}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-[11px] text-amber-600">
                          Este producto no tiene variantes: registra el cambio como devolución y vuelve a venderlo.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Por qué */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Por qué</p>
            <div className="flex flex-wrap gap-1.5">
              {MOTIVOS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMotivo(m.id)}
                  className={`px-2.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                    motivo === m.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
              placeholder="Detalle (opcional)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px]"
            />
          </div>

          {/* Vuelve a bodega o no */}
          <label className="flex items-start gap-2.5 rounded-xl bg-slate-50 border border-slate-200 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={reingresaStock}
              onChange={(e) => setReingresaStock(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-[13px] font-semibold text-slate-800">Vuelve a estar a la venta</span>
              <span className="block text-[11.5px] text-slate-500">
                Desmárcalo si llegó dañado: contarlo como disponible es venderlo roto otra vez.
              </span>
            </span>
          </label>

          {/* La plata */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 text-slate-900 p-3">
            {tipo === 'devolucion' ? (
              <p className="text-[13px] font-semibold">Se le devuelven <span className="font-black">{pesos(valor)}</span></p>
            ) : diferencia === 0 ? (
              <p className="text-[13px] font-semibold">Cambio parejo: no se cobra nada</p>
            ) : diferencia > 0 ? (
              <p className="text-[13px] font-semibold">El cliente completa <span className="font-black">{pesos(diferencia)}</span></p>
            ) : (
              <p className="text-[13px] font-semibold">Se le devuelven <span className="font-black">{pesos(-diferencia)}</span></p>
            )}
            <p className="text-[11px] text-slate-500 mt-0.5">
              El inventario se mueve cuando marques la devolución como recibida.
            </p>
          </div>

          {error && <p className="text-[12.5px] font-semibold text-red-600">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando || !elegidas.length}
            className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-[13px] font-bold disabled:opacity-40"
          >
            {guardando ? 'Guardando…' : 'Registrar'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
