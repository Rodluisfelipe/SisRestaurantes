# Notificaciones Push (PWA) - Menuby

## 📋 Descripción

Sistema de notificaciones push multi-tenant para alertar a admins/comercios sobre:
- **Pedido listo**: Cuando un pedido cambia a estado `ready` o `completed`
- **Cambio de estado**: Cada transición de estado de pedido (`pending` → `preparing` → `ready` → `delivered`)

## 🔧 Configuración

### 1. Generar claves VAPID

Las claves VAPID son necesarias para autenticar las notificaciones push.

```bash
# Instalar web-push globalmente
npm install -g web-push

# Generar claves VAPID
web-push generate-vapid-keys
```

Salida esperada:
```
=======================================
Public Key:
BG...xyz (clave pública larga)

Private Key:
abc...123 (clave privada larga)
=======================================
```

### 2. Configurar variables de entorno

#### Backend (.env)
```env
# Push Notifications (VAPID)
VAPID_PUBLIC=BG...xyz
VAPID_PRIVATE=abc...123
VAPID_MAILTO=mailto:admin@menuby.tech
```

#### Frontend (.env)
```env
# Push Notifications
VITE_VAPID_PUBLIC=BG...xyz
```

**⚠️ IMPORTANTE:** La clave pública (`VAPID_PUBLIC`) debe ser la misma en backend y frontend.

### 3. Instalar dependencias

#### Backend
```bash
cd Backend
npm install web-push
```

#### Frontend
No requiere dependencias adicionales (usa APIs nativas del navegador).

## 🚀 Uso

### Activar notificaciones (Frontend)

```jsx
import PushNotificationToggle from './Components/PushNotificationToggle';

function AdminPanel() {
  const businessId = 'your-business-id';
  const userId = 'optional-user-id';

  return (
    <div>
      <h1>Panel de Administración</h1>
      <PushNotificationToggle businessId={businessId} userId={userId} />
    </div>
  );
}
```

### Flujo de suscripción

1. Usuario hace clic en "Activar Alertas"
2. El navegador solicita permiso de notificaciones
3. Si se acepta, se registra el Service Worker (`/sw.js`)
4. Se crea una suscripción push con las claves VAPID
5. La suscripción se envía al backend (`POST /api/push/subscribe`)
6. El backend guarda la suscripción asociada al `businessId`

### Envío de notificaciones (Backend)

Las notificaciones se envían automáticamente cuando:
- Se actualiza el estado de un pedido (`PATCH /api/orders/:id/status`)
- El estado cambia a `ready` o `completed` (notificación especial)

```javascript
// Ejemplo manual de envío
const { sendOrderReadyPush } = require('./services/pushService');

await sendOrderReadyPush(businessId, order);
```

## 📱 Compatibilidad

### Navegadores Desktop
| Navegador | Soporte | Notas |
|-----------|---------|-------|
| Chrome | ✅ Completo | Versión 50+ |
| Firefox | ✅ Completo | Versión 44+ |
| Edge | ✅ Completo | Versión 17+ |
| Safari | ✅ Completo | Versión 16+ (macOS 13+) |
| Opera | ✅ Completo | Versión 37+ |

### Navegadores Móviles
| Navegador | Soporte | Notas |
|-----------|---------|-------|
| Chrome Android | ✅ Completo | Funciona en segundo plano |
| Firefox Android | ✅ Completo | Funciona en segundo plano |
| Safari iOS | ⚠️ Limitado | **Solo si la PWA está instalada** |
| Samsung Internet | ✅ Completo | Versión 4+ |

### ⚠️ Limitaciones en iOS

**Safari en iOS solo soporta push notifications si:**
1. La PWA está **instalada en la pantalla de inicio**
2. El usuario abre la app desde el ícono instalado (no desde Safari)
3. iOS 16.4+ (lanzado en marzo 2023)

**Pasos para instalar PWA en iOS:**
1. Abrir `https://www.menuby.tech` en Safari
2. Tocar el botón "Compartir" (ícono de cuadrado con flecha)
3. Seleccionar "Añadir a pantalla de inicio"
4. Abrir la app desde el ícono en la pantalla de inicio
5. Activar notificaciones desde el panel de admin

## 🔒 Seguridad y Privacidad

### Multi-tenancy estricto
- Cada suscripción se asocia a un `businessId`
- Al enviar notificaciones, solo se envían a suscripciones del mismo tenant
- No hay fuga de notificaciones entre negocios

### Sin PII en payloads
Los payloads de notificaciones **NO incluyen**:
- Teléfonos de clientes
- Direcciones completas
- Datos personales sensibles

Solo se envían:
- Título genérico ("Pedido listo")
- Número de pedido
- URL para abrir el detalle en el admin

Ejemplo de payload:
```json
{
  "title": "🔔 Pedido listo",
  "body": "Pedido #123 está listo",
  "clickUrl": "/admin?orderId=abc123",
  "data": {
    "orderId": "abc123",
    "orderNumber": "123",
    "type": "order_ready"
  }
}
```

### Limpieza automática
Si una suscripción expira (endpoint devuelve `410 Gone`), se elimina automáticamente de la base de datos.

## 🧪 Pruebas

### Prueba manual

1. **Activar notificaciones:**
   ```
   1. Abrir panel de admin
   2. Hacer clic en "Activar Alertas"
   3. Aceptar permiso del navegador
   4. Verificar mensaje de confirmación
   ```

2. **Probar notificación:**
   ```
   1. Crear un pedido de prueba
   2. Cambiar estado a "ready" o "completed"
   3. Verificar que llega la notificación push
   4. Hacer clic en la notificación
   5. Verificar que abre el pedido correcto
   ```

3. **Verificar multi-tenancy:**
   ```
   1. Suscribirse desde negocio A
   2. Crear pedido en negocio B
   3. Verificar que NO llega notificación a negocio A
   4. Crear pedido en negocio A
   5. Verificar que SÍ llega notificación a negocio A
   ```

### Verificar suscripciones activas

```bash
# GET /api/push/subscriptions?businessId=<id>
curl -X GET "https://api.menuby.tech/api/push/subscriptions?businessId=go-burger"
```

Respuesta:
```json
{
  "success": true,
  "count": 2,
  "subscriptions": [
    {
      "id": "abc123",
      "endpoint": "https://fcm.googleapis.com/fcm/send/...",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

## 🐛 Troubleshooting

### "Push notifications no están soportadas"
- Verificar que el navegador sea compatible
- En iOS, verificar que la PWA esté instalada
- Verificar que el sitio use HTTPS (push requiere conexión segura)

### "Permiso de notificaciones denegado"
- El usuario debe ir a la configuración del navegador
- Chrome: `chrome://settings/content/notifications`
- Firefox: `about:preferences#privacy` → Permisos → Notificaciones
- Safari: Preferencias → Sitios web → Notificaciones

### "VAPID public key no configurada"
- Verificar que `VITE_VAPID_PUBLIC` esté en `.env` del frontend
- Verificar que `VAPID_PUBLIC` y `VAPID_PRIVATE` estén en `.env` del backend
- Reiniciar el servidor después de cambiar `.env`

### "Service Worker registration failed"
- Verificar que `/sw.js` esté accesible en `Frontend/public/sw.js`
- Verificar que el sitio use HTTPS (SW requiere conexión segura)
- Limpiar cache del navegador y recargar

### Notificaciones no llegan
1. Verificar que la suscripción esté guardada:
   ```bash
   GET /api/push/subscriptions?businessId=<id>
   ```

2. Verificar logs del backend:
   ```bash
   docker logs sisrestaurantes-backend --tail 100
   ```

3. Verificar que el Service Worker esté activo:
   - Chrome DevTools → Application → Service Workers
   - Debe aparecer "Activated and is running"

4. Verificar que el `businessId` coincida:
   - La suscripción debe estar asociada al mismo `businessId` del pedido

## 📚 Referencias

- [Web Push Protocol](https://datatracker.ietf.org/doc/html/rfc8030)
- [VAPID Specification](https://datatracker.ietf.org/doc/html/rfc8292)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [iOS PWA Push Notifications](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

## 📝 Notas de implementación

### Archivos creados/modificados

**Backend:**
- `Backend/Models/PushSubscription.js` - Modelo de suscripciones
- `Backend/services/pushService.js` - Servicio de envío de push
- `Backend/Routes/push.js` - Endpoints de suscripción
- `Backend/Routes/orders.js:410-422` - Integración en flujo de órdenes
- `Backend/server.js:132,167-168` - Registro de rutas y configuración VAPID
- `Backend/package.json:31` - Dependencia `web-push`

**Frontend:**
- `Frontend/public/sw.js` - Service Worker
- `Frontend/src/utils/pushNotifications.js` - Utilidades de push
- `Frontend/src/Components/PushNotificationToggle.jsx` - Componente UI

### Variables de entorno requeridas

**Backend:**
```env
VAPID_PUBLIC=<clave-publica>
VAPID_PRIVATE=<clave-privada>
VAPID_MAILTO=mailto:admin@menuby.tech
```

**Frontend:**
```env
VITE_VAPID_PUBLIC=<clave-publica>
```

### Endpoints API

- `POST /api/push/subscribe` - Suscribirse a notificaciones
- `POST /api/push/unsubscribe` - Desuscribirse
- `GET /api/push/subscriptions` - Listar suscripciones (debug)

---

**Versión:** 1.0.0  
**Última actualización:** 2025-01-15

