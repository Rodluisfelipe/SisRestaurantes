import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useBusinessConfig } from '../../Context/BusinessContext';
import { Capa } from '../ui';

/**
 * La configuración de una caja registradora, desde el panel.
 *
 * Lo que hasta ahora había que ir a configurar máquina por máquina: el tiempo
 * de bloqueo, el régimen tributario, la impresora, el datáfono. Con seis cajas
 * en un local eso eran seis visitas cada vez que cambiaba algo.
 *
 * La caja lo recoge en su siguiente sincronización, en menos de treinta
 * segundos, y se redibuja sola sin cerrar turno ni reiniciar.
 *
 * **Una advertencia que aparece en la pestaña de periféricos y no es un
 * adorno:** si alguien ajustó una IP desde la terminal, esa caja deja de
 * aceptar hardware del panel. Quien está frente al aparato sabe mejor en qué
 * dirección responde, y pisárselo desde aquí dejaría el local sin imprimir.
 */
export default function ConfigCaja({ caja, onCerrar }) {
  const { businessId } = useBusinessConfig();
  const [config, setConfig] = useState(null);
  const [pestana, setPestana] = useState('operativa');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const res = await api.get(`/cajas/${caja._id}/config?businessId=${businessId}`);
      setConfig(res.data.config);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo cargar la configuración');
    }
  }, [caja._id, businessId]);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    setGuardando(true);
    setAviso('');
    setError('');
    try {
      await api.put(`/cajas/${caja._id}/config`, { businessId, config });
      setAviso('Guardado. La caja lo recoge en menos de 30 segundos.');
      window.setTimeout(() => setAviso(''), 6000);
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  };

  /** Cambia un campo anidado sin pisar el resto. */
  const set = (ruta, valor) => {
    setConfig((previa) => {
      const copia = structuredClone(previa);
      const partes = ruta.split('.');
      let nodo = copia;
      for (const parte of partes.slice(0, -1)) nodo = nodo[parte];
      nodo[partes.at(-1)] = valor;
      return copia;
    });
  };

  if (!config) {
    return (
      <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-6 text-[13px] text-slate-400">
          {error || 'Cargando…'}
        </div>
      </div>
    );
  }

  const PESTANAS = [
    { id: 'operativa', nombre: 'Operación' },
    { id: 'fiscal', nombre: 'Impuestos' },
    { id: 'hardware', nombre: 'Periféricos' },
  ];

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={onCerrar}>
      <Capa onCerrar={onCerrar} />
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl"
      >
        <div className="p-5 pb-3 flex-shrink-0">
          <h3 className="text-[15px] font-bold text-slate-900">{caja.nombre}</h3>
          <p className="text-[12.5px] text-slate-500 mt-0.5">
            Lo que cambies aquí llega a la caja sola, sin tener que ir al local.
          </p>

          <div className="flex gap-1.5 mt-3">
            {PESTANAS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPestana(p.id)}
                className={`flex-1 h-10 rounded-xl text-[13px] font-bold border-2 transition-colors ${
                  pestana === p.id
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {p.nombre}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 space-y-4">
          {pestana === 'operativa' && <Operativa config={config} set={set} />}
          {pestana === 'fiscal' && <Fiscal config={config} set={set} />}
          {pestana === 'hardware' && <Hardware config={config} set={set} />}
        </div>

        <div className="p-5 pt-3 flex-shrink-0 border-t border-slate-100 space-y-2">
          {aviso && <p className="text-[12.5px] font-semibold text-emerald-600">{aviso}</p>}
          {error && <p className="text-[12.5px] font-semibold text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={onCerrar}
              className="w-28 h-11 rounded-xl border-2 border-slate-200 text-[13px] font-bold text-slate-600"
            >
              Cerrar
            </button>
            <button
              onClick={guardar}
              disabled={guardando}
              className="flex-1 h-11 rounded-xl bg-slate-900 text-white text-[13px] font-bold disabled:opacity-40"
            >
              {guardando ? 'Guardando…' : 'Guardar y enviar a la caja'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Piezas ────────────────────────────────────────────────────────────── */

function Campo({ titulo, ayuda, children }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{titulo}</label>
      {children}
      {ayuda && <p className="text-[11px] text-slate-400">{ayuda}</p>}
    </div>
  );
}

function Interruptor({ titulo, ayuda, valor, onCambiar }) {
  return (
    <button
      onClick={() => onCambiar(!valor)}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 text-left"
    >
      <span
        className={`flex-shrink-0 w-10 h-6 rounded-full transition-colors relative ${
          valor ? 'bg-slate-900' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
            valor ? 'left-[1.125rem]' : 'left-0.5'
          }`}
        />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-bold text-slate-800">{titulo}</span>
        {ayuda && <span className="block text-[11.5px] text-slate-500">{ayuda}</span>}
      </span>
    </button>
  );
}

const entrada = 'w-full h-11 px-3 rounded-xl border-2 border-slate-200 text-[13.5px] outline-none focus:border-slate-900';

/* ── Pestaña 1 ─────────────────────────────────────────────────────────── */

function Operativa({ config, set }) {
  return (
    <>
      <Campo
        titulo={`Bloqueo por inactividad: ${config.autoBloqueoSegundos} s`}
        ayuda="Cuánto espera la caja antes de pedir el PIN otra vez. Es lo que impide que alguien cobre bajo el usuario del que se fue a almorzar."
      >
        <input
          type="range"
          min={30}
          max={300}
          step={10}
          value={config.autoBloqueoSegundos}
          onChange={(e) => set('autoBloqueoSegundos', Number(e.target.value))}
          className="w-full accent-slate-900"
        />
      </Campo>

      <Interruptor
        titulo="Sonido de la caja"
        ayuda="Un bip al marcar y otro distinto al fallar. Se procesa sin mirar la pantalla."
        valor={config.sonidoActivo}
        onCambiar={(v) => set('sonidoActivo', v)}
      />

      <Interruptor
        titulo="Pedir propina en las mesas"
        ayuda="Solo en cuentas de salón. En mostrador, preguntarla por cada café es un toque de más trescientas veces al día."
        valor={config.propinaEnMesas}
        onCambiar={(v) => set('propinaEnMesas', v)}
      />

      {config.propinaEnMesas && (
        <Campo titulo="Propina sugerida" ayuda="El porcentaje que aparece marcado por defecto. El cliente puede cambiarlo o quitarlo.">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={50}
              value={config.propinaSugerida}
              onChange={(e) => set('propinaSugerida', Number(e.target.value))}
              className={`${entrada} w-24 tabular-nums`}
            />
            <span className="text-[13px] font-bold text-slate-400">%</span>
          </div>
        </Campo>
      )}
    </>
  );
}

/* ── Pestaña 2 ─────────────────────────────────────────────────────────── */

function Fiscal({ config, set }) {
  const f = config.fiscal;

  /* Las categorías se escriben separadas por coma y se comparan en minúsculas
     contra la categoría del producto. Un selector de las categorías del menú
     sería mejor, pero obligaría a tenerlas creadas antes de poder configurar
     esto, y un negocio necesita declarar bien desde el primer día. */
  const lista = (texto) => texto.split(',').map((c) => c.trim()).filter(Boolean);

  return (
    <>
      <Interruptor
        titulo="Cobrar impuestos"
        ayuda="Apágalo si el negocio no es responsable. Todo saldrá como exento."
        valor={f.impuestosActivos}
        onCambiar={(v) => set('fiscal.impuestosActivos', v)}
      />

      {f.impuestosActivos && (
        <>
          <Campo titulo="Régimen de la mayoría de tus productos">
            <div className="space-y-1.5">
              {[
                ['INC_8', 'Impoconsumo 8%', 'Restaurantes, bares, comida preparada.'],
                ['IVA_19', 'IVA 19%', 'Tiendas, ropa, mercancía.'],
                ['NO_RESPONSABLE', 'No responsable', 'El negocio no cobra impuesto.'],
              ].map(([id, nombre, ayuda]) => (
                <button
                  key={id}
                  onClick={() => set('fiscal.regimenPrincipal', id)}
                  className={`w-full p-3 rounded-xl border-2 text-left transition-colors ${
                    f.regimenPrincipal === id ? 'border-slate-900 bg-slate-50' : 'border-slate-200'
                  }`}
                >
                  <span className="block text-[13px] font-bold text-slate-800">{nombre}</span>
                  <span className="block text-[11.5px] text-slate-500">{ayuda}</span>
                </button>
              ))}
            </div>
          </Campo>

          <Campo
            titulo="Categorías que pagan IVA 19%"
            ayuda="Aunque el negocio opere en impoconsumo. Separadas por coma. Si lo dejas vacío, la caja usa su lista de siempre: licores, cervezas, cigarrillos."
          >
            <input
              value={(f.categoriasIva || []).join(', ')}
              onChange={(e) => set('fiscal.categoriasIva', lista(e.target.value))}
              placeholder="licores, cervezas, cigarrillos"
              className={entrada}
            />
          </Campo>

          <Campo titulo="Categorías exentas" ayuda="No pagan ningún impuesto.">
            <input
              value={(f.categoriasExentas || []).join(', ')}
              onChange={(e) => set('fiscal.categoriasExentas', lista(e.target.value))}
              placeholder="donaciones"
              className={entrada}
            />
          </Campo>
        </>
      )}

      <Campo
        titulo="Texto al pie de la tirilla"
        ayuda="La resolución DIAN, el régimen o un mensaje de despedida. Sale impreso en cada venta."
      >
        <textarea
          value={f.textoPieFactura}
          onChange={(e) => set('fiscal.textoPieFactura', e.target.value)}
          rows={3}
          maxLength={300}
          placeholder="Resolución DIAN 18764… · No responsable de IVA"
          className="w-full px-3 py-2 rounded-xl border-2 border-slate-200 text-[13px] outline-none focus:border-slate-900"
        />
      </Campo>
    </>
  );
}

/* ── Pestaña 3 ─────────────────────────────────────────────────────────── */

function Hardware({ config, set }) {
  const h = config.hardware;

  return (
    <>
      {/* La advertencia va arriba y no al pie: quien entra a esta pestaña
          necesita saber esto antes de cambiar nada, no después de guardar. */}
      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
        <p className="text-[12px] font-bold text-amber-900">Si alguien tocó esto en la caja</p>
        <p className="text-[11.5px] text-amber-800 mt-0.5">
          Esa terminal deja de aceptar periféricos desde aquí, a propósito: quien está frente al
          aparato sabe mejor en qué dirección responde. Para devolver el mando al panel hay que
          hacerlo desde la caja, en Aparatos conectados.
        </p>
      </div>

      <FichaImpresora
        titulo="Impresora de caja"
        ayuda="La que saca la tirilla y a la que se conecta el cajón monedero."
        valor={h.impresoraCaja}
        onCambiar={(campo, v) => set(`hardware.impresoraCaja.${campo}`, v)}
      />

      <FichaImpresora
        titulo="Impresora de cocina"
        ayuda="Opcional. Casi siempre de red, porque está a diez metros."
        valor={h.impresoraCocina}
        onCambiar={(campo, v) => set(`hardware.impresoraCocina.${campo}`, v)}
      />

      <div className="p-3 rounded-xl bg-slate-50 space-y-2">
        <p className="text-[13px] font-bold text-slate-800">Datáfono</p>
        <div className="flex gap-1.5">
          {[['MANUAL', 'Voucher a mano'], ['RED', 'Integrado por red']].map(([id, nombre]) => (
            <button
              key={id}
              onClick={() => set('hardware.datafono.tipo', id)}
              className={`flex-1 h-10 rounded-xl text-[12.5px] font-bold border-2 ${
                h.datafono.tipo === id ? 'border-slate-900 bg-white' : 'border-slate-200 text-slate-500'
              }`}
            >
              {nombre}
            </button>
          ))}
        </div>

        {h.datafono.tipo === 'RED' && (
          <>
            <div className="flex gap-2">
              <input
                value={h.datafono.host}
                onChange={(e) => set('hardware.datafono.host', e.target.value)}
                placeholder="192.168.1.60"
                className={`${entrada} font-mono`}
              />
              <input
                type="number"
                value={h.datafono.puerto}
                onChange={(e) => set('hardware.datafono.puerto', Number(e.target.value))}
                className={`${entrada} w-24 tabular-nums`}
              />
            </div>
            <Campo
              titulo={`Cuánto esperarlo: ${h.datafono.esperaSegundos} s`}
              ayuda="Lo que tarda el cliente en pasar la tarjeta y digitar la clave. Muy corto y el cobro se cae a mitad; muy largo y la caja espera a un aparato colgado."
            >
              <input
                type="range"
                min={5}
                max={180}
                step={5}
                value={h.datafono.esperaSegundos}
                onChange={(e) => set('hardware.datafono.esperaSegundos', Number(e.target.value))}
                className="w-full accent-slate-900"
              />
            </Campo>
          </>
        )}
      </div>

      <Interruptor
        titulo="Abrir la gaveta al cobrar en efectivo"
        ayuda="Apágalo si el negocio no maneja efectivo en esta terminal."
        valor={h.cajon.abrirAlCobrarEfectivo}
        onCambiar={(v) => set('hardware.cajon.abrirAlCobrarEfectivo', v)}
      />

      <Interruptor
        titulo="Mostrar QR de transferencia al cliente"
        ayuda="En la pantalla del cliente, cuando se cobra por transferencia."
        valor={h.pantallaCliente.mostrarQr}
        onCambiar={(v) => set('hardware.pantallaCliente.mostrarQr', v)}
      />

      {h.pantallaCliente.mostrarQr && (
        <Campo
          titulo="Tu código de cobro"
          ayuda="Pega el enlace o la llave que ya usas hoy. Escribe {monto} y {ref} donde deban ir el valor y el número de la venta; si tu código no los admite, déjalo tal cual y la pantalla mostrará el monto en letra grande al lado."
        >
          <input
            value={h.pantallaCliente.plantillaQr}
            onChange={(e) => set('hardware.pantallaCliente.plantillaQr', e.target.value)}
            placeholder="https://mibanco.co/pagar?monto={monto}&ref={ref}"
            className={`${entrada} font-mono text-[12px]`}
          />
        </Campo>
      )}
    </>
  );
}

function FichaImpresora({ titulo, ayuda, valor, onCambiar }) {
  return (
    <div className="p-3 rounded-xl bg-slate-50 space-y-2">
      <div>
        <p className="text-[13px] font-bold text-slate-800">{titulo}</p>
        <p className="text-[11.5px] text-slate-500">{ayuda}</p>
      </div>

      <div className="flex gap-1.5">
        {[['NINGUNA', 'Ninguna'], ['WINDOWS', 'Windows (USB)'], ['RED', 'Red'], ['SERIAL', 'Puerto COM']].map(([id, nombre]) => (
          <button
            key={id}
            onClick={() => onCambiar('tipo', id)}
            className={`flex-1 h-10 rounded-xl text-[12.5px] font-bold border-2 ${
              valor.tipo === id ? 'border-slate-900 bg-white' : 'border-slate-200 text-slate-500'
            }`}
          >
            {nombre}
          </button>
        ))}
      </div>

      {valor.tipo === 'RED' && (
        <div className="flex gap-2">
          <input
            value={valor.host}
            onChange={(e) => onCambiar('host', e.target.value)}
            placeholder="192.168.1.50"
            className={`${entrada} font-mono`}
          />
          <input
            type="number"
            value={valor.puerto}
            onChange={(e) => onCambiar('puerto', Number(e.target.value))}
            className={`${entrada} w-24 tabular-nums`}
          />
        </div>
      )}

      {valor.tipo === 'WINDOWS' && (
        /* El nombre tal cual aparece en "Impresoras y escáneres" de Windows.
           Si no se sabe, es más fácil elegirla desde la propia caja, que
           muestra la lista de las instaladas. */
        <input
          value={valor.nombre || ''}
          onChange={(e) => onCambiar('nombre', e.target.value)}
          placeholder="Nombre en Windows, ej. POS-58"
          className={entrada}
        />
      )}

      {valor.tipo === 'SERIAL' && (
        <div className="flex gap-2">
          <input
            value={valor.com}
            onChange={(e) => onCambiar('com', e.target.value)}
            placeholder="COM3"
            className={`${entrada} font-mono`}
          />
          <input
            type="number"
            value={valor.baudios}
            onChange={(e) => onCambiar('baudios', Number(e.target.value))}
            className={`${entrada} w-28 tabular-nums`}
          />
        </div>
      )}

      {valor.tipo !== 'NINGUNA' && (
        <div className="flex gap-1.5">
          {[44, 58, 76, 80].map((mm) => (
            <button
              key={mm}
              onClick={() => onCambiar('anchoMm', mm)}
              className={`flex-1 h-10 rounded-xl text-[12.5px] font-bold border-2 tabular-nums ${
                valor.anchoMm === mm ? 'border-slate-900 bg-white' : 'border-slate-200 text-slate-500'
              }`}
            >
              {mm} mm
            </button>
          ))}
        </div>
      )}

      {valor.tipo !== 'NINGUNA' && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
            <input
              type="checkbox"
              checked={valor.corte !== false}
              onChange={(e) => onCambiar('corte', e.target.checked)}
            />
            Tiene cuchilla
          </label>
          <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
            QR del menú
            <select
              value={valor.qr || 'imagen'}
              onChange={(e) => onCambiar('qr', e.target.value)}
              className="h-9 px-2 rounded-lg border border-slate-200 bg-white"
            >
              <option value="imagen">Imagen (casi todas)</option>
              <option value="nativo">Nativo (más nítido)</option>
              <option value="no">No imprimir</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
