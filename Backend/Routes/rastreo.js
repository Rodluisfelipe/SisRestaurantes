const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { rastrearEnvio, soportadas } = require('../services/transportadoras');
const logger = require('../utils/logger');

/**
 * Rastreo de envíos.
 *
 * Público a propósito: quien compró necesita ver dónde va su paquete sin tener
 * sesión, igual que ve el estado de su pedido. Lo que lo protege es que solo
 * acepta un número de guía —no revela nada de un pedido, ni un teléfono, ni una
 * dirección— y que está limitado por IP.
 *
 * Diez consultas por minuto es holgado para una persona impaciente y sigue
 * frenando el scraping. Servientrega no publica cuota; sin límite ni caché,
 * diez refrescos del cliente son treinta peticiones contra sus servidores y el
 * riesgo real es que bloqueen la IP del droplet.
 */
const limitador = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Demasiadas consultas de rastreo. Espera un momento.' },
});

/* Caché en memoria del proceso.
   Aquí alcanza porque MenuBy corre un solo contenedor por despliegue (azul o
   verde, nunca los dos sirviendo): el TTL es real. El día que haya varias
   instancias esto pasa a ser "por instancia" y toca moverlo a Redis. */
const cache = new Map();
const MAX_EN_CACHE = 500;

const TTL = {
  ok: 180 * 1000,          // un envío no cambia de estado cada segundo
  entregado: 60 * 60 * 1000, // ya llegó: no va a cambiar más
  no_encontrada: 60 * 1000,  // pudo ser un dedazo, pero tampoco hay que insistir
};

function leerCache(clave) {
  const fila = cache.get(clave);
  if (!fila) return null;
  if (Date.now() > fila.expira) {
    cache.delete(clave);
    return null;
  }
  return fila.valor;
}

function guardarCache(clave, valor, ttl) {
  /* Nunca se cachea un fallo de red ni un timeout: congelaría una caída
     pasajera durante minutos justo cuando el cliente más quiere mirar. */
  if (!ttl) return;
  if (cache.size >= MAX_EN_CACHE) cache.delete(cache.keys().next().value);
  cache.set(clave, { valor, expira: Date.now() + ttl });
}

const HTTP = {
  guia_invalida: 400,
  no_encontrada: 404,
  timeout: 504,
  upstream_error: 502,
  sin_soporte: 501,
};

/* GET /api/rastreo/transportadoras — cuáles sabemos rastrear hoy. */
router.get('/transportadoras', (req, res) => {
  res.json(soportadas());
});

/* GET /api/rastreo?guia=...&transportadora=Servientrega */
router.get('/', limitador, async (req, res) => {
  const guia = String(req.query.guia || '').trim();
  const transportadora = String(req.query.transportadora || '').trim();

  const clave = `${transportadora.toLowerCase()}|${guia}`;
  const enCache = leerCache(clave);
  if (enCache) {
    return res.set('Cache-Control', 'public, max-age=120').json(enCache);
  }

  try {
    const resultado = await rastrearEnvio(guia, transportadora);

    if (!resultado.encontrado) {
      guardarCache(clave, null, 0);   // los fallos no se cachean
      if (resultado.motivo === 'no_encontrada') {
        guardarCache(clave, { ...resultado }, TTL.no_encontrada);
      }
      return res.status(HTTP[resultado.motivo] || 502)
        .json({ error: resultado.mensaje, motivo: resultado.motivo });
    }

    /* `fuente` dice cuál de los tres endpoints respondió. Es telemetría: sirve
       para enterarnos de que Servientrega cambió algo antes que los clientes,
       y no tiene por qué salir al navegador. */
    const { fuente, ...publico } = resultado;
    logger.debug('Rastreo resuelto', { transportadora: resultado.transportadora, fuente, movimientos: resultado.totalMovimientos });

    guardarCache(clave, publico, publico.fase === 'entregado' ? TTL.entregado : TTL.ok);
    res.set('Cache-Control', 'public, max-age=120').json(publico);
  } catch (error) {
    // El adaptador ya no lanza; esto cubre un fallo del propio registro.
    logger.error('Error rastreando el envío', error, req);
    res.status(502).json({ error: 'El rastreo no está disponible.', motivo: 'upstream_error' });
  }
});

module.exports = router;
