/**
 * Marcar como vencidas las suscripciones que pasaron su periodo de gracia.
 *
 * Nadie actualizaba el campo `status`: el proceso programado solo mandaba
 * recordatorios. Las 28 suscripciones de producción decían 'active', incluida
 * una vencida hacía cuatro meses, y cualquier consulta que leyera ese campo
 * mentía —yo mismo caí en eso auditando.
 */
const fs = require('fs');
const path = require('path');

const fuente = fs.readFileSync(
  path.join(__dirname, '..', 'services', 'subscriptionCron.js'), 'utf8'
);

describe('el proceso que ordena las suscripciones vencidas', () => {
  it('existe y se ejecuta con el cron', () => {
    expect(fuente).toMatch(/async function marcarVencidas/);
    expect(fuente).toMatch(/await marcarVencidas\(\)/);
  });

  it('usa el estado que admite el modelo', () => {
    /* El enum es ['active','expired','cancelled','pending']. 'suspended' es un
       estado CALCULADO, no guardable: escribirlo reventaría la validación. */
    expect(fuente).toMatch(/\$set:\s*\{\s*status:\s*'expired'\s*\}/);
    expect(fuente).not.toMatch(/\$set:\s*\{\s*status:\s*'suspended'/);
  });

  it('respeta el periodo de gracia, el mismo que usa el cálculo al leer', () => {
    expect(fuente).toMatch(/GRACE_DAYS/);
    expect(fuente).toMatch(/limite\.setDate\(limite\.getDate\(\) - GRACE_DAYS\)/);
  });

  it('no toca las que no tienen fecha de fin', () => {
    // periodEnd null = sin vencimiento; marcarlas sería inventarse un corte.
    expect(fuente).toMatch(/periodEnd:\s*\{\s*\$ne:\s*null,\s*\$lt:\s*limite\s*\}/);
  });

  it('un fallo suyo no tumba los recordatorios', () => {
    // Son dos trabajos distintos: avisar a quien está por vencer importa más
    // que ordenar el dato de quien ya venció.
    const bloque = fuente.match(/async function marcarVencidas[\s\S]*?\n\}/)[0];
    expect(bloque).toMatch(/try\s*\{/);
    expect(bloque).toMatch(/catch/);
  });
});
