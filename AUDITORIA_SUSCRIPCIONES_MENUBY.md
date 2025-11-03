# 📋 AUDITORÍA COMPLETA: SISTEMA DE SUSCRIPCIONES - MENUBY

**Fecha:** 2025-01-27  
**Versión:** 1.0  
**Estado:** Solo lectura - Diagnóstico

---

## 📊 RESUMEN EJECUTIVO

### Estado Actual
Menuby implementa un **sistema de suscripciones básico y completamente manual**, gestionado exclusivamente por SuperAdmin. No existe integración con pasarelas de pago (PSP), webhooks automáticos, ni jobs cron para transiciones de estado.

### Hallazgos Críticos
1. ❌ **NO HAY ENFORCEMENT**: Ninguna ruta del backend ni del frontend bloquea operaciones basándose en el estado de suscripción
2. ❌ **NO HAY AUTOMATIZACIÓN**: No existen cron jobs para transiciones de estado (active → expired → cancelled)
3. ❌ **NO HAY WEBHOOKS**: Cero integración con Stripe, MercadoPago u otros PSP
4. ❌ **GESTIÓN 100% MANUAL**: SuperAdmin debe actualizar manualmente cada suscripción
5. ⚠️ **PERÍODO DE GRACIA HARDCODEADO**: 1 día fijo, sin configuración por `.env`

### Riesgos Identificados
| Riesgo | Prioridad | Impacto | Archivo |
|--------|-----------|---------|---------|
| Ningún enforcement en pedidos/productos/admin | 🔴 ALTA | Crítico | Todas las rutas POST/PUT/DELETE |
| Período de gracia no configurable | 🟡 MEDIA | Operacional | `subscriptions.js:200` |
| Sin idempotencia en transiciones | 🟢 BAJA | Resiliencia | N/A (sin transiciones automáticas) |
| Sin notificaciones automáticas | 🟡 MEDIA | UX | N/A |

---

## 🗂️ 1. MODELO DE DATOS

### Archivo: `Backend/Models/Subscription.js`

**Schema completo (líneas 3-50):**
```javascript
businessId: ObjectId -> BusinessConfig (requerido)
planType: 'monthly' | 'annual' (requerido)
status: 'active' | 'expired' | 'cancelled' | 'pending' (default: 'pending')
startDate: Date (requerido)
endDate: Date (requerido)
price: Number (requerido)
paymentStatus: 'paid' | 'pending' | 'failed' (default: 'pending')
gracePeriodEnd: Date (default: null) // ⚠️ CALCULADO: endDate + 1 día
isActive: Boolean (default: true)
notes: String (default: '')
timestamps: {createdAt, updatedAt} (automático)
```

**Índices (líneas 53-54):**
- Compound: `{businessId: 1, status: 1}`
- Compound: `{endDate: 1, status: 1}`

**Métodos del modelo (líneas 57-77):**
- `isSubscriptionActive()`: Verifica `status === 'active' && endDate > now && paymentStatus === 'paid'`
- `isInGracePeriod()`: Verifica `status === 'expired' && gracePeriodEnd > now`
- `getDaysRemaining()`: Calcula días hasta `endDate`

**Hooks Mongoose:** ❌ NINGUNO

---

## 🔄 2. FUENTE DE VERDAD Y ESTADO

### Source of Truth
**Base de datos MongoDB**: Colección `subscriptions`

**NO HAY** integración con PSP externos. Todo se almacena en MongoDB y se actualiza manualmente por SuperAdmin.

### State Machine Actual

```
[PENDING] ──(SuperAdmin crea)──> [ACTIVE]
                                      │
                                      │ (endDate < ahora AND SuperAdmin actualiza)
                                      ▼
                                [EXPIRED]
                                      │
                                      │ (gracePeriodEnd < ahora Y SuperAdmin actualiza)
                                      ▼
                                [CANCELLED]
```

**Estados posibles:**
- `pending`: Recién creada, no activa
- `active`: Suscripción vigente (no verifica automáticamente si `endDate` pasó)
- `expired`: Marcada manualmente como expirada (período de gracia activo si `gracePeriodEnd > now`)
- `cancelled`: Finalizada permanentemente

**Transiciones:**
- ❌ **NO HAY TRANSICIONES AUTOMÁTICAS**
- Todas las transiciones requieren actualización manual por SuperAdmin
- No existe validación de `endDate < now` en ningún middleware o job

### Cálculo de Período de Gracia

**Archivo:** `Backend/Routes/subscriptions.js`

**Líneas 200-201 (POST):**
```javascript
const gracePeriodEnd = new Date(endDate);
gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 1); // ⚠️ HARDCODEADO: +1 día
```

**Líneas 240-241 (PUT):**
```javascript
subscription.gracePeriodEnd = new Date(endDate);
subscription.gracePeriodEnd.setDate(subscription.gracePeriodEnd.getDate() + 1);
```

**Período de gracia:**
- **Duración**: 1 día después de `endDate`
- **Configuración**: ❌ NO configurable vía `.env`
- **Cálculo**: Hardcodeado en el código
- **Aplicación**: Solo se considera si `status === 'expired'`

---

## 💳 3. INTEGRACIÓN DE PAGOS

### ❌ NO EXISTE INTEGRACIÓN

**Búsqueda realizada:**
- ❌ No existe carpeta `Backend/Routes/payments/`
- ❌ No existe `Backend/services/paymentService.js`
- ❌ No hay archivos con "stripe", "mercadopago", "payment" en rutas

**Endpoints de pagos:** ❌ 0 endpoints

**Webhooks:** ❌ No implementados

**Manejo de eventos externos:** ❌ N/A

---

## 🚫 4. ENFORCEMENT Y PERÍODO DE GRACIA

### ⚠️ **CRÍTICO: NO HAY ENFORCEMENT EN NINGÚN PUNTO**

#### Búsqueda de enforcement en backend:
1. **Creación de pedidos** (`Backend/Routes/orders.js:64-242`): ❌ SIN CHECK
2. **Creación de productos** (`Backend/Routes/products.js`): ❌ SIN CHECK
3. **Actualización de business** (`Backend/Routes/businessConfig.js`): ❌ SIN CHECK
4. **Gestión de cupones** (`Backend/Routes/coupons.js`): ❌ SIN CHECK
5. **Todas las rutas admin**: ❌ SIN CHECK

#### Búsqueda de enforcement en frontend:
1. **Rutas protegidas** (`Frontend/src/App.jsx:33-58`): Solo verifica autenticación JWT
2. **Admin panel** (`Frontend/src/Pages/Admin.jsx:168-371`): Solo verifica autenticación
3. **Guards de suscripción**: ❌ NO EXISTEN

#### Componente de UI existente:

**Archivo:** `Frontend/src/Components/SubscriptionStatus.jsx`

**Renderizado en:** `Frontend/src/Pages/Admin.jsx:1031-1033`
```jsx
<SubscriptionStatus businessId={businessConfig._id} />
```

**Funcionalidad:**
- ✅ Solo muestra el estado visual (color/icono según estado)
- ❌ NO bloquea acciones
- ❌ NO previene acceso a rutas
- ❌ NO limita funcionalidad

### Período de Gracia

**Archivo:** `Backend/Models/Subscription.js:65-70`
```javascript
subscriptionSchema.methods.isInGracePeriod = function() {
  const now = new Date();
  return this.status === 'expired' && 
         this.gracePeriodEnd && 
         this.gracePeriodEnd > now;
};
```

**Condiciones exactas:**
```pseudocode
IF subscription.status === 'expired' 
   AND subscription.gracePeriodEnd != null 
   AND subscription.gracePeriodEnd > fecha_actual
THEN grace_period = TRUE
ELSE grace_period = FALSE
```

**⚠️ PROBLEMA**: Este método se llama en `GET /api/subscriptions/check/:businessId`, pero **nunca se usa para bloquear operaciones**.

---

## ⏰ 5. JOBS/CRON Y AUTOMATIZACIÓN

### ❌ NO EXISTEN JOBS

**Búsqueda realizada:**
- ❌ No existen archivos `**/*cron*.js`
- ❌ No existen archivos `**/*job*.js`
- ❌ No existe `node-cron` en `package.json`
- ❌ No existe `agenda` en `package.json`
- ❌ No existe `bull` en `package.json`

**Consecuencia:**
- ❌ `status: 'active'` con `endDate < now` no se actualiza automáticamente a `expired`
- ❌ `status: 'expired'` con `gracePeriodEnd < now` no se actualiza a `cancelled`
- ❌ No se envían notificaciones automáticas de vencimiento
- ❌ Todas las transiciones deben hacerse manualmente

---

## 📧 6. NOTIFICACIONES Y RECORDATORIOS

### ❌ NO EXISTEN NOTIFICACIONES AUTOMÁTICAS

**Archivos de email/WhatsApp:**
- `Backend/utils/nodemailer.js`: ❌ NO EXISTE
- `Backend/services/emailService.js`: ❌ NO EXISTE
- `Backend/services/whatsappService.js`: ❌ NO EXISTE

**Integración:**
- ✅ Existe `SMTP_*` en `.env` para nodemailer
- ❌ No se usa para notificaciones de suscripción
- ❌ No hay templates de email para vencimiento/grace

**Archivo:** `updated_env_file.txt:10-15`
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=pipe95141007@gmail.com
SMTP_PASS=***
EMAIL_FROM=Restaurantes System <pipe95141007@gmail.com>
```

**Notificaciones push:**
- ✅ Existe infraestructura de push (Web Push PWA)
- ❌ No se usa para notificar vencimientos

---

## 🎨 7. FRONTEND (PAYWALL Y AVISOS)

### Componentes visuales

#### `Frontend/src/Components/SubscriptionStatus.jsx`

**Líneas 35-46:** Colores y texto según estado
```javascript
getStatusColor(status, isInGracePeriod) {
  if (isInGracePeriod) return 'text-yellow-600';
  if (status === 'active') return 'text-green-600';
  if (status === 'expired') return 'text-red-600';
  return 'text-gray-600';
}
```

**Renderizado en Admin:** `Frontend/src/Pages/Admin.jsx:1031-1033`

**Banners mostrados:**
- 🟢 **Activo**: "X días restantes" (green-50)
- 🟡 **Gracia**: "Período de Gracia" + "1 día para renovar" (yellow-50)
- 🔴 **Expirado**: "MENÚ DESACTIVADO" (red-50)

**⚠️ LIMITACIÓN**: Solo visual, no previene acciones.

### Guards de acceso

**Archivo:** `Frontend/src/App.jsx:33-58`

**ProtectedRoute:** Solo verifica `isAuthenticated` y `hasToken`. ❌ **NO verifica estado de suscripción**.

**Archivo:** `Frontend/src/Pages/Admin.jsx:168-371`

**Verificaciones:**
- `isAuthenticated`: ✅ Se verifica
- `businessId`: ✅ Se valida
- Estado de suscripción: ❌ **NO se verifica**

---

## 🔧 8. VARIABLES DE ENTORNO

### Variables relacionadas con suscripciones

**Archivo:** `updated_env_file.txt`, `production_env_file.txt`

❌ **NO EXISTEN VARIABLES** para:
- `SUBSCRIPTION_GRACE_PERIOD_DAYS`
- `SUBSCRIPTION_TRIAL_DAYS`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `MERCADOPAGO_ACCESS_TOKEN`

**Hardcodeados:**
- Período de gracia: **1 día** (línea `subscriptions.js:200`)
- Estados: **Sin defaults en `.env`**
- Precios: **Sin configuración**

---

## 🔐 9. SEGURIDAD Y MULTITENANCY

### Verificaciones de businessId

**✅ CORRECTO**: Todas las consultas a `Subscription` usan filtro por `businessId`

**Archivo:** `Backend/Routes/subscriptions.js:21,89,161,190`
```javascript
const subscription = await Subscription.findOne({ businessId })
```

**Validación:** `isValidObjectId(businessId)` en múltiples rutas

**Protección SuperAdmin:** `Backend/Routes/subscriptions.js:133`
```javascript
router.use(protectSuperAdmin); // Aplica a todas las rutas excepto /check/:businessId
```

**⚠️ RIESGO**: Como no hay enforcement, un negocio sin suscripción puede operar normalmente.

---

## 🚨 10. GAPS Y RIESGOS

### Gap 1: Sin enforcement en pedidos
**Archivo:** `Backend/Routes/orders.js:64-242`  
**Severidad:** 🔴 CRÍTICA  
**Impacto:** Un negocio con suscripción expirada puede seguir recibiendo pedidos  
**Líneas:** 64-242 (POST /orders)

### Gap 2: Sin enforcement en admin
**Archivos:** `Backend/Routes/products.js`, `businessConfig.js`, `categories.js`, `toppingGroups.js`  
**Severidad:** 🔴 CRÍTICA  
**Impacto:** Admin puede crear/editar/eliminar productos sin verificar suscripción  
**Líneas:** Todas las rutas POST/PUT/DELETE

### Gap 3: Sin transiciones automáticas
**Archivo:** No existe  
**Severidad:** 🟡 ALTA  
**Impacto:** SuperAdmin debe recordar actualizar `status` manualmente  
**Consecuencia:** `status: 'active'` puede quedar con `endDate` vencido

### Gap 4: Período de gracia hardcodeado
**Archivo:** `Backend/Routes/subscriptions.js:200`  
**Severidad:** 🟡 MEDIA  
**Impacto:** No se puede ajustar sin modificar código  
**Líneas:** 200, 240-241

### Gap 5: Sin notificaciones automáticas
**Archivos:** No existen  
**Severidad:** 🟡 MEDIA  
**Impacto:** Usuario no sabe que su suscripción vence  
**Mitigación:** Solo hay UI visual en Admin

### Gap 6: Sin idempotencia en transiciones
**Archivo:** N/A (no hay transiciones automáticas)  
**Severidad:** 🟢 BAJA  
**Impacto:** N/A por ahora

### Gap 7: Sin validación de `endDate` en runtime
**Archivo:** `Backend/Models/Subscription.js:57-62`  
**Severidad:** 🟡 MEDIA  
**Impacto:** `isSubscriptionActive()` se calcula en tiempo real, pero no se llama en ningún lugar crítico  
**Líneas:** 57-62, 100-105

---

## ✅ CHECKLIST DE VERIFICACIÓN MANUAL

### Escenario 1: "Vence en 3 días"
```bash
# 1. Crear suscripción
POST /api/subscriptions
{
  "businessId": "507f1f77bcf86cd799439011",
  "planType": "monthly",
  "startDate": "2025-01-01",
  "endDate": "2025-01-30", // +3 días desde hoy
  "price": 50000
}

# 2. Verificar estado
GET /api/subscriptions/check/507f1f77bcf86cd799439011
# Respuesta esperada: status: 'active', daysRemaining: 3

# 3. Intentar crear pedido
POST /api/orders
# ✅ DEBERÍA funcionar (pero hoy NO BLOQUEA)
```

### Escenario 2: "Vence hoy (endDate = hoy)"
```bash
# 1. Actualizar suscripción
PUT /api/subscriptions/{id}
{
  "endDate": "2025-01-27" // Hoy
}

# 2. Verificar
GET /api/subscriptions/check/{businessId}
# Respuesta: status: 'active', daysRemaining: 0

# 3. Crear pedido
POST /api/orders
# ✅ DEBERÍA funcionar (pero hoy NO BLOQUEA)
```

### Escenario 3: "Día +1 grace period"
```bash
# 1. Actualizar a expired manualmente
PUT /api/subscriptions/{id}
{
  "status": "expired"
}

# 2. Verificar
GET /api/subscriptions/check/{businessId}
# Respuesta: status: 'expired', isInGracePeriod: true

# 3. Crear pedido
POST /api/orders
# ✅ DEBERÍA funcionar (pero hoy NO BLOQUEA)
```

### Escenario 4: "Suspendido (fuera de grace)"
```bash
# 1. Esperar 1 día después de gracePeriodEnd
# 2. Verificar
GET /api/subscriptions/check/{businessId}
# Respuesta: status: 'expired', isInGracePeriod: false

# 3. Crear pedido
POST /api/orders
# ❌ NO DEBERÍA funcionar (pero hoy NO BLOQUEA)
```

---

## 📊 TABLA: ARCHIVO vs RESPONSABILIDAD

| Responsabilidad | Archivo | Líneas | Estado |
|----------------|---------|--------|--------|
| **Modelo de datos** | `Backend/Models/Subscription.js` | 1-79 | ✅ Completo |
| **Endpoints CRUD** | `Backend/Routes/subscriptions.js` | 1-305 | ✅ Completo |
| **Check de suscripción** | `Backend/Routes/subscriptions.js` | 77-130 | ✅ Existe |
| **UI de estado** | `Frontend/src/Components/SubscriptionStatus.jsx` | 1-190 | ✅ Solo visual |
| **Gestión SuperAdmin** | `Frontend/src/Components/SuperAdmin/SubscriptionManagement.jsx` | 1-677 | ✅ Completo |
| **Enforcement pedidos** | `Backend/Routes/orders.js` | 64-242 | ❌ NO EXISTE |
| **Enforcement admin** | `Backend/Routes/products.js`, etc. | Varias | ❌ NO EXISTE |
| **Cron jobs** | N/A | N/A | ❌ NO EXISTE |
| **Webhooks PSP** | N/A | N/A | ❌ NO EXISTE |
| **Notificaciones auto** | N/A | N/A | ❌ NO EXISTE |
| **Variables .env** | `.env` | N/A | ❌ SIN VARS |

---

## 🎯 DIAGRAMA DE ESTADOS (ASCII)

```
                    [PENDING]
                       │
                       │ POST /subscriptions
                       ▼
                    [ACTIVE] ───────┐
                       │             │
                       │             │ endDate > now
                       │             │ paymentStatus = 'paid'
                       │             │
                       │             │
                       │             │ PUT /:id {status: 'expired'}
                       │             ▼
                       │        [EXPIRED] (gracePeriodEnd > now)
                       │             │
                       │             │ gracePeriodEnd < now
                       │             ▼
                       │        [CANCELLED]
                       │
                       │ PUT /:id {status: 'cancelled'}
                       └─────────────────────────────┘
```

---

## 📌 CONCLUSIÓN

### Estado Actual
**Sistema de suscripciones implementado al 40%**: Modelo, endpoints, UI visual y gestión SuperAdmin están completos. **Faltan critical paths**: enforcement, automatización y notificaciones.

### Recomendaciones Prioritarias

1. **ALTA**: Implementar middleware `checkSubscriptionActive()` que bloquee operaciones en rutas clave
2. **ALTA**: Crear job cron diario para transiciones `active → expired → cancelled`
3. **MEDIA**: Agregar variable `SUBSCRIPTION_GRACE_PERIOD_DAYS` en `.env`
4. **MEDIA**: Enviar emails/push automáticos antes de vencimiento
5. **BAJA**: Integrar PSP para pagos automáticos

### Riesgo de Producción
**🔴 ALTO**: Cualquier negocio con suscripción expirada puede seguir operando indefinidamente sin restricciones.

---

**FIN DEL INFORME**

