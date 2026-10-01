/**
 * Entregar: cobrar, foto (opcional) y el código del cliente.
 *
 * El código se comprueba en el servidor y la respuesta se espera unos
 * segundos. Sin señal no hay cómo comprobarlo: la entrega queda guardada y se
 * confirma sola al volver la señal; si el código estaba mal, el pedido vuelve
 * a aparecer con el aviso.
 */
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton, Icono, T, Tarjeta } from '@/componentes/base';
import { CabezaPedido } from '@/componentes/CabezaPedido';
import { Deslizar } from '@/componentes/Deslizar';
import { Casillas, Teclado } from '@/componentes/Teclado';
import { exito, fallo, tocar } from '@/lib/aviso';
import { encolarFoto, enviarYEsperar, nuevoId } from '@/lib/cola';
import { pesos, primerNombre, sugerirBilletes } from '@/lib/formato';
import { llamarA } from '@/lib/navegar';
import type { Evento, Pedido } from '@/lib/tipos';
import { MENSAJE_ERROR, useApp } from '@/estado/app';
import { usePedido } from '@/estado/usePedido';
import { color, radio } from '@/tema';

type Fin = { tipo: 'ok' | 'pendiente'; ganancia: number };

export default function Entregar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pedido = usePedido(id);
  const [fin, setFin] = useState<Fin | null>(null);

  if (fin) return <Listo fin={fin} />;
  if (!pedido) {
    return (
      <SafeAreaView style={[s.fondo, { justifyContent: 'center', padding: 24, gap: 16 }]}>
        <T v="titulo">Este pedido ya no está en tu lista</T>
        <Boton texto="Volver a la ruta" tipo="oscuro" alTocar={() => router.replace('/')} />
      </SafeAreaView>
    );
  }
  return <Flujo p={pedido} alTerminar={setFin} />;
}

function Flujo({ p, alTerminar }: { p: Pedido; alTerminar: (f: Fin) => void }) {
  const [cobrado, setCobrado] = useState(p.efectivo === 0);
  const [pagoCon, setPagoCon] = useState<number | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [bloqueado, setBloqueado] = useState(false);
  const nombre = primerNombre(p.cliente.nombre);

  const billetes = sugerirBilletes(p.efectivo);

  const tomarFoto = async () => {
    try {
      const permiso = await ImagePicker.requestCameraPermissionsAsync();
      if (!permiso.granted) return;
      const r = await ImagePicker.launchCameraAsync({ quality: 0.5, allowsEditing: false, exif: false });
      if (!r.canceled && r.assets[0]) setFoto(r.assets[0].uri);
    } catch { /* sin cámara (web): se sigue sin foto */ }
  };

  const entregar = async (conCodigo: string) => {
    setEnviando(true);
    setError('');
    const u = useApp.getState().ubicacion;
    const fotoId = foto ? await encolarFoto(p.id, foto) : undefined;
    const evento: Evento = {
      id: nuevoId(), tipo: 'entregado', pedidoId: p.id, at: new Date().toISOString(),
      ...(u ? { lat: u.lat, lng: u.lng } : {}),
      datos: p.pideCodigoEntrega ? { codigo: conCodigo } : {},
    };
    const r = await enviarYEsperar(evento, fotoId);
    setEnviando(false);
    if (r === 'pendiente') {
      useApp.getState().marcarLocal(p.id, 'entregado');
      exito();
      alTerminar({ tipo: 'pendiente', ganancia: p.ganancia });
      return;
    }
    if (r.ok) {
      useApp.getState().marcarLocal(p.id, 'entregado');
      exito();
      useApp.getState().refrescar();
      alTerminar({ tipo: 'ok', ganancia: p.ganancia });
      return;
    }
    fallo();
    setCodigo('');
    if (r.error === 'codigo_incorrecto') {
      setError(`Ese código no es. ${r.intentosRestantes === 1 ? 'Te queda 1 intento.' : `Te quedan ${r.intentosRestantes} intentos.`} Pídeselo otra vez a ${nombre}.`);
    } else if (r.error === 'codigo_bloqueado') {
      setBloqueado(true);
      setError(MENSAJE_ERROR.codigo_bloqueado);
    } else {
      setError(MENSAJE_ERROR[r.error || ''] || 'No se pudo entregar. Intenta de nuevo.');
    }
  };

  const tecla = (d: string) => {
    if (enviando || bloqueado || codigo.length >= 4) return;
    setError('');
    const n = codigo + d;
    setCodigo(n);
    if (n.length === 4) entregar(n);
  };

  return (
    <View style={s.fondo}>
      <CabezaPedido pedido={p} cerrar />
      <ScrollView contentContainerStyle={s.cuerpo} keyboardShouldPersistTaps="handled">
        {/* 1. Cobrar */}
        {p.efectivo > 0 && (
          <Tarjeta style={[s.bloque, cobrado && s.bloqueHecho]}>
            <View style={s.bloqueCabeza}>
              <Numero n={1} hecho={cobrado} />
              <View style={{ flex: 1 }}>
                <T v="fuerte">Cobra {pesos(p.efectivo)}</T>
                <T v="pequeno" c={color.tintaSuave}>¿Con cuánto te pagó?</T>
              </View>
            </View>
            {!cobrado && (
              <>
                <View style={s.billetes}>
                  {billetes.map((b) => (
                    <Pressable key={b} testID={`billete-${b}`} onPress={() => { tocar(); setPagoCon(b); }} style={[s.billete, pagoCon === b && s.billeteActivo]}>
                      <T v="fuerte" c={pagoCon === b ? '#fff' : color.tinta}>{b === p.efectivo ? 'Exacto' : pesos(b)}</T>
                    </Pressable>
                  ))}
                </View>
                {pagoCon != null && pagoCon > p.efectivo && (
                  <View style={s.vueltas}>
                    <T v="etiqueta" c={color.tinta}>Devuélvele</T>
                    <T v="titulo">{pesos(pagoCon - p.efectivo)}</T>
                  </View>
                )}
                <Boton prueba="ya-cobre" texto="Ya cobré" icono="cash-check" tipo="oscuro" desactivado={pagoCon == null} alTocar={() => setCobrado(true)} />
              </>
            )}
          </Tarjeta>
        )}

        {/* 2. Foto */}
        <Tarjeta style={[s.bloque, !!foto && s.bloqueHecho]}>
          <View style={s.bloqueCabeza}>
            <Numero n={p.efectivo > 0 ? 2 : 1} hecho={!!foto} />
            <View style={{ flex: 1 }}>
              <T v="fuerte">Foto de la entrega</T>
              <T v="pequeno" c={color.tintaSuave}>Opcional. Te cubre si hay un reclamo.</T>
            </View>
            {foto
              ? <Image source={{ uri: foto }} style={s.miniatura} />
              : <Boton texto="Tomar" icono="camera" tipo="claro" compacto alTocar={tomarFoto} />}
          </View>
        </Tarjeta>

        {/* 3. Código o confirmar */}
        {p.pideCodigoEntrega ? (
          <Tarjeta style={[s.bloque, { opacity: cobrado ? 1 : 0.45 }]}>
            <View style={s.bloqueCabeza}>
              <Numero n={p.efectivo > 0 ? 3 : 2} />
              <View style={{ flex: 1 }}>
                <T v="fuerte">Código de {nombre}</T>
                <T v="pequeno" c={color.tintaSuave}>Los 4 números que le llegaron con el pedido.</T>
              </View>
            </View>
            {cobrado && (
              <View style={{ gap: 14, marginTop: 6 }}>
                <Casillas valor={codigo} error={!!error} />
                {!!error && <T v="fuerte" c={color.peligro} centro>{error}</T>}
                {enviando && <T v="fuerte" c={color.tintaSuave} centro>Comprobando…</T>}
                {bloqueado ? (
                  <Boton texto="Llamar al local" icono="phone" tipo="oscuro" alTocar={() => llamarA(p.negocio?.telefono ?? null)} />
                ) : (
                  <Teclado alTecla={tecla} alBorrar={() => setCodigo((c) => c.slice(0, -1))} />
                )}
              </View>
            )}
          </Tarjeta>
        ) : null}
      </ScrollView>
      {!p.pideCodigoEntrega && (
        <SafeAreaView edges={['bottom']} style={s.pie}>
          {!!error && <T v="fuerte" c={color.peligro} centro style={{ marginBottom: 8 }}>{error}</T>}
          <Deslizar prueba="deslizar-confirmar-entrega" texto="Confirmar entrega" fondo={color.dinero} desactivado={!cobrado} cargando={enviando} alConfirmar={() => entregar('')} />
        </SafeAreaView>
      )}
    </View>
  );
}

function Listo({ fin }: { fin: Fin }) {
  useEffect(() => {
    const t = setTimeout(() => router.dismissTo('/'), 2600);
    return () => clearTimeout(t);
  }, []);
  return (
    <SafeAreaView style={[s.fondo, s.listo]} testID="entregado">
      <Animated.View entering={ZoomIn.springify().damping(12)} style={s.circuloListo}>
        <Icono nombre="check-bold" tam={64} tinte="#fff" />
      </Animated.View>
      <Animated.View entering={FadeIn.delay(250)} style={{ alignItems: 'center', gap: 8 }}>
        <T v="titulo" centro>¡Entregado!</T>
        <T v="enorme" c={color.dinero} centro>+{pesos(fin.ganancia)}</T>
        {fin.tipo === 'pendiente' && (
          <T v="cuerpo" c={color.tintaSuave} centro style={{ paddingHorizontal: 30 }}>
            Estás sin señal: la entrega quedó guardada y se confirma sola apenas vuelva.
          </T>
        )}
      </Animated.View>
      <Boton texto="Seguir" tipo="oscuro" alTocar={() => router.dismissTo('/')} style={{ alignSelf: 'stretch', marginHorizontal: 24, marginTop: 20 }} />
    </SafeAreaView>
  );
}

function Numero({ n, hecho }: { n: number; hecho?: boolean }) {
  return (
    <View style={[s.numero, hecho && { backgroundColor: color.dinero }]}>
      {hecho ? <Icono nombre="check-bold" tam={16} tinte="#fff" /> : <T v="fuerte" c="#fff">{n}</T>}
    </View>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: color.fondo },
  cuerpo: { padding: 16, gap: 12, paddingBottom: 40 },
  bloque: { gap: 12, borderWidth: 2, borderColor: 'transparent' },
  bloqueHecho: { borderColor: color.dinero },
  bloqueCabeza: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  numero: { width: 30, height: 30, borderRadius: 15, backgroundColor: color.tinta, alignItems: 'center', justifyContent: 'center' },
  billetes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  billete: { paddingHorizontal: 16, height: 52, borderRadius: radio.m, borderWidth: 2, borderColor: color.borde, justifyContent: 'center', minWidth: '46%', alignItems: 'center', flexGrow: 1 },
  billeteActivo: { backgroundColor: color.tinta, borderColor: color.tinta },
  vueltas: { backgroundColor: color.efectivoSuave, borderRadius: radio.m, padding: 14, alignItems: 'center' },
  miniatura: { width: 54, height: 54, borderRadius: radio.s },
  pie: { backgroundColor: color.superficie, padding: 16, borderTopWidth: 1, borderTopColor: color.borde },
  listo: { alignItems: 'center', justifyContent: 'center', gap: 20 },
  circuloListo: { width: 128, height: 128, borderRadius: 64, backgroundColor: color.dinero, alignItems: 'center', justifyContent: 'center' },
});
