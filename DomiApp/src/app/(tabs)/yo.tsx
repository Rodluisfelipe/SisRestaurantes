/** Yo: perfil, dónde trabajo, cómo quiero que suene y navegue, y salir. */
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton, Icono, T, Tarjeta, type NombreIcono } from '@/componentes/base';
import { tocar } from '@/lib/aviso';
import { celularBonito } from '@/lib/formato';
import { llamar } from '@/lib/api';
import { pedidosVisibles, useApp } from '@/estado/app';
import { color, radio } from '@/tema';

export default function Yo() {
  const servidor = useApp((s) => s.servidor);
  const locales = useApp((s) => s.locales);
  const ajustes = useApp((s) => s.ajustes);
  const [subiendo, setSubiendo] = useState(false);
  const cuenta = servidor?.cuenta;

  const cambiarFoto = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
      if (r.canceled || !r.assets[0]) return;
      setSubiendo(true);
      const form = new FormData();
      if (Platform.OS === 'web') form.append('foto', await (await fetch(r.assets[0].uri)).blob(), 'perfil.jpg');
      else form.append('foto', { uri: r.assets[0].uri, name: 'perfil.jpg', type: 'image/jpeg' } as unknown as Blob);
      await llamar('/domi-app/perfil/foto', { formulario: form, tiempo: 60_000 });
      await useApp.getState().refrescar();
    } catch {
      /* se intenta otra vez */
    } finally {
      setSubiendo(false);
    }
  };

  const salir = () => {
    const activos = pedidosVisibles(servidor, locales).length;
    const hacer = () => useApp.getState().salir();
    if (Platform.OS === 'web') { hacer(); return; }
    Alert.alert(
      activos ? 'Tienes pedidos en curso' : '¿Cerrar sesión?',
      activos ? `Llevas ${activos} ${activos === 1 ? 'pedido' : 'pedidos'}. Si sales, no podrás marcarlos como entregados desde aquí.` : 'Dejarás de recibir pedidos en este celular.',
      [{ text: 'Cancelar', style: 'cancel' }, { text: 'Salir', style: 'destructive', onPress: hacer }],
    );
  };

  return (
    <SafeAreaView style={s.fondo} edges={['top']}>
      <ScrollView contentContainerStyle={s.cuerpo}>
        <View style={s.perfil}>
          <Pressable onPress={cambiarFoto} style={s.foto} testID="foto-perfil">
            {cuenta?.foto
              ? <Image source={{ uri: cuenta.foto }} style={s.foto} contentFit="cover" />
              : <Icono nombre="account" tam={44} tinte={color.tintaSuave} />}
            <View style={s.camara}><Icono nombre={subiendo ? 'progress-upload' : 'camera'} tam={16} tinte="#fff" /></View>
          </Pressable>
          <T v="titulo" centro>{cuenta?.nombre || 'Domiciliario'}</T>
          <T v="cuerpo" c={color.tintaSuave}>{celularBonito(cuenta?.telefono || '')}</T>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <View style={s.dato}><Icono nombre="star" tam={18} tinte={color.efectivo} /><T v="fuerte">{(cuenta?.calificacion ?? 5).toFixed(1)}</T></View>
            <View style={s.dato}><Icono nombre="package-variant-closed-check" tam={18} tinte={color.dinero} /><T v="fuerte">{cuenta?.totalEntregas ?? 0} entregas</T></View>
          </View>
        </View>

        <T v="etiqueta" c={color.tintaSuave}>Trabajas con</T>
        <Tarjeta style={{ gap: 12 }}>
          {(servidor?.afiliaciones ?? []).map((a) => (
            <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {a.logo
                ? <Image source={{ uri: a.logo }} style={s.logo} />
                : <View style={[s.logo, { alignItems: 'center', justifyContent: 'center', backgroundColor: a.tipo === 'red' ? color.marca : color.fondo }]}><Icono nombre={a.tipo === 'red' ? 'moped' : a.tipo === 'empresa' ? 'account-group' : 'storefront'} tinte={a.tipo === 'red' ? '#fff' : color.tinta} /></View>}
              <View style={{ flex: 1 }}>
                <T v="fuerte">{a.tipo === 'empresa' ? `Asociado a ${a.nombre}` : a.tipo === 'red' ? `${a.detalle || 'Independiente'} · ${a.nombre}` : a.nombre}</T>
                <T v="pequeno" c={color.tintaSuave}>
                  {a.tipo === 'empresa' ? 'Empresa de reparto' : a.tipo === 'red' ? `Repartes para ${a.negocios ?? 0} ${a.negocios === 1 ? 'negocio' : 'negocios'}` : 'Negocio'} · hasta {a.maxActivos} {a.maxActivos === 1 ? 'pedido' : 'pedidos'} a la vez
                </T>
              </View>
            </View>
          ))}
        </Tarjeta>

        <T v="etiqueta" c={color.tintaSuave}>Ajustes</T>
        <Tarjeta style={{ gap: 4, paddingVertical: 8 }}>
          <View style={s.fila}>
            <Icono nombre="navigation-variant" />
            <T v="fuerte" style={{ flex: 1 }}>Navegar con</T>
            <View style={s.segmento}>
              {(['google', 'waze'] as const).map((n) => (
                <Pressable key={n} testID={`navegador-${n}`} onPress={() => { tocar(); useApp.getState().cambiarAjustes({ navegador: n }); }} style={[s.opcion, ajustes.navegador === n && s.opcionActiva]}>
                  <T v="pequeno" c={ajustes.navegador === n ? '#fff' : color.tinta}>{n === 'google' ? 'Google Maps' : 'Waze'}</T>
                </Pressable>
              ))}
            </View>
          </View>
          <Interruptor icono="volume-high" texto="Sonido de pedidos nuevos" valor={ajustes.sonido} alCambiar={(v) => useApp.getState().cambiarAjustes({ sonido: v })} />
          <Interruptor icono="vibrate" texto="Vibrar con pedidos nuevos" valor={ajustes.vibrar} alCambiar={(v) => useApp.getState().cambiarAjustes({ vibrar: v })} />
          <Pressable onPress={() => router.push('/preparar')} style={s.fila} testID="ir-preparar">
            <Icono nombre="cellphone-cog" />
            <T v="fuerte" style={{ flex: 1 }}>Revisar permisos y batería</T>
            <Icono nombre="chevron-right" tinte={color.tintaSuave} />
          </Pressable>
        </Tarjeta>

        <Boton texto="Cerrar sesión" tipo="peligro" icono="logout" alTocar={salir} prueba="salir" />
        <T v="pequeno" c={color.tintaTenue} centro>MenuBy Go 2.0</T>
      </ScrollView>
    </SafeAreaView>
  );
}

function Interruptor({ icono, texto, valor, alCambiar }: { icono: NombreIcono; texto: string; valor: boolean; alCambiar: (v: boolean) => void }) {
  return (
    <View style={s.fila}>
      <Icono nombre={icono} />
      <T v="fuerte" style={{ flex: 1 }}>{texto}</T>
      <Switch value={valor} onValueChange={(v) => { tocar(); alCambiar(v); }} trackColor={{ true: color.dinero, false: color.borde }} thumbColor="#fff" />
    </View>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: color.fondo },
  cuerpo: { padding: 18, gap: 12, paddingBottom: 40 },
  perfil: { alignItems: 'center', gap: 4, paddingVertical: 10 },
  foto: { width: 104, height: 104, borderRadius: 52, backgroundColor: color.superficie, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.borde },
  camara: { position: 'absolute', right: 0, bottom: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: color.tinta, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: color.fondo },
  dato: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: color.superficie, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radio.total },
  logo: { width: 44, height: 44, borderRadius: radio.m },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  segmento: { flexDirection: 'row', backgroundColor: color.fondo, borderRadius: radio.total, padding: 3 },
  opcion: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radio.total },
  opcionActiva: { backgroundColor: color.tinta },
});
