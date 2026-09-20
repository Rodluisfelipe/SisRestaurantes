//! El token del negocio, fuera de la base.
//!
//! Hasta ahora vivía en la tabla `ajustes` de SQLite, en claro. Eso significa
//! que cualquiera con acceso al equipo —o al respaldo del equipo, o al disco
//! que se llevaron a reparar— podía abrir el archivo con un visor de SQLite y
//! leerse la credencial del negocio entera.
//!
//! Ahora vive donde el sistema operativo guarda ese tipo de cosas:
//!
//! - **Windows**: Credential Manager, cifrado con DPAPI contra la cuenta de
//!   usuario. Otro usuario del mismo equipo no puede leerlo.
//! - **Linux**: Secret Service (GNOME Keyring / KWallet) por DBus.
//! - **macOS**: el llavero.
//!
//! La migración es automática y de una sola vía: al arrancar, si queda un
//! token en SQLite se mueve al llavero y **se borra de la base**. Un token que
//! se migra pero se queda de copia no migró nada.

use keyring::Entry;
use rusqlite::Connection;

/// Cómo se identifica la credencial dentro del llavero.
const SERVICIO: &str = "tech.menuby.pos";
const CUENTA: &str = "token-negocio";

/// La clave con la que se guardaba antes en SQLite. Se conserva solo para
/// poder migrarla y limpiarla; nada nuevo la escribe.
const CLAVE_VIEJA: &str = "nube_token";

fn entrada() -> Result<Entry, String> {
    Entry::new(SERVICIO, CUENTA).map_err(|e| format!("No se pudo abrir el llavero del sistema: {e}"))
}

pub fn guardar(token: &str) -> Result<(), String> {
    entrada()?
        .set_password(token)
        .map_err(|e| format!("No se pudo guardar la credencial: {e}"))
}

/// Devuelve el token, o `None` si esta caja todavía no está conectada.
///
/// Un llavero que no responde —una sesión de Linux sin agente de secretos, por
/// ejemplo— se trata como "no hay token": la caja sigue vendiendo y guardando
/// en su cola, que es lo que no puede fallar. Lo que no hace es inventarse una
/// credencial ni caerse al arrancar.
pub fn leer() -> Option<String> {
    match entrada().ok()?.get_password() {
        Ok(token) if !token.is_empty() => Some(token),
        _ => None,
    }
}

pub fn borrar() -> Result<(), String> {
    match entrada()?.delete_credential() {
        Ok(()) => Ok(()),
        // Borrar lo que ya no está es el resultado que se quería.
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("No se pudo borrar la credencial: {e}")),
    }
}

/// Mueve al llavero el token que haya quedado en SQLite y lo borra de ahí.
///
/// Se llama en cada arranque. Es idempotente: si no hay nada que migrar, no
/// hace nada. Devuelve `true` solo cuando de verdad movió algo, para poder
/// dejarlo en el log una única vez.
pub fn migrar_desde_sqlite(base: &Connection) -> bool {
    let viejo: String = base
        .query_row("SELECT valor FROM ajustes WHERE clave = ?1", [CLAVE_VIEJA], |f| f.get(0))
        .unwrap_or_default();

    if viejo.is_empty() {
        return false;
    }

    /* Primero se guarda en el llavero y solo si eso funcionó se borra de la
       base. Al revés, un llavero inaccesible dejaría la caja sin credencial y
       sin forma de recuperarla: habría que volver a emparejarla a mano. */
    if guardar(&viejo).is_err() {
        return false;
    }

    let _ = base.execute("DELETE FROM ajustes WHERE clave = ?1", [CLAVE_VIEJA]);
    true
}

#[cfg(test)]
mod pruebas {
    use super::*;

    /* El llavero real no se toca en las pruebas: escribirlo ensuciaría el
       Credential Manager de quien corra `cargo test` y, en CI, ni siquiera
       existe. Lo que sí se prueba es la parte que decide, que es donde está el
       riesgo: que la migración no borre nada cuando no hay qué migrar. */

    fn base_con(clave: &str, valor: &str) -> Connection {
        let c = pos_core::db::abrir_en_memoria().unwrap();
        c.execute("INSERT INTO ajustes (clave, valor) VALUES (?1, ?2)", [clave, valor]).unwrap();
        c
    }

    #[test]
    fn sin_token_viejo_no_migra_nada() {
        let c = pos_core::db::abrir_en_memoria().unwrap();
        assert!(!migrar_desde_sqlite(&c));
    }

    #[test]
    fn un_token_vacio_no_cuenta_como_token() {
        // Es lo que queda cuando alguien "borró" el token dejando la fila.
        let c = base_con(CLAVE_VIEJA, "");
        assert!(!migrar_desde_sqlite(&c));
    }

    #[test]
    fn la_url_no_se_toca() {
        /* Solo el token es secreto. La URL de la nube se queda en SQLite: es
           configuración, no credencial, y moverla al llavero solo complicaría
           el diagnóstico cuando una caja apunte a donde no debe. */
        let c = base_con("nube_url", "https://api.menuby.tech/api");
        migrar_desde_sqlite(&c);

        let url: String = c
            .query_row("SELECT valor FROM ajustes WHERE clave = 'nube_url'", [], |f| f.get(0))
            .unwrap();
        assert_eq!(url, "https://api.menuby.tech/api");
    }
}
