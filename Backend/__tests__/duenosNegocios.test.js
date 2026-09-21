/**
 * Asociar varios negocios a un mismo dueño.
 *
 * Existe porque la única vía que había —`/api/brands/:id/assign`— convierte los
 * negocios en **sucursales**: pone `brandId`, `isMainBranch`, `useSharedMenu` y
 * `mainBranchId`. Para una pizzería y una heladería del mismo dueño eso es
 * falso, y el panel empezaría a listarlas bajo "Sucursales".
 *
 * Aquí solo se da acceso. Lo que se vigila es precisamente que no se cuele nada
 * de lo otro.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresco-de-prueba';

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'superadmin.js'), 'utf8');
const ruta = src.slice(
  src.indexOf("router.put('/duenos/:adminId/negocios'"),
  src.indexOf('/* ── Complementos (add-ons) ──'),
);

describe('asociar negocios a un dueño', () => {
  it('la ruta existe y es de superadmin', () => {
    expect(src).toContain("router.put('/duenos/:adminId/negocios'");
    expect(ruta).toContain("requireRole('admin')");
  });

  it('NO toca nada de sucursales', () => {
    /* Es la razón de que esta ruta exista en vez de reutilizar la de marcas.
       Si mañana alguien agrega una de estas líneas "para que se vea igual",
       Doguitos y Fraise pasan a ser sucursales la una de la otra. */
    for (const campo of ['brandId', 'isMainBranch', 'useSharedMenu', 'mainBranchId', 'branchLabel']) {
      expect(ruta).not.toContain(campo);
    }
  });

  it('comprueba que los negocios existan', () => {
    /* Un id inventado dejaría al dueño con entrada a un negocio fantasma, y el
       síntoma —una tarjeta que no carga— no diría de dónde vino. */
    expect(ruta).toContain('negocio_inexistente');
    expect(ruta).toContain('existentes.length !== pedidos.length');
  });

  it('reemplaza la lista entera, no suma', () => {
    /* Es lo que permite **quitar** un negocio sin necesitar otra ruta. */
    expect(ruta).toContain('admin.accessibleBusinessIds = pedidos;');
  });

  it('deja al dueño con un negocio por defecto válido', () => {
    /* Si le quitan el negocio con el que entra y no se corrige, no puede
       iniciar sesión. */
    expect(ruta).toContain('const sigue = admin.businessId && pedidos.includes(String(admin.businessId));');
    expect(ruta).toContain('if (!sigue) admin.businessId = pedidos[0];');
  });

  it('pone el rol que el login ya mira para ofrecer el cambio de negocio', () => {
    const auth = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'auth.js'), 'utf8');

    expect(ruta).toContain("admin.role = 'brand_admin';");
    // El login usa ese mismo rol para cargar la lista de negocios.
    expect(auth).toContain("admin.role === 'brand_admin' && admin.accessibleBusinessIds?.length");
  });

  it('queda registrado quién lo hizo', () => {
    /* Dar acceso a los negocios de otro es de lo más delicado que hace un
       superadmin: tiene que quedar en la auditoría. */
    expect(ruta).toContain("audit(req, 'duenos.negocios'");
  });

  it('exige al menos un negocio', () => {
    /* Con la lista vacía el dueño se quedaría sin poder entrar a ninguno. */
    expect(ruta).toContain('Manda al menos un negocio');
  });
});
