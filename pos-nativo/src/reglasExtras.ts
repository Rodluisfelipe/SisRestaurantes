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

/* ── Lo que entra sin preguntar ─────────────────────────────────────────
 *
 * El 80 % de los clientes pide el combo tal como está en la carta. Abrir una
 * pantalla para confirmar papas y gaseosa en el 100 % de los pedidos es lo
 * que mantiene vivo el cuello de botella: son dos toques y una interrupción
 * de la vista por cada combo, multiplicados por la fila del mediodía.
 *
 * Así que cada grupo obligatorio entra resuelto y el cajero solo abre el
 * modal cuando el cliente pide algo distinto.
 *
 * **Cuál es la opción por defecto** es la parte delicada. El catálogo no
 * tiene forma de marcar una favorita —`toppingOptionSchema` solo lleva
 * nombre, precio, activa e imagen— así que lo único disponible es el orden
 * en que el dueño las escribió en el panel.
 *
 * Sobre ese orden se aplica una regla que no es preferencia sino aritmética:
 * **gana la primera que no cobre de más**. Un combo anunciado en la carta a
 * 25.000 tiene que entrar a 25.000; si la primera opción de la lista fuera
 * "aros de cebolla +2.000", el defecto cobraría 27.000 en cada combo del día
 * sin que nadie lo note. Si todas cuestan, gana la más barata, que es la
 * lectura más cercana a "el combo normal".
 */

/** La opción que entra sola en un grupo: la primera sin recargo. */
function porDefecto(opciones: { nombre: string; precio: number }[]) {
  if (!opciones.length) return null;
  return (
    opciones.find((o) => o.precio <= 0) ??
    opciones.reduce((mejor, o) => (o.precio < mejor.precio ? o : mejor))
  );
}

/**
 * Deja resueltos todos los grupos obligatorios de un producto.
 *
 * Solo los obligatorios: un grupo opcional es algo que el cliente **pidió**
 * —tocineta extra, doble queso— y meterlo por defecto sería venderle algo
 * que no pidió y cobrárselo.
 *
 * Tampoco toca los grupos de varias opciones aunque sean obligatorios: ahí el
 * negocio dijo "elige las que quieras" y no hay una respuesta estándar que
 * adivinar.
 *
 * `partida` se respeta: si el cajero tenía un tamaño puesto en la columna,
 * ese grupo ya viene decidido y no se pisa.
 */
export function predeterminadas(grupos: GrupoExtra[], partida: Elegidas = {}): Elegidas {
  let salida: Elegidas = { ...partida };

  for (const g of grupos) {
    if (g.obligatorio && !g.multiple && cuantasEn(salida, g.id, '') === 0) {
      const opcion = porDefecto(g.opciones || []);
      if (opcion) salida = { ...salida, [clave(g.id, '', opcion.nombre)]: 1 };
    }

    for (const sg of g.subgrupos || []) {
      if (sg.obligatorio && !sg.multiple && cuantasEn(salida, g.id, sg.titulo) === 0) {
        const opcion = porDefecto(sg.opciones || []);
        if (opcion) salida = { ...salida, [clave(g.id, sg.titulo, opcion.nombre)]: 1 };
      }
    }
  }

  return salida;
}

/**
 * El camino de vuelta: de lo que lleva una línea a lo que marca el modal.
 *
 * Lo necesita el botón de modificar, que abre la personalización sobre una
 * línea **ya en el carrito**: hay que volver a marcar lo que esa línea tiene
 * para que el cajero vea de qué está partiendo y solo cambie lo que el
 * cliente pidió cambiar.
 *
 * El emparejamiento es por nombre porque es lo único que guarda la línea: un
 * `ExtraElegido` lleva el nombre del grupo, no su id. Una opción que ya no
 * exista en el catálogo —el negocio la quitó— simplemente no se vuelve a
 * marcar, y el grupo obligatorio aparecerá pendiente, que es la señal
 * correcta.
 */
export function reconstruirElegidas(grupos: GrupoExtra[], extras: ExtraElegido[]): Elegidas {
  const salida: Elegidas = {};

  for (const e of extras) {
    for (const g of grupos) {
      if (normalizar(g.nombre) === normalizar(e.grupo)
        && (g.opciones || []).some((o) => o.nombre === e.nombre)) {
        salida[clave(g.id, '', e.nombre)] = e.cantidad;
      }

      for (const sg of g.subgrupos || []) {
        if (normalizar(sg.titulo || g.nombre) === normalizar(e.grupo)
          && (sg.opciones || []).some((o) => o.nombre === e.nombre)) {
          salida[clave(g.id, sg.titulo, e.nombre)] = e.cantidad;
        }
      }
    }
  }

  return salida;
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

/**
 * El grupo que representa el tamaño de este producto, si lo hay.
 *
 * Dos caminos, y el orden importa:
 *
 * 1. **La bandera del panel** (`es_combo`). Es lo que el dueño dijo, así que
 *    manda sobre cualquier deducción. Si marcó un grupo llamado
 *    "Presentaciones", ese es, aunque el nombre no esté en ninguna lista.
 * 2. **El nombre**, como red. Ningún negocio ha marcado nada todavía —el
 *    campo acaba de existir— y quitar la heurística les dejaría la botonera
 *    vacía hasta que alguien entre al panel a tocar una casilla que no sabe
 *    que existe. Se puede retirar cuando la adopción lo justifique.
 *
 * La condición de excluyente se aplica a los dos caminos: un tamaño no puede
 * ser mediano y grande a la vez, y un grupo múltiple marcado como combo por
 * error llenaría la botonera de cosas que no son tamaños.
 */
export function grupoDeTamano(grupos: GrupoExtra[]): GrupoExtra | null {
  const sirve = (g: GrupoExtra) => !g.multiple && (g.opciones || []).length > 0;

  const marcado = grupos.find((g) => g.es_combo === true && sirve(g));
  if (marcado) return marcado;

  return grupos.find((g) => sirve(g) && NOMBRES_DE_TAMANO.includes(normalizar(g.nombre))) ?? null;
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
