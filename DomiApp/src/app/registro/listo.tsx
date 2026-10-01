/** Registro enviado: qué sigue y cuánto se demora, dicho claro. */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton, Icono, T } from '@/componentes/base';
import { useRegistro } from '@/estado/datosRegistro';
import { color, radio } from '@/tema';

export default function RegistroListo() {
  return (
    <SafeAreaView style={s.fondo} testID="registro-enviado">
      <View style={s.centro}>
        <Animated.View entering={ZoomIn.springify().damping(12)} style={s.circulo}>
          <Icono nombre="clipboard-check-outline" tam={56} tinte="#fff" />
        </Animated.View>
        <T v="titulo" centro>¡Listo! Estamos revisando tus datos</T>
        <T v="cuerpo" c={color.tintaSuave} centro>Casi siempre lo aprobamos el mismo día. Te avisamos por aquí apenas puedas empezar.</T>
        <View style={s.pasos}>
          <Paso n={1} texto="Revisamos tu documento y tu selfie" />
          <Paso n={2} texto="Te asignamos los negocios de tu zona" />
          <Paso n={3} texto="Entras con tu celular y tu PIN y te conectas" />
        </View>
      </View>
      <Boton texto="Entendido" tipo="oscuro" alTocar={() => { useRegistro.getState().reiniciar(); router.replace('/entrar'); }} style={{ marginHorizontal: 22, marginBottom: 12 }} />
    </SafeAreaView>
  );
}

function Paso({ n, texto }: { n: number; texto: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <View style={s.numero}><T v="fuerte" c="#fff">{n}</T></View>
      <T v="fuerte" style={{ flex: 1 }}>{texto}</T>
    </View>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: color.fondo },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  circulo: { width: 116, height: 116, borderRadius: 58, backgroundColor: color.dinero, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  pasos: { alignSelf: 'stretch', gap: 12, marginTop: 14, padding: 16, borderRadius: radio.l, backgroundColor: color.superficie },
  numero: { width: 30, height: 30, borderRadius: 15, backgroundColor: color.tinta, alignItems: 'center', justifyContent: 'center' },
});
