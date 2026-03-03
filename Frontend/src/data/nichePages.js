/**
 * Niche Landing Pages — SEO-optimized pages per business type.
 * Each page targets a unique long-tail keyword cluster.
 * 
 * Strategy: Like Yumzi (40+ pages) and OlaClick (pages per niche),
 * each page has unique H1, content, features, FAQ, and schema.
 */

export const NICHE_PAGES = {
  'menu-digital-restaurante': {
    slug: 'menu-digital-restaurante',
    emoji: '🍽️',
    keyword: 'menú digital para restaurantes',
    h1: 'Menú Digital para Restaurantes',
    subtitle: 'La carta digital que tus comensales aman. Sin comisiones, sin apps, sin complicaciones.',
    seo: {
      title: 'Menú Digital para Restaurantes | Código QR + Pedidos Online | Menuby',
      description: 'Crea tu menú digital para restaurante con código QR en 5 minutos. Recibe pedidos online, gestiona cocina en tiempo real. Sin comisiones. Prueba 7 días gratis.',
      keywords: 'menú digital restaurante, carta digital restaurante, menú QR restaurante, menú online restaurante, menú interactivo restaurante, sistema pedidos restaurante',
    },
    heroImage: '🍽️',
    stats: [
      { value: '500+', label: 'Restaurantes activos' },
      { value: '35%', label: 'Más ventas promedio' },
      { value: '0%', label: 'Comisión por pedido' },
      { value: '5 min', label: 'Para empezar' },
    ],
    features: [
      { icon: '📱', title: 'Menú QR para Mesas', desc: 'Genera un código QR único. Tus clientes escanean desde la mesa y ven la carta completa con fotos y precios actualizados.' },
      { icon: '🛵', title: 'Pedidos a Domicilio', desc: 'Configura zonas de entrega con cobro automático. Tus clientes piden desde casa directo a tu cocina.' },
      { icon: '👨‍🍳', title: 'Pantalla de Cocina', desc: 'Tu equipo de cocina ve los pedidos en tiempo real con timers y prioridades. Cero tickets perdidos.' },
      { icon: '💳', title: 'Pagos en Línea', desc: 'Acepta tarjeta, Nequi, Daviplata y PSE. El cliente paga directo en el menú digital.' },
      { icon: '📊', title: 'Reportes de Ventas', desc: 'Cierre diario en PDF, productos más vendidos, ticket promedio. Toda la data de tu restaurante.' },
      { icon: '⭐', title: 'Reseñas y Fidelización', desc: 'Tus clientes dejan reseñas después de cada pedido. Construye reputación orgánicamente.' },
    ],
    useCases: [
      'Restaurantes de comida colombiana que quieren recibir pedidos sin Rappi',
      'Restaurantes casuales con menú rotativo que necesitan actualizar platos al instante',
      'Restaurantes con terraza o varias sedes que necesitan QR por mesa',
      'Restaurantes nuevos que quieren una presencia digital profesional desde el día 1',
    ],
    faq: [
      { q: '¿Cómo funciona el menú digital para restaurante?', a: 'Tus clientes escanean un código QR desde la mesa o acceden a un link. Ven tu carta con fotos, precios y descripciones. Pueden pedir directo desde el celular sin descargar ninguna app.' },
      { q: '¿Puedo personalizar el diseño del menú?', a: 'Sí. Puedes subir tu logo, elegir colores, configurar categorías y agregar fotos profesionales a cada plato. El menú refleja la identidad de tu restaurante.' },
      { q: '¿Se integra con WhatsApp?', a: 'Sí. Los pedidos pueden enviarse por WhatsApp con un mensaje formateado que incluye platos, cantidades, precios y dirección de entrega.' },
      { q: '¿Cuánto cuesta el menú digital para restaurante?', a: 'Menuby cuesta $30.000 COP al mes, todo incluido. Sin comisiones por pedido, sin contratos. Los primeros 7 días son gratis.' },
    ],
    longContent: `
## ¿Por Qué tu Restaurante Necesita un Menú Digital?

En 2026, más del 70% de los comensales en Colombia consultan el menú de un restaurante desde su celular antes de visitarlo. Un **menú digital para restaurante** no es un lujo, es una necesidad competitiva.

Con Menuby, tu restaurante obtiene una carta digital profesional que se actualiza en tiempo real. Cambia precios, agrega platos del día, marca productos agotados y destaca promociones — todo desde tu celular, sin llamar a ningún diseñador.

### Ventajas del Menú Digital vs la Carta Impresa

| Aspecto | Menú Digital | Carta Impresa |
|---|---|---|
| Actualización | Instantánea | Requiere reimprimir |
| Costo mensual | $30.000 COP | $50.000+ en impresión |
| Fotos de platos | Sí, ilimitadas | Costoso por plato |
| Pedidos online | Integrado | No disponible |
| Alérgenos e info nutricional | Configurable | Espacio limitado |
| Higiene | Sin contacto | Tocar menú compartido |

### Cómo Funciona Menuby para Restaurantes

1. **Regístrate gratis** en menuby.tech — toma menos de 5 minutos
2. **Sube tus platos** con fotos, precios, categorías y descripciones
3. **Imprime tu QR** o comparte tu link personalizado
4. **Recibe pedidos** en tu pantalla de cocina o por WhatsApp

Tu restaurante está listo para vender más, sin intermediarios y sin comisiones.
    `,
  },

  'menu-digital-bar': {
    slug: 'menu-digital-bar',
    emoji: '🍺',
    keyword: 'menú digital para bares',
    h1: 'Menú Digital para Bares y Gastrobares',
    subtitle: 'Carta de tragos digital con QR. Pedidos desde la mesa, sin esperar al mesero.',
    seo: {
      title: 'Menú Digital para Bares y Gastrobares | QR + Pedidos Mesa | Menuby',
      description: 'Menú digital para bar con código QR. Carta de cócteles, tragos y comida. Pedidos desde la mesa sin esperar. Sin comisiones. 7 días gratis.',
      keywords: 'menú digital bar, carta digital bar, menú QR bar, carta tragos digital, menú gastrobar, carta cócteles digital',
    },
    heroImage: '🍺',
    stats: [
      { value: '120+', label: 'Bares activos' },
      { value: '45%', label: 'Más pedidos por mesa' },
      { value: '0%', label: 'Comisión' },
      { value: '3 min', label: 'Tiempo de pedido' },
    ],
    features: [
      { icon: '🍸', title: 'Carta de Tragos Digital', desc: 'Muestra tu carta de cócteles con fotos profesionales, ingredientes y precios. Actualiza en segundos.' },
      { icon: '📱', title: 'QR en Cada Mesa', desc: 'Un QR por mesa. Tu cliente escanea, ve la carta y pide sin levantar la mano.' },
      { icon: '🎵', title: 'Ambiente Sin Interrupciones', desc: 'Los clientes piden desde el celular sin interrumpir la música o el ambiente del bar.' },
      { icon: '💳', title: 'Pagos Instantáneos', desc: 'Pago con tarjeta, Nequi o Daviplata directo desde el menú digital.' },
      { icon: '🕐', title: 'Happy Hour Automático', desc: 'Configura precios de happy hour y se actualizan automáticamente en el menú.' },
      { icon: '📊', title: 'Tragos Más Vendidos', desc: 'Reportes de ventas te muestran cuáles cócteles son los favoritos de tus clientes.' },
    ],
    useCases: [
      'Bares de cócteles con carta extensa que cambia por temporada',
      'Gastrobares que quieren combinar carta de comida y tragos en un solo menú',
      'Rooftop bars que buscan una experiencia premium sin esperar al mesero',
      'Bares deportivos con promociones por evento que necesitan actualizar precios al instante',
    ],
    faq: [
      { q: '¿Puedo mostrar cócteles con sus ingredientes?', a: 'Sí. Cada trago puede tener foto, descripción, ingredientes, nivel de alcohol y precio. También puedes marcar si es dulce, amargo, refrescante, etc.' },
      { q: '¿Funciona en ambientes oscuros?', a: 'Sí. El menú digital se ve en la pantalla del celular del cliente, por lo que funciona perfectamente en bares con poca iluminación.' },
      { q: '¿Puedo tener carta de tragos y comida por separado?', a: 'Sí. Puedes organizar tu menú con categorías como "Cócteles", "Shots", "Cervezas Artesanales", "Entradas", "Platos Fuertes", etc.' },
      { q: '¿Cuánto cuesta para mi bar?', a: '$30.000 COP al mes. El mismo precio para bares de cualquier tamaño, sin comisiones por pedido.' },
    ],
    longContent: `
## Carta Digital para Bares: Más Pedidos, Menos Esperas

Los bares pierden hasta el **25% de pedidos potenciales** cuando los clientes tienen que esperar al mesero. Con un **menú digital para bar**, tus clientes escanean el QR y piden desde su celular al instante.

### ¿Por Qué los Bares Necesitan un Menú Digital?

- **Rotación más rápida**: el cliente pide sin esperar, consume más
- **Menos errores**: el pedido llega escrito directo a la barra
- **Happy hour automático**: precios se actualizan solos
- **Carta siempre actualizada**: agrega o quita tragos al instante

### Menuby vs Carta Impresa para Bares

En un bar con poca luz, leer una carta impresa es incómodo. Con Menuby, tu carta de tragos se ve perfecta en el celular, con fotos de cada cóctel que despiertan el antojo y aumentan el ticket promedio.
    `,
  },

  'menu-digital-cafeteria': {
    slug: 'menu-digital-cafeteria',
    emoji: '☕',
    keyword: 'menú digital para cafeterías',
    h1: 'Menú Digital para Cafeterías',
    subtitle: 'Carta digital con QR para café especial, postres y brunch. Pide desde la mesa o para llevar.',
    seo: {
      title: 'Menú Digital para Cafeterías | Carta QR + Pedidos Online | Menuby',
      description: 'Crea el menú digital de tu cafetería con QR. Carta de café especial, postres y brunch. Pedidos para mesa y para llevar. Sin comisiones. 7 días gratis.',
      keywords: 'menú digital cafetería, carta digital café, menú QR cafetería, menú digital café especial, carta cafetería online',
    },
    heroImage: '☕',
    stats: [
      { value: '80+', label: 'Cafeterías activas' },
      { value: '28%', label: 'Más ticket promedio' },
      { value: '0%', label: 'Comisión' },
      { value: '5 min', label: 'Para empezar' },
    ],
    features: [
      { icon: '☕', title: 'Carta de Café Especial', desc: 'Muestra origen del grano, método de preparación y notas de sabor. Ideal para café de especialidad.' },
      { icon: '🍰', title: 'Vitrina Digital', desc: 'Tus postres y pastelería con fotos que despiertan el antojo. Actualiza la vitrina en tiempo real.' },
      { icon: '📲', title: 'Pedidos para Llevar', desc: 'El cliente pide desde el celular antes de llegar. Su café lo espera listo.' },
      { icon: '🧁', title: 'Menú de Brunch', desc: 'Organiza una sección especial de brunch con horarios automáticos de disponibilidad.' },
      { icon: '💳', title: 'Pago Anticipado', desc: 'El cliente paga desde la app. Reduce filas y agiliza el servicio.' },
      { icon: '⭐', title: 'Reseñas de Café', desc: 'Tus clientes califican la experiencia. Construye reputación para tu cafetería.' },
    ],
    useCases: [
      'Cafeterías de especialidad que quieren mostrar el origen y perfil del grano',
      'Cafeterías con brunch que necesitan un menú que cambia por horario',
      'Coffee shops con alta rotación que necesitan agilizar pedidos',
      'Cafeterías con repostería propia que quieren una vitrina visual atractiva',
    ],
    faq: [
      { q: '¿Puedo mostrar los métodos de preparación del café?', a: 'Sí. Puedes crear categorías como "Pour Over", "Espresso", "Cold Brew" y describir cada preparación con detalle.' },
      { q: '¿Se puede configurar menú diferente para mañana y tarde?', a: 'Sí. Puedes marcar productos como disponibles solo en ciertos horarios, perfecto para brunch.' },
      { q: '¿Es bueno para cafeterías pequeñas?', a: 'Perfecto. No importa si tienes 10 o 100 productos. El precio es el mismo: $30.000 COP/mes sin comisiones.' },
      { q: '¿Los clientes necesitan descargar una app?', a: 'No. El menú se abre directamente en el navegador del celular. Solo escanean el QR o abren el link.' },
    ],
    longContent: `
## Menú Digital para Cafeterías: Más que una Carta de Café

Las cafeterías modernas en Colombia necesitan más que un pizarrón de precios. Un **menú digital para cafetería** con fotos profesionales y QR aumenta el ticket promedio hasta un 28%.

### ¿Qué Incluye Menuby para Cafeterías?

- **Categorías personalizadas**: Café caliente, Café frío, Postres, Brunch, Panadería
- **Fotos que venden**: Cada producto con imagen de alta calidad
- **QR para mesas y barra**: El cliente pide desde donde esté
- **Pedidos para llevar**: Perfecto para cafeterías con takeaway

### Todo por $30.000 COP/mes — Sin Comisiones

Mientras Rappi te cobra entre el 20% y 30% por cada pedido, con Menuby pagas un precio fijo mensual sin importar cuántos cafés vendas.
    `,
  },

  'menu-digital-pizzeria': {
    slug: 'menu-digital-pizzeria',
    emoji: '🍕',
    keyword: 'menú digital para pizzerías',
    h1: 'Menú Digital para Pizzerías',
    subtitle: 'Carta digital con personalización de toppings, mitades y combos. Pedidos directos sin comisión.',
    seo: {
      title: 'Menú Digital para Pizzerías | Toppings + Pedidos Online | Menuby',
      description: 'Menú digital para pizzería con QR. Personalización de toppings, tamaños y mitades. Pedidos a domicilio sin comisión. 7 días gratis.',
      keywords: 'menú digital pizzería, carta digital pizzería, menú QR pizza, sistema pedidos pizzería, pizza a domicilio sin comisión',
    },
    heroImage: '🍕',
    stats: [
      { value: '90+', label: 'Pizzerías activas' },
      { value: '40%', label: 'Menos errores en pedidos' },
      { value: '0%', label: 'Comisión' },
      { value: '$30K', label: 'COP al mes' },
    ],
    features: [
      { icon: '🍕', title: 'Toppings Personalizables', desc: 'El cliente elige extras, quita ingredientes y personaliza su pizza directo en el menú digital.' },
      { icon: '📏', title: 'Tamaños y Mitades', desc: 'Configura personal, mediana, grande y familiar. Permite mitad y mitad con selector visual.' },
      { icon: '🛵', title: 'Delivery Sin Comisión', desc: 'Recibe pedidos a domicilio directos. Zonas de entrega con cobro de envío automático.' },
      { icon: '🎁', title: 'Combos y Promociones', desc: 'Crea combos de pizza + bebida + postre. Descuentos por martes o días lentos.' },
      { icon: '👨‍🍳', title: 'Pantalla de Cocina', desc: 'El pizzero ve cada pedido con detalles de toppings, tamaño y observaciones.' },
      { icon: '📊', title: 'Pizza Más Vendida', desc: 'Reportes con las pizzas top, toppings favoritos y horarios pico de pedidos.' },
    ],
    useCases: [
      'Pizzerías con amplia variedad de toppings personalizables',
      'Pizzerías que hacen delivery propio sin querer pagar comisiones a Rappi',
      'Cadenas de pizzería con múltiples sedes y menú centralizado',
      'Pizzerías artesanales que quieren mostrar sus ingredientes premium',
    ],
    faq: [
      { q: '¿Se pueden configurar extras y toppings?', a: 'Sí. Menuby permite crear grupos de toppings con precios individuales. El cliente personaliza su pizza desde el menú digital.' },
      { q: '¿Funciona para delivery de pizzas?', a: 'Sí. Configuras tus zonas de entrega y el costo de envío se calcula automáticamente según la dirección del cliente.' },
      { q: '¿Puedo tener tamaño personal, mediana, grande y familiar?', a: 'Sí. Cada pizza puede tener múltiples tamaños con precios diferentes.' },
      { q: '¿Cuánto cuesta Menuby para pizzerías?', a: '$30.000 COP al mes. Sin comisión por pizza vendida, sin importar cuántos pedidos recibas.' },
    ],
    longContent: `
## Menú Digital para Pizzerías: Toppings, Delivery y Más

Una **pizzería sin menú digital** pierde pedidos todos los días. Con Menuby, tu pizzería recibe pedidos directos con total personalización de toppings, tamaños y extras.

### ¿Por Qué Menuby para Pizzerías?

- **Sin comisiones**: Rappi cobra 25-30% por cada pizza. Con Menuby, $0 comisión
- **Personalización total**: El cliente elige exactamente lo que quiere
- **Menos errores**: Los pedidos llegan escritos a la cocina, no interpretados por teléfono
- **Delivery propio**: Zonas de entrega configurables con cobro automático

### La Pizza Perfecta, Personalizada por el Cliente

El menú digital de Menuby permite al cliente seleccionar tamaño, masa, salsa y cada topping individualmente. El pedido llega completo y detallado a la pantalla de cocina de tu pizzería.
    `,
  },

  'menu-digital-hamburgueseria': {
    slug: 'menu-digital-hamburgueseria',
    emoji: '🍔',
    keyword: 'menú digital para hamburgueserías',
    h1: 'Menú Digital para Hamburgueserías',
    subtitle: 'Carta digital con combos, adiciones y personalización. Pedidos directos sin intermediarios.',
    seo: {
      title: 'Menú Digital para Hamburgueserías | Combos + Delivery | Menuby',
      description: 'Menú digital para hamburguesería con QR. Combos, adiciones, delivery propio sin comisión. Pantalla de cocina en tiempo real. 7 días gratis.',
      keywords: 'menú digital hamburguesería, carta digital hamburguesas, sistema pedidos hamburguesas, delivery hamburguesas sin comisión',
    },
    heroImage: '🍔',
    stats: [
      { value: '150+', label: 'Hamburgueserías' },
      { value: '50%', label: 'Más upselling' },
      { value: '0%', label: 'Comisión' },
      { value: '2 min', label: 'Pedido promedio' },
    ],
    features: [
      { icon: '🍔', title: 'Combos Inteligentes', desc: 'Combina hamburguesa + papas + bebida. El cliente arma su combo con un par de toques.' },
      { icon: '🧀', title: 'Adiciones y Extras', desc: 'Queso extra, tocineta, huevo, salsas artesanales — todo configurable con precios.' },
      { icon: '🛵', title: 'Delivery Propio', desc: 'Zonas de entrega con tarifa automática. Recibe pedidos a domicilio sin pagar comisión.' },
      { icon: '⏱️', title: 'Tiempos de Preparación', desc: 'La pantalla de cocina muestra cada pedido con timer. Tu equipo no pierde ni una orden.' },
      { icon: '📸', title: 'Fotos que Venden', desc: 'Cada hamburguesa con foto profesional. Las fotos aumentan la conversión hasta 30%.' },
      { icon: '🔔', title: 'Notificación al Cliente', desc: 'El cliente recibe notificación cuando su pedido está listo. Mejora la experiencia.' },
    ],
    useCases: [
      'Hamburgueserías gourmet que quieren mostrar ingredientes artesanales',
      'Hamburgueserías de barrio que quieren recibir pedidos por WhatsApp sin Rappi',
      'Food trucks de hamburguesas que necesitan un menú digital rápido',
      'Cadenas de hamburguesas con menú estandarizado en todas las sedes',
    ],
    faq: [
      { q: '¿Puedo crear combos personalizables?', a: 'Sí. Crea combos donde el cliente elige: hamburguesa + acompañamiento + bebida. Cada opción con precio.' },
      { q: '¿Cómo manejo las adiciones?', a: 'Menuby permite crear grupos de extras: salsas, toppings adicionales, cambios de proteína, cada uno con su precio.' },
      { q: '¿Funciona para delivery?', a: 'Sí. Configuras tus zonas de entrega y tarifa de envío. El cliente paga todo junto en el menú digital.' },
      { q: '¿Cuánto sale para mi hamburguesería?', a: '$30.000 COP al mes. Sin comisión por hamburguesa vendida. Ilimitados pedidos.' },
    ],
    longContent: `
## Menú Digital para Hamburgueserías: Combos, Extras y Delivery

Las hamburgueserías son el negocio gastronómico más popular en Colombia. Un **menú digital para hamburguesería** con personalización de combos y extras puede aumentar tu ticket promedio hasta un 50%.

### ¿Por Qué No Depender Solo de Rappi?

- Rappi cobra entre **25% y 30%** de comisión por cada pedido
- En una hamburguesa de $25.000, pierdes hasta $7.500
- Con Menuby pagas $30.000 al mes sin importar cuántas hamburguesas vendas

### Hamburgueserías que Usan Menuby

Más de 150 hamburgueserías en Colombia ya reciben pedidos directos con Menuby. El cliente personaliza su hamburguesa, paga online y recibe en casa — sin intermediarios.
    `,
  },

  'menu-digital-hotel': {
    slug: 'menu-digital-hotel',
    emoji: '🏨',
    keyword: 'menú digital para hoteles',
    h1: 'Menú Digital para Hoteles y Room Service',
    subtitle: 'Room service digital con QR en cada habitación. Pedidos al restaurante del hotel sin llamar a recepción.',
    seo: {
      title: 'Menú Digital para Hoteles | Room Service QR | Menuby',
      description: 'Menú digital para hotel con QR en habitaciones. Room service sin llamar a recepción. Restaurante del hotel con pedidos digitales. 7 días gratis.',
      keywords: 'menú digital hotel, room service digital, menú QR hotel, carta digital hotel, pedidos room service, menú habitación hotel',
    },
    heroImage: '🏨',
    stats: [
      { value: '30+', label: 'Hoteles activos' },
      { value: '60%', label: 'Más room service' },
      { value: '0%', label: 'Comisión' },
      { value: '24/7', label: 'Disponible' },
    ],
    features: [
      { icon: '🛏️', title: 'QR por Habitación', desc: 'Un QR único por habitación. El huésped escanea y pide room service sin llamar a nadie.' },
      { icon: '🍽️', title: 'Restaurante del Hotel', desc: 'Menú digital para el restaurante, bar y lobby lounge del hotel. Todo centralizado.' },
      { icon: '🌐', title: 'Multi-idioma', desc: 'Carta en español, inglés, francés y más. Ideal para hoteles con huéspedes internacionales.' },
      { icon: '⏰', title: 'Horarios por Servicio', desc: 'Desayuno, almuerzo, cena y late night — cada uno con su propio menú y horario.' },
      { icon: '💳', title: 'Cargo a Habitación', desc: 'El huésped puede pagar online o cargar a la habitación.' },
      { icon: '👨‍🍳', title: 'Cocina en Tiempo Real', desc: 'Los pedidos de room service llegan a la pantalla de cocina con número de habitación.' },
    ],
    useCases: [
      'Hoteles boutique que quieren modernizar su room service',
      'Hoteles de cadena con múltiples restaurantes y servicios',
      'Hoteles turísticos con huéspedes que hablan diferentes idiomas',
      'Hostales y apartahoteles que quieren ofrecer servicio de comidas',
    ],
    faq: [
      { q: '¿Cómo funciona el QR por habitación?', a: 'Colocas un QR con el número de mesa (habitación) en cada cuarto. Cuando el huésped pide, el pedido llega a cocina con el número de habitación automativamente.' },
      { q: '¿Funciona en varios idiomas?', a: 'Sí. Puedes escribir nombres y descripciones en varios idiomas. Ideal para hoteles con huéspedes internacionales.' },
      { q: '¿Es compatible con PMS de hotel?', a: 'Los pedidos se gestionan desde la pantalla de cocina de Menuby. La integración con PMS es mediante exportación de datos.' },
      { q: '¿Cuánto cuesta para un hotel?', a: '$30.000 COP al mes para un restaurante/servicio. Si tienes múltiples restaurantes en el hotel, puedes contactarnos para un plan especial.' },
    ],
    longContent: `
## Room Service Digital: La Experiencia que tus Huéspedes Esperan

Los huéspedes de hotel ya no quieren llamar a recepción para pedir room service. Un **menú digital para hotel** con QR en la habitación permite pedidos instantáneos y silenciosos.

### ¿Cómo Funciona en un Hotel?

1. Coloca un QR en cada habitación con el número correspondiente
2. El huésped escanea y ve el menú completo con fotos
3. Pide lo que quiere y el pedido llega a cocina con el número de habitación
4. La cocina prepara y envía — sin intermediarios telefónicos

### Beneficios para Hoteles

- **+60% en pedidos de room service** al eliminar la barrera de llamar
- **Multilenguaje** para huéspedes internacionales
- **Horarios automáticos** para desayuno, almuerzo, cena y late night
    `,
  },

  'menu-digital-food-truck': {
    slug: 'menu-digital-food-truck',
    emoji: '🚚',
    keyword: 'menú digital para food trucks',
    h1: 'Menú Digital para Food Trucks',
    subtitle: 'Carta digital portátil con QR. Pide antes de llegar, evita la fila y ahorra tiempo.',
    seo: {
      title: 'Menú Digital para Food Trucks | QR + Pedidos sin Fila | Menuby',
      description: 'Menú digital para food truck con código QR. Pedidos anticipados sin fila. Pago online. Ideal para festivales y eventos. 7 días gratis.',
      keywords: 'menú digital food truck, carta digital food truck, menú QR food truck, sistema pedidos food truck',
    },
    heroImage: '🚚',
    stats: [
      { value: '60+', label: 'Food trucks' },
      { value: '3x', label: 'Más pedidos en eventos' },
      { value: '0%', label: 'Comisión' },
      { value: '30 seg', label: 'Para ordenar' },
    ],
    features: [
      { icon: '📱', title: 'QR Portátil', desc: 'Imprime tu QR y llévalo a cualquier ubicación. Funciona igual en ferias, parques o esquinas.' },
      { icon: '⏱️', title: 'Pedidos Anticipados', desc: 'El cliente hace su pedido antes de llegar. Cuando llega, su comida está lista.' },
      { icon: '💵', title: 'Pago Sin Efectivo', desc: 'Acepta pagos digitales. Ideal para eventos donde los clientes no cargan efectivo.' },
      { icon: '🗺️', title: 'Comparte tu Ubicación', desc: 'Publica tu ubicación del día en redes sociales junto con el link de tu menú digital.' },
      { icon: '📊', title: 'Reportes por Evento', desc: 'Ve cuánto vendiste en cada evento o ubicación. Compara rendimiento por día.' },
      { icon: '🔔', title: 'Alertas de Pedido', desc: 'Recibe notificaciones push por cada pedido nuevo. No pierdas ventas en momentos de alta demanda.' },
    ],
    useCases: [
      'Food trucks en festivales gastronómicos con alta demanda',
      'Food trucks con ubicación rotativa que necesitan QR portátil',
      'Carritos de comida en zonas empresariales con pedidos anticipados',
      'Food trucks de eventos privados que quieren ofrecer menú digital',
    ],
    faq: [
      { q: '¿Funciona sin WiFi?', a: 'Tu cliente solo necesita datos móviles (3G/4G). El menú se carga desde la nube, no necesita WiFi en tu food truck.' },
      { q: '¿Puedo cambiar el menú según el evento?', a: 'Sí. Puedes activar/desactivar productos al instante. Ideal para cuando un producto se agota en un festival.' },
      { q: '¿Sirve para ferias gastronómicas?', a: 'Perfecto. El QR reduce la fila y permite pedidos anticipados, ideal para eventos con mucha gente.' },
      { q: '¿Cuánto cuesta?', a: '$30.000 COP/mes. Puedes pausar tu suscripción si tu food truck no opera todos los meses.' },
    ],
    longContent: `
## Menú Digital para Food Trucks: Vende Más en Cada Parada

Un **food truck con menú digital** vende hasta 3 veces más en eventos porque elimina las filas. El cliente escanea el QR, pide y paga desde su celular.

### ¿Por Qué un Food Truck Necesita Menú Digital?

- **Sin filas**: El cliente pide desde el celular, no espera en cola
- **Portátil**: Tu QR funciona donde sea que estaciones tu food truck
- **Sin efectivo**: Acepta pagos digitales en eventos al aire libre
- **Pedidos anticipados**: El cliente pide antes de llegar

### Ideal para Festivales y Eventos

En festivales gastronómicos, un food truck con menú digital atiende más clientes por hora. El QR se comparte por redes sociales y atrae más visitantes a tu ubicación.
    `,
  },

  'menu-digital-panaderia': {
    slug: 'menu-digital-panaderia',
    emoji: '🥐',
    keyword: 'menú digital para panaderías',
    h1: 'Menú Digital para Panaderías y Pastelerías',
    subtitle: 'Vitrina digital con fotos de panes, pasteles y tortas. Pedidos de tortas personalizadas por WhatsApp.',
    seo: {
      title: 'Menú Digital para Panaderías y Pastelerías | Vitrina QR | Menuby',
      description: 'Menú digital para panadería y pastelería con QR. Vitrina digital con fotos. Pedidos de tortas y encargos por WhatsApp. Sin comisiones. 7 días gratis.',
      keywords: 'menú digital panadería, carta digital pastelería, menú QR panadería, vitrina digital panadería, pedidos tortas online',
    },
    heroImage: '🥐',
    stats: [
      { value: '45+', label: 'Panaderías activas' },
      { value: '25%', label: 'Más ventas' },
      { value: '0%', label: 'Comisión' },
      { value: '$30K', label: 'COP al mes' },
    ],
    features: [
      { icon: '🍞', title: 'Vitrina Digital', desc: 'Muestra tus panes, pastelería y tortería con fotos que despiertan el antojo.' },
      { icon: '🎂', title: 'Pedidos de Tortas', desc: 'Recibe encargos de tortas personalizadas con especificaciones detalladas.' },
      { icon: '📲', title: 'Pedidos Anticipados', desc: 'El cliente pide el día antes y recoge a la hora indicada. Reduce desperdicios.' },
      { icon: '🕐', title: 'Disponibilidad Diaria', desc: 'Marca qué productos están disponibles hoy. Actualiza según lo que saques del horno.' },
      { icon: '📸', title: 'Catálogo Visual', desc: 'Fotos de tortas y pasteles que has hecho. Tu portafolio de tortas online.' },
      { icon: '💬', title: 'WhatsApp para Encargos', desc: 'Los pedidos especiales llegan por WhatsApp con toda la información.' },
    ],
    useCases: [
      'Panaderías artesanales con producción limitada y productos que se agotan',
      'Pastelerías que hacen tortas por encargo y necesitan recibir pedidos online',
      'Panaderías de barrio que quieren tener presencia digital',
      'Pastelerías gourmet que quieren mostrar su portafolio visual',
    ],
    faq: [
      { q: '¿Puedo recibir pedidos de tortas personalizadas?', a: 'Sí. El cliente puede incluir especificaciones como tamaño, sabor, decoración y fecha de entrega en las observaciones del pedido.' },
      { q: '¿Puedo marcar productos como agotados?', a: 'Sí. Con un toque marcas un producto como agotado y desaparece del menú para los clientes.' },
      { q: '¿Funciona para panaderías pequeñas?', a: 'Perfecto. No importa si vendes 5 o 500 productos diarios. El precio es igual: $30.000 COP/mes.' },
      { q: '¿Los clientes pueden pedir para recoger?', a: 'Sí. El cliente puede elegir recoger en tienda o pedir a domicilio.' },
    ],
    longContent: `
## Menú Digital para Panaderías: Tu Vitrina en el Celular del Cliente

Las panaderías y pastelerías con **menú digital** venden más porque sus clientes ven fotos irresistibles de panes y pasteles antes de visitarlas.

### ¿Cómo Ayuda un Menú Digital a tu Panadería?

- **Vitrina 24/7**: Tu catálogo siempre visible, no solo cuando el cliente pasa por la puerta
- **Pedidos anticipados**: El cliente pide y programa la hora de recogida
- **Tortas por encargo**: Recibe pedidos especiales con todas las especificaciones
- **Menos desperdicio**: Produce lo que ya tienes vendido

### Del Horno al Celular

Con Menuby, tu panadería tiene presencia digital profesional. Comparte tu link en Instagram, WhatsApp y Google Maps para que más clientes descubran tus productos.
    `,
  },

  'menu-digital-comida-rapida': {
    slug: 'menu-digital-comida-rapida',
    emoji: '🌮',
    keyword: 'menú digital para comida rápida',
    h1: 'Menú Digital para Comida Rápida',
    subtitle: 'Pedidos rápidos sin fila. Combos, adiciones y pago digital. Ideal para alto volumen.',
    seo: {
      title: 'Menú Digital para Comida Rápida | Combos + Pedidos Rápidos | Menuby',
      description: 'Menú digital para negocio de comida rápida. Combos, adiciones y pedidos sin fila. Pantalla de cocina en tiempo real. Sin comisiones. 7 días gratis.',
      keywords: 'menú digital comida rápida, carta digital comida rápida, sistema pedidos comida rápida, menú QR comida rápida',
    },
    heroImage: '🌮',
    stats: [
      { value: '200+', label: 'Negocios de comida rápida' },
      { value: '3x', label: 'Más pedidos/hora' },
      { value: '0%', label: 'Comisión' },
      { value: '45 seg', label: 'Pedido promedio' },
    ],
    features: [
      { icon: '⚡', title: 'Pedidos Ultra-Rápidos', desc: 'El cliente toca, personaliza y paga en menos de 1 minuto.' },
      { icon: '🎁', title: 'Combos y Ofertas', desc: 'Crea combos irresistibles con descuento automático al agregar acompañamiento y bebida.' },
      { icon: '🛵', title: 'Delivery y Para Llevar', desc: 'Recibe pedidos para llevar y a domicilio. El cliente elige la opción.' },
      { icon: '👨‍🍳', title: 'Pantalla de Cocina', desc: 'Cola de pedidos en tiempo real. Tu equipo ve qué preparar primero.' },
      { icon: '📱', title: 'QR en el Local', desc: 'Elimina la fila del mostrador. El cliente pide desde la mesa o antes de llegar.' },
      { icon: '📊', title: 'Ventas en Tiempo Real', desc: 'Dashboard con ventas del día, pedidos pendientes y productos más vendidos.' },
    ],
    useCases: [
      'Locales de empanadas, arepas y comida callejera con alta rotación',
      'Restaurantes de corrientazo que quieren agilizar el servicio',
      'Negocios de comida rápida en centros comerciales con varias sedes',
      'Cocinas ocultas (dark kitchens) que solo hacen delivery',
    ],
    faq: [
      { q: '¿Funciona para locales con mucho volumen?', a: 'Sí. La pantalla de cocina de Menuby está diseñada para alto volumen. Los pedidos se organizan por prioridad y timer.' },
      { q: '¿Puedo usarlo como autoservicio digital?', a: 'Sí. Coloca un QR en la puerta o en las mesas. El cliente pide y paga sin pasar por caja.' },
      { q: '¿Es útil para dark kitchens?', a: 'Perfecto. Recibe pedidos por tu menú digital propio sin depender de plataformas de delivery.' },
      { q: '¿Cuánto cuesta?', a: '$30.000 COP/mes. Sin comisión por pedido. Puedes recibir 10 o 1.000 pedidos al día por el mismo precio.' },
    ],
    longContent: `
## Menú Digital para Comida Rápida: Velocidad y Eficiencia

Los negocios de **comida rápida** necesitan velocidad. Con un menú digital, tus clientes piden en menos de 1 minuto y tu cocina recibe los pedidos al instante.

### ¿Por Qué Menuby para Comida Rápida?

- **Sin filas**: El cliente pide desde el celular, no espera en el mostrador
- **Combos automáticos**: Sugiere acompañamiento y bebida para subir el ticket
- **Alto volumen**: La pantalla de cocina organiza pedidos por prioridad
- **Dark kitchens**: Ideal para cocinas que solo hacen delivery

### Elimina la Dependencia de Rappi y iFood

Con Menuby, tu comida rápida llega directo al cliente sin pagar 25-30% de comisión. Configura tus zonas de entrega y empieza a recibir pedidos propios.
    `,
  },

  'menu-digital-sushi': {
    slug: 'menu-digital-sushi',
    emoji: '🍣',
    keyword: 'menú digital para restaurantes de sushi',
    h1: 'Menú Digital para Restaurantes de Sushi',
    subtitle: 'Carta digital con fotos de rolls, makis y combos. Personalización de ingredientes y pedidos directos.',
    seo: {
      title: 'Menú Digital para Sushi | Rolls + Personalización + Delivery | Menuby',
      description: 'Menú digital para restaurant de sushi con QR. Personalización de rolls, combos y delivery sin comisión. Fotos que venden. 7 días gratis.',
      keywords: 'menú digital sushi, carta digital sushi, menú QR sushi, pedidos sushi online, delivery sushi sin comisión',
    },
    heroImage: '🍣',
    stats: [
      { value: '40+', label: 'Restaurantes de sushi' },
      { value: '35%', label: 'Más ticket promedio' },
      { value: '0%', label: 'Comisión' },
      { value: '$30K', label: 'COP al mes' },
    ],
    features: [
      { icon: '🍣', title: 'Carta Visual de Rolls', desc: 'Fotos profesionales de cada roll. Los clientes ven exactamente lo que van a pedir.' },
      { icon: '🥢', title: 'Personalización', desc: 'Ingredientes extra, salsas, nivel de picante y proteína alternativa. El cliente arma su roll.' },
      { icon: '🎁', title: 'Combos y Bandejas', desc: 'Crea bandejas mixtas y combos familiares con descuento.' },
      { icon: '🛵', title: 'Delivery Premium', desc: 'Pedidos a domicilio con empaque premium. Sin comisión por pedido.' },
      { icon: '👨‍🍳', title: 'Pantalla de Cocina', desc: 'Los susheros ven cada roll con ingredientes, cantidad y observaciones.' },
      { icon: '⭐', title: 'Calificaciones', desc: 'Los clientes califican cada pedido. Construye reputación para tu sushi.' },
    ],
    useCases: [
      'Restaurantes de sushi premium que quieren mostrar la presentación de sus rolls',
      'Sushi a domicilio que quiere canal directo sin comisiones de Rappi',
      'Dark kitchens de sushi con menú extenso y personalizable',
      'Sushi fusion con ingredientes especiales que necesitan descripción detallada',
    ],
    faq: [
      { q: '¿Puedo mostrar fotos detalladas de cada roll?', a: 'Sí. Cada producto puede tener múltiples fotos. Muestra la presentación desde diferentes ángulos.' },
      { q: '¿El cliente puede personalizar ingredientes?', a: 'Sí. Configura extras como aguacate adicional, salmón extra, cambio de proteína, salsas, etc.' },
      { q: '¿Funciona para delivery de sushi?', a: 'Perfecto. Zonas de entrega con tarifa automática. El cliente paga online y recibe en casa.' },
      { q: '¿Cuánto cuesta?', a: '$30.000 COP/mes. Sin comisión por roll vendido. Pedidos ilimitados.' },
    ],
    longContent: `
## Menú Digital para Sushi: Fotos que Venden

El sushi es visual. Un **menú digital para sushi** con fotos profesionales de cada roll aumenta el ticket promedio hasta 35%.

### ¿Por Qué Menuby para tu Restaurante de Sushi?

- **Fotos irresistibles**: Cada roll con imagen de alta calidad
- **Personalización**: Ingredientes extra, salsas, nivel de picante
- **Delivery sin comisión**: Directo de tu cocina al cliente
- **Combos y bandejas**: Arma promociones familiares que generan más venta
    `,
  },

  'menu-digital-asadero': {
    slug: 'menu-digital-asadero',
    emoji: '🍗',
    keyword: 'menú digital para asaderos',
    h1: 'Menú Digital para Asaderos y Pollerías',
    subtitle: 'Carta digital con combos de pollo, costilla y churrasco. Pedidos a domicilio sin comisión.',
    seo: {
      title: 'Menú Digital para Asaderos y Pollerías | Combos + Delivery | Menuby',
      description: 'Menú digital para asadero y pollería. Combos de pollo, costilla y acompañamientos. Delivery propio sin comisión. 7 días gratis.',
      keywords: 'menú digital asadero, carta digital pollería, menú QR asadero, pedidos asadero online, delivery pollo sin comisión',
    },
    heroImage: '🍗',
    stats: [
      { value: '70+', label: 'Asaderos activos' },
      { value: '30%', label: 'Más delivery propio' },
      { value: '0%', label: 'Comisión' },
      { value: '$30K', label: 'COP al mes' },
    ],
    features: [
      { icon: '🍗', title: 'Combos de Pollo', desc: 'Crea combos con 1/4, 1/2 y pollo entero con acompañamientos seleccionables.' },
      { icon: '🥩', title: 'Parrilla y Churrasco', desc: 'Carta de carnes a la brasa con fotos. El cliente elige corte y término.' },
      { icon: '🛵', title: 'Delivery Propio', desc: 'Deja de depender de Rappi. Recibe pedidos directos y ahorra la comisión.' },
      { icon: '🎁', title: 'Combos Familiares', desc: 'Bandejas y combos para compartir con descuento automático.' },
      { icon: '📞', title: 'Sustituto del Volante', desc: 'En vez de volantes impresos, comparte tu QR por WhatsApp con tu menú completo.' },
      { icon: '📊', title: 'Producto Más Vendido', desc: 'Reportes con el combo más popular, horarios pico y clientes frecuentes.' },
    ],
    useCases: [
      'Asaderos de pollo que quieren digitalizar su carta de combos',
      'Pollerías con delivery propio que quieren canal digital sin rappi',
      'Asaderos con múltiples sedes y menú centralizado',
      'Restaurantes de carnes a la brasa con carta extensa',
    ],
    faq: [
      { q: '¿Puedo crear combos tipo 1/4, 1/2 y pollo entero?', a: 'Sí. Crea cada presentación como un producto independiente o como variación del mismo producto con precios diferentes.' },
      { q: '¿Funciona para reemplazar los volantes impresos?', a: 'Perfecto. Comparte el link de tu menú digital por WhatsApp, Instagram y Facebook en vez de gastar en volantes.' },
      { q: '¿Puedo configurar domicilio propio?', a: 'Sí. Configura zonas de entrega con tarifas automáticas y recibe pedidos sin intermediarios.' },
      { q: '¿Cuánto cuesta?', a: '$30.000 COP/mes. Sin comisión sin importar cuántos pollos vendas.' },
    ],
    longContent: `
## Menú Digital para Asaderos: Deja los Volantes, Pasa al Digital

Los asaderos y pollerías en Colombia tradicionalmente usan volantes impresos. Un **menú digital para asadero** con QR es más económico, más efectivo y siempre está actualizado.

### Del Volante al Menú Digital

- **Volante**: Se bota, se pierde, requiere actualizar e imprimir
- **Menú digital**: Siempre en el celular del cliente, con fotos y precios actualizados
- **Costo volante**: $200.000+ por tiraje. **Menuby**: $30.000/mes con pedidos incluidos

### Delivery Propio vs Rappi

Los asaderos que usan Menuby ahorran hasta $500.000 al mes en comisiones de plataformas de delivery.
    `,
  },

  'menu-digital-heladeria': {
    slug: 'menu-digital-heladeria',
    emoji: '🍦',
    keyword: 'menú digital para heladerías',
    h1: 'Menú Digital para Heladerías',
    subtitle: 'Carta digital con sabores disponibles hoy, combos y pedidos para eventos.',
    seo: {
      title: 'Menú Digital para Heladerías | Sabores + QR + Pedidos | Menuby',
      description: 'Menú digital para heladería con QR. Muestra sabores disponibles hoy, combos y balde para eventos. Sin comisiones. 7 días gratis.',
      keywords: 'menú digital heladería, carta digital heladería, menú QR heladería, sabores helado online, pedidos heladería',
    },
    heroImage: '🍦',
    stats: [
      { value: '35+', label: 'Heladerías activas' },
      { value: '20%', label: 'Más ticket promedio' },
      { value: '0%', label: 'Comisión' },
      { value: '$30K', label: 'COP al mes' },
    ],
    features: [
      { icon: '🍦', title: 'Sabores del Día', desc: 'Actualiza diariamente los sabores disponibles. Tus clientes ven solo lo que hay.' },
      { icon: '🍨', title: 'Personalización', desc: 'Cono, vaso, sundae, banana split — el cliente elige presentación y toppings.' },
      { icon: '📸', title: 'Fotos Irresistibles', desc: 'Cada sabor con foto que despierta el antojo. Las fotos venden más que las descripciones.' },
      { icon: '🎉', title: 'Pedidos para Eventos', desc: 'Baldes, conos de fiesta y pedidos especiales para cumpleaños y eventos.' },
      { icon: '📱', title: 'QR en el Local', desc: 'Mientras el cliente espera en la fila, ve la carta completa y decide más rápido.' },
      { icon: '⭐', title: 'Sabores Favoritos', desc: 'Reportes con los sabores más pedidos para planificar tu producción.' },
    ],
    useCases: [
      'Heladerías artesanales con sabores rotativos',
      'Heladerías de cadena con múltiples sedes',
      'Negocios de helados que hacen domicilios',
      'Heladerías con servicio de catering para eventos',
    ],
    faq: [
      { q: '¿Puedo actualizar los sabores cada día?', a: 'Sí. Marca sabores como disponibles o agotados con un toque. Solo se muestran los que están disponibles.' },
      { q: '¿Funciona para pedidos de eventos?', a: 'Sí. Puedes crear una sección especial de "Pedidos para Eventos" con baldes, litros y precios por volumen.' },
      { q: '¿Los clientes ven fotos de cada sabor?', a: 'Sí. Sube una foto por sabor. Las heladerías con fotos venden 20% más que las que solo muestran el nombre.' },
      { q: '¿Cuánto cuesta?', a: '$30.000 COP/mes. Sin comisión. Ideal para heladerías pequeñas y grandes.' },
    ],
    longContent: `
## Menú Digital para Heladerías: Sabores que se Venden Solos

Una **heladería con menú digital** muestra sus sabores con fotos tan tentadoras que el cliente ya sabe qué quiere antes de llegar al mostrador.

### ¿Por Qué un Menú Digital en tu Heladería?

- **Sabores rotativos**: Actualiza los sabores disponibles cada día
- **Fotos que venden**: Las imágenes de helado generan 20% más ventas
- **Menos demora**: El cliente llega decidido, atiende más rápido
- **Eventos y catering**: Recibe pedidos por volumen para fiestas
    `,
  },
};

// Helper to get all niche pages as array
export const getAllNichePages = () => Object.values(NICHE_PAGES);

// Helper to get a niche page by slug
export const getNichePageBySlug = (slug) => NICHE_PAGES[slug] || null;

// All niche slugs for routes and sitemap
export const NICHE_SLUGS = Object.keys(NICHE_PAGES);
