//! La tirilla y el cajón monedero, en bytes.
//!
//! Las impresoras térmicas no hablan HTTP ni JSON: reciben una secuencia de
//! bytes ESC/POS por un puerto serie, USB o TCP 9100. Armar esos bytes es la
//! clase de código que "funciona en mi impresora" y falla en la del cliente,
//! así que vive aquí solo, sin puerto de por medio, y se prueba byte a byte.
//!
//! Dos cosas que cuestan plata si se hacen mal:
//!
//! 1. **La tabla de caracteres.** El webview manda UTF-8; la impresora no lo
//!    entiende. Sin traducir, "Ñ" y las tildes salen como basura en el nombre
//!    del producto y en el del negocio. Se convierte a CP850, que es la que
//!    traen casi todas las térmicas que se venden en Colombia.
//!
//! 2. **El pulso del cajón.** Va en el mismo flujo que la tirilla, no en una
//!    conexión aparte: si se manda por otro lado, el cajón abre antes de que
//!    la tirilla termine de salir, o no abre.

/// Comandos crudos. Los nombres son los del manual de Epson, para poder
/// contrastarlos con cualquier documentación sin traducir mentalmente.
const ESC: u8 = 0x1B;
const GS: u8 = 0x1D;
const LF: u8 = 0x0A;

/// Ancho en caracteres de una térmica de 80 mm con fuente A.
/// Las de 58 mm usan 32; se pasa como parámetro porque el negocio puede tener
/// cualquiera de las dos y la tirilla se descuadra entera si se asume.
pub const ANCHO_80MM: usize = 48;
pub const ANCHO_58MM: usize = 32;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Alineacion {
    Izquierda,
    Centro,
    Derecha,
}

/// Construye el flujo de bytes de una tirilla.
#[derive(Debug, Default)]
pub struct Tirilla {
    bytes: Vec<u8>,
    ancho: usize,
}

impl Tirilla {
    /// `ESC @` reinicia la impresora y `ESC t 2` selecciona CP850. Van juntos
    /// y de primeras: si la impresora quedó en negrita o en doble alto por un
    /// ticket anterior que se cortó a medias, esto lo limpia.
    pub fn nueva(ancho: usize) -> Self {
        let mut t = Tirilla { bytes: Vec::with_capacity(512), ancho };
        t.bytes.extend_from_slice(&[ESC, b'@']);
        t.bytes.extend_from_slice(&[ESC, b't', 2]);
        t
    }

    pub fn alinear(&mut self, a: Alineacion) -> &mut Self {
        let n = match a {
            Alineacion::Izquierda => 0,
            Alineacion::Centro => 1,
            Alineacion::Derecha => 2,
        };
        self.bytes.extend_from_slice(&[ESC, b'a', n]);
        self
    }

    /// `ESC E n` — negrita.
    pub fn negrita(&mut self, encendida: bool) -> &mut Self {
        self.bytes.extend_from_slice(&[ESC, b'E', encendida as u8]);
        self
    }

    /// `GS ! n` — doble alto y ancho, para el total. Es lo único que el cliente
    /// mira desde lejos mientras paga.
    pub fn doble(&mut self, encendido: bool) -> &mut Self {
        self.bytes.extend_from_slice(&[GS, b'!', if encendido { 0x11 } else { 0x00 }]);
        self
    }

    pub fn texto(&mut self, s: &str) -> &mut Self {
        self.bytes.extend(a_cp850(s));
        self
    }

    pub fn linea(&mut self, s: &str) -> &mut Self {
        self.texto(s);
        self.bytes.push(LF);
        self
    }

    pub fn salto(&mut self) -> &mut Self {
        self.bytes.push(LF);
        self
    }

    /// Una línea con algo a la izquierda y algo a la derecha, rellenando el
    /// medio. Es el 90% de una tirilla: producto y precio, "TOTAL" y total.
    ///
    /// Si no cabe, se recorta la izquierda: el precio nunca se corta, porque un
    /// precio a medias es un reclamo.
    pub fn par(&mut self, izq: &str, der: &str) -> &mut Self {
        let largo_der = der.chars().count();
        let espacio_izq = self.ancho.saturating_sub(largo_der + 1);

        let izq_recortada: String = izq.chars().take(espacio_izq).collect();
        let relleno = self.ancho.saturating_sub(izq_recortada.chars().count() + largo_der);

        let linea = format!("{}{}{}", izq_recortada, " ".repeat(relleno), der);
        self.linea(&linea)
    }

    pub fn separador(&mut self) -> &mut Self {
        let l = "-".repeat(self.ancho);
        self.linea(&l)
    }

    /// `ESC p 0 25 250` — pulso al conector RJ11 del cajón.
    ///
    /// Los dos números son la duración del pulso en unidades de 2 ms: 50 ms
    /// encendido, 500 ms apagado. Con valores más bajos hay cajones baratos que
    /// no alcanzan a mover el solenoide y no abren.
    pub fn abrir_cajon(&mut self) -> &mut Self {
        self.bytes.extend_from_slice(&[ESC, b'p', 0, 25, 250]);
        self
    }

    /// El QR de un enlace —el del menú del negocio— centrado en la tirilla.
    ///
    /// Dos formas, las mismas del agente de impresión:
    ///
    /// - **Imagen** (`nativo = false`): la caja dibuja los módulos y los manda
    ///   como mapa de bits (GS v 0). Funciona en casi cualquier térmica, porque
    ///   imprimir puntos es lo único que todas saben hacer.
    /// - **Nativo**: se le manda el texto y la impresora dibuja el código
    ///   (GS ( k). Sale más nítido, pero las térmicas baratas no lo entienden
    ///   y lo imprimen como basura.
    ///
    /// Nivel de corrección M: una tirilla se arruga y se destiñe, y M sigue
    /// leyéndose con un 15 % del código dañado.
    pub fn qr(&mut self, texto: &str, nativo: bool) -> &mut Self {
        if texto.is_empty() {
            return self;
        }
        if nativo {
            let datos = texto.as_bytes();
            let largo = datos.len() + 3;
            self.bytes.extend_from_slice(&[ESC, b'a', 1]);
            self.bytes.extend_from_slice(&[GS, b'(', b'k', 4, 0, 49, 65, 50, 0]); // modelo 2
            self.bytes.extend_from_slice(&[GS, b'(', b'k', 3, 0, 49, 67, 6]); // módulo de 6 puntos
            self.bytes.extend_from_slice(&[GS, b'(', b'k', 3, 0, 49, 69, 49]); // corrección M
            self.bytes.extend_from_slice(&[GS, b'(', b'k', (largo & 0xFF) as u8, (largo >> 8) as u8, 49, 80, 48]);
            self.bytes.extend_from_slice(datos);
            self.bytes.extend_from_slice(&[GS, b'(', b'k', 3, 0, 49, 81, 48]); // imprimir
            self.bytes.push(LF);
            return self;
        }

        let Ok(codigo) = qrcode::QrCode::with_error_correction_level(texto, qrcode::EcLevel::M) else {
            return self;
        };
        let lado = codigo.width();
        let colores = codigo.to_colors();
        let oscuro = |x: usize, y: usize| colores[y * lado + x] == qrcode::Color::Dark;

        /* Doce puntos por carácter es la relación de las térmicas: 48
           caracteres son los 576 puntos del papel de 80 mm, 32 los 384 del de
           58. Se apunta a la mitad del ancho, en un múltiplo entero del módulo
           —escalar fraccionario deforma los módulos y los lectores fallan—, y
           con dos módulos de margen blanco alrededor. */
        let puntos = self.ancho * 12;
        let margen = 2;
        let total = lado + margen * 2;
        let escala = ((puntos / 2) / total).clamp(3, 8).min((puntos / total).max(1));
        let lado_puntos = total * escala;
        let desplazamiento = (puntos.saturating_sub(lado_puntos)) / 2;
        let fila_bytes = (desplazamiento + lado_puntos).div_ceil(8);

        self.bytes.extend_from_slice(&[GS, b'v', b'0', 0]);
        self.bytes.extend_from_slice(&[(fila_bytes & 0xFF) as u8, (fila_bytes >> 8) as u8]);
        self.bytes.extend_from_slice(&[(lado_puntos & 0xFF) as u8, (lado_puntos >> 8) as u8]);
        for y in 0..lado_puntos {
            let mut fila = vec![0u8; fila_bytes];
            let my = (y / escala) as isize - margen as isize;
            for x in 0..lado_puntos {
                let mx = (x / escala) as isize - margen as isize;
                let negro = my >= 0 && mx >= 0 && (my as usize) < lado && (mx as usize) < lado
                    && oscuro(mx as usize, my as usize);
                if negro {
                    let bit = desplazamiento + x;
                    fila[bit / 8] |= 0x80 >> (bit % 8);
                }
            }
            self.bytes.extend_from_slice(&fila);
        }
        self.bytes.push(LF);
        self
    }

    /// Avanza el papel y corta. El avance no es decorativo: sin él, el corte
    /// queda dentro del texto porque la cuchilla está unos milímetros arriba
    /// del cabezal.
    pub fn cortar(&mut self) -> &mut Self {
        self.bytes.extend_from_slice(&[LF, LF, LF, LF]);
        self.bytes.extend_from_slice(&[GS, b'V', 66, 0]);
        self
    }

    /// Corta dejando un punto de unión de un milímetro.
    ///
    /// Es el corte de la cocina, y la diferencia no es un detalle: con corte
    /// total la comanda se suelta y cae —al suelo, a la freidora, sobre la
    /// plancha—. Con corte parcial se queda colgando hasta que el cocinero la
    /// arranca con la mano y la pone en su comandero.
    ///
    /// En el mostrador es al revés: ahí el papel tiene que soltarse solo para
    /// llegar a la mano del cliente.
    pub fn cortar_parcial(&mut self) -> &mut Self {
        self.bytes.extend_from_slice(&[LF, LF, LF, LF]);
        self.bytes.extend_from_slice(&[GS, b'V', 66, 1]);
        self
    }

    pub fn terminar(self) -> Vec<u8> {
        self.bytes
    }
}

/// UTF-8 → CP850 (la tabla que traen las térmicas comunes en Colombia).
///
/// Solo se traduce lo que de verdad aparece en una tirilla en español. Lo que
/// no está en la tabla se reemplaza por '?': es preferible una interrogación a
/// un byte suelto que deje a la impresora imprimiendo basura el resto del
/// ticket.
fn a_cp850(s: &str) -> Vec<u8> {
    s.chars()
        .map(|c| match c {
            c if (c as u32) < 128 => c as u8,
            'á' => 0xA0, 'é' => 0x82, 'í' => 0xA1, 'ó' => 0xA2, 'ú' => 0xA3,
            'Á' => 0xB5, 'É' => 0x90, 'Í' => 0xD6, 'Ó' => 0xE0, 'Ú' => 0xE9,
            'ñ' => 0xA4, 'Ñ' => 0xA5,
            'ü' => 0x81, 'Ü' => 0x9A,
            '¿' => 0xA8, '¡' => 0xAD,
            '°' => 0xF8,
            '“' | '”' => b'"',
            '‘' | '’' => b'\'',
            '–' | '—' => b'-',
            '…' => b'.',
            _ => b'?',
        })
        .collect()
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn arranca_reiniciando_y_fijando_la_tabla() {
        // Sin ESC @ hereda el formato del ticket anterior; sin ESC t 2 las
        // tildes salen como basura.
        let bytes = Tirilla::nueva(ANCHO_80MM).terminar();
        assert_eq!(bytes, vec![ESC, b'@', ESC, b't', 2]);
    }

    #[test]
    fn las_tildes_y_la_enie_no_salen_como_basura() {
        assert_eq!(a_cp850("ñ"), vec![0xA4]);
        assert_eq!(a_cp850("Ñ"), vec![0xA5]);
        assert_eq!(a_cp850("Café"), vec![b'C', b'a', b'f', 0x82]);
        assert_eq!(a_cp850("Piñón"), vec![b'P', b'i', 0xA4, 0xA2, b'n']);
    }

    #[test]
    fn lo_que_no_esta_en_la_tabla_no_rompe_el_resto_del_ticket() {
        // Un emoji en el nombre de un producto no puede tumbar la tirilla.
        assert_eq!(a_cp850("a🍔b"), vec![b'a', b'?', b'b']);
    }

    #[test]
    fn el_par_alinea_a_lo_ancho_del_papel() {
        let mut t = Tirilla::nueva(ANCHO_58MM);
        t.par("Café", "$5.000");
        let texto = String::from_utf8_lossy(&t.terminar()[5..]).to_string();
        // 32 caracteres exactos: el precio pegado al borde derecho.
        assert_eq!(texto.trim_end_matches('\n').chars().count(), 32);
        assert!(texto.ends_with("$5.000\n"));
    }

    #[test]
    fn un_nombre_largo_se_recorta_pero_el_precio_nunca() {
        let mut t = Tirilla::nueva(ANCHO_58MM);
        t.par("Hamburguesa doble con tocineta y papas", "$45.000");
        let texto = String::from_utf8_lossy(&t.terminar()[5..]).to_string();
        assert_eq!(texto.trim_end_matches('\n').chars().count(), 32);
        assert!(texto.contains("$45.000"));
    }

    #[test]
    fn el_pulso_del_cajon_es_el_que_mueve_solenoides_baratos() {
        let mut t = Tirilla::nueva(ANCHO_80MM);
        t.abrir_cajon();
        let bytes = t.terminar();
        assert_eq!(&bytes[5..], &[ESC, b'p', 0, 25, 250]);
    }

    #[test]
    fn el_corte_de_cocina_deja_la_comanda_colgando() {
        /* Con corte total la comanda se suelta y cae a la freidora. El 1 final
           es lo que deja el milímetro de unión. */
        let mut t = Tirilla::nueva(ANCHO_80MM);
        t.cortar_parcial();
        let bytes = t.terminar();

        assert_eq!(&bytes[bytes.len() - 4..], &[GS, b'V', 66, 1]);
        assert_eq!(&bytes[bytes.len() - 8..bytes.len() - 4], &[LF, LF, LF, LF], "también avanza");
    }

    #[test]
    fn corta_despues_de_avanzar_el_papel() {
        // Cortar sin avanzar parte el texto: la cuchilla está sobre el cabezal.
        let mut t = Tirilla::nueva(ANCHO_80MM);
        t.cortar();
        let bytes = t.terminar();
        assert_eq!(&bytes[5..], &[LF, LF, LF, LF, GS, b'V', 66, 0]);
    }

    #[test]
    fn el_qr_como_imagen_es_un_mapa_de_bits_del_ancho_del_papel() {
        let mut t = Tirilla::nueva(48);
        t.qr("https://menuby.tech/go-burger", false);
        let b = t.terminar();
        let i = b.windows(4).position(|w| w == [GS, b'v', b'0', 0]).expect("falta GS v 0");
        let ancho_bytes = b[i + 4] as usize | (b[i + 5] as usize) << 8;
        let alto = b[i + 6] as usize | (b[i + 7] as usize) << 8;
        assert!(ancho_bytes * 8 <= 576, "no cabe en 80 mm");
        assert!(alto > 100, "demasiado chico para leerse: {alto}");
    }

    #[test]
    fn el_qr_nativo_lleva_el_texto_para_la_impresora() {
        let mut t = Tirilla::nueva(32);
        t.qr("https://menuby.tech/go-burger", true);
        let b = t.terminar();
        assert!(b.windows(3).any(|w| w == [GS, b'(', b'k']));
        assert!(String::from_utf8_lossy(&b).contains("menuby.tech/go-burger"));
    }

    #[test]
    fn sin_enlace_no_hay_qr() {
        let mut con = Tirilla::nueva(32);
        con.qr("", false);
        assert_eq!(con.terminar(), Tirilla::nueva(32).terminar());
    }
}
