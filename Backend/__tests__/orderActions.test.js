/**
 * El panel y la máquina de estados tienen que hablar el mismo idioma.
 *
 * Los pedidos de POS y de pedido rápido nacen en `confirmed`, pero el panel
 * solo tenía botones para cuatro de los once estados, así que quedaban sin
 * forma de avanzar: solo se podían cancelar. La lista de acciones vive en el
 * frontend y las transiciones válidas en el backend, y nada obligaba a que
 * coincidieran. Estas pruebas leen ambos archivos y los cruzan.
 */
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..', '..');
const leer = (...p) => fs.readFileSync(path.join(raiz, ...p), 'utf8');

/** Recorta un literal `{...}` o `[...]` balanceando llaves. */
function recortarLiteral(src, desde) {
  const abre = src[desde];
  const cierra = abre === '{' ? '}' : ']';
  let nivel = 0;
  for (let i = desde; i < src.length; i++) {
    if (src[i] === abre) nivel++;
    else if (src[i] === cierra && --nivel === 0) return src.slice(desde, i + 1);
  }
  throw new Error('literal sin cerrar');
}

function bloqueDespuesDe(src, marca) {
  const i = src.indexOf(marca);
  if (i === -1) throw new Error(`no se encontró: ${marca}`);
  return recortarLiteral(src, src.indexOf(marca[marca.length - 1] === '{' ? '{' : '[', i + marca.length - 1));
}

// ── Backend: transiciones permitidas ──
const srcOrders = leer('Backend', 'Routes', 'orders.js');
const FIN = new Function(`return ${bloqueDespuesDe(srcOrders, 'const FIN = [')}`)();
const VALID_TRANSITIONS = new Function('FIN', `return ${bloqueDespuesDe(srcOrders, 'const VALID_TRANSITIONS = {')}`)(FIN);

// ── Frontend: estados y acciones ofrecidas ──
const srcConst = leer('Frontend', 'src', 'utils', 'constants.js');
const ORDER_STATUS = new Function(`return ${bloqueDespuesDe(srcConst, 'export const ORDER_STATUS = {')}`)();

const srcCard = leer('Frontend', 'src', 'Components', 'OrderCard.jsx');
const icono = () => null;
/* Los pasos dependen del tipo de pedido (en un domicilio "Listo" es "En
   camino"; en la mesa no existe): se evalúa el bloque del panel, de
   `const S =` a `const nextSteps`, para cada tipo. */
const bloquePasos = srcCard.slice(srcCard.indexOf('const S = ORDER_STATUS;'), srcCard.indexOf('const nextSteps ='));
const pasosPara = (orderType) => new Function(
  'ORDER_STATUS', 'order', 'FaPlay', 'FaCheck', 'FaMotorcycle',
  `${bloquePasos}
return NEXT_STEPS;`,
)(ORDER_STATUS, { orderType }, icono, icono, icono);
const TIPOS = ['delivery', 'takeaway', 'inSite'];
const NEXT_STEPS = pasosPara('delivery');

const TERMINALES = ['completed', 'delivered', 'cancelled'];

describe.each(TIPOS)('acciones del panel vs. máquina de estados (%s)', (tipo) => {
  const NEXT_STEPS = pasosPara(tipo);
  it('el panel solo ofrece saltos que el backend acepta', () => {
    const invalidos = [];
    for (const [desde, pasos] of Object.entries(NEXT_STEPS)) {
      const permitidos = VALID_TRANSITIONS[desde];
      expect(permitidos).toBeDefined();
      for (const paso of pasos) {
        if (!permitidos.includes(paso.to)) invalidos.push(`${desde} → ${paso.to} ("${paso.label}")`);
      }
    }
    expect(invalidos).toEqual([]);
  });

  /* Los dos estados de pago son la excepción a propósito, por el mismo motivo
     que el backend los deja fuera de FIN: nadie ha confirmado que el cliente
     pagó, y avanzar sería dar por cobrado algo que no lo está. */
  const SIN_ACCION_A_PROPOSITO = ['pending_payment', 'payment_uploaded'];

  it('ningún estado deja al pedido sin salida', () => {
    const sinSalida = Object.keys(VALID_TRANSITIONS).filter((estado) => {
      if (TERMINALES.includes(estado)) return false;
      if (SIN_ACCION_A_PROPOSITO.includes(estado)) return false;
      return !(NEXT_STEPS[estado] || []).length;
    });
    expect(sinSalida).toEqual([]);
  });

  it('todo pedido que se puede trabajar se puede completar', () => {
    const sinCompletar = Object.keys(VALID_TRANSITIONS).filter((estado) => {
      if (TERMINALES.includes(estado)) return false;
      if (SIN_ACCION_A_PROPOSITO.includes(estado)) return false;
      // Vale llegar a completed directo o pasando por otro estado que sí lo ofrezca.
      const pasos = NEXT_STEPS[estado] || [];
      if (pasos.some((p) => p.to === 'completed')) return false;
      return !pasos.some((p) => (NEXT_STEPS[p.to] || []).some((q) => q.to === 'completed'));
    });
    expect(sinCompletar).toEqual([]);
  });

  it('los pedidos de POS y de pedido rápido nacen en un estado que el panel sabe manejar', () => {
    // El backend los crea en CONFIRMED (ver initialStatus en Routes/orders.js).
    expect(srcOrders).toMatch(/isPOS \? ORDER_STATUS\.CONFIRMED/);
    expect(NEXT_STEPS.confirmed).toBeDefined();
    expect(NEXT_STEPS.confirmed.map((p) => p.to)).toContain('completed');
  });
});
