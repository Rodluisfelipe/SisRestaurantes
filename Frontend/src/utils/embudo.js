/**
 * El paso del pedido al que llegó el cliente (ver Backend/utils/embudoPedido):
 * 1 abrió el carrito, 2 fue a finalizar, 3 eligió cómo recibirlo, 4 puso
 * dirección o mesa, 5 eligió cómo pagar. El 6 (pidió) lo marca el servidor.
 *
 * Solo avisa; el menú lo manda en el latido que ya envía por socket.
 */
export const ETAPA = { CARRITO: 1, FINALIZAR: 2, TIPO: 3, DIRECCION: 4, PAGO: 5 };

export function marcarEtapa(etapa) {
  try { window.dispatchEvent(new CustomEvent('mb:etapa', { detail: { etapa } })); } catch { /* nada */ }
}
