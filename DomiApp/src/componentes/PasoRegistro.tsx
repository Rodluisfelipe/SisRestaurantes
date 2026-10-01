/** El marco de cada paso del registro: volver, avance, título y un botón abajo. */
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, radio } from '@/tema';
import { Icono, T } from './base';

export function PasoRegistro({ paso, total = 5, titulo, ayuda, children, pie, sinScroll }: {
  paso: number; total?: number; titulo: string; ayuda?: string; children: ReactNode; pie?: ReactNode; sinScroll?: boolean;
}) {
  const Contenido = sinScroll ? View : ScrollView;
  return (
    <SafeAreaView style={s.fondo} edges={['top', 'bottom']}>
      <View style={s.cabeza}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.volver} accessibilityLabel="Volver" testID="volver">
          <Icono nombre="arrow-left" tam={24} />
        </Pressable>
        <View style={s.barras}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={[s.barra, { backgroundColor: i < paso ? color.marca : color.borde }]} />
          ))}
        </View>
      </View>
      <Contenido style={{ flex: 1 }} {...(sinScroll ? {} : { contentContainerStyle: s.cuerpo, keyboardShouldPersistTaps: 'handled' as const })}>
        <View style={sinScroll ? [s.cuerpo, { flex: 1 }] : undefined}>
          <T v="titulo">{titulo}</T>
          {!!ayuda && <T v="cuerpo" c={color.tintaSuave} style={{ marginTop: 6 }}>{ayuda}</T>}
          <View style={{ marginTop: 20, gap: 12, flex: sinScroll ? 1 : undefined }}>{children}</View>
        </View>
      </Contenido>
      {pie && <View style={s.pie}>{pie}</View>}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: color.fondo },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingTop: 8 },
  volver: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: color.superficie },
  barras: { flex: 1, flexDirection: 'row', gap: 5 },
  barra: { flex: 1, height: 5, borderRadius: radio.total },
  cuerpo: { padding: 22, paddingBottom: 30 },
  pie: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 12, gap: 6 },
});
