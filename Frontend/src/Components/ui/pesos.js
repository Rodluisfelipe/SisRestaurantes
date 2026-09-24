/** Pesos colombianos sin decimales: "$25.500". La única forma de escribir plata. */
export function formatearPesos(n) {
  return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
}
