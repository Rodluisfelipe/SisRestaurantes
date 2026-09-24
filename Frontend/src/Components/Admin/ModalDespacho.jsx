import { useState } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';
import { Capa } from '../ui';

/**
 * Despachar un pedido: con quién salió y con qué guía.
 *
 * Hasta ahora ese número se lo mandaban al cliente por WhatsApp y se perdía
 * entre mensajes; el cliente volvía a preguntarlo tres días después y nadie lo
 * encontraba. Aquí queda pegado al pedido y el cliente lo ve solo.
 *
 * Con Servientrega el enlace sobra: MenuBy consulta el recorrido por la guía
 * y el cliente lo ve dentro de su pedido. Para las demás transportadoras, el
 * enlace escrito a mano es lo que hay hasta que tengan su propio adaptador en
 * services/transportadoras.
 */
export default function ModalDespacho({ pedido, onClose, onListo }) {
  const { businessId, businessConfig } = useBusinessConfig();
  const sugeridas = businessConfig?.envioNacional?.transportadoras || [];

  const [transportadora, setTransportadora] = useState(sugeridas[0] || '');
  const [guia, setGuia] = useState('');
  const [urlRastreo, setUrlRastreo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const guardar = async () => {
    if (!transportadora.trim() || !guia.trim()) {
      setError('Falta la transportadora o el número de guía');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      const res = await api.patch(`/orders/${pedido._id}/envio`, {
        businessId,
        transportadora: transportadora.trim(),
        guia: guia.trim(),
        urlRastreo: urlRastreo.trim(),
      });
      onListo?.(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo registrar el envío');
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
        className="bg-white w-full max-w-md rounded-t-2xl lg:rounded-2xl overflow-hidden"
      >
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-[15px] font-bold text-slate-900">Despachar pedido #{pedido.orderNumber}</h2>
          <p className="text-[11.5px] text-slate-400 mt-0.5">{pedido.customerName || 'Sin nombre'}</p>
        </div>

        <div className="p-5 space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Transportadora</label>
            <input
              value={transportadora}
              onChange={(e) => setTransportadora(e.target.value)}
              list="transportadoras-del-negocio"
              placeholder="Servientrega, Interrapidísimo…"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13.5px]"
            />
            {/* Las que el negocio ya usa, sin encerrarlo en una lista fija. */}
            <datalist id="transportadoras-del-negocio">
              {sugeridas.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Número de guía</label>
            <input
              value={guia}
              onChange={(e) => setGuia(e.target.value)}
              placeholder="1234567890"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13.5px] font-semibold tabular-nums"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Enlace de rastreo <span className="font-medium normal-case text-slate-300">· opcional</span>
            </label>
            <input
              value={urlRastreo}
              onChange={(e) => setUrlRastreo(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px]"
            />
            <p className="text-[11px] text-slate-400">
              {/servientrega/i.test(transportadora)
                ? 'Con Servientrega no hace falta: el recorrido se consulta solo y el cliente lo ve en su pedido.'
                : 'Si lo pegas, el cliente lo ve como un botón para seguir su paquete.'}
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
            disabled={guardando}
            className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-[13px] font-bold disabled:opacity-40"
          >
            {guardando ? 'Guardando…' : 'Despachar'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
