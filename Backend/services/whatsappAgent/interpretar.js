/**
 * Lo ÚNICO que hace el modelo: entender qué dijo el cliente.
 *
 * No decide nada. No elige si mandar el menú, ni si agregar, ni qué preguntar
 * después. Solo traduce un mensaje en español a datos. Todo lo demás lo decide
 * el código en conversacion.js.
 *
 * Esa separación es la respuesta a los cuatro bucles que ya nos costaron una
 * tarde: mientras el modelo manejaba el flujo, se saltaba pasos, olvidaba lo
 * que el cliente ya había dicho y repetía la misma pregunta. Un modelo es
 * bueno entendiendo lenguaje y malo llevando la cuenta de en qué punto va una
 * conversación; el código es exactamente al revés.
 *
 * Además puede extraer VARIAS cosas de un mismo mensaje. Antes solo cabía una
 * acción por turno, así que "Felipe, Cra 6 # 3 139" perdía uno de los dos.
 */
const logger = require('../../utils/logger');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODELOS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

/** Forma vacía: si el modelo falla, el código sigue con esto y no se rompe. */
const NADA = {
  productos: [], quitar: [], tipo: null, nombre: null, direccion: null,
  confirma: null, quiereMenu: false, quiereHumano: false,
  preguntaEstado: false, preguntaCarta: false, otraPregunta: null,
};

function instrucciones(nombresDeProductos) {
  return `Tu único trabajo es entender EL ÚLTIMO MENSAJE del cliente de un restaurante y devolverlo como datos.
NO respondes al cliente. NO decides qué hacer. Solo extraes.

LO MÁS IMPORTANTE: extraes ÚNICAMENTE de "MENSAJE A INTERPRETAR".
Lo demás es contexto para entender a qué se refiere ("sí", "esa", "la otra"), NO es algo que pedir otra vez.
Si el mensaje a interpretar no nombra ningún producto, "productos" va VACÍO — aunque el cliente haya pedido algo antes.
Un cliente que responde "a domicilio" o dice su dirección NO está pidiendo comida.
Solo pon algo en "productos" si en ESE mensaje está pidiendo algo NUEVO o MÁS de algo.

PRODUCTOS QUE EXISTEN (usa el nombre tal cual aparece acá, o el más parecido):
${nombresDeProductos.join('\n')}

Devuelves SOLO este JSON:
{
  "productos": [{"nombre":"...","cantidad":1,"nota":"sin cebolla"}],
  "quitar": ["nombre del producto"],
  "tipo": "domicilio" | "recoger" | "mesa" | null,
  "nombre": "nombre de la persona" | null,
  "direccion": "dirección de entrega" | null,
  "confirma": true | false | null,
  "quiereMenu": true | false,
  "quiereHumano": true | false,
  "preguntaEstado": true | false,
  "preguntaCarta": true | false,
  "otraPregunta": "lo que preguntó, si no es nada de lo anterior" | null
}

CÓMO DECIDIR CADA CAMPO:
- "productos": lo que quiere pedir. Si dice "una hamburguesa sencilla sin salsas" → [{"nombre":"Hamburguesa","cantidad":1,"nota":"sin salsas"}]. Vacío si no menciona ninguno.
- "quitar": lo que pide sacar del pedido.
- "tipo": solo si lo dice. "a domicilio" → domicilio. "paso por él" → recoger. "acá en la mesa" → mesa.
- "nombre" y "direccion": si los da, aunque sea en el mismo mensaje y sin etiquetas. "Felipe, Cra 6 # 3 139" → nombre "Felipe", direccion "Cra 6 # 3 139".
- "confirma": true si está diciendo que sí a algo ("sí", "dale", "correcto", "listo"). false si dice que no. null si no responde sí ni no.
- "quiereMenu": true si pide ver el menú o el link.
- "preguntaCarta": true si pregunta qué tienen o qué hay, sin pedir el link.
- "preguntaEstado": true si pregunta por un pedido que ya hizo.
- "quiereHumano": true si pide hablar con una persona.
- "otraPregunta": horarios, ubicación, promociones, reclamos, o cualquier cosa que no sea pedir. Si no hay, null.

Extrae TODO lo que haya en el mensaje. Un mensaje puede traer producto y dirección a la vez.
Si el cliente dice "no" a una pregunta tuya anterior, eso es "confirma": false, no "quiereMenu".`;
}

/** Convierte lo que devuelva el modelo a la forma que espera el código. */
function normalizar(bruto) {
  const texto = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null);
  const bool = (v) => v === true;

  return {
    productos: Array.isArray(bruto?.productos)
      ? bruto.productos
        .filter((p) => p && texto(p.nombre))
        .slice(0, 10)
        .map((p) => ({
          nombre: texto(p.nombre),
          cantidad: Math.max(1, Math.min(50, Number(p.cantidad) || 1)),
          nota: texto(p.nota) || '',
        }))
      : [],
    quitar: Array.isArray(bruto?.quitar)
      ? bruto.quitar.map(texto).filter(Boolean).slice(0, 10)
      : [],
    tipo: ['domicilio', 'recoger', 'mesa'].includes(bruto?.tipo) ? bruto.tipo : null,
    nombre: texto(bruto?.nombre),
    direccion: texto(bruto?.direccion),
    confirma: bruto?.confirma === true ? true : (bruto?.confirma === false ? false : null),
    quiereMenu: bool(bruto?.quiereMenu),
    quiereHumano: bool(bruto?.quiereHumano),
    preguntaEstado: bool(bruto?.preguntaEstado),
    preguntaCarta: bool(bruto?.preguntaCarta),
    otraPregunta: texto(bruto?.otraPregunta),
  };
}

/**
 * @returns {Promise<object>} lo entendido, o null si el modelo no respondió.
 */
async function interpretar({ texto, historial, catalogo, pedidoActual }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Falta GROQ_API_KEY');

  const nombres = catalogo.slice(0, 80).map((p) => `- ${p.name}`);

  /* Todo va en UN mensaje, con el texto a interpretar marcado aparte.
     Antes se mandaba como una conversación normal y el modelo extraía de todo
     el hilo: el cliente decía "a domicilio" y volvía a reportar la hamburguesa
     que había pedido tres mensajes atrás, así que el pedido se multiplicaba
     solo. También se le muestra lo que YA está en el pedido, para que sepa que
     no hace falta volver a pedirlo. */
  const contexto = (historial || [])
    .map((m) => `${m.role === 'user' ? 'cliente' : 'negocio'}: ${m.content}`)
    .join('\n')
    .slice(-1500);

  const entrada = [
    contexto ? `CONVERSACIÓN PREVIA (solo contexto, NO extraigas de acá):\n${contexto}` : '',
    pedidoActual ? `YA ESTÁ EN EL PEDIDO (no lo repitas):\n${pedidoActual}` : '',
    `MENSAJE A INTERPRETAR (extrae SOLO de acá):\n"${texto}"`,
  ].filter(Boolean).join('\n\n');

  const mensajes = [
    { role: 'system', content: instrucciones(nombres) },
    { role: 'user', content: entrada },
  ];

  let ultimoError;
  for (const model of MODELOS) {
    try {
      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: mensajes,
          max_tokens: 500,
          /* Temperatura baja: acá no se busca creatividad, se busca que
             entienda siempre igual lo mismo. */
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });

      if ([400, 404, 429].includes(res.status)) { ultimoError = new Error(`Groq ${res.status}`); continue; }
      if (!res.ok) throw new Error(`Groq ${res.status}`);

      const data = await res.json();
      const bruto = (data.choices?.[0]?.message?.content || '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      return normalizar(JSON.parse(bruto));
    } catch (e) {
      ultimoError = e;
    }
  }

  logger.error('[Agente] No se pudo interpretar el mensaje', { error: ultimoError?.message });
  return null;
}

module.exports = { interpretar, normalizar, NADA };
