/**
 * Registro de transportadoras.
 *
 * Crecer no es agregar más estrategias dentro de Servientrega, sino adaptadores
 * al lado. Cada uno expone lo mismo:
 *
 *   { id, nombre, reconoce(guia), rastrear(guia, opciones) }
 *
 * Y `rastrear` siempre resuelve, nunca lanza: o { encontrado: true, ... } o
 * { encontrado: false, motivo, mensaje }.
 *
 * Sobre la autodetección: Servientrega, Coordinadora, Interrapidísimo y TCC
 * usan guías numéricas de longitud parecida y no se distinguen de forma
 * confiable. Por eso el pedido guarda con qué transportadora salió
 * (`order.envio.transportadora`) y eso es lo que manda; adivinar por el formato
 * queda solo como último recurso.
 */

const servientrega = require('./servientrega');

const ADAPTADORES = [servientrega];

/** El adaptador que corresponde a un nombre escrito por el negocio. */
function porNombre(nombre) {
  const buscado = String(nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
  if (!buscado) return null;

  return ADAPTADORES.find((a) => {
    const id = a.id.replace(/[^a-z0-9]/g, '');
    // "Servientrega", "SERVIENTREGA S.A.", "servi entrega" → el mismo adaptador.
    return buscado.includes(id) || id.includes(buscado);
  }) || null;
}

/** Qué transportadoras sabe rastrear MenuBy hoy. */
function soportadas() {
  return ADAPTADORES.map((a) => ({ id: a.id, nombre: a.nombre }));
}

/**
 * Rastrea una guía.
 *
 * @param {string} guia
 * @param {string} [transportadora] la que quedó guardada en el pedido
 */
async function rastrearEnvio(guia, transportadora, opciones = {}) {
  /* Si el pedido dice con quién salió, manda eso y punto. Adivinar por el
     formato solo cuando no hay nombre: una guía de Coordinadora pasa el
     formato de Servientrega, y preguntarle a la transportadora equivocada
     devuelve "no existe" para un envío que va perfectamente en camino. */
  const elegido = transportadora
    ? porNombre(transportadora)
    : ADAPTADORES.find((a) => a.reconoce(guia));

  if (!elegido) {
    return {
      encontrado: false,
      motivo: 'sin_soporte',
      mensaje: transportadora
        ? `Todavía no rastreamos envíos de ${transportadora}.`
        : 'No sabemos con qué transportadora salió este envío.',
    };
  }

  const resultado = await elegido.rastrear(guia, opciones);
  return { ...resultado, transportadora: elegido.id };
}

module.exports = { rastrearEnvio, porNombre, soportadas, ADAPTADORES };
