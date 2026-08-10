/**
 * Los tres paneles que un restaurante abre todo el día: el menú, los chats y
 * el punto de venta.
 *
 * Llegar a cualquiera de ellos era abrir el menú lateral, buscar la sección y
 * entrar — y luego repetirlo para cambiar al otro. Acá están los tres, siempre
 * en el mismo sitio, y se salta de uno a otro con un clic.
 *
 * Se usa en dos sitios y se ve distinto en cada uno:
 *   - `barra`: la fila de la cabecera del panel, compacta.
 *   - `pleno`: la barra de arriba cuando la sección ocupa la pantalla entera,
 *     con el botón de salir.
 */
import React from 'react';
import { FaThLarge, FaWhatsapp, FaCashRegister, FaCompress } from 'react-icons/fa';

/* "Menú" acá es el menú de opciones del administrador —la pantalla de inicio
   del panel, con el resumen del día y los accesos— no la carta de comida.
   El POS no es una pestaña del panel sino su propia pantalla, así que ese va
   por navegación y los otros dos por cambio de sección. */
export const PANELES = [
  { id: 'dashboard', txt: 'Menú', Icono: FaThLarge, color: 'orange' },
  { id: 'whatsapp-inbox', txt: 'WhatsApp', Icono: FaWhatsapp, color: 'emerald' },
  { id: 'pos', txt: 'POS', Icono: FaCashRegister, color: 'blue', ruta: true },
];

const TONO = {
  orange: { activo: 'bg-orange-500 text-white shadow-orange-500/30', icono: 'text-orange-500' },
  emerald: { activo: 'bg-emerald-500 text-white shadow-emerald-500/30', icono: 'text-emerald-500' },
  blue: { activo: 'bg-blue-500 text-white shadow-blue-500/30', icono: 'text-blue-500' },
};

export default function PanelesRapidos({
  variante = 'barra',
  activo,
  onIr,
  onSalir,
  whatsappSinLeer = 0,
  posDisponible = true,
  superAdmin = false,
}) {
  const paneles = PANELES.filter((p) => p.id !== 'pos' || posDisponible);
  const pleno = variante === 'pleno';

  return (
    <div
      className={
        pleno
          /* El hueco de la derecha es para la insignia de SuperAdmin, que va
             fija en esa esquina y por encima de todo. */
          ? `flex items-center gap-2 px-3 sm:px-4 py-2 bg-white border-b border-slate-200 shadow-sm shrink-0 ${superAdmin ? 'pr-40' : ''}`
          : 'flex items-center gap-1.5'
      }
    >
      {pleno && (
        <span className="hidden sm:block text-[11px] font-bold text-slate-300 uppercase tracking-widest pr-1">
          MenuBy
        </span>
      )}

      {paneles.map((p) => {
        const esActivo = !pleno ? false : activo === p.id;
        const tono = TONO[p.color];
        const sinLeer = p.id === 'whatsapp-inbox' ? whatsappSinLeer : 0;

        return (
          <button
            key={p.id}
            onClick={() => onIr(p)}
            title={`Abrir ${p.txt} a pantalla completa`}
            className={`relative flex items-center gap-2 rounded-xl font-bold transition-all active:scale-95 ${
              pleno ? 'px-3.5 sm:px-5 py-2 text-[13px]' : 'px-3 py-1.5 text-xs'
            } ${
              esActivo
                ? `${tono.activo} shadow-sm`
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <p.Icono className={`text-sm ${esActivo ? 'text-white' : tono.icono}`} />
            <span className={pleno ? '' : 'hidden sm:inline'}>{p.txt}</span>
            {sinLeer > 0 && (
              <span
                className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black grid place-items-center ${
                  esActivo ? 'bg-white text-emerald-600' : 'bg-emerald-500 text-white'
                }`}
              >
                {sinLeer > 99 ? '99+' : sinLeer}
              </span>
            )}
          </button>
        );
      })}

      {pleno && (
        <button
          onClick={onSalir}
          title="Volver al panel"
          className="ml-auto flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        >
          <FaCompress className="text-xs" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      )}
    </div>
  );
}
