# 🔌 Ejemplos de Integración - Zonas de Entrega

Este archivo contiene ejemplos prácticos de cómo integrar el sistema de zonas de entrega en diferentes partes de tu aplicación.

---

## 📱 Ejemplo 1: Integración Completa en el Proceso de Pedido

### Paso 1: Componente de Checkout

```jsx
// Frontend/src/Pages/Checkout.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DeliveryCoverageChecker from '../Components/DeliveryCoverageChecker';
import api from '../services/api';

function Checkout() {
  const navigate = useNavigate();
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState('delivery');
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    address: ''
  });
  const [deliveryCoverage, setDeliveryCoverage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Cargar carrito del localStorage
  useEffect(() => {
    const savedCart = JSON.parse(localStorage.getItem('cart') || '[]');
    setCart(savedCart);
  }, []);

  // Calcular subtotal
  const subtotal = cart.reduce((sum, item) => 
    sum + (item.price * item.quantity), 0
  );

  // Calcular total con envío
  const deliveryFee = deliveryCoverage?.covered && deliveryCoverage.valid 
    ? deliveryCoverage.delivery.price 
    : 0;
  const total = subtotal + deliveryFee;

  // Manejar resultado de cobertura
  const handleCoverageResult = (result) => {
    setDeliveryCoverage(result);
    
    if (!result.covered) {
      alert('Lo sentimos, no entregamos en tu zona');
    } else if (!result.valid) {
      alert(result.error || 'No se puede realizar el pedido en esta zona');
    }
  };

  // Procesar pedido
  const handlePlaceOrder = async () => {
    // Validaciones
    if (!customerInfo.name.trim()) {
      alert('Por favor ingresa tu nombre');
      return;
    }

    if (!customerInfo.phone.trim()) {
      alert('Por favor ingresa tu teléfono');
      return;
    }

    if (orderType === 'delivery') {
      if (!deliveryCoverage) {
        alert('Por favor verifica tu dirección de entrega');
        return;
      }

      if (!deliveryCoverage.covered || !deliveryCoverage.valid) {
        alert('No se puede entregar en esta zona o no cumples con el pedido mínimo');
        return;
      }
    }

    try {
      setIsProcessing(true);

      const orderData = {
        customerName: customerInfo.name,
        phone: customerInfo.phone,
        orderType: orderType,
        items: cart.map(item => ({
          productId: item.productId || item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          selectedToppings: item.selectedToppings || []
        })),
        totalAmount: subtotal
      };

      // Agregar información de entrega si aplica
      if (orderType === 'delivery' && deliveryCoverage?.covered) {
        orderData.address = customerInfo.address;
        orderData.deliveryZoneId = deliveryCoverage.zone.id;
        orderData.deliveryZoneName = deliveryCoverage.zone.name;
        orderData.deliveryFee = deliveryCoverage.delivery.price;
        orderData.deliveryCoordinates = {
          lat: deliveryCoverage.coordinates?.lat,
          lon: deliveryCoverage.coordinates?.lon
        };
        orderData.deliveryDistance = deliveryCoverage.delivery.distance;
        orderData.estimatedDeliveryTime = deliveryCoverage.delivery.estimatedTime;
        orderData.totalAmount = total;
      }

      // Crear el pedido
      const response = await api.post('/orders', orderData);

      if (response.data.success) {
        // Limpiar carrito
        localStorage.removeItem('cart');
        
        // Mostrar confirmación
        alert(`¡Pedido creado! Número: ${response.data.order.orderNumber}`);
        
        // Redirigir
        navigate('/order-success');
      }
    } catch (error) {
      console.error('Error al crear pedido:', error);
      alert(error.response?.data?.message || 'Error al crear el pedido');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Finalizar Pedido</h1>

      {/* Resumen del carrito */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Tu Pedido</h2>
        {cart.map((item, index) => (
          <div key={index} className="flex justify-between py-2 border-b">
            <span>{item.name} x{item.quantity}</span>
            <span>${item.price * item.quantity}</span>
          </div>
        ))}
        
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-lg">
            <span>Subtotal:</span>
            <span>${subtotal}</span>
          </div>
          
          {orderType === 'delivery' && deliveryCoverage?.covered && (
            <div className="flex justify-between text-lg">
              <span>Envío:</span>
              <span>${deliveryFee}</span>
            </div>
          )}
          
          <div className="flex justify-between text-xl font-bold border-t pt-2">
            <span>Total:</span>
            <span>${total}</span>
          </div>
        </div>
      </div>

      {/* Tipo de pedido */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Tipo de Pedido</h2>
        <div className="flex gap-4">
          <button
            onClick={() => setOrderType('delivery')}
            className={`flex-1 py-3 rounded-lg border-2 ${
              orderType === 'delivery' 
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300'
            }`}
          >
            🚚 Domicilio
          </button>
          <button
            onClick={() => setOrderType('takeaway')}
            className={`flex-1 py-3 rounded-lg border-2 ${
              orderType === 'takeaway'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300'
            }`}
          >
            🏃 Para Llevar
          </button>
        </div>
      </div>

      {/* Información del cliente */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Información de Contacto</h2>
        <div className="space-y-4">
          <div>
            <label className="block font-medium mb-2">Nombre *</label>
            <input
              type="text"
              value={customerInfo.name}
              onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
              className="w-full border rounded px-4 py-2"
              placeholder="Tu nombre completo"
            />
          </div>
          
          <div>
            <label className="block font-medium mb-2">Teléfono *</label>
            <input
              type="tel"
              value={customerInfo.phone}
              onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
              className="w-full border rounded px-4 py-2"
              placeholder="3001234567"
            />
          </div>

          {orderType === 'delivery' && (
            <div>
              <label className="block font-medium mb-2">Dirección *</label>
              <input
                type="text"
                value={customerInfo.address}
                onChange={(e) => setCustomerInfo({...customerInfo, address: e.target.value})}
                className="w-full border rounded px-4 py-2"
                placeholder="Calle 100 #10-20"
              />
            </div>
          )}
        </div>
      </div>

      {/* Verificador de cobertura (solo para delivery) */}
      {orderType === 'delivery' && (
        <DeliveryCoverageChecker
          adminId={localStorage.getItem('businessId')}
          orderTotal={subtotal}
          onCoverageResult={handleCoverageResult}
        />
      )}

      {/* Botón de confirmar */}
      <button
        onClick={handlePlaceOrder}
        disabled={isProcessing || (orderType === 'delivery' && !deliveryCoverage?.valid)}
        className="w-full bg-blue-600 text-white py-4 rounded-lg text-lg font-semibold 
                   hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isProcessing ? 'Procesando...' : `Confirmar Pedido - $${total}`}
      </button>
    </div>
  );
}

export default Checkout;
```

---

## 🎛️ Ejemplo 2: Integración en Panel de Administración

### Agregar al menú de administración

```jsx
// Frontend/src/Pages/Admin.jsx
import { useState } from 'react';
import DeliveryZoneManager from '../Components/DeliveryZoneManager';
// ... otros imports

function Admin() {
  const [activeSection, setActiveSection] = useState('dashboard');

  return (
    <div className="flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 text-white h-screen">
        <nav className="p-4">
          <button 
            onClick={() => setActiveSection('dashboard')}
            className="w-full text-left py-2 px-4 rounded hover:bg-gray-700"
          >
            📊 Dashboard
          </button>
          <button 
            onClick={() => setActiveSection('products')}
            className="w-full text-left py-2 px-4 rounded hover:bg-gray-700"
          >
            🍔 Productos
          </button>
          <button 
            onClick={() => setActiveSection('orders')}
            className="w-full text-left py-2 px-4 rounded hover:bg-gray-700"
          >
            📦 Pedidos
          </button>
          <button 
            onClick={() => setActiveSection('delivery-zones')}
            className="w-full text-left py-2 px-4 rounded hover:bg-gray-700"
          >
            🗺️ Zonas de Entrega
          </button>
        </nav>
      </aside>

      {/* Contenido */}
      <main className="flex-1 p-6">
        {activeSection === 'delivery-zones' && <DeliveryZoneManager />}
        {/* ... otras secciones */}
      </main>
    </div>
  );
}
```

---

## 🚀 Ejemplo 3: Middleware para Validar Zona en el Backend

### Backend/middleware/deliveryZoneValidator.js

```javascript
const { validateDeliveryForOrder } = require('../services/deliveryZoneService');

/**
 * Middleware para validar zona de entrega en pedidos
 */
async function validateDeliveryZone(req, res, next) {
  try {
    const { orderType, deliveryCoordinates, totalAmount, businessId } = req.body;

    // Solo validar si es pedido de delivery
    if (orderType !== 'delivery') {
      return next();
    }

    // Verificar que se proporcionaron coordenadas
    if (!deliveryCoordinates || !deliveryCoordinates.lat || !deliveryCoordinates.lon) {
      return res.status(400).json({
        success: false,
        message: 'Las coordenadas de entrega son requeridas para pedidos a domicilio'
      });
    }

    // Validar cobertura
    const validation = await validateDeliveryForOrder(
      businessId || req.admin._id,
      {
        lat: deliveryCoordinates.lat,
        lon: deliveryCoordinates.lon
      },
      totalAmount
    );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error || 'La ubicación está fuera del área de entrega',
        coverage: validation.coverage
      });
    }

    // Agregar información de zona al request
    req.deliveryCoverage = validation.coverage;
    next();
  } catch (error) {
    console.error('Error al validar zona de entrega:', error);
    res.status(500).json({
      success: false,
      message: 'Error al validar la zona de entrega'
    });
  }
}

module.exports = { validateDeliveryZone };
```

### Usar el middleware en las rutas de pedidos

```javascript
// Backend/Routes/orders.js
const { validateDeliveryZone } = require('../middleware/deliveryZoneValidator');

// Aplicar middleware al crear pedidos
router.post('/', authMiddleware, validateDeliveryZone, async (req, res) => {
  try {
    const orderData = req.body;

    // Si hay cobertura validada, usar esa información
    if (req.deliveryCoverage) {
      orderData.deliveryZoneId = req.deliveryCoverage.zone.id;
      orderData.deliveryZoneName = req.deliveryCoverage.zone.name;
      orderData.deliveryFee = req.deliveryCoverage.delivery.price;
      orderData.estimatedDeliveryTime = req.deliveryCoverage.delivery.estimatedTime;
    }

    // Crear el pedido
    const order = new Order(orderData);
    await order.save();

    res.status(201).json({
      success: true,
      order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al crear el pedido'
    });
  }
});
```

---

## 📊 Ejemplo 4: Dashboard de Estadísticas de Zonas

```jsx
// Frontend/src/Components/DeliveryZoneStats.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';

function DeliveryZoneStats() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadZoneStats();
  }, []);

  const loadZoneStats = async () => {
    try {
      const response = await api.get('/delivery-zones');
      setZones(response.data.zones);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Cargando...</div>;

  // Calcular totales
  const totalOrders = zones.reduce((sum, z) => sum + (z.stats?.totalOrders || 0), 0);
  const totalRevenue = zones.reduce((sum, z) => sum + (z.stats?.totalRevenue || 0), 0);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Estadísticas de Zonas</h2>

      {/* Resumen general */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-6 rounded-lg">
          <div className="text-3xl font-bold text-blue-600">{zones.length}</div>
          <div className="text-gray-600">Zonas Configuradas</div>
        </div>
        <div className="bg-green-50 p-6 rounded-lg">
          <div className="text-3xl font-bold text-green-600">{totalOrders}</div>
          <div className="text-gray-600">Pedidos Totales</div>
        </div>
        <div className="bg-purple-50 p-6 rounded-lg">
          <div className="text-3xl font-bold text-purple-600">${totalRevenue.toLocaleString()}</div>
          <div className="text-gray-600">Ingresos Totales</div>
        </div>
      </div>

      {/* Tabla de zonas */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">Zona</th>
              <th className="px-6 py-3 text-right">Pedidos</th>
              <th className="px-6 py-3 text-right">Ingresos</th>
              <th className="px-6 py-3 text-right">Ticket Promedio</th>
              <th className="px-6 py-3 text-left">Último Pedido</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => {
              const avgTicket = zone.stats?.totalOrders > 0
                ? zone.stats.totalRevenue / zone.stats.totalOrders
                : 0;

              return (
                <tr key={zone.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div 
                        className="w-4 h-4 rounded mr-3" 
                        style={{ backgroundColor: zone.color }}
                      />
                      <span className="font-medium">{zone.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {zone.stats?.totalOrders || 0}
                  </td>
                  <td className="px-6 py-4 text-right">
                    ${(zone.stats?.totalRevenue || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    ${Math.round(avgTicket).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    {zone.stats?.lastOrderDate 
                      ? new Date(zone.stats.lastOrderDate).toLocaleDateString()
                      : 'Nunca'
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DeliveryZoneStats;
```

---

## 🎯 Ejemplo 5: Widget de Cobertura en Landing Page

```jsx
// Frontend/src/Components/CoverageWidget.jsx
import { useState } from 'react';
import api from '../services/api';

function CoverageWidget({ businessId }) {
  const [address, setAddress] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);

  const handleCheck = async () => {
    if (!address.trim()) {
      alert('Ingresa una dirección');
      return;
    }

    setChecking(true);
    try {
      // Geocodificar
      const geoResponse = await api.post('/delivery-zones/geocode', { 
        address 
      });

      if (geoResponse.data.results.length === 0) {
        setResult({ covered: false, message: 'Dirección no encontrada' });
        return;
      }

      const location = geoResponse.data.results[0];

      // Verificar cobertura
      const coverageResponse = await api.post('/delivery-zones/check-coverage', {
        adminId: businessId,
        lat: location.lat,
        lon: location.lon
      });

      setResult(coverageResponse.data);
    } catch (error) {
      console.error('Error:', error);
      setResult({ covered: false, message: 'Error al verificar' });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-8 rounded-lg">
      <h3 className="text-2xl font-bold mb-4">¿Entregamos en tu zona?</h3>
      <p className="mb-4">Verifica si hacemos domicilios a tu dirección</p>

      <div className="flex gap-2">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleCheck()}
          placeholder="Ej: Calle 100 #10-20"
          className="flex-1 px-4 py-2 rounded text-gray-900"
          disabled={checking}
        />
        <button
          onClick={handleCheck}
          disabled={checking}
          className="bg-white text-blue-600 px-6 py-2 rounded font-semibold 
                     hover:bg-gray-100 disabled:bg-gray-300"
        >
          {checking ? 'Verificando...' : 'Verificar'}
        </button>
      </div>

      {result && (
        <div className={`mt-4 p-4 rounded ${
          result.covered ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {result.covered ? (
            <>
              <p className="font-bold text-lg">✅ ¡Sí entregamos!</p>
              <p>Zona: {result.zone.name}</p>
              <p>Costo de envío: ${result.delivery.price}</p>
              <p>Tiempo: {result.delivery.estimatedTime.min}-{result.delivery.estimatedTime.max} min</p>
            </>
          ) : (
            <p className="font-bold">❌ {result.message}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default CoverageWidget;
```

---

## 🔄 Ejemplo 6: Actualización de Zona al Cambiar Estado del Pedido

```javascript
// Backend: Hook para actualizar estadísticas cuando cambia el estado
// Ya está implementado en el modelo Order.js

// Puedes extenderlo para enviar notificaciones
orderSchema.post('save', async function(doc) {
  if (doc.deliveryZoneId && (doc.status === 'completed' || doc.status === 'delivered')) {
    // Actualizar estadísticas (ya implementado)
    
    // Opcional: Enviar notificación o webhook
    // await sendZoneStatsWebhook(doc.deliveryZoneId);
  }
});
```

---

## 🎨 Ejemplo 7: CSS Custom para los Componentes

```css
/* Frontend/src/styles/delivery-zones.css */

/* Estilos para el mapa */
.leaflet-container {
  font-family: inherit;
}

.delivery-zone-popup {
  min-width: 200px;
}

.delivery-zone-popup .zone-name {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 8px;
}

.delivery-zone-popup .zone-info {
  font-size: 14px;
  line-height: 1.6;
}

/* Estilos para el resultado de cobertura */
.coverage-result {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.coverage-result.covered {
  background: linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%);
}

.coverage-result.not-covered {
  background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
}

/* Loading spinner personalizado */
.zone-loader {
  border: 3px solid #f3f3f3;
  border-top: 3px solid #3B82F6;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

---

## 📱 Tips de Integración

### 1. Guardar última ubicación del usuario
```javascript
// Guardar en localStorage para no pedir siempre
const saveLastLocation = (lat, lon, address) => {
  localStorage.setItem('lastDeliveryLocation', JSON.stringify({
    lat, lon, address, timestamp: Date.now()
  }));
};

// Recuperar si es reciente (< 24 horas)
const getLastLocation = () => {
  const saved = localStorage.getItem('lastDeliveryLocation');
  if (!saved) return null;
  
  const data = JSON.parse(saved);
  const hoursSince = (Date.now() - data.timestamp) / (1000 * 60 * 60);
  
  return hoursSince < 24 ? data : null;
};
```

### 2. Mostrar tiempo estimado en tiempo real
```javascript
// Actualizar countdown de tiempo de entrega
const [estimatedDelivery, setEstimatedDelivery] = useState(null);

useEffect(() => {
  if (deliveryCoverage?.delivery?.estimatedTime) {
    const now = new Date();
    const minTime = new Date(now.getTime() + deliveryCoverage.delivery.estimatedTime.min * 60000);
    const maxTime = new Date(now.getTime() + deliveryCoverage.delivery.estimatedTime.max * 60000);
    
    setEstimatedDelivery({
      min: minTime.toLocaleTimeString(),
      max: maxTime.toLocaleTimeString()
    });
  }
}, [deliveryCoverage]);
```

### 3. Validación de formulario mejorada
```javascript
const validateCheckout = () => {
  const errors = [];
  
  if (!customerInfo.name.trim()) {
    errors.push('El nombre es requerido');
  }
  
  if (!customerInfo.phone.match(/^\d{10}$/)) {
    errors.push('El teléfono debe tener 10 dígitos');
  }
  
  if (orderType === 'delivery') {
    if (!customerInfo.address.trim()) {
      errors.push('La dirección es requerida');
    }
    
    if (!deliveryCoverage || !deliveryCoverage.covered) {
      errors.push('Debes verificar tu dirección de entrega');
    }
    
    if (deliveryCoverage && !deliveryCoverage.valid) {
      errors.push(deliveryCoverage.error || 'No cumples con los requisitos de entrega');
    }
  }
  
  return errors;
};
```

---

Estos ejemplos cubren los casos de uso más comunes. Adapta según las necesidades específicas de tu aplicación.

