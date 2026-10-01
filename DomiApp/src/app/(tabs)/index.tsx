/**
 * Ruta: la pantalla donde el domi pasa el día.
 *
 * Tres estados y nada más:
 *  - desconectado → un solo gesto para conectarse;
 *  - conectado sin pedidos → "buscando pedidos", con lo ganado hoy;
 *  - con pedidos → la ruta en el orden más corto y un botón para la siguiente parada.
 */
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Boton, Icono, T, Tarjeta } from '@/componentes/base';
import { Deslizar } from '@/componentes/Deslizar';
import { Mapa } from '@/componentes/Mapa';
import { fallo } from '@/lib/aviso';
import { pesos, km, minutos } from '@/lib/formato';
import { planearRuta, type Parada } from '@/lib/ruta';
import { aplicarPlan, useRutaCalles } from '@/lib/rutaCalles';
import { puedeSuperponer } from '@/lib/sistema';
import { permisosUbicacion } from '@/lib/ubicacion';
import { permisoNotificaciones } from '@/lib/notificaciones';
import { ErrorApi, pedidosVisibles, useApp } from '@/estado/app';
import { color, radio, sombra } from '@/tema';

export default function Ruta() {
  const servidor = useApp((s) => s.servidor);
  const locales = useApp((s) => s.locales);
  const yo = useApp((s) => s.ubicacion);
  const enLineaLocal = useApp((s) => s.enLineaLocal);
  const arriba = useSafeAreaInsets().top;
  const [faltanPermisos, setFaltanPermisos] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const [error, setError] = useState('');
  const [altoPanel, setAltoPanel] = useState(320);

  const pedidos = useMemo(() => pedidosVisibles(servidor, locales), [servidor, locales]);
  const hayRed = useApp((s) => s.hayRed);
  // Plan local en línea recta (sirve sin señal) y, encima, la ruta real por calles
  const paradasBase = useMemo(() => planearRuta(yo, pedidos), [pedidos, yo]);
  const plan = useRutaCalles(yo, paradasBase, hayRed);
  const paradas = useMemo(() => aplicarPlan(paradasBase, plan), [paradasBase, plan]);
  const enLinea = enLineaLocal ?? !!servidor?.cuenta.enLinea;

  useEffect(() => {
    Promise.all([permisosUbicacion(), permisoNotificaciones()]).then(([u, n]) => setFaltanPermisos(!u.segundoPlano || !u.gpsEncendido || !n || !puedeSuperponer()));
  }, [servidor?.servidorAt]);

  const conectar = async (valor: boolean) => {
    setCambiando(true);
    setError('');
    try {
      await useApp.getState().conectarse(valor);
    } catch (e) {
      fallo();
      setError(e instanceof ErrorApi && e.status === 0 ? 'Sin señal: no se pudo cambiar. Intenta de nuevo.' : 'No se pudo cambiar tu estado.');
    } finally {
      setCambiando(false);
    }
  };

  const abrirParada = (p: Parada) => router.push({ pathname: '/pedido/[id]', params: { id: p.pedidoIds[0] } });

  return (
    <View style={s.fondo}>
      <Mapa yo={yo} paradas={paradas} trazo={plan?.trazo} margen={{ arriba: arriba + 90, abajo: altoPanel }} />

      {/* Arriba: estado y plata de hoy */}
      <View style={[s.arriba, { top: arriba + 10 }]}>
        <Pressable
          testID="interruptor-conexion"
          onPress={() => !cambiando && conectar(!enLinea)}
          style={[s.estado, { backgroundColor: enLinea ? color.dinero : color.tinta }]}>
          <Punto vivo={enLinea} />
          <View style={{ flex: 1 }}>
            <T v="fuerte" c="#fff">{cambiando ? 'Un momento…' : enLinea ? 'Conectado' : 'Desconectado'}</T>
            <T v="pequeno" c="rgba(255,255,255,0.75)">{enLinea ? 'Toca para desconectarte' : 'No recibes pedidos'}</T>
          </View>
        </Pressable>
        <Pressable onPress={() => router.navigate('/plata')} style={s.hoy} testID="chip-hoy">
          <T v="etiqueta" c={color.tintaSuave}>Hoy</T>
          <T v="subtitulo" c={color.dinero}>{pesos(servidor?.hoy.ganancias ?? 0)}</T>
        </Pressable>
      </View>

      {/* Abajo: la ruta o el estado */}
      <View style={s.panel} onLayout={(e) => setAltoPanel(e.nativeEvent.layout.height)}>
        {!!error && <T v="fuerte" c={color.peligro} centro style={{ marginBottom: 10 }}>{error}</T>}
        {faltanPermisos && (
          <Pressable onPress={() => router.push('/preparar')} style={s.alerta} testID="alerta-permisos">
            <Icono nombre="alert-circle" tinte={color.peligro} />
            <T v="fuerte" c={color.peligro} style={{ flex: 1 }}>Tu celular no está listo para recibir pedidos</T>
            <Icono nombre="chevron-right" tinte={color.peligro} />
          </Pressable>
        )}

        {pedidos.length > 0 ? (
          <ConRuta paradas={paradas} alAbrir={abrirParada} />
        ) : enLinea ? (
          <Esperando entregas={servidor?.hoy.entregas ?? 0} efectivo={servidor?.efectivoEnMano ?? 0} />
        ) : (
          <View style={{ gap: 14 }}>
            <View>
              <T v="subtitulo">¿Listo para repartir?</T>
              <T v="cuerpo" c={color.tintaSuave}>Conéctate y te avisamos apenas haya un pedido cerca.</T>
            </View>
            <Deslizar prueba="deslizar-conectar" texto="Desliza para conectarte" fondo={color.dinero} icono="power" cargando={cambiando} alConfirmar={() => conectar(true)} />
          </View>
        )}
      </View>
    </View>
  );
}

function ConRuta({ paradas, alAbrir }: { paradas: Parada[]; alAbrir: (p: Parada) => void }) {
  const ultima = paradas[paradas.length - 1];
  const siguiente = paradas[0];
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <T v="subtitulo">Tu ruta</T>
        <T v="pequeno" c={color.tintaSuave}>
          {paradas.length} {paradas.length === 1 ? 'parada' : 'paradas'}{ultima?.llegadaMin != null ? ` · terminas en ~${minutos(ultima.llegadaMin + 3)}` : ''}
        </T>
      </View>
      <ScrollView style={{ maxHeight: 190 }} contentContainerStyle={{ gap: 8 }}>
        {paradas.map((p, i) => (
          <Pressable key={p.clave} onPress={() => alAbrir(p)} style={[s.parada, i === 0 && s.paradaPrimera]} testID={`parada-${i + 1}`}>
            <View style={[s.numero, { backgroundColor: p.tipo === 'recoger' ? color.marca : color.tinta }]}>
              <T v="fuerte" c="#fff">{i + 1}</T>
            </View>
            <View style={{ flex: 1 }}>
              <T v="fuerte" lineas={1}>
                {p.tipo === 'recoger' ? `Recoger${p.pedidoIds.length > 1 ? ` ${p.pedidoIds.length} pedidos` : ''} en ${p.titulo}` : `Entregar a ${p.titulo.split(' ')[0]}`}
              </T>
              <T v="pequeno" c={color.tintaSuave} lineas={1}>{p.direccion || 'Sin dirección'}</T>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <T v="fuerte">{p.llegadaMin != null ? minutos(p.llegadaMin) : '—'}</T>
              <T v="pequeno" c={color.tintaTenue}>{km(p.tramoKm)}</T>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <Boton
        prueba="ir-siguiente"
        texto={siguiente.tipo === 'recoger' ? `Ir a ${siguiente.titulo}` : `Ir donde ${siguiente.titulo.split(' ')[0]}`}
        icono="navigation-variant"
        tipo="oscuro"
        alTocar={() => alAbrir(siguiente)}
      />
    </View>
  );
}

function Esperando({ entregas, efectivo }: { entregas: number; efectivo: number }) {
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Radar />
        <View style={{ flex: 1 }}>
          <T v="subtitulo">Buscando pedidos cerca</T>
          <T v="pequeno" c={color.tintaSuave}>Te sonará como una llamada. Puedes bloquear la pantalla.</T>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Tarjeta style={s.mini}>
          <T v="etiqueta" c={color.tintaSuave}>Entregas hoy</T>
          <T v="titulo">{entregas}</T>
        </Tarjeta>
        <Tarjeta style={s.mini}>
          <T v="etiqueta" c={color.tintaSuave}>Efectivo en mano</T>
          <T v="titulo" c={efectivo ? color.efectivo : color.tinta}>{pesos(efectivo)}</T>
        </Tarjeta>
      </View>
    </View>
  );
}

function Punto({ vivo }: { vivo: boolean }) {
  const e = useSharedValue(1);
  useEffect(() => {
    e.value = vivo ? withRepeat(withTiming(1.8, { duration: 1100, easing: Easing.out(Easing.quad) }), -1, false) : 1;
  }, [vivo, e]);
  const halo = useAnimatedStyle(() => ({ transform: [{ scale: e.value }], opacity: vivo ? 2 - e.value : 0 }));
  return (
    <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff' }, halo]} />
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: vivo ? '#fff' : 'rgba(255,255,255,0.4)' }} />
    </View>
  );
}

function Radar() {
  const e = useSharedValue(0);
  useEffect(() => { e.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) }), -1, false); }, [e]);
  const onda = useAnimatedStyle(() => ({ transform: [{ scale: 0.5 + e.value }], opacity: 1 - e.value }));
  return (
    <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: color.dinero }, onda]} />
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color.dinero, alignItems: 'center', justifyContent: 'center' }}>
        <Icono nombre="moped" tinte="#fff" tam={22} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: color.fondo },
  arriba: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', gap: 10 },
  estado: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, height: 64, borderRadius: radio.l, ...sombra.flotante },
  hoy: { backgroundColor: color.superficie, borderRadius: radio.l, paddingHorizontal: 16, justifyContent: 'center', minWidth: 104, ...sombra.flotante },
  panel: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: color.superficie,
    borderTopLeftRadius: radio.xl, borderTopRightRadius: radio.xl, padding: 18, paddingBottom: 16, ...sombra.flotante,
  },
  alerta: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radio.m, backgroundColor: color.peligroSuave, marginBottom: 12 },
  parada: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radio.m, backgroundColor: color.fondo },
  paradaPrimera: { borderWidth: 2, borderColor: color.tinta, backgroundColor: color.superficie },
  numero: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  mini: { flex: 1, gap: 2, padding: 14, shadowOpacity: 0, elevation: 0, backgroundColor: color.fondo },
});
