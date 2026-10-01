/** Cabecera de las pantallas secundarias: volver y el título. */
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { color } from '@/tema';
import { Icono, T } from './base';

export function Cabecera({ titulo }: { titulo: string }) {
  return (
    <View style={s.cabeza}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={s.volver} accessibilityLabel="Volver" testID="volver">
        <Icono nombre="arrow-left" tam={24} />
      </Pressable>
      <T v="subtitulo">{titulo}</T>
    </View>
  );
}

const s = StyleSheet.create({
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: color.borde, backgroundColor: color.superficie },
  volver: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: color.fondo },
});
