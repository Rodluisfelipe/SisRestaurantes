/**
 * Aceptar pedidos solo: las ofertas que cumplen lo que el domi elige aquí
 * quedan suyas sin tocar el celular (va en la moto). Lo decide el servidor.
 *
 * Se explica claro lo que pasa si acepta y no arranca, para que no haya
 * sorpresas: a los 5 minutos se le pasa a otro y con 2 veces se apaga sola.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton, Icono, T, Tarjeta } from '@/componentes/base';
import { Cabecera } from '@/componentes/Cabecera';
import { ErrorApi, llamar } from '@/lib/api';
import { tocar } from '@/lib/aviso';
import { pesos } from '@/lib/formato';
import type { AutoAcepta } from '@/lib/tipos';
import { useApp } from '@/estado/app';
import { color, radio } from '@/tema';

const DISTANCIAS = [1, 2, 3, 5, 8];
const GANANCIAS = [0, 4000, 5000, 6000, 8000];

export default function AceptarSolo() {
  const [c, setC] = useState<AutoAcepta | null>(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setC(await llamar<AutoAcepta>('/domi-app/auto-aceptar'));
      setError('');
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos cargar tu ajuste.');
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (cambios: Partial<AutoAcepta>) => {
    if (!c) return;
    const antes = c;
    setC({ ...c, ...cambios, apagadaPor: cambios.activo ? null : c.apagadaPor });
    setGuardando(true);
    setError('');
    try {
      setC(await llamar<AutoAcepta>('/domi-app/auto-aceptar', { metodo: 'PUT', cuerpo: cambios }));
      useApp.getState().refrescar();
    } catch (e) {
      setC(antes);
      setError(e instanceof ErrorApi ? e.message : 'No se pudo guardar. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SafeAreaView style={s.fondo} edges={['top', 'bottom']}>
      <Cabecera titulo="Aceptar pedidos solo" />
      {!c ? (
        <View style={s.centro}>
          {error ? <><T v="cuerpo" centro>{error}</T><Boton texto="Reintentar" tipo="oscuro" compacto alTocar={cargar} style={{ marginTop: 12 }} /></> : <ActivityIndicator color={color.marca} />}
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.cuerpo}>
          <T v="cuerpo" c={color.tintaSuave}>
            Los pedidos que cumplan lo que elijas aquí quedan tuyos al instante, sin tocar el celular. Te suena "Aceptaste el pedido" y te lleva a la ruta.
          </T>

          {!c.disponible ? (
            <Tarjeta style={{ gap: 8 }}>
              <View style={s.fila}><Icono nombre="lock" tinte={color.tintaSuave} /><T v="fuerte" style={{ flex: 1 }}>Se activa desde el nivel {c.nivelNecesario}</T></View>
              <T v="cuerpo" c={color.tintaSuave}>Sigue entregando bien y la desbloqueas.</T>
              <Boton texto="Ver mi nivel" tipo="claro" compacto icono="trophy-outline" alTocar={() => router.replace('/desempeno')} />
            </Tarjeta>
          ) : (
            <>
              {c.apagadaPor && (
                <Tarjeta style={[s.aviso]}>
                  <View style={s.fila}><Icono nombre="information" tinte={color.efectivo} />
                    <T v="fuerte" style={{ flex: 1 }}>
                      {c.apagadaPor === 'no_arranco'
                        ? 'Se apagó sola: aceptaste 2 pedidos y no saliste hacia el local.'
                        : 'Se apagó porque tu nivel bajó de ' + c.nivelNecesario + '.'}
                    </T>
                  </View>
                  <T v="pequeno" c={color.tintaSuave}>Puedes volver a activarla cuando quieras.</T>
                </Tarjeta>
              )}

              <Tarjeta style={s.interruptor}>
                <Icono nombre="lightning-bolt" tinte={c.activo ? color.dinero : color.tintaSuave} />
                <T v="fuerte" style={{ flex: 1 }}>{c.activo ? 'Activada' : 'Apagada'}</T>
                <Switch
                  testID="auto-aceptar-interruptor"
                  value={c.activo}
                  disabled={guardando}
                  onValueChange={(v) => { tocar(); guardar({ activo: v }); }}
                  trackColor={{ true: color.dinero, false: color.borde }}
                  thumbColor="#fff"
                />
              </Tarjeta>

              <T v="etiqueta" c={color.tintaSuave}>Solo si el local está a máximo</T>
              <Opciones valores={DISTANCIAS} actual={c.kmMax} texto={(v) => `${v} km`} alElegir={(v) => guardar({ kmMax: v })} prueba="km" />

              <T v="etiqueta" c={color.tintaSuave}>Y si ganas por lo menos</T>
              <Opciones valores={GANANCIAS} actual={c.gananciaMin} texto={(v) => (v ? pesos(v) : 'Sin mínimo')} alElegir={(v) => guardar({ gananciaMin: v })} prueba="ganancia" />
              <T v="pequeno" c={color.tintaTenue}>La ganancia mínima aplica en los pedidos de la Red MenuBy, donde ves cuánto ganas antes de aceptar.</T>

              {c.maxActivos > 1 && (
                <>
                  <T v="etiqueta" c={color.tintaSuave}>Pedidos a la vez que aceptas solo</T>
                  <Opciones valores={Array.from({ length: c.maxActivos }, (_, i) => i + 1)} actual={c.maxPedidos} texto={(v) => String(v)} alElegir={(v) => guardar({ maxPedidos: v })} prueba="pedidos" />
                </>
              )}

              {!!error && <T v="pequeno" c={color.peligro}>{error}</T>}
            </>
          )}

          <Tarjeta style={{ gap: 6 }}>
            <T v="fuerte">Para que no te la apaguen</T>
            <T v="pequeno" c={color.tintaSuave}>• Solo acepta si estás conectado y con el GPS al día.</T>
            <T v="pequeno" c={color.tintaSuave}>• Cuando acepte solo, sal hacia el local. Si a los 3 minutos no te mueves te avisamos, y a los 5 el pedido pasa a otro domi y te queda una falta.</T>
            <T v="pequeno" c={color.tintaSuave}>• Con 2 pedidos así, se apaga sola. La puedes volver a activar.</T>
            <T v="pequeno" c={color.tintaSuave}>• Tenerla activa te ayuda: si hay otro domi igual de cerca, el pedido te llega a ti.</T>
          </Tarjeta>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Opciones({ valores, actual, texto, alElegir, prueba }: {
  valores: number[]; actual: number; texto: (v: number) => string; alElegir: (v: number) => void; prueba: string;
}) {
  return (
    <View style={s.opciones}>
      {valores.map((v) => (
        <Pressable key={v} testID={`${prueba}-${v}`} onPress={() => { tocar(); alElegir(v); }} style={[s.opcion, actual === v && s.opcionActiva]}>
          <T v="fuerte" c={actual === v ? '#fff' : color.tinta}>{texto(v)}</T>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: color.fondo },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  cuerpo: { padding: 18, gap: 12, paddingBottom: 40 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aviso: { gap: 6, borderWidth: 2, borderColor: color.efectivo },
  interruptor: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcion: { paddingHorizontal: 16, height: 48, borderRadius: radio.total, backgroundColor: color.superficie, borderWidth: 1, borderColor: color.borde, alignItems: 'center', justifyContent: 'center' },
  opcionActiva: { backgroundColor: color.tinta, borderColor: color.tinta },
});
