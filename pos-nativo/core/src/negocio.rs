//! De qué negocio es esta caja, y qué pasa cuando cambia.
//!
//! El fallo que este módulo existe para cerrar: una terminal vinculada a un
//! negocio y después vinculada a otro **se quedaba con los datos del primero**.
//! El catálogo no se borraba, y como la bajada va por marca de agua —"dame lo
//! que cambió desde tal fecha"— el negocio nuevo solo mandaba sus cambios
//! posteriores a esa fecha. Resultado: una caja vendiendo una mezcla de dos
//! cartas, con los clientes del local anterior en la memoria.
//!
//! No se nota de entrada. Se nota cuando alguien cobra un producto que ese
//! local no vende, o cuando un cliente aparece con puntos que no son suyos.
//!
//! La regla es simple y va en una sola dirección: **si el negocio cambió, lo
//! replicado se tira y se vuelve a bajar entero**. Lo replicado es barato —son
//! productos, fotos y caché de clientes, todos reconstruibles desde la nube—.
//! Lo que **no** se toca es lo que la caja generó y la nube no tiene: ventas,
//! turnos y arqueos. Eso es historia del negocio anterior y borrarla sería
//! perder la única copia.

use rusqlite::{params, Connection, Result};

/// Dónde se guarda el negocio al que responde esta caja.
const CLAVE: &str = "negocio_id";

/// Lo que se hereda del negocio anterior y hay que soltar.
///
/// Son las claves de identidad —nombre y colores— que se pintan en la pantalla
/// y en la tirilla. Sin borrarlas, la caja del negocio nuevo arranca con el
/// nombre del viejo hasta que baje catálogo, y esa primera tirilla sale con el
/// membrete equivocado.
const AJUSTES_DEL_NEGOCIO: &[&str] = &[
    "catalogo_desde",
    "clientes_desde",
    "negocio_nombre",
    "marca_color",
    "marca_color_texto",
    "config_version",
];

#[derive(Debug)]
pub enum ErrorCambio {
    /// Hay ventas sin subir. Cambiar de negocio ahora las perdería.
    HayPendientes(i64),
    /* Hay un turno sin cerrar.

       No está en el outbox —el arqueo se encola al cerrarlo, no al abrirlo—
       así que la guarda de las pendientes no lo ve. Y si se dejara pasar,
       el cajero cerraría el turno del negocio anterior con la caja ya
       vinculada al nuevo, y ese arqueo se subiría al local equivocado. */
    TurnoAbierto(String),
    Base(rusqlite::Error),
}

impl From<rusqlite::Error> for ErrorCambio {
    fn from(e: rusqlite::Error) -> Self {
        ErrorCambio::Base(e)
    }
}

impl std::fmt::Display for ErrorCambio {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ErrorCambio::HayPendientes(n) => write!(
                f,
                "Quedan {n} venta(s) sin subir del negocio anterior. \
                 Sincroniza antes de vincular esta caja a otro negocio."
            ),
            ErrorCambio::TurnoAbierto(cajero) => write!(
                f,
                "El turno de {cajero} sigue abierto. Ciérralo antes de vincular \
                 esta caja a otro negocio: su arqueo es del negocio anterior."
            ),
            ErrorCambio::Base(e) => write!(f, "{e}"),
        }
    }
}

/// Qué pasó al cambiar de negocio, para poder contarlo.
#[derive(Debug, Default, PartialEq, Eq, serde::Serialize)]
pub struct Cambio {
    /// Si de verdad cambió. Falso = es el mismo negocio y no se tocó nada.
    pub hubo_cambio: bool,
    pub productos_borrados: i64,
    pub clientes_borrados: i64,
    /// Filas del outbox que se apartaron con su negocio original.
    pub outbox_archivado: i64,
}

/// El negocio al que responde esta caja. Vacío = nunca se ha vinculado.
pub fn id_actual(conexion: &Connection) -> Result<String> {
    conexion
        .query_row("SELECT valor FROM ajustes WHERE clave = ?1", [CLAVE], |f| f.get(0))
        .or_else(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => Ok(String::new()),
            otro => Err(otro),
        })
}

/// Si esta caja llegó a estar conectada a algún MenuBy alguna vez.
///
/// `nube_url` se escribe en cada vinculación y **no** se borra al cambiar de
/// negocio, así que su ausencia significa exactamente una cosa: esta caja
/// nunca se conectó a nada.
///
/// La distinción importa porque las guardas de más abajo protegen contra una
/// sola cosa —subirle a un negocio los datos de otro— y eso no puede pasar
/// cuando no hubo otro. Una caja recién instalada que abrió turno y vendió
/// sin conexión está haciendo justo lo que la pantalla le prometió: "vende y
/// guarda igual, nada sube". Bloquearle la vinculación sería castigarla por
/// haber funcionado.
fn fue_vinculada(conexion: &Connection) -> Result<bool> {
    conexion
        .query_row("SELECT COUNT(*) FROM ajustes WHERE clave = 'nube_url'", [], |f| {
            f.get::<_, i64>(0)
        })
        .map(|n| n > 0)
}

/// Cuántas ventas quedan por subir.
///
/// Las apartadas no cuentan: son las que el servidor ya rechazó y no va a
/// aceptar por insistir. Exigir que estén en cero dejaría la caja imposible de
/// re-vincular para siempre por una venta malformada de hace tres meses.
pub fn pendientes(conexion: &Connection) -> Result<i64> {
    conexion.query_row(
        "SELECT COUNT(*) FROM outbox WHERE enviado_en IS NULL AND apartada = 0",
        [],
        |f| f.get(0),
    )
}

/// Pone esta caja al servicio de un negocio, tirando lo del anterior si lo hay.
///
/// Devuelve `hubo_cambio: false` sin tocar nada cuando el negocio es el mismo:
/// re-vincular la misma caja al mismo local —porque venció el token, porque
/// alguien la desvinculó por error— no puede costarle al negocio una bajada
/// entera del catálogo en mitad del servicio.
///
/// **Cuando no había ningún id guardado, sí se limpia.** Es el caso de una caja
/// que venía de una versión anterior a este control: no hay forma de saber de
/// qué negocio son sus datos, y la única respuesta honesta a "no sé" es volver
/// a bajarlo todo. Cuesta una sincronización; la alternativa es seguir
/// vendiendo una carta que puede no ser la de este local.
pub fn cambiar_a(
    conexion: &mut Connection,
    nuevo_id: &str,
    ahora: &str,
) -> std::result::Result<Cambio, ErrorCambio> {
    let nuevo = nuevo_id.trim();
    if nuevo.is_empty() {
        /* Sin id no se puede decidir nada. No se limpia y no se guarda: quedarse
           como está es lo único que no empeora la situación, y la próxima
           vinculación con un id válido lo resolverá. */
        return Ok(Cambio::default());
    }

    let anterior = id_actual(conexion)?;
    if anterior == nuevo {
        return Ok(Cambio::default());
    }

    /* Las guardas solo aplican si de verdad hubo un negocio antes.

       Protegen contra una sola cosa: que las ventas o el arqueo de un local
       terminen subiendo al siguiente. En una caja que nunca estuvo conectada
       no hay de dónde: lo que tenga encolado es suyo y del negocio al que
       está a punto de vincularse, que es exactamente el caso que la pantalla
       anuncia —"vende y guarda igual, pero nada sube"— y el orden natural de
       una instalación: poner el PIN, abrir el turno, y conectar después.

       Aplicarlas ahí dejaba la caja en un punto muerto: no podía vincularse
       sin cerrar el turno, y cerrar el turno no servía de nada porque el
       arqueo no tenía a dónde subir. */
    let vinculada = fue_vinculada(conexion)?;

    if vinculada {
        /* Una venta en la cola solo puede subir con el token del negocio que
           la generó: con el nuevo, o la rechaza el servidor o —peor— la
           acepta y le mete a un local las ventas de otro. */
        let sin_subir = pendientes(conexion)?;
        if sin_subir > 0 {
            return Err(ErrorCambio::HayPendientes(sin_subir));
        }

        /* Y el turno. Su arqueo todavía no existe y no está en la cola, así
           que la guarda de arriba no lo ve: hay que mirarlo aparte. */
        if let Some(turno) = crate::turnos::activo(conexion)? {
            return Err(ErrorCambio::TurnoAbierto(turno.cajero));
        }
    }

    let tx = conexion.transaction()?;

    /* Lo que queda en el outbox se aparta con su negocio, no se borra.

       Son las rechazadas y el historial de lo ya enviado. Borrarlas dejaría a
       soporte sin nada que mirar el día que alguien pregunte por una venta de
       hace un mes; dejarlas en su sitio las mezclaría con las del negocio
       nuevo.

       **Solo si la caja ya estaba vinculada.** Lo que tenga encolado una que
       nunca se conectó son sus ventas sin conexión, y son del negocio al que
       se está vinculando ahora mismo: archivarlas sería quitárselas antes de
       que lleguen a subir, que es justo lo que la cola existe para evitar. */
    let archivadas = if !vinculada {
        0
    } else {
        let movidas = tx.execute(
            "INSERT INTO outbox_archivado
               (negocio_id, entidad, entidad_id, operacion, payload, intentos, ultimo_error, creado_en, archivado_en)
             SELECT ?1, entidad, entidad_id, operacion, payload, intentos, ultimo_error, creado_en, ?2
               FROM outbox",
            params![if anterior.is_empty() { "desconocido" } else { anterior.as_str() }, ahora],
        )? as i64;
        tx.execute("DELETE FROM outbox", [])?;
        movidas
    };

    /* El catálogo y los cachés. Todo esto vuelve a bajar solo. */
    let productos = tx.execute("DELETE FROM productos", [])? as i64;
    let clientes = tx.execute("DELETE FROM clientes_cache", [])? as i64;
    tx.execute("DELETE FROM recompensas_cache", [])?;

    /* Las marcas de agua **se borran, no se ponen en 1970**.

       `marca_de_agua` devuelve cadena vacía cuando la fila no está, y el
       servidor entiende un `since` vacío como "mándalo todo". Es el mismo
       mecanismo que ya usan las migraciones que agregan columnas al catálogo:
       una sola forma de decir "vuelve a bajarlo entero", no dos. */
    for clave in AJUSTES_DEL_NEGOCIO {
        tx.execute("DELETE FROM ajustes WHERE clave = ?1", [clave])?;
    }

    tx.execute(
        "INSERT INTO ajustes (clave, valor) VALUES (?1, ?2)
         ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
        params![CLAVE, nuevo],
    )?;

    tx.commit()?;

    Ok(Cambio {
        hubo_cambio: true,
        productos_borrados: productos,
        clientes_borrados: clientes,
        outbox_archivado: archivadas,
    })
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use crate::db;

    const AHORA: &str = "2026-09-20T20:00:00-05:00";

    /// Una caja con catálogo bajado. Sin negocio puesto todavía.
    fn con_catalogo() -> Connection {
        let mut c = db::abrir_en_memoria().unwrap();
        sembrar(&mut c);
        c
    }

    /// Una caja ya vinculada a un negocio y con su catálogo bajado.
    ///
    /// El orden importa y es el del mundo real: primero se vincula, después
    /// baja el catálogo. Sembrarlo antes daría una caja con datos de nadie,
    /// que es justo el estado que `cambiar_a` limpia.
    fn con_negocio(id: &str) -> Connection {
        let mut c = db::abrir_en_memoria().unwrap();
        cambiar_a(&mut c, id, AHORA).unwrap();
        /* Una caja vinculada tiene su `nube_url`: la escribe el comando de
           vinculación. Es lo que distingue "cambia de dueño" de "nunca
           estuvo conectada", así que sin esto el helper daría una caja que
           no se parece a ninguna real. */
        c.execute(
            "INSERT INTO ajustes (clave, valor) VALUES ('nube_url', 'https://api.menuby.tech/api')",
            [],
        )
        .unwrap();
        sembrar(&mut c);
        c
    }

    fn sembrar(c: &mut Connection) {
        crate::catalogo::aplicar(
            c,
            &[crate::catalogo::FilaCatalogo {
                id: "p1".into(),
                nombre: "Hamburguesa".into(),
                precio: 18_000,
                categoria: "Platos".into(),
                sku: String::new(),
                variante: String::new(),
                activo: true,
                actualizado: "2026-09-20T10:00:00Z".into(),
                foto: String::new(),
                extras: serde_json::json!([]),
                tipo_impuesto: String::new(),
            }],
        )
        .unwrap();

        crate::clientes::aplicar(
            c,
            &[crate::clientes::FilaCliente {
                id: "c1".into(),
                documento: String::new(),
                tipo_documento: "CC".into(),
                telefono: "3001234567".into(),
                nombre: "Ana".into(),
                puntos: 100,
                saldo_favor: 0,
                estado: "active".into(),
                actualizado: "2026-09-20T10:00:00Z".into(),
            }],
        )
        .unwrap();
    }

    #[test]
    fn una_caja_nueva_no_tiene_negocio() {
        let c = db::abrir_en_memoria().unwrap();
        assert_eq!(id_actual(&c).unwrap(), "");
    }

    #[test]
    fn cambiar_de_negocio_borra_el_catalogo_del_anterior() {
        /* El fallo que este módulo cierra: sin esto la caja se quedaba con los
           productos del local anterior y, como la bajada va por marca de agua,
           el negocio nuevo solo mandaba sus cambios recientes. La carta
           quedaba mezclada y nadie lo notaba hasta cobrar algo que ese local
           no vende. */
        let mut c = con_negocio("negocio-A");

        let cambio = cambiar_a(&mut c, "negocio-B", AHORA).unwrap();

        assert!(cambio.hubo_cambio);
        assert_eq!(cambio.productos_borrados, 1);
        assert_eq!(cambio.clientes_borrados, 1);

        let quedan: i64 = c.query_row("SELECT COUNT(*) FROM productos", [], |f| f.get(0)).unwrap();
        assert_eq!(quedan, 0);
        assert_eq!(id_actual(&c).unwrap(), "negocio-B");
    }

    #[test]
    fn la_marca_de_agua_vuelve_a_cero_para_bajarlo_todo() {
        /* Borrar el catálogo sin soltar la marca de agua sería peor que no
           hacer nada: la caja quedaría vacía y el servidor solo le mandaría
           los cambios posteriores a una fecha que ya pasó. */
        let mut c = con_negocio("negocio-A");
        assert_ne!(crate::catalogo::marca_de_agua(&c).unwrap(), "");

        cambiar_a(&mut c, "negocio-B", AHORA).unwrap();

        assert_eq!(crate::catalogo::marca_de_agua(&c).unwrap(), "");
        assert_eq!(crate::clientes::marca_de_agua(&c).unwrap(), "");
    }

    #[test]
    fn el_nombre_y_los_colores_del_anterior_no_se_quedan() {
        /* Sin esto, la primera tirilla del negocio nuevo sale con el membrete
           del viejo. */
        let mut c = con_catalogo();
        c.execute(
            "INSERT INTO ajustes (clave, valor) VALUES ('negocio_nombre', 'GO BURGER')",
            [],
        )
        .unwrap();
        cambiar_a(&mut c, "negocio-A", AHORA).unwrap();
        cambiar_a(&mut c, "negocio-B", AHORA).unwrap();

        let hay: i64 = c
            .query_row(
                "SELECT COUNT(*) FROM ajustes WHERE clave = 'negocio_nombre'",
                [],
                |f| f.get(0),
            )
            .unwrap();
        assert_eq!(hay, 0);
    }

    #[test]
    fn re_vincular_al_mismo_negocio_no_borra_nada() {
        /* Pasa de verdad: vence el token, o alguien desvincula por error. Que
           eso cueste una bajada entera del catálogo en mitad del servicio
           sería un castigo por un trámite. */
        let mut c = con_negocio("negocio-A");

        let cambio = cambiar_a(&mut c, "negocio-A", AHORA).unwrap();

        assert!(!cambio.hubo_cambio);
        let quedan: i64 = c.query_row("SELECT COUNT(*) FROM productos", [], |f| f.get(0)).unwrap();
        assert_eq!(quedan, 1);
        assert_ne!(crate::catalogo::marca_de_agua(&c).unwrap(), "");
    }

    #[test]
    fn una_caja_nunca_conectada_se_vincula_con_el_turno_abierto() {
        /* El orden natural de una instalación: se pone el PIN, se abre el
           turno con el efectivo de la gaveta, y se conecta después. Ese turno
           no es de ningún negocio anterior porque no hubo ninguno.

           Bloquearlo dejaba la caja en un punto muerto: no se podía vincular
           sin cerrar el turno, y cerrarlo no servía de nada porque el arqueo
           no tenía a dónde subir. */
        let mut c = db::abrir_en_memoria().unwrap();
        crate::turnos::abrir(&c, "u1", "Daniel", crate::dinero::Pesos(100_000), AHORA).unwrap();

        let cambio = cambiar_a(&mut c, "negocio-nuevo", AHORA).unwrap();

        assert!(cambio.hubo_cambio);
        assert_eq!(id_actual(&c).unwrap(), "negocio-nuevo");
        // Y el turno sigue abierto: nadie tiene por qué cerrarlo.
        assert!(crate::turnos::activo(&c).unwrap().is_some());
    }

    #[test]
    fn una_caja_nunca_conectada_sube_lo_que_vendio_sin_conexion() {
        /* Es lo que la pantalla promete antes de vincular: "vende y guarda
           igual, pero nada sube". Esas ventas son del negocio al que está a
           punto de conectarse, así que no pueden impedirle conectarse. */
        let mut c = db::abrir_en_memoria().unwrap();
        c.execute(
            "INSERT INTO outbox (entidad, entidad_id, operacion, payload, creado_en)
             VALUES ('venta', 'v1', 'crear', '{}', ?1)",
            [AHORA],
        )
        .unwrap();

        cambiar_a(&mut c, "negocio-nuevo", AHORA).unwrap();

        // Sigue en la cola, lista para subir con el token del negocio nuevo.
        let quedan: i64 = c
            .query_row("SELECT COUNT(*) FROM outbox", [], |f| f.get(0))
            .unwrap();
        assert_eq!(quedan, 1);
    }

    #[test]
    fn una_caja_que_viene_sin_id_se_limpia_igual() {
        /* Es la caja que venía de una versión anterior a este control. No hay
           forma de saber de qué negocio son sus datos, y la única respuesta
           honesta a "no sé" es volver a bajarlo todo. */
        let mut c = con_catalogo();
        assert_eq!(id_actual(&c).unwrap(), "");

        let cambio = cambiar_a(&mut c, "negocio-A", AHORA).unwrap();

        assert!(cambio.hubo_cambio);
        assert_eq!(cambio.productos_borrados, 1);
    }

    #[test]
    fn con_ventas_sin_subir_no_se_cambia_de_negocio() {
        /* Una venta encolada solo puede subir con el token del negocio que la
           generó. Con el nuevo, o la rechaza el servidor o —peor— la acepta y
           le mete a un local las ventas de otro. */
        let mut c = con_negocio("negocio-A");

        c.execute(
            "INSERT INTO outbox (entidad, entidad_id, operacion, payload, creado_en)
             VALUES ('venta', 'v1', 'crear', '{}', ?1)",
            [AHORA],
        )
        .unwrap();

        match cambiar_a(&mut c, "negocio-B", AHORA) {
            Err(ErrorCambio::HayPendientes(n)) => assert_eq!(n, 1),
            otro => panic!("esperaba HayPendientes, llegó {otro:?}"),
        }

        // Y no tocó nada: la venta sigue ahí y el catálogo también.
        let ventas: i64 = c.query_row("SELECT COUNT(*) FROM outbox", [], |f| f.get(0)).unwrap();
        assert_eq!(ventas, 1);
        assert_eq!(id_actual(&c).unwrap(), "negocio-A");
    }

    #[test]
    fn una_venta_apartada_no_bloquea_el_cambio_para_siempre() {
        /* El servidor ya la rechazó y no va a aceptarla por insistir. Si
           contara, una venta malformada de hace tres meses dejaría la caja
           imposible de re-vincular. */
        let mut c = con_negocio("negocio-A");

        c.execute(
            "INSERT INTO outbox (entidad, entidad_id, operacion, payload, creado_en, apartada)
             VALUES ('venta', 'v1', 'crear', '{}', ?1, 1)",
            [AHORA],
        )
        .unwrap();

        let cambio = cambiar_a(&mut c, "negocio-B", AHORA).unwrap();
        assert!(cambio.hubo_cambio);
        // Pero se guarda con su negocio original, no se pierde.
        assert_eq!(cambio.outbox_archivado, 1);
    }

    #[test]
    fn lo_archivado_conserva_de_que_negocio_era() {
        let mut c = con_negocio("negocio-A");
        c.execute(
            "INSERT INTO outbox (entidad, entidad_id, operacion, payload, creado_en, apartada)
             VALUES ('venta', 'v1', 'crear', '{\"total\":5000}', ?1, 1)",
            [AHORA],
        )
        .unwrap();

        cambiar_a(&mut c, "negocio-B", AHORA).unwrap();

        let (negocio, payload): (String, String) = c
            .query_row(
                "SELECT negocio_id, payload FROM outbox_archivado WHERE entidad_id = 'v1'",
                [],
                |f| Ok((f.get(0)?, f.get(1)?)),
            )
            .unwrap();

        assert_eq!(negocio, "negocio-A");
        assert!(payload.contains("5000"));
    }

    #[test]
    fn las_ventas_y_los_turnos_no_se_tocan() {
        /* Lo replicado se tira porque vuelve a bajar. Lo que la caja generó y
           la nube no tiene —ventas, turnos, arqueos— es la única copia que
           existe, y borrarla sería perder la historia del negocio anterior. */
        let mut c = con_negocio("negocio-A");
        crate::turnos::abrir(&c, "u1", "Ana", crate::dinero::Pesos(100_000), AHORA).unwrap();
        crate::turnos::cerrar(&mut c, crate::dinero::Pesos(100_000), AHORA).unwrap();

        /* Cerrar el turno encola su arqueo, así que hay que darlo por subido
           antes de cambiar: es lo que habría pasado en la caja real tras una
           sincronización, y lo que la guarda de pendientes exige. */
        c.execute("UPDATE outbox SET enviado_en = ?1", [AHORA]).unwrap();

        cambiar_a(&mut c, "negocio-B", AHORA).unwrap();

        let turnos: i64 = c.query_row("SELECT COUNT(*) FROM turnos", [], |f| f.get(0)).unwrap();
        assert_eq!(turnos, 1);
    }

    #[test]
    fn con_un_turno_abierto_no_se_cambia_de_negocio() {
        /* El arqueo de ese turno es del negocio anterior. Dejarlo pasar lo
           subiría al local equivocado al cerrarlo, y la guarda del outbox no
           lo ve porque todavía no está encolado. */
        let mut c = con_negocio("negocio-A");
        crate::turnos::abrir(&c, "u1", "Ana", crate::dinero::Pesos(100_000), AHORA).unwrap();

        match cambiar_a(&mut c, "negocio-B", AHORA) {
            Err(ErrorCambio::TurnoAbierto(quien)) => assert_eq!(quien, "Ana"),
            otro => panic!("esperaba TurnoAbierto, llegó {otro:?}"),
        }

        // Y no tocó nada.
        assert_eq!(id_actual(&c).unwrap(), "negocio-A");
    }

    #[test]
    fn un_id_vacio_no_hace_nada() {
        /* Sin id no se puede decidir. Quedarse como está es lo único que no
           empeora la situación. */
        let mut c = con_negocio("negocio-A");

        let cambio = cambiar_a(&mut c, "   ", AHORA).unwrap();

        assert!(!cambio.hubo_cambio);
        assert_eq!(id_actual(&c).unwrap(), "negocio-A");
    }
}
