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
const POR_VUELTA: usize = 25;

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
/// Los errores no se propagan: una foto que no bajó se reintenta en la próxima
/// vuelta, y mientras tanto el producto se ve con su marcador de iniciales.
pub fn bajar_pendientes(conexion: &rusqlite::Connection, datos: &Path) -> usize {
    let destino = carpeta(datos);
    if std::fs::create_dir_all(&destino).is_err() {
        return 0;
    }

    let pendientes = match listar_pendientes(conexion) {
        Ok(v) => v,
        Err(_) => return 0,
    };

    let mut listas = 0;
    for (id, url) in pendientes {
        let Some(nombre) = nombre_de_archivo(&id, &url) else { continue };
        let archivo = destino.join(&nombre);

        /* Si el archivo ya está, no se vuelve a bajar: pasa cuando la base se
           borró pero la carpeta no, o cuando dos filas del mismo producto con
           variantes distintas comparten la foto del padre. */
        if !archivo.exists() {
            match descargar(&url) {
                Ok(bytes) => {
                    if std::fs::write(&archivo, &bytes).is_err() {
                        continue;
                    }
                }
                Err(_) => continue,
            }
        }

        if conexion
            .execute(
                "UPDATE productos SET foto_local = ?1 WHERE foto_url = ?2",
                rusqlite::params![nombre, url],
            )
            .is_ok()
        {
            listas += 1;
        }
    }

    listas
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
}
