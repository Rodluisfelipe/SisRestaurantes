/**
 * Saltar entre las tres pantallas que un restaurante usa todo el día:
 * el panel, los chats de WhatsApp y el punto de venta.
 *
 * Están en tres sitios distintos de la aplicación —dos son secciones del panel
 * y el POS es su propia pantalla—, así que cambiar de una a otra era: salir del
 * POS, esperar a que cargue el panel, abrir el menú lateral, buscar la sección.
 * Este selector va en la cabecera de las tres y hace el salto en un clic.
 *
 * Se pinta claro en el panel y oscuro en el POS, que tiene la cabecera negra.
 */
import React from 'react';
import { FaThLarge, FaWhatsapp, FaCashRegister } from 'react-icons/fa';

export const PANELES = [
  { id: 'dashboard', txt: 'Panel', Icono: FaThLarge },
  { id: 'whatsapp-inbox', txt: 'WhatsApp', Icono: FaWhatsapp },
  { id: 'pos', txt: 'POS', Icono: FaCashRegister },
];

const PIEL = {
  claro: {
    caja: 'bg-slate-100',
    activo: 'bg-white text-slate-800 shadow-sm',
    inactivo: 'text-slate-500 hover:text-slate-800',
    globo: 'bg-emerald-500 text-white',
  },
  oscuro: {
    caja: 'bg-slate-800',
    activo: 'bg-slate-600 text-white shadow-sm',
    inactivo: 'text-slate-400 hover:text-white',
    globo: 'bg-emerald-500 text-white',
  },
};

export default function PanelesRapidos({
  activo,
  onIr,
  whatsappSinLeer = 0,
  posDisponible = true,
  tono = 'claro',
  superAdmin = false,
}) {
  const paneles = PANELES.filter((p) => p.id !== 'pos' || posDisponible);
  const piel = PIEL[tono] || PIEL.claro;

  return (
    /* Control segmentado, no botones sueltos: se ve de un vistazo en cuál de
       las tres estás parado.
       El margen de la derecha es para la insignia de SuperAdmin, que va fija
       en esa esquina y por encima de todo. */
    <div className={`inline-flex items-center gap-0.5 p-1 rounded-xl ${piel.caja} ${superAdmin ? 'mr-36' : ''}`}>
      {paneles.map((p) => {
        const esActivo = activo === p.id;
        const sinLeer = p.id === 'whatsapp-inbox' ? whatsappSinLeer : 0;

        return (
          <button
            key={p.id}
            onClick={() => { if (!esActivo) onIr(p); }}
            title={p.txt}
            aria-current={esActivo ? 'page' : undefined}
            className={`relative flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              esActivo ? piel.activo : `${piel.inactivo} active:scale-95`
            }`}
          >
            <p.Icono className="text-sm" />
            <span className="hidden sm:inline">{p.txt}</span>
            {sinLeer > 0 && (
              <span className={`min-w-[17px] h-[17px] px-1 rounded-full text-[10px] font-black grid place-items-center ${piel.globo}`}>
                {sinLeer > 99 ? '99+' : sinLeer}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
