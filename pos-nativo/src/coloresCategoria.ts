import { normalizar } from './reglasExtras';

/**
 * De qué color es una categoría en el modo expandido.
 *
 * Sin fotos, el color es lo único que queda para encontrar un producto de
 * reojo. En un mostrador eso vale más que leer: el cajero no busca "Coca-Cola",
 * busca "la zona azul" y dentro de ella la casilla que ya sabe dónde está.
 *
 * Las familias se reconocen **por el nombre de la categoría**, que es texto
 * libre que el comerciante escribe en el panel. Es una convención, no un
 * contrato, así que se hace con dos cuidados: se compara sin tildes ni
 * mayúsculas, y lo que no reconoce **no se queda gris** —cae a un color
 * derivado del nombre—.
 *
 * Esa caída importa más que los aciertos. Un negocio de comida china no tiene
 * "hamburguesas" ni "postres": tiene "arroces", "chop suey" y "agridulces". Si
 * lo no reconocido fuera todo del mismo gris, el modo expandido no le serviría
 * de nada justo a los negocios cuya carta no se parece a la de McDonald's.
 */

/** Las familias que sí se reconocen, con su color. */
const FAMILIAS: { palabras: string[]; clase: string }[] = [
  {
    // Carmesí: lo que sale de la plancha.
    palabras: ['carne', 'carnes', 'hamburguesa', 'hamburguesas', 'burger', 'burgers', 'parrilla', 'asados'],
    clase: 'bg-red-100 text-red-950 border-l-[6px] border-red-500',
  },
  {
    // Cobalto: todo lo que se bebe frío.
    palabras: ['bebida', 'bebidas', 'gaseosa', 'gaseosas', 'jugos', 'jugo', 'refrescos', 'liquidos'],
    clase: 'bg-blue-100 text-blue-950 border-l-[6px] border-blue-500',
  },
  {
    // Ámbar: lo que el negocio quiere que se venda.
    palabras: ['combo', 'combos', 'promo', 'promos', 'promocion', 'promociones', 'menu del dia'],
    clase: 'bg-amber-100 text-amber-950 border-l-[6px] border-amber-500',
  },
  {
    // Púrpura: el final de la comida.
    palabras: ['postre', 'postres', 'dulces', 'helados', 'cafe', 'cafes', 'reposteria'],
    clase: 'bg-purple-100 text-purple-950 border-l-[6px] border-purple-500',
  },
  {
    palabras: ['pollo', 'pollos', 'alitas'],
    clase: 'bg-orange-100 text-orange-950 border-l-[6px] border-orange-500',
  },
  {
    palabras: ['acompanamiento', 'acompanamientos', 'papas', 'entradas', 'picadas'],
    clase: 'bg-lime-100 text-lime-950 border-l-[6px] border-lime-600',
  },
];

/* Los tonos de reserva, de la misma familia que los de arriba.

   Todos son **pastel con texto casi negro y una franja del tono fuerte** a la
   izquierda, que es como pintan sus botones Toast y los POS de restaurante
   grandes. Antes eran bloques saturados con texto blanco: se distinguían bien,
   pero una pantalla entera de rojo o azul intenso cansa la vista en un turno
   de ocho horas, y el texto blanco sobre amarillo no se leía. La franja
   conserva lo que servía —reconocer la zona de reojo— y el fondo claro deja
   leer el nombre y el precio con contraste de sobra. */
const RESERVA = [
  'bg-teal-100 text-teal-950 border-l-[6px] border-teal-500',
  'bg-rose-100 text-rose-950 border-l-[6px] border-rose-500',
  'bg-indigo-100 text-indigo-950 border-l-[6px] border-indigo-500',
  'bg-emerald-100 text-emerald-950 border-l-[6px] border-emerald-500',
  'bg-cyan-100 text-cyan-950 border-l-[6px] border-cyan-500',
  'bg-fuchsia-100 text-fuchsia-950 border-l-[6px] border-fuchsia-500',
  'bg-yellow-100 text-yellow-950 border-l-[6px] border-yellow-500',
  'bg-sky-100 text-sky-950 border-l-[6px] border-sky-500',
];

/**
 * Las clases de fondo y texto de una categoría.
 *
 * Siempre devuelve algo: una categoría vacía —un producto sin clasificar— cae
 * en pizarra, que es el único caso en que el gris es la respuesta correcta.
 */
export function colorDeCategoria(categoria: string): string {
  const limpia = normalizar(categoria);
  if (!limpia) return 'bg-slate-100 text-slate-900 border-l-[6px] border-slate-400';

  for (const f of FAMILIAS) {
    /* `includes` sobre la categoría entera y no igualdad: un negocio escribe
       "Hamburguesas Artesanales", no "Hamburguesas". Se compara palabra a
       palabra contenida para no exigirle al dueño que acierte el nombre. */
    if (f.palabras.some((p) => limpia.includes(p))) return f.clase;
  }

  /* Derivado del nombre, y estable: la misma categoría tiene siempre el mismo
     color, que es lo único que hace que el color sirva para encontrar algo.
     Un color al azar por render no valdría de nada. */
  let suma = 0;
  for (let i = 0; i < limpia.length; i++) {
    suma = (suma * 31 + limpia.charCodeAt(i)) % RESERVA.length;
  }
  return RESERVA[suma];
}
