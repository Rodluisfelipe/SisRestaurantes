/**
 * Permisos de la caja: roles a la medida en vez de "cajero o supervisor".
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresco-de-prueba';

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { CLAVES, ROLES_DE_FABRICA, validarRoles, pinValido } = require('../utils/permisosPos');

describe('los permisos', () => {
  it('son exactamente los que conoce la caja', () => {
    // Un permiso que el panel ofrece y la caja no conoce no haría nada.
    const rust = fs.readFileSync(path.join(__dirname, '..', '..', 'pos-nativo', 'core', 'src', 'permisos.rs'), 'utf8');
    const deLaCaja = [...rust.matchAll(/\("([a-z_]+)", "/g)].map((m) => m[1]);
    expect([...deLaCaja].sort()).toEqual([...CLAVES].sort());
  });

  it('los roles de fábrica: el cajero no descuenta, el dueño lo puede todo', () => {
    const cajero = ROLES_DE_FABRICA.find((r) => r.id === 'cajero');
    expect(cajero.permisos).toContain('cobrar');
    expect(cajero.permisos).not.toContain('descuento');
    expect(ROLES_DE_FABRICA.find((r) => r.id === 'dueno').permisos).toEqual(CLAVES);
  });
});

describe('validar roles', () => {
  it('limpia permisos inventados y arma el id del nombre', () => {
    const v = validarRoles([{ nombre: 'Cajero de confianza', permisos: ['cobrar', 'devolucion', 'borrar_todo'] }, ROLES_DE_FABRICA[2]]);
    expect(v.ok).toBe(true);
    expect(v.roles[0].id).toBe('cajero_de_confianza');
    expect(v.roles[0].permisos).toEqual(['cobrar', 'devolucion']);
  });

  it('alguien tiene que poder configurar la caja', () => {
    expect(validarRoles([{ nombre: 'Cajero', permisos: ['cobrar'] }]).ok).toBe(false);
  });

  it('no deja roles repetidos ni vacíos', () => {
    expect(validarRoles([]).ok).toBe(false);
    expect(validarRoles([{ nombre: 'A', permisos: ['configurar'] }, { nombre: 'A', permisos: [] }]).ok).toBe(false);
  });
});

describe('el PIN', () => {
  it('de 4 a 6 números', () => {
    expect(pinValido('1234')).toBe(true);
    expect(pinValido('123456')).toBe(true);
    expect(pinValido('123')).toBe(false);
    expect(pinValido('12a4')).toBe(false);
    expect(pinValido(1234)).toBe(false);
  });

  it('se guarda en un formato que la caja sabe verificar', () => {
    // La caja acepta hashes $2a$/$2b$ (ver usuarios.rs, acepta_el_hash_que_hace_el_backend).
    expect(bcrypt.hashSync('2468', 6)).toMatch(/^\$2[ab]\$06\$/);
  });
});

describe('las rutas', () => {
  const panel = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'posPanel.js'), 'utf8');
  const pos = fs.readFileSync(path.join(__dirname, '..', 'Routes', 'pos.js'), 'utf8');

  it('dos personas activas no pueden tener el mismo PIN', () => {
    expect(panel).toContain("'Ese PIN ya lo usa otra persona'");
  });

  it('no se quita un rol que alguien todavía tiene', () => {
    expect(panel).toContain('tiene un rol que quitaste');
  });

  it('el panel nunca devuelve el hash del PIN; la caja sí lo recibe', () => {
    const paraPanel = panel.slice(panel.indexOf('const paraPanel'), panel.indexOf('async function pinEnUso'));
    expect(paraPanel).not.toContain('pinHash');
    expect(pos).toMatch(/router\.get\('\/personal', tenantAuth, cajaVigente/);
    expect(pos).toContain('pin_hash: u.pinHash');
  });
});
