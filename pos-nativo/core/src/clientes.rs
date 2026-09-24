//! Los clientes del negocio, replicados en la terminal.
//!
//! El programa de fidelización le prometió al cliente que sus compras suman.
//! Hoy esa promesa depende de que haya internet en el segundo en que el cajero
//! cobra —y en un local de barrio no siempre lo hay—. Cuando la señal se cae,
//! el cliente pierde los puntos de esa compra y quien da la cara es el cajero.
//!
//! Con esta copia local la caja busca y ofrece sola. La nube se entera después.
//!
//! **Es caché, no es la verdad.** La verdad vive en la nube. De aquí nada se
//! envía de vuelta como si fuera nuevo, y la tabla entera se puede borrar sin
//! perder un dato del negocio: se vuelve a bajar. Por eso los puntos que
//! muestra son "los que la nube dijo la última vez", y el canje se confirma
//! contra el servidor: el descuento atómico vive allá porque dos terminales
//! pueden redimir al mismo cliente en el mismo segundo y solo una puede ganar.

use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Un cliente, tal como baja de la nube.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilaCliente {
    pub id: String,
    #[serde(default)]
    pub documento: String,
    #[serde(default = "cedula")]
    pub tipo_documento: String,
    #[serde(default)]
    pub telefono: String,
    #[serde(default)]
    pub nombre: String,
    #[serde(default)]
    pub puntos: i64,
    #[serde(default)]
    pub saldo_favor: i64,
    #[serde(default = "activo")]
    pub estado: String,
    /// La fecha del cambio en la nube: es lo que alimenta la marca de agua.
    #[serde(default)]
    pub actualizado: String,
    /// Si se le puede fiar. Ver `credito`.
    #[serde(default)]
    pub credito_habilitado: bool,
    /// Hasta cuánto se le fía.
    #[serde(default)]
    pub cupo: i64,
    /// Lo que debe ahora.
    #[serde(default)]
    pub saldo_credito: i64,
}

/// Una recompensa canjeable.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilaRecompensa {
    pub id: String,
    pub nombre: String,
    #[serde(default)]
    pub tipo: String,
    #[serde(default)]
    pub costo_puntos: i64,
    #[serde(default)]
    pub producto_id: String,
    #[serde(default)]
    pub valor_descuento: i64,
}

fn cedula() -> String {
    "CC".into()
}

fn activo() -> String {
    "active".into()
}

/// Mete un lote de clientes y devuelve la nueva marca de agua.
///
/// Todo el lote en una transacción, igual que el catálogo: o entra completo o
/// no entra. Y la marca se guarda **después** de aplicarlo; si se guardara
/// antes y la escritura fallara a la mitad, esos clientes no se volverían a
/// pedir nunca y sus puntos quedarían congelados en la terminal.
pub fn aplicar(conexion: &mut Connection, filas: &[FilaCliente]) -> Result<Option<String>> {
    if filas.is_empty() {
        return Ok(None);
    }

    let tx = conexion.transaction()?;
    let mut marca: Option<String> = None;

    {
        let mut sentencia = tx.prepare(
            "INSERT INTO clientes_cache
               (id, documento, tipo_documento, telefono, nombre, puntos, saldo_favor, estado, actualizado,
                credito_habilitado, cupo, saldo_credito)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
             ON CONFLICT(id) DO UPDATE SET
               credito_habilitado = excluded.credito_habilitado,
               cupo           = excluded.cupo,
               saldo_credito  = excluded.saldo_credito,
               documento      = excluded.documento,
               tipo_documento = excluded.tipo_documento,
               telefono       = excluded.telefono,
               nombre         = excluded.nombre,
               puntos         = excluded.puntos,
               saldo_favor    = excluded.saldo_favor,
               estado         = excluded.estado,
               actualizado    = excluded.actualizado",
        )?;

        let mut borrar_duplicada =
            tx.prepare("DELETE FROM clientes_cache WHERE telefono = ?1 AND id <> ?2")?;

        for f in filas {
            sentencia.execute(params![
                f.id,
                f.documento.trim(),
                f.tipo_documento.trim(),
                f.telefono.trim(),
                f.nombre.trim(),
                f.puntos.max(0),
                f.saldo_favor.max(0),
                f.estado.trim(),
                f.actualizado,
                f.credito_habilitado as i64,
                f.cupo.max(0),
                f.saldo_credito,
            ])?;

            /* La misma persona, si quedó registrada dos veces.

               Pasa cuando el cajero la da de alta en el mostrador: la fila
               nace con un id local, y cuando la nube la devuelve viene con el
               suyo. Sin esto el cajero la vería dos veces en la búsqueda —una
               con puntos y otra sin ellos— y no sabría cuál tocar.

               Gana la de la nube, que es la que tiene el historial. */
            if !f.telefono.trim().is_empty() {
                borrar_duplicada.execute(params![f.telefono.trim(), f.id])?;
            }

            if !f.actualizado.is_empty()
                && marca.as_deref().map_or(true, |m| f.actualizado.as_str() > m)
            {
                marca = Some(f.actualizado.clone());
            }
        }
    }

    if let Some(m) = &marca {
        tx.execute(
            "INSERT INTO ajustes (clave, valor) VALUES ('clientes_desde', ?1)
             ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
            params![m],
        )?;
    }

    tx.commit()?;
    Ok(marca)
}

/// Desde cuándo pedir. Vacío la primera vez: se bajan todos.
pub fn marca_de_agua(conexion: &Connection) -> Result<String> {
    conexion
        .query_row("SELECT valor FROM ajustes WHERE clave = 'clientes_desde'", [], |f| f.get(0))
        .or_else(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => Ok(String::new()),
            otro => Err(otro),
        })
}

/// Buscar por lo que el cajero teclee: teléfono, cédula o nombre.
///
/// Las tres a la vez porque el cajero no va a elegir primero en qué campo
/// busca: escribe lo que el cliente le dice y espera que aparezca.
///
/// Los dados de baja quedan fuera: no tienen por qué salir en la lista de un
/// mostrador con fila.
pub fn buscar(conexion: &Connection, texto: &str, limite: i64) -> Result<Vec<FilaCliente>> {
    /* Los comodines de SQL se quitan antes de armar el patrón. Si el cajero
       roza la tecla del porcentaje, el patrón no puede convertirse en "todos":
       serían los diez mil clientes del negocio volcados en pantalla. */
    let limpio: String = texto.trim().chars().filter(|c| *c != '%' && *c != '_').collect();
    if limpio.is_empty() {
        return Ok(Vec::new());
    }

    /* `LIKE 'algo%'` y no `'%algo%'`: con el comodín adelante SQLite no puede
       usar el índice y recorre la tabla entera. Con diez mil clientes eso es
       medio segundo por tecla, y en un mostrador se siente como si la caja se
       hubiera trabado. Quien busca a alguien empieza por el principio del
       número o del nombre. */
    let patron = format!("{limpio}%");

    let mut sentencia = conexion.prepare(
        "SELECT id, documento, tipo_documento, telefono, nombre, puntos, saldo_favor, estado, actualizado, credito_habilitado, cupo, saldo_credito
           FROM clientes_cache
          WHERE estado <> 'inactive'
            AND (telefono LIKE ?1 OR documento LIKE ?1 OR nombre LIKE ?1)
          ORDER BY nombre
          LIMIT ?2",
    )?;

    let filas = sentencia
        .query_map(params![patron, limite.clamp(1, 50)], leer_cliente)?
        .collect::<Result<Vec<_>>>()?;

    Ok(filas)
}

/// Un cliente por su id, para releerlo al cobrar.
pub fn por_id(conexion: &Connection, id: &str) -> Result<Option<FilaCliente>> {
    let mut sentencia = conexion.prepare(
        "SELECT id, documento, tipo_documento, telefono, nombre, puntos, saldo_favor, estado, actualizado, credito_habilitado, cupo, saldo_credito
           FROM clientes_cache WHERE id = ?1",
    )?;

    let mut filas = sentencia.query_map(params![id], leer_cliente)?;

    match filas.next() {
        Some(f) => Ok(Some(f?)),
        None => Ok(None),
    }
}

fn leer_cliente(f: &rusqlite::Row) -> Result<FilaCliente> {
    Ok(FilaCliente {
        id: f.get(0)?,
        documento: f.get(1)?,
        tipo_documento: f.get(2)?,
        telefono: f.get(3)?,
        nombre: f.get(4)?,
        puntos: f.get(5)?,
        saldo_favor: f.get(6)?,
        estado: f.get(7)?,
        actualizado: f.get(8)?,
        credito_habilitado: f.get::<_, i64>(9)? != 0,
        cupo: f.get(10)?,
        saldo_credito: f.get(11)?,
    })
}

/// Reemplaza las recompensas por las que manda la nube.
///
/// Enteras y no por marca de agua: son diez, no diez mil. Y **reemplazar** en
/// vez de mezclar, porque una recompensa que el negocio apagó tiene que
/// desaparecer del mostrador. Si solo se insertaran las nuevas, la caja
/// seguiría ofreciendo una promoción que ya se acabó.
pub fn reemplazar_recompensas(conexion: &mut Connection, filas: &[FilaRecompensa]) -> Result<()> {
    let tx = conexion.transaction()?;
    tx.execute("DELETE FROM recompensas_cache", [])?;

    {
        let mut sentencia = tx.prepare(
            "INSERT INTO recompensas_cache
               (id, nombre, tipo, costo_puntos, producto_id, valor_descuento)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )?;

        for f in filas {
            sentencia.execute(params![
                f.id,
                f.nombre.trim(),
                f.tipo.trim(),
                f.costo_puntos.max(1),
                f.producto_id.trim(),
                f.valor_descuento.max(0),
            ])?;
        }
    }

    tx.commit()
}

/// Las recompensas que la caja puede ofrecer ahora mismo.
pub fn recompensas(conexion: &Connection) -> Result<Vec<FilaRecompensa>> {
    let mut sentencia = conexion.prepare(
        "SELECT id, nombre, tipo, costo_puntos, producto_id, valor_descuento
           FROM recompensas_cache ORDER BY costo_puntos",
    )?;

    let filas = sentencia
        .query_map([], |f| {
            Ok(FilaRecompensa {
                id: f.get(0)?,
                nombre: f.get(1)?,
                tipo: f.get(2)?,
                costo_puntos: f.get(3)?,
                producto_id: f.get(4)?,
                valor_descuento: f.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;

    Ok(filas)
}

/// Da de alta un cliente desde el mostrador, sin esperar a la nube.
///
/// El cliente está enfrente y la fila detrás: preguntarle el teléfono y que la
/// caja se quede pensando en la red es exactamente el momento en que el cajero
/// decide no volver a registrar a nadie. Así que entra local y sube después.
///
/// El id que se genera aquí (UUIDv7) es **solo de esta copia local**. La nube
/// lleva los suyos y no puede adoptar este: sus ids son ObjectId de Mongo y
/// esto es un UUID. Así que la ficha vive un rato con dos identidades.
///
/// Lo que las reconcilia es el teléfono, que además es la llave con la que el
/// programa de puntos lleva las cuentas. Cuando la nube devuelva a este cliente
/// en una bajada posterior —ya con su id— `aplicar` borra la fila local que
/// tenga el mismo teléfono y otro id. Sin eso, el cajero vería a la misma
/// persona dos veces en la búsqueda y no sabría cuál tocar.
///
/// Por eso la venta que se cobre en estos segundos viaja con **teléfono y id**:
/// el id local no le sirve al servidor, el teléfono sí.
///
/// UUIDv7 y no v4 porque lleva la hora adentro: dos cajas registrando a la vez
/// no chocan, y las fichas quedan ordenadas por cuándo se crearon.
pub fn crear_local(
    conexion: &mut Connection,
    telefono: &str,
    nombre: &str,
    documento: &str,
    ahora: &str,
) -> Result<FilaCliente> {
    let fila = FilaCliente {
        id: Uuid::now_v7().to_string(),
        documento: documento.trim().chars().take(20).collect(),
        tipo_documento: "CC".into(),
        telefono: telefono.trim().chars().take(30).collect(),
        nombre: nombre.trim().chars().take(80).collect(),
        puntos: 0,
        saldo_favor: 0,
        estado: "active".into(),
        /* Se estampa con la hora de la caja para que la ficha exista en la copia
           local desde ya. **No** se toca la marca de agua: moverla con una
           fecha local haría que la caja se saltara los clientes que la nube
           cambió entre esa hora y la próxima bajada. */
        actualizado: ahora.to_string(),
        credito_habilitado: false,
        cupo: 0,
        saldo_credito: 0,
    };

    let tx = conexion.transaction()?;

    tx.execute(
        "INSERT INTO clientes_cache
           (id, documento, tipo_documento, telefono, nombre, puntos, saldo_favor, estado, actualizado)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, 0, 'active', ?6)
         ON CONFLICT(id) DO NOTHING",
        params![fila.id, fila.documento, fila.tipo_documento, fila.telefono, fila.nombre, fila.actualizado],
    )?;

    /* Por la misma cola que las ventas: reintentos espaciados, nada se pierde
       si no hay internet, y nada se manda dos veces. */
    let payload = serde_json::json!({
        /* De referencia, para poder rastrear en qué terminal se creó. La nube
           **no** lo usa como identidad: su llave es el teléfono. */
        "pos_cliente_id": fila.id,
        "telefono": fila.telefono,
        "nombre": fila.nombre,
        "documento": fila.documento,
        "tipo_documento": fila.tipo_documento,
        "creado_en": ahora,
    })
    .to_string();

    tx.execute(
        "INSERT INTO outbox (entidad, entidad_id, operacion, payload, creado_en)
         VALUES ('cliente', ?1, 'crear', ?2, ?3)",
        params![fila.id, payload, ahora],
    )?;

    tx.commit()?;
    Ok(fila)
}

/// Descuenta puntos en la copia local, después de que la nube confirmó.
///
/// No decide nada: la nube ya descontó y esto es el reflejo, para que la
/// pantalla no siga mostrando puntos que ya no existen hasta la próxima
/// sincronización. Se acota en cero porque un saldo negativo en un caché solo
/// puede venir de un desfase, y mostrar "-30 puntos" en un mostrador no le
/// sirve a nadie.
pub fn reflejar_canje(conexion: &Connection, id: &str, puntos: i64) -> Result<()> {
    conexion.execute(
        "UPDATE clientes_cache SET puntos = MAX(0, puntos - ?2) WHERE id = ?1",
        params![id, puntos.max(0)],
    )?;
    Ok(())
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use crate::db;

    const AHORA: &str = "2026-09-20T15:04:05-05:00";

    fn cliente(id: &str, tel: &str, doc: &str, nombre: &str, actualizado: &str) -> FilaCliente {
        FilaCliente {
            id: id.into(),
            documento: doc.into(),
            tipo_documento: "CC".into(),
            telefono: tel.into(),
            nombre: nombre.into(),
            puntos: 120,
            saldo_favor: 0,
            estado: "active".into(),
            actualizado: actualizado.into(),
            credito_habilitado: false,
            cupo: 0,
            saldo_credito: 0,
        }
    }

    #[test]
    fn se_encuentra_por_telefono_por_cedula_y_por_nombre() {
        let mut base = db::abrir_en_memoria().unwrap();
        aplicar(
            &mut base,
            &[cliente("c1", "3001234567", "1017", "Marcela Ruiz", "2026-09-20T10:00:00Z")],
        )
        .unwrap();

        // Las tres formas en que alguien se identifica en un mostrador.
        assert_eq!(buscar(&base, "300123", 10).unwrap().len(), 1);
        assert_eq!(buscar(&base, "1017", 10).unwrap().len(), 1);
        assert_eq!(buscar(&base, "Marce", 10).unwrap().len(), 1);
        assert_eq!(buscar(&base, "zzz", 10).unwrap().len(), 0);
    }

    #[test]
    fn la_busqueda_vacia_no_devuelve_la_tabla_entera() {
        /* Con un patrón vacío el cajero que roza una tecla vería los diez mil
           clientes del negocio de golpe. */
        let mut base = db::abrir_en_memoria().unwrap();
        aplicar(&mut base, &[cliente("c1", "3001", "1", "Ana", "2026-09-20T10:00:00Z")]).unwrap();

        assert!(buscar(&base, "", 10).unwrap().is_empty());
        assert!(buscar(&base, "   ", 10).unwrap().is_empty());
    }

    #[test]
    fn un_comodin_tecleado_no_lista_a_todos() {
        let mut base = db::abrir_en_memoria().unwrap();
        aplicar(&mut base, &[cliente("c1", "3001", "1", "Ana", "2026-09-20T10:00:00Z")]).unwrap();

        assert!(buscar(&base, "%", 10).unwrap().is_empty());
        assert!(buscar(&base, "_", 10).unwrap().is_empty());
        assert!(buscar(&base, "%%%", 10).unwrap().is_empty());
    }

    #[test]
    fn un_cliente_dado_de_baja_no_aparece() {
        let mut base = db::abrir_en_memoria().unwrap();
        let mut c = cliente("c1", "3001234567", "1017", "Marcela", "2026-09-20T10:00:00Z");
        c.estado = "inactive".into();
        aplicar(&mut base, &[c]).unwrap();

        assert!(buscar(&base, "300", 10).unwrap().is_empty());
    }

    #[test]
    fn volver_a_bajar_al_mismo_cliente_lo_actualiza_no_lo_duplica() {
        let mut base = db::abrir_en_memoria().unwrap();
        aplicar(&mut base, &[cliente("c1", "3001", "1", "Ana", "2026-09-20T10:00:00Z")]).unwrap();

        let mut despues = cliente("c1", "3001", "1", "Ana Ruiz", "2026-09-21T10:00:00Z");
        despues.puntos = 500;
        aplicar(&mut base, &[despues]).unwrap();

        let hallados = buscar(&base, "3001", 10).unwrap();
        assert_eq!(hallados.len(), 1);
        assert_eq!(hallados[0].nombre, "Ana Ruiz");
        assert_eq!(hallados[0].puntos, 500);
    }

    #[test]
    fn la_marca_de_agua_avanza_con_el_lote() {
        let mut base = db::abrir_en_memoria().unwrap();
        assert_eq!(marca_de_agua(&base).unwrap(), "");

        aplicar(
            &mut base,
            &[
                cliente("c1", "3001", "1", "Ana", "2026-09-20T10:00:00Z"),
                cliente("c2", "3002", "2", "Beto", "2026-09-21T10:00:00Z"),
            ],
        )
        .unwrap();

        // La más reciente del lote, no la de la última fila.
        assert_eq!(marca_de_agua(&base).unwrap(), "2026-09-21T10:00:00Z");
    }

    #[test]
    fn un_lote_vacio_no_mueve_la_marca() {
        /* Si la moviera, un lote vacío por un fallo de red haría que la caja se
           saltara clientes que nunca llegó a recibir. */
        let mut base = db::abrir_en_memoria().unwrap();
        aplicar(&mut base, &[cliente("c1", "3001", "1", "Ana", "2026-09-20T10:00:00Z")]).unwrap();
        aplicar(&mut base, &[]).unwrap();

        assert_eq!(marca_de_agua(&base).unwrap(), "2026-09-20T10:00:00Z");
    }

    #[test]
    fn una_recompensa_apagada_desaparece_del_mostrador() {
        let mut base = db::abrir_en_memoria().unwrap();
        let hacer = |id: &str, n: &str| FilaRecompensa {
            id: id.into(),
            nombre: n.into(),
            tipo: "free_product".into(),
            costo_puntos: 100,
            producto_id: String::new(),
            valor_descuento: 0,
        };

        reemplazar_recompensas(&mut base, &[hacer("r1", "Café gratis"), hacer("r2", "Postre")])
            .unwrap();
        assert_eq!(recompensas(&base).unwrap().len(), 2);

        // El negocio apagó la del postre: no se puede seguir ofreciendo.
        reemplazar_recompensas(&mut base, &[hacer("r1", "Café gratis")]).unwrap();
        let quedan = recompensas(&base).unwrap();
        assert_eq!(quedan.len(), 1);
        assert_eq!(quedan[0].nombre, "Café gratis");
    }

    #[test]
    fn un_cliente_creado_en_el_mostrador_se_encuentra_enseguida() {
        /* Sin esto, el cajero registra a alguien y tiene que esperar a que la
           nube devuelva la ficha para poder usarla. Con el cliente enfrente,
           eso son treinta segundos de silencio. */
        let mut base = db::abrir_en_memoria().unwrap();
        let creado = crear_local(&mut base, "3101234567", "Pedro Gómez", "", AHORA).unwrap();

        let hallados = buscar(&base, "310", 10).unwrap();
        assert_eq!(hallados.len(), 1);
        assert_eq!(hallados[0].id, creado.id);
        assert_eq!(hallados[0].nombre, "Pedro Gómez");
        assert_eq!(hallados[0].puntos, 0);
    }

    #[test]
    fn crear_un_cliente_lo_deja_en_la_cola_para_subirlo() {
        /* Si se quedara solo en la terminal, existiría para esta caja y para
           ninguna otra, y el programa de puntos no sabría que existe. */
        let mut base = db::abrir_en_memoria().unwrap();
        let creado = crear_local(&mut base, "3101234567", "Pedro", "1017", AHORA).unwrap();

        let (entidad, id, payload): (String, String, String) = base
            .query_row(
                "SELECT entidad, entidad_id, payload FROM outbox WHERE entidad = 'cliente'",
                [],
                |f| Ok((f.get(0)?, f.get(1)?, f.get(2)?)),
            )
            .unwrap();

        assert_eq!(entidad, "cliente");
        assert_eq!(id, creado.id);

        /* El id local viaja como referencia —para saber en qué terminal se
           creó— pero la llave con la que la nube reconoce al cliente es el
           teléfono, que tiene que ir sí o sí. */
        let leido: serde_json::Value = serde_json::from_str(&payload).unwrap();
        assert_eq!(leido["pos_cliente_id"], creado.id);
        assert_eq!(leido["telefono"], "3101234567");
        assert_eq!(leido["documento"], "1017");
    }

    #[test]
    fn el_cliente_creado_aqui_no_queda_duplicado_cuando_la_nube_lo_devuelve() {
        /* El caso real: el cajero registra a alguien con la fila esperando, la
           ficha nace con un id local, y media hora después la nube la devuelve
           con el suyo. Si las dos se quedaran, el cajero vería a la misma
           persona dos veces —una con puntos y otra sin ellos— y tendría que
           adivinar cuál tocar. */
        let mut base = db::abrir_en_memoria().unwrap();
        let local = crear_local(&mut base, "3101234567", "Pedro", "", AHORA).unwrap();

        aplicar(
            &mut base,
            &[cliente("id-de-la-nube", "3101234567", "", "Pedro Gómez", "2026-09-20T16:00:00Z")],
        )
        .unwrap();

        let hallados = buscar(&base, "310", 10).unwrap();
        assert_eq!(hallados.len(), 1);
        // Gana la de la nube: es la que trae el historial y los puntos.
        assert_eq!(hallados[0].id, "id-de-la-nube");
        assert!(por_id(&base, &local.id).unwrap().is_none());
    }

    #[test]
    fn dos_clientes_distintos_no_se_borran_entre_si() {
        /* La deduplicación es por teléfono. Si se pasara de lista y borrara por
           otra cosa, bajar el catálogo de clientes iría dejando la tabla
           vacía. */
        let mut base = db::abrir_en_memoria().unwrap();
        aplicar(
            &mut base,
            &[
                cliente("c1", "3001", "1", "Ana", "2026-09-20T10:00:00Z"),
                cliente("c2", "3002", "2", "Beto", "2026-09-20T11:00:00Z"),
            ],
        )
        .unwrap();

        assert_eq!(buscar(&base, "300", 10).unwrap().len(), 2);
    }

    #[test]
    fn crear_un_cliente_no_mueve_la_marca_de_agua() {
        /* Moverla con una fecha local haría que la caja se saltara los clientes
           que la nube cambió entre esa hora y la próxima bajada: se perderían
           en silencio y nadie lo notaría hasta que alguien reclame sus puntos. */
        let mut base = db::abrir_en_memoria().unwrap();
        aplicar(&mut base, &[cliente("c1", "3001", "1", "Ana", "2026-09-20T10:00:00Z")]).unwrap();

        crear_local(&mut base, "3109999999", "Pedro", "", "2027-01-01T00:00:00Z").unwrap();

        assert_eq!(marca_de_agua(&base).unwrap(), "2026-09-20T10:00:00Z");
    }

    #[test]
    fn el_canje_se_refleja_y_nunca_deja_el_saldo_negativo() {
        let mut base = db::abrir_en_memoria().unwrap();
        aplicar(&mut base, &[cliente("c1", "3001", "1", "Ana", "2026-09-20T10:00:00Z")]).unwrap();

        reflejar_canje(&base, "c1", 100).unwrap();
        assert_eq!(por_id(&base, "c1").unwrap().unwrap().puntos, 20);

        // Un desfase con la nube no puede terminar en "-80 puntos" en pantalla.
        reflejar_canje(&base, "c1", 999).unwrap();
        assert_eq!(por_id(&base, "c1").unwrap().unwrap().puntos, 0);
    }
}
