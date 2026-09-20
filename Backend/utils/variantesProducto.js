/**
 * Variantes de un producto, para los negocios en modo tienda (ecommerce).
 *
 * El negocio define sus propios ejes —"Talla", "Fragancia", "Color",
 * "Material"…— y MenuBy arma una variante por cada combinación. Así sirve
 * igual para una camiseta (Talla × Color) que para un perfume (Fragancia ×
 * Tamaño), sin que el código sepa nada del rubro.
 *
 * Reglas que sostienen todo lo demás:
 *   - Los valores de una variante van en el MISMO orden que las opciones, así
 *     renombrar un eje no rompe las variantes ya guardadas.
 *   - Precio y costo vacíos significan "el del producto": una talla que cuesta
 *     lo mismo no obliga a repetir el precio en cada fila.
 *   - Un producto sin opciones se comporta como siempre: un precio y un stock.
 */

const MAX_OPCIONES = 3;
const MAX_VALORES = 30;
const MAX_VARIANTES = 100;
const MAX_TEXTO = 40;

const texto = (valor, limite = MAX_TEXTO) =>
  (typeof valor === 'string' ? valor : '').trim().slice(0, limite);

const clave = (valores) => valores.map((v) => v.toLowerCase()).join(' / ');

/** Número >= 0, o null si viene vacío (hereda el valor del producto). */
function numeroOpcional(valor) {
  if (valor === '' || valor === null || valor === undefined) return null;
  const n = typeof valor === 'string' ? parseFloat(valor.replace(/\./g, '')) : Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function entero(valor) {
  const n = typeof valor === 'string' ? parseInt(valor, 10) : Number(valor);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/**
 * Ejes del producto: nombre y valores, sin repetidos ni vacíos.
 * Ejemplo: [{ nombre: 'Talla', valores: ['S', 'M', 'L'] }]
 */
function normalizarOpciones(opciones) {
  const lista = Array.isArray(opciones) ? opciones : [];
  const limpias = [];

  for (const opcion of lista.slice(0, MAX_OPCIONES)) {
    const nombre = texto(opcion && opcion.nombre);
    if (!nombre) continue;
    // Dos ejes con el mismo nombre volverían ambiguo el selector del cliente.
    if (limpias.some((o) => o.nombre.toLowerCase() === nombre.toLowerCase())) continue;

    const valores = [];
    for (const bruto of Array.isArray(opcion && opcion.valores) ? opcion.valores : []) {
      const valor = texto(bruto);
      if (!valor) continue;
      if (valores.some((v) => v.toLowerCase() === valor.toLowerCase())) continue;
      valores.push(valor);
      if (valores.length >= MAX_VALORES) break;
    }

    if (valores.length) limpias.push({ nombre, valores });
  }

  return limpias;
}

/** Todas las combinaciones posibles, en el orden en que se muestran. */
function combinaciones(opciones) {
  return normalizarOpciones(opciones).reduce(
    (acumulado, opcion) => acumulado.flatMap((previa) => opcion.valores.map((valor) => [...previa, valor])),
    [[]]
  );
}

/**
 * Deja solo las variantes que corresponden a las opciones actuales: si el
 * negocio borra el color "rojo", sus variantes dejan de existir en vez de
 * quedar como filas fantasma que el cliente podría llegar a pedir.
 */
function normalizarVariantes(variantes, opciones) {
  const ejes = normalizarOpciones(opciones);
  if (!ejes.length) return [];

  const permitidos = ejes.map((o) => o.valores.map((v) => v.toLowerCase()));
  const lista = Array.isArray(variantes) ? variantes : [];
  const limpias = [];
  const vistas = new Set();

  for (const variante of lista) {
    const valores = Array.isArray(variante && variante.valores)
      ? variante.valores.map((v) => texto(v))
      : [];
    if (valores.length !== ejes.length) continue;
    if (!valores.every((valor, i) => valor && permitidos[i].includes(valor.toLowerCase()))) continue;

    const combinacion = clave(valores);
    if (vistas.has(combinacion)) continue;
    vistas.add(combinacion);

    limpias.push({
      valores,
      sku: texto(variante.sku),
      precio: numeroOpcional(variante.precio),
      costo: numeroOpcional(variante.costo),
      stock: entero(variante.stock),
      imagen: typeof variante.imagen === 'string' ? variante.imagen.trim() : '',
      activo: variante.activo !== false,
    });

    if (limpias.length >= MAX_VARIANTES) break;
  }

  return limpias;
}

/** Lo que el cliente puede comprar de verdad: activas y con stock. */
function stockTotal(variantes) {
  return (Array.isArray(variantes) ? variantes : [])
    .filter((v) => v && v.activo !== false)
    .reduce((suma, v) => suma + entero(v.stock), 0);
}

/** Precio desde el que arranca el producto, para mostrar "desde $X". */
function precioDesde(variantes, precioProducto) {
  const precios = (Array.isArray(variantes) ? variantes : [])
    .filter((v) => v && v.activo !== false)
    .map((v) => (v.precio === null || v.precio === undefined ? precioProducto : v.precio))
    .filter((p) => typeof p === 'number' && Number.isFinite(p));
  return precios.length ? Math.min(...precios) : precioProducto;
}

module.exports = {
  MAX_OPCIONES,
  MAX_VALORES,
  MAX_VARIANTES,
  normalizarOpciones,
  normalizarVariantes,
  combinaciones,
  stockTotal,
  precioDesde,
};
