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
    clase: 'bg-red-700 text-white',
  },
  {
    // Cobalto: todo lo que se bebe frío.
    palabras: ['bebida', 'bebidas', 'gaseosa', 'gaseosas', 'jugos', 'jugo', 'refrescos', 'liquidos'],
    clase: 'bg-blue-700 text-white',
  },
  {
    // Ámbar: lo que el negocio quiere que se venda.
    palabras: ['combo', 'combos', 'promo', 'promos', 'promocion', 'promociones', 'menu del dia'],
    clase: 'bg-amber-500 text-amber-950',
  },
  {
    // Púrpura: el final de la comida.
    palabras: ['postre', 'postres', 'dulces', 'helados', 'cafe', 'cafes', 'reposteria'],
    clase: 'bg-purple-700 text-white',
  },
  {
    palabras: ['pollo', 'pollos', 'alitas'],
    clase: 'bg-orange-700 text-white',
  },
  {
    palabras: ['acompanamiento', 'acompanamientos', 'papas', 'entradas', 'picadas'],
    clase: 'bg-yellow-600 text-yellow-950',
  },
];

/* Los tonos de reserva. Son de la misma familia visual que los de arriba
   —oscuros, saturados, con texto blanco legible encima— para que una carta que
   no se reconoce no se vea como un error sino como otra carta. */
const RESERVA = [
  'bg-teal-700 text-white',
  'bg-rose-700 text-white',
  'bg-indigo-700 text-white',
  'bg-emerald-700 text-white',
  'bg-cyan-800 text-white',
  'bg-fuchsia-800 text-white',
  'bg-lime-800 text-white',
  'bg-sky-800 text-white',
];

/**
 * Las clases de fondo y texto de una categoría.
 *
 * Siempre devuelve algo: una categoría vacía —un producto sin clasificar— cae
 * en pizarra, que es el único caso en que el gris es la respuesta correcta.
 */
export function colorDeCategoria(categoria: string): string {
  const limpia = normalizar(categoria);
  if (!limpia) return 'bg-slate-700 text-white';

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
