/**
 * El embudo del pedido en el menú: de todas las visitas, cuántas llegaron a
 * cada paso. Sirve para ver dónde se caen los pedidos (y, sobre todo, en qué
 * paso la gente se va a escribir por WhatsApp).
 *
 * `conteos` viene de agrupar ViewerSession por `etapa` (el máximo alcanzado):
 * [{ _id: 0, n: 120 }, { _id: 1, n: 40 }, …]. Quien llegó a la 4 también pasó
 * por la 1, 2 y 3, así que cada paso suma las visitas de su etapa y las de
 * todas las siguientes.
 */
const PASOS = [
  { etapa: 0, clave: 'menu', nombre: 'Vieron el menú' },
  { etapa: 1, clave: 'carrito', nombre: 'Abrieron el carrito' },
  { etapa: 2, clave: 'finalizar', nombre: 'Fueron a finalizar' },
  { etapa: 3, clave: 'tipo', nombre: 'Eligieron cómo recibirlo' },
  { etapa: 4, clave: 'direccion', nombre: 'Pusieron dirección o mesa' },
  { etapa: 5, clave: 'pago', nombre: 'Eligieron cómo pagar' },
  { etapa: 6, clave: 'pidieron', nombre: 'Pidieron' },
];

function armarEmbudo(conteos) {
  const porEtapa = new Map((conteos || []).map((c) => [Number(c._id) || 0, Number(c.n) || 0]));
  const total = [...porEtapa.values()].reduce((a, b) => a + b, 0);
  let anterior = null;
  return PASOS.map((p) => {
    let llegaron = 0;
    for (const [etapa, n] of porEtapa) if (etapa >= p.etapa) llegaron += n;
    const paso = {
      ...p,
      llegaron,
      deTodos: total ? Math.round((llegaron / total) * 1000) / 10 : 0,
      // Cuántos de los que llegaron al paso anterior se perdieron aquí.
      seCayeron: anterior === null ? 0 : anterior - llegaron,
      pctCaida: anterior ? Math.round(((anterior - llegaron) / anterior) * 1000) / 10 : 0,
    };
    anterior = llegaron;
    return paso;
  });
}

module.exports = { PASOS, armarEmbudo };
