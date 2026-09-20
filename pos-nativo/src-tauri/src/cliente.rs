//! La pantalla que mira el cliente.
//!
//! Una segunda ventana, sin bordes, en el monitor que da al mostrador. No es
//! decoración: es lo que evita la discusión de "yo no pedí eso" y "¿cuánto era?"
//! con la fila esperando, y lo que hace que el cliente vea su cambio antes de
//! que el cajero se lo cuente.
//!
//! Tres decisiones que la hacen funcionar en un mostrador real:
//!
//! 1. **Es la misma app, no otro programa.** Carga el mismo bundle con
//!    `#cliente` en la URL. Nada que instalar aparte, nada que actualizar por
//!    separado, y comparte los mismos estilos.
//! 2. **Se abre en el otro monitor, no en el principal.** Si hay un solo
//!    monitor, no se abre: superponerla sobre la caja dejaría al cajero sin
//!    poder trabajar, que es exactamente lo contrario de lo que se busca.
//! 3. **Si algo falla, la caja sigue.** Que no haya segunda pantalla nunca
//!    puede impedir cobrar.

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

pub const ETIQUETA: &str = "cliente";

/// Abre (o trae al frente) la pantalla del cliente.
///
/// Devuelve un aviso legible cuando no se pudo: es información para la pantalla
/// de configuración, no un error que deba tumbar nada.
pub fn abrir(app: &AppHandle) -> Result<(), String> {
    if let Some(ventana) = app.get_webview_window(ETIQUETA) {
        let _ = ventana.show();
        let _ = ventana.set_focus();
        return Ok(());
    }

    let monitores = app.available_monitors().map_err(|e| e.to_string())?;
    if monitores.len() < 2 {
        return Err("No hay una segunda pantalla conectada".into());
    }

    /* El monitor del cliente es el que no es el principal. Con más de dos, se
       toma el primero que no sea principal: elegir entre tres pantallas es una
       preferencia que se configura, no algo que adivinar. */
    let principal = app.primary_monitor().ok().flatten();
    let destino = monitores
        .iter()
        .find(|m| match &principal {
            Some(p) => m.position() != p.position(),
            None => true,
        })
        .unwrap_or(&monitores[0]);

    let posicion = *destino.position();
    let tamano = *destino.size();

    WebviewWindowBuilder::new(app, ETIQUETA, WebviewUrl::App("index.html#cliente".into()))
        .title("MenuBy POS · Cliente")
        // Sin bordes ni barra: el cliente no tiene por qué poder cerrarla.
        .decorations(false)
        .resizable(false)
        // No roba el foco: el cajero sigue escribiendo en la caja.
        .focused(false)
        .skip_taskbar(true)
        .position(posicion.x as f64, posicion.y as f64)
        .inner_size(tamano.width as f64, tamano.height as f64)
        .build()
        .map_err(|e| format!("No se pudo abrir la pantalla del cliente: {e}"))?;

    Ok(())
}

pub fn cerrar(app: &AppHandle) {
    if let Some(ventana) = app.get_webview_window(ETIQUETA) {
        let _ = ventana.close();
    }
}

pub fn esta_abierta(app: &AppHandle) -> bool {
    app.get_webview_window(ETIQUETA).is_some()
}
