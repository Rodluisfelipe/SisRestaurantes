//! El transporte hacia MenuBy.
//!
//! El núcleo define *qué* se manda y *cuándo* (la cola, el backoff, el orden);
//! esto es solo *cómo*: HTTP contra la API que ya existe. Por eso vive aquí y
//! no en `pos-core`, que se prueba sin red.
//!
//! Se usa `ureq` y no un cliente async: la sincronización corre en un hilo
//! aparte que puede bloquearse tranquilo, y meter un runtime async completo
//! para hacer un POST cada treinta segundos es cargar una tonelada de
//! dependencias en un binario que se enorgullece de pesar 15 MB.

use pos_core::{catalogo, sync};
use std::time::Duration;

const ESPERA: Duration = Duration::from_secs(20);

pub struct Nube {
    /// Sin barra final. Ej: `https://api.menuby.tech/api`
    pub base: String,
    /// El JWT del negocio.
    ///
    /// Hoy se guarda en la tabla `ajustes` de SQLite, en claro. Es aceptable
    /// mientras la caja sea un equipo del negocio con su propio usuario de
    /// Windows, pero lo correcto es moverlo al llavero del sistema
    /// (tauri-plugin-stronghold o keyring) antes de instalarlo en equipos
    /// compartidos.
    pub token: String,
}

impl Nube {
    /// Traduce un fallo de red o un código HTTP a la decisión que le importa a
    /// la cola: ¿esto se reintenta o no?
    fn clasificar(error: ureq::Error) -> sync::FalloEnvio {
        match error {
            // 4xx: el servidor entendió y dijo que no. Insistir no cambia nada.
            ureq::Error::Status(codigo, respuesta) if (400..500).contains(&codigo) => {
                let detalle = respuesta
                    .into_string()
                    .unwrap_or_default()
                    .chars()
                    .take(200)
                    .collect::<String>();
                sync::FalloEnvio::Rechazado(codigo, detalle)
            }
            // 5xx: es culpa suya y se le da otra oportunidad.
            ureq::Error::Status(codigo, _) => sync::FalloEnvio::Servidor(codigo, String::new()),
            // Sin respuesta: no hay internet, DNS caído, timeout.
            ureq::Error::Transport(t) => sync::FalloEnvio::Red(t.to_string()),
        }
    }
}

impl sync::Transporte for Nube {
    fn enviar(&self, entidad: &str, _operacion: &str, payload: &str) -> Result<(), sync::FalloEnvio> {
        /* Cada entidad de la cola tiene su ruta. La cola no sabe de HTTP y esto
           no sabe de reintentos: por eso agregar una entidad nueva es agregar
           una línea aquí y nada más. */
        let ruta = match entidad {
            "venta" => format!("{}/pos/sync-sale", self.base),
            "turno" => format!("{}/pos/shifts/close", self.base),
            "devolucion" => format!("{}/pos/sync-refund", self.base),
            "excepcion" => format!("{}/pos/audit", self.base),
            otro => {
                return Err(sync::FalloEnvio::Rechazado(
                    422,
                    format!("no sé a dónde mandar '{otro}'"),
                ))
            }
        };

        let cuerpo: serde_json::Value = serde_json::from_str(payload)
            .map_err(|e| sync::FalloEnvio::Rechazado(400, format!("payload ilegible: {e}")))?;

        ureq::post(&ruta)
            .timeout(ESPERA)
            .set("Authorization", &format!("Bearer {}", self.token))
            .send_json(cuerpo)
            .map(|_| ())
            .map_err(Nube::clasificar)
    }
}

#[derive(serde::Deserialize)]
pub struct Emparejamiento {
    pub token: String,
    #[serde(default)]
    pub negocio: String,
    #[serde(default)]
    pub vence_en_dias: i64,
}

/// Canjea el código que el dueño sacó del panel por el token de esta caja.
///
/// Es la vía normal: ocho caracteres que alguien puede dictar por teléfono. La
/// otra —cambiar la sesión del panel— sigue existiendo para soporte, pero exige
/// saber qué es un token y dónde vive.
pub fn vincular(base_url: &str, codigo: &str) -> Result<Emparejamiento, String> {
    let url = format!("{}/pos/vincular", base_url.trim_end_matches('/'));

    ureq::post(&url)
        .timeout(ESPERA)
        .send_json(serde_json::json!({ "codigo": codigo.trim() }))
        .map_err(|e| match Nube::clasificar(e) {
            sync::FalloEnvio::Red(m) => format!("No se pudo llegar a MenuBy: {m}"),
            sync::FalloEnvio::Servidor(c, _) => format!("El servidor falló ({c}). Intenta más tarde"),
            sync::FalloEnvio::Rechazado(404, _) => {
                "Ese código no sirve o ya venció. Pide uno nuevo desde el panel".into()
            }
            sync::FalloEnvio::Rechazado(429, _) => {
                "Demasiados intentos. Espera un minuto".into()
            }
            sync::FalloEnvio::Rechazado(c, m) => format!("Rechazado ({c}): {m}"),
        })?
        .into_json()
        .map_err(|e| format!("Respuesta inesperada del servidor: {e}"))
}

/// Cambia la sesión del panel por el token de esta caja.
///
/// El del panel vence en 24 horas: una caja que lo use deja de sincronizar al
/// día siguiente, en mitad del servicio y sin que nadie entienda por qué. Este
/// intercambio ocurre una sola vez, al instalar.
pub fn emparejar(base_url: &str, token_panel: &str, caja: &str) -> Result<Emparejamiento, String> {
    let url = format!("{}/pos/pair", base_url.trim_end_matches('/'));

    ureq::post(&url)
        .timeout(ESPERA)
        .set("Authorization", &format!("Bearer {}", token_panel.trim()))
        .send_json(serde_json::json!({ "caja": caja }))
        .map_err(|e| match Nube::clasificar(e) {
            sync::FalloEnvio::Red(m) => format!("No se pudo llegar a {url}: {m}"),
            sync::FalloEnvio::Servidor(c, _) => format!("El servidor falló ({c}). Intenta más tarde"),
            sync::FalloEnvio::Rechazado(401, _) | sync::FalloEnvio::Rechazado(403, _) => {
                "Esa sesión no sirve o ya venció. Vuelve a entrar al panel y copia el token otra vez".into()
            }
            sync::FalloEnvio::Rechazado(c, m) => format!("Rechazado ({c}): {m}"),
        })?
        .into_json()
        .map_err(|e| format!("Respuesta inesperada del servidor: {e}"))
}

/// Comprueba que la caja puede hablar con MenuBy con el token que ya tiene.
///
/// Se pide el catálogo con una marca de agua imposible: contesta rápido, no
/// baja nada y verifica de una sola vez la URL, el token y los permisos.
pub fn probar(nube: &Nube) -> Result<(), String> {
    ureq::get(&format!("{}/pos/catalog", nube.base))
        .timeout(ESPERA)
        .set("Authorization", &format!("Bearer {}", nube.token))
        .query("since", "2999-01-01T00:00:00.000Z")
        .query("limit", "1")
        .call()
        .map(|_| ())
        .map_err(|e| match Nube::clasificar(e) {
            sync::FalloEnvio::Red(m) => format!("Sin conexión: {m}"),
            sync::FalloEnvio::Servidor(c, _) => format!("El servidor falló ({c})"),
            sync::FalloEnvio::Rechazado(401, _) | sync::FalloEnvio::Rechazado(403, _) => {
                "El token de esta caja venció o fue revocado. Hay que emparejarla otra vez".into()
            }
            sync::FalloEnvio::Rechazado(c, m) => format!("Rechazado ({c}): {m}"),
        })
}

#[derive(serde::Deserialize)]
struct RespuestaCatalogo {
    filas: Vec<catalogo::FilaCatalogo>,
    #[serde(default)]
    hay_mas: bool,
    #[serde(default)]
    negocio: Option<Identidad>,
}

/// Cómo se llama el negocio y de qué color es.
///
/// Viaja con el catálogo, no con el emparejamiento: el emparejamiento ocurre
/// una vez y el dueño puede cambiar su color un martes cualquiera.
#[derive(serde::Deserialize, Default)]
pub struct Identidad {
    #[serde(default)]
    pub nombre: String,
    #[serde(default)]
    pub color: String,
    #[serde(default)]
    pub color_texto: String,
}

/// Baja el catálogo desde la marca de agua y lo aplica.
///
/// Devuelve cuántas filas entraron. Se pide por lotes hasta que el servidor
/// diga que no hay más: un negocio con 5.000 productos no cabe en una sola
/// respuesta, y bajar "lo que quepa" dejaría la caja con medio catálogo sin
/// que nadie se enterara.
pub fn bajar_catalogo(
    conexion: &mut rusqlite::Connection,
    nube: &Nube,
) -> Result<usize, String> {
    let mut total = 0usize;

    for _ in 0..20 {
        let desde = catalogo::marca_de_agua(conexion).map_err(|e| e.to_string())?;

        let cruda = ureq::get(&format!("{}/pos/catalog", nube.base))
            .timeout(ESPERA)
            .set("Authorization", &format!("Bearer {}", nube.token))
            .query("since", &desde)
            .call()
            .map_err(|e| match Nube::clasificar(e) {
                sync::FalloEnvio::Red(m) => format!("Sin conexión: {m}"),
                sync::FalloEnvio::Servidor(c, _) => format!("El servidor falló ({c})"),
                sync::FalloEnvio::Rechazado(c, m) => format!("Rechazado ({c}): {m}"),
            })?;

        /* De paso, la hora. Toda respuesta HTTP trae una cabecera `Date`, y es
           gratis: sirve para detectar que la pila de la placa está agotada y
           que este equipo cree estar en 1970. Sin esto, las ventas de esa
           mañana se estampan cincuenta y seis años atrás y ningún informe del
           negocio vuelve a cuadrar. */
        if let Some(fecha) = cruda.header("Date") {
            if let Some(epoch) = crate::reloj::epoch_de_cabecera(fecha) {
                if crate::reloj::sincronizar(epoch) {
                    println!(
                        "El reloj de esta caja estaba corrido {} s y se corrigió",
                        crate::reloj::desfase_segundos(),
                    );
                }
            }
        }

        let respuesta: RespuestaCatalogo = cruda
            .into_json()
            .map_err(|e| format!("Respuesta ilegible: {e}"))?;

        let cuantas = respuesta.filas.len();
        catalogo::aplicar(conexion, &respuesta.filas).map_err(|e| e.to_string())?;
        if let Some(quien) = &respuesta.negocio {
            guardar_identidad(conexion, quien);
        }
        total += cuantas;

        /* Se corta si no hay más, o si el lote no movió la marca de agua: sin
           esa segunda condición, un lote donde todo comparte la misma fecha
           haría pedir lo mismo una y otra vez hasta agotar las veinte vueltas. */
        if !respuesta.hay_mas || cuantas == 0 {
            break;
        }
    }

    Ok(total)
}

/// Deja el nombre y el color del negocio en los ajustes locales.
///
/// Un color mal escrito en el panel no puede tumbar una sincronización, así
/// que se valida aquí: si no es un hexadecimal de los de siempre, se ignora y
/// la caja se queda con el que ya tenía. Y si falla la escritura tampoco se
/// propaga: lo que importaba de esta bajada eran los productos.
fn guardar_identidad(conexion: &rusqlite::Connection, quien: &Identidad) {
    let poner = |clave: &str, valor: &str| {
        if valor.is_empty() {
            return;
        }
        let _ = conexion.execute(
            "INSERT INTO ajustes (clave, valor) VALUES (?1, ?2)
             ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
            rusqlite::params![clave, valor],
        );
    };

    poner("negocio_nombre", quien.nombre.trim());
    if es_hexadecimal(&quien.color) {
        poner("marca_color", quien.color.trim());
    }
    if es_hexadecimal(&quien.color_texto) {
        poner("marca_color_texto", quien.color_texto.trim());
    }
}

/// #rgb o #rrggbb, nada más. Lo que llega de la nube se dibuja en una pantalla
/// y termina dentro de una hoja de estilos: no se deja pasar texto libre.
fn es_hexadecimal(valor: &str) -> bool {
    let v = valor.trim();
    let Some(cuerpo) = v.strip_prefix('#') else { return false };
    (cuerpo.len() == 3 || cuerpo.len() == 6) && cuerpo.chars().all(|c| c.is_ascii_hexdigit())
}

#[cfg(test)]
mod pruebas_identidad {
    use super::es_hexadecimal;

    #[test]
    fn acepta_las_dos_formas_de_escribir_un_color() {
        assert!(es_hexadecimal("#fff"));
        assert!(es_hexadecimal("#2563EB"));
    }

    #[test]
    fn no_deja_pasar_nada_que_no_sea_un_color() {
        /* El de en medio es el que importa: un valor así, puesto en el panel y
           metido tal cual en un atributo de estilo, es una inyección. */
        assert!(!es_hexadecimal("rojo"));
        assert!(!es_hexadecimal("#fff; background: url(http://x)"));
        assert!(!es_hexadecimal("2563eb"));
        assert!(!es_hexadecimal(""));
        assert!(!es_hexadecimal("#12345"));
    }
}
