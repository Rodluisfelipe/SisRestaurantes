/**
 * "Prepara tu celular": la lista de lo que hace falta para que lleguen los
 * pedidos y el local te vea en el mapa. Cada cosa dice PARA QUÉ sirve antes de
 * pedir el permiso, que es lo que hace que la gente diga que sí.
 *
 * Se vuelve a revisar sola al regresar de los ajustes del celular.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton, Icono, T, Tarjeta, type NombreIcono } from '@/componentes/base';
import { abrirAjusteBateria, abrirAjustesApp, abrirAjustesUbicacion, bateriaRestringida, esXiaomi, pasosDeMarca } from '@/lib/bateria';
import { permisoNotificaciones, pedirNotificaciones, registrarToken } from '@/lib/notificaciones';
import { permisosUbicacion, pedirSegundoPlano } from '@/lib/ubicacion';
import { CLAVES, guardar, leer } from '@/lib/almacen';
import { abrirPermisoPantallaCompleta, abrirPermisoSuperponer, abrirPermisosXiaomi, hayModuloSistema, puedePantallaCompleta, puedeSuperponer, xiaomiListo } from '@/lib/sistema';
import { color, radio } from '@/tema';

type Revision = { ubicacion: boolean; gps: boolean; avisos: boolean; bateria: boolean; encima: boolean; pantallaCompleta: boolean; xiaomi: boolean; bateriaXiaomi: boolean };

async function leerRevision(): Promise<Revision> {
  const [u, avisos, restringida, bateriaXiaomi] = await Promise.all([
    permisosUbicacion(), permisoNotificaciones(), bateriaRestringida(), leer<boolean>(CLAVES.bateriaXiaomi, false),
  ]);
  return {
    ubicacion: u.segundoPlano, gps: u.gpsEncendido, avisos, bateria: !restringida,
    encima: puedeSuperponer(), pantallaCompleta: puedePantallaCompleta(), xiaomi: xiaomiListo(), bateriaXiaomi: !esXiaomi || bateriaXiaomi,
  };
}

export default function Preparar() {
  const [r, setR] = useState<Revision | null>(null);
  const [negadoUbicacion, setNegadoUbicacion] = useState(false);
  const marca = pasosDeMarca();

  const revisar = useCallback(() => leerRevision().then(setR), []);

  useEffect(() => {
    let vivo = true;
    const ahora = () => leerRevision().then((x) => { if (vivo) setR(x); });
    ahora();
    const sub = AppState.addEventListener('change', (e) => { if (e === 'active') ahora(); });
    return () => { vivo = false; sub.remove(); };
  }, []);

  const pedirUbicacion = async () => {
    const ok = await pedirSegundoPlano();
    if (!ok) { setNegadoUbicacion(true); await abrirAjustesApp(); }
    revisar();
  };
  const pedirAvisos = async () => {
    const ok = await pedirNotificaciones();
    if (ok) registrarToken(); else await abrirAjustesApp();
    revisar();
  };

  const listo = !!r && r.ubicacion && r.gps && r.avisos && r.encima && r.pantallaCompleta && r.xiaomi && r.bateriaXiaomi;
  const terminar = async () => {
    await guardar(CLAVES.permisosVistos, true);
    router.replace('/');
  };

  return (
    <SafeAreaView style={s.fondo} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.contenido}>
        <T v="titulo">Prepara tu celular</T>
        <T v="cuerpo" c={color.tintaSuave} style={{ marginTop: 6, marginBottom: 18 }}>
          Así te llegan los pedidos aunque tengas la pantalla apagada, y el local sabe dónde vas.
        </T>

        <Item
          icono="map-marker-radius"
          titulo="Ubicación todo el tiempo"
          porque={Platform.OS === 'android'
            ? 'Para darte los pedidos más cercanos. Cuando Android pregunte, elige "Permitir todo el tiempo".'
            : 'Para darte los pedidos más cercanos. Elige "Siempre".'}
          ok={r?.ubicacion}
          boton={negadoUbicacion ? 'Abrir ajustes' : 'Permitir'}
          alTocar={pedirUbicacion}
          prueba="permiso-ubicacion"
        />
        <Item
          icono="crosshairs-gps"
          titulo="GPS encendido"
          porque="Sin GPS no hay forma de saber dónde estás."
          ok={r?.gps}
          boton="Encender GPS"
          alTocar={abrirAjustesUbicacion}
        />
        <Item
          icono="bell-ring"
          titulo="Avisos de pedidos"
          porque="Para que suene como una llamada cuando te ofrecen un pedido, aunque la app esté cerrada."
          ok={r?.avisos}
          boton="Permitir"
          alTocar={pedirAvisos}
          prueba="permiso-avisos"
        />
        {Platform.OS === 'android' && hayModuloSistema && (
          <Item
            icono="layers-triple"
            titulo="Abrirse encima de otras apps"
            porque="Si estás en otra app (Rappi, WhatsApp, Maps…) y te cae un pedido, MenuBy Go se abre sola para que lo aceptes a tiempo. Busca MenuBy Go y activa «Permitir mostrar sobre otras apps»."
            ok={r?.encima}
            boton="Activar"
            alTocar={abrirPermisoSuperponer}
            prueba="permiso-encima"
          />
        )}
        {/* Android 14+: sin este permiso, con el celular bloqueado el pedido solo suena */}
        {r && !r.pantallaCompleta && (
          <Item
            icono="phone-ring"
            titulo="Pedidos como llamada"
            porque="Con el celular bloqueado, el pedido entra como una llamada: prende la pantalla y suena hasta que lo veas. Toca el botón y activa «Permitir notificaciones en pantalla completa»."
            ok={r.pantallaCompleta}
            boton="Activar"
            alTocar={abrirPermisoPantallaCompleta}
            prueba="permiso-pantalla-completa"
          />
        )}
        {/* Solo aparece en Xiaomi / Redmi / POCO con el permiso apagado */}
        {r && !r.xiaomi && (
          <Item
            icono="cellphone-cog"
            titulo="Permisos de Xiaomi"
            porque="Tu Xiaomi tiene un bloqueo extra: sin él, el pedido suena pero la app no se abre. Toca el botón y activa «Mostrar ventanas emergentes mientras se ejecuta en segundo plano» y «Mostrar en pantalla de bloqueo»."
            ok={false}
            boton="Abrir permisos de Xiaomi"
            alTocar={abrirPermisosXiaomi}
            prueba="permiso-xiaomi"
          />
        )}
        {/* Xiaomi corta el internet de las apps en segundo plano y no deja saber
            si lo está haciendo: se muestra siempre hasta que el domi confirme */}
        {esXiaomi && marca && (
          <Item
            icono="battery-alert-variant-outline"
            titulo="Ahorro de batería de Xiaomi"
            porque="Tu Xiaomi le corta el internet a la app cuando no la estás viendo, y así no te llegan los pedidos. Haz estos pasos una sola vez:"
            ok={r?.bateriaXiaomi}
            boton="Abrir ajustes de la app"
            alTocar={abrirAjustesApp}
            prueba="bateria-xiaomi"
          >
            <View style={s.marca}>
              {marca.pasos.map((p, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                  <T v="fuerte" c={color.marca}>{i + 1}.</T>
                  <T v="pequeno" style={{ flex: 1 }}>{p}</T>
                </View>
              ))}
              <Boton texto="Ya lo hice" tipo="claro" compacto icono="check" alTocar={async () => { await guardar(CLAVES.bateriaXiaomi, true); revisar(); }} style={{ marginTop: 6 }} />
            </View>
          </Item>
        )}
        {Platform.OS === 'android' && (
          <Item
            icono="battery-heart-variant"
            titulo="Batería sin restricciones"
            porque="Muchos celulares cierran las apps para ahorrar batería y dejas de recibir pedidos sin darte cuenta. Busca MenuBy Go y elige «No optimizar» o «Sin restricciones»."
            ok={r?.bateria}
            boton="Abrir ajuste"
            alTocar={abrirAjusteBateria}
            recomendado
          >
            {marca && !esXiaomi && (
              <View style={s.marca}>
                <T v="etiqueta" c={color.tintaSuave}>En tu {marca.marca} además:</T>
                {marca.pasos.map((p, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
                    <T v="fuerte" c={color.marca}>{i + 1}.</T>
                    <T v="pequeno" style={{ flex: 1 }}>{p}</T>
                  </View>
                ))}
                <Boton texto="Abrir ajustes de la app" tipo="claro" compacto icono="cog" alTocar={abrirAjustesApp} style={{ marginTop: 6 }} />
              </View>
            )}
          </Item>
        )}
      </ScrollView>

      <View style={s.pie}>
        <Boton prueba="listo-trabajar" texto={listo ? 'Listo, a trabajar' : 'Faltan permisos'} icono={listo ? 'check-bold' : undefined} tipo={listo ? 'dinero' : 'oscuro'} desactivado={!listo} alTocar={terminar} />
        {!listo && <Boton texto="Hacerlo después" tipo="fantasma" compacto alTocar={terminar} />}
      </View>
    </SafeAreaView>
  );
}

function Item({ icono, titulo, porque, ok, boton, alTocar, recomendado, children, prueba }: {
  icono: NombreIcono; titulo: string; porque: string; ok?: boolean; boton: string; alTocar: () => void;
  recomendado?: boolean; children?: React.ReactNode; prueba?: string;
}) {
  return (
    <Tarjeta style={[s.item, ok && { borderColor: color.dinero }]}>
      <View style={s.itemFila}>
        <View style={[s.icono, { backgroundColor: ok ? color.dineroSuave : color.fondo }]}>
          <Icono nombre={ok ? 'check-bold' : icono} tinte={ok ? color.dinero : color.tinta} tam={24} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <T v="fuerte">{titulo}{recomendado && !ok ? '  ·  muy recomendado' : ''}</T>
          <T v="pequeno" c={color.tintaSuave}>{porque}</T>
        </View>
      </View>
      {ok === false && <Boton prueba={prueba} texto={boton} compacto tipo="oscuro" alTocar={alTocar} style={{ marginTop: 12 }} />}
      {ok === false && children}
    </Tarjeta>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: color.fondo },
  contenido: { padding: 22, gap: 12, paddingBottom: 30 },
  item: { borderWidth: 2, borderColor: 'transparent' },
  itemFila: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  icono: { width: 48, height: 48, borderRadius: radio.m, alignItems: 'center', justifyContent: 'center' },
  marca: { marginTop: 14, gap: 8, padding: 12, borderRadius: radio.m, backgroundColor: color.fondo },
  pie: { padding: 22, paddingTop: 10, gap: 4, borderTopWidth: 1, borderTopColor: color.borde, backgroundColor: color.superficie },
});
