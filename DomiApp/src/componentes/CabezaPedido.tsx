/** Cabecera de las pantallas de un pedido: volver, número, local y avance. */
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EstadoPedido, Pedido } from '@/lib/tipos';
import { color } from '@/tema';
import { Icono, T } from './base';

const PASOS: { estados: EstadoPedido[]; texto: string }[] = [
  { estados: ['hacia_local'], texto: 'Al local' },
  { estados: ['en_local'], texto: 'Recoger' },
  { estados: ['hacia_cliente'], texto: 'Al cliente' },
  { estados: ['con_cliente'], texto: 'Entregar' },
];

export function CabezaPedido({ pedido, cerrar }: { pedido: Pedido; cerrar?: boolean }) {
  const arriba = useSafeAreaInsets().top;
  const actual = PASOS.findIndex((p) => p.estados.includes(pedido.estado));
  return (
    <View style={[s.cabeza, { paddingTop: arriba + 8 }]}>
      <View style={s.fila}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.volver} testID="volver" accessibilityLabel="Volver">
          <Icono nombre={cerrar ? 'close' : 'arrow-left'} tam={26} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T v="fuerte" lineas={1}>{pedido.negocio?.nombre || 'Pedido'}</T>
          <T v="pequeno" c={color.tintaSuave}>
            {pedido.tipo === 'envio' ? `Envío #${pedido.numero} · ${pedido.negocio?.empresa || 'empresa'}` : `Pedido #${pedido.numero}`}
          </T>
        </View>
      </View>
      <View style={s.pasos}>
        {PASOS.map((p, i) => (
          <View key={p.texto} style={{ flex: 1, gap: 5 }}>
            <View style={[s.barra, { backgroundColor: i <= actual ? color.tinta : color.borde }]} />
            <T v="pequeno" c={i === actual ? color.tinta : color.tintaTenue} style={{ fontSize: 12 }}>{p.texto}</T>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  cabeza: { backgroundColor: color.superficie, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: color.borde, gap: 12 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  volver: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: color.fondo },
  pasos: { flexDirection: 'row', gap: 6 },
  barra: { height: 5, borderRadius: 3 },
});
