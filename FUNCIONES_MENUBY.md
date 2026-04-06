# MenuBy — Funciones Completas (sin POS)

## 📊 Dashboard y Analíticas
- **Panel de métricas**: KPIs en tiempo real, gráficos de ventas, productos más vendidos, estadísticas de clientes
- **Visitantes en tiempo real**: Ver cuántas personas están viendo tu menú en este momento
- **Carritos abandonados**: Analítica de ventas perdidas — cuántos clientes agregaron productos pero no completaron el pedido

---

## 🍽️ Menú Digital
- **Categorías y productos**: Crear, editar y organizar categorías y productos con imagen, descripción y precio
- **Grupos de toppings/extras**: Configurar opciones adicionales por producto (extras, tamaños, ingredientes)
- **Productos destacados**: Seleccionar productos para resaltar en una sección especial del menú
- **Búsqueda y filtrado**: Los clientes pueden buscar productos y filtrar por categoría
- **Favoritos**: Los clientes guardan sus productos favoritos para acceder rápido
- **Historial de pedidos**: Los clientes ven sus pedidos anteriores

---

## 🛒 Sistema de Pedidos
- **Carrito de compras**: Agregar/quitar productos, personalizar toppings, resumen del pedido
- **Confirmación de pedido**: Modal de confirmación con opciones de pago y comprobante
- **Seguimiento en tiempo real**: Los clientes ven el estado de su pedido en vivo (preparando, en camino, entregado)
- **Notificaciones push**: El cliente recibe notificaciones cuando su pedido cambia de estado
- **Dashboard de pedidos activos**: El admin ve todos los pedidos y cambia estados en tiempo real
- **Pedidos completados**: Historial y resumen de pedidos finalizados con métricas

---

## 📅 Reservas / Citas (Bookings)
- **Agenda de reservas**: Crear, confirmar, cancelar y gestionar citas o reservas
- **Slots disponibles**: Configurar horarios y disponibilidad
- **Asignación de staff**: Asignar personal a cada reserva
- **Recordatorios automáticos**: Notificaciones push y email 24h y 1h antes de la cita
- **Confirmación por WhatsApp**: Enviar confirmación de cita al cliente por WhatsApp con un clic
- **Historial por cliente**: Ver todas las reservas de un cliente por teléfono

---

## 🚚 Delivery y Zonas de Entrega
- **Zonas de entrega**: Definir áreas geográficas con costos de envío diferenciados
- **QR para delivery**: Código QR para asignar entregas
- **Tracking público**: Los clientes rastrean su pedido en tiempo real

---

## 👥 Gestión de Clientes
- **Base de clientes**: Ver, filtrar y gestionar perfiles de clientes registrados
- **Datos de contacto**: Teléfono, nombre, historial de compras

---

## 🏆 Programa de Lealtad
- **Programa de puntos**: Configurar acumulación de puntos por compra
- **Niveles (tiers)**: Crear niveles de fidelidad con beneficios diferenciados
- **Recompensas**: Los clientes canjean puntos por descuentos o productos
- **Balance de puntos**: Los clientes ven su saldo de puntos en el menú

---

## 🎟️ Cupones y Descuentos
- **Crear cupones**: Códigos de descuento con porcentaje o valor fijo
- **Gestionar cupones**: Activar, desactivar, ver uso

---

## ⭐ Reseñas
- **Reseñas de clientes**: Los clientes dejan calificación y comentario después de un pedido
- **Panel de reseñas**: El admin ve todas las reseñas, responde y activa/desactiva visibilidad
- **Reseñas pendientes**: Los clientes ven si tienen reseñas pendientes por completar

---

## 🎨 Personalización del Menú
- **Tema y colores**: Personalizar colores del botón, fondo y texto del menú
- **Logo y portada**: Subir logo e imagen de portada del negocio
- **Banners promocioanles**: Subir banners que se muestran en el menú del cliente
- **Splash screen**: Pantalla de carga con logo y nombre del negocio

---

## 📱 WhatsApp
- **Número de WhatsApp**: Configurar número para recibir pedidos o consultas
- **Modo de pedido**: Elegir entre pedido directo por la app o por WhatsApp
- **Confirmación por WhatsApp**: Enviar confirmación de citas/reservas al cliente

---

## 🔔 Notificaciones
- **Push notifications**: Notificaciones al admin cuando llega un nuevo pedido
- **Push al cliente**: Notificaciones de cambio de estado del pedido
- **Recordatorios de reserva**: Push y email automáticos antes de la cita
- **Email**: Configurar proveedor de email (Resend, Brevo, SendGrid) para notificaciones

---

## 📢 Anuncios
- **Anuncios del sistema**: Mensajes del superadmin que aparecen como popup en el panel del negocio
- **Marcar como leído**: Control de lecturas por negocio

---

## 🪑 Mesas y Pisos
- **Gestión de mesas**: Crear mesas y pisos para pedidos en sitio
- **QR por mesa**: Cada mesa tiene su código QR que abre el menú con el número de mesa

---

## 👨‍💼 Staff y Roles
- **Gestión de equipo**: Agregar/eliminar miembros del staff
- **Roles y permisos**: Restringir acceso a secciones del panel según el rol

---

## 💳 Suscripción
- **Estado de suscripción**: Ver plan activo, fechas de vencimiento
- **Pagos**: Integración con ePayco y dLocal para pagar/renovar suscripción
- **Recordatorios automáticos**: Notificaciones de vencimiento, gracia y suspensión

---

## 🤖 Herramientas IA
- **Generador de nombres**: IA sugiere nombres para productos
- **Respuestas a reseñas**: IA genera respuestas a reseñas de clientes

---

## 🖼️ Subida de Imágenes
- **Imágenes de productos**: Subir fotos a DigitalOcean Spaces (CDN)
- **Comprobantes de pago**: Los clientes suben foto del comprobante al hacer el pedido
- **Banners y anuncios**: Imágenes promocionales

---

## 🏪 Configuración del Negocio
- **Nombre, descripción y NIT**
- **Dirección y Google Maps**
- **Estado abierto/cerrado**: Overlay de "cerrado" cuando el negocio no está operando
- **Horarios de atención**: Configurar horas de apertura por día
- **Redes sociales**: Facebook, Instagram, TikTok, link personalizado
- **Configuración de email**: Proveedor, notificaciones de reservas

---

## 🔐 Seguridad y Sesiones
- **Autenticación JWT**: Login seguro para admins
- **Google OAuth**: Login con Google
- **Advertencia de sesión múltiple**: Detecta si hay otra sesión activa del mismo admin
- **Onboarding wizard**: Asistente guiado para configurar el negocio por primera vez

---

## 💬 Soporte
- **Chat de ayuda**: Chat flotante en el panel admin para soporte técnico

---

## 🔄 Servicios Automáticos (Background)
- **Limpieza de pedidos**: Auto-cancelación de pedidos abandonados o vencidos
- **Recordatorios de citas**: Cron que envía push/email antes de las reservas
- **Gestión de suscripciones**: Cron que revisa vencimientos y envía recordatorios
