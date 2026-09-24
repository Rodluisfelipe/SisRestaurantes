/**
 * Extras con cantidad ("Carne extra ×10") y el recargo de grupo.
 *
 * Cada unidad llega como su propia entrada en selectedToppings. El precio de
 * la opción se cobra por cada una; el recargo del grupo y los subgrupos, una
 * sola vez por grupo (antes se cobraban en cada entrada).
 */
jest.mock('../Models/Product', () => ({ find: jest.fn() }));
jest.mock('../Models/ToppingGroup', () => ({ find: jest.fn() }));
jest.mock('../utils/logger', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const Product = require('../Models/Product');
const ToppingGroup = require('../Models/ToppingGroup');
const { validateOrderPrices } = require('../utils/orderPricing');

const NEGOCIO = '64b000000000000000000001';
const lean = (v) => ({ lean: () => Promise.resolve(v) });

const hamburguesa = { _id: 'p1', name: 'Hamburguesa', price: 20000, toppingGroups: ['g1'] };
const adiciones = {
  _id: 'g1',
  name: 'Adiciones',
  basePrice: 1000,
  options: [{ name: 'Carne extra', price: 5000 }, { name: 'Queso', price: 2000 }],
  subGroups: [{ title: 'Salsa', options: [{ name: 'BBQ', price: 500 }] }],
};

beforeEach(() => {
  Product.find.mockReturnValue(lean([hamburguesa]));
  ToppingGroup.find.mockReturnValue(lean([adiciones]));
});

const carne = { groupName: 'Adiciones', optionName: 'Carne extra', price: 5000 };
const item = (selectedToppings, quantity = 1) => ({ productId: 'p1', name: 'Hamburguesa', quantity, selectedToppings });

describe('extras repetidos', () => {
  it('10 carnes extra cobran 10 veces la carne y una vez el recargo', async () => {
    const toppings = Array.from({ length: 10 }, (_, i) => (i === 0 ? { ...carne, basePrice: 1000 } : carne));
    const esperado = 20000 + 1000 + 10 * 5000;
    expect((await validateOrderPrices([item(toppings)], NEGOCIO, esperado)).valid).toBe(true);
  });

  it('si el celular cobra el recargo 10 veces, el servidor lo rechaza', async () => {
    const toppings = Array.from({ length: 10 }, () => ({ ...carne, basePrice: 1000 }));
    const inflado = 20000 + 10 * 1000 + 10 * 5000;
    expect((await validateOrderPrices([item(toppings)], NEGOCIO, inflado)).valid).toBe(false);
  });

  it('dos opciones del mismo grupo: recargo una vez', async () => {
    const toppings = [
      { ...carne, basePrice: 1000 },
      { groupName: 'Adiciones', optionName: 'Queso', price: 2000 },
    ];
    expect((await validateOrderPrices([item(toppings)], NEGOCIO, 20000 + 1000 + 5000 + 2000)).valid).toBe(true);
  });

  it('los subgrupos se cobran una vez aunque vengan repetidos en cada entrada (carritos viejos)', async () => {
    const conSalsa = { ...carne, basePrice: 1000, subGroups: [{ subGroupTitle: 'Salsa', optionName: 'BBQ', price: 500 }] };
    const toppings = [conSalsa, conSalsa];
    expect((await validateOrderPrices([item(toppings)], NEGOCIO, 20000 + 1000 + 2 * 5000 + 500)).valid).toBe(true);
  });

  it('la cantidad del producto multiplica todo', async () => {
    const toppings = [{ ...carne, basePrice: 1000 }, carne];
    expect((await validateOrderPrices([item(toppings, 2)], NEGOCIO, 2 * (20000 + 1000 + 2 * 5000))).valid).toBe(true);
  });
});
