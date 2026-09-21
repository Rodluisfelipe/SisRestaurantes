import { describe, expect, it } from 'vitest';
import {
  clave, cuantasEn, derivar, grupoDeTamano, marcar, normalizar,
  predeterminadas, preseleccionarTamano, quitar, reconstruirElegidas,
} from './reglasExtras';
import type { GrupoExtra } from './nativo';

/**
 * Las reglas de los extras.
 *
 * Son las que deciden si una comanda llega completa a la cocina y cuánto paga
 * el cliente por su combo. Dos pantallas las usan —el modal de una unidad y el
 * de lote— y por eso viven en un módulo: aquí se prueban una vez y las dos
 * quedan cubiertas.
 */

const grupo = (
  id: string,
  nombre: string,
  opciones: { nombre: string; precio: number }[],
  obligatorio = true,
  multiple = false,
): GrupoExtra => ({
  id,
  nombre,
  multiple,
  obligatorio,
  precio_base: 0,
  opciones,
  subgrupos: [],
});

/* El combo como lo configura un restaurante colombiano de verdad: el plato con
   dos grupos obligatorios colgados, sin módulo de combos de por medio. */
const COMBO: GrupoExtra[] = [
  grupo('g-papas', 'Papas', [
    { nombre: 'Francesa', precio: 0 },
    { nombre: 'Cascos', precio: 0 },
    { nombre: 'Aros de cebolla', precio: 2000 },
  ]),
  grupo('g-bebida', 'Bebida', [
    { nombre: 'Coca-Cola', precio: 0 },
    { nombre: 'Sprite', precio: 0 },
    { nombre: 'Agua', precio: 0 },
  ]),
];

describe('qué falta por elegir', () => {
  it('un combo recién abierto tiene los dos grupos pendientes', () => {
    /* Es lo que impide que llegue a la cocina un combo sin bebida: alguien
       tendría que ir a preguntarle a la mesa qué pidió. */
    expect(derivar(COMBO, {}).faltan).toEqual(['Papas', 'Bebida']);
  });

  it('con papas elegidas, solo falta la bebida', () => {
    const elegidas = marcar({}, 'g-papas', '', 'Francesa', false, null, false);

    expect(derivar(COMBO, elegidas).faltan).toEqual(['Bebida']);
  });

  it('completo cuando los dos están', () => {
    let e = marcar({}, 'g-papas', '', 'Cascos', false, null, false);
    e = marcar(e, 'g-bebida', '', 'Coca-Cola', false, null, false);

    const salida = derivar(COMBO, e);

    expect(salida.faltan).toEqual([]);
    expect(salida.extras).toHaveLength(2);
    expect(salida.extras.map((x) => x.nombre)).toEqual(['Cascos', 'Coca-Cola']);
  });

  it('un grupo opcional nunca falta', () => {
    const opcional = [grupo('g-salsa', 'Salsas', [{ nombre: 'BBQ', precio: 0 }], false)];

    expect(derivar(opcional, {}).faltan).toEqual([]);
  });
});

describe('cuánto suman los extras', () => {
  it('lo que cuesta cada opción elegida', () => {
    let e = marcar({}, 'g-papas', '', 'Aros de cebolla', false, null, false);
    e = marcar(e, 'g-bebida', '', 'Sprite', false, null, false);

    expect(derivar(COMBO, e).sobreprecio).toBe(2000);
  });

  it('sin extras de pago, el combo vale lo que vale', () => {
    let e = marcar({}, 'g-papas', '', 'Francesa', false, null, false);
    e = marcar(e, 'g-bebida', '', 'Agua', false, null, false);

    expect(derivar(COMBO, e).sobreprecio).toBe(0);
  });
});

describe('marcar y desmarcar', () => {
  it('en un grupo de una sola opción, elegir otra reemplaza', () => {
    /* Quien pulsa "Cascos" después de "Francesa" está cambiando de opinión, no
       pidiendo las dos. Obligarlo a desmarcar primero sería un toque de más en
       cada venta. */
    let e = marcar({}, 'g-papas', '', 'Francesa', false, null, false);
    e = marcar(e, 'g-papas', '', 'Cascos', false, null, false);

    expect(cuantasEn(e, 'g-papas', '')).toBe(1);
    expect(e[clave('g-papas', '', 'Cascos')]).toBe(1);
    expect(e[clave('g-papas', '', 'Francesa')]).toBeUndefined();
  });

  it('volver a tocar la misma la desmarca', () => {
    let e = marcar({}, 'g-papas', '', 'Francesa', false, null, false);
    e = marcar(e, 'g-papas', '', 'Francesa', false, null, false);

    expect(cuantasEn(e, 'g-papas', '')).toBe(0);
  });

  it('en un grupo múltiple se acumulan', () => {
    let e = marcar({}, 'g-salsa', '', 'BBQ', true, null, false);
    e = marcar(e, 'g-salsa', '', 'Miel', true, null, false);

    expect(cuantasEn(e, 'g-salsa', '')).toBe(2);
  });

  it('el tope de un grupo múltiple se respeta', () => {
    /* El negocio dijo "hasta dos salsas". La caja obedece: si dejara pasar la
       tercera, el cliente recibiría algo que el negocio no vende así. */
    let e = marcar({}, 'g-salsa', '', 'BBQ', true, 2, false);
    e = marcar(e, 'g-salsa', '', 'Miel', true, 2, false);
    e = marcar(e, 'g-salsa', '', 'Tártara', true, 2, false);

    expect(cuantasEn(e, 'g-salsa', '')).toBe(2);
  });

  it('una repetible suma de a una', () => {
    let e = marcar({}, 'g-ad', '', 'Queso', true, null, true);
    e = marcar(e, 'g-ad', '', 'Queso', true, null, true);

    expect(e[clave('g-ad', '', 'Queso')]).toBe(2);
  });

  it('quitar baja una unidad y al final la borra', () => {
    let e = marcar({}, 'g-ad', '', 'Queso', true, null, true);
    e = marcar(e, 'g-ad', '', 'Queso', true, null, true);

    e = quitar(e, 'g-ad', '', 'Queso');
    expect(e[clave('g-ad', '', 'Queso')]).toBe(1);

    e = quitar(e, 'g-ad', '', 'Queso');
    expect(e[clave('g-ad', '', 'Queso')]).toBeUndefined();
  });

  it('no muta lo que recibe', () => {
    const antes = marcar({}, 'g-papas', '', 'Francesa', false, null, false);
    const despues = marcar(antes, 'g-bebida', '', 'Sprite', false, null, false);

    expect(Object.keys(antes)).toHaveLength(1);
    expect(Object.keys(despues)).toHaveLength(2);
  });
});

describe('lo que entra sin preguntar', () => {
  it('un combo entra con papas y bebida resueltas', () => {
    /* Es el cambio que quita el cuello de botella: el 80 % pide el combo
       tal como está en la carta, y abrir una pantalla para confirmarlo en el
       100 % de los pedidos es lo que mantiene la fila. */
    const salida = derivar(COMBO, predeterminadas(COMBO));

    expect(salida.faltan).toEqual([]);
    expect(salida.extras.map((e) => e.nombre)).toEqual(['Francesa', 'Coca-Cola']);
  });

  it('el defecto no cobra de más', () => {
    /* La regla que no es preferencia sino aritmética: un combo anunciado a
       25.000 tiene que entrar a 25.000. Si la primera opción de la lista
       cobrara, el defecto subiría el precio de cada combo del día sin que
       nadie lo note. */
    const caro = [
      grupo('g-p', 'Papas', [
        { nombre: 'Aros de cebolla', precio: 2000 },
        { nombre: 'Francesa', precio: 0 },
      ]),
    ];

    const salida = derivar(caro, predeterminadas(caro));

    expect(salida.extras[0].nombre).toBe('Francesa');
    expect(salida.sobreprecio).toBe(0);
  });

  it('si todas cuestan, gana la más barata', () => {
    const todasCobran = [
      grupo('g-p', 'Papas', [
        { nombre: 'Rústicas', precio: 3000 },
        { nombre: 'Francesa', precio: 1000 },
      ]),
    ];

    expect(derivar(todasCobran, predeterminadas(todasCobran)).sobreprecio).toBe(1000);
  });

  it('no mete nada de un grupo opcional', () => {
    /* Un grupo opcional es algo que el cliente **pidió** —tocineta extra—.
       Meterlo por defecto sería venderle algo que no pidió y cobrárselo. */
    const conOpcional = [
      ...COMBO,
      grupo('g-ad', 'Adiciones', [{ nombre: 'Tocineta', precio: 4000 }], false),
    ];

    const salida = derivar(conOpcional, predeterminadas(conOpcional));

    expect(salida.extras.map((e) => e.nombre)).not.toContain('Tocineta');
    expect(salida.sobreprecio).toBe(0);
  });

  it('no adivina en un grupo obligatorio de varias opciones', () => {
    /* Ahí el negocio dijo "elige las que quieras" y no hay respuesta
       estándar. Ese sí abre el modal. */
    const varias = [grupo('g-s', 'Salsas', [{ nombre: 'BBQ', precio: 0 }], true, true)];

    expect(predeterminadas(varias)).toEqual({});
  });

  it('respeta el tamaño que el cajero ya tenía puesto', () => {
    const conTamano = [
      grupo('g-t', 'Tamaño', [{ nombre: 'Mediano', precio: 0 }, { nombre: 'Grande', precio: 3000 }]),
      ...COMBO,
    ];
    const partida = preseleccionarTamano(conTamano, 'Grande')!;

    const salida = derivar(conTamano, predeterminadas(conTamano, partida));

    // Grande, aunque Mediano sea el que no cobra: lo eligió el cajero.
    expect(salida.extras.map((e) => e.nombre)).toContain('Grande');
    expect(salida.sobreprecio).toBe(3000);
  });
});

describe('volver a marcar lo que una línea lleva', () => {
  it('deja el modal como estaba para cambiar solo una cosa', () => {
    /* Lo usa el botón de modificar: el cliente dice "cámbieme las papas" y
       el cajero tiene que ver la bebida ya puesta, no empezar de cero. */
    const elegidas = predeterminadas(COMBO);
    const { extras } = derivar(COMBO, elegidas);

    expect(reconstruirElegidas(COMBO, extras)).toEqual(elegidas);
  });

  it('una opción que el negocio quitó del catálogo no se vuelve a marcar', () => {
    /* Y entonces el grupo aparece pendiente, que es la señal correcta: hay
       que preguntarle al cliente otra vez. */
    const extras = [{ grupo: 'Papas', nombre: 'Descatalogada', precio: 0, cantidad: 1 }];

    const vueltas = reconstruirElegidas(COMBO, extras);

    expect(vueltas).toEqual({});
    expect(derivar(COMBO, vueltas).faltan).toContain('Papas');
  });
});

describe('reconocer el grupo que hace de tamaño', () => {
  const tamano = (nombre: string, multiple = false) =>
    grupo('g-t', nombre, [{ nombre: 'Mediano', precio: 0 }, { nombre: 'Grande', precio: 3000 }], true, multiple);

  it('acepta los nombres que usa un dueño de verdad', () => {
    for (const n of ['Tamaño', 'TAMANO', 'combo', 'Presentación', 'Porcion', 'Talla']) {
      expect(grupoDeTamano([tamano(n)])?.id).toBe('g-t');
    }
  });

  it('la bandera del panel manda sobre el nombre', () => {
    /* Es el punto del campo nuevo: el dueño llamó a su grupo
       "Presentaciones" —que no está en ninguna lista— y lo marcó. Eso es lo
       que dijo, y vale más que cualquier deducción nuestra. */
    const marcado: GrupoExtra = {
      ...grupo('g-pres', 'Presentaciones', [
        { nombre: 'Personal', precio: 0 },
        { nombre: 'Familiar', precio: 5000 },
      ]),
      es_combo: true,
    };

    expect(grupoDeTamano([marcado])?.id).toBe('g-pres');
  });

  it('la bandera gana cuando hay dos candidatos', () => {
    /* Un negocio con un grupo llamado "Combo" que son adiciones, y otro
       marcado de verdad. Sin prioridad, la heurística se llevaría el
       equivocado por estar primero. */
    const senuelo = grupo('g-falso', 'Combo', [{ nombre: 'Tocineta', precio: 3000 }]);
    const real: GrupoExtra = {
      ...grupo('g-real', 'Presentaciones', [{ nombre: 'Personal', precio: 0 }]),
      es_combo: true,
    };

    expect(grupoDeTamano([senuelo, real])?.id).toBe('g-real');
  });

  it('sin bandera sigue funcionando el nombre', () => {
    /* La red para los negocios que todavía no han marcado nada: el campo
       acaba de existir y nadie ha entrado al panel a tocarlo. */
    expect(grupoDeTamano([tamano('Tamaño')])?.id).toBe('g-t');
  });

  it('un grupo múltiple marcado como combo tampoco cuenta', () => {
    /* La bandera dice "esto es el tamaño", no "sáltate las reglas". Un
       tamaño sigue siendo excluyente. */
    const mal: GrupoExtra = { ...tamano('Presentaciones', true), es_combo: true };

    expect(grupoDeTamano([mal])).toBeNull();
  });

  it('ignora un grupo que no es de tamaño', () => {
    /* La convención es por nombre y tiene que fallar hacia "no es": confundir
       las salsas con el tamaño pondría el conmutador de la columna lleno de
       salsas. */
    expect(grupoDeTamano(COMBO)).toBeNull();
    expect(grupoDeTamano([tamano('Adiciones')])).toBeNull();
  });

  it('un grupo de varias opciones no es un tamaño', () => {
    /* Un tamaño es excluyente: no se pide una hamburguesa mediana y grande a
       la vez. Si el grupo admite varias, el dueño quiso decir otra cosa. */
    expect(grupoDeTamano([tamano('Tamaño', true)])).toBeNull();
  });

  it('un grupo sin opciones no cuenta', () => {
    expect(grupoDeTamano([grupo('g-t', 'Tamaño', [])])).toBeNull();
  });
});

describe('preseleccionar el tamaño de la columna', () => {
  const CON_TAMANO: GrupoExtra[] = [
    grupo('g-t', 'Tamaño', [{ nombre: 'Mediano', precio: 0 }, { nombre: 'Grande', precio: 3000 }]),
    ...COMBO,
  ];

  it('deja el grupo resuelto sin preguntar', () => {
    const e = preseleccionarTamano(CON_TAMANO, 'Mediano');

    expect(e).not.toBeNull();
    expect(derivar(CON_TAMANO, e!).faltan).toEqual(['Papas', 'Bebida']);
    expect(derivar(CON_TAMANO, e!).extras[0].nombre).toBe('Mediano');
  });

  it('cobra lo que cuesta ese tamaño', () => {
    const e = preseleccionarTamano(CON_TAMANO, 'Grande');

    expect(derivar(CON_TAMANO, e!).sobreprecio).toBe(3000);
  });

  it('empareja sin tildes ni mayúsculas', () => {
    /* "Mediano" en la columna y "MEDIANO" en el grupo salen del mismo dueño
       escribiendo con prisa. */
    expect(preseleccionarTamano(CON_TAMANO, 'MEDIANO')).not.toBeNull();
    expect(preseleccionarTamano(CON_TAMANO, '  mediano ')).not.toBeNull();
  });

  it('un producto que no tiene ese tamaño devuelve null', () => {
    /* Hay hamburguesa mediana pero no hay postre mediano. Tocar el postre con
       [Mediano] puesto tiene que marcarlo normal, no fallar. */
    expect(preseleccionarTamano(CON_TAMANO, 'Familiar')).toBeNull();
    expect(preseleccionarTamano(COMBO, 'Mediano')).toBeNull();
  });

  it('sin tamaño puesto no preselecciona nada', () => {
    expect(preseleccionarTamano(CON_TAMANO, '')).toBeNull();
  });
});

describe('normalizar', () => {
  it('quita tildes, mayúsculas y espacios de sobra', () => {
    expect(normalizar('  Tamaño ')).toBe('tamano');
    expect(normalizar('PRESENTACIÓN')).toBe('presentacion');
    expect(normalizar('Porción')).toBe('porcion');
  });
});
