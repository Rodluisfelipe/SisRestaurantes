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
use rusqlite::{params, Connection, OptionalExtension, Result};
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
    /// Cómo lo pidió el cliente: "sin cebolla", "término tres cuartos".
    ///
    /// Va en la línea y no en la venta porque en una mesa de cuatro cada plato
    /// se pide distinto, y una nota al pie de la comanda no le dice al cocinero
    /// cuál de las tres hamburguesas es la que va sin salsa.
    #[serde(default)]
    pub nota: String,
}

impl LineaVenta {
    pub fn total(&self) -> Option<Pesos> {
        self.precio.por(self.cantidad)
    }
}

/// Con qué se pagó. Una venta puede tener varios.
///
/// El pago mixto —parte en efectivo, el resto con tarjeta— es diario en
/// mostrador. Antes solo cabía un medio por venta, y el cajero terminaba
/// registrando el total en uno solo: el arqueo cuadraba de milagro y el cuadre
/// de tarjetas del panel no cuadraba nunca.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PagoDetalle {
    /// "efectivo", "tarjeta", "transferencia". En minúsculas al normalizar.
    pub metodo: String,
    pub monto: Pesos,
    /// El voucher o la aprobación, cuando el medio la tiene.
    #[serde(default)]
    pub referencia: String,
}

impl PagoDetalle {
    /// Solo el efectivo admite que sobre. Un datáfono cobra el monto exacto.
    pub fn es_efectivo(&self) -> bool {
        self.metodo.eq_ignore_ascii_case("efectivo")
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
    /// Los medios con los que se pagó.
    ///
    /// Lo que se le rebaja al total. Ya viene autorizado por un supervisor:
    /// quien decide si se puede es la pantalla, aquí solo se aplica y se deja
    /// escrito.
    #[serde(default)]
    pub descuento: Pesos,
    #[serde(default)]
    pub descuento_motivo: String,
    /// Lo que el cliente da de más, voluntariamente, para el personal.
    ///
    /// **No es del negocio.** Se cobra con la venta y se guarda aparte del
    /// total: no es ingreso ni base gravable, y al liquidar el turno hay que
    /// poder separarla sin adivinar.
    #[serde(default)]
    pub propina: Pesos,
    /// Vacío significa "como siempre": se arma uno solo con `medio_pago` y
    /// `recibido`. Eso mantiene andando todo lo que ya existía —incluida
    /// cualquier caja que no se haya actualizado— sin una segunda ruta de
    /// código que mantener.
    #[serde(default)]
    pub pagos: Vec<PagoDetalle>,
}

impl NuevaVenta {
    /// Los pagos, siempre como lista, venga la venta de donde venga.
    /// Necesita el total porque el monto de un pago que no es efectivo no está
    /// escrito en ninguna parte de la venta antigua: el datáfono cobró el total
    /// exacto y nadie lo digitó.
    fn formas_de_pago(&self, total: Pesos) -> Vec<PagoDetalle> {
        if !self.pagos.is_empty() {
            return self.pagos.clone();
        }

        let metodo = if self.medio_pago.is_empty() { "efectivo" } else { &self.medio_pago };
        let es_efectivo = metodo.eq_ignore_ascii_case("efectivo");
        let referencia = self
            .pago
            .as_ref()
            .map(|p| p.codigo_autorizacion.clone())
            .unwrap_or_default();

        /* Con efectivo, el monto es lo que el cajero digitó haber recibido.
           Cero significa "no lo contó porque el cliente pagó justo", así que
           vale el total: si valiera cero, la gaveta esperaría esa plata de
           menos al cerrar el turno y el cajero cargaría con un faltante que no
           es suyo. Con cualquier otro medio el aparato cobró la cifra exacta. */
        let monto = match (es_efectivo, self.recibido > Pesos::CERO) {
            (true, true) => self.recibido,
            _ => total,
        };

        vec![PagoDetalle { metodo: metodo.to_string(), monto, referencia }]
    }
}

/// Qué falta, qué sobra y si la venta se puede cerrar.
///
/// El orden importa: primero se descuenta lo que no es efectivo, porque eso ya
/// está cobrado y no admite vuelto. Lo que quede es lo que el cliente tiene que
/// poner en billetes, y solo sobre eso se calcula el cambio.
pub fn repartir(total: Pesos, pagos: &[PagoDetalle]) -> Result<Pesos, ErrorVenta> {
    let mut no_efectivo = Pesos::CERO;
    let mut efectivo = Pesos::CERO;

    for p in pagos {
        if p.monto < Pesos::CERO {
            return Err(ErrorVenta::PagoInvalido);
        }
        let destino = if p.es_efectivo() { &mut efectivo } else { &mut no_efectivo };
        *destino = destino.mas(p.monto).ok_or(ErrorVenta::Desbordado)?;
    }

    /* Un datáfono no devuelve cambio. Si alguien digitó de más, es un error de
       digitación que hay que atrapar aquí y no al cuadrar el mes. */
    if no_efectivo > total {
        return Err(ErrorVenta::PagoExcedido { total, cobrado: no_efectivo });
    }

    let falta = total.menos(no_efectivo).ok_or(ErrorVenta::Desbordado)?;

    if efectivo < falta {
        return Err(ErrorVenta::PagoInsuficiente { total: falta, recibido: efectivo });
    }

    efectivo.menos(falta).ok_or(ErrorVenta::Desbordado)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VentaRegistrada {
    pub id: String,
    pub consecutivo: i64,
    pub total: Pesos,
    pub iva: Pesos,
    pub vuelto: Pesos,
    pub propina: Pesos,
    /// Lo que el cliente entrega: el total más la propina.
    pub a_pagar: Pesos,
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
    /// Se digitó con tarjeta más de lo que vale la venta. No hay vuelto posible.
    PagoExcedido { total: Pesos, cobrado: Pesos },
    /// Un monto negativo. Casi siempre es un signo de menos que se coló.
    PagoInvalido,
    /// Un descuento mayor que la venta. Dejaría un total negativo.
    DescuentoExcesivo { bruto: Pesos, descuento: Pesos },
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
            ErrorVenta::PagoExcedido { total, cobrado } => {
                write!(f, "Se cobraron {cobrado} y la venta es de {total}: revisa el monto")
            }
            ErrorVenta::PagoInvalido => write!(f, "Hay un monto de pago inválido"),
            ErrorVenta::DescuentoExcesivo { bruto, descuento } => {
                write!(f, "El descuento de {descuento} es mayor que la venta de {bruto}")
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
    let bruto = total_de(&venta.items)?;

    /* El descuento se rebaja aquí y no en la pantalla: si el total llegara ya
       rebajado desde el webview, un descuento sería indistinguible de un precio
       cambiado a mano, y la auditoría no tendría contra qué comparar. */
    if venta.descuento < Pesos::CERO {
        return Err(ErrorVenta::PagoInvalido);
    }
    if venta.descuento > bruto {
        return Err(ErrorVenta::DescuentoExcesivo { bruto, descuento: venta.descuento });
    }
    let total = bruto.menos(venta.descuento).ok_or(ErrorVenta::Desbordado)?;

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

    /* Qué se pagó y con qué. Una sola función decide esto para la venta de un
       solo medio y para la mixta: si fueran dos caminos, el día que cambie la
       regla del vuelto cambiaría en uno solo. */
    /* La propina entra en lo que hay que cubrir. Es plata que el cliente
       entrega y que tiene que salir de algún medio de pago: si el reparto se
       hiciera solo contra el total, una venta de 45.000 con 5.000 de propina
       daría 5.000 de vuelto en vez de cobrarlos. */
    if venta.propina < Pesos::CERO {
        return Err(ErrorVenta::PagoInvalido);
    }
    let a_pagar = total.mas(venta.propina).ok_or(ErrorVenta::Desbordado)?;

    let formas = venta.formas_de_pago(a_pagar);
    let vuelto = repartir(a_pagar, &formas)?;

    /* `medio_pago` se queda como estaba, porque es lo que hace legible un
       listado de ventas sin abrir cada una. Con más de un medio pasa a "mixto",
       y el detalle real vive en `venta_pagos`. */
    let medio_resumen: String = if formas.len() > 1 {
        "mixto".to_string()
    } else {
        formas
            .first()
            .map(|p| p.metodo.to_lowercase())
            .filter(|m| !m.is_empty())
            .unwrap_or_else(|| "efectivo".to_string())
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
                             pago_autorizacion, pago_ultimos4, pago_franquicia,
                             bruto, descuento, descuento_motivo, propina)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
        params![
            id,
            consecutivo,
            total.0,
            iva.0,
            venta.recibido.0,
            vuelto.0,
            medio_resumen,
            venta.cajero,
            venta.turno_id,
            ahora,
            autorizacion,
            ultimos4,
            franquicia,
            bruto.0,
            venta.descuento.0,
            venta.descuento_motivo,
            venta.propina.0
        ],
    )?;

    for (i, item) in venta.items.iter().enumerate() {
        tx.execute(
            "INSERT INTO venta_items (venta_id, linea, producto_id, nombre, variante, precio, cantidad, nota)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![id, i as i64 + 1, item.producto_id, item.nombre, item.variante, item.precio.0, item.cantidad, item.nota],
        )?;
    }

    /* Los pagos, dentro de la misma transacción que la venta. Si quedaran
       fuera, una caída entre los dos escritos dejaría una venta cobrada sin
       registro de con qué se pagó: el arqueo la contaría como efectivo y la
       gaveta no tendría el dinero. */
    for (i, p) in formas.iter().enumerate() {
        tx.execute(
            "INSERT INTO venta_pagos (venta_id, linea, metodo, monto, referencia)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, i as i64 + 1, p.metodo.to_lowercase(), p.monto.0, p.referencia],
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
        "medio_pago": medio_resumen,
        "pagos": formas,
        "bruto": bruto.0,
        "descuento": venta.descuento.0,
        "descuento_motivo": venta.descuento_motivo,
        "propina": venta.propina.0,
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

    Ok(VentaRegistrada {
        id,
        consecutivo,
        total,
        iva,
        vuelto,
        propina: venta.propina,
        a_pagar,
        creada_en: ahora.to_string(),
    })
}

/// Una venta ya guardada, con todo lo que hace falta para reimprimirla.
///
/// Reimprimir no puede reconstruirse desde la pantalla: el carrito ya se
/// limpió y el cliente puede volver media hora después pidiendo su tirilla. Se
/// relee de la base, que es donde está lo que de verdad se cobró.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VentaCompleta {
    pub id: String,
    pub consecutivo: i64,
    pub total: Pesos,
    pub iva: Pesos,
    pub recibido: Pesos,
    pub vuelto: Pesos,
    pub medio_pago: String,
    pub cajero: String,
    pub creada_en: String,
    pub items: Vec<LineaVenta>,
    pub pago_autorizacion: String,
    pub pago_ultimos4: String,
    /// Lo que valía antes del descuento. Igual al total si no hubo.
    #[serde(default)]
    pub bruto: Pesos,
    #[serde(default)]
    pub descuento: Pesos,
    #[serde(default)]
    pub descuento_motivo: String,
    #[serde(default)]
    pub propina: Pesos,
    /// Con qué se pagó. Una sola entrada en la venta corriente.
    ///
    /// La reimpresión tiene que poder decir "treinta mil en efectivo y veinte
    /// con tarjeta": es justo la tirilla que alguien vuelve a pedir cuando no
    /// le cuadra un gasto.
    #[serde(default)]
    pub pagos: Vec<PagoDetalle>,
}

/// Relee una venta con sus líneas.
pub fn detalle(conexion: &Connection, venta_id: &str) -> Result<Option<VentaCompleta>> {
    let base = conexion.query_row(
        "SELECT id, consecutivo, total, iva, recibido, vuelto, medio_pago, cajero, creada_en,
                pago_autorizacion, pago_ultimos4, bruto, descuento, descuento_motivo, propina
         FROM ventas WHERE id = ?1",
        [venta_id],
        |f| {
            Ok(VentaCompleta {
                id: f.get(0)?,
                consecutivo: f.get(1)?,
                total: Pesos(f.get(2)?),
                iva: Pesos(f.get(3)?),
                recibido: Pesos(f.get(4)?),
                vuelto: Pesos(f.get(5)?),
                medio_pago: f.get(6)?,
                cajero: f.get(7)?,
                creada_en: f.get(8)?,
                items: vec![],
                pago_autorizacion: f.get(9)?,
                pago_ultimos4: f.get(10)?,
                bruto: Pesos(f.get(11)?),
                descuento: Pesos(f.get(12)?),
                descuento_motivo: f.get(13)?,
                propina: Pesos(f.get(14)?),
                pagos: vec![],
            })
        },
    );

    let mut completa = match base {
        Ok(v) => v,
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
        Err(e) => return Err(e),
    };

    let mut consulta = conexion.prepare(
        "SELECT producto_id, nombre, variante, precio, cantidad, nota
         FROM venta_items WHERE venta_id = ?1 ORDER BY linea",
    )?;
    let filas = consulta.query_map([venta_id], |f| {
        Ok(LineaVenta {
            producto_id: f.get(0)?,
            nombre: f.get(1)?,
            variante: f.get(2)?,
            precio: Pesos(f.get(3)?),
            cantidad: f.get(4)?,
            nota: f.get(5)?,
        })
    })?;

    completa.items = filas.collect::<Result<Vec<_>>>()?;

    let mut pagos = conexion.prepare(
        "SELECT metodo, monto, referencia FROM venta_pagos WHERE venta_id = ?1 ORDER BY linea",
    )?;
    let cobros = pagos.query_map([venta_id], |f| {
        Ok(PagoDetalle {
            metodo: f.get(0)?,
            monto: Pesos(f.get(1)?),
            referencia: f.get(2)?,
        })
    })?;

    completa.pagos = cobros.collect::<Result<Vec<_>>>()?;
    Ok(Some(completa))
}

/// La última venta del turno. Es la que el cajero quiere reimprimir el 99% de
/// las veces: acabó de cobrar y la impresora no tenía papel.
pub fn ultima_del_turno(conexion: &Connection, turno_id: &str) -> Result<Option<String>> {
    conexion
        .query_row(
            "SELECT id FROM ventas WHERE turno_id = ?1 ORDER BY consecutivo DESC LIMIT 1",
            [turno_id],
            |f| f.get(0),
        )
        .optional()
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
            nota: String::new(),
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
            descuento: Pesos::CERO,
            propina: Pesos::CERO,
            descuento_motivo: String::new(),
            pagos: vec![],
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
    fn una_venta_se_puede_releer_entera_para_reimprimirla() {
        /* El carrito ya se limpió y el cliente vuelve media hora después
           pidiendo su tirilla: lo que se imprime sale de la base. */
        let (mut c, t) = caja();
        let r = registrar(&mut c, &venta_de(vec![item("Café", 5_000, 2), item("Pan", 1_500, 1)], &t), AHORA).unwrap();

        let completa = detalle(&c, &r.id).unwrap().unwrap();
        assert_eq!(completa.consecutivo, r.consecutivo);
        assert_eq!(completa.total, r.total);
        assert_eq!(completa.items.len(), 2);
        assert_eq!(completa.items[0].nombre, "Café");
        assert_eq!(completa.items[0].cantidad, 2);
        assert_eq!(completa.cajero, "Ana");
    }

    #[test]
    fn releer_una_venta_que_no_existe_no_revienta() {
        let (c, _) = caja();
        assert!(detalle(&c, "no-existe").unwrap().is_none());
    }

    #[test]
    fn la_ultima_del_turno_es_la_que_se_acaba_de_cobrar() {
        // Es la que el cajero quiere reimprimir cuando la impresora falló.
        let (mut c, t) = caja();
        registrar(&mut c, &venta_de(vec![item("A", 1_000, 1)], &t), AHORA).unwrap();
        let segunda = registrar(&mut c, &venta_de(vec![item("B", 2_000, 1)], &t), AHORA).unwrap();

        assert_eq!(ultima_del_turno(&c, &t).unwrap().as_deref(), Some(segunda.id.as_str()));
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

    fn efectivo(monto: i64) -> PagoDetalle {
        PagoDetalle { metodo: "efectivo".into(), monto: Pesos(monto), referencia: String::new() }
    }

    fn tarjeta(monto: i64) -> PagoDetalle {
        PagoDetalle { metodo: "tarjeta".into(), monto: Pesos(monto), referencia: "A1B2".into() }
    }

    /* El reparto, sin tocar la base. Es la regla que decide si una venta se
       puede cerrar y cuánto cambio sale de la gaveta, así que se prueba sola. */
    mod reparto {
        use super::*;

        #[test]
        fn treinta_en_efectivo_y_el_resto_con_tarjeta() {
            // El caso que motivó todo esto.
            let vuelto = repartir(Pesos(50_000), &[efectivo(30_000), tarjeta(20_000)]).unwrap();
            assert_eq!(vuelto, Pesos::CERO);
        }

        #[test]
        fn el_cambio_sale_solo_de_la_parte_en_efectivo() {
            /* Tarjeta 20.000 y el cliente pone 50.000 en billetes sobre una
               venta de 60.000: faltan 40.000 en efectivo, así que el cambio es
               10.000. Es la cuenta que el cajero hace de cabeza y en la que se
               equivoca con gente esperando. */
            let vuelto = repartir(Pesos(60_000), &[tarjeta(20_000), efectivo(50_000)]).unwrap();
            assert_eq!(vuelto, Pesos(10_000));
        }

        #[test]
        fn no_se_cierra_una_venta_a_la_que_le_falta_plata() {
            let r = repartir(Pesos(50_000), &[efectivo(10_000), tarjeta(20_000)]);
            assert!(matches!(r, Err(ErrorVenta::PagoInsuficiente { .. })));
        }

        #[test]
        fn un_datafono_no_devuelve_cambio() {
            /* Digitar 60.000 en el datáfono para una venta de 50.000 no es un
               pago con vuelto: es un error de digitación, y al cliente le
               cobraron diez mil de más. Tiene que saltar aquí, no al cuadrar
               el mes. */
            let r = repartir(Pesos(50_000), &[tarjeta(60_000)]);
            assert!(matches!(r, Err(ErrorVenta::PagoExcedido { .. })));
        }

        #[test]
        fn dos_tarjetas_que_suman_exacto_pasan() {
            // Tarjeta del cliente y tarjeta del acompañante, a medias.
            let vuelto = repartir(Pesos(50_000), &[tarjeta(25_000), tarjeta(25_000)]).unwrap();
            assert_eq!(vuelto, Pesos::CERO);
        }

        #[test]
        fn un_monto_negativo_no_pasa() {
            let r = repartir(Pesos(50_000), &[efectivo(60_000), efectivo(-10_000)]);
            assert!(matches!(r, Err(ErrorVenta::PagoInvalido)));
        }

        #[test]
        fn un_pago_de_cero_no_paga_nada() {
            /* Aquí cero es cero. Que el cajero no haya digitado cuánto recibió
               es otra cosa y se resuelve antes, al armar las formas de pago:
               esta función solo ve montos ya resueltos y no tiene por qué
               adivinar intenciones. */
            let r = repartir(Pesos(50_000), &[efectivo(0)]);
            assert!(matches!(r, Err(ErrorVenta::PagoInsuficiente { .. })));
        }
    }

    #[test]
    fn el_efectivo_sin_digitar_cuenta_completo_en_la_gaveta() {
        /* La venta de toda la vida: efectivo, el cliente paga justo y el cajero
           no digita nada. Ese billete entra a la gaveta igual, así que la venta
           tiene que quedar registrada como cincuenta mil en efectivo.

           Si contara cero, al cerrar el turno la caja esperaría cincuenta mil
           de menos y el cajero respondería por un faltante que no existe. */
        let (mut c, turno) = caja();
        let mut v = venta_de(vec![item("Almuerzo", 50_000, 1)], &turno);
        v.medio_pago = "efectivo".into();
        v.recibido = Pesos::CERO;

        let r = registrar(&mut c, &v, AHORA).unwrap();
        assert_eq!(r.vuelto, Pesos::CERO);

        let en_gaveta: i64 = c
            .query_row(
                "SELECT SUM(monto) FROM venta_pagos WHERE venta_id = ?1 AND metodo = 'efectivo'",
                [&r.id],
                |f| f.get(0),
            )
            .unwrap();
        assert_eq!(en_gaveta, 50_000);
    }

    #[test]
    fn una_venta_mixta_guarda_sus_dos_pagos() {
        let (mut c, turno) = caja();
        let mut v = venta_de(vec![item("Almuerzo", 50_000, 1)], &turno);
        v.pagos = vec![efectivo(30_000), tarjeta(20_000)];

        let r = registrar(&mut c, &v, AHORA).unwrap();

        let cuantos: i64 = c
            .query_row("SELECT COUNT(*) FROM venta_pagos WHERE venta_id = ?1", [&r.id], |f| f.get(0))
            .unwrap();
        assert_eq!(cuantos, 2);

        let suma: i64 = c
            .query_row("SELECT SUM(monto) FROM venta_pagos WHERE venta_id = ?1", [&r.id], |f| f.get(0))
            .unwrap();
        assert_eq!(suma, 50_000);
    }

    #[test]
    fn el_listado_de_ventas_dice_mixto() {
        /* `medio_pago` es lo que se lee de un vistazo en un listado. Con dos
           medios no puede decir "efectivo", porque quien lea el listado creería
           que esa plata está en la gaveta. */
        let (mut c, turno) = caja();
        let mut v = venta_de(vec![item("Almuerzo", 50_000, 1)], &turno);
        v.pagos = vec![efectivo(30_000), tarjeta(20_000)];

        let r = registrar(&mut c, &v, AHORA).unwrap();

        let medio: String = c
            .query_row("SELECT medio_pago FROM ventas WHERE id = ?1", [&r.id], |f| f.get(0))
            .unwrap();
        assert_eq!(medio, "mixto");
    }

    #[test]
    fn la_venta_de_un_solo_medio_no_dice_mixto() {
        // La de siempre tiene que seguir leyéndose igual.
        let (mut c, turno) = caja();
        let r = registrar(&mut c, &venta_de(vec![item("Café", 3_000, 1)], &turno), AHORA).unwrap();

        let medio: String = c
            .query_row("SELECT medio_pago FROM ventas WHERE id = ?1", [&r.id], |f| f.get(0))
            .unwrap();
        assert_eq!(medio, "efectivo");
    }

    #[test]
    fn los_pagos_viajan_a_la_nube() {
        /* Si el detalle se quedara en la caja, el panel vería una venta "mixta"
           sin saber cuánto fue en efectivo: el cuadre de tarjetas del negocio
           dependería de ir terminal por terminal. */
        let (mut c, turno) = caja();
        let mut v = venta_de(vec![item("Almuerzo", 50_000, 1)], &turno);
        v.pagos = vec![efectivo(30_000), tarjeta(20_000)];

        registrar(&mut c, &v, AHORA).unwrap();

        let payload: String = c
            .query_row("SELECT payload FROM outbox WHERE entidad = 'venta'", [], |f| f.get(0))
            .unwrap();
        let leido: serde_json::Value = serde_json::from_str(&payload).unwrap();

        assert_eq!(leido["medio_pago"], "mixto");
        assert_eq!(leido["pagos"].as_array().unwrap().len(), 2);
        assert_eq!(leido["pagos"][0]["monto"], 30_000);
    }

    #[test]
    fn una_venta_mixta_a_la_que_le_falta_plata_no_entra() {
        /* Y lo que importa: no deja rastro. Si la venta se guardara y solo
           fallara el pago, quedaría una venta cobrada que nadie pagó. */
        let (mut c, turno) = caja();
        let mut v = venta_de(vec![item("Almuerzo", 50_000, 1)], &turno);
        v.pagos = vec![efectivo(10_000), tarjeta(20_000)];

        assert!(registrar(&mut c, &v, AHORA).is_err());

        let ventas: i64 = c.query_row("SELECT COUNT(*) FROM ventas", [], |f| f.get(0)).unwrap();
        assert_eq!(ventas, 0);
    }

    #[test]
    fn la_nota_del_cliente_llega_hasta_la_reimpresion() {
        /* "Sin cebolla" tiene que sobrevivir a que se limpie el carrito: si el
           plato vuelve, la tirilla es la prueba de qué se pidió. */
        let (mut c, turno) = caja();
        let mut linea = item("Hamburguesa", 25_000, 1);
        linea.nota = "Sin cebolla, término tres cuartos".into();

        let r = registrar(&mut c, &venta_de(vec![linea], &turno), AHORA).unwrap();
        let releida = detalle(&c, &r.id).unwrap().unwrap();

        assert_eq!(releida.items[0].nota, "Sin cebolla, término tres cuartos");
    }


    #[test]
    fn el_descuento_se_rebaja_del_total() {
        let (mut c, turno) = caja();
        let mut v = venta_de(vec![item("Almuerzo", 50_000, 1)], &turno);
        v.descuento = Pesos(5_000);
        v.descuento_motivo = "Cliente frecuente".into();

        let r = registrar(&mut c, &v, AHORA).unwrap();

        assert_eq!(r.total, Pesos(45_000));
    }

    #[test]
    fn la_venta_guarda_cuanto_valia_antes() {
        /* Sin el bruto, la tirilla no puede decir "antes 50.000, descuento
           5.000, paga 45.000", y un descuento que no se ve escrito es
           indistinguible de un precio cambiado a mano. */
        let (mut c, turno) = caja();
        let mut v = venta_de(vec![item("Almuerzo", 50_000, 1)], &turno);
        v.descuento = Pesos(5_000);
        v.descuento_motivo = "Cliente frecuente".into();

        let r = registrar(&mut c, &v, AHORA).unwrap();
        let releida = detalle(&c, &r.id).unwrap().unwrap();

        assert_eq!(releida.bruto, Pesos(50_000));
        assert_eq!(releida.descuento, Pesos(5_000));
        assert_eq!(releida.total, Pesos(45_000));
        assert_eq!(releida.descuento_motivo, "Cliente frecuente");
    }

    #[test]
    fn no_se_puede_descontar_mas_de_lo_que_vale() {
        /* Dejaría un total negativo, y un total negativo en una caja significa
           que la gaveta tiene que poner plata. */
        let (mut c, turno) = caja();
        let mut v = venta_de(vec![item("Café", 3_000, 1)], &turno);
        v.descuento = Pesos(10_000);

        assert!(matches!(
            registrar(&mut c, &v, AHORA),
            Err(ErrorVenta::DescuentoExcesivo { .. })
        ));
    }

    #[test]
    fn una_cortesia_completa_si_se_puede() {
        // Descontar el 100% es un plato de cortesía, y es legítimo.
        let (mut c, turno) = caja();
        let mut v = venta_de(vec![item("Postre", 8_000, 1)], &turno);
        v.descuento = Pesos(8_000);
        v.descuento_motivo = "Cortesía por la demora".into();
        v.recibido = Pesos::CERO;

        let r = registrar(&mut c, &v, AHORA).unwrap();
        assert_eq!(r.total, Pesos::CERO);
    }

    #[test]
    fn un_descuento_negativo_no_es_un_recargo() {
        /* Si pasara, sería la forma de cobrar de más sin que quedara registrado
           como un precio distinto. */
        let (mut c, turno) = caja();
        let mut v = venta_de(vec![item("Café", 3_000, 1)], &turno);
        v.descuento = Pesos(-5_000);

        assert!(registrar(&mut c, &v, AHORA).is_err());
    }

    #[test]
    fn se_paga_sobre_el_total_con_descuento() {
        /* La cuenta que importa: con 45.000 en la mano alcanza para una venta
           de 50.000 que tiene 5.000 de descuento. Si el pago se validara contra
           el bruto, el cajero no podría cerrar la venta. */
        let (mut c, turno) = caja();
        let mut v = venta_de(vec![item("Almuerzo", 50_000, 1)], &turno);
        v.descuento = Pesos(5_000);
        v.pagos = vec![efectivo(45_000)];

        let r = registrar(&mut c, &v, AHORA).unwrap();
        assert_eq!(r.vuelto, Pesos::CERO);
    }

    #[test]
    fn el_descuento_viaja_a_la_nube() {
        let (mut c, turno) = caja();
        let mut v = venta_de(vec![item("Almuerzo", 50_000, 1)], &turno);
        v.descuento = Pesos(5_000);
        v.descuento_motivo = "Cliente frecuente".into();

        registrar(&mut c, &v, AHORA).unwrap();

        let payload: String = c
            .query_row("SELECT payload FROM outbox WHERE entidad = 'venta'", [], |f| f.get(0))
            .unwrap();
        let leido: serde_json::Value = serde_json::from_str(&payload).unwrap();

        assert_eq!(leido["bruto"], 50_000);
        assert_eq!(leido["descuento"], 5_000);
        assert_eq!(leido["total"], 45_000);
    }

}
