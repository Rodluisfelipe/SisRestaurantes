# Datos reales de negocios — MenuBy

Generado: 2026-08-30, consultando directamente la base de datos de producción (MongoDB, droplet `159.203.136.199`).

**Exclusiones aplicadas** (confirmadas contigo): `Test`, `PENTEST AUDIT 1784930691`, `MacDonalds (menu demo) 1`, `felipe-2`. No se excluyó ningún negocio adicional por nombre — no existe en la base de datos ningún registro literal llamado "Menuby Crew" (ese nombre corresponde a un **módulo/función** de MenuBy — el marketplace de turnos para trabajadores casuales — no a una cuenta de negocio; ver `FUNCIONES_MENUBY.md`).

**Total de negocios en la base de datos:** 34. Tras excluir las 4 cuentas de prueba: **30 negocios reales**.

---

## ⚠️ Cómo leer estas cifras (importante)

- **"Ventas" = productos − descuentos** (sin domicilio ni propina), calculado con la misma fórmula que usa el resto de la app (`Backend/utils/revenue.js`) — es lo que factura el negocio, no lo que entra a caja.
- Los datos salen de la colección `CompletedOrder` (pedidos ya completados/entregados). **Existe una función de "limpiar pedidos completados" en el panel** (usada después de un cierre de caja) que borra pedidos ya reportados — si un negocio la ha usado, su histórico real de ventas es **mayor** al que aquí aparece. Estas cifras son un piso, no necesariamente el total histórico completo.
- El campo "Ciudad" del perfil del negocio está vacío en la mayoría de los casos (solo 3 de 30 lo llenaron). Donde fue posible, se infirió una pista de ciudad desde la dirección guardada para geolocalización de zonas de entrega — se marca como "(inferida)".
- Moneda: COP.

---

## Negocios con ventas reales registradas (6 de 30)

| # | Negocio | Ciudad | Plan | Pedidos | Ventas | Domicilios | Total cobrado | Primer pedido | Último pedido | Canales |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **FRAISE** | — | Pro | 4,187 | $113,081,200 | $15,490,000 | $128,571,200 | 2026-02-26 | 2026-07-14 | admin, pos, whatsapp, inapp |
| 2 | **Las 4 en punto** | Buenaventura, Valle del Cauca | Pro | 952 | $20,639,000 | $1,548,000 | $22,187,000 | 2026-06-27 | 2026-08-29 | inapp, admin, whatsapp, pos |
| 3 | **GO BURGER** | Chía, Cundinamarca | Starter | 312 | $18,767,000 | $555,500 | $19,322,500 | 2025-09-25 | 2026-08-30 | pos, whatsapp |
| 4 | **DOGGITOS** | — | Pro | 682 | $10,237,000 | $0 | $10,237,000 | 2026-08-08 | 2026-08-30 | admin, pos |
| 5 | **Cocina Vital** | — | Pro | 4 | $320,000 | $10,000 | $330,000 | 2026-08-28 | 2026-08-28 | whatsapp, pos, admin, inapp |
| 6 | **IBIZA COCKTAIL** | — | Free | 2 | $44,000 | $0 | $44,000 | 2026-08-28 | 2026-08-28 | admin |

**Total combinado: 6,139 pedidos · $163,088,200 en ventas · $180,691,700 cobrado en total.**

Notas rápidas:
- **FRAISE** es, por lejos, el negocio con más actividad y volumen — dejó de tener pedidos completados desde el 14 de julio (vale la pena confirmar si sigue activo o si algo se rompió en su flujo).
- **GO BURGER** es el más antiguo con ventas reales (desde sep. 2025) y el único con ciudad confirmada además de Las 4 en punto.
- **DOGGITOS**, **Cocina Vital** e **IBIZA COCKTAIL** son negocios muy recientes (cuenta creada en agosto 2026), aún en ramp-up.

---

## Negocios registrados sin ventas completadas aún (24 de 30)

Ninguno de estos tiene pedidos en `CompletedOrder` — o nunca activaron el flujo de pedidos, o sus pedidos siguen en la cola activa sin cerrar, o llevan poco tiempo.

| Negocio | Plan | Estado suscripción | Creado |
|---|---|---|---|
| Felipe | Pro Max | active | 2025-05-11 |
| Hotel Plaza Mar | — | expired | 2026-03-23 |
| GN Nails | — | expired | 2026-04-08 |
| Cremu | — | — | 2026-04-09 |
| Dulce Magia | Free | expired | 2026-05-13 |
| Kalunga | Pro | active | 2026-06-29 |
| LA VACA ORIGINAL | Free | expired | 2026-06-29 |
| CAFETERIA MIKKAN | Free | expired | 2026-06-30 |
| HELADOS DALUR | Free | expired | 2026-07-05 |
| Chimichurri menudo | Free | expired | 2026-07-06 |
| Amor y Pastel | Free | expired | 2026-07-10 |
| Pueblo Viejo | Free | expired | 2026-07-10 |
| Caprichosos | Pro | expired | 2026-07-15 |
| Melenas / cuidado capilar | Free | expired | 2026-07-16 |
| Sweet Rings | Free | expired | 2026-07-20 |
| JHON'S BURGER | — | — | 2026-07-25 (Chía, Cundinamarca — inferida) |
| MARUT | Free | expired | 2026-07-28 |
| Fashion YEF | Free | expired | 2026-07-30 (Caracas, Venezuela — inferida) |
| Gordinis | Free | expired | 2026-08-03 (Girardota, Antioquia) |
| Hamburguelionas | Free | expired | 2026-08-04 |
| Jm parilla | Free | expired | 2026-08-08 |
| Rochy's | Free | expired | 2026-08-13 |
| GRATINADOS_FG | Free | expired | 2026-08-14 |
| Vital Bakery | Pro | active | 2026-08-28 |

**Patrón notable:** la enorme mayoría de estas cuentas están en plan `Free` con suscripción `expired` — es decir, probaron el producto (probablemente en un trial) y no convirtieron a plan pago, o simplemente no llegaron a operar con clientes reales.

---

## Geografía

Solo 3 negocios tienen ciudad confirmada en su perfil:
- **Chía, Cundinamarca** — GO BURGER (con ventas) y JHON'S BURGER (sin ventas aún, dirección inferida — mismo centro comercial "Vivenza Plaza")
- **Buenaventura, Valle del Cauca** — Las 4 en punto (con ventas)
- **Girardota, Antioquia** — Gordinis (sin ventas aún)
- **Caracas, Venezuela** — Fashion YEF (dirección inferida — único negocio fuera de Colombia)

El resto no ha llenado el campo de ciudad en su perfil (`Configuración del negocio`). Si quieres un mapa de ciudades más completo, se podría pedir directamente a cada negocio, o inferir desde `deliveryZones` (zonas de entrega) para los que las configuraron — no lo hice en esta pasada porque implicaría cruzar coordenadas GPS, y no todos los negocios usan zonas de entrega.

---

## Metodología (para reproducir esto después)

Consulta ejecutada dentro del contenedor Docker en producción, usando el modelo `CompletedOrder` y la fórmula de ventas oficial de `Backend/utils/revenue.js`, agrupando por `businessId`, cruzado con `BusinessConfig` (nombre, ciudad, plan) y `Subscription` (plan/estado). Los 4 negocios de prueba se excluyeron por `_id` en la consulta misma, no filtrados después.
