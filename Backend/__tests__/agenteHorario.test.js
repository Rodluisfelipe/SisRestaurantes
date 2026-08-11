/**
 * "¿Tienen servicio?" — la pregunta que más llega y que el agente no sabía.
 *
 * Salió de una conversación real: un cliente escribió "Hola veci tienes
 * servicio ?" y el agente lo mandó a esperar a que contestara una persona.
 * El horario estaba en la base; simplemente no le llegaba.
 */
const { estadoDeHoy, bonita, proximoDiaAbierto } = require('../services/whatsappAgent/horario');
const { COL_OFFSET_MS } = require('../utils/timezone');

const DIAS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const hoyCOL = () => DIAS[new Date(Date.now() - COL_OFFSET_MS).getUTCDay()];
const minutosCOL = () => {
  const d = new Date(Date.now() - COL_OFFSET_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
const hhmm = (min) => `${String(Math.floor(((min % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Una semana entera con el mismo horario. */
const semanaCon = (dia) => ({ businessHours: Object.fromEntries(DIAS.map((d) => [d, dia])) });

describe('si está abierto ahora mismo', () => {
  it('dentro del horario, contesta que sí y hasta cuándo', () => {
    const ahora = minutosCOL();
    const r = estadoDeHoy(semanaCon({ isOpen: true, openTime: hhmm(ahora - 60), closeTime: hhmm(ahora + 120) }));
    expect(r.abierto).toBe(true);
    expect(r.texto).toMatch(/abiertos hasta/i);
  });

  it('antes de abrir, dice a qué hora abre hoy', () => {
    const ahora = minutosCOL();
    const r = estadoDeHoy(semanaCon({ isOpen: true, openTime: hhmm(ahora + 60), closeTime: hhmm(ahora + 180) }));
    expect(r.abierto).toBe(false);
    expect(r.texto).toMatch(/todavía no abrimos/i);
  });

  /* Abre a las 6 de la tarde y cierra a las 2 de la madrugada. Con una
     comparación simple, ese negocio saldría "cerrado" las 24 horas. */
  it('entiende los horarios que pasan de medianoche', () => {
    const ahora = minutosCOL();
    const r = estadoDeHoy(semanaCon({ isOpen: true, openTime: hhmm(ahora - 60), closeTime: hhmm(ahora - 120) }));
    expect(r.abierto).toBe(true);
  });
});

describe('cuando está cerrado', () => {
  it('el día marcado como cerrado se respeta', () => {
    const r = estadoDeHoy(semanaCon({ isOpen: false }));
    expect(r.abierto).toBe(false);
    expect(r.texto).toMatch(/cerrados/i);
  });

  /* El interruptor del panel manda sobre el horario: un negocio que cerró por
     hoy lo apaga ahí, y decirle al cliente que está abierto porque el horario
     dice que sí lo manda a una puerta cerrada. */
  it('el interruptor manual gana al horario', () => {
    const abierto = semanaCon({ isOpen: true, openTime: '00:00', closeTime: '23:59' });
    expect(estadoDeHoy({ ...abierto, isOpen: false }).abierto).toBe(false);
  });

  it('sin horarios configurados no se inventa uno', () => {
    // Un cliente que llega y encuentra cerrado no vuelve.
    expect(estadoDeHoy({})).toBeNull();
    expect(estadoDeHoy(null)).toBeNull();
  });
});

describe('cómo se escribe la hora', () => {
  it.each([
    ['22:00', '10 p.m.'],
    ['08:00', '8 a.m.'],
    ['23:30', '11:30 p.m.'],
    ['00:00', '12 a.m.'],
    ['12:00', '12 p.m.'],
  ])('%s se lee "%s"', (entrada, esperado) => {
    expect(bonita(entrada)).toBe(esperado);
  });
});

describe('el próximo día con atención', () => {
  it('salta los días cerrados', () => {
    const horarios = Object.fromEntries(DIAS.map((d) => [d, { isOpen: false }]));
    const manana = DIAS[(DIAS.indexOf(hoyCOL()) + 2) % 7];
    horarios[manana] = { isOpen: true, openTime: '09:00', closeTime: '18:00' };
    expect(proximoDiaAbierto(horarios, hoyCOL()).desde).toBe('09:00');
  });

  it('si nunca abre, no devuelve nada en vez de dar vueltas', () => {
    const horarios = Object.fromEntries(DIAS.map((d) => [d, { isOpen: false }]));
    expect(proximoDiaAbierto(horarios, hoyCOL())).toBeNull();
  });
});
