//! La base local.
//!
//! El POS escribe aquí y solo aquí. La nube es un destino, no una dependencia:
//! si no hay internet, la caja sigue vendiendo igual de rápido.
//!
//! Dos ajustes que no son opcionales:
//!
//! - **WAL.** En un mostrador se va la luz y se apagan equipos de un tirón. Con
//!   el journal por defecto, una escritura a medias puede dejar la base
//!   corrupta; con WAL, la transacción incompleta simplemente no ocurrió.
//! - **`synchronous = NORMAL`.** Con WAL es seguro ante caída del proceso y
//!   evita un `fsync` por transacción, que en las eMMC baratas de los
//!   todo-en-uno es la diferencia entre 2 ms y 40 ms por venta.
//!
//! `foreign_keys` va encendido porque SQLite las ignora por defecto: sin eso,
//! un ítem puede quedar apuntando a una venta que no existe y el cierre de caja
//! cuadra mal sin que nadie sepa por qué.

use rusqlite::{Connection, Result};
use std::path::Path;

/// Cada migración se aplica una vez y en orden. El número queda guardado en
/// `user_version`, que es un entero que SQLite ya trae en el archivo: no hace
/// falta una tabla de migraciones ni una librería.
const MIGRACIONES: &[&str] = &[
    // 1 — catálogo replicado desde la nube y ventas locales.
    r#"
    CREATE TABLE productos (
        id            TEXT PRIMARY KEY,
        nombre        TEXT NOT NULL,
        precio        INTEGER NOT NULL,
        categoria     TEXT NOT NULL DEFAULT '',
        sku           TEXT NOT NULL DEFAULT '',
        -- Qué talla o sabor es, cuando el producto tiene variantes.
        variante      TEXT NOT NULL DEFAULT '',
        activo        INTEGER NOT NULL DEFAULT 1,
        actualizado   TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX idx_productos_nombre ON productos(nombre);
    CREATE INDEX idx_productos_sku ON productos(sku);

    CREATE TABLE ventas (
        -- UUID generado en la caja, no un consecutivo del servidor: es lo que
        -- permite reintentar el envío sin duplicar la venta en la nube.
        id            TEXT PRIMARY KEY,
        consecutivo   INTEGER NOT NULL,
        total         INTEGER NOT NULL,
        iva           INTEGER NOT NULL DEFAULT 0,
        recibido      INTEGER NOT NULL DEFAULT 0,
        vuelto        INTEGER NOT NULL DEFAULT 0,
        medio_pago    TEXT NOT NULL DEFAULT 'efectivo',
        cajero        TEXT NOT NULL DEFAULT '',
        turno_id      TEXT NOT NULL DEFAULT '',
        creada_en     TEXT NOT NULL,
        -- 'local' mientras no haya subido; el motor de sync la marca 'sincronizada'.
        estado_sync   TEXT NOT NULL DEFAULT 'local'
    );
    CREATE INDEX idx_ventas_creada ON ventas(creada_en);
    CREATE INDEX idx_ventas_turno ON ventas(turno_id);

    CREATE TABLE venta_items (
        venta_id      TEXT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
        linea         INTEGER NOT NULL,
        producto_id   TEXT NOT NULL,
        -- Copia del nombre y del precio al momento de vender: si mañana suben
        -- el precio, la tirilla reimpresa tiene que decir lo que se cobró.
        nombre        TEXT NOT NULL,
        variante      TEXT NOT NULL DEFAULT '',
        precio        INTEGER NOT NULL,
        cantidad      INTEGER NOT NULL,
        PRIMARY KEY (venta_id, linea)
    );

    -- La cola hacia la nube. Vive en la MISMA transacción que la venta: o se
    -- guardan las dos o ninguna. Una venta sin su fila de outbox es una venta
    -- que nunca sube y que nadie nota hasta el cierre del mes.
    CREATE TABLE outbox (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        entidad       TEXT NOT NULL,
        entidad_id    TEXT NOT NULL,
        operacion     TEXT NOT NULL,
        payload       TEXT NOT NULL,
        intentos      INTEGER NOT NULL DEFAULT 0,
        ultimo_error  TEXT NOT NULL DEFAULT '',
        creado_en     TEXT NOT NULL,
        enviado_en    TEXT
    );
    CREATE INDEX idx_outbox_pendiente ON outbox(enviado_en, id);
    "#,
    // 2 — reintentos con espera y ajustes locales.
    r#"
    /* Cuándo toca el siguiente intento (epoch en segundos). 0 = ya.
       Sin esto, una caída del backend se convierte en cien cajas
       martillándolo cada segundo justo cuando intenta levantarse. */
    ALTER TABLE outbox ADD COLUMN proximo_intento INTEGER NOT NULL DEFAULT 0;

    /* Lo que el servidor rechazó y no vale la pena reintentar. Se aparta en
       vez de borrarse: la venta sigue en la base y visible para soporte. */
    ALTER TABLE outbox ADD COLUMN apartada INTEGER NOT NULL DEFAULT 0;

    DROP INDEX IF EXISTS idx_outbox_pendiente;
    CREATE INDEX idx_outbox_pendiente ON outbox(enviado_en, apartada, proximo_intento, id);

    /* Clave/valor de la caja: marca de agua del catálogo, id del equipo,
       última sincronización. Una tabla y no un archivo suelto, para que entre
       en la misma transacción que los datos que describe. */
    CREATE TABLE ajustes (
        clave TEXT PRIMARY KEY,
        valor TEXT NOT NULL
    );
    "#,
    // 3 — quién está en la caja y de qué turno responde.
    r#"
    CREATE TABLE usuarios (
        id        TEXT PRIMARY KEY,
        nombre    TEXT NOT NULL,
        -- 'cajero' o 'supervisor'. Dos roles y nada más: un POS con doce
        -- permisos termina con todos usando el usuario del dueño.
        rol       TEXT NOT NULL DEFAULT 'cajero',
        -- Argon2 con sal por usuario. Nunca el PIN.
        pin_hash  TEXT NOT NULL,
        activo    INTEGER NOT NULL DEFAULT 1
    );

    /* El trozo de día del que alguien responde. Sin turno abierto no se vende:
       un descuadre sin dueño vuelve imposible la conversación de "faltan
       veinte mil". */
    CREATE TABLE turnos (
        id             TEXT PRIMARY KEY,
        usuario_id     TEXT NOT NULL DEFAULT '',
        cajero         TEXT NOT NULL DEFAULT '',
        abierto_en     TEXT NOT NULL,
        cerrado_en     TEXT,
        fondo_inicial  INTEGER NOT NULL DEFAULT 0,
        -- Se llenan al cerrar. El esperado NO se calcula antes del conteo.
        contado        INTEGER,
        esperado       INTEGER,
        diferencia     INTEGER,
        estado         TEXT NOT NULL DEFAULT 'ABIERTO'
    );
    CREATE INDEX idx_turnos_estado ON turnos(estado, abierto_en);

    /* Plata que entra o sale sin ser una venta: sencillo del banco, hielo, el
       domiciliario. El motivo es obligatorio porque un movimiento sin motivo es
       el hueco exacto por donde se va la plata. */
    CREATE TABLE movimientos_caja (
        id         TEXT PRIMARY KEY,
        turno_id   TEXT NOT NULL REFERENCES turnos(id),
        tipo       TEXT NOT NULL,
        monto      INTEGER NOT NULL,
        motivo     TEXT NOT NULL,
        usuario    TEXT NOT NULL DEFAULT '',
        creado_en  TEXT NOT NULL
    );
    CREATE INDEX idx_movimientos_turno ON movimientos_caja(turno_id);
    "#,
    // 4 — la fila de la hora pico: ventas en espera y excepciones.
    r#"
    /* El carrito apartado mientras el cliente busca la plata. No es una venta:
       no tiene consecutivo, no toca inventario y no sube a la nube. Vive en
       disco y no en la memoria del webview, para que sobreviva a un apagón. */
    CREATE TABLE ventas_pausadas (
        id         TEXT PRIMARY KEY,
        turno_id   TEXT NOT NULL,
        etiqueta   TEXT NOT NULL DEFAULT '',
        total      INTEGER NOT NULL DEFAULT 0,
        items      INTEGER NOT NULL DEFAULT 0,
        carrito    TEXT NOT NULL,
        creada_en  TEXT NOT NULL
    );
    CREATE INDEX idx_pausadas_turno ON ventas_pausadas(turno_id, creada_en);

    /* Anulaciones, descuentos y aperturas de cajón. Solo se agrega: no hay
       borrado ni edición a propósito, porque un log de excepciones que se
       puede limpiar no sirve para nada. */
    CREATE TABLE auditoria_operaciones (
        id         TEXT PRIMARY KEY,
        turno_id   TEXT NOT NULL,
        tipo       TEXT NOT NULL,
        detalle    TEXT NOT NULL DEFAULT '',
        monto      INTEGER NOT NULL DEFAULT 0,
        motivo     TEXT NOT NULL DEFAULT '',
        -- Quién tenía la caja y quién autorizó. Los dos, siempre.
        cajero     TEXT NOT NULL DEFAULT '',
        autorizo   TEXT NOT NULL DEFAULT '',
        creada_en  TEXT NOT NULL
    );
    CREATE INDEX idx_auditoria_turno ON auditoria_operaciones(turno_id, creada_en);
    "#,
    // 5 — el voucher del datáfono, pegado a la venta.
    r#"
    /* Lo que imprime el datáfono. Sin esto, al cerrar el turno hay una pila de
       vouchers de papel y ninguna forma de emparejarlos con las ventas: los
       últimos cuatro y el código de aprobación son justo eso. */
    ALTER TABLE ventas ADD COLUMN pago_autorizacion TEXT NOT NULL DEFAULT '';
    ALTER TABLE ventas ADD COLUMN pago_ultimos4 TEXT NOT NULL DEFAULT '';
    ALTER TABLE ventas ADD COLUMN pago_franquicia TEXT NOT NULL DEFAULT '';
    "#,
    // 6 — una venta pagada con dos medios, y lo que el cliente pidió a mano.
    r#"
    /* Pago mixto: "treinta mil en efectivo y el resto con tarjeta" es diario en
       mostrador, y hasta aquí la venta solo admitía un medio.

       Es tabla aparte y no más columnas en `ventas` porque el número de pagos
       no tiene tope: hay clientes que juntan efectivo, tarjeta y un bono. La
       columna `medio_pago` de `ventas` se queda —es lo que hace legible un
       listado de un vistazo— y pasa a guardar "mixto" cuando hay más de uno.

       No lleva llave foránea a `ventas` por accidente: la lleva porque borrar
       una venta sin borrar sus pagos dejaría plata registrada sin venta, que es
       exactamente el tipo de fila que descuadra un arqueo sin explicación. */
    CREATE TABLE venta_pagos (
        venta_id    TEXT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
        linea       INTEGER NOT NULL,
        metodo      TEXT NOT NULL,
        monto       INTEGER NOT NULL,
        -- El voucher o el número de aprobación, cuando el medio lo tiene.
        referencia  TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (venta_id, linea)
    );
    CREATE INDEX idx_venta_pagos_metodo ON venta_pagos(metodo);

    /* La nota del ítem: "sin cebolla", "término tres cuartos". En gastronomía
       no se vende un plato, se vende un plato como lo pidieron, y esa frase
       tiene que llegar a la cocina o el plato vuelve. */
    ALTER TABLE venta_items ADD COLUMN nota TEXT NOT NULL DEFAULT '';

    /* Las ventas que ya estaban en la caja se traen a la tabla nueva. Sin esto
       habría dos formas de saber con qué se pagó —la columna vieja para lo de
       antes y la tabla para lo de ahora— y el arqueo tendría que conocer las
       dos. Con el relleno, `venta_pagos` es la única respuesta.

       El monto reproduce lo que hace `formas_de_pago`: en efectivo, lo que el
       cajero digitó, y el total cuando no digitó nada; en cualquier otro medio,
       el total. */
    INSERT INTO venta_pagos (venta_id, linea, metodo, monto, referencia)
    SELECT id, 1, medio_pago,
           CASE WHEN medio_pago = 'efectivo' AND recibido > 0 THEN recibido ELSE total END,
           pago_autorizacion
    FROM ventas;
    "#,
    // 7 — el descuento, rebajado del total y con nombre y apellido.
    r#"
    /* Un descuento no es una anotación: cambia lo que el cliente paga. Va en la
       venta y no en las líneas porque se aplica al total —un 10% sobre la
       cuenta, una cortesía— y repartirlo por línea obligaría a redondear cuatro
       veces y a que la suma de las partes no diera el total.

       `bruto` se guarda además del total para que la tirilla pueda decir
       "antes 50.000, descuento 5.000, paga 45.000": sin el bruto, esa resta no
       se puede reconstruir después. */
    ALTER TABLE ventas ADD COLUMN bruto INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE ventas ADD COLUMN descuento INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE ventas ADD COLUMN descuento_motivo TEXT NOT NULL DEFAULT '';

    /* Las ventas que ya existían no tenían descuento, así que su bruto es su
       total. Sin esto quedarían con bruto cero y cualquier informe que reste
       las dos cifras vería un descuento del 100%. */
    UPDATE ventas SET bruto = total WHERE bruto = 0;
    "#,
    // 8 — la mesa que pide en tandas y paga al final.
    r#"
    /* Una cuenta abierta es una venta en espera que en vez de esperar, crece.
       Es la misma tabla porque es la misma idea —un carrito en disco que
       todavía no se cobró— y partirla en dos habría dejado dos sitios donde
       mirar antes de cerrar el turno.

       Sigue sin tocar inventario y sin entrar a la cola: a la nube le importa
       lo que se cobró, y una mesa que lleva una hora pidiendo todavía no se
       cobró. */
    ALTER TABLE ventas_pausadas ADD COLUMN identificador TEXT NOT NULL DEFAULT '';

    /* Lo que ya se mandó a la cocina, guardado tal cual se mandó.

       Es la pieza de la que depende que una mesa no reciba dos veces el mismo
       plato: cuando llega una ronda nueva, se compara lo que hay contra esta
       foto y solo se imprime la diferencia. Está en disco y no en memoria
       porque el corte de luz entre la primera y la segunda ronda es
       exactamente el momento en que se duplicaría. */
    ALTER TABLE ventas_pausadas ADD COLUMN comandado TEXT NOT NULL DEFAULT '[]';

    ALTER TABLE ventas_pausadas ADD COLUMN actualizada_en TEXT NOT NULL DEFAULT '';
    UPDATE ventas_pausadas SET actualizada_en = creada_en WHERE actualizada_en = '';

    /* Dos mesas con el mismo nombre en el mismo turno serían dos cuentas que
       el mesero cree que son una. El índice es parcial porque las ventas en
       espera de mostrador no tienen identificador y son muchas. */
    CREATE UNIQUE INDEX idx_cuenta_unica
        ON ventas_pausadas(turno_id, identificador)
        WHERE identificador != '';
    "#,
    // 9 — la foto del producto, guardada en el disco de la caja.
    r#"
    /* Dos columnas y no una, y la diferencia importa:

       `foto_url` es la dirección que mandó la nube y sirve para saber si la
       imagen cambió —si llega una distinta, hay que volver a bajarla—.
       `foto_local` es el archivo que ya está en disco, y es la única que mira
       la pantalla.

       Con una sola columna no se podría distinguir "todavía no se ha
       descargado" de "el dueño le cambió la foto", y una de las dos cosas no
       se actualizaría nunca. */
    ALTER TABLE productos ADD COLUMN foto_url TEXT NOT NULL DEFAULT '';
    ALTER TABLE productos ADD COLUMN foto_local TEXT NOT NULL DEFAULT '';
    "#,
];

/// Abre (o crea) la base y la deja lista para operar.
pub fn abrir(ruta: &Path) -> Result<Connection> {
    let conexion = Connection::open(ruta)?;
    preparar(&conexion)?;
    Ok(conexion)
}

/// Una base en memoria, para las pruebas.
pub fn abrir_en_memoria() -> Result<Connection> {
    let conexion = Connection::open_in_memory()?;
    preparar(&conexion)?;
    Ok(conexion)
}

fn preparar(conexion: &Connection) -> Result<()> {
    // En memoria WAL no aplica, y pedirlo no falla: simplemente se queda en
    // 'memory'. Por eso no se verifica el resultado.
    conexion.pragma_update(None, "journal_mode", "WAL")?;
    conexion.pragma_update(None, "synchronous", "NORMAL")?;
    conexion.pragma_update(None, "foreign_keys", "ON")?;
    // Si otra ventana del POS está escribiendo, se espera en vez de reventar.
    conexion.busy_timeout(std::time::Duration::from_secs(5))?;
    migrar(conexion)
}

fn migrar(conexion: &Connection) -> Result<()> {
    let version: i64 = conexion.query_row("PRAGMA user_version", [], |f| f.get(0))?;

    for (i, sql) in MIGRACIONES.iter().enumerate() {
        let numero = i as i64 + 1;
        if numero <= version {
            continue;
        }
        conexion.execute_batch(sql)?;
        conexion.pragma_update(None, "user_version", numero)?;
    }

    Ok(())
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn la_segunda_migracion_deja_la_cola_con_espera_y_los_ajustes() {
        let c = abrir_en_memoria().unwrap();
        // Si estas columnas faltaran, el backoff no existiría y la caja
        // reintentaría en bucle contra un backend caído.
        c.execute("INSERT INTO ajustes (clave, valor) VALUES ('x', 'y')", []).unwrap();
        let pendientes: i64 = c
            .query_row("SELECT COUNT(*) FROM outbox WHERE apartada = 0 AND proximo_intento <= 0", [], |f| f.get(0))
            .unwrap();
        assert_eq!(pendientes, 0);
    }

    #[test]
    fn migrar_dos_veces_no_rompe_nada() {
        // Es lo que pasa en cada arranque del POS.
        let c = abrir_en_memoria().unwrap();
        migrar(&c).unwrap();
        migrar(&c).unwrap();

        let version: i64 = c.query_row("PRAGMA user_version", [], |f| f.get(0)).unwrap();
        assert_eq!(version, MIGRACIONES.len() as i64);
    }

    #[test]
    fn las_llaves_foraneas_quedan_encendidas() {
        // SQLite las ignora por defecto; sin esto un ítem puede quedar huérfano.
        let c = abrir_en_memoria().unwrap();
        let encendidas: i64 = c.query_row("PRAGMA foreign_keys", [], |f| f.get(0)).unwrap();
        assert_eq!(encendidas, 1);
    }

    #[test]
    fn un_item_sin_venta_no_entra() {
        let c = abrir_en_memoria().unwrap();
        let r = c.execute(
            "INSERT INTO venta_items (venta_id, linea, producto_id, nombre, precio, cantidad)
             VALUES ('no-existe', 1, 'p1', 'X', 1000, 1)",
            [],
        );
        assert!(r.is_err(), "la llave foránea tiene que rechazarlo");
    }

    #[test]
    fn en_disco_queda_en_wal() {
        // WAL es lo que salva la base cuando se va la luz a mitad de venta.
        let dir = tempfile::tempdir().unwrap();
        let c = abrir(&dir.path().join("pos.db")).unwrap();
        let modo: String = c.query_row("PRAGMA journal_mode", [], |f| f.get(0)).unwrap();
        assert_eq!(modo.to_lowercase(), "wal");
    }
}
