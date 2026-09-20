//! La cáscara nativa.
//!
//! Abre la ventana, guarda la conexión a SQLite y expone al webview los cuatro
//! verbos que necesita una caja: ver el catálogo, cobrar, imprimir y mirar la
//! cola de sincronización. Toda la lógica vive en `pos_core`.
//!
//! El orden de una venta es deliberado: **primero se guarda, después se
//! imprime**. Si la impresora está sin papel, la venta ya quedó registrada y la
//! tirilla se reimprime; al revés, se entregaría un comprobante de una venta
//! que no existe.

use pos_core::pagos::{self, Terminal};
use pos_core::{auditoria, db, dinero::Pesos, escpos, pausadas, sync, turnos, usuarios, venta};
use std::sync::Mutex;
use tauri::{Manager, State};

mod cliente;
mod credenciales;
mod datafono_red;
mod nube;
mod perifericos;
use nube::Nube;
use perifericos::Impresora;

/// Lo que la app mantiene viva mientras corre.
pub struct Estado {
    /// Una sola conexión, tras un mutex. SQLite aguanta más, pero una caja
    /// tiene un cajero: la contención no existe y así no hay dos escrituras
    /// compitiendo por el mismo archivo.
    pub base: Mutex<rusqlite::Connection>,
    pub negocio: Mutex<String>,
    /// Quién tiene la caja ahora mismo. Se cierra sola por inactividad.
    pub sesion: Mutex<Option<usuarios::Usuario>>,
}

/// A dónde sincronizar. Vacío = caja sin configurar: vende igual, pero no sube.
///
/// La URL sale de SQLite —es configuración— y el token del llavero del
/// sistema, que es donde va lo que no puede leerse abriendo un archivo.
fn leer_nube(base: &rusqlite::Connection) -> Option<Nube> {
    let url: String = base
        .query_row("SELECT valor FROM ajustes WHERE clave = 'nube_url'", [], |f| f.get(0))
        .unwrap_or_default();
    let token = credenciales::leer()?;

    if url.is_empty() || token.is_empty() {
        return None;
    }
    Some(Nube { base: url, token })
}

/// Los datos del datáfono integrado, si lo hay. `None` = el manual.
///
/// Se devuelven los datos y no el `Box<dyn Terminal>` porque el terminal se
/// construye dentro del hilo que va a usarlo: así nada que dependa de la
/// conexión a SQLite cruza el límite del hilo.
fn descripcion_terminal(base: &rusqlite::Connection) -> Option<(String, u16)> {
    let leer = |clave: &str| -> String {
        base.query_row("SELECT valor FROM ajustes WHERE clave = ?1", [clave], |f| f.get(0))
            .unwrap_or_default()
    };

    if leer("datafono_tipo") != "red" {
        return None;
    }
    let host = leer("datafono_host");
    if host.is_empty() {
        return None;
    }
    Some((host, leer("datafono_puerto").parse().unwrap_or(9100)))
}

fn uuid_v7() -> String {
    uuid::Uuid::now_v7().to_string()
}

/// El datáfono configurado en esta caja.
///
/// Por defecto, el manual: funciona con el aparato que el negocio ya tiene
/// sobre el mostrador, sin integrar nada con nadie. El integrado se activa
/// cuando hay uno y alguien lo configuró.
fn terminal(base: &rusqlite::Connection) -> Box<dyn Terminal> {
    let leer = |clave: &str| -> String {
        base.query_row("SELECT valor FROM ajustes WHERE clave = ?1", [clave], |f| f.get(0))
            .unwrap_or_default()
    };

    if leer("datafono_tipo") == "red" {
        let host = leer("datafono_host");
        let puerto = leer("datafono_puerto").parse().unwrap_or(9100);
        if !host.is_empty() {
            return Box::new(datafono_red::DatafonoRed { host, puerto });
        }
    }

    Box::new(pagos::DatafonoManual)
}

/// 80 mm es lo que trae casi toda impresora de mostrador que se vende aquí.
pub(crate) fn escpos_ancho_por_defecto() -> usize {
    escpos::ANCHO_80MM
}

fn ahora_epoch() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

#[derive(serde::Serialize)]
pub struct Producto {
    id: String,
    nombre: String,
    precio: i64,
    categoria: String,
    variante: String,
}

/// El catálogo sale de SQLite, nunca de la red: es lo que permite abrir la caja
/// a las 7 de la mañana sin internet.
#[tauri::command]
fn catalogo(estado: State<Estado>, busqueda: String) -> Result<Vec<Producto>, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    let patron = format!("%{}%", busqueda.trim());

    let mut consulta = base
        .prepare(
            "SELECT id, nombre, precio, categoria, variante FROM productos
             WHERE activo = 1 AND (?1 = '%%' OR nombre LIKE ?1 OR sku LIKE ?1)
             ORDER BY nombre LIMIT 200",
        )
        .map_err(|e| e.to_string())?;

    let filas = consulta
        .query_map([&patron], |f| {
            Ok(Producto {
                id: f.get(0)?,
                nombre: f.get(1)?,
                precio: f.get(2)?,
                categoria: f.get(3)?,
                variante: f.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    filas.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
pub struct Cobro {
    venta: venta::VentaRegistrada,
    /// Qué pasó con la tirilla. La venta ya está guardada pase lo que pase con
    /// la impresora, así que esto es un aviso, no un error de la venta.
    impresion: Option<String>,
}

/// Cobra.
///
/// Es `async` por una sola razón: un datáfono integrado puede tardar hasta un
/// minuto en contestar, y un comando síncrono bloquearía el hilo de la ventana.
/// El trabajo pesado se manda a un hilo aparte; la caja sigue respondiendo.
///
/// El orden importa y no es negociable: **primero se cobra la tarjeta, después
/// se registra la venta**. Al revés quedaría una venta registrada de un cobro
/// que el banco rechazó.
#[tauri::command]
async fn cobrar(
    estado: State<'_, Estado>,
    nueva: venta::NuevaVenta,
    voucher: Option<pagos::Voucher>,
) -> Result<Cobro, String> {
    let ahora = ahora_local();

    /* El turno y el cajero los pone el backend nativo, no la interfaz. Si
       vinieran del webview, bastaría con abrir las herramientas de desarrollo
       para firmar una venta a nombre de otro cajero, y el arqueo dejaría de
       señalar a nadie. */
    let mut nueva = {
        let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
        let turno = turnos::activo(&base)
            .map_err(|e| e.to_string())?
            .ok_or("Abre un turno antes de vender")?;
        let cajero = estado
            .sesion
            .lock()
            .ok()
            .and_then(|s| s.clone())
            .map(|u| u.nombre)
            .unwrap_or_else(|| turno.cajero.clone());

        venta::NuevaVenta { turno_id: turno.id, cajero, ..nueva }
    };

    if nueva.medio_pago == "tarjeta" {
        let total = venta::total_de(&nueva.items).map_err(|e| e.to_string())?;
        let (_, iva) = total.desglosar_iva(nueva.iva_porcentaje);

        let solicitud = pagos::SolicitudPago {
            operacion_id: uuid_v7(),
            monto: total,
            iva,
            referencia: nueva.turno_id.chars().take(8).collect(),
        };

        /* En un hilo aparte: el datáfono puede tardar un minuto y la ventana no
           puede quedarse congelada mientras tanto. El candado de la base se
           soltó arriba a propósito, para no retenerlo durante la espera. */
        let quien = {
            let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
            descripcion_terminal(&base)
        };
        let respuesta = tauri::async_runtime::spawn_blocking(move || {
            let aparato: Box<dyn Terminal> = match quien {
                Some((host, puerto)) => Box::new(datafono_red::DatafonoRed { host, puerto }),
                None => Box::new(pagos::DatafonoManual),
            };
            aparato.cobrar(&solicitud, voucher)
        })
        .await
        .map_err(|e| format!("el cobro se interrumpió: {e}"))?
        .map_err(|e| e.to_string())?;

        nueva.pago = Some(respuesta);
    }

    let registrada = {
        let mut base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
        venta::registrar(&mut base, &nueva, &ahora).map_err(|e| e.to_string())?
    };

    /* Guardada. De aquí en adelante nada puede perder la venta: lo que sigue
       es papel, y el papel se reimprime. */
    let (caja, cocina, negocio) = {
        let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
        (
            perifericos::leer_config(&base, "caja"),
            perifericos::leer_config(&base, "cocina"),
            estado.negocio.lock().unwrap().clone(),
        )
    };

    let bytes = tirilla(&negocio, caja.ancho, &nueva, &registrada);
    let impresion = perifericos::enviar(&caja.impresora, &bytes).err();

    /* La comanda va aparte y sin precios: en la cocina no se cobra, se prepara,
       y un papel con plata encima solo estorba. Que falle no se le reporta al
       cajero como un problema de la venta. */
    if !matches!(cocina.impresora, Impresora::Ninguna) {
        let comanda = comanda(cocina.ancho, &nueva, &registrada);
        let _ = perifericos::enviar(&cocina.impresora, &comanda);
    }

    Ok(Cobro { venta: registrada, impresion })
}

/// Abre la gaveta sin venta de por medio.
///
/// No pide supervisor —hacerlo paralizaría la fila cada vez que hay que dar un
/// cambio— pero **sí queda registrado**. Abrir el cajón de más es de las cosas
/// que más se abusan, y el patrón solo se ve si cada apertura deja rastro.
#[tauri::command]
fn abrir_cajon(estado: State<Estado>, motivo: String) -> Result<(), String> {
    anotar_excepcion(&estado, auditoria::TipoExcepcion::AbrirCajon, "", 0, &motivo, "");

    /* El pulso viaja por el mismo cable que la tirilla: el cajón cuelga del
       conector RJ11 de la impresora, no del computador. */
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    let config = perifericos::leer_config(&base, "caja");
    drop(base);

    let mut t = escpos::Tirilla::nueva(config.ancho);
    t.abrir_cajon();
    perifericos::enviar(&config.impresora, &t.terminar())
}

/// Deja constancia de una excepción con el cajero y el turno de verdad.
///
/// Que falle el registro no puede impedir la operación —el cliente está ahí
/// esperando— pero tampoco puede pasar inadvertido: queda en el log de la app.
fn anotar_excepcion(
    estado: &State<Estado>,
    tipo: auditoria::TipoExcepcion,
    detalle: &str,
    monto: i64,
    motivo: &str,
    autorizo: &str,
) {
    let Ok(mut base) = estado.base.lock() else { return };
    let turno = match turnos::activo(&base) {
        Ok(Some(t)) => t,
        _ => return,
    };
    let cajero = estado
        .sesion
        .lock()
        .ok()
        .and_then(|s| s.clone())
        .map(|u| u.nombre)
        .unwrap_or_else(|| turno.cajero.clone());

    if let Err(e) = auditoria::registrar(
        &mut base, &turno.id, tipo, detalle, monto, motivo, &cajero, autorizo, &ahora_local(),
    ) {
        eprintln!("no se pudo registrar la excepción: {e}");
    }
}

#[derive(serde::Serialize)]
pub struct EstadoSync {
    pendientes: i64,
    /// Lo que la nube rechazó y necesita que alguien lo mire.
    apartadas: i64,
}

/// Cuántas ventas faltan por subir. Va en la barra superior de la caja: el
/// negocio tiene que poder ver de un vistazo si está operando sin conexión.
#[tauri::command]
fn estado_sync(estado: State<Estado>) -> Result<EstadoSync, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    let (pendientes, apartadas) = sync::estado(&base).map_err(|e| e.to_string())?;
    Ok(EstadoSync { pendientes, apartadas })
}

#[tauri::command]
fn puertos_serie() -> Vec<String> {
    perifericos::puertos_serie()
}

/* ── Quién está en la caja ─────────────────────────────────────────────── */

#[tauri::command]
fn entrar(estado: State<Estado>, pin: String) -> Result<usuarios::Usuario, String> {
    let usuario = {
        let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
        usuarios::entrar(&base, &pin, ahora_epoch()).map_err(|e| e.to_string())?
    };
    *estado.sesion.lock().map_err(|_| "sesión ocupada".to_string())? = Some(usuario.clone());
    Ok(usuario)
}

/// Cierra la sesión: lo llama el botón y también el auto-bloqueo por inactividad.
#[tauri::command]
fn salir(estado: State<Estado>) {
    if let Ok(mut s) = estado.sesion.lock() {
        *s = None;
    }
}

#[tauri::command]
fn sesion(estado: State<Estado>) -> Option<usuarios::Usuario> {
    estado.sesion.lock().ok().and_then(|s| s.clone())
}

#[tauri::command]
fn hay_usuarios(estado: State<Estado>) -> bool {
    let Ok(base) = estado.base.lock() else { return false };
    usuarios::listar(&base).map(|u| !u.is_empty()).unwrap_or(false)
}

/// Crea el primer usuario o uno nuevo.
///
/// Mientras no exista ninguno, cualquiera puede crear el primero: es la
/// instalación. Después hace falta ser supervisor, porque si no, un cajero se
/// crearía a sí mismo un usuario con permisos y el control se acabó.
#[tauri::command]
fn crear_usuario(
    estado: State<Estado>,
    nombre: String,
    pin: String,
    supervisor: bool,
) -> Result<usuarios::Usuario, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    let primeros = usuarios::listar(&base).map(|u| u.is_empty()).unwrap_or(true);

    if !primeros {
        let soy_supervisor = estado
            .sesion
            .lock()
            .ok()
            .and_then(|s| s.clone())
            .map(|u| u.rol == usuarios::Rol::Supervisor)
            .unwrap_or(false);
        if !soy_supervisor {
            return Err("Solo un supervisor puede crear usuarios".into());
        }
    }

    let rol = if supervisor || primeros { usuarios::Rol::Supervisor } else { usuarios::Rol::Cajero };
    usuarios::guardar(&base, &nombre, &pin, rol).map_err(|e| e.to_string())
}

/* ── La fila de la hora pico ───────────────────────────────────────────── */

/// Aparta el carrito para cobrarle al siguiente.
#[tauri::command]
fn pausar_venta(
    estado: State<Estado>,
    carrito: String,
    etiqueta: String,
    total: i64,
    items: i64,
) -> Result<pausadas::EnEspera, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    let turno = turnos::activo(&base).map_err(|e| e.to_string())?.ok_or("No hay turno abierto")?;
    pausadas::pausar(&base, &turno.id, &carrito, &etiqueta, total, items, &ahora_local())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn listar_pausadas(estado: State<Estado>) -> Result<Vec<pausadas::EnEspera>, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    let Some(turno) = turnos::activo(&base).map_err(|e| e.to_string())? else {
        return Ok(vec![]);
    };
    pausadas::listar(&base, &turno.id).map_err(|e| e.to_string())
}

/// Devuelve el carrito y lo saca de la lista: retomar no deja copia.
#[tauri::command]
fn retomar_venta(estado: State<Estado>, id: String) -> Result<Option<String>, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    pausadas::retomar(&base, &id).map_err(|e| e.to_string())
}

/// Descarta una venta en espera. Queda registrada: es plata que no se cobró.
#[tauri::command]
fn descartar_pausada(estado: State<Estado>, id: String, motivo: String) -> Result<(), String> {
    let (detalle, monto) = {
        let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
        let turno = turnos::activo(&base).map_err(|e| e.to_string())?.ok_or("No hay turno abierto")?;
        let ficha = pausadas::listar(&base, &turno.id)
            .map_err(|e| e.to_string())?
            .into_iter()
            .find(|p| p.id == id);
        match ficha {
            Some(f) => (f.etiqueta, f.total),
            None => return Ok(()),
        }
    };

    anotar_excepcion(&estado, auditoria::TipoExcepcion::DescartarPausada, &detalle, monto, &motivo, "");

    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    pausadas::descartar(&base, &id).map_err(|e| e.to_string())
}

/* ── Autorizaciones ────────────────────────────────────────────────────── */

/// Verifica el PIN de un supervisor **sin cambiar la sesión**.
///
/// Es la diferencia entre "el supervisor autoriza y se va" y "el supervisor
/// queda logueado y el cajero sigue vendiendo con su usuario". Lo segundo
/// borraría de un plumazo toda la trazabilidad del turno.
#[tauri::command]
fn autorizar(estado: State<Estado>, pin: String) -> Result<String, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    let quien = usuarios::entrar(&base, &pin, ahora_epoch()).map_err(|e| e.to_string())?;

    if quien.rol != usuarios::Rol::Supervisor {
        return Err("Ese PIN no es de un supervisor".into());
    }
    Ok(quien.nombre)
}

/// Anula una línea ya marcada. Exige el nombre de quien autorizó.
#[tauri::command]
fn anular_item(
    estado: State<Estado>,
    detalle: String,
    monto: i64,
    motivo: String,
    autorizo: String,
) -> Result<(), String> {
    if autorizo.trim().is_empty() {
        return Err("Falta la autorización de un supervisor".into());
    }
    if motivo.trim().len() < 3 {
        return Err("Dile por qué se anula".into());
    }
    anotar_excepcion(&estado, auditoria::TipoExcepcion::AnularItem, &detalle, monto, &motivo, &autorizo);
    Ok(())
}

/// Registra un descuento puesto a mano.
#[tauri::command]
fn registrar_descuento(
    estado: State<Estado>,
    detalle: String,
    monto: i64,
    motivo: String,
    autorizo: String,
) -> Result<(), String> {
    if autorizo.trim().is_empty() {
        return Err("Falta la autorización de un supervisor".into());
    }
    if motivo.trim().len() < 3 {
        return Err("Dile por qué se descuenta".into());
    }
    anotar_excepcion(&estado, auditoria::TipoExcepcion::Descuento, &detalle, monto, &motivo, &autorizo);
    Ok(())
}

/* ── El turno ──────────────────────────────────────────────────────────── */

#[tauri::command]
fn turno_activo(estado: State<Estado>) -> Result<Option<turnos::Turno>, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    turnos::activo(&base).map_err(|e| e.to_string())
}

#[tauri::command]
fn abrir_turno(estado: State<Estado>, fondo: i64) -> Result<turnos::Turno, String> {
    let usuario = estado
        .sesion
        .lock()
        .ok()
        .and_then(|s| s.clone())
        .ok_or("Entra con tu PIN antes de abrir el turno")?;

    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    turnos::abrir(&base, &usuario.id, &usuario.nombre, Pesos(fondo), &ahora_local())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn mover_efectivo(
    estado: State<Estado>,
    entrada: bool,
    monto: i64,
    motivo: String,
) -> Result<(), String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    let turno = turnos::activo(&base).map_err(|e| e.to_string())?.ok_or("No hay turno abierto")?;
    let quien = estado
        .sesion
        .lock()
        .ok()
        .and_then(|s| s.clone())
        .map(|u| u.nombre)
        .unwrap_or_default();

    turnos::mover_efectivo(&base, &turno.id, entrada, Pesos(monto), &motivo, &quien, &ahora_local())
        .map_err(|e| e.to_string())?;

    // La gaveta se abre sola: el cajero va a meter o sacar plata de ahí mismo.
    let config = perifericos::leer_config(&base, "caja");
    let mut t = escpos::Tirilla::nueva(config.ancho);
    t.abrir_cajon();
    let _ = perifericos::enviar(&config.impresora, &t.terminar());

    Ok(())
}

/// Cierra el turno con lo que el cajero contó.
///
/// El conteo entra como parámetro y el esperado se calcula después: no existe
/// ningún comando que devuelva el esperado antes de contar, porque sería el
/// final del arqueo ciego.
#[tauri::command]
fn cerrar_turno(estado: State<Estado>, contado: i64) -> Result<turnos::CierreTurno, String> {
    let cierre = {
        let mut base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
        turnos::cerrar(&mut base, Pesos(contado), &ahora_local()).map_err(|e| e.to_string())?
    };

    // Terminado el turno, la caja queda bloqueada esperando el próximo PIN.
    if let Ok(mut s) = estado.sesion.lock() {
        *s = None;
    }

    Ok(cierre)
}

/// Guarda contra qué MenuBy trabaja esta caja.
///
/// La URL en la base y el token en el llavero. El token **nunca** vuelve a
/// pasar por SQLite, ni siquiera de paso.
#[tauri::command]
fn configurar_nube(estado: State<Estado>, url: String, token: String) -> Result<(), String> {
    credenciales::guardar(token.trim())?;

    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    base.execute(
        "INSERT INTO ajustes (clave, valor) VALUES ('nube_url', ?1)
         ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
        rusqlite::params![url.trim_end_matches('/')],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Desconecta la caja de MenuBy: borra la credencial del llavero.
///
/// No toca ventas ni turnos. Es para cuando el equipo cambia de dueño o sale a
/// reparación: lo que se va es la llave, no la historia.
#[tauri::command]
fn desconectar_nube() -> Result<(), String> {
    credenciales::borrar()
}

/* ── Las impresoras ────────────────────────────────────────────────────── */

#[tauri::command]
fn impresoras(estado: State<Estado>) -> Result<serde_json::Value, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    Ok(serde_json::json!({
        "caja": perifericos::leer_config(&base, "caja"),
        "cocina": perifericos::leer_config(&base, "cocina"),
        "puertos": perifericos::puertos_serie(),
    }))
}

#[tauri::command]
fn configurar_impresora(
    estado: State<Estado>,
    rol: String,
    config: perifericos::Config,
) -> Result<(), String> {
    if rol != "caja" && rol != "cocina" {
        return Err("Solo hay impresora de caja y de cocina".into());
    }
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    perifericos::guardar_config(&base, &rol, &config)
}

/// Imprime una prueba. Es lo que se usa al configurar: si no sale el papel, el
/// problema es la impresora y no la venta que todavía no se ha hecho.
#[tauri::command]
async fn probar_impresora(estado: State<'_, Estado>, rol: String) -> Result<(), String> {
    let config = {
        let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
        perifericos::leer_config(&base, &rol)
    };

    if matches!(config.impresora, Impresora::Ninguna) {
        return Err("Esa impresora no está configurada".into());
    }

    let mut t = escpos::Tirilla::nueva(config.ancho);
    t.alinear(escpos::Alineacion::Centro)
        .negrita(true)
        .linea("PRUEBA DE IMPRESIÓN")
        .negrita(false)
        .linea(&format!("Impresora de {rol}"))
        .alinear(escpos::Alineacion::Izquierda)
        .separador()
        // Con tildes y Ñ a propósito: es la prueba de que la tabla de
        // caracteres quedó bien.
        .linea("Áéíóú Ññ ¿? ¡!")
        .par("Ancho del papel", &format!("{} caracteres", config.ancho))
        .separador()
        .cortar();

    let bytes = t.terminar();
    tauri::async_runtime::spawn_blocking(move || perifericos::enviar(&config.impresora, &bytes))
        .await
        .map_err(|e| e.to_string())?
}

/// Reimprime una venta ya cobrada.
///
/// Sin id, la última del turno: es el caso real, el cajero acaba de cobrar y la
/// impresora no tenía papel. **No vuelve a cobrar nada** y no abre el cajón: la
/// venta ya ocurrió y la gaveta ya se abrió una vez.
#[tauri::command]
async fn reimprimir(estado: State<'_, Estado>, venta_id: Option<String>) -> Result<(), String> {
    let (completa, config, negocio) = {
        let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;

        let id = match venta_id {
            Some(id) => id,
            None => {
                let turno = turnos::activo(&base)
                    .map_err(|e| e.to_string())?
                    .ok_or("No hay turno abierto")?;
                venta::ultima_del_turno(&base, &turno.id)
                    .map_err(|e| e.to_string())?
                    .ok_or("Todavía no hay ventas en este turno")?
            }
        };

        let completa = venta::detalle(&base, &id)
            .map_err(|e| e.to_string())?
            .ok_or("Esa venta no está en esta caja")?;

        (
            completa,
            perifericos::leer_config(&base, "caja"),
            estado.negocio.lock().unwrap().clone(),
        )
    };

    let bytes = tirilla_de(&negocio, config.ancho, &completa, true);
    tauri::async_runtime::spawn_blocking(move || perifericos::enviar(&config.impresora, &bytes))
        .await
        .map_err(|e| e.to_string())?
}

/* ── El datáfono ───────────────────────────────────────────────────────── */

#[derive(serde::Serialize)]
pub struct InfoTerminal {
    nombre: String,
    /// Si es true, la caja tiene que pedirle el voucher al cajero.
    requiere_digitacion: bool,
}

#[tauri::command]
fn info_terminal(estado: State<Estado>) -> Result<InfoTerminal, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    let aparato = terminal(&base);
    Ok(InfoTerminal {
        nombre: aparato.nombre().to_string(),
        requiere_digitacion: aparato.requiere_digitacion(),
    })
}

/// Conecta un datáfono integrado, o vuelve al manual con `red = false`.
#[tauri::command]
fn configurar_datafono(
    estado: State<Estado>,
    red: bool,
    host: String,
    puerto: u16,
) -> Result<(), String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    for (clave, valor) in [
        ("datafono_tipo", if red { "red" } else { "manual" }.to_string()),
        ("datafono_host", host.trim().to_string()),
        ("datafono_puerto", puerto.to_string()),
    ] {
        base.execute(
            "INSERT INTO ajustes (clave, valor) VALUES (?1, ?2)
             ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
            rusqlite::params![clave, valor],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/* ── La pantalla del cliente ───────────────────────────────────────────── */

/// Abre la segunda pantalla. Si no hay, lo dice y la caja sigue igual.
#[tauri::command]
fn abrir_pantalla_cliente(app: tauri::AppHandle) -> Result<(), String> {
    cliente::abrir(&app)
}

#[tauri::command]
fn cerrar_pantalla_cliente(app: tauri::AppHandle) {
    cliente::cerrar(&app);
}

#[tauri::command]
fn hay_pantalla_cliente(app: tauri::AppHandle) -> bool {
    cliente::esta_abierta(&app)
}

/// ¿Esta caja ya está emparejada con un negocio?
#[tauri::command]
fn conectada(estado: State<Estado>) -> bool {
    let Ok(base) = estado.base.lock() else { return false };
    leer_nube(&base).is_some()
}

#[derive(serde::Serialize, Default)]
pub struct ResumenSync {
    enviadas: usize,
    fallidas: usize,
    apartadas: usize,
    catalogo: usize,
    error: Option<String>,
}

/// Sube lo pendiente y baja el catálogo. Lo llama el botón y también el hilo
/// de fondo; es la misma operación, solo cambia quién la dispara.
#[tauri::command]
fn sincronizar(estado: State<Estado>) -> ResumenSync {
    let mut base = match estado.base.lock() {
        Ok(b) => b,
        Err(_) => return ResumenSync { error: Some("base ocupada".into()), ..Default::default() },
    };

    let Some(destino) = leer_nube(&base) else {
        return ResumenSync { error: Some("Esta caja todavía no está conectada a MenuBy".into()), ..Default::default() };
    };

    /* Primero suben las ventas y después baja el catálogo. El orden importa: si
       el catálogo llegara primero y la bajada fallara, las ventas —que es lo
       único irrecuperable— se quedarían esperando otra vuelta. */
    let cola = sync::procesar_cola(&base, &destino, 200, ahora_epoch(), &ahora_local())
        .unwrap_or_default();

    let (catalogo, error) = match nube::bajar_catalogo(&mut base, &destino) {
        Ok(n) => (n, None),
        Err(e) => (0, Some(e)),
    };

    ResumenSync {
        enviadas: cola.enviadas,
        fallidas: cola.fallidas,
        apartadas: cola.apartadas,
        catalogo,
        error,
    }
}

/// La tirilla de una venta releída de la base. Es la que se reimprime.
///
/// Una reimpresión va marcada: un segundo papel idéntico al original es un
/// comprobante duplicado, y con eso se devuelve mercancía dos veces.
fn tirilla_de(negocio: &str, ancho: usize, v: &venta::VentaCompleta, copia: bool) -> Vec<u8> {
    let mut t = escpos::Tirilla::nueva(ancho);

    t.alinear(escpos::Alineacion::Centro)
        .negrita(true)
        .linea(negocio)
        .negrita(false)
        .linea(&format!("Venta #{}", v.consecutivo))
        .linea(&v.creada_en);

    if copia {
        t.negrita(true).linea("*** COPIA ***").negrita(false);
    }

    t.alinear(escpos::Alineacion::Izquierda).separador();

    for item in &v.items {
        let nombre = if item.variante.is_empty() {
            item.nombre.clone()
        } else {
            format!("{} ({})", item.nombre, item.variante)
        };
        let total_linea = item.total().unwrap_or(Pesos::CERO);
        t.par(&format!("{} x{}", nombre, item.cantidad), &total_linea.to_string());
    }

    t.separador();

    if v.iva > Pesos::CERO {
        t.par("IVA incluido", &v.iva.to_string());
    }

    t.doble(true).par("TOTAL", &v.total.to_string()).doble(false);

    if v.medio_pago == "efectivo" && v.recibido > Pesos::CERO {
        t.par("Recibido", &v.recibido.to_string());
        t.par("Cambio", &v.vuelto.to_string());
    } else {
        t.par("Pago", &v.medio_pago);
        if !v.pago_ultimos4.is_empty() {
            t.par("Tarjeta", &format!("**** {}", v.pago_ultimos4));
        }
        if !v.pago_autorizacion.is_empty() {
            t.par("Aprobación", &v.pago_autorizacion);
        }
    }

    t.salto()
        .alinear(escpos::Alineacion::Centro)
        .linea(&format!("Le atendió {}", v.cajero))
        .linea("¡Gracias por tu compra!")
        // Una copia no abre el cajón: la gaveta ya se abrió cuando se cobró.
        .cortar();

    t.terminar()
}

/// La comanda de cocina: qué preparar, sin un solo precio.
///
/// Letra grande y una línea por producto. Quien la lee está de pie frente a una
/// plancha, no sentado revisando una cuenta.
fn comanda(ancho: usize, nueva: &venta::NuevaVenta, registrada: &venta::VentaRegistrada) -> Vec<u8> {
    let mut t = escpos::Tirilla::nueva(ancho);

    t.alinear(escpos::Alineacion::Centro)
        .doble(true)
        .linea(&format!("PEDIDO #{}", registrada.consecutivo))
        .doble(false)
        .linea(&registrada.creada_en)
        .alinear(escpos::Alineacion::Izquierda)
        .separador();

    for item in &nueva.items {
        let nombre = if item.variante.is_empty() {
            item.nombre.clone()
        } else {
            format!("{} ({})", item.nombre, item.variante)
        };
        t.doble(true).linea(&format!("{} x{}", item.cantidad, nombre)).doble(false);
    }

    t.separador().cortar();
    t.terminar()
}

/// Arma la tirilla. Vive aquí y no en el núcleo porque es presentación: qué se
/// imprime y en qué orden es una decisión del negocio, no del dominio.
fn tirilla(
    negocio: &str,
    ancho: usize,
    nueva: &venta::NuevaVenta,
    registrada: &venta::VentaRegistrada,
) -> Vec<u8> {
    let mut t = escpos::Tirilla::nueva(ancho);

    t.alinear(escpos::Alineacion::Centro)
        .negrita(true)
        .linea(negocio)
        .negrita(false)
        .linea(&format!("Venta #{}", registrada.consecutivo))
        .linea(&registrada.creada_en)
        .alinear(escpos::Alineacion::Izquierda)
        .separador();

    for item in &nueva.items {
        let nombre = if item.variante.is_empty() {
            item.nombre.clone()
        } else {
            format!("{} ({})", item.nombre, item.variante)
        };
        let total_linea = item.total().unwrap_or(Pesos::CERO);
        t.par(&format!("{} x{}", nombre, item.cantidad), &total_linea.to_string());
    }

    t.separador();

    if registrada.iva > Pesos::CERO {
        t.par("IVA incluido", &registrada.iva.to_string());
    }

    t.doble(true)
        .par("TOTAL", &registrada.total.to_string())
        .doble(false);

    if nueva.medio_pago == "efectivo" && nueva.recibido > Pesos::CERO {
        t.par("Recibido", &nueva.recibido.to_string());
        t.par("Cambio", &registrada.vuelto.to_string());
    } else {
        t.par("Pago", &nueva.medio_pago);
    }

    t.salto()
        .alinear(escpos::Alineacion::Centro)
        .linea("¡Gracias por tu compra!")
        // El cajón abre con la tirilla, en el mismo flujo: si va aparte, abre
        // antes de que termine de salir el papel.
        .abrir_cajon()
        .cortar();

    t.terminar()
}

fn ahora_local() -> String {
    // Hora del equipo: la caja es la fuente de la hora de la venta, no la nube.
    // Si el reloj está corrido, lo que se corrige es el equipo.
    time::OffsetDateTime::now_local()
        .unwrap_or_else(|_| time::OffsetDateTime::now_utc())
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            /* La base va en el directorio de datos de la app, no junto al
               ejecutable: en Windows, Program Files es de solo lectura para el
               usuario que atiende la caja. */
            let carpeta = app.path().app_data_dir().expect("sin directorio de datos");
            std::fs::create_dir_all(&carpeta).ok();
            let base = db::abrir(&carpeta.join("pos.db")).expect("no se pudo abrir la base local");

            /* Cajas que ya venían con el token en SQLite: se mueve al llavero y
               se borra de la base. De una sola vía y en cada arranque, porque
               una caja puede estar días sin actualizarse. */
            if credenciales::migrar_desde_sqlite(&base) {
                println!("El token del negocio se movió al llavero del sistema");
            }

            app.manage(Estado {
                base: Mutex::new(base),
                negocio: Mutex::new("MenuBy POS".into()),
                sesion: Mutex::new(None),
            });

            /* Un hilo aparte, no un temporizador en el webview: la caja tiene
               que seguir subiendo ventas aunque la ventana esté minimizada o el
               cajero deje la pantalla en el mismo sitio toda la tarde.

               Cada 30 segundos es suficiente: lo urgente (cobrar, imprimir) ya
               pasó, y el backoff de la cola manda sobre esta frecuencia cuando
               el backend está caído. */
            let mango = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(std::time::Duration::from_secs(30));
                let estado = mango.state::<Estado>();
                let _ = sincronizar(estado);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            catalogo,
            cobrar,
            abrir_cajon,
            estado_sync,
            configurar_nube,
            desconectar_nube,
            conectada,
            impresoras,
            configurar_impresora,
            probar_impresora,
            reimprimir,
            info_terminal,
            configurar_datafono,
            abrir_pantalla_cliente,
            cerrar_pantalla_cliente,
            hay_pantalla_cliente,
            sincronizar,
            puertos_serie,
            entrar,
            salir,
            sesion,
            hay_usuarios,
            crear_usuario,
            turno_activo,
            abrir_turno,
            mover_efectivo,
            cerrar_turno,
            pausar_venta,
            listar_pausadas,
            retomar_venta,
            descartar_pausada,
            autorizar,
            anular_item,
            registrar_descuento
        ])
        .run(tauri::generate_context!())
        .expect("error arrancando el POS");
}
