/**
 * Un negocio es tienda cuando MenuBy lo marcó así desde el SuperAdmin
 * (`tipoTienda: 'ecommerce'`). El negocio no puede cambiarlo por su cuenta.
 *
 * El menú entero se lee de este interruptor: en tienda la foto es cuadrada, el
 * precio va bajo el nombre y el botón dice "Agregar"; en restaurante todo sigue
 * exactamente igual que siempre.
 */
export const esTienda = (businessConfig) => businessConfig?.tipoTienda === 'ecommerce';

/* Nadie "prepara" un perfume ni lo tiene "en cocina": lo empaca y lo despacha.
   Las claves son los estados que ya usa el pedido; lo que cambia es cómo se
   le cuentan al cliente y al negocio. */
const ESTADOS_TIENDA = {
  pending: { label: 'Pedido recibido', sub: 'Ya lo estamos revisando' },
  confirmed: { label: 'Confirmado', sub: 'Tu compra quedó confirmada' },
  preparing: { label: 'Alistando tu envío', sub: 'Estamos empacando tu compra' },
  inProgress: { label: 'Alistando tu envío', sub: 'Estamos empacando tu compra' },
  ready: { label: 'Listo para despachar', sub: 'Tu paquete está listo' },
  completed: { label: 'Entregado', sub: '¡Gracias por tu compra!' },
  delivered: { label: 'Entregado', sub: '¡Gracias por tu compra!' },
};

/** El estado contado en palabras de tienda; en restaurante devuelve el de siempre. */
export const estadoEnTienda = (estado, tienda) => (tienda ? ESTADOS_TIENDA[estado] || null : null);

/** El vocabulario cambia: nadie "pide" un perfume, lo compra. */
export const palabras = (tienda) => ({
  agregar: tienda ? 'Agregar' : 'Agregar',
  elegir: tienda ? 'Elegir opciones' : 'Personalizar',
  masPedidos: tienda ? 'Lo más vendido' : 'Los más pedidos',
  destacados: tienda ? 'Nuestra selección' : 'Selección del chef',
  favorito: tienda ? 'El más vendido' : 'El favorito de la casa',
  estaSemana: tienda ? 'vendidos esta semana' : 'pedidos esta semana',
  /* "En sitio" y "mesa" no existen en una tienda: o se envía, o se recoge. */
  llevar: tienda ? 'Recoger en tienda' : 'Llevar',
  domicilio: tienda ? 'Envío' : 'Domicilio',
});
