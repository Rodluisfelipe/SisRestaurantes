/**
 * Las horas de un pedido: cuándo pasó cada cosa.
 *
 * Un pedido tiene `createdAt` y `completedAt`, y entre esos dos extremos no se
 * sabe nada. Cuando un cliente reclama que esperó cuarenta minutos, el negocio
 * no puede responder si la demora fue de la cocina, del domiciliario o del
 * cajero que no pasó la comanda.
 *
 * Cada marca es el instante en que el pedido cambió de manos. Los tiempos
 * —espera en cocina, minutos en la calle— se calculan restando; no se guardan,
 * porque un dato derivado que se guarda termina contradiciendo al original.
 *
 * Todas son opcionales a propósito. Un pedido de mostrador que se cobra y se
 * entrega en el acto no tiene "salió a domicilio", y forzar la marca obligaría
 * a inventarse una hora.
 *
 * Se comparte entre `Order` y `CompletedOrder` porque un pedido vivo y el mismo
 * pedido archivado tienen que medirse igual. Si cada modelo llevara su propia
 * copia, la primera vez que alguien agregue una marca a uno solo, los informes
 * empiezan a mentir en la mitad de los casos y nadie se entera.
 */
const marcasTiempo = {
  /** El negocio vio el pedido. Hasta aquí, el cliente está esperando respuesta. */
  aceptado: { type: Date, default: null },

  /** La comanda salió hacia la cocina. */
  comandado: { type: Date, default: null },

  /** La cocina empezó a prepararlo. */
  enPreparacion: { type: Date, default: null },

  /** Está listo en la barra. A partir de aquí la comida se enfría. */
  listo: { type: Date, default: null },

  /** Salió a domicilio. Vacío en mostrador y para llevar. */
  despachado: { type: Date, default: null },

  /** En manos del cliente. */
  entregado: { type: Date, default: null },

  /* Cuánto tardó el cajero en armar el ticket, en segundos.
   *
   * Lo mide la terminal —desde el primer producto hasta el cobro— porque es lo
   * único que el servidor no puede deducir: la venta llega ya cerrada y, si se
   * hizo sin internet, llega horas después.
   *
   * Sirve para lo que un dueño pregunta y hoy nadie sabe responder: si la fila
   * del mediodía es por la cocina o porque el cajero tarda dos minutos en
   * encontrar los productos. Lo segundo se arregla reordenando el menú. */
  duracionTomaSegundos: { type: Number, default: 0, min: 0 },
};

module.exports = { marcasTiempo };
