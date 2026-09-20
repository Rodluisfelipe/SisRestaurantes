//! Devolver lo que ya se cobró.
//!
//! Una devolución **no borra la venta**. Es una operación aparte que apunta a
//! la original, y esa diferencia es la que separa un registro contable de uno
//! que se puede alterar: si devolver borrara la venta, no quedaría rastro de
//! que se cobró y el turno donde se cobró cerraría distinto cada vez que
//! alguien devuelve algo del día anterior.
//!
//! Tres reglas que no se negocian:
//!
//! 1. **La autoriza un supervisor.** Es plata que sale de la gaveta sin nada
//!    vendido a cambio; sin autorización sería el camino más corto para vaciar
//!    una caja.
//! 2. **No se puede devolver más de lo que se vendió**, ni sumando varias
//!    devoluciones de la misma venta. Es lo único que impide convertir una
//!    venta de un café en una fuente de efectivo.
//! 3. **El turno es el de hoy**, no el de la venta. Ese billete sale de la
//!    gaveta de hoy aunque la venta fuera de ayer, y el arqueo de hoy tiene que
//!    verlo salir.

use crate::dinero::Pesos;
use crate::venta::LineaVenta;
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Devolucion {
    pub id: String,
    pub venta_id: String,
    pub consecutivo: i64,
    pub total: Pesos,
    pub medio: String,
    pub motivo: String,
    pub cajero: String,
    pub autorizo: String,
    pub creada_en: String,
}

#[derive(Debug)]
pub enum ErrorDevolucion {
    /// La venta no existe en esta caja. Pasa con ventas de otra terminal.
    SinVenta,
    SinTurno,
    SinItems,
    SinAutorizacion,
    SinMotivo,
    /// Se intentó devolver más de lo que se vendió, o más de lo que queda.
    DeMas { producto: String, vendidas: i64, ya_devueltas: i64, pedidas: i64 },
    Base(rusqlite::Error),
}

impl std::fmt::Display for ErrorDevolucion {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            // Mensajes para el cajero, con el cliente esperando al frente.
            ErrorDevolucion::SinVenta => write!(f, "Esa venta no está en esta caja"),
            ErrorDevolucion::SinTurno => write!(f, "Abre un turno antes de devolver"),
            ErrorDevolucion::SinItems => write!(f, "No hay nada que devolver"),
            ErrorDevolucion::SinAutorizacion => write!(f, "Falta la autorización de un supervisor"),
            ErrorDevolucion::SinMotivo => write!(f, "Dile por qué se devuelve"),
            ErrorDevolucion::DeMas { producto, vendidas, ya_devueltas, pedidas } => {
                if *ya_devueltas > 0 {
                    write!(
                        f,
                        "De {producto} se vendieron {vendidas} y ya se devolvieron {ya_devueltas}: \
                         no se pueden devolver {pedidas} más"
                    )
                } else {
                    write!(f, "De {producto} solo se vendieron {vendidas}, no {pedidas}")
                }
            }
            ErrorDevolucion::Base(e) => write!(f, "No se pudo registrar la devolución: {e}"),
        }
    }
}

impl From<rusqlite::Error> for ErrorDevolucion {
    fn from(e: rusqlite::Error) -> Self {
        ErrorDevolucion::Base(e)
    }
}

/// Cómo se reconoce una línea entre la venta y lo que se devuelve.
fn llave(producto_id: &str, variante: &str) -> String {
    format!("{producto_id}\u{1}{variante}")
}

/// Cuánto queda por devolver de cada línea de una venta.
///
/// Es la función de la que depende que una venta de un café no se convierta en
/// una fuente de efectivo. Cuenta lo ya devuelto en **todas** las devoluciones
/// anteriores de esa venta, no solo en la última.
pub fn devolubles(conexion: &Connection, venta_id: &str) -> Result<Vec<(LineaVenta, i64)>> {
    let mut consulta = conexion.prepare(
        "SELECT producto_id, nombre, variante, precio, cantidad, nota, extras
         FROM venta_items WHERE venta_id = ?1 ORDER BY linea",
    )?;
    let vendidas: Vec<LineaVenta> = consulta
        .query_map([venta_id], |f| {
            Ok(LineaVenta {
                producto_id: f.get(0)?,
                nombre: f.get(1)?,
                variante: f.get(2)?,
                precio: Pesos(f.get(3)?),
                cantidad: f.get(4)?,
                nota: f.get(5)?,
                /* Lo que llevaba puesto. Una devolución tiene que poder decir
                   que volvió la hamburguesa **con** el queso extra. */
                extras: serde_json::from_str(&f.get::<_, String>(6)?).unwrap_or_default(),
            })
        })?
        .collect::<Result<Vec<_>>>()?;

    let mut ya = conexion.prepare(
        "SELECT di.producto_id, di.variante, SUM(di.cantidad)
         FROM devolucion_items di
         JOIN devoluciones d ON d.id = di.devolucion_id
         WHERE d.venta_id = ?1
         GROUP BY di.producto_id, di.variante",
    )?;
    let devueltas: std::collections::HashMap<String, i64> = ya
        .query_map([venta_id], |f| {
            Ok((llave(&f.get::<_, String>(0)?, &f.get::<_, String>(1)?), f.get(2)?))
        })?
        .collect::<Result<_>>()?;

    Ok(vendidas
        .into_iter()
        .map(|linea| {
            let fuera = devueltas.get(&llave(&linea.producto_id, &linea.variante)).copied().unwrap_or(0);
            let quedan = (linea.cantidad - fuera).max(0);
            (linea, quedan)
        })
        .collect())
}

/// Registra la devolución y la deja encolada, todo o nada.
///
/// Igual que una venta: si la fila de la cola se escribiera después del commit,
/// una caída entre las dos dejaría plata devuelta que la nube nunca sabría, y
/// el inventario del negocio quedaría corto para siempre.
#[allow(clippy::too_many_arguments)]
pub fn registrar(
    conexion: &mut Connection,
    venta_id: &str,
    items: &[LineaVenta],
    medio: &str,
    motivo: &str,
    cajero: &str,
    autorizo: &str,
    ahora: &str,
) -> Result<Devolucion, ErrorDevolucion> {
    if items.is_empty() {
        return Err(ErrorDevolucion::SinItems);
    }
    if autorizo.trim().is_empty() {
        return Err(ErrorDevolucion::SinAutorizacion);
    }
    if motivo.trim().len() < 3 {
        return Err(ErrorDevolucion::SinMotivo);
    }

    let consecutivo: i64 = conexion
        .query_row("SELECT consecutivo FROM ventas WHERE id = ?1", [venta_id], |f| f.get(0))
        .map_err(|_| ErrorDevolucion::SinVenta)?;

    let turno: String = conexion
        .query_row("SELECT id FROM turnos WHERE estado = 'ABIERTO'", [], |f| f.get(0))
        .map_err(|_| ErrorDevolucion::SinTurno)?;

    /* Se comprueba contra lo vendido **y contra lo ya devuelto**. Sin la
       segunda parte, devolver el mismo café diez veces seguidas sacaría diez
       cafés de la gaveta. */
    let disponibles = devolubles(conexion, venta_id)?;
    let mut total = Pesos::CERO;

    for item in items {
        if item.cantidad <= 0 {
            return Err(ErrorDevolucion::SinItems);
        }

        let encontrada = disponibles
            .iter()
            .find(|(l, _)| llave(&l.producto_id, &l.variante) == llave(&item.producto_id, &item.variante));

        let Some((vendida, quedan)) = encontrada else {
            return Err(ErrorDevolucion::DeMas {
                producto: item.nombre.clone(),
                vendidas: 0,
                ya_devueltas: 0,
                pedidas: item.cantidad,
            });
        };

        if item.cantidad > *quedan {
            return Err(ErrorDevolucion::DeMas {
                producto: item.nombre.clone(),
                vendidas: vendida.cantidad,
                ya_devueltas: vendida.cantidad - quedan,
                pedidas: item.cantidad,
            });
        }

        /* El precio sale de la venta, no de lo que mande la pantalla: devolver
           a un precio distinto del que se cobró es la forma silenciosa de
           sacar plata de la caja. */
        let linea = vendida.precio.por(item.cantidad).ok_or(ErrorDevolucion::SinItems)?;
        total = total.mas(linea).ok_or(ErrorDevolucion::SinItems)?;
    }

    let id = Uuid::now_v7().to_string();
    let en_efectivo = medio.eq_ignore_ascii_case("efectivo");
    let medio_limpio = if en_efectivo { "efectivo" } else { medio };

    let tx = conexion.transaction()?;

    tx.execute(
        "INSERT INTO devoluciones (id, venta_id, turno_id, cajero, autorizo, total, medio, motivo, creada_en)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![id, venta_id, turno, cajero, autorizo, total.0, medio_limpio, motivo.trim(), ahora],
    )?;

    for (i, item) in items.iter().enumerate() {
        let precio = disponibles
            .iter()
            .find(|(l, _)| llave(&l.producto_id, &l.variante) == llave(&item.producto_id, &item.variante))
            .map(|(l, _)| l.precio)
            .unwrap_or(item.precio);

        tx.execute(
            "INSERT INTO devolucion_items (devolucion_id, linea, producto_id, nombre, variante, precio, cantidad)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![id, i as i64 + 1, item.producto_id, item.nombre, item.variante, precio.0, item.cantidad],
        )?;
    }

    /* A la nube, en la misma transacción. Allá es donde el inventario vuelve a
       sumar: esta caja no lleva existencias —el catálogo local no tiene stock—
       y por eso la reversión no ocurre aquí. */
    let payload = serde_json::json!({
        "id": id,
        "venta_id": venta_id,
        "consecutivo": consecutivo,
        "turno_id": turno,
        "total": total.0,
        "medio": medio_limpio,
        "motivo": motivo.trim(),
        "cajero": cajero,
        "autorizo": autorizo,
        "creada_en": ahora,
        "items": items,
    })
    .to_string();

    tx.execute(
        "INSERT INTO outbox (entidad, entidad_id, operacion, payload, creado_en)
         VALUES ('devolucion', ?1, 'crear', ?2, ?3)",
        params![id, payload, ahora],
    )?;

    tx.commit()?;

    Ok(Devolucion {
        id,
        venta_id: venta_id.to_string(),
        consecutivo,
        total,
        medio: medio_limpio.to_string(),
        motivo: motivo.trim().to_string(),
        cajero: cajero.to_string(),
        autorizo: autorizo.to_string(),
        creada_en: ahora.to_string(),
    })
}

/// Lo devuelto en efectivo durante un turno. El arqueo lo resta de la gaveta.
pub fn efectivo_del_turno(conexion: &Connection, turno_id: &str) -> Result<Pesos> {
    conexion
        .query_row(
            "SELECT COALESCE(SUM(total), 0) FROM devoluciones
             WHERE turno_id = ?1 AND medio = 'efectivo'",
            [turno_id],
            |f| f.get(0),
        )
        .map(Pesos)
}

/// Las últimas ventas, para encontrar la que hay que devolver.
///
/// Por consecutivo descendente: el cliente que vuelve casi siempre acaba de
/// salir, y el número que trae en la tirilla es el consecutivo.
pub fn ultimas_ventas(conexion: &Connection, cuantas: i64) -> Result<Vec<(String, i64, i64, String)>> {
    let mut consulta = conexion.prepare(
        "SELECT id, consecutivo, total, creada_en FROM ventas
         ORDER BY consecutivo DESC LIMIT ?1",
    )?;
    let filas = consulta.query_map([cuantas], |f| {
        Ok((f.get(0)?, f.get(1)?, f.get(2)?, f.get(3)?))
    })?;
    filas.collect()
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use crate::{db, turnos, venta};

    const AHORA: &str = "2026-09-20T15:00:00-05:00";

    fn linea(nombre: &str, precio: i64, cantidad: i64) -> LineaVenta {
        LineaVenta {
            producto_id: format!("p-{nombre}"),
            nombre: nombre.to_string(),
            variante: String::new(),
            precio: Pesos(precio),
            cantidad,
            nota: String::new(),
            extras: vec![],
        }
    }

    /// Una caja con turno abierto y una venta hecha.
    fn con_venta(items: Vec<LineaVenta>) -> (Connection, String) {
        let mut c = db::abrir_en_memoria().unwrap();
        let t = turnos::abrir(&c, "u1", "Ana", Pesos(100_000), AHORA).unwrap();

        let v = venta::NuevaVenta {
            items,
            medio_pago: "efectivo".into(),
            recibido: Pesos(500_000),
            cajero: "Ana".into(),
            turno_id: t.id.clone(),
            iva_porcentaje: 0,
            pago: None,
            descuento: Pesos::CERO,
            descuento_motivo: String::new(),
            propina: Pesos::CERO,
            pagos: vec![],
        };
        let r = venta::registrar(&mut c, &v, AHORA).unwrap();
        (c, r.id)
    }

    #[test]
    fn devolver_no_borra_la_venta() {
        /* Es la diferencia entre un registro contable y uno que se puede
           alterar: si la venta desapareciera, el turno donde se cobró cerraría
           distinto cada vez que alguien devuelve algo del día anterior. */
        let (mut c, venta_id) = con_venta(vec![linea("Café", 5_000, 2)]);

        registrar(&mut c, &venta_id, &[linea("Café", 5_000, 1)], "efectivo", "Salió frío", "Ana", "Luis", AHORA)
            .unwrap();

        let sigue: i64 = c
            .query_row("SELECT COUNT(*) FROM ventas WHERE id = ?1", [&venta_id], |f| f.get(0))
            .unwrap();
        assert_eq!(sigue, 1);
    }

    #[test]
    fn el_total_sale_de_lo_que_se_cobro() {
        let (mut c, venta_id) = con_venta(vec![linea("Almuerzo", 20_000, 2)]);

        let d = registrar(&mut c, &venta_id, &[linea("Almuerzo", 20_000, 1)], "efectivo", "Mal servido", "Ana", "Luis", AHORA)
            .unwrap();

        assert_eq!(d.total, Pesos(20_000));
    }

    #[test]
    fn no_se_devuelve_a_un_precio_inventado() {
        /* Si el precio viniera de la pantalla, cambiar un 5.000 por un 50.000
           sacaría cuarenta y cinco mil pesos de la gaveta sin que nada lo
           delatara. El precio sale de la venta. */
        let (mut c, venta_id) = con_venta(vec![linea("Café", 5_000, 1)]);

        let mut mentira = linea("Café", 50_000, 1);
        mentira.precio = Pesos(50_000);

        let d = registrar(&mut c, &venta_id, &[mentira], "efectivo", "Salió frío", "Ana", "Luis", AHORA).unwrap();

        assert_eq!(d.total, Pesos(5_000), "vale lo que se cobró, no lo que pidieron");
    }

    #[test]
    fn no_se_puede_devolver_mas_de_lo_vendido() {
        let (mut c, venta_id) = con_venta(vec![linea("Café", 5_000, 2)]);

        let r = registrar(&mut c, &venta_id, &[linea("Café", 5_000, 3)], "efectivo", "Salió frío", "Ana", "Luis", AHORA);

        assert!(matches!(r, Err(ErrorDevolucion::DeMas { .. })));
    }

    #[test]
    fn dos_devoluciones_no_suman_mas_que_la_venta() {
        /* La regla que convierte una venta de un café en una fuente de
           efectivo si falta: devolver uno, y otro, y otro. */
        let (mut c, venta_id) = con_venta(vec![linea("Café", 5_000, 2)]);

        registrar(&mut c, &venta_id, &[linea("Café", 5_000, 2)], "efectivo", "Salió frío", "Ana", "Luis", AHORA)
            .unwrap();

        let segunda = registrar(&mut c, &venta_id, &[linea("Café", 5_000, 1)], "efectivo", "Otra vez", "Ana", "Luis", AHORA);

        assert!(matches!(segunda, Err(ErrorDevolucion::DeMas { ya_devueltas: 2, .. })));
    }

    #[test]
    fn lo_que_queda_por_devolver_baja_con_cada_devolucion() {
        let (mut c, venta_id) = con_venta(vec![linea("Café", 5_000, 3)]);

        assert_eq!(devolubles(&c, &venta_id).unwrap()[0].1, 3);

        registrar(&mut c, &venta_id, &[linea("Café", 5_000, 1)], "efectivo", "Salió frío", "Ana", "Luis", AHORA)
            .unwrap();

        assert_eq!(devolubles(&c, &venta_id).unwrap()[0].1, 2);
    }

    #[test]
    fn una_talla_no_se_devuelve_con_otra() {
        // Dos variantes del mismo producto son dos líneas distintas.
        let mut ema = linea("Camiseta", 40_000, 1);
        ema.variante = "M".into();
        let mut ele = linea("Camiseta", 40_000, 1);
        ele.variante = "L".into();

        let (mut c, venta_id) = con_venta(vec![ema.clone(), ele]);

        registrar(&mut c, &venta_id, &[ema], "efectivo", "No le quedó", "Ana", "Luis", AHORA).unwrap();

        let quedan = devolubles(&c, &venta_id).unwrap();
        assert_eq!(quedan.iter().find(|(l, _)| l.variante == "M").unwrap().1, 0);
        assert_eq!(quedan.iter().find(|(l, _)| l.variante == "L").unwrap().1, 1, "la L sigue entera");
    }

    #[test]
    fn sin_supervisor_no_hay_devolucion() {
        /* Es plata que sale de la gaveta sin nada vendido a cambio: sin
           autorización sería el camino más corto para vaciar una caja. */
        let (mut c, venta_id) = con_venta(vec![linea("Café", 5_000, 1)]);

        let r = registrar(&mut c, &venta_id, &[linea("Café", 5_000, 1)], "efectivo", "Salió frío", "Ana", "  ", AHORA);

        assert!(matches!(r, Err(ErrorDevolucion::SinAutorizacion)));
    }

    #[test]
    fn sin_motivo_tampoco() {
        let (mut c, venta_id) = con_venta(vec![linea("Café", 5_000, 1)]);

        let r = registrar(&mut c, &venta_id, &[linea("Café", 5_000, 1)], "efectivo", "x", "Ana", "Luis", AHORA);

        assert!(matches!(r, Err(ErrorDevolucion::SinMotivo)));
    }

    #[test]
    fn una_devolucion_rechazada_no_deja_rastro() {
        /* Ni fila de devolución ni fila en la cola: si quedara encolada, la
           nube restaría inventario de algo que en la caja no pasó. */
        let (mut c, venta_id) = con_venta(vec![linea("Café", 5_000, 1)]);

        let _ = registrar(&mut c, &venta_id, &[linea("Café", 5_000, 9)], "efectivo", "Salió frío", "Ana", "Luis", AHORA);

        let cuantas: i64 = c.query_row("SELECT COUNT(*) FROM devoluciones", [], |f| f.get(0)).unwrap();
        assert_eq!(cuantas, 0);

        let en_cola: i64 = c
            .query_row("SELECT COUNT(*) FROM outbox WHERE entidad = 'devolucion'", [], |f| f.get(0))
            .unwrap();
        assert_eq!(en_cola, 0);
    }

    #[test]
    fn la_devolucion_viaja_a_la_nube() {
        // Allá es donde el inventario vuelve a sumar: esta caja no lleva stock.
        let (mut c, venta_id) = con_venta(vec![linea("Café", 5_000, 2)]);

        registrar(&mut c, &venta_id, &[linea("Café", 5_000, 1)], "efectivo", "Salió frío", "Ana", "Luis", AHORA)
            .unwrap();

        let payload: String = c
            .query_row("SELECT payload FROM outbox WHERE entidad = 'devolucion'", [], |f| f.get(0))
            .unwrap();
        let leido: serde_json::Value = serde_json::from_str(&payload).unwrap();

        assert_eq!(leido["total"], 5_000);
        assert_eq!(leido["items"].as_array().unwrap().len(), 1);
        assert_eq!(leido["autorizo"], "Luis");
    }

    #[test]
    fn solo_lo_devuelto_en_efectivo_sale_de_la_gaveta() {
        /* Por datáfono la reversa la hace el banco y la gaveta no se entera.
           Restarla del esperado dejaría la caja con un sobrante todos los días
           que alguien devuelve una compra con tarjeta. */
        let (mut c, venta_id) = con_venta(vec![linea("Almuerzo", 20_000, 2)]);

        registrar(&mut c, &venta_id, &[linea("Almuerzo", 20_000, 1)], "efectivo", "Mal servido", "Ana", "Luis", AHORA)
            .unwrap();
        registrar(&mut c, &venta_id, &[linea("Almuerzo", 20_000, 1)], "tarjeta", "Mal servido", "Ana", "Luis", AHORA)
            .unwrap();

        let turno: String = c
            .query_row("SELECT id FROM turnos WHERE estado = 'ABIERTO'", [], |f| f.get(0))
            .unwrap();

        assert_eq!(efectivo_del_turno(&c, &turno).unwrap(), Pesos(20_000));
    }

    #[test]
    fn no_se_devuelve_una_venta_que_no_esta_en_esta_caja() {
        // Pasa de verdad: la venta se hizo en otra terminal del mismo negocio.
        let (mut c, _) = con_venta(vec![linea("Café", 5_000, 1)]);

        let r = registrar(&mut c, "no-existe", &[linea("Café", 5_000, 1)], "efectivo", "Salió frío", "Ana", "Luis", AHORA);

        assert!(matches!(r, Err(ErrorDevolucion::SinVenta)));
    }
}
