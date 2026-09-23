//! Las fotos del catálogo, en el disco de la caja.
//!
//! Un cajero reconoce un producto por su foto mucho más rápido que leyendo un
//! nombre, y esa diferencia se nota trescientas veces al día. Pero la caja
//! trabaja sin internet, así que apuntar la pantalla a la dirección del CDN
//! llenaría la rejilla de iconos rotos justo el día que se cayó la conexión.
//!
//! Por eso se bajan una vez y se guardan. Las reglas que siguen son las que
//! hacen que esto no estorbe:
//!
//! - **Nunca bloquea la sincronización.** Las fotos se bajan después de aplicar
//!   el catálogo, y que una falle no toca ni las ventas ni los precios. Sin
//!   foto se dibuja un marcador con las iniciales, que es peor que la foto y
//!   mucho mejor que una caja que no abre.
//! - **Se guarda con la extensión de origen.** El CDN sirve lo que sirve —jpg,
//!   png, webp— y convertir exigiría una crate de imágenes dentro del binario
//!   por una ganancia que nadie va a notar en una tarjeta de 150 píxeles.
//! - **Un tope por vuelta.** Un catálogo de 5.000 productos son 5.000 descargas,
//!   y hacerlas todas en el primer arranque dejaría la caja pegada media hora.
//!   Se bajan de a poco, sincronización tras sincronización.

use std::io::Read;
use std::path::{Path, PathBuf};

/// Cuántas fotos se bajan en cada vuelta de sincronización.
///
/// Con la sincronización cada 30 segundos, un catálogo de 500 productos queda
/// completo en menos de diez minutos sin que nadie note la descarga.
const POR_VUELTA: usize = 12;

/// Lo que se espera por una foto. Corto a propósito: es lo menos importante
/// que hace la caja y no puede retrasar lo demás.
const ESPERA: std::time::Duration = std::time::Duration::from_secs(10);

/// Tope por archivo. Una foto de producto de 5 MB es un error de quien la
/// subió, y bajarla llenaría el disco de la terminal sin dar nada a cambio.
const MAX_BYTES: usize = 3 * 1024 * 1024;

/// Dónde viven las fotos dentro de la carpeta de datos de la app.
pub fn carpeta(datos: &Path) -> PathBuf {
    datos.join("fotos")
}

/// Baja las fotos que falten. Devuelve cuántas quedaron en disco.
///
/// Recibe el candado de la base y **no lo retiene mientras descarga**. Esa es
/// la regla de la que depende que la caja siga viva: veinticinco descargas de
/// diez segundos con el candado puesto dejan bloqueada cualquier venta, cobro
/// o cierre de turno que intente escribir mientras tanto. Se abre para leer la
/// lista, se suelta, se baja, y se vuelve a abrir para anotar cada una.
///
/// Los errores no se propagan: una foto que no bajó se reintenta en la próxima
/// vuelta, y mientras tanto el producto se ve con su marcador de iniciales.
pub fn bajar_pendientes(base: &std::sync::Mutex<rusqlite::Connection>, datos: &Path) -> usize {
    let destino = carpeta(datos);
    if std::fs::create_dir_all(&destino).is_err() {
        return 0;
    }

    // Se abre solo para leer qué falta, y se suelta enseguida.
    let pendientes = {
        let Ok(conexion) = base.lock() else { return 0 };
        match listar_pendientes(&conexion) {
            Ok(v) => v,
            Err(_) => return 0,
        }
    };

    let mut listas = 0;
    for (id, url) in pendientes {
        let Some(nombre) = nombre_de_archivo(&id, &url) else { continue };
        let archivo = destino.join(&nombre);

        /* Si el archivo ya está, no se vuelve a bajar: pasa cuando la base se
           borró pero la carpeta no, o cuando dos filas del mismo producto con
           variantes distintas comparten la foto del padre. */
        if !archivo.exists() {
            // Aquí es donde se van los segundos, y aquí no hay candado puesto.
            match descargar(&url) {
                Ok(bytes) => {
                    if std::fs::write(&archivo, &bytes).is_err() {
                        continue;
                    }
                }
                Err(_) => continue,
            }
        }

        // Se vuelve a abrir solo para anotar esta, y se suelta.
        let anotada = {
            let Ok(conexion) = base.lock() else { continue };
            conexion
                .execute(
                    "UPDATE productos SET foto_local = ?1 WHERE foto_url = ?2",
                    rusqlite::params![nombre, url],
                )
                .is_ok()
        };

        if anotada {
            listas += 1;
        }
    }

    listas
}

/// Borra las fotos que ya no referencia ningún producto.
///
/// Un negocio que rota su carta —menús de temporada, promociones semanales,
/// fotos que el dueño cambia desde el panel— va dejando archivos atrás. La
/// caja no los borra al actualizar el catálogo porque en ese momento no sabe
/// si otra fila los usa.
///
/// En un año de operación eso llena el disco de una terminal con eMMC de
/// 32 GB, y un disco lleno no es "van lentas las fotos": es SQLite sin poder
/// escribir y una caja que no cobra.
///
/// Devuelve cuántas se borraron.
pub fn purgar_huerfanas(base: &std::sync::Mutex<rusqlite::Connection>, datos: &Path) -> usize {
    let carpeta_fotos = carpeta(datos);

    // Qué archivos sigue nombrando la base. Se suelta el candado enseguida.
    let vivas: std::collections::HashSet<String> = {
        let Ok(conexion) = base.lock() else { return 0 };
        let Ok(mut consulta) = conexion.prepare("SELECT DISTINCT foto_local FROM productos WHERE foto_local != ''")
        else {
            return 0;
        };
        let Ok(filas) = consulta.query_map([], |f| f.get::<_, String>(0)) else { return 0 };
        let mut vivas: std::collections::HashSet<String> = filas.flatten().collect();
        // El logo del negocio vive en la misma carpeta y no es de ningún producto.
        if let Ok(logo) = conexion.query_row::<String, _, _>(
            "SELECT valor FROM ajustes WHERE clave = 'negocio_logo_local'", [], |f| f.get(0),
        ) {
            vivas.insert(logo);
        }
        vivas
    };

    /* Si la consulta no devolvió nada, no se borra nada. Podría ser que el
       catálogo esté vacío de verdad, pero también que la base esté a medio
       migrar: borrar todas las fotos por una lectura rara sale mucho más caro
       que dejarlas un día más. */
    if vivas.is_empty() {
        return 0;
    }

    let Ok(entradas) = std::fs::read_dir(&carpeta_fotos) else { return 0 };
    let mut borradas = 0;

    for entrada in entradas.flatten() {
        let ruta = entrada.path();
        if !ruta.is_file() {
            continue;
        }
        let Some(nombre) = ruta.file_name().and_then(|n| n.to_str()) else { continue };

        if !vivas.contains(nombre) && std::fs::remove_file(&ruta).is_ok() {
            borradas += 1;
        }
    }

    borradas
}

/// Baja el logo del negocio si cambió. Va con las fotos: la pantalla de
/// entrada lo muestra aunque no haya internet, así que tiene que estar en
/// disco, no en la nube.
pub fn bajar_logo(base: &std::sync::Mutex<rusqlite::Connection>, datos: &Path) {
    let leer = |conexion: &rusqlite::Connection, clave: &str| -> String {
        conexion
            .query_row("SELECT valor FROM ajustes WHERE clave = ?1", [clave], |f| f.get(0))
            .unwrap_or_default()
    };
    let (url, bajada) = {
        let Ok(conexion) = base.lock() else { return };
        (leer(&conexion, "negocio_logo_url"), leer(&conexion, "negocio_logo_bajado"))
    };
    if url.is_empty() || url == bajada {
        return;
    }
    let Some(nombre) = nombre_de_archivo("logo-negocio", &url) else { return };
    // Sin el candado mientras se descarga: la red puede tardar.
    let Ok(bytes) = descargar(&url) else { return };
    let carpeta_fotos = carpeta(datos);
    let _ = std::fs::create_dir_all(&carpeta_fotos);
    if std::fs::write(carpeta_fotos.join(&nombre), bytes).is_err() {
        return;
    }
    if let Ok(conexion) = base.lock() {
        for (clave, valor) in [("negocio_logo_local", nombre.as_str()), ("negocio_logo_bajado", url.as_str())] {
            let _ = conexion.execute(
                "INSERT INTO ajustes (clave, valor) VALUES (?1, ?2)
                 ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
                rusqlite::params![clave, valor],
            );
        }
    }
}

/// Los productos con foto en la nube y sin foto en disco.
///
/// Se agrupa por dirección y no por producto: diez tallas de la misma camisa
/// comparten la foto del producto padre, y bajarla diez veces sería gastar
/// diez veces el mismo dato.
fn listar_pendientes(conexion: &rusqlite::Connection) -> rusqlite::Result<Vec<(String, String)>> {
    let mut consulta = conexion.prepare(
        "SELECT MIN(id), foto_url FROM productos
         WHERE foto_url != '' AND foto_local = ''
         GROUP BY foto_url
         LIMIT ?1",
    )?;
    let filas = consulta.query_map([POR_VUELTA as i64], |f| Ok((f.get(0)?, f.get(1)?)))?;
    filas.collect()
}

/// Cómo se llama el archivo en disco.
///
/// El id del producto más la extensión de la dirección. El id porque es único
/// y ya está saneado —lo genera Mongo—, y la extensión porque el webview
/// decide cómo mostrar la imagen por ella.
fn nombre_de_archivo(id: &str, url: &str) -> Option<String> {
    if url.trim().is_empty() {
        return None;
    }

    /* Se corta lo que venga después de un interrogante: muchos CDN firman las
       direcciones y sin esto la extensión saldría como "jpg?v=3&w=800". */
    let sin_consulta = url.split(['?', '#']).next().unwrap_or(url);
    let extension = sin_consulta
        .rsplit('.')
        .next()
        .filter(|e| e.len() <= 5 && e.chars().all(|c| c.is_ascii_alphanumeric()))
        .unwrap_or("jpg")
        .to_lowercase();

    /* El id llega de la nube y termina siendo un nombre de archivo: cualquier
       cosa que no sea alfanumérica se cambia, porque un id con barras o puntos
       escribiría fuera de la carpeta. */
    let limpio: String = id
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .take(80)
        .collect();

    Some(format!("{limpio}.{extension}"))
}

/// Trae los bytes. Se para en el tope para que una foto enorme no llene el disco.
fn descargar(url: &str) -> Result<Vec<u8>, String> {
    // Solo http(s). Sin esto, una dirección "file:///" leería el disco del equipo.
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("dirección no admitida".into());
    }

    let respuesta = ureq::get(url).timeout(ESPERA).call().map_err(|e| e.to_string())?;

    let mut bytes = Vec::new();
    respuesta
        .into_reader()
        .take(MAX_BYTES as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;

    if bytes.len() > MAX_BYTES {
        return Err("la foto pesa demasiado".into());
    }
    if bytes.is_empty() {
        return Err("la foto llegó vacía".into());
    }

    Ok(bytes)
}

#[cfg(test)]
mod pruebas {
    use super::nombre_de_archivo;

    #[test]
    fn el_archivo_se_llama_como_el_producto() {
        assert_eq!(
            nombre_de_archivo("507f1f77bcf86cd799439011", "https://cdn/x/foto.png").as_deref(),
            Some("507f1f77bcf86cd799439011.png"),
        );
    }

    #[test]
    fn la_firma_del_cdn_no_se_cuela_en_la_extension() {
        /* Sin cortar en el interrogante, el archivo quedaría llamándose
           "x.jpg?v=3&w=800" y el sistema de archivos lo rechazaría. */
        let nombre = nombre_de_archivo("abc", "https://cdn/x/foto.jpg?v=3&w=800").unwrap();
        assert_eq!(nombre, "abc.jpg");
    }

    #[test]
    fn una_direccion_sin_extension_se_asume_jpg() {
        // Vale más una extensión equivocada que un archivo sin extensión.
        let nombre = nombre_de_archivo("abc", "https://cdn/imagen/12345").unwrap();
        assert!(nombre.ends_with(".jpg"));
    }

    #[test]
    fn un_id_con_barras_no_escribe_fuera_de_la_carpeta() {
        /* El id llega de la nube. Si se usara tal cual, un id como
           "../../config" escribiría donde no debe. */
        let nombre = nombre_de_archivo("../../secreto", "https://cdn/x.png").unwrap();
        assert!(!nombre.contains('/'));
        assert!(!nombre.contains(".."));
    }

    #[test]
    fn el_id_compuesto_de_una_variante_sigue_siendo_un_nombre_valido() {
        // Las variantes traen "<producto>:M|Negro", con dos puntos y barra.
        let nombre = nombre_de_archivo("507f1f:M|Negro", "https://cdn/x.webp").unwrap();
        assert_eq!(nombre, "507f1f_M_Negro.webp");
    }

    #[test]
    fn sin_direccion_no_hay_archivo() {
        assert!(nombre_de_archivo("abc", "").is_none());
        assert!(nombre_de_archivo("abc", "   ").is_none());
    }

    /* Las dos pruebas que siguen leen el código en vez de ejecutarlo. No es lo
       ideal, pero lo que hay que vigilar aquí no se puede observar desde
       dentro: que una función tarde no es un fallo, y que congele la ventana
       tampoco lo detecta ningún `assert`. Lo que sí se puede fijar es la forma
       del código que causó el cuelgue, para que nadie la reintroduzca. */

    /// El código de producción, sin las pruebas.
    fn codigo(archivo: &str) -> String {
        let texto = std::fs::read_to_string(archivo).expect("no pude leer el archivo");
        texto.split("#[cfg(test)]").next().unwrap_or_default().to_string()
    }

    /// Lo que devuelve `crear_usuario` entre llaves, sin las pruebas.
    fn cuerpo_de_crear_usuario() -> String {
        let texto = codigo("src/lib.rs");
        let desde = texto.find("fn crear_usuario(").expect("no existe crear_usuario");
        let resto = &texto[desde..];
        let hasta = resto.find("
}").expect("no encuentro el final");
        resto[..hasta].to_string()
    }

    #[test]
    fn el_primer_usuario_queda_dentro_de_la_caja() {
        /* El fallo real, y se vio en una instalación nueva: la pantalla del
           PIN crea el primer usuario con `crear_usuario`, no con `entrar`.
           Como solo `entrar` abría la sesión, el núcleo se quedaba sin
           nadie en la caja mientras la pantalla ya decía \"Hola, Daniel\", y
           lo primero que esa persona intentaba —abrir el turno— fallaba con
           un \"entra con tu PIN\".

           Se comprueba leyendo el código porque la sesión vive en el estado
           de Tauri y no hay forma de montarlo en una prueba unitaria. Lo
           que se fija es la forma: que este comando toque `estado.sesion`. */
        let cuerpo = cuerpo_de_crear_usuario();

        assert!(
            cuerpo.contains("estado.sesion"),
            "crear_usuario tiene que dejar dentro al primer usuario",
        );
    }

    #[test]
    fn crear_un_cajero_no_le_quita_la_caja_al_supervisor() {
        /* La otra mitad, y la que importa para el control: un supervisor que
           da de alta a un cajero sigue siendo quien está en la caja. Si la
           sesión cambiara al recién creado, las ventas de esa noche saldrían
           a nombre de alguien que ni siquiera está en el mostrador. */
        let cuerpo = cuerpo_de_crear_usuario();

        let sesion = cuerpo.find("estado.sesion").expect("sin sesión");
        let guarda = cuerpo.find("if primeros").expect("sin guarda de primeros");

        assert!(
            guarda < sesion,
            "la sesión solo se abre para el primero, dentro de `if primeros`",
        );
    }

    #[test]
    fn la_descarga_no_retiene_el_candado_de_la_base() {
        /* El cuelgue real: `bajar_pendientes` recibía una `&Connection` —es
           decir, el candado ya abierto— y hacía dentro hasta veinticinco
           descargas de diez segundos. Cualquier venta que intentara escribir
           durante esos minutos se quedaba esperando.

           Recibir el `Mutex` en vez de la conexión es lo que obliga a abrirlo y
           soltarlo por tramos. */
        let fuente = codigo("src/fotos.rs");

        assert!(
            fuente.contains("pub fn bajar_pendientes(base: &std::sync::Mutex<rusqlite::Connection>"),
            "bajar_pendientes tiene que recibir el Mutex, no una conexión ya abierta: \
             con el candado puesto, cada descarga bloquea las ventas",
        );
    }

    #[test]
    fn la_sincronizacion_no_corre_en_el_hilo_que_dibuja() {
        /* El otro lado del mismo cuelgue: un comando de Tauri que no es `async`
           corre en el hilo principal. `sincronizar` habla con la red, así que
           ahí dejaba la ventana en "no responde" hasta que terminara. */
        let fuente = codigo("src/lib.rs");

        assert!(
            fuente.contains("async fn sincronizar(app: tauri::AppHandle)"),
            "el comando sincronizar tiene que ser async y salirse del hilo principal: \
             si no, la ventana se congela mientras habla con la red",
        );

        assert!(
            !fuente.contains("fn sincronizar(estado: State<Estado>)"),
            "quedó la versión vieja del comando, que sí congela la ventana",
        );
    }


    #[test]
    fn ninguna_impresion_bloquea_el_hilo_que_dibuja() {
        /* Un comando de Tauri que no es `async` corre en el hilo principal, y
           abrir el socket de una impresora apagada tarda los tres segundos del
           tiempo de espera. Eso es la ventana congelada con un cliente al
           frente, y pasó con seis comandos a la vez.

           La regla que fija esta prueba: `perifericos::enviar` —que bloquea—
           solo se llama desde `imprimir`, que lo saca a `spawn_blocking`, o
           desde `enviar_suelto`, que lo manda a un hilo propio. Cualquier
           llamada directa desde un comando vuelve a traer el problema.

           Se lee el código porque lo que hay que vigilar no se observa desde
           dentro: que una función tarde no es un fallo, y ningún `assert`
           detecta una ventana congelada. */
        let fuente = codigo("src/lib.rs");

        /* Se excluye `enviar_suelto`, que ya manda a un hilo propio. Lo que
           se busca son las llamadas crudas: las que bloquean el hilo desde el
           que se hagan. */
        let directas: Vec<&str> = fuente
            .lines()
            .filter(|l| l.contains("perifericos::enviar(&"))
            // La de dentro de `imprimir`, que es el sitio correcto.
            .filter(|l| !l.contains("spawn_blocking"))
            .map(|l| l.trim())
            .collect();

        assert!(
            directas.is_empty(),
            "estas llamadas bloquean el hilo desde el que se hagan; \
             usa imprimir(...).await si el resultado importa, o \
             perifericos::enviar_suelto(...) si no: {directas:?}",
        );
    }

    #[test]
    fn el_envio_suelto_no_espera_a_la_impresora() {
        /* Es lo que hace que un aviso de anulación o un movimiento de caja no
           frenen la caja: se manda y la función vuelve enseguida, aunque la
           impresora esté apagada al otro lado. */
        let inicio = std::time::Instant::now();

        crate::perifericos::enviar_suelto(
            // Una dirección que no existe: el intento agota su espera.
            crate::perifericos::Impresora::Red { host: "192.0.2.1".into(), puerto: 9100 },
            b"hola".to_vec(),
        );

        assert!(
            inicio.elapsed() < std::time::Duration::from_millis(200),
            "enviar_suelto tiene que volver de inmediato, tardó {:?}",
            inicio.elapsed(),
        );
    }

}
