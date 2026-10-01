import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ComponentProps } from 'react';
import { Icono, T, type NombreIcono } from '@/componentes/base';
import { tocar } from '@/lib/aviso';
import { color } from '@/tema';

const PESTANAS: Record<string, { texto: string; icono: NombreIcono; iconoActivo: NombreIcono }> = {
  index: { texto: 'Ruta', icono: 'map-outline', iconoActivo: 'map' },
  plata: { texto: 'Mi plata', icono: 'wallet-outline', iconoActivo: 'wallet' },
  yo: { texto: 'Yo', icono: 'account-circle-outline', iconoActivo: 'account-circle' },
};

type PropsBarra = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

function Barra({ state, navigation }: PropsBarra) {
  const abajo = useSafeAreaInsets().bottom;
  return (
    <View style={[s.barra, { paddingBottom: Math.max(abajo, 10) }]}>
      {state.routes.map((r, i) => {
        const p = PESTANAS[r.name];
        if (!p) return null;
        const activa = state.index === i;
        return (
          <Pressable
            key={r.key}
            testID={`pestana-${r.name}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: activa }}
            onPress={() => { tocar(); if (!activa) navigation.navigate(r.name); }}
            style={s.pestana}>
            <View style={[s.pildora, activa && { backgroundColor: color.tinta }]}>
              <Icono nombre={activa ? p.iconoActivo : p.icono} tam={24} tinte={activa ? '#fff' : color.tintaSuave} />
            </View>
            <T v="pequeno" c={activa ? color.tinta : color.tintaSuave}>{p.texto}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Pestanas() {
  return (
    <Tabs tabBar={(p) => <Barra {...p} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="plata" />
      <Tabs.Screen name="yo" />
    </Tabs>
  );
}

const s = StyleSheet.create({
  barra: { flexDirection: 'row', backgroundColor: color.superficie, borderTopWidth: 1, borderTopColor: color.borde, paddingTop: 8 },
  pestana: { flex: 1, alignItems: 'center', gap: 3 },
  pildora: { width: 64, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
