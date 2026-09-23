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
    pub(crate) fn clasificar(error: ureq::Error) -> sync::FalloEnvio {
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
            "cliente" => format!("{}/pos/customers", self.base),
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

/// A qué negocio pertenece un token de caja.
///
/// Se lee del propio token y no se le pregunta al servidor, por dos razones:
/// está disponible justo cuando hace falta —en el momento de vincular, antes
/// de la primera sincronización— y no cuesta una llamada de red en el peor
/// momento para hacerla.
///
/// **No se verifica la firma, y no hace falta.** Esto no autoriza nada: el
/// valor solo se compara contra el que la caja ya tenía guardado para decidir
/// si hay que tirar el catálogo replicado. Un token falsificado no consigue
/// nada por este camino —lo peor que puede provocar es que la caja vuelva a
/// bajar su catálogo— y de todos modos el servidor lo rechazaría en la
/// primera petición.
pub fn negocio_del_token(token: &str) -> String {
    let Some(carga) = token.split('.').nth(1) else { return String::new() };

    /* Base64 URL-safe y sin relleno, que es como viaja un JWT. `base64` no
       está entre las dependencias y traerla por doce líneas no se justifica:
       el alfabeto es fijo y la decodificación cabe aquí. */
    let bytes = match descodificar_base64url(carga) {
        Some(b) => b,
        None => return String::new(),
    };

    let Ok(texto) = String::from_utf8(bytes) else { return String::new() };
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&texto) else { return String::new() };

    json.get("businessId")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string()
}

fn descodificar_base64url(texto: &str) -> Option<Vec<u8>> {
    const ALFABETO: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

    let mut acumulado: u32 = 0;
    let mut bits = 0u32;
    let mut salida = Vec::with_capacity(texto.len() * 3 / 4);

    for c in texto.bytes() {
        if c == b'=' {
            break;
        }
        let valor = ALFABETO.iter().position(|&a| a == c)? as u32;
        acumulado = (acumulado << 6) | valor;
        bits += 6;

        if bits >= 8 {
            bits -= 8;
            salida.push((acumulado >> bits) as u8);
        }
    }

    Some(salida)
}

#[cfg(test)]
mod pruebas_token {
    use super::negocio_del_token;

    /* Un token firmado por el backend de verdad, con `jsonwebtoken` y la
       misma carga que arma `Routes/pos.js`. No es uno inventado a mano:
       el relleno, el alfabeto url-safe y el orden de los campos son los
       que van a llegar en producción. */
    const TOKEN_REAL: &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjUwN2YxZjc3YmNmODZjZDc5OTQzOTAxMSIsImJ1c2luZXNzSWQiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTEiLCJyb2xlIjoiYWRtaW4iLCJzY29wZSI6InBvcyIsImNhamEiOiJDYWphIHByaW5jaXBhbCIsImp0aSI6ImFiYy0xMjMiLCJpYXQiOjE3ODk5NTIyMjQsImV4cCI6MTc5NzcyODIyNH0.aavpJ8H22TMLrKoZKsa885zkavDH4fDPMoKjs3Z_xzI";

    #[test]
    fn saca_el_negocio_de_un_token_del_backend() {
        assert_eq!(negocio_del_token(TOKEN_REAL), "507f1f77bcf86cd799439011");
    }

    #[test]
    fn lo_que_no_es_un_token_devuelve_vacio() {
        /* Y vacío significa "no sé de qué negocio es", que `cambiar_a`
           trata sin tocar nada. Fallar hacia no-hacer-nada es lo correcto:
           lo contrario sería borrarle el catálogo a una caja por un token
           que llegó raro. */
        assert_eq!(negocio_del_token(""), "");
        assert_eq!(negocio_del_token("no-es-un-jwt"), "");
        assert_eq!(negocio_del_token("a.b.c"), "");
        assert_eq!(negocio_del_token("a..c"), "");
    }

    #[test]
    fn un_token_sin_business_id_devuelve_vacio() {
        // {"scope":"pos"} en base64url, sin relleno.
        let sin = "eyJhbGciOiJIUzI1NiJ9.eyJzY29wZSI6InBvcyJ9.firma";
        assert_eq!(negocio_del_token(sin), "");
    }

    #[test]
    fn dos_tokens_de_negocios_distintos_no_se_confunden() {
        /* Es la comparación de la que depende todo el mecanismo: si
           devolviera lo mismo para dos negocios, la caja nunca limpiaría. */
        // {"businessId":"otro-negocio"}
        let otro = "eyJhbGciOiJIUzI1NiJ9.eyJidXNpbmVzc0lkIjoib3Ryby1uZWdvY2lvIn0.firma";

        assert_eq!(negocio_del_token(otro), "otro-negocio");
        assert_ne!(negocio_del_token(otro), negocio_del_token(TOKEN_REAL));
    }
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
    /* La configuración de esta terminal, cuando cambió. El servidor la manda
       solo si es posterior a la marca de agua; el resto de las veces viene
       nula y no hay nada que aplicar. */
    #[serde(default)]
    configuracion: Option<crate::configuracion::ConfigRemota>,
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
    /* El membrete de la tirilla. `None` cuando el servidor es de antes y no
       los manda: ahí se deja lo que haya. `Some("")` es que el dueño los
       borró, y se borran. */
    #[serde(default)]
    pub nit: Option<String>,
    #[serde(default)]
    pub direccion: Option<String>,
    #[serde(default)]
    pub telefono: Option<String>,
    #[serde(default)]
    pub menu_url: Option<String>,
    #[serde(default)]
    pub qr_en_tirilla: Option<bool>,
    #[serde(default)]
    pub logo: Option<String>,
}

/// Baja el catálogo desde la marca de agua y lo aplica.
///
/// Devuelve cuántas filas entraron. Se pide por lotes hasta que el servidor
/// diga que no hay más: un negocio con 5.000 productos no cabe en una sola
/// respuesta, y bajar "lo que quepa" dejaría la caja con medio catálogo sin
/// que nadie se enterara.
/// Lo que trajo una bajada de catálogo.
pub struct Bajada {
    pub filas: usize,
    /// La configuración nueva, si el panel la cambió.
    pub configuracion: Option<crate::configuracion::Aplicada>,
}

pub fn bajar_catalogo(
    conexion: &mut rusqlite::Connection,
    nube: &Nube,
) -> Result<Bajada, String> {
    let mut total = 0usize;
    let mut aplicada: Option<crate::configuracion::Aplicada> = None;

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

        /* La configuración del panel. Su fallo **no** se propaga: si algo del
           bloque viniera mal, lo que no puede pasar es que esta caja deje de
           bajar catálogo y de subir ventas por una casilla mal puesta en una
           pantalla de administración. */
        if let Some(config) = &respuesta.configuracion {
            match crate::configuracion::aplicar(conexion, config) {
                Ok(r) => {
                    aplicada = Some(r);
                }
                Err(e) => {
                    println!("La configuración del panel no se pudo aplicar: {e}");
                }
            }
        }
        total += cuantas;

        /* Se corta si no hay más, o si el lote no movió la marca de agua: sin
           esa segunda condición, un lote donde todo comparte la misma fecha
           haría pedir lo mismo una y otra vez hasta agotar las veinte vueltas. */
        if !respuesta.hay_mas || cuantas == 0 {
            break;
        }
    }

    Ok(Bajada { filas: total, configuracion: aplicada })
}

/// Lo que devuelve GET /pos/customers.
#[derive(serde::Deserialize)]
struct RespuestaClientes {
    #[serde(default)]
    filas: Vec<pos_core::clientes::FilaCliente>,
    #[serde(default)]
    hay_mas: bool,
    /* Las recompensas viajan con los clientes porque se piden juntas y son
       pocas. Vienen enteras en cada vuelta, así que solo se aplican en la
       primera: repetir el reemplazo veinte veces sería borrar y reescribir la
       misma tabla veinte veces. */
    #[serde(default)]
    recompensas: Vec<pos_core::clientes::FilaRecompensa>,
}

/// Baja los clientes que cambiaron, y de paso las recompensas vigentes.
///
/// Su fallo **no** puede tumbar la sincronización. Una caja que no pudo bajar
/// clientes sigue vendiendo perfectamente; una que deja de subir ventas por eso
/// pierde plata. Por eso quien la llama se limita a anotar el error.
pub fn bajar_clientes(
    conexion: &mut rusqlite::Connection,
    nube: &Nube,
) -> Result<usize, String> {
    let mut total = 0usize;
    let mut primera = true;

    for _ in 0..20 {
        let desde = pos_core::clientes::marca_de_agua(conexion).map_err(|e| e.to_string())?;

        let cruda = ureq::get(&format!("{}/pos/customers", nube.base))
            .timeout(ESPERA)
            .set("Authorization", &format!("Bearer {}", nube.token))
            .query("since", &desde)
            .call()
            .map_err(|e| match Nube::clasificar(e) {
                sync::FalloEnvio::Red(m) => format!("Sin conexión: {m}"),
                sync::FalloEnvio::Servidor(c, _) => format!("El servidor falló ({c})"),
                sync::FalloEnvio::Rechazado(c, m) => format!("Rechazado ({c}): {m}"),
            })?;

        let respuesta: RespuestaClientes = cruda
            .into_json()
            .map_err(|e| format!("Respuesta ilegible: {e}"))?;

        if primera {
            pos_core::clientes::reemplazar_recompensas(conexion, &respuesta.recompensas)
                .map_err(|e| e.to_string())?;
            primera = false;
        }

        let cuantas = respuesta.filas.len();
        let marca = pos_core::clientes::aplicar(conexion, &respuesta.filas)
            .map_err(|e| e.to_string())?;
        total += cuantas;

        /* Se corta si no hay más, si el lote vino vacío, o si el lote no movió
           la marca de agua. Lo último es lo que evita el bucle infinito cuando
           todas las filas comparten la misma fecha: sin esa condición se
           pediría lo mismo veinte veces. */
        if !respuesta.hay_mas || cuantas == 0 || marca.is_none() {
            break;
        }
    }

    Ok(total)
}

/// Lo que el servidor responde a un canje.
#[derive(serde::Deserialize, serde::Serialize, Default)]
pub struct Canje {
    #[serde(default)]
    pub success: bool,
    #[serde(rename = "pointsSpent", default)]
    pub puntos_gastados: i64,
    #[serde(rename = "remainingPoints", default)]
    pub puntos_restantes: i64,
    #[serde(default)]
    pub reward: serde_json::Value,
}

/// Canjea puntos por una recompensa. **Siempre contra el servidor.**
///
/// Esta es la excepción a que la caja pueda todo sin internet, y es deliberada.
/// El descuento de puntos tiene que ser atómico entre todas las terminales del
/// negocio: dos cajas atendiendo al mismo cliente en el mismo minuto —una en el
/// mostrador y otra en la caja rápida— podrían quemarle los mismos cien puntos
/// dos veces si cada una decidiera por su cuenta.
///
/// Guardarlo en la cola para "confirmarlo después" tampoco sirve: la caja ya le
/// habría entregado el café gratis al cliente, y cuando la nube dijera que no
/// alcanzaban los puntos no habría nada que deshacer.
///
/// Así que sin señal no hay canje, y la pantalla lo dice con esas palabras. El
/// resto del cobro sigue funcionando igual.
pub fn canjear(
    nube: &Nube,
    telefono: &str,
    reward_id: &str,
    venta_id: &str,
    cajero: &str,
) -> Result<Canje, String> {
    let cuerpo = serde_json::json!({
        "telefono": telefono,
        "reward_id": reward_id,
        /* La venta contra la que se canjea. El servidor la exige, y es lo que
           hace que un reintento cuente una sola vez: el mismo id de venta con
           la misma recompensa choca contra su índice único y no descuenta dos
           veces. */
        "venta_id": venta_id,
        "cajero": cajero,
    });

    let respuesta = ureq::post(&format!("{}/pos/redeem-reward", nube.base))
        .timeout(ESPERA)
        .set("Authorization", &format!("Bearer {}", nube.token))
        .send_json(cuerpo)
        .map_err(|e| match Nube::clasificar(e) {
            sync::FalloEnvio::Red(_) => {
                "Sin conexión: el canje de puntos necesita internet".to_string()
            }
            sync::FalloEnvio::Servidor(c, _) => format!("El servidor falló ({c})"),
            /* El mensaje del servidor se muestra tal cual porque es el que le
               sirve al cajero: "Puntos insuficientes" explica la situación al
               cliente que está enfrente; "error 400" no. */
            sync::FalloEnvio::Rechazado(_, m) => m,
        })?;

    respuesta.into_json().map_err(|e| format!("Respuesta ilegible: {e}"))
}

/// Marca un producto como disponible o agotado en la nube.
///
/// Necesita internet, como el canje: es un cambio del catálogo del negocio, y
/// la nube es la dueña del catálogo. Si se hiciera solo en esta caja, el menú
/// web seguiría vendiendo lo que se acabó.
pub fn marcar_disponible(nube: &Nube, producto_id: &str, disponible: bool) -> Result<(), String> {
    let base = producto_id.split(':').next().unwrap_or_default();
    if base.is_empty() || !base.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Ese producto no es del catálogo de MenuBy".into());
    }
    ureq::patch(&format!("{}/pos/productos/{base}/disponible", nube.base))
        .timeout(ESPERA)
        .set("Authorization", &format!("Bearer {}", nube.token))
        .send_json(serde_json::json!({ "disponible": disponible }))
        .map_err(|e| match Nube::clasificar(e) {
            sync::FalloEnvio::Red(_) => "Sin conexión: marcar agotado necesita internet".to_string(),
            sync::FalloEnvio::Servidor(c, _) => format!("El servidor falló ({c})"),
            sync::FalloEnvio::Rechazado(_, m) => m,
        })?;
    Ok(())
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

    /* Estos sí se escriben vacíos: un NIT que el dueño quitó del panel no
       puede seguir saliendo en el papel. Se recortan porque terminan en una
       línea de tirilla de 32 a 48 columnas. */
    let qr = quien.qr_en_tirilla.map(|si| if si { "1".to_string() } else { "0".to_string() });
    for (clave, valor) in [
        ("negocio_nit", &quien.nit),
        ("negocio_direccion", &quien.direccion),
        ("negocio_telefono", &quien.telefono),
        ("negocio_menu_url", &quien.menu_url),
        ("qr_en_tirilla", &qr),
        ("negocio_logo_url", &quien.logo),
    ] {
        if let Some(v) = valor {
            let v: String = v.trim().chars().take(300).collect();
            let _ = conexion.execute(
                "INSERT INTO ajustes (clave, valor) VALUES (?1, ?2)
                 ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
                rusqlite::params![clave, v],
            );
        }
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

    fn base() -> rusqlite::Connection {
        let c = rusqlite::Connection::open_in_memory().unwrap();
        c.execute("CREATE TABLE ajustes (clave TEXT PRIMARY KEY, valor TEXT)", []).unwrap();
        c
    }

    fn leer(c: &rusqlite::Connection, clave: &str) -> Option<String> {
        c.query_row("SELECT valor FROM ajustes WHERE clave = ?1", [clave], |f| f.get(0)).ok()
    }

    fn con(nit: Option<&str>) -> super::Identidad {
        super::Identidad {
            nombre: "Go Burger".into(),
            nit: nit.map(Into::into),
            direccion: nit.map(|_| "Cra 10 # 20-30".into()),
            telefono: nit.map(|_| "3001234567".into()),
            ..Default::default()
        }
    }

    #[test]
    fn guarda_el_membrete_de_la_tirilla() {
        let c = base();
        super::guardar_identidad(&c, &con(Some(" 900123456-7 ")));
        assert_eq!(leer(&c, "negocio_nit").as_deref(), Some("900123456-7"));
        assert_eq!(leer(&c, "negocio_direccion").as_deref(), Some("Cra 10 # 20-30"));
        assert_eq!(leer(&c, "negocio_telefono").as_deref(), Some("3001234567"));
    }

    #[test]
    fn un_nit_borrado_en_el_panel_se_borra_en_la_caja() {
        // Si no, el papel sigue diciendo un NIT que el dueño ya quitó.
        let c = base();
        super::guardar_identidad(&c, &con(Some("900123456-7")));
        super::guardar_identidad(&c, &con(Some("")));
        assert_eq!(leer(&c, "negocio_nit").as_deref(), Some(""));
    }

    #[test]
    fn un_servidor_viejo_que_no_los_manda_no_los_borra() {
        let c = base();
        super::guardar_identidad(&c, &con(Some("900123456-7")));
        let viejo: super::Identidad =
            serde_json::from_str(r#"{"nombre":"Go Burger","color":"","color_texto":""}"#).unwrap();
        super::guardar_identidad(&c, &viejo);
        assert_eq!(leer(&c, "negocio_nit").as_deref(), Some("900123456-7"));
    }
}
