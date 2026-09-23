import api from '../services/api';

/**
 * Cobrar con tarjeta en el menú, con la pasarela de Bold.
 *
 * El script de Bold se carga **solo cuando hace falta**. El menú ya pesa
 * bastante y la inmensa mayoría de los pedidos se pagan en efectivo o por
 * transferencia: cargarle a todo el mundo una librería de pasarela para que
 * uno de cada diez la use es hacer más lento el caso común.
 *
 * Lo que este módulo NO hace, a propósito:
 *
 * - **No arma el monto.** Se lo pide al servidor, que lo saca del pedido en la
 *   base. La firma de integridad existe justamente para que el monto no se
 *   pueda alterar desde el navegador; calcularlo acá sería devolverle al
 *   cliente el control de lo que se le cobra.
 * - **No decide si el pago pasó.** Eso lo dice el webhook. El navegador puede
 *   cerrarse con el pago hecho, o quedarse en la pantalla de éxito sin que el
 *   cobro haya salido.
 */

const URL_SCRIPT = 'https://checkout.bold.co/library/boldPaymentButton.js';

/** Una sola carga aunque se toque el botón varias veces. */
let cargando = null;

/**
 * Trae el script de Bold y espera a que esté listo.
 *
 * Bold dispara `boldCheckoutLoaded` o `boldCheckoutLoadFailed` en `window`, y
 * se escuchan los dos: sin el de fallo, un cliente sin buena señal se queda
 * mirando un botón que no hace nada.
 */
export function cargarBold() {
  if (typeof window === 'undefined') return Promise.reject(new Error('sin navegador'));
  if (window.BoldCheckout) return Promise.resolve();
  if (cargando) return cargando;

  cargando = new Promise((listo, falló) => {
    const ya = document.querySelector(`script[src="${URL_SCRIPT}"]`);
    if (ya && window.BoldCheckout) return listo();

    const script = ya || document.createElement('script');
    script.src = URL_SCRIPT;
    script.async = true;
    script.onload = () => listo();
    script.onerror = () => {
      /* Se suelta la promesa cacheada: si el cliente recupera la señal y
         vuelve a tocar, se reintenta en vez de fallar para siempre. */
      cargando = null;
      falló(new Error('No se pudo cargar la pasarela de pagos'));
    };
    if (!ya) document.head.appendChild(script);
  });

  return cargando;
}

/**
 * Abre la pasarela para un pedido que ya existe.
 *
 * @param {object} opciones
 * @param {string} opciones.orderId  el pedido, ya creado y esperando pago
 * @param {object} [opciones.cliente] nombre, teléfono y correo, si se tienen
 * @returns {Promise<void>} se resuelve cuando la pasarela quedó abierta
 */
export async function cobrarConTarjeta({ orderId, cliente }) {
  /* El servidor devuelve monto y firma; acá no se calcula ninguno de los dos. */
  const { data } = await api.post('/bold/firma', { orderId });

  await cargarBold();

  const config = {
    orderId: data.referencia,
    currency: data.moneda,
    amount: data.monto,
    apiKey: data.identidad,
    integritySignature: data.firma,
    description: data.descripcion,
    /* Embebido: se abre encima del menú en vez de sacar al cliente del sitio.
       Un cliente al que se lo lleva a otra página en mitad de un pedido es un
       cliente que a veces no vuelve. */
    renderMode: 'embedded',
    redirectionUrl: `${window.location.origin}/pago-listo`,
  };

  /* Los datos que ya dio al armar el pedido, para que no los escriba otra vez
     en la pasarela. Bold los espera como JSON en un string. */
  const datos = {};
  if (cliente?.nombre) datos.fullName = cliente.nombre;
  if (cliente?.correo) datos.email = cliente.correo;
  if (cliente?.telefono) {
    datos.phone = String(cliente.telefono).replace(/\D/g, '').slice(-10);
    datos.dialCode = '+57';
  }
  if (Object.keys(datos).length) config.customerData = JSON.stringify(datos);

  new window.BoldCheckout(config).open();
}
