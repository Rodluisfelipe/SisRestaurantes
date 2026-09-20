/**
 * Un negocio es tienda cuando MenuBy lo marcó así desde el SuperAdmin
 * (`tipoTienda: 'ecommerce'`). El negocio no puede cambiarlo por su cuenta.
 *
 * El menú entero se lee de este interruptor: en tienda la foto es cuadrada, el
 * precio va bajo el nombre y el botón dice "Agregar"; en restaurante todo sigue
 * exactamente igual que siempre.
 */
export const esTienda = (businessConfig) => businessConfig?.tipoTienda === 'ecommerce';

/** El vocabulario cambia: nadie "pide" un perfume, lo compra. */
export const palabras = (tienda) => ({
  agregar: tienda ? 'Agregar' : 'Agregar',
  elegir: tienda ? 'Elegir opciones' : 'Personalizar',
  masPedidos: tienda ? 'Lo más vendido' : 'Los más pedidos',
  destacados: tienda ? 'Nuestra selección' : 'Selección del chef',
  favorito: tienda ? 'El más vendido' : 'El favorito de la casa',
  estaSemana: tienda ? 'vendidos esta semana' : 'pedidos esta semana',
});
