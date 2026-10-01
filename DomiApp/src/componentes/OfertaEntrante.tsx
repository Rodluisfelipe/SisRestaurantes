/**
 * La oferta de un pedido, a pantalla completa.
 *
 * El domi decide en dos segundos, casi siempre en movimiento. Por eso arriba,
 * enorme, lo único que decide: cuánto gana. Debajo, qué tan lejos y si hay
 * que cobrar efectivo. El resto (qué lleva, a quién) cabe después.
 *
 * El tiempo que queda se ve como un aro que se vacía, no como un número que
 * hay que leer.
 */
import { useEffect, useEffectEvent, useState } from 'react';
import { AppState, Modal, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { router } from 'expo-router';
import { callarOferta, exito, fallo, sonarOferta } from '@/lib/aviso';
import { mostrarSobreBloqueo } from '@/lib/sistema';
import { pesos, km, minutos } from '@/lib/formato';
import { llamar, ErrorApi } from '@/lib/api';
import { distanciaKm } from '@/lib/ruta';
import type { Oferta } from '@/lib/tipos';
import { useApp } from '@/estado/app';
import { color, letra, radio } from '@/tema';
import { Boton, Icono, Pastilla, T } from './base';

/* Siempre el mismo arreglo vacío: uno nuevo en cada lectura haría que la
   pantalla creyera que cambió y se redibujara sin parar. */
const SIN_OFERTAS: Oferta[] = [];
const R = 34;
const CIRC = 2 * Math.PI * R;

export function OfertaEntrante() {
  const ofertas = useApp((s) => s.servidor?.ofertas ?? SIN_OFERTAS);
  const ajustes = useApp((s) => s.ajustes);
  const [descartadas, setDescartadas] = useState<string[]>([]);
  // Las vencidas se cierran solas: el temporizador de la tarjeta las descarta al primer tic.
  const oferta = ofertas.find((o) => !descartadas.includes(o.id));

  useEffect(() => {
    if (oferta) sonarOferta(ajustes.sonido, ajustes.vibrar);
    else callarOferta();
    return () => callarOferta();
  }, [oferta, ajustes.sonido, ajustes.vibrar]);

  // Mientras suena: pantalla encendida y encima del bloqueo, como una llamada
  const hayOferta = !!oferta;
  useEffect(() => {
    mostrarSobreBloqueo(hayOferta);
  }, [hayOferta]);

  /* La tarjeta se abre solo con la app al frente: una ventana creada con la
     app atrás no recibe los toques cuando la app sube sola encima de otra. */
  const [alFrente, setAlFrente] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (e) => setAlFrente(e === 'active'));
    return () => sub.remove();
  }, []);

  if (!oferta || !alFrente) return null;
  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={() => {}}>
      <Tarjeta
        key={oferta.id}
        oferta={oferta}
        alTerminar={(id) => { callarOferta(); setDescartadas((d) => [...d, id]); useApp.getState().quitarOferta(id); }}
      />
    </Modal>
  );
}

function Tarjeta({ oferta, alTerminar }: { oferta: Oferta; alTerminar: (id: string) => void }) {
  const p = oferta.pedido;
  const yo = useApp((s) => s.ubicacion);
  // Los segundos que quedaban cuando el servidor la mandó; el temporizador descuenta desde venceAt.
  const total = Math.max(1, oferta.segundos || 30);
  const [quedan, setQuedan] = useState(total);
  const [ocupado, setOcupado] = useState<'' | 'aceptar' | 'rechazar'>('');
  const [error, setError] = useState('');

  const vencio = useEffectEvent(() => alTerminar(oferta.id));
  useEffect(() => {
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((new Date(oferta.venceAt).getTime() - Date.now()) / 1000));
      setQuedan(s);
      if (s <= 0) { clearInterval(t); vencio(); }
    }, 250);
    return () => clearInterval(t);
  }, [oferta.venceAt]);

  const dLocal = distanciaKm(yo, p.negocio?.ubicacion);
  const kmLocal = dLocal != null ? dLocal * 1.3 : oferta.kmAlLocal;
  const kmTotal = (kmLocal ?? 0) + (p.distanciaKm ?? 0) * 1.3;
  const minTotal = kmTotal ? (kmTotal * 60) / 22 + 6 : null;

  const responder = async (acepta: boolean) => {
    setOcupado(acepta ? 'aceptar' : 'rechazar');
    setError('');
    try {
      const r = await llamar<{ pedidoId?: string }>(`/domi-app/ofertas/${oferta.id}/${acepta ? 'aceptar' : 'rechazar'}`, { cuerpo: {} });
      if (acepta) exito();
      alTerminar(oferta.id);
      await useApp.getState().refrescar();
      if (acepta && r.pedidoId) router.push({ pathname: '/pedido/[id]', params: { id: r.pedidoId } });
    } catch (e) {
      fallo();
      setError(e instanceof ErrorApi ? e.message : 'No se pudo. Intenta otra vez.');
      if (e instanceof ErrorApi && e.status === 409) setTimeout(() => alTerminar(oferta.id), 1800);
    } finally {
      setOcupado('');
    }
  };

  const avance = Math.min(1, quedan / total);
  const urgente = quedan <= 10;

  return (
    <View style={s.fondo} testID="oferta">
      <View style={s.arriba}>
        <T v="etiqueta" c="rgba(255,255,255,0.6)">Nuevo pedido</T>
        <View style={s.aro}>
          <Svg width={84} height={84}>
            <Circle cx={42} cy={42} r={R} stroke="rgba(255,255,255,0.15)" strokeWidth={7} fill="none" />
            <Circle
              cx={42} cy={42} r={R} stroke={urgente ? color.efectivo : '#fff'} strokeWidth={7} fill="none"
              strokeDasharray={`${CIRC} ${CIRC}`} strokeDashoffset={CIRC * (1 - avance)} strokeLinecap="round"
              transform="rotate(-90 42 42)"
            />
          </Svg>
          <View style={s.aroNumero}><T v="subtitulo" c="#fff">{quedan}</T></View>
        </View>
      </View>

      <View style={s.centro}>
        <T v="etiqueta" c="rgba(255,255,255,0.55)" centro>Ganas</T>
        <T v="enorme" c="#fff" centro style={s.ganancia}>{pesos(p.ganancia)}</T>
        {!!p.desgloseGanancia?.length && (
          <View style={s.extras} testID="desglose-ganancia">
            {p.desgloseGanancia.filter((d) => !/^Tarifa base|^Redondeo|^Ajuste/.test(d.concepto)).slice(0, 4).map((d) => (
              <View key={d.concepto} style={s.extra}>
                <T v="pequeno" c="rgba(255,255,255,0.85)">{d.concepto} +{pesos(d.valor)}</T>
              </View>
            ))}
          </View>
        )}
        <View style={s.fila}>
          <Dato icono="map-marker-distance" valor={km(kmTotal || null)} texto="recorrido" />
          <View style={s.divisor} />
          <Dato icono="clock-outline" valor={minutos(minTotal)} texto="aprox." />
        </View>
        {p.efectivo > 0
          ? <Pastilla icono="cash" texto={`Cobras ${pesos(p.efectivo)} en efectivo`} fondo={color.efectivo} tinte={color.tinta} />
          : <Pastilla icono="check-circle" texto="Ya está pagado" fondo="rgba(255,255,255,0.12)" tinte="#fff" />}
      </View>

      <View style={s.ruta}>
        <Paso icono="storefront" titulo={p.negocio?.nombre || 'Local'} detalle={kmLocal != null ? `${km(kmLocal)} de ti` : p.negocio?.direccion || ''} />
        <View style={s.lineaRuta} />
        <Paso icono="home-variant" titulo={p.cliente.direccion || 'Dirección del cliente'} detalle={p.distanciaKm != null ? `${km(p.distanciaKm * 1.3)} del local` : ''} />
        <T v="pequeno" c="rgba(255,255,255,0.55)" style={{ marginTop: 10 }}>
          {p.productos.reduce((n, x) => n + x.cantidad, 0)} productos · Pedido #{p.numero}
        </T>
      </View>

      <View style={s.botones}>
        {!!error && <T v="fuerte" c={color.efectivo} centro>{error}</T>}
        <Boton prueba="aceptar-oferta" texto="Aceptar pedido" icono="check-bold" tipo="dinero" cargando={ocupado === 'aceptar'} desactivado={!!ocupado} alTocar={() => responder(true)} style={{ height: 72, borderRadius: radio.xl }} />
        <Boton prueba="rechazar-oferta" texto="No, gracias" tipo="fantasma" desactivado={!!ocupado} cargando={ocupado === 'rechazar'} alTocar={() => responder(false)} style={{ borderColor: 'transparent' }} />
      </View>
    </View>
  );
}

function Dato({ icono, valor, texto }: { icono: 'map-marker-distance' | 'clock-outline'; valor: string; texto: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icono nombre={icono} tam={18} tinte="rgba(255,255,255,0.7)" />
        <T v="subtitulo" c="#fff">{valor}</T>
      </View>
      <T v="pequeno" c="rgba(255,255,255,0.55)">{texto}</T>
    </View>
  );
}

function Paso({ icono, titulo, detalle }: { icono: 'storefront' | 'home-variant'; titulo: string; detalle: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      <View style={s.pasoIcono}><Icono nombre={icono} tam={20} tinte="#fff" /></View>
      <View style={{ flex: 1 }}>
        <T v="fuerte" c="#fff" lineas={1}>{titulo}</T>
        {!!detalle && <T v="pequeno" c="rgba(255,255,255,0.6)" lineas={1}>{detalle}</T>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: color.noche, paddingHorizontal: 22, paddingTop: 56, paddingBottom: 28 },
  arriba: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aro: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  aroNumero: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  centro: { alignItems: 'center', gap: 16, marginTop: 18 },
  ganancia: { fontSize: 64, lineHeight: 70, fontFamily: letra.negra, letterSpacing: -2 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  divisor: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.15)' },
  ruta: { marginTop: 'auto', backgroundColor: color.nocheSuave, borderRadius: radio.l, padding: 16 },
  lineaRuta: { width: 2, height: 16, backgroundColor: 'rgba(255,255,255,0.2)', marginLeft: 17, marginVertical: 4 },
  pasoIcono: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  botones: { gap: 6, marginTop: 18 },
  extras: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: -6 },
  extra: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radio.total, backgroundColor: 'rgba(255,255,255,0.1)' },
});
