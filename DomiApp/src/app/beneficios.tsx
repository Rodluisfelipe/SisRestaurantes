/**
 * Beneficios para los domis: los publica MenuBy y se canjean con el código
 * único del domi. El canje queda en firme cuando lo confirma con el enlace
 * que le llega al correo (así nadie usa su código).
 */
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, RefreshControl, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton, Icono, Pastilla, T, Tarjeta } from '@/componentes/base';
import { Cabecera } from '@/componentes/Cabecera';
import { ErrorApi, llamar } from '@/lib/api';
import { exito } from '@/lib/aviso';
import type { Beneficios } from '@/lib/tipos';
import { color, letra, radio } from '@/tema';

export default function PantallaBeneficios() {
  const [d, setD] = useState<Beneficios | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [correo, setCorreo] = useState('');
  const [guardandoCorreo, setGuardandoCorreo] = useState(false);
  const [cambiarCorreo, setCambiarCorreo] = useState(false);
  const [canjeando, setCanjeando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ id: string; texto: string; bien: boolean } | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await llamar<Beneficios>('/domi-app/beneficios');
      setD(r);
      setCorreo(r.correo || '');
      setError('');
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos cargar los beneficios.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardarCorreo = async () => {
    setGuardandoCorreo(true);
    try {
      await llamar('/domi-app/correo', { metodo: 'PUT', cuerpo: { email: correo } });
      exito();
      setCambiarCorreo(false);
      await cargar();
    } catch (e) {
      Alert.alert('Correo', e instanceof ErrorApi ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardandoCorreo(false);
    }
  };

  const canjear = (id: string, titulo: string) => {
    const hacer = async () => {
      setCanjeando(id);
      setMensaje(null);
      try {
        const r = await llamar<{ correo: string }>(`/domi-app/beneficios/${id}/canjear`, { cuerpo: {} });
        exito();
        setMensaje({ id, bien: true, texto: `Te enviamos un correo a ${r.correo}. Ábrelo y toca "Confirmar canje".` });
        cargar();
      } catch (e) {
        setMensaje({ id, bien: false, texto: e instanceof ErrorApi ? e.message : 'No se pudo pedir el canje.' });
      } finally {
        setCanjeando(null);
      }
    };
    if (Platform.OS === 'web') { hacer(); return; }
    Alert.alert('Canjear', `¿Quieres canjear "${titulo}"? Te llegará un correo para confirmarlo.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Canjear', onPress: hacer },
    ]);
  };

  const compartirCodigo = () => {
    if (!d) return;
    Share.share({ message: `Mi código de MenuBy Go: ${d.codigo}` }).catch(() => {});
  };

  const sinCorreo = !d?.correo;

  return (
    <SafeAreaView style={s.fondo} edges={['top', 'bottom']}>
      <Cabecera titulo="Beneficios" />
      {!d ? (
        <View style={s.centro}>
          {error ? <><T v="cuerpo" centro>{error}</T><Boton texto="Reintentar" tipo="oscuro" compacto alTocar={cargar} style={{ marginTop: 12 }} /></> : <ActivityIndicator color={color.marca} />}
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.cuerpo} refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />} keyboardShouldPersistTaps="handled">
          {/* El código: con él se canjea en cualquier página de beneficio */}
          <View style={s.codigo} testID="mi-codigo">
            <T v="etiqueta" c="#F5C04A">Tu código MenuBy Go</T>
            <T v="enorme" c="#fff" style={s.codigoTexto} >{d.codigo}</T>
            <T v="pequeno" c="#C9C9CF" centro>Con este código canjeas los beneficios. Es solo tuyo.</T>
            <Boton texto="Compartir código" tipo="claro" compacto icono="share-variant" alTocar={compartirCodigo} style={{ marginTop: 8, alignSelf: 'center' }} />
          </View>

          {/* El correo: ahí llega la confirmación de cada canje */}
          <Tarjeta style={{ gap: 8 }}>
            <View style={s.fila}>
              <Icono nombre="email-outline" />
              <T v="fuerte" style={{ flex: 1 }}>{sinCorreo ? 'Agrega tu correo para canjear' : 'Tu correo'}</T>
            </View>
            {sinCorreo || cambiarCorreo ? (
              <>
                <TextInput
                  value={correo}
                  onChangeText={setCorreo}
                  placeholder="tucorreo@gmail.com"
                  placeholderTextColor={color.tintaTenue}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={s.entrada}
                  testID="correo"
                />
                <Boton texto="Guardar correo" tipo="oscuro" compacto cargando={guardandoCorreo} desactivado={!/\S+@\S+\.\S+/.test(correo)} alTocar={guardarCorreo} />
              </>
            ) : (
              <View style={s.fila}>
                <T v="cuerpo" c={color.tintaSuave} style={{ flex: 1 }}>{d.correo}</T>
                <Boton texto="Cambiar" tipo="fantasma" compacto alTocar={() => setCambiarCorreo(true)} />
              </View>
            )}
          </Tarjeta>

          {d.beneficios.length === 0 ? (
            <Tarjeta style={{ alignItems: 'center', gap: 6, paddingVertical: 26 }}>
              <Icono nombre="gift-outline" tam={36} tinte={color.tintaSuave} />
              <T v="fuerte" centro>Pronto vas a ver beneficios aquí</T>
              <T v="pequeno" c={color.tintaSuave} centro>Estamos armando convenios para los domis de MenuBy.</T>
            </Tarjeta>
          ) : d.beneficios.map((b) => (
            <Tarjeta key={b.id} style={{ gap: 10, padding: 0, overflow: 'hidden' }}>
              {!!b.imagen && <Image source={{ uri: b.imagen }} style={s.imagen} contentFit="cover" />}
              <View style={{ padding: 16, gap: 8 }}>
                <View style={s.fila}>
                  <T v="subtitulo" style={{ flex: 1 }}>{b.titulo}</T>
                  {b.canje?.estado === 'confirmado' && <Pastilla texto="Canjeado" fondo={color.dineroSuave} tinte={color.dinero} icono="check" />}
                  {b.canje?.estado === 'pendiente' && <Pastilla texto="Confirma en tu correo" fondo={color.efectivoSuave} tinte="#8A5A00" />}
                </View>
                {!!b.descripcion && <T v="cuerpo" c={color.tintaSuave}>{b.descripcion}</T>}
                {b.canje?.comprobante && (
                  <T v="pequeno" c={color.tintaSuave}>Comprobante: <T v="fuerte">{b.canje.comprobante}</T></T>
                )}
                {mensaje?.id === b.id && <T v="pequeno" c={mensaje.bien ? color.dinero : color.peligro}>{mensaje.texto}</T>}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {!!b.enlace && <Boton texto="Ver beneficio" tipo="claro" compacto icono="open-in-new" alTocar={() => Linking.openURL(b.enlace).catch(() => {})} style={{ flex: 1 }} />}
                  {b.canje?.estado !== 'confirmado' && (
                    <Boton
                      texto={b.canje?.estado === 'pendiente' ? 'Reenviar correo' : 'Canjear'}
                      tipo="primario"
                      compacto
                      icono="gift"
                      cargando={canjeando === b.id}
                      desactivado={sinCorreo}
                      alTocar={() => canjear(b.id, b.titulo)}
                      style={{ flex: 1 }}
                      prueba={`canjear-${b.id}`}
                    />
                  )}
                </View>
              </View>
            </Tarjeta>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: color.fondo },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  cuerpo: { padding: 18, gap: 12, paddingBottom: 40 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codigo: { backgroundColor: color.noche, borderRadius: radio.xl, padding: 22, alignItems: 'center', gap: 4 },
  codigoTexto: { fontFamily: letra.negra, letterSpacing: 3, fontSize: 36, lineHeight: 42 },
  entrada: { height: 52, borderWidth: 1, borderColor: color.borde, borderRadius: radio.m, paddingHorizontal: 14, fontFamily: letra.normal, fontSize: 16, color: color.tinta, backgroundColor: color.superficie },
  imagen: { width: '100%', height: 150, backgroundColor: color.fondo },
});
