//! El registro de excepciones.
//!
//! Anular una línea ya marcada y aplicar un descuento a mano son las dos
//! operaciones por donde se va la plata en un mostrador, y las dos son
//! legítimas: el cliente cambió de opinión, el producto salió mal, el dueño
//! autorizó una cortesía. Lo que las vuelve un problema no es que ocurran, es
//! que ocurran **sin dejar rastro**.
//!
//! Por eso aquí cada una queda con las tres cosas que permiten mirarla después:
//! **quién estaba en la caja**, **quién la autorizó** y **por qué**. Un patrón
//! como "el cajero A anuló ocho cafés el martes, todos autorizados por el
//! supervisor B a las tres de la tarde" solo se ve si esos tres datos están.
//!
//! El registro es de solo agregar: no hay función para borrar ni editar. Un log
//! de excepciones que se puede limpiar no sirve para nada, y la tentación de
//! "limpiar el ruido" aparece siempre.

use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TipoExcepcion {
    /// Se quitó una línea que ya estaba marcada.
    AnularItem,
    /// Descuento puesto a mano sobre el total o sobre una línea.
    Descuento,
    /// Se abrió el cajón sin que hubiera una venta detrás.
    AbrirCajon,
    /// Se descartó una venta en espera sin cobrarla.
    DescartarPausada,
}

impl TipoExcepcion {
    fn como_texto(&self) -> &'static str {
        match self {
            TipoExcepcion::AnularItem => "anular_item",
            TipoExcepcion::Descuento => "descuento",
            TipoExcepcion::AbrirCajon => "abrir_cajon",
            TipoExcepcion::DescartarPausada => "descartar_pausada",
        }
    }

    /// ¿Necesita que un supervisor ponga su PIN?
    ///
    /// Abrir el cajón queda registrado pero no se pide autorización: en plena
    /// hora pico, pedir un supervisor para dar un cambio paraliza la fila, y el
    /// registro ya deja ver quién lo abre de más.
    pub fn requiere_supervisor(&self) -> bool {
        matches!(self, TipoExcepcion::AnularItem | TipoExcepcion::Descuento)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Excepcion {
    pub id: String,
    pub turno_id: String,
    pub tipo: TipoExcepcion,
    /// Qué se anuló o sobre qué se aplicó el descuento.
    pub detalle: String,
    pub monto: i64,
    pub motivo: String,
    /// Quién tenía la caja.
    pub cajero: String,
    /// Quién lo autorizó con su PIN. Vacío en lo que no requiere autorización.
    pub autorizo: String,
    pub creada_en: String,
}

/// Deja constancia y la encola para el dueño.
///
/// Va a la misma cola que las ventas: el dueño tiene que poder ver las
/// anulaciones del martes aunque esa caja no haya tenido internet hasta el
/// jueves. Y se escribe en una sola transacción con el encolado, por lo mismo
/// que las ventas: una excepción registrada que nunca sube es una excepción que
/// nadie va a mirar.
pub fn registrar(
    conexion: &mut Connection,
    turno_id: &str,
    tipo: TipoExcepcion,
    detalle: &str,
    monto: i64,
    motivo: &str,
    cajero: &str,
    autorizo: &str,
    ahora: &str,
) -> Result<Excepcion> {
    let e = Excepcion {
        id: Uuid::now_v7().to_string(),
        turno_id: turno_id.to_string(),
        tipo,
        detalle: detalle.chars().take(200).collect(),
        monto,
        motivo: motivo.trim().chars().take(200).collect(),
        cajero: cajero.to_string(),
        autorizo: autorizo.to_string(),
        creada_en: ahora.to_string(),
    };

    let tx = conexion.transaction()?;

    tx.execute(
        "INSERT INTO auditoria_operaciones
           (id, turno_id, tipo, detalle, monto, motivo, cajero, autorizo, creada_en)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            e.id, e.turno_id, tipo.como_texto(), e.detalle, e.monto,
            e.motivo, e.cajero, e.autorizo, e.creada_en
        ],
    )?;

    let payload = serde_json::to_string(&e).unwrap_or_default();
    tx.execute(
        "INSERT INTO outbox (entidad, entidad_id, operacion, payload, creado_en)
         VALUES ('excepcion', ?1, 'crear', ?2, ?3)",
        params![e.id, payload, ahora],
    )?;

    tx.commit()?;
    Ok(e)
}

/// Lo ocurrido en un turno, lo último primero. Para la pantalla del supervisor.
pub fn del_turno(conexion: &Connection, turno_id: &str) -> Result<Vec<Excepcion>> {
    let mut consulta = conexion.prepare(
        "SELECT id, turno_id, tipo, detalle, monto, motivo, cajero, autorizo, creada_en
         FROM auditoria_operaciones WHERE turno_id = ?1 ORDER BY creada_en DESC LIMIT 200",
    )?;

    let filas = consulta.query_map([turno_id], |f| {
        let tipo: String = f.get(2)?;
        Ok(Excepcion {
            id: f.get(0)?,
            turno_id: f.get(1)?,
            tipo: match tipo.as_str() {
                "descuento" => TipoExcepcion::Descuento,
                "abrir_cajon" => TipoExcepcion::AbrirCajon,
                "descartar_pausada" => TipoExcepcion::DescartarPausada,
                _ => TipoExcepcion::AnularItem,
            },
            detalle: f.get(3)?,
            monto: f.get(4)?,
            motivo: f.get(5)?,
            cajero: f.get(6)?,
            autorizo: f.get(7)?,
            creada_en: f.get(8)?,
        })
    })?;

    filas.collect()
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use crate::db;

    const AHORA: &str = "2026-09-20T15:00:00-05:00";

    #[test]
    fn una_anulacion_deja_quien_quien_y_por_que() {
        // Sin los tres datos, el patrón de robo hormiga es invisible.
        let mut c = db::abrir_en_memoria().unwrap();
        let e = registrar(
            &mut c, "t1", TipoExcepcion::AnularItem, "Café x2", 10_000,
            "el cliente se arrepintió", "Ana", "Felipe", AHORA,
        ).unwrap();

        assert_eq!(e.cajero, "Ana");
        assert_eq!(e.autorizo, "Felipe");
        assert_eq!(e.motivo, "el cliente se arrepintió");
    }

    #[test]
    fn la_excepcion_sube_con_las_ventas() {
        /* El dueño tiene que ver las anulaciones del martes aunque la caja no
           haya tenido internet hasta el jueves. */
        let mut c = db::abrir_en_memoria().unwrap();
        registrar(&mut c, "t1", TipoExcepcion::Descuento, "Total", 5_000, "cortesía", "Ana", "Felipe", AHORA).unwrap();

        let (entidad, payload): (String, String) = c
            .query_row("SELECT entidad, payload FROM outbox LIMIT 1", [], |f| Ok((f.get(0)?, f.get(1)?)))
            .unwrap();

        assert_eq!(entidad, "excepcion");
        let json: serde_json::Value = serde_json::from_str(&payload).unwrap();
        assert_eq!(json["tipo"], "descuento");
        assert_eq!(json["autorizo"], "Felipe");
    }

    #[test]
    fn anular_y_descontar_piden_supervisor_abrir_el_cajon_no() {
        // Pedir un supervisor para dar un cambio paraliza la fila en hora pico.
        assert!(TipoExcepcion::AnularItem.requiere_supervisor());
        assert!(TipoExcepcion::Descuento.requiere_supervisor());
        assert!(!TipoExcepcion::AbrirCajon.requiere_supervisor());
    }

    #[test]
    fn el_registro_es_de_solo_agregar() {
        /* No hay función para borrar ni editar: un log de excepciones que se
           puede limpiar no sirve de nada, y la tentación aparece siempre. */
        // Solo el código, no estas mismas pruebas, que nombran lo que vigilan.
        const CODIGO: &str = include_str!("auditoria.rs");
        let sin_pruebas = CODIGO.split("#[cfg(test)]").next().unwrap();
        assert!(!sin_pruebas.contains("DELETE FROM auditoria"));
        assert!(!sin_pruebas.contains("UPDATE auditoria"));
    }

    #[test]
    fn se_puede_revisar_lo_del_turno() {
        let mut c = db::abrir_en_memoria().unwrap();
        registrar(&mut c, "t1", TipoExcepcion::AnularItem, "Café", 5_000, "mal servido", "Ana", "Felipe", "2026-09-20T10:00:00-05:00").unwrap();
        registrar(&mut c, "t1", TipoExcepcion::AnularItem, "Pan", 2_000, "quemado", "Ana", "Felipe", "2026-09-20T11:00:00-05:00").unwrap();
        registrar(&mut c, "t2", TipoExcepcion::AnularItem, "Otro turno", 1_000, "x", "Beto", "Felipe", AHORA).unwrap();

        let lista = del_turno(&c, "t1").unwrap();
        assert_eq!(lista.len(), 2);
        assert_eq!(lista[0].detalle, "Pan", "lo último, primero");
    }
}
