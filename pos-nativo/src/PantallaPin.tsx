import { useEffect, useState } from 'react';
import { crearUsuario, entrar, hayUsuarios, type Usuario } from './nativo';

/**
 * La puerta de la caja.
 *
 * Un teclado numérico grande y nada más. Aparece al arrancar, al cerrar turno y
 * cada vez que la caja se bloquea sola por inactividad — que es lo que impide
 * que un cajero cobre bajo el usuario del que se fue a almorzar.
 *
 * Acepta el teclado físico además de la pantalla: en un mostrador con teclado,
 * obligar a apuntar con el dedo es más lento.
 */
export default function PantallaPin({ onEntrar }: { onEntrar: (u: Usuario) => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  /* Instalación: mientras no exista ningún usuario, la primera pantalla no es
     un PIN sino la creación del dueño. Sin esto, una caja recién instalada
     quedaría cerrada con llave y sin llave. */
  const [primeraVez, setPrimeraVez] = useState<boolean | null>(null);
  const [nombre, setNombre] = useState('');

  useEffect(() => {
    hayUsuarios().then((hay) => setPrimeraVez(!hay)).catch(() => setPrimeraVez(false));
  }, []);

  const confirmar = async (valor: string) => {
    if (ocupado) return;
    setOcupado(true);
    setError('');
    try {
      const usuario = primeraVez
        ? await crearUsuario(nombre.trim() || 'Dueño', valor, true)
        : await entrar(valor);
      setPin('');
      onEntrar(usuario);
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ''));
      setPin('');
    } finally {
      setOcupado(false);
    }
  };

  const marcar = (d: string) => {
    const siguiente = (pin + d).slice(0, 8);
    setPin(siguiente);
    // Cuatro dígitos es el PIN normal: se envía solo, sin pedir "aceptar".
    if (siguiente.length === 4 && !primeraVez) confirmar(siguiente);
  };

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) marcar(e.key);
      if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
      if (e.key === 'Enter' && pin.length >= 4) confirmar(pin);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-6">
      <div className="text-center">
        <p className="text-2xl font-black tracking-tight">MenuBy POS</p>
        <p className="text-sm text-slate-400 mt-1">
          {primeraVez ? 'Crea el usuario del dueño' : 'Ingresa tu PIN'}
        </p>
      </div>

      {primeraVez && (
        <input
          autoFocus
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Tu nombre"
          className="w-64 h-12 px-4 rounded-xl bg-slate-800 border-2 border-slate-700 text-center outline-none focus:border-white"
        />
      )}

      {/* Los puntos, no los números: nadie tiene que poder leer el PIN por encima del hombro. */}
      <div className="flex gap-3 h-6">
        {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
          <span
            key={i}
            className={`w-4 h-4 rounded-full transition-colors ${i < pin.length ? 'bg-white' : 'bg-slate-700'}`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            onClick={() => marcar(d)}
            className="w-20 h-20 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-2xl font-bold transition-all"
          >
            {d}
          </button>
        ))}
        <button
          onClick={() => setPin((p) => p.slice(0, -1))}
          className="w-20 h-20 rounded-2xl bg-slate-800/60 hover:bg-slate-700 text-xl transition-all"
        >
          ←
        </button>
        <button
          onClick={() => marcar('0')}
          className="w-20 h-20 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-2xl font-bold transition-all"
        >
          0
        </button>
        <button
          onClick={() => pin.length >= 4 && confirmar(pin)}
          disabled={pin.length < 4 || ocupado}
          className="w-20 h-20 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-sm font-bold transition-all"
        >
          {primeraVez ? 'Crear' : 'Entrar'}
        </button>
      </div>

      <p className="h-6 text-[13px] font-semibold text-red-400">{error}</p>
    </div>
  );
}
