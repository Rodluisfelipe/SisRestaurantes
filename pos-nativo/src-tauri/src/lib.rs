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
use pos_core::busqueda;
use pos_core::negocio;
use pos_core::{
    auditoria, cuentas, db, devoluciones, dinero::Pesos, escpos, pausadas, sync, turnos, usuarios,
    venta,
};
use std::sync::Mutex;
use tauri::{Emitter, Manager, State};

mod cliente;
mod credenciales;
mod datafono_red;
mod configuracion;
mod fotos;
mod nube;
mod pedidos_web;
mod reloj;
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
    /// Dónde guarda la app sus cosas. Aquí van las fotos del catálogo.
    pub datos: std::path::PathBuf,
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
fn descripcion_terminal(base: &rusqlite::Connection) -> Option<(String, u16, u64)> {
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
    Some((
        host,
        leer("datafono_puerto").parse().unwrap_or(9100),
        leer("datafono_espera").parse().unwrap_or(60),
    ))
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
        let espera = leer("datafono_espera").parse().unwrap_or(60);
        if !host.is_empty() {
            return Box::new(datafono_red::DatafonoRed { host, puerto, espera });
        }
    }

    Box::new(pagos::DatafonoManual)
}

/// 80 mm es lo que trae casi toda impresora de mostrador que se vende aquí.
pub(crate) fn escpos_ancho_por_defecto() -> usize {
    escpos::ANCHO_80MM
}

/// El instante en segundos, ya corregido contra el servidor.
///
/// Lo usa la espera de la cola. Con un reloj en 1970, una venta encolada
/// quedaría con un "reintentar después de" cincuenta y seis años en el pasado
/// —o en el futuro al cambiar la pila— y no se subiría nunca.
fn ahora_epoch() -> i64 {
    reloj::ahora_epoch()
}

#[derive(serde::Serialize)]
pub struct Producto {
    id: String,
    nombre: String,
    precio: i64,
    categoria: String,
    variante: String,
    /// Nombre del archivo en la carpeta de fotos. Vacío = todavía no bajó.
    foto: String,
    /// Los grupos de extras, tal como bajaron de la nube.
    ///
    /// Va crudo hasta la pantalla: la caja no interpreta qué es un extra
    /// válido —eso lo decide el panel— solo lo dibuja para que el cajero
    /// elija.
    extras: serde_json::Value,
    /// "INC_8", "IVA_19" o "EXENTO". Viaja con la línea al venderse.
    tipo_impuesto: String,
}

/// El catálogo sale de SQLite, nunca de la red: es lo que permite abrir la caja
/// a las 7 de la mañana sin internet.
///
/// Quién coincide y en qué orden lo decide `pos_core::busqueda`: sin tildes,
/// por palabras, lo que empieza por lo escrito primero, y sin buscar, lo más
/// vendido arriba. Se filtra en Rust y no con `LIKE` porque SQLite no sabe
/// que "clasica" y "Clásica" son lo mismo.
#[tauri::command]
fn catalogo(
    estado: State<Estado>,
    busqueda: String,
    categoria: Option<String>,
) -> Result<Vec<Producto>, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    // Vacío = todas. Se filtra antes del límite: filtrar después dejaría
    // categorías sin nada.
    let cual = categoria.unwrap_or_default();
    let vendidas = populares_de_hoy(&base);

    struct Fila {
        id: String,
        nombre: String,
        precio: i64,
        categoria: String,
        variante: String,
        foto: String,
        extras: String,
        tipo_impuesto: String,
        sku: String,
        categoria_orden: i64,
    }

    let mut consulta = base
        .prepare(
            "SELECT id, nombre, precio, categoria, variante, foto_local, extras, tipo_impuesto,
                    sku, categoria_orden
               FROM productos
              WHERE activo = 1 AND (?1 = '' OR categoria = ?1)",
        )
        .map_err(|e| e.to_string())?;

    let filas = consulta
        .query_map(rusqlite::params![&cual], |f| {
            Ok(Fila {
                id: f.get(0)?,
                nombre: f.get(1)?,
                precio: f.get(2)?,
                categoria: f.get(3)?,
                variante: f.get(4)?,
                foto: f.get(5)?,
                extras: f.get(6)?,
                tipo_impuesto: f.get(7)?,
                sku: f.get(8)?,
                categoria_orden: f.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let candidatas: Vec<_> = filas
        .iter()
        .map(|f| busqueda::Candidata {
            nombre: &f.nombre,
            variante: &f.variante,
            sku: &f.sku,
            categoria_orden: f.categoria_orden,
            vendidas: vendidas
                .get(&busqueda::clave(&f.id, &f.variante))
                .copied()
                .unwrap_or(0),
        })
        .collect();

    Ok(busqueda::ordenar(&busqueda, &candidatas, 200)
        .into_iter()
        .map(|i| {
            let f = &filas[i];
            Producto {
                id: f.id.clone(),
                nombre: f.nombre.clone(),
                precio: f.precio,
                categoria: f.categoria.clone(),
                variante: f.variante.clone(),
                foto: f.foto.clone(),
                /* Un JSON corrupto no puede dejar el catálogo sin cargar: ese
                   producto se queda sin extras y los demás siguen vendiéndose. */
                extras: serde_json::from_str(&f.extras).unwrap_or_else(|_| serde_json::json!([])),
                tipo_impuesto: f.tipo_impuesto.clone(),
            }
        })
        .collect())
}

/// Lo más vendido, contado una vez por día.
///
/// El catálogo se pide en cada tecla —el lector de códigos escribe trece por
/// código—, y sumar treinta días de ventas en cada una sería trabajo repetido
/// para una respuesta que no cambia hasta mañana. Se recalcula cuando cambia
/// la fecha.
fn populares_de_hoy(base: &rusqlite::Connection) -> std::collections::HashMap<String, i64> {
    use std::sync::{Mutex, OnceLock};
    static CACHE: OnceLock<Mutex<(String, std::collections::HashMap<String, i64>)>> = OnceLock::new();

    let hoy: String = ahora_local().chars().take(10).collect();
    let cache = CACHE.get_or_init(|| Mutex::new((String::new(), Default::default())));
    let Ok(mut c) = cache.lock() else { return Default::default() };
    if c.0 != hoy {
        /* Si falla, se ordena por la carta y se reintenta mañana: el orden es
           una ayuda, no algo por lo que valga la pena no mostrar productos. */
        c.1 = busqueda::populares(base, &hoy).unwrap_or_default();
        c.0 = hoy;
    }
    c.1.clone()
}

/// Un producto por su id, para las recompensas.
///
/// El canje dice "producto gratis" y trae el id, no el nombre: hay que ir a
/// buscarlo. Lo trae aunque esté desactivado, a propósito: si el negocio apagó
/// el producto pero dejó la recompensa encendida, entregarlo es mejor que
/// dejar al cliente sin lo que ya pagó con sus puntos, y el problema real —una
/// recompensa que apunta a algo descatalogado— se arregla en el panel.
#[tauri::command]
fn producto_por_id(estado: State<Estado>, id: String) -> Result<Option<Producto>, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;

    let mut consulta = base
        .prepare(
            "SELECT id, nombre, precio, categoria, variante, foto_local, extras, tipo_impuesto
               FROM productos WHERE id = ?1 LIMIT 1",
        )
        .map_err(|e| e.to_string())?;

    let mut filas = consulta
        .query_map(rusqlite::params![id], |f| {
            Ok(Producto {
                id: f.get(0)?,
                nombre: f.get(1)?,
                precio: f.get(2)?,
                categoria: f.get(3)?,
                variante: f.get(4)?,
                foto: f.get(5)?,
                extras: serde_json::from_str(&f.get::<_, String>(6)?)
                    .unwrap_or_else(|_| serde_json::json!([])),
                tipo_impuesto: f.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    match filas.next() {
        Some(f) => Ok(Some(f.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

/// La dirección desde la que el webview puede leer las fotos.
///
/// La carpeta se expone por el protocolo de recursos de Tauri, acotada a esta
/// ruta y nada más. Es la primera vez que el webview lee del disco, y por eso
/// está acotada: lo que hay ahí son imágenes de catálogo, no la base de datos
/// ni el llavero.
#[tauri::command]
fn carpeta_fotos(estado: State<Estado>) -> String {
    fotos::carpeta(&estado.datos).to_string_lossy().to_string()
}

/// Las categorías que de verdad tienen algo que vender, **en el orden del panel**.
///
/// Salen de los productos y no de una tabla aparte: una categoría vacía en
/// pantalla es un botón que el cajero toca y no le muestra nada, y con
/// cuarenta platos en carta eso pasa seguido.
///
/// El orden es el que el dueño puso en MenuBy, no el alfabético. Alfabético
/// pone "Adiciones" antes que "Hamburguesas", y el cajero se sabe su carta
/// por el orden del panel —el mismo que ve el cliente en el menú—.
///
/// `MIN` porque la categoría se agrupa: todas sus filas traen el mismo orden,
/// pero SQLite necesita una función para agregarlo. El nombre desempata, para
/// que dos categorías con el mismo orden no bailen entre bajadas.
#[tauri::command]
fn categorias(estado: State<Estado>) -> Result<Vec<String>, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;

    let mut consulta = base
        .prepare(
            "SELECT categoria FROM productos
             WHERE activo = 1 AND categoria != ''
             GROUP BY categoria
             ORDER BY MIN(categoria_orden), categoria",
        )
        .map_err(|e| e.to_string())?;

    let filas = consulta
        .query_map([], |f| f.get::<_, String>(0))
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

    /* Cuánto va al datáfono. Con pago mixto **no es el total**: si el cliente
       pone treinta mil en billetes y veinte con tarjeta, cobrarle el total a la
       tarjeta le saca cincuenta mil de la cuenta y le deja los billetes en la
       mano. Es el error más caro que podría cometer esta función, y por eso el
       monto sale de las líneas de pago y no del medio de la venta. */
    let al_datafono = {
        let total = venta::total_de(&nueva.items).map_err(|e| e.to_string())?;

        if !nueva.pagos.is_empty() {
            let mut suma = Pesos::CERO;
            for p in nueva.pagos.iter().filter(|p| !p.es_efectivo()) {
                suma = suma.mas(p.monto).ok_or("El total es demasiado grande")?;
            }
            suma
        } else if nueva.medio_pago == "tarjeta" {
            total
        } else {
            Pesos::CERO
        }
    };

    if al_datafono > Pesos::CERO {
        /* El IVA que se le declara al datáfono es el de la parte que cobra, no
           el de la venta entera: es lo que va impreso en el voucher. */
        let (_, iva) = al_datafono.desglosar_iva(nueva.iva_porcentaje);

        let solicitud = pagos::SolicitudPago {
            operacion_id: uuid_v7(),
            monto: al_datafono,
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
                Some((host, puerto, espera)) => {
                    Box::new(datafono_red::DatafonoRed { host, puerto, espera })
                }
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
    let (completa, caja, cocina, negocio) = {
        let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
        (
            /* Se relee de la base en vez de armarla con lo que hay en memoria.
               Así la tirilla dice exactamente lo que quedó guardado: si alguna
               vez la venta se registra distinto de como se pidió, el papel lo
               muestra en vez de taparlo. */
            venta::detalle(&base, &registrada.id).ok().flatten(),
            perifericos::leer_config(&base, "caja"),
            perifericos::leer_config(&base, "cocina"),
            membrete(&base, &estado.negocio.lock().unwrap()),
        )
    };

    /* La misma tirilla de una reimpresión.
     *
     * Antes había dos: esta venta imprimía una versión corta que se había
     * quedado atrás, sin los extras, sin las notas, sin el descuento y sin el
     * desglose de impuestos. El cliente pagaba $4.000 de tocineta y el papel
     * decía solo "Hamburguesa x1". Y quien pedía una reimpresión recibía una
     * tirilla mejor que la del momento de comprar, que es justo al revés de
     * como tiene que ser.
     *
     * `copia: false` porque esta es la original. */
    let bytes = match &completa {
        Some(v) => tirilla_de(&negocio, caja.ancho, v, false),
        /* Si releerla falla, el cobro ya está hecho y el cliente está
           esperando su papel: se imprime la corta antes que nada. */
        None => tirilla(&negocio, caja.ancho, &nueva, &registrada),
    };
    /* La venta ya está guardada. Lo que sigue es papel, y el papel se
       reimprime: por eso su fallo se reporta como aviso y no revierte nada. */
    let impresion = imprimir(caja.impresora, bytes).await.err();

    /* La comanda va aparte y sin precios: en la cocina no se cobra, se prepara,
       y un papel con plata encima solo estorba. Que falle no se le reporta al
       cajero como un problema de la venta. */
    if !matches!(cocina.impresora, Impresora::Ninguna) {
        let comanda = comanda(cocina.ancho, &nueva, &registrada);
        perifericos::enviar_suelto(cocina.impresora, comanda);
    }

    Ok(Cobro { venta: registrada, impresion })
}

/// Abre la gaveta sin venta de por medio.
///
/// No pide supervisor —hacerlo paralizaría la fila cada vez que hay que dar un
/// cambio— pero **sí queda registrado**. Abrir el cajón de más es de las cosas
/// que más se abusan, y el patrón solo se ve si cada apertura deja rastro.
#[tauri::command]
async fn abrir_cajon(estado: State<'_, Estado>, motivo: String) -> Result<(), String> {
    anotar_excepcion(&estado, auditoria::TipoExcepcion::AbrirCajon, "", 0, &motivo, "");

    /* El pulso viaja por el mismo cable que la tirilla: el cajón cuelga del
       conector RJ11 de la impresora, no del computador. */
    let config = {
        let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
        perifericos::leer_config(&base, "caja")
    };

    let mut t = escpos::Tirilla::nueva(config.ancho);
    t.abrir_cajon();

    /* El cajero sí espera saber si abrió —si no, va a volver a tocar el botón
       y a dejar dos aperturas en la auditoría por una sola intención— pero se
       espera fuera del hilo que dibuja. */
    imprimir(config.impresora, t.terminar()).await
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

/* ── Cómo se ve la rejilla ─────────────────────────────────────────────

   Dos comandos propios en vez de un `guardar_ajuste(clave, valor)` genérico.
   La tabla `ajustes` guarda también el negocio al que responde la caja, la
   URL de la nube y las marcas de agua del catálogo: una escritura libre
   desde el webview dejaría todo eso al alcance de cualquier cosa que corra
   dentro. Dos comandos que solo saben de una clave no tienen esa superficie. */

/// Visual (con fotos) o expandido (denso, sin imágenes).
#[tauri::command]
fn modo_vista(estado: State<Estado>) -> String {
    let Ok(base) = estado.base.lock() else { return "visual".into() };
    let guardado: String = base
        .query_row("SELECT valor FROM ajustes WHERE clave = 'modo_vista'", [], |f| f.get(0))
        .unwrap_or_default();

    if guardado == "compacto" || guardado == "expandido" { "compacto".into() } else { "visual".into() }
}

/// Guarda cómo prefiere ver la carta esta terminal.
///
/// Es de la **terminal y no del cajero**: la pantalla grande del mostrador y
/// la chica de la barra quieren densidades distintas, y quien las conoce es
/// quien está parado ahí, no quien entra con su PIN esa tarde.
#[tauri::command]
fn guardar_modo_vista(estado: State<Estado>, modo: String) -> Result<(), String> {
    // Solo los dos que existen: cualquier otra cosa dejaría la rejilla en blanco.
    /* `expandido` es como se llamaba antes de encoger las casillas. Se sigue
       aceptando para que una terminal que lo tenía guardado no despierte en
       modo visual sin que nadie haya tocado nada. */
    let limpio = if modo == "compacto" || modo == "expandido" { "compacto" } else { "visual" };

    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    base.execute(
        "INSERT INTO ajustes (clave, valor) VALUES ('modo_vista', ?1)
         ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
        rusqlite::params![limpio],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
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
///
/// **El primero además entra.** La pantalla del PIN usa este comando cuando
/// la caja no tiene usuarios, así que quien acaba de poner su PIN espera
/// estar dentro —y la pantalla ya lo saluda por su nombre—. Sin abrirle la
/// sesión aquí, el núcleo seguía sin nadie en la caja y lo primero que hacía
/// esa persona, abrir el turno, fallaba con un "entra con tu PIN" delante de
/// una pantalla que decía "Hola, Daniel".
///
/// Un usuario creado **por un supervisor** no entra: el supervisor sigue
/// siendo quien está en la caja. Cambiar la sesión ahí le pondría las ventas
/// a nombre del cajero recién creado, que ni siquiera está en el mostrador.
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
    let creado = usuarios::guardar(&base, &nombre, &pin, rol).map_err(|e| e.to_string())?;

    if primeros {
        /* Se suelta la base antes de tomar la sesión. Los dos candados nunca
           se piden en este orden en ningún otro sitio, así que hoy no hay
           abrazo mortal posible; soltarlo igual es lo que hace que siga sin
           haberlo cuando alguien agregue el que falta. */
        drop(base);
        *estado.sesion.lock().map_err(|_| "sesión ocupada".to_string())? = Some(creado.clone());
    }

    Ok(creado)
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

/* ── Cuentas abiertas ──────────────────────────────────────────────────────
   La mesa que pide en tandas y paga al final. No toca inventario ni entra a la
   cola hasta que se cobra: hasta entonces no ha vendido nada. */

/// Lo que devuelve guardar una ronda.
#[derive(serde::Serialize)]
struct RondaGuardada {
    cuenta: cuentas::Cuenta,
    /// Cuántas líneas bajaron a la cocina en esta ronda.
    a_cocina: usize,
    /// Qué salió mal con la impresora, si algo salió mal.
    ///
    /// La cuenta queda guardada igual: perder el pedido de una mesa porque la
    /// impresora se quedó sin papel sería el peor intercambio posible.
    impresion: Option<String>,
}

/// Abre la cuenta o le agrega la ronda que acaba de pedir la mesa.
///
/// A la cocina baja **solo lo nuevo**. Lo que decide qué es nuevo vive en el
/// núcleo y se prueba solo; aquí únicamente se imprime y, si el papel salió, se
/// deja constancia.
#[tauri::command]
async fn guardar_en_cuenta(
    estado: State<'_, Estado>,
    identificador: String,
    carrito: String,
    total: i64,
    items: i64,
) -> Result<RondaGuardada, String> {
    let nombre = identificador.trim().to_string();
    if nombre.is_empty() {
        return Err("Ponle un nombre a la cuenta, por ejemplo \"Mesa 3\"".into());
    }

    /* Lo que toca la base, en un bloque: al salir, el candado está suelto y la
       impresión puede tardar sus tres segundos sin trabar a nadie.

       En bloque y no con `drop`: Rust tiene que **poder demostrar** que el
       guardia no cruza el `await`, y un `drop` a mitad de función no se lo
       demuestra. */
    enum Siguiente {
        Listo(RondaGuardada),
        Imprimir(cuentas::Cuenta, perifericos::Impresora, Vec<u8>, usize),
    }

    let paso = {
        let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
        let turno = turnos::activo(&base).map_err(|e| e.to_string())?.ok_or("No hay turno abierto")?;

        let (cuenta, pendientes) =
            cuentas::guardar(&base, &turno.id, &nombre, &carrito, total, items, &ahora_local())
                .map_err(|e| e.to_string())?;

        if pendientes.is_empty() {
            Siguiente::Listo(RondaGuardada { cuenta, a_cocina: 0, impresion: None })
        } else {
            let cocina = perifericos::leer_config(&base, "cocina");
            if matches!(cocina.impresora, Impresora::Ninguna) {
                /* Sin impresora de cocina no hay comanda que mandar, pero la
                   ronda sí se da por despachada: si no, cada vez que la mesa
                   pidiera algo se volvería a contar lo anterior como
                   pendiente. */
                cuentas::marcar_comandado(&base, &cuenta.id, &carrito).map_err(|e| e.to_string())?;
                Siguiente::Listo(RondaGuardada { cuenta, a_cocina: 0, impresion: None })
            } else {
                let bytes = comanda_de(cocina.ancho, &cuenta.identificador, &pendientes, &ahora_local());
                Siguiente::Imprimir(cuenta, cocina.impresora, bytes, pendientes.len())
            }
        }
    };

    let (cuenta, impresora, bytes, cuantas) = match paso {
        Siguiente::Listo(r) => return Ok(r),
        Siguiente::Imprimir(c, i, b, n) => (c, i, b, n),
    };

    /* Esta impresión **sí** se espera: de que el papel haya salido depende que
       la ronda se marque como comandada, y marcarla sin que saliera dejaría
       esos platos sin cocinar para siempre. */
    let salio = imprimir(impresora, bytes).await;

    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    match salio {
        Ok(()) => {
            /* Se marca **después** de que el papel salió. Al revés, una
               impresora sin papel dejaría la ronda como enviada y esos platos
               no se cocinarían nunca. */
            cuentas::marcar_comandado(&base, &cuenta.id, &carrito).map_err(|e| e.to_string())?;
            Ok(RondaGuardada { cuenta, a_cocina: cuantas, impresion: None })
        }
        Err(e) => Ok(RondaGuardada { cuenta, a_cocina: 0, impresion: Some(e) }),
    }
}

#[tauri::command]
fn listar_cuentas(estado: State<Estado>) -> Result<Vec<cuentas::Cuenta>, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    let Some(turno) = turnos::activo(&base).map_err(|e| e.to_string())? else {
        return Ok(vec![]);
    };
    cuentas::listar(&base, &turno.id).map_err(|e| e.to_string())
}

/// Devuelve el pedido de una cuenta **sin cerrarla**.
///
/// A diferencia de retomar una venta en espera, esto no borra: la mesa sigue
/// sentada y puede pedir más.
#[tauri::command]
fn abrir_cuenta(estado: State<Estado>, id: String) -> Result<Option<String>, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    Ok(cuentas::por_id(&base, &id).map_err(|e| e.to_string())?.map(|c| c.carrito))
}

/// La precuenta: lo que la mesa lleva consumido.
///
/// **No abre el cajón y no cierra nada.** Es el papel que el cliente revisa
/// antes de pagar, y por eso va marcado como no válido como factura: si no lo
/// dijera, sería un comprobante de una venta que todavía no existe.
#[tauri::command]
async fn imprimir_precuenta(estado: State<'_, Estado>, id: String) -> Result<(), String> {
    /* Todo lo que necesita la base, dentro del bloque. Al salir, los candados
       están sueltos: la precuenta sí espera respuesta —el cajero tiene que
       saber si salió— y esperarla con la base tomada trabaría cualquier venta
       simultánea.

       En bloque y no con `drop`: Rust tiene que **poder demostrar** que el
       guardia no cruza el `await`, y un `drop` a mitad de función no se lo
       demuestra. */
    let (impresora, bytes) = {
        let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;

        let cuenta = cuentas::por_id(&base, &id)
            .map_err(|e| e.to_string())?
            .ok_or("Esa cuenta ya no está abierta")?;

        let items: Vec<venta::LineaVenta> = serde_json::from_str(&cuenta.carrito).unwrap_or_default();
        let caja = perifericos::leer_config(&base, "caja");
        let negocio = estado.negocio.lock().map(|n| n.clone()).unwrap_or_default();

        (caja.impresora, precuenta(&negocio, caja.ancho, &cuenta, &items, &ahora_local()))
    };

    imprimir(impresora, bytes).await
}

/// Cierra la cuenta después de que su venta ya quedó registrada.
#[tauri::command]
fn cerrar_cuenta(estado: State<Estado>, id: String) -> Result<(), String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    cuentas::cerrar(&base, &id).map_err(|e| e.to_string())
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
    // De qué mesa se quita, si la línea ya se mandó a la cocina.
    cuenta: Option<String>,
) -> Result<(), String> {
    if autorizo.trim().is_empty() {
        return Err("Falta la autorización de un supervisor".into());
    }
    if motivo.trim().len() < 3 {
        return Err("Dile por qué se anula".into());
    }

    let cajero = estado
        .sesion
        .lock()
        .ok()
        .and_then(|s| s.clone())
        .map(|u| u.nombre)
        .unwrap_or_default();

    anotar_excepcion(&estado, auditoria::TipoExcepcion::AnularItem, &detalle, monto, &motivo, &autorizo);

    /* Si el plato ya bajó a la cocina, la cocina tiene que enterarse **en
       papel**. Es el hueco por el que se va la plata: el cliente se come el
       plato, el cajero lo quita de la cuenta con un PIN, cobra de viva voz y
       ese dinero no entra al arqueo. Nadie lo descubre porque en la cuenta no
       queda nada que mirar.

       Con el papel encima del comandero, el jefe de cocina coteja lo anulado
       contra lo que tiene en la plancha. Si el plato ya salió, lo dice.

       Solo se imprime cuando la línea venía de una mesa: en mostrador se
       anula antes de cobrar y la cocina todavía no sabe que ese plato
       existía. */
    if let Some(mesa) = cuenta.filter(|m| !m.trim().is_empty()) {
        let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
        let cocina = perifericos::leer_config(&base, "cocina");

        if !matches!(cocina.impresora, Impresora::Ninguna) {
            let bytes = comanda_anulacion(cocina.ancho, &mesa, &detalle, &cajero, &autorizo, &motivo, &ahora_local());
            /* Que falle no revierte la anulación: la línea ya se quitó y el
               supervisor ya autorizó. Lo que se pierde es el aviso, y eso se
               resuelve hablando, no deshaciendo una operación autorizada.

               Y por eso mismo va en un hilo suelto: nadie está esperando este
               resultado, y esperarlo congelaría la caja tres segundos con la
               impresora de cocina apagada. */
            perifericos::enviar_suelto(cocina.impresora, bytes);
        }
    }

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

/* ── Devoluciones ──────────────────────────────────────────────────────────
   Plata que sale de la gaveta sin nada vendido a cambio. Por eso pasa por PIN
   de supervisor, deja motivo escrito y no borra la venta original. */

/// Una venta de esta caja, para encontrar la que hay que devolver.
#[derive(serde::Serialize)]
struct VentaBuscada {
    id: String,
    consecutivo: i64,
    total: i64,
    creada_en: String,
}

/// Las últimas ventas, la más reciente primero.
///
/// El cliente que vuelve casi siempre acaba de salir, y el número que trae en
/// la mano es el consecutivo.
#[tauri::command]
fn ventas_recientes(estado: State<Estado>) -> Result<Vec<VentaBuscada>, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    let filas = devoluciones::ultimas_ventas(&base, 40).map_err(|e| e.to_string())?;

    Ok(filas
        .into_iter()
        .map(|(id, consecutivo, total, creada_en)| VentaBuscada { id, consecutivo, total, creada_en })
        .collect())
}

/// Una línea de la venta con lo que todavía se puede devolver de ella.
#[derive(serde::Serialize)]
struct LineaDevolvible {
    producto_id: String,
    nombre: String,
    variante: String,
    precio: i64,
    /// Cuántas se vendieron.
    cantidad: i64,
    /// Cuántas quedan por devolver, ya descontando devoluciones anteriores.
    quedan: i64,
}

#[tauri::command]
fn lineas_devolvibles(estado: State<Estado>, venta_id: String) -> Result<Vec<LineaDevolvible>, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;

    Ok(devoluciones::devolubles(&base, &venta_id)
        .map_err(|e| e.to_string())?
        .into_iter()
        .map(|(l, quedan)| LineaDevolvible {
            producto_id: l.producto_id,
            nombre: l.nombre,
            variante: l.variante,
            precio: l.precio.0,
            cantidad: l.cantidad,
            quedan,
        })
        .collect())
}

/// Devuelve parte o todo de una venta.
///
/// El cajero llega aquí con el PIN de un supervisor ya validado. Quién autoriza
/// y el motivo quedan escritos, y el precio lo pone la venta original: devolver
/// a un precio distinto del que se cobró es la forma silenciosa de sacar plata
/// de la caja.
#[tauri::command]
fn devolver(
    estado: State<Estado>,
    venta_id: String,
    items: Vec<venta::LineaVenta>,
    medio: String,
    motivo: String,
    autorizo: String,
) -> Result<devoluciones::Devolucion, String> {
    let cajero = estado
        .sesion
        .lock()
        .ok()
        .and_then(|s| s.clone())
        .map(|u| u.nombre)
        .unwrap_or_default();

    let ahora = ahora_local();
    let registrada = {
        let mut base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
        devoluciones::registrar(&mut base, &venta_id, &items, &medio, &motivo, &cajero, &autorizo, &ahora)
            .map_err(|e| e.to_string())?
    };

    /* Queda también en la auditoría del turno, junto a las anulaciones y los
       descuentos: quien revise las excepciones del día tiene que verlas todas
       en la misma lista, no en tres sitios distintos. */
    anotar_excepcion(
        &estado,
        auditoria::TipoExcepcion::Descuento,
        &format!("Devolución de la venta #{}", registrada.consecutivo),
        registrada.total.0,
        &motivo,
        &autorizo,
    );

    /* El papel de la devolución. Se imprime después de registrarla, igual que
       la venta: si falla la impresora, la devolución ya está hecha. */
    {
        let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
        let caja = perifericos::leer_config(&base, "caja");
        let negocio = estado.negocio.lock().map(|n| n.clone()).unwrap_or_default();
        let bytes = comprobante_devolucion(&negocio, caja.ancho, &registrada, &items);
        // La devolución ya está hecha: el papel no la condiciona.
        perifericos::enviar_suelto(caja.impresora, bytes);
    }

    Ok(registrada)
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

    /* La gaveta se abre sola: el cajero va a meter o sacar plata de ahí
       mismo. Va en un hilo suelto porque este comando es síncrono —corre en
       el hilo que dibuja— y con la impresora apagada el pulso tarda los tres
       segundos del tiempo de espera. Tres segundos de ventana congelada por
       un movimiento de caja que ya quedó registrado. */
    let config = perifericos::leer_config(&base, "caja");
    let mut t = escpos::Tirilla::nueva(config.ancho);
    t.abrir_cajon();
    perifericos::enviar_suelto(config.impresora, t.terminar());

    Ok(())
}

/// Anota que se quitó una línea que todavía era borrador.
///
/// No pide nada y no puede fallar hacia afuera: el cajero ya quitó la línea en
/// la pantalla y la fila sigue avanzando. Si el registro falla, queda en el log
/// de la app —igual que cualquier otra excepción— pero la caja no se detiene.
///
/// Que exista este registro es lo que permite que el arqueo cuente el patrón:
/// marcar diez productos y borrarlos antes de cobrar es como se ve un cobro de
/// palabra sin registro fiscal, y sin contarlo no se ve nunca.
#[tauri::command]
fn anular_borrador(estado: State<Estado>, detalle: String, monto: i64) {
    anotar_excepcion(
        &estado,
        auditoria::TipoExcepcion::AnularBorrador,
        &detalle,
        monto.max(0),
        "Quitado antes de mandar a cocina",
        "",
    );
}

/// Imprime el acta del cierre.
///
/// Va aparte de `cerrar_turno` a propósito: el turno tiene que quedar cerrado
/// aunque la impresora esté sin papel. Si el cierre dependiera de imprimir, un
/// rollo acabado a las once de la noche dejaría la caja con el turno abierto y
/// al cajero sin poder irse.
#[tauri::command]
async fn imprimir_arqueo(app: tauri::AppHandle, cierre: turnos::CierreTurno) -> Result<(), String> {
    let (config, negocio) = {
        let estado = app.state::<Estado>();
        let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
        let quien = estado.negocio.lock().ok().map(|n| n.clone()).unwrap_or_default();
        (perifericos::leer_config(&base, "caja"), quien)
    };

    imprimir(config.impresora, turnos::tirilla_arqueo(&cierre, &negocio, config.ancho)).await
}

/// Cierra el turno con lo que el cajero contó.
///
/// El conteo entra como parámetro y el esperado se calcula después: no existe
/// ningún comando que devuelva el esperado antes de contar, porque sería el
/// final del arqueo ciego.
/// Cierra el turno y aprovecha para dejar la base compacta.
///
/// Es el único momento del día en que la caja está garantizadamente quieta, y
/// el único donde se puede hacer un `TRUNCATE` del WAL sin frenar a nadie.
#[tauri::command]
fn cerrar_turno(estado: State<Estado>, contado: i64) -> Result<turnos::CierreTurno, String> {
    let cierre = {
        let mut base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
        turnos::cerrar(&mut base, Pesos(contado), &ahora_local()).map_err(|e| e.to_string())?
    };

    /* La base, compacta. Aquí y no en mitad del servicio: un TRUNCATE del
       WAL sí bloquea, y el cierre es el único momento en que no hay nadie
       cobrando. */
    if let Ok(base) = estado.base.lock() {
        db::compactar(&base);
    }

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

#[derive(serde::Serialize)]
pub struct Emparejada {
    negocio: String,
    /// Para poder avisar antes de que la caja se quede muda.
    vence_en_dias: i64,
}

/// Vincula esta caja con el código que el dueño sacó del panel.
#[tauri::command]
async fn vincular(
    estado: State<'_, Estado>,
    url: String,
    codigo: String,
) -> Result<Emparejada, String> {
    let base = url.trim_end_matches('/').to_string();
    let limpia = base.clone();

    let resultado = tauri::async_runtime::spawn_blocking(move || {
        nube::vincular(&limpia, &codigo)
    })
    .await
    .map_err(|e| e.to_string())??;

    /* El negocio se resuelve **antes** de guardar el token.

       Si la caja venía de otro local, lo replicado de ese local se tira aquí.
       Y si quedan ventas suyas sin subir, esto falla y no se guarda nada: la
       caja sigue siendo del negocio anterior, que es la única forma de que
       esas ventas todavía puedan llegar a donde tienen que llegar. */
    {
        let mut conexion = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
        let quien = nube::negocio_del_token(&resultado.token);
        negocio::cambiar_a(&mut conexion, &quien, &ahora_local()).map_err(|e| e.to_string())?;
    }

    credenciales::guardar(&resultado.token)?;

    let conexion = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    conexion
        .execute(
            "INSERT INTO ajustes (clave, valor) VALUES ('nube_url', ?1)
             ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
            rusqlite::params![base],
        )
        .map_err(|e| e.to_string())?;

    Ok(Emparejada { negocio: resultado.negocio, vence_en_dias: resultado.vence_en_dias })
}

/// Empareja esta caja con un negocio.
///
/// Recibe la sesión del panel —la que el dueño copia una vez— y guarda a cambio
/// el token largo de la caja en el llavero del sistema. La sesión del panel no
/// se guarda en ninguna parte: se usa y se descarta.
#[tauri::command]
async fn emparejar(
    estado: State<'_, Estado>,
    url: String,
    token_panel: String,
    caja: String,
) -> Result<Emparejada, String> {
    let base = url.trim_end_matches('/').to_string();
    let limpia = base.clone();

    let resultado = tauri::async_runtime::spawn_blocking(move || {
        nube::emparejar(&limpia, &token_panel, &caja)
    })
    .await
    .map_err(|e| e.to_string())??;

    /* El negocio se resuelve **antes** de guardar el token.

       Si la caja venía de otro local, lo replicado de ese local se tira aquí.
       Y si quedan ventas suyas sin subir, esto falla y no se guarda nada: la
       caja sigue siendo del negocio anterior, que es la única forma de que
       esas ventas todavía puedan llegar a donde tienen que llegar. */
    {
        let mut conexion = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
        let quien = nube::negocio_del_token(&resultado.token);
        negocio::cambiar_a(&mut conexion, &quien, &ahora_local()).map_err(|e| e.to_string())?;
    }

    credenciales::guardar(&resultado.token)?;

    let conexion = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    conexion
        .execute(
            "INSERT INTO ajustes (clave, valor) VALUES ('nube_url', ?1)
             ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
            rusqlite::params![base],
        )
        .map_err(|e| e.to_string())?;

    Ok(Emparejada { negocio: resultado.negocio, vence_en_dias: resultado.vence_en_dias })
}

/// Comprueba que la caja puede hablar con MenuBy ahora mismo.
#[tauri::command]
async fn probar_nube(estado: State<'_, Estado>) -> Result<(), String> {
    let destino = {
        let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
        leer_nube(&base).ok_or("Esta caja todavía no está conectada a MenuBy")?
    };

    tauri::async_runtime::spawn_blocking(move || nube::probar(&destino))
        .await
        .map_err(|e| e.to_string())?
}

/// A qué MenuBy apunta esta caja. Sin el token: eso no sale del llavero.
#[tauri::command]
fn url_nube(estado: State<Estado>) -> String {
    let Ok(base) = estado.base.lock() else { return String::new() };
    base.query_row("SELECT valor FROM ajustes WHERE clave = 'nube_url'", [], |f| f.get(0))
        .unwrap_or_default()
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

    // Mismo criterio que con el datáfono: el mostrador manda sobre su hardware.
    configuracion::soltar_del_panel(&base);
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
    imprimir(config.impresora, bytes).await
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
            membrete(&base, &estado.negocio.lock().unwrap()),
        )
    };

    let bytes = tirilla_de(&negocio, config.ancho, &completa, true);
    imprimir(config.impresora, bytes).await
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

/* ── Pedidos web ─────────────────────────────────────────────────────────
 *
 * Los de la nube: se listan, se mueven y se imprimen. Ver `pedidos_web`. */

/// El destino en la nube, o por qué no hay.
fn destino_nube(estado: &Estado) -> Result<nube::Nube, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    leer_nube(&base).ok_or_else(|| "Esta caja todavía no está conectada a MenuBy".to_string())
}

#[tauri::command]
async fn pedidos_web(app: tauri::AppHandle) -> Result<Vec<pedidos_web::PedidoWeb>, String> {
    // La red no se espera con la base tomada: el destino se lee y se suelta.
    tauri::async_runtime::spawn_blocking(move || {
        let destino = destino_nube(&app.state::<Estado>())?;
        pedidos_web::listar(&destino)
    })
    .await
    .unwrap_or_else(|e| Err(format!("la consulta se interrumpió: {e}")))
}

#[tauri::command]
async fn mover_pedido_web(app: tauri::AppHandle, id: String, estado: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let destino = destino_nube(&app.state::<Estado>())?;
        pedidos_web::mover(&destino, &id, &estado)
    })
    .await
    .unwrap_or_else(|e| Err(format!("el cambio se interrumpió: {e}")))
}

/// Imprime un pedido web: la tirilla con precios en la caja y, si hay
/// impresora de cocina, la comanda sin precios allá.
#[tauri::command]
async fn imprimir_pedido_web(
    estado: State<'_, Estado>,
    pedido: pedidos_web::PedidoWeb,
) -> Result<(), String> {
    let (caja, cocina, negocio) = {
        let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
        (
            perifericos::leer_config(&base, "caja"),
            perifericos::leer_config(&base, "cocina"),
            estado.negocio.lock().map(|n| n.clone()).unwrap_or_default(),
        )
    };
    let ahora = ahora_local();
    if !matches!(cocina.impresora, Impresora::Ninguna) {
        perifericos::enviar_suelto(cocina.impresora, pedidos_web::comanda(cocina.ancho, &pedido, &ahora));
    }
    imprimir(caja.impresora, pedidos_web::tirilla(&negocio, caja.ancho, &pedido, &ahora)).await
}

/// Cómo va el turno abierto: ventas, lo más vendido y la lista para
/// reimprimir. Sin totales por medio: el arqueo es ciego.
#[tauri::command]
fn resumen_turno(estado: State<Estado>) -> Result<turnos::Resumen, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    let turno = turnos::activo(&base)
        .map_err(|e| e.to_string())?
        .ok_or("No hay turno abierto")?;
    turnos::resumen(&base, &turno.id).map_err(|e| e.to_string())
}

/* ── Agotados ──────────────────────────────────────────────────────────── */

/// Marca un producto agotado (o de vuelta a la venta) en la nube y aquí.
///
/// El reflejo local es inmediato: el cajero que tocó "agotado" no puede
/// seguir viéndolo en la carta hasta la próxima sincronización. Van todas sus
/// filas, tallas incluidas.
#[tauri::command]
async fn marcar_agotado(app: tauri::AppHandle, producto_id: String, agotado: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let estado = app.state::<Estado>();
        let destino = destino_nube(&estado)?;
        nube::marcar_disponible(&destino, &producto_id, !agotado)?;

        let base_id = producto_id.split(':').next().unwrap_or_default().to_string();
        if let Ok(base) = estado.base.lock() {
            let _ = base.execute(
                "UPDATE productos SET activo = ?2 WHERE id = ?1 OR id LIKE ?1 || ':%'",
                rusqlite::params![base_id, if agotado { 0 } else { 1 }],
            );
        }
        Ok(())
    })
    .await
    .unwrap_or_else(|e| Err(format!("el cambio se interrumpió: {e}")))
}

/// Un producto que no se está vendiendo.
#[derive(serde::Serialize)]
struct Apagado {
    id: String,
    nombre: String,
    categoria: String,
}

/// Lo que está apagado: agotado desde aquí o desde el panel. Una fila por
/// producto aunque tenga tallas, porque se enciende entero.
#[tauri::command]
fn apagados(estado: State<Estado>) -> Result<Vec<Apagado>, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    let mut consulta = base
        .prepare(
            "SELECT CASE WHEN instr(id, ':') > 0 THEN substr(id, 1, instr(id, ':') - 1) ELSE id END AS base_id,
                    MIN(nombre), MIN(categoria)
               FROM productos
              WHERE activo = 0
              GROUP BY base_id
              ORDER BY MIN(nombre)
              LIMIT 200",
        )
        .map_err(|e| e.to_string())?;
    let filas = consulta
        .query_map([], |f| Ok(Apagado { id: f.get(0)?, nombre: f.get(1)?, categoria: f.get(2)? }))
        .map_err(|e| e.to_string())?;
    filas.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Lo que la nube rechazó y quedó apartado, con el motivo.
#[tauri::command]
fn apartadas(estado: State<Estado>) -> Result<Vec<sync::Apartada>, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    sync::apartadas(&base).map_err(|e| e.to_string())
}

/// Vuelve a encolar lo apartado y sube de una.
#[tauri::command]
async fn reintentar_apartadas(app: tauri::AppHandle) -> Result<ResumenSync, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let estado = app.state::<Estado>();
        {
            let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
            sync::reintentar_apartadas(&base).map_err(|e| e.to_string())?;
        }
        Ok(sincronizar_ahora(&estado, &app))
    })
    .await
    .unwrap_or_else(|e| Err(format!("el reintento se interrumpió: {e}")))
}

/// Lo que el panel decide sobre el trato de esta caja con el cajero.
///
/// Estos valores bajaban con la configuración y se guardaban, pero la
/// pantalla no tenía cómo leerlos: el auto-bloqueo quedaba en 90 segundos y la
/// propina en cero, dijera lo que dijera el panel.
#[derive(serde::Serialize)]
struct AjustesCaja {
    auto_bloqueo_segundos: u64,
    /// `None` si el panel nunca lo dijo: manda lo que el cajero tenga puesto.
    sonido_activo: Option<bool>,
    propina_en_mesas: bool,
    propina_sugerida: u8,
    nombre_caja: String,
}

#[tauri::command]
fn ajustes_caja(estado: State<Estado>) -> Result<AjustesCaja, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    let leer = |clave: &str| -> Option<String> {
        base.query_row("SELECT valor FROM ajustes WHERE clave = ?1", [clave], |f| f.get(0)).ok()
    };
    Ok(AjustesCaja {
        auto_bloqueo_segundos: leer("auto_bloqueo_segundos")
            .and_then(|v| v.parse().ok())
            .map(|n: u64| n.clamp(30, 300))
            .unwrap_or(90),
        sonido_activo: leer("sonido_activo").map(|v| v != "0"),
        propina_en_mesas: leer("propina_en_mesas").is_none_or(|v| v != "0"),
        propina_sugerida: leer("propina_sugerida")
            .and_then(|v| v.parse().ok())
            .map(|n: u8| n.min(50))
            .unwrap_or(10),
        nombre_caja: leer("caja_nombre").unwrap_or_default(),
    })
}

/// Conecta un datáfono integrado, o vuelve al manual con `red = false`.
#[tauri::command]
fn configurar_datafono(
    estado: State<Estado>,
    red: bool,
    host: String,
    puerto: u16,
    espera: Option<u64>,
) -> Result<(), String> {
    let anfitrion = host.trim().to_string();

    /* Un datáfono de red sin dirección es un datáfono que no existe, y la venta
       se quedaría esperando un aparato inalcanzable con el cliente al frente.
       Se atrapa al guardar, que es cuando hay alguien mirando la pantalla de
       ajustes, y no en mitad de un cobro. */
    if red && anfitrion.is_empty() {
        return Err("Escribe la dirección del datáfono".into());
    }
    if red && puerto == 0 {
        return Err("El puerto tiene que ser mayor que cero".into());
    }

    /* Entre 5 y 180 segundos. Menos no le alcanza a nadie para pasar la tarjeta
       y digitar la clave; más deja la caja esperando un aparato que ya se
       colgó, y el cajero sin poder cobrarle al siguiente. */
    let segundos = espera.unwrap_or(60).clamp(5, 180);

    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;

    /* Quien está frente al aparato sabe más que el panel sobre en qué IP
       responde. A partir de aquí, la nube deja de pisarle el hardware a esta
       caja: cambiaron el router un domingo, el técnico ajustó la dirección, y
       un guardado cualquiera en el panel el lunes se la volvería a poner mal. */
    configuracion::soltar_del_panel(&base);

    for (clave, valor) in [
        ("datafono_tipo", if red { "red" } else { "manual" }.to_string()),
        ("datafono_host", anfitrion),
        ("datafono_puerto", puerto.to_string()),
        ("datafono_espera", segundos.to_string()),
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

/// Cómo está configurado el datáfono ahora mismo.
#[derive(serde::Serialize)]
struct ConfigDatafono {
    /// true = integrado por red. false = el manual, con voucher digitado.
    red: bool,
    host: String,
    puerto: u16,
    espera: u64,
}

/// Se lee de SQLite cada vez, no de una copia en memoria.
///
/// Es configuración que se toca una vez al instalar y se mira cuando algo
/// falla: una copia en memoria solo serviría para mostrar valores viejos
/// justo el día que alguien está intentando arreglar el aparato.
#[tauri::command]
fn config_datafono(estado: State<Estado>) -> Result<ConfigDatafono, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    let leer = |clave: &str| -> String {
        base.query_row("SELECT valor FROM ajustes WHERE clave = ?1", [clave], |f| f.get(0))
            .unwrap_or_default()
    };

    Ok(ConfigDatafono {
        red: leer("datafono_tipo") == "red",
        host: leer("datafono_host"),
        puerto: leer("datafono_puerto").parse().unwrap_or(9100),
        espera: leer("datafono_espera").parse().unwrap_or(60),
    })
}

/// Cuánto tarda el datáfono en contestar, en milisegundos.
#[derive(serde::Serialize)]
struct PruebaDatafono {
    milisegundos: u128,
}

/// Toca la puerta del datáfono sin cobrarle nada a nadie.
///
/// Abre el socket y lo cierra. No manda una transacción a propósito: probar la
/// configuración no puede terminar con un cobro de prueba en el extracto del
/// negocio.
///
/// Tres segundos de espera, mucho menos que los del cobro: aquí hay alguien
/// mirando la pantalla, y si el aparato no está, lo que se quiere es saberlo
/// rápido para corregir la dirección.
#[tauri::command]
async fn probar_datafono(host: String, puerto: u16) -> Result<PruebaDatafono, String> {
    let anfitrion = host.trim().to_string();
    if anfitrion.is_empty() {
        return Err("Escribe la dirección del datáfono".into());
    }

    tauri::async_runtime::spawn_blocking(move || {
        use std::net::ToSocketAddrs;

        let destino = format!("{anfitrion}:{puerto}");
        let inicio = std::time::Instant::now();

        /* Se resuelve el nombre antes de conectar para poder distinguir "esa
           dirección no existe" de "existe y no contesta". Son dos problemas
           distintos y se arreglan de forma distinta. */
        let mut direcciones = destino
            .to_socket_addrs()
            .map_err(|_| format!("No se entiende la dirección \"{destino}\""))?;

        let direccion = direcciones
            .next()
            .ok_or_else(|| format!("No se encontró \"{destino}\" en la red"))?;

        std::net::TcpStream::connect_timeout(&direccion, std::time::Duration::from_secs(3))
            .map_err(|e| match e.kind() {
                std::io::ErrorKind::TimedOut => {
                    "El datáfono no contestó en tres segundos. ¿Está encendido y en la misma red?".to_string()
                }
                std::io::ErrorKind::ConnectionRefused => {
                    format!("Algo contestó en {destino}, pero rechazó la conexión. ¿Es ese el puerto?")
                }
                _ => format!("No se pudo conectar: {e}"),
            })?;

        // La conexión se cierra al salir de aquí; no se manda nada por ella.
        Ok(PruebaDatafono { milisegundos: inicio.elapsed().as_millis() })
    })
    .await
    .unwrap_or_else(|e| Err(format!("la prueba se interrumpió: {e}")))
}

/// ¿Manda el panel sobre los aparatos de esta caja?
#[tauri::command]
fn hardware_del_panel(estado: State<Estado>) -> Result<bool, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    Ok(configuracion::sincronizar_hardware(&base))
}

/// Devuelve el mando de los periféricos al panel.
///
/// Se usa cuando el ajuste local ya no hace falta —se arregló la red, se
/// cambió la impresora— y el negocio quiere volver a administrarlo todo desde
/// un solo sitio. Lo que llegue en la próxima sincronización pisará lo local.
#[tauri::command]
fn devolver_hardware_al_panel(estado: State<Estado>) -> Result<(), String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    configuracion::devolver_al_panel(&base);
    Ok(())
}

/// El código de cobro por transferencia que configuró el negocio.
#[derive(serde::Serialize, Default)]
struct CobroQr {
    /// Si esta caja lo muestra en la pantalla del cliente.
    activo: bool,
    /// La cadena tal como la pegó el negocio, sin interpretar.
    ///
    /// **La caja no la modifica.** Los códigos EMVCo que usan los bancos
    /// colombianos —Bre-B, Redeban— van firmados: el campo de seguridad lo
    /// calcula el adquirente sobre el contenido, y meterle el monto rompe esa
    /// firma. Un QR alterado o lo rechaza el banco, con el cliente y su
    /// teléfono esperando frente a la caja, o lo acepta con los campos de
    /// impuesto que traía y queda un cobro mal declarado.
    ///
    /// Si la plantilla trae {monto} o {ref} —un enlace de pasarela, no un
    /// EMVCo— la pantalla sí los reemplaza: ahí no hay firma que romper.
    plantilla: String,
}

#[tauri::command]
fn cobro_qr(estado: State<Estado>) -> Result<CobroQr, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    let leer = |clave: &str| -> String {
        base.query_row("SELECT valor FROM ajustes WHERE clave = ?1", [clave], |f| f.get(0))
            .unwrap_or_default()
    };

    let plantilla = leer("plantilla_qr");

    Ok(CobroQr {
        /* Sin plantilla no hay nada que mostrar, aunque el panel diga que sí:
           un cuadro vacío en la pantalla del cliente es peor que no mostrar
           nada, porque el cajero cree que el cliente puede pagar. */
        activo: leer("mostrar_qr") == "1" && !plantilla.trim().is_empty(),
        plantilla,
    })
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
    /// Cuántos clientes se refrescaron en la copia local.
    clientes: usize,
    error: Option<String>,
}

/// Sube lo pendiente y baja el catálogo. Lo llama el botón y también el hilo
/// de fondo; es la misma operación, solo cambia quién la dispara.
/// Cómo se llama el negocio y de qué color es, para pintar la pantalla.
///
/// Es lo que separa una caja que parece un programa genérico de una que parece
/// del negocio. Los colores ya vienen validados como hexadecimales desde la
/// bajada del catálogo; vacío significa "usa el tuyo".
#[derive(serde::Serialize, Default)]
struct Identidad {
    nombre: String,
    color: String,
    color_texto: String,
}

#[tauri::command]
fn identidad(estado: State<Estado>) -> Identidad {
    let Ok(base) = estado.base.lock() else { return Identidad::default() };
    let leer = |clave: &str| -> String {
        base.query_row("SELECT valor FROM ajustes WHERE clave = ?1", [clave], |f| f.get(0))
            .unwrap_or_default()
    };
    Identidad {
        nombre: leer("negocio_nombre"),
        color: leer("marca_color"),
        color_texto: leer("marca_color_texto"),
    }
}

/* ── Clientes y fidelización ───────────────────────────────────────────────

   La búsqueda y la lista de recompensas salen de la copia local, así que
   responden sin internet y en el mismo instante en que el cajero teclea. El
   canje no: ese va contra el servidor, y más abajo se explica por qué. */

/// Buscar un cliente por teléfono, cédula o nombre.
#[tauri::command]
fn buscar_clientes(
    estado: State<Estado>,
    texto: String,
) -> Result<Vec<pos_core::clientes::FilaCliente>, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    pos_core::clientes::buscar(&base, &texto, 20).map_err(|e| e.to_string())
}

/// Da de alta un cliente desde el mostrador.
///
/// Entra a la copia local y a la cola en la misma transacción, así que el
/// cajero puede usarlo en la venta que está cobrando sin esperar a la red. Si
/// no hay internet, sube cuando la haya.
#[tauri::command]
fn crear_cliente(
    estado: State<Estado>,
    telefono: String,
    nombre: String,
    documento: String,
) -> Result<pos_core::clientes::FilaCliente, String> {
    let tel = telefono.trim();
    let nom = nombre.trim();
    if tel.is_empty() || nom.is_empty() {
        return Err("El cliente necesita teléfono y nombre".into());
    }

    let mut base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    pos_core::clientes::crear_local(&mut base, tel, nom, documento.trim(), &ahora_local())
        .map_err(|e| e.to_string())
}

/// Las recompensas que se pueden ofrecer ahora mismo.
#[tauri::command]
fn recompensas(
    estado: State<Estado>,
) -> Result<Vec<pos_core::clientes::FilaRecompensa>, String> {
    let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
    pos_core::clientes::recompensas(&base).map_err(|e| e.to_string())
}

/// Canjear puntos por una recompensa.
///
/// `async` y con la red fuera del candado, por las dos razones de siempre: un
/// comando no-async corre en el hilo que dibuja —y dejaría la ventana en "no
/// responde" mientras espera al servidor—, y sostener el candado de la base
/// durante una llamada HTTP trabaría cualquier otra cosa que el cajero
/// intentara hacer entre tanto.
#[tauri::command]
async fn canjear_recompensa(
    app: tauri::AppHandle,
    cliente_id: String,
    telefono: String,
    reward_id: String,
    venta_id: String,
    cajero: String,
) -> Result<nube::Canje, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let estado = app.state::<Estado>();

        // El destino se lee y el candado se suelta antes de tocar la red.
        let destino = {
            let base = estado.base.lock().map_err(|_| "base ocupada".to_string())?;
            leer_nube(&base).ok_or_else(|| {
                "Esta caja todavía no está conectada a MenuBy".to_string()
            })?
        };

        let canje = nube::canjear(&destino, &telefono, &reward_id, &venta_id, &cajero)?;

        /* El reflejo en la copia local, para que la pantalla no siga mostrando
           puntos que ya no existen. Si falla no se propaga: la nube ya
           descontó y el cliente ya tiene su recompensa —negársela porque una
           escritura de caché falló sería castigarlo por un problema nuestro—.
           La próxima sincronización lo corrige. */
        if !cliente_id.is_empty() {
            if let Ok(base) = estado.base.lock() {
                let _ = pos_core::clientes::reflejar_canje(
                    &base,
                    &cliente_id,
                    canje.puntos_gastados,
                );
            }
        }

        Ok(canje)
    })
    .await
    .unwrap_or_else(|_| Err("El canje se interrumpió".into()))
}

/// Sincroniza, sin ventana de por medio.
///
/// **No baja fotos.** Eso lo hace el hilo de fondo después de llamar aquí: son
/// hasta veinticinco descargas y no pueden estar dentro de la operación que el
/// cajero dispara con un botón.
fn sincronizar_ahora(estado: &Estado, app: &tauri::AppHandle) -> ResumenSync {
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

    let (catalogo, config_nueva, error) = match nube::bajar_catalogo(&mut base, &destino) {
        Ok(b) => (b.filas, b.configuracion, None),
        Err(e) => (0, None, Some(e)),
    };

    /* Los clientes, para poder buscarlos sin internet.

       Va después del catálogo y su fallo se anota pero no se propaga: una caja
       que no pudo bajar clientes vende igual, y castigar la sincronización
       entera por eso dejaría ventas sin subir, que es lo único irrecuperable. */
    let clientes = match nube::bajar_clientes(&mut base, &destino) {
        Ok(n) => n,
        Err(e) => {
            println!("Los clientes no se pudieron bajar: {e}");
            0
        }
    };

    /* Si el dueño le cambió el nombre al negocio en el panel, la próxima
       tirilla ya sale con el nuevo. Sin esto habría que reiniciar la caja. */
    if let Ok(nombre) = base.query_row::<String, _, _>(
        "SELECT valor FROM ajustes WHERE clave = 'negocio_nombre'", [], |f| f.get(0),
    ) {
        if !nombre.is_empty() {
            if let Ok(mut actual) = estado.negocio.lock() {
                *actual = nombre;
            }
        }
    }

    /* Si el panel cambió algo, la pantalla se entera y se redibuja sola. No
       hace falta reiniciar la caja ni cerrar el turno: el cajero ve el nombre
       nuevo, el color nuevo o el selector de propina aparecer mientras
       atiende, sin que nada se interrumpa. */
    if let Some(aplicada) = config_nueva {
        /* Se suelta el candado antes de avisar. El manejador de la pantalla
           corre en otro hilo y podría querer leer la base: avisar con el
           candado puesto es la forma más fácil de trabar las dos cosas. */
        drop(base);
        let _ = app.emit("pos:configuracion_actualizada", aplicada);

        return ResumenSync {
            enviadas: cola.enviadas,
            fallidas: cola.fallidas,
            apartadas: cola.apartadas,
            catalogo,
            clientes,
            error,
        };
    }

    ResumenSync {
        enviadas: cola.enviadas,
        fallidas: cola.fallidas,
        apartadas: cola.apartadas,
        catalogo,
        clientes,
        error,
    }
}

/// Sincroniza a petición del cajero, sin congelar la ventana.
///
/// Un comando de Tauri que no es `async` corre en el hilo principal, y este
/// habla con la red: subir la cola, bajar el catálogo. Mientras tanto la
/// ventana se queda sin responder, y con un catálogo grande o una conexión
/// mala eso son minutos con el cartel de "no responde" encima de la caja.
///
/// Es el mismo trato que ya recibía el datáfono, y por la misma razón: lo que
/// depende de la red nunca va en el hilo que dibuja.
#[tauri::command]
async fn sincronizar(app: tauri::AppHandle) -> ResumenSync {
    tauri::async_runtime::spawn_blocking(move || {
        let estado = app.state::<Estado>();
        sincronizar_ahora(&estado, &app)
    })
    .await
    .unwrap_or_else(|e| ResumenSync {
        error: Some(format!("la sincronización se interrumpió: {e}")),
        ..Default::default()
    })
}

/// La tirilla de una venta releída de la base. Es la que se reimprime.
///
/// Una reimpresión va marcada: un segundo papel idéntico al original es un
/// comprobante duplicado, y con eso se devuelve mercancía dos veces.
/// La cabecera de la tirilla: quién vende.
///
/// La misma que imprime el PrintAgent en los pedidos del menú —nombre,
/// dirección, teléfono y NIT—. Un cliente que pide factura, o que vuelve a
/// reclamar, necesita saber a qué negocio le compró; y un papel de la caja que
/// dice menos que el del domicilio parece de otro local.
#[derive(Clone)]
struct Membrete {
    nombre: String,
    nit: String,
    direccion: String,
    telefono: String,
    /// El texto del pie que el dueño escribió en el panel. Vacío = el de
    /// siempre.
    pie: String,
    /// Si la tirilla de una venta en efectivo abre la gaveta. Viene del
    /// panel; sin configuración, abre.
    cajon_al_cobrar: bool,
}

impl Default for Membrete {
    fn default() -> Self {
        Membrete {
            nombre: String::new(),
            nit: String::new(),
            direccion: String::new(),
            telefono: String::new(),
            pie: String::new(),
            cajon_al_cobrar: true,
        }
    }
}

impl Membrete {
    #[cfg(test)]
    fn solo(nombre: &str) -> Self {
        Membrete { nombre: nombre.into(), ..Default::default() }
    }

    fn pie(&self) -> &str {
        if self.pie.trim().is_empty() { "¡Gracias por tu compra!" } else { self.pie.trim() }
    }

    fn escribir(&self, t: &mut escpos::Tirilla) {
        t.negrita(true).linea(&self.nombre).negrita(false);
        /* Cada línea solo si hay algo: un "NIT:" pelado es peor que nada. */
        if !self.direccion.is_empty() {
            t.linea(&self.direccion);
        }
        if !self.telefono.is_empty() {
            t.linea(&format!("Tel: {}", self.telefono));
        }
        if !self.nit.is_empty() {
            t.linea(&format!("NIT: {}", self.nit));
        }
    }
}

/// Lee el membrete de lo que dejó la última bajada de catálogo.
fn membrete(base: &rusqlite::Connection, nombre: &str) -> Membrete {
    let leer = |clave: &str| -> String {
        base.query_row("SELECT valor FROM ajustes WHERE clave = ?1", [clave], |f| f.get(0))
            .unwrap_or_default()
    };
    Membrete {
        nombre: nombre.to_string(),
        nit: leer("negocio_nit"),
        direccion: leer("negocio_direccion"),
        telefono: leer("negocio_telefono"),
        pie: leer("texto_pie_factura"),
        cajon_al_cobrar: leer("cajon_al_cobrar") != "0",
    }
}

fn tirilla_de(negocio: &Membrete, ancho: usize, v: &venta::VentaCompleta, copia: bool) -> Vec<u8> {
    let mut t = escpos::Tirilla::nueva(ancho);

    t.alinear(escpos::Alineacion::Centro);
    negocio.escribir(&mut t);
    t.linea(&format!("Venta #{}", v.consecutivo))
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

        /* Los extras, desglosados con su precio. El cliente tiene derecho a
           ver por qué su hamburguesa costó tres mil más que la de la carta. */
        for extra in &item.extras {
            let veces = if extra.cantidad > 1 { format!(" x{}", extra.cantidad) } else { String::new() };
            let cuesta = extra.precio.por(extra.cantidad * item.cantidad).unwrap_or(Pesos::CERO);
            if cuesta > Pesos::CERO {
                t.par(&format!("   + {}{}", extra.nombre, veces), &cuesta.to_string());
            } else {
                t.linea(&format!("   + {}{}", extra.nombre, veces));
            }
        }

        // Lo que pidió el cliente, por si el plato hay que reclamarlo después.
        if !item.nota.is_empty() {
            t.linea(&format!("   {}", item.nota));
        }
    }

    t.separador();

    /* El descuento va escrito con el antes y el después. Una tirilla que solo
       dice "45.000" no le sirve a nadie para reclamar el descuento que le
       prometieron, ni al dueño para ver cuánto se regaló en el mes. */
    if v.descuento > Pesos::CERO {
        t.par("Subtotal", &v.bruto.to_string());
        t.par(
            &if v.descuento_motivo.is_empty() {
                "Descuento".to_string()
            } else {
                format!("Dcto: {}", v.descuento_motivo)
            },
            &format!("-{}", v.descuento),
        );
    }

    /* El desglose por régimen. Un local que vende almuerzo y cerveza tiene
       que poder mostrar las dos bases por separado: es lo que el cliente
       necesita para su contabilidad y lo que la DIAN espera ver. */
    if v.total_inc > Pesos::CERO {
        t.par("Base INC", &v.total_base_inc.to_string());
        t.par("INC 8%", &v.total_inc.to_string());
    }
    if v.total_iva > Pesos::CERO {
        t.par("Base IVA", &v.total_base_iva.to_string());
        t.par("IVA 19%", &v.total_iva.to_string());
    }
    if v.total_exento > Pesos::CERO && (v.total_inc > Pesos::CERO || v.total_iva > Pesos::CERO) {
        // Solo se nombra si convive con algo gravado; si no, es toda la venta.
        t.par("Exento", &v.total_exento.to_string());
    }

    /* La propina va **después** del total de la venta y con su propia línea.
       No se suma dentro: no es ingreso del negocio ni base gravable, y una
       tirilla que la esconda dentro del total impide al cliente ver qué
       aceptó pagar y al negocio separarla al liquidar. */
    if v.propina > Pesos::CERO {
        t.par("TOTAL", &v.total.to_string());
        t.par("Propina", &v.propina.to_string());
        let gran_total = v.total.mas(v.propina).unwrap_or(v.total);
        t.doble(true).par("A PAGAR", &gran_total.to_string()).doble(false);
    } else {
        t.doble(true).par("TOTAL", &v.total.to_string()).doble(false);
    }

    /* Con pago mixto hay que desglosar: "pagó con mixto" no le dice nada a
       nadie, y es justo la tirilla que alguien vuelve a mirar cuando no le
       cuadra un gasto. */
    if v.pagos.len() > 1 {
        for p in &v.pagos {
            let etiqueta = if p.referencia.is_empty() {
                p.metodo.clone()
            } else {
                format!("{} {}", p.metodo, p.referencia)
            };
            t.par(&etiqueta, &p.monto.to_string());
        }
        if v.vuelto > Pesos::CERO {
            t.par("Cambio", &v.vuelto.to_string());
        }
    } else if v.medio_pago == "efectivo" && v.recibido > Pesos::CERO {
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
        .linea(negocio.pie());

    /* La gaveta abre con la tirilla, en el mismo envío: si va aparte, abre
       antes de que termine de salir el papel. Solo si entró efectivo y el
       panel no lo apagó. Una copia nunca abre: la gaveta ya se abrió cuando
       se cobró, y una reimpresión que abre el cajón es plata a la vista sin
       venta de por medio. */
    let hubo_efectivo = v.pagos.iter().any(|p| p.metodo == "efectivo")
        || (v.pagos.is_empty() && v.medio_pago == "efectivo");
    if !copia && hubo_efectivo && negocio.cajon_al_cobrar {
        t.abrir_cajon();
    }
    t.cortar();

    t.terminar()
}

/// La comanda de cocina: qué preparar, sin un solo precio.
///
/// Letra grande y una línea por producto. Quien la lee está de pie frente a una
/// plancha, no sentado revisando una cuenta.
/// Imprime esperando el resultado, pero fuera del hilo que dibuja.
///
/// Para los papeles cuyo resultado sí importa: la tirilla de la venta, la
/// precuenta, la comanda de una ronda. Abrir el socket a una impresora apagada
/// tarda los tres segundos del tiempo de espera, y hacerlo en el hilo
/// principal es la ventana congelada con un cliente al frente.
async fn imprimir(destino: perifericos::Impresora, bytes: Vec<u8>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || perifericos::enviar(&destino, &bytes))
        .await
        .unwrap_or_else(|e| Err(format!("la impresión se interrumpió: {e}")))
}

/// El papel de una devolución.
///
/// Lleva el número de la venta original en grande: es lo que permite emparejar
/// este papel con la tirilla que el cliente trajo, y lo primero que busca quien
/// revise la caja al final del día.
///
/// Lleva también quién autorizó. Una devolución sin nombre encima es una salida
/// de efectivo que nadie firmó.
fn comprobante_devolucion(
    negocio: &str,
    ancho: usize,
    d: &devoluciones::Devolucion,
    items: &[venta::LineaVenta],
) -> Vec<u8> {
    let mut t = escpos::Tirilla::nueva(ancho);

    t.alinear(escpos::Alineacion::Centro)
        .negrita(true)
        .linea(negocio)
        .doble(true)
        .linea("DEVOLUCION")
        .doble(false)
        .negrita(false)
        .linea(&format!("De la venta #{}", d.consecutivo))
        .linea(&d.creada_en)
        .alinear(escpos::Alineacion::Izquierda)
        .separador();

    for item in items {
        let nombre = if item.variante.is_empty() {
            item.nombre.clone()
        } else {
            format!("{} ({})", item.nombre, item.variante)
        };
        let linea = item.precio.por(item.cantidad).unwrap_or(Pesos::CERO);
        t.par(&format!("{} x{}", nombre, item.cantidad), &linea.to_string());
    }

    t.separador()
        .doble(true)
        .par("DEVUELTO", &d.total.to_string())
        .doble(false)
        .par("En", &d.medio)
        .salto()
        .linea(&format!("Motivo: {}", d.motivo))
        .linea(&format!("Atendió: {}", d.cajero))
        .linea(&format!("Autorizó: {}", d.autorizo))
        .salto()
        .alinear(escpos::Alineacion::Centro)
        .linea("Conserve este comprobante")
        .cortar();

    t.terminar()
}

/// El aviso de que un plato ya mandado se anuló.
///
/// Va en grande y con marco, y no es estética: este papel tiene que saltar a
/// la vista entre diez comandas colgadas en el comandero. Si se confunde con
/// una comanda normal, el cocinero prepara el plato que acaban de anular.
#[allow(clippy::too_many_arguments)]
fn comanda_anulacion(
    ancho: usize,
    mesa: &str,
    detalle: &str,
    cajero: &str,
    autorizo: &str,
    motivo: &str,
    ahora: &str,
) -> Vec<u8> {
    let mut t = escpos::Tirilla::nueva(ancho);
    let marco = "*".repeat(ancho.min(48));

    t.alinear(escpos::Alineacion::Centro)
        .linea(&marco)
        .doble(true)
        .linea("ANULACION")
        .doble(false)
        .linea("NO PREPARAR")
        .linea(&marco)
        .alinear(escpos::Alineacion::Izquierda)
        .salto();

    t.doble(true).linea(&mesa.to_uppercase()).doble(false);
    t.linea(ahora).separador();

    t.doble(true).linea(&detalle.to_uppercase()).doble(false);

    t.separador()
        .linea(&format!("Quitó:    {cajero}"))
        .linea(&format!("Autorizó: {autorizo}"))
        .linea(&format!("Motivo:   {motivo}"))
        .salto()
        .alinear(escpos::Alineacion::Centro)
        .linea("Si ya salió, avisa a caja")
        .linea(&marco)
        .cortar_parcial();

    t.terminar()
}

/// La comanda de una ronda de mesa.
///
/// Lleva el nombre de la mesa en grande y arriba, porque en una cocina con seis
/// comandas colgadas lo primero que hay que saber es para dónde va el plato. Y
/// lleva solo lo nuevo: lo anterior ya está cocinado o cocinándose.
/// Cómo se leen los extras de una línea en la cocina.
///
/// El detalle que parece menor y no lo es: en una línea de dos unidades, los
/// extras son **de cada una**. Un `2 COMBO HAMBURGUESA / + PAPAS FRANCESA`
/// se lee como "dos combos y una papa", y el cocinero arma una bandeja
/// incompleta. Con el `(cada una)` no hay forma de leerlo mal.
///
/// Una línea con varias unidades tiene siempre los mismos extras: el carrito
/// solo agrupa lo que coincide exactamente, y lo que difiere queda en líneas
/// separadas. Por eso no hace falta numerar unidad por unidad —serían dos
/// bloques idénticos— y basta con decir que aplican a cada una.
fn extras_de_comanda(item: &venta::LineaVenta) -> Vec<String> {
    let mut salida = Vec::new();

    for extra in &item.extras {
        /* `x2` en el extra es "dos porciones de papa en este plato", que es
           distinto de `(cada una)`. Las dos cosas pueden aparecer juntas y
           significan cosas distintas: dos combos, con dos papas cada uno. */
        let veces = if extra.cantidad > 1 {
            format!(" x{}", extra.cantidad)
        } else {
            String::new()
        };

        let cada = if item.cantidad > 1 { "  (CADA UNA)" } else { "" };

        salida.push(format!("  + {}{}{}", extra.nombre.to_uppercase(), veces, cada));
    }

    salida
}

fn comanda_de(
    ancho: usize,
    identificador: &str,
    nuevos: &[venta::LineaVenta],
    ahora: &str,
) -> Vec<u8> {
    let mut t = escpos::Tirilla::nueva(ancho);

    t.alinear(escpos::Alineacion::Centro)
        .doble(true)
        .linea(&identificador.to_uppercase())
        .doble(false)
        .linea(ahora)
        .alinear(escpos::Alineacion::Izquierda)
        .separador();

    for item in nuevos {
        let nombre = if item.variante.is_empty() {
            item.nombre.clone()
        } else {
            format!("{} ({})", item.nombre, item.variante)
        };
        t.doble(true).linea(&format!("{} x{}", item.cantidad, nombre));

        // Los extras y la nota, igual de grandes que el plato: es lo que se
        // lee de reojo desde el otro lado de la plancha.
        for linea in extras_de_comanda(item) {
            t.linea(&linea);
        }
        if !item.nota.is_empty() {
            t.linea(&format!("  >> {}", item.nota.to_uppercase()));
        }
        t.doble(false);
    }

    // Parcial: si cae, cae al piso de la cocina o dentro de una freidora.
    t.separador().cortar_parcial();
    t.terminar()
}

/// La precuenta que el cliente revisa antes de pagar.
///
/// Va marcada como no válida como factura, y no es una formalidad: es el
/// comprobante de una venta que **todavía no existe**. Sin ese aviso, un
/// cliente podría irse con este papel creyendo que pagó, y el negocio tendría
/// un consumo sin venta y sin forma de explicarlo.
fn precuenta(
    negocio: &str,
    ancho: usize,
    cuenta: &cuentas::Cuenta,
    items: &[venta::LineaVenta],
    ahora: &str,
) -> Vec<u8> {
    let mut t = escpos::Tirilla::nueva(ancho);

    t.alinear(escpos::Alineacion::Centro)
        .negrita(true)
        .linea(negocio)
        .doble(true)
        .linea("PRE-CUENTA")
        .doble(false)
        .linea("NO VALIDO COMO FACTURA")
        .negrita(false)
        .linea(&cuenta.identificador)
        .linea(ahora)
        .alinear(escpos::Alineacion::Izquierda)
        .separador();

    let mut suma = Pesos::CERO;
    for item in items {
        let nombre = if item.variante.is_empty() {
            item.nombre.clone()
        } else {
            format!("{} ({})", item.nombre, item.variante)
        };
        let linea = item.total().unwrap_or(Pesos::CERO);
        suma = suma.mas(linea).unwrap_or(suma);
        t.par(&format!("{} x{}", nombre, item.cantidad), &linea.to_string());

        if !item.nota.is_empty() {
            t.linea(&format!("   {}", item.nota));
        }
    }

    t.separador()
        .doble(true)
        .par("TOTAL", &suma.to_string())
        .doble(false)
        .salto()
        .alinear(escpos::Alineacion::Centro)
        .linea("Pide tu factura en la caja")
        // Sin cortar el cajón: aquí no se ha cobrado nada todavía.
        .cortar();

    t.terminar()
}

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
        t.doble(true).linea(&format!("{} x{}", item.cantidad, nombre));

        /* Los extras y la nota van igual de grandes que el plato, y a
           propósito. Es lo que la cocina lee de reojo desde el otro lado de la
           plancha: un "sin cebolla" que no se ve es un plato devuelto y una
           mesa perdida, y un "queso extra" que no se ve es un plato que el
           cliente pagó y no recibió. */
        for linea in extras_de_comanda(item) {
            t.linea(&linea);
        }
        if !item.nota.is_empty() {
            t.linea(&format!("  >> {}", item.nota.to_uppercase()));
        }
        t.doble(false);
    }

    // Parcial: la comanda se queda colgando hasta que el cocinero la arranque.
    t.separador().cortar_parcial();
    t.terminar()
}

/// Arma la tirilla. Vive aquí y no en el núcleo porque es presentación: qué se
/// imprime y en qué orden es una decisión del negocio, no del dominio.
fn tirilla(
    negocio: &Membrete,
    ancho: usize,
    nueva: &venta::NuevaVenta,
    registrada: &venta::VentaRegistrada,
) -> Vec<u8> {
    let mut t = escpos::Tirilla::nueva(ancho);

    t.alinear(escpos::Alineacion::Centro);
    negocio.escribir(&mut t);
    t.linea(&format!("Venta #{}", registrada.consecutivo))
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
        .linea(negocio.pie());
    // Misma regla que la tirilla completa: solo con efectivo y si el panel no
    // lo apagó.
    let hubo_efectivo = nueva.pagos.iter().any(|p| p.metodo == "efectivo")
        || (nueva.pagos.is_empty() && nueva.medio_pago == "efectivo");
    if hubo_efectivo && negocio.cajon_al_cobrar {
        t.abrir_cajon();
    }
    t.cortar();

    t.terminar()
}

/// La hora que se estampa en cada venta, turno y excepción.
///
/// Sale del reloj del equipo **corregido** con el desfase que se mide contra
/// el servidor en cada sincronización. Si la pila de la placa está agotada y
/// la máquina arranca en 1970, la corrección la trae de vuelta; mientras tanto
/// sigue avanzando con el reloj local, que avanza bien aunque arranque mal.
fn ahora_local() -> String {
    reloj::ahora()
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

            /* El nombre que va en la cabecera de la tirilla. Sale de la última
               bajada de catálogo; "MenuBy POS" solo se ve en una caja recién
               instalada que todavía no ha hablado con la nube. */
            let nombre: String = base
                .query_row("SELECT valor FROM ajustes WHERE clave = 'negocio_nombre'", [], |f| f.get(0))
                .unwrap_or_default();

            app.manage(Estado {
                datos: carpeta.clone(),
                base: Mutex::new(base),
                negocio: Mutex::new(if nombre.is_empty() { "MenuBy POS".into() } else { nombre }),
                sesion: Mutex::new(None),
            });

            /* Un hilo aparte, no un temporizador en el webview: la caja tiene
               que seguir subiendo ventas aunque la ventana esté minimizada o el
               cajero deje la pantalla en el mismo sitio toda la tarde.

               Cada 30 segundos es suficiente: lo urgente (cobrar, imprimir) ya
               pasó, y el backoff de la cola manda sobre esta frecuencia cuando
               el backend está caído. */
            let mango = app.handle().clone();
            let mut vueltas: u64 = 0;
            std::thread::spawn(move || loop {
                std::thread::sleep(std::time::Duration::from_secs(30));
                let estado = mango.state::<Estado>();
                sincronizar_ahora(&estado, &mango);

                /* Las fotos van aquí y **solo** aquí: este hilo puede tardar lo
                   que sea sin que nadie lo note, y el cajero nunca las está
                   esperando. Si fallan, en la próxima vuelta se reintentan y
                   mientras tanto el producto se dibuja con sus iniciales. */
                fotos::bajar_pendientes(&estado.base, &estado.datos);

                vueltas += 1;

                /* Cada media hora, el mantenimiento que evita que una terminal
                   encendida durante semanas se degrade sola: consolidar el WAL
                   —que si no crece hasta hacer lento cada cobro— y borrar las
                   fotos de productos que el negocio ya quitó de la carta.

                   Las dos cosas son `PASSIVE` o no bloqueantes: si hay alguien
                   cobrando, no hacen nada y se reintentan en la próxima vuelta. */
                if vueltas.is_multiple_of(60) {
                    if let Ok(base) = estado.base.lock() {
                        db::mantener(&base);
                    }
                    let borradas = fotos::purgar_huerfanas(&estado.base, &estado.datos);
                    if borradas > 0 {
                        println!("Se borraron {borradas} foto(s) de productos que ya no están");
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            catalogo,
            producto_por_id,
            modo_vista,
            guardar_modo_vista,
            categorias,
            carpeta_fotos,
            buscar_clientes,
            crear_cliente,
            recompensas,
            canjear_recompensa,
            cobrar,
            abrir_cajon,
            estado_sync,
            configurar_nube,
            desconectar_nube,
            conectada,
            emparejar,
            vincular,
            probar_nube,
            url_nube,
            impresoras,
            configurar_impresora,
            probar_impresora,
            reimprimir,
            info_terminal,
            configurar_datafono,
            config_datafono,
            hardware_del_panel,
            ajustes_caja,
            resumen_turno,
            apartadas,
            reintentar_apartadas,
            marcar_agotado,
            apagados,
            pedidos_web,
            mover_pedido_web,
            imprimir_pedido_web,
            devolver_hardware_al_panel,
            cobro_qr,
            probar_datafono,
            abrir_pantalla_cliente,
            cerrar_pantalla_cliente,
            hay_pantalla_cliente,
            sincronizar,
            identidad,
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
            anular_borrador,
            imprimir_arqueo,
            pausar_venta,
            listar_pausadas,
            guardar_en_cuenta,
            listar_cuentas,
            abrir_cuenta,
            imprimir_precuenta,
            cerrar_cuenta,
            retomar_venta,
            descartar_pausada,
            autorizar,
            anular_item,
            ventas_recientes,
            lineas_devolvibles,
            devolver,
            registrar_descuento
        ])
        .run(tauri::generate_context!())
        .expect("error arrancando el POS");
}

#[cfg(test)]
mod pruebas_tirilla {
    use super::*;
    use pos_core::venta::{ExtraElegido, LineaVenta, PagoDetalle, VentaCompleta};

    /// Lo que sale impreso, como texto, para poder buscar dentro.
    fn impreso(v: &VentaCompleta) -> String {
        String::from_utf8_lossy(&tirilla_de(&Membrete::solo("Go Burger"), 42, v, false)).to_string()
    }

    /// Una venta con todo lo que la tirilla corta se comía.
    fn venta_completa() -> VentaCompleta {
        VentaCompleta {
            id: "v-1".into(),
            consecutivo: 42,
            total: Pesos(29_000),
            iva: Pesos::CERO,
            recibido: Pesos(30_000),
            vuelto: Pesos(1_000),
            medio_pago: "efectivo".into(),
            cajero: "Ana".into(),
            creada_en: "2026-09-23 12:00".into(),
            items: vec![LineaVenta {
                producto_id: "p1".into(),
                nombre: "Hamburguesa".into(),
                variante: String::new(),
                precio: Pesos(26_000),
                cantidad: 1,
                extras: vec![ExtraElegido {
                    grupo: "Adiciones".into(),
                    nombre: "Tocineta".into(),
                    precio: Pesos(4_000),
                    cantidad: 1,
                }],
                tipo_impuesto: "INC_8".into(),
                nota: "sin cebolla".into(),
            }],
            pago_autorizacion: String::new(),
            pago_ultimos4: String::new(),
            bruto: Pesos(31_000),
            descuento: Pesos(2_000),
            descuento_motivo: "Cliente frecuente".into(),
            propina: Pesos::CERO,
            total_base_inc: Pesos(26_852),
            total_inc: Pesos(2_148),
            total_base_iva: Pesos::CERO,
            total_iva: Pesos::CERO,
            total_exento: Pesos::CERO,
            pagos: vec![PagoDetalle {
                metodo: "efectivo".into(),
                monto: Pesos(29_000),
                referencia: String::new(),
            }],
        }
    }

    /* La tirilla de la venta y la de una reimpresión son la misma función.
     *
     * Antes eran dos, y la corta —la que recibía el cliente al comprar— se
     * había quedado atrás: sin extras, sin notas, sin descuento y sin el
     * desglose de impuestos. Quien pedía una reimpresión recibía un papel
     * mejor que el del momento de pagar, que es justo al revés. */

    /// Si los bytes llevan el pulso que abre la gaveta (ESC p).
    fn abre_cajon(bytes: &[u8]) -> bool {
        bytes.windows(2).any(|w| w == [0x1B, b'p'])
    }

    #[test]
    fn cobrar_en_efectivo_abre_la_gaveta() {
        // El error que esto cierra: la tirilla completa no abría el cajón.
        let bytes = tirilla_de(&Membrete::solo("Go Burger"), 42, &venta_completa(), false);
        assert!(abre_cajon(&bytes));
    }

    #[test]
    fn una_reimpresion_no_abre_la_gaveta() {
        let bytes = tirilla_de(&Membrete::solo("Go Burger"), 42, &venta_completa(), true);
        assert!(!abre_cajon(&bytes));
    }

    #[test]
    fn con_tarjeta_no_abre_la_gaveta() {
        let mut v = venta_completa();
        v.medio_pago = "tarjeta".into();
        v.pagos = vec![PagoDetalle { metodo: "tarjeta".into(), monto: Pesos(29_000), referencia: String::new() }];
        assert!(!abre_cajon(&tirilla_de(&Membrete::solo("Go Burger"), 42, &v, false)));
    }

    #[test]
    fn si_el_panel_apaga_el_cajon_no_abre() {
        let m = Membrete { cajon_al_cobrar: false, ..Membrete::solo("Go Burger") };
        assert!(!abre_cajon(&tirilla_de(&m, 42, &venta_completa(), false)));
    }

    #[test]
    fn el_pie_es_el_que_escribio_el_dueno() {
        let m = Membrete { pie: "Síguenos en Instagram".into(), ..Membrete::solo("Go Burger") };
        let texto = String::from_utf8_lossy(&tirilla_de(&m, 42, &venta_completa(), false)).to_string();
        assert!(texto.contains("Instagram"), "falta el pie:\n{texto}");
        assert!(!texto.contains("Gracias por tu compra"));
    }

    #[test]
    fn el_membrete_lleva_direccion_telefono_y_nit() {
        // Lo mismo que imprime el PrintAgent en los pedidos del menú.
        let m = Membrete {
            nombre: "Go Burger".into(),
            nit: "900123456-7".into(),
            direccion: "Cra 10 # 20-30".into(),
            telefono: "3001234567".into(),
            ..Membrete::default()
        };
        let texto = String::from_utf8_lossy(&tirilla_de(&m, 42, &venta_completa(), false)).to_string();
        for esperado in ["Go Burger", "Cra 10 # 20-30", "Tel: 3001234567", "NIT: 900123456-7"] {
            assert!(texto.contains(esperado), "falta {esperado}:
{texto}");
        }
    }

    #[test]
    fn sin_nit_no_imprime_la_etiqueta_sola() {
        let texto = impreso(&venta_completa());
        assert!(!texto.contains("NIT:"), "NIT vacío impreso:
{texto}");
        assert!(!texto.contains("Tel:"), "Tel vacío impreso:
{texto}");
    }

    #[test]
    fn la_venta_y_la_reimpresion_leen_el_membrete_de_la_base() {
        /* Sin esto, el membrete existe pero nadie lo usa: la tirilla seguiría
           saliendo solo con el nombre. Aguja partida para no encontrarse a sí
           misma en este archivo. */
        let fuente = include_str!("lib.rs");
        let aguja = format!("{}{}", "membrete(&base, ", "&estado.negocio.lock().unwrap())");
        assert_eq!(fuente.matches(&aguja).count(), 2, "venta y reimpresión deben leerlo");
    }

    #[test]
    fn imprime_los_extras_con_su_precio() {
        // El cliente paga $4.000 de tocineta: tiene derecho a verlo.
        let texto = impreso(&venta_completa());
        assert!(texto.contains("Tocineta"), "falta el extra:\n{texto}");
    }

    #[test]
    fn imprime_la_nota_del_plato() {
        // "sin cebolla" es lo que el cliente revisa antes de irse.
        let texto = impreso(&venta_completa());
        assert!(texto.contains("sin cebolla"), "falta la nota:\n{texto}");
    }

    #[test]
    fn imprime_el_descuento_y_su_motivo() {
        // Una tirilla que solo dice el total no sirve para reclamar nada.
        let texto = impreso(&venta_completa());
        assert!(texto.contains("Cliente frecuente"), "falta el motivo:\n{texto}");
    }

    #[test]
    fn imprime_el_desglose_de_impuestos() {
        // Es lo que la DIAN espera en el papel, y la corta no lo tenía.
        let texto = impreso(&venta_completa());
        assert!(texto.contains("INC"), "falta el impuesto:\n{texto}");
    }

    #[test]
    fn la_original_no_se_marca_como_copia() {
        /* `copia: true` es para las reimpresiones. Marcar la primera como
           copia haría dudar a cualquiera de que es válida. */
        let v = venta_completa();
        let original = String::from_utf8_lossy(&tirilla_de(&Membrete::solo("Go Burger"), 42, &v, false)).to_string();
        let reimpresa = String::from_utf8_lossy(&tirilla_de(&Membrete::solo("Go Burger"), 42, &v, true)).to_string();
        assert_ne!(original, reimpresa, "la copia tiene que distinguirse");
    }

    #[test]
    fn la_venta_imprime_la_completa() {
        /* Guardia sobre el sitio de la venta: si alguien vuelve a poner ahí la
           tirilla corta, el cliente deja de ver por qué pagó lo que pagó. */
        let fuente = include_str!("lib.rs");
        /* La aguja se arma en dos pedazos a propósito. `include_str!` de este
           mismo archivo incluye esta línea, así que un literal entero se
           encontraría a sí mismo y la prueba pasaría siempre — daba verde
           incluso con la tirilla corta puesta de vuelta. */
        let aguja = format!("{}{}", "Some(v) => tirilla_de(", "&negocio, caja.ancho, v, false)");
        assert!(
            fuente.contains(&aguja),
            "la venta dejó de imprimir la tirilla completa",
        );
    }
}
