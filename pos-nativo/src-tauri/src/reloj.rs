//! La hora de la caja, cuando no se puede confiar en el equipo.
//!
//! Una terminal de mostrador lleva años ensamblada y su pila CR2032 se agota.
//! Si el local corta la corriente desde la llave general al cerrar, la máquina
//! arranca al día siguiente en **1970**.
//!
//! Con la hora del sistema a secas, todas las ventas de esa mañana se estampan
//! en 1970: los informes del negocio quedan destrozados, los turnos no cuadran
//! con ninguna jornada y los UUIDv7 —que llevan el instante dentro— dejan de
//! estar ordenados.
//!
//! La corrección es un desfase, no un reemplazo. Cada respuesta del servidor
//! trae una cabecera `Date`; de ahí sale cuánto está corrido este equipo, y ese
//! número se le suma a la hora local de ahí en adelante.
//!
//! **Por qué un desfase y no la hora del servidor tal cual:** entre dos
//! sincronizaciones pasan minutos, y durante esos minutos la caja sigue
//! vendiendo sin internet. Lo que tiene que seguir avanzando es el reloj del
//! equipo —que avanza bien aunque arranque mal— corregido por una constante.

use std::sync::atomic::{AtomicI64, Ordering};

/// Cuánto hay que sumarle a la hora de este equipo, en segundos.
///
/// Atómico y global porque lo escribe el hilo de sincronización y lo leen el
/// hilo de la interfaz y el de fondo, cada uno cuando cobra o imprime.
static DESFASE: AtomicI64 = AtomicI64::new(0);

/// A partir de cuánta diferencia se considera que el equipo está mal.
///
/// Dos minutos. Por debajo es la deriva normal de cualquier reloj y corregirla
/// solo movería las marcas de tiempo sin ganar nada; por encima es una pila
/// agotada, una zona horaria mal puesta o alguien que cambió la hora a mano.
const TOLERANCIA_SEGUNDOS: i64 = 120;

/// Ajusta el reloj con la hora que dijo el servidor.
///
/// Devuelve `true` si había que corregir algo, para poder dejarlo en el registro:
/// una caja que se corrige sola todos los días tiene una pila que cambiar.
pub fn sincronizar(epoch_servidor: i64) -> bool {
    if epoch_servidor <= 0 {
        return false;
    }

    let local = time::OffsetDateTime::now_utc().unix_timestamp();
    let diferencia = epoch_servidor - local;

    if diferencia.abs() <= TOLERANCIA_SEGUNDOS {
        // El equipo va bien. Se limpia cualquier desfase viejo.
        DESFASE.store(0, Ordering::Relaxed);
        return false;
    }

    DESFASE.store(diferencia, Ordering::Relaxed);
    true
}

/// Qué hora es de verdad, en formato RFC 3339 con la zona del equipo.
///
/// Es la que se estampa en cada venta, cada turno y cada UUIDv7.
pub fn ahora() -> String {
    let desfase = DESFASE.load(Ordering::Relaxed);

    let base = time::OffsetDateTime::now_local()
        .unwrap_or_else(|_| time::OffsetDateTime::now_utc());

    let corregida = base + time::Duration::seconds(desfase);

    corregida
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default()
}

/// El instante corregido en segundos, para la espera de la cola.
pub fn ahora_epoch() -> i64 {
    time::OffsetDateTime::now_utc().unix_timestamp() + DESFASE.load(Ordering::Relaxed)
}

/// Cuánto está corrido este equipo. Cero = va bien.
pub fn desfase_segundos() -> i64 {
    DESFASE.load(Ordering::Relaxed)
}

/// Lee la cabecera `Date` de una respuesta HTTP y la pasa a epoch.
///
/// El formato es el de siempre en HTTP: `Sun, 20 Sep 2026 17:04:05 GMT`.
/// Si no se entiende, se devuelve `None` y el reloj se queda como estaba:
/// una cabecera rara no puede mover la hora de las ventas.
pub fn epoch_de_cabecera(date: &str) -> Option<i64> {
    let formato = time::format_description::well_known::Rfc2822;
    // HTTP escribe "GMT" donde el RFC 2822 espera un desfase numérico.
    let normalizada = date.trim().replace("GMT", "+0000");

    time::OffsetDateTime::parse(&normalizada, &formato)
        .ok()
        .map(|f| f.unix_timestamp())
}

#[cfg(test)]
mod pruebas {
    use super::*;

    /// Las pruebas comparten el desfase global, así que cada una lo limpia.
    fn limpio() {
        DESFASE.store(0, Ordering::Relaxed);
    }

    #[test]
    fn un_equipo_en_hora_no_se_toca() {
        limpio();
        let ahora = time::OffsetDateTime::now_utc().unix_timestamp();

        assert!(!sincronizar(ahora + 5), "cinco segundos es deriva normal");
        assert_eq!(desfase_segundos(), 0);
    }

    #[test]
    fn una_pila_agotada_se_corrige() {
        /* El caso real: el equipo arranca en 1970 y el servidor dice que
           estamos en 2026. Sin esto, las ventas de la mañana se estampan
           cincuenta y seis años atrás. */
        limpio();
        let real = time::OffsetDateTime::now_utc().unix_timestamp();
        let local = time::OffsetDateTime::now_utc().unix_timestamp();

        assert!(sincronizar(real + 1_000_000));
        assert!(desfase_segundos() > 900_000);

        // Y la hora que se estampa ya viene corregida.
        let corregido = ahora_epoch();
        assert!(corregido > local + 900_000);
        limpio();
    }

    #[test]
    fn un_equipo_adelantado_tambien() {
        // Pasa cuando alguien cambia la hora a mano para "arreglar" algo.
        limpio();
        let ahora = time::OffsetDateTime::now_utc().unix_timestamp();

        assert!(sincronizar(ahora - 3_600));
        assert!(desfase_segundos() < -3_000);
        limpio();
    }

    #[test]
    fn volver_a_estar_en_hora_borra_la_correccion() {
        /* Cuando cambian la pila, la caja tiene que dejar de corregir. Si el
           desfase se quedara pegado, el equipo arreglado empezaría a estampar
           mal por la corrección vieja. */
        limpio();
        let ahora = time::OffsetDateTime::now_utc().unix_timestamp();

        sincronizar(ahora + 500_000);
        assert!(desfase_segundos() != 0);

        assert!(!sincronizar(time::OffsetDateTime::now_utc().unix_timestamp()));
        assert_eq!(desfase_segundos(), 0);
    }

    #[test]
    fn una_hora_imposible_del_servidor_se_ignora() {
        // Un proxy que devuelve basura no puede mover la hora de las ventas.
        limpio();
        assert!(!sincronizar(0));
        assert!(!sincronizar(-1));
        assert_eq!(desfase_segundos(), 0);
    }

    #[test]
    fn se_entiende_la_cabecera_date_de_http() {
        let epoch = epoch_de_cabecera("Sun, 20 Sep 2026 17:04:05 GMT").unwrap();

        // 2026-09-20T17:04:05Z
        assert_eq!(epoch, 1_789_923_845);
    }

    #[test]
    fn una_cabecera_ilegible_no_mueve_nada() {
        assert!(epoch_de_cabecera("").is_none());
        assert!(epoch_de_cabecera("ayer por la tarde").is_none());
    }
}
