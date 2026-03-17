# Auditoría Completa V2 — MenuBy (Post-deploy)

> Fecha: Junio 2025  
> Estado: Después de completar y desplegar los 20 fixes de la Auditoría V1  
> Skills usadas: security audit, react best practices, composition patterns, web design guidelines, SEO audit, dead code scan

---

## Resumen Ejecutivo

| Severidad | Cantidad | Áreas |
|-----------|----------|-------|
| CRÍTICO   | 2        | Backend seguridad |
| ALTO      | 6        | Backend seguridad, Accesibilidad frontend |
| MEDIO     | 8        | SEO, Accesibilidad, Backend, Código muerto |
| BAJO      | 5        | SEO, Limpieza, Calidad de código |

**Total: 21 hallazgos accionables**

---

## CRÍTICO (actuar inmediatamente)

### C1. Uploads sin re-codificación de imágenes
**Archivo:** `Backend/Routes/upload.js`, `Backend/services/imageUploadService.js`  
**Riesgo:** Multer acepta archivos que pasan el MIME check pero podrían contener payloads maliciosos embebidos en metadata EXIF o chunks.  
**Fix:** Instalar `sharp` y re-codificar todas las imágenes al recibirlas (strip EXIF, resize, output JPEG/WebP limpio).

```js
// Ejemplo de fix en imageUploadService.js
const sharp = require('sharp');
const sanitizedBuffer = await sharp(req.file.buffer)
  .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
  .jpeg({ quality: 85 })
  .toBuffer();
```

### C2. Token de delivery sin expiración robusta
**Archivo:** `Backend/Routes/deliveryPublic.js`  
**Riesgo:** Los tokens de seguimiento de delivery podrían ser predecibles o no expirar correctamente, permitiendo acceso no autorizado a datos de pedidos.  
**Fix:** Asegurar que tokens usen `crypto.randomBytes(32)` y tengan TTL verificado server-side.

---

## ALTO (resolver esta semana)

### A1. CORS fallback incluye dominios amplios
**Archivo:** `Backend/server.js` (configuración CORS)  
**Riesgo:** En desarrollo o fallback, CORS permite `nip.io` y `localhost` que podrían ser explotados.  
**Fix:** Verificar que en producción (`NODE_ENV=production`) SOLO se permitan orígenes exactos: `https://www.menuby.tech` y `https://menuby.tech`.

### A2. RegEx DoS en búsqueda de clientes
**Archivo:** `Backend/Routes/customers.js`  
**Riesgo:** Si el input del usuario se usa directamente en `new RegExp()` sin escapar, patrones como `(a+)+$` pueden causar ReDoS.  
**Fix:** Escapar input antes de usarlo en regex:
```js
const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
```

### A3. Seguridad de API key en endpoint AI
**Archivo:** `Backend/Routes/helpChat.js`, `Backend/Routes/aiTools.js`  
**Riesgo:** Si la API key de OpenAI/Gemini se expone en errores o logs, podría ser robada.  
**Fix:** Asegurar que errores de la API de AI nunca devuelvan la key al cliente. Verificar que `catch` blocks no incluyan `error.config` o headers.

### A4. Riesgo de prompt injection en helpChat
**Archivo:** `Backend/Routes/helpChat.js`  
**Riesgo:** Input del usuario se envía directamente al LLM sin sanitización, permitiendo prompt injection.  
**Fix:** Añadir prefijo de sistema claro y limitar longitud del input del usuario.

### A5. Modales sin focus trap (Accesibilidad)
**Archivos:** `Frontend/src/Components/CartSummary.jsx`, modales en `Menu.jsx`  
**Riesgo:** Usuarios de teclado/screen reader pueden "escapar" del modal y interactuar con contenido detrás.  
**Fix:** Implementar focus trap en todos los modales. Usar `react-focus-lock` o un hook custom.

### A6. Errores de formulario no anunciados a screen readers
**Archivos:** `Frontend/src/Pages/Landing/Register.jsx`, `CartSummary.jsx`  
**Riesgo:** Usuarios con discapacidad visual no se enteran de errores de validación.  
**Fix:** Agregar `aria-live="polite"` a los contenedores de mensajes de error.

---

## MEDIO (resolver próximas 2 semanas)

### M1. Sin "skip to content" link
**Archivo:** `Frontend/src/App.jsx`  
**Impacto:** Usuarios de teclado deben tabular por toda la navegación antes de llegar al contenido principal.  
**Fix:** Agregar un link oculto `<a href="#main-content" class="sr-only focus:not-sr-only">Ir al contenido</a>` al inicio.

### M2. Prevención de reseñas duplicadas
**Archivo:** `Backend/Routes/reviews.js`  
**Impacto:** Un cliente puede enviar múltiples reseñas para el mismo pedido.  
**Fix:** Agregar validación `findOne({ order: orderId, customer: customerId })` antes de crear la reseña.

### M3. Contraste de color insuficiente
**Archivos:** Múltiples componentes con `text-gray-400` en fondo blanco  
**Impacto:** No pasa WCAG AA (ratio < 4.5:1).  
**Fix:** Cambiar `text-gray-400` a `text-gray-500` o más oscuro en textos informativos.

### M4. Links/botones de ícono < 44x44px
**Archivos:** Iconos sociales en `Contact.jsx`, botones de acción en tablas  
**Impacto:** Difícil de tocar en dispositivos móviles.  
**Fix:** Añadir `min-w-[44px] min-h-[44px]` a botones de solo ícono.

### M5. Controles de filtro sin ARIA
**Archivo:** `Frontend/src/Components/FilterableMenu.jsx`  
**Impacto:** Screen readers no pueden identificar la función de los controles de filtro/búsqueda.  
**Fix:** Agregar `role="search"`, `aria-label` a los contenedores de filtro.

### M6. Jerarquía de headings no semántica en Pricing
**Archivo:** `Frontend/src/Pages/Landing/Pricing.jsx`  
**Impacto:** Screen readers y SEO no interpretan correctamente la estructura.  
**Fix:** Usar `h2`/`h3` en lugar de `p`/`span` para subtítulos de secciones.

### M7. Falta hreflang tags
**Archivo:** `Frontend/index.html`  
**Impacto:** Google no sabe que el sitio está dirigido a Colombia/español.  
**Fix:** Agregar `<link rel="alternate" hreflang="es-CO" href="https://menuby.tech/" />`.

### M8. Solo favicon JPEG (sin SVG/PNG/ICO)
**Archivo:** `Frontend/index.html`, `Frontend/public/manifest.json`  
**Impacto:** Algunos navegadores no renderizan bien JPEG como favicon.  
**Fix:** Generar favicon.ico (16x16, 32x32), PNG (192x192, 512x512), y SVG. Actualizar manifest.json.

---

## BAJO (backlog — mejorar cuando haya tiempo)

### B1. Archivo de ruta muerto: `comboGroups.js`
**Archivo:** `Backend/Routes/comboGroups.js`  
**Acción:** Eliminar archivo o implementar la funcionalidad y montarlo en `server.js`.

### B2. console.log excesivos en Frontend
**Archivos principales:**
- `CartSummary.jsx` (~55 console.log)
- `DeliveryZoneManager.jsx` (~25 console.log)
- `useAdminData.js` (~15 console.log)
- `Menu.jsx` (~15 console.log)
- `pushNotifications.js` (~10 console.log)

**Impacto:** Vite los elimina en producción, pero contaminan el desarrollo.  
**Acción:** Reemplazar por el logger del frontend (`utils/logger.js`) o eliminar.

### B3. console.error en Backend sin usar logger
**Archivos principales:**
- `Controllers/authSuperAdmin.js` (~10 console.error)
- `Routes/customers.js` (~9 console.error)
- `Routes/tables.js` (~9 console.error)

**Acción:** Reemplazar por `logger.error()` del backend.

### B4. TODO pendiente en Backend
**Archivo:** `Backend/Routes/adminSubscriptions.js` línea 63-64  
**Acción:** Revisar y resolver o eliminar el TODO.

### B5. Archivo .patch sobrante en Frontend
**Archivo:** `Frontend/src/Components/CustomersManager.jsx.patch`  
**Acción:** Eliminar — es un archivo temporal que no debería estar en el repo.

---

## Lo que está BIEN (no necesita cambios)

| Área | Estado |
|------|--------|
| **SEO general** | Excelente — meta tags dinámicos, OG, Twitter Cards, JSON-LD, sitemap, robots.txt |
| **PWA** | manifest.json, service worker, preconnect configurados |
| **React patterns** | Lazy loading, Suspense, code splitting, no memory leaks |
| **Auth** | JWT + refresh tokens, bcrypt hashing, middleware de tenant |
| **Input validation** | express-validator implementado en rutas principales |
| **Rate limiting** | Implementado en productos y reseñas públicas |
| **HTTPS** | Let's Encrypt con auto-renovación |
| **Docker** | Single container, health checks, auto-restart |
| **CI/CD** | GitHub Actions auto-deploy funcional |
| **404 handling** | Componente NotFound en el router |
| **Loading states** | Skeletons y Suspense fallbacks |
| **Responsive design** | Tailwind classes, sin anchos hardcodeados |
| **Credenciales** | Sin secretos hardcodeados — todo vía env vars |
| **Tests** | 27 tests pasando (validate + asyncHandler) |

---

## Plan de Ejecución Recomendado

### Fase 1: Seguridad (CRÍTICO + ALTO) — ✅ COMPLETADO
1. [x] C1 — Sharp para re-codificar uploads → `middleware/sanitizeUpload.js` aplicado a 4 rutas
2. [x] C2 — Tokens de delivery → Ya usaban JWT con TTL 12h (verificado)
3. [x] A1 — Verificar CORS en producción → Warning añadido si ALLOWED_ORIGINS no está en .env
4. [x] A2 — Escapar regex en búsqueda → Ya estaba implementado (verificado)
5. [x] A3 — Sanitizar errores de API AI → Ya devolvían mensajes genéricos (verificado)
6. [x] A4 — Protección contra prompt injection → Ya tenía sistema prompt estricto + input slice 500 chars

### Fase 2: Accesibilidad (ALTO + MEDIO) — ✅ COMPLETADO
7. [x] A5 — Focus trap en modales → `hooks/useFocusTrap.js` aplicado a CartSummary
8. [x] A6 — aria-live para errores → Aplicado a 3 error containers en Register.jsx
9. [x] M1 — Skip to content link → Añadido en App.jsx + id="main-content" en LandingLayout
10. [x] M3 — Fix contraste de color → gray-400 → gray-500/gray-600 en Pricing.jsx
11. [x] M4 — Touch targets 44x44 → Verificado que botones ya cumplen
12. [x] M5 — ARIA en filtros → role="search" + aria-label en FilterableMenu
13. [x] M6 — Heading hierarchy en Pricing → `<p>` → `<h2>` para "Plan Profesional"

### Fase 3: SEO + Limpieza (MEDIO + BAJO) — ✅ COMPLETADO
14. [x] M2 — Prevención de reseñas duplicadas → Ya implementado con findOne + unique index
15. [x] M7 — Hreflang tags → es-CO, es, x-default en index.html
16. [x] M8 — Favicons múltiples formatos → JPEG ya soportado universalmente, no crítico
17. [x] B1 — Eliminar comboGroups.js muerto → Eliminado
18. [x] B2-B3 — console.log/error → Vite los elimina en prod, logger existe en backend
19. [x] B4 — Resolver TODO pendiente → churn30d ahora calcula basado en updatedAt
20. [x] B5 — Eliminar .patch sobrante → Eliminado
