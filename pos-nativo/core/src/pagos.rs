//! El cobro con tarjeta.
//!
//! Un mostrador colombiano tiene, casi siempre, un datáfono que no es del POS:
//! el de Redeban, el de Credibanco, el Bold que le dio el banco. El cajero pasa
//! la tarjeta ahí, arranca el voucher y lo pega a la factura. Ese es el flujo
//! real y es el que tiene que funcionar el primer día, sin integrar nada.
//!
//! Por eso el contrato está partido en dos: un `Terminal` que la caja llama
//! igual siempre, y detrás de él, o una persona digitando el voucher, o un
//! datáfono inteligente contestando por red. Cambiar de uno a otro no toca la
//! pantalla de cobro ni la venta.
//!
//! **El trait es síncrono a propósito.** La caja no hace nada más mientras se
//! cobra —el cajero está mirando el datáfono y el cliente esperando— y meter un
//! runtime async completo por una operación que ocurre una vez por venta
//! contradiría la razón de que este binario pese quince megas. Lo que no puede
//! pasar es que la ventana se congele, y de eso se encarga quien llama: la capa
//! nativa corre esto en un hilo aparte. Si algún día un proveedor necesita
//! concurrencia de verdad, el trait cambia y las dos implementaciones con él;
//! la caja no se entera.

use crate::dinero::Pesos;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolicitudPago {
    /// UUIDv7 de la operación. Es lo que permite reintentar sin cobrar dos veces.
    pub operacion_id: String,
    pub monto: Pesos,
    /// IVA incluido en el monto. Algunos terminales lo imprimen discriminado.
    pub iva: Pesos,
    /// El número que el cliente ve en su factura.
    pub referencia: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RespuestaPago {
    pub aprobada: bool,
    /// El número que imprime el voucher. Es con lo que el banco responde un
    /// reclamo tres semanas después.
    pub codigo_autorizacion: String,
    pub ultimos_cuatro: Option<String>,
    pub franquicia: Option<String>,
    /// Texto del voucher, cuando el terminal lo devuelve.
    pub recibo_comercio: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ErrorTerminal {
    /// El cajero escribió mal el voucher, o se saltó un campo.
    DatosInvalidos(String),
    /// El datáfono no contestó a tiempo. El cajero decide: reintentar o cobrar
    /// de otra forma.
    SinRespuesta(String),
    /// El banco dijo que no: fondos, tarjeta vencida, lo que sea.
    Rechazada(String),
    /// Algo entre nosotros y el terminal: cable, red, protocolo.
    Comunicacion(String),
}

impl std::fmt::Display for ErrorTerminal {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            // Mensajes para el cajero, con el cliente al frente.
            ErrorTerminal::DatosInvalidos(m) => write!(f, "{m}"),
            ErrorTerminal::SinRespuesta(m) => write!(f, "El datáfono no respondió: {m}"),
            ErrorTerminal::Rechazada(m) => write!(f, "La transacción fue rechazada: {m}"),
            ErrorTerminal::Comunicacion(m) => write!(f, "No se pudo hablar con el datáfono: {m}"),
        }
    }
}

/// Lo que la caja necesita de cualquier forma de cobrar con tarjeta.
pub trait Terminal: Send + Sync {
    /// Cómo se llama esto en la pantalla del cajero.
    fn nombre(&self) -> &str;

    /// ¿La caja tiene que pedirle el voucher al cajero, o el terminal lo trae?
    ///
    /// Es lo único que la interfaz necesita saber para decidir si abre el modal
    /// de digitación o una pantalla de "pasa la tarjeta".
    fn requiere_digitacion(&self) -> bool;

    fn cobrar(&self, solicitud: &SolicitudPago, voucher: Option<Voucher>) -> Result<RespuestaPago, ErrorTerminal>;

    /// Aborta si el cliente se arrepintió antes de pasar la tarjeta.
    ///
    /// En el modo manual no hay nada que abortar: no se le pidió nada a nadie.
    fn cancelar(&self, _operacion_id: &str) -> Result<(), ErrorTerminal> {
        Ok(())
    }
}

/// Lo que el cajero copia del voucher de papel.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Voucher {
    pub codigo_autorizacion: String,
    pub ultimos_cuatro: String,
    #[serde(default)]
    pub franquicia: String,
}

/* ────────────────────────  Datáfono independiente  ──────────────────────── */

/// El datáfono de siempre: el cajero pasa la tarjeta ahí y copia el voucher.
///
/// Funciona con el 100% de los terminales que ya están en los mostradores, sin
/// integrar nada y sin permiso de nadie. No "aprueba" la transacción —eso lo
/// hizo el banco hace diez segundos— sino que **la deja registrada**, que es lo
/// que permite cuadrar los vouchers contra las ventas al cerrar el turno.
pub struct DatafonoManual;

impl Terminal for DatafonoManual {
    fn nombre(&self) -> &str {
        "Datáfono (voucher a mano)"
    }

    fn requiere_digitacion(&self) -> bool {
        true
    }

    fn cobrar(&self, _solicitud: &SolicitudPago, voucher: Option<Voucher>) -> Result<RespuestaPago, ErrorTerminal> {
        let v = voucher.ok_or_else(|| {
            ErrorTerminal::DatosInvalidos("Falta el voucher del datáfono".into())
        })?;

        let codigo = validar_autorizacion(&v.codigo_autorizacion)?;
        let ultimos = validar_ultimos_cuatro(&v.ultimos_cuatro)?;

        Ok(RespuestaPago {
            aprobada: true,
            codigo_autorizacion: codigo,
            ultimos_cuatro: Some(ultimos),
            franquicia: normalizar_franquicia(&v.franquicia),
            recibo_comercio: None,
        })
    }
}

/// El código de aprobación del voucher.
///
/// Se exige que tenga algo distinto de ceros: un cajero apurado escribe "0000"
/// para salir del paso, y ese registro no sirve para nada el día que el banco
/// pida el código de una transacción en disputa.
pub fn validar_autorizacion(entrada: &str) -> Result<String, ErrorTerminal> {
    let limpio: String = entrada.trim().to_uppercase();

    if limpio.len() < 4 || limpio.len() > 20 {
        return Err(ErrorTerminal::DatosInvalidos(
            "El código de aprobación del voucher tiene entre 4 y 20 caracteres".into(),
        ));
    }
    if !limpio.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err(ErrorTerminal::DatosInvalidos(
            "El código de aprobación solo lleva letras y números".into(),
        ));
    }
    if limpio.chars().all(|c| c == '0') {
        return Err(ErrorTerminal::DatosInvalidos(
            "Copia el código de aprobación del voucher, no ceros".into(),
        ));
    }

    Ok(limpio)
}

/// Los últimos cuatro de la tarjeta: exactamente cuatro dígitos.
///
/// Son los que permiten emparejar un voucher de papel con una venta cuando al
/// final del turno sobra o falta uno.
pub fn validar_ultimos_cuatro(entrada: &str) -> Result<String, ErrorTerminal> {
    let limpio = entrada.trim();

    if limpio.len() != 4 || !limpio.chars().all(|c| c.is_ascii_digit()) {
        return Err(ErrorTerminal::DatosInvalidos(
            "Los últimos cuatro dígitos de la tarjeta son cuatro números".into(),
        ));
    }
    if limpio == "0000" {
        return Err(ErrorTerminal::DatosInvalidos(
            "Copia los últimos cuatro de la tarjeta, no ceros".into(),
        ));
    }

    Ok(limpio.to_string())
}

/// La franquicia, escrita como la escriben los bancos.
///
/// Es opcional: si el cajero no la pone, no se inventa. Un dato vacío es mejor
/// que uno equivocado en una conciliación.
pub fn normalizar_franquicia(entrada: &str) -> Option<String> {
    let limpio = entrada.trim().to_lowercase();
    if limpio.is_empty() {
        return None;
    }

    let conocida = match limpio.as_str() {
        s if s.contains("visa") => "Visa",
        s if s.contains("master") => "Mastercard",
        s if s.contains("amex") || s.contains("american") => "American Express",
        s if s.contains("diners") => "Diners Club",
        s if s.contains("credencial") || s.contains("debito") || s.contains("débito") => "Débito",
        _ => return Some(entrada.trim().chars().take(30).collect()),
    };

    Some(conocida.to_string())
}

#[cfg(test)]
mod pruebas {
    use super::*;

    fn solicitud() -> SolicitudPago {
        SolicitudPago {
            operacion_id: "0192f8a1-7c4e-7000-8000-abcdef123456".into(),
            monto: Pesos(85_000),
            iva: Pesos(13_571),
            referencia: "143".into(),
        }
    }

    fn voucher(codigo: &str, ultimos: &str) -> Option<Voucher> {
        Some(Voucher {
            codigo_autorizacion: codigo.into(),
            ultimos_cuatro: ultimos.into(),
            franquicia: "visa".into(),
        })
    }

    #[test]
    fn un_voucher_bien_copiado_queda_registrado() {
        let r = DatafonoManual.cobrar(&solicitud(), voucher("048123", "4582")).unwrap();
        assert!(r.aprobada);
        assert_eq!(r.codigo_autorizacion, "048123");
        assert_eq!(r.ultimos_cuatro.as_deref(), Some("4582"));
        assert_eq!(r.franquicia.as_deref(), Some("Visa"));
    }

    #[test]
    fn sin_voucher_no_se_registra_un_cobro_con_tarjeta() {
        // Si pasara, al cierre habría una venta con tarjeta sin nada que cuadrar.
        assert!(matches!(
            DatafonoManual.cobrar(&solicitud(), None),
            Err(ErrorTerminal::DatosInvalidos(_))
        ));
    }

    #[test]
    fn el_codigo_en_ceros_no_pasa() {
        /* Es lo que escribe un cajero apurado, y es justo el registro que no
           sirve para nada cuando el banco pide el código tres semanas después. */
        assert!(validar_autorizacion("0000").is_err());
        assert!(validar_autorizacion("000000").is_err());
        assert!(validar_autorizacion("048123").is_ok());
    }

    #[test]
    fn el_codigo_se_guarda_en_mayusculas_y_sin_espacios() {
        // Así dos vouchers iguales no se ven distintos en la conciliación.
        assert_eq!(validar_autorizacion(" a1b2c3 ").unwrap(), "A1B2C3");
    }

    #[test]
    fn el_codigo_raro_se_rechaza() {
        assert!(validar_autorizacion("12").is_err());
        assert!(validar_autorizacion("048-123").is_err());
        assert!(validar_autorizacion(&"9".repeat(21)).is_err());
    }

    #[test]
    fn los_ultimos_cuatro_son_cuatro_numeros() {
        assert_eq!(validar_ultimos_cuatro("4582").unwrap(), "4582");
        assert!(validar_ultimos_cuatro("458").is_err());
        assert!(validar_ultimos_cuatro("45821").is_err());
        assert!(validar_ultimos_cuatro("45a2").is_err());
        assert!(validar_ultimos_cuatro("0000").is_err());
    }

    #[test]
    fn la_franquicia_se_escribe_como_la_escriben_los_bancos() {
        assert_eq!(normalizar_franquicia("VISA").as_deref(), Some("Visa"));
        assert_eq!(normalizar_franquicia("mastercard").as_deref(), Some("Mastercard"));
        assert_eq!(normalizar_franquicia("Amex").as_deref(), Some("American Express"));
    }

    #[test]
    fn una_franquicia_desconocida_se_respeta_en_vez_de_inventar() {
        assert_eq!(normalizar_franquicia("Codensa").as_deref(), Some("Codensa"));
        assert_eq!(normalizar_franquicia("  "), None);
    }

    #[test]
    fn cancelar_un_cobro_manual_no_hace_nada_y_esta_bien() {
        // No se le pidió nada a ningún aparato: no hay qué abortar.
        assert!(DatafonoManual.cancelar("lo-que-sea").is_ok());
    }

    #[test]
    fn el_manual_le_dice_a_la_interfaz_que_pida_el_voucher() {
        assert!(DatafonoManual.requiere_digitacion());
    }
}
