//! El datáfono conectado por red.
//!
//! Los terminales inteligentes (SmartPOS con Android, o los integrados por IP
//! del adquirente) exponen un socket al que se le manda el monto y que contesta
//! con el resultado de la transacción. El flujo es el mismo del manual, pero el
//! voucher lo trae el aparato en vez del cajero.
//!
//! **Esto es una costura, no una integración terminada.** El protocolo cambia
//! por adquirente y por modelo: unos hablan JSON por TCP, otros un binario con
//! longitud al frente, otros HTTP en localhost. Lo que está resuelto aquí es lo
//! que no cambia —el contrato con la caja, el tiempo de espera, qué hacer
//! cuando no contesta— y lo que sí cambia está aislado en dos funciones:
//! `armar_peticion` y `leer_respuesta`. Integrar un modelo concreto es
//! reescribir esas dos y nada más.
//!
//! Por qué importa el tiempo de espera: el cajero está de pie mirando el
//! datáfono con un cliente al frente. Si el aparato no contesta, lo que
//! necesita **no** es un spinner eterno, es recuperar el control para
//! reintentar o cobrar en efectivo.

use pos_core::pagos::{ErrorTerminal, RespuestaPago, SolicitudPago, Terminal, Voucher};
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

/// Un minuto: lo que tarda una tarjeta con chip, su PIN y la respuesta del
/// banco en una red lenta, con margen. Más que esto ya no es una transacción
/// lenta, es una transacción que no va a llegar.
const ESPERA: Duration = Duration::from_secs(60);
const ESPERA_CONEXION: Duration = Duration::from_secs(5);

pub struct DatafonoRed {
    pub host: String,
    pub puerto: u16,
}

impl DatafonoRed {
    fn conectar(&self) -> Result<TcpStream, ErrorTerminal> {
        let dir = format!("{}:{}", self.host, self.puerto)
            .to_socket_addrs()
            .map_err(|e| ErrorTerminal::Comunicacion(format!("dirección inválida: {e}")))?
            .next()
            .ok_or_else(|| ErrorTerminal::Comunicacion("la dirección no resolvió".into()))?;

        let flujo = TcpStream::connect_timeout(&dir, ESPERA_CONEXION)
            .map_err(|e| ErrorTerminal::Comunicacion(format!("{} no responde: {e}", self.host)))?;

        flujo.set_read_timeout(Some(ESPERA)).ok();
        flujo.set_write_timeout(Some(ESPERA_CONEXION)).ok();
        Ok(flujo)
    }
}

impl Terminal for DatafonoRed {
    fn nombre(&self) -> &str {
        "Datáfono integrado"
    }

    /// El aparato trae el voucher: no hay nada que copiar a mano.
    fn requiere_digitacion(&self) -> bool {
        false
    }

    fn cobrar(&self, solicitud: &SolicitudPago, _voucher: Option<Voucher>) -> Result<RespuestaPago, ErrorTerminal> {
        let mut flujo = self.conectar()?;

        flujo
            .write_all(armar_peticion(solicitud).as_bytes())
            .map_err(|e| ErrorTerminal::Comunicacion(format!("no se pudo enviar el cobro: {e}")))?;
        flujo.flush().ok();

        let mut lector = BufReader::new(flujo);
        let mut linea = String::new();

        match lector.read_line(&mut linea) {
            Ok(0) => Err(ErrorTerminal::SinRespuesta("el datáfono cerró la conexión".into())),
            Ok(_) => leer_respuesta(&linea),
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock || e.kind() == std::io::ErrorKind::TimedOut => {
                /* Se agotó el minuto. No se asume nada: puede que el cobro haya
                   pasado y solo se perdiera la respuesta, así que el cajero
                   tiene que mirar la pantalla del datáfono antes de reintentar.
                   Cobrar dos veces a un cliente es peor que cobrar tarde. */
                Err(ErrorTerminal::SinRespuesta(
                    "no contestó en un minuto. Mira la pantalla del datáfono antes de reintentar".into(),
                ))
            }
            Err(e) => Err(ErrorTerminal::Comunicacion(e.to_string())),
        }
    }

    fn cancelar(&self, operacion_id: &str) -> Result<(), ErrorTerminal> {
        let mut flujo = self.conectar()?;
        let peticion = serde_json::json!({ "op": "cancelar", "operacion_id": operacion_id }).to_string();
        flujo
            .write_all(format!("{peticion}\n").as_bytes())
            .map_err(|e| ErrorTerminal::Comunicacion(e.to_string()))?;
        Ok(())
    }
}

/* ─── Lo que cambia por modelo de datáfono: solo estas dos funciones ─── */

/// El JSON por línea es el formato más común entre los SmartPOS con Android.
/// Un terminal serial con longitud al frente reemplaza esta función y nada más.
fn armar_peticion(s: &SolicitudPago) -> String {
    let cuerpo = serde_json::json!({
        "op": "venta",
        "operacion_id": s.operacion_id,
        // En pesos enteros, que es como cotiza Colombia. Un terminal que espere
        // centavos multiplica aquí, y solo aquí.
        "monto": s.monto.0,
        "iva": s.iva.0,
        "referencia": s.referencia,
    });
    format!("{cuerpo}\n")
}

/// Traduce lo que conteste el aparato al contrato de la caja.
///
/// Un rechazo del banco **no** es un error nuestro: es una respuesta válida que
/// el cajero tiene que ver para ofrecer otra tarjeta o cobrar en efectivo.
fn leer_respuesta(linea: &str) -> Result<RespuestaPago, ErrorTerminal> {
    let json: serde_json::Value = serde_json::from_str(linea.trim())
        .map_err(|e| ErrorTerminal::Comunicacion(format!("respuesta ilegible: {e}")))?;

    let aprobada = json["aprobada"].as_bool().unwrap_or(false);
    if !aprobada {
        let motivo = json["mensaje"].as_str().unwrap_or("sin motivo").to_string();
        return Err(ErrorTerminal::Rechazada(motivo));
    }

    let texto = |clave: &str| json[clave].as_str().map(|s| s.to_string()).filter(|s| !s.is_empty());

    Ok(RespuestaPago {
        aprobada: true,
        codigo_autorizacion: texto("codigo_autorizacion").unwrap_or_default(),
        ultimos_cuatro: texto("ultimos_cuatro"),
        franquicia: texto("franquicia"),
        recibo_comercio: texto("recibo_comercio"),
    })
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use pos_core::dinero::Pesos;

    fn solicitud() -> SolicitudPago {
        SolicitudPago {
            operacion_id: "0192f8a1-7c4e-7000-8000-abcdef123456".into(),
            monto: Pesos(85_000),
            iva: Pesos(13_571),
            referencia: "143".into(),
        }
    }

    /* La red no se prueba —no hay datáfono en CI— pero sí las dos funciones
       donde se esconde lo que cambia por modelo, que es donde va a estar el
       error el día que se integre uno de verdad. */

    #[test]
    fn la_peticion_manda_pesos_enteros_y_termina_en_salto() {
        let p = armar_peticion(&solicitud());
        assert!(p.ends_with('\n'), "el terminal lee por líneas");

        let json: serde_json::Value = serde_json::from_str(p.trim()).unwrap();
        assert_eq!(json["monto"], 85_000);
        assert_eq!(json["op"], "venta");
        assert_eq!(json["referencia"], "143");
    }

    #[test]
    fn una_aprobacion_trae_el_voucher_del_aparato() {
        let r = leer_respuesta(
            r#"{"aprobada":true,"codigo_autorizacion":"048123","ultimos_cuatro":"4582","franquicia":"Visa"}"#,
        )
        .unwrap();

        assert_eq!(r.codigo_autorizacion, "048123");
        assert_eq!(r.ultimos_cuatro.as_deref(), Some("4582"));
    }

    #[test]
    fn un_rechazo_del_banco_no_es_un_error_nuestro() {
        // El cajero tiene que verlo para ofrecer otra tarjeta o cobrar en efectivo.
        let r = leer_respuesta(r#"{"aprobada":false,"mensaje":"Fondos insuficientes"}"#);
        assert!(matches!(r, Err(ErrorTerminal::Rechazada(m)) if m.contains("Fondos")));
    }

    #[test]
    fn una_respuesta_ilegible_se_reporta_como_comunicacion() {
        assert!(matches!(
            leer_respuesta("<html>error 500</html>"),
            Err(ErrorTerminal::Comunicacion(_))
        ));
    }

    #[test]
    fn los_campos_vacios_no_se_guardan_como_vacios() {
        // Un "" en la conciliación es peor que un campo ausente.
        let r = leer_respuesta(r#"{"aprobada":true,"codigo_autorizacion":"1","ultimos_cuatro":""}"#).unwrap();
        assert_eq!(r.ultimos_cuatro, None);
    }
}
