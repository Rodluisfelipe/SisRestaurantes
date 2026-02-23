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
const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

async function callGroq(apiKey, systemPrompt, userMessage, opts = {}) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];

  for (const model of GROQ_MODELS) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: opts.maxTokens || 400,
          temperature: opts.temperature || 0.8
        })
      });

      if (response.status === 429) {
        logger.warn(`Groq model ${model} rate limited, trying next...`);
        continue;
      }

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Groq API error ${response.status}: ${errBody}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (err) {
      if (err.message && err.message.includes('429')) continue;
      throw err;
    }
  }
  throw new Error('RATE_LIMITED');
}

// ─── 1. GENERATE CREATIVE PRODUCT NAMES ─────────────────
const NAMES_PROMPT = `Eres un experto en branding y naming para restaurantes y negocios de comida en Latinoamérica. Tu trabajo es generar nombres CREATIVOS, ATRACTIVOS y MEMORABLES para platos de menú.

REGLAS:
- Genera EXACTAMENTE 5 nombres creativos y diferentes
- Cada nombre debe ser corto (2-5 palabras máximo)
- Los nombres deben sonar apetitosos y atractivos
- Adapta el estilo al tipo de negocio (casual, gourmet, callejero, etc.)
- Usa español colombiano/latinoamericano
- NO uses comillas ni numeración
- Responde SOLO con los 5 nombres, uno por línea, sin explicaciones ni texto adicional
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

    let prompt = `Genera 5 nombres creativos para este plato: ${description.trim().slice(0, 300)}`;
    if (category) prompt += `\nCategoría: ${category}`;
    if (businessType) prompt += `\nTipo de negocio: ${businessType}`;

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
