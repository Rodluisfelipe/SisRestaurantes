import type { ExtraElegido, GrupoExtra } from './nativo';

/**
 * Las reglas de los extras, sin pantalla de por medio.
 *
 * Estaban dentro de `Extras.tsx` y ahí se quedaban bien mientras hubiera una
 * sola pantalla que las usara. Con el modal en lote —el que configura tres
 * combos de una— pasaron a ser dos, y dos copias de "qué falta por elegir" es
 * el camino corto a que una pantalla deje pasar a la cocina un plato que la
 * otra habría frenado.
 *
 * Aquí no se decide **cuáles** son las reglas: eso lo define el negocio en el
 * panel y baja con el catálogo. Aquí solo se obedecen.
 */

/** Una opción elegida, identificada por dónde salió. */
export type Clave = string;

/* El separador es un carácter de control, no un guion ni una barra: los
   nombres de los grupos y las opciones los escribe el comerciante, y el día
   que alguien llame a una salsa "BBQ | Miel" un separador legible partiría la
   clave en el sitio equivocado. */
export const clave = (grupo: string, sub: string, opcion: string): Clave =>
  `${grupo}\u0001${sub}\u0001${opcion}`;

/** Lo elegido, por clave y cuántas veces. Cero o ausente = no elegida. */
export type Elegidas = Record<Clave, number>;

/** Cuántas opciones hay marcadas dentro de un grupo o subgrupo. */
export function cuantasEn(elegidas: Elegidas, grupo: string, sub: string): number {
  return Object.entries(elegidas)
    .filter(([k, n]) => n > 0 && k.startsWith(`${grupo}\u0001${sub}\u0001`))
    .reduce((t, [, n]) => t + n, 0);
}

/**
 * Marca o desmarca una opción, respetando las reglas de su grupo.
 *
 * Devuelve un objeto nuevo: nada se muta, porque quien llama es React.
 */
export function marcar(
  elegidas: Elegidas,
  grupo: string,
  sub: string,
  opcion: string,
  multiple: boolean,
  maximo: number | null,
  repetible: boolean,
): Elegidas {
  const k = clave(grupo, sub, opcion);
  const actual = elegidas[k] || 0;

  /* De una sola opción: elegir otra reemplaza. Es lo que espera quien pulsa
     "término medio" después de haber pulsado "bien asado", y obligarlo a
     desmarcar primero sería un toque de más en cada venta. */
  if (!multiple) {
    const limpias = Object.fromEntries(
      Object.entries(elegidas).filter(([otra]) => !otra.startsWith(`${grupo}\u0001${sub}\u0001`)),
    );
    return actual > 0 ? limpias : { ...limpias, [k]: 1 };
  }

  // Repetible: cada toque suma uno, hasta el tope.
  if (repetible) {
    if (maximo !== null && cuantasEn(elegidas, grupo, sub) >= maximo) return elegidas;
    return { ...elegidas, [k]: actual + 1 };
  }

  // Normal: enciende y apaga.
  if (actual > 0) {
    const { [k]: _fuera, ...resto } = elegidas;
    return resto;
  }
  if (maximo !== null && cuantasEn(elegidas, grupo, sub) >= maximo) return elegidas;
  return { ...elegidas, [k]: 1 };
}

/** Baja una unidad de una opción repetible, o la quita. */
export function quitar(elegidas: Elegidas, grupo: string, sub: string, opcion: string): Elegidas {
  const k = clave(grupo, sub, opcion);
  const actual = elegidas[k] || 0;
  if (actual <= 1) {
    const { [k]: _fuera, ...resto } = elegidas;
    return resto;
  }
  return { ...elegidas, [k]: actual - 1 };
}

export interface Derivado {
  /** Lo elegido, en la forma que viaja con la venta. */
  extras: ExtraElegido[];
  /** Lo que suman los extras **por unidad**. */
  sobreprecio: number;
  /** Los grupos obligatorios que todavía no tienen nada elegido. */
  faltan: string[];
}

/**
 * Traduce lo marcado a lo que se guarda, y dice qué falta.
 *
 * `faltan` es lo que impide que una comanda incompleta llegue a la cocina: un
 * grupo obligatorio sin elegir es un plato que alguien va a tener que ir a
 * preguntar a la mesa.
 */
export function derivar(grupos: GrupoExtra[], elegidas: Elegidas): Derivado {
  const salida: ExtraElegido[] = [];
  let suma = 0;
  const pendientes: string[] = [];

  for (const g of grupos) {
    // Las opciones que cuelgan del grupo, sin subgrupo.
    for (const o of g.opciones || []) {
      const n = elegidas[clave(g.id, '', o.nombre)] || 0;
      if (n > 0) {
        salida.push({ grupo: g.nombre, nombre: o.nombre, precio: o.precio, cantidad: n });
        suma += o.precio * n;
      }
    }
    if (g.obligatorio && cuantasEn(elegidas, g.id, '') === 0 && (g.opciones || []).length) {
      pendientes.push(g.nombre);
    }

    for (const sg of g.subgrupos || []) {
      for (const o of sg.opciones || []) {
        const n = elegidas[clave(g.id, sg.titulo, o.nombre)] || 0;
        if (n > 0) {
          salida.push({
            grupo: sg.titulo || g.nombre,
            nombre: o.nombre,
            precio: o.precio,
            cantidad: n,
          });
          suma += o.precio * n;
        }
      }
      if (sg.obligatorio && cuantasEn(elegidas, g.id, sg.titulo) === 0) {
        pendientes.push(sg.titulo || g.nombre);
      }
    }

    // El grupo puede cobrar por sí mismo, aparte de sus opciones.
    if (g.precio_base > 0 && salida.some((e) => e.grupo === g.nombre)) {
      suma += g.precio_base;
    }
  }

  return { extras: salida, sobreprecio: suma, faltan: pendientes };
}

/** Si este producto obliga a preguntarle algo al cliente. */
export function pideAlgo(grupos: GrupoExtra[]): boolean {
  return derivar(grupos, {}).faltan.length > 0;
}

/* ── El grupo que hace de tamaño ────────────────────────────────────────
 *
 * En Colombia casi ningún restaurante configura un módulo de combos: crea el
 * plato "Combo Hamburguesa" y le cuelga grupos de extras obligatorios. El
 * tamaño, cuando existe, es uno de esos grupos y se llama como al dueño se le
 * ocurrió: "Tamaño", "Porción", "Presentación", "Combo".
 *
 * Reconocerlo por el nombre es una convención, no un contrato, y por eso se
 * hace con cuidado: solo grupos de **una sola opción obligatoria** —un tamaño
 * es excluyente— y se comparan los nombres sin tildes ni mayúsculas, porque
 * "Tamaño" y "TAMANO" salen del mismo dueño escribiendo con prisa.
 *
 * Si no acierta, no se rompe nada: el conmutador no aparece y el producto se
 * configura en su modal como siempre.
 */

const NOMBRES_DE_TAMANO = ['tamano', 'combo', 'presentacion', 'porcion', 'talla'];

/** Sin tildes, sin mayúsculas, sin espacios de sobra. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** El grupo que representa el tamaño de este producto, si lo hay. */
export function grupoDeTamano(grupos: GrupoExtra[]): GrupoExtra | null {
  for (const g of grupos) {
    if (g.multiple) continue;
    if (!(g.opciones || []).length) continue;
    if (NOMBRES_DE_TAMANO.includes(normalizar(g.nombre))) return g;
  }
  return null;
}

/**
 * Deja preseleccionado el tamaño que el cajero tiene puesto en la columna.
 *
 * Devuelve `null` cuando este producto no tiene ese tamaño —hay hamburguesa
 * mediana pero no hay postre mediano— para que quien llama sepa que no hay
 * nada que preseleccionar, en vez de recibir un objeto vacío indistinguible
 * de "no eligió nada".
 */
export function preseleccionarTamano(grupos: GrupoExtra[], tamano: string): Elegidas | null {
  if (!tamano) return null;

  const grupo = grupoDeTamano(grupos);
  if (!grupo) return null;

  const opcion = (grupo.opciones || []).find((o) => normalizar(o.nombre) === normalizar(tamano));
  if (!opcion) return null;

  return { [clave(grupo.id, '', opcion.nombre)]: 1 };
}
