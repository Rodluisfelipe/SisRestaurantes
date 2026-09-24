const { armarEmbudo } = require('../utils/embudoPedido');

describe('embudo del pedido', () => {
  // 100 visitas: 50 solo vieron el menú, 20 abrieron el carrito, 10 fueron a
  // finalizar y se quedaron ahí, 5 eligieron tipo, 5 pusieron dirección y 10 pidieron.
  const conteos = [{ _id: 0, n: 50 }, { _id: 1, n: 20 }, { _id: 2, n: 10 }, { _id: 3, n: 5 }, { _id: 4, n: 5 }, { _id: 6, n: 10 }];
  const pasos = armarEmbudo(conteos);
  const paso = (clave) => pasos.find((p) => p.clave === clave);

  it('cada paso suma a los que llegaron más lejos', () => {
    expect(paso('menu').llegaron).toBe(100);
    expect(paso('carrito').llegaron).toBe(50);
    expect(paso('finalizar').llegaron).toBe(30);
    expect(paso('tipo').llegaron).toBe(20);
    expect(paso('direccion').llegaron).toBe(15);
    expect(paso('pago').llegaron).toBe(10);
    expect(paso('pidieron').llegaron).toBe(10);
  });

  it('dice cuántos se cayeron en cada paso y qué porcentaje', () => {
    expect(paso('finalizar').seCayeron).toBe(20);
    expect(paso('finalizar').pctCaida).toBe(40);
    expect(paso('pidieron').seCayeron).toBe(0);
    expect(paso('pidieron').deTodos).toBe(10);
  });

  it('sin visitas no divide por cero', () => {
    expect(armarEmbudo([]).every((p) => p.llegaron === 0 && p.deTodos === 0 && p.pctCaida === 0)).toBe(true);
  });
});
