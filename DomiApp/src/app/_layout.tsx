// La tarea de GPS en segundo plano tiene que definirse antes que nada.
import '@/lib/ubicacion';

import { Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold, useFonts } from '@expo-google-fonts/manrope';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AvisoAsignado } from '@/componentes/AvisoAsignado';
import { BarraSinSenal } from '@/componentes/BarraSinSenal';
import { Bloqueo } from '@/componentes/Bloqueo';
import { Motor } from '@/componentes/Motor';
import { OfertaEntrante } from '@/componentes/OfertaEntrante';
import { useApp } from '@/estado/app';
import { color } from '@/tema';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Raiz() {
  const [fuentes] = useFonts({ Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold });
  const listo = useApp((s) => s.listo);
  const sesion = useApp((s) => s.sesion);

  useEffect(() => { useApp.getState().iniciar(); }, []);
  useEffect(() => { if (fuentes && listo) SplashScreen.hideAsync().catch(() => {}); }, [fuentes, listo]);

  if (!fuentes || !listo) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.fondo }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.fondo }, animation: 'slide_from_right' }}>
        <Stack.Protected guard={!sesion}>
          <Stack.Screen name="entrar" />
          <Stack.Screen name="registro/celular" />
          <Stack.Screen name="registro/correo" />
          <Stack.Screen name="registro/codigo" />
          <Stack.Screen name="registro/datos" />
          <Stack.Screen name="registro/fotos" />
          <Stack.Screen name="registro/pin" />
          <Stack.Screen name="registro/listo" options={{ gestureEnabled: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!!sesion}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="pedido/[id]" />
          <Stack.Screen name="entregar/[id]" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="no-entregado/[id]" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="preparar" options={{ animation: 'slide_from_bottom' }} />
        </Stack.Protected>
      </Stack>
      {sesion && <Motor />}
      {sesion && <OfertaEntrante />}
      {sesion && <AvisoAsignado />}
      <BarraSinSenal />
      <Bloqueo />
    </GestureHandlerRootView>
  );
}
