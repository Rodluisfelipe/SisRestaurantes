/**
 * Aviso de "sin señal" que tranquiliza en vez de asustar: todo lo que haga se
 * guarda y se manda solo. Con señal y cosas pendientes, dice que está enviando.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { alCambiarCola } from '@/lib/cola';
import { useApp } from '@/estado/app';
import { color } from '@/tema';
import { Icono, T } from './base';

export function BarraSinSenal() {
  const hayRed = useApp((s) => s.hayRed);
  const sesion = useApp((s) => s.sesion);
  const [pendientes, setPendientes] = useState(0);
  const arriba = useSafeAreaInsets().top;

  useEffect(() => alCambiarCola((n) => setPendientes(n.eventos + n.fotos)), []);

  if (!sesion || (hayRed && !pendientes)) return null;
  const texto = !hayRed
    ? pendientes
      ? `Sin señal · ${pendientes} ${pendientes === 1 ? 'paso guardado' : 'pasos guardados'}, se envían solos`
      : 'Sin señal · Puedes seguir trabajando, guardamos todo'
    : `Enviando ${pendientes} ${pendientes === 1 ? 'paso guardado' : 'pasos guardados'}…`;

  return (
    <View style={[s.barra, { paddingTop: arriba + 6, backgroundColor: hayRed ? color.info : color.tinta }]} pointerEvents="none" testID="barra-senal">
      <Icono nombre={hayRed ? 'cloud-upload-outline' : 'signal-off'} tam={17} tinte="#fff" />
      <T v="pequeno" c="#fff" lineas={1}>{texto}</T>
    </View>
  );
}

const s = StyleSheet.create({
  barra: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 8, paddingHorizontal: 16,
  },
});
