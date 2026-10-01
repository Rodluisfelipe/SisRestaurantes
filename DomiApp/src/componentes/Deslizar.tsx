/**
 * Deslizar para confirmar.
 *
 * Los pasos que no se pueden deshacer ("Recogí", "Entregué") no van en un
 * botón: con el celular en el bolsillo o en el soporte de la moto, un toque
 * accidental es fácil. Deslizar hasta el final es imposible por error y se
 * hace sin mirar.
 */
import { useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { exito, tocar } from '@/lib/aviso';
import { color, letra, radio } from '@/tema';
import { Icono, type NombreIcono } from './base';

const PERILLA = 60;
const MARGEN = 5;

export function Deslizar({ texto, alConfirmar, fondo = color.tinta, icono = 'chevron-double-right', cargando, desactivado, prueba }: {
  texto: string; alConfirmar: () => void; fondo?: string; icono?: NombreIcono; cargando?: boolean; desactivado?: boolean; prueba?: string;
}) {
  const [ancho, setAncho] = useState(0);
  const x = useSharedValue(0);
  const max = Math.max(0, ancho - PERILLA - MARGEN * 2);

  const confirmar = () => { exito(); alConfirmar(); };

  const gesto = Gesture.Pan()
    .enabled(!desactivado && !cargando && max > 0)
    .onBegin(() => { scheduleOnRN(tocar); })
    .onUpdate((e) => { x.value = Math.min(max, Math.max(0, e.translationX)); })
    .onEnd(() => {
      if (x.value > max * 0.86) {
        x.value = withSequence(withTiming(max, { duration: 90 }), withDelay(450, withTiming(0, { duration: 350 })));
        scheduleOnRN(confirmar);
      } else {
        x.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  const perilla = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const relleno = useAnimatedStyle(() => ({ width: x.value + PERILLA + MARGEN }));
  const letrero = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, max * 0.6 || 1], [1, 0]) }));

  return (
    <View
      testID={prueba}
      accessibilityRole="adjustable"
      accessibilityLabel={`${texto}. Desliza a la derecha para confirmar.`}
      accessibilityActions={[{ name: 'activate', label: texto }]}
      onAccessibilityAction={() => confirmar()}
      onLayout={(e: LayoutChangeEvent) => setAncho(e.nativeEvent.layout.width)}
      style={[s.carril, { backgroundColor: fondo, opacity: desactivado ? 0.45 : 1 }]}>
      <Animated.View style={[s.relleno, relleno]} />
      <Animated.View style={[s.centro, letrero]} pointerEvents="none">
        <Text style={s.texto} numberOfLines={1}>{texto}</Text>
      </Animated.View>
      <GestureDetector gesture={gesto}>
        <Animated.View style={[s.perilla, perilla]}>
          {cargando ? <ActivityIndicator color={fondo} /> : <Icono nombre={icono} tam={30} tinte={fondo} />}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const s = StyleSheet.create({
  carril: { height: PERILLA + MARGEN * 2, borderRadius: radio.total, justifyContent: 'center', overflow: 'hidden' },
  relleno: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: radio.total },
  centro: { position: 'absolute', left: PERILLA + 16, right: 20, alignItems: 'center' },
  texto: { color: '#fff', fontFamily: letra.fuerte, fontSize: 17.5, letterSpacing: -0.2 },
  perilla: {
    position: 'absolute', left: MARGEN, width: PERILLA, height: PERILLA, borderRadius: PERILLA / 2,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
});
