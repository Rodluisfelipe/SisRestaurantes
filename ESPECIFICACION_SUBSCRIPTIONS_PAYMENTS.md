# 📋 ESPECIFICACIÓN TÉCNICA: PAGOS Y SUSCRIPCIONES EN MENUBY

**Versión:** 1.0  
**Fecha:** 2025-01-27  
**Estado:** Diseño - No implementado

---

## 📊 RESUMEN EJECUTIVO

### Objetivo General
Implementar un sistema completo de gestión de suscripciones y pagos integrado con **Wompi**, con dos interfaces principales:
1. **Panel Admin**: Gestión de la propia suscripción
2. **Panel SuperAdmin**: Dashboard global de todos los negocios

### Alcance
- ✅ Endpoints de datos y checkout Wompi
- ✅ Interfaz Admin para pagar/renovar
- ✅ Dashboard SuperAdmin con KPIs
- ✅ Historial de transacciones
- ❌ **NO incluye**: enforcement automático (solo visual), webhooks (se asume implementado)

---

## 🎯 PROMPT 1: PANEL ADMIN - SECCIÓN PAGOS

### Objetivo
Permitir que cada negocio gestione su propia suscripción: ver estado, histórico de pagos y renovar.

---

### 1.1 Endpoint: `GET /api/subscriptions/me`

**Archivo:** `Backend/Routes/subscriptions.js`  
**Línea aproximada:** Agregar después de línea 76

**Funcionalidad:**
- Retorna la suscripción del negocio autenticado
- Calcula `nextDueDate`, `graceUntil` dinámicamente
- Incluye información del último pago

**Request:**
```http
GET /api/subscriptions/me
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "subscription": {
    "plan": "monthly | annual",
    "status": "trial | active | past_due | grace | suspended | canceled",
    "periodStart": "2025-01-01T00:00:00Z",
    "periodEnd": "2025-02-01T00:00:00Z",
    "graceUntil": "2025-02-02T00:00:00Z" // null si no aplica
    "nextDueDate": "2025-02-01T00:00:00Z",
    "price": 50000,
    "currency": "COP",
    "lastPayment": {
      "date": "2025-01-01T12:30:00Z",
      "amount": 50000,
      "currency": "COP",
      "method": "CARD | PSE | NEQUI",
      "status": "APPROVED | DECLINED | PENDING",
      "externalId": "WMPI_123456789"
    },
    "isInGracePeriod": false,
    "daysRemaining": 5
  }
}
```

**Response (404 Not Found - Sin suscripción):**
```json
{
  "success": true,
  "hasSubscription": false,
  "message": "No hay suscripción activa"
}
```

**Implementación:**
```javascript
// Backend/Routes/subscriptions.js (después de línea 76)

// GET /api/subscriptions/me - Obtener mi suscripción (para admin autenticado)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    
    if (!businessId) {
      return res.status(403).json(formatHttpError(req, 'No se pudo determinar el negocio', 403));
    }
    
    const subscription = await Subscription.findOne({ businessId })
      .sort({ createdAt: -1 }) // Tomar la más reciente
      .populate('businessId', 'businessName slug');
    
    if (!subscription) {
      return res.status(200).json({
        success: true,
        hasSubscription: false,
        message: 'No hay suscripción activa'
      });
    }
    
    // Calcular nextDueDate dinámicamente
    const now = new Date();
    const nextDueDate = subscription.endDate > now ? subscription.endDate : null;
    
    // Determinar status (considerar grace period automáticamente)
    let status = subscription.status;
    const isInGracePeriod = subscription.isInGracePeriod();
    
    if (status === 'active' && subscription.endDate < now) {
      status = 'past_due';
    }
    if (status === 'expired' && isInGracePeriod) {
      status = 'grace';
    }
    
    // Construir respuesta del último pago (si existe)
    const lastPayment = {
      date: subscription.updatedAt,
      amount: subscription.price,
      currency: 'COP',
      method: subscription.paymentMethod || 'CARD',
      status: subscription.paymentStatus === 'paid' ? 'APPROVED' : 
              subscription.paymentStatus === 'failed' ? 'DECLINED' : 'PENDING',
      externalId: subscription.wompiTransactionId || null
    };
    
    res.json({
      success: true,
      subscription: {
        plan: subscription.planType,
        status,
        periodStart: subscription.startDate,
        periodEnd: subscription.endDate,
        graceUntil: subscription.gracePeriodEnd,
        nextDueDate,
        price: subscription.price,
        currency: 'COP',
        lastPayment: subscription.paymentStatus === 'paid' ? lastPayment : null,
        isInGracePeriod: isInGracePeriod,
        daysRemaining: subscription.getDaysRemaining()
      }
    });
  } catch (error) {
    logger.error('Error fetching my subscription', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener la suscripción', 500));
  }
});
```

---

### 1.2 Endpoint: `POST /api/subscriptions/checkout`

**Archivo:** `Backend/Routes/subscriptions.js`  
**Línea aproximada:** Agregar después de endpoint `/me`

**Funcionalidad:**
- Crea un checkout en Wompi para la suscripción actual
- Guarda `wompiTransactionId` y `checkoutLink`
- Retorna el link para redirección

**Request:**
```http
POST /api/subscriptions/checkout
Authorization: Bearer {token}
Content-Type: application/json

{
  "planType": "monthly | annual" // Opcional, default usa el plan actual
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "checkoutLink": "https://checkout.wompi.co/v1/transaction/?id=WMPI_123456789",
  "transactionId": "WMPI_123456789"
}
```

**Implementación:**
```javascript
// Backend/Routes/subscriptions.js (después de endpoint /me)

const wompiService = require('../services/wompiService');

router.post('/checkout', authMiddleware, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { planType } = req.body; // Opcional
    
    if (!businessId) {
      return res.status(403).json(formatHttpError(req, 'No se pudo determinar el negocio', 403));
    }
    
    // Buscar suscripción actual
    const subscription = await Subscription.findOne({ businessId })
      .sort({ createdAt: -1 });
    
    if (!subscription) {
      return res.status(404).json(formatHttpError(req, 'No tienes una suscripción', 404));
    }
    
    // Obtener business para email
    const business = await BusinessConfig.findById(businessId);
    
    // Precio según plan
    const price = planType === 'annual' ? 
      (process.env.SUBSCRIPTION_ANNUAL_PRICE || 500000) : 
      (process.env.SUBSCRIPTION_MONTHLY_PRICE || 50000);
    
    // Crear checkout en Wompi
    const checkout = await wompiService.createCheckout({
      amountInCents: price,
      currency: 'COP',
      reference: `SUB_${subscription._id}_${Date.now()}`,
      customerEmail: business.adminEmail || req.user.email, // Asumir que tenemos email del Admin
      customerName: business.businessName,
      redirectUrl: `${process.env.FRONTEND_URL}/${business.slug}/payment-callback`,
      businessId: business._id.toString(),
      subscriptionId: subscription._id.toString()
    });
    
    // Actualizar suscripción con datos del checkout
    subscription.wompiTransactionId = checkout.id;
    subscription.checkoutLink = checkout.link;
    subscription.lastPaymentAttempt = new Date();
    await subscription.save();
    
    logger.info('Checkout created for subscription', { 
      subscriptionId: subscription._id, 
      transactionId: checkout.id 
    }, req);
    
    res.json({
      success: true,
      checkoutLink: checkout.link,
      transactionId: checkout.id
    });
  } catch (error) {
    logger.error('Error creating checkout', error, req);
    res.status(500).json(formatHttpError(req, 'Error al crear checkout de pago', 500));
  }
});
```

---

### 1.3 Vista Frontend: `/admin/subscription`

**Archivo:** `Frontend/src/Pages/Admin.jsx`  
**Línea aproximada:** Agregar nueva pestaña en `activeTab === 'subscription'`

**Estructura de la vista:**
```jsx
// Frontend/src/Pages/Admin.jsx (agregar en el switch de tabs, línea ~1200)

{activeTab === 'subscription' && (
  <div className="space-y-6">
    {/* Card de Estado */}
    <SubscriptionPaymentCard />
    
    {/* Card de Detalles */}
    <SubscriptionDetailsCard />
    
    {/* Historial de Pagos */}
    <SubscriptionHistoryCard />
  </div>
)}
```

**Componente:** 🆕 `Frontend/src/Components/SubscriptionPaymentCard.jsx`

```jsx
// Frontend/src/Components/SubscriptionPaymentCard.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../Context/AuthContext';
import api from '../services/api';
import { motion } from 'framer-motion';

const SubscriptionPaymentCard = () => {
  const { businessId } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadSubscription();
  }, [businessId]);

  const loadSubscription = async () => {
    try {
      const res = await api.get('/subscriptions/me');
      if (res.data.success && res.data.subscription) {
        setSubscription(res.data.subscription);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = async () => {
    setProcessing(true);
    try {
      const res = await api.post('/subscriptions/checkout');
      if (res.data.success && res.data.checkoutLink) {
        // Redirigir a Wompi
        window.location.href = res.data.checkoutLink;
      }
    } catch (error) {
      alert('Error al crear checkout. Por favor intenta nuevamente.');
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse bg-gray-200 rounded-lg h-64" />;
  }

  if (!subscription) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4">Sin Suscripción</h3>
        <p className="text-gray-600 mb-4">Aún no tienes una suscripción activa.</p>
      </div>
    );
  }

  const statusBadge = {
    'active': { color: 'green', text: 'Activa' },
    'past_due': { color: 'orange', text: 'Pago vencido' },
    'grace': { color: 'yellow', text: 'En periodo de gracia' },
    'suspended': { color: 'red', text: 'Suspendida' },
    'canceled': { color: 'gray', text: 'Cancelada' }
  };

  const badge = statusBadge[subscription.status] || statusBadge.active;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow-lg p-6"
    >
      {/* Header con Badge */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Mi Suscripción</h2>
        <span className={`px-4 py-2 rounded-full text-sm font-semibold bg-${badge.color}-100 text-${badge.color}-800`}>
          {badge.text}
        </span>
      </div>

      {/* Banner de Alerta (si aplica) */}
      {(subscription.status === 'past_due' || subscription.status === 'grace') && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-orange-800 font-medium">
            Tu suscripción está vencida. Mantén tu acceso renovando ahora.
          </p>
        </div>
      )}

      {/* Fecha de Vencimiento */}
      <div className="mb-4">
        <p className="text-gray-600 text-sm">
          {subscription.status === 'active' ? 'Vence el' : 'Venció el'}{' '}
          <span className="font-semibold text-gray-800">
            {new Date(subscription.periodEnd).toLocaleDateString('es-CO', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            })}
          </span>
        </p>
      </div>

      {/* Último Pago */}
      {subscription.lastPayment && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">Último pago</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800">
                ${subscription.lastPayment.amount.toLocaleString('es-CO')} COP
              </p>
              <p className="text-xs text-gray-500">
                {new Date(subscription.lastPayment.date).toLocaleDateString('es-CO', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })} • {subscription.lastPayment.method}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              subscription.lastPayment.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
              subscription.lastPayment.status === 'DECLINED' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {subscription.lastPayment.status}
            </span>
          </div>
        </div>
      )}

      {/* CTA Principal */}
      <button
        onClick={handlePayNow}
        disabled={processing || subscription.status === 'active'}
        className={`w-full py-3 rounded-lg font-semibold text-white transition-colors ${
          subscription.status === 'active' 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {processing ? 'Redirigiendo a Wompi...' : subscription.status === 'active' ? 'Activa' : 'Pagar / Renovar ahora'}
      </button>
    </motion.div>
  );
};

export default SubscriptionPaymentCard;
```

**Componente:** 🆕 `Frontend/src/Components/SubscriptionDetailsCard.jsx`

```jsx
// Frontend/src/Components/SubscriptionDetailsCard.jsx
import React from 'react';

const SubscriptionDetailsCard = ({ subscription }) => {
  if (!subscription) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold mb-4">Detalles de la Suscripción</h3>
      
      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">Plan:</span>
          <span className="font-semibold text-gray-800">
            {subscription.plan === 'annual' ? '📅 Plan Anual' : '📆 Plan Mensual'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600">Período:</span>
          <span className="font-semibold text-gray-800">
            {new Date(subscription.periodStart).toLocaleDateString('es-CO', {
              day: '2-digit',
              month: '2-digit'
            })} - {new Date(subscription.periodEnd).toLocaleDateString('es-CO', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            })}
          </span>
        </div>
        
        {subscription.nextDueDate && (
          <div className="flex justify-between">
            <span className="text-gray-600">Próximo cobro:</span>
            <span className="font-semibold text-gray-800">
              {new Date(subscription.nextDueDate).toLocaleDateString('es-CO', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
              })}
            </span>
          </div>
        )}
        
        <div className="flex justify-between">
          <span className="text-gray-600">Días restantes:</span>
          <span className="font-semibold text-gray-800">{subscription.daysRemaining} días</span>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionDetailsCard;
```

**Integración en Admin.jsx:**
```jsx
// Frontend/src/Pages/Admin.jsx (agregar import, línea ~30)

import SubscriptionPaymentCard from '../Components/SubscriptionPaymentCard';
import SubscriptionDetailsCard from '../Components/SubscriptionDetailsCard';

// Luego en el switch de tabs (línea ~1200):
{activeTab === 'subscription' && (
  <div className="space-y-6">
    <SubscriptionPaymentCard />
    <SubscriptionDetailsCard subscription={/* state local */} />
  </div>
)}
```

---

## 🎯 PROMPT 2: PANEL SUPERADMIN - DASHBOARD GLOBAL

### Objetivo
Vista consolidada para SuperAdmin de todos los negocios y su estado de pagos, con KPIs y drill-down.

---

### 2.1 Endpoint: `GET /api/admin/subscriptions/overview`

**Archivo:** 🆕 `Backend/Routes/adminSubscriptions.js` (NUEVO)

**Funcionalidad:**
- Lista todos los negocios con su estado de suscripción
- Calcula KPIs agregados
- Soporta paginación y filtros

**Request:**
```http
GET /api/admin/subscriptions/overview?range=30d&status=active&page=1&limit=20
Authorization: Bearer {superadmin_token}
```

**Query Params:**
- `range`: `7d | 30d | 90d` (default: `30d`)
- `status`: `all | active | past_due | grace | suspended | canceled` (default: `all`)
- `page`: Número (default: `1`)
- `limit`: Número (default: `20`)

**Response (200 OK):**
```json
{
  "success": true,
  "kpis": {
    "totalBusinesses": 150,
    "active": 120,
    "pastDue": 15,
    "grace": 8,
    "suspended": 7,
    "churn30d": 12,
    "mrr30d": 6000000
  },
  "businesses": [
    {
      "businessId": "507f1f77bcf86cd799439011",
      "slug": "mi-restaurante",
      "name": "Mi Restaurante",
      "status": "active | past_due | grace | suspended | canceled",
      "plan": "monthly | annual",
      "periodEnd": "2025-02-01T00:00:00Z",
      "graceUntil": "2025-02-02T00:00:00Z" // null si no aplica
      "nextDueDate": "2025-02-01T00:00:00Z",
      "lastPayment": {
        "date": "2025-01-01T12:30:00Z",
        "amount": 50000,
        "currency": "COP",
        "status": "APPROVED | DECLINED | PENDING",
        "externalId": "WMPI_123456789"
      }
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

**Implementación:**
```javascript
// Backend/Routes/adminSubscriptions.js (NUEVO)

const express = require('express');
const router = express.Router();
const Subscription = require('../Models/Subscription');
const BusinessConfig = require('../Models/BusinessConfig');
const { protectSuperAdmin } = require('../middleware/authSuperAdmin');
const logger = require('../utils/logger');
const { formatHttpError } = require('../utils/errorFormatter');

router.use(protectSuperAdmin); // Todas las rutas requieren SuperAdmin

// GET /api/admin/subscriptions/overview
router.get('/overview', async (req, res) => {
  try {
    const { range = '30d', status = 'all', page = 1, limit = 20 } = req.query;
    
    // Calcular fecha de inicio según range
    const startDate = new Date();
    if (range === '7d') startDate.setDate(startDate.getDate() - 7);
    else if (range === '90d') startDate.setDate(startDate.getDate() - 90);
    else startDate.setDate(startDate.getDate() - 30);
    
    // Query base
    let query = {};
    if (status !== 'all') {
      query.status = status;
    }
    
    // Obtener todas las suscripciones con negocio
    const subscriptions = await Subscription.find(query)
      .populate('businessId', 'businessName slug')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) * 10); // Temporalmente más para calcular KPIs
    
    // Agrupar por businessId (solo la más reciente)
    const businessMap = new Map();
    subscriptions.forEach(sub => {
      if (!businessMap.has(sub.businessId._id.toString())) {
        businessMap.set(sub.businessId._id.toString(), sub);
      }
    });
    
    const allBusinesses = Array.from(businessMap.values());
    
    // Calcular KPIs
    const kpis = {
      totalBusinesses: allBusinesses.length,
      active: allBusinesses.filter(b => b.status === 'active').length,
      pastDue: allBusinesses.filter(b => b.status === 'expired' && !b.isInGracePeriod()).length,
      grace: allBusinesses.filter(b => b.isInGracePeriod()).length,
      suspended: allBusinesses.filter(b => b.status === 'cancelled').length,
      churn30d: 0, // TODO: Calcular basado en fechas
      mrr30d: 0 // TODO: Calcular MRR aprobado
    };
    
    // Paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedBusinesses = allBusinesses.slice(skip, skip + parseInt(limit));
    
    // Formatear respuesta
    const businesses = paginatedBusinesses.map(sub => ({
      businessId: sub.businessId._id,
      slug: sub.businessId.slug,
      name: sub.businessId.businessName,
      status: sub.status,
      plan: sub.planType,
      periodEnd: sub.endDate,
      graceUntil: sub.gracePeriodEnd,
      nextDueDate: sub.endDate,
      lastPayment: sub.paymentStatus === 'paid' ? {
        date: sub.updatedAt,
        amount: sub.price,
        currency: 'COP',
        status: 'APPROVED',
        externalId: sub.wompiTransactionId
      } : null
    }));
    
    res.json({
      success: true,
      kpis,
      businesses,
      pagination: {
        total: allBusinesses.length,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(allBusinesses.length / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching subscriptions overview', error, req);
    res.status(500).json(formatHttpError(req, 'Error al obtener overview', 500));
  }
});

module.exports = router;
```

**Registro en server.js:**
```javascript
// Backend/server.js (después de línea 126)
app.use("/api/subscriptions", require("./Routes/subscriptions"));
app.use("/api/admin/subscriptions", require("./Routes/adminSubscriptions")); // 🆕 NUEVO
```

---

### 2.2 Vista Frontend: `/superadmin/payments`

**Archivo:** 🆕 `Frontend/src/Pages/SuperAdmin/PaymentsDashboard.jsx` (NUEVO)

**Estructura:**
```jsx
// Frontend/src/Pages/SuperAdmin/PaymentsDashboard.jsx (NUEVO)
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import superadminApi from '../../services/superadminApi';

const PaymentsDashboard = () => {
  const [kpis, setKpis] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    range: '30d',
    status: 'all',
    page: 1
  });

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    try {
      const params = new URLSearchParams(filters).toString();
      const res = await superadminApi.get(`/admin/subscriptions/overview?${params}`);
      
      if (res.data.success) {
        setKpis(res.data.kpis);
        setBusinesses(res.data.businesses);
      }
    } catch (error) {
      console.error('Error loading payments data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* KPIs Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <KPICard label="Activos" value={kpis?.active || 0} color="green" />
        <KPICard label="En Gracia" value={kpis?.grace || 0} color="yellow" />
        <KPICard label="Suspendidos" value={kpis?.suspended || 0} color="red" />
        <KPICard label="Churn 30d" value={kpis?.churn30d || 0} color="orange" />
        <KPICard label="MRR 30d" value={`$${(kpis?.mrr30d / 1000000).toFixed(1)}M`} color="blue" />
      </div>

      {/* Filtros */}
      <div className="flex gap-4">
        <select value={filters.range} onChange={e => setFilters({...filters, range: e.target.value})}>
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
          <option value="90d">Últimos 90 días</option>
        </select>
        
        <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="past_due">Vencidos</option>
          <option value="grace">En gracia</option>
          <option value="suspended">Suspendidos</option>
        </select>
      </div>

      {/* Tabla */}
      <PaymentsTable businesses={businesses} loading={loading} />
    </div>
  );
};

const KPICard = ({ label, value, color }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`bg-white rounded-lg shadow p-4 border-l-4 border-${color}-500`}
  >
    <p className="text-sm text-gray-600">{label}</p>
    <p className="text-2xl font-bold text-gray-800">{value}</p>
  </motion.div>
);

const PaymentsTable = ({ businesses, loading }) => (
  <div className="bg-white rounded-lg shadow-lg overflow-hidden">
    <table className="w-full">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Negocio</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Estado</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Vence</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Último pago</th>
          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {businesses.map((business, idx) => (
          <tr key={idx} className="border-t hover:bg-gray-50">
            <td className="px-4 py-3">{business.name}</td>
            <td className="px-4 py-3">
              <Badge status={business.status} />
            </td>
            <td className="px-4 py-3">
              {new Date(business.periodEnd).toLocaleDateString('es-CO')}
            </td>
            <td className="px-4 py-3">
              {business.lastPayment ? (
                <>
                  <p className="text-sm">{new Date(business.lastPayment.date).toLocaleDateString('es-CO')}</p>
                  <p className="text-xs text-gray-500">${business.lastPayment.amount.toLocaleString()}</p>
                </>
              ) : '-'}
            </td>
            <td className="px-4 py-3">
              <button className="text-blue-600 hover:underline">Ver detalle</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Badge = ({ status }) => {
  const badges = {
    'active': 'bg-green-100 text-green-800',
    'past_due': 'bg-orange-100 text-orange-800',
    'grace': 'bg-yellow-100 text-yellow-800',
    'suspended': 'bg-red-100 text-red-800',
    'canceled': 'bg-gray-100 text-gray-800'
  };
  
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badges[status] || badges.canceled}`}>
      {status}
    </span>
  );
};

export default PaymentsDashboard;
```

**Registro en App.jsx:**
```jsx
// Frontend/src/App.jsx (agregar ruta SuperAdmin, línea ~100)

import PaymentsDashboard from './Pages/SuperAdmin/PaymentsDashboard';

// En rutas (línea ~200):
<Route path="/superadmin/payments" element={
  <ProtectedRoute>
    <PaymentsDashboard />
  </ProtectedRoute>
} />
```

---

## 📋 TABLA RESUMEN DE CAMBIOS

| Componente | Archivo | Tipo | Líneas |
|------------|---------|------|--------|
| **Backend** |
| GET /subscriptions/me | `subscriptions.js` | Modificar | +80 líneas |
| POST /subscriptions/checkout | `subscriptions.js` | Agregar | +60 líneas |
| adminSubscriptions router | `adminSubscriptions.js` | 🆕 NUEVO | ~150 líneas |
| Registrar ruta admin | `server.js` | Modificar | +1 línea |
| wompiService | `services/wompiService.js` | 🆕 NUEVO | ~200 líneas |
| **Frontend** |
| SubscriptionPaymentCard | `SubscriptionPaymentCard.jsx` | 🆕 NUEVO | ~150 líneas |
| SubscriptionDetailsCard | `SubscriptionDetailsCard.jsx` | 🆕 NUEVO | ~60 líneas |
| PaymentsDashboard | `SuperAdmin/PaymentsDashboard.jsx` | 🆕 NUEVO | ~200 líneas |
| Integrar tabs en Admin | `Admin.jsx` | Modificar | +20 líneas |
| Ruta SuperAdmin | `App.jsx` | Modificar | +5 líneas |
| **Modelos** |
| Subscription (wompi fields) | `Subscription.js` | Modificar | +20 líneas |

**Total aprox.:** ~1,066 líneas nuevas + ~100 modificadas

---

## ✅ CRITERIOS DE ACEPTACIÓN

### Panel Admin
- [ ] GET /subscriptions/me retorna datos correctos del negocio autenticado
- [ ] POST /subscriptions/checkout crea checkout en Wompi
- [ ] Botón "Pagar" redirige a Wompi
- [ ] Vista muestra estado, vencimiento y último pago
- [ ] Banner de alerta aparece en grace/past_due
- [ ] No hay fugas de datos entre tenants

### Panel SuperAdmin
- [ ] GET /admin/subscriptions/overview retorna KPIs correctos
- [ ] Tabla muestra todos los negocios con estado
- [ ] Filtros por range y status funcionan
- [ ] Paginación funciona correctamente
- [ ] KPIs coinciden con datos reales
- [ ] Solo SuperAdmin puede acceder

---

**FIN DE LA ESPECIFICACIÓN**

