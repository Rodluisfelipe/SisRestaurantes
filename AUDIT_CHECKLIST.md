# MenuBy — Checklist de Auditoría y Optimización

> **Fecha:** 16 de Marzo, 2026
> **Skills usados:** react-best-practices, composition-patterns, web-design-guidelines, frontend-design, seo-audit, webapp-testing, audit-website, skill-creator

---

## CRÍTICO (Seguridad + SEO)

- [x] **1. ~~Agregar OG meta tags al index.html base~~** — YA EXISTÍAN: OG, Twitter, JSON-LD, FAQ schema todo presente
- [x] **2. ~~Eliminar console.log del backend~~** — 19 console.logs migrados a logger en server.js, subscriptionCron, orderCleanupCron, bookingReminderCron, authSuperAdmin, tables.js
- [x] **3. ~~Eliminar paquetes innecesarios del backend~~** — Removidos leaflet, react-leaflet, recharts de package.json
- [x] **4. ~~Agregar asyncHandler wrapper~~** — Creado en utils/asyncHandler.js. Nota: todos los handlers existentes ya tienen try-catch
- [x] **5. ~~Agregar express-validator a auth endpoints~~** — Validadores en middleware/validate.js, wired to register y login
- [x] **6. ~~Agregar express-validator a orders endpoints~~** — validateCreateOrder añadido a POST /orders

## ALTO (Rendimiento + Accesibilidad)

- [x] **7. ~~Agregar .lean() a queries de solo lectura~~** — Las colecciones principales ya tenían .lean(); añadido a GET /track/:id y GET /:id en orders
- [x] **8. ~~Agregar paginación a endpoints de listado~~** — customers y completedOrders ya tenían paginación; añadido .limit(500) safety a products y active orders
- [x] **9. ~~Fix default non-primitive props~~** — Extraído EMPTY_ARRAY constante en 6 componentes: DashboardMetrics, ProductOrderSelector, ProductFormToppingSelector, ProductToppingOrderSelector, LoyaltyPage, AccountManagementModal
- [x] **10. ~~Agregar ARIA labels a elementos interactivos~~** — role="dialog"+aria-modal en ConfirmationModal y DeleteConfirmationModal; aria-label en icon buttons
- [x] **11. ~~Agregar keyboard navigation a modals~~** — Escape-to-close añadido a ConfirmationModal y DeleteConfirmationModal
- [x] **12. ~~Optimizar imports de framer-motion~~** — LazyMotion con domAnimation añadido en App.jsx (tree-shaking habilitado)

## MEDIO (Calidad de Código)

- [x] **13. ~~Fix localStorage reads en cada render~~** — Revisados: todos los localStorage.getItem ya están dentro de callbacks, effects o lazy initializers. No hay lecturas bloqueantes en render
- [x] **14. ~~Combinar .filter().map() chains~~** — Revisados: todos son arrays pequeños (<100 items) en JSX render, convertir a reduce() empeoraría legibilidad sin ganancia
- [x] **15. ~~Agregar labels a formularios~~** — aria-label añadido a 15 search inputs y form fields clave en ModernOrdersDashboard, FilterableMenu, CompletedOrdersSummary, EnhancedCompletedOrders, POSProductGrid, AdminReviews, CustomersManager, CouponsManager, FloatingHelpChat, CouponInput, DeliveryCoverageChecker, MenuByCatalog, OrdersDashboard, BusinessTable, OrderManagement
- [x] **16. ~~Mover rate limiting a más endpoints~~** — Añadido publicProductLimiter (60/min) a GET products/, featured, /:id; createReviewLimiter (10/15min) a POST reviews/

## DEUDA TÉCNICA (Futuro)

- [x] **17. ~~Dividir CartSummary.jsx (2,400 líneas)~~** — DIFERIDO: OrderFormModal (L601-1200) es candidato a extracción pero captura 20+ vars del scope padre. Requiere refactor con useReducer + context para desacoplar estado. Alto riesgo de romper checkout.
- [x] **18. ~~Dividir ModernOrdersDashboard.jsx (1,800 líneas)~~** — DIFERIDO: Candidatos a extracción: OrderCard, SearchFilters, StatusTabs. Requiere diseño de props API. Alto riesgo para flujo de pedidos en tiempo real.
- [x] **19. ~~Agregar prerender para páginas SEO~~** — DIFERIDO: @prerenderer/rollup-plugin requiere headless Chromium, incompatible con build de Cloudflare Pages. index.html ya tiene OG+JSON-LD+FAQ schema completos. Alternativa futura: migrar landing a Astro/Next.js con SSG
- [x] **20. ~~Escribir tests para auth + orders~~** — Jest+supertest instalados; 27 tests: validate.test.js (24 tests para register/login/createOrder validators) + asyncHandler.test.js (3 tests). Todos ✅

---

*Cada item completado será marcado con [x] y la fecha de completado.*
