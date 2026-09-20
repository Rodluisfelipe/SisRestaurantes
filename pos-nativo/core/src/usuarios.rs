//! Quién está en la caja.
//!
//! Un PIN de cuatro dígitos son diez mil combinaciones: cualquier hash se
//! rompe por fuerza bruta en segundos si alguien se lleva el archivo. Eso no
//! quiere decir que guardarlo en claro dé igual — lo que protege el hash es del
//! caso real y frecuente: alguien con acceso al equipo abriendo la base con un
//! visor de SQLite y viendo el PIN del dueño en pantalla.
//!
//! La defensa de verdad es la otra: **frenar los intentos**. Tras cinco fallos
//! seguidos la caja se bloquea un minuto, y probar diez mil PINes a un minuto
//! por cada cinco deja de ser un ataque y pasa a ser una tarde perdida.
//!
//! Dos roles y nada más, porque un POS con doce permisos termina con todos los
//! cajeros usando el usuario del dueño:
//!
//! - **Cajero**: vende, y pide su propio arqueo.
//! - **Supervisor**: además anula, abre el cajón sin venta y cierra turnos
//!   ajenos.

use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use rand_core::OsRng;
use argon2::Argon2;
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Rol {
    Cajero,
    Supervisor,
}

impl Rol {
    pub fn como_texto(&self) -> &'static str {
        match self {
            Rol::Cajero => "cajero",
            Rol::Supervisor => "supervisor",
        }
    }

    fn desde(texto: &str) -> Rol {
        // Ante cualquier cosa rara, el rol de menos permisos.
        if texto == "supervisor" { Rol::Supervisor } else { Rol::Cajero }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usuario {
    pub id: String,
    pub nombre: String,
    pub rol: Rol,
}

#[derive(Debug, PartialEq, Eq)]
pub enum ErrorAcceso {
    PinInvalido,
    /// Demasiados intentos. Trae cuántos segundos faltan, para poder decírselo
    /// al cajero en vez de dejarlo probando contra una pared.
    Bloqueado(i64),
    Base(String),
}

impl std::fmt::Display for ErrorAcceso {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ErrorAcceso::PinInvalido => write!(f, "PIN incorrecto"),
            ErrorAcceso::Bloqueado(s) => write!(f, "Demasiados intentos. Espera {s} segundos"),
            ErrorAcceso::Base(e) => write!(f, "No se pudo verificar el PIN: {e}"),
        }
    }
}

impl From<rusqlite::Error> for ErrorAcceso {
    fn from(e: rusqlite::Error) -> Self {
        ErrorAcceso::Base(e.to_string())
    }
}

const FALLOS_ANTES_DE_BLOQUEAR: i64 = 5;
const SEGUNDOS_BLOQUEADO: i64 = 60;

/// Crea (o actualiza) un usuario de la caja.
pub fn guardar(
    conexion: &Connection,
    nombre: &str,
    pin: &str,
    rol: Rol,
) -> Result<Usuario, ErrorAcceso> {
    if pin.len() < 4 || !pin.chars().all(|c| c.is_ascii_digit()) {
        return Err(ErrorAcceso::PinInvalido);
    }

    let sal = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(pin.as_bytes(), &sal)
        .map_err(|e| ErrorAcceso::Base(e.to_string()))?
        .to_string();

    let id = Uuid::now_v7().to_string();
    conexion.execute(
        "INSERT INTO usuarios (id, nombre, rol, pin_hash, activo) VALUES (?1, ?2, ?3, ?4, 1)",
        params![id, nombre.trim(), rol.como_texto(), hash],
    )?;

    Ok(Usuario { id, nombre: nombre.trim().to_string(), rol })
}

/// Verifica un PIN contra los usuarios activos.
///
/// No se pregunta primero "¿quién eres?": el cajero digita cuatro números y
/// listo. Con menos de diez usuarios, comparar contra todos cuesta
/// milisegundos y ahorra un paso en una pantalla donde cada segundo se nota.
pub fn entrar(conexion: &Connection, pin: &str, ahora_epoch: i64) -> Result<Usuario, ErrorAcceso> {
    if let Some(restan) = bloqueo_restante(conexion, ahora_epoch)? {
        return Err(ErrorAcceso::Bloqueado(restan));
    }

    let mut consulta = conexion.prepare("SELECT id, nombre, rol, pin_hash FROM usuarios WHERE activo = 1")?;
    let filas = consulta.query_map([], |f| {
        Ok((
            f.get::<_, String>(0)?,
            f.get::<_, String>(1)?,
            f.get::<_, String>(2)?,
            f.get::<_, String>(3)?,
        ))
    })?;

    for fila in filas {
        let (id, nombre, rol, hash) = fila?;
        let Ok(guardado) = PasswordHash::new(&hash) else { continue };

        if Argon2::default().verify_password(pin.as_bytes(), &guardado).is_ok() {
            limpiar_fallos(conexion)?;
            return Ok(Usuario { id, nombre, rol: Rol::desde(&rol) });
        }
    }

    anotar_fallo(conexion, ahora_epoch)?;
    Err(ErrorAcceso::PinInvalido)
}

/// Cuántos segundos faltan para poder volver a intentar, si está bloqueado.
fn bloqueo_restante(conexion: &Connection, ahora_epoch: i64) -> Result<Option<i64>, ErrorAcceso> {
    let fallos: i64 = leer_numero(conexion, "pin_fallos")?;
    if fallos < FALLOS_ANTES_DE_BLOQUEAR {
        return Ok(None);
    }
    let ultimo: i64 = leer_numero(conexion, "pin_ultimo_fallo")?;
    let restan = SEGUNDOS_BLOQUEADO - (ahora_epoch - ultimo);
    Ok(if restan > 0 { Some(restan) } else { None })
}

fn anotar_fallo(conexion: &Connection, ahora_epoch: i64) -> Result<(), ErrorAcceso> {
    let fallos = leer_numero(conexion, "pin_fallos")?;
    /* Si el bloqueo anterior ya venció, la cuenta arranca de cero: si no, el
       sexto intento de la mañana quedaría bloqueado por cinco fallos de ayer. */
    let ultimo = leer_numero(conexion, "pin_ultimo_fallo")?;
    let vencido = ahora_epoch - ultimo > SEGUNDOS_BLOQUEADO;
    let nuevos = if vencido { 1 } else { fallos + 1 };

    escribir(conexion, "pin_fallos", &nuevos.to_string())?;
    escribir(conexion, "pin_ultimo_fallo", &ahora_epoch.to_string())?;
    Ok(())
}

fn limpiar_fallos(conexion: &Connection) -> Result<(), ErrorAcceso> {
    escribir(conexion, "pin_fallos", "0")
}

fn leer_numero(conexion: &Connection, clave: &str) -> Result<i64, ErrorAcceso> {
    let texto: String = conexion
        .query_row("SELECT valor FROM ajustes WHERE clave = ?1", [clave], |f| f.get(0))
        .unwrap_or_default();
    Ok(texto.parse().unwrap_or(0))
}

fn escribir(conexion: &Connection, clave: &str, valor: &str) -> Result<(), ErrorAcceso> {
    conexion.execute(
        "INSERT INTO ajustes (clave, valor) VALUES (?1, ?2)
         ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
        params![clave, valor],
    )?;
    Ok(())
}

/// Los usuarios de la caja, para la pantalla de configuración.
pub fn listar(conexion: &Connection) -> Result<Vec<Usuario>> {
    let mut consulta = conexion.prepare("SELECT id, nombre, rol FROM usuarios WHERE activo = 1 ORDER BY nombre")?;
    let filas = consulta.query_map([], |f| {
        Ok(Usuario {
            id: f.get(0)?,
            nombre: f.get(1)?,
            rol: Rol::desde(&f.get::<_, String>(2)?),
        })
    })?;
    filas.collect()
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use crate::db;

    fn con_usuarios() -> Connection {
        let c = db::abrir_en_memoria().unwrap();
        guardar(&c, "Ana", "1234", Rol::Cajero).unwrap();
        guardar(&c, "Felipe", "9999", Rol::Supervisor).unwrap();
        c
    }

    #[test]
    fn el_pin_no_se_guarda_en_claro() {
        // Lo que protege del caso real: alguien abriendo la base con un visor.
        let c = con_usuarios();
        let hash: String = c
            .query_row("SELECT pin_hash FROM usuarios WHERE nombre = 'Ana'", [], |f| f.get(0))
            .unwrap();
        assert!(!hash.contains("1234"));
        assert!(hash.starts_with("$argon2"));
    }

    #[test]
    fn dos_usuarios_con_el_mismo_pin_no_comparten_hash() {
        // Sin sal por usuario, ver dos hashes iguales delataría el PIN repetido.
        let c = db::abrir_en_memoria().unwrap();
        guardar(&c, "A", "1111", Rol::Cajero).unwrap();
        guardar(&c, "B", "1111", Rol::Cajero).unwrap();

        let mut q = c.prepare("SELECT pin_hash FROM usuarios ORDER BY nombre").unwrap();
        let hashes: Vec<String> = q.query_map([], |f| f.get(0)).unwrap().map(|r| r.unwrap()).collect();
        assert_ne!(hashes[0], hashes[1]);
    }

    #[test]
    fn entra_con_su_pin_y_trae_su_rol() {
        let c = con_usuarios();
        assert_eq!(entrar(&c, "1234", 1_000).unwrap().nombre, "Ana");
        assert_eq!(entrar(&c, "9999", 1_000).unwrap().rol, Rol::Supervisor);
    }

    #[test]
    fn un_pin_que_no_es_de_nadie_no_entra() {
        let c = con_usuarios();
        assert!(matches!(entrar(&c, "0000", 1_000), Err(ErrorAcceso::PinInvalido)));
    }

    #[test]
    fn a_los_cinco_fallos_se_bloquea_un_minuto() {
        // Es lo que convierte diez mil combinaciones en una tarde perdida.
        let c = con_usuarios();
        for _ in 0..5 {
            let _ = entrar(&c, "0000", 1_000);
        }
        assert!(matches!(entrar(&c, "1234", 1_010), Err(ErrorAcceso::Bloqueado(_))));

        // Pasado el minuto, el PIN correcto entra.
        assert_eq!(entrar(&c, "1234", 1_070).unwrap().nombre, "Ana");
    }

    #[test]
    fn un_acierto_borra_la_cuenta_de_fallos() {
        let c = con_usuarios();
        for _ in 0..4 {
            let _ = entrar(&c, "0000", 1_000);
        }
        entrar(&c, "1234", 1_000).unwrap();

        // Cuatro fallos más no deberían bloquear: la cuenta arrancó de cero.
        for _ in 0..4 {
            let _ = entrar(&c, "0000", 1_001);
        }
        assert!(entrar(&c, "1234", 1_002).is_ok());
    }

    #[test]
    fn los_fallos_viejos_no_bloquean_la_manana_siguiente() {
        let c = con_usuarios();
        for _ in 0..5 {
            let _ = entrar(&c, "0000", 1_000);
        }
        // Al otro día, el primer fallo no arrastra los de ayer.
        let _ = entrar(&c, "0000", 100_000);
        assert!(entrar(&c, "1234", 100_001).is_ok());
    }

    #[test]
    fn un_pin_corto_o_con_letras_no_se_acepta() {
        let c = db::abrir_en_memoria().unwrap();
        assert!(guardar(&c, "X", "12", Rol::Cajero).is_err());
        assert!(guardar(&c, "X", "abcd", Rol::Cajero).is_err());
    }
}
