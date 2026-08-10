/**
 * Instalar la extensión de Chrome.
 *
 * No hay botón de "instalar" y no es un descuido: Google quitó en 2018 la
 * instalación desde páginas web, y los enlaces a `chrome://` están bloqueados,
 * así que ni siquiera se puede abrir la pantalla de extensiones por el usuario.
 * Lo único posible es descargar y guiar — por eso la dirección se copia al
 * portapapeles en vez de ser un enlace que no haría nada.
 */
import React, { useState } from 'react';
import {
  FaChrome, FaDownload, FaCheck, FaCopy, FaKeyboard, FaBell, FaWindowRestore,
} from 'react-icons/fa';
import { useBusinessConfig } from '../../Context/BusinessContext';

const ZIP = '/menuby-extension.zip';

function Paso({ n, titulo, children }) {
  return (
    <li className="flex gap-3.5">
      <span className="w-7 h-7 shrink-0 rounded-full bg-slate-800 text-white text-xs font-bold grid place-items-center">
        {n}
      </span>
      <div className="min-w-0 pb-5 border-l border-dashed border-slate-200 -ml-[1.9rem] pl-[1.9rem]">
        <p className="text-sm font-bold text-slate-700">{titulo}</p>
        <div className="text-[13px] text-slate-500 mt-1 leading-relaxed">{children}</div>
      </div>
    </li>
  );
}

export default function ExtensionChrome() {
  const { businessConfig } = useBusinessConfig();
  const [copiado, setCopiado] = useState(false);
  const [descargado, setDescargado] = useState(false);
  const slug = businessConfig?.slug;

  const copiarDireccion = () => {
    navigator.clipboard?.writeText('chrome://extensions');
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="max-w-2xl space-y-5">
      {/* Qué es */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
        <div className="flex items-start gap-4">
          <span className="w-12 h-12 shrink-0 rounded-2xl bg-slate-100 grid place-items-center text-2xl text-slate-500">
            <FaChrome />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-800">Extensión de Chrome</h2>
            <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
              Te avisa de cada pedido nuevo aunque tengas MenuBy cerrado, y te
              deja saltar entre el panel, los chats y el punto de venta.
            </p>
          </div>
        </div>

        <ul className="mt-5 space-y-3">
          {[
            {
              Icono: FaBell,
              t: 'Avisa de un pedido nuevo con MenuBy cerrado',
              d: 'El aviso se queda en pantalla hasta que alguien lo mire, y al tocarlo abre los pedidos. También lleva el contador de pendientes en el ícono de Chrome.',
            },
            {
              Icono: FaWindowRestore,
              t: 'No recarga lo que ya tienes abierto',
              d: 'Trae la pestaña al frente sin tocarla: el punto de venta conserva el pedido a medio armar y los chats el mensaje a medio escribir.',
            },
            {
              Icono: FaKeyboard,
              t: 'Atajos Alt+1, Alt+2 y Alt+3',
              d: 'Funcionan en cualquier pestaña de Chrome, esté MenuBy al frente o no. Y no hay nada que configurar: reconoce tu negocio de la sesión que ya tienes abierta.',
            },
          ].map(({ Icono, t, d }) => (
            <li key={t} className="flex gap-3">
              <Icono className="text-slate-300 mt-0.5 shrink-0" />
              <div>
                <p className="text-[13px] font-bold text-slate-700">{t}</p>
                <p className="text-[12.5px] text-slate-500 leading-relaxed">{d}</p>
              </div>
            </li>
          ))}
        </ul>

        <a
          href={ZIP}
          download
          onClick={() => setDescargado(true)}
          className="mt-6 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition-colors active:scale-[0.99]"
        >
          <FaDownload className="text-xs" /> Descargar la extensión
        </a>
        <p className="text-[11.5px] text-slate-400 mt-2 text-center">
          Sirve en Chrome, Edge, Brave y Opera. En Safari no.
        </p>
      </div>

      {/* Cómo instalarla */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
        <h3 className="text-sm font-bold text-slate-800 mb-1">Cómo instalarla</h3>
        <p className="text-[12.5px] text-slate-400 mb-5">
          Toma un minuto y se hace una sola vez en cada computador.
        </p>

        <ol className="space-y-0">
          <Paso n="1" titulo="Descomprime el archivo que descargaste">
            Clic derecho sobre <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[12px]">menuby-extension.zip</code>{' '}
            → <strong>Extraer todo</strong>. Queda una carpeta llamada{' '}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[12px]">menuby-extension</code>.
            Recuerda dónde la dejaste: si la borras, la extensión deja de funcionar.
          </Paso>

          <Paso n="2" titulo="Abre la pantalla de extensiones de Chrome">
            <div className="flex items-center gap-2 mt-1.5">
              <code className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[12.5px] text-slate-600">
                chrome://extensions
              </code>
              <button
                onClick={copiarDireccion}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[11.5px] font-bold transition-colors"
              >
                {copiado ? <><FaCheck className="text-[10px]" /> Copiado</> : <><FaCopy className="text-[10px]" /> Copiar</>}
              </button>
            </div>
            <p className="mt-1.5">
              Pégala en la barra de direcciones y presiona Enter.{' '}
              <span className="text-slate-400">
                No la puedo abrir por ti: Chrome no deja que una página web abra sus pantallas internas.
              </span>
            </p>
          </Paso>

          <Paso n="3" titulo="Enciende el Modo de desarrollador">
            Es un interruptor en la esquina superior derecha de esa pantalla.
          </Paso>

          <Paso n="4" titulo="Clic en “Cargar descomprimida”">
            Aparece arriba a la izquierda al encender el modo anterior. Elige la
            carpeta <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[12px]">menuby-extension</code>{' '}
            del paso 1.
          </Paso>

          <Paso n="5" titulo="Ánclala a la barra">
            Clic en el ícono de piezas de rompecabezas, al lado de la barra de
            direcciones, y luego en el pin junto a MenuBy. Así queda siempre a la vista.
          </Paso>
        </ol>

        {descargado && (
          <p className="text-[12.5px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5">
            Ya se descargó. Sigue los cinco pasos de arriba
            {slug && <> y al terminar te va a reconocer como <strong>{slug}</strong>.</>}
          </p>
        )}
      </div>

      {/* Lo que hay que saber antes de repartirla */}
      <div className="bg-amber-50/70 rounded-2xl border border-amber-200/70 p-5">
        <p className="text-[13px] font-bold text-amber-800">Lo que conviene saber</p>
        <ul className="mt-2 space-y-1.5 text-[12.5px] text-amber-700 leading-relaxed">
          <li>
            <strong>Para avisarte necesita que abras MenuBy de vez en cuando.</strong>{' '}
            Usa tu sesión, que dura 24 horas. Si pasas más de un día sin entrar, deja
            de avisar hasta que vuelvas — y te lo dice, no te muestra un cero falso.
          </li>
          <li>
            <strong>Chrome tiene que estar abierto</strong>, aunque sea sin ninguna
            pestaña de MenuBy. Si cierras el navegador por completo, nadie vigila.
          </li>
          <li>
            <strong>El aviso no suena</strong>, es visual. El sonido llega en una
            versión siguiente.
          </li>
          <li>
            <strong>No se actualiza sola.</strong> Cuando saquemos una versión nueva
            hay que descargarla y repetir los pasos. Eso se arregla el día que se
            publique en la tienda de Chrome.
          </li>
          <li>
            <strong>No borres la carpeta.</strong> Chrome lee los archivos de ahí cada
            vez que abre; si la mueves o la eliminas, la extensión desaparece.
          </li>
        </ul>
      </div>

      <p className="text-[11.5px] text-slate-400 leading-relaxed">
        La extensión usa tu propia sesión de MenuBy para consultar tus pedidos y
        mensajes, contra la misma API que usa este panel. No toca ninguna otra
        página, no envía nada a servidores de terceros y no rastrea nada.
      </p>
    </div>
  );
}
