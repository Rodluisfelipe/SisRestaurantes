/**
 * "¿Tienes servicio?" tiene que contestarse, no escalarse.
 *
 * Esta prueba es la conversación real del 10/8 a las 7:05 p.m., donde el
 * cliente preguntó cinco veces si había servicio y no lo supo nunca: primero
 * le llegó el menú, luego "¿qué te gustaría pedir?" tres veces, y al final el
 * agente se rindió y lo pasó a una persona.
 *
 * Fallaban tres cosas a la vez, y cualquiera de las tres bastaba para romperlo:
 *   1. `normalizar` no copiaba `preguntaHorario`, así que llegaba siempre false
 *   2. `turno` se leía antes de su `const` → ReferenceError dentro de la rama
 *   3. el traspaso a un humano se evaluaba antes que el horario
 */
const { resolver } = require('../services/whatsappAgent/conversacion');

const CONFIG = {
  isOpen: true,
  businessHours: {
    monday: { isOpen: true, openTime: '11:00', closeTime: '22:00' },
    tuesday: { isOpen: true, openTime: '11:00', closeTime: '22:00' },
    wednesday: { isOpen: true, openTime: '11:00', closeTime: '22:00' },
    thursday: { isOpen: true, openTime: '11:00', closeTime: '22:00' },
    friday: { isOpen: true, openTime: '11:00', closeTime: '23:00' },
    saturday: { isOpen: true, openTime: '11:00', closeTime: '23:00' },
    sunday: { isOpen: true, openTime: '12:00', closeTime: '21:00' },
  },
};

const turnoBase = (dicho, extra = {}) => ({
  sesion: { mensajes: 1, items: [] },
  catalogo: [{ name: 'Hamburguesa', price: 20000, isActive: true }],
  dicho: {
    productos: [], quitar: [], tipo: null, nombre: null, direccion: null,
    confirma: null, quiereMenu: false, quiereHumano: false,
    preguntaEstado: false, preguntaCarta: false, otraPregunta: null,
    busca: null, preguntaPrecio: null, preguntaHorario: false,
    ...dicho,
  },
  enlace: 'https://www.menuby.tech/macdonalds',
  negocio: { name: 'MacDonalds' },
  estadoPedido: async () => null,
  config: CONFIG,
  ...extra,
});

describe('preguntar por el horario', () => {
  it('contesta si hay servicio en vez de pasar a una persona', async () => {
    /* Tal cual llega de verdad: el modelo marca el horario Y deja el texto en
       `otraPregunta`, porque el prompt le pide meter ahí los horarios. Esa
       combinación es la que se iba por el traspaso. */
    const r = await resolver(turnoBase({
      preguntaHorario: true,
      otraPregunta: 'tienes servicio',
    }, { texto: 'Hola veci tienes servicio?' }));

    expect(r.traspasar).toBeFalsy();
    expect(r.respuesta).not.toMatch(/alguien del equipo/i);
    expect(r.respuesta).toMatch(/abiert|cerrad|abrimos|atendemos/i);
  });

  it('no revienta al componer la respuesta', async () => {
    // `turno` se leía antes de existir y la excepción se comía la respuesta.
    const r = await resolver(turnoBase(
      { preguntaHorario: true },
      { texto: '¿Están abiertos?', sesion: { mensajes: 0, items: [] } },
    ));
    expect(typeof r.respuesta).toBe('string');
    expect(r.respuesta.length).toBeGreaterThan(0);
    expect(r.respuesta).not.toMatch(/undefined|NaN|\[object/);
  });

  it('sin horarios configurados lo pasa a una persona, no inventa una hora', async () => {
    const r = await resolver(turnoBase(
      { preguntaHorario: true },
      { texto: '¿Hasta qué hora?', config: {} },
    ));
    expect(r.traspasar).toBeTruthy();
    expect(r.respuesta).toMatch(/equipo/i);
  });

  it('el precio y la búsqueda tampoco escalan', async () => {
    const precio = await resolver(turnoBase(
      { preguntaPrecio: 'hamburguesa', otraPregunta: 'cuánto vale' },
      { texto: '¿Cuánto vale la hamburguesa?' },
    ));
    expect(precio.traspasar).toBeFalsy();
    expect(precio.respuesta).toMatch(/20\.000/);

    const busca = await resolver(turnoBase(
      { busca: 'pollo', otraPregunta: 'qué tienen de pollo' },
      { texto: '¿Qué tienen de pollo?' },
    ));
    expect(busca.traspasar).toBeFalsy();
  });

  it('lo que el código NO sabe responder sí sigue llegando a una persona', async () => {
    const r = await resolver(turnoBase(
      { otraPregunta: '¿tienen parqueadero?' },
      { texto: '¿Tienen parqueadero?' },
    ));
    expect(r.traspasar).toBeTruthy();
  });
});
