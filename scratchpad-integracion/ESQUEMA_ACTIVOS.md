# Integración MenuBy ↔ Activos (app de entregas)

Estado: **descubierto por ingeniería inversa** con la cuenta de prueba del
restaurante Go Burger (tienda `115`) que Activos nos entregó. Falta confirmar
con Activos el **contrato de creación** (ver §5).

## 1. Arquitectura de Activos

- App del repartidor/restaurante: **Flutter Web PWA**.
- Backend: **Firebase Realtime Database** directo (no hay API REST propia).
  - Proyecto: `allco-uo9n52`
  - Base: `https://allco-uo9n52-default-rtdb.firebaseio.com`
  - Auth: Firebase Auth **correo/clave**. El token trae claims: `id_tienda`, `role`.
- Cada restaurante = una **tienda** con id **numérico** (Go Burger = `115`).

## 2. Dónde viven las entregas

| Ruta | Qué es |
|---|---|
| `pedidos_activos/tiendas/<tiendaId>/<pushId>` | Entregas en curso |
| `pedidos_finalizados_hoy/tiendas/<tiendaId>/<pushId>` | Entregas terminadas hoy |

Una entrega nace en `pedidos_activos`, y al finalizar se mueve a
`pedidos_finalizados_hoy`. La clave `<pushId>` es la de Firebase
(`entrega_id` / `firestore_doc_id`, ej. `ANRmvClEEMZNZfc135UY`). Además hay un
id numérico global `ID_entrega` (ej. `22225`).

## 3. Esquema de una entrega (campos reales)

### Lo que MenuBy tendría que ENVIAR (datos del pedido)
| Campo Activos | Tipo | Origen en MenuBy | Nota |
|---|---|---|---|
| `id_tienda` / `ID_restaurante` | number | 115 (fijo del restaurante) | uno string, otro number |
| `nombre_tienda` / `nombre_restaurante` | string | nombre del negocio | |
| `telefono_tienda` | string | teléfono del negocio | |
| `ubicacion_restaurante` | {lat,lng} | ubicación del negocio | origen |
| `nombre_cliene` | string | nombre del cliente | **typo en su base: `cliene`, sin la t** |
| `telefono_cliente` | number | teléfono del cliente | va como número |
| `descripcion_direccion` | string | dirección | |
| `descripcion_cliente` | string | detalle (casa/apto) | |
| `ubicacion_cliente` | string | dirección texto | |
| `destino_ubicacion` | {lat,lng} | ubicación de entrega | |
| `ciudad` | string | ciudad | |
| `observaciones_entrega` | string | notas | |
| `estado_pago` | string | ej. "No cobrar al cliente" (prepagado) | |
| `valor_pedido` | number | total del pedido | |

### Lo que Activos LLENA (MenuBy solo lo lee)
- Repartidor: `id_repartidor`/`ID_repartidor`, `repartidor_uid`, `nombre_repartidor`, `repartidor_fcm_token`, `vehiculo_snapshot`
- Comisión/pago al repartidor: `valor_pago_a_repartidor`, `comision_pct_aplicado`, `comision_calculada_sobre_bruto`, `efectivo_pendiente_repartidor`
- Ruta: `distancia_km`, `zona_aplicada`, `tiempo_preparacion`
- Evidencia: `foto_evidencia` (URL de Firebase Storage)
- Tiempos (epoch ms): `hora_entrega`, `fecha_asignacion`, `comenzar_ruta`, `llegada_tienda_at`, `hora_finalizacion`, `last_updated`
- Notificaciones: `notificacion_asignacion_enviada`, `pedido_listo_notificado`, `alerta_retraso_enviada`

## 4. Estado de la entrega (para el seguimiento en MenuBy)

No hay un campo único de estado: se arma con banderas booleanas y tiempos.

| Fase | Cómo se detecta |
|---|---|
| Creada, sin repartidor | `esta_asignado_entrega=false` |
| Asignada | `esta_asignado_entrega=true` + `id_repartidor` + `fecha_asignacion` |
| Repartidor en ruta al local | `comenzar_ruta` (timestamp) |
| Repartidor en el local | `llegada_tienda_at` |
| Pedido listo / recogido | `entrega_lista=true` / `pedido_listo_notificado=true` |
| Entregada | aparece en `pedidos_finalizados_hoy`, `hora_finalizacion`, `foto_evidencia` |
| Falló asignación | `asignacion_fallida=true` |

## 5. Lo que falta (confirmar con Activos)

1. **Contrato de creación:** qué campos EXACTOS espera al crear una entrega
   nueva (el registro que vimos es uno terminado, con campos que llena su
   backend). No se debe adivinar y escribir en producción: crear una entrega
   **despacha un repartidor real**. Pedirles el mínimo, o crear una de prueba
   con ellos presentes.
2. **Credencial de producción:** para la integración real, una credencial de
   servicio o reglas específicas para MenuBy, no un login de restaurante.
3. **Regla de seguridad a cerrar (ver abajo).**

## 6. ⚠️ Hallazgos de seguridad (reportar a Activos)

- **Fuga entre restaurantes:** con la cuenta de UN restaurante (115) se puede
  **leer `pedidos_finalizados_hoy/tiendas` completo** (se ven las tiendas 111,
  112, 113, 114, 115…). Un restaurante podría leer las entregas y **datos de
  clientes de otros restaurantes**. Falla en las reglas de seguridad.
- En cada entrega quedan expuestos **teléfono del cliente**, **teléfono y token
  FCM del repartidor** y la **foto de evidencia**: al ser legibles de forma
  cruzada, es un problema de privacidad.
- No apto para producción hasta cerrar las reglas (y ojalá activar **App Check**).
