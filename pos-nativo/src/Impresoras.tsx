import { useEffect, useState } from 'react';
import { CreditCard, Printer } from 'lucide-react';
import {
  configurarImpresora, impresoras, probarImpresora,
  type ConfigImpresora, type Impresora, type Impresoras as Config,
} from './nativo';
import Datafono from './Datafono';

/**
 * Dónde imprime esta caja.
 *
 * Dos impresoras, que son las dos que existen en un local: la de **caja**, que
 * saca la tirilla y a la que cuelga el cajón monedero, y la de **cocina**, que
 * es opcional y casi siempre de red porque está a diez metros.
 *
 * El botón de probar no es un adorno: es la única forma de saber si el papel
 * sale **antes** de que haya un cliente esperando. Y la prueba lleva tildes y Ñ
 * a propósito, que es donde falla la mitad de las configuraciones.
 */
export default function Impresoras({ onCerrar }: { onCerrar: () => void }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  /* Los dos aparatos que un local conecta a la caja. Van juntos porque se
     configuran el mismo día —el de la instalación— y no se vuelven a tocar. */
  const [pestana, setPestana] = useState<'impresoras' | 'datafono'>('impresoras');

  useEffect(() => { impresoras().then(setConfig).catch(() => {}); }, []);

  if (!config) return null;

  const guardar = async (rol: 'caja' | 'cocina', nueva: ConfigImpresora) => {
    setConfig({ ...config, [rol]: nueva });
    try {
      await configurarImpresora(rol, nueva);
      setError('');
    } catch (e) {
      setError(String(e));
    }
  };

  const probar = async (rol: 'caja' | 'cocina') => {
    setAviso('');
    setError('');
    try {
      await probarImpresora(rol);
      setAviso(`Se mandó la prueba a la impresora de ${rol}`);
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ''));
    }
  };

  return (
    <div className="fixed inset-0 z-30 bg-black/50 flex items-center justify-center" onClick={onCerrar}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[520px] max-h-[85vh] overflow-y-auto bg-white rounded-2xl p-5 space-y-4"
      >
        <p className="text-[15px] font-black">Aparatos conectados</p>

        <div className="flex gap-1.5">
          {([
            { id: 'impresoras' as const, nombre: 'Impresoras', icono: Printer },
            { id: 'datafono' as const, nombre: 'Datáfono', icono: CreditCard },
          ]).map(({ id, nombre, icono: Icono }) => (
            <button
              key={id}
              onClick={() => setPestana(id)}
              className={`flex-1 flex items-center justify-center gap-2 h-toque rounded-xl text-[13px] font-bold border-2 transition-colors ${
                pestana === id
                  ? 'border-marca bg-marca text-sobre-marca'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <Icono size={16} strokeWidth={2.25} />
              {nombre}
            </button>
          ))}
        </div>

        {pestana === 'datafono' ? (
          <Datafono />
        ) : (
          <>
            {(['caja', 'cocina'] as const).map((rol) => (
              <Ficha
                key={rol}
                rol={rol}
                valor={config[rol]}
                puertos={config.puertos}
                onCambiar={(nueva) => guardar(rol, nueva)}
                onProbar={() => probar(rol)}
              />
            ))}

            {aviso && <p className="text-[12.5px] font-semibold text-emerald-600">{aviso}</p>}
            {error && <p className="text-[12.5px] font-semibold text-red-600">{error}</p>}
          </>
        )}

        <button onClick={onCerrar} className="w-full h-toque rounded-xl bg-marca text-sobre-marca text-[13px] font-bold">
          Listo
        </button>
      </div>
    </div>
  );
}

function Ficha({
  rol,
  valor,
  puertos,
  onCambiar,
  onProbar,
}: {
  rol: 'caja' | 'cocina';
  valor: ConfigImpresora;
  puertos: string[];
  onCambiar: (c: ConfigImpresora) => void;
  onProbar: () => void;
}) {
  const tipo = valor.impresora.tipo;

  const cambiarTipo = (nuevo: Impresora['tipo']) => {
    const impresora: Impresora =
      nuevo === 'red' ? { tipo: 'red', host: '192.168.1.100', puerto: 9100 }
      : nuevo === 'serie' ? { tipo: 'serie', puerto: puertos[0] || 'COM3', baudios: 9600 }
      : nuevo === 'archivo' ? { tipo: 'archivo', ruta: '/dev/usb/lp0' }
      : { tipo: 'ninguna' };
    onCambiar({ ...valor, impresora });
  };

  return (
    <div className="rounded-xl border border-slate-200 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[13.5px] font-bold capitalize">
          {rol === 'caja' ? 'Caja (tirilla y cajón)' : 'Cocina (comanda)'}
        </p>
        <button
          onClick={onProbar}
          disabled={tipo === 'ninguna'}
          className="h-toque px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-[12px] font-bold disabled:opacity-30"
        >
          Probar
        </button>
      </div>

      <div className="flex gap-1.5">
        {([
          ['ninguna', 'Ninguna'],
          ['red', 'Red'],
          ['serie', 'USB / COM'],
          ['archivo', 'Archivo'],
        ] as const).map(([id, etiqueta]) => (
          <button
            key={id}
            onClick={() => cambiarTipo(id)}
            className={`flex-1 h-toque rounded-lg text-[11.5px] font-bold border-2 transition-colors ${
              tipo === id ? 'border-marca bg-marca text-sobre-marca' : 'border-slate-200 text-slate-500'
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {valor.impresora.tipo === 'red' && (
        <div className="flex gap-2">
          <input
            value={valor.impresora.host}
            onChange={(e) => onCambiar({ ...valor, impresora: { tipo: 'red', host: e.target.value, puerto: (valor.impresora as any).puerto } })}
            placeholder="192.168.1.100"
            className="flex-1 h-toque px-3 rounded-lg border-2 border-slate-200 text-[13px] outline-none focus:border-marca"
          />
          <input
            value={valor.impresora.puerto}
            onChange={(e) => onCambiar({ ...valor, impresora: { tipo: 'red', host: (valor.impresora as any).host, puerto: parseInt(e.target.value || '9100', 10) || 9100 } })}
            className="w-24 h-toque px-3 rounded-lg border-2 border-slate-200 text-[13px] tabular-nums outline-none focus:border-marca"
          />
        </div>
      )}

      {valor.impresora.tipo === 'serie' && (
        <div className="flex gap-2">
          {/* La lista sale del sistema: nadie tiene que adivinar si es COM3 o COM7. */}
          <select
            value={valor.impresora.puerto}
            onChange={(e) => onCambiar({ ...valor, impresora: { tipo: 'serie', puerto: e.target.value, baudios: (valor.impresora as any).baudios } })}
            className="flex-1 h-toque px-2 rounded-lg border-2 border-slate-200 text-[13px]"
          >
            {[valor.impresora.puerto, ...puertos.filter((p) => p !== (valor.impresora as any).puerto)].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select
            value={valor.impresora.baudios}
            onChange={(e) => onCambiar({ ...valor, impresora: { tipo: 'serie', puerto: (valor.impresora as any).puerto, baudios: parseInt(e.target.value, 10) } })}
            className="w-28 h-toque px-2 rounded-lg border-2 border-slate-200 text-[13px]"
          >
            {[9600, 19200, 38400, 115200].map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      )}

      {valor.impresora.tipo === 'archivo' && (
        <input
          value={valor.impresora.ruta}
          onChange={(e) => onCambiar({ ...valor, impresora: { tipo: 'archivo', ruta: e.target.value } })}
          placeholder="/dev/usb/lp0"
          className="w-full h-toque px-3 rounded-lg border-2 border-slate-200 text-[13px] outline-none focus:border-marca"
        />
      )}

      {tipo !== 'ninguna' && (
        <div className="flex gap-1.5 items-center">
          <span className="text-[11.5px] text-slate-400">Ancho del papel</span>
          {[[48, '80 mm'], [32, '58 mm']].map(([ancho, etiqueta]) => (
            <button
              key={ancho}
              onClick={() => onCambiar({ ...valor, ancho: ancho as number })}
              className={`h-toque px-3 rounded-lg text-[11.5px] font-bold border-2 ${
                valor.ancho === ancho ? 'border-marca bg-marca text-sobre-marca' : 'border-slate-200 text-slate-500'
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
