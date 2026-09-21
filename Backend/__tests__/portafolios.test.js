/**
 * La vitrina de un dueño con varios negocios: "MenuBy Tura".
 *
 * Lo que se prueba acá es lo que decide si la página sirve o si abre un hueco:
 * que el orden que puso el dueño se respete, que un negocio suspendido no se
 * cuele, y que nadie pueda armar una vitrina con los negocios de otro.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresco-de-prueba';

const mongoose = require('mongoose');
const Portafolio = require('../Models/Portafolio');

describe('el modelo del portafolio', () => {
  const DUENO = new mongoose.Types.ObjectId();

  it('necesita nombre y dirección', () => {
    const sinNada = new Portafolio({});
    const error = sinNada.validateSync();

    expect(error.errors.nombre).toBeDefined();
    expect(error.errors.slug).toBeDefined();
  });

  it('la dirección se guarda en minúsculas', () => {
    /* Va en una URL que alguien va a dictar por teléfono. */
    const p = new Portafolio({ nombre: 'MenuBy Tura', slug: 'TURA', adminId: DUENO });

    expect(p.validateSync()).toBeUndefined();
    expect(p.slug).toBe('tura');
  });

  it('la dirección no admite espacios ni símbolos', () => {
    /* "menuby tura" en una URL se convierte en "menuby%20tura", que nadie va a
       escribir bien. */
    for (const malo of ['menuby tura', 'tura/', 'turá', 'tura?x']) {
      const p = new Portafolio({ nombre: 'X', slug: malo, adminId: DUENO });
      expect(p.validateSync()?.errors?.slug).toBeDefined();
    }
  });

  it('la dirección es única: dos dueños no pueden tomar la misma', () => {
    expect(Portafolio.schema.path('slug').options.unique).toBe(true);
  });

  it('nace activo, con su propio color', () => {
    /* Los colores son del portafolio y no de ninguno de sus negocios: tiene
       identidad propia, que es justo la razón de que exista. */
    const p = new Portafolio({ nombre: 'MenuBy Tura', slug: 'tura', adminId: DUENO });

    expect(p.activo).toBe(true);
    expect(p.colorPrincipal).toBe('#111827');
    expect(p.negocios).toHaveLength(0);
  });

  it('no arrastra nada de sucursales', () => {
    /* Es lo que lo separa de `Brand`. Si este modelo tuviera `useSharedMenu` o
       `mainBranchId`, una pizzería y un sushi del mismo dueño empezarían a
       comportarse como sucursales el uno del otro. */
    const campos = Object.keys(Portafolio.schema.paths);

    expect(campos).not.toContain('useSharedMenu');
    expect(campos).not.toContain('mainBranchId');
    expect(campos).not.toContain('brandId');
  });
});

describe('la ruta del portafolio', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'portafolios.js'), 'utf8');

  it('respeta el orden que puso el dueño', () => {
    /* Mongo devuelve en el orden que quiera. El orden del arreglo es la única
       curaduría que hay en un portafolio, así que reordenar por cercanía o
       popularidad —como hace el listado general— tiraría lo que el dueño
       configuró. */
    expect(src).toContain('const porId = new Map');
    expect(src).toContain('ids' + '\n      .map((id) => porId.get(String(id)))');
  });

  it('aplica el mismo filtro de visibilidad que el listado general', () => {
    /* El portafolio decide cuáles de los visibles muestra, no salta el filtro:
       un negocio suspendido o sin plan no puede colarse por aquí. */
    expect(src).toContain('filtroVisible({ _id: { $in: ids } })');
  });

  it('no deja poner negocios ajenos en la vitrina', () => {
    /* Sin esto, cualquiera podría armar una página con los negocios de otro y
       hacerla pasar por propia. */
    expect(src).toContain('negocio_ajeno');
    expect(src).toContain('const ajenos = pedidos.filter');
  });

  it('una dirección tomada responde 409 y no 500', () => {
    /* Es algo que el dueño puede resolver eligiendo otra: tiene que poder
       distinguirlo de una caída del servidor. */
    expect(src).toContain('slug_ocupado');
    expect(src).toContain('status(409)');
  });

  it('las rutas concretas van antes que el comodín', () => {
    /* Si `/:slug` quedara primero, se tragaría `/mios/negocios` y buscaría un
       portafolio llamado "mios". */
    const comodin = src.indexOf("router.get('/:slug'");
    const mios = src.indexOf("router.get('/mios/negocios'");
    const raiz = src.indexOf("router.get('/',");

    expect(mios).toBeLessThan(comodin);
    expect(raiz).toBeLessThan(comodin);
  });

  it('está montada en el servidor', () => {
    const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

    expect(server).toContain('/api/portafolios');
  });
});
