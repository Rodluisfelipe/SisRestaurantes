//! La configuración que llega del panel.
//!
//! Hasta ahora, cada terminal se configuraba a mano en el sitio: el nombre, el
//! tiempo de bloqueo, la impresora, el datáfono, el régimen fiscal. Con seis
//! cajas en un local eso son seis visitas cada vez que cambia algo.
//!
//! Ahora el dueño lo pone en el panel y la caja lo recoge con el catálogo, en
//! menos de treinta segundos. Tres reglas gobiernan cómo se aplica:
//!
//! 1. **Nada de lo que llega puede tumbar la sincronización.** Un campo mal
//!    escrito en el panel no puede dejar la caja sin subir ventas. Todo se
//!    deserializa con valores por defecto y lo que no se entienda se ignora.
//!
//! 2. **El hardware tiene la última palabra en el mostrador.** Si el operario
//!    cambió la IP de la impresora aquí —porque cambiaron el router del
//!    restaurante un domingo— el panel no se la vuelve a pisar. Ese cambio
//!    local apaga [`sincronizar_hardware`] y la nube deja de mandar sobre los
//!    aparatos de esa caja.
//!
//! 3. **Lo administrativo y lo fiscal sí manda la nube, siempre.** El régimen
//!    tributario, el pie de la factura o el porcentaje de propina no son
//!    decisiones del cajero: son del negocio, y un cambio en el panel tiene que
//!    llegar aunque alguien haya tocado algo en la terminal.

use serde::Deserialize;

/// Lo que manda el panel. Todo opcional, todo con valor por defecto.
///
/// Los `#[serde(default)]` no son un adorno: es lo que hace que una versión
/// vieja de la caja siga funcionando cuando el panel agregue campos, y que un
/// campo nulo no reviente el hilo de sincronización.
#[derive(Debug, Clone, Deserialize)]
pub struct ConfigRemota {
    #[serde(default)]
    pub nombre: String,
    #[serde(default = "noventa", rename = "autoBloqueoSegundos")]
    pub auto_bloqueo_segundos: u64,
    #[serde(default = "si", rename = "sonidoActivo")]
    pub sonido_activo: bool,
    #[serde(default = "si", rename = "propinaEnMesas")]
    pub propina_en_mesas: bool,
    #[serde(default = "diez", rename = "propinaSugerida")]
    pub propina_sugerida: u8,
    #[serde(default)]
    pub fiscal: Fiscal,
    #[serde(default)]
    pub hardware: Hardware,
    #[serde(default, rename = "actualizadoEn")]
    pub actualizado_en: String,
}

/* Los nombres del panel vienen en camello y los de aquí en serpiente. Se
   renombra campo por campo en vez de con un `rename_all` para que el día que
   cambie uno solo, el compilador señale exactamente cuál. */

fn noventa() -> u64 {
    90
}
fn diez() -> u8 {
    10
}
fn si() -> bool {
    true
}

#[derive(Debug, Clone, Deserialize)]
pub struct Fiscal {
    #[serde(default = "si", rename = "impuestosActivos")]
    pub impuestos_activos: bool,
    #[serde(default, rename = "regimenPrincipal")]
    pub regimen_principal: String,
    #[serde(default, rename = "categoriasIva")]
    pub categorias_iva: Vec<String>,
    #[serde(default, rename = "categoriasExentas")]
    pub categorias_exentas: Vec<String>,
    #[serde(default, rename = "textoPieFactura")]
    pub texto_pie_factura: String,
}

impl Default for Fiscal {
    fn default() -> Self {
        Fiscal {
            impuestos_activos: true,
            regimen_principal: "INC_8".into(),
            categorias_iva: Vec::new(),
            categorias_exentas: Vec::new(),
            texto_pie_factura: String::new(),
        }
    }
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct Hardware {
    #[serde(default, rename = "impresoraCaja")]
    pub impresora_caja: ImpresoraRemota,
    #[serde(default, rename = "impresoraCocina")]
    pub impresora_cocina: ImpresoraRemota,
    #[serde(default)]
    pub datafono: DatafonoRemoto,
    #[serde(default)]
    pub cajon: CajonRemoto,
    #[serde(default, rename = "pantallaCliente")]
    pub pantalla_cliente: PantallaRemota,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ImpresoraRemota {
    #[serde(default)]
    pub tipo: String,
    #[serde(default)]
    pub host: String,
    #[serde(default = "puerto_termica")]
    pub puerto: u16,
    #[serde(default)]
    pub com: String,
    #[serde(default = "baudios_por_defecto")]
    pub baudios: u32,
    #[serde(default = "ochenta", rename = "anchoMm")]
    pub ancho_mm: u32,
}

impl Default for ImpresoraRemota {
    fn default() -> Self {
        ImpresoraRemota {
            tipo: "NINGUNA".into(),
            host: String::new(),
            puerto: 9100,
            com: String::new(),
            baudios: 9600,
            ancho_mm: 80,
        }
    }
}

fn puerto_termica() -> u16 {
    9100
}
fn baudios_por_defecto() -> u32 {
    9600
}
fn ochenta() -> u32 {
    80
}

#[derive(Debug, Clone, Deserialize)]
pub struct DatafonoRemoto {
    #[serde(default)]
    pub tipo: String,
    #[serde(default)]
    pub host: String,
    #[serde(default = "puerto_termica")]
    pub puerto: u16,
    #[serde(default = "sesenta", rename = "esperaSegundos")]
    pub espera_segundos: u64,
}

impl Default for DatafonoRemoto {
    fn default() -> Self {
        DatafonoRemoto {
            tipo: "MANUAL".into(),
            host: String::new(),
            puerto: 9100,
            espera_segundos: 60,
        }
    }
}

fn sesenta() -> u64 {
    60
}

#[derive(Debug, Clone, Deserialize)]
pub struct CajonRemoto {
    #[serde(default = "si", rename = "abrirAlCobrarEfectivo")]
    pub abrir_al_cobrar: bool,
}

impl Default for CajonRemoto {
    fn default() -> Self {
        CajonRemoto { abrir_al_cobrar: true }
    }
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct PantallaRemota {
    #[serde(default, rename = "mostrarQr")]
    pub mostrar_qr: bool,
    #[serde(default, rename = "plantillaQr")]
    pub plantilla_qr: String,
}

/// ¿Manda la nube sobre los aparatos de esta caja?
///
/// Enciende de fábrica. Se apaga sola en cuanto alguien toca la configuración
/// de un periférico desde la terminal, y a partir de ahí el panel deja de
/// pisarle el hardware a esta caja.
pub fn sincronizar_hardware(base: &rusqlite::Connection) -> bool {
    let valor: String = base
        .query_row(
            "SELECT valor FROM ajustes WHERE clave = 'sincronizar_hardware'",
            [],
            |f| f.get(0),
        )
        .unwrap_or_default();

    valor != "0"
}

/// El operario tocó el hardware aquí: la nube deja de mandar sobre él.
///
/// Pasa de verdad: cambian el router del local un domingo, el técnico ajusta
/// la IP de la impresora en la caja, y el lunes un guardado cualquiera en el
/// panel se la volvería a poner mal. Quien está frente al aparato sabe más que
/// el panel sobre en qué IP responde.
pub fn soltar_del_panel(base: &rusqlite::Connection) {
    let _ = base.execute(
        "INSERT INTO ajustes (clave, valor) VALUES ('sincronizar_hardware', '0')
         ON CONFLICT(clave) DO UPDATE SET valor = '0'",
        [],
    );
}

/// Vuelve a dejar que el panel mande sobre los aparatos de esta caja.
pub fn devolver_al_panel(base: &rusqlite::Connection) {
    let _ = base.execute(
        "INSERT INTO ajustes (clave, valor) VALUES ('sincronizar_hardware', '1')
         ON CONFLICT(clave) DO UPDATE SET valor = '1'",
        [],
    );
}

/// Convierte lo que manda el panel en una impresora de las que entiende la caja.
fn como_impresora(r: &ImpresoraRemota) -> crate::perifericos::Impresora {
    match r.tipo.as_str() {
        "RED" if !r.host.trim().is_empty() => crate::perifericos::Impresora::Red {
            host: r.host.trim().to_string(),
            puerto: r.puerto,
        },
        "SERIAL" if !r.com.trim().is_empty() => crate::perifericos::Impresora::Serie {
            puerto: r.com.trim().to_string(),
            baudios: r.baudios,
        },
        /* Cualquier otra cosa —incluida una "RED" sin dirección— es ninguna.
           Una impresora mal definida que se diera por buena dejaría cada cobro
           esperando tres segundos a un aparato que no existe. */
        _ => crate::perifericos::Impresora::Ninguna,
    }
}

/// El ancho en caracteres que corresponde a los milímetros del papel.
fn ancho_en_caracteres(mm: u32) -> usize {
    if mm == 58 {
        32
    } else {
        48
    }
}

/// Qué cambió al aplicar. Sirve para decidir si hay que avisarle a la pantalla.
#[derive(Debug, Default, serde::Serialize, Clone)]
pub struct Aplicada {
    pub version: String,
    pub hardware_aplicado: bool,
}

/// Guarda la configuración del panel en los ajustes locales.
///
/// Todo en una transacción: una configuración a medias —con el régimen nuevo y
/// la impresora vieja— sería peor que no haber aplicado nada.
pub fn aplicar(
    base: &mut rusqlite::Connection,
    config: &ConfigRemota,
) -> Result<Aplicada, rusqlite::Error> {
    let manda_el_panel = sincronizar_hardware(base);
    let tx = base.transaction()?;

    {
        let poner = |clave: &str, valor: String| -> Result<(), rusqlite::Error> {
            tx.execute(
                "INSERT INTO ajustes (clave, valor) VALUES (?1, ?2)
                 ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
                rusqlite::params![clave, valor],
            )?;
            Ok(())
        };

        /* ── Operación ──────────────────────────────────────────────────── */
        if !config.nombre.trim().is_empty() {
            poner("caja_nombre", config.nombre.trim().to_string())?;
        }
        // Acotado también aquí: el panel ya lo valida, pero esta caja puede
        // estar hablando con un servidor viejo o con uno modificado.
        poner(
            "auto_bloqueo_segundos",
            config.auto_bloqueo_segundos.clamp(30, 300).to_string(),
        )?;
        poner("sonido_activo", if config.sonido_activo { "1" } else { "0" }.into())?;
        poner("propina_en_mesas", if config.propina_en_mesas { "1" } else { "0" }.into())?;
        poner("propina_sugerida", config.propina_sugerida.min(50).to_string())?;

        /* ── Fiscal ─────────────────────────────────────────────────────── */
        poner(
            "impuestos_activos",
            if config.fiscal.impuestos_activos { "1" } else { "0" }.into(),
        )?;
        poner("regimen_principal", config.fiscal.regimen_principal.clone())?;
        poner(
            "categorias_iva",
            serde_json::to_string(&config.fiscal.categorias_iva).unwrap_or_else(|_| "[]".into()),
        )?;
        poner(
            "categorias_exentas",
            serde_json::to_string(&config.fiscal.categorias_exentas).unwrap_or_else(|_| "[]".into()),
        )?;
        poner("texto_pie_factura", config.fiscal.texto_pie_factura.clone())?;

        /* ── Pantalla del cliente ───────────────────────────────────────── */
        poner("mostrar_qr", if config.hardware.pantalla_cliente.mostrar_qr { "1" } else { "0" }.into())?;
        poner("plantilla_qr", config.hardware.pantalla_cliente.plantilla_qr.clone())?;
        poner(
            "cajon_al_cobrar",
            if config.hardware.cajon.abrir_al_cobrar { "1" } else { "0" }.into(),
        )?;

        /* ── Periféricos ────────────────────────────────────────────────── */
        if manda_el_panel {
            for (rol, remota) in [
                ("caja", &config.hardware.impresora_caja),
                ("cocina", &config.hardware.impresora_cocina),
            ] {
                let local = crate::perifericos::Config {
                    impresora: como_impresora(remota),
                    ancho: ancho_en_caracteres(remota.ancho_mm),
                };
                let json = serde_json::to_string(&local).unwrap_or_default();
                poner(&format!("impresora_{rol}"), json)?;
            }

            let d = &config.hardware.datafono;
            poner("datafono_tipo", if d.tipo == "RED" { "red" } else { "manual" }.into())?;
            poner("datafono_host", d.host.trim().to_string())?;
            poner("datafono_puerto", d.puerto.to_string())?;
            poner("datafono_espera", d.espera_segundos.clamp(5, 180).to_string())?;
        }

        // Hasta dónde se aplicó. La caja no vuelve a pedir lo mismo.
        poner("config_version", config.actualizado_en.clone())?;
    }

    tx.commit()?;

    Ok(Aplicada {
        version: config.actualizado_en.clone(),
        hardware_aplicado: manda_el_panel,
    })
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use pos_core::db;

    /// El bloque tal como lo manda el panel, en camello.
    const DEL_PANEL: &str = r#"{
        "nombre": "Caja Barra",
        "autoBloqueoSegundos": 120,
        "sonidoActivo": false,
        "propinaEnMesas": true,
        "propinaSugerida": 15,
        "fiscal": {
            "impuestosActivos": true,
            "regimenPrincipal": "IVA_19",
            "categoriasIva": ["licores", "cervezas"],
            "categoriasExentas": [],
            "textoPieFactura": "Resolución DIAN 12345"
        },
        "hardware": {
            "impresoraCaja": { "tipo": "RED", "host": "192.168.1.50", "puerto": 9100, "anchoMm": 80 },
            "impresoraCocina": { "tipo": "NINGUNA" },
            "datafono": { "tipo": "RED", "host": "192.168.1.60", "puerto": 9200, "esperaSegundos": 45 },
            "cajon": { "abrirAlCobrarEfectivo": false },
            "pantallaCliente": { "mostrarQr": true, "plantillaQr": "https://pagar.co?m={monto}" }
        },
        "actualizadoEn": "2026-09-20T18:00:00.000Z"
    }"#;

    fn leer(c: &rusqlite::Connection, clave: &str) -> String {
        c.query_row("SELECT valor FROM ajustes WHERE clave = ?1", [clave], |f| f.get(0))
            .unwrap_or_default()
    }

    #[test]
    fn lo_que_manda_el_panel_queda_en_los_ajustes() {
        let mut c = db::abrir_en_memoria().unwrap();
        let config: ConfigRemota = serde_json::from_str(DEL_PANEL).unwrap();

        aplicar(&mut c, &config).unwrap();

        assert_eq!(leer(&c, "auto_bloqueo_segundos"), "120");
        assert_eq!(leer(&c, "sonido_activo"), "0");
        assert_eq!(leer(&c, "regimen_principal"), "IVA_19");
        assert_eq!(leer(&c, "texto_pie_factura"), "Resolución DIAN 12345");
        assert_eq!(leer(&c, "config_version"), "2026-09-20T18:00:00.000Z");
    }

    #[test]
    fn un_bloque_casi_vacio_no_revienta() {
        /* La regla número uno: un campo mal escrito en el panel no puede dejar
           la caja sin subir ventas. Todo cae en su valor por defecto. */
        let mut c = db::abrir_en_memoria().unwrap();
        let config: ConfigRemota = serde_json::from_str("{}").unwrap();

        aplicar(&mut c, &config).unwrap();

        assert_eq!(leer(&c, "auto_bloqueo_segundos"), "90");
        assert_eq!(leer(&c, "sonido_activo"), "1");
        assert_eq!(leer(&c, "regimen_principal"), "INC_8");
    }

    #[test]
    fn un_numero_absurdo_se_acota_aqui_tambien() {
        /* El panel ya lo valida, pero esta caja puede estar hablando con un
           servidor viejo o con uno que alguien modificó. */
        let mut c = db::abrir_en_memoria().unwrap();
        let config: ConfigRemota =
            serde_json::from_str(r#"{"autoBloqueoSegundos": 99999}"#).unwrap();

        aplicar(&mut c, &config).unwrap();

        assert_eq!(leer(&c, "auto_bloqueo_segundos"), "300");
    }

    #[test]
    fn la_impresora_de_red_del_panel_llega_a_la_caja() {
        let mut c = db::abrir_en_memoria().unwrap();
        let config: ConfigRemota = serde_json::from_str(DEL_PANEL).unwrap();

        aplicar(&mut c, &config).unwrap();

        let caja = crate::perifericos::leer_config(&c, "caja");
        assert!(matches!(
            caja.impresora,
            crate::perifericos::Impresora::Red { ref host, puerto: 9100 } if host == "192.168.1.50"
        ));
        assert_eq!(caja.ancho, 48, "80 mm son 48 caracteres");
    }

    #[test]
    fn una_impresora_de_red_sin_direccion_es_ninguna() {
        /* Darla por buena dejaría cada cobro esperando tres segundos a un
           aparato que no existe, con el cliente al frente. */
        let r = ImpresoraRemota { tipo: "RED".into(), host: "   ".into(), ..Default::default() };
        assert!(matches!(como_impresora(&r), crate::perifericos::Impresora::Ninguna));
    }

    #[test]
    fn tocar_el_hardware_en_la_caja_lo_suelta_del_panel() {
        /* El caso real: cambian el router del local un domingo, el técnico
           ajusta la IP en la terminal, y el lunes un guardado cualquiera en el
           panel se la volvería a poner mal. */
        let mut c = db::abrir_en_memoria().unwrap();
        assert!(sincronizar_hardware(&c), "de fábrica manda el panel");

        soltar_del_panel(&c);
        assert!(!sincronizar_hardware(&c));

        let config: ConfigRemota = serde_json::from_str(DEL_PANEL).unwrap();
        let r = aplicar(&mut c, &config).unwrap();

        assert!(!r.hardware_aplicado);
        let caja = crate::perifericos::leer_config(&c, "caja");
        assert!(
            matches!(caja.impresora, crate::perifericos::Impresora::Ninguna),
            "el panel no le pisó la impresora",
        );
    }

    #[test]
    fn lo_fiscal_llega_aunque_el_hardware_este_suelto() {
        /* El régimen tributario no es decisión del cajero: es del negocio, y
           un cambio en el panel tiene que llegar aunque alguien haya tocado un
           aparato en la terminal. */
        let mut c = db::abrir_en_memoria().unwrap();
        soltar_del_panel(&c);

        let config: ConfigRemota = serde_json::from_str(DEL_PANEL).unwrap();
        aplicar(&mut c, &config).unwrap();

        assert_eq!(leer(&c, "regimen_principal"), "IVA_19");
        assert_eq!(leer(&c, "texto_pie_factura"), "Resolución DIAN 12345");
    }

    #[test]
    fn se_puede_devolver_el_mando_al_panel() {
        let c = db::abrir_en_memoria().unwrap();
        soltar_del_panel(&c);
        devolver_al_panel(&c);
        assert!(sincronizar_hardware(&c));
    }

    #[test]
    fn un_campo_que_el_panel_no_conoce_todavia_no_estorba() {
        /* Al revés que el caso anterior: el panel manda un campo que esta
           versión de la caja no conoce. Tiene que ignorarlo, no fallar. */
        let config: Result<ConfigRemota, _> =
            serde_json::from_str(r#"{"autoBloqueoSegundos": 60, "algoDelFuturo": {"x": 1}}"#);

        assert!(config.is_ok());
        assert_eq!(config.unwrap().auto_bloqueo_segundos, 60);
    }
}
