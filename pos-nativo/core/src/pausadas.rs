//! Ventas en espera.
//!
//! El caso es siempre el mismo: el cliente se acordó de que le falta algo, o
//! está buscando la plata, y detrás hay cuatro personas. La venta se aparta, se
//! cobra a los siguientes y se retoma cuando vuelva.
//!
//! No es una venta: es un carrito guardado. No tiene consecutivo, no toca el
//! inventario y **no entra a la cola de sincronización** — a la nube solo le
//! importa lo que se cobró. Si la caja se apaga con tres ventas en espera, al
//! volver siguen ahí, porque están en disco y no en la memoria del webview.
//!
//! Van atadas al turno: al cerrar hay que avisar si quedan sueltas. Una venta
//! en espera del turno de la mañana que aparece a las nueve de la noche ya no
//! la reclama nadie.

use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnEspera {
    pub id: String,
    pub turno_id: String,
    /// Para que el cajero la reconozca de un vistazo en la lista.
    pub etiqueta: String,
    pub total: i64,
    pub items: i64,
    pub creada_en: String,
    /// El carrito completo, tal como estaba.
    pub carrito: String,
}

/// Aparta el carrito y devuelve la ficha para la lista.
pub fn pausar(
    conexion: &Connection,
    turno_id: &str,
    carrito_json: &str,
    etiqueta: &str,
    total: i64,
    items: i64,
    ahora: &str,
) -> Result<EnEspera> {
    let ficha = EnEspera {
        id: Uuid::now_v7().to_string(),
        turno_id: turno_id.to_string(),
        etiqueta: etiqueta.to_string(),
        total,
        items,
        creada_en: ahora.to_string(),
        carrito: carrito_json.to_string(),
    };

    conexion.execute(
        "INSERT INTO ventas_pausadas (id, turno_id, etiqueta, total, items, carrito, creada_en)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![ficha.id, turno_id, etiqueta, total, items, carrito_json, ahora],
    )?;

    Ok(ficha)
}

/// Las que están esperando en este turno, la más vieja primero.
///
/// El orden no es casual: la que lleva más tiempo esperando es la que más
/// urge, y la que el cajero va a tener que salir a buscar.
pub fn listar(conexion: &Connection, turno_id: &str) -> Result<Vec<EnEspera>> {
    let mut consulta = conexion.prepare(
        "SELECT id, turno_id, etiqueta, total, items, carrito, creada_en
         FROM ventas_pausadas WHERE turno_id = ?1 ORDER BY creada_en",
    )?;
    let filas = consulta.query_map([turno_id], |f| {
        Ok(EnEspera {
            id: f.get(0)?,
            turno_id: f.get(1)?,
            etiqueta: f.get(2)?,
            total: f.get(3)?,
            items: f.get(4)?,
            carrito: f.get(5)?,
            creada_en: f.get(6)?,
        })
    })?;
    filas.collect()
}

/// Saca la venta de la lista y devuelve su carrito.
///
/// Retomar **borra**: si se quedara, el cajero podría cobrar dos veces el mismo
/// carrito sin darse cuenta, y con el cliente ya afuera nadie lo descubriría.
pub fn retomar(conexion: &Connection, id: &str) -> Result<Option<String>> {
    let carrito: Option<String> = conexion
        .query_row("SELECT carrito FROM ventas_pausadas WHERE id = ?1", [id], |f| f.get(0))
        .ok();

    if carrito.is_some() {
        conexion.execute("DELETE FROM ventas_pausadas WHERE id = ?1", [id])?;
    }

    Ok(carrito)
}

/// Descarta una venta en espera que ya nadie va a reclamar.
pub fn descartar(conexion: &Connection, id: &str) -> Result<()> {
    conexion.execute("DELETE FROM ventas_pausadas WHERE id = ?1", [id])?;
    Ok(())
}

/// Cuántas ventas de mostrador quedan apartadas. El cierre no deja cerrar
/// con ninguna.
///
/// **No cuenta las mesas abiertas**, y la diferencia es el día y la noche de
/// un restaurante: a las seis de la tarde hay seis mesas comiendo y el cajero
/// del turno diurno tiene que poder irse a su casa. Una venta apartada de
/// mostrador sí es un carrito que nadie va a reclamar; una mesa con gente
/// sentada no.
///
/// Las mesas pasan al turno siguiente con [`crate::cuentas::traspasar`], y su
/// venta se le imputa al turno que **cobra** la plata, que es el que la tiene
/// en la gaveta.
pub fn cuantas(conexion: &Connection, turno_id: &str) -> Result<i64> {
    conexion.query_row(
        "SELECT COUNT(*) FROM ventas_pausadas WHERE turno_id = ?1 AND identificador = ''",
        [turno_id],
        |f| f.get(0),
    )
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use crate::db;

    fn caja() -> Connection {
        db::abrir_en_memoria().unwrap()
    }

    #[test]
    fn una_venta_apartada_sobrevive_al_apagon() {
        // Está en disco, no en la memoria del webview.
        let c = caja();
        pausar(&c, "t1", r#"[{"nombre":"Café"}]"#, "Café +2", 15_000, 3, "2026-09-20T10:00:00-05:00").unwrap();

        let lista = listar(&c, "t1").unwrap();
        assert_eq!(lista.len(), 1);
        assert_eq!(lista[0].total, 15_000);
        assert_eq!(lista[0].items, 3);
    }

    #[test]
    fn la_mas_vieja_sale_primero() {
        // Es la que más urge y la que el cajero va a tener que salir a buscar.
        let c = caja();
        pausar(&c, "t1", "[]", "primera", 1_000, 1, "2026-09-20T10:00:00-05:00").unwrap();
        pausar(&c, "t1", "[]", "segunda", 2_000, 1, "2026-09-20T11:00:00-05:00").unwrap();

        let lista = listar(&c, "t1").unwrap();
        assert_eq!(lista[0].etiqueta, "primera");
    }

    #[test]
    fn retomar_la_saca_de_la_lista() {
        /* Si se quedara, el cajero podría cobrar dos veces el mismo carrito y,
           con el cliente ya afuera, nadie lo descubriría. */
        let c = caja();
        let ficha = pausar(&c, "t1", r#"[{"x":1}]"#, "x", 1_000, 1, "2026-09-20T10:00:00-05:00").unwrap();

        assert_eq!(retomar(&c, &ficha.id).unwrap().as_deref(), Some(r#"[{"x":1}]"#));
        assert_eq!(listar(&c, "t1").unwrap().len(), 0);
        assert_eq!(retomar(&c, &ficha.id).unwrap(), None, "no se retoma dos veces");
    }

    #[test]
    fn cada_turno_ve_solo_las_suyas() {
        // Una venta en espera de la mañana no la reclama nadie a las nueve.
        let c = caja();
        pausar(&c, "t1", "[]", "mañana", 1_000, 1, "2026-09-20T10:00:00-05:00").unwrap();
        pausar(&c, "t2", "[]", "noche", 2_000, 1, "2026-09-20T20:00:00-05:00").unwrap();

        assert_eq!(listar(&c, "t1").unwrap().len(), 1);
        assert_eq!(cuantas(&c, "t2").unwrap(), 1);
    }

    #[test]
    fn descartar_la_borra_sin_cobrarla() {
        let c = caja();
        let ficha = pausar(&c, "t1", "[]", "x", 1_000, 1, "2026-09-20T10:00:00-05:00").unwrap();
        descartar(&c, &ficha.id).unwrap();
        assert_eq!(cuantas(&c, "t1").unwrap(), 0);
    }

    #[test]
    fn las_pausadas_no_entran_a_la_cola_de_la_nube() {
        // A la nube solo le importa lo que se cobró.
        let c = caja();
        pausar(&c, "t1", "[]", "x", 1_000, 1, "2026-09-20T10:00:00-05:00").unwrap();
        let encoladas: i64 = c.query_row("SELECT COUNT(*) FROM outbox", [], |f| f.get(0)).unwrap();
        assert_eq!(encoladas, 0);
    }
}
