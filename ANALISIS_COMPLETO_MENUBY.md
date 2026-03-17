# MenuBy (SisRestaurantes) — Análisis Técnico Completo

> **Fecha del análisis:** 16 de Marzo, 2026
> **Repositorio:** https://github.com/Rodluisfelipe/SisRestaurantes
> **Dominio:** https://www.menuby.tech
> **Servidor:** DigitalOcean 157.245.125.216

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Métricas del Proyecto](#2-métricas-del-proyecto)
3. [Arquitectura del Sistema](#3-arquitectura-del-sistema)
4. [Stack Tecnológico](#4-stack-tecnológico)
5. [Funcionalidades Completas](#5-funcionalidades-completas)
6. [Backend — Análisis Detallado](#6-backend--análisis-detallado)
7. [Frontend — Análisis Detallado](#7-frontend--análisis-detallado)
8. [Base de Datos](#8-base-de-datos)
9. [Integraciones Externas](#9-integraciones-externas)
10. [Infraestructura y DevOps](#10-infraestructura-y-devops)
11. [Seguridad](#11-seguridad)
12. [Rendimiento y Escalabilidad](#12-rendimiento-y-escalabilidad)
13. [Estado Actual del Proyecto](#13-estado-actual-del-proyecto)
14. [Estimación de Tiempo de Construcción](#14-estimación-de-tiempo-de-construcción)
15. [Estimación de Precio del Proyecto](#15-estimación-de-precio-del-proyecto)
16. [Fortalezas](#16-fortalezas)
17. [Debilidades y Deuda Técnica](#17-debilidades-y-deuda-técnica)
18. [Recomendaciones](#18-recomendaciones)
19. [Conclusión](#19-conclusión)

---

## 1. Resumen Ejecutivo

**MenuBy** es una plataforma SaaS multi-tenant de gestión y pedidos para restaurantes y negocios gastronómicos. Permite a cada negocio tener su propio menú digital, sistema POS, gestión de pedidos en tiempo real, domiciliarios, reservas, programa de fidelidad, y panel de administración completo.

| Aspecto | Detalle |
|---------|---------|
| **Tipo de producto** | SaaS B2B (Business-to-Business) |
| **Modelo de negocio** | Suscripción mensual/anual por negocio |
| **Público objetivo** | Restaurantes, bares, cafeterías, hoteles, panaderías, food trucks, heladerías, pizzerías, sushi bars, asaderos, hamburgueserías, comida rápida |
| **Tipos de negocio soportados** | 13 tipos diferentes |
| **Multi-tenant** | Sí — cada negocio es un tenant aislado |
| **Tiempo real** | Sí — WebSockets (Socket.IO) + SSE |
| **PWA** | Sí — Service Worker, offline POS, push notifications |
| **Idioma** | Español (Colombia) |

---

## 2. Métricas del Proyecto

### Código Fuente

| Métrica | Backend | Frontend | Total |
|---------|---------|----------|-------|
| **Líneas de código** | 22,097 | 62,603 | **84,700** |
| **Archivos fuente** | ~75 | 203 | **~278** |
| **Endpoints API** | **224** | — | 224 |
| **Componentes React** | — | **163** | 163 |
| **Rutas de navegación** | — | **37** | 37 |
| **Modelos de datos** | **29** | — | 29 |

### Infraestructura

| Métrica | Valor |
|---------|-------|
| **Archivos de rutas (Backend)** | 39 |
| **Middleware** | 5 |
| **Servicios Backend** | 12 |
| **Utilidades Backend** | 12 |
| **Hooks personalizados (Frontend)** | 17 |
| **Servicios Frontend** | 6 |
| **Context Providers** | 3 |
| **Cron Jobs** | 3 |
| **Integraciones externas** | 12 |
| **Dependencias Backend** | 32 |
| **Dependencias Frontend** | 35 |

---

## 3. Arquitectura del Sistema

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENTES                                  │
│  ┌───────────┐  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Cliente   │  │   Admin   │  │   POS    │  │   Cocina     │  │
│  │  (Menú)   │  │  (Panel)  │  │ (Ventas) │  │  (Kitchen)   │  │
│  └─────┬─────┘  └─────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│        │              │              │               │           │
│  ┌─────┴──────────────┴──────────────┴───────────────┴────────┐  │
│  │              React SPA (Cloudflare Pages)                   │  │
│  │              menuby.tech — Vite + Tailwind                  │  │
│  └─────────────────────────┬──────────────────────────────────┘  │
└────────────────────────────┼─────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                   SERVIDOR (DigitalOcean)                       │
│                   157.245.125.216                               │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Nginx (Reverse Proxy + SSL)                            │   │
│  │  :443 → proxy_pass 127.0.0.1:5000                      │   │
│  │  Let's Encrypt (157-245-125-216.nip.io)                 │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │                                     │
│  ┌────────────────────────┴────────────────────────────────┐   │
│  │  Docker Container (backend-backend-1)                    │   │
│  │  Node.js 20 Alpine                                       │   │
│  │  Express.js + Socket.IO                                  │   │
│  │  Puerto: 5000                                            │   │
│  │                                                          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │   │
│  │  │ REST API │ │Socket.IO │ │   SSE    │ │   Cron    │  │   │
│  │  │ 224 eps  │ │ 14 evts  │ │  events  │ │  3 jobs   │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
└────────────────────────────┬───────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │    MongoDB Atlas        │
                │    (Cloud - Remoto)     │
                │    29 colecciones       │
                └─────────────────────────┘
```

### Flujo de datos en tiempo real

```
Cliente (navegador)
    │
    ├── HTTP/REST ──────► Express API ──────► MongoDB
    │                         │
    ├── WebSocket ◄────► Socket.IO ◄────► Sala por negocio
    │   (pedidos en vivo)     │              (tenant isolation)
    │                         │
    ├── SSE ◄──────────── EventService
    │   (eventos unidireccionales)
    │
    └── Web Push ◄──────── VAPID (notificaciones)
```

---

## 4. Stack Tecnológico

### Backend

| Categoría | Tecnología | Versión |
|-----------|-----------|---------|
| **Runtime** | Node.js | 20 (Alpine) |
| **Framework HTTP** | Express.js | 4.19 |
| **WebSockets** | Socket.IO | 4.6 |
| **Base de datos** | MongoDB Atlas | Cloud |
| **ODM** | Mongoose | 8.14 |
| **Autenticación** | JWT (jsonwebtoken) | 9.0 |
| **Passwords** | bcryptjs | 3.0 |
| **Archivos** | Multer + Sharp (WebP) | 1.4 / 0.34 |
| **Almacenamiento** | DigitalOcean Spaces (S3) | AWS SDK v3 |
| **Email** | Nodemailer + Resend + Brevo + SendGrid | Multi-provider |
| **Push** | web-push (VAPID) | 3.6 |
| **IA** | Google Gemini | 0.24 |
| **Pagos** | ePayco + dLocal Go | REST API |
| **Geolocalización** | Nominatim (OpenStreetMap) | API |
| **Monitoreo** | Sentry | 10.38 |
| **Seguridad** | Helmet + express-mongo-sanitize + rate-limit | — |
| **Contenedor** | Docker + docker-compose | — |

### Frontend

| Categoría | Tecnología | Versión |
|-----------|-----------|---------|
| **Framework** | React | 18.3 |
| **Build Tool** | Vite | 5.4 |
| **Estilos** | Tailwind CSS | 3.3 |
| **Animaciones** | Framer Motion | 12.10 |
| **Iconos** | Lucide React + React Icons | 0.544 / 5.5 |
| **Gráficas** | Recharts | 3.8 |
| **Mapas** | Leaflet + React-Leaflet + Leaflet-Draw | 1.9 / 4.2 |
| **QR Codes** | qrcode.react | 4.2 |
| **PDF** | jsPDF + jsPDF-AutoTable + html2canvas | 3.0 |
| **Excel** | ExcelJS | 4.4 |
| **OAuth** | @react-oauth/google | 0.13 |
| **Toasts** | Sonner | 2.0 |
| **Onboarding** | React Joyride | 2.9 |
| **Monitoreo** | Sentry React | 10.38 |
| **Hosting** | Cloudflare Pages | — |

### Infraestructura

| Categoría | Tecnología |
|-----------|-----------|
| **Servidor** | DigitalOcean Droplet (1 vCPU, 960 MB RAM, 24 GB SSD) |
| **Reverse Proxy** | Nginx con SSL (Let's Encrypt) |
| **Contenedores** | Docker + docker-compose |
| **CI/CD** | GitHub Actions (auto-deploy al push a `produccion`) |
| **CDN/Frontend Hosting** | Cloudflare Pages |
| **Base de datos** | MongoDB Atlas (cloud) |
| **Almacenamiento de archivos** | DigitalOcean Spaces (S3 compatible) |
| **DNS** | nip.io (para IP del backend) + Cloudflare (para menuby.tech) |
| **Control de versiones** | Git + GitHub |
| **Ramas** | `desarrollo` (trabajo diario) → `produccion` (deploy) |

---

## 5. Funcionalidades Completas

### 5.1 Menú Digital (Cliente)

| Funcionalidad | Descripción |
|---------------|-------------|
| **Menú por QR / URL** | Cada negocio tiene su URL: `menuby.tech/{slug}` |
| **Categorías con filtros** | Navegación por categorías, búsqueda por texto |
| **Productos con toppings** | Sistema completo de toppings, sub-grupos, opciones obligatorias/opcionales |
| **Combos** | Combos con sub-grupos y opciones múltiples |
| **Carrito inteligente** | Persistencia en sesión, cálculo de precios con toppings |
| **Tipos de pedido** | En sitio (mesa), para llevar, domicilio |
| **Mesa por QR** | Escaneo de QR en mesa → pedido directo con número de mesa |
| **Cupones** | Validación y aplicación de cupones en el carrito |
| **Programa de lealtad** | Acumulación/canje de puntos en checkout |
| **Favoritos** | Guardar productos favoritos con sus toppings |
| **Zona de cobertura** | Verificación de dirección dentro de zona de delivery |
| **Seguimiento de pedido** | Tracking en tiempo real del estado del pedido |
| **Tracking GPS** | Tracking en vivo de la ubicación del domiciliario |
| **Reseñas** | Calificación con estrellas y comentario post-pedido |
| **Pedido por WhatsApp** | Generación de mensaje WhatsApp con el pedido |
| **Historial** | Historial de pedidos del cliente |
| **Push notifications** | Notificaciones de cambio de estado del pedido |
| **Horario de negocio** | Modal de cierre cuando está fuera de horario |
| **Splash screen** | Pantalla de carga con logo del negocio |
| **PWA** | Instalable en móvil como app nativa |

### 5.2 Panel Administrativo

| Funcionalidad | Descripción |
|---------------|-------------|
| **Dashboard analítico** | Gráficas de ventas, pedidos por tipo/canal/pago, productos top (Recharts) |
| **Gestión de productos** | CRUD completo, reordenamiento drag & drop, toggle activo/destacado |
| **Categorías** | CRUD con ordenamiento personalizado |
| **Toppings y extras** | Grupos de toppings con sub-grupos, precios individuales |
| **Pedidos en tiempo real** | Dashboard de pedidos activos con actualización automática via Socket.IO |
| **Pedidos completados** | Historial con filtros avanzados, exportación a Excel (5 hojas), resumen estadístico |
| **Gestión de clientes (CRM)** | Base de datos de clientes, historial, estadísticas por cliente |
| **Cupones** | Creación de cupones con reglas (%, fijo, delivery gratis), límites de uso |
| **Programa de fidelidad** | Configuración de programa de puntos, niveles, recompensas |
| **Reseñas** | Moderación, respuesta a reseñas, estadísticas |
| **Reservas** | Sistema de reservas con confirmación, recordatorios automáticos |
| **Configuración de negocio** | Nombre, logo, portada, horarios, métodos de pago, dirección, redes sociales |
| **Configuración de tema** | Colores personalizados, tema claro/oscuro |
| **Staff/Empleados** | Gestión de usuarios con roles (admin, manager, staff) |
| **Impresora** | Configuración de impresora térmica para tickets |
| **Caja registradora** | Cierre de caja con resumen de ventas |
| **Zonas de delivery** | Dibujo de polígonos/radios en mapa, precios por zona/distancia |
| **Domiciliarios** | 3 modos de delivery, gestión de repartidores, sesiones diarias |
| **Banners promocionales** | Upload de banners con aprobación del SuperAdmin |
| **WhatsApp** | Personalización de mensajes WhatsApp |
| **Push notifications** | Toggle de notificaciones, notificaciones automáticas de pedidos |
| **Asistente IA** | Chat de ayuda con IA (Google Gemini) para configurar el negocio |
| **Onboarding** | Tour guiado para nuevos usuarios, wizard de bienvenida |
| **Cambio de contraseña** | Gestión de contraseña y cuenta |
| **Suscripción** | Estado de suscripción, renovación, historial de pagos |

### 5.3 Sistema POS (Punto de Venta)

| Funcionalidad | Descripción |
|---------------|-------------|
| **Grid de productos** | Vista rápida de productos por categoría |
| **Carrito POS** | Carrito optimizado para velocidad de despacho |
| **Checkout rápido** | Modal de pago con múltiples métodos |
| **Mapa de mesas** | Vista de mesas del restaurante para selección |
| **Tickets** | Generación e impresión de tickets/recibos |
| **Caja registradora** | Apertura, movimientos, cierre con resumen |
| **Pedidos activos** | Vista de pedidos pendientes en tiempo real |
| **Modo offline** | Funciona sin internet (IndexedDB), sincroniza cuando vuelve la conexión |
| **Sincronización** | Motor de sync con retry y backoff exponencial |

### 5.4 Kitchen Display (Cocina)

| Funcionalidad | Descripción |
|---------------|-------------|
| **Vista de pedidos** | Pedidos en cola con detalles de items y toppings |
| **Actualización en tiempo real** | Socket.IO para nuevos pedidos y cambios de estado |
| **Cambio de estado** | Marcar pedidos como en preparación → listos |
| **Diseño optimizado** | Pantalla diseñada para pantallas de cocina (sin interacción compleja) |

### 5.5 Sistema de Delivery

| Funcionalidad | Descripción |
|---------------|-------------|
| **3 modos de domicilio** | Modo 1: básico, Modo 2: domiciliarios fijos, Modo 3: tracking GPS completo |
| **Zonas de cobertura** | Polígonos/radios geográficos con precios diferenciados |
| **Geocodificación** | Conversión de direcciones a coordenadas (Nominatim/OSM) |
| **Precios por zona** | Fijo, por distancia, o por niveles |
| **Tracking GPS en vivo** | WebSocket para posición del domiciliario en tiempo real |
| **Asignación** | Asignar pedido a domiciliario específico |
| **Página del domiciliario** | Interfaz móvil para el repartidor con pedidos asignados |
| **Sesiones diarias** | Código diario rotativo para acceso de domiciliarios |
| **QR de acceso** | Acceso temporal por QR para domiciliarios |
| **Estadísticas** | Dashboard de estadísticas de domiciliarios |

### 5.6 SuperAdmin (Gestión de Plataforma)

| Funcionalidad | Descripción |
|---------------|-------------|
| **Gestión de negocios** | Crear, activar, desactivar, eliminar negocios |
| **Vista de pedidos global** | Pedidos de todos los negocios |
| **Gestión de suscripciones** | Estado de suscripciones, cupones de regalo |
| **Pagos manuales** | Revisión y aprobación de comprobantes de pago |
| **Dashboard de pagos** | Analytics de ingresos por suscripciones |
| **Banners** | Aprobación/rechazo de banners promocionales |
| **Anuncios** | Anuncios globales para todos los negocios |
| **POS Beta** | Toggle de funcionalidad POS por negocio |

### 5.7 Catálogo Público de Restaurantes

| Funcionalidad | Descripción |
|---------------|-------------|
| **Directorio** | Listado público de restaurantes en la plataforma |
| **Búsqueda avanzada** | Filtros por tipo de negocio, ubicación, rating |
| **Detalle de restaurante** | Página individual con info, menú, reseñas |
| **Banners** | Carrusel de banners promocionales |

### 5.8 Landing Page y Marketing

| Funcionalidad | Descripción |
|---------------|-------------|
| **Página de inicio** | Landing page con propuesta de valor |
| **Registro de negocios** | Formulario de registro con selección de tipo de negocio |
| **Pricing** | Planes y precios de suscripción |
| **Blog** | Sistema de blog con posts estáticos (SEO) |
| **Páginas de nicho SEO** | 12 páginas específicas por tipo de negocio para SEO |
| **Features showcase** | Página de características de la plataforma |
| **Contacto** | Formulario de contacto |
| **Demo** | Página de demostración |

### 5.9 Pagos y Suscripciones

| Funcionalidad | Descripción |
|---------------|-------------|
| **ePayco** | Pasarela de pago colombiana (sandbox) |
| **dLocal Go** | Pasarela de pago LATAM (sandbox) |
| **Pago manual** | Upload de comprobante de pago para revisión |
| **Cupones de suscripción** | Cupones que regalan meses de suscripción |
| **Período de gracia** | 1 día de gracia después del vencimiento |
| **Recordatorios automáticos** | Push notifications a 7, 3, 1 y 0 días del vencimiento |
| **Suspensión automática** | Bloqueo del dashboard después del período de gracia |

---

## 6. Backend — Análisis Detallado

### 6.1 Endpoints API (224 totales)

| Dominio | Archivos de ruta | Endpoints |
|---------|-----------------|-----------|
| Auth y Usuarios | auth.js, authSuperAdmin.js | 24 |
| Productos | products.js | 12 |
| Categorías | categories.js | 6 |
| Toppings | toppingGroups.js | 5 |
| Pedidos | orders.js | 15 |
| Configuración de negocio | businessConfig.js, businesses.js | 17 |
| Clientes | customers.js | 9 |
| Delivery | deliveryZones.js, deliveryAdmin.js, deliveryPublic.js | 31 |
| Pagos y suscripciones | epaycoPayments.js, dlocalPayments.js, subscriptions.js, adminSubscriptions.js, paymentRequests.js | 33 |
| Cupones | coupons.js | 11 |
| Reseñas | reviews.js | 10 |
| Reservas | bookings.js | 9 |
| Banners | banners.js | 20 |
| Dashboard | dashboard.js | 4 |
| Caja registradora | cashRegister.js | 6 |
| Fidelización | loyalty.js | 6 |
| Mesas y pisos | tables.js, floors.js | 11 |
| Favoritos | favorites.js | 4 |
| Email | email.js | 2 |
| Push Notifications | push.js | 3 |
| Upload | upload.js | 2 |
| WhatsApp | whatsappTemplates.js | 3 |
| Anuncios | announcements.js | 7 |
| SuperAdmin | superadmin.js | 7 |
| IA | aiTools.js, helpChat.js | 3 |
| Health | health.js | 1 |
| Debug | debug.js (dev-only) | 3 |
| Eventos SSE | events.js | 1 |

### 6.2 Sistema de Autenticación

```
┌─────────────────────────────────────────────┐
│            AUTENTICACIÓN JWT                 │
│                                              │
│  Login → Access Token (24h) + Refresh (7d)  │
│                                              │
│  ┌──────────────┐  ┌───────────────────┐    │
│  │ Access Token  │  │ Refresh Token     │    │
│  │ Header Bearer │  │ SHA-256 hashed    │    │
│  │ 24h TTL       │  │ Array multi-device│    │
│  │ {id,biz,role} │  │ 7d TTL            │    │
│  └──────────────┘  └───────────────────┘    │
│                                              │
│  Roles: superadmin > admin > manager > staff │
│                                              │
│  Google OAuth: Admin + SuperAdmin            │
│  Customer tokens: Per-order, anonymous       │
│  Delivery codes: SHA-256 hashed PINs         │
│                                              │
│  Cache de verificación: 5 min in-memory      │
│  Rate limiting: 5 intentos / 15 min (login)  │
└─────────────────────────────────────────────┘
```

### 6.3 WebSocket Events (Socket.IO)

| Dirección | Evento | Propósito |
|-----------|--------|-----------|
| Client → Server | `joinBusiness` | Unirse a sala del negocio (auth + tenant-check) |
| Client → Server | `joinSuperAdmin` | Unirse a canal SuperAdmin |
| Client → Server | `trackOrder` | Tracking de pedido (token verificado) |
| Client → Server | `domi:join` | Domiciliario se conecta (Modo 3 GPS) |
| Client → Server | `domi:joinFixed` | Domiciliario fijo se conecta (Modo 2) |
| Client → Server | `domi:location` | Enviar coordenadas GPS |
| Client → Server | `delivery:track` | Cliente rastrea domicilio |
| Client → Server | `viewer:join` | Visitante abre el menú |
| Client → Server | `viewer:heartbeat` | Heartbeat + actualización carrito |
| Client → Server | `viewer:leave` | Visitante cierra el menú |
| Server → Client | `new_order` | Nuevo pedido recibido |
| Server → Client | `order_updated` | Estado del pedido cambió |
| Server → Client | `domi:location` | GPS del domiciliario en vivo |
| Server → Client | `viewers_updated` | Lista de visitantes actualizada |
| Server → Client | `cart_abandoned` | Carrito abandonado detectado |

### 6.4 Cron Jobs

| Job | Frecuencia | Función |
|-----|-----------|---------|
| Recordatorios de suscripción | Diario (9:00 AM COT) | Push notifications a 7, 3, 1 y 0 días del vencimiento |
| Limpieza de pedidos | Medianoche (Colombia) | Auto-expirar pedidos pendientes >1h, archivar cancelados >2h |
| Recordatorios de reservas | Cada 15 minutos | Push + email 24h y 1h antes de la cita |

---

## 7. Frontend — Análisis Detallado

### 7.1 Estructura de Componentes

| Área | Componentes | Líneas |
|------|-------------|--------|
| Páginas principales | 19 | ~5,000 |
| Landing/Marketing | 8 | ~2,600 |
| Blog | 2 | ~410 |
| Catálogo | 10 | ~3,400 |
| SuperAdmin | 12 | ~3,700 |
| Admin Panel | 23 | ~5,500 |
| POS | 8 | ~1,950 |
| Delivery | 5 | ~1,600 |
| Componentes core | 68 | ~30,000 |
| Hooks | 17 | ~2,200 |
| Servicios | 6 | ~910 |
| Utilidades | 9 | ~1,100 |
| Contextos | 3 | ~720 |
| **Total** | **~190** | **~62,600** |

### 7.2 Manejo de Estado

| Capa | Mecanismo |
|------|-----------|
| Autenticación global | React Context (AuthContext) |
| Config de negocio | React Context (BusinessContext) + Socket.IO |
| Tema | React Context (ThemeContext) + localStorage |
| Datos admin | Custom hook (useAdminData) + Socket/SSE |
| Carrito | Custom hook (useCart) + sessionStorage |
| Datos de cliente | Custom hook (useCustomerData) + localStorage |
| Forms | useState local + useFormValidation |
| Tiempo real | Socket.IO |
| POS offline | IndexedDB (posOfflineStore) |

> **No usa** Redux, Zustand, MobX ni ninguna librería de estado global externa.

### 7.3 PWA y Capacidades Offline

| Característica | Implementación |
|---------------|----------------|
| Service Worker | `public/sw.js` — estrategia network-first |
| Web App Manifest | `public/manifest.json` — standalone, portrait |
| Manifiesto dinámico | `DynamicManifest.jsx` — por negocio |
| Push Notifications | VAPID vía `pushNotifications.js` |
| POS Offline | IndexedDB + motor de sincronización con retry |
| Indicador offline | POS muestra contador de pedidos pendientes |
| Cache | HTML por SW, JS/CSS vía Cloudflare CDN |

### 7.4 Code Splitting (Vite)

| Chunk | Contenido |
|-------|-----------|
| `vendor-react` | react, react-dom, react-router-dom |
| `vendor-motion` | framer-motion |
| `vendor-sentry` | @sentry/react |
| `vendor-maps` | leaflet, react-leaflet |
| `vendor-pdf` | jspdf, jspdf-autotable, html2canvas |

---

## 8. Base de Datos

### 8.1 Motor y Conexión

- **Motor:** MongoDB Atlas (cloud)
- **ODM:** Mongoose 8.14
- **Colecciones:** 29

### 8.2 Esquema de Colecciones

| Colección | Descripción | Campos clave |
|-----------|-------------|--------------|
| `admins` | Usuarios administradores | username, password, googleId, role(admin/manager/staff), businessId, refreshTokens[] |
| `superadmins` | Super administradores | email, password, googleId, refreshToken(hashed) |
| `businessconfigs` | Configuración del negocio | slug, businessName, businessType, enableBookings, bookingSettings, emailSettings, onboarding, description, logo, coverImage, isOpen, businessHours, menuStatus, whatsappNumber, address, googleMapsUrl, printerSettings, location, socialMedia, theme, features, orderingMode, paymentInfo, paymentMethods, reviewStats |
| `products` | Productos del menú | name, description, price, category, image, toppingGroups[], itemType, durationMinutes, active, displayOrder, isFeatured, businessId |
| `categories` | Categorías | name, description, displayOrder, active, businessId |
| `toppinggroups` | Grupos de toppings | name, basePrice, isMultipleChoice, isRequired, options[], subGroups[], businessId |
| `orders` | Pedidos activos | orderNumber, customerName, phone, orderType, status(11 estados), orderChannel, paymentMethod, items[], totalAmount, deliveryInfo, couponInfo, statusHistory[] |
| `completedorders` | Pedidos archivados | Mismo esquema que orders + analytics |
| `customers` | Clientes | businessId, phone, name, address, totalOrders, totalSpent, lastOrderDate |
| `customerloyalties` | Perfiles de lealtad | businessId, customerId, phone, points, totalEarned, currentTier, transactions[] |
| `loyaltyprograms` | Programas de fidelidad | businessId, isActive, pointsPerAmount, tiers[], rewards[] |
| `favorites` | Favoritos del cliente | businessId, customerId, productId, selectedToppings |
| `reviews` | Reseñas | businessId, orderId, phone, rating(1-5), comment, reply, isVisible |
| `deliveryzones` | Zonas de delivery (GeoJSON) | businessId, name, type(radius/polygon), geometry, pricing, schedule |
| `deliverypersons` | Domiciliarios | businessId, name, code(SHA-256), active, status |
| `deliverysessions` | Sesiones de delivery | businessId, dailyCode, validDate |
| `bookings` | Reservas | businessId, customerName, phone, date, time, guests, status |
| `cashregisters` | Cajas registradoras | businessId, openedBy, status, movements[], salesSummary |
| `tables` | Mesas | businessId, floorId, tableNumber, qrCodeUrl, position, capacity |
| `floors` | Pisos/plantas | businessId, name, order, isActive |
| `coupons` | Cupones de suscripción (SA) | code, months, maxUses, usedBy[] |
| `businesscoupons` | Cupones de negocio | businessId, code, discountType, discountValue, usageLimit |
| `subscriptions` | Suscripciones | businessId, planType, status, startDate, endDate, graceUntil |
| `paymentrequests` | Comprobantes de pago | businessId, amount, proofUrl, status(pending/approved/rejected) |
| `banners` | Banners promocionales | businessId, title, image, status(pending/approved/rejected), clicks, impressions |
| `announcements` | Anuncios de plataforma | title, body, image, priority, seenBy[] |
| `pushsubscriptions` | Suscripciones push | businessId, userId, role, endpoint, keys |
| `whatsapptemplates` | Templates de WhatsApp | businessId, modules[], customMessage |
| `viewersessions` | Sesiones de visitantes | businessId, device, duration, cartProducts[], converted |
| `optiongroups` / `combogroups` | Grupos de opciones/combos | name, subGroups[], businessId |

### 8.3 Relaciones entre Colecciones

```
BusinessConfig (tenant principal)
    │
    ├── Products ──── Categories
    │      └── ToppingGroups
    │
    ├── Orders ──── Customers
    │      └── CompletedOrders
    │
    ├── DeliveryZones
    │      └── DeliveryPersons ──── DeliverySessions
    │
    ├── Bookings
    │
    ├── Reviews
    │
    ├── CashRegisters
    │
    ├── Tables ──── Floors
    │
    ├── LoyaltyPrograms ──── CustomerLoyalties
    │
    ├── BusinessCoupons
    │
    ├── Banners
    │
    ├── Subscriptions ──── PaymentRequests
    │
    ├── Admins (users)
    │
    ├── Favorites
    │
    └── PushSubscriptions

SuperAdmin
    ├── Coupons (suscripción)
    └── Announcements
```

---

## 9. Integraciones Externas

| Integración | Tecnología | Propósito | Estado |
|-------------|-----------|----------|--------|
| **ePayco** | REST API + SHA-256 | Pagos automáticos suscripción (Colombia) | Sandbox (test) |
| **dLocal Go** | REST API + HMAC | Pagos automáticos suscripción (LATAM) | Sandbox (test) |
| **Google OAuth** | google-auth-library | Login con Google | Producción |
| **Google Gemini AI** | @google/generative-ai | Chat de ayuda IA, sugerencias | Producción |
| **DigitalOcean Spaces** | @aws-sdk/client-s3 + Sharp | Subida de imágenes (WebP), CDN | Producción |
| **Resend** | HTTP API | Email provider #1 (95/día gratis) | Producción |
| **Brevo** | HTTP API | Email provider #2 (290/día gratis) | Producción |
| **SendGrid** | HTTP API | Email provider #3 (95/día gratis) | Producción |
| **Nodemailer (SMTP)** | Gmail SMTP | Emails de SuperAdmin | Producción |
| **Nominatim/OSM** | HTTP API | Geocodificación de direcciones | Producción |
| **Web Push (VAPID)** | web-push | Push notifications (navegador) | Producción |
| **Sentry** | @sentry/node + @sentry/react | Monitoreo de errores | Producción |

### Capacidad de email (gratuita)
- Resend: 95 emails/día
- Brevo: 290 emails/día
- SendGrid: 95 emails/día
- **Total: ~480 emails/día gratis** (con routing inteligente automático)

---

## 10. Infraestructura y DevOps

### 10.1 Servidor

| Especificación | Valor |
|----------------|-------|
| **Proveedor** | DigitalOcean |
| **IP** | 157.245.125.216 |
| **OS** | Ubuntu (kernel 6.14) |
| **CPU** | 1 vCPU |
| **RAM** | 960 MB + 1 GB swap |
| **Disco** | 24 GB SSD |
| **Costo** | ~$6 USD/mes |

### 10.2 Servicios del Servidor

| Puerto | Servicio | Binding | Nota |
|--------|---------|---------|------|
| 22 | SSH | 0.0.0.0 | Acceso remoto |
| 80 | Nginx | 0.0.0.0 | Redirect → 443 |
| 443 | Nginx (SSL) | 0.0.0.0 | Reverse proxy |
| 5000 | Docker/Backend | 127.0.0.1 | Solo local |
| 5432 | PostgreSQL | 127.0.0.1 | Legacy (no se usa) |

### 10.3 Docker

```yaml
services:
  backend:
    build: .
    ports: ["127.0.0.1:5000:5000"]
    env_file: [.env]
    volumes: ["./uploads:/app/uploads"]
    restart: unless-stopped
    healthcheck:
      test: wget http://localhost:5000/api/health
      interval: 30s
```

### 10.4 CI/CD Pipeline

```
desarrollo (trabajo diario)
    │
    │  Commit + push
    │  Cloudflare Pages auto-build ← Frontend
    │
    │  git checkout produccion
    │  git merge desarrollo
    │  git push origin produccion
    ▼
produccion
    │
    │  GitHub Actions (deploy-backend.yml)
    │  ┌──────────────────────────────────┐
    │  │ 1. SSH al servidor               │
    │  │ 2. Backup .env                    │
    │  │ 3. git fetch + reset --hard       │
    │  │ 4. Restore .env                   │
    │  │ 5. docker compose build (cache)   │
    │  │ 6. docker compose up -d           │
    │  │ 7. docker image prune             │
    │  │ 8. Health check                   │
    │  └──────────────────────────────────┘
    ▼
Deploy automático ← Backend
```

### 10.5 Nginx (Reverse Proxy)

| Path | Destino | Tipo |
|------|---------|------|
| `/api/*` | http://127.0.0.1:5000 | REST API |
| `/socket.io/*` | http://127.0.0.1:5000 | WebSocket (upgrade) |
| `/uploads/*` | http://127.0.0.1:5000 | Archivos estáticos |
| `/health` | http://127.0.0.1:5000 | Health check |
| `/events/*` | http://127.0.0.1:5000 | SSE |

- **SSL:** Let's Encrypt (auto-renovación)
- **Dominio:** 157-245-125-216.nip.io

### 10.6 Costos de Infraestructura Mensuales

| Servicio | Costo |
|---------|-------|
| DigitalOcean Droplet (1 vCPU, 1 GB) | ~$6 USD |
| MongoDB Atlas (free tier → shared) | $0 - $9 USD |
| Cloudflare Pages | $0 (free tier) |
| DigitalOcean Spaces | ~$5 USD |
| Dominio (menuby.tech) | ~$10 USD/año |
| **Total mensual** | **~$12 - $21 USD** |

---

## 11. Seguridad

### 11.1 Medidas Implementadas

| Categoría | Implementación | Estado |
|-----------|---------------|--------|
| **Headers HTTP** | Helmet (CSP, HSTS, X-Frame-Options, etc.) | ✅ Activo |
| **Inyección NoSQL** | express-mongo-sanitize | ✅ Activo |
| **Rate Limiting** | express-rate-limit (login: 5/15min, API: 100/15min) | ✅ Activo |
| **CORS** | Whitelist explícita de orígenes | ✅ Activo |
| **JWT** | Access token (24h) + Refresh token hashed (7d) | ✅ Activo |
| **Passwords** | bcrypt (10 rounds) | ✅ Activo |
| **Tokens almacenados** | SHA-256 hash de refresh tokens y códigos delivery | ✅ Activo |
| **Aislamiento tenant** | Middleware tenantAuth prohíbe acceso cross-tenant | ✅ Activo |
| **PII en logs** | Redacción automática de campos sensibles | ✅ Activo |
| **Sentry PII** | `sendDefaultPii: false` | ✅ Activo |
| **Docker no-root** | Container corre como user nodejs (UID 1001) | ✅ Activo |
| **Puerto backend** | Solo 127.0.0.1 (no expuesto al exterior) | ✅ Activo |
| **SSL** | Let's Encrypt con auto-renovación | ✅ Activo |
| **Compresión** | Gzip (compression middleware) | ✅ Activo |
| **Trust proxy** | `app.set('trust proxy', 1)` para IP real detrás de Nginx | ✅ Activo |

### 11.2 Vulnerabilidades y Riesgos

| Riesgo | Severidad | Detalle |
|--------|-----------|---------|
| **Credenciales en historial de git** | 🔴 Alto | MongoDB URI, JWT secrets, SMTP password estuvieron commiteados. Aunque ya se eliminaron del HEAD, persisten en el historial. Requiere rotación de credenciales. |
| **Pasarelas de pago en sandbox** | 🟡 Medio | ePayco y dLocal aún están en modo test. No procesan pagos reales. |
| **Dependencias sin renovar** | 🟡 Medio | Algunas dependencias pueden necesitar actualización de seguridad. |
| **1 servidor sin redundancia** | 🟡 Medio | Punto único de fallo. Si el servidor cae, todo el backend cae. |
| **MongoDB Atlas sin IP whitelist** | 🟡 Medio | Verificar que solo las IPs autorizadas puedan conectar. |
| **Paquetes innecesarios en Backend** | 🟢 Bajo | `leaflet`, `react-leaflet`, `recharts` están en package.json del backend pero son librerías de frontend. Agregan peso innecesario. |

### 11.3 Recomendaciones de Seguridad Urgentes

1. **Rotar TODAS las credenciales** expuestas en el historial de git:
   - Contraseña de MongoDB Atlas
   - JWT secrets
   - App Password de Gmail (SMTP)
   - API keys de ePayco/dLocal (aunque sean sandbox)
2. **Limpiar historial de git** con `git filter-branch` o BFG Repo-Cleaner para eliminar las credenciales del historial
3. **Verificar que el repo sea privado** en GitHub
4. **Configurar IP whitelist** en MongoDB Atlas

---

## 12. Rendimiento y Escalabilidad

### 12.1 Optimizaciones Actuales

| Optimización | Detalle |
|------|---------|
| **Cache de verificación JWT** | 5 min in-memory TTL, evita hits a DB por request |
| **Cache de resolución de negocio** | 5 min in-memory para slug → ObjectId |
| **Cache de geocodificación** | 24h in-memory para queries de Nominatim |
| **Compresión gzip** | Todas las respuestas HTTP comprimidas |
| **Imágenes WebP** | Sharp comprime a WebP antes de subir a S3 |
| **CDN** | Frontend en Cloudflare Pages con CDN global |
| **Code splitting** | Vite divide el bundle en chunks por dominio |
| **Docker layer caching** | Builds incrementales solo re-ejecutan lo que cambió |
| **Console strip** | Vite elimina `console.log` y `debugger` en builds de producción |

### 12.2 Limitaciones de Escalabilidad

| Limitación | Impacto |
|-----------|---------|
| **960 MB RAM** | Limita número de conexiones simultáneas y cache en memoria |
| **1 vCPU** | Limita throughput de requests concurrentes |
| **Single container** | No hay balanceo de carga ni horizontal scaling |
| **In-memory caches** | Se pierden al reiniciar, no compartidos entre instancias |
| **Socket.IO in-memory** | Las salas son locales al proceso, no funcionaría con múltiples instancias sin Redis adapter |
| **SSE in-memory** | Mismo problema que Socket.IO |
| **Sin CDN para API** | El backend no tiene cache layer (Redis) frente a MongoDB |

### 12.3 Capacidad Estimada (servidor actual)

| Métrica | Estimación |
|---------|-----------|
| **Requests/segundo** | ~50-100 (limitado por 1 vCPU + 960 MB) |
| **Conexiones WebSocket simultáneas** | ~200-500 |
| **Negocios activos** | ~20-50 sin degradación |
| **Pedidos/día** | ~500-2,000 |
| **Emails/día** | ~480 (gratis, multi-provider) |

---

## 13. Estado Actual del Proyecto

### 13.1 Estado General

| Aspecto | Estado | Nota |
|---------|--------|------|
| **Menú digital** | ✅ Producción | Completo y funcional |
| **Sistema de pedidos** | ✅ Producción | In-app, WhatsApp, POS |
| **Panel admin** | ✅ Producción | Completo con analytics |
| **POS** | ✅ Producción (Beta) | Funcional con modo offline |
| **Kitchen display** | ✅ Producción | Tiempo real con Socket.IO |
| **Delivery (modos 1-3)** | ✅ Producción | GPS tracking incluido |
| **Reservas** | ✅ Producción | Con recordatorios automáticos |
| **Programa de fidelidad** | ✅ Producción | Puntos, niveles, canjes |
| **Cupones** | ✅ Producción | %, fijo, delivery gratis |
| **Reseñas** | ✅ Producción | Con moderación y respuesta |
| **SuperAdmin** | ✅ Producción | Gestión completa de plataforma |
| **Catálogo público** | ✅ Producción | Directorio de restaurantes |
| **Landing + SEO** | ✅ Producción | 12 páginas de nicho + blog |
| **Push notifications** | ✅ Producción | VAPID configurado |
| **Pagos automatizados** | 🟡 Sandbox | ePayco/dLocal en modo test |
| **Pagos manuales** | ✅ Producción | Upload de comprobante |
| **WhatsApp** | ✅ Producción | Generación de mensaje |
| **IA (chat ayuda)** | ✅ Producción | Google Gemini |
| **CI/CD** | ✅ Producción | GitHub Actions automático |
| **SSL** | ✅ Producción | Let's Encrypt auto-renewal |

### 13.2 Datos en Producción

| Colección | Documentos aprox. |
|-----------|-------------------|
| Negocios (businessconfigs) | 8 |
| Productos | 90 |
| Categorías | 30 |
| Pedidos activos | ~138 |
| Pedidos completados | ~430 |
| Clientes | ~330 |
| Toppings | 12 |
| Admins | 8 |
| Suscripciones | 7 |
| Zonas de delivery | 9 |
| Reseñas | 18 |
| Cajas registradoras | 5 |

---

## 14. Estimación de Tiempo de Construcción

### 14.1 Desglose por Módulo

| Módulo | Complejidad | Estimación (1 dev senior) |
|--------|-------------|---------------------------|
| **Arquitectura base** (Express, Docker, MongoDB, Auth) | Alta | 3-4 semanas |
| **Sistema multi-tenant** (aislamiento, middleware, resolvers) | Alta | 2-3 semanas |
| **Menú digital** (categorías, productos, toppings, combos) | Alta | 3-4 semanas |
| **Carrito y checkout** (toppings, cupones, loyalty, tipos de pedido) | Alta | 3-4 semanas |
| **Sistema de pedidos** (estados, tracking, archivado, limpieza) | Alta | 2-3 semanas |
| **POS** (checkout, caja, tickets, offline, sync) | Muy alta | 4-5 semanas |
| **Kitchen display** | Media | 1-2 semanas |
| **Panel admin** (dashboard, CRUD, analytics, exportación) | Muy alta | 5-6 semanas |
| **Sistema de delivery** (3 modos, GPS tracking, zonas, geocoding) | Muy alta | 4-5 semanas |
| **Pagos y suscripciones** (ePayco, dLocal, manual, cupones) | Alta | 3-4 semanas |
| **Programa de fidelidad** (puntos, niveles, canjes) | Media | 2-3 semanas |
| **Reseñas** | Media | 1-2 semanas |
| **Reservas** (con recordatorios automáticos) | Media | 2-3 semanas |
| **CRM de clientes** | Media | 1-2 semanas |
| **Mesas y pisos** (editor visual, QR) | Media | 2-3 semanas |
| **SuperAdmin** (gestión plataforma, banners, anuncios) | Alta | 3-4 semanas |
| **Catálogo público** (directorio, búsqueda, detalle) | Media | 2-3 semanas |
| **Landing page + SEO** (12 nichos, blog, pricing) | Media | 2-3 semanas |
| **WebSocket real-time** (Socket.IO, SSE, viewer tracking) | Alta | 2-3 semanas |
| **Push notifications** (VAPID, servicio, suscripciones) | Media | 1-2 semanas |
| **Email system** (multi-provider, templates) | Media | 1-2 semanas |
| **Integración IA** (Gemini chat, sugerencias) | Media | 1-2 semanas |
| **PWA + Service Worker** | Media | 1-2 semanas |
| **Infraestructura** (Docker, Nginx, CI/CD, SSL) | Alta | 2-3 semanas |
| **Testing, debugging, pulido** | — | 4-6 semanas |

### 14.2 Resumen de Tiempo

| Escenario | Tiempo |
|-----------|--------|
| **1 desarrollador senior full-stack** | 12-16 meses |
| **1 dev senior + 1 dev mid** | 8-11 meses |
| **Equipo de 3 (senior + 2 mid)** | 5-7 meses |
| **Equipo de 5 (2 senior + 2 mid + 1 junior)** | 4-5 meses |

> Nota: Estos tiempos asumen desarrollo desde cero, sin dependencias de terceros pre-existentes. Con experiencia previa en el dominio de restaurantes, podría reducirse un 20-30%.

---

## 15. Estimación de Precio del Proyecto

### 15.1 Por Contratación de Desarrollo

**Tarifas por hora aproximadas (LATAM/Colombia):**

| Rol | Tarifa/hora (USD) |
|-----|-------------------|
| Dev Senior Full-Stack | $30 - $50 |
| Dev Mid Full-Stack | $20 - $35 |
| Dev Junior | $12 - $20 |
| DevOps | $35 - $55 |
| Diseñador UI/UX | $25 - $45 |

**Escenario: Equipo de desarrollo en LATAM**

| Concepto | Horas | Tarifa/h | Total |
|----------|-------|----------|-------|
| 1 Dev Senior Full-Stack (líder) | ~1,600h (10 meses) | $40 | $64,000 |
| 1 Dev Mid Frontend | ~1,200h (8 meses) | $28 | $33,600 |
| 1 Dev Mid Backend | ~1,000h (7 meses) | $28 | $28,000 |
| DevOps (parcial) | ~200h | $45 | $9,000 |
| UI/UX Design | ~300h | $35 | $10,500 |
| **Subtotal desarrollo** | | | **$145,100** |
| QA/Testing (15%) | | | $21,765 |
| Gestión de proyecto (10%) | | | $14,510 |
| **Total LATAM** | | | **~$180,000 - $200,000 USD** |

**Escenario: Desarrollo en USA/Europa**

| Concepto | Total |
|----------|-------|
| Mismo scope, tarifas $80-150/h | **$350,000 - $500,000 USD** |

**Escenario: Agencia de desarrollo (LATAM)**

| Concepto | Total |
|----------|-------|
| Proyecto llave en mano, agencia premium | **$120,000 - $180,000 USD** |
| Proyecto llave en mano, agencia mid-range | **$60,000 - $100,000 USD** |

### 15.2 Valor de Mercado del Producto

| Factor | Valor estimado |
|--------|----------------|
| Código fuente como activo | $80,000 - $150,000 USD |
| Con 8 clientes activos y base de datos | $100,000 - $200,000 USD |
| Con marca, dominio.tech y 500+ pedidos | +$20,000 - $30,000 USD |
| **Valor total estimado del producto** | **$120,000 - $250,000 USD** |

### 15.3 Comparación con Competidores

| Competidor | Precio mensual (por restaurante) | Funcionalidades incluidas |
|-----------|--------------------------------|--------------------------|
| **Poster POS** | $50 - $100/mes | POS + inventario |
| **Square for Restaurants** | $60 - $165/mes | POS + pedidos + analytics |
| **Toast** | $0 - $165/mes | POS + pedidos + marketing |
| **Rappi/iFood (marketplace)** | 20-30% comisión | Solo delivery |
| **Pedidos Ya** | 15-25% comisión | Solo delivery |
| **MenuBy (este proyecto)** | ~$10-15 USD/mes | Menú + POS + delivery + loyalty + reservas + CRM + analytics + IA |

> MenuBy ofrece significativamente más funcionalidades a un precio mucho menor que los competidores establecidos, lo que lo posiciona como una opción atractiva para mercados LATAM.

---

## 16. Fortalezas

| # | Fortaleza | Detalle |
|---|-----------|---------|
| 1 | **Funcionalidad extremadamente completa** | 224 endpoints, 163 componentes, cubre prácticamente todo el lifecycle de un restaurante |
| 2 | **Multi-tenant real** | Aislamiento de datos por negocio desde middleware hasta base de datos |
| 3 | **Tiempo real** | WebSockets para pedidos, tracking GPS, viewer analytics, SSE como fallback |
| 4 | **3 modos de delivery** | Desde básico hasta tracking GPS en vivo — se adapta al tamaño del negocio |
| 5 | **POS con modo offline** | IndexedDB + motor de sincronización — funciona sin internet |
| 6 | **Soporta 13 tipos de negocio** | No solo restaurantes: hoteles, barberías, panaderías, etc. |
| 7 | **PWA completa** | Instalable, push notifications, service worker |
| 8 | **Email multi-provider** | 480 emails/día gratis con routing inteligente |
| 9 | **IA integrada** | Chat de ayuda con Google Gemini para configuración |
| 10 | **SEO** | 12 páginas de nicho, blog, meta tags dinámicos, JSON-LD |
| 11 | **Costo de infraestructura bajísimo** | ~$12-21/mes para toda la plataforma |
| 12 | **CI/CD automatizado** | GitHub Actions con deploy automático |
| 13 | **Onboarding guiado** | Tours interactivos y wizard para nuevos usuarios |
| 14 | **Exportación profesional** | Excel con múltiples hojas, PDF, reportes |

---

## 17. Debilidades y Deuda Técnica

| # | Debilidad | Severidad | Detalle |
|---|-----------|-----------|---------|
| 1 | **Credenciales en historial de git** | 🔴 Crítico | MongoDB, JWT, SMTP passwords persisten en commits antiguos |
| 2 | **Sin tests automatizados** | 🔴 Alto | 0 unit tests, 0 integration tests, 0 e2e tests |
| 3 | **Componentes demasiado grandes** | 🟡 Medio | CartSummary (1,943 líneas), ModernOrdersDashboard (1,800 líneas) — difíciles de mantener |
| 4 | **Sin Redis/cache externo** | 🟡 Medio | Todos los caches son in-memory — se pierden al reiniciar, no escalan a múltiples instancias |
| 5 | **Sin TypeScript** | 🟡 Medio | Todo el proyecto es JavaScript puro — más propenso a errores de tipo |
| 6 | **Single point of failure** | 🟡 Medio | 1 servidor, 1 contenedor, sin redundancia |
| 7 | **Paquetes de frontend en backend** | 🟢 Bajo | `leaflet`, `react-leaflet`, `recharts` en package.json del backend |
| 8 | **Sin documentación de API** | 🟡 Medio | No hay Swagger/OpenAPI para los 224 endpoints |
| 9 | **Pasarelas de pago en sandbox** | 🟡 Medio | ePayco y dLocal no procesan pagos reales aún |
| 10 | **Sin sistema de logs centralizado** | 🟢 Bajo | Los logs solo están en Docker stdout — no hay ELK/CloudWatch |
| 11 | **Sin backups automatizados** | 🟡 Medio | MongoDB Atlas tiene backups propios, pero no hay estrategia documentada |
| 12 | **sin validación de entrada completa** | 🟡 Medio | Algunos endpoints confían en la estructura del body sin validación explícita (express-validator / Joi ausentes) |

---

## 18. Recomendaciones

### Prioridad Alta (hacer ya)

1. **Rotar todas las credenciales** expuestas en git (MongoDB, JWT, SMTP, APIs)
2. **Verificar que el repo sea privado** en GitHub
3. **Agregar validación de entrada** con Joi o express-validator en endpoints críticos
4. **Eliminar paquetes innecesarios** del backend (`leaflet`, `react-leaflet`, `recharts`)

### Prioridad Media (próximos meses)

5. **Escribir tests** — al menos para auth, orders, y payments
6. **Migrar a TypeScript** gradualmente (empezar por los modelos y middleware)
7. **Documentar API** con Swagger/OpenAPI
8. **Agregar Redis** para cache compartido y Socket.IO adapter
9. **Dividir componentes grandes** (CartSummary, ModernOrdersDashboard) en sub-componentes
10. **Activar pasarelas de pago** en modo producción (ePayco/dLocal)

### Prioridad Baja (futuro)

11. **Escalar a 2+ instancias** con load balancer
12. **Agregar sistema de logs** centralizado (ELK, Loki, etc.)
13. **Implementar backups** automatizados documentados
14. **Considerar microservicios** para el servicio de delivery (alto acoplamiento con WebSockets)
15. **Agregar rate limiting más granular** por tenant

---

## 19. Conclusión

**MenuBy es un producto SaaS notablemente completo y ambicioso para haber sido desarrollado por un único desarrollador.** Con 84,700 líneas de código, 224 endpoints API, 163 componentes React, y soporte para 13 tipos de negocio, el sistema cubre prácticamente todo el ciclo de vida de un restaurante digital: desde la vitrina del menú hasta el tracking GPS del domiciliario.

**Puntos destacados:**
- La relación funcionalidad/costo es excepcional — el stack gratuito/barato (Cloudflare Pages, multi-email, MongoDB Atlas free) mantiene los costos operativos en ~$12-21/mes
- El soporte multi-tenant con aislamiento real es una decisión arquitectónica sólida que permite escalar el modelo SaaS
- Las funcionalidades en tiempo real (WebSockets, GPS tracking, viewer analytics) son diferenciadores competitivos frente a soluciones más simples
- El sistema POS con modo offline demuestra madurez técnica

**Áreas críticas de atención:**
- La rotación de credenciales expuestas es URGENTE
- La ausencia total de tests automatizados es el mayor riesgo técnico para el mantenimiento a largo plazo
- El servidor actual (960 MB RAM) soportará ~20-50 negocios antes de necesitar upgrade

**Valor estimado: $120,000 - $250,000 USD** dependiendo del contexto de venta (código fuente, clientes activos, marca).

---

*Documento generado automáticamente mediante análisis estático del repositorio SisRestaurantes.*
