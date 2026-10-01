/**
 * No pude entregar. Antes de marcarlo se sugiere llamar (la mayoría de los
 * "no responde" se resuelven con una llamada), y el motivo se elige de una
 * lista para que el local sepa qué pasó sin tener que preguntar.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton, Icono, T, Tarjeta, type NombreIcono } from '@/componentes/base';
import { Deslizar } from '@/componentes/Deslizar';
import { tocar } from '@/lib/aviso';
import { primerNombre } from '@/lib/formato';
import { llamarA } from '@/lib/navegar';
import { useApp } from '@/estado/app';
import { usePedido } from '@/estado/usePedido';
import { color, letra, radio } from '@/tema';

const MOTIVOS: { clave: string; texto: string; icono: NombreIcono }[] = [
  { clave: 'cliente_no_responde', texto: 'No contesta ni sale', icono: 'phone-off' },
  { clave: 'direccion_errada', texto: 'La dirección está mal', icono: 'map-marker-off' },
  { clave: 'cliente_rechazo', texto: 'No lo quiso recibir', icono: 'hand-back-left-off' },
  { clave: 'sin_dinero', texto: 'No tenía con qué pagar', icono: 'cash-remove' },
  { clave: 'otro', texto: 'Otra cosa', icono: 'dots-horizontal-circle' },
];

export default function NoEntregado() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePedido(id);
  const [motivo, setMotivo] = useState('');
  const [nota, setNota] = useState('');
  const [hecho, setHecho] = useState(false);

  if (hecho) {
    return (
      <SafeAreaView style={[s.fondo, { justifyContent: 'center', padding: 24, gap: 14 }]}>
        <Icono nombre="storefront" tam={56} tinte={color.marca} />
        <T v="titulo">Le avisamos al local</T>
        <T v="cuerpo" c={color.tintaSuave}>Devuelve el pedido al local y ellos te dicen qué hacer.</T>
        <Boton texto="Volver a la ruta" tipo="oscuro" alTocar={() => router.dismissTo('/')} />
      </SafeAreaView>
    );
  }
  if (!p) {
    return (
      <SafeAreaView style={[s.fondo, { justifyContent: 'center', padding: 24, gap: 16 }]}>
        <T v="titulo">Este pedido ya no está en tu lista</T>
        <Boton texto="Volver" tipo="oscuro" alTocar={() => router.back()} />
      </SafeAreaView>
    );
  }

  const marcar = async () => {
    await useApp.getState().avanzar(p, 'no_entregado', { motivo, ...(nota.trim() ? { nota: nota.trim() } : {}) });
    setHecho(true);
  };

  return (
    <SafeAreaView style={s.fondo} edges={['top', 'bottom']}>
      <View style={s.cabeza}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.cerrar} accessibilityLabel="Cerrar"><Icono nombre="close" tam={26} /></Pressable>
        <T v="subtitulo">No pude entregar</T>
      </View>
      <ScrollView contentContainerStyle={s.cuerpo} keyboardShouldPersistTaps="handled">
        <Tarjeta style={s.llamar}>
          <T v="fuerte" style={{ flex: 1 }}>¿Ya llamaste a {primerNombre(p.cliente.nombre)}? Casi siempre se resuelve con una llamada.</T>
          <Boton texto="Llamar" icono="phone" compacto tipo="oscuro" alTocar={() => llamarA(p.cliente.telefono)} />
        </Tarjeta>
        <T v="fuerte" style={{ marginTop: 8 }}>¿Qué pasó?</T>
        {MOTIVOS.map((m) => (
          <Pressable key={m.clave} testID={`motivo-${m.clave}`} onPress={() => { tocar(); setMotivo(m.clave); }} style={[s.motivo, motivo === m.clave && s.motivoActivo]}>
            <Icono nombre={m.icono} tinte={motivo === m.clave ? '#fff' : color.tinta} />
            <T v="fuerte" c={motivo === m.clave ? '#fff' : color.tinta}>{m.texto}</T>
          </Pressable>
        ))}
        <TextInput
          value={nota}
          onChangeText={setNota}
          maxLength={200}
          placeholder="Algo más que deba saber el local (opcional)"
          placeholderTextColor={color.tintaTenue}
          multiline
          style={s.nota}
        />
      </ScrollView>
      <View style={s.pie}>
        <Deslizar prueba="deslizar-no-entregado" texto="Avisar al local" fondo={color.peligro} icono="alert-octagon" desactivado={!motivo} alConfirmar={marcar} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: color.fondo },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: color.borde, backgroundColor: color.superficie },
  cerrar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: color.fondo },
  cuerpo: { padding: 16, gap: 10 },
  llamar: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.infoSuave, shadowOpacity: 0, elevation: 0 },
  motivo: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 58, paddingHorizontal: 16, borderRadius: radio.m, borderWidth: 2, borderColor: color.borde, backgroundColor: color.superficie },
  motivoActivo: { backgroundColor: color.tinta, borderColor: color.tinta },
  nota: { minHeight: 80, borderRadius: radio.m, borderWidth: 2, borderColor: color.borde, backgroundColor: color.superficie, padding: 14, fontFamily: letra.normal, fontSize: 16, color: color.tinta, textAlignVertical: 'top' },
  pie: { padding: 16, borderTopWidth: 1, borderTopColor: color.borde, backgroundColor: color.superficie },
});
