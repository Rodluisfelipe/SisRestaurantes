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
    // 10 — volver a bajar el catálogo entero, una vez.
    r#"
    /* La marca de agua guarda hasta cuándo se bajó el catálogo, y el servidor
       solo manda lo que cambió después de esa fecha. Eso es lo que permite que
       una caja con 5.000 productos arranque en un segundo.

       Tiene una consecuencia que costó una tarde entender: **agregar una
       columna nueva no rellena las filas que ya estaban**. La migración 9 creó
       `foto_url`, pero como en la nube ningún producto había cambiado desde la
       última bajada, el servidor respondía "no hay nada nuevo" y esa columna se
       quedaba vacía para siempre. Las fotos no bajaban y no había forma de que
       bajaran.

       Borrar la marca fuerza una bajada completa la próxima vez. Cuesta unos
       segundos, pasa una sola vez y deja el catálogo con todo lo que el
       contrato nuevo trae.

       ── La regla, para que esto no vuelva a pasar ──────────────────────────
       Toda migración que agregue una columna de `productos` alimentada por el
       catálogo tiene que borrar la marca de agua en la misma migración. Si no,
       la columna nace vacía y nadie se entera hasta que un cajero dice que
       algo no aparece. */
    DELETE FROM ajustes WHERE clave = 'catalogo_desde';
    "#,
    // 11 — la propina, que se cobra pero no es del negocio.
    r#"
    /* La propina va aparte del total y no dentro, y la diferencia no es
       cosmética: no es ingreso del negocio ni base gravable. Si se sumara al
       total, aparecería en las ventas del mes, pagaría impuestos que no le
       corresponden y el administrador no tendría forma de separar lo que hay
       que repartirle al personal.

       El gran total que el cliente paga es `total + propina`. En la gaveta
       entran las dos cosas juntas, y por eso el arqueo tiene que saber cuánta
       propina en efectivo hay dentro: al liquidar el turno, esa plata sale y
       no es un faltante. */
    ALTER TABLE ventas ADD COLUMN propina INTEGER NOT NULL DEFAULT 0;
    CREATE INDEX idx_ventas_propina ON ventas(turno_id) WHERE propina > 0;
    "#,
    // 12 — devolver lo que ya se cobró.
    r#"
    /* Una devolución **no borra la venta**. Es una operación aparte que apunta
       a la original, y esa es la diferencia entre un registro contable y un
       registro que se puede alterar: si devolver borrara la venta, no quedaría
       rastro de que se cobró, y el turno donde se cobró cerraría distinto cada
       vez que alguien devuelve algo del día anterior.

       El turno que se anota es el turno en el que se **devuelve**, no el de la
       venta. Ese billete sale de la gaveta de hoy, aunque la venta fuera de
       ayer. */
    CREATE TABLE devoluciones (
        id             TEXT PRIMARY KEY,
        venta_id       TEXT NOT NULL REFERENCES ventas(id),
        turno_id       TEXT NOT NULL REFERENCES turnos(id),
        -- Quién la hizo y quién la autorizó. Nunca la misma persona por accidente.
        cajero         TEXT NOT NULL,
        autorizo       TEXT NOT NULL,
        total          INTEGER NOT NULL,
        /* Cómo salió la plata. En efectivo sale de la gaveta y el arqueo tiene
           que saberlo; por datáfono la reversa la hace el banco y la gaveta no
           se entera. */
        medio          TEXT NOT NULL DEFAULT 'efectivo',
        motivo         TEXT NOT NULL,
        creada_en      TEXT NOT NULL
    );
    CREATE INDEX idx_devoluciones_turno ON devoluciones(turno_id);
    CREATE INDEX idx_devoluciones_venta ON devoluciones(venta_id);

    /* Qué se devolvió. Por línea, porque casi nunca se devuelve la venta
       entera: de cuatro platos vuelve uno. */
    CREATE TABLE devolucion_items (
        devolucion_id  TEXT NOT NULL REFERENCES devoluciones(id) ON DELETE CASCADE,
        linea          INTEGER NOT NULL,
        producto_id    TEXT NOT NULL,
        nombre         TEXT NOT NULL,
        variante       TEXT NOT NULL DEFAULT '',
        precio         INTEGER NOT NULL,
        cantidad       INTEGER NOT NULL,
        PRIMARY KEY (devolucion_id, linea)
    );
    "#,
    // 13 — los extras: adiciones, salsas, términos.
    r#"
    /* Los grupos de extras del producto, tal como bajan de la nube, en JSON.

       En una columna y no en tablas propias a propósito: esto es **material de
       consulta replicado**, no datos del negocio. La caja no lo consulta ni lo
       cruza con nada —lo lee entero para dibujar una pantalla y ya— y tres
       tablas con sus llaves foráneas serían tres tablas que mantener en
       sincronía con un modelo que vive en Mongo y cambia sin avisar.

       Lo que el cajero elige sí se guarda estructurado, en `venta_items`. */
    ALTER TABLE productos ADD COLUMN extras TEXT NOT NULL DEFAULT '[]';

    /* Qué extras llevaba esta línea. Es lo que hace que la comanda diga
       "hamburguesa con queso extra y sin cebolla" y no solo "hamburguesa". */
    ALTER TABLE venta_items ADD COLUMN extras TEXT NOT NULL DEFAULT '[]';

    /* Una columna nueva alimentada por el catálogo obliga a bajarlo entero:
       las filas que ya estaban nacen con '[]' y la marca de agua impediría que
       se volvieran a pedir nunca. Misma regla que la migración 10. */
    DELETE FROM ajustes WHERE clave = 'catalogo_desde';
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

    #[test]
    fn una_columna_nueva_del_catalogo_obliga_a_bajarlo_entero() {
        /* Esta prueba existe por un fallo real: la migración 9 agregó
           `foto_url` y las fotos no bajaron nunca. El catálogo solo trae lo que
           cambió desde la marca de agua, así que una columna nueva nace vacía
           en todas las filas que ya estaban y se queda vacía para siempre.

           Se comprueba leyendo las migraciones: cualquiera que agregue una
           columna a `productos` tiene que borrar la marca, en ella misma o en
           la siguiente. Una prueba que solo mirara la base no vería el
           problema, porque una base recién creada no tiene marca que estorbe. */
        let toca_productos: Vec<usize> = MIGRACIONES
            .iter()
            .enumerate()
            .filter(|(_, sql)| sql.contains("ALTER TABLE productos ADD COLUMN"))
            .map(|(i, _)| i)
            .collect();

        assert!(!toca_productos.is_empty(), "debería haber alguna");

        for i in toca_productos {
            /* En la misma o en la siguiente: se admiten las dos porque la
               número 10 arregló a posteriori lo que la 9 dejó suelto, y
               reescribir una migración ya publicada no es una opción. */
            let borra_la_marca = MIGRACIONES[i..]
                .iter()
                .take(2)
                .any(|sql| sql.contains("DELETE FROM ajustes WHERE clave = 'catalogo_desde'"));

            assert!(
                borra_la_marca,
                "la migración {} agrega una columna de productos y no borra la marca de agua: \
                 esa columna va a quedarse vacía en toda caja que ya haya sincronizado",
                i + 1,
            );
        }
    }

    #[test]
    fn sin_marca_de_agua_el_catalogo_se_pide_desde_el_principio() {
        // Que es lo que hace que la bajada completa ocurra de verdad.
        let c = abrir_en_memoria().unwrap();
        assert_eq!(crate::catalogo::marca_de_agua(&c).unwrap(), "");
    }

}
