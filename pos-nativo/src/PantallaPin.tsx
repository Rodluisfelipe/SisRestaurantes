import { useEffect, useState } from 'react';
import { Delete, Lock } from 'lucide-react';
import { carpetaFotos, crearUsuario, entrar, hayUsuarios, identidad, type Usuario } from './nativo';
import { error as bipError } from './sonido';
import { rutaDeFoto } from './FotoProducto';
import logoMenuBy from './assets/menuby.png';

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
export default function PantallaPin({
  negocio,
  onEntrar,
}: {
  /** Cómo se llama el negocio. Vacío en una caja que nunca ha sincronizado. */
  negocio: string;
  onEntrar: (u: Usuario) => void;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  /* Instalación: mientras no exista ningún usuario, la primera pantalla no es
     un PIN sino la creación del dueño. Sin esto, una caja recién instalada
     quedaría cerrada con llave y sin llave. */
  const [primeraVez, setPrimeraVez] = useState<boolean | null>(null);
  const [nombre, setNombre] = useState('');

  /* El logo del negocio, desde el disco de la caja: la pantalla de entrada
     tiene que verse igual sin internet. Si todavía no bajó —caja recién
     instalada— o no se puede leer, queda el candado. */
  const [logo, setLogo] = useState('');
  const [logoFallo, setLogoFallo] = useState(false);
  useEffect(() => {
    Promise.all([identidad(), carpetaFotos()])
      .then(([quien, carpeta]) => {
        if (quien.logo && carpeta) setLogo(rutaDeFoto(carpeta, quien.logo));
      })
      .catch(() => {});
  }, []);

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
      /* El PIN equivocado suena: el cajero está mirando el teclado, no la
         pantalla, y el mensaje rojo se lo pierde. */
      bipError();
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
    <div className="relative h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-6">
      {/* Esta es la primera pantalla de la mañana. Lleva el nombre del negocio
          y no el del programa: el cajero trabaja para el negocio, y una caja
          que dice "MenuBy POS" a las seis de la mañana es una herramienta
          ajena. El candado hace de marca cuando todavía no hay ninguna. */}
      <div className="flex flex-col items-center gap-3">
        {logo && !logoFallo ? (
          /* Fondo blanco detrás: los logos vienen en cualquier color, y uno
             oscuro sobre este fondo oscuro desaparecería. */
          <span className="flex items-center justify-center w-24 h-24 rounded-3xl bg-white p-2 shadow-lg shadow-black/30">
            <img
              src={logo}
              alt=""
              draggable={false}
              onError={() => setLogoFallo(true)}
              className="max-w-full max-h-full object-contain rounded-2xl"
            />
          </span>
        ) : (
          <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-marca text-sobre-marca">
            <Lock size={26} strokeWidth={2.25} />
          </span>
        )}
        <div className="text-center">
          <p className="text-2xl font-black tracking-tight">{negocio || 'MenuBy POS'}</p>
          <p className="text-sm text-slate-400 mt-1">
            {primeraVez ? 'Crea el usuario del dueño' : 'Ingresa tu PIN'}
          </p>
        </div>
      </div>

      {primeraVez && (
        <input
          autoFocus
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Tu nombre"
          className="w-64 h-14 px-4 rounded-xl bg-slate-800 border-2 border-slate-700 text-center outline-none focus:border-white"
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
            className="w-20 h-20 rounded-2xl bg-slate-700 hover:bg-slate-600 active:scale-95 text-2xl font-bold transition-transform duration-75 border border-slate-600"
          >
            {d}
          </button>
        ))}
        <button
          onClick={() => setPin((p) => p.slice(0, -1))}
          aria-label="Borrar"
          className="flex items-center justify-center w-20 h-20 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 active:scale-95 transition-transform duration-75 border border-slate-700"
        >
          <Delete size={24} strokeWidth={2} />
        </button>
        <button
          onClick={() => marcar('0')}
          className="w-20 h-20 rounded-2xl bg-slate-700 hover:bg-slate-600 active:scale-95 text-2xl font-bold transition-transform duration-75 border border-slate-600"
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

      {/* La firma, chica y abajo: la pantalla es del negocio, no nuestra. */}
      <div className="absolute bottom-5 flex items-center gap-2 text-[12px] text-slate-500 select-none">
        <img src={logoMenuBy} alt="" draggable={false} className="w-5 h-5 rounded-md" />
        <span>
          Hecho con <span className="text-red-400" aria-label="amor">♥</span> por{' '}
          <span className="font-bold text-slate-300">MenuBy</span>
        </span>
      </div>
    </div>
  );
}
