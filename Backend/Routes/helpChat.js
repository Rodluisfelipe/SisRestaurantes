const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

// Rate limiter: 20 mensajes por usuario cada 10 minutos
const chatLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { message: 'Demasiadas preguntas. Espera unos minutos.' }
});

// System prompt que describe TODO el sistema MenuBy
const SYSTEM_PROMPT = `Eres el asistente de ayuda de MenuBy, una plataforma colombiana de menús digitales para restaurantes. Responde SIEMPRE en español, de forma breve (máximo 3-4 oraciones), amigable y práctica.

SOBRE MENUBY:
- Plataforma para crear menús digitales con link propio (menuby.tech/tu-negocio)
- Permite recibir pedidos por WhatsApp o directamente en la app
- Los restaurantes se registran, crean productos, categorías y personalizan su menú

FUNCIONES DEL PANEL DE ADMINISTRACIÓN:
- **Dashboard**: Vista general con accesos rápidos a todas las secciones
- **Pedidos**: Ver pedidos en tiempo real, marcar como completados, gestionar estados
- **Productos**: Crear/editar productos con nombre, precio, descripción, imagen, categoría. Pueden tener extras/toppings
- **Categorías**: Organizar productos en categorías (se crean automáticas según tipo de negocio)
- **Extras/Toppings**: Crear grupos de extras (ej: salsas, tamaños) que se asignan a productos
- **Clientes**: Base de datos de clientes que han hecho pedidos
- **Cupones**: Crear descuentos por porcentaje o valor fijo con código
- **Reseñas**: Ver calificaciones y comentarios de clientes
- **Mesas**: Generar códigos QR para mesas del restaurante
- **Zonas de entrega**: Definir áreas de delivery con costos por zona
- **Catálogo**: Subir banners promocionales que aparecen en el menú
- **WhatsApp**: Personalizar el mensaje que se envía al pedir por WhatsApp
- **Pagos**: Configurar métodos de pago aceptados y modo de pedidos (WhatsApp/en app/ambos)
- **Suscripción**: Plan y pagos del servicio MenuBy
- **Configuración**: Nombre del negocio, logo, horarios, descripción
- **Tema**: Personalizar colores y apariencia del menú digital
- **Ubicación**: Dirección y mapa del negocio
- **Contraseña**: Cambiar contraseña de acceso

CÓMO EMPEZAR (para nuevos):
1. Registrarse y elegir tipo de negocio → se crean categorías automáticas
2. Agregar productos con fotos y precios
3. Configurar modo de pedidos (WhatsApp es perfecto para empezar)
4. Compartir el link menuby.tech/tu-negocio

SOPORTE HUMANO:
Si el usuario necesita ayuda más personalizada o tiene problemas técnicos que no puedes resolver, sugiérele contactar soporte por WhatsApp al 3138178003.

REGLAS:
- NO inventes funciones que no existen
- Si no sabes algo, di "No estoy seguro, contacta soporte por WhatsApp al 3138178003"
- Sé conciso, máximo 3-4 oraciones por respuesta
- Usa emojis moderadamente para ser amigable
- Si preguntan algo no relacionado con MenuBy, redirige amablemente`;

// Store conversations in memory (cleared on restart, no persistence needed)
const conversations = new Map();
const CONV_TTL = 30 * 60 * 1000; // 30 minutes
const MAX_HISTORY = 10; // Keep last 10 messages per conversation

// Cleanup old conversations every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, conv] of conversations) {
    if (now - conv.lastActive > CONV_TTL) conversations.delete(key);
  }
}, 15 * 60 * 1000);

// POST /help-chat/message
router.post('/message', authMiddleware, chatLimiter, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ message: 'Mensaje es requerido' });
    }

    // Limit message length
    const userMessage = message.trim().slice(0, 500);
    const userId = req.user.id;

    // Check for Gemini API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Fallback: respond with a helpful static message
      return res.json({
        reply: 'El asistente de IA no está configurado aún. Para ayuda, contacta soporte por WhatsApp al 3138178003 📱',
        fallback: true
      });
    }

    // Get or create conversation history
    if (!conversations.has(userId)) {
      conversations.set(userId, { history: [], lastActive: Date.now() });
    }
    const conv = conversations.get(userId);
    conv.lastActive = Date.now();

    // Add user message to history
    conv.history.push({ role: 'user', parts: [{ text: userMessage }] });

    // Keep only last N messages
    if (conv.history.length > MAX_HISTORY) {
      conv.history = conv.history.slice(-MAX_HISTORY);
    }

    // Call Gemini API
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_PROMPT
    });

    const chat = model.startChat({
      history: conv.history.slice(0, -1), // All except current message
    });

    const result = await chat.sendMessage(userMessage);
    const reply = result.response.text();

    // Add assistant response to history
    conv.history.push({ role: 'model', parts: [{ text: reply }] });

    res.json({ reply });
  } catch (error) {
    logger.error('Error in help chat', error);
    
    // Friendly fallback on any error
    res.json({
      reply: 'Disculpa, no pude procesar tu pregunta en este momento. Para ayuda inmediata, contacta soporte por WhatsApp al 3138178003 📱',
      fallback: true
    });
  }
});

module.exports = router;
