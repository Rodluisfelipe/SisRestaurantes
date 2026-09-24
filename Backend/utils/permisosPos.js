/**
 * Los permisos de la caja y los roles de fábrica.
 *
 * La misma lista vive en la caja (pos-nativo/core/src/permisos.rs). Una prueba
 * lee ese archivo y exige que coincidan: un permiso que el panel ofrece y la
 * caja no conoce sería un interruptor que no hace nada.
 */

const PERMISOS = [
  { clave: 'cobrar', nombre: 'Vender y cobrar' },
  { clave: 'turno', nombre: 'Abrir y cerrar su turno' },
  { clave: 'ventas', nombre: 'Ver las ventas del turno y reimprimir' },
  { clave: 'pedidos_web', nombre: 'Atender pedidos web' },
  { clave: 'efectivo', nombre: 'Registrar entradas y salidas de efectivo' },
  { clave: 'gaveta', nombre: 'Abrir la gaveta sin venta' },
  { clave: 'descuento', nombre: 'Hacer descuentos' },
  { clave: 'anular', nombre: 'Quitar lo que ya fue a cocina' },
  { clave: 'devolucion', nombre: 'Hacer devoluciones' },
  { clave: 'descartar', nombre: 'Descartar ventas en espera' },
  { clave: 'precio_libre', nombre: 'Vender con precio libre' },
  { clave: 'agotados', nombre: 'Marcar productos agotados' },
  { clave: 'configurar', nombre: 'Configurar la caja (impresoras, datáfono, conexión)' },
];

const CLAVES = PERMISOS.map((p) => p.clave);

/* Los tres con los que arranca un negocio. Se pueden editar y se pueden
   crear más; estos son solo el punto de partida razonable. */
const ROLES_DE_FABRICA = [
  { id: 'cajero', nombre: 'Cajero', permisos: ['cobrar', 'turno', 'ventas', 'pedidos_web'] },
  { id: 'supervisor', nombre: 'Supervisor', permisos: CLAVES.filter((c) => c !== 'configurar') },
  { id: 'dueno', nombre: 'Dueño', permisos: [...CLAVES] },
];

const texto = (v, max) => String(v ?? '').trim().slice(0, max);

/** Valida la lista de roles que manda el panel. */
function validarRoles(roles) {
  if (!Array.isArray(roles) || roles.length === 0) {
    return { ok: false, error: 'Tiene que haber al menos un rol' };
  }
  if (roles.length > 20) return { ok: false, error: 'Máximo 20 roles' };

  const vistos = new Set();
  const limpios = [];
  for (const r of roles) {
    const nombre = texto(r?.nombre, 40);
    if (!nombre) return { ok: false, error: 'Hay un rol sin nombre' };
    const id = texto(r?.id, 40) || nombre.toLowerCase().normalize('NFD').replace(/[^\w]+/g, '_').replace(/_+$/, '');
    if (vistos.has(id)) return { ok: false, error: `El rol "${nombre}" está repetido` };
    vistos.add(id);
    const permisos = [...new Set((Array.isArray(r.permisos) ? r.permisos : []).filter((p) => CLAVES.includes(p)))];
    limpios.push({ id, nombre, permisos });
  }

  /* Alguien tiene que poder configurar la caja. Sin eso, un error del dueño
     en el panel deja todas las cajas sin quién cambie una impresora. */
  if (!limpios.some((r) => r.permisos.includes('configurar'))) {
    return { ok: false, error: 'Al menos un rol tiene que poder configurar la caja' };
  }
  return { ok: true, roles: limpios };
}

/** Un PIN de 4 a 6 dígitos. */
function pinValido(pin) {
  return typeof pin === 'string' && /^\d{4,6}$/.test(pin);
}

module.exports = { PERMISOS, CLAVES, ROLES_DE_FABRICA, validarRoles, pinValido };
