//! Qué impuesto lleva cada línea.
//!
//! Un local que vende almuerzos y además cerveza en botella cerrada no tiene
//! un impuesto, tiene tres: el plato paga **impoconsumo del 8%**, la cerveza
//! paga **IVA del 19%** y hay cosas que no pagan nada. Con un porcentaje único
//! para toda la venta —que es como estaba— el negocio declara mal, y declara
//! mal todos los días.
//!
//! ## Los precios ya llevan el impuesto dentro
//!
//! En Colombia se cotiza con el impuesto incluido: la carta dice 20.000 y el
//! cliente paga 20.000. Así que aquí no se **suma** nada, se **desglosa**: de
//! esos 20.000 se saca cuánto es base y cuánto es impuesto. El total de la
//! venta no cambia por clasificar bien, y por eso este módulo no puede romper
//! ninguna cuenta de la caja.
//!
//! ## Por qué se infiere de la categoría
//!
//! Lo correcto sería que cada producto lo dijera. Pero eso exige que alguien
//! entre al panel y clasifique cientos de productos antes de poder cobrar, y
//! mientras tanto el negocio sigue vendiendo. La inferencia por categoría
//! acierta en la inmensa mayoría de las cartas colombianas —"Licores" es
//! licor— y deja el caso raro para cuando haya un campo explícito.

use crate::dinero::Pesos;
use serde::{Deserialize, Serialize};

/// El régimen de una línea.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TipoImpuesto {
    /// Impoconsumo 8%: platos preparados, bebidas servidas, postres.
    Inc8,
    /// IVA 19%: licor cerrado, cigarrillos, mercancía.
    Iva19,
    /// Ni uno ni otro.
    Exento,
}

impl TipoImpuesto {
    /// La tarifa en puntos porcentuales.
    pub fn tarifa(self) -> u32 {
        match self {
            TipoImpuesto::Inc8 => 8,
            TipoImpuesto::Iva19 => 19,
            TipoImpuesto::Exento => 0,
        }
    }

    /// Cómo se guarda en SQLite y cómo viaja a la nube.
    pub fn como_texto(self) -> &'static str {
        match self {
            TipoImpuesto::Inc8 => "INC_8",
            TipoImpuesto::Iva19 => "IVA_19",
            TipoImpuesto::Exento => "EXENTO",
        }
    }

    /// Cómo se lee de vuelta. Lo desconocido cae en impoconsumo, que es la
    /// regla general de un negocio gastronómico.
    pub fn desde_texto(texto: &str) -> Self {
        match texto {
            "IVA_19" => TipoImpuesto::Iva19,
            "EXENTO" => TipoImpuesto::Exento,
            _ => TipoImpuesto::Inc8,
        }
    }

    /// Cómo se llama en la tirilla, donde lo lee el cliente y el contador.
    pub fn etiqueta(self) -> &'static str {
        match self {
            TipoImpuesto::Inc8 => "INC 8%",
            TipoImpuesto::Iva19 => "IVA 19%",
            TipoImpuesto::Exento => "Exento",
        }
    }
}

/// Quita tildes y pasa a minúsculas, para comparar categorías escritas a mano.
///
/// El dueño escribe "Bebidas Alcohólicas", "bebidas alcoholicas" o "LICORES"
/// según el día, y las tres son lo mismo.
fn normalizar(texto: &str) -> String {
    texto
        .chars()
        .map(|c| match c {
            'á' | 'à' | 'ä' | 'â' | 'Á' | 'À' | 'Ä' | 'Â' => 'a',
            'é' | 'è' | 'ë' | 'ê' | 'É' | 'È' | 'Ë' | 'Ê' => 'e',
            'í' | 'ì' | 'ï' | 'î' | 'Í' | 'Ì' | 'Ï' | 'Î' => 'i',
            'ó' | 'ò' | 'ö' | 'ô' | 'Ó' | 'Ò' | 'Ö' | 'Ô' => 'o',
            'ú' | 'ù' | 'ü' | 'û' | 'Ú' | 'Ù' | 'Ü' | 'Û' => 'u',
            otro => otro.to_ascii_lowercase(),
        })
        .collect()
}

/// Categorías que son IVA del 19%.
const SON_IVA: &[&str] = &[
    "licor", "licores", "cerveza", "cervezas", "alcohol",
    "bebidas alcoholicas", "cigarrillo", "cigarrillos", "merch",
];

/// Categorías que no pagan.
const SON_EXENTAS: &[&str] = &["exento", "exentos", "excluido", "excluidos", "propina"];

/// Deduce el régimen a partir de la categoría del producto.
///
/// El orden de las comprobaciones importa: lo exento se mira **antes** que lo
/// gravado, porque una categoría llamada "Licores exentos" —que existe en
/// zonas de frontera— es exenta, no IVA.
pub fn inferir(categoria: &str) -> TipoImpuesto {
    let limpia = normalizar(categoria);

    if SON_EXENTAS.iter().any(|p| limpia.contains(p)) {
        return TipoImpuesto::Exento;
    }
    if SON_IVA.iter().any(|p| limpia.contains(p)) {
        return TipoImpuesto::Iva19;
    }

    // La regla general de un negocio gastronómico.
    TipoImpuesto::Inc8
}

/// Lo que se declara de una línea: cuánto es base y cuánto es impuesto.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct Desglose {
    pub base: Pesos,
    pub impuesto: Pesos,
}

/// Separa un monto con impuesto incluido en base e impuesto.
///
/// El impuesto se calcula como **la diferencia** contra la base, nunca por
/// separado: así base + impuesto da exactamente el monto cobrado y la suma de
/// la tirilla cuadra al peso con lo que entró a la gaveta. Calcularlos por
/// separado deja diferencias de un peso que nadie sabe explicar.
pub fn desglosar(monto: Pesos, tipo: TipoImpuesto) -> Desglose {
    if tipo == TipoImpuesto::Exento {
        return Desglose { base: monto, impuesto: Pesos::CERO };
    }

    let divisor = 100 + tipo.tarifa() as i64;
    // Al entero más cercano, no truncado: truncar siempre a favor del negocio
    // son centavos que no existen y una declaración que no cuadra.
    let base = (monto.0 * 100 + divisor / 2) / divisor;

    Desglose { base: Pesos(base), impuesto: Pesos(monto.0 - base) }
}

/// Los totales por régimen de una venta entera.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct Totales {
    pub base_inc: Pesos,
    pub inc: Pesos,
    pub base_iva: Pesos,
    pub iva: Pesos,
    pub exento: Pesos,
}

impl Totales {
    /// Suma una línea ya desglosada.
    pub fn sumar(&mut self, tipo: TipoImpuesto, d: Desglose) {
        match tipo {
            TipoImpuesto::Inc8 => {
                self.base_inc = Pesos(self.base_inc.0 + d.base.0);
                self.inc = Pesos(self.inc.0 + d.impuesto.0);
            }
            TipoImpuesto::Iva19 => {
                self.base_iva = Pesos(self.base_iva.0 + d.base.0);
                self.iva = Pesos(self.iva.0 + d.impuesto.0);
            }
            TipoImpuesto::Exento => {
                self.exento = Pesos(self.exento.0 + d.base.0);
            }
        }
    }

    /// Todo el impuesto de la venta, de cualquier régimen.
    pub fn impuesto_total(&self) -> Pesos {
        Pesos(self.inc.0 + self.iva.0)
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;

    mod que_impuesto_lleva {
        use super::*;

        #[test]
        fn un_plato_paga_impoconsumo() {
            // La regla general de cualquier restaurante.
            assert_eq!(inferir("Platos fuertes"), TipoImpuesto::Inc8);
            assert_eq!(inferir("Entradas"), TipoImpuesto::Inc8);
            assert_eq!(inferir("Postres"), TipoImpuesto::Inc8);
            assert_eq!(inferir(""), TipoImpuesto::Inc8);
        }

        #[test]
        fn el_licor_cerrado_paga_iva() {
            assert_eq!(inferir("Licores"), TipoImpuesto::Iva19);
            assert_eq!(inferir("Cervezas"), TipoImpuesto::Iva19);
            assert_eq!(inferir("Cigarrillos"), TipoImpuesto::Iva19);
        }

        #[test]
        fn las_tildes_y_las_mayusculas_dan_igual() {
            /* El dueño escribe la categoría a mano y cada día distinto. Si
               "Bebidas Alcohólicas" no se reconociera, ese licor se declararía
               al 8% en vez de al 19%. */
            assert_eq!(inferir("Bebidas Alcohólicas"), TipoImpuesto::Iva19);
            assert_eq!(inferir("bebidas alcoholicas"), TipoImpuesto::Iva19);
            assert_eq!(inferir("LICORES"), TipoImpuesto::Iva19);
        }

        #[test]
        fn lo_exento_se_mira_antes_que_lo_gravado() {
            /* "Licores exentos" existe en zonas de frontera. Si se mirara
               primero lo gravado, se cobraría IVA sobre algo que no lo paga. */
            assert_eq!(inferir("Licores exentos"), TipoImpuesto::Exento);
            assert_eq!(inferir("Productos excluidos"), TipoImpuesto::Exento);
        }

        #[test]
        fn una_categoria_compuesta_se_reconoce_igual() {
            // "Bar - Cervezas artesanales" es cerveza.
            assert_eq!(inferir("Bar - Cervezas artesanales"), TipoImpuesto::Iva19);
        }
    }

    mod el_desglose {
        use super::*;

        #[test]
        fn base_mas_impuesto_da_exactamente_lo_cobrado() {
            /* La propiedad de la que depende todo: si no diera exacto, la
               tirilla mostraría una suma distinta de lo que entró a la gaveta
               y el contador tendría que explicar un peso de diferencia. */
            for monto in [1, 999, 1_000, 14_237, 20_000, 99_999, 1_234_567] {
                for tipo in [TipoImpuesto::Inc8, TipoImpuesto::Iva19, TipoImpuesto::Exento] {
                    let d = desglosar(Pesos(monto), tipo);
                    assert_eq!(
                        d.base.0 + d.impuesto.0,
                        monto,
                        "no cuadra con {monto} en {}",
                        tipo.etiqueta(),
                    );
                }
            }
        }

        #[test]
        fn un_plato_de_veinte_mil_al_ocho_por_ciento() {
            // 20.000 / 1,08 = 18.518,5 → base 18.519, impoconsumo 1.481.
            let d = desglosar(Pesos(20_000), TipoImpuesto::Inc8);
            assert_eq!(d.base, Pesos(18_519));
            assert_eq!(d.impuesto, Pesos(1_481));
        }

        #[test]
        fn una_cerveza_de_diez_mil_al_diecinueve() {
            // 10.000 / 1,19 = 8.403,4 → base 8.403, IVA 1.597.
            let d = desglosar(Pesos(10_000), TipoImpuesto::Iva19);
            assert_eq!(d.base, Pesos(8_403));
            assert_eq!(d.impuesto, Pesos(1_597));
        }

        #[test]
        fn lo_exento_es_todo_base() {
            let d = desglosar(Pesos(15_000), TipoImpuesto::Exento);
            assert_eq!(d.base, Pesos(15_000));
            assert_eq!(d.impuesto, Pesos::CERO);
        }
    }

    #[test]
    fn una_venta_mixta_declara_cada_cosa_por_su_lado() {
        /* El caso que motivó todo: un almuerzo y una cerveza en la misma
           cuenta. Con un porcentaje único, uno de los dos se declara mal. */
        let mut t = Totales::default();

        t.sumar(TipoImpuesto::Inc8, desglosar(Pesos(20_000), TipoImpuesto::Inc8));
        t.sumar(TipoImpuesto::Iva19, desglosar(Pesos(10_000), TipoImpuesto::Iva19));

        assert_eq!(t.base_inc, Pesos(18_519));
        assert_eq!(t.inc, Pesos(1_481));
        assert_eq!(t.base_iva, Pesos(8_403));
        assert_eq!(t.iva, Pesos(1_597));

        // Y la venta sigue valiendo 30.000.
        assert_eq!(t.base_inc.0 + t.inc.0 + t.base_iva.0 + t.iva.0, 30_000);
        assert_eq!(t.impuesto_total(), Pesos(3_078));
    }

    #[test]
    fn el_texto_va_y_vuelve_igual() {
        // Es lo que se guarda en SQLite y lo que viaja a la nube.
        for tipo in [TipoImpuesto::Inc8, TipoImpuesto::Iva19, TipoImpuesto::Exento] {
            assert_eq!(TipoImpuesto::desde_texto(tipo.como_texto()), tipo);
        }
    }

    #[test]
    fn un_texto_desconocido_cae_en_impoconsumo() {
        /* Una caja vieja que suba "IVA_5" no puede reventar. Cae en la regla
           general del negocio, que es lo menos equivocado posible. */
        assert_eq!(TipoImpuesto::desde_texto("IVA_5"), TipoImpuesto::Inc8);
        assert_eq!(TipoImpuesto::desde_texto(""), TipoImpuesto::Inc8);
    }
}
