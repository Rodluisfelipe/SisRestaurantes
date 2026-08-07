/**
 * El ledger de Crew es la única prueba de a dónde fue la plata. Estas pruebas
 * cubren la clase de fallo que costó $20.000 sin dejar rastro: el saldo se
 * descontaba y el asiento reventaba después por un valor fuera del enum.
 */
const fs = require('fs');
const path = require('path');
const CrewWalletTxn = require('../Models/CrewWalletTxn');

const base = {
  actorType: 'crew_employer',
  actorId: '507f1f77bcf86cd799439011',
  kind: 'vacancy_post',
  direction: 'out',
  amount: 10000,
};

describe('CrewWalletTxn — enums', () => {
  it('acepta a un empleador externo como autor del movimiento', () => {
    const txn = new CrewWalletTxn({ ...base, performedBy: { kind: 'crew_employer', id: base.actorId } });
    expect(txn.validateSync()).toBeUndefined();
  });

  it('acepta a un empleador externo como dueño de la billetera', () => {
    const txn = new CrewWalletTxn({ ...base, performedBy: { kind: 'system' } });
    expect(txn.validateSync()).toBeUndefined();
  });

  /* La prueba de verdad: cualquier `performedBy: { kind: 'x' }` escrito en el
     código tiene que existir en el enum. Sin esto, agregar un actor nuevo
     vuelve a romper el ledger en silencio y solo se nota auditando saldos. */
  it('todo performedBy.kind usado en el código existe en el enum', () => {
    const permitidos = CrewWalletTxn.schema.path('performedBy.kind').enumValues;
    const raiz = path.join(__dirname, '..');
    const usados = new Map();

    const recorrer = (dir) => {
      for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        if (item.name === 'node_modules' || item.name === '__tests__' || item.name.startsWith('.')) continue;
        const full = path.join(dir, item.name);
        if (item.isDirectory()) { recorrer(full); continue; }
        if (!item.name.endsWith('.js')) continue;
        const src = fs.readFileSync(full, 'utf8');
        for (const m of src.matchAll(/performedBy:\s*\{\s*kind:\s*'([a-z_]+)'/g)) {
          usados.set(m[1], path.relative(raiz, full));
        }
        // Forma con ternario: kind: cond ? 'a' : 'b'
        for (const m of src.matchAll(/performedBy:\s*\{\s*kind:[^}]*?\?\s*'([a-z_]+)'\s*:\s*'([a-z_]+)'/g)) {
          usados.set(m[1], path.relative(raiz, full));
          usados.set(m[2], path.relative(raiz, full));
        }
      }
    };
    recorrer(raiz);

    expect(usados.size).toBeGreaterThan(0);
    const invalidos = [...usados].filter(([k]) => !permitidos.includes(k));
    expect(invalidos.map(([k, f]) => `${k} (en ${f})`)).toEqual([]);
  });

  it('todo actorType usado en el código existe en el enum', () => {
    const permitidos = CrewWalletTxn.schema.path('actorType').enumValues;
    expect(permitidos).toContain('crew_employer');
    expect(permitidos).toContain('worker');
    expect(permitidos).toContain('business');
  });
});

describe('crewLedger — ningún saldo cambia sin asiento', () => {
  /* Se comprueba leyendo el código: cada punto donde se mueve plata antes de
     escribir el asiento tiene que tener su vuelta atrás o su registro del
     fallo. Un test de integración exigiría Mongo; esto atrapa la regresión. */
  const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'crewLedger.js'), 'utf8');

  it('el cobro de vacante se revierte si el asiento falla', () => {
    const fn = src.slice(src.indexOf('async function chargeVacancyFee'));
    const cuerpo = fn.slice(0, fn.indexOf('\n}\n'));
    expect(cuerpo).toMatch(/catch[\s\S]*'crewWallet\.balance': charge/);
  });

  it('la reserva del turno se revierte si el asiento falla', () => {
    const fn = src.slice(src.indexOf('async function reserveShiftEscrow'));
    const cuerpo = fn.slice(0, fn.indexOf('\n}\n'));
    expect(cuerpo).toMatch(/catch[\s\S]*'crewWallet\.balance': quote\.totalReserveNeeded/);
  });

  it('un pago ya entregado deja constancia en vez de reventar', () => {
    const fn = src.slice(src.indexOf('async function releaseBookingFunds'));
    const cuerpo = fn.slice(0, fn.indexOf('\n}\n'));
    expect(cuerpo).toMatch(/try\s*\{\s*await CrewWalletTxn\.insertMany/);
    expect(cuerpo).toMatch(/PAGO SIN ASIENTO/);
  });
});
