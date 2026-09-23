//! La cola hacia la nube.
//!
//! El POS ya cobró y ya imprimió; esto es lo que pasa después, en segundo plano
//! y sin que el cajero se entere. Por eso las reglas de aquí no son sobre
//! velocidad sino sobre **no perder una venta jamás**:
//!
//! - Una venta sale de la cola **solo** cuando el servidor confirma que la
//!   tiene. Un timeout no es una confirmación.
//! - Los reintentos son espaciados (backoff exponencial). Sin eso, una caída
//!   del backend se convierte en cien cajas martillándolo cada segundo justo
//!   cuando está intentando levantarse.
//! - Lo que el servidor **rechaza** (un 4xx: payload malformado, negocio que ya
//!   no existe) no se reintenta para siempre: se aparta marcado, porque si no
//!   tapona la cola y las ventas buenas que vienen detrás nunca suben.
//!
//! Este módulo no sabe de HTTP a propósito: recibe un `Transporte`. Así la cola
//! se prueba entera —incluido el caso "el servidor responde OK pero la conexión
//! se cae antes de que llegue la respuesta"— sin levantar un servidor.

use rusqlite::{params, Connection, Result};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FalloEnvio {
    /// No hubo respuesta: sin internet, DNS caído, timeout. Se reintenta.
    Red(String),
    /// El servidor contestó pero está mal (5xx). Se reintenta: es culpa suya.
    Servidor(u16, String),
    /// El servidor entendió y dijo que no (4xx). Reintentar no va a cambiarlo.
    Rechazado(u16, String),
}

impl FalloEnvio {
    fn se_reintenta(&self) -> bool {
        !matches!(self, FalloEnvio::Rechazado(..))
    }

    fn texto(&self) -> String {
        match self {
            FalloEnvio::Red(e) => format!("red: {e}"),
            FalloEnvio::Servidor(c, e) => format!("servidor {c}: {e}"),
            FalloEnvio::Rechazado(c, e) => format!("rechazado {c}: {e}"),
        }
    }
}

/// Cómo se manda una fila de la cola. La implementación real (HTTP) vive en la
/// capa nativa; en las pruebas se reemplaza por una de mentira.
pub trait Transporte {
    fn enviar(&self, entidad: &str, operacion: &str, payload: &str) -> Result<(), FalloEnvio>;
}

#[derive(Debug, Default, PartialEq, Eq)]
pub struct Resultado {
    pub enviadas: usize,
    pub fallidas: usize,
    pub apartadas: usize,
}

/// Después de cuántos intentos fallidos se deja de reintentar un rechazo.
/// Uno solo basta —un 4xx no cambia por insistir— pero se deja margen para el
/// caso de un backend recién desplegado que devuelve 400 por un minuto.
const INTENTOS_ANTES_DE_APARTAR: i64 = 3;

/// Espera antes del siguiente intento, en segundos.
///
/// 5s, 10s, 20s, 40s… con techo de 15 minutos. El techo importa: sin él, una
/// caja que estuvo sin internet toda la noche despertaría con un backoff de
/// horas y sus ventas no subirían hasta el otro día.
pub fn espera_segundos(intentos: i64) -> i64 {
    const BASE: i64 = 5;
    const TECHO: i64 = 900;
    if intentos <= 0 {
        return 0;
    }
    BASE.saturating_mul(1i64.checked_shl(intentos.min(20) as u32).unwrap_or(i64::MAX))
        .min(TECHO)
}

/// Vacía lo que se pueda de la cola. Devuelve qué pasó, para la barra de estado.
///
/// `ahora_epoch` se recibe en vez de leerse del reloj para poder probar el
/// backoff sin dormir el hilo de la prueba.
pub fn procesar_cola<T: Transporte>(
    conexion: &Connection,
    transporte: &T,
    limite: i64,
    ahora_epoch: i64,
    ahora_texto: &str,
) -> Result<Resultado> {
    let listas = listas_para_enviar(conexion, limite, ahora_epoch)?;
    let mut r = Resultado::default();

    for (id, entidad, operacion, payload, intentos) in listas {
        match transporte.enviar(&entidad, &operacion, &payload) {
            Ok(()) => {
                crate::venta::marcar_enviado(conexion, id, ahora_texto)?;
                r.enviadas += 1;
            }
            Err(fallo) => {
                let siguiente = intentos + 1;
                let apartar = !fallo.se_reintenta() && siguiente >= INTENTOS_ANTES_DE_APARTAR;

                if apartar {
                    /* Apartada, no borrada: la venta sigue en la base local y
                       visible para soporte. Perderla en silencio sería peor que
                       no subirla. */
                    conexion.execute(
                        "UPDATE outbox SET intentos = ?2, ultimo_error = ?3, apartada = 1 WHERE id = ?1",
                        params![id, siguiente, fallo.texto()],
                    )?;
                    r.apartadas += 1;
                } else {
                    conexion.execute(
                        "UPDATE outbox SET intentos = ?2, ultimo_error = ?3, proximo_intento = ?4 WHERE id = ?1",
                        params![id, siguiente, fallo.texto(), ahora_epoch + espera_segundos(siguiente)],
                    )?;
                    r.fallidas += 1;
                }

                /* Se corta al primer fallo de red: si no hay internet, insistir
                   con las otras cincuenta solo gasta batería y llena el log.
                   Un rechazo puntual sí deja seguir con las demás. */
                if matches!(fallo, FalloEnvio::Red(_)) {
                    break;
                }
            }
        }
    }

    Ok(r)
}

/// Lo pendiente cuya espera ya venció, en orden de llegada.
fn listas_para_enviar(
    conexion: &Connection,
    limite: i64,
    ahora_epoch: i64,
) -> Result<Vec<(i64, String, String, String, i64)>> {
    let mut consulta = conexion.prepare(
        "SELECT id, entidad, operacion, payload, intentos FROM outbox
         WHERE enviado_en IS NULL AND apartada = 0 AND proximo_intento <= ?1
         ORDER BY id LIMIT ?2",
    )?;
    let filas = consulta.query_map(params![ahora_epoch, limite], |f| {
        Ok((f.get(0)?, f.get(1)?, f.get(2)?, f.get(3)?, f.get(4)?))
    })?;
    filas.collect()
}

/// Cuántas faltan por subir y cuántas quedaron apartadas. Va en la barra de la
/// caja: el negocio tiene que poder ver que está operando sin conexión.
pub fn estado(conexion: &Connection) -> Result<(i64, i64)> {
    let pendientes: i64 = conexion.query_row(
        "SELECT COUNT(*) FROM outbox WHERE enviado_en IS NULL AND apartada = 0",
        [],
        |f| f.get(0),
    )?;
    let apartadas: i64 = conexion.query_row(
        "SELECT COUNT(*) FROM outbox WHERE apartada = 1",
        [],
        |f| f.get(0),
    )?;
    Ok((pendientes, apartadas))
}

/// Una fila apartada, para mostrarle al negocio qué quedó sin subir y por qué.
#[derive(Debug, Clone, serde::Serialize)]
pub struct Apartada {
    pub entidad: String,
    pub detalle: String,
    pub error: String,
    pub creado_en: String,
}

/// Lo apartado, con el motivo que dio el servidor.
pub fn apartadas(conexion: &Connection) -> Result<Vec<Apartada>> {
    let mut consulta = conexion.prepare(
        "SELECT entidad, payload, ultimo_error, creado_en FROM outbox
          WHERE apartada = 1 AND enviado_en IS NULL ORDER BY id LIMIT 200",
    )?;
    let filas = consulta.query_map([], |f| {
        let payload: String = f.get(1)?;
        let json: serde_json::Value = serde_json::from_str(&payload).unwrap_or_default();
        // Lo que un humano reconoce: "GO AMERICAN x1", "Venta #42".
        let detalle = json["detalle"].as_str().map(str::to_string)
            .or_else(|| json["consecutivo"].as_i64().map(|n| format!("Venta #{n}")))
            .unwrap_or_default();
        Ok(Apartada { entidad: f.get(0)?, detalle, error: f.get(2)?, creado_en: f.get(3)? })
    })?;
    filas.collect()
}

/// Vuelve a poner en la cola lo apartado.
///
/// Se aparta lo que el servidor rechazó tres veces, y eso casi siempre es un
/// error del servidor o de una versión vieja de él —un tipo que no conocía,
/// una validación de más—, no de la venta. Cuando el servidor se arregla, la
/// caja tiene que poder subirlo sin que nadie toque la base a mano.
pub fn reintentar_apartadas(conexion: &Connection) -> Result<usize> {
    conexion.execute(
        "UPDATE outbox SET apartada = 0, intentos = 0, proximo_intento = 0, ultimo_error = ''
          WHERE apartada = 1 AND enviado_en IS NULL",
        [],
    )
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use crate::{db, dinero::Pesos, turnos, venta};
    use std::cell::RefCell;

    const AHORA: &str = "2026-09-20T10:00:00-05:00";

    /// Un servidor de mentira al que se le dice qué contestar en cada llamada.
    struct Fingido {
        respuestas: RefCell<Vec<Result<(), FalloEnvio>>>,
        recibidos: RefCell<Vec<String>>,
    }

    impl Fingido {
        fn con(respuestas: Vec<Result<(), FalloEnvio>>) -> Self {
            Fingido { respuestas: RefCell::new(respuestas), recibidos: RefCell::new(vec![]) }
        }
        fn siempre_ok() -> Self {
            Fingido::con(vec![])
        }
    }

    impl Transporte for Fingido {
        fn enviar(&self, _entidad: &str, _op: &str, payload: &str) -> Result<(), FalloEnvio> {
            self.recibidos.borrow_mut().push(payload.to_string());
            let mut r = self.respuestas.borrow_mut();
            if r.is_empty() { Ok(()) } else { r.remove(0) }
        }
    }

    fn con_ventas(cuantas: usize) -> Connection {
        let mut c = db::abrir_en_memoria().unwrap();
        // Sin turno abierto no hay ventas que encolar.
        let turno = turnos::abrir(&c, "u1", "Ana", Pesos(0), AHORA).unwrap();
        for i in 0..cuantas {
            let v = venta::NuevaVenta {
                items: vec![venta::LineaVenta {
                    producto_id: format!("p{i}"),
                    nombre: format!("Producto {i}"),
                    variante: String::new(),
                    precio: Pesos(1_000),
                    cantidad: 1,
                    nota: String::new(),
                    extras: vec![],
                    tipo_impuesto: String::new(),
                }],
                medio_pago: "efectivo".into(),
                recibido: Pesos(1_000),
                cajero: String::new(),
                turno_id: turno.id.clone(),
                iva_porcentaje: 0,
                pago: None,
                descuento: Pesos::CERO,
                propina: Pesos::CERO,
                descuento_motivo: String::new(),
                pagos: vec![],
                ..Default::default()
            };
            venta::registrar(&mut c, &v, AHORA).unwrap();
        }
        c
    }

    #[test]
    fn sube_lo_pendiente_y_lo_saca_de_la_cola() {
        let c = con_ventas(3);
        let r = procesar_cola(&c, &Fingido::siempre_ok(), 10, 1_000, AHORA).unwrap();
        assert_eq!(r, Resultado { enviadas: 3, fallidas: 0, apartadas: 0 });
        assert_eq!(estado(&c).unwrap(), (0, 0));
    }

    #[test]
    fn sube_en_el_orden_en_que_se_vendio() {
        let c = con_ventas(3);
        let servidor = Fingido::siempre_ok();
        procesar_cola(&c, &servidor, 10, 1_000, AHORA).unwrap();

        let recibidos = servidor.recibidos.borrow();
        let primero: serde_json::Value = serde_json::from_str(&recibidos[0]).unwrap();
        let ultimo: serde_json::Value = serde_json::from_str(&recibidos[2]).unwrap();
        assert_eq!(primero["consecutivo"], 1);
        assert_eq!(ultimo["consecutivo"], 3);
    }

    #[test]
    fn sin_internet_nada_sale_de_la_cola() {
        // Es el caso que no puede fallar nunca: la venta se queda hasta que
        // alguien confirme que la recibió.
        let c = con_ventas(2);
        let caido = Fingido::con(vec![Err(FalloEnvio::Red("dns".into()))]);

        let r = procesar_cola(&c, &caido, 10, 1_000, AHORA).unwrap();
        assert_eq!(r.enviadas, 0);
        assert_eq!(estado(&c).unwrap().0, 2);
    }

    #[test]
    fn sin_internet_no_martilla_al_servidor_con_toda_la_cola() {
        let c = con_ventas(5);
        let caido = Fingido::con(vec![Err(FalloEnvio::Red("sin ruta".into()))]);
        procesar_cola(&c, &caido, 10, 1_000, AHORA).unwrap();
        // Un intento, no cinco: al primer fallo de red se corta la pasada.
        assert_eq!(caido.recibidos.borrow().len(), 1);
    }

    #[test]
    fn el_reintento_espera_cada_vez_mas_pero_no_hasta_manana() {
        assert_eq!(espera_segundos(1), 10);
        assert_eq!(espera_segundos(2), 20);
        assert_eq!(espera_segundos(3), 40);
        // Con techo: una caja que pasó la noche sin red sube apenas vuelva.
        assert_eq!(espera_segundos(30), 900);
    }

    #[test]
    fn no_se_reintenta_antes_de_tiempo() {
        let c = con_ventas(1);
        let caido = Fingido::con(vec![Err(FalloEnvio::Servidor(502, "bad gateway".into()))]);
        procesar_cola(&c, &caido, 10, 1_000, AHORA).unwrap();

        // Un segundo después todavía no toca.
        let r = procesar_cola(&c, &Fingido::siempre_ok(), 10, 1_001, AHORA).unwrap();
        assert_eq!(r.enviadas, 0);

        // Pasada la espera, sube.
        let r = procesar_cola(&c, &Fingido::siempre_ok(), 10, 1_020, AHORA).unwrap();
        assert_eq!(r.enviadas, 1);
    }

    #[test]
    fn un_rechazo_no_tapona_la_cola_para_siempre() {
        let c = con_ventas(1);
        let rechaza = Fingido::con(vec![
            Err(FalloEnvio::Rechazado(400, "payload inválido".into())),
            Err(FalloEnvio::Rechazado(400, "payload inválido".into())),
            Err(FalloEnvio::Rechazado(400, "payload inválido".into())),
        ]);

        for t in [1_000, 1_100, 1_200] {
            procesar_cola(&c, &rechaza, 10, t, AHORA).unwrap();
        }

        let (pendientes, apartadas) = estado(&c).unwrap();
        assert_eq!((pendientes, apartadas), (0, 1), "se aparta, no bloquea");

        // Pero la venta sigue guardada: no se pierde plata registrada.
        let ventas: i64 = c.query_row("SELECT COUNT(*) FROM ventas", [], |f| f.get(0)).unwrap();
        assert_eq!(ventas, 1);
    }

    #[test]
    fn un_rechazo_puntual_deja_pasar_a_las_demas() {
        let c = con_ventas(3);
        let mixto = Fingido::con(vec![Err(FalloEnvio::Rechazado(422, "rara".into())), Ok(()), Ok(())]);
        let r = procesar_cola(&c, &mixto, 10, 1_000, AHORA).unwrap();
        assert_eq!(r.enviadas, 2);
        assert_eq!(r.fallidas, 1);
    }

    #[test]
    fn una_venta_confirmada_no_se_vuelve_a_mandar() {
        // Si se remandara, en la nube aparecería dos veces cada cierre de caja.
        let c = con_ventas(1);
        procesar_cola(&c, &Fingido::siempre_ok(), 10, 1_000, AHORA).unwrap();

        let servidor = Fingido::siempre_ok();
        procesar_cola(&c, &servidor, 10, 2_000, AHORA).unwrap();
        assert_eq!(servidor.recibidos.borrow().len(), 0);
    }

    #[test]
    fn lo_apartado_se_puede_volver_a_subir() {
        let c = db::abrir_en_memoria().unwrap();
        c.execute(
            "INSERT INTO outbox (entidad, entidad_id, operacion, payload, creado_en, intentos, ultimo_error, apartada)
             VALUES ('excepcion', 'x1', 'crear', '{\"detalle\":\"GO AMERICAN x1\"}', 'hoy', 3, 'rechazado 400', 1)",
            [],
        )
        .unwrap();

        let lista = apartadas(&c).unwrap();
        assert_eq!(lista[0].detalle, "GO AMERICAN x1");
        assert_eq!(lista[0].error, "rechazado 400");

        assert_eq!(reintentar_apartadas(&c).unwrap(), 1);
        assert_eq!(estado(&c).unwrap(), (1, 0), "vuelve a estar pendiente y ya no apartada");
    }
}
