/**
 * Los pasos de un pedido, según cómo se pidió. Lo usan la pantalla de estado
 * y la tarjeta del pedido en curso del menú, para que digan lo mismo.
 *
 * Antes había una sola lista para todos, y "entregado" o "cancelado" no
 * estaban en ella: la barra de progreso quedaba en blanco justo al final.
 * Tampoco distinguía un domicilio ("en camino") de uno para recoger ("listo
 * para recoger") o de uno en la mesa.
 */

/* Qué tan avanzado va cada estado. "Listo" (ready) es "en camino" en un
   domicilio y "listo para recoger" en uno para llevar: el panel lo marca con
   su botón. "Completado" y "entregado" son el final. */
function nivelDe(status) {
  switch (status) {
    case 'pending_payment': return 0;
    case 'payment_uploaded': return 1;
    case 'payment_confirmed':
    case 'pending': return 2;
    case 'confirmed':
    case 'preparing':
    case 'inProgress': return 3;
    case 'ready': return 4;
    case 'completed': return 5;
    case 'delivered': return 5;
    default: return 2;
  }
}

export function pasosDelPedido({ status, orderType, orderChannel, statusHistory = [], tienda = false, hotel = false }) {
  const tipo = orderType || 'takeaway';
  const pasos = [];
  if (orderChannel === 'inapp') {
    pasos.push({ clave: 'pago', nombre: 'Pago', desc: 'Realiza el pago y sube el comprobante', nivel: 0 });
    pasos.push({ clave: 'verificando', nombre: 'Verificando pago', desc: 'El negocio revisa tu comprobante', nivel: 1 });
  }
  pasos.push({ clave: 'recibido', nombre: 'Pedido recibido', desc: 'El negocio ya tiene tu pedido', nivel: 2 });
  pasos.push({ clave: 'preparando', nombre: tienda ? 'Alistando tu pedido' : 'En preparación', desc: tienda ? 'Lo están empacando' : 'Están preparando tu pedido', nivel: 3 });
  if (tipo === 'delivery') pasos.push({ clave: 'camino', nombre: 'En camino', desc: 'Tu pedido va hacia ti', nivel: 4 });
  if (tipo === 'takeaway') pasos.push({ clave: 'listo', nombre: 'Listo para recoger', desc: 'Ya puedes pasar por él', nivel: 4 });
  pasos.push({
    clave: 'final',
    nombre: tipo === 'inSite' ? (hotel ? 'Entregado en tu habitación' : 'Servido') : 'Entregado',
    desc: '¡Buen provecho!',
    nivel: 5,
  });

  const cancelado = status === 'cancelled';
  const nivel = nivelDe(status);
  // El paso actual: el más avanzado que ya se alcanzó.
  let actual = 0;
  pasos.forEach((p, i) => { if (p.nivel <= nivel) actual = i; });

  // La hora en que se llegó a cada paso, del historial.
  const horaDe = (paso) => {
    const h = (statusHistory || []).find((e) => nivelDe(e.status) >= paso.nivel && e.status !== 'cancelled');
    return h?.timestamp || null;
  };

  return {
    cancelado,
    terminado: !cancelado && pasos[actual]?.clave === 'final',
    actual,
    pasos: pasos.map((p, i) => ({ ...p, hecho: !cancelado && i < actual, enCurso: !cancelado && i === actual, hora: i <= actual ? horaDe(p) : null })),
  };
}
