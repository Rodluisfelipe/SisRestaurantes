const express = require('express');
const router = express.Router();
const PosCaja = require('../Models/PosCaja');
const PosVinculacion = require('../Models/PosVinculacion');
const { generar, bonito } = require('../utils/codigoVinculacion');
const { tenantAuth } = require('../middleware/tenantAuth');
const { isValidObjectId } = require('../utils/validators');
const logger = require('../utils/logger');
const { conDefectos, validarConfig } = require('../utils/configPos');

/**
 * Las terminales del negocio, desde el panel.
 *
 * Dos cosas: ver cuáles hay y **desvincular una**. La segunda es la que
 * importa, y tiene que estar a un clic el día que se pierda una caja o se vaya
 * alguien con ella: a esa hora nadie va a llamar a soporte a pedir que le
 * inventen una revocación.
 */

/* POST /api/cajas/vincular — un código para conectar una caja nueva.
 *
 * El dueño le da al botón, le sale un código de ocho caracteres y lo dicta o
 * lo escribe en la terminal. Nadie tiene que abrir las herramientas del
 * navegador ni entender qué es un token, que era el problema del flujo
 * anterior.
 *
 * Un superadmin tiene que decir de qué negocio es: no pertenece a ninguno.
 */
router.post('/vincular', tenantAuth, async (req, res) => {
  const businessId = req.user?.businessId || req.body.businessId;
  if (!businessId) {
    return res.status(400).json({
      message: 'Dinos de qué negocio es la caja',
      motivo: 'falta_negocio',
    });
  }

  try {
    const nombre = String(req.body.nombre || 'Caja').trim().slice(0, 60) || 'Caja';

    /* Diez minutos: suficiente para caminar hasta la caja y escribirlo, poco
       para que sirva un código que quedó en una nota pegada al monitor. */
    const minutos = 10;
    const expiraEn = new Date(Date.now() + minutos * 60 * 1000);

    /* Si sale un código repetido —prácticamente imposible, pero el índice único
       lo haría fallar— se reintenta en vez de devolverle un error al dueño. */
    let vinculacion = null;
    for (let intento = 0; intento < 5 && !vinculacion; intento++) {
      try {
        vinculacion = await PosVinculacion.create({
          businessId,
          codigo: generar(),
          nombre,
          creadaPor: req.user?.id || null,
          expiraEn,
        });
      } catch (e) {
        if (e.code !== 11000) throw e;
      }
    }

    if (!vinculacion) return res.status(500).json({ message: 'No se pudo generar el código' });

    logger.info('Código de vinculación generado', { businessId: String(businessId), nombre });
    res.status(201).json({
      codigo: bonito(vinculacion.codigo),
      nombre,
      expira_en_minutos: minutos,
      expira: expiraEn,
    });
  } catch (error) {
    logger.error('Error generando el código de vinculación', error, req);
    res.status(500).json({ message: 'No se pudo generar el código' });
  }
});

/* GET /api/cajas — qué terminales tiene este negocio y cuál sigue viva. */
router.get('/', tenantAuth, async (req, res) => {
  const businessId = req.user?.businessId || req.query.businessId;
  if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });

  try {
    const cajas = await PosCaja.find({ businessId })
      .select('nombre revocada revocadaEn ultimaVezVista ultimaActividad venceEn createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const ahora = Date.now();
    res.json(
      cajas.map((c) => ({
        ...c,
        /* "Activa" no es lo mismo que "vinculada": una caja puede seguir
           vinculada y llevar tres días sin hablar porque alguien la desconectó
           del internet, y eso el dueño tiene que poder verlo. */
        callada: c.ultimaVezVista ? ahora - new Date(c.ultimaVezVista).getTime() > 24 * 60 * 60 * 1000 : true,
        vencida: new Date(c.venceEn).getTime() < ahora,
      })),
    );
  } catch (error) {
    logger.error('Error listando las cajas', error, req);
    res.status(500).json({ message: 'No se pudieron cargar las cajas' });
  }
});

/* POST /api/cajas/:id/revocar — matar el token de una terminal. */
router.post('/:id/revocar', tenantAuth, async (req, res) => {
  const businessId = req.user?.businessId || req.body.businessId;
  if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Id inválido' });

  try {
    /* El filtro lleva businessId además del id: sin eso, el id de una caja
       ajena bastaría para apagar la caja de otro negocio. */
    const caja = await PosCaja.findOneAndUpdate(
      { _id: req.params.id, businessId },
      { $set: { revocada: true, revocadaEn: new Date() } },
      { new: true },
    );

    if (!caja) return res.status(404).json({ message: 'Esa caja no existe' });

    logger.info('Caja revocada', { caja: caja.nombre, businessId: String(businessId) });

    /* La caja revocada no pierde lo que tiene guardado: sus ventas siguen en su
       SQLite. Lo que pierde es el permiso de subirlas, y eso hay que decirlo
       para que nadie crea que revocar borra plata. */
    res.json({
      ok: true,
      mensaje: `${caja.nombre} quedó desvinculada. Las ventas que tenga sin subir se quedan en esa máquina.`,
    });
  } catch (error) {
    logger.error('Error revocando la caja', error, req);
    res.status(500).json({ message: 'No se pudo desvincular la caja' });
  }
});

/* GET /api/cajas/:id/config — la configuración de una terminal.
 *
 * Solo el panel. Una caja no puede leer —ni mucho menos cambiar— su propia
 * configuración por esta vía: la recibe con el catálogo, en un solo sentido.
 * Si pudiera escribir aquí, una terminal robada podría apagarse los impuestos. */
router.get('/:id/config', tenantAuth, async (req, res) => {
  const businessId = req.user?.businessId || req.query.businessId;
  if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });

  try {
    const caja = await PosCaja.findOne({ _id: req.params.id, businessId })
      .select('nombre config')
      .lean();

    if (!caja) return res.status(404).json({ message: 'Esa caja no existe' });

    /* Se devuelve con los valores por defecto ya aplicados, no el documento
       crudo: una caja vinculada antes de que existiera este bloque no tiene
       `config`, y el panel se encontraría con undefined en todos los campos. */
    res.json({ nombre: caja.nombre, config: conDefectos(caja.config) });
  } catch (error) {
    logger.error('Error leyendo la configuración de la caja', error, req);
    res.status(500).json({ message: 'No se pudo cargar la configuración' });
  }
});

/* PUT /api/cajas/:id/config — cambiarla.
 *
 * Mover `actualizadoEn` es lo que hace que la caja se entere: compara esa
 * fecha contra su marca de agua en cada sincronización. Sin tocarla, el cambio
 * se guardaría aquí y la terminal seguiría con lo de antes para siempre. */
router.put('/:id/config', tenantAuth, async (req, res) => {
  const businessId = req.user?.businessId || req.body.businessId;
  if (!businessId) return res.status(400).json({ message: 'businessId es requerido' });

  const limpia = validarConfig(req.body.config);
  if (!limpia.ok) return res.status(400).json({ message: limpia.error });

  try {
    const caja = await PosCaja.findOneAndUpdate(
      { _id: req.params.id, businessId },
      { $set: { config: { ...limpia.config, actualizadoEn: new Date() } } },
      { new: true },
    ).select('nombre config');

    if (!caja) return res.status(404).json({ message: 'Esa caja no existe' });

    logger.info('Configuración de caja actualizada', {
      cajaId: String(caja._id),
      businessId: String(businessId),
    });
    res.json({ nombre: caja.nombre, config: caja.config });
  } catch (error) {
    logger.error('Error guardando la configuración de la caja', error, req);
    res.status(500).json({ message: 'No se pudo guardar la configuración' });
  }
});

module.exports = router;
