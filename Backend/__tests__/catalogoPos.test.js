/**
 * Cómo se enteran las cajas de que un grupo de extras cambió.
 *
 * El fallo que esto cierra es silencioso y por eso vale la pena fijarlo: el
 * catálogo baja por marca de agua sobre `Product.updatedAt`, pero los extras
 * viven en otro documento. Editar un grupo no tocaba el producto, su fecha se
 * quedaba por debajo de la marca de la caja, y el cambio no se pedía nunca.
 *
 * La caja seguía vendiendo, con los extras de antes, y nadie se enteraba hasta
 * que un cliente pedía una opción que el negocio quitó hace un mes.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresco-de-prueba';

const fs = require('fs');
const path = require('path');

describe('marcar los productos de un grupo de extras', () => {
  const rutaUtil = path.join(__dirname, '..', 'utils', 'catalogoPos.js');
  const rutaRuta = path.join(__dirname, '..', 'Routes', 'toppingGroups.js');

  it('busca por el grupo y mueve la fecha del producto', () => {
    const src = fs.readFileSync(rutaUtil, 'utf8');

    expect(src).toContain('toppingGroups: grupoId');
    expect(src).toContain('$currentDate');
    expect(src).toContain('updatedAt');
  });

  it('usa el reloj del motor y no el de Node', () => {
    /* Poniendo la fecha desde Node y con varios procesos con relojes
       distintos, un producto podría quedar marcado con una hora anterior a la
       marca de agua que la caja ya tenía, y entonces tampoco se bajaría.

       Se mide sobre el código sin comentarios: el propio módulo explica por
       qué no se usa la forma incorrecta, y esa explicación la contiene. */
    const src = fs
      .readFileSync(rutaUtil, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    expect(src).toContain('$currentDate');
    expect(src).not.toMatch(/\$set[^}]*updatedAt/);
  });

  it('su fallo no rompe la operación del panel', () => {
    /* El dueño ya guardó lo que quería. Lo peor que puede pasar si esto falla
       es que las cajas tarden hasta la siguiente edición en enterarse; un 500
       en el panel por eso sería peor. */
    const src = fs.readFileSync(rutaUtil, 'utf8');

    expect(src).toContain('catch');
    expect(src).toMatch(/return 0;/);
  });

  it('las tres rutas que cambian los extras lo llaman', () => {
    /* Editar el grupo, borrarlo y apagar una opción. Las tres cambian lo que
       la caja replica; si una se olvida, ese cambio concreto no llega y el
       síntoma es indistinguible de "la caja está desactualizada". */
    const src = fs.readFileSync(rutaRuta, 'utf8');

    // Una por cada ruta, más el require.
    expect((src.match(/tocarProductosDe/g) || []).length).toBeGreaterThanOrEqual(4);

    const put = src.slice(src.indexOf('router.put("/:id"'), src.indexOf('router.delete("/:id"'));
    expect(put).toContain('tocarProductosDe');

    const del = src.slice(src.indexOf('router.delete("/:id"'), src.indexOf('router.patch('));
    expect(del).toContain('tocarProductosDe');

    const toggle = src.slice(src.indexOf('router.patch('));
    expect(toggle).toContain('tocarProductosDe');
  });
});

describe('la bandera de tamaño llega hasta la caja', () => {
  it('el modelo la guarda y por defecto está apagada', () => {
    /* Apagada porque un grupo que nadie marcó no puede colarse en la botonera
       de tamaños del mostrador. */
    const ToppingGroup = require('../Models/ToppingGroup');
    const campo = ToppingGroup.schema.path('esCombo');

    expect(campo).toBeDefined();
    expect(campo.options.default).toBe(false);
  });

  it('el catálogo del POS la incluye', () => {
    /* Sin esta línea, la casilla del panel guarda algo que ninguna caja llega
       a ver: es exactamente lo que pasó la primera vez. */
    const src = fs.readFileSync(path.join(__dirname, '..', 'utils', 'pos.js'), 'utf8');

    expect(src).toContain('es_combo: g.esCombo === true');
  });
});

describe('dónde se vende cada producto', () => {
  const { aplanarCatalogo } = require('../utils/pos');

  const producto = (id, nombre, extra = {}) => ({
    _id: id,
    name: nombre,
    price: 5000,
    category: 'c1',
    active: true,
    updatedAt: new Date('2026-09-20T10:00:00Z'),
    ...extra,
  });

  const CATS = { c1: { nombre: 'Domicilios', orden: 3 } };

  it('un producto solo de caja baja activo', () => {
    /* El caso que lo pidió: un costo de envío existe para cobrarlo en el
       mostrador, no para que un cliente lo pida desde el menú. */
    const [fila] = aplanarCatalogo([producto('p1', 'Costo de envío', { enPos: true, enMenu: false })], CATS);

    expect(fila.activo).toBe(true);
    expect(fila.nombre).toBe('Costo de envío');
  });

  it('un producto oculto en la caja baja igual, pero apagado', () => {
    /* **No se omite.** Si se omitiera, uno que ya estaba replicado se quedaría
       en la terminal para siempre y se seguiría vendiendo: es la misma razón
       por la que un producto desactivado tampoco se omite. */
    const [fila] = aplanarCatalogo([producto('p2', 'Solo domicilio', { enPos: false })], CATS);

    expect(fila).toBeDefined();
    expect(fila.activo).toBe(false);
  });

  it('un producto viejo sin los campos sale en los dos sitios', () => {
    /* Los creados antes de que esto existiera no los tienen, y ausente
       significa "sale donde salía". */
    const [fila] = aplanarCatalogo([producto('p3', 'De siempre')], CATS);

    expect(fila.activo).toBe(true);
  });

  it('desactivar el producto sigue mandando sobre el canal', () => {
    const [fila] = aplanarCatalogo([producto('p4', 'Agotado', { active: false, enPos: true })], CATS);

    expect(fila.activo).toBe(false);
  });

  it('la fila lleva el orden de su categoría', () => {
    const [fila] = aplanarCatalogo([producto('p5', 'X')], CATS);

    expect(fila.categoria).toBe('Domicilios');
    expect(fila.categoria_orden).toBe(3);
  });

  it('una categoría sin orden queda al final', () => {
    const [fila] = aplanarCatalogo([producto('p6', 'X')], { c1: { nombre: 'Sin orden' } });

    expect(fila.categoria_orden).toBe(999);
  });

  it('el menú web esconde lo que es solo de caja', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'products.js'), 'utf8');

    /* `$ne: false` y no `true`: los productos creados antes de que el campo
       existiera no lo tienen, y desaparecerían del menú de golpe. */
    expect(src).toContain('filter.enMenu = { $ne: false }');
  });
});
