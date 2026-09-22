/**
 * Enlaces de WhatsApp que funcionan también en el computador.
 *
 * El fallo que esto cierra: los enlaces `wa.me` se armaban con el número tal
 * como estaba guardado —`3154087774`, sin indicativo— y en el celular
 * funcionaban, porque la aplicación asume el país del teléfono. En WhatsApp Web
 * no hay país que asumir, así que **lo adivina**: un número colombiano de diez
 * dígitos lo leía como belga y respondía "el número +32 15 40 87 74 no está en
 * WhatsApp".
 *
 * No fallaba siempre ni para todos, que es lo que lo hizo durar: quien probaba
 * desde el celular lo veía bien.
 *
 * La corrección estaba copiada en cuatro pantallas y faltaba en otras ocho. Por
 * eso vive aquí: un enlace de WhatsApp roto no da error, solo no llega, y el
 * negocio se entera cuando el cliente ya se cansó de esperar.
 */

/** Colombia, que es de donde son casi todos los negocios que usan esto. */
const INDICATIVO_POR_DEFECTO = '57';

/**
 * Cuántos dígitos tiene un número sin indicativo.
 *
 * Diez sirve para Colombia y para Estados Unidos, que son los dos países que
 * hay hoy en la base. Si algún día entra uno donde no se cumpla, este es el
 * número que hay que mover.
 */
const LARGO_NACIONAL = 10;

/**
 * El número listo para `wa.me`: solo dígitos y con indicativo.
 *
 * Devuelve cadena vacía cuando lo que llega no puede ser un teléfono, para que
 * quien llama pueda esconder el botón en vez de ofrecer un enlace que lleva a
 * un error.
 *
 * @param {string} telefono como lo escribió quien lo guardó
 * @param {string} [indicativo] el del negocio (`businessConfig.phoneCountryCode`),
 *   con o sin `+`. Sin él se asume Colombia.
 * @returns {string} dígitos con indicativo, o '' si no sirve
 */
export function numeroWhatsApp(telefono, indicativo) {
  const pais = String(indicativo || '').replace(/\D/g, '') || INDICATIVO_POR_DEFECTO;
  let digitos = String(telefono || '').replace(/\D/g, '');
  if (!digitos) return '';

  /* El prefijo internacional que la gente marca desde un fijo. `00573...` y
     `573...` son el mismo número. */
  if (digitos.startsWith('00')) digitos = digitos.slice(2);

  /* Ya viene con indicativo. Se compara también el largo porque un móvil
     colombiano son diez dígitos y ninguno empieza por 57: sin esa segunda
     condición, un número de otro país que empiece por 57 se daría por
     colombiano y se dejaría corto. */
  if (digitos.startsWith(pais) && digitos.length === pais.length + LARGO_NACIONAL) {
    return digitos;
  }

  if (digitos.length === LARGO_NACIONAL) {
    return pais + digitos;
  }

  /* Cualquier otro largo se deja como está: puede ser un número de otro país
     ya completo. Inventarle un indicativo sería justo el error que este módulo
     existe para evitar, solo que al revés.

     Lo que sí se descarta es lo que no alcanza a ser un teléfono. Siete dígitos
     era un fijo de Bogotá antes de 2022; hoy no marca a ningún lado. */
  return digitos.length >= 8 ? digitos : '';
}

/**
 * El enlace completo, con mensaje si se quiere.
 *
 * Devuelve cadena vacía cuando el número no sirve, por lo mismo que arriba.
 *
 * @param {string} telefono
 * @param {string} [mensaje] texto **sin codificar**: de eso se encarga esta función
 * @param {string} [indicativo] el del negocio; sin él se asume Colombia
 */
export function enlaceWhatsApp(telefono, mensaje, indicativo) {
  const numero = numeroWhatsApp(telefono, indicativo);
  if (!numero) return '';

  const base = `https://wa.me/${numero}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}
