/**
 * Con qué billetes es probable que pague el cliente.
 *
 * Para cobrar en efectivo desde el ticket con un solo toque, sin abrir la
 * pantalla de cobro. Un total de $27.000 se paga con $30.000, $50.000 o
 * $100.000: son los redondeos hacia arriba a los billetes que circulan. El
 * exacto va aparte, siempre primero.
 *
 * Como mucho `cuantos`, de menor a mayor y sin repetir ni igualar el total
 * (pagar exacto ya tiene su botón).
 */
export function billetesProbables(total: number, cuantos = 3): number[] {
  if (total <= 0) return [];
  const saltos = [5_000, 10_000, 20_000, 50_000, 100_000];
  const salida = new Set<number>();
  for (const s of saltos) {
    const redondo = Math.ceil(total / s) * s;
    if (redondo > total) salida.add(redondo);
  }
  return [...salida].sort((a, b) => a - b).slice(0, cuantos);
}
