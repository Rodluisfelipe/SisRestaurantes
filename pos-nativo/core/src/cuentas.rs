//! Cuentas abiertas: la mesa que pide en tandas y paga al final.
//!
//! Se apoya en la misma tabla que las ventas en espera, porque son la misma
//! idea —un carrito en disco que todavía no se cobró— con una diferencia: la
//! cuenta crece. El cliente pide una entrada, después el plato fuerte, después
//! el postre, y cada ronda tiene que bajar a la cocina **sin volver a mandar lo
//! anterior**.
//!
//! Esa es toda la dificultad de este módulo y está en una sola función,
//! [`nuevos_para_cocina`]: comparar lo que hay contra lo que ya se mandó. Si se
//! equivoca de más, la mesa recibe dos veces el mismo plato y el negocio paga
//! el ingrediente; si se equivoca de menos, el cliente espera un plato que
//! nadie está cocinando.
//!
//! Igual que las pausadas: **no toca inventario y no entra a la cola**. Una
//! mesa que lleva una hora pidiendo todavía no vendió nada. Lo que la nube
//! recibe es la venta del final, una sola vez, cuando se cobra.

use crate::venta::LineaVenta;
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Una cuenta abierta, tal como se ve en el tablero de mesas.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cuenta {
    pub id: String,
    pub turno_id: String,
    /// "Mesa 3", "Barra 1". Es lo que el mesero dice en voz alta.
    pub identificador: String,
    pub total: i64,
    pub items: i64,
    pub creada_en: String,
    pub actualizada_en: String,
    /// El pedido completo, tal como está.
    pub carrito: String,
}

/// Cómo se reconoce una línea entre dos rondas.
///
/// Incluye la nota a propósito: "hamburguesa sin cebolla" y "hamburguesa" son
/// dos platos distintos para la cocina, y sumarlos haría que el segundo no se
/// imprimiera nunca.
fn llave(l: &LineaVenta) -> (String, String, String) {
    (l.producto_id.clone(), l.variante.clone(), l.nota.clone())
}

/// Lo que hay que mandar a la cocina y no se ha mandado.
///
/// Se compara por cantidad y no por presencia: una mesa que pide otra cerveza
/// no agrega una línea, sube la que ya tenía de 1 a 2, y lo que baja a la
/// cocina es *una* cerveza.
///
/// Una cantidad que **baja** no devuelve nada. Quitar algo ya comandado no se
/// resuelve imprimiendo: el plato puede estar en la plancha, y eso se habla con
/// la cocina, no se le manda en papel.
pub fn nuevos_para_cocina(comandado: &[LineaVenta], actual: &[LineaVenta]) -> Vec<LineaVenta> {
    let mut nuevos = Vec::new();

    for linea in actual {
        let ya = comandado
            .iter()
            .filter(|c| llave(c) == llave(linea))
            .map(|c| c.cantidad)
            .sum::<i64>();

        let faltan = linea.cantidad - ya;
        if faltan > 0 {
            nuevos.push(LineaVenta { cantidad: faltan, ..linea.clone() });
        }
    }

    nuevos
}

/// Abre la cuenta o le agrega lo que llegó.
///
/// Devuelve la cuenta y **lo que falta mandar a la cocina**, sin marcarlo como
/// mandado: eso lo hace [`marcar_comandado`] cuando el papel salió de verdad.
/// Separarlo en dos pasos es lo que evita que una impresora sin papel deje a la
/// cocina sin enterarse de una ronda que el sistema ya dio por enviada.
#[allow(clippy::too_many_arguments)]
pub fn guardar(
    conexion: &Connection,
    turno_id: &str,
    identificador: &str,
    carrito_json: &str,
    total: i64,
    items: i64,
    ahora: &str,
) -> Result<(Cuenta, Vec<LineaVenta>)> {
    let existente = por_identificador(conexion, turno_id, identificador)?;

    let id = match &existente {
        Some(c) => c.id.clone(),
        None => Uuid::now_v7().to_string(),
    };
    let creada_en = match &existente {
        Some(c) => c.creada_en.clone(),
        None => ahora.to_string(),
    };

    let comandado: Vec<LineaVenta> = match &existente {
        Some(c) => leer_comandado(conexion, &c.id)?,
        None => Vec::new(),
    };
    let actual: Vec<LineaVenta> = serde_json::from_str(carrito_json).unwrap_or_default();
    let pendientes = nuevos_para_cocina(&comandado, &actual);

    if existente.is_some() {
        conexion.execute(
            "UPDATE ventas_pausadas
             SET carrito = ?1, total = ?2, items = ?3, etiqueta = ?4, actualizada_en = ?5
             WHERE id = ?6",
            params![carrito_json, total, items, identificador, ahora, id],
        )?;
    } else {
        conexion.execute(
            "INSERT INTO ventas_pausadas
                (id, turno_id, etiqueta, total, items, carrito, creada_en, identificador, comandado, actualizada_en)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?3, '[]', ?7)",
            params![id, turno_id, identificador, total, items, carrito_json, ahora],
        )?;
    }

    Ok((
        Cuenta {
            id,
            turno_id: turno_id.to_string(),
            identificador: identificador.to_string(),
            total,
            items,
            creada_en,
            actualizada_en: ahora.to_string(),
            carrito: carrito_json.to_string(),
        },
        pendientes,
    ))
}

/// Deja constancia de que la cocina ya recibió esto.
///
/// Se llama **después** de que la impresora respondió. Al revés, una impresora
/// sin papel dejaría la ronda marcada como enviada y esos platos no se
/// cocinarían nunca.
pub fn marcar_comandado(conexion: &Connection, id: &str, carrito_json: &str) -> Result<()> {
    conexion.execute(
        "UPDATE ventas_pausadas SET comandado = ?1 WHERE id = ?2",
        params![carrito_json, id],
    )?;
    Ok(())
}

/// Lo que ya se mandó a la cocina de esta cuenta.
pub fn leer_comandado(conexion: &Connection, id: &str) -> Result<Vec<LineaVenta>> {
    let crudo: String = conexion
        .query_row("SELECT comandado FROM ventas_pausadas WHERE id = ?1", [id], |f| f.get(0))
        .unwrap_or_else(|_| "[]".to_string());
    Ok(serde_json::from_str(&crudo).unwrap_or_default())
}

/// Las cuentas abiertas del turno, la más vieja primero.
///
/// La que lleva más tiempo sentada es la que hay que mirar: o está esperando la
/// cuenta, o se fue sin pagar.
pub fn listar(conexion: &Connection, turno_id: &str) -> Result<Vec<Cuenta>> {
    let mut consulta = conexion.prepare(
        "SELECT id, turno_id, identificador, total, items, carrito, creada_en, actualizada_en
         FROM ventas_pausadas
         WHERE turno_id = ?1 AND identificador != ''
         ORDER BY creada_en",
    )?;
    let filas = consulta.query_map([turno_id], |f| {
        Ok(Cuenta {
            id: f.get(0)?,
            turno_id: f.get(1)?,
            identificador: f.get(2)?,
            total: f.get(3)?,
            items: f.get(4)?,
            carrito: f.get(5)?,
            creada_en: f.get(6)?,
            actualizada_en: f.get(7)?,
        })
    })?;
    filas.collect()
}

/// Una cuenta por su nombre de mesa, dentro del turno.
pub fn por_identificador(
    conexion: &Connection,
    turno_id: &str,
    identificador: &str,
) -> Result<Option<Cuenta>> {
    let mut consulta = conexion.prepare(
        "SELECT id, turno_id, identificador, total, items, carrito, creada_en, actualizada_en
         FROM ventas_pausadas
         WHERE turno_id = ?1 AND identificador = ?2",
    )?;
    let mut filas = consulta.query_map(params![turno_id, identificador], |f| {
        Ok(Cuenta {
            id: f.get(0)?,
            turno_id: f.get(1)?,
            identificador: f.get(2)?,
            total: f.get(3)?,
            items: f.get(4)?,
            carrito: f.get(5)?,
            creada_en: f.get(6)?,
            actualizada_en: f.get(7)?,
        })
    })?;

    filas.next().transpose()
}

/// Una cuenta por su id.
pub fn por_id(conexion: &Connection, id: &str) -> Result<Option<Cuenta>> {
    let mut consulta = conexion.prepare(
        "SELECT id, turno_id, identificador, total, items, carrito, creada_en, actualizada_en
         FROM ventas_pausadas WHERE id = ?1",
    )?;
    let mut filas = consulta.query_map([id], |f| {
        Ok(Cuenta {
            id: f.get(0)?,
            turno_id: f.get(1)?,
            identificador: f.get(2)?,
            total: f.get(3)?,
            items: f.get(4)?,
            carrito: f.get(5)?,
            creada_en: f.get(6)?,
            actualizada_en: f.get(7)?,
        })
    })?;

    filas.next().transpose()
}

/// Pasa al turno nuevo las mesas que quedaron abiertas del anterior.
///
/// Es el relevo de las seis de la tarde: el cajero del día se va, seis mesas
/// siguen comiendo, y el de la noche tiene que encontrarlas en su tablero.
///
/// Se re-apuntan al turno entrante y no se dejan huérfanas porque el turno es
/// quien responde por ellas: la venta de esa mesa se le imputa a quien
/// **cobre** el dinero, que es quien lo va a tener en su gaveta al cerrar. Si
/// se quedaran con el turno viejo, el arqueo de la noche saldría corto por
/// todo lo que esas mesas consumieron.
///
/// Devuelve cuántas se recibieron, para poder decírselo al cajero que entra.
pub fn traspasar(conexion: &Connection, turno_nuevo: &str) -> Result<usize> {
    let cuantas = conexion.execute(
        "UPDATE ventas_pausadas
         SET turno_id = ?1
         WHERE identificador != ''
           AND turno_id != ?1
           AND turno_id IN (SELECT id FROM turnos WHERE estado != 'ABIERTO')",
        [turno_nuevo],
    )?;
    Ok(cuantas)
}

/// Cierra la cuenta. Se llama cuando la venta ya quedó registrada.
pub fn cerrar(conexion: &Connection, id: &str) -> Result<()> {
    conexion.execute("DELETE FROM ventas_pausadas WHERE id = ?1", [id])?;
    Ok(())
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use crate::db;
    use crate::dinero::Pesos;

    const AHORA: &str = "2026-09-20T12:00:00-05:00";

    fn linea(nombre: &str, cantidad: i64) -> LineaVenta {
        LineaVenta {
            producto_id: format!("p-{nombre}"),
            nombre: nombre.to_string(),
            variante: String::new(),
            precio: Pesos(10_000),
            cantidad,
            nota: String::new(),
            extras: vec![],
        }
    }

    fn json(items: &[LineaVenta]) -> String {
        serde_json::to_string(items).unwrap()
    }

    mod lo_que_baja_a_la_cocina {
        use super::*;

        #[test]
        fn la_primera_ronda_baja_entera() {
            let actual = vec![linea("Sopa", 2), linea("Arroz", 1)];
            let nuevos = nuevos_para_cocina(&[], &actual);

            assert_eq!(nuevos.len(), 2);
            assert_eq!(nuevos[0].cantidad, 2);
        }

        #[test]
        fn lo_que_ya_se_mando_no_vuelve_a_bajar() {
            /* El error que arruina el servicio: la mesa pide un postre y la
               cocina vuelve a recibir la entrada, el plato fuerte y el postre. */
            let comandado = vec![linea("Sopa", 2), linea("Arroz", 1)];
            let actual = vec![linea("Sopa", 2), linea("Arroz", 1), linea("Postre", 1)];

            let nuevos = nuevos_para_cocina(&comandado, &actual);

            assert_eq!(nuevos.len(), 1);
            assert_eq!(nuevos[0].nombre, "Postre");
        }

        #[test]
        fn pedir_otra_cerveza_baja_una_sola() {
            /* No se agrega una línea: sube la que había de 1 a 2. Si se
               comparara por presencia y no por cantidad, esa segunda cerveza no
               llegaría nunca a la barra. */
            let comandado = vec![linea("Cerveza", 1)];
            let actual = vec![linea("Cerveza", 3)];

            let nuevos = nuevos_para_cocina(&comandado, &actual);

            assert_eq!(nuevos.len(), 1);
            assert_eq!(nuevos[0].cantidad, 2, "solo las dos que faltan");
        }

        #[test]
        fn quitar_algo_ya_comandado_no_imprime_nada() {
            /* El plato puede estar en la plancha. Eso se habla con la cocina,
               no se le manda un papel con cantidades negativas. */
            let comandado = vec![linea("Sopa", 3)];
            let actual = vec![linea("Sopa", 1)];

            assert!(nuevos_para_cocina(&comandado, &actual).is_empty());
        }

        #[test]
        fn el_mismo_plato_con_notas_distintas_son_dos_platos() {
            /* Para la cocina, "sin cebolla" es otro plato. Si se sumaran, el
               segundo comensal recibiría el plato del primero. */
            let mut sin_cebolla = linea("Hamburguesa", 1);
            sin_cebolla.nota = "Sin cebolla".into();

            let comandado = vec![linea("Hamburguesa", 1)];
            let actual = vec![linea("Hamburguesa", 1), sin_cebolla];

            let nuevos = nuevos_para_cocina(&comandado, &actual);

            assert_eq!(nuevos.len(), 1);
            assert_eq!(nuevos[0].nota, "Sin cebolla");
        }

        #[test]
        fn sin_cambios_no_baja_nada() {
            // Guardar la cuenta sin agregar nada no puede despertar a la cocina.
            let items = vec![linea("Sopa", 2)];
            assert!(nuevos_para_cocina(&items, &items).is_empty());
        }
    }

    #[test]
    fn la_segunda_ronda_solo_manda_lo_nuevo() {
        let c = db::abrir_en_memoria().unwrap();

        let primera = vec![linea("Sopa", 1)];
        let (cuenta, nuevos) = guardar(&c, "t1", "Mesa 3", &json(&primera), 10_000, 1, AHORA).unwrap();
        assert_eq!(nuevos.len(), 1);
        marcar_comandado(&c, &cuenta.id, &json(&primera)).unwrap();

        let segunda = vec![linea("Sopa", 1), linea("Postre", 1)];
        let (_, nuevos) = guardar(&c, "t1", "Mesa 3", &json(&segunda), 20_000, 2, AHORA).unwrap();

        assert_eq!(nuevos.len(), 1);
        assert_eq!(nuevos[0].nombre, "Postre");
    }

    #[test]
    fn una_mesa_es_una_sola_cuenta() {
        // Dos cuentas con el mismo nombre serían dos cuentas que el mesero cree
        // que son una, y una de las dos se iría sin cobrar.
        let c = db::abrir_en_memoria().unwrap();

        guardar(&c, "t1", "Mesa 3", &json(&[linea("Sopa", 1)]), 10_000, 1, AHORA).unwrap();
        guardar(&c, "t1", "Mesa 3", &json(&[linea("Sopa", 2)]), 20_000, 2, AHORA).unwrap();

        assert_eq!(listar(&c, "t1").unwrap().len(), 1);
    }

    #[test]
    fn la_cuenta_sobrevive_al_corte_de_luz_sin_duplicar_la_comanda() {
        /* La prueba que justifica que \`comandado\` esté en disco: si viviera en
           memoria, al volver la luz la mesa recibiría otra vez toda su comida. */
        let c = db::abrir_en_memoria().unwrap();
        let items = vec![linea("Sopa", 1), linea("Arroz", 2)];

        let (cuenta, _) = guardar(&c, "t1", "Mesa 3", &json(&items), 30_000, 3, AHORA).unwrap();
        marcar_comandado(&c, &cuenta.id, &json(&items)).unwrap();

        // Se relee de la base, como haría la app al arrancar de nuevo.
        let comandado = leer_comandado(&c, &cuenta.id).unwrap();
        assert!(nuevos_para_cocina(&comandado, &items).is_empty());
    }

    #[test]
    fn si_la_impresora_falla_la_ronda_sigue_pendiente() {
        /* No marcar es lo que permite reintentar. Si se marcara antes de
           imprimir, esos platos no se cocinarían nunca y nadie sabría por qué. */
        let c = db::abrir_en_memoria().unwrap();
        let items = vec![linea("Sopa", 1)];

        let (cuenta, _) = guardar(&c, "t1", "Mesa 3", &json(&items), 10_000, 1, AHORA).unwrap();
        // Aquí falló la impresora: no se llama a marcar_comandado.

        let (_, otra_vez) = guardar(&c, "t1", "Mesa 3", &json(&items), 10_000, 1, AHORA).unwrap();
        assert_eq!(otra_vez.len(), 1, "sigue pendiente de bajar a cocina");
        assert_eq!(cuenta.identificador, "Mesa 3");
    }

    #[test]
    fn una_cuenta_abierta_no_entra_a_la_cola_de_la_nube() {
        // Una mesa que lleva una hora pidiendo todavía no vendió nada.
        let c = db::abrir_en_memoria().unwrap();
        guardar(&c, "t1", "Mesa 3", &json(&[linea("Sopa", 1)]), 10_000, 1, AHORA).unwrap();

        let encoladas: i64 = c.query_row("SELECT COUNT(*) FROM outbox", [], |f| f.get(0)).unwrap();
        assert_eq!(encoladas, 0);
    }

    #[test]
    fn las_cuentas_no_se_mezclan_con_las_ventas_en_espera() {
        /* El mostrador y el salón comparten tabla pero no lista: una venta
           apartada de mostrador no es una mesa y no puede aparecer en el
           tablero.

           Y al cerrar turno tampoco pesan igual. Una venta apartada de
           mostrador es un carrito que nadie va a reclamar y hay que resolverla
           antes de irse; una mesa con gente sentada no. Contar las dos —que
           es como estaba— dejaba a un restaurante sin poder cerrar turno a las
           seis de la tarde. */
        let c = db::abrir_en_memoria().unwrap();

        crate::pausadas::pausar(&c, "t1", "[]", "Café +2", 5_000, 1, AHORA).unwrap();
        guardar(&c, "t1", "Mesa 3", &json(&[linea("Sopa", 1)]), 10_000, 1, AHORA).unwrap();

        assert_eq!(listar(&c, "t1").unwrap().len(), 1, "solo la mesa en el tablero");
        assert_eq!(
            crate::pausadas::cuantas(&c, "t1").unwrap(),
            1,
            "el cierre solo se traba con la de mostrador",
        );
    }

    #[test]
    fn el_turno_cierra_aunque_queden_mesas_comiendo() {
        /* El relevo de las seis de la tarde. Sin esto, el cajero del día no se
           puede ir a su casa hasta que se vacíe el salón. */
        let mut c = db::abrir_en_memoria().unwrap();
        let t = crate::turnos::abrir(&c, "u1", "Ana", Pesos(100_000), AHORA).unwrap();

        guardar(&c, &t.id, "Mesa 3", &json(&[linea("Sopa", 1)]), 10_000, 1, AHORA).unwrap();
        guardar(&c, &t.id, "Mesa 5", &json(&[linea("Arroz", 2)]), 20_000, 2, AHORA).unwrap();

        assert!(crate::turnos::cerrar(&mut c, Pesos(100_000), AHORA).is_ok());
    }

    #[test]
    fn el_turno_que_entra_recibe_las_mesas_del_que_sale() {
        /* Y tienen que aparecer en **su** tablero: si se quedaran con el turno
           viejo, el cajero de la noche abriría una pantalla vacía con seis
           mesas comiendo en el salón, y al cobrarlas esa plata se le imputaría
           a un turno ya cerrado. */
        let mut c = db::abrir_en_memoria().unwrap();
        let dia = crate::turnos::abrir(&c, "u1", "Ana", Pesos(100_000), AHORA).unwrap();

        guardar(&c, &dia.id, "Mesa 3", &json(&[linea("Sopa", 1)]), 10_000, 1, AHORA).unwrap();
        crate::turnos::cerrar(&mut c, Pesos(100_000), AHORA).unwrap();

        /* Entre cerrar y abrir, la mesa sigue apuntando al turno viejo: el
           traspaso ocurre cuando alguien entra a hacerse cargo, no cuando el
           anterior se va. Es lo correcto —una mesa sin turno no tendría a
           quién imputarle la venta— y por eso se comprueba después. */
        let noche = crate::turnos::abrir(&c, "u2", "Luis", Pesos(100_000), AHORA).unwrap();

        assert!(
            listar(&c, &dia.id).unwrap().is_empty(),
            "el turno que se fue ya no responde por ellas",
        );

        let recibidas = listar(&c, &noche.id).unwrap();
        assert_eq!(recibidas.len(), 1);
        assert_eq!(recibidas[0].identificador, "Mesa 3");
    }

    #[test]
    fn el_traspaso_no_toca_las_mesas_del_turno_abierto() {
        /* Abrir un turno no puede robarle las mesas a otro que siga vivo. No
           pasa hoy —no se permiten dos turnos abiertos— pero es la clase de
           cosa que se rompe el día que se permita multicaja. */
        let c = db::abrir_en_memoria().unwrap();
        let t = crate::turnos::abrir(&c, "u1", "Ana", Pesos(100_000), AHORA).unwrap();

        guardar(&c, &t.id, "Mesa 3", &json(&[linea("Sopa", 1)]), 10_000, 1, AHORA).unwrap();

        assert_eq!(traspasar(&c, "otro-turno").unwrap(), 0);
        assert_eq!(listar(&c, &t.id).unwrap().len(), 1);
    }

    #[test]
    fn cerrar_la_saca_del_tablero() {
        let c = db::abrir_en_memoria().unwrap();
        let (cuenta, _) = guardar(&c, "t1", "Mesa 3", &json(&[linea("Sopa", 1)]), 10_000, 1, AHORA).unwrap();

        cerrar(&c, &cuenta.id).unwrap();

        assert!(listar(&c, "t1").unwrap().is_empty());
        assert!(por_id(&c, &cuenta.id).unwrap().is_none());
    }
}
