//! Los pedidos que entran por el menú web, el WhatsApp o el panel.
//!
//! El POS web los mostraba y la caja nativa no: quien atendía el mostrador
//! tenía que tener el panel abierto en otra pantalla para enterarse de que
//! había un domicilio esperando, y el domicilio esperaba.
//!
//! La caja **no los guarda**: viven en la nube, que es donde el cliente los
//! sigue y donde se cobran. Aquí solo se miran, se mueven de estado —por el
//! mismo camino que el panel, así que el cliente recibe sus avisos igual— y se
//! imprimen. Sin internet no hay pedidos web que atender, y la pantalla lo dice.

use crate::nube::Nube;
use pos_core::{escpos, sync};
use std::time::Duration;

/// Corto: la pantalla pregunta cada pocos segundos y una respuesta lenta no
/// puede apilar consultas.
const ESPERA: Duration = Duration::from_secs(8);

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct ItemPedido {
    pub nombre: String,
    #[serde(default)]
    pub variante: String,
    pub cantidad: i64,
    #[serde(default)]
    pub precio: i64,
    #[serde(default)]
    pub extras: Vec<String>,
    #[serde(default)]
    pub regalo: bool,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct PedidoWeb {
    pub id: String,
    pub numero: String,
    pub estado: String,
    #[serde(default)]
    pub canal: String,
    /// "delivery", "takeaway" o "inSite".
    #[serde(default)]
    pub tipo: String,
    #[serde(default)]
    pub cliente: String,
    #[serde(default)]
    pub telefono: String,
    #[serde(default)]
    pub direccion: String,
    #[serde(default)]
    pub mesa: String,
    #[serde(default)]
    pub notas: String,
    #[serde(default)]
    pub metodo_pago: String,
    #[serde(default)]
    pub comprobante: bool,
    #[serde(default)]
    pub total: i64,
    #[serde(default)]
    pub envio: i64,
    #[serde(default)]
    pub creado: String,
    #[serde(default)]
    pub items: Vec<ItemPedido>,
}

#[derive(serde::Deserialize)]
struct Lista {
    pedidos: Vec<PedidoWeb>,
}

fn explicar(e: ureq::Error) -> String {
    match Nube::clasificar(e) {
        sync::FalloEnvio::Red(_) => "Sin conexión: los pedidos web necesitan internet".into(),
        sync::FalloEnvio::Servidor(c, _) => format!("El servidor falló ({c})"),
        // El mensaje del servidor dice qué pasó: "Transición no válida"…
        sync::FalloEnvio::Rechazado(_, m) => m,
    }
}

/// Los pedidos activos del negocio, del más viejo al más nuevo.
pub fn listar(nube: &Nube) -> Result<Vec<PedidoWeb>, String> {
    let respuesta = ureq::get(&format!("{}/pos/pedidos", nube.base))
        .timeout(ESPERA)
        .set("Authorization", &format!("Bearer {}", nube.token))
        .call()
        .map_err(explicar)?;
    let lista: Lista = respuesta.into_json().map_err(|e| format!("Respuesta ilegible: {e}"))?;
    Ok(lista.pedidos)
}

/// Mueve un pedido de estado. Devuelve el error del servidor tal cual.
pub fn mover(nube: &Nube, id: &str, estado: &str) -> Result<(), String> {
    /* El id va en la ruta: que no se pueda colar nada más que un id de Mongo. */
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Ese pedido no es válido".into());
    }
    ureq::patch(&format!("{}/pos/pedidos/{id}/estado", nube.base))
        .timeout(ESPERA)
        .set("Authorization", &format!("Bearer {}", nube.token))
        .send_json(serde_json::json!({ "estado": estado }))
        .map_err(explicar)?;
    Ok(())
}

/// Cómo se llama el tipo de pedido en el papel.
fn tipo_legible(p: &PedidoWeb) -> String {
    match p.tipo.as_str() {
        "delivery" => "DOMICILIO".into(),
        "inSite" if !p.mesa.is_empty() => format!("MESA {}", p.mesa),
        "inSite" => "EN EL LOCAL".into(),
        _ => "PARA LLEVAR".into(),
    }
}

fn metodo_legible(m: &str) -> &str {
    match m {
        "cash" | "efectivo" => "Efectivo",
        "nequi" => "Nequi",
        "daviplata" => "Daviplata",
        "transfer" | "transferencia" => "Transferencia",
        "bold" => "Tarjeta (Bold)",
        "" => "Sin definir",
        otro => otro,
    }
}

fn pesos(n: i64) -> String {
    crate::Pesos(n).to_string()
}

/// La tirilla del pedido, con precios: es la que viaja con el domiciliario y
/// la que el cliente revisa al recibir.
pub fn tirilla(negocio: &str, ancho: usize, p: &PedidoWeb, ahora: &str) -> Vec<u8> {
    let mut t = escpos::Tirilla::nueva(ancho);

    t.alinear(escpos::Alineacion::Centro)
        .negrita(true)
        .linea(negocio)
        .negrita(false)
        .doble(true)
        .linea(&format!("{} #{}", tipo_legible(p), p.numero))
        .doble(false)
        .linea(ahora)
        .alinear(escpos::Alineacion::Izquierda)
        .separador();

    if !p.cliente.is_empty() {
        t.negrita(true).linea(&p.cliente).negrita(false);
    }
    if !p.telefono.is_empty() {
        t.linea(&format!("Tel: {}", p.telefono));
    }
    if !p.direccion.is_empty() {
        t.linea(&p.direccion);
    }
    t.separador();

    for it in &p.items {
        let nombre = if it.variante.is_empty() { it.nombre.clone() } else { format!("{} ({})", it.nombre, it.variante) };
        let valor = if it.regalo { "GRATIS".to_string() } else { pesos(it.precio * it.cantidad) };
        t.par(&format!("{} x{}", nombre, it.cantidad), &valor);
        for e in &it.extras {
            t.linea(&format!("   + {e}"));
        }
    }

    if !p.notas.is_empty() {
        t.separador().negrita(true).linea("NOTAS:").negrita(false).linea(&p.notas);
    }

    t.separador();
    if p.envio > 0 {
        t.par("Domicilio", &pesos(p.envio));
    }
    t.doble(true).par("TOTAL", &pesos(p.total)).doble(false);
    t.par("Pago", metodo_legible(&p.metodo_pago));
    if p.comprobante {
        t.linea("Comprobante de pago recibido");
    }

    t.salto().cortar();
    t.terminar()
}

/// La comanda: sin precios y en grande, para quien cocina.
pub fn comanda(ancho: usize, p: &PedidoWeb, ahora: &str) -> Vec<u8> {
    let mut t = escpos::Tirilla::nueva(ancho);

    t.alinear(escpos::Alineacion::Centro)
        .doble(true)
        .linea(&format!("{} #{}", tipo_legible(p), p.numero))
        .doble(false)
        .linea(ahora)
        .alinear(escpos::Alineacion::Izquierda)
        .separador();

    for it in &p.items {
        let nombre = if it.variante.is_empty() { it.nombre.clone() } else { format!("{} ({})", it.nombre, it.variante) };
        t.doble(true).linea(&format!("{} x {}", it.cantidad, nombre.to_uppercase())).doble(false);
        for e in &it.extras {
            t.linea(&format!("   + {e}"));
        }
    }
    if !p.notas.is_empty() {
        t.separador().negrita(true).linea(&p.notas).negrita(false);
    }

    t.salto().cortar_parcial();
    t.terminar()
}

#[cfg(test)]
mod pruebas {
    use super::*;

    fn pedido() -> PedidoWeb {
        serde_json::from_str(
            r#"{"id":"66f0","numero":"1042","estado":"pending","tipo":"delivery",
                "cliente":"Ana","telefono":"3001234567","direccion":"Cra 10 # 20-30",
                "notas":"Timbre dañado","metodo_pago":"cash","total":32000,"envio":4000,
                "items":[{"nombre":"Combo Go","cantidad":2,"precio":14000,"extras":["Coca-Cola"]}]}"#,
        )
        .unwrap()
    }

    fn texto(b: Vec<u8>) -> String {
        String::from_utf8_lossy(&b).to_string()
    }

    #[test]
    fn lee_lo_que_manda_el_servidor_aunque_falten_campos() {
        let p: PedidoWeb = serde_json::from_str(r#"{"id":"a","numero":"1","estado":"pending"}"#).unwrap();
        assert!(p.items.is_empty());
    }

    #[test]
    fn la_tirilla_lleva_lo_que_necesita_el_domiciliario() {
        let t = texto(tirilla("Go Burger", 42, &pedido(), "12:00"));
        for esperado in ["DOMICILIO #1042", "Ana", "3001234567", "Cra 10 # 20-30", "Coca-Cola", "Timbre", "Efectivo"] {
            assert!(t.contains(esperado), "falta {esperado}:\n{t}");
        }
    }

    #[test]
    fn la_comanda_no_lleva_precios() {
        let t = texto(comanda(42, &pedido(), "12:00"));
        assert!(t.contains("COMBO GO"));
        assert!(!t.contains("32.000") && !t.contains("TOTAL"), "la cocina no cobra:\n{t}");
    }

    #[test]
    fn una_mesa_se_llama_por_su_numero() {
        let mut p = pedido();
        p.tipo = "inSite".into();
        p.mesa = "5".into();
        assert!(texto(comanda(42, &p, "12:00")).contains("MESA 5"));
    }

    #[test]
    fn no_deja_colar_nada_por_el_id() {
        let nube = Nube { base: "http://127.0.0.1:9".into(), token: "t".into() };
        assert!(mover(&nube, "../../admin", "completed").is_err());
    }
}
