//! Qué puede hacer cada quien en la caja.
//!
//! Antes había dos roles fijos —cajero y supervisor— y todo lo sensible pedía
//! el PIN de "un supervisor", cualquiera. No alcanzaba para un negocio real:
//! el cajero de confianza que sí puede hacer devoluciones pero no descuentos,
//! o el mesero que solo marca y no cobra, no tenían dónde caber, y terminaban
//! usando el PIN del dueño —que es justo lo que vuelve inútil la auditoría—.
//!
//! Ahora los roles son **listas de permisos** que el dueño arma en el panel y
//! bajan a cada caja. Una caja que nunca recibió roles del panel usa los de
//! fábrica, que reproducen los dos de antes.
//!
//! La lista de permisos está repetida en el backend (`utils/permisosPos.js`) y
//! en el panel. Una prueba del backend lee este archivo y exige que coincidan:
//! un permiso que el panel ofrece y la caja no conoce sería un interruptor que
//! no hace nada.

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

/// Todos los permisos, con su nombre para la pantalla.
pub const PERMISOS: &[(&str, &str)] = &[
    ("cobrar", "Vender y cobrar"),
    ("turno", "Abrir y cerrar su turno"),
    ("ventas", "Ver las ventas del turno y reimprimir"),
    ("pedidos_web", "Atender pedidos web"),
    ("efectivo", "Registrar entradas y salidas de efectivo"),
    ("gaveta", "Abrir la gaveta sin venta"),
    ("descuento", "Hacer descuentos"),
    ("anular", "Quitar lo que ya fue a cocina"),
    ("devolucion", "Hacer devoluciones"),
    ("descartar", "Descartar ventas en espera"),
    ("precio_libre", "Vender con precio libre"),
    ("agotados", "Marcar productos agotados"),
    ("cortes", "Sacar el corte X y el corte Z"),
    ("configurar", "Configurar la caja (impresoras, datáfono, conexión)"),
];

/// Un rol: un nombre y lo que deja hacer.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Rol {
    pub id: String,
    pub nombre: String,
    #[serde(default)]
    pub permisos: Vec<String>,
}

/// Los roles de fábrica, para una caja que todavía no recibió los del panel.
///
/// El supervisor de fábrica lo puede todo, configurar incluido: en una caja sin
/// panel, el primer usuario —el dueño— es supervisor, y no puede quedarse sin
/// poder configurar su propia impresora.
pub fn de_fabrica() -> Vec<Rol> {
    vec![
        Rol {
            id: "cajero".into(),
            nombre: "Cajero".into(),
            permisos: ["cobrar", "turno", "ventas", "pedidos_web"].iter().map(|s| s.to_string()).collect(),
        },
        Rol {
            id: "supervisor".into(),
            nombre: "Supervisor".into(),
            permisos: PERMISOS.iter().map(|(k, _)| k.to_string()).collect(),
        },
    ]
}

/// Los roles vigentes en esta caja: los del panel si llegaron, si no los de
/// fábrica. Un permiso que la caja no conoce se ignora.
pub fn roles(conexion: &Connection) -> Vec<Rol> {
    let guardado: Option<String> = conexion
        .query_row("SELECT valor FROM ajustes WHERE clave = 'roles_personal'", [], |f| f.get(0))
        .optional()
        .ok()
        .flatten();
    let del_panel: Vec<Rol> = guardado
        .and_then(|j| serde_json::from_str(&j).ok())
        .unwrap_or_default();
    if del_panel.is_empty() {
        return de_fabrica();
    }
    del_panel
        .into_iter()
        .map(|mut r| {
            r.permisos.retain(|p| PERMISOS.iter().any(|(k, _)| k == p));
            r
        })
        .collect()
}

/// El rol de un usuario por su id. Un rol que ya no existe no da permisos:
/// ante la duda, el de menos.
pub fn rol(conexion: &Connection, id: &str) -> Rol {
    roles(conexion)
        .into_iter()
        .find(|r| r.id == id)
        .unwrap_or_else(|| Rol { id: id.to_string(), nombre: "Sin rol".into(), permisos: vec![] })
}

/// Guarda los roles que bajaron del panel.
pub fn guardar_roles(conexion: &Connection, roles: &[Rol]) -> rusqlite::Result<()> {
    let json = serde_json::to_string(roles).unwrap_or_else(|_| "[]".into());
    conexion.execute(
        "INSERT INTO ajustes (clave, valor) VALUES ('roles_personal', ?1)
         ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
        [json],
    )?;
    Ok(())
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use crate::db;

    #[test]
    fn sin_panel_valen_los_de_fabrica() {
        let c = db::abrir_en_memoria().unwrap();
        let r = rol(&c, "cajero");
        assert!(r.permisos.contains(&"cobrar".to_string()));
        assert!(!r.permisos.contains(&"descuento".to_string()));
        assert!(rol(&c, "supervisor").permisos.contains(&"configurar".to_string()));
    }

    #[test]
    fn los_del_panel_reemplazan_a_los_de_fabrica() {
        let c = db::abrir_en_memoria().unwrap();
        guardar_roles(&c, &[Rol { id: "r1".into(), nombre: "Cajero de confianza".into(), permisos: vec!["cobrar".into(), "devolucion".into()] }]).unwrap();
        let r = rol(&c, "r1");
        assert_eq!(r.nombre, "Cajero de confianza");
        assert!(r.permisos.contains(&"devolucion".to_string()));
        // El de fábrica ya no existe: sin rol, sin permisos.
        assert!(rol(&c, "supervisor").permisos.is_empty());
    }

    #[test]
    fn un_permiso_que_la_caja_no_conoce_se_ignora() {
        let c = db::abrir_en_memoria().unwrap();
        guardar_roles(&c, &[Rol { id: "r".into(), nombre: "X".into(), permisos: vec!["cobrar".into(), "borrar_todo".into()] }]).unwrap();
        assert_eq!(rol(&c, "r").permisos, vec!["cobrar".to_string()]);
    }
}
