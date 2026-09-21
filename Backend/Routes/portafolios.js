const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Portafolio = require('../Models/Portafolio');
const BusinessConfig = require('../Models/BusinessConfig');
const Admin = require('../Models/Admin');
const { CAMPOS_VITRINA, filtroVisible } = require('../utils/marketplace');
const { tenantAuth } = require('../middleware/tenantAuth');
const logger = require('../utils/logger');

/**
 * La vitrina de un dueño con varios negocios.
 *
 * Un portafolio es "MenuBy Tura": una página con las tarjetas de los negocios
 * de una misma persona, cada una llevando a su menú de siempre. No agrupa
 * sucursales ni es un marketplace de terceros —ver `Models/Portafolio`— y no
 * toca la configuración de ningún negocio.
 */

/* El mismo techo que el listado general. Es una página pública cuya dirección
   se comparte por WhatsApp: llega en ráfagas. */
const limitePublico = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Lo que la tarjeta de un negocio necesita para dibujarse. */
function tarjeta(b) {
  return {
    _id: b._id,
    businessName: b.businessName,
    slug: b.slug,
    logo: b.logo,
    coverImage: b.coverImage,
    description: b.description,
    theme: b.theme,
    address: b.address,
    city: b.city,
    tipoTienda: b.tipoTienda || 'restaurante',
    isOpen: b.isOpen,
  };
}

/**
 * De quién es el portafolio que se está tocando.
 *
 * Casi siempre es quien hizo la petición. La excepción es el superadmin: su
 * token trae **su** id, que no es el de ningún `Admin`, y buscar negocios con
 * él no devuelve ninguno.
 *
 * Eso importa porque configurarle la página a un cliente desde soporte es
 * justo lo que alguien va a querer hacer el primer día. `tenantAuth` ya le
 * resuelve al superadmin el negocio que está mirando, así que el dueño es el
 * administrador de ese negocio.
 *
 * Devuelve `null` cuando no se puede saber —un superadmin que no entró a
 * ningún negocio— para que quien llama lo diga con palabras en vez de
 * devolver una lista vacía que parece "no tienes negocios".
 */
async function duenoDe(req) {
  if (!req.user?.isSuperAdmin) return req.user?.id || null;

  const negocio = req.resolvedBusinessId || req.user?.businessId;
  if (!negocio) return null;

  /* El dueño, no un empleado: `staff` no configura la página del negocio.
     Se prefiere `brand_admin` porque si ya tiene varios negocios asociados,
     es el que va a armar la vitrina. */
  const dueno = await Admin.findOne(
    {
      role: { $in: ['brand_admin', 'admin'] },
      $or: [{ businessId: negocio }, { accessibleBusinessIds: negocio }],
    },
    '_id role',
  )
    .sort({ role: 1 })
    .lean();

  return dueno ? String(dueno._id) : null;
}

/** Los negocios a los que este admin tiene entrada. */
async function negociosDe(adminId) {
  if (!adminId) return [];

  const admin = await Admin.findById(adminId, 'businessId accessibleBusinessIds').lean();
  if (!admin) return [];

  const suyos = new Set((admin.accessibleBusinessIds || []).map(String));
  if (admin.businessId) suyos.add(String(admin.businessId));
  return [...suyos];
}

/* ── Administración ─────────────────────────────────────────────────────
 *
 * Van **antes** que `/:slug`: `mios` y la raíz son rutas concretas y si
 * quedaran después, el comodín se las tragaría y buscaría un portafolio
 * llamado "mios".
 *
 * Quien administra un portafolio es el dueño de esos negocios, y eso ya está
 * escrito en `Admin.accessibleBusinessIds`. No se inventa un permiso nuevo: se
 * comprueba contra el que existe.
 */

/** GET /api/portafolios — el portafolio de quien pregunta, si tiene. */
router.get('/', tenantAuth, async (req, res) => {
  try {
    const dueno = await duenoDe(req);
    const mio = dueno ? await Portafolio.findOne({ adminId: dueno }).lean() : null;
    res.json({ portafolio: mio || null });
  } catch (error) {
    logger.error('Error leyendo el portafolio propio', error, req);
    res.status(500).json({ message: 'No se pudo cargar' });
  }
});

/** GET /api/portafolios/mios/negocios — los que puede poner en la vitrina. */
router.get('/mios/negocios', tenantAuth, async (req, res) => {
  try {
    const dueno = await duenoDe(req);
    if (!dueno) {
      /* Un superadmin que no entró a ningún negocio. Decirlo es mejor que
         devolver una lista vacía que se lee como "no tienes negocios". */
      return res.status(400).json({
        message: 'Entra primero al panel de un negocio para configurar su página',
        motivo: 'sin_negocio',
      });
    }

    const ids = await negociosDe(dueno);
    const negocios = await BusinessConfig.find({ _id: { $in: ids } })
      .select('businessName slug logo city isActive')
      .lean();

    res.json({ negocios });
  } catch (error) {
    logger.error('Error listando los negocios del dueño', error, req);
    res.status(500).json({ message: 'No se pudo cargar' });
  }
});

/* PUT /api/portafolios — crear o actualizar el propio.
 *
 * Uno por dueño: un portafolio es su cara pública, y dos caras públicas del
 * mismo dueño es un problema que nadie ha pedido resolver. */
router.put('/', tenantAuth, async (req, res) => {
  try {
    const slug = String(req.body.slug || '').toLowerCase().trim();
    const nombre = String(req.body.nombre || '').trim();

    if (!nombre || !slug) {
      return res.status(400).json({ message: 'El portafolio necesita nombre y dirección' });
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({ message: 'La dirección solo admite letras, números y guiones' });
    }

    /* Los negocios que manda tienen que ser **suyos**. Sin esta comprobación,
       cualquiera podría armar una vitrina con los negocios de otro y hacerla
       pasar por propia. */
    const dueno = await duenoDe(req);
    if (!dueno) {
      return res.status(400).json({
        message: 'Entra primero al panel de un negocio para configurar su página',
        motivo: 'sin_negocio',
      });
    }

    const suyos = new Set(await negociosDe(dueno));
    const pedidos = (Array.isArray(req.body.negocios) ? req.body.negocios : []).map(String);
    const ajenos = pedidos.filter((id) => !suyos.has(id));

    if (ajenos.length) {
      return res.status(403).json({
        message: 'Hay negocios en la lista que no son tuyos',
        motivo: 'negocio_ajeno',
      });
    }

    const datos = {
      nombre,
      slug,
      descripcion: String(req.body.descripcion || '').trim().slice(0, 300),
      logo: String(req.body.logo || ''),
      portada: String(req.body.portada || ''),
      colorPrincipal: String(req.body.colorPrincipal || '#111827'),
      colorTexto: String(req.body.colorTexto || '#ffffff'),
      negocios: pedidos,
      activo: req.body.activo !== false,
      adminId: dueno,
    };

    const guardado = await Portafolio.findOneAndUpdate(
      { adminId: dueno },
      { $set: datos },
      { new: true, upsert: true, runValidators: true },
    ).lean();

    res.json({ portafolio: guardado });
  } catch (error) {
    /* La dirección la elige el dueño y dos pueden querer la misma. Es un 409 y
       no un 500: hay algo que él puede hacer al respecto. */
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Esa dirección ya está tomada. Prueba con otra.',
        motivo: 'slug_ocupado',
      });
    }
    logger.error('Error guardando el portafolio', error, req);
    res.status(500).json({ message: 'No se pudo guardar' });
  }
});

/* GET /api/portafolios/:slug — la vitrina, pública.
 *
 * Devuelve el portafolio y sus negocios **en el orden que el dueño puso**. Ese
 * orden es la única curaduría que hay aquí, y por eso se respeta tal cual en
 * lugar de ordenar por cercanía o popularidad como hace el listado general: en
 * un portafolio de cinco negocios propios, el dueño sabe cuál quiere primero. */
router.get('/:slug', limitePublico, async (req, res) => {
  try {
    const portafolio = await Portafolio.findOne({
      slug: String(req.params.slug || '').toLowerCase().trim(),
      activo: true,
    }).lean();

    if (!portafolio) {
      return res.status(404).json({ message: 'Esa página no existe' });
    }

    const ids = portafolio.negocios || [];

    /* `filtroVisible` aplica los mismos criterios que el listado general: un
       negocio suspendido o sin plan no puede colarse por aquí. El portafolio
       decide **cuáles de los visibles** muestra, no salta el filtro. */
    const negocios = ids.length
      ? await BusinessConfig.find(filtroVisible({ _id: { $in: ids } }))
          .select(CAMPOS_VITRINA)
          .lean()
      : [];

    /* Se reordenan según el arreglo del portafolio. Mongo devuelve en el orden
       que quiera, y el orden es justamente lo que el dueño configuró. */
    const porId = new Map(negocios.map((b) => [String(b._id), b]));
    const ordenados = ids
      .map((id) => porId.get(String(id)))
      .filter(Boolean)
      .map(tarjeta);

    res.json({
      portafolio: {
        nombre: portafolio.nombre,
        slug: portafolio.slug,
        descripcion: portafolio.descripcion,
        logo: portafolio.logo,
        portada: portafolio.portada,
        colorPrincipal: portafolio.colorPrincipal,
        colorTexto: portafolio.colorTexto,
      },
      negocios: ordenados,
    });
  } catch (error) {
    logger.error('Error cargando el portafolio', error, req);
    res.status(500).json({ message: 'No se pudo cargar la página' });
  }
});

module.exports = router;
