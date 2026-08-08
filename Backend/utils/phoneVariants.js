/**
 * Un mismo teléfono está guardado de varias formas distintas en la base, y hay
 * que poder reconocerlo en todas.
 *
 * Lo que hay hoy en producción:
 *   customers       → mezclado: "(310) 645-3205" y "3105657653"
 *   orders          → plano de 10 dígitos: "3155295353"
 *   completedorders → plano de 10 dígitos
 *   WhatsApp        → internacional: "573138178003"
 *
 * Ninguno coincide con otro tal cual. Sin esto, enlazar un chat con los pedidos
 * de ese cliente no encontraría nunca nada, y el fallo sería mudo: la pantalla
 * diría "cliente nuevo" para alguien que lleva treinta pedidos.
 *
 * Se generan las variantes en vez de normalizar la base porque las consultas
 * siguen usando el índice { businessId, phone }; una búsqueda que limpie el
 * campo al vuelo obliga a recorrer la colección entera.
 */

/** Deja solo los dígitos. */
function soloDigitos(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/**
 * Los 10 dígitos nacionales, quitando indicativo de país o el cero inicial.
 * Devuelve null si no parece un celular colombiano.
 */
function nacional(phone) {
  const d = soloDigitos(phone);
  if (/^57\d{10}$/.test(d)) return d.slice(2);
  if (/^0\d{10}$/.test(d)) return d.slice(1);
  if (/^\d{10}$/.test(d)) return d;
  return null;
}

/**
 * Todas las formas en que ese número puede estar escrito en la base.
 * Pensado para usarse con `{ phone: { $in: variantesDeTelefono(x) } }`.
 */
function variantesDeTelefono(phone) {
  const n = nacional(phone);
  if (!n) {
    // No se reconoce el formato: al menos se busca tal cual vino.
    const crudo = String(phone || '').trim();
    return crudo ? [crudo] : [];
  }

  const a = n.slice(0, 3);
  const b = n.slice(3, 6);
  const c = n.slice(6);

  return [...new Set([
    n,                       // 3138178003
    `57${n}`,                // 573138178003
    `+57${n}`,               // +573138178003
    `(${a}) ${b}-${c}`,      // (313) 817-8003
    `${a} ${b} ${c}`,        // 313 817 8003
    `${a}-${b}-${c}`,        // 313-817-8003
    `+57 ${a} ${b} ${c}`,
  ])];
}

/** Para mostrar: "313 817 8003". */
function telefonoLegible(phone) {
  const n = nacional(phone);
  if (!n) return String(phone || '');
  return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
}

/** ¿Son el mismo número, escritos como sea? */
function mismoTelefono(a, b) {
  const na = nacional(a);
  const nb = nacional(b);
  if (na && nb) return na === nb;
  return soloDigitos(a) === soloDigitos(b) && soloDigitos(a) !== '';
}

module.exports = { soloDigitos, nacional, variantesDeTelefono, telefonoLegible, mismoTelefono };
