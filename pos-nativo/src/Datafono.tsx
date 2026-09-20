import { useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, Loader2, Network, PenLine } from 'lucide-react';
import { configurarDatafono, configDatafono, probarDatafono } from './nativo';

/**
 * Con qué se cobran las tarjetas.
 *
 * Dos formas, y la diferencia para el cajero es enorme:
 *
 * - **Manual**: el datáfono es un aparato aparte. El cajero pasa la tarjeta
 *   allá, espera la aprobación y escribe el voucher en la caja. Funciona con
 *   cualquier datáfono del país y no hay nada que configurar.
 * - **Por red**: la caja le habla al datáfono. El monto se manda solo, no hay
 *   nada que digitar y no hay forma de equivocarse al teclearlo.
 *
 * El módulo de red existía en Rust desde hace tiempo y no había forma de
 * activarlo: esta pantalla es lo que faltaba.
 */
export default function Datafono() {
  const [red, setRed] = useState(false);
  const [host, setHost] = useState('');
  const [puerto, setPuerto] = useState('9100');
  const [espera, setEspera] = useState('60');
  const [probando, setProbando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    configDatafono()
      .then((c) => {
        setRed(c.red);
        setHost(c.host);
        setPuerto(String(c.puerto));
        setEspera(String(c.espera));
      })
      .catch(() => {})
      .finally(() => setCargado(true));
  }, []);

  if (!cargado) return null;

  const guardar = async (cambios?: { red?: boolean }) => {
    const usaRed = cambios?.red ?? red;
    setAviso('');
    setError('');
    try {
      await configurarDatafono(
        usaRed,
        host.trim(),
        parseInt(puerto || '9100', 10) || 9100,
        parseInt(espera || '60', 10) || 60,
      );
      setAviso('Guardado');
      window.setTimeout(() => setAviso(''), 3000);
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ''));
    }
  };

  const probar = async () => {
    setProbando(true);
    setAviso('');
    setError('');
    try {
      const r = await probarDatafono(host.trim(), parseInt(puerto || '9100', 10) || 9100);
      setAviso(`El datáfono contestó en ${r.milisegundos} ms`);
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ''));
    } finally {
      setProbando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {([
          { id: false, nombre: 'Manual', detalle: 'Voucher a mano', icono: PenLine },
          { id: true, nombre: 'Por red', detalle: 'Integrado', icono: Network },
        ]).map(({ id, nombre, detalle, icono: Icono }) => (
          <button
            key={String(id)}
            onClick={() => { setRed(id); guardar({ red: id }); }}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-3 rounded-xl border-2 transition-colors ${
              red === id
                ? 'border-marca bg-marca text-sobre-marca'
                : 'border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            <Icono size={18} strokeWidth={2.25} />
            <span className="text-[13px] font-bold">{nombre}</span>
            <span className="text-[10.5px] opacity-70">{detalle}</span>
          </button>
        ))}
      </div>

      {!red ? (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[12.5px] text-slate-600 space-y-1">
          <p className="font-bold text-slate-700">Cómo funciona</p>
          <p>Pasa la tarjeta en el datáfono y escribe el número de aprobación en la caja.</p>
          <p className="text-slate-400">
            Funciona con cualquier datáfono y no hay nada que configurar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Dirección del datáfono
              </label>
              <input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                onBlur={() => guardar()}
                placeholder="192.168.1.50"
                className="w-full h-toque px-3 rounded-xl border-2 border-slate-200 text-[13.5px] font-mono outline-none focus:border-marca"
              />
            </div>
            <div className="w-24 space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Puerto
              </label>
              <input
                value={puerto}
                onChange={(e) => setPuerto(e.target.value.replace(/\D/g, '').slice(0, 5))}
                onBlur={() => guardar()}
                inputMode="numeric"
                className="w-full h-toque px-3 rounded-xl border-2 border-slate-200 text-[13.5px] tabular-nums outline-none focus:border-marca"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Cuánto esperarlo (segundos)
            </label>
            <input
              value={espera}
              onChange={(e) => setEspera(e.target.value.replace(/\D/g, '').slice(0, 3))}
              onBlur={() => guardar()}
              inputMode="numeric"
              className="w-full h-toque px-3 rounded-xl border-2 border-slate-200 text-[13.5px] tabular-nums outline-none focus:border-marca"
            />
            {/* El número importa y no es obvio: aquí se explica en qué se nota. */}
            <p className="text-[11px] text-slate-400">
              Es lo que tarda el cliente en pasar la tarjeta y digitar la clave. Muy corto y el
              cobro se cae a mitad; muy largo y la caja se queda esperando un aparato colgado.
            </p>
          </div>

          <button
            onClick={probar}
            disabled={probando || !host.trim()}
            className="w-full flex items-center justify-center gap-2 h-toque rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600 disabled:opacity-30"
          >
            {probando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} strokeWidth={2.25} />}
            {probando ? 'Tocando la puerta…' : 'Probar conexión'}
          </button>

          {/* Lo que la prueba hace y, sobre todo, lo que no hace. */}
          <p className="text-[11px] text-slate-400">
            La prueba solo comprueba que el aparato conteste. No cobra nada.
          </p>
        </div>
      )}

      {aviso && (
        <p className="flex items-center gap-2 text-[12.5px] font-semibold text-emerald-600">
          <CreditCard size={15} strokeWidth={2.25} />
          {aviso}
        </p>
      )}
      {error && <p className="text-[12.5px] font-semibold text-red-600">{error}</p>}
    </div>
  );
}
