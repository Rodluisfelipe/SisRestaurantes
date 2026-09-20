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

use pos_core::{auditoria, db, dinero::Pesos, escpos, pausadas, sync, turnos, usuarios, venta};
use std::sync::Mutex;
use tauri::{Manager, State};

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
    pub impresora: Mutex<Impresora>,
    pub ancho_tirilla: Mutex<usize>,
    pub negocio: Mutex<String>,
    /// Quién tiene la caja ahora mismo. Se cierra sola por inactividad.
    pub sesion: Mutex<Option<usuarios::Usuario>>,
}

/// A dónde sincronizar. Vacío = caja sin configurar: vende igual, pero no sube.
fn leer_nube(base: &rusqlite::Connection) -> Option<Nube> {
    let leer = |clave: &str| -> String {
        base.query_row("SELECT valor FROM ajustes WHERE clave = ?1", [clave], |f| f.get(0))
            .unwrap_or_default()
    };
    let (url, token) = (leer("nube_url"), leer("nube_token"));
    if url.is_empty() || token.is_empty() {
        return None;
    }
    Some(Nube { base: url, token })
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

#[tauri::command]
fn cobrar(estado: State<Estado>, nueva: venta::NuevaVenta) -> Result<Cobro, String> {
    let ahora = ahora_local();

    /* El turno y el cajero los pone el backend nativo, no la interfaz. Si
       vinieran del webview, bastaría con abrir las herramientas de desarrollo
       para firmar una venta a nombre de otro cajero, y el arqueo dejaría de
       señalar a nadie. */
    let nueva = {
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

    let registrada = {
        let mut base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
        venta::registrar(&mut base, &nueva, &ahora).map_err(|e| e.to_string())?
    };

    // Guardada. De aquí en adelante, nada puede perder la venta.
    let bytes = {
        let ancho = *estado.ancho_tirilla.lock().unwrap();
        let negocio = estado.negocio.lock().unwrap().clone();
        tirilla(&negocio, ancho, &nueva, &registrada)
    };

    let destino = estado.impresora.lock().unwrap().clone();
    let impresion = perifericos::enviar(&destino, &bytes).err();

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

    let ancho = *estado.ancho_tirilla.lock().unwrap();
    let mut t = escpos::Tirilla::nueva(ancho);
    t.abrir_cajon();
    let destino = estado.impresora.lock().unwrap().clone();
    perifericos::enviar(&destino, &t.terminar())
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
    let ancho = *estado.ancho_tirilla.lock().unwrap();
    let mut t = escpos::Tirilla::nueva(ancho);
    t.abrir_cajon();
    let destino = estado.impresora.lock().unwrap().clone();
    let _ = perifericos::enviar(&destino, &t.terminar());

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
#[tauri::command]
fn configurar_nube(estado: State<Estado>, url: String, token: String) -> Result<(), String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    for (clave, valor) in [("nube_url", url.trim_end_matches('/')), ("nube_token", token.as_str())] {
        base.execute(
            "INSERT INTO ajustes (clave, valor) VALUES (?1, ?2)
             ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
            rusqlite::params![clave, valor],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
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

            app.manage(Estado {
                base: Mutex::new(base),
                impresora: Mutex::new(Impresora::Ninguna),
                ancho_tirilla: Mutex::new(escpos::ANCHO_80MM),
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
