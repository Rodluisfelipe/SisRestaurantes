/**
 * La llave de "Mi cuenta": abre solo la cuenta de ese teléfono en ese negocio,
 * no se puede fabricar sin el secreto y nunca vale como sesión del panel.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const {
  emitirLlave, leerLlave, abreCuenta, requiereCuenta,
  perfilParaCliente, direccionesDe, limpiarDireccion, pedidoParaCliente, normalizarTelefono,
} = require('../utils/cuentaCliente');

const NEGOCIO = '64b000000000000000000001';
const OTRO = '64b000000000000000000002';
const pedirCon = (llave) => ({ headers: llave ? { 'x-cuenta': llave } : {} });

describe('la llave de la cuenta', () => {
  it('abre la cuenta de ese teléfono en ese negocio', () => {
    const llave = emitirLlave({ businessId: NEGOCIO, telefono: '300 123 4567' });
    expect(leerLlave(pedirCon(llave))).toEqual({ businessId: NEGOCIO, telefono: '300 123 4567' });
    expect(abreCuenta(pedirCon(llave), NEGOCIO, '3001234567')).toBe(true);
  });

  it('no abre otro teléfono ni otro negocio', () => {
    const llave = emitirLlave({ businessId: NEGOCIO, telefono: '3001234567' });
    expect(abreCuenta(pedirCon(llave), NEGOCIO, '3009999999')).toBe(false);
    expect(abreCuenta(pedirCon(llave), OTRO, '3001234567')).toBe(false);
  });

  it('sin llave, saber el teléfono no sirve', () => {
    expect(abreCuenta(pedirCon(null), NEGOCIO, '3001234567')).toBe(false);
  });

  it('una llave firmada con otro secreto no vale', () => {
    const falsa = jwt.sign({ tipo: 'cuenta', b: NEGOCIO, p: '3001234567' }, 'otro-secreto');
    expect(leerLlave(pedirCon(falsa))).toBeNull();
  });

  it('una sesión del panel no vale como llave, ni la llave como sesión del panel', () => {
    const sesionPanel = jwt.sign({ id: 'admin1', businessId: NEGOCIO }, process.env.JWT_SECRET);
    expect(leerLlave(pedirCon(sesionPanel))).toBeNull();
    const llave = emitirLlave({ businessId: NEGOCIO, telefono: '3001234567' });
    expect(() => jwt.verify(llave, process.env.JWT_SECRET)).toThrow();
  });

  it('no se emite sin teléfono', () => {
    expect(emitirLlave({ businessId: NEGOCIO, telefono: '  ' })).toBeNull();
  });

  it('normaliza espacios, guiones y paréntesis al comparar', () => {
    expect(normalizarTelefono('(300) 123-45 67')).toBe('3001234567');
  });
});

describe('requiereCuenta', () => {
  const app = express();
  app.get('/cuenta', requiereCuenta, (req, res) => res.json(req.cuenta));

  it('sin llave responde 401 SIN_CUENTA', async () => {
    const r = await request(app).get('/cuenta');
    expect(r.status).toBe(401);
    expect(r.body.codigo).toBe('SIN_CUENTA');
  });

  it('con llave deja pasar con la cuenta de la llave', async () => {
    const llave = emitirLlave({ businessId: NEGOCIO, telefono: '3001234567' });
    const r = await request(app).get('/cuenta').set('x-cuenta', llave);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ businessId: NEGOCIO, telefono: '3001234567' });
  });
});

describe('lo que el cliente ve de sí mismo', () => {
  const cliente = {
    name: 'Ana', phone: '3001234567', email: 'ana@x.co', address: 'Cra 6 #3-139',
    notes: [{ text: 'Cliente difícil' }], status: 'vip', totalSpent: 900000,
    saldoFavor: 5000, credito: { habilitado: true, cupo: 100000, saldo: 20000 },
  };

  it('nunca incluye las notas del personal ni los datos internos', () => {
    const p = perfilParaCliente(cliente);
    expect(p).not.toHaveProperty('notes');
    expect(p).not.toHaveProperty('status');
    expect(p).not.toHaveProperty('totalSpent');
    expect(p.saldoFavor).toBe(5000);
    expect(p.credito).toEqual({ cupo: 100000, saldo: 20000 });
  });

  it('sin crédito habilitado no muestra crédito', () => {
    expect(perfilParaCliente({ ...cliente, credito: { habilitado: false } }).credito).toBeNull();
  });

  it('la dirección única de antes aparece como "Casa"', () => {
    expect(direccionesDe(cliente)).toEqual([
      { id: 'anterior', etiqueta: 'Casa', texto: 'Cra 6 #3-139', referencia: '', principal: true },
    ]);
  });

  it('con direcciones guardadas, muestra esas', () => {
    const d = direccionesDe({ ...cliente, direcciones: [{ _id: 'a1', etiqueta: 'Oficina', texto: 'Calle 1', principal: true }] });
    expect(d).toHaveLength(1);
    expect(d[0].etiqueta).toBe('Oficina');
  });
});

describe('limpiarDireccion', () => {
  it('rechaza una dirección incompleta', () => {
    expect(limpiarDireccion({ texto: 'Cra' }).error).toBeTruthy();
  });
  it('recorta y pone etiqueta por defecto', () => {
    const { direccion } = limpiarDireccion({ texto: '  Calle 10 # 5-20  ', etiqueta: '' });
    expect(direccion).toEqual({ etiqueta: 'Dirección', texto: 'Calle 10 # 5-20', referencia: '', principal: false });
  });
});

describe('pedidoParaCliente', () => {
  it('trae lo necesario para "pedir de nuevo" y el seguimiento de su dueño', () => {
    const p = pedidoParaCliente({
      _id: 'o1', orderNumber: 74, status: 'completed', orderType: 'delivery', totalAmount: 81900,
      createdAt: new Date('2026-09-01'), customerToken: 'tok',
      internalNotes: 'no mostrar', deliveryPersonId: 'd1',
      items: [{ productId: 'p1', name: 'Hamburguesa', quantity: 2, price: 20000, selectedToppings: [{ groupName: 'Salsa' }] }],
    });
    expect(p.items[0]).toMatchObject({ productId: 'p1', nombre: 'Hamburguesa', cantidad: 2 });
    expect(p.seguimiento).toBe('tok');
    expect(p).not.toHaveProperty('internalNotes');
    expect(p).not.toHaveProperty('deliveryPersonId');
  });
});
