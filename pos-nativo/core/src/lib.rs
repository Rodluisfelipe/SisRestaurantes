//! Núcleo del POS nativo.
//!
//! Todo lo que tiene que estar bien aunque no haya internet, impresora ni
//! interfaz: la plata, la venta, la base local y los bytes que van a la
//! térmica. Se prueba entero con `cargo test`, sin hardware.
//!
//! La capa de Tauri (`../src-tauri`) es una cáscara: abre la ventana, expone
//! estos comandos al webview y habla con los puertos. Si mañana el POS deja de
//! ser Tauri, esto se queda igual.

pub mod auditoria;
pub mod catalogo;
pub mod clientes;
pub mod cuentas;
pub mod db;
pub mod devoluciones;
pub mod dinero;
pub mod escpos;
pub mod impuestos;
pub mod negocio;
pub mod pagos;
pub mod pausadas;
pub mod sync;
pub mod turnos;
pub mod usuarios;
pub mod venta;

pub use dinero::Pesos;
pub use venta::{registrar, total_de, ErrorVenta, LineaVenta, NuevaVenta, VentaRegistrada};
