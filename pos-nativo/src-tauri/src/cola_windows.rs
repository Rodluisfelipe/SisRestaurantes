//! Imprimir en una impresora instalada en Windows, por su nombre.
//!
//! Es como están conectadas casi todas las térmicas USB de un local: el
//! instalador del fabricante las deja como "POS-58" o "XP-80C" en la lista de
//! impresoras de Windows, y no tienen ni IP ni puerto COM. El agente de
//! impresión de MenuBy las usaba así desde siempre; la caja no podía, y un
//! negocio con una térmica USB se quedaba sin tirilla.
//!
//! Se manda en modo **RAW**: los bytes ESC/POS pasan tal cual por la cola de
//! Windows hasta la impresora, sin que el controlador los convierta en una
//! página. Es lo mismo que hace el agente.

#[cfg(windows)]
mod sistema {
    use windows_sys::Win32::Foundation::HANDLE;
    use windows_sys::Win32::Graphics::Printing::{
        ClosePrinter, EndDocPrinter, EndPagePrinter, EnumPrintersW, OpenPrinterW, StartDocPrinterW,
        StartPagePrinter, WritePrinter, DOC_INFO_1W, PRINTER_ENUM_CONNECTIONS, PRINTER_ENUM_LOCAL,
        PRINTER_INFO_4W,
    };

    fn ancho(texto: &str) -> Vec<u16> {
        texto.encode_utf16().chain(std::iter::once(0)).collect()
    }

    /// Cierra la impresora al salir, pase lo que pase en el medio.
    struct Abierta(HANDLE);
    impl Drop for Abierta {
        fn drop(&mut self) {
            unsafe { ClosePrinter(self.0) };
        }
    }

    pub fn imprimir(nombre: &str, bytes: &[u8]) -> Result<(), String> {
        let nombre_w = ancho(nombre);
        let mut manija: HANDLE = std::ptr::null_mut();
        if unsafe { OpenPrinterW(nombre_w.as_ptr(), &mut manija, std::ptr::null()) } == 0 {
            return Err(format!("Windows no encuentra la impresora \"{nombre}\""));
        }
        let impresora = Abierta(manija);

        let mut documento = ancho("MenuBy POS");
        let mut tipo = ancho("RAW");
        let info = DOC_INFO_1W {
            pDocName: documento.as_mut_ptr(),
            pOutputFile: std::ptr::null_mut(),
            pDatatype: tipo.as_mut_ptr(),
        };
        if unsafe { StartDocPrinterW(impresora.0, 1, &info) } == 0 {
            return Err(format!("La impresora \"{nombre}\" no aceptó el trabajo"));
        }
        let resultado = (|| {
            if unsafe { StartPagePrinter(impresora.0) } == 0 {
                return Err("La impresora no abrió la página".to_string());
            }
            let mut escritos: u32 = 0;
            let ok = unsafe {
                WritePrinter(impresora.0, bytes.as_ptr().cast(), bytes.len() as u32, &mut escritos)
            };
            unsafe { EndPagePrinter(impresora.0) };
            if ok == 0 || escritos as usize != bytes.len() {
                return Err(format!("Se cortó el envío a \"{nombre}\""));
            }
            Ok(())
        })();
        unsafe { EndDocPrinter(impresora.0) };
        resultado
    }

    pub fn listar() -> Vec<String> {
        let banderas = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
        let mut necesita: u32 = 0;
        let mut cuantas: u32 = 0;
        // Primera llamada: cuánto espacio hace falta.
        unsafe { EnumPrintersW(banderas, std::ptr::null(), 4, std::ptr::null_mut(), 0, &mut necesita, &mut cuantas) };
        if necesita == 0 {
            return vec![];
        }
        let mut buffer = vec![0u8; necesita as usize];
        let ok = unsafe {
            EnumPrintersW(banderas, std::ptr::null(), 4, buffer.as_mut_ptr(), necesita, &mut necesita, &mut cuantas)
        };
        if ok == 0 {
            return vec![];
        }
        let infos = unsafe {
            std::slice::from_raw_parts(buffer.as_ptr() as *const PRINTER_INFO_4W, cuantas as usize)
        };
        let mut nombres: Vec<String> = infos
            .iter()
            .filter(|i| !i.pPrinterName.is_null())
            .map(|i| unsafe {
                let mut largo = 0;
                while *i.pPrinterName.add(largo) != 0 {
                    largo += 1;
                }
                String::from_utf16_lossy(std::slice::from_raw_parts(i.pPrinterName, largo))
            })
            .collect();
        nombres.sort();
        nombres
    }
}

/// Manda los bytes a la impresora de Windows con ese nombre.
pub fn imprimir(nombre: &str, bytes: &[u8]) -> Result<(), String> {
    #[cfg(windows)]
    {
        sistema::imprimir(nombre, bytes)
    }
    #[cfg(not(windows))]
    {
        let _ = (nombre, bytes);
        Err("Las impresoras de Windows solo existen en Windows".into())
    }
}

/// Las impresoras instaladas en este equipo, por nombre.
pub fn listar() -> Vec<String> {
    #[cfg(windows)]
    {
        sistema::listar()
    }
    #[cfg(not(windows))]
    {
        vec![]
    }
}
