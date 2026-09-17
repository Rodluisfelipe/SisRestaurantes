const express = require('express');
const router = express.Router();
const PanelLiveAcceso = require('../Models/PanelLiveAcceso');
const { protectSuperAdmin, requireRole } = require('../middleware/authSuperAdmin');
const { isValidObjectId } = require('../utils/isValidObjectId');
const logger = require('../utils/logger');

/**
 * Cuentas del Panel LIVE, el panel de TikTok que corre aparte en el servidor.
 *
 * No pasa por el registro de auditoría: ese registro es por negocio y su
 * esquema solo admite recursos de restaurantes. Cada cambio queda en el log
 * con quién lo hizo.
 */
router.use(protectSuperAdmin, requireRole('admin'));

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/accesos', async (req, res) => {
  try {
    // El hash solo se pide para saber si la persona ya se registró; no sale.
    const cuentas = await PanelLiveAcceso.find().sort({ createdAt: -1 }).select('+passwordHash').lean();
    const accesos = cuentas.map(({ passwordHash, ...cuenta }) => ({ ...cuenta, registrado: Boolean(passwordHash) }));
    res.json({ accesos });
  } catch (error) {
    logger.error('Error listando cuentas del Panel LIVE', error, req);
    res.status(500).json({ message: 'Error al cargar las cuentas' });
  }
});

// Alta previa: cuando esa persona se registre en el panel, entra directo.
router.post('/accesos', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!EMAIL_VALIDO.test(email) || email.length > 254) {
    return res.status(400).json({ message: 'Escribe un correo válido' });
  }
  const nota = String(req.body?.nota || '').trim().slice(0, 120);

  try {
    const acceso = await PanelLiveAcceso.create({
      email,
      nota,
      activo: true,
      aprobadoEn: new Date(),
      agregadoPor: req.user?.email || ''
    });
    logger.info('Acceso al Panel LIVE concedido', { email, por: req.user?.email });
    res.status(201).json({ acceso });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Ese correo ya tiene cuenta' });
    }
    logger.error('Error concediendo acceso al Panel LIVE', error, req);
    res.status(500).json({ message: 'Error al dar el acceso' });
  }
});

// Aprobar, pausar o reactivar.
router.patch('/accesos/:id', async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Cuenta inválida' });
  if (typeof req.body?.activo !== 'boolean') {
    return res.status(400).json({ message: 'Indica si la cuenta queda activa o pausada' });
  }

  try {
    const acceso = await PanelLiveAcceso.findById(req.params.id);
    if (!acceso) return res.status(404).json({ message: 'Cuenta no encontrada' });

    acceso.activo = req.body.activo;
    if (acceso.activo && !acceso.aprobadoEn) acceso.aprobadoEn = new Date();
    await acceso.save();

    logger.info('Cuenta del Panel LIVE cambiada', { email: acceso.email, activo: acceso.activo, por: req.user?.email });
    res.json({ acceso });
  } catch (error) {
    logger.error('Error cambiando cuenta del Panel LIVE', error, req);
    res.status(500).json({ message: 'Error al cambiar la cuenta' });
  }
});

router.delete('/accesos/:id', async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Cuenta inválida' });

  try {
    const acceso = await PanelLiveAcceso.findByIdAndDelete(req.params.id);
    if (!acceso) return res.status(404).json({ message: 'Cuenta no encontrada' });
    logger.info('Cuenta del Panel LIVE borrada', { email: acceso.email, por: req.user?.email });
    res.json({ ok: true });
  } catch (error) {
    logger.error('Error borrando cuenta del Panel LIVE', error, req);
    res.status(500).json({ message: 'Error al borrar la cuenta' });
  }
});

module.exports = router;
