/**
 * Pantalla que tapa todo cuando hay trampa: GPS falso o app modificada.
 *
 * Con GPS falso se sale en cuanto el domi lo apaga (el siguiente punto real
 * la quita sola). Con la app modificada no hay salida: hay que instalar la
 * oficial.
 */
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform, StyleSheet, View } from 'react-native';
import { useApp } from '@/estado/app';
import { color } from '@/tema';
import { Boton, Icono, T } from './base';

async function abrirOpcionesDesarrollador() {
  try {
    await IntentLauncher.startActivityAsync('android.settings.APPLICATION_DEVELOPMENT_SETTINGS');
  } catch {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.SETTINGS).catch(() => {});
  }
}

export function Bloqueo() {
  const alterada = useApp((s) => s.appAlterada);
  const simulado = useApp((s) => s.gpsSimulado);
  if (!alterada && !simulado) return null;

  return (
    <View style={s.fondo} testID="bloqueo">
      <View style={s.icono}>
        <Icono nombre={alterada ? 'shield-alert' : 'map-marker-off'} tam={44} tinte="#fff" />
      </View>
      {alterada ? (
        <>
          <T v="titulo" c="#fff" centro>Esta app no es la oficial</T>
          <T v="cuerpo" c="#ffffffcc" centro>
            Detectamos que la app fue modificada o que hay un programa cambiándola. Bórrala e instala MenuBy Go desde la tienda.
          </T>
        </>
      ) : (
        <>
          <T v="titulo" c="#fff" centro>Apaga la ubicación simulada</T>
          <T v="cuerpo" c="#ffffffcc" centro>
            Tu celular está usando una app de GPS falso. Así no puedes recibir ni entregar pedidos. En Opciones de desarrollador, busca «Seleccionar app de ubicación simulada» y elige «Ninguna».
          </T>
          {Platform.OS === 'android' && (
            <Boton texto="Abrir opciones de desarrollador" tipo="claro" icono="cog" alTocar={abrirOpcionesDesarrollador} style={{ marginTop: 10, alignSelf: 'stretch' }} />
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  fondo: {
    ...StyleSheet.absoluteFill, zIndex: 100, elevation: 100, backgroundColor: color.noche,
    alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14,
  },
  icono: { width: 88, height: 88, borderRadius: 44, backgroundColor: color.peligro, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
});
