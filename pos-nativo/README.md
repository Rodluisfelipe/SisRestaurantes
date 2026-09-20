# POS nativo de MenuBy

Punto de venta *local-first*: la caja opera contra SQLite en disco y la nube es
un destino, no una dependencia. Si se cae internet, se sigue vendiendo.

```
pos-nativo/
├── core/          Rust. Dinero, venta, SQLite y ESC/POS. Sin Tauri, sin red.
├── src-tauri/     Rust. La cáscara: ventana, comandos y puertos físicos.
├── src/           React + TypeScript. La caja.
└── dist/          Lo que Tauri empaqueta (generado).
```

## Por qué está partido así

`core` no conoce Tauri ni ventanas **a propósito**. Es la parte que tiene que
estar bien aunque no haya impresora, ni pantalla, ni servidor: se prueba entera
con `cargo test` en medio segundo. El día que el POS deje de ser Tauri —o corra
en Android—, `core` no se toca.

## Arrancar

```bash
npm install
npm run tauri dev      # abre la app con recarga en caliente
npm run tauri build    # instalador (msi/nsis en Windows, deb/appimage en Linux)
```

Para trabajar solo la interfaz, sin compilar Rust:

```bash
npm run dev            # http://localhost:5174
```

Fuera de Tauri la app funciona con un catálogo de prueba y **no cobra ni
imprime**. La barra superior lo dice en amarillo: un POS que finja cobrar sin
avisar es peligroso.

## Pruebas

```bash
cd core && cargo test
```

27 pruebas sobre lo que cuesta plata si falla: que el IVA incluido cuadre al
peso, que una cantidad absurda no dé la vuelta en `i64`, que las tildes y la Ñ
no salgan como basura en la tirilla, que el pulso del cajón sea el que mueve
solenoides baratos, que la base quede en WAL, y que una venta rechazada **no
deje rastro**.

## Decisiones tomadas

**La plata en enteros.** Nunca `f64`. Un `0.1 + 0.2 = 0.30000000000000004` en
una tirilla es un descuadre de caja que el cajero paga de su bolsillo.

**WAL + `synchronous = NORMAL`.** En un mostrador se va la luz. Con WAL, una
transacción incompleta simplemente no ocurrió; sin él, la base puede quedar
corrupta. `NORMAL` evita un `fsync` por venta, que en las eMMC de los
todo-en-uno es la diferencia entre 2 ms y 40 ms.

**El id de la venta lo genera la caja (UUID), no el servidor.** Es lo que
permite reintentar el envío diez veces sin que aparezcan diez ventas en la nube:
el servidor lo usa como llave de idempotencia. El consecutivo ("venta #143") es
aparte y es para el humano.

**La venta y su fila de `outbox` entran en la misma transacción.** Si se
encolara después, una caída entre el commit y el encolado dejaría una venta que
nunca sube y que nadie nota hasta el cierre del mes.

**Primero se guarda, después se imprime.** Si la impresora está sin papel, la
venta ya está registrada y la tirilla se reimprime. Al revés, se entregaría un
comprobante de una venta que no existe.

**Los bytes ESC/POS se arman sin puerto de por medio.** Es la clase de código
que "funciona en mi impresora" y falla en la del cliente, así que vive en
`core/escpos.rs` y se prueba byte a byte, sin hardware.

**El texto se convierte a CP850.** El webview manda UTF-8 y la térmica no lo
entiende: sin traducir, la Ñ y las tildes salen como basura en el nombre del
negocio y de cada producto.

## Lo que falta decidir (bloquea el motor de sincronización)

PowerSync y ElectricSQL son **local-first sobre PostgreSQL**: los dos se montan
sobre la replicación lógica de Postgres. MenuBy hoy corre sobre **MongoDB**, así
que tal como está, ninguno de los dos se puede apuntar al backend actual.

Los tres caminos, con lo que cuesta cada uno:

1. **POS con su propio PostgreSQL + PowerSync**, y un puente hacia MenuBy para
   catálogo y ventas. Es la directriz al pie de la letra y la mejor
   sincronización; el costo es operar dos bases y mantener el puente.
2. **Migrar MenuBy a PostgreSQL.** Resuelve el problema de raíz y es, con
   diferencia, lo más caro: hoy hay 60+ modelos de Mongoose en producción.
3. **Outbox contra la API actual de MenuBy.** El `outbox` ya está construido y
   probado; faltaría el cliente HTTP con reintentos y un endpoint idempotente
   del lado de Express. No es sincronización bidireccional —el catálogo bajaría
   por *pull* periódico, no por streaming—, pero es una fracción del trabajo y
   no agrega una base nueva.

Mi recomendación: **(3) para salir a producción y (1) cuando haya más de un
punto de venta por negocio**. El `outbox` es el mismo en los tres caminos, que
es justo por lo que se construyó primero: no hay que elegir hoy para avanzar.

## Turnos, PIN y arqueo ciego

Sin PIN no hay caja y **sin turno abierto no se vende**: es lo que hace que cada
venta tenga dueño y que un descuadre se le pueda preguntar a alguien.

- **PIN con Argon2 y sal por usuario.** Cuatro dígitos son diez mil
  combinaciones, así que el hash por sí solo no detiene a quien se lleve el
  archivo; lo que sí lo detiene es el freno: cinco fallos bloquean la caja un
  minuto.
- **Auto-bloqueo a los 90 segundos** sin tocar nada. Un cajero que se va a
  almorzar sin bloquear deja su usuario disponible para que otro cobre a su
  nombre, y el arqueo termina señalando a quien no fue.
- **El cajero y el turno los pone Rust**, no la interfaz. Si vinieran del
  webview, bastaría abrir las herramientas de desarrollo para firmar una venta
  a nombre de otro.
- **Arqueo ciego de verdad**: no existe ningún comando que devuelva el esperado
  antes de contar. El cajero cuenta, digita, y la diferencia aparece después.
- **Entradas y salidas de gaveta con motivo obligatorio.** Un "salieron 50.000"
  sin motivo es indistinguible de un faltante.

El cierre sube por la misma cola que las ventas y queda en MenuBy como un
arqueo (`CashRegister` con `origen: 'pos-nativo'`), con su hora real aunque la
caja haya estado sin internet todo el día. Un descuadre distinto de cero avisa
al panel en vivo.

## Lo que todavía no existe

Devoluciones desde el POS, descuentos y propina, pausar una venta para atender
al siguiente de la fila, pantalla de cliente, datáfono integrado y conteo por
denominaciones (hoy se digita el total contado, no billete por billete).
