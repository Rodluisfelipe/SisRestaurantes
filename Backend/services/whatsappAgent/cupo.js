/**
 * Cuánto ha atendido el agente este mes, y hasta dónde puede.
 *
 * El complemento se cobra a precio fijo pero atender cuesta por mensaje: sin
 * tope, un solo negocio con mucho tráfico se lleva por delante el margen de
 * todos los demás. Se cuentan CONVERSACIONES y no mensajes porque es lo que se
 * le promete al negocio y lo que entiende sin explicaciones.
 *
 * Al agotarse NO se corta la bandeja: los mensajes siguen llegando y el negocio
 * puede responder a mano. Lo único que se apaga es el agente.
 */
const { getAddonConfig } = require('../../utils/commercialPlans');

/** 'AAAA-MM' del mes en curso en Colombia. */
function periodoActual(ahora = new Date()) {
  const col = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  return `${col.getFullYear()}-${String(col.getMonth() + 1).padStart(2, '0')}`;
}

/** Cuántas conversaciones tiene derecho a atender. */
function cupoDe(account) {
  if (Number.isFinite(account?.agente?.cupoConversaciones)) {
    return account.agente.cupoConversaciones;
  }
  return getAddonConfig('whatsapp_agent')?.incluye?.conversaciones ?? 500;
}

/**
 * Pone los contadores al día. Si cambió el mes, arrancan de cero.
 * Devuelve el consumo vigente sin guardar: guarda quien llame.
 */
function alDia(account, ahora = new Date()) {
  const periodo = periodoActual(ahora);
  account.agente = account.agente || {};
  const c = account.agente.consumo || {};

  if (c.periodo !== periodo) {
    account.agente.consumo = {
      periodo, conversaciones: 0, mensajes: 0, avisadoSinCupo: false,
    };
  }
  return account.agente.consumo;
}

/** ¿Le queda cupo para atender una conversación nueva? */
function tieneCupo(account, ahora = new Date()) {
  const consumo = alDia(account, ahora);
  return consumo.conversaciones < cupoDe(account);
}

/**
 * Registra una conversación nueva. Solo se cuenta al abrirla, no en cada
 * mensaje: si se contara por mensaje, un cliente indeciso valdría como diez.
 */
function contarConversacion(account, ahora = new Date()) {
  const consumo = alDia(account, ahora);
  consumo.conversaciones += 1;
  account.markModified?.('agente.consumo');
  return consumo;
}

/** Registra un mensaje atendido. Sirve para ver el costo real, no para topar. */
function contarMensaje(account, ahora = new Date()) {
  const consumo = alDia(account, ahora);
  consumo.mensajes += 1;
  account.markModified?.('agente.consumo');
  return consumo;
}

/** Lo que se le muestra al negocio en el panel. */
function estado(account, ahora = new Date()) {
  const consumo = alDia(account, ahora);
  const cupo = cupoDe(account);
  return {
    periodo: consumo.periodo,
    usadas: consumo.conversaciones,
    cupo,
    restantes: Math.max(0, cupo - consumo.conversaciones),
    mensajes: consumo.mensajes,
    agotado: consumo.conversaciones >= cupo,
  };
}

module.exports = { periodoActual, cupoDe, alDia, tieneCupo, contarConversacion, contarMensaje, estado };
