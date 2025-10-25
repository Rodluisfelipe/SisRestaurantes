# 📍 Sistema de Zonas de Entrega - Documentación

## 📋 Tabla de Contenidos
1. [Descripción General](#descripción-general)
2. [Características](#características)
3. [Arquitectura](#arquitectura)
4. [Backend - API](#backend---api)
5. [Frontend - Componentes](#frontend---componentes)
6. [Modelos de Datos](#modelos-de-datos)
7. [Casos de Uso](#casos-de-uso)
8. [Instalación y Configuración](#instalación-y-configuración)
9. [Ejemplos de Uso](#ejemplos-de-uso)

---

## 🎯 Descripción General

El Sistema de Zonas de Entrega permite a los administradores de restaurantes:
- ✅ Definir múltiples zonas de entrega con áreas geográficas personalizadas
- ✅ Configurar precios de envío por zona (fijo, por distancia, o por tramos)
- ✅ Establecer tiempos estimados de entrega
- ✅ Verificar automáticamente si un cliente está en el área de cobertura
- ✅ Calcular costos de envío dinámicamente

Los clientes pueden:
- ✅ Verificar si su dirección tiene cobertura
- ✅ Ver el costo de envío y tiempo estimado
- ✅ Visualizar las zonas de entrega en un mapa interactivo

---

## ⭐ Características

### Para Administradores
- 🗺️ **Mapas Interactivos**: Dibuja zonas usando polígonos o círculos
- 💰 **Múltiples Modos de Precio**: Fijo, por distancia, o por tramos
- ⏱️ **Tiempos Estimados**: Define rangos de tiempo para cada zona
- 🎨 **Colores Personalizados**: Diferencia visualmente tus zonas
- 📊 **Estadísticas**: Seguimiento de pedidos y ingresos por zona
- 🔄 **Prioridades**: Resuelve superposiciones de zonas
- 📅 **Horarios**: Configura disponibilidad por día y hora (opcional)

### Para Clientes
- 📍 **Ubicación Actual**: Usa GPS para verificar cobertura
- 🔍 **Búsqueda de Dirección**: Encuentra ubicaciones por dirección
- 🗺️ **Vista de Mapa**: Visualiza áreas de cobertura
- 💵 **Cálculo Automático**: Conoce el costo antes de pedir

---

## 🏗️ Arquitectura

### Backend
```
Backend/
├── Models/
│   ├── DeliveryZone.js          # Modelo de zona de entrega
│   └── Order.js                 # Modelo actualizado con info de zona
├── Routes/
│   └── deliveryZones.js         # Endpoints de la API
├── services/
│   └── deliveryZoneService.js   # Lógica de negocio
└── utils/
    ├── geocoding.js             # Servicios de geocodificación
    └── geospatial.js            # Cálculos geoespaciales
```

### Frontend
```
Frontend/
└── src/
    └── Components/
        ├── DeliveryZoneManager.jsx       # Panel de administración
        └── DeliveryCoverageChecker.jsx   # Verificación de cobertura
```

---

## 🔌 Backend - API

### Endpoints de Administración (Requieren autenticación)

#### 1. Obtener todas las zonas
```http
GET /api/delivery-zones
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "zones": [...],
  "total": 3
}
```

#### 2. Crear zona
```http
POST /api/delivery-zones
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Zona Centro",
  "description": "Centro de la ciudad",
  "type": "polygon",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[lon, lat], [lon, lat], ...]]
  },
  "pricing": {
    "mode": "fixed",
    "basePrice": 5000,
    "minimumOrder": 20000
  },
  "estimatedTime": {
    "min": 30,
    "max": 45
  },
  "priority": 1,
  "color": "#3B82F6"
}
```

#### 3. Actualizar zona
```http
PUT /api/delivery-zones/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Zona Centro Actualizada",
  "pricing": {
    "basePrice": 6000
  }
}
```

#### 4. Eliminar zona
```http
DELETE /api/delivery-zones/:id
Authorization: Bearer {token}
```

#### 5. Activar/Desactivar zona
```http
PATCH /api/delivery-zones/:id/toggle
Authorization: Bearer {token}
```

#### 6. Duplicar zona
```http
POST /api/delivery-zones/:id/duplicate
Authorization: Bearer {token}
```

### Endpoints Públicos

#### 7. Verificar cobertura
```http
POST /api/delivery-zones/check-coverage
Content-Type: application/json

{
  "adminId": "60d5ec49f1b2c72b8c8e4a1b",
  "lat": 4.7110,
  "lon": -74.0721,
  "orderTotal": 35000
}
```

**Respuesta (Con cobertura):**
```json
{
  "success": true,
  "covered": true,
  "zone": {
    "id": "60d5ec49f1b2c72b8c8e4a1c",
    "name": "Zona Centro",
    "color": "#3B82F6"
  },
  "delivery": {
    "price": 5000,
    "estimatedTime": { "min": 30, "max": 45 },
    "minimumOrder": 20000,
    "distance": 2.5
  },
  "valid": true
}
```

**Respuesta (Sin cobertura):**
```json
{
  "success": true,
  "covered": false,
  "message": "Esta ubicación está fuera del área de entrega"
}
```

#### 8. Geocodificar dirección
```http
POST /api/delivery-zones/geocode
Content-Type: application/json

{
  "address": "Calle 100 #10-20, Bogotá",
  "country": "CO"
}
```

#### 9. Geocodificación inversa
```http
POST /api/delivery-zones/reverse-geocode
Content-Type: application/json

{
  "lat": 4.7110,
  "lon": -74.0721
}
```

---

## 🎨 Frontend - Componentes

### DeliveryZoneManager

Panel completo de administración de zonas.

**Uso:**
```jsx
import DeliveryZoneManager from './Components/DeliveryZoneManager';

function AdminPanel() {
  return <DeliveryZoneManager />;
}
```

**Características:**
- Mapa interactivo con todas las zonas
- Lista de zonas con acciones (editar, duplicar, eliminar)
- Modal de creación/edición con mapa de dibujo
- Configuración de precios y tiempos
- Estadísticas por zona

### DeliveryCoverageChecker

Componente para que los clientes verifiquen cobertura.

**Uso:**
```jsx
import DeliveryCoverageChecker from './Components/DeliveryCoverageChecker';

function CheckoutPage() {
  const [coverageData, setCoverageData] = useState(null);

  const handleCoverageResult = (result) => {
    setCoverageData(result);
    
    if (result.covered && result.valid) {
      // Proceder con el pedido
      // Agregar deliveryFee al total
    }
  };

  return (
    <DeliveryCoverageChecker
      adminId={businessId}
      orderTotal={cartTotal}
      onCoverageResult={handleCoverageResult}
    />
  );
}
```

---

## 📊 Modelos de Datos

### DeliveryZone

```javascript
{
  adminId: ObjectId,              // ID del negocio
  name: String,                   // Nombre de la zona
  description: String,            // Descripción opcional
  type: "polygon" | "radius",     // Tipo de área
  geometry: {                     // GeoJSON
    type: "Polygon" | "Point",
    coordinates: [[lon, lat], ...],
    radius?: Number               // Solo para tipo "radius"
  },
  pricing: {
    mode: "fixed" | "distance" | "tiered",
    basePrice: Number,
    pricePerKm?: Number,          // Para modo "distance"
    freeDistanceKm?: Number,
    minimumOrder: Number,
    tiers?: [{                    // Para modo "tiered"
      maxDistance: Number,
      price: Number
    }]
  },
  estimatedTime: {
    min: Number,                  // Minutos
    max: Number
  },
  priority: Number,               // 1-100, mayor = más prioridad
  color: String,                  // Hex color
  isActive: Boolean,
  schedule: {                     // Horarios opcionales
    enabled: Boolean,
    days: [{
      day: Number,                // 0-6 (Domingo-Sábado)
      openTime: String,           // "HH:mm"
      closeTime: String
    }]
  },
  stats: {
    totalOrders: Number,
    totalRevenue: Number,
    lastOrderDate: Date
  }
}
```

### Order (Campos añadidos)

```javascript
{
  // ... campos existentes ...
  deliveryZoneId: ObjectId,
  deliveryZoneName: String,
  deliveryFee: Number,
  deliveryCoordinates: {
    lat: Number,
    lon: Number
  },
  deliveryDistance: Number,
  estimatedDeliveryTime: {
    min: Number,
    max: Number
  }
}
```

---

## 💼 Casos de Uso

### Caso 1: Configurar Zona con Tarifa Fija

```javascript
// Admin crea zona simple con precio fijo
const zone = {
  name: "Zona Centro",
  type: "polygon",
  geometry: { /* coordenadas del polígono */ },
  pricing: {
    mode: "fixed",
    basePrice: 5000,
    minimumOrder: 20000
  },
  estimatedTime: { min: 30, max: 45 }
};
```

### Caso 2: Zona con Precio por Distancia

```javascript
const zone = {
  name: "Zona Norte",
  type: "radius",
  geometry: {
    type: "Point",
    coordinates: [-74.0721, 4.7110],
    radius: 5000  // 5km
  },
  pricing: {
    mode: "distance",
    basePrice: 3000,          // Precio base
    pricePerKm: 1000,         // $1000 por km adicional
    freeDistanceKm: 2,        // Primeros 2km gratis
    minimumOrder: 15000
  },
  estimatedTime: { min: 35, max: 60 }
};
```

### Caso 3: Zona con Tramos de Precio

```javascript
const zone = {
  name: "Zona Sur",
  type: "polygon",
  geometry: { /* ... */ },
  pricing: {
    mode: "tiered",
    basePrice: 0,
    tiers: [
      { maxDistance: 3, price: 4000 },    // 0-3km: $4000
      { maxDistance: 7, price: 7000 },    // 3-7km: $7000
      { maxDistance: 15, price: 12000 }   // 7-15km: $12000
    ],
    minimumOrder: 25000
  },
  estimatedTime: { min: 40, max: 70 }
};
```

### Caso 4: Verificar Cobertura en Checkout

```javascript
// En el componente de checkout
const handleCheckout = async () => {
  // 1. Verificar cobertura
  const coverage = await api.post('/delivery-zones/check-coverage', {
    adminId: businessId,
    lat: userLat,
    lon: userLon,
    orderTotal: cartTotal
  });

  if (!coverage.data.covered) {
    alert('No entregamos en tu zona');
    return;
  }

  if (!coverage.data.valid) {
    alert(coverage.data.error); // Ej: "Pedido mínimo no alcanzado"
    return;
  }

  // 2. Crear pedido con información de zona
  const order = {
    // ... datos del pedido ...
    deliveryZoneId: coverage.data.zone.id,
    deliveryZoneName: coverage.data.zone.name,
    deliveryFee: coverage.data.delivery.price,
    deliveryCoordinates: { lat: userLat, lon: userLon },
    deliveryDistance: coverage.data.delivery.distance,
    estimatedDeliveryTime: coverage.data.delivery.estimatedTime,
    totalAmount: cartTotal + coverage.data.delivery.price
  };

  await api.post('/orders', order);
};
```

---

## 🚀 Instalación y Configuración

### 1. Dependencias Backend

Las dependencias ya están incluidas en el proyecto:
- `express`
- `mongoose`
- `axios` (para geocodificación)
- `express-rate-limit`

### 2. Dependencias Frontend

```bash
cd Frontend
npm install leaflet react-leaflet@4.2.1 leaflet-draw --legacy-peer-deps
```

### 3. Importar CSS de Leaflet

En tu archivo principal de CSS (`index.css`):

```css
@import 'leaflet/dist/leaflet.css';
@import 'leaflet-draw/dist/leaflet.draw.css';
```

### 4. Configurar Rutas

En tu archivo de rutas (ej: `App.jsx`):

```jsx
import DeliveryZoneManager from './Components/DeliveryZoneManager';

// En el admin panel
<Route path="/admin/delivery-zones" element={<DeliveryZoneManager />} />
```

### 5. Variables de Entorno

No requiere variables de entorno adicionales. Usa Nominatim (OpenStreetMap) que es gratuito.

---

## 📝 Ejemplos de Uso

### Ejemplo 1: Integrar en el Admin Panel

```jsx
// AdminPanel.jsx
import { useState } from 'react';
import DeliveryZoneManager from './Components/DeliveryZoneManager';

function AdminPanel() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div>
      <nav>
        <button onClick={() => setActiveTab('dashboard')}>Dashboard</button>
        <button onClick={() => setActiveTab('products')}>Productos</button>
        <button onClick={() => setActiveTab('zones')}>Zonas de Entrega</button>
      </nav>

      {activeTab === 'zones' && <DeliveryZoneManager />}
    </div>
  );
}
```

### Ejemplo 2: Integrar en el Checkout

```jsx
// Checkout.jsx
import { useState } from 'react';
import DeliveryCoverageChecker from './Components/DeliveryCoverageChecker';

function Checkout({ cart, businessId }) {
  const [deliveryInfo, setDeliveryInfo] = useState(null);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCoverageResult = (result) => {
    setDeliveryInfo(result);
  };

  const handlePlaceOrder = async () => {
    if (!deliveryInfo || !deliveryInfo.covered) {
      alert('Por favor verifica tu dirección de entrega');
      return;
    }

    const finalTotal = cartTotal + deliveryInfo.delivery.price;

    const order = {
      items: cart,
      totalAmount: finalTotal,
      deliveryFee: deliveryInfo.delivery.price,
      deliveryZoneId: deliveryInfo.zone.id,
      deliveryZoneName: deliveryInfo.zone.name,
      // ... otros campos
    };

    // Enviar orden
    await api.post('/orders', order);
  };

  return (
    <div>
      <h1>Checkout</h1>
      
      <div className="cart-summary">
        <p>Subtotal: ${cartTotal}</p>
        {deliveryInfo?.covered && (
          <p>Envío: ${deliveryInfo.delivery.price}</p>
        )}
        <p>Total: ${cartTotal + (deliveryInfo?.delivery?.price || 0)}</p>
      </div>

      <DeliveryCoverageChecker
        adminId={businessId}
        orderTotal={cartTotal}
        onCoverageResult={handleCoverageResult}
      />

      <button 
        onClick={handlePlaceOrder}
        disabled={!deliveryInfo?.valid}
      >
        Realizar Pedido
      </button>
    </div>
  );
}
```

### Ejemplo 3: Mostrar Zonas en Landing Page

```jsx
// LandingPage.jsx
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon } from 'react-leaflet';
import api from './services/api';

function DeliveryAreasPreview({ businessId }) {
  const [zones, setZones] = useState([]);

  useEffect(() => {
    loadZones();
  }, []);

  const loadZones = async () => {
    const res = await api.get('/delivery-zones', { params: { adminId: businessId } });
    setZones(res.data.zones.filter(z => z.isActive));
  };

  return (
    <div>
      <h2>Áreas de Entrega</h2>
      <div style={{ height: '400px' }}>
        <MapContainer center={[4.7110, -74.0721]} zoom={12}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {zones.map(zone => (
            zone.type === 'polygon' && (
              <Polygon
                key={zone.id}
                positions={zone.geometry.coordinates[0].map(c => [c[1], c[0]])}
                pathOptions={{ color: zone.color, fillOpacity: 0.3 }}
              />
            )
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
```

---

## 🎯 Mejores Prácticas

### Para Administradores

1. **Prioridades**: Usa prioridades más altas para zonas más específicas
2. **Colores**: Usa colores distintivos para cada zona
3. **Mínimos**: Establece mínimos de pedido realistas
4. **Tiempos**: Sé conservador con los tiempos estimados
5. **Testing**: Prueba la cobertura desde diferentes ubicaciones

### Para Desarrollo

1. **Cache**: La geocodificación usa cache interno para reducir llamadas API
2. **Rate Limiting**: Los endpoints tienen límites de tasa configurados
3. **Validación**: Usa las funciones de validación antes de guardar
4. **Índices**: Los índices de MongoDB están optimizados para consultas frecuentes
5. **Logs**: Revisa los logs del servidor para debugging

---

## 🐛 Solución de Problemas

### Problema: "No se pueden cargar los mapas"
**Solución**: Verifica que los CSS de Leaflet estén importados correctamente.

### Problema: "Error al geocodificar"
**Solución**: Nominatim tiene rate limiting. El sistema usa cache para mitigar esto.

### Problema: "Las zonas no se muestran en el mapa"
**Solución**: Verifica que las coordenadas estén en formato [lon, lat] (GeoJSON estándar).

### Problema: "Error de dependencias en npm install"
**Solución**: Usa `--legacy-peer-deps` al instalar react-leaflet.

---

## 📞 Soporte

Para preguntas o problemas:
1. Revisa esta documentación
2. Verifica los logs del servidor
3. Contacta al equipo de desarrollo

---

## 📄 Licencia

Sistema desarrollado para SisRestaurantes © 2025

