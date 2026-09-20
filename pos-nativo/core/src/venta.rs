//! Registrar una venta.
//!
//! Es la única operación que no puede fallar a medias. Todo —la venta, sus
//! líneas y la fila de la cola hacia la nube— entra en una sola transacción de
//! SQLite: o queda completa, o es como si el cajero nunca hubiera cobrado.
//!
//! El id lo genera la caja, no el servidor. Eso es lo que permite reintentar el
//! envío diez veces sin que en la nube aparezcan diez ventas: el servidor lo usa
//! como llave de idempotencia.

use crate::dinero::Pesos;
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineaVenta {
    pub producto_id: String,
    pub nombre: String,
    #[serde(default)]
    pub variante: String,
    pub precio: Pesos,
    pub cantidad: i64,
}

impl LineaVenta {
    pub fn total(&self) -> Option<Pesos> {
        self.precio.por(self.cantidad)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NuevaVenta {
    pub items: Vec<LineaVenta>,
    #[serde(default)]
    pub medio_pago: String,
    #[serde(default)]
    pub recibido: Pesos,
    #[serde(default)]
    pub cajero: String,
    #[serde(default)]
    pub turno_id: String,
    /// IVA incluido en los precios. 0 si el negocio no es responsable de IVA.
    #[serde(default)]
    pub iva_porcentaje: u32,
    /// El voucher, cuando se cobró con tarjeta.
    #[serde(default)]
    pub pago: Option<crate::pagos::RespuestaPago>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VentaRegistrada {
    pub id: String,
    pub consecutivo: i64,
    pub total: Pesos,
    pub iva: Pesos,
    pub vuelto: Pesos,
    pub creada_en: String,
}

#[derive(Debug)]
pub enum ErrorVenta {
    /// No hay turno abierto. Sin turno, un descuadre no tiene dueño.
    SinTurno,
    SinItems,
    CantidadInvalida,
    Desbordado,
    PagoInsuficiente { total: Pesos, recibido: Pesos },
    Base(rusqlite::Error),
}

impl std::fmt::Display for ErrorVenta {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            // Mensajes para el cajero, que es quien los va a leer con un cliente
            // esperando al frente.
            ErrorVenta::SinTurno => write!(f, "Abre un turno antes de vender"),
            ErrorVenta::SinItems => write!(f, "No hay nada que cobrar"),
            ErrorVenta::CantidadInvalida => write!(f, "Hay una cantidad inválida en el pedido"),
            ErrorVenta::Desbordado => write!(f, "El total es demasiado grande, revisa las cantidades"),
            ErrorVenta::PagoInsuficiente { total, recibido } => {
                write!(f, "Con {recibido} no alcanza: el total es {total}")
            }
            ErrorVenta::Base(e) => write!(f, "No se pudo guardar la venta: {e}"),
        }
    }
}

impl From<rusqlite::Error> for ErrorVenta {
    fn from(e: rusqlite::Error) -> Self {
        ErrorVenta::Base(e)
    }
}

/// El total de un carrito, sin tocar la base. La interfaz lo usa en cada tecla.
pub fn total_de(items: &[LineaVenta]) -> Result<Pesos, ErrorVenta> {
    if items.is_empty() {
        return Err(ErrorVenta::SinItems);
    }
    let mut total = Pesos::CERO;
    for item in items {
        if item.cantidad <= 0 {
            return Err(ErrorVenta::CantidadInvalida);
        }
        let linea = item.total().ok_or(ErrorVenta::Desbordado)?;
        total = total.mas(linea).ok_or(ErrorVenta::Desbordado)?;
    }
    Ok(total)
}

/// Guarda la venta y la deja encolada para la nube, todo o nada.
pub fn registrar(
    conexion: &mut Connection,
    venta: &NuevaVenta,
    ahora: &str,
) -> Result<VentaRegistrada, ErrorVenta> {
    let total = total_de(&venta.items)?;

    /* Toda venta pertenece a un turno abierto. Es lo que hace que el arqueo
       signifique algo: sin esto, las ventas quedarían huérfanas y el cierre no
       tendría contra qué comparar la gaveta. */
    let turno_abierto: i64 = conexion.query_row(
        "SELECT COUNT(*) FROM turnos WHERE id = ?1 AND estado = 'ABIERTO'",
        [&venta.turno_id],
        |f| f.get(0),
    )?;
    if turno_abierto == 0 {
        return Err(ErrorVenta::SinTurno);
    }

    /* El efectivo es lo único donde el pago puede quedarse corto: con tarjeta o
       transferencia el monto lo define el datáfono, no el cajero. */
    let vuelto = if venta.medio_pago == "efectivo" && venta.recibido > Pesos::CERO {
        Pesos::vuelto(total, venta.recibido).ok_or(ErrorVenta::PagoInsuficiente {
            total,
            recibido: venta.recibido,
        })?
    } else {
        Pesos::CERO
    };

    let (_base, iva) = total.desglosar_iva(venta.iva_porcentaje);

    /* UUIDv7 y no v4: lleva el instante adelante, así los ids salen ordenados
       en el tiempo. Eso le sirve al índice de Mongo del otro lado —las
       inserciones caen al final del árbol en vez de dispersas— y hace legible
       cualquier listado de ventas por id. */
    let id = Uuid::now_v7().to_string();

    let tx = conexion.transaction()?;

    /* El consecutivo es para el humano: "la venta 143 de hoy". No identifica
       nada hacia la nube —para eso está el UUID— así que un salto por una
       transacción revertida no rompe nada. */
    let consecutivo: i64 = tx.query_row(
        "SELECT COALESCE(MAX(consecutivo), 0) + 1 FROM ventas",
        [],
        |f| f.get(0),
    )?;

    let (autorizacion, ultimos4, franquicia) = match &venta.pago {
        Some(p) => (
            p.codigo_autorizacion.clone(),
            p.ultimos_cuatro.clone().unwrap_or_default(),
            p.franquicia.clone().unwrap_or_default(),
        ),
        None => (String::new(), String::new(), String::new()),
    };

    tx.execute(
        "INSERT INTO ventas (id, consecutivo, total, iva, recibido, vuelto, medio_pago, cajero, turno_id, creada_en,
                             pago_autorizacion, pago_ultimos4, pago_franquicia)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            id,
            consecutivo,
            total.0,
            iva.0,
            venta.recibido.0,
            vuelto.0,
            if venta.medio_pago.is_empty() { "efectivo" } else { &venta.medio_pago },
            venta.cajero,
            venta.turno_id,
            ahora,
            autorizacion,
            ultimos4,
            franquicia
        ],
    )?;

    for (i, item) in venta.items.iter().enumerate() {
        tx.execute(
            "INSERT INTO venta_items (venta_id, linea, producto_id, nombre, variante, precio, cantidad)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![id, i as i64 + 1, item.producto_id, item.nombre, item.variante, item.precio.0, item.cantidad],
        )?;
    }

    /* La cola, en la misma transacción. Este es el detalle del que depende que
       no se pierda una venta: si se encolara después, una caída entre el commit
       y el encolado dejaría una venta que nunca sube. */
    let payload = serde_json::json!({
        "id": id,
        "consecutivo": consecutivo,
        "total": total.0,
        "iva": iva.0,
        "medio_pago": venta.medio_pago,
        "cajero": venta.cajero,
        "turno_id": venta.turno_id,
        "creada_en": ahora,
        "items": venta.items,
        // El voucher viaja con la venta: el cuadre de tarjetas se hace en el panel.
        "pago": venta.pago,
    })
    .to_string();

    tx.execute(
        "INSERT INTO outbox (entidad, entidad_id, operacion, payload, creado_en)
         VALUES ('venta', ?1, 'crear', ?2, ?3)",
        params![id, payload, ahora],
    )?;

    tx.commit()?;

    Ok(VentaRegistrada { id, consecutivo, total, iva, vuelto, creada_en: ahora.to_string() })
}

/// Lo que falta por subir, en orden de llegada.
pub fn pendientes(conexion: &Connection, limite: i64) -> Result<Vec<(i64, String)>> {
    let mut consulta = conexion.prepare(
        "SELECT id, payload FROM outbox WHERE enviado_en IS NULL ORDER BY id LIMIT ?1",
    )?;
    let filas = consulta.query_map([limite], |f| Ok((f.get(0)?, f.get(1)?)))?;
    filas.collect()
}

/// Marca como enviado lo que la nube ya confirmó.
pub fn marcar_enviado(conexion: &Connection, outbox_id: i64, ahora: &str) -> Result<()> {
    conexion.execute(
        "UPDATE outbox SET enviado_en = ?2 WHERE id = ?1",
        params![outbox_id, ahora],
    )?;
    conexion.execute(
        "UPDATE ventas SET estado_sync = 'sincronizada'
         WHERE id = (SELECT entidad_id FROM outbox WHERE id = ?1)",
        params![outbox_id],
    )?;
    Ok(())
}

/// Deja anotado por qué falló, sin sacarlo de la cola.
pub fn anotar_fallo(conexion: &Connection, outbox_id: i64, error: &str) -> Result<()> {
    conexion.execute(
        "UPDATE outbox SET intentos = intentos + 1, ultimo_error = ?2 WHERE id = ?1",
        params![outbox_id, &error.chars().take(300).collect::<String>()],
    )?;
    Ok(())
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use crate::{db, turnos};

    const AHORA: &str = "2026-09-19T15:04:05-05:00";

    fn item(nombre: &str, precio: i64, cantidad: i64) -> LineaVenta {
        LineaVenta {
            producto_id: format!("p-{nombre}"),
            nombre: nombre.to_string(),
            variante: String::new(),
            precio: Pesos(precio),
            cantidad,
        }
    }

    /* Una caja con su turno abierto: sin turno no se vende, que es justo lo
       que exige . */
    fn caja() -> (Connection, String) {
        let c = db::abrir_en_memoria().unwrap();
        let t = turnos::abrir(&c, "u1", "Ana", Pesos(0), AHORA).unwrap();
        (c, t.id)
    }

    fn venta_de(items: Vec<LineaVenta>, turno_id: &str) -> NuevaVenta {
        NuevaVenta {
            items,
            medio_pago: "efectivo".into(),
            recibido: Pesos(100_000),
            cajero: "Ana".into(),
            turno_id: turno_id.into(),
            iva_porcentaje: 19,
            pago: None,
        }
    }

    #[test]
    fn una_venta_deja_venta_items_y_cola_o_no_deja_nada() {
        let (mut c, t) = caja();
        let r = registrar(&mut c, &venta_de(vec![item("Café", 5_000, 2), item("Pan", 1_500, 3)], &t), AHORA).unwrap();

        assert_eq!(r.total, Pesos(14_500));
        assert_eq!(r.vuelto, Pesos(85_500));

        let items: i64 = c.query_row("SELECT COUNT(*) FROM venta_items", [], |f| f.get(0)).unwrap();
        let cola: i64 = c.query_row("SELECT COUNT(*) FROM outbox", [], |f| f.get(0)).unwrap();
        assert_eq!(items, 2);
        assert_eq!(cola, 1, "la venta tiene que quedar encolada en la misma transacción");
    }

    #[test]
    fn cada_venta_nace_con_id_propio() {
        // Es lo que impide que un reintento duplique la venta en la nube.
        let (mut c, t) = caja();
        let a = registrar(&mut c, &venta_de(vec![item("Café", 5_000, 1)], &t), AHORA).unwrap();
        let b = registrar(&mut c, &venta_de(vec![item("Café", 5_000, 1)], &t), AHORA).unwrap();
        assert_ne!(a.id, b.id);
        assert_eq!((a.consecutivo, b.consecutivo), (1, 2));
    }

    #[test]
    fn cobrar_de_menos_no_se_guarda() {
        let (mut c, t) = caja();
        let mut v = venta_de(vec![item("Televisor", 900_000, 1)], &t);
        v.recibido = Pesos(50_000);

        let r = registrar(&mut c, &v, AHORA);
        assert!(matches!(r, Err(ErrorVenta::PagoInsuficiente { .. })));

        let ventas: i64 = c.query_row("SELECT COUNT(*) FROM ventas", [], |f| f.get(0)).unwrap();
        assert_eq!(ventas, 0, "una venta rechazada no puede dejar rastro");
    }

    #[test]
    fn con_tarjeta_no_se_exige_efectivo_recibido() {
        let (mut c, t) = caja();
        let mut v = venta_de(vec![item("Televisor", 900_000, 1)], &t);
        v.medio_pago = "tarjeta".into();
        v.recibido = Pesos::CERO;

        let r = registrar(&mut c, &v, AHORA).unwrap();
        assert_eq!(r.vuelto, Pesos::CERO);
    }

    #[test]
    fn un_carrito_vacio_no_es_una_venta() {
        let (mut c, t) = caja();
        assert!(matches!(registrar(&mut c, &venta_de(vec![], &t), AHORA), Err(ErrorVenta::SinItems)));
    }

    #[test]
    fn una_cantidad_en_cero_o_negativa_se_rechaza() {
        let (mut c, t) = caja();
        assert!(matches!(
            registrar(&mut c, &venta_de(vec![item("Café", 5_000, 0)], &t), AHORA),
            Err(ErrorVenta::CantidadInvalida)
        ));
        assert!(matches!(
            registrar(&mut c, &venta_de(vec![item("Café", 5_000, -2)], &t), AHORA),
            Err(ErrorVenta::CantidadInvalida)
        ));
    }

    #[test]
    fn el_iva_se_guarda_desglosado_y_cuadra() {
        let (mut c, t) = caja();
        let r = registrar(&mut c, &venta_de(vec![item("Café", 10_000, 1)], &t), AHORA).unwrap();
        assert_eq!(r.iva, Pesos(1_597));
        assert_eq!(r.total, Pesos(10_000));
    }

    #[test]
    fn la_cola_sale_en_orden_y_se_vacia_al_confirmar() {
        let (mut c, t) = caja();
        registrar(&mut c, &venta_de(vec![item("A", 1_000, 1)], &t), AHORA).unwrap();
        registrar(&mut c, &venta_de(vec![item("B", 2_000, 1)], &t), AHORA).unwrap();

        let cola = pendientes(&c, 10).unwrap();
        assert_eq!(cola.len(), 2);
        assert!(cola[0].0 < cola[1].0, "primero lo que se vendió primero");

        marcar_enviado(&c, cola[0].0, AHORA).unwrap();
        assert_eq!(pendientes(&c, 10).unwrap().len(), 1);

        let sincronizadas: i64 = c
            .query_row("SELECT COUNT(*) FROM ventas WHERE estado_sync = 'sincronizada'", [], |f| f.get(0))
            .unwrap();
        assert_eq!(sincronizadas, 1);
    }

    #[test]
    fn un_fallo_de_red_no_saca_la_venta_de_la_cola() {
        // Si un error la borrara, la venta se perdería sin que nadie se entere.
        let (mut c, t) = caja();
        registrar(&mut c, &venta_de(vec![item("A", 1_000, 1)], &t), AHORA).unwrap();

        let cola = pendientes(&c, 10).unwrap();
        anotar_fallo(&c, cola[0].0, "timeout contra la nube").unwrap();

        assert_eq!(pendientes(&c, 10).unwrap().len(), 1);
        let intentos: i64 = c.query_row("SELECT intentos FROM outbox WHERE id = ?1", [cola[0].0], |f| f.get(0)).unwrap();
        assert_eq!(intentos, 1);
    }

    #[test]
    fn el_payload_encolado_lleva_todo_lo_que_la_nube_necesita() {
        let (mut c, t) = caja();
        let r = registrar(&mut c, &venta_de(vec![item("Café", 5_000, 2)], &t), AHORA).unwrap();

        let (_, payload) = pendientes(&c, 1).unwrap().remove(0);
        let json: serde_json::Value = serde_json::from_str(&payload).unwrap();

        assert_eq!(json["id"], r.id);          // la llave de idempotencia
        assert_eq!(json["total"], 10_000);
        assert_eq!(json["items"][0]["cantidad"], 2);
        assert_eq!(json["turno_id"], t, "la nube tiene que saber de qué turno salió");
    }
}
