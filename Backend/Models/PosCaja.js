const mongoose = require('mongoose');

/**
 * Las cajas registradoras vinculadas a un negocio.
 *
 * Existe por una sola razón: **poder matar un token desde el panel**. Un token
 * firmado es válido hasta que vence, haga lo que haga el servidor; la única
 * forma de revocarlo antes es que el servidor consulte algo en cada petición.
 * Ese algo es esta colección.
 *
 * El costo es una lectura por sincronización. Con una caja que sube cada
 * treinta segundos eso es nada, y compra algo que no se puede improvisar el día
 * que se pierda una terminal o se vaya un empleado con ella.
 */
const posCajaSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true,
    index: true,
  },

  /** Como la llama el dueño: "Caja principal", "Barra". */
  nombre: { type: String, required: true, trim: true, maxlength: 60 },

  /* El identificador del token (jti). No es el token: es su nombre. Guardar el
     token entero sería guardar la llave en la cerradura. */
  tokenId: { type: String, required: true, unique: true, index: true },

  revocada: { type: Boolean, default: false, index: true },
  revocadaEn: { type: Date, default: null },

  /* Cuándo habló esta caja por última vez. Es lo que le dice al dueño cuál de
     sus terminales está viva y cuál lleva tres días muda porque alguien la
     desconectó del internet. */
  ultimaVezVista: { type: Date, default: null },
  /** Qué hizo la última vez: vender, cerrar turno, bajar catálogo. */
  ultimaActividad: { type: String, default: '', trim: true, maxlength: 40 },

  vinculadaPor: { type: mongoose.Schema.Types.ObjectId, default: null },
  venceEn: { type: Date, required: true },

  /* ── La configuración de esta terminal ───────────────────────────────────

     Todo lo que hasta ahora había que ir a configurar máquina por máquina. El
     dueño lo pone aquí desde el panel y la caja lo recoge en su siguiente
     sincronización, que es en menos de treinta segundos.

     Va por caja y no por negocio porque las terminales de un mismo local no son
     iguales: la de la barra imprime en la barra y la del mostrador no, y la del
     salón pide propina mientras la de domicilios no. */
  config: {
    /* Operación */
    autoBloqueoSegundos: { type: Number, default: 90, min: 30, max: 300 },
    sonidoActivo: { type: Boolean, default: true },
    propinaEnMesas: { type: Boolean, default: true },
    propinaSugerida: { type: Number, default: 10, min: 0, max: 50 },

    /* Régimen fiscal */
    fiscal: {
      impuestosActivos: { type: Boolean, default: true },
      /* El régimen de todo lo que no caiga en una categoría especial. Un
         restaurante es INC_8; una tienda de ropa, IVA_19. */
      regimenPrincipal: {
        type: String,
        enum: ['INC_8', 'IVA_19', 'NO_RESPONSABLE'],
        default: 'INC_8',
      },
      /* Qué categorías tributan IVA aunque el negocio opere en impoconsumo.
         Vacío = la caja usa su lista por defecto (licores, cervezas…), que es
         lo que hace que funcione desde el primer día sin configurar nada. */
      categoriasIva: [{ type: String, trim: true, maxlength: 60 }],
      categoriasExentas: [{ type: String, trim: true, maxlength: 60 }],
      /* La resolución DIAN o el régimen, al pie de la tirilla. */
      textoPieFactura: { type: String, default: '', trim: true, maxlength: 300 },
    },

    /* Periféricos */
    hardware: {
      impresoraCaja: {
        tipo: { type: String, enum: ['NINGUNA', 'RED', 'SERIAL'], default: 'NINGUNA' },
        host: { type: String, default: '', trim: true, maxlength: 60 },
        puerto: { type: Number, default: 9100, min: 1, max: 65535 },
        com: { type: String, default: '', trim: true, maxlength: 20 },
        baudios: { type: Number, default: 9600 },
        anchoMm: { type: Number, enum: [58, 80], default: 80 },
      },
      impresoraCocina: {
        tipo: { type: String, enum: ['NINGUNA', 'RED', 'SERIAL'], default: 'NINGUNA' },
        host: { type: String, default: '', trim: true, maxlength: 60 },
        puerto: { type: Number, default: 9100, min: 1, max: 65535 },
        com: { type: String, default: '', trim: true, maxlength: 20 },
        baudios: { type: Number, default: 9600 },
        anchoMm: { type: Number, enum: [58, 80], default: 80 },
      },
      datafono: {
        tipo: { type: String, enum: ['MANUAL', 'RED'], default: 'MANUAL' },
        host: { type: String, default: '', trim: true, maxlength: 60 },
        puerto: { type: Number, default: 9100, min: 1, max: 65535 },
        esperaSegundos: { type: Number, default: 60, min: 5, max: 180 },
      },
      cajon: {
        abrirAlCobrarEfectivo: { type: Boolean, default: true },
      },
      pantallaCliente: {
        mostrarQr: { type: Boolean, default: false },
        /* La cadena del QR de transferencia, con {monto} y {ref} donde vayan
           los valores. No se inventa ningún formato bancario: el negocio pega
           el suyo, que es el único que sus clientes pueden escanear. */
        plantillaQr: { type: String, default: '', trim: true, maxlength: 500 },
      },
    },

    /* La marca de agua de la configuración.

       La caja manda hasta cuándo bajó catálogo; si esta fecha es posterior, se
       le adjunta el bloque entero. Si no, no se manda nada: son unos cientos
       de bytes cada treinta segundos, por terminal, para decir que nada
       cambió. */
    actualizadoEn: { type: Date, default: Date.now },
  },
}, { timestamps: true });

posCajaSchema.index({ businessId: 1, revocada: 1 });

module.exports = mongoose.models.PosCaja || mongoose.model('PosCaja', posCajaSchema);
