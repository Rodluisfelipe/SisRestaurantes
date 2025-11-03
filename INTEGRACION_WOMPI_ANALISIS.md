# 🔍 ANÁLISIS: PUNTOS DE INTEGRACIÓN WOMPI EN MENUBY

**Fecha:** 2025-01-27  
**Objetivo:** Identificar dónde interceptar pagos de suscripciones con Wompi  
**Estado:** Solo análisis, sin cambios

---

## 📊 RESUMEN EJECUTIVO

### Estado Actual
Menuby tiene un flujo de suscripciones **100% manual** gestionado por SuperAdmin. No existen:
- ❌ Pasarelas de pago integradas
- ❌ Webhooks de confirmación
- ❌ Flujos de checkout
- ❌ Links de pago generados automáticamente

### Propuesta de Integración Wompi
Para integrar Wompi, **NO necesitamos tocar `/orders`**. Las suscripciones se manejan independientemente del ciclo de pedidos de clientes. Los puntos críticos son **`/subscriptions` y `/auth`**.

---

## 🎯 PUNTOS DE INTEGRACIÓN CRÍTICOS

### 1️⃣ **POST `/api/auth/register`** (NUEVO NEGOCIO)

**Archivo:** `Backend/Routes/auth.js:18-98`

**Flujo actual:**
```javascript
POST /auth/register
  → Crea BusinessConfig
  → Crea Admin
  → Devuelve tokens
  → ❌ NO crea suscripción automática
```

**🏗️ INTEGRACIÓN WOMPI AQUÍ:**

```javascript
POST /auth/register
  → Crea BusinessConfig
  → Crea Admin
  → 🆕 INICIAR FLUJO DE CHECKOUT WOMPI
     ├── Calcular precio según plan (trial/monthly/annual)
     ├── POST a Wompi: crear "transaction"
     ├── Guardar paymentIntent/transactionId en DB
     └── Devolver checkoutLink al frontend
  → Devuelve tokens + checkoutLink
```

**PSEUDOCÓDIGO:**
```javascript
// Backend/Routes/auth.js:64 (después de await businessConfig.save())

// Crear suscripción inicial (estado: 'pending_payment')
const trialSubscription = new Subscription({
  businessId: businessConfig._id,
  planType: 'monthly', // O trial
  status: 'pending_payment',
  startDate: new Date(),
  endDate: addMonth(new Date()), // Calcular según plan
  price: 0, // O precio del plan
  paymentStatus: 'pending',
  gracePeriodEnd: null // Solo se calcula cuando se activa
});

await trialSubscription.save();

// 🆕 NUEVO: Crear checkout en Wompi
const wompiCheckout = await createWompiCheckout({
  businessId: businessConfig._id,
  subscriptionId: trialSubscription._id,
  amount: 50000, // Precio mensual
  currency: 'COP',
  redirectUrl: `${FRONTEND_URL}/${businessConfig.slug}/payment-callback`
});

// Actualizar suscripción con ID de transacción Wompi
trialSubscription.wompiTransactionId = wompiCheckout.id;
await trialSubscription.save();

// Devolver checkoutLink
res.status(201).json({
  message: 'Negocio registrado con éxito',
  business: { id, slug, businessName },
  user: { id, username, businessId },
  token,
  refreshToken,
  checkoutLink: wompiCheckout.link  // 🆕 NUEVO
});
```

**Impacto:** Cada negocio nuevo debe pagar antes de activar su cuenta.

---

### 2️⃣ **POST `/api/subscriptions`** (RENOVACIÓN / UPGRADE)

**Archivo:** `Backend/Routes/subscriptions.js:179-230`

**Flujo actual:**
```javascript
POST /subscriptions (SuperAdmin only)
  → Valida campos
  → Crea Subscription con status='active'
  → ❌ NO integra pago
```

**🏗️ INTEGRACIÓN WOMPI AQUÍ:**

```javascript
POST /subscriptions
  → Valida campos
  → 🆕 POST a Wompi: crear transaction
     ├── Si SuperAdmin: bypass (pago offline)
     └── Si Admin regular: crear checkout
  → Crea Subscription con status='pending_payment' o 'active'
  → Devuelve checkoutLink (si aplica)
```

**PSEUDOCÓDIGO:**
```javascript
// Backend/Routes/subscriptions.js:203 (modificar)

// ¿Es SuperAdmin creando para otro negocio?
const isSuperAdmin = req.user.role === 'superadmin';

if (isSuperAdmin && req.user.id !== businessId) {
  // SuperAdmin paga offline → activar directo
  subscription.status = 'active';
  subscription.paymentStatus = 'paid';
} else {
  // Admin renovando su propia suscripción → crear checkout
  subscription.status = 'pending_payment';
  subscription.paymentStatus = 'pending';
  
  // 🆕 Crear checkout en Wompi
  const wompiCheckout = await createWompiCheckout({
    businessId,
    subscriptionId: subscription._id,
    amount: price,
    currency: 'COP',
    redirectUrl: `${FRONTEND_URL}/${business.slug}/payment-callback`
  });
  
  subscription.wompiTransactionId = wompiCheckout.id;
  checkoutLink = wompiCheckout.link;
}

await subscription.save();

res.status(201).json({
  success: true,
  message: isSuperAdmin ? 'Suscripción activa' : 'Esperando pago',
  subscription,
  checkoutLink: checkoutLink || null  // 🆕 NUEVO
});
```

**Impacto:** Los admins pueden renovar suscripciones pagando en línea.

---

### 3️⃣ **WEBHOOK `/api/webhooks/wompi`** (CONFIRMACIÓN PAGO)

**Archivo:** 🆕 **CREAR NUEVO** `Backend/Routes/webhooks.js`

**Flujo:**
```javascript
POST /webhooks/wompi
  → Validar firma Wompi (security)
  → Leer event: 'TRANSACTION_APPROVED' | 'TRANSACTION_DECLINED'
  → Buscar Subscription por wompiTransactionId
  → Actualizar:
     ├── paymentStatus: 'paid' | 'failed'
     ├── status: 'active' | 'cancelled'
     └── startDate/endDate según plan
  → Emitir socket a business para notificar
  → Enviar email de confirmación
  → Responder 200 OK inmediatamente
```

**PSEUDOCÓDIGO:**
```javascript
// Backend/Routes/webhooks.js (NUEVO)

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Subscription = require('../Models/Subscription');
const { emitToBusiness } = require('../services/socketService');
const logger = require('../utils/logger');

// Validar firma Wompi
const verifyWompiSignature = (payload, signature) => {
  const eventSignature = crypto
    .createHmac('sha256', process.env.WOMPI_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(eventSignature)
  );
};

router.post('/wompi', async (req, res) => {
  // Responder 200 OK inmediatamente
  res.status(200).json({ received: true });
  
  try {
    const signature = req.headers['x-wompi-signature'];
    if (!verifyWompiSignature(req.body, signature)) {
      logger.error('Invalid Wompi webhook signature', null, req);
      return;
    }
    
    const event = req.body;
    
    // Buscar suscripción por transactionId
    const subscription = await Subscription.findOne({ 
      wompiTransactionId: event.data.transaction.id 
    });
    
    if (!subscription) {
      logger.warn('Subscription not found for Wompi transaction', { 
        transactionId: event.data.transaction.id 
      });
      return;
    }
    
    if (event.event === 'TRANSACTION_APPROVED') {
      // Pagó exitosamente
      subscription.paymentStatus = 'paid';
      subscription.status = 'active';
      
      // Calcular endDate según planType
      const endDate = new Date(subscription.startDate);
      if (subscription.planType === 'annual') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }
      subscription.endDate = endDate;
      subscription.gracePeriodEnd = new Date(endDate);
      subscription.gracePeriodEnd.setDate(subscription.gracePeriodEnd.getDate() + 1);
      
      await subscription.save();
      
      // Emitir socket
      emitToBusiness(subscription.businessId.toString(), 'subscription_activated', {
        subscriptionId: subscription._id,
        planType: subscription.planType
      });
      
      logger.info('Subscription activated via Wompi', { 
        subscriptionId: subscription._id, 
        businessId: subscription.businessId 
      });
      
      // TODO: Enviar email de confirmación
      
    } else if (event.event === 'TRANSACTION_DECLINED') {
      // Pago rechazado
      subscription.paymentStatus = 'failed';
      subscription.status = 'cancelled';
      await subscription.save();
      
      logger.info('Subscription payment failed via Wompi', { 
        subscriptionId: subscription._id 
      });
    }
    
  } catch (error) {
    logger.error('Error processing Wompi webhook', error, req);
  }
});

module.exports = router;
```

**Registro en server.js:**
```javascript
// Backend/server.js:126 (después de subscriptions)
app.use("/api/subscriptions", require("./Routes/subscriptions"));
app.use("/api/webhooks", require("./Routes/webhooks")); // 🆕 NUEVO
```

---

## 🗂️ 2. MODELO DE DATOS: CAMBIOS NECESARIOS

### Archivo: `Backend/Models/Subscription.js`

**Campos a agregar:**

```javascript
// Agregar después de línea 47:
wompiTransactionId: {
  type: String,
  default: null,
  sparse: true // Permite null pero único si existe
},
wompiReference: {
  type: String, // reference_v1 de Wompi
  default: null
},
lastPaymentAttempt: {
  type: Date,
  default: null
},
checkoutLink: {
  type: String, // URL generada por Wompi
  default: null
}
```

**Índices adicionales:**
```javascript
// Agregar después de línea 54:
subscriptionSchema.index({ wompiTransactionId: 1 }, { unique: true, sparse: true });
```

---

## 🔧 3. SERVICIO WOMPI: CAPA DE ABSTRACCIÓN

### Archivo: 🆕 **CREAR** `Backend/services/wompiService.js`

```javascript
const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

class WompiService {
  constructor() {
    this.baseUrl = process.env.WOMPI_API_URL || 'https://production.wompi.co/v1';
    this.publicKey = process.env.WOMPI_PUBLIC_KEY;
    this.privateKey = process.env.WOMPI_PRIVATE_KEY;
    this.integrityKey = process.env.WOMPI_INTEGRITY_KEY;
  }

  /**
   * Crear una transacción/checkout en Wompi
   */
  async createCheckout({ 
    amountInCents, 
    currency, 
    reference, 
    customerEmail,
    customerName,
    redirectUrl,
    businessId,
    subscriptionId
  }) {
    const checkoutData = {
      amount_in_cents: amountInCents * 100, // Wompi usa centavos
      currency: currency,
      customer_email: customerEmail,
      payment_method: {
        type: 'CARD', // O 'PSE', 'NEQUI', etc.
        installments: 1 // Sin cuotas
      },
      reference: reference, // unique per transaction
      shipping_address: {
        // Obtener de BusinessConfig
      },
      redirect_url: redirectUrl
    };

    const signature = this.generateSignature(checkoutData, this.privateKey);

    try {
      const response = await axios.post(
        `${this.baseUrl}/transactions`,
        checkoutData,
        {
          headers: {
            'Authorization': `Bearer ${this.publicKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        id: response.data.data.id,
        reference: response.data.data.reference,
        link: response.data.data.payment_link_url,
        status: response.data.data.status
      };

    } catch (error) {
      logger.error('Wompi checkout creation failed', error);
      throw new Error('No se pudo crear el checkout de pago');
    }
  }

  /**
   * Verificar estado de una transacción
   */
  async getTransactionStatus(transactionId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transactions/${transactionId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.publicKey}`
          }
        }
      );

      return {
        id: response.data.data.id,
        status: response.data.data.status, // 'APPROVED' | 'DECLINED' | 'VOIDED' | 'PENDING'
        amount: response.data.data.amount_in_cents / 100,
        reference: response.data.data.reference
      };

    } catch (error) {
      logger.error('Wompi transaction status check failed', error);
      throw error;
    }
  }

  /**
   * Generar firma para integridad
   */
  generateSignature(data, secret) {
    const concat = Object.keys(data)
      .sort()
      .map(key => `${key}${data[key]}`)
      .join('');
    
    return crypto
      .createHmac('sha256', secret)
      .update(concat)
      .digest('hex');
  }

  /**
   * Validar webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    const eventSignature = crypto
      .createHmac('sha256', this.integrityKey)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(eventSignature)
    );
  }
}

module.exports = new WompiService();
```

---

## 🎨 4. FRONTEND: FLUJOS DE CHECKOUT

### Página de Callback: 🆕 **CREAR** `Frontend/src/Pages/PaymentCallback.jsx`

```jsx
// Frontend/src/Pages/PaymentCallback.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../services/api';

const PaymentCallback = () => {
  const { businessId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const transactionId = searchParams.get('ref_payco');
    
    // Verificar estado del pago
    api.post(`/webhooks/wompi/callback`, { transactionId })
      .then((res) => {
        if (res.data.success) {
          setStatus('success');
          setTimeout(() => {
            navigate(`/${businessId}/admin`);
          }, 3000);
        } else {
          setStatus('failed');
        }
      })
      .catch(() => {
        setStatus('failed');
      });
  }, []);

  return (
    <div>
      {status === 'loading' && <p>Verificando pago...</p>}
      {status === 'success' && <p>✅ Pago confirmado</p>}
      {status === 'failed' && <p>❌ Pago fallido</p>}
    </div>
  );
};

export default PaymentCallback;
```

---

## 📊 TABLA DE RUTAS AFECTADAS

| Ruta | Método | Archivo Actual | Cambio Requerido |
|------|--------|----------------|------------------|
| `/auth/register` | POST | `auth.js:18` | ✅ Modificar: crear checkout Wompi |
| `/subscriptions` | POST | `subscriptions.js:179` | ✅ Modificar: integrar Wompi checkout |
| `/subscriptions` | PUT | `subscriptions.js:233` | ⚠️ Opcional: permitir renovación |
| `/webhooks/wompi` | POST | ❌ NO EXISTE | 🆕 CREAR: webhook handler |
| `/orders` | POST | `orders.js:64` | ❌ NO TOCAR (separado) |
| `/products` | POST | `products.js` | ❌ NO TOCAR |
| `/business-config` | PUT | `businessConfig.js` | ❌ NO TOCAR |

---

## 🔐 5. VARIABLES DE ENTORNO

### Archivo: `.env` / `.env.production`

```env
# Wompi Configuration
WOMPI_API_URL=https://production.wompi.co/v1
WOMPI_PUBLIC_KEY=pk_prod_XXXXXXXXXXXXXXXX
WOMPI_PRIVATE_KEY=prv_prod_XXXXXXXXXXXXXXXX
WOMPI_INTEGRITY_KEY=XXXXXXXXXXXXXX
WOMPI_WEBHOOK_SECRET=XXXXXXXXXXXXXX

# Subscription Settings
SUBSCRIPTION_GRACE_PERIOD_DAYS=1
SUBSCRIPTION_MONTHLY_PRICE=50000
SUBSCRIPTION_ANNUAL_PRICE=500000
SUBSCRIPTION_TRIAL_DAYS=7
```

---

## 📋 FLUJO COMPLETO (DIAGRAMA)

```
┌─────────────────────────────────────────────────────────────┐
│ NUEVO NEGOCIO (Admin se registra)                          │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
  POST /auth/register
         │
         ├─ Crear BusinessConfig
         ├─ Crear Admin
         ├─ 🆕 Crear Subscription (pending_payment)
         └─ 🆕 POST Wompi → crear checkout
         │
         ▼
  Frontend recibe checkoutLink
         │
         ▼
  Redirect a Wompi Checkout
         │
         ▼
  Usuario paga en Wompi
         │
         ▼
  Redirect a /payment-callback
         │
         ▼
  🆕 Webhook: POST /webhooks/wompi
         │
         ├─ Validar firma
         ├─ Buscar Subscription
         ├─ UPDATE status='active'
         ├─ UPDATE paymentStatus='paid'
         ├─ Calcular endDate según plan
         └─ Emitir socket: 'subscription_activated'
         │
         ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ SUSCRIPCIÓN ACTIVA                                          │
  │ - Admin puede crear productos                               │
  │ - Admin puede recibir pedidos                               │
  │ - Socket notifica activación                                │
  └─────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────┐
│ RENOVACIÓN (Admin renueva antes de vencer)                  │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
  Frontend: Admin hace clic "Renovar"
         │
         ▼
  POST /subscriptions
         │
         ├─ Crear nueva Subscription (pending_payment)
         └─ 🆕 POST Wompi → crear checkout
         │
         ▼
  [Mismo flujo que arriba]
         │
         ▼
  Webhook actualiza nueva Subscription
         │
         ▼
  Suscripción renovada
```

---

## 🔍 PUNTOS CLAVE DE INTERCEPTACIÓN

### ¿Dónde NO tocar?

1. ❌ `/orders`: Los pedidos de clientes son independientes de las suscripciones
2. ❌ `/products`: La gestión de productos NO depende del pago
3. ❌ Middleware de auth: Solo verifica JWT, no estado de suscripción (por ahora)

### ¿Dónde SÍ tocar?

1. ✅ `/auth/register`: Crear checkout al registrarse
2. ✅ `/subscriptions`: Integrar Wompi al crear/renovar
3. ✅ 🆕 `/webhooks/wompi`: Recibir confirmaciones
4. ✅ Modelo `Subscription`: Agregar campos `wompi*`

### ¿Qué falta después?

Una vez integrado Wompi, necesitarás:
- 🟡 **Middleware de enforcement**: Bloquear operaciones si suscripción expirada
- 🟡 **Cron jobs**: Transiciones automáticas `active → expired`
- 🟡 **Notificaciones**: Emails/push antes de vencer
- 🟢 **Idempotencia**: Validar transacciones duplicadas en webhooks

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Fase 1: Base (Wompi SDK)
- [ ] Instalar `wompi-node` o usar `axios` para API
- [ ] Crear `Backend/services/wompiService.js`
- [ ] Agregar variables `.env` de Wompi
- [ ] Crear endpoints de prueba (sandbox)

### Fase 2: Checkout
- [ ] Modificar `POST /auth/register` para crear checkout
- [ ] Modificar `POST /subscriptions` para crear checkout
- [ ] Actualizar modelo `Subscription` con campos Wompi
- [ ] Crear página `PaymentCallback` en frontend

### Fase 3: Webhook
- [ ] Crear `Backend/Routes/webhooks.js`
- [ ] Implementar validación de firma
- [ ] Procesar eventos `TRANSACTION_APPROVED` y `TRANSACTION_DECLINED`
- [ ] Actualizar estado de suscripción desde webhook
- [ ] Emitir eventos socket

### Fase 4: Testing
- [ ] Configurar Wompi Sandbox
- [ ] Probar flujo completo con tarjetas de prueba
- [ ] Verificar webhook con ngrok/cloudflare tunnel
- [ ] Validar idempotencia (reenviar webhook)
- [ ] Probar edge cases (pago fallido, timeout)

### Fase 5: Production
- [ ] Switch a producción Wompi
- [ ] Configurar webhook URL real
- [ ] Monitorear logs de transacciones
- [ ] Implementar enforcement middleware
- [ ] Agregar cron jobs de transiciones

---

## 🚨 CONSIDERACIONES DE SEGURIDAD

1. **Validar firma en TODOS los webhooks** (línea `webhooks.js`)
2. **Usar HTTPS en producción** (Wompi exige esto)
3. **Rate-limit en `/webhooks/wompi`** (prevenir spam)
4. **Logging detallado** de todas las transacciones
5. **Idempotencia** en webhooks (verificar si ya se procesó)
6. **Rollback** si algo falla después del webhook

---

**FIN DEL ANÁLISIS**

