/**
 * Si el negocio está abierto y hasta qué hora.
 *
 * "¿Tienen servicio?", "¿están abiertos?", "¿hasta qué hora?" es de lo que más
 * preguntan, y hasta ahora el agente lo mandaba a una persona: no tenía el
 * horario en ningún lado. Un cliente esperando a que alguien le confirme si
 * pueden pedirle es un cliente que se va a otro lado.
 */
const { COL_OFFSET_MS } = require('../../utils/timezone');

const DIAS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const EN_ESPANOL = {
  sunday: 'domingo', monday: 'lunes', tuesday: 'martes', wednesday: 'miércoles',
  thursday: 'jueves', friday: 'viernes', saturday: 'sábado',
};

/** Ahora mismo, en hora de Colombia. */
function ahoraCOL() {
  const d = new Date(Date.now() - COL_OFFSET_MS);
  return { dia: DIAS[d.getUTCDay()], minutos: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

const aMinutos = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return Number.isFinite(h) ? h * 60 + (m || 0) : null;
};

/* "22:00" se lee mejor como "10:00 p. m."; nadie contesta en formato militar. */
function bonita(hhmm) {
  const min = aMinutos(hhmm);
  if (min === null) return hhmm;
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h24 < 12 ? 'a.m.' : 'p.m.'}`;
}

/**
 * Devuelve el estado de hoy, o null si el negocio no tiene horarios puestos
 * —en cuyo caso es mejor callarse que inventar uno.
 */
function estadoDeHoy(config) {
  const horarios = config?.businessHours;
  if (!horarios) return null;

  const { dia, minutos } = ahoraCOL();
  const hoy = horarios[dia];
  if (!hoy) return null;

  /* El interruptor manual manda sobre el horario: un negocio que cerró por hoy
     lo apaga en el panel, y decirle al cliente que está abierto porque el
     horario dice que sí es peor que no contestar. */
  const apagadoAMano = config.isOpen === false;

  if (apagadoAMano || hoy.isOpen === false) {
    const proximo = proximoDiaAbierto(horarios, dia);
    return {
      abierto: false,
      texto: proximo
        ? `Ahora estamos cerrados. Abrimos el ${proximo.nombre} de ${bonita(proximo.desde)} a ${bonita(proximo.hasta)}`
        : 'Ahora estamos cerrados.',
    };
  }

  const abre = aMinutos(hoy.openTime);
  const cierra = aMinutos(hoy.closeTime);
  if (abre === null || cierra === null) return null;

  /* Los horarios que pasan de medianoche —abre 18:00, cierra 02:00— serían
     "cerrado todo el día" con una comparación simple. */
  const cruzaMedianoche = cierra <= abre;
  const dentro = cruzaMedianoche
    ? (minutos >= abre || minutos < cierra)
    : (minutos >= abre && minutos < cierra);

  if (dentro) {
    return { abierto: true, texto: `¡Sí! Estamos abiertos hasta las ${bonita(hoy.closeTime)} 😊` };
  }
  if (minutos < abre) {
    return { abierto: false, texto: `Todavía no abrimos. Hoy atendemos de ${bonita(hoy.openTime)} a ${bonita(hoy.closeTime)}` };
  }
  const proximo = proximoDiaAbierto(horarios, dia);
  return {
    abierto: false,
    texto: `Ya cerramos por hoy 😕`
      + (proximo ? ` Mañana abrimos a las ${bonita(proximo.desde)}` : ''),
  };
}

/** El siguiente día con atención, empezando por mañana. */
function proximoDiaAbierto(horarios, diaDeHoy) {
  const desde = DIAS.indexOf(diaDeHoy);
  for (let i = 1; i <= 7; i++) {
    const clave = DIAS[(desde + i) % 7];
    const d = horarios[clave];
    if (d?.isOpen !== false && d?.openTime) {
      return { nombre: EN_ESPANOL[clave], desde: d.openTime, hasta: d.closeTime };
    }
  }
  return null;
}

/** La semana completa, para cuando piden el horario y no si está abierto. */
function semana(config) {
  const horarios = config?.businessHours;
  if (!horarios) return null;

  const lineas = [];
  for (const clave of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
    const d = horarios[clave];
    if (!d) continue;
    lineas.push(d.isOpen === false
      ? `• ${EN_ESPANOL[clave]}: cerrado`
      : `• ${EN_ESPANOL[clave]}: ${bonita(d.openTime)} a ${bonita(d.closeTime)}`);
  }
  return lineas.length ? lineas.join('\n') : null;
}

module.exports = { estadoDeHoy, semana, bonita, ahoraCOL, proximoDiaAbierto };
