/**
 * Un pedido, paso a paso. Cada etapa dice UNA cosa que hacer, trae a la mano
 * lo que se necesita para hacerla y se cierra deslizando.
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Accion, Boton, Icono, Pastilla, T, Tarjeta } from '@/componentes/base';
import { CabezaPedido } from '@/componentes/CabezaPedido';
import { Deslizar } from '@/componentes/Deslizar';
import { Casillas, Teclado } from '@/componentes/Teclado';
import { tocar } from '@/lib/aviso';
import { km, minutos, pesos, primerNombre } from '@/lib/formato';
import { llamarA, navegarA, whatsappA } from '@/lib/navegar';
import { distanciaKm } from '@/lib/ruta';
import type { Pedido } from '@/lib/tipos';
import { useApp } from '@/estado/app';
import { usePedido } from '@/estado/usePedido';
import { color, radio } from '@/tema';

export default function PantallaPedido() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pedido = usePedido(id);
  const error = useApp((s) => (id ? s.errores[id] : ''));
  const guardando = useApp((s) => !!(id && s.locales[id]));

  if (!pedido) {
    return (
      <SafeAreaView style={[s.fondo, { justifyContent: 'center', padding: 24, gap: 16 }]}>
        <Icono nombre="check-circle-outline" tam={56} tinte={color.dinero} />
        <T v="titulo">Este pedido ya no está en tu lista</T>
        <T v="cuerpo" c={color.tintaSuave}>Puede que ya lo entregaste o que el local lo cambió.</T>
        <Boton texto="Volver a la ruta" tipo="oscuro" alTocar={() => router.replace('/')} />
      </SafeAreaView>
    );
  }

  return (
    <View style={s.fondo}>
      <CabezaPedido pedido={pedido} />
      {!!error && (
        <Pressable onPress={() => useApp.getState().limpiarError(pedido.id)} style={s.error} testID="error-pedido">
          <Icono nombre="alert-circle" tinte={color.peligro} />
          <T v="fuerte" c={color.peligro} style={{ flex: 1 }}>{error}</T>
          <Icono nombre="close" tinte={color.peligro} tam={18} />
        </Pressable>
      )}
      {pedido.estado === 'hacia_local' && <HaciaLocal p={pedido} />}
      {pedido.estado === 'en_local' && <EnLocal p={pedido} />}
      {pedido.estado === 'hacia_cliente' && <HaciaCliente p={pedido} />}
      {pedido.estado === 'con_cliente' && <ConCliente p={pedido} />}
      {guardando && (
        <View style={s.guardando} pointerEvents="none">
          <Icono nombre="cloud-check-outline" tam={15} tinte={color.tintaSuave} />
          <T v="pequeno" c={color.tintaSuave}>Guardado</T>
        </View>
      )}
    </View>
  );
}

function Pie({ children }: { children: React.ReactNode }) {
  return <SafeAreaView edges={['bottom']} style={s.pie}>{children}</SafeAreaView>;
}

function useDistancia(destino: Pedido['cliente']['ubicacion']) {
  const yo = useApp((s) => s.ubicacion);
  const d = distanciaKm(yo, destino);
  return d == null ? null : d * 1.3;
}

/* ── 1. Ir al local ── */
function HaciaLocal({ p }: { p: Pedido }) {
  const navegador = useApp((s) => s.ajustes.navegador);
  const d = useDistancia(p.negocio?.ubicacion ?? null);
  return (
    <>
      <ScrollView contentContainerStyle={s.cuerpo}>
        <T v="etiqueta" c={color.marca}>Paso 1 · Ve al local</T>
        <T v="titulo">Recoge en {p.negocio?.nombre}</T>
        <T v="cuerpo" c={color.tintaSuave}>{p.negocio?.direccion || 'Dirección no registrada'}</T>
        <FotosLocal fotos={p.negocio?.fotos} />
        <View style={s.filaDatos}>
          {d != null && <Pastilla icono="map-marker-distance" texto={`${km(d)} · ${minutos((d * 60) / 22)}`} fondo={color.fondo} tinte={color.tinta} />}
          {p.listoEnLocal && <Pastilla icono="check-circle" texto="Ya está listo" fondo={color.dineroSuave} tinte={color.dinero} />}
        </View>
        <View style={s.acciones}>
          <Accion prueba="navegar" icono="navigation-variant" texto="Cómo llegar" fondo={color.tinta} tinte="#fff" alTocar={() => navegarA(p.negocio?.ubicacion ?? null, p.negocio?.direccion ?? '', navegador)} />
          <Accion icono="phone" texto="Llamar al local" alTocar={() => llamarA(p.negocio?.telefono ?? null)} />
        </View>
        <Resumen p={p} />
      </ScrollView>
      <Pie>
        <Deslizar prueba="deslizar-llegue-local" texto="Llegué al local" alConfirmar={() => useApp.getState().avanzar(p, 'llegue_local')} />
      </Pie>
    </>
  );
}

/** Cómo se ve el local desde la calle: se toca para verla en grande. */
function FotosLocal({ fotos }: { fotos?: string[] }) {
  const [grande, setGrande] = useState<string | null>(null);
  if (!fotos?.length) return null;
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }} style={{ marginHorizontal: -20 }}>
        <View style={{ width: 10 }} />
        {fotos.map((url) => (
          <Pressable key={url} onPress={() => setGrande(url)} testID="foto-local" accessibilityLabel="Ver foto del local">
            <Image source={url} style={[s.fotoLocal, fotos.length === 1 && { width: 300 }]} contentFit="cover" transition={150} />
          </Pressable>
        ))}
        <View style={{ width: 10 }} />
      </ScrollView>
      <Modal visible={!!grande} transparent animationType="fade" onRequestClose={() => setGrande(null)} statusBarTranslucent>
        <Pressable style={s.fotoGrande} onPress={() => setGrande(null)}>
          {grande && <Image source={grande} style={{ width: '100%', height: '75%' }} contentFit="contain" />}
          <View style={s.cerrarFoto}>
            <Icono nombre="close" tinte="#fff" />
            <T v="fuerte" c="#fff">Cerrar</T>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/* ── 2. En el local: revisar y recoger ── */
function EnLocal({ p }: { p: Pedido }) {
  const [revisados, setRevisados] = useState<number[]>([]);
  const [codigo, setCodigo] = useState('');
  const todos = revisados.length === p.productos.length;
  const faltaCodigo = p.pideCodigoRecogida && codigo.length < 4;
  const recoger = () => useApp.getState().avanzar(p, 'recogido', p.pideCodigoRecogida ? { codigo } : undefined);
  return (
    <>
      <ScrollView contentContainerStyle={s.cuerpo}>
        <T v="etiqueta" c={color.marca}>Paso 2 · Revisa antes de salir</T>
        <T v="titulo">¿Está todo?</T>
        <T v="cuerpo" c={color.tintaSuave}>Toca cada cosa a medida que la revisas. Así no vuelves por lo que faltó.</T>
        <View style={{ gap: 8, marginTop: 6 }}>
          {p.productos.map((x, i) => {
            const ok = revisados.includes(i);
            return (
              <Pressable
                key={i}
                testID={`producto-${i}`}
                onPress={() => { tocar(); setRevisados((r) => (ok ? r.filter((y) => y !== i) : [...r, i])); }}
                style={[s.producto, ok && { borderColor: color.dinero, backgroundColor: color.dineroSuave }]}>
                <View style={[s.check, ok && { backgroundColor: color.dinero, borderColor: color.dinero }]}>
                  {ok && <Icono nombre="check-bold" tam={18} tinte="#fff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <T v="fuerte">{x.cantidad} × {x.nombre}</T>
                  {!!x.extras.length && <T v="pequeno" c={color.tintaSuave}>Con {x.extras.join(', ')}</T>}
                  {!!x.notas && <T v="pequeno" c={color.efectivo}>Nota: {x.notas}</T>}
                </View>
              </Pressable>
            );
          })}
        </View>
        {p.efectivo > 0 && (
          <Tarjeta style={[s.cobro, { marginTop: 8 }]}>
            <Icono nombre="cash" tinte={color.tinta} />
            <T v="fuerte" style={{ flex: 1 }}>Vas a cobrar {pesos(p.efectivo)} en efectivo. Lleva cambio.</T>
          </Tarjeta>
        )}
        {p.pideCodigoRecogida && (
          <View style={{ gap: 12, marginTop: 10 }}>
            <T v="fuerte">Código de recogida (te lo da el local)</T>
            <Casillas valor={codigo} />
            <Teclado alTecla={(d) => setCodigo((c) => (c + d).slice(0, 4))} alBorrar={() => setCodigo((c) => c.slice(0, -1))} />
          </View>
        )}
      </ScrollView>
      <Pie>
        {!todos && p.productos.length > 0 && (
          <T v="pequeno" c={color.tintaSuave} centro style={{ marginBottom: 8 }}>
            Revisaste {revisados.length} de {p.productos.length}
          </T>
        )}
        <Deslizar prueba="deslizar-recogi" texto="Recogí el pedido" fondo={color.marca} desactivado={faltaCodigo} alConfirmar={recoger} />
      </Pie>
    </>
  );
}

/* ── 3. Llevarlo al cliente ── */
function HaciaCliente({ p }: { p: Pedido }) {
  const navegador = useApp((s) => s.ajustes.navegador);
  const d = useDistancia(p.cliente.ubicacion);
  const nombre = primerNombre(p.cliente.nombre);
  const mensaje = `Hola ${nombre}, soy tu domiciliario de ${p.negocio?.nombre || 'tu pedido'}. Voy en camino${d != null ? `, llego en unos ${Math.max(2, Math.round((d * 60) / 22))} min` : ''}.`;
  return (
    <>
      <ScrollView contentContainerStyle={s.cuerpo}>
        <T v="etiqueta" c={color.marca}>Paso 3 · Llévalo al cliente</T>
        <T v="titulo">Para {nombre}</T>
        <T v="subtitulo" style={{ marginTop: 2 }}>{p.cliente.direccion || 'Sin dirección'}</T>
        {!!p.cliente.notas && (
          <View style={s.nota}>
            <Icono nombre="message-alert" tinte={color.tinta} />
            <T v="fuerte" style={{ flex: 1 }}>{p.cliente.notas}</T>
          </View>
        )}
        <View style={s.filaDatos}>
          {d != null && <Pastilla icono="map-marker-distance" texto={`${km(d)} · ${minutos((d * 60) / 22)}`} fondo={color.fondo} tinte={color.tinta} />}
          {!p.cliente.ubicacion && <Pastilla icono="map-marker-question" texto="Sin punto en el mapa: usa la dirección" fondo={color.efectivoSuave} tinte={color.tinta} />}
        </View>
        <View style={s.acciones}>
          <Accion prueba="navegar" icono="navigation-variant" texto="Cómo llegar" fondo={color.tinta} tinte="#fff" alTocar={() => navegarA(p.cliente.ubicacion, p.cliente.direccion, navegador)} />
          <Accion icono="phone" texto="Llamar" alTocar={() => llamarA(p.cliente.telefono)} />
          <Accion icono="whatsapp" texto="WhatsApp" tinte="#128C4B" alTocar={() => whatsappA(p.cliente.telefono, mensaje)} />
        </View>
        <Cobro p={p} />
        <Boton texto="No pude entregar" tipo="fantasma" compacto icono="alert-octagon-outline" alTocar={() => router.push({ pathname: '/no-entregado/[id]', params: { id: p.id } })} />
      </ScrollView>
      <Pie>
        <Deslizar prueba="deslizar-llegue-cliente" texto={`Llegué donde ${nombre}`} alConfirmar={() => useApp.getState().avanzar(p, 'llegue_cliente')} />
      </Pie>
    </>
  );
}

/* ── 4. Con el cliente ── */
function ConCliente({ p }: { p: Pedido }) {
  const nombre = primerNombre(p.cliente.nombre);
  return (
    <>
      <ScrollView contentContainerStyle={s.cuerpo}>
        <T v="etiqueta" c={color.marca}>Paso 4 · Entrega</T>
        <T v="titulo">Entrégale a {nombre}</T>
        <T v="cuerpo" c={color.tintaSuave}>{p.cliente.direccion}</T>
        <Cobro p={p} grande />
        {p.pideCodigoEntrega && (
          <Tarjeta style={s.cobro}>
            <Icono nombre="numeric" tinte={color.info} />
            <T v="fuerte" style={{ flex: 1 }}>Pídele a {nombre} el código de 4 números que le llegó con su pedido.</T>
          </Tarjeta>
        )}
        <View style={s.acciones}>
          <Accion icono="phone" texto="Llamar" alTocar={() => llamarA(p.cliente.telefono)} />
          <Accion icono="whatsapp" texto="WhatsApp" tinte="#128C4B" alTocar={() => whatsappA(p.cliente.telefono, `Hola ${nombre}, ya estoy afuera con tu pedido.`)} />
        </View>
        <Boton texto="No pude entregar" tipo="fantasma" compacto icono="alert-octagon-outline" alTocar={() => router.push({ pathname: '/no-entregado/[id]', params: { id: p.id } })} />
      </ScrollView>
      <Pie>
        <Deslizar prueba="deslizar-entregar" texto="Entregar pedido" fondo={color.dinero} icono="package-variant-closed-check" alConfirmar={() => router.push({ pathname: '/entregar/[id]', params: { id: p.id } })} />
      </Pie>
    </>
  );
}

function Cobro({ p, grande }: { p: Pedido; grande?: boolean }) {
  if (p.efectivo > 0) {
    return (
      <View style={[s.cobroGrande, !grande && { paddingVertical: 14 }]} testID="cobro">
        <T v="etiqueta" c={color.tinta}>Cobra en efectivo</T>
        <T v={grande ? 'enorme' : 'titulo'} c={color.tinta}>{pesos(p.efectivo)}</T>
      </View>
    );
  }
  return (
    <View style={[s.cobroGrande, { backgroundColor: color.dineroSuave }, !grande && { paddingVertical: 14 }]} testID="cobro">
      <T v="etiqueta" c={color.dinero}>No cobres nada</T>
      <T v={grande ? 'titulo' : 'subtitulo'} c={color.dinero}>Ya está pagado</T>
    </View>
  );
}

function Resumen({ p }: { p: Pedido }) {
  return (
    <Tarjeta style={{ gap: 6, shadowOpacity: 0, elevation: 0, backgroundColor: color.fondo }}>
      <T v="etiqueta" c={color.tintaSuave}>Lo que vas a recoger</T>
      {p.productos.map((x, i) => (
        <T key={i} v="cuerpo">{x.cantidad} × {x.nombre}</T>
      ))}
      <View style={{ height: 1, backgroundColor: color.borde, marginVertical: 4 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T v="cuerpo" c={color.tintaSuave}>Para {primerNombre(p.cliente.nombre)}</T>
        <T v="fuerte" c={color.dinero}>Ganas {pesos(p.ganancia)}</T>
      </View>
    </Tarjeta>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: color.fondo },
  cuerpo: { padding: 20, gap: 12, paddingBottom: 30 },
  filaDatos: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  acciones: { flexDirection: 'row', gap: 18, marginVertical: 6 },
  pie: { backgroundColor: color.superficie, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: color.borde },
  error: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: color.peligroSuave },
  guardando: { position: 'absolute', right: 16, bottom: 112, flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: color.superficie, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radio.total },
  producto: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radio.m, borderWidth: 2, borderColor: color.borde, backgroundColor: color.superficie },
  check: { width: 30, height: 30, borderRadius: 8, borderWidth: 2, borderColor: color.tintaTenue, alignItems: 'center', justifyContent: 'center' },
  nota: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: radio.m, backgroundColor: color.efectivoSuave },
  cobro: { flexDirection: 'row', gap: 12, alignItems: 'center', shadowOpacity: 0, elevation: 0, backgroundColor: color.fondo },
  cobroGrande: { backgroundColor: color.efectivo, borderRadius: radio.l, padding: 20, gap: 2 },
  fotoLocal: { width: 220, height: 140, borderRadius: radio.m, backgroundColor: color.borde },
  fotoGrande: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  cerrarFoto: { position: 'absolute', bottom: 50, flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: radio.total, backgroundColor: 'rgba(255,255,255,0.15)' },
});
