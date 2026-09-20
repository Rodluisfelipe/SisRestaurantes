import { useMemo, useState } from 'react';
import { abrirTurno, cerrarTurno, moverEfectivo, pesos, type CierreTurno, type Turno, type Usuario } from './nativo';

/**
 * Abrir el turno: cuánto hay en la gaveta para arrancar.
 *
 * Es la primera pantalla del día y la única que pregunta por el fondo. Ese
 * número es la base de todo el arqueo: si se digita mal, el cierre va a marcar
 * un descuadre que nadie se robó.
 */
export function AbrirTurno({ usuario, onAbierto }: { usuario: Usuario; onAbierto: (t: Turno) => void }) {
  const [fondo, setFondo] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const abrir = async () => {
    setOcupado(true);
    setError('');
    try {
      onAbierto(await abrirTurno(parseInt(fondo || '0', 10) || 0));
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ''));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-100 gap-5">
      <div className="text-center">
        <p className="text-xl font-black">Hola, {usuario.nombre}</p>
        <p className="text-sm text-slate-500 mt-1">¿Con cuánto efectivo arranca la caja?</p>
      </div>

      <input
        autoFocus
        value={fondo}
        onChange={(e) => setFondo(e.target.value.replace(/\D/g, ''))}
        onKeyDown={(e) => { if (e.key === 'Enter') abrir(); }}
        inputMode="numeric"
        placeholder="0"
        className="w-72 h-16 px-4 rounded-2xl border-2 border-slate-200 bg-white text-center text-3xl font-black tabular-nums outline-none focus:border-marca"
      />

      <p className="text-[12px] text-slate-400 max-w-xs text-center">
        Cuenta la gaveta antes de escribir. Este número es contra el que se va a
        comparar al cerrar.
      </p>

      {error && <p className="text-[13px] font-semibold text-red-600">{error}</p>}

      <button
        onClick={abrir}
        disabled={ocupado}
        className="w-72 h-14 rounded-2xl bg-marca text-sobre-marca text-lg font-black disabled:opacity-40"
      >
        {ocupado ? 'Abriendo…' : 'Abrir turno'}
      </button>
    </div>
  );
}

/* Lo que circula en Colombia. Los billetes primero, que es como se cuenta una
   gaveta: se apilan por denominación de mayor a menor y después las monedas.
   El de 1.000 existe como billete y como moneda; se cuenta junto, porque para
   el arqueo vale lo mismo y separarlo solo invita a equivocarse. */
const DENOMINACIONES = [100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000, 500, 200, 100, 50];

/**
 * El panel del turno: mover plata y cerrar.
 *
 * **El cierre es ciego.** Esta pantalla nunca muestra cuánto debería haber en
 * la gaveta: el cajero cuenta, digita y solo entonces aparece la diferencia. Si
 * soplara el esperado, quien tomó plata escribiría esa cifra exacta y el
 * arqueo dejaría de medir nada.
 */
export function PanelTurno({
  turno,
  onCerrado,
  onSalir,
}: {
  turno: Turno;
  onCerrado: (c: CierreTurno) => void;
  onSalir: () => void;
}) {
  const [vista, setVista] = useState<'menu' | 'movimiento' | 'cierre'>('menu');
  const [entrada, setEntrada] = useState(true);
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [contado, setContado] = useState('');
  /* El conteo por denominaciones: cuántos billetes de cada uno. Sumar de
     cabeza o con una calculadora aparte es el origen clásico del descuadre
     involuntario, ese que no es robo sino cansancio a las diez de la noche. */
  const [cuantos, setCuantos] = useState<Record<number, string>>({});
  const [aMano, setAMano] = useState(false);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const totalContado = useMemo(
    () => DENOMINACIONES.reduce((t, d) => t + d * (parseInt(cuantos[d] || '0', 10) || 0), 0),
    [cuantos],
  );
  const aEntregar = aMano ? parseInt(contado || '0', 10) || 0 : totalContado;

  const guardarMovimiento = async () => {
    setOcupado(true);
    setError('');
    try {
      await moverEfectivo(entrada, parseInt(monto || '0', 10) || 0, motivo);
      setMonto('');
      setMotivo('');
      setVista('menu');
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ''));
    } finally {
      setOcupado(false);
    }
  };

  const cerrar = async () => {
    setOcupado(true);
    setError('');
    try {
      onCerrado(await cerrarTurno(aEntregar));
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ''));
      setOcupado(false);
    }
  };

  return (
    <div className="p-5 space-y-4">
      <div>
        <p className="text-[15px] font-black">Turno de {turno.cajero}</p>
        <p className="text-[12px] text-slate-400">
          Abierto {new Date(turno.abierto_en).toLocaleString('es-CO')} · fondo {pesos(turno.fondo_inicial)}
        </p>
      </div>

      {vista === 'menu' && (
        <div className="space-y-2">
          <button
            onClick={() => { setEntrada(true); setVista('movimiento'); }}
            className="w-full h-12 rounded-xl border border-slate-200 text-[13.5px] font-semibold hover:bg-slate-50"
          >
            Entra plata a la gaveta
          </button>
          <button
            onClick={() => { setEntrada(false); setVista('movimiento'); }}
            className="w-full h-12 rounded-xl border border-slate-200 text-[13.5px] font-semibold hover:bg-slate-50"
          >
            Sale plata de la gaveta
          </button>
          <button
            onClick={() => setVista('cierre')}
            className="w-full h-12 rounded-xl bg-marca text-sobre-marca text-[13.5px] font-bold"
          >
            Cerrar turno y contar
          </button>
          <button
            onClick={onSalir}
            className="w-full h-toque text-[12.5px] font-semibold text-slate-400 hover:text-slate-700"
          >
            Bloquear caja sin cerrar el turno
          </button>
        </div>
      )}

      {vista === 'movimiento' && (
        <div className="space-y-2">
          <input
            autoFocus
            value={monto}
            onChange={(e) => setMonto(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="Cuánto"
            className="w-full h-12 px-3 rounded-xl border-2 border-slate-200 text-center text-xl font-black tabular-nums outline-none focus:border-marca"
          />
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={entrada ? 'De dónde salió (sencillo del banco…)' : 'En qué se gastó (hielo, domiciliario…)'}
            className="w-full h-12 px-3 rounded-xl border-2 border-slate-200 text-[13.5px] outline-none focus:border-marca"
          />
          {/* El motivo es obligatorio: sin él, una salida es indistinguible de un faltante. */}
          <p className="text-[11.5px] text-slate-400">
            El motivo es obligatorio. Es lo que después distingue un gasto de un faltante.
          </p>
          {error && <p className="text-[13px] font-semibold text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setVista('menu'); setError(''); }} className="flex-1 h-12 rounded-xl border border-slate-200 text-[13px] font-semibold">
              Cancelar
            </button>
            <button
              onClick={guardarMovimiento}
              disabled={ocupado}
              className="flex-1 h-12 rounded-xl bg-marca text-sobre-marca text-[13px] font-bold disabled:opacity-40"
            >
              Registrar
            </button>
          </div>
        </div>
      )}

      {vista === 'cierre' && (
        <div className="space-y-2">
          <p className="text-[13px] font-semibold text-slate-700">
            Cuenta la gaveta por denominación. Nosotros sumamos.
          </p>

          {!aMano ? (
            <div className="space-y-1">
              {DENOMINACIONES.map((d) => {
                const n = parseInt(cuantos[d] || '0', 10) || 0;
                return (
                  <div key={d} className="flex items-center gap-2">
                    <span className="w-20 text-right text-[13px] font-semibold text-slate-600 tabular-nums">
                      {pesos(d)}
                    </span>
                    <span className="text-slate-300">×</span>
                    <input
                      value={cuantos[d] || ''}
                      onChange={(e) => setCuantos((c) => ({ ...c, [d]: e.target.value.replace(/\D/g, '') }))}
                      inputMode="numeric"
                      placeholder="0"
                      className="w-16 h-toque px-2 rounded-lg border-2 border-slate-200 text-center text-[14px] font-bold tabular-nums outline-none focus:border-marca"
                    />
                    {/* El subtotal a la vista: el cajero detecta el dedazo en el momento. */}
                    <span className="flex-1 text-right text-[13px] tabular-nums text-slate-400">
                      {n > 0 ? pesos(d * n) : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <input
              autoFocus
              value={contado}
              onChange={(e) => setContado(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              placeholder="0"
              className="w-full h-16 px-3 rounded-xl border-2 border-slate-200 text-center text-3xl font-black tabular-nums outline-none focus:border-marca"
            />
          )}

          <div className="flex items-baseline justify-between pt-2 border-t border-slate-100">
            <span className="text-[13px] font-semibold text-slate-500">Vas a entregar</span>
            <span className="text-2xl font-black tabular-nums">{pesos(aEntregar)}</span>
          </div>

          <button
            onClick={() => setAMano(!aMano)}
            className="text-[11.5px] font-semibold text-slate-400 hover:text-slate-700"
          >
            {aMano ? 'Contar por denominaciones' : 'Escribir el total directamente'}
          </button>

          <p className="text-[11.5px] text-slate-400">
            No te decimos cuánto debería haber: por eso el conteo sirve. La
            diferencia aparece después de guardar.
          </p>
          {error && <p className="text-[13px] font-semibold text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setVista('menu'); setError(''); }} className="flex-1 h-12 rounded-xl border border-slate-200 text-[13px] font-semibold">
              Atrás
            </button>
            <button
              onClick={cerrar}
              disabled={ocupado || (aMano && contado === '')}
              className="flex-1 h-12 rounded-xl bg-marca text-sobre-marca text-[13px] font-bold disabled:opacity-40"
            >
              {ocupado ? 'Cerrando…' : 'Cerrar turno'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** El resultado del arqueo, una vez contado. */
export function ResumenCierre({ cierre, onListo }: { cierre: CierreTurno; onListo: () => void }) {
  const falta = cierre.diferencia < 0;
  const sobra = cierre.diferencia > 0;

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-100 gap-4 p-6">
      <p className="text-lg font-black">Turno de {cierre.cajero} cerrado</p>

      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-4 space-y-1.5 text-[13px]">
        {[
          ['Fondo inicial', cierre.fondo_inicial],
          ['Ventas en efectivo', cierre.ventas_efectivo],
          ['Entradas', cierre.entradas],
          ['Salidas', -cierre.salidas],
        ].map(([etiqueta, valor]) => (
          <div key={etiqueta as string} className="flex justify-between text-slate-500">
            <span>{etiqueta}</span>
            <span className="tabular-nums">{pesos(valor as number)}</span>
          </div>
        ))}

        <div className="flex justify-between pt-2 border-t border-slate-100 font-semibold">
          <span>Debía haber</span>
          <span className="tabular-nums">{pesos(cierre.esperado)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Contaste</span>
          <span className="tabular-nums">{pesos(cierre.contado)}</span>
        </div>

        <div
          className={`flex justify-between pt-2 border-t border-slate-100 text-base font-black ${
            falta ? 'text-red-600' : sobra ? 'text-amber-600' : 'text-emerald-600'
          }`}
        >
          <span>{falta ? 'Faltan' : sobra ? 'Sobran' : 'Cuadró'}</span>
          <span className="tabular-nums">{pesos(Math.abs(cierre.diferencia))}</span>
        </div>

        {cierre.ventas_otros > 0 && (
          <p className="pt-2 text-[11.5px] text-slate-400">
            Además {pesos(cierre.ventas_otros)} en tarjeta o transferencia, que no pasan por la gaveta.
          </p>
        )}

        {cierre.propina_efectivo > 0 && (
          /* La propina está **dentro** de lo contado: es plata que el cliente
             dejó y que hay que sacar de la gaveta al liquidar. Decirlo aquí es
             lo que evita que mañana aparezca como un faltante sin explicación. */
          <p className="pt-2 text-[11.5px] font-semibold text-emerald-700">
            De lo contado, {pesos(cierre.propina_efectivo)} son propina: no son del negocio.
          </p>
        )}

        {cierre.devoluciones_efectivo > 0 && (
          <p className="pt-1 text-[11.5px] text-slate-400">
            Se devolvieron {pesos(cierre.devoluciones_efectivo)} en efectivo, ya restados.
          </p>
        )}

        {cierre.aperturas_sin_venta > 5 && (
          /* No acusa a nadie: cuenta. Abrir la gaveta sin vender es normal una
             o dos veces por turno —dar cambio, revisar el fondo—; ocho veces es
             un patrón, y el patrón solo se ve si alguien lo cuenta. */
          <p className="mt-2 px-2 py-1.5 rounded-lg bg-amber-50 text-[11.5px] font-semibold text-amber-800">
            La gaveta se abrió {cierre.aperturas_sin_venta} veces sin una venta detrás.
          </p>
        )}
      </div>

      <p className="text-[11.5px] text-slate-400 max-w-sm text-center">
        El arqueo queda guardado y sube solo cuando haya internet. El dueño lo ve
        desde el panel, con la hora exacta.
      </p>

      <button onClick={onListo} className="w-full max-w-sm h-14 rounded-2xl bg-marca text-sobre-marca font-black">
        Listo
      </button>
    </div>
  );
}
