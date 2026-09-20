//! Plata.
//!
//! En Colombia se cobra en pesos enteros: no hay centavos circulando. Aun así,
//! la plata **nunca** se guarda en `f64`. Un `0.1 + 0.2` que da `0.30000000000000004`
//! en una tirilla es un descuadre de caja al final del turno, y el cajero es
//! quien lo paga de su bolsillo.
//!
//! Todo se maneja en `i64` de pesos. La única división que existe —el IVA— se
//! redondea explícitamente y en un solo lugar.

use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, Default)]
#[serde(transparent)]
pub struct Pesos(pub i64);

impl Pesos {
    pub const CERO: Pesos = Pesos(0);

    /// El total de una línea. Devuelve `None` si se desborda, en vez de dar la
    /// vuelta en silencio: una cantidad absurda debe reventar en la caja, no
    /// aparecer como un total negativo en el cierre.
    pub fn por(self, cantidad: i64) -> Option<Pesos> {
        self.0.checked_mul(cantidad).map(Pesos)
    }

    pub fn mas(self, otro: Pesos) -> Option<Pesos> {
        self.0.checked_add(otro.0).map(Pesos)
    }

    pub fn menos(self, otro: Pesos) -> Option<Pesos> {
        self.0.checked_sub(otro.0).map(Pesos)
    }

    /// IVA incluido en el precio (que es como se cotiza en Colombia).
    ///
    /// Con 19%: de un precio de 10.000, la base son 8.403 y el IVA 1.597.
    /// Se redondea al peso más cercano y el IVA se calcula como la diferencia
    /// contra la base, nunca por separado: así base + iva siempre da el total
    /// exacto y la suma de la tirilla cuadra con lo que se cobró.
    pub fn desglosar_iva(self, porcentaje: u32) -> (Pesos, Pesos) {
        if porcentaje == 0 {
            return (self, Pesos::CERO);
        }
        let divisor = 100 + porcentaje as i64;
        // Redondeo al entero más cercano, no truncado: truncar siempre a favor
        // del negocio son centavos que no existen y una DIAN que no cuadra.
        let base = (self.0 * 100 + divisor / 2) / divisor;
        (Pesos(base), Pesos(self.0 - base))
    }

    /// El vuelto. `None` si el pago no alcanza: cobrar de menos no es un caso
    /// a redondear, es un error que el cajero tiene que ver.
    pub fn vuelto(total: Pesos, recibido: Pesos) -> Option<Pesos> {
        if recibido < total {
            return None;
        }
        recibido.menos(total)
    }
}

impl fmt::Display for Pesos {
    /// Con separador de miles y sin decimales, como se lee en Colombia.
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let negativo = self.0 < 0;
        let digitos = self.0.abs().to_string();
        let mut salida = String::with_capacity(digitos.len() + digitos.len() / 3 + 2);

        for (i, c) in digitos.chars().enumerate() {
            if i > 0 && (digitos.len() - i) % 3 == 0 {
                salida.push('.');
            }
            salida.push(c);
        }

        if negativo {
            write!(f, "-${}", salida)
        } else {
            write!(f, "${}", salida)
        }
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn se_lee_como_en_colombia() {
        assert_eq!(Pesos(1_250_000).to_string(), "$1.250.000");
        assert_eq!(Pesos(999).to_string(), "$999");
        assert_eq!(Pesos(1_000).to_string(), "$1.000");
        assert_eq!(Pesos(0).to_string(), "$0");
        assert_eq!(Pesos(-4_500).to_string(), "-$4.500");
    }

    #[test]
    fn el_iva_incluido_siempre_cuadra_con_el_total() {
        // Si base + iva no da el total, la tirilla miente y la declaración también.
        for precio in [1_000, 9_900, 10_000, 33_333, 1_250_000] {
            let (base, iva) = Pesos(precio).desglosar_iva(19);
            assert_eq!(base.0 + iva.0, precio, "no cuadra para {precio}");
        }
    }

    #[test]
    fn el_iva_de_diez_mil_es_el_conocido() {
        let (base, iva) = Pesos(10_000).desglosar_iva(19);
        assert_eq!((base.0, iva.0), (8_403, 1_597));
    }

    #[test]
    fn sin_iva_no_se_inventa_nada() {
        let (base, iva) = Pesos(10_000).desglosar_iva(0);
        assert_eq!((base.0, iva.0), (10_000, 0));
    }

    #[test]
    fn una_cantidad_absurda_no_da_la_vuelta() {
        assert_eq!(Pesos(i64::MAX).por(2), None);
        assert_eq!(Pesos(2_000).por(3), Some(Pesos(6_000)));
    }

    #[test]
    fn no_hay_vuelto_si_el_pago_no_alcanza() {
        assert_eq!(Pesos::vuelto(Pesos(10_000), Pesos(9_999)), None);
        assert_eq!(Pesos::vuelto(Pesos(10_000), Pesos(20_000)), Some(Pesos(10_000)));
        assert_eq!(Pesos::vuelto(Pesos(10_000), Pesos(10_000)), Some(Pesos::CERO));
    }
}
