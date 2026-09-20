// La ventana sin consola detrás en Windows: un POS que abre una terminal negra
// al arrancar se ve roto, y el cajero la cierra y mata la app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    pos_nativo_lib::run()
}
