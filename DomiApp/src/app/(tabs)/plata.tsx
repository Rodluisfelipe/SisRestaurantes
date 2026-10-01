/**
 * Mi plata: cuánto gané y cuánto tengo que entregar.
 *
 * El cuadre se dice como se dice en la calle: "Tienes $59.000 de Go Burger.
 * Lo tuyo son $5.000. Entrega $54.000." Sin débitos, créditos ni saldos.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icono, T, Tarjeta } from '@/componentes/base';
import { tocar } from '@/lib/aviso';
import { diaCorto, hora, pesos } from '@/lib/formato';
import { llamar } from '@/lib/api';
import type { Cuadre } from '@/lib/tipos';
import { useApp } from '@/estado/app';
import { color, radio } from '@/tema';

type Ganancias = { entregas: number; ganancias: number; promedio: number; dias: { dia: string; entregas: number; ganancias: number }[] };
type Liquidacion = { _id: string; entregas: number; efectivo: number; ganancias: number; neto: number; createdAt: string; nota?: string };

type DatosPlata = { ganancias: Ganancias; cuadres: Cuadre[]; historial: Liquidacion[] };

async function pedirPlata(rango: number): Promise<DatosPlata> {
  const desde = new Date(Date.now() - (rango - 1) * 86400000);
  desde.setHours(0, 0, 0, 0);
  const [ganancias, cuadre] = await Promise.all([
    llamar<Ganancias>(`/domi-app/ganancias?desde=${desde.toISOString()}`),
    llamar<{ cuadres: Cuadre[]; historial: Liquidacion[] }>('/domi-app/cuadre'),
  ]);
  return { ganancias, cuadres: cuadre.cuadres, historial: cuadre.historial };
}

const RANGOS = [{ dias: 7, texto: '7 días' }, { dias: 30, texto: '30 días' }];

export default function Plata() {
  const servidor = useApp((s) => s.servidor);
  const [rango, setRango] = useState(7);
  const [g, setG] = useState<Ganancias | null>(null);
  const [cuadres, setCuadres] = useState<Cuadre[] | null>(null);
  const [historial, setHistorial] = useState<Liquidacion[]>([]);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);

  const poner = useCallback((d: DatosPlata) => {
    setG(d.ganancias);
    setCuadres(d.cuadres);
    setHistorial(d.historial);
  }, []);

  const entregasHoy = servidor?.hoy.entregas;
  useEffect(() => {
    let vivo = true;
    pedirPlata(rango).then((d) => { if (vivo) poner(d); }).catch(() => { /* sin señal: queda lo último */ });
    return () => { vivo = false; };
  }, [rango, entregasHoy, poner]);

  const cargar = async () => {
    setCargando(true);
    try { poner(await pedirPlata(rango)); } catch { /* sin señal */ }
    setCargando(false);
  };

  const lista = cuadres ?? servidor?.cuadres ?? [];
  const efectivoTotal = lista.reduce((s, c) => s + c.efectivo, 0);
  const aEntregar = lista.reduce((s, c) => s + c.debeEntregar, 0);
  const meDeben = lista.reduce((s, c) => s + c.leDeben, 0);
  const dias = rellenarDias(g?.dias ?? [], rango);
  const max = Math.max(1, ...dias.map((d) => d.ganancias));

  return (
    <SafeAreaView style={s.fondo} edges={['top']}>
      <ScrollView contentContainerStyle={s.cuerpo} refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}>
        <T v="titulo">Mi plata</T>

        {/* Hoy */}
        <View style={s.hoy} testID="plata-hoy">
          <T v="etiqueta" c="rgba(255,255,255,0.7)">Hoy ganaste</T>
          <T v="enorme" c="#fff">{pesos(servidor?.hoy.ganancias ?? 0)}</T>
          <T v="fuerte" c="rgba(255,255,255,0.8)">{servidor?.hoy.entregas ?? 0} {servidor?.hoy.entregas === 1 ? 'entrega' : 'entregas'}</T>
        </View>

        {/* Efectivo */}
        <Tarjeta style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[s.iconoRedondo, { backgroundColor: color.efectivoSuave }]}><Icono nombre="cash-multiple" tinte={color.tinta} /></View>
            <View style={{ flex: 1 }}>
              <T v="etiqueta" c={color.tintaSuave}>Efectivo en tu mano</T>
              <T v="titulo">{pesos(efectivoTotal)}</T>
            </View>
          </View>
          {aEntregar > 0 && (
            <View style={s.linea}><T v="cuerpo" style={{ flex: 1 }}>Debes entregar a los locales</T><T v="fuerte" c={color.marca}>{pesos(aEntregar)}</T></View>
          )}
          {meDeben > 0 && (
            <View style={s.linea}><T v="cuerpo" style={{ flex: 1 }}>Te deben por entregas pagadas en línea</T><T v="fuerte" c={color.dinero}>{pesos(meDeben)}</T></View>
          )}
          {!lista.length && <T v="cuerpo" c={color.tintaSuave}>Estás al día con todos los locales.</T>}
        </Tarjeta>

        {lista.map((c) => (
          <Tarjeta key={c.businessId} style={{ gap: 10 }}>
            <Pressable onPress={() => { tocar(); setAbierto(abierto === c.businessId ? null : c.businessId); }} testID={`cuadre-${c.negocio}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <T v="subtitulo" style={{ flex: 1 }}>{c.negocio}</T>
                <Icono nombre={abierto === c.businessId ? 'chevron-up' : 'chevron-down'} tinte={color.tintaSuave} />
              </View>
              <T v="cuerpo" c={color.tintaSuave} style={{ marginTop: 4 }}>
                {c.entregas} {c.entregas === 1 ? 'entrega' : 'entregas'} sin cuadrar · cobraste {pesos(c.efectivo)} · lo tuyo son {pesos(c.ganancias)}
              </T>
              <View style={[s.resultado, { backgroundColor: c.debeEntregar ? color.marcaSuave : c.leDeben ? color.dineroSuave : color.fondo }]}>
                <T v="fuerte" c={c.debeEntregar ? color.marca : c.leDeben ? color.dinero : color.tinta}>
                  {c.debeEntregar ? `Entrega ${pesos(c.debeEntregar)} al local` : c.leDeben ? `El local te debe ${pesos(c.leDeben)}` : 'Están a paz y salvo'}
                </T>
              </View>
            </Pressable>
            {abierto === c.businessId && c.detalle.map((d) => (
              <View key={d.orderId} style={s.detalle}>
                <View style={{ flex: 1 }}>
                  <T v="fuerte">#{d.numero} · {d.cliente.split(' ')[0]}</T>
                  <T v="pequeno" c={color.tintaSuave}>{hora(d.entregadoAt)} · {d.efectivo ? `cobraste ${pesos(d.efectivo)}` : 'pagado en línea'}</T>
                </View>
                <T v="fuerte" c={color.dinero}>+{pesos(d.ganancia)}</T>
              </View>
            ))}
          </Tarjeta>
        ))}

        {/* Ganancias por día */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <T v="subtitulo" style={{ flex: 1 }}>Tus ganancias</T>
          <View style={s.segmento}>
            {RANGOS.map((r) => (
              <Pressable key={r.dias} onPress={() => { tocar(); setRango(r.dias); }} style={[s.opcion, rango === r.dias && s.opcionActiva]}>
                <T v="pequeno" c={rango === r.dias ? '#fff' : color.tinta}>{r.texto}</T>
              </Pressable>
            ))}
          </View>
        </View>
        <Tarjeta style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Cifra etiqueta="Ganado" valor={pesos(g?.ganancias ?? 0)} tinte={color.dinero} />
            <Cifra etiqueta="Entregas" valor={String(g?.entregas ?? 0)} />
            <Cifra etiqueta="Por entrega" valor={pesos(g?.promedio ?? 0)} />
          </View>
          <View style={s.barras}>
            {dias.slice(-7).map((d) => (
              <View key={d.dia} style={s.columna}>
                <T v="pequeno" c={color.tintaSuave} style={{ fontSize: 11 }}>{d.ganancias ? `${Math.round(d.ganancias / 1000)}k` : ''}</T>
                <View style={[s.barra, { height: 6 + (d.ganancias / max) * 96, backgroundColor: d.ganancias ? color.dinero : color.borde }]} />
                <T v="pequeno" c={color.tintaSuave} style={{ fontSize: 11 }}>{diaCorto(d.dia)}</T>
              </View>
            ))}
          </View>
          {rango > 7 && <T v="pequeno" c={color.tintaTenue} centro>La gráfica muestra los últimos 7 días; los totales son de {rango} días.</T>}
        </Tarjeta>

        {!!historial.length && (
          <>
            <T v="subtitulo" style={{ marginTop: 8 }}>Cuadres cerrados</T>
            {historial.map((h) => (
              <View key={h._id} style={s.historial}>
                <Icono nombre="check-decagram" tinte={color.dinero} />
                <View style={{ flex: 1 }}>
                  <T v="fuerte">{h.entregas} entregas · {new Date(h.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</T>
                  <T v="pequeno" c={color.tintaSuave}>{h.neto >= 0 ? `Entregaste ${pesos(h.neto)}` : `Te pagaron ${pesos(-h.neto)}`}</T>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Cifra({ etiqueta, valor, tinte = color.tinta }: { etiqueta: string; valor: string; tinte?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <T v="etiqueta" c={color.tintaSuave}>{etiqueta}</T>
      <T v="subtitulo" c={tinte}>{valor}</T>
    </View>
  );
}

/** Días sin entregas también se dibujan (en cero), para que la semana se lea completa. */
function rellenarDias(dias: Ganancias['dias'], rango: number) {
  const mapa = new Map(dias.map((d) => [d.dia, d]));
  const out: Ganancias['dias'] = [];
  for (let i = Math.min(rango, 7) - 1; i >= 0; i--) {
    const f = new Date(Date.now() - i * 86400000);
    const clave = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
    out.push(mapa.get(clave) ?? { dia: clave, entregas: 0, ganancias: 0 });
  }
  return out;
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: color.fondo },
  cuerpo: { padding: 18, gap: 12, paddingBottom: 40 },
  hoy: { backgroundColor: color.dinero, borderRadius: radio.xl, padding: 22, gap: 2 },
  iconoRedondo: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  linea: { flexDirection: 'row', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: color.borde },
  resultado: { marginTop: 10, padding: 12, borderRadius: radio.m, alignItems: 'center' },
  detalle: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: color.borde },
  segmento: { flexDirection: 'row', backgroundColor: color.superficie, borderRadius: radio.total, padding: 3, borderWidth: 1, borderColor: color.borde },
  opcion: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radio.total },
  opcionActiva: { backgroundColor: color.tinta },
  barras: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 140 },
  columna: { flex: 1, alignItems: 'center', gap: 4 },
  barra: { width: 22, borderRadius: 7 },
  historial: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radio.m, backgroundColor: color.superficie },
});
