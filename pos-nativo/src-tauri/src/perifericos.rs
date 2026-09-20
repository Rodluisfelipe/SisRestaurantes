//! Los fierros del mostrador: impresora térmica y cajón monedero.
//!
//! Este módulo solo transporta bytes. Qué bytes son se decide en
//! `pos_core::escpos`, que se puede probar sin tener una impresora al lado.
//!
//! Tres formas de conexión, que son las tres que existen en un mostrador
//! colombiano:
//!
//! - **Red (TCP 9100)**: lo estándar en impresoras con puerto ethernet. Es la
//!   más confiable y la que permite compartir una impresora entre dos cajas.
//! - **Serie (COM/USB-serial)**: las viejas y las que se conectan por un
//!   conversor. Hay que fijar baudios; 9600 y 19200 cubren casi todo.
//! - **Archivo del sistema**: en Linux, `/dev/usb/lp0`; en Windows, un puerto
//!   compartido. Es el plan B cuando el driver no expone nada más.
//!
//! Todo aquí es de bloqueo a propósito, pero se llama desde un hilo aparte
//! (`async_runtime::spawn_blocking` en los comandos): si la impresora está
//! apagada, el `connect_timeout` se come tres segundos y la interfaz **no**
//! puede quedarse congelada con un cliente esperando el vuelto.

use std::io::Write;
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

/// Adónde mandar la tirilla. Se guarda en la configuración del negocio.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "tipo", rename_all = "lowercase")]
pub enum Impresora {
    Red { host: String, puerto: u16 },
    Serie { puerto: String, baudios: u32 },
    Archivo { ruta: String },
    /// Sin impresora configurada: el POS vende igual y la tirilla se ve en
    /// pantalla. Un negocio sin térmica no puede quedarse sin poder cobrar.
    Ninguna,
}

const ESPERA: Duration = Duration::from_secs(3);

pub fn enviar(destino: &Impresora, bytes: &[u8]) -> Result<(), String> {
    match destino {
        Impresora::Ninguna => Ok(()),

        Impresora::Red { host, puerto } => {
            let dir = format!("{host}:{puerto}")
                .to_socket_addrs()
                .map_err(|e| format!("No se pudo resolver {host}: {e}"))?
                .next()
                .ok_or_else(|| format!("La dirección {host} no resolvió a nada"))?;

            /* Con timeout, no con `TcpStream::connect` a secas: una impresora
               apagada en una IP que existe deja la conexión colgada hasta que
               el sistema se rinda, que en Windows es cerca de un minuto. */
            let mut flujo = TcpStream::connect_timeout(&dir, ESPERA)
                .map_err(|e| format!("La impresora en {host}:{puerto} no responde: {e}"))?;
            flujo.set_write_timeout(Some(ESPERA)).ok();

            flujo.write_all(bytes).map_err(|e| format!("Se cortó el envío a la impresora: {e}"))?;
            flujo.flush().map_err(|e| format!("Se cortó el envío a la impresora: {e}"))
        }

        Impresora::Serie { puerto, baudios } => {
            let mut serie = serialport::new(puerto, *baudios)
                .timeout(ESPERA)
                .open()
                .map_err(|e| format!("No se pudo abrir {puerto}: {e}"))?;

            serie.write_all(bytes).map_err(|e| format!("Se cortó el envío por {puerto}: {e}"))?;
            serie.flush().map_err(|e| format!("Se cortó el envío por {puerto}: {e}"))
        }

        Impresora::Archivo { ruta } => {
            let mut archivo = std::fs::OpenOptions::new()
                .write(true)
                .open(ruta)
                .map_err(|e| format!("No se pudo abrir {ruta}: {e}"))?;
            archivo.write_all(bytes).map_err(|e| format!("Se cortó el envío a {ruta}: {e}"))
        }
    }
}

/* ── Qué impresoras tiene este mostrador ──────────────────────────────── */

/// Dónde vive cada impresora y de qué ancho es su papel.
///
/// Dos roles, que son los dos que existen en un local: **caja**, donde sale la
/// tirilla del cliente, y **cocina**, donde sale la comanda. La de cocina es
/// opcional y casi siempre de red, porque está a diez metros de la caja.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Config {
    pub impresora: Impresora,
    /// 48 para papel de 80 mm, 32 para 58 mm. Si se equivoca, la tirilla sale
    /// descuadrada entera: por eso se configura y no se adivina.
    pub ancho: usize,
}

impl Default for Config {
    fn default() -> Self {
        Config { impresora: Impresora::Ninguna, ancho: crate::escpos_ancho_por_defecto() }
    }
}

fn clave(rol: &str) -> String {
    format!("impresora_{rol}")
}

/// Lee la configuración guardada. Sin configurar = sin impresora, y la caja
/// sigue vendiendo: la tirilla es un comprobante, no la venta.
pub fn leer_config(base: &rusqlite::Connection, rol: &str) -> Config {
    let guardado: String = base
        .query_row("SELECT valor FROM ajustes WHERE clave = ?1", [clave(rol)], |f| f.get(0))
        .unwrap_or_default();

    serde_json::from_str(&guardado).unwrap_or_default()
}

pub fn guardar_config(base: &rusqlite::Connection, rol: &str, config: &Config) -> Result<(), String> {
    let json = serde_json::to_string(config).map_err(|e| e.to_string())?;
    base.execute(
        "INSERT INTO ajustes (clave, valor) VALUES (?1, ?2)
         ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
        rusqlite::params![clave(rol), json],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Los puertos serie que ve el sistema, para que el negocio elija de una lista
/// en vez de adivinar si su impresora es COM3 o COM7.
pub fn puertos_serie() -> Vec<String> {
    serialport::available_ports()
        .map(|lista| lista.into_iter().map(|p| p.port_name).collect())
        .unwrap_or_default()
}
