const express = require('express');
const router = express.Router();
const PosCaja = require('../Models/PosCaja');
const { tenantAuth } = require('../middleware/tenantAuth');
const { isValidObjectId } = require('../utils/validators');
const logger = require('../utils/logger');

/**
 * Las terminales del negocio, desde el panel.
 *
 * Dos cosas: ver cuáles hay y **desvincular una**. La segunda es la que
 * importa, y tiene que estar a un clic el día que se pierda una caja o se vaya
 * alguien con ella: a esa hora nadie va a llamar a soporte a pedir que le
 * inventen una revocación.
 */

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

module.exports = router;
