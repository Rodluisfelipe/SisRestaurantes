//! El catálogo, bajado de la nube.
//!
//! Va en un solo sentido: MenuBy manda, la caja obedece. Un cambio de precio se
//! hace en el panel y baja; la caja nunca edita el catálogo, así dos cajas no
//! pueden contradecirse.
//!
//! Se baja por **marca de agua**: la caja guarda la fecha del último cambio que
//! recibió y solo pide lo que cambió después. Bajar el catálogo entero cada vez
//! funciona con 50 productos y se cae con 5.000, que es justo el negocio que
//! más lo necesita.
//!
//! Dos detalles que parecen menores y no lo son:
//!
//! - Un producto que el negocio desactivó **tiene que llegar** marcado como
//!   inactivo. Si el servidor solo mandara los activos, el producto se quedaría
//!   para siempre en la caja y se seguiría vendiendo lo que ya no se vende.
//! - La marca de agua se guarda **después** de aplicar todo el lote. Si se
//!   guardara antes y la escritura fallara a la mitad, esos cambios no se
//!   volverían a pedir nunca.

use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

/// Una fila vendible. Un producto con tallas llega como varias filas: en la
/// caja lo que se toca es "Camiseta · M", no "Camiseta".
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilaCatalogo {
    pub id: String,
    pub nombre: String,
    pub precio: i64,
    #[serde(default)]
    pub categoria: String,
    #[serde(default)]
    pub sku: String,
    #[serde(default)]
    pub variante: String,
    #[serde(default = "verdadero")]
    pub activo: bool,
    /// Fecha del cambio en la nube. Es lo que alimenta la marca de agua.
    #[serde(default)]
    pub actualizado: String,
    /// De dónde bajar la foto. Vacío = el producto no tiene.
    #[serde(default)]
    pub foto: String,
}

fn verdadero() -> bool {
    true
}

/// Aplica un lote y devuelve la nueva marca de agua.
///
/// Todo el lote va en una transacción: o entra completo o no entra, y así el
/// catálogo de la caja nunca queda a mitad de camino entre dos precios.
pub fn aplicar(conexion: &mut Connection, filas: &[FilaCatalogo]) -> Result<Option<String>> {
    if filas.is_empty() {
        return Ok(None);
    }

    let tx = conexion.transaction()?;
    let mut marca: Option<String> = None;

    for fila in filas {
        tx.execute(
            /* `foto_local` no se toca en el UPDATE: el archivo que ya está en
               disco sigue sirviendo. Solo se borra cuando la dirección cambió,
               y eso se decide abajo comparando contra la que había. */
            "INSERT INTO productos (id, nombre, precio, categoria, sku, variante, activo, actualizado, foto_url)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(id) DO UPDATE SET
               nombre = excluded.nombre,
               precio = excluded.precio,
               categoria = excluded.categoria,
               sku = excluded.sku,
               variante = excluded.variante,
               activo = excluded.activo,
               actualizado = excluded.actualizado,
               foto_url = excluded.foto_url,
               foto_local = CASE
                   WHEN productos.foto_url = excluded.foto_url THEN productos.foto_local
                   ELSE ''
               END",
            params![
                fila.id,
                fila.nombre,
                fila.precio,
                fila.categoria,
                fila.sku,
                fila.variante,
                fila.activo as i64,
                fila.actualizado,
                fila.foto
            ],
        )?;

        // La más reciente del lote, comparada como texto porque las fechas
        // vienen en ISO-8601, donde el orden alfabético es el cronológico.
        if !fila.actualizado.is_empty()
            && marca.as_deref().map_or(true, |m| fila.actualizado.as_str() > m)
        {
            marca = Some(fila.actualizado.clone());
        }
    }

    if let Some(m) = &marca {
        tx.execute(
            "INSERT INTO ajustes (clave, valor) VALUES ('catalogo_desde', ?1)
             ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
            params![m],
        )?;
    }

    tx.commit()?;
    Ok(marca)
}

/// Desde cuándo pedir. Vacío la primera vez: se baja todo.
pub fn marca_de_agua(conexion: &Connection) -> Result<String> {
    conexion
        .query_row("SELECT valor FROM ajustes WHERE clave = 'catalogo_desde'", [], |f| f.get(0))
        .or_else(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => Ok(String::new()),
            otro => Err(otro),
        })
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use crate::db;

    fn fila(id: &str, nombre: &str, precio: i64, actualizado: &str) -> FilaCatalogo {
        FilaCatalogo {
            id: id.into(),
            nombre: nombre.into(),
            precio,
            categoria: "General".into(),
            sku: String::new(),
            variante: String::new(),
            activo: true,
            actualizado: actualizado.into(),
            foto: String::new(),
        }
    }

    #[test]
    fn la_primera_vez_pide_todo() {
        let c = db::abrir_en_memoria().unwrap();
        assert_eq!(marca_de_agua(&c).unwrap(), "");
    }

    #[test]
    fn inserta_y_luego_actualiza_el_mismo_producto() {
        let mut c = db::abrir_en_memoria().unwrap();
        aplicar(&mut c, &[fila("p1", "Café", 4_500, "2026-09-20T10:00:00Z")]).unwrap();
        aplicar(&mut c, &[fila("p1", "Café", 5_000, "2026-09-20T11:00:00Z")]).unwrap();

        let (nombre, precio): (String, i64) = c
            .query_row("SELECT nombre, precio FROM productos WHERE id = 'p1'", [], |f| {
                Ok((f.get(0)?, f.get(1)?))
            })
            .unwrap();
        assert_eq!((nombre.as_str(), precio), ("Café", 5_000));

        let cuantos: i64 = c.query_row("SELECT COUNT(*) FROM productos", [], |f| f.get(0)).unwrap();
        assert_eq!(cuantos, 1, "el mismo id no puede duplicarse");
    }

    #[test]
    fn lo_desactivado_en_la_nube_deja_de_venderse_en_la_caja() {
        let mut c = db::abrir_en_memoria().unwrap();
        aplicar(&mut c, &[fila("p1", "Café", 4_500, "2026-09-20T10:00:00Z")]).unwrap();

        let mut apagado = fila("p1", "Café", 4_500, "2026-09-20T12:00:00Z");
        apagado.activo = false;
        aplicar(&mut c, &[apagado]).unwrap();

        let activo: i64 = c.query_row("SELECT activo FROM productos WHERE id = 'p1'", [], |f| f.get(0)).unwrap();
        assert_eq!(activo, 0);
    }

    #[test]
    fn la_marca_de_agua_queda_en_el_cambio_mas_reciente_del_lote() {
        let mut c = db::abrir_en_memoria().unwrap();
        let marca = aplicar(
            &mut c,
            &[
                fila("p1", "A", 1_000, "2026-09-20T10:00:00Z"),
                fila("p2", "B", 2_000, "2026-09-20T12:00:00Z"),
                fila("p3", "C", 3_000, "2026-09-20T11:00:00Z"),
            ],
        )
        .unwrap();

        assert_eq!(marca.as_deref(), Some("2026-09-20T12:00:00Z"));
        assert_eq!(marca_de_agua(&c).unwrap(), "2026-09-20T12:00:00Z");
    }

    #[test]
    fn un_lote_vacio_no_mueve_la_marca() {
        // Si la moviera, un "no hay nada nuevo" podría saltarse cambios.
        let mut c = db::abrir_en_memoria().unwrap();
        aplicar(&mut c, &[fila("p1", "A", 1_000, "2026-09-20T10:00:00Z")]).unwrap();
        assert_eq!(aplicar(&mut c, &[]).unwrap(), None);
        assert_eq!(marca_de_agua(&c).unwrap(), "2026-09-20T10:00:00Z");
    }

    #[test]
    fn las_variantes_son_filas_distintas() {
        // En la caja se toca "Camiseta · M", no "Camiseta".
        let mut c = db::abrir_en_memoria().unwrap();
        let mut m = fila("p1:M", "Camiseta", 40_000, "2026-09-20T10:00:00Z");
        m.variante = "M".into();
        let mut l = fila("p1:L", "Camiseta", 42_000, "2026-09-20T10:00:00Z");
        l.variante = "L".into();

        aplicar(&mut c, &[m, l]).unwrap();

        let cuantas: i64 = c
            .query_row("SELECT COUNT(*) FROM productos WHERE nombre = 'Camiseta'", [], |f| f.get(0))
            .unwrap();
        assert_eq!(cuantas, 2);
    }
}
