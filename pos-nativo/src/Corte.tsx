import { useEffect, useState } from 'react';
import { Printer, X } from 'lucide-react';
import { imprimirCorte, pesos, type InformeCorte } from './nativo';

const MEDIO: Record<string, string> = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', credito: 'Crédito',
};

/**
 * Un corte X o Z en pantalla, listo para imprimir.
 *
 * El Z ya quedó guardado y en camino al panel cuando esto se muestra: el papel
 * es una copia, no el registro. Si la impresora falla, se reimprime desde aquí.
 */
export default function Corte({ informe: c, onCerrar }: { informe: InformeCorte; onCerrar: () => void }) {
  const [error, setError] = useState('');

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar]);

  const imprimir = () => imprimirCorte(c).then(() => setError('')).catch((e) => setError(String(e).replace(/^Error:\s*/, '')));

  const Fila = ({ t, v, fuerte }: { t: string; v: string; fuerte?: boolean }) => (
    <div className={`flex justify-between ${fuerte ? 'text-[15px] font-black' : 'text-[13px]'}`}>
      <span className={fuerte ? '' : 'text-slate-600'}>{t}</span>
      <span className="tabular-nums font-bold">{v}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center" onMouseDown={onCerrar}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-[440px] max-h-[88vh] overflow-y-auto bg-white rounded-2xl p-5 space-y-3 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xl font-black">{c.tipo === 'Z' ? `Corte Z #${c.numero}` : 'Corte X'}</p>
            <p className="text-[12px] text-slate-500">
              {c.tipo === 'Z' ? 'Día cerrado. Ya va camino al panel.' : 'Informativo: no cierra el día.'}
            </p>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="space-y-1">
          <Fila t="Ventas" v={`${c.ventas}${c.ventas ? ` (#${c.primera} a #${c.ultima})` : ''}`} />
          <Fila t="Venta bruta" v={pesos(c.bruto)} />
          <Fila t="Descuentos" v={`−${pesos(c.descuentos)}`} />
          <Fila t="Total" v={pesos(c.total)} fuerte />
          <Fila t="Propinas" v={pesos(c.propinas)} />
        </div>

        <div className="space-y-1 border-t border-slate-100 pt-2">
          {c.base_inc + c.inc > 0 && <><Fila t="Base INC 8%" v={pesos(c.base_inc)} /><Fila t="INC" v={pesos(c.inc)} /></>}
          {c.base_iva + c.iva > 0 && <><Fila t="Base IVA 19%" v={pesos(c.base_iva)} /><Fila t="IVA" v={pesos(c.iva)} /></>}
          {c.exento > 0 && <Fila t="Exento" v={pesos(c.exento)} />}
        </div>

        <div className="space-y-1 border-t border-slate-100 pt-2">
          {c.por_medio.map((m) => <Fila key={m.metodo} t={MEDIO[m.metodo] ?? m.metodo} v={pesos(m.total)} />)}
        </div>

        <div className="space-y-1 border-t border-slate-100 pt-2">
          <Fila t="Devoluciones" v={`${c.devoluciones} · ${pesos(c.devoluciones_monto)}`} />
          <Fila t="Anuladas después de cocina" v={`${c.anulaciones} · ${pesos(c.anulaciones_monto)}`} />
          <Fila t="Quitadas antes de cocina" v={String(c.borradores)} />
          <Fila t="Gaveta abierta sin venta" v={String(c.aperturas_gaveta)} />
        </div>

        {error && <p className="text-[12.5px] font-semibold text-red-600">{error}</p>}

        <button onClick={imprimir} className="w-full h-12 rounded-xl bg-accion text-sobre-accion text-[14px] font-black flex items-center justify-center gap-2">
          <Printer size={16} strokeWidth={2.5} />
          Imprimir
        </button>
      </div>
    </div>
  );
}
