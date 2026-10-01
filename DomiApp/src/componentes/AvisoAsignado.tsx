/**
 * "Te asignaron un pedido": cuando el negocio se lo manda directo (sin oferta).
 *
 * Suena y vibra como una oferta hasta que el domi lo ve, porque una
 * notificación que suena una vez se pierde en la moto. No hay que aceptar ni
 * rechazar: ya es suyo. El botón lo lleva al pedido.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Modal, StyleSheet, View } from 'react-native';
import { callarOferta, sonarOferta } from '@/lib/aviso';
import { pesos, primerNombre } from '@/lib/formato';
import { cancelarLlamada, clavePedido, mostrarSobreBloqueo } from '@/lib/sistema';
import { useTimbre } from '@/lib/useTimbre';
import { useApp } from '@/estado/app';
import { color, letra, radio } from '@/tema';
import { Boton, Icono, T } from './base';

const NINGUNO: string[] = [];

export function AvisoAsignado() {
  const nuevos = useApp((s) => (s.asignadosNuevos.length ? s.asignadosNuevos : NINGUNO));
  const pedidos = useApp((s) => s.servidor?.pedidos);
  const ajustes = useApp((s) => s.ajustes);
  const hay = nuevos.length > 0;
  // Suena la app solo cuando el domi la ve; antes timbra la llamada del sistema
  const suena = useTimbre(nuevos.map(clavePedido));

  useEffect(() => {
    if (suena) sonarOferta(ajustes.sonido, ajustes.vibrar);
    else callarOferta();
  }, [suena, ajustes.sonido, ajustes.vibrar]);

  useEffect(() => {
    mostrarSobreBloqueo(hay);
  }, [hay]);

  // Como la oferta: la ventana se abre con la app al frente (si no, no recibe los toques)
  const [alFrente, setAlFrente] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (e) => setAlFrente(e === 'active'));
    return () => sub.remove();
  }, []);

  const p = pedidos?.find((x) => x.id === nuevos[0]);
  const visible = hay && alFrente && !!p;

  if (!visible || !p) return null;

  const ver = () => {
    callarOferta();
    nuevos.forEach((id) => cancelarLlamada(clavePedido(id)));
    useApp.getState().yaVistos(nuevos);
    router.push({ pathname: '/pedido/[id]', params: { id: p.id } });
  };

  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={ver}>
      <View style={s.fondo} testID="aviso-asignado">
        <View style={s.centro}>
          <View style={s.icono}><Icono nombre="moped" tam={44} tinte="#fff" /></View>
          <T v="etiqueta" c={color.marca} centro>{nuevos.length > 1 ? `${nuevos.length} pedidos nuevos` : p.automatico ? 'Aceptado automáticamente' : 'Pedido nuevo'}</T>
          <T v="titulo" centro>{p.automatico ? `Aceptaste el pedido #${p.numero} de ${p.negocio?.nombre || 'el negocio'}` : `${p.negocio?.nombre || 'El negocio'} te asignó el pedido #${p.numero}`}</T>
          {p.ganancia > 0 && <T v="enorme" c={color.dinero} centro style={s.ganancia}>{pesos(p.ganancia)}</T>}
        </View>

        <View style={s.ruta}>
          <View style={s.paso}>
            <View style={s.pasoIcono}><Icono nombre="storefront" tam={20} tinte={color.tinta} /></View>
            <View style={{ flex: 1 }}>
              <T v="fuerte" lineas={1}>{p.negocio?.nombre || 'Local'}</T>
              {!!p.negocio?.direccion && <T v="pequeno" c={color.tintaSuave} lineas={1}>{p.negocio.direccion}</T>}
            </View>
          </View>
          <View style={s.lineaRuta} />
          <View style={s.paso}>
            <View style={s.pasoIcono}><Icono nombre="home-variant" tam={20} tinte={color.tinta} /></View>
            <View style={{ flex: 1 }}>
              <T v="fuerte" lineas={1}>Para {primerNombre(p.cliente.nombre)}</T>
              <T v="pequeno" c={color.tintaSuave} lineas={1}>{p.cliente.direccion || 'Sin dirección'}</T>
            </View>
          </View>
          {p.efectivo > 0 && <T v="fuerte" c={color.tinta} style={{ marginTop: 10 }}>Cobras {pesos(p.efectivo)} en efectivo</T>}
        </View>

        <Boton prueba="ver-asignado" texto="Ver pedido" icono="arrow-right" tipo="dinero" alTocar={ver} style={{ height: 72, borderRadius: radio.xl, marginTop: 18 }} />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: color.fondo, paddingHorizontal: 22, paddingTop: 70, paddingBottom: 28 },
  centro: { alignItems: 'center', gap: 12 },
  icono: { width: 88, height: 88, borderRadius: 44, backgroundColor: color.marca, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  ganancia: { fontSize: 56, lineHeight: 62, fontFamily: letra.negra, letterSpacing: -2, marginTop: 6 },
  ruta: { marginTop: 'auto', backgroundColor: color.superficie, borderRadius: radio.l, padding: 16, borderWidth: 1, borderColor: color.borde },
  paso: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  pasoIcono: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.fondo, alignItems: 'center', justifyContent: 'center' },
  lineaRuta: { width: 2, height: 16, backgroundColor: color.borde, marginLeft: 17, marginVertical: 4 },
});
