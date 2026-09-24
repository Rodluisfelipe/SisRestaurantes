//! El corte X y el corte Z.
//!
//! El arqueo de turno responde "¿cuadró la gaveta de este cajero?". El corte
//! responde otra cosa: **qué vendió esta caja en el día**, con su desglose
//! fiscal, sus consecutivos y sus medios de pago. Es el papel que pide el
//! contador y el que se archiva.
//!
//! - **X**: el informe desde el último Z hasta ahora. No cierra nada; se puede
//!   sacar las veces que se quiera para ver cómo va el día.
//! - **Z**: el mismo informe, pero **cierra el periodo**: lleva un consecutivo
//!   propio, queda guardado, sube al panel y el siguiente empieza de cero. Se
//!   saca una vez, al final del día, con los turnos ya cerrados.
//!
//! Los dos muestran el efectivo por medio de pago, así que no los puede sacar
//! cualquiera: el cajero que todavía no cuenta su gaveta vería la cifra que el
//! arqueo ciego existe para esconderle. Por eso piden el permiso `cortes`.

use crate::dinero::Pesos;
use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PorMedio {
    pub metodo: String,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Informe {
    /// "X" o "Z".
    pub tipo: String,
    /// El consecutivo del Z. En un X, el que tendría el próximo Z.
    pub numero: i64,
    /// Desde cuándo (exclusivo) y hasta cuándo (inclusivo).
    pub desde: String,
    pub hasta: String,
    pub cajero: String,
    pub ventas: i64,
    /// El primer y el último consecutivo de venta del periodo.
    pub primera: i64,
    pub ultima: i64,
    pub bruto: i64,
    pub descuentos: i64,
    pub propinas: i64,
    pub total: i64,
    pub base_inc: i64,
    pub inc: i64,
    pub base_iva: i64,
    pub iva: i64,
    pub exento: i64,
    /// Lo que entró por cada medio. El efectivo ya sin el vuelto.
    pub por_medio: Vec<PorMedio>,
    pub devoluciones: i64,
    pub devoluciones_monto: i64,
    /// Lo quitado después de mandarlo a cocina.
    pub anulaciones: i64,
    pub anulaciones_monto: i64,
    /// Lo quitado antes de mandarlo a cocina.
    pub borradores: i64,
    pub aperturas_gaveta: i64,
}

#[derive(Debug)]
pub enum ErrorCorte {
    TurnoAbierto,
    SinVentas,
    Base(rusqlite::Error),
}

impl From<rusqlite::Error> for ErrorCorte {
    fn from(e: rusqlite::Error) -> Self {
        ErrorCorte::Base(e)
    }
}

impl std::fmt::Display for ErrorCorte {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ErrorCorte::TurnoAbierto => write!(f, "Cierra el turno antes de sacar el corte Z"),
            ErrorCorte::SinVentas => write!(f, "No hay ventas desde el último corte Z"),
            ErrorCorte::Base(e) => write!(f, "{e}"),
        }
    }
}

/// Dónde terminó el último Z, y qué número tendría el siguiente.
fn ultimo_z(conexion: &Connection) -> Result<(String, i64)> {
    let fila: Option<(String, i64)> = conexion
        .query_row("SELECT hasta, numero FROM cortes_z ORDER BY numero DESC LIMIT 1", [], |f| {
            Ok((f.get(0)?, f.get(1)?))
        })
        .optional()?;
    Ok(match fila {
        Some((hasta, n)) => (hasta, n + 1),
        None => (String::new(), 1),
    })
}

/// El informe de un periodo. `desde` exclusivo, `hasta` inclusivo.
fn informe(conexion: &Connection, tipo: &str, numero: i64, desde: &str, hasta: &str, cajero: &str) -> Result<Informe> {
    let rango = "creada_en > ?1 AND creada_en <= ?2";

    let (ventas, primera, ultima, bruto, descuentos, propinas, total, base_inc, inc, base_iva, iva, exento, vuelto):
        (i64, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64, i64) = conexion.query_row(
        &format!(
            "SELECT COUNT(*), COALESCE(MIN(consecutivo), 0), COALESCE(MAX(consecutivo), 0),
                    COALESCE(SUM(bruto), 0), COALESCE(SUM(descuento), 0), COALESCE(SUM(propina), 0),
                    COALESCE(SUM(total), 0),
                    COALESCE(SUM(total_base_inc), 0), COALESCE(SUM(total_inc), 0),
                    COALESCE(SUM(total_base_iva), 0), COALESCE(SUM(total_iva), 0),
                    COALESCE(SUM(total_exento), 0), COALESCE(SUM(vuelto), 0)
               FROM ventas WHERE {rango}"
        ),
        params![desde, hasta],
        |f| {
            Ok((
                f.get(0)?, f.get(1)?, f.get(2)?, f.get(3)?, f.get(4)?, f.get(5)?, f.get(6)?,
                f.get(7)?, f.get(8)?, f.get(9)?, f.get(10)?, f.get(11)?, f.get(12)?,
            ))
        },
    )?;

    let mut consulta = conexion.prepare(
        "SELECT p.metodo, SUM(p.monto) FROM venta_pagos p JOIN ventas v ON v.id = p.venta_id
          WHERE v.creada_en > ?1 AND v.creada_en <= ?2
          GROUP BY p.metodo ORDER BY SUM(p.monto) DESC",
    )?;
    let mut por_medio: Vec<PorMedio> = consulta
        .query_map(params![desde, hasta], |f| Ok(PorMedio { metodo: f.get(0)?, total: f.get(1)? }))?
        .collect::<Result<_>>()?;
    /* El billete del vuelto volvió a salir: lo que de verdad entró en
       efectivo es lo pagado menos el cambio. */
    if let Some(e) = por_medio.iter_mut().find(|m| m.metodo == "efectivo") {
        e.total -= vuelto;
    }

    let (devoluciones, devoluciones_monto): (i64, i64) = conexion.query_row(
        &format!("SELECT COUNT(*), COALESCE(SUM(total), 0) FROM devoluciones WHERE {rango}"),
        params![desde, hasta],
        |f| Ok((f.get(0)?, f.get(1)?)),
    )?;

    let (anulaciones, anulaciones_monto, borradores, aperturas_gaveta): (i64, i64, i64, i64) = conexion.query_row(
        &format!(
            "SELECT COALESCE(SUM(CASE WHEN tipo = 'anular_item' THEN 1 ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN tipo = 'anular_item' THEN monto ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN tipo = 'anular_borrador' THEN 1 ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN tipo = 'abrir_cajon' THEN 1 ELSE 0 END), 0)
               FROM auditoria_operaciones WHERE {rango}"
        ),
        params![desde, hasta],
        |f| Ok((f.get(0)?, f.get(1)?, f.get(2)?, f.get(3)?)),
    )?;

    Ok(Informe {
        tipo: tipo.into(),
        numero,
        desde: desde.into(),
        hasta: hasta.into(),
        cajero: cajero.into(),
        ventas,
        primera,
        ultima,
        bruto,
        descuentos,
        propinas,
        total,
        base_inc,
        inc,
        base_iva,
        iva,
        exento,
        por_medio,
        devoluciones,
        devoluciones_monto,
        anulaciones,
        anulaciones_monto,
        borradores,
        aperturas_gaveta,
    })
}

/// El corte X: cómo va el día, sin cerrar nada.
pub fn corte_x(conexion: &Connection, cajero: &str, ahora: &str) -> Result<Informe> {
    let (desde, siguiente) = ultimo_z(conexion)?;
    informe(conexion, "X", siguiente, &desde, ahora, cajero)
}

/// El corte Z: cierra el periodo, lo guarda y lo deja en la cola hacia la nube.
///
/// Con un turno abierto no se deja: el Z es el cierre del día, y un turno que
/// sigue vendiendo después dejaría ventas del "día cerrado" en el día
/// siguiente.
pub fn corte_z(conexion: &mut Connection, cajero: &str, ahora: &str) -> std::result::Result<Informe, ErrorCorte> {
    if crate::turnos::activo(conexion)?.is_some() {
        return Err(ErrorCorte::TurnoAbierto);
    }
    let (desde, numero) = ultimo_z(conexion)?;
    let inf = informe(conexion, "Z", numero, &desde, ahora, cajero)?;
    if inf.ventas == 0 {
        return Err(ErrorCorte::SinVentas);
    }

    let json = serde_json::to_string(&inf).unwrap_or_default();
    let tx = conexion.transaction()?;
    tx.execute(
        "INSERT INTO cortes_z (numero, desde, hasta, cajero, informe, creado_en) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![numero, desde, ahora, cajero, json, ahora],
    )?;
    // A la nube por la misma cola que las ventas: la caja puede estar sin señal.
    tx.execute(
        "INSERT INTO outbox (entidad, entidad_id, operacion, payload, creado_en)
         VALUES ('corte_z', ?1, 'crear', ?2, ?3)",
        params![numero.to_string(), json, ahora],
    )?;
    tx.commit()?;
    Ok(inf)
}

/// El papel del corte.
pub fn tirilla(inf: &Informe, negocio: &str, ancho: usize) -> Vec<u8> {
    let mut t = crate::escpos::Tirilla::nueva(ancho);
    let p = |n: i64| Pesos(n).to_string();

    t.alinear(crate::escpos::Alineacion::Centro)
        .negrita(true)
        .linea(negocio)
        .negrita(false)
        .doble(true)
        .linea(&if inf.tipo == "Z" { format!("CORTE Z #{}", inf.numero) } else { "CORTE X".to_string() })
        .doble(false);
    if inf.tipo == "X" {
        t.linea("Informativo: no cierra el día");
    }
    t.linea(&format!("Hasta {}", inf.hasta))
        .linea(&format!("Sacado por {}", inf.cajero))
        .alinear(crate::escpos::Alineacion::Izquierda)
        .separador();

    t.par("Ventas", &inf.ventas.to_string());
    if inf.ventas > 0 {
        t.par("Consecutivos", &format!("{} a {}", inf.primera, inf.ultima));
    }
    t.par("Venta bruta", &p(inf.bruto))
        .par("Descuentos", &p(inf.descuentos))
        .doble(true)
        .par("TOTAL", &p(inf.total))
        .doble(false)
        .par("Propinas", &p(inf.propinas))
        .separador();

    if inf.base_inc + inf.inc > 0 {
        t.par("Base INC 8%", &p(inf.base_inc)).par("INC", &p(inf.inc));
    }
    if inf.base_iva + inf.iva > 0 {
        t.par("Base IVA 19%", &p(inf.base_iva)).par("IVA", &p(inf.iva));
    }
    if inf.exento > 0 {
        t.par("Exento", &p(inf.exento));
    }
    t.separador();

    for m in &inf.por_medio {
        t.par(&m.metodo, &p(m.total));
    }
    t.separador()
        .par("Devoluciones", &format!("{} · {}", inf.devoluciones, p(inf.devoluciones_monto)))
        .par("Anuladas en cocina", &format!("{} · {}", inf.anulaciones, p(inf.anulaciones_monto)))
        .par("Quitadas antes", &inf.borradores.to_string())
        .par("Gaveta sin venta", &inf.aperturas_gaveta.to_string())
        .salto()
        .cortar();
    t.terminar()
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use crate::{db, turnos, venta};

    const T1: &str = "2026-09-23T12:00:00-05:00";
    const T2: &str = "2026-09-23T20:00:00-05:00";
    const T3: &str = "2026-09-24T12:00:00-05:00";

    fn vender(c: &mut Connection, turno: &str, monto: i64, medio: &str, recibido: i64, cuando: &str) {
        let v = venta::NuevaVenta {
            items: vec![venta::LineaVenta {
                producto_id: "p".into(),
                nombre: "Burger".into(),
                variante: String::new(),
                precio: Pesos(monto),
                cantidad: 1,
                nota: String::new(),
                extras: vec![],
                tipo_impuesto: "INC_8".into(),
            }],
            medio_pago: medio.into(),
            recibido: Pesos(recibido),
            turno_id: turno.into(),
            ..Default::default()
        };
        venta::registrar(c, &v, cuando).unwrap();
    }

    fn caja() -> (Connection, String) {
        let c = db::abrir_en_memoria().unwrap();
        let t = turnos::abrir(&c, "u", "Ana", Pesos(0), "2026-09-23T08:00:00-05:00").unwrap();
        (c, t.id)
    }

    #[test]
    fn el_x_suma_el_dia_con_su_desglose_y_el_efectivo_sin_vuelto() {
        let (mut c, t) = caja();
        vender(&mut c, &t, 30_000, "efectivo", 50_000, T1);
        vender(&mut c, &t, 20_000, "tarjeta", 0, T1);
        let x = corte_x(&c, "Felipe", T2).unwrap();
        assert_eq!(x.ventas, 2);
        assert_eq!(x.total, 50_000);
        assert_eq!(x.inc + x.base_inc, 50_000);
        let efectivo = x.por_medio.iter().find(|m| m.metodo == "efectivo").unwrap();
        assert_eq!(efectivo.total, 30_000, "los 50.000 recibidos menos 20.000 de cambio");
        assert_eq!(x.numero, 1);
    }

    #[test]
    fn el_x_no_cierra_nada() {
        let (mut c, t) = caja();
        vender(&mut c, &t, 10_000, "efectivo", 10_000, T1);
        corte_x(&c, "Felipe", T2).unwrap();
        assert_eq!(corte_x(&c, "Felipe", T2).unwrap().ventas, 1);
    }

    #[test]
    fn el_z_pide_los_turnos_cerrados() {
        let (mut c, t) = caja();
        vender(&mut c, &t, 10_000, "efectivo", 10_000, T1);
        assert!(matches!(corte_z(&mut c, "Felipe", T2), Err(ErrorCorte::TurnoAbierto)));
    }

    #[test]
    fn el_z_cierra_el_periodo_numera_y_sube() {
        let (mut c, t) = caja();
        vender(&mut c, &t, 10_000, "efectivo", 10_000, T1);
        turnos::cerrar(&mut c, Pesos(10_000), T2).unwrap();

        let z = corte_z(&mut c, "Felipe", T2).unwrap();
        assert_eq!((z.numero, z.ventas), (1, 1));

        // Lo siguiente empieza de cero y con el número que sigue.
        let t2 = turnos::abrir(&c, "u", "Ana", Pesos(0), T2).unwrap();
        vender(&mut c, &t2.id, 5_000, "efectivo", 5_000, T3);
        let x = corte_x(&c, "Felipe", T3).unwrap();
        assert_eq!((x.numero, x.ventas, x.total), (2, 1, 5_000));

        let en_cola: i64 = c
            .query_row("SELECT COUNT(*) FROM outbox WHERE entidad = 'corte_z'", [], |f| f.get(0))
            .unwrap();
        assert_eq!(en_cola, 1);
    }

    #[test]
    fn un_z_sin_ventas_no_se_saca() {
        let (mut c, _) = caja();
        turnos::cerrar(&mut c, Pesos(0), T2).unwrap();
        assert!(matches!(corte_z(&mut c, "Felipe", T2), Err(ErrorCorte::SinVentas)));
    }

    #[test]
    fn la_tirilla_dice_que_es_y_su_numero() {
        let (mut c, t) = caja();
        vender(&mut c, &t, 10_000, "efectivo", 10_000, T1);
        let x = corte_x(&c, "Felipe", T2).unwrap();
        let texto = String::from_utf8_lossy(&tirilla(&x, "Go Burger", 42)).to_string();
        assert!(texto.contains("CORTE X") && texto.contains("no cierra"));
    }
}
