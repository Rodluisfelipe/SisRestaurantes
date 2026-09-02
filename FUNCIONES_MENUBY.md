# MenuBy — Funciones Completas

*Catálogo de todo lo que MenuBy ofrece a un negocio cliente (no incluye herramientas internas de MenuBy: superadmin, debug, auditoría interna, etc.). Actualizado 2026-08-30 a partir de lectura directa del código fuente.*

## 💼 Planes y Precios Comerciales (2026)

### Gratis — $0 siempre
- 20 productos, 5 categorías, 30 pedidos/mes, 5 mesas, 1 usuario
- Menú QR, carrito básico, logo y portada, 1 zona de entrega, reseñas, Google OAuth
- Autoprint: 1 impresora
- Lealtad: puntos básicos sin tiers

### Starter — $39.900/mes · $34.900/mes anual ($418.800/año)
- 60 productos, 12 categorías, 350 pedidos/mes, 15 mesas, 3 usuarios
- Todo lo de Gratis + push notifications, zonas de entrega ilimitadas, toppings/extras, 3 cupones, 1 banner, KDS básico
- Autoprint: 2 impresoras
- Lealtad: puntos + recompensas canjeables
- Distintivo verificado en menú: rojo

### Pro — $59.900/mes · $49.900/mes anual ($598.800/año)
- Ilimitado en todo
- Todo lo de Starter + pedidos ilimitados, reservas, recordatorios automáticos, tiers de lealtad, cupones ilimitados, 3 banners, carritos abandonados, analytics completo, IA
- Autoprint: impresoras ilimitadas
- Lealtad: tiers completos
- Distintivo verificado en menú: azul

### Pro Max — $89.900/mes · $74.900/mes anual ($898.800/año)
- Ilimitado en todo
- Todo lo de Pro + soporte prioritario, acceso a eventos exclusivos, tutoriales premium y nuevas funciones con acceso anticipado
- Autoprint: impresoras ilimitadas
- Lealtad: tiers completos
- Distintivo verificado en menú: dorado

### Complementos aparte del plan (add-ons de pago)
- **`whatsapp_inbox`** — Bandeja de WhatsApp Cloud API (chat bidireccional oficial vía Meta)
- **`whatsapp_agent`** — Agente de IA que responde WhatsApp automáticamente
- **Inventario por niveles**: `off` (sin inventario), `basic` (stock por producto) o `advanced` (insumos + recetas) — es una configuración propia del negocio, no depende del plan comercial

---

## 📊 Dashboard y Analíticas
- **Panel de métricas**: KPIs en tiempo real, gráficas de ventas, productos más vendidos, pedidos por canal/tipo/pago (Recharts)
- **Visitantes en tiempo real**: cuántas personas están viendo el menú en este momento
- **Carritos abandonados**: analítica de ventas perdidas — clientes que agregaron productos pero no completaron el pedido
- **Score de salud del menú** (`MenuHealthScore`): calificación 0-100 que audita fotos faltantes, descripciones vacías, categorías sin productos, horarios sin configurar, productos destacados, etc., con checklist accionable que enlaza directo a la pestaña a corregir
- **Herramientas / calculadoras de negocio** (`ToolsPanel`): 6 calculadoras integradas — ganancias del día, precio de venta ideal según margen, punto de equilibrio, división de propinas entre el equipo, impacto de un descuento en el margen, ticket promedio y potencial de crecimiento
- **Calculadora rápida** (`Calculator`): calculadora numérica flotante dentro del panel

---

## 🍽️ Menú Digital
- **Categorías y productos**: crear, editar y organizar con imagen, descripción y precio, reordenamiento drag & drop
- **Grupos de toppings/extras**: opciones adicionales por producto (extras, tamaños, ingredientes), con sub-grupos anidados y **tope configurable de selecciones** por sub-grupo (ej: "máximo 3 vegetales de 4"), con opción de permitir repetir la misma opción
- **Productos destacados**: seleccionar productos para resaltar en una sección especial del menú
- **Sección "Los más pedidos"** (`PopularSectionManager`): sección inteligente de best-sellers con 3 modos — *híbrido* (ventas + destacados + favoritos), *automático* (solo ventas reales en una ventana de días configurable) o *manual* (solo los que el negocio fije); permite fijar u ocultar productos puntuales y mostrar insignias/conteo de pedidos
- **Búsqueda y filtrado**: los clientes buscan productos y filtran por categoría
- **Favoritos**: los clientes guardan sus productos favoritos (con toppings seleccionados) para acceder rápido
- **Historial de pedidos**: los clientes ven sus pedidos anteriores
- **Menú compartido entre sucursales**: una sucursal puede usar el mismo catálogo que la principal, o tener uno independiente (ver Sucursales)

---

## 🛒 Sistema de Pedidos
- **Carrito de compras**: agregar/quitar productos, personalizar toppings, resumen del pedido
- **Confirmación de pedido**: modal de confirmación con opciones de pago y comprobante
- **Seguimiento en tiempo real**: los clientes ven el estado de su pedido en vivo (preparando, en camino, entregado)
- **Notificaciones push**: el cliente recibe notificaciones cuando su pedido cambia de estado
- **Dashboard de pedidos activos**: el admin ve todos los pedidos y cambia estados en tiempo real
- **Modo Operación**: pantalla móvil a pantalla completa optimizada para manejar el flujo de pedidos con una mano (botones grandes, lista única, sin doble scroll)
- **Pedidos completados**: historial con filtros avanzados, exportación a Excel (varias hojas) y resumen estadístico

---

## 📅 Reservas / Citas (Bookings)
- **Agenda de reservas**: crear, confirmar, cancelar y gestionar citas o reservas
- **Slots disponibles**: configurar horarios y disponibilidad
- **Asignación de staff**: asignar personal a cada reserva
- **Recordatorios automáticos**: notificaciones push y email 24h y 1h antes de la cita
- **Confirmación por WhatsApp**: enviar confirmación de cita al cliente por WhatsApp con un clic
- **Historial por cliente**: ver todas las reservas de un cliente por teléfono

---

## 🚚 Delivery
- **3 modos de domicilio**: Modo 1 (QR básico de asignación), Modo 2 (domiciliarios fijos del negocio), Modo 3 (tracking GPS en vivo)
- **Zonas de entrega**: polígonos/radios en mapa con precio fijo, por distancia o por niveles
- **Domiciliarios propios**: alta/gestión de repartidores del negocio, códigos de acceso diarios rotativos, código de recogida en tienda
- **Login del domiciliario**: por teléfono+contraseña, por PIN de 4 dígitos, o por QR/token temporal — sin credenciales del panel admin
- **Empresas repartidoras (Delivery Partners)**: portal separado para compañías de domiciliarios (no ligadas a un solo negocio) — login propio, gestión de sus conductores, cola de pedidos ofrecidos/aceptados/rechazados, historial y estadísticas
- **Asignación de pedidos**: manual (a un domiciliario o partner específico) o automática
- **Cola de ofertas**: un pedido se ofrece a un domiciliario/partner, que puede aceptar o rechazar (y re-ofrecerse a otro)
- **Confirmación con código**: el domiciliario confirma la entrega con un código de 4 dígitos que ve el cliente
- **Tracking GPS en vivo**: posición del domiciliario por WebSocket, heartbeat de presencia
- **Notificaciones push nativas**: token FCM para avisar al domiciliario en su celular
- **Línea de tiempo auditable**: registro inmutable de cada evento del ciclo de vida del pedido de delivery
- **Estadísticas de domiciliarios**: por domiciliario y globales del negocio
- **Tracking público**: los clientes rastrean su pedido en tiempo real

---

## 👥 Gestión de Clientes
- **Base de clientes**: ver, filtrar y gestionar perfiles de clientes registrados
- **Datos de contacto**: teléfono, nombre, historial de compras
- **Opt-out de campañas**: los clientes pueden marcarse como excluidos de campañas masivas de WhatsApp

---

## 🏆 Programa de Lealtad
- **Programa de puntos**: configurar acumulación de puntos por compra
- **Niveles (tiers)**: crear niveles de fidelidad con beneficios diferenciados
- **Recompensas**: los clientes canjean puntos por descuentos o productos
- **Balance de puntos**: los clientes ven su saldo de puntos en el menú

---

## 🎟️ Cupones y Descuentos
- **Crear cupones**: códigos de descuento con porcentaje o valor fijo
- **Gestionar cupones**: activar, desactivar, ver uso

---

## ⭐ Reseñas
- **Reseñas de clientes**: los clientes dejan calificación y comentario después de un pedido
- **Panel de reseñas**: el admin ve todas las reseñas, responde y activa/desactiva visibilidad
- **Reseñas pendientes**: los clientes ven si tienen reseñas pendientes por completar
- **Integración con Google Places**: autocompletar la dirección del negocio desde Google, vincular el negocio a su ficha de Google (Place ID), traer automáticamente horario, dirección, ubicación, rating, reseñas y fotos de Google

---

## 🎨 Personalización del Menú
- **Tema y colores**: personalizar colores del botón, fondo y texto del menú
- **Logo y portada**: subir logo e imagen de portada del negocio
- **Banners promocionales**: subir banners que se muestran en el menú del cliente
- **Splash screen**: pantalla de carga con logo y nombre del negocio
- **Popups del menú**: anuncios emergentes propios del negocio para sus clientes — modal, barra superior/inferior, toast o pantalla completa; con imagen, CTA, fechas de vigencia y frecuencia de aparición
  - **Captura de leads**: formulario opcional dentro del popup (nombre, email, teléfono, cumpleaños), contactos descargables en CSV
  - **Métricas**: vistas, clics y envíos de formulario por popup

---

## 📱 WhatsApp

### Pedido/consulta por WhatsApp (modo básico, siempre disponible)
- Número de WhatsApp configurable para recibir pedidos o consultas
- Modo de pedido: directo por la app o por WhatsApp
- Plantillas de mensaje personalizables por módulo (pedidos, reservas)
- Confirmación de citas/reservas por WhatsApp con un clic

### Campañas masivas
- Envío de un mensaje promocional a todos los clientes con teléfono registrado (que no se hayan dado de baja)
- Cooldown de 24h entre campañas, selección de destinatarios, estimación de tiempo de envío, opt-out automático vía respuesta "STOP"

### WhatsApp Cloud API — Bandeja, Agente IA y Plantillas (add-on de pago, integración oficial vía Meta)
- **Conexión del número**: por *Embedded Signup* (login con Facebook/Meta, sin ver la consola de Meta ni copiar IDs) o conexión manual con credenciales verificadas contra Meta antes de guardarse
- **Multi-tenant real**: un mismo webhook de Meta enruta por `phone_number_id` al negocio correcto
- **Bandeja de chat bidireccional**: lista de conversaciones, hilo completo por contacto, contexto del cliente (pedidos/reservas relacionados), envío de texto y media, contador de no leídos
- **Agente de IA integrado**: responde automáticamente los chats entrantes, limitable al horario del negocio; se calla solo si alguien del negocio responde a mano
- **Plantillas de Meta**: crear, enviar a revisión/aprobación, listar, eliminar y enviar a un chat puntual
- **Firma de seguridad de webhook**: verificación HMAC para que solo Meta pueda inyectar mensajes

---

## 🔔 Notificaciones
- **Push notifications**: notificaciones al admin cuando llega un nuevo pedido
- **Push al cliente**: notificaciones de cambio de estado del pedido
- **Recordatorios de reserva**: push y email automáticos antes de la cita
- **Email**: configurar proveedor de email (Resend, Brevo, SendGrid) para notificaciones

---

## 📢 Anuncios
- **Anuncios del sistema**: mensajes del SuperAdmin de MenuBy que aparecen como popup en el panel del negocio
- **Marcar como leído**: control de lecturas por negocio
- *(No confundir con los "Popups del menú" — esos los configura el propio negocio para sus clientes finales, ver Personalización)*

---

## 🪑 Mesas y Pisos
- **Gestión de mesas**: crear mesas y pisos para pedidos en sitio
- **QR por mesa**: cada mesa tiene su código QR que abre el menú con el número de mesa

---

## 👨‍💼 Staff y Roles
- **Gestión de equipo**: agregar/eliminar miembros del staff — roles Cajero, Gerente, Admin (dueño) y **Admin de marca** (dueño de varias sucursales, ver Sucursales)
- **Perfil de cada miembro**: nombre, teléfono, especialidad, biografía y foto, con opción de hacerlo público
- **Horario individual por empleado**: días y horas de trabajo configurables por persona
- **Roles y permisos**: restringir acceso a secciones del panel según el rol

---

## 💳 Suscripción
- **Estado de suscripción**: ver plan activo, fechas de vencimiento, período de gracia
- **Pagos**: integración con ePayco y dLocal para pagar/renovar suscripción
- **Pago manual**: subir comprobante para revisión y aprobación del SuperAdmin
- **Créditos por referidos**: aplicables a la suscripción (ver Programa de Referidos)
- **Recordatorios automáticos**: notificaciones de vencimiento, gracia y suspensión

---

## 🤖 Herramientas IA
*(Motor: Groq — modelos Llama 3.3/3.1 y GPT-OSS con fallback entre ellos)*
- **Generador de nombres**: IA sugiere nombres para productos
- **Respuestas a reseñas**: IA genera respuestas a reseñas de clientes
- **Insights de ventas**: la IA analiza los pedidos completados y genera hallazgos/recomendaciones de negocio
- **Chat de ayuda con IA**: asistente conversacional dentro del panel para dudas de configuración

---

## 🖼️ Subida de Imágenes
- **Imágenes de productos**: subir fotos a DigitalOcean Spaces (CDN)
- **Comprobantes de pago**: los clientes suben foto del comprobante al hacer el pedido
- **Banners y anuncios**: imágenes promocionales
- **Fotos de staff y Crew**: foto de perfil de empleados, y foto de perfil + cédula/selfie (KYC) de trabajadores Crew

---

## 🏪 Configuración del Negocio
- **Nombre, descripción y NIT**
- **Dirección y Google Maps**, con vinculación a Google Business (autocompletar/sincronizar dirección, horario, ubicación y reseñas)
- **Estado abierto/cerrado**: overlay de "cerrado" cuando el negocio no está operando
- **Horarios de atención**: configurar horas de apertura por día
- **Redes sociales**: Facebook, Instagram, TikTok, link personalizado
- **Métodos de pago por canal**: Nequi, Daviplata, transferencia, efectivo, tarjeta — cada uno activable por separado para pedidos por WhatsApp y/o in-app, con sus datos de cuenta
- **Configuración de email**: proveedor, notificaciones de reservas

---

## 🔐 Seguridad y Sesiones
- **Autenticación JWT**: login seguro para admins
- **Google OAuth**: login con Google
- **Advertencia de sesión múltiple**: detecta si hay otra sesión activa del mismo admin
- **Onboarding wizard**: asistente guiado para configurar el negocio por primera vez

---

## 💬 Soporte
- **Chat de ayuda**: chat flotante en el panel admin para soporte técnico

---

## 🔄 Servicios Automáticos (Background)
- **Limpieza de pedidos**: auto-cancelación de pedidos abandonados o vencidos
- **Recordatorios de citas**: cron que envía push/email antes de las reservas
- **Gestión de suscripciones**: cron que revisa vencimientos y envía recordatorios
- **Auto-liberación de pagos Crew**: cron que libera el pago (wallet) de un trabajador Crew si el negocio no confirma el cierre del turno

---

## 🧾 Punto de Venta (POS) y Caja
*(Función habilitada por negocio mediante un flag propio — no viene activada por defecto en todos.)*
- **Grid de productos y carrito POS**: venta rápida por categoría, checkout con métodos de pago
- **Mapa de mesas**: selección de mesa para el pedido
- **Tickets/comandas**: impresión vía Print Agent (ver sección aparte)
- **Modo offline**: funciona sin internet (IndexedDB) y sincroniza al reconectar
- **Caja registradora**: apertura con monto inicial, movimientos manuales de ingreso/retiro, cierre con conteo real
- **Cierre de caja inteligente**: calcula el efectivo esperado (apertura + ventas en efectivo + ingresos − retiros − reembolsos) y la diferencia contra el conteo real; separa ventas por canal (POS vs. menú online) y por método de pago, normalizando métodos equivalentes
- **Historial de cajas**: listado paginado de cierres anteriores, quién abrió/cerró y duración del turno
- **Cierre mensual**: resumen por mes calendario — ventas por canal, tipo de pedido y método de pago, con variación % contra el mes anterior

---

## 📦 Inventario, Insumos y Recetas
- **3 niveles de control por negocio**: sin control, básico (stock por producto) o avanzado (insumos + recetas)
- **Insumos**: catálogo de materias primas con unidad de medida, stock, costo, proveedor y alerta de stock bajo
- **Ajustes de stock**: por delta (suma) o por valor exacto (conteo físico), con motivo (compra/merma/ajuste) y nota
- **Historial de movimientos**: cada cambio queda registrado (quién, cuándo, de dónde a dónde) para auditar descuadres
- **Recetas**: define qué insumos y en qué cantidad consume cada producto al venderse, en vez de llevar el conteo por producto terminado
- **Protección de integridad**: no se puede borrar un insumo usado en una receta activa
- **Resumen de inventario**: total de insumos, agotados, bajos, valor total

---

## 🏬 Proveedores (Marketplace)
- **Directorio de proveedores**: negocios marcados como proveedor publican su catálogo (ingredientes, bebidas, equipos, empaques, otros) para que otros negocios les compren
- **Compra a proveedores**: buscar/filtrar productos y proveedores, carrito, nota al comprador y dirección de entrega
- **Pedidos a proveedor**: un negocio ve sus pedidos salientes (lo que compró) y, si es proveedor, sus pedidos entrantes (lo que le compraron)
- **Flujo de aprobación**: cada pedido a proveedor requiere aprobación del SuperAdmin antes de pasar a "en proceso"; el proveedor lo marca luego como "entregado"
- **Notificaciones en tiempo real** al crear, aprobar o cambiar de estado un pedido a proveedor

---

## 🧑‍🍳 MenuBy Crew (marketplace de turnos)
Plataforma paralela dentro del mismo panel para conseguir personal temporal/casual (estudiantes, trabajadores por turno) — con dos lados: **negocios** y **trabajadores (workers)**.

**Para el negocio**
- **Publicar turnos**: fecha, hora, rol/skill requerido, paga y ubicación — visible en el feed de trabajadores cercanos
- **Publicar vacantes fijas**: oferta de empleo continua (a diferencia del turno puntual)
- **Ver postulantes**: aceptar o rechazar
- **Perfil completo del trabajador**: visible solo con postulación o reserva activa (experiencia, educación, referencias, historial en Crew, reseñas)
- **Código de check-in**: cada turno reservado genera un código de 4 dígitos que el trabajador da al llegar — garantiza presencia real; regenerable
- **Completar turno**: libera el pago retenido (escrow) al trabajador; puede forzarse sin check-in en casos excepcionales (queda en auditoría)
- **Reseñas mutuas** entre negocio y trabajador
- **Chat directo** ligado a una postulación/reserva
- **Cancelar turno** con reglas de reembolso según anticipación
- **Wallet del negocio**: saldo prepago para pagar turnos (escrow — se retiene al publicar, se libera al completarse); recarga manual o con comprobante para aprobación de SuperAdmin; cotización previa; extracto de movimientos
- **Empleadores externos**: negocios que no son clientes de MenuBy pueden registrarse solo para contratar turnos vía Crew

**Para el trabajador**
- Registro/login independiente, perfil (foto, experiencias, educación, referencias), verificación KYC (cédula + selfie)
- Gamificación con misiones diarias (XP)
- Feed de turnos/vacantes filtrable por ciudad, rol y distancia
- Aplicar, ver postulaciones/reservas, check-in con código, checkout del turno
- Favoritos, wallet propio con historial y solicitud de retiro
- Historial laboral automático ("CV" generado desde los turnos completados)
- Chat con el negocio/empleador

---

## 🏢 Sucursales y Marcas (multi-ubicación)
- **Auto-creación de marca**: al crear la primera sucursal adicional se genera una "Marca" y el admin se vuelve Admin de marca
- **Alta de sucursal (self-service)**: nombre, slug propio, WhatsApp, dirección; compartir el mismo menú que la principal o clonarlo como punto de partida independiente
- **Selector de sucursal**: cambiar de sucursal activa dentro del mismo panel sin cerrar sesión
- **Eliminar sucursal**: soft-delete de una sucursal no principal (la principal no puede eliminarse)
- **Gestión de marca desde SuperAdmin**: asignar/reasignar sucursales, definir la sucursal principal, cuáles comparten menú, crear la cuenta de Admin de marca
- **Etiqueta de sucursal**: nombre visible para diferenciarlas (ej. "Sede Norte")

---

## 🎁 Programa de Referidos
- **Código de referido propio**: cada negocio obtiene un código único de 8 caracteres para compartir
- **Enlace de registro con código**
- **Panel de mis referidos**: lista, estado (pendiente/calificado/acreditado/rechazado) y estadísticas de conversión
- **Créditos acumulados**: saldo ganado por referir, con historial
- **Validación pública del código** antes de usarlo en el registro
- **Reglas configurables globalmente** (desde SuperAdmin): % de descuento para quien refiere y para el referido, máximos de créditos y referidos, si requiere aprobación manual, meses mínimos de suscripción para calificar
- **Tabla de líderes**: ranking de negocios que más han referido

---

## 🖨️ Print Agent (impresión térmica de tickets)
App de escritorio para Windows (Go/Wails), ubicada en `PrintAgent/`.
- **Conexión por API Key** de 64 caracteres generada desde el panel
- **Streaming en vivo (SSE)**: recibe cada pedido nuevo o solicitud de impresión en tiempo real, sin necesitar el panel abierto
- **Modo de impresión configurable**: comanda, recibo, o ambos
- **Comandos ESC/POS**: impresión directa a impresoras térmicas de 80mm o 58mm, con corte automático opcional
- **Icono en la bandeja del sistema**: estado de conexión, impresora seleccionada, contador de tickets, modo de prueba
- **Límite por plan**: cantidad de agentes/impresoras conectadas según el plan de suscripción
- **Reimpresión manual** de comanda o recibo de un pedido puntual

---

## 🧩 Extensión de navegador (Chrome)
Ubicada en `Extension/` — salta entre Panel, WhatsApp y POS desde cualquier pestaña.
- **Aviso de pedido nuevo con MenuBy cerrado**: revisa cada minuto y muestra notificación del sistema visible hasta que alguien la atiende
- **Contador en el ícono**: pedidos pendientes en rojo; si no hay, chats sin leer en verde
- **Atajos de teclado globales**: `Alt+1/2/3` para saltar a Panel/WhatsApp/POS
- **No duplica pestañas**: trae al frente una ya abierta sin recargarla
- **Reutiliza la sesión del panel**: sin usuario/contraseña aparte

---

## 🔗 Página de enlaces (link in bio)
- **URL pública por negocio o por marca**: logo, portada, descripción, redes sociales, enlace extra, horario y si está abierto ahora
- **Vista de marca**: si el slug es de una marca con varias sucursales, muestra la principal destacada y el listado de todas, cada una con su estado de apertura
- **Productos destacados y rating** incluidos
- **Configuración desde el panel**: tagline, descripción, redes sociales y enlace extra, cada uno con opción de mostrar/ocultar

---

## 🚴 App de Repartidores (Driver App)
App móvil nativa React Native/Expo (`DriverApp/`), para domiciliarios.
- Pantallas: autenticación, inicio (pedidos disponibles/asignados), detalle de pedido, perfil
- **Ubicación en vivo**: GPS en segundo plano mientras el domiciliario está en ruta
- **Push notifications nativas** (Firebase) para nuevas ofertas de pedido
- **Mapa** para rutas/ubicación
- **Conexión en tiempo real** para recibir asignaciones y actualizaciones
- Consume los mismos endpoints de delivery que el resto del sistema (login por teléfono/PIN, ofertas, aceptar/rechazar, confirmar con código, marcar recogido)

---

## ⚠️ Notas de la actualización 2026-08-30

- Título corregido: el POS y la caja registradora sí son una función completa y documentada, no una ausencia.
- Secciones nuevas agregadas por completo: POS y Caja, Inventario/Insumos/Recetas, Proveedores (Marketplace), MenuBy Crew, Sucursales y Marcas, Programa de Referidos, Print Agent, Extensión de navegador, Página de enlaces, Driver App.
- WhatsApp ampliado sustancialmente: se agregó la integración oficial WhatsApp Cloud API (Embedded Signup, bandeja bidireccional, agente de IA, plantillas de Meta — add-on de pago) y las Campañas masivas, ninguna documentada antes.
- IA corregida: el motor es Groq/Llama, no Google Gemini como decía la versión anterior; se agregó Insights de ventas.
- Delivery ampliado con el portal de empresas repartidoras, login por PIN/QR, cola de ofertas y línea de tiempo auditable.
- Se documentó el tope configurable de selecciones (`maxSelections`) en sub-grupos de toppings y la sección "Los más pedidos".
- Se confirmó que `auditLogs.js` es exclusivo de SuperAdmin y por eso no se incluyó como función del negocio.
