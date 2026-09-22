/**
 * Una dirección que no existe no es una caída del servidor.
 *
 * El 22/09/2026 los únicos cuatro errores 5xx del día fueron esto: alguien
 * escribió mal su dirección al pedir un domicilio y el servidor respondió 500.
 * Con un 500 el frontend no puede distinguirlo de un servicio caído, así que
 * le dice "intenta más tarde" a quien solo tiene que corregir la calle —y de
 * paso ensucia el conteo de 5xx, que es donde uno mira si algo se rompió.
 *
 * Lo que se prueba es esa distinción, en las dos direcciones: que el error del
 * cliente salga 404 y que el del servicio siga saliendo 500.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-prueba';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresco-de-prueba';

const express = require('express');
const request = require('supertest');

jest.mock('express-rate-limit', () => () => (req, res, next) => next());
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('axios');

const axios = require('axios');
const { geocodeAddress, reverseGeocode, clearCache } = require('../utils/geocoding');

beforeEach(() => {
  jest.clearAllMocks();
  /* El módulo cachea por dirección: sin limpiar, la segunda prueba leería la
     respuesta de la primera. */
  clearCache();
});

describe('el ayudante de geocodificación', () => {
  it('marca la dirección que no existe', async () => {
    axios.get.mockResolvedValue({ data: [] });

    await expect(geocodeAddress('calle que no existe')).rejects.toMatchObject({
      codigo: 'direccion_no_encontrada',
    });
  });

  it('no marca una caída del servicio', async () => {
    /* Nominatim caído, sin red, DNS: eso sí es nuestro problema y tiene que
       poder distinguirse. */
    axios.get.mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));

    const error = await geocodeAddress('cualquier calle').catch((e) => e);

    expect(error.codigo).toBeUndefined();
  });

  it('no envuelve el error que ya viene clasificado', async () => {
    /* Era el bug: se lanzaba dentro del `try`, su propio `catch` lo atrapaba
       y lo volvía a envolver como "Error al geocodificar: …", perdiendo la
       marca por el camino. */
    axios.get.mockResolvedValue({ data: [] });

    const error = await geocodeAddress('calle que no existe').catch((e) => e);

    expect(error.message).not.toContain('Error al geocodificar');
  });

  it('también en la búsqueda inversa', async () => {
    axios.get.mockResolvedValue({ data: null });

    await expect(reverseGeocode(3.87, -77.0)).rejects.toMatchObject({
      codigo: 'direccion_no_encontrada',
    });
  });
});

describe('lo que responde la ruta', () => {
  const app = express();
  app.use(express.json());
  app.use('/', require('../Routes/deliveryZones'));

  it('404 cuando la dirección no existe', async () => {
    axios.get.mockResolvedValue({ data: [] });

    const r = await request(app).post('/geocode').send({ address: 'calle que no existe' });

    expect(r.status).toBe(404);
  });

  it('el mensaje le dice al cliente qué hacer', async () => {
    /* "Error al geocodificar: No se encontraron resultados" no le sirve a
       nadie que esté pidiendo un almuerzo. */
    axios.get.mockResolvedValue({ data: [] });

    const r = await request(app).post('/geocode').send({ address: 'otra calle inventada' });

    expect(r.body.message || r.body.error).toMatch(/dirección|mapa/i);
  });

  it('sigue siendo 500 si el servicio se cae', async () => {
    axios.get.mockRejectedValue(new Error('socket hang up'));

    const r = await request(app).post('/geocode').send({ address: 'calle real' });

    expect(r.status).toBe(500);
  });

  it('sin dirección sigue siendo 400', async () => {
    const r = await request(app).post('/geocode').send({});

    expect(r.status).toBe(400);
  });

  it('la búsqueda inversa responde igual', async () => {
    axios.get.mockResolvedValue({ data: null });

    const r = await request(app).post('/reverse-geocode').send({ lat: 3.87, lon: -77.0 });

    expect(r.status).toBe(404);
  });
});
