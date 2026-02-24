const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

// Rate limiter: 30 AI tool calls per 10 minutes per user
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { message: 'Demasiadas solicitudes de IA. Espera unos minutos.' }
});

// Groq API
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
// For AI tools (structured output), prefer non-reasoning models first.
// openai/gpt-oss-120b uses reasoning tokens that consume max_tokens budget,
// often leaving content empty. Use it as last resort with higher max_tokens.
const GROQ_TOOLS_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b'];

async function callGroq(apiKey, systemPrompt, userMessage, opts = {}) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];

  const baseMaxTokens = opts.maxTokens || 400;
  let lastError;

  for (const model of GROQ_TOOLS_MODELS) {
    try {
      // Reasoning models need much higher max_tokens (reasoning consumes most of them)
      const isReasoningModel = model.includes('gpt-oss');
      const maxTokens = isReasoningModel ? Math.max(baseMaxTokens * 4, 2000) : baseMaxTokens;

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature: opts.temperature || 0.8
        })
      });

      // Retry on rate limit or model unavailable/decommissioned
      if (response.status === 429 || response.status === 400 || response.status === 404) {
        const errBody = await response.text();
        logger.warn(`Groq model ${model} failed (${response.status}), trying next...`, errBody.slice(0, 200));
        lastError = new Error(`Groq ${response.status}: ${errBody}`);
        continue;
      }

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Groq API error ${response.status}: ${errBody}`);
      }

      const data = await response.json();
      let content = data.choices[0].message.content || '';
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

      // If reasoning model returned empty content (all tokens used for reasoning), try next model
      if (!content && data.choices[0].finish_reason === 'length') {
        logger.warn(`Groq model ${model} returned empty content (finish_reason: length), trying next...`);
        lastError = new Error(`Empty content from ${model}`);
        continue;
      }

      return content;
    } catch (err) {
      lastError = err;
      if (err.message && (err.message.includes('429') || err.message.includes('400') || err.message.includes('decommission'))) {
        logger.warn(`Groq model ${model} error, trying next...`);
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error('ALL_MODELS_FAILED');
}

// ─── 1. GENERATE CREATIVE PRODUCT NAMES ─────────────────
const NAMES_PROMPT = `Eres un experto en naming para menús de restaurantes en Latinoamérica. Tu trabajo es generar nombres CREATIVOS para platos de menú.

REGLAS IMPORTANTES:
- Genera EXACTAMENTE 5 nombres creativos y diferentes
- Cada nombre debe ser corto (2-5 palabras máximo)
- Los nombres DEBEN dejar claro qué tipo de plato es (hamburguesa, pizza, wrap, etc.). El cliente que lea el nombre en el menú debe saber qué está pidiendo
- Ejemplo BUENO para "hamburguesa doble carne": "La Doble Bestia", "Burger Inferno Doble", "La Gran Smash Doble"
- Ejemplo MALO para "hamburguesa doble carne": "Doble Sabor", "Carne y Fuego" (no dicen que es una hamburguesa)
- Los nombres deben sonar apetitosos, memorables y diferenciadores
- Usa español latinoamericano, pero puedes mezclar con anglicismos comunes en gastronomía (burger, smash, wrap, etc.)
- NO uses comillas ni numeración
- Responde SOLO con los 5 nombres, uno por línea, sin explicaciones
- NO repitas palabras entre los nombres`;

router.post('/generate-names', authMiddleware, aiLimiter, async (req, res) => {
  try {
    const { description, category, businessType } = req.body;
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({ message: 'Descripción del plato es requerida' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ message: 'Servicio de IA no disponible' });
    }

    let prompt = `Plato: ${description.trim().slice(0, 300)}`;
    if (category) prompt += `\nCategoría del menú: ${category}`;
    if (businessType) prompt += `\nTipo de negocio: ${businessType}`;
    prompt += `\n\nGenera 5 nombres creativos para este plato. El nombre debe dejar claro qué tipo de comida es.`;

    const result = await callGroq(apiKey, NAMES_PROMPT, prompt, { temperature: 0.9 });

    // Parse names (one per line, filter empty)
    const names = result
      .split('\n')
      .map(n => n.replace(/^[\d\.\-\*]+\s*/, '').replace(/["""]/g, '').trim())
      .filter(n => n.length > 0 && n.length < 60)
      .slice(0, 5);

    res.json({ names });
  } catch (error) {
    logger.error('Error generating product names', error);
    const errMsg = error.message || '';
    if (errMsg.includes('RATE_LIMITED') || errMsg.includes('429')) {
      return res.status(429).json({ message: 'Demasiadas solicitudes. Intenta en un minuto.' });
    }
    res.status(500).json({ message: 'Error al generar nombres' });
  }
});

// ─── 2. GENERATE REVIEW RESPONSE ────────────────────────
const REVIEW_RESPONSE_PROMPT = `Eres el encargado de relaciones públicas de un negocio de comida. Tu trabajo es redactar respuestas PROFESIONALES y PERSONALIZADAS a reseñas de clientes.

REGLAS ESTRICTAS:
- Responde SIEMPRE en español colombiano natural (tuteo, amigable)
- La respuesta debe ser CORTA: máximo 2-3 oraciones (menos de 250 caracteres)
- SIEMPRE menciona el nombre del negocio en la respuesta
- Si la reseña es POSITIVA (4-5 estrellas): agradece con calidez, menciona que es un placer atenderlo
- Si la reseña es NEUTRAL (3 estrellas): agradece y menciona que trabajarán para mejorar
- Si la reseña es NEGATIVA (1-2 estrellas): discúlpate con empatía, ofrece mejorar, NO seas defensivo
- Si el cliente mencionó un producto específico, referéncialo en la respuesta
- Usa un tono cálido pero profesional, como hablaría el dueño de un restaurante
- NO uses emojis excesivos (máximo 1)
- NO uses frases genéricas como "valoramos tu opinión" - sé específico
- Responde SOLO con el texto de la respuesta, sin comillas ni prefijos`;

router.post('/review-response', authMiddleware, aiLimiter, async (req, res) => {
  try {
    const { reviewText, rating, customerName, businessName, businessType } = req.body;
    if (!reviewText && !rating) {
      return res.status(400).json({ message: 'Datos de la reseña son requeridos' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ message: 'Servicio de IA no disponible' });
    }

    let prompt = `Genera una respuesta para esta reseña de cliente:\n`;
    prompt += `Nombre del negocio: ${(businessName || 'nuestro negocio').slice(0, 100)}\n`;
    if (businessType) prompt += `Tipo de negocio: ${businessType}\n`;
    prompt += `Calificación: ${rating || '?'}/5 estrellas\n`;
    if (customerName) prompt += `Cliente: ${customerName.slice(0, 50)}\n`;
    prompt += `Reseña: "${(reviewText || 'Sin comentario, solo calificación').slice(0, 400)}"`;

    const result = await callGroq(apiKey, REVIEW_RESPONSE_PROMPT, prompt, {
      maxTokens: 200,
      temperature: 0.7
    });

    // Clean up response
    const response = result
      .replace(/^["'"""]+|["'"""]+$/g, '')
      .replace(/^(Respuesta|Response|Reply):\s*/i, '')
      .trim();

    res.json({ response });
  } catch (error) {
    logger.error('Error generating review response', error);
    const errMsg = error.message || '';
    if (errMsg.includes('RATE_LIMITED') || errMsg.includes('429')) {
      return res.status(429).json({ message: 'Demasiadas solicitudes. Intenta en un minuto.' });
    }
    res.status(500).json({ message: 'Error al generar respuesta' });
  }
});

module.exports = router;
