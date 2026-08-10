/**
 * El efectivo esperado al cerrar la caja.
 *
 * Existe por un fallo que costó meses de cuadres a mano: el mismo método de
 * pago tiene dos nombres en la base —'cash' y 'efectivo'— y el cierre solo
 * contaba uno. En producción eran $37.608.800 invisibles y 35 de 38 cierres
 * descuadrados. Los cajeros buscaban una diferencia que no existía.
 */
const fs = require('fs');
const path = require('path');

const ruta = (...p) => path.join(__dirname, '..', ...p);

/** La misma regla que usa el cierre, para poder probarla sin base de datos. */
const MISMO_METODO = { efectivo: 'cash', transferencia: 'transfer' };
const metodoDe = (m) => MISMO_METODO[m.paymentMethod] || m.paymentMethod || 'cash';

function agrupar(movimientos) {
  const por = {};
  movimientos.forEach((m) => {
    const method = metodoDe(m);
    if (!por[method]) por[method] = { count: 0, total: 0 };
    por[method].count += 1;
    por[method].total += m.amount;
  });
  return por;
}

describe('los dos nombres del mismo método de pago', () => {
  const MOVIMIENTOS = [
    { paymentMethod: 'cash', amount: 10000 },
    { paymentMethod: 'efectivo', amount: 15000 },   // el mismo método, otro nombre
    { paymentMethod: 'transfer', amount: 5000 },
    { paymentMethod: 'transferencia', amount: 7000 },
    { paymentMethod: 'nequi', amount: 3000 },
    { amount: 2000 },                                // sin método = efectivo
  ];

  it('el efectivo suma "cash", "efectivo" y los que no traen método', () => {
    const por = agrupar(MOVIMIENTOS);
    expect(por.cash.total).toBe(27000);   // 10.000 + 15.000 + 2.000
    expect(por.cash.count).toBe(3);
  });

  it('las transferencias suman sus dos nombres', () => {
    expect(agrupar(MOVIMIENTOS).transfer.total).toBe(12000);
  });

  it('los demás métodos quedan como están', () => {
    expect(agrupar(MOVIMIENTOS).nequi.total).toBe(3000);
  });

  it('no quedan montones sueltos con el nombre largo', () => {
    const por = agrupar(MOVIMIENTOS);
    expect(por.efectivo).toBeUndefined();
    expect(por.transferencia).toBeUndefined();
  });

  /* Lo que de verdad se rompía: el cierre miraba `byPaymentMethod['cash']` y
     el montón de 'efectivo' no entraba en la cuenta. */
  it('sin agrupar, el efectivo esperado sale corto', () => {
    const crudo = {};
    MOVIMIENTOS.forEach((m) => {
      const k = m.paymentMethod || 'cash';
      crudo[k] = (crudo[k] || 0) + m.amount;
    });
    expect(crudo.cash).toBe(12000);            // lo que se contaba antes
    expect(agrupar(MOVIMIENTOS).cash.total).toBe(27000);  // lo que había de verdad
  });
});

describe('la regla está donde tiene que estar', () => {
  it('el cierre del backend agrupa los dos nombres', () => {
    const src = fs.readFileSync(ruta('Routes', 'cashRegister.js'), 'utf8');
    expect(src).toMatch(/MISMO_METODO/);
    expect(src).toMatch(/efectivo:\s*'cash'/);
    expect(src).toMatch(/transferencia:\s*'transfer'/);
  });

  /* El POS muestra su propio "efectivo esperado" mientras el cajero cuenta.
     Tenía el mismo fallo, y ahí se ve en el momento de cuadrar. */
  it('el POS también los cuenta juntos', () => {
    const src = fs.readFileSync(
      ruta('..', 'Frontend', 'src', 'Components', 'POS', 'POSCashRegister.jsx'), 'utf8'
    );
    expect(src).toMatch(/ES_EFECTIVO/);
    expect(src).toMatch(/'cash',\s*'efectivo'/);
  });
});
