//! El crédito de los clientes: fiar y recibir abonos.
//!
//! El cliente de siempre que paga el viernes, la empresa que manda a sus
//! empleados a almorzar y paga a fin de mes. Hasta ahora eso se anotaba en un
//! cuaderno, por fuera de la caja: las ventas "fiadas" se registraban como
//! efectivo que no entraba, y el arqueo no cuadraba nunca.
//!
//! La cuenta de verdad vive en la nube. La caja lleva una copia de lo que debe
//! cada cliente y de su cupo, para dos cosas: **no fiar por encima del cupo**
//! aunque no haya internet, y mostrarle al cajero cuánto debe quien está al
//! frente. Cada venta a crédito y cada abono sube por la cola, y la caja
//! corrige su copia en el acto.

use crate::clientes;
use crate::dinero::Pesos;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, PartialEq)]
pub enum ErrorCredito {
    SinCliente,
    SinCredito,
    SuperaCupo { disponible: i64 },
    MontoInvalido,
    SinDeuda,
    Base(String),
}

impl From<rusqlite::Error> for ErrorCredito {
    fn from(e: rusqlite::Error) -> Self {
        ErrorCredito::Base(e.to_string())
    }
}

impl std::fmt::Display for ErrorCredito {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ErrorCredito::SinCliente => write!(f, "Para fiar hay que asociar al cliente"),
            ErrorCredito::SinCredito => write!(f, "Ese cliente no tiene crédito habilitado"),
            ErrorCredito::SuperaCupo { disponible } => {
                write!(f, "Supera el cupo: le quedan {} disponibles", Pesos(*disponible))
            }
            ErrorCredito::MontoInvalido => write!(f, "El monto no es válido"),
            ErrorCredito::SinDeuda => write!(f, "Ese cliente no debe nada"),
            ErrorCredito::Base(e) => write!(f, "{e}"),
        }
    }
}

/// Lo que todavía se le puede fiar.
pub fn disponible(c: &clientes::FilaCliente) -> i64 {
    (c.cupo - c.saldo_credito).max(0)
}

/// ¿Se le puede fiar este monto? Con la copia local: sin internet también.
pub fn validar_venta(conexion: &Connection, cliente_id: &str, monto: i64) -> Result<(), ErrorCredito> {
    if cliente_id.is_empty() {
        return Err(ErrorCredito::SinCliente);
    }
    let c = clientes::por_id(conexion, cliente_id)?.ok_or(ErrorCredito::SinCliente)?;
    if !c.credito_habilitado {
        return Err(ErrorCredito::SinCredito);
    }
    let libre = disponible(&c);
    if monto > libre {
        return Err(ErrorCredito::SuperaCupo { disponible: libre });
    }
    Ok(())
}

/// Corrige la copia local de lo que debe. Positivo = fió; negativo = abonó.
pub fn reflejar(conexion: &Connection, cliente_id: &str, delta: i64) -> rusqlite::Result<()> {
    conexion.execute(
        "UPDATE clientes_cache SET saldo_credito = MAX(0, saldo_credito + ?2) WHERE id = ?1",
        params![cliente_id, delta],
    )?;
    Ok(())
}

/// Un abono registrado en la caja.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Abono {
    pub id: String,
    pub cliente_id: String,
    pub cliente_telefono: String,
    pub cliente_nombre: String,
    pub monto: i64,
    pub medio: String,
    pub cajero: String,
    pub creada_en: String,
    /// Lo que queda debiendo después del abono.
    pub saldo_despues: i64,
}

/// Recibe un abono.
///
/// En efectivo, la plata entra a la gaveta: se anota como entrada de caja con
/// su motivo, o el arqueo del turno saldría con un sobrante que nadie sabría
/// explicar. Por datáfono o transferencia no pasa por la gaveta.
///
/// No se deja abonar más de lo que debe: el sobrante sería un saldo a favor, y
/// ese es otro campo con otras reglas.
pub fn registrar_abono(
    conexion: &Connection,
    turno_id: &str,
    cliente_id: &str,
    monto: i64,
    medio: &str,
    cajero: &str,
    ahora: &str,
) -> Result<Abono, ErrorCredito> {
    if monto <= 0 {
        return Err(ErrorCredito::MontoInvalido);
    }
    let c = clientes::por_id(conexion, cliente_id)?.ok_or(ErrorCredito::SinCliente)?;
    if c.saldo_credito <= 0 {
        return Err(ErrorCredito::SinDeuda);
    }
    let monto = monto.min(c.saldo_credito);
    let medio = if ["efectivo", "tarjeta", "transferencia"].contains(&medio) { medio } else { "efectivo" };

    let abono = Abono {
        id: Uuid::now_v7().to_string(),
        cliente_id: c.id.clone(),
        cliente_telefono: c.telefono.clone(),
        cliente_nombre: c.nombre.clone(),
        monto,
        medio: medio.into(),
        cajero: cajero.into(),
        creada_en: ahora.into(),
        saldo_despues: c.saldo_credito - monto,
    };

    let tx = conexion.unchecked_transaction()?;
    if medio == "efectivo" {
        crate::turnos::mover_efectivo(
            &tx,
            turno_id,
            true,
            Pesos(monto),
            &format!("Abono de crédito · {}", c.nombre),
            cajero,
            ahora,
        )
        .map_err(|e| ErrorCredito::Base(e.to_string()))?;
    }
    reflejar(&tx, cliente_id, -monto)?;
    tx.execute(
        "INSERT INTO outbox (entidad, entidad_id, operacion, payload, creado_en)
         VALUES ('abono', ?1, 'crear', ?2, ?3)",
        params![abono.id, serde_json::to_string(&abono).unwrap_or_default(), ahora],
    )?;
    tx.commit()?;
    Ok(abono)
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use crate::{db, turnos};

    const AHORA: &str = "2026-09-23T12:00:00-05:00";

    fn con_cliente(habilitado: bool, cupo: i64, saldo: i64) -> Connection {
        let mut c = db::abrir_en_memoria().unwrap();
        clientes::aplicar(&mut c, &[clientes::FilaCliente {
            id: "c1".into(),
            documento: String::new(),
            tipo_documento: "CC".into(),
            telefono: "3001234567".into(),
            nombre: "Ana".into(),
            puntos: 0,
            saldo_favor: 0,
            estado: "active".into(),
            actualizado: "2026-09-20T10:00:00Z".into(),
            credito_habilitado: habilitado,
            cupo,
            saldo_credito: saldo,
        }])
        .unwrap();
        c
    }

    #[test]
    fn se_fia_hasta_el_cupo_y_ni_un_peso_mas() {
        let c = con_cliente(true, 100_000, 70_000);
        assert!(validar_venta(&c, "c1", 30_000).is_ok());
        assert_eq!(validar_venta(&c, "c1", 30_001), Err(ErrorCredito::SuperaCupo { disponible: 30_000 }));
    }

    #[test]
    fn sin_credito_habilitado_o_sin_cliente_no_se_fia() {
        let c = con_cliente(false, 100_000, 0);
        assert_eq!(validar_venta(&c, "c1", 1_000), Err(ErrorCredito::SinCredito));
        assert_eq!(validar_venta(&c, "", 1_000), Err(ErrorCredito::SinCliente));
    }

    #[test]
    fn el_abono_en_efectivo_entra_a_la_gaveta_y_baja_la_deuda() {
        let c = con_cliente(true, 100_000, 50_000);
        let t = turnos::abrir(&c, "u", "Ana", Pesos(0), AHORA).unwrap();
        let a = registrar_abono(&c, &t.id, "c1", 20_000, "efectivo", "Ana", AHORA).unwrap();
        assert_eq!(a.saldo_despues, 30_000);
        assert_eq!(clientes::por_id(&c, "c1").unwrap().unwrap().saldo_credito, 30_000);

        let entradas: i64 = c
            .query_row("SELECT COALESCE(SUM(monto), 0) FROM movimientos_caja WHERE tipo = 'entrada'", [], |f| f.get(0))
            .unwrap();
        assert_eq!(entradas, 20_000, "sin esto el arqueo saldría con sobrante");
        let en_cola: i64 = c.query_row("SELECT COUNT(*) FROM outbox WHERE entidad = 'abono'", [], |f| f.get(0)).unwrap();
        assert_eq!(en_cola, 1);
    }

    #[test]
    fn por_transferencia_no_toca_la_gaveta() {
        let c = con_cliente(true, 100_000, 50_000);
        let t = turnos::abrir(&c, "u", "Ana", Pesos(0), AHORA).unwrap();
        registrar_abono(&c, &t.id, "c1", 20_000, "transferencia", "Ana", AHORA).unwrap();
        let movimientos: i64 = c.query_row("SELECT COUNT(*) FROM movimientos_caja", [], |f| f.get(0)).unwrap();
        assert_eq!(movimientos, 0);
    }

    #[test]
    fn no_se_abona_mas_de_lo_que_debe() {
        let c = con_cliente(true, 100_000, 10_000);
        let t = turnos::abrir(&c, "u", "Ana", Pesos(0), AHORA).unwrap();
        let a = registrar_abono(&c, &t.id, "c1", 50_000, "efectivo", "Ana", AHORA).unwrap();
        assert_eq!((a.monto, a.saldo_despues), (10_000, 0));
        assert_eq!(
            registrar_abono(&c, &t.id, "c1", 1_000, "efectivo", "Ana", AHORA).unwrap_err(),
            ErrorCredito::SinDeuda
        );
    }
}
