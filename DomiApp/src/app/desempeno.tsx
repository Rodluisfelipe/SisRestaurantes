/**
 * Mi nivel. Pensado como las apps grandes: una tarjeta tipo membresía con el
 * nivel y la barra hacia el siguiente, los números contra la meta (barras que
 * se llenan), los niveles como tarjetas que se deslizan, y las faltas con su
 * botón de reclamar. Las reglas, plegadas en "¿Cómo funciona?".
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton, Icono, T, type NombreIcono } from '@/componentes/base';
import { Cabecera } from '@/componentes/Cabecera';
import { Degradado } from '@/componentes/Degradado';
import { ErrorApi, llamar } from '@/lib/api';
import { exito, tocar } from '@/lib/aviso';
import { fechaCorta } from '@/lib/formato';
import { aspectoNivel } from '@/lib/niveles';
import type { Desempeno } from '@/lib/tipos';
import { color, letra, radio } from '@/tema';

type Requisitos = NonNullable<Desempeno['niveles'][number]['requisitos']>;

export default function MiNivel() {
  const [d, setD] = useState<Desempeno | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setD(await llamar<Desempeno>('/domi-app/desempeno'));
      setError('');
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos cargar tu nivel.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <SafeAreaView style={s.fondo} edges={['top', 'bottom']}>
      <Cabecera titulo="Mi nivel" />
      {!d ? (
        <View style={s.centro}>
          {error ? <><T v="cuerpo" centro>{error}</T><Boton texto="Reintentar" tipo="oscuro" compacto alTocar={cargar} style={{ marginTop: 12 }} /></> : <ActivityIndicator color={color.marca} />}
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.cuerpo} refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}>
          <TarjetaNivel d={d} />
          <Metas d={d} />
          <Niveles d={d} />
          <Faltas d={d} alCambiar={cargar} />
          <ComoFunciona />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* ── La tarjeta del nivel (tipo membresía) ── */

function TarjetaNivel({ d }: { d: Desempeno }) {
  const a = aspectoNivel(d.nivel.id);
  const sig = d.siguiente ? d.niveles.find((n) => n.id === d.siguiente!.id)?.requisitos : null;
  const avance = sig ? Math.min(1, d.metricas.entregas / sig.entregas) : 1;

  return (
    <View style={s.tarjeta} testID="nivel-actual">
      <Degradado colores={a.degradado} />
      {/* El ícono del nivel, grande y tenue, como marca de agua */}
      <View style={s.marcaAgua} pointerEvents="none"><Icono nombre={a.icono} tam={170} tinte="rgba(255,255,255,0.08)" /></View>

      <View style={s.filaTarjeta}>
        <View style={[s.chipIcono, { backgroundColor: 'rgba(255,255,255,0.16)' }]}><Icono nombre={a.icono} tam={22} tinte={a.acento} /></View>
        <T v="etiqueta" c="rgba(255,255,255,0.75)">MenuBy Go</T>
        {d.nivel.enRiesgo && (
          <View style={s.riesgo}><Icono nombre="alert" tam={14} tinte="#3B2600" /><T v="pequeno" c="#3B2600" style={{ fontFamily: letra.fuerte }}>En riesgo</T></View>
        )}
      </View>

      <T c={a.acento} style={s.nombreNivel}>{d.nivel.nombre}</T>
      <T v="cuerpo" c="rgba(255,255,255,0.85)">{d.nivel.beneficio}</T>

      <View style={s.separador} />
      {d.siguiente && sig ? (
        <>
          <View style={s.filaTarjeta}>
            <T v="pequeno" c="rgba(255,255,255,0.75)" style={{ flex: 1 }}>Siguiente: <T v="pequeno" c="#fff" style={{ fontFamily: letra.fuerte }}>{d.siguiente.nombre}</T></T>
            <T v="pequeno" c="#fff" style={{ fontFamily: letra.fuerte }}>{Math.min(d.metricas.entregas, sig.entregas)} / {sig.entregas} entregas</T>
          </View>
          <View style={s.barraTarjeta}><View style={[s.llenoTarjeta, { width: `${Math.round(avance * 100)}%`, backgroundColor: a.acento }]} /></View>
        </>
      ) : (
        <View style={s.filaTarjeta}><Icono nombre="trophy" tam={18} tinte={a.acento} /><T v="fuerte" c="#fff">Estás en el nivel más alto</T></View>
      )}
      {d.nivel.enRiesgo && d.nivel.revisionAt && (
        <T v="pequeno" c="rgba(255,255,255,0.8)" style={{ marginTop: 8 }}>Mantienes {d.nivel.nombre} hasta la revisión del {fechaCorta(d.nivel.revisionAt)}.</T>
      )}
    </View>
  );
}

/* ── Los números contra la meta ── */

const METRICAS: { clave: keyof Requisitos; texto: string; icono: NombreIcono; formato: (v: number) => string; ayuda: string }[] = [
  { clave: 'entregas', texto: 'Entregas', icono: 'package-variant-closed-check', formato: (v) => String(v), ayuda: 'En los últimos 30 días' },
  { clave: 'cumplimiento', texto: 'Cumplimiento', icono: 'check-decagram', formato: (v) => `${v} %`, ayuda: 'Pedidos que cumpliste de los que tomaste' },
  { clave: 'puntualidad', texto: 'Puntualidad', icono: 'clock-check-outline', formato: (v) => `${v} %`, ayuda: 'Desde que recoges hasta que entregas' },
  { clave: 'calificacion', texto: 'Calificación', icono: 'star', formato: (v) => v.toFixed(1), ayuda: 'Lo que te califican' },
];

function Metas({ d }: { d: Desempeno }) {
  // En riesgo: lo que pide su nivel para mantenerlo. Si no: lo que pide el siguiente.
  const objetivo = d.nivel.enRiesgo ? d.nivel.id : d.siguiente?.id ?? d.nivel.id;
  const req = d.niveles.find((n) => n.id === objetivo)?.requisitos;
  const nombre = d.niveles.find((n) => n.id === objetivo)?.nombre;
  const titulo = !req ? 'Tus números' : d.nivel.enRiesgo ? `Para mantener ${nombre}` : d.siguiente ? `Para llegar a ${nombre}` : `Para mantener ${nombre}`;

  return (
    <View style={{ gap: 10 }}>
      <View style={s.tituloSeccion}>
        <T v="subtitulo">{titulo}</T>
        <T v="pequeno" c={color.tintaSuave}>Últimos 30 días</T>
      </View>
      <View style={s.metas}>
        {METRICAS.map((m) => {
          const valor = d.metricas[m.clave];
          const meta = req?.[m.clave] ?? null;
          const cumple = meta == null || valor >= meta;
          const avance = meta == null ? 1 : Math.max(0.04, Math.min(1, valor / meta));
          return (
            <View key={m.clave} style={s.meta}>
              <View style={[s.metaIcono, { backgroundColor: cumple ? color.dineroSuave : color.efectivoSuave }]}>
                <Icono nombre={m.icono} tam={20} tinte={cumple ? color.dinero : '#B07400'} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={s.filaMeta}>
                  <T v="fuerte" style={{ flex: 1 }}>{m.texto}</T>
                  <T v="fuerte" style={{ fontFamily: letra.negra }}>{m.formato(valor)}</T>
                  {meta != null && <T v="pequeno" c={color.tintaSuave}> / {m.formato(meta)}</T>}
                </View>
                {meta != null && (
                  <View style={s.barra}><View style={[s.lleno, { width: `${Math.round(avance * 100)}%`, backgroundColor: cumple ? color.dinero : color.efectivo }]} /></View>
                )}
                <T v="pequeno" c={color.tintaTenue}>{cumple && meta != null ? '¡Cumplido!' : m.ayuda}</T>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ── Los niveles, como tarjetas que se deslizan ── */

function Niveles({ d }: { d: Desempeno }) {
  const { width } = useWindowDimensions();
  const ancho = Math.min(260, width * 0.62);
  const lista = useRef<ScrollView>(null);
  useEffect(() => {
    const t = setTimeout(() => lista.current?.scrollTo({ x: Math.max(0, d.nivel.id * (ancho + 12) - 20), animated: false }), 50);
    return () => clearTimeout(t);
  }, [d.nivel.id, ancho]);

  return (
    <View style={{ gap: 10 }}>
      <View style={s.tituloSeccion}><T v="subtitulo">Los niveles</T></View>
      <ScrollView ref={lista} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 18 }} style={{ marginHorizontal: -18, paddingLeft: 18 }} snapToInterval={ancho + 12} decelerationRate="fast">
        {d.niveles.map((n) => {
          const a = aspectoNivel(n.id);
          const actual = n.id === d.nivel.id;
          return (
            <View key={n.id} style={[s.mini, { width: ancho }, !n.logrado && { opacity: 0.55 }]}>
              <Degradado colores={a.degradado} />
              <View style={s.filaTarjeta}>
                <Icono nombre={a.icono} tam={22} tinte={a.acento} />
                <View style={{ flex: 1 }} />
                {actual ? <View style={s.tu}><T v="pequeno" c={color.tinta} style={{ fontFamily: letra.fuerte }}>Tú</T></View>
                  : !n.logrado ? <Icono nombre="lock" tam={18} tinte="rgba(255,255,255,0.8)" /> : <Icono nombre="check-circle" tam={18} tinte={a.acento} />}
              </View>
              <T c={a.acento} style={s.nombreMini}>{n.nombre}</T>
              <T v="pequeno" c="rgba(255,255,255,0.88)" lineas={3}>{n.beneficio}</T>
              {n.requisitos && !n.logrado && <T v="pequeno" c="rgba(255,255,255,0.7)" style={{ marginTop: 'auto' }}>Desde {n.requisitos.entregas} entregas al mes</T>}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ── Faltas ── */

const ESTADO_FALTA = {
  vigente: { texto: 'Cuenta', fondo: color.peligroSuave, tinta: color.peligro },
  en_revision: { texto: 'En revisión', fondo: color.efectivoSuave, tinta: '#8A5A00' },
  anulada: { texto: 'Anulada', fondo: color.dineroSuave, tinta: color.dinero },
} as const;

function Faltas({ d, alCambiar }: { d: Desempeno; alCambiar: () => void }) {
  const cuentan = d.faltas.filter((f) => f.estado !== 'anulada').length;
  return (
    <View style={{ gap: 10 }}>
      <View style={s.tituloSeccion}>
        <T v="subtitulo">Faltas</T>
        <View style={[s.contador, { backgroundColor: cuentan ? color.peligroSuave : color.dineroSuave }]}>
          <T v="pequeno" c={cuentan ? color.peligro : color.dinero} style={{ fontFamily: letra.fuerte }}>{cuentan ? `${cuentan} ${cuentan === 1 ? 'cuenta' : 'cuentan'}` : 'Ninguna'}</T>
        </View>
      </View>
      {d.faltas.length === 0 ? (
        <View style={s.vacio}>
          <Icono nombre="emoticon-happy-outline" tam={28} tinte={color.dinero} />
          <T v="fuerte" style={{ flex: 1 }}>Sin faltas en 30 días. ¡Así se hace!</T>
        </View>
      ) : (
        <View style={s.lista}>
          {d.faltas.map((f, i) => <Falta key={f.id} falta={f} ultima={i === d.faltas.length - 1} alReclamar={alCambiar} />)}
        </View>
      )}
    </View>
  );
}

function Falta({ falta, ultima, alReclamar }: { falta: Desempeno['faltas'][number]; ultima: boolean; alReclamar: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const e = ESTADO_FALTA[falta.estado];

  const enviar = async () => {
    setEnviando(true);
    setError('');
    try {
      await llamar(`/domi-app/faltas/${falta.id}/reclamar`, { cuerpo: { nota } });
      exito();
      setAbierto(false);
      alReclamar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : 'No se pudo enviar. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={[s.falta, !ultima && s.faltaBorde]}>
      <View style={s.filaMeta}>
        <View style={[s.punto, { backgroundColor: e.tinta }]} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="fuerte">{falta.motivo}</T>
          <T v="pequeno" c={color.tintaSuave}>
            {fechaCorta(falta.at)}{falta.pedido ? ` · pedido #${falta.pedido}` : ''}{falta.negocio ? ` · ${falta.negocio}` : ''}
          </T>
        </View>
        <View style={[s.estado, { backgroundColor: e.fondo }]}><T v="pequeno" c={e.tinta} style={{ fontFamily: letra.fuerte }}>{e.texto}</T></View>
      </View>
      {falta.reclamo && (
        <View style={s.reclamo}>
          <T v="pequeno" c={color.tintaSuave}>Tu reclamo: {falta.reclamo.nota}</T>
          {!!falta.reclamo.respuesta && <T v="pequeno" c={color.tinta}>Respuesta: {falta.reclamo.respuesta}</T>}
        </View>
      )}
      {!falta.reclamo && falta.estado === 'vigente' && (abierto ? (
        <View style={{ gap: 8, marginTop: 8 }}>
          <TextInput value={nota} onChangeText={setNota} placeholder="Cuéntanos qué pasó" placeholderTextColor={color.tintaTenue}
            multiline maxLength={500} style={s.entrada} testID={`reclamo-${falta.id}`} />
          {!!error && <T v="pequeno" c={color.peligro}>{error}</T>}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Boton texto="Cancelar" tipo="claro" compacto alTocar={() => setAbierto(false)} style={{ flex: 1 }} />
            <Boton texto="Enviar" tipo="oscuro" compacto cargando={enviando} desactivado={nota.trim().length < 5} alTocar={enviar} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <Pressable onPress={() => { tocar(); setAbierto(true); }} style={s.reclamar} testID={`reclamar-${falta.id}`}>
          <T v="fuerte" c={color.info}>No fue mi culpa · Reclamar</T>
          <Icono nombre="chevron-right" tam={18} tinte={color.info} />
        </Pressable>
      ))}
    </View>
  );
}

/* ── Las reglas, plegadas ── */

function ComoFunciona() {
  const [abierto, setAbierto] = useState(false);
  return (
    <View style={s.lista}>
      <Pressable onPress={() => { tocar(); setAbierto((x) => !x); }} style={s.plegable} testID="como-funciona">
        <Icono nombre="help-circle-outline" tinte={color.tintaSuave} />
        <T v="fuerte" style={{ flex: 1 }}>¿Cómo funciona?</T>
        <Icono nombre={abierto ? 'chevron-up' : 'chevron-down'} tinte={color.tintaSuave} />
      </Pressable>
      {abierto && (
        <View style={{ gap: 10, paddingHorizontal: 16, paddingBottom: 16 }}>
          <Regla icono="arrow-up-bold-circle" texto="Subir de nivel es inmediato." />
          <Regla icono="shield-check" texto="Al llegar a un nivel tienes 30 días protegido. Bajar solo se revisa una vez al mes y nunca más de un nivel." />
          <Regla icono="close-circle-outline" texto="Rechazar una oferta no es falta. Solo cuenta dejarla vencer si te llegó." />
          <Regla icono="store-clock-outline" texto="La demora del local no te cuenta: la puntualidad se mide desde que recoges." />
          <Regla icono="home-alert-outline" texto="Si llegaste donde el cliente y no estaba, no es culpa tuya." />
          <Regla icono="message-alert-outline" texto="Cualquier falta la puedes reclamar." />
        </View>
      )}
    </View>
  );
}

function Regla({ icono, texto }: { icono: NombreIcono; texto: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Icono nombre={icono} tam={20} tinte={color.dinero} />
      <T v="cuerpo" c={color.tintaSuave} style={{ flex: 1 }}>{texto}</T>
    </View>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: color.fondo },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  cuerpo: { padding: 18, gap: 22, paddingBottom: 40 },

  tarjeta: { borderRadius: radio.xl, padding: 20, overflow: 'hidden', gap: 4, minHeight: 230 },
  marcaAgua: { position: 'absolute', right: -30, top: -10 },
  filaTarjeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipIcono: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  riesgo: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F5C04A', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radio.total },
  nombreNivel: { fontFamily: letra.negra, fontSize: 46, lineHeight: 52, letterSpacing: -1.5, marginTop: 14 },
  separador: { height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: 14 },
  barraTarjeta: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden', marginTop: 8 },
  llenoTarjeta: { height: '100%', borderRadius: 5 },

  tituloSeccion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metas: { backgroundColor: color.superficie, borderRadius: radio.l, padding: 16, gap: 18, borderWidth: 1, borderColor: color.borde },
  meta: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  metaIcono: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  filaMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barra: { height: 8, borderRadius: 4, backgroundColor: color.fondo, overflow: 'hidden' },
  lleno: { height: '100%', borderRadius: 4 },

  mini: { borderRadius: radio.l, padding: 16, overflow: 'hidden', gap: 6, minHeight: 150 },
  nombreMini: { fontFamily: letra.negra, fontSize: 24, lineHeight: 30, marginTop: 6 },
  tu: { backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radio.total },

  contador: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radio.total },
  vacio: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.dineroSuave, borderRadius: radio.l, padding: 16 },
  lista: { backgroundColor: color.superficie, borderRadius: radio.l, borderWidth: 1, borderColor: color.borde },
  falta: { padding: 16 },
  faltaBorde: { borderBottomWidth: 1, borderBottomColor: color.borde },
  punto: { width: 10, height: 10, borderRadius: 5 },
  estado: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radio.total },
  reclamo: { backgroundColor: color.fondo, borderRadius: radio.m, padding: 10, gap: 4, marginTop: 10 },
  reclamar: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  entrada: { minHeight: 80, borderWidth: 1, borderColor: color.borde, borderRadius: radio.m, padding: 12, fontFamily: letra.normal, fontSize: 16, color: color.tinta, textAlignVertical: 'top', backgroundColor: color.superficie },
  plegable: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, minHeight: 56 },
});
