//! El turno y su arqueo.
//!
//! Un turno es el trozo de día del que alguien responde: desde que abre la
//! gaveta con un fondo hasta que la cuenta y entrega. Sin turno no se vende, y
//! toda venta lleva el suyo: si no, un descuadre no tiene dueño y "faltan
//! veinte mil" se vuelve una conversación imposible.
//!
//! **Arqueo ciego.** Al cerrar, la caja no le dice al cajero cuánto debería
//! haber. Él cuenta lo que hay y lo digita; el sistema compara después. Si la
//! pantalla soplara el número esperado, el arqueo dejaría de medir nada: quien
//! tomó plata escribe justo esa cifra y el faltante nunca aparece. Por eso
//! `esperado_de` es privada del cierre y no hay ningún comando que la exponga
//! antes de contar.
//!
//! La fórmula, que es la de cualquier caja del mundo:
//!
//! ```text
//! esperado  = fondo inicial + ventas en efectivo + entradas − salidas
//! diferencia = contado − esperado        (negativo = falta plata)
//! ```
//!
//! Solo el efectivo entra en la cuenta: lo de tarjeta y transferencia no pasa
//! por la gaveta y cuadrarlo contra el datáfono es otro trabajo.

use crate::dinero::Pesos;
use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Turno {
    pub id: String,
    pub usuario_id: String,
    pub cajero: String,
    pub abierto_en: String,
    pub fondo_inicial: Pesos,
    pub estado: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CierreTurno {
    pub turno_id: String,
    pub cajero: String,
    pub abierto_en: String,
    pub cerrado_en: String,
    pub fondo_inicial: Pesos,
    pub ventas_efectivo: Pesos,
    pub ventas_otros: Pesos,
    pub entradas: Pesos,
    pub salidas: Pesos,
    pub esperado: Pesos,
    pub contado: Pesos,
    /// Negativo = falta plata en la gaveta.
    pub diferencia: Pesos,
    pub ventas: i64,
    /// Propina cobrada en efectivo durante el turno.
    ///
    /// **Está dentro del esperado**, porque ese billete está físicamente en la
    /// gaveta y el conteo lo va a encontrar. Se informa aparte para que quien
    /// liquida el turno sepa cuánto de lo que hay no es del negocio: sacarla
    /// sin este número deja un faltante que nadie sabe explicar.
    pub propina_efectivo: Pesos,
    /// Propina cobrada con tarjeta o transferencia. No pasa por la gaveta.
    pub propina_otros: Pesos,
    /// Lo devuelto en efectivo durante el turno. Sale de la gaveta.
    pub devoluciones_efectivo: Pesos,
    /// Cuántas veces se abrió la gaveta sin una venta detrás.
    ///
    /// No es un delito: dar cambio a otro cajero o revisar el fondo son cosas
    /// que pasan. Lo que dice algo es la **frecuencia**. Un turno normal abre
    /// la gaveta sin vender una o dos veces; ocho es un patrón, y el patrón
    /// solo se ve si alguien lo cuenta.
    pub aperturas_sin_venta: i64,
}

#[derive(Debug)]
pub enum ErrorTurno {
    YaHayUnoAbierto(String),
    /// Quedan ventas apartadas. Cerrar con ellas sueltas las pierde sin que
    /// nadie decida si se cobran o se descartan.
    QuedanPausadas(i64),
    NoHayTurnoAbierto,
    MotivoRequerido,
    MontoInvalido,
    Base(rusqlite::Error),
}

impl std::fmt::Display for ErrorTurno {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ErrorTurno::YaHayUnoAbierto(quien) => write!(f, "Ya hay un turno abierto de {quien}"),
            ErrorTurno::QuedanPausadas(n) => {
                write!(f, "Quedan {n} venta(s) en espera. Cóbralas o descártalas antes de cerrar")
            }
            ErrorTurno::NoHayTurnoAbierto => write!(f, "No hay un turno abierto en esta caja"),
            ErrorTurno::MotivoRequerido => write!(f, "Dile por qué sale o entra la plata"),
            ErrorTurno::MontoInvalido => write!(f, "El monto no es válido"),
            ErrorTurno::Base(e) => write!(f, "No se pudo guardar: {e}"),
        }
    }
}

impl From<rusqlite::Error> for ErrorTurno {
    fn from(e: rusqlite::Error) -> Self {
        ErrorTurno::Base(e)
    }
}

/// El turno abierto, si lo hay. Una caja tiene uno o ninguno.
pub fn activo(conexion: &Connection) -> Result<Option<Turno>> {
    conexion
        .query_row(
            "SELECT id, usuario_id, cajero, abierto_en, fondo_inicial, estado
             FROM turnos WHERE estado = 'ABIERTO' ORDER BY abierto_en DESC LIMIT 1",
            [],
            |f| {
                Ok(Turno {
                    id: f.get(0)?,
                    usuario_id: f.get(1)?,
                    cajero: f.get(2)?,
                    abierto_en: f.get(3)?,
                    fondo_inicial: Pesos(f.get(4)?),
                    estado: f.get(5)?,
                })
            },
        )
        .optional()
}

/// Abre la gaveta del día.
pub fn abrir(
    conexion: &Connection,
    usuario_id: &str,
    cajero: &str,
    fondo_inicial: Pesos,
    ahora: &str,
) -> Result<Turno, ErrorTurno> {
    /* Dos turnos abiertos a la vez harían que las ventas se repartieran entre
       los dos sin criterio y ningún arqueo cuadraría. */
    if let Some(abierto) = activo(conexion)? {
        return Err(ErrorTurno::YaHayUnoAbierto(abierto.cajero));
    }
    if fondo_inicial < Pesos::CERO {
        return Err(ErrorTurno::MontoInvalido);
    }

    let turno = Turno {
        id: Uuid::now_v7().to_string(),
        usuario_id: usuario_id.to_string(),
        cajero: cajero.to_string(),
        abierto_en: ahora.to_string(),
        fondo_inicial,
        estado: "ABIERTO".into(),
    };

    conexion.execute(
        "INSERT INTO turnos (id, usuario_id, cajero, abierto_en, fondo_inicial, estado)
         VALUES (?1, ?2, ?3, ?4, ?5, 'ABIERTO')",
        params![turno.id, turno.usuario_id, turno.cajero, turno.abierto_en, fondo_inicial.0],
    )?;

    /* Las mesas que dejó abiertas el turno anterior pasan a este. Si no, el
       cajero que entra abriría su tablero vacío mientras seis mesas comen en
       el salón, y al cobrarlas el dinero se le imputaría a un turno cerrado.

       Que falle no puede impedir abrir el turno: sin turno no se vende, y eso
       es peor que un tablero incompleto que se arregla reiniciando. */
    let _ = crate::cuentas::traspasar(conexion, &turno.id);

    Ok(turno)
}

/// Plata que entra o sale de la gaveta sin ser una venta.
///
/// El motivo es obligatorio en las dos direcciones. Un movimiento sin motivo es
/// exactamente el hueco por donde se va la plata: "salieron 50.000" sin nada
/// más es indistinguible de un faltante.
pub fn mover_efectivo(
    conexion: &Connection,
    turno_id: &str,
    entrada: bool,
    monto: Pesos,
    motivo: &str,
    usuario: &str,
    ahora: &str,
) -> Result<(), ErrorTurno> {
    if monto <= Pesos::CERO {
        return Err(ErrorTurno::MontoInvalido);
    }
    if motivo.trim().len() < 3 {
        return Err(ErrorTurno::MotivoRequerido);
    }

    conexion.execute(
        "INSERT INTO movimientos_caja (id, turno_id, tipo, monto, motivo, usuario, creado_en)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            Uuid::now_v7().to_string(),
            turno_id,
            if entrada { "entrada" } else { "salida" },
            monto.0,
            motivo.trim(),
            usuario,
            ahora
        ],
    )?;

    Ok(())
}

/// Lo que el sistema cree que hay en la gaveta.
///
/// **Privada a propósito.** Si la interfaz pudiera preguntarla antes del
/// conteo, el arqueo dejaría de ser ciego y dejaría de medir nada.
fn esperado_de(conexion: &Connection, turno: &Turno) -> Result<CierreTurno> {
    let (ventas_efectivo, ventas_otros, cuantas): (i64, i64, i64) = conexion.query_row(
        /* El efectivo sale de `venta_pagos` y no de `medio_pago`: con el pago
           mixto, una venta de cincuenta mil puede tener treinta en la gaveta y
           veinte en el datáfono, y mirar solo el resumen la contaría entera de
           un solo lado. El vuelto se resta porque ese billete volvió a salir.

           `v.vuelto` se suma en la consulta de afuera —una fila por venta— y
           los pagos en subconsultas, porque unir las dos tablas multiplicaría
           el vuelto por la cantidad de pagos de cada venta. */
        "SELECT
            COALESCE((SELECT SUM(p.monto) FROM venta_pagos p
                      JOIN ventas vv ON vv.id = p.venta_id
                      WHERE vv.turno_id = ?1 AND p.metodo = 'efectivo'), 0)
              - COALESCE(SUM(v.vuelto), 0),
            COALESCE((SELECT SUM(p.monto) FROM venta_pagos p
                      JOIN ventas vv ON vv.id = p.venta_id
                      WHERE vv.turno_id = ?1 AND p.metodo != 'efectivo'), 0),
            COUNT(*)
         FROM ventas v WHERE v.turno_id = ?1",
        [&turno.id],
        |f| Ok((f.get(0)?, f.get(1)?, f.get(2)?)),
    )?;

    let (entradas, salidas): (i64, i64) = conexion.query_row(
        "SELECT
            COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN monto ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN tipo = 'salida'  THEN monto ELSE 0 END), 0)
         FROM movimientos_caja WHERE turno_id = ?1",
        [&turno.id],
        |f| Ok((f.get(0)?, f.get(1)?)),
    )?;

    /* La propina se reparte por medio de pago igual que la venta: la que
       entró en billetes está en la gaveta y la que entró por datáfono no.

       No se suma al esperado porque ya está contada: `ventas_efectivo` sale de
       `venta_pagos`, y el cliente que dejó propina pagó el gran total —venta
       más propina— con esos medios. Sumarla otra vez la contaría dos veces y
       la caja cerraría siempre con un faltante del tamaño de las propinas. */
    let (propina_efectivo, propina_otros): (i64, i64) = conexion
        .query_row(
            "SELECT
                COALESCE(SUM(CASE WHEN v.medio_pago = 'efectivo' THEN v.propina ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN v.medio_pago != 'efectivo' THEN v.propina ELSE 0 END), 0)
             FROM ventas v WHERE v.turno_id = ?1",
            [&turno.id],
            |f| Ok((f.get(0)?, f.get(1)?)),
        )
        .unwrap_or((0, 0));

    /* Lo devuelto en efectivo salió de la gaveta y hay que restarlo.

       Solo lo devuelto en efectivo: por datáfono la reversa la hace el banco y
       la gaveta no se entera. Restar esas también dejaría la caja con un
       sobrante cada día que alguien devuelve una compra con tarjeta. */
    let devuelto = crate::devoluciones::efectivo_del_turno(conexion, &turno.id)
        .unwrap_or(Pesos::CERO);

    let aperturas: i64 = conexion
        .query_row(
            "SELECT COUNT(*) FROM auditoria_operaciones
             WHERE turno_id = ?1 AND tipo = 'abrir_cajon'",
            [&turno.id],
            |f| f.get(0),
        )
        .unwrap_or(0);

    let esperado = turno.fondo_inicial.0 + ventas_efectivo + entradas - salidas - devuelto.0;

    Ok(CierreTurno {
        turno_id: turno.id.clone(),
        cajero: turno.cajero.clone(),
        abierto_en: turno.abierto_en.clone(),
        cerrado_en: String::new(),
        fondo_inicial: turno.fondo_inicial,
        ventas_efectivo: Pesos(ventas_efectivo),
        propina_efectivo: Pesos(propina_efectivo),
        propina_otros: Pesos(propina_otros),
        devoluciones_efectivo: devuelto,
        aperturas_sin_venta: aperturas,
        ventas_otros: Pesos(ventas_otros),
        entradas: Pesos(entradas),
        salidas: Pesos(salidas),
        esperado: Pesos(esperado),
        contado: Pesos::CERO,
        diferencia: Pesos::CERO,
        ventas: cuantas,
    })
}

/// Cierra el turno con lo que el cajero contó y deja el arqueo encolado.
///
/// El orden es el del arqueo ciego: el conteo **entra** como parámetro, el
/// esperado se calcula **después**, y solo entonces aparece la diferencia.
pub fn cerrar(
    conexion: &mut Connection,
    contado: Pesos,
    ahora: &str,
) -> Result<CierreTurno, ErrorTurno> {
    let turno = activo(conexion)?.ok_or(ErrorTurno::NoHayTurnoAbierto)?;
    if contado < Pesos::CERO {
        return Err(ErrorTurno::MontoInvalido);
    }

    /* Una venta apartada al cerrar es un carrito que nadie va a reclamar y una
       decisión que nadie tomó. Se obliga a resolverla antes. */
    let pendientes = crate::pausadas::cuantas(conexion, &turno.id)?;
    if pendientes > 0 {
        return Err(ErrorTurno::QuedanPausadas(pendientes));
    }

    let mut cierre = esperado_de(conexion, &turno)?;
    cierre.contado = contado;
    cierre.diferencia = Pesos(contado.0 - cierre.esperado.0);
    cierre.cerrado_en = ahora.to_string();

    let tx = conexion.transaction()?;

    tx.execute(
        "UPDATE turnos SET estado = 'CERRADO', cerrado_en = ?2, contado = ?3, esperado = ?4, diferencia = ?5
         WHERE id = ?1",
        params![turno.id, ahora, contado.0, cierre.esperado.0, cierre.diferencia.0],
    )?;

    /* El arqueo sube por la misma cola que las ventas: el dueño tiene que poder
       ver desde el panel que faltaron veinte mil el martes, aunque esa caja
       siga sin internet hasta el jueves. */
    let payload = serde_json::to_string(&cierre).unwrap_or_default();
    tx.execute(
        "INSERT INTO outbox (entidad, entidad_id, operacion, payload, creado_en)
         VALUES ('turno', ?1, 'cerrar', ?2, ?3)",
        params![turno.id, payload, ahora],
    )?;

    tx.commit()?;

    Ok(cierre)
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use crate::{db, venta};

    const AHORA: &str = "2026-09-20T18:00:00-05:00";

    fn caja_con_turno() -> (Connection, Turno) {
        let c = db::abrir_en_memoria().unwrap();
        let t = abrir(&c, "u1", "Ana", Pesos(100_000), "2026-09-20T08:00:00-05:00").unwrap();
        (c, t)
    }

    fn vender(c: &mut Connection, turno: &Turno, monto: i64, medio: &str) {
        let v = venta::NuevaVenta {
            items: vec![venta::LineaVenta {
                producto_id: "p1".into(),
                nombre: "Café".into(),
                variante: String::new(),
                precio: Pesos(monto),
                cantidad: 1,
                nota: String::new(),
                extras: vec![],
                tipo_impuesto: String::new(),
            }],
            medio_pago: medio.into(),
            recibido: if medio == "efectivo" { Pesos(monto) } else { Pesos::CERO },
            cajero: turno.cajero.clone(),
            turno_id: turno.id.clone(),
            iva_porcentaje: 0,
            pago: None,
            descuento: Pesos::CERO,
            propina: Pesos::CERO,
            descuento_motivo: String::new(),
            pagos: vec![],
        };
        venta::registrar(c, &v, AHORA).unwrap();
    }

    #[test]
    fn no_se_pueden_abrir_dos_turnos_a_la_vez() {
        // Con dos abiertos, las ventas se reparten sin criterio y ningún arqueo cuadra.
        let (c, _) = caja_con_turno();
        assert!(matches!(
            abrir(&c, "u2", "Beto", Pesos(50_000), AHORA),
            Err(ErrorTurno::YaHayUnoAbierto(_))
        ));
    }

    #[test]
    fn el_esperado_es_fondo_mas_efectivo_mas_entradas_menos_salidas() {
        let (mut c, t) = caja_con_turno();
        vender(&mut c, &t, 30_000, "efectivo");
        vender(&mut c, &t, 20_000, "tarjeta");        // no pasa por la gaveta
        mover_efectivo(&c, &t.id, true, Pesos(50_000), "sencillo del banco", "Ana", AHORA).unwrap();
        mover_efectivo(&c, &t.id, false, Pesos(10_000), "hielo", "Ana", AHORA).unwrap();

        // 100.000 + 30.000 + 50.000 − 10.000 = 170.000
        let cierre = cerrar(&mut c, Pesos(170_000), AHORA).unwrap();
        assert_eq!(cierre.esperado, Pesos(170_000));
        assert_eq!(cierre.ventas_efectivo, Pesos(30_000));
        assert_eq!(cierre.ventas_otros, Pesos(20_000));
        assert_eq!(cierre.diferencia, Pesos::CERO);
    }

    #[test]
    fn un_faltante_sale_negativo_y_un_sobrante_positivo() {
        let (mut c, t) = caja_con_turno();
        vender(&mut c, &t, 30_000, "efectivo");
        let cierre = cerrar(&mut c, Pesos(110_000), AHORA).unwrap();
        assert_eq!(cierre.diferencia, Pesos(-20_000), "faltan veinte mil");

        let (mut c2, t2) = caja_con_turno();
        vender(&mut c2, &t2, 30_000, "efectivo");
        assert_eq!(cerrar(&mut c2, Pesos(135_000), AHORA).unwrap().diferencia, Pesos(5_000));
    }

    #[test]
    fn la_venta_con_tarjeta_no_entra_a_la_gaveta() {
        let (mut c, t) = caja_con_turno();
        vender(&mut c, &t, 500_000, "tarjeta");
        // El esperado sigue siendo solo el fondo: esa plata está en el datáfono.
        assert_eq!(cerrar(&mut c, Pesos(100_000), AHORA).unwrap().diferencia, Pesos::CERO);
    }

    #[test]
    fn el_cierre_queda_encolado_para_el_dueno() {
        let (mut c, t) = caja_con_turno();
        vender(&mut c, &t, 30_000, "efectivo");
        cerrar(&mut c, Pesos(125_000), AHORA).unwrap();

        let cola: Vec<(String, String)> = {
            let mut q = c.prepare("SELECT entidad, payload FROM outbox WHERE entidad = 'turno'").unwrap();
            q.query_map([], |f| Ok((f.get(0)?, f.get(1)?))).unwrap().map(|r| r.unwrap()).collect()
        };
        assert_eq!(cola.len(), 1);

        let json: serde_json::Value = serde_json::from_str(&cola[0].1).unwrap();
        assert_eq!(json["diferencia"], -5_000);
        assert_eq!(json["cajero"], "Ana");
    }

    #[test]
    fn no_se_cierra_con_ventas_en_espera() {
        // Cerrar con carritos sueltos los pierde sin que nadie decida nada.
        let (mut c, t) = caja_con_turno();
        crate::pausadas::pausar(&c, &t.id, "[]", "x", 10_000, 1, AHORA).unwrap();

        assert!(matches!(cerrar(&mut c, Pesos(100_000), AHORA), Err(ErrorTurno::QuedanPausadas(1))));

        // Resuelta la espera, el cierre pasa.
        let apartada = crate::pausadas::listar(&c, &t.id).unwrap().remove(0);
        crate::pausadas::descartar(&c, &apartada.id).unwrap();
        assert!(cerrar(&mut c, Pesos(100_000), AHORA).is_ok());
    }

    #[test]
    fn cerrado_el_turno_no_queda_ninguno_activo() {
        let (mut c, _) = caja_con_turno();
        cerrar(&mut c, Pesos(100_000), AHORA).unwrap();
        assert!(activo(&c).unwrap().is_none());
        assert!(matches!(cerrar(&mut c, Pesos(0), AHORA), Err(ErrorTurno::NoHayTurnoAbierto)));
    }

    #[test]
    fn la_plata_no_sale_sin_motivo() {
        // Un "salieron 50.000" sin motivo es indistinguible de un faltante.
        let (c, t) = caja_con_turno();
        assert!(matches!(
            mover_efectivo(&c, &t.id, false, Pesos(50_000), "  ", "Ana", AHORA),
            Err(ErrorTurno::MotivoRequerido)
        ));
        assert!(matches!(
            mover_efectivo(&c, &t.id, false, Pesos(0), "hielo", "Ana", AHORA),
            Err(ErrorTurno::MontoInvalido)
        ));
    }

    #[test]
    fn las_ventas_de_otro_turno_no_contaminan_el_arqueo() {
        let (mut c, t1) = caja_con_turno();
        vender(&mut c, &t1, 30_000, "efectivo");
        cerrar(&mut c, Pesos(130_000), AHORA).unwrap();

        let t2 = abrir(&c, "u2", "Beto", Pesos(100_000), AHORA).unwrap();
        vender(&mut c, &t2, 10_000, "efectivo");

        let cierre = cerrar(&mut c, Pesos(110_000), AHORA).unwrap();
        assert_eq!(cierre.ventas_efectivo, Pesos(10_000), "solo lo suyo");
        assert_eq!(cierre.diferencia, Pesos::CERO);
    }

    #[test]
    fn la_parte_en_efectivo_de_una_venta_mixta_entra_a_la_gaveta() {
        /* Cincuenta mil: treinta en billetes y veinte con tarjeta. En la gaveta
           quedan treinta.

           Esta prueba existe por una regresión concreta: al agregar el pago
           mixto, el esperado se calculaba mirando `medio_pago`, que en estas
           ventas dice "mixto" y no "efectivo". Esos treinta mil desaparecían de
           la cuenta, la caja cerraba con un sobrante de treinta mil y el
           cajero quedaba señalado por algo que nunca hizo. */
        let (mut c, t) = caja_con_turno();

        let v = venta::NuevaVenta {
            items: vec![venta::LineaVenta {
                producto_id: "p1".into(),
                nombre: "Almuerzo".into(),
                variante: String::new(),
                precio: Pesos(50_000),
                cantidad: 1,
                nota: String::new(),
                extras: vec![],
                tipo_impuesto: String::new(),
            }],
            medio_pago: String::new(),
            recibido: Pesos::CERO,
            cajero: "Ana".into(),
            turno_id: t.id.clone(),
            iva_porcentaje: 0,
            pago: None,
            descuento: Pesos::CERO,
            propina: Pesos::CERO,
            descuento_motivo: String::new(),
            pagos: vec![
                venta::PagoDetalle { metodo: "efectivo".into(), monto: Pesos(30_000), referencia: String::new() },
                venta::PagoDetalle { metodo: "tarjeta".into(), monto: Pesos(20_000), referencia: "A1".into() },
            ],
        };
        venta::registrar(&mut c, &v, AHORA).unwrap();

        let cierre = cerrar(&mut c, Pesos(130_000), AHORA).unwrap();

        assert_eq!(cierre.ventas_efectivo, Pesos(30_000));
        assert_eq!(cierre.ventas_otros, Pesos(20_000));
        // Fondo 100.000 + 30.000 en billetes = 130.000, y la gaveta tiene eso.
        assert_eq!(cierre.diferencia, Pesos::CERO);
    }

    #[test]
    fn el_vuelto_no_se_queda_en_la_gaveta() {
        /* Venta de 30.000, el cliente entrega 50.000 y se le devuelven 20.000.
           En la gaveta quedan 30.000, no 50.000: el pago entra completo y el
           vuelto vuelve a salir. */
        let (mut c, t) = caja_con_turno();

        let v = venta::NuevaVenta {
            items: vec![venta::LineaVenta {
                producto_id: "p1".into(),
                nombre: "Café".into(),
                variante: String::new(),
                precio: Pesos(30_000),
                cantidad: 1,
                nota: String::new(),
                extras: vec![],
                tipo_impuesto: String::new(),
            }],
            medio_pago: "efectivo".into(),
            // Entrega 50.000 por una venta de 30.000: se le devuelven 20.000.
            recibido: Pesos(50_000),
            cajero: "Ana".into(),
            turno_id: t.id.clone(),
            iva_porcentaje: 0,
            pago: None,
            descuento: Pesos::CERO,
            propina: Pesos::CERO,
            descuento_motivo: String::new(),
            pagos: vec![],
        };
        let r = venta::registrar(&mut c, &v, AHORA).unwrap();
        assert_eq!(r.vuelto, Pesos(20_000));

        let cierre = cerrar(&mut c, Pesos(130_000), AHORA).unwrap();

        assert_eq!(cierre.ventas_efectivo, Pesos(30_000));
        assert_eq!(cierre.diferencia, Pesos::CERO);
    }


    #[test]
    fn la_propina_en_efectivo_esta_en_la_gaveta_pero_se_informa_aparte() {
        /* Venta de 30.000 con 3.000 de propina, pagada con un billete de
           50.000: el cliente entrega 33.000 y se lleva 17.000 de cambio. En la
           gaveta quedan 33.000, de los cuales 3.000 no son del negocio.

           Lo que esta prueba fija es que la propina **no se sume dos veces**.
           Ya está dentro de `ventas_efectivo`, porque el pago cubrió el gran
           total; sumarla otra vez al esperado haría que la caja cerrara con un
           faltante del tamaño de las propinas, todos los días. */
        let (mut c, t) = caja_con_turno();

        let v = venta::NuevaVenta {
            items: vec![venta::LineaVenta {
                producto_id: "p1".into(),
                nombre: "Almuerzo".into(),
                variante: String::new(),
                precio: Pesos(30_000),
                cantidad: 1,
                nota: String::new(),
                extras: vec![],
                tipo_impuesto: String::new(),
            }],
            medio_pago: "efectivo".into(),
            recibido: Pesos(50_000),
            cajero: "Ana".into(),
            turno_id: t.id.clone(),
            iva_porcentaje: 0,
            pago: None,
            descuento: Pesos::CERO,
            descuento_motivo: String::new(),
            propina: Pesos(3_000),
            pagos: vec![],
        };
        let r = venta::registrar(&mut c, &v, AHORA).unwrap();

        assert_eq!(r.a_pagar, Pesos(33_000), "el cliente paga venta + propina");
        assert_eq!(r.vuelto, Pesos(17_000));

        // Fondo 100.000 + 33.000 que quedaron en la gaveta.
        let cierre = cerrar(&mut c, Pesos(133_000), AHORA).unwrap();

        assert_eq!(cierre.diferencia, Pesos::CERO, "la caja cuadra");
        assert_eq!(cierre.propina_efectivo, Pesos(3_000), "y se sabe cuánto sacar");
    }


    #[test]
    fn lo_devuelto_en_efectivo_sale_del_esperado() {
        /* Venta de 30.000 en efectivo, y después se devuelven 10.000. En la
           gaveta quedan 20.000 sobre el fondo.

           Sin restarlo, la caja cerraría con un faltante de 10.000 y el cajero
           respondería por una plata que devolvió con autorización. */
        let (mut c, t) = caja_con_turno();
        vender(&mut c, &t, 30_000, "efectivo");

        let venta_id: String = c
            .query_row("SELECT id FROM ventas LIMIT 1", [], |f| f.get(0))
            .unwrap();

        crate::devoluciones::registrar(
            &mut c,
            &venta_id,
            &[venta::LineaVenta {
                producto_id: "p1".into(),
                nombre: "Café".into(),
                variante: String::new(),
                precio: Pesos(30_000),
                cantidad: 1,
                nota: String::new(),
                extras: vec![],
                tipo_impuesto: String::new(),
            }],
            "efectivo",
            "Salió frío",
            "Ana",
            "Luis",
            AHORA,
        )
        .unwrap();

        // Fondo 100.000 + 30.000 vendidos − 30.000 devueltos.
        let cierre = cerrar(&mut c, Pesos(100_000), AHORA).unwrap();

        assert_eq!(cierre.devoluciones_efectivo, Pesos(30_000));
        assert_eq!(cierre.diferencia, Pesos::CERO, "la caja cuadra");
    }

}
