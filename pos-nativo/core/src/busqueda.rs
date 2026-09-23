//! Encontrar un producto al primer intento, y que lo que más se vende esté
//! a mano.
//!
//! La caja buscaba con `LIKE '%texto%'` y ordenaba por nombre. Tres cosas
//! salían mal todos los días:
//!
//! - **Las tildes.** SQLite solo ignora mayúsculas en ASCII: "clasica" no
//!   encontraba "Clásica", y nadie escribe tildes con una fila esperando.
//! - **El orden de las palabras.** "ham cla" no encontraba "Hamburguesa
//!   Clásica", porque el texto se buscaba entero y seguido.
//! - **El primero de la lista.** Enter agrega el primer resultado —es lo que
//!   hace el lector de códigos al terminar—, y con orden alfabético "papas"
//!   daba primero "Hamburguesa con papas" que "Papas francesas". El cajero
//!   escribía bien y la caja marcaba otra cosa.
//!
//! Y sin buscar, la rejilla salía en orden alfabético: el producto que más se
//! vende podía estar en la página tres, a dos toques de distancia cada vez.
//!
//! Todo lo de aquí es puro —no toca la base— para poder probarlo entero.

use rusqlite::{params, Connection, Result};
use std::collections::HashMap;

/// Minúsculas, sin tildes y con cualquier signo convertido en espacio.
///
/// La ñ se vuelve n a propósito: "pina" tiene que encontrar "Piña colada",
/// que es como lo escribe quien no tiene la ñ a mano en el teclado de la caja.
pub fn normalizar(texto: &str) -> String {
    let mut salida = String::with_capacity(texto.len());
    for c in texto.chars().flat_map(char::to_lowercase) {
        let base = match c {
            'á' | 'à' | 'ä' | 'â' | 'ã' => 'a',
            'é' | 'è' | 'ë' | 'ê' => 'e',
            'í' | 'ì' | 'ï' | 'î' => 'i',
            'ó' | 'ò' | 'ö' | 'ô' | 'õ' => 'o',
            'ú' | 'ù' | 'ü' | 'û' => 'u',
            'ñ' => 'n',
            'ç' => 'c',
            c if c.is_alphanumeric() => c,
            _ => ' ',
        };
        salida.push(base);
    }
    salida.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Qué tan bien coincide un producto con lo que se escribió. `None` si no
/// coincide.
///
/// De mayor a menor:
///
/// - **El código exacto.** Si el lector leyó un código de barras, es ese
///   producto y ningún otro, aunque haya otro con ese número en el nombre.
/// - **El nombre exacto**, y después **el nombre que empieza** por lo escrito:
///   "papas" es "Papas francesas" antes que "Hamburguesa con papas".
/// - **Todas las palabras como comienzo de alguna palabra** del nombre:
///   "ham cla" es "Hamburguesa Clásica".
/// - **Todas las palabras en algún lado**, como último recurso: "burg" dentro
///   de "Hamburguesa".
pub fn puntaje(consulta: &str, nombre: &str, variante: &str, sku: &str) -> Option<u32> {
    let q = normalizar(consulta);
    if q.is_empty() {
        return Some(0);
    }

    if !sku.is_empty() && normalizar(sku) == q {
        return Some(1000);
    }

    let completo = if variante.is_empty() {
        normalizar(nombre)
    } else {
        normalizar(&format!("{nombre} {variante}"))
    };
    let solo_nombre = normalizar(nombre);

    if solo_nombre == q || completo == q {
        return Some(900);
    }
    if completo.starts_with(&q) {
        return Some(800);
    }

    let palabras: Vec<&str> = completo.split(' ').collect();
    let piezas: Vec<&str> = q.split(' ').collect();

    if piezas.iter().all(|p| palabras.iter().any(|w| w.starts_with(p))) {
        return Some(600);
    }

    /* El código también se busca por pedazos: los negocios que imprimen sus
       propias etiquetas se saben "los que empiezan por 77". */
    let codigo = normalizar(sku);
    if piezas.iter().all(|p| completo.contains(p) || (!codigo.is_empty() && codigo.contains(p))) {
        return Some(400);
    }

    None
}

/// Cuántas unidades de cada producto se vendieron en esta caja en los treinta
/// días **anteriores a hoy**.
///
/// Sin hoy, a propósito: si contaran las ventas del día, un producto que se
/// vende mucho esta tarde subiría de puesto mientras se atiende, y la rejilla
/// se reacomodaría bajo el dedo del cajero. Así el orden cambia de un día al
/// siguiente, nunca en medio de un turno: "la tercera de la segunda fila"
/// significa lo mismo todo el día.
///
/// `hoy` es la fecha en `AAAA-MM-DD`. La clave es el id del producto más su
/// variante, porque "Gaseosa · 1.5L" y "Gaseosa · 400ml" son dos casillas.
pub fn populares(conexion: &Connection, hoy: &str) -> Result<HashMap<String, i64>> {
    let mut consulta = conexion.prepare(
        "SELECT i.producto_id || char(31) || i.variante, SUM(i.cantidad)
           FROM venta_items i JOIN ventas v ON v.id = i.venta_id
          WHERE substr(v.creada_en, 1, 10) >= date(?1, '-30 days')
            AND substr(v.creada_en, 1, 10) < ?1
          GROUP BY i.producto_id, i.variante",
    )?;
    let filas = consulta.query_map(params![hoy], |f| Ok((f.get::<_, String>(0)?, f.get::<_, i64>(1)?)))?;
    filas.collect()
}

/// La clave de `populares` para una fila del catálogo.
pub fn clave(id: &str, variante: &str) -> String {
    format!("{id}\u{1f}{variante}")
}

/// Una fila candidata: lo mínimo para decidir el orden.
pub struct Candidata<'a> {
    pub nombre: &'a str,
    pub variante: &'a str,
    pub sku: &'a str,
    pub categoria_orden: i64,
    pub vendidas: i64,
}

/// Qué filas se muestran y en qué orden. Devuelve los índices.
///
/// Buscando manda la coincidencia; entre dos que coinciden igual de bien, la
/// que más se vende. Sin buscar, manda lo que más se vende, y lo que nunca se
/// ha vendido queda en el orden de la carta —el del panel, que es el que el
/// cajero conoce— y por nombre dentro de cada categoría.
pub fn ordenar(consulta: &str, filas: &[Candidata], limite: usize) -> Vec<usize> {
    let mut elegidas: Vec<(usize, u32)> = filas
        .iter()
        .enumerate()
        .filter_map(|(i, f)| puntaje(consulta, f.nombre, f.variante, f.sku).map(|p| (i, p)))
        .collect();

    elegidas.sort_by(|(a, pa), (b, pb)| {
        let (fa, fb) = (&filas[*a], &filas[*b]);
        pb.cmp(pa)
            .then(fb.vendidas.cmp(&fa.vendidas))
            .then(fa.categoria_orden.cmp(&fb.categoria_orden))
            .then_with(|| normalizar(fa.nombre).cmp(&normalizar(fb.nombre)))
            .then_with(|| fa.variante.cmp(fb.variante))
    });

    elegidas.into_iter().take(limite).map(|(i, _)| i).collect()
}

#[cfg(test)]
mod pruebas {
    use super::*;

    fn fila<'a>(nombre: &'a str, sku: &'a str, vendidas: i64) -> Candidata<'a> {
        Candidata { nombre, variante: "", sku, categoria_orden: 1, vendidas }
    }

    fn nombres(consulta: &str, filas: &[Candidata]) -> Vec<String> {
        ordenar(consulta, filas, 200).into_iter().map(|i| filas[i].nombre.to_string()).collect()
    }

    #[test]
    fn ignora_tildes_y_mayusculas() {
        assert!(puntaje("clasica", "Hamburguesa Clásica", "", "").is_some());
        assert!(puntaje("CLÁSICA", "hamburguesa clasica", "", "").is_some());
        assert!(puntaje("pina", "Piña colada", "", "").is_some());
    }

    #[test]
    fn encuentra_por_comienzos_de_palabra_en_cualquier_orden() {
        assert!(puntaje("ham cla", "Hamburguesa Clásica", "", "").is_some());
        assert!(puntaje("cla ham", "Hamburguesa Clásica", "", "").is_some());
        assert!(puntaje("ham pollo", "Hamburguesa Clásica", "", "").is_none());
    }

    #[test]
    fn enter_marca_el_que_empieza_por_lo_escrito() {
        // El caso que marcaba mal: alfabético ponía primero la hamburguesa.
        let filas = [fila("Hamburguesa con papas", "", 0), fila("Papas francesas", "", 0)];
        assert_eq!(nombres("papas", &filas)[0], "Papas francesas");
    }

    #[test]
    fn el_codigo_exacto_gana_siempre() {
        // El lector leyó un código: es ese producto, aunque otro lo lleve en el nombre.
        let filas = [fila("Combo 7702004", "", 50), fila("Gaseosa", "7702004", 0)];
        assert_eq!(nombres("7702004", &filas)[0], "Gaseosa");
    }

    #[test]
    fn la_variante_cuenta_para_buscar() {
        let f = Candidata { nombre: "Gaseosa", variante: "1.5L", sku: "", categoria_orden: 1, vendidas: 0 };
        assert!(puntaje("gaseosa 1 5", f.nombre, f.variante, f.sku).is_some());
    }

    #[test]
    fn sin_buscar_lo_mas_vendido_va_primero() {
        let filas = [fila("Agua", "", 2), fila("Burger", "", 90), fila("Coca", "", 40)];
        assert_eq!(nombres("", &filas), ["Burger", "Coca", "Agua"]);
    }

    #[test]
    fn lo_que_nunca_se_vendio_sigue_el_orden_de_la_carta() {
        // Una caja recién instalada no tiene ventas: la carta del panel, no el abecedario.
        let filas = [
            Candidata { nombre: "Agua", variante: "", sku: "", categoria_orden: 3, vendidas: 0 },
            Candidata { nombre: "Burger", variante: "", sku: "", categoria_orden: 1, vendidas: 0 },
        ];
        assert_eq!(nombres("", &filas), ["Burger", "Agua"]);
    }

    #[test]
    fn a_igual_coincidencia_desempata_lo_que_mas_se_vende() {
        let filas = [fila("Hamburguesa doble", "", 3), fila("Hamburguesa sencilla", "", 80)];
        assert_eq!(nombres("hambur", &filas)[0], "Hamburguesa sencilla");
    }

    #[test]
    fn respeta_el_limite() {
        let filas: Vec<_> = (0..10).map(|_| fila("X", "", 0)).collect();
        assert_eq!(ordenar("", &filas, 3).len(), 3);
    }

    fn base() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch(
            "CREATE TABLE ventas (id TEXT PRIMARY KEY, creada_en TEXT NOT NULL);
             CREATE TABLE venta_items (venta_id TEXT, producto_id TEXT, variante TEXT, cantidad INTEGER);",
        )
        .unwrap();
        c
    }

    fn vender(c: &Connection, id: &str, cuando: &str, producto: &str, cantidad: i64) {
        c.execute("INSERT INTO ventas VALUES (?1, ?2)", params![id, cuando]).unwrap();
        c.execute(
            "INSERT INTO venta_items VALUES (?1, ?2, '', ?3)",
            params![id, producto, cantidad],
        )
        .unwrap();
    }

    #[test]
    fn populares_cuenta_los_ultimos_treinta_dias_sin_hoy() {
        let c = base();
        vender(&c, "a", "2026-09-22T13:00:00-05:00", "burger", 3);
        vender(&c, "b", "2026-08-25T13:00:00-05:00", "burger", 2);
        // Hoy no cuenta: la rejilla no se reacomoda en medio del turno.
        vender(&c, "c", "2026-09-23T09:00:00-05:00", "burger", 50);
        // Hace más de treinta días tampoco.
        vender(&c, "d", "2026-08-01T13:00:00-05:00", "burger", 70);

        let p = populares(&c, "2026-09-23").unwrap();
        assert_eq!(p.get(&clave("burger", "")), Some(&5));
    }
}
