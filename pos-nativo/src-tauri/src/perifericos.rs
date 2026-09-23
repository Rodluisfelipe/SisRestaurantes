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
    /// Una impresora instalada en Windows, por su nombre ("POS-58"). Es como
    /// quedan casi todas las térmicas USB. Ver `cola_windows`.
    Windows { nombre: String },
    /// Sin impresora configurada: el POS vende igual y la tirilla se ve en
    /// pantalla. Un negocio sin térmica no puede quedarse sin poder cobrar.
    Ninguna,
}

const ESPERA: Duration = Duration::from_secs(3);

/// Manda a imprimir sin esperar el resultado.
///
/// Abrir un socket a una impresora apagada tarda los tres segundos del tiempo
/// de espera. Hecho desde el hilo que dibuja, eso es la ventana congelada tres
/// segundos con un cliente al frente; y hay papeles —la comanda de cocina, el
/// aviso de una anulación, el comprobante de un movimiento de caja— cuyo
/// resultado nadie mira de todos modos.
///
/// Para esos, un hilo suelto: la caja sigue respondiendo y el papel sale
/// cuando salga. Los que sí necesitan saber si salió —la tirilla de la venta,
/// la precuenta— se resuelven con `spawn_blocking` desde un comando async.
pub fn enviar_suelto(destino: Impresora, bytes: Vec<u8>) {
    if matches!(destino, Impresora::Ninguna) {
        return;
    }
    std::thread::spawn(move || {
        let _ = enviar(&destino, &bytes);
    });
}

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

        Impresora::Windows { nombre } => crate::cola_windows::imprimir(nombre, bytes),

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
    /// Si la impresora tiene cuchilla. Las que no la tienen reciben el
    /// comando de corte como basura y a veces imprimen caracteres raros; el
    /// agente de impresión ya dejaba apagarlo.
    #[serde(default = "si")]
    pub corte: bool,
    /// Cómo sale el QR del menú en la tirilla: "imagen" (lo dibuja la caja,
    /// funciona en casi todas), "nativo" (lo dibuja la impresora, más nítido
    /// pero no todas lo entienden) o "no". Los mismos tres del agente.
    #[serde(default = "qr_imagen")]
    pub qr: String,
}

fn si() -> bool {
    true
}

fn qr_imagen() -> String {
    "imagen".into()
}

impl Default for Config {
    fn default() -> Self {
        Config {
            impresora: Impresora::Ninguna,
            ancho: crate::escpos_ancho_por_defecto(),
            corte: true,
            qr: qr_imagen(),
        }
    }
}

/// Lo que de verdad sale hacia la impresora: sin los cortes si no tiene
/// cuchilla. Se quitan solo los comandos que pone `Tirilla::cortar` (GS V 66
/// n), no cualquier byte parecido.
pub fn papel(corte: bool, bytes: Vec<u8>) -> Vec<u8> {
    if corte {
        return bytes;
    }
    let mut salida = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if i + 3 < bytes.len() && bytes[i] == 0x1D && bytes[i + 1] == b'V' && bytes[i + 2] == 66 {
            i += 4;
            continue;
        }
        salida.push(bytes[i]);
        i += 1;
    }
    salida
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
