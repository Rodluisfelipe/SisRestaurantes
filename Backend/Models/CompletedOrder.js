const mongoose = require("mongoose");

/**
 * Model for completed orders in the restaurant system
 * 
 * This model stores orders that have been completed.
 * It has the same structure as the Order model but with additional
 * fields for reporting and analytics.
 */
const completedOrderSchema = new mongoose.Schema({
  // Business reference
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessConfig',
    required: true
  },
  
  // Order identification
  orderNumber: {
    type: String,
    required: true,
    trim: true
  },
  
  // Customer information
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  
  // Order details
  orderType: {
    type: String,
    enum: ['inSite', 'takeaway', 'delivery'],
    required: true
  },
  status: {
    type: String,
    default: 'completed'
  },
  
  // In-app ordering fields (for analytics breakdowns)
  orderChannel: {
    type: String,
    enum: ['whatsapp', 'inapp', 'pos', 'admin'],
    default: 'whatsapp'
  },
  /* De donde llego el cliente: el valor de ?source= del enlace con el que
     entro al menu. `orderChannel` dice COMO se tomo el pedido; esto dice de
     que campana o canal vino, que es lo que permite saber si el link de
     Instagram o el QR de la mesa estan sirviendo de algo. Texto libre porque
     cada negocio inventa sus campanas. */
  source: {
    type: String,
    trim: true,
    maxlength: 40,
    default: null,
    index: true
  },

  paymentMethod: {
    type: String,
    enum: ['cash', 'efectivo', 'nequi', 'daviplata', 'transfer', 'transferencia', 'other'],
    default: null
  },
  
  // Table information (for in-site orders)
  tableNumber: {
    type: String,
    trim: true,
    default: ''
  },
  
  // Delivery information
  address: {
    type: String,
    trim: true,
    default: ''
  },
  
  // Order items
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      default: 1
    },
    /* Qué talla o fragancia se vendió. Sin esto, al archivar el pedido se
       perdía la variante y una devolución no sabía qué devolver a bodega. */
    variante: {
      valores: [{ type: String, trim: true, maxlength: 40 }],
      sku: { type: String, trim: true, maxlength: 40, default: '' }
    },
    /* Cómo lo pidió el cliente: "sin cebolla", "término tres cuartos". Llega
       de la caja nativa y se guarda porque una devolución de "lo pedí sin
       cebolla y vino con cebolla" se resuelve mirando esta línea. */
    nota: { type: String, trim: true, maxlength: 120, default: '' },
    selectedToppings: [{
      groupName: String,
      optionName: String,
      price: Number,
      basePrice: Number,
      subGroups: [{
        subGroupTitle: String,
        optionName: String,
        price: Number
      }]
    }]
  }],
  
  /* El voucher del datáfono, en las ventas con tarjeta de la caja nativa.
     Guardarlo aquí y no en un modelo aparte es a propósito: quien concilia
     mira la venta, no una tabla de pagos. */
  posPago: {
    autorizacion: { type: String, default: '', trim: true, maxlength: 20 },
    ultimosCuatro: { type: String, default: '', trim: true, maxlength: 4 },
    franquicia: { type: String, default: '', trim: true, maxlength: 30 }
  },

  /* Con qué se pagó, cuando fue con más de un medio: "treinta mil en efectivo
     y el resto con tarjeta".

     Va aquí y no en `paymentMethod` porque ese campo es uno solo y con pago
     mixto solo puede decir "mixto". El cuadre de caja del negocio —cuánto
     entró en billetes contra cuánto por datáfono— sale de este desglose, no
     del resumen. Vacío en las ventas de un solo medio. */
  posPagos: [{
    metodo: { type: String, trim: true, maxlength: 30 },
    monto: { type: Number, min: 0 },
    referencia: { type: String, trim: true, maxlength: 40, default: '' }
  }],

  /* Por qué se descontó. `discountAmount` ya decía cuánto y nunca por qué, y
     un descuento sin motivo es indistinguible de un precio mal puesto cuando
     el dueño revisa el mes. */
  discountReason: { type: String, trim: true, maxlength: 120, default: '' },

  /* La propina de las ventas de caja.

     `tipAmount` ya existía para los pedidos del menú y significa lo mismo, así
     que se reutiliza: los informes del negocio suman las dos cosas sin tener
     que saber de dónde vino la venta. */

  /* Id que generó la caja nativa (UUIDv7) para esta venta.
     Es la llave de idempotencia: el POS reintenta hasta que confirmemos, y sin
     esto cada reintento crearía otra venta. `sparse` porque solo existe en las
     ventas de caja; el resto de pedidos no lo tienen. */
  posSaleId: {
    type: String,
    default: undefined,
    trim: true,
    maxlength: 64
  },

  /* Con qué transportadora y guía salió, si fue envío nacional. Se archiva
     con el pedido: es lo que el cliente pregunta meses después. */
  envio: {
    transportadora: { type: String, trim: true, maxlength: 40, default: '' },
    guia: { type: String, trim: true, maxlength: 60, default: '' },
    urlRastreo: { type: String, trim: true, maxlength: 400, default: '' },
    despachadoAt: { type: Date, default: null }
  },

  // Order totals
  totalAmount: {
    type: Number,
    required: true
  },
  finalAmount: {
    type: Number,
    default: null
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  /* La propina va incluida en finalAmount pero no se estaba copiando al
     completar el pedido, así que en el historial el desglose no cuadraba con
     el total y no había forma de saber cuánto se repartió al personal. */
  tipAmount: {
    type: Number,
    default: 0
  },
  couponCode: {
    type: String,
    trim: true,
    default: null
  },
  deliveryFee: {
    type: Number,
    default: 0
  },
  deliveryZoneName: {
    type: String,
    trim: true,
    default: ''
  },
  posPaymentInfo: {
    cashReceived: { type: Number, default: null },
    change: { type: Number, default: null },
  },
  
  // Delivery person / domiciliario fields
  deliveryMode: {
    type: String,
    enum: ['qr', 'fixed', 'profile'],
    default: null
  },
  deliveryPersonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryPerson',
    default: null
  },
  confirmationAttempts: {
    type: Number,
    default: 0
  },
  deliveryAssignedAt: {
    type: Date,
    default: null
  },
  deliveryPickedAt: {
    type: Date,
    default: null
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  
  // Booking / appointment fields
  isBooking: {
    type: Boolean,
    default: false
  },
  bookingDate: {
    type: Date,
    default: null
  },
  bookingEndDate: {
    type: Date,
    default: null
  },
  bookingStatus: {
    type: String,
    default: null
  },

  // Timestamps
  createdAt: {
    type: Date,
    required: true
  },
  completedAt: {
    type: Date,
    default: Date.now
  },
  
  // Additional fields for reporting
  reportDate: {
    type: Date,
    default: function() {
      // Start of day in Colombia timezone (UTC-5)
      const { startOfDayCOL } = require('../utils/timezone');
      return startOfDayCOL();
    }
  },
  
  // Flag to indicate if this order has been included in a report
  includedInReport: {
    type: Boolean,
    default: false
  }
});

// Indexes for faster queries
completedOrderSchema.index({ businessId: 1, completedAt: -1 });
completedOrderSchema.index({ businessId: 1, reportDate: 1 });
completedOrderSchema.index({ businessId: 1, includedInReport: 1 });

/* Único y disperso: dos reintentos simultáneos de la misma venta chocan aquí
   y solo uno entra. Es la red de seguridad de la idempotencia; sin el índice,
   la comprobación previa tiene una ventana de carrera. */
completedOrderSchema.index(
  { businessId: 1, posSaleId: 1 },
  { unique: true, partialFilterExpression: { posSaleId: { $type: "string" } } }
);

module.exports = mongoose.models.CompletedOrder || mongoose.model("CompletedOrder", completedOrderSchema); 