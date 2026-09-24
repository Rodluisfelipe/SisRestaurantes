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
//! Qué puede hacer cada usuario lo dice su rol, y los roles son listas de
//! permisos (ver `permisos`). Los dos de fábrica —cajero y supervisor— siguen
//! existiendo para las cajas que no reciben personal del panel.
//!
//! Los usuarios pueden nacer en la caja (el dueño, la primera vez) o bajar del
//! panel. Los del panel traen el PIN en bcrypt, que es lo que usa el backend;
//! los de la caja, en Argon2. Aquí se verifican los dos.

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

}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usuario {
    pub id: String,
    pub nombre: String,
    /// El id del rol.
    pub rol: String,
    /// Cómo se llama el rol, para la pantalla.
    #[serde(default)]
    pub rol_nombre: String,
    /// Lo que puede hacer, resuelto al entrar.
    #[serde(default)]
    pub permisos: Vec<String>,
}

impl Usuario {
    pub fn puede(&self, permiso: &str) -> bool {
        self.permisos.iter().any(|p| p == permiso)
    }

    fn con_rol(conexion: &Connection, id: String, nombre: String, rol_id: String) -> Usuario {
        let rol = crate::permisos::rol(conexion, &rol_id);
        Usuario { id, nombre, rol: rol_id, rol_nombre: rol.nombre, permisos: rol.permisos }
    }
}

/// Un usuario que bajó del panel.
#[derive(Debug, Clone, Deserialize)]
pub struct UsuarioRemoto {
    pub id: String,
    pub nombre: String,
    /// bcrypt, tal como lo guarda el backend.
    pub pin_hash: String,
    pub rol: String,
    #[serde(default = "verdadero")]
    pub activo: bool,
}

fn verdadero() -> bool {
    true
}

/// Si un PIN corresponde a un hash, sea Argon2 (hecho en la caja) o bcrypt
/// (hecho en el panel).
fn coincide(pin: &str, hash: &str) -> bool {
    if hash.starts_with("$2") {
        return bcrypt::verify(pin, hash).unwrap_or(false);
    }
    PasswordHash::new(hash)
        .map(|guardado| Argon2::default().verify_password(pin.as_bytes(), &guardado).is_ok())
        .unwrap_or(false)
}

/// Deja en la caja el personal que definió el panel.
///
/// Si el panel mandó personal, **manda él**: los usuarios que se crearon en la
/// caja se desactivan —no se borran: sus turnos y ventas los siguen
/// nombrando—. Así el dueño administra a su gente en un solo lugar para todas
/// sus cajas, y un cajero que se fue deja de entrar en todas a la vez.
///
/// Con la lista vacía no se toca nada: un negocio que nunca configuró personal
/// en el panel sigue con los usuarios de su caja.
pub fn sincronizar_personal(
    conexion: &Connection,
    roles: &[crate::permisos::Rol],
    usuarios: &[UsuarioRemoto],
) -> Result<()> {
    if usuarios.is_empty() {
        return Ok(());
    }
    crate::permisos::guardar_roles(conexion, roles)?;
    let tx = conexion.unchecked_transaction()?;
    tx.execute("UPDATE usuarios SET activo = 0", [])?;
    for u in usuarios {
        if u.pin_hash.is_empty() {
            continue;
        }
        tx.execute(
            "INSERT INTO usuarios (id, nombre, rol, pin_hash, activo) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, rol = excluded.rol,
               pin_hash = excluded.pin_hash, activo = excluded.activo",
            params![u.id, u.nombre.trim(), u.rol, u.pin_hash, u.activo as i64],
        )?;
    }
    tx.commit()
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

    Ok(Usuario::con_rol(conexion, id, nombre.trim().to_string(), rol.como_texto().to_string()))
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

    let filas: Vec<(String, String, String, String)> = filas.collect::<Result<_>>()?;
    drop(consulta);
    for (id, nombre, rol, hash) in filas {
        if coincide(pin, &hash) {
            limpiar_fallos(conexion)?;
            return Ok(Usuario::con_rol(conexion, id, nombre, rol));
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
    let filas: Vec<(String, String, String)> = consulta
        .query_map([], |f| Ok((f.get(0)?, f.get(1)?, f.get(2)?)))?
        .collect::<Result<_>>()?;
    Ok(filas.into_iter().map(|(id, nombre, rol)| Usuario::con_rol(conexion, id, nombre, rol)).collect())
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
        assert_eq!(entrar(&c, "9999", 1_000).unwrap().rol, "supervisor");
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

    #[test]
    fn el_usuario_trae_los_permisos_de_su_rol() {
        let c = con_usuarios();
        let ana = entrar(&c, "1234", 1_000).unwrap();
        assert!(ana.puede("cobrar"));
        assert!(!ana.puede("descuento"));
        assert!(entrar(&c, "9999", 1_000).unwrap().puede("descuento"));
    }

    #[test]
    fn entra_con_un_pin_hecho_en_el_panel() {
        // El backend guarda bcrypt; la caja lo verifica sin internet.
        let c = db::abrir_en_memoria().unwrap();
        let hash = bcrypt::hash("4321", 4).unwrap();
        let roles = vec![crate::permisos::Rol { id: "r1".into(), nombre: "Mesero".into(), permisos: vec!["cobrar".into()] }];
        sincronizar_personal(&c, &roles, &[UsuarioRemoto {
            id: "u1".into(), nombre: "Luis".into(), pin_hash: hash, rol: "r1".into(), activo: true,
        }]).unwrap();
        let luis = entrar(&c, "4321", 1_000).unwrap();
        assert_eq!(luis.nombre, "Luis");
        assert_eq!(luis.rol_nombre, "Mesero");
    }

    #[test]
    fn con_personal_del_panel_los_de_la_caja_dejan_de_entrar() {
        let c = con_usuarios();
        let hash = bcrypt::hash("4321", 4).unwrap();
        sincronizar_personal(&c, &crate::permisos::de_fabrica(), &[UsuarioRemoto {
            id: "u1".into(), nombre: "Luis".into(), pin_hash: hash, rol: "cajero".into(), activo: true,
        }]).unwrap();
        assert!(matches!(entrar(&c, "1234", 1_000), Err(ErrorAcceso::PinInvalido)));
        assert_eq!(listar(&c).unwrap().len(), 1);
    }

    #[test]
    fn con_la_lista_vacia_no_se_toca_nada() {
        let c = con_usuarios();
        sincronizar_personal(&c, &[], &[]).unwrap();
        assert_eq!(entrar(&c, "1234", 1_000).unwrap().nombre, "Ana");
    }

    #[test]
    fn un_usuario_desactivado_en_el_panel_no_entra() {
        let c = db::abrir_en_memoria().unwrap();
        let hash = bcrypt::hash("4321", 4).unwrap();
        sincronizar_personal(&c, &crate::permisos::de_fabrica(), &[
            UsuarioRemoto { id: "u1".into(), nombre: "Luis".into(), pin_hash: hash.clone(), rol: "cajero".into(), activo: false },
            UsuarioRemoto { id: "u2".into(), nombre: "Sara".into(), pin_hash: bcrypt::hash("1111", 4).unwrap(), rol: "cajero".into(), activo: true },
        ]).unwrap();
        assert!(entrar(&c, "4321", 1_000).is_err());
    }

    #[test]
    fn acepta_el_hash_que_hace_el_backend() {
        /* Generado con el bcryptjs del backend (costo 6, PIN 2468). Si el
           backend cambiara de librería o de formato, esta prueba lo diría
           antes de que un cajero se quede sin entrar. */
        let c = db::abrir_en_memoria().unwrap();
        sincronizar_personal(&c, &crate::permisos::de_fabrica(), &[UsuarioRemoto {
            id: "u1".into(),
            nombre: "Luis".into(),
            pin_hash: "$2b$06$lO3zY15xqY3m5.UFk5hfoubDXxlUJWkrjP.IMkMTS1d69.aK79Dqy".into(),
            rol: "cajero".into(),
            activo: true,
        }]).unwrap();
        assert_eq!(entrar(&c, "2468", 1_000).unwrap().nombre, "Luis");
        assert!(entrar(&c, "2469", 1_000).is_err());
    }
}
