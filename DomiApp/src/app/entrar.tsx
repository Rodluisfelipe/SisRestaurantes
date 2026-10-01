/**
 * Entrar: celular y PIN, nada más. El PIN es el mismo de cuatro números que
 * le dio el negocio; si trabaja en varios, sirve el de cualquiera.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Boton, Icono, T } from '@/componentes/base';
import { Casillas, Teclado } from '@/componentes/Teclado';
import { fallo } from '@/lib/aviso';
import { celularBonito } from '@/lib/formato';
import { ErrorApi, useApp } from '@/estado/app';
import { color, letra, radio } from '@/tema';

export default function Entrar() {
  const [paso, setPaso] = useState<'celular' | 'pin'>('celular');
  const [celular, setCelular] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: string; mensaje: string } | null>(null);

  const celularValido = /^3\d{9}$/.test(celular);

  const probar = async (codigo: string) => {
    setCargando(true);
    setError('');
    try {
      await useApp.getState().entrar(celular, codigo);
      router.replace('/preparar');
    } catch (e) {
      fallo();
      setPin('');
      if (e instanceof ErrorApi && e.codigo?.startsWith('registro_')) {
        setAviso({ tipo: e.codigo.replace('registro_', ''), mensaje: e.message });
        return;
      }
      setError(e instanceof ErrorApi ? (e.status === 0 ? 'Sin conexión. Revisa tus datos o el wifi.' : e.message) : 'No se pudo entrar.');
    } finally {
      setCargando(false);
    }
  };

  const tecla = (d: string) => {
    setError('');
    if (paso === 'celular') { setCelular((c) => (c + d).slice(0, 10)); return; }
    if (cargando || pin.length >= 4) return;
    const n = pin + d;
    setPin(n);
    if (n.length === 4) probar(n);
  };
  const borrar = () => (paso === 'celular' ? setCelular((c) => c.slice(0, -1)) : setPin((p) => p.slice(0, -1)));

  if (aviso) return <EstadoRegistro {...aviso} alVolver={() => { setAviso(null); setPaso('celular'); }} />;

  return (
    <SafeAreaView style={s.fondo} edges={['top', 'bottom']}>
      <View style={s.cabeza}>
        <View style={s.marca}><Icono nombre="moped" tam={30} tinte="#fff" /></View>
        <T v="titulo">{paso === 'celular' ? 'Hola, ¿cuál es tu celular?' : 'Escribe tu PIN'}</T>
        <T v="cuerpo" c={color.tintaSuave}>
          {paso === 'celular'
            ? 'El mismo que le diste al negocio donde repartes.'
            : 'Los 4 números que te dio el negocio. Si trabajas en varios, sirve el de cualquiera.'}
        </T>
      </View>

      <View style={s.medio}>
        {paso === 'celular' ? (
          <View style={[s.campo, error && { borderColor: color.peligro }]} testID="campo-celular">
            <T v="titulo" c={celular ? color.tinta : color.tintaTenue} style={{ fontFamily: letra.negra, letterSpacing: 1 }}>
              {celular ? celularBonito(celular) : '300 000 0000'}
            </T>
          </View>
        ) : (
          <View style={{ gap: 14, alignItems: 'center' }}>
            <Casillas valor={pin} error={!!error} />
            <T v="pequeno" c={color.tintaSuave}>Celular {celularBonito(celular)}</T>
          </View>
        )}
        {!!error && <T v="fuerte" c={color.peligro} centro style={{ marginTop: 14 }}>{error}</T>}
        {paso === 'pin' && (
          <Boton texto="Cambiar celular" tipo="fantasma" compacto alTocar={() => { setPaso('celular'); setPin(''); setError(''); }} style={{ alignSelf: 'center', marginTop: 4 }} />
        )}
      </View>

      <View style={{ gap: 14 }}>
        <Teclado alTecla={tecla} alBorrar={borrar} />
        {paso === 'celular' && (
          <Boton prueba="continuar" texto="Continuar" icono="arrow-right" tipo="oscuro" desactivado={!celularValido} alTocar={() => setPaso('pin')} />
        )}
        {paso === 'celular' && (
          <Boton prueba="ir-registro" texto="¿Quieres repartir? Regístrate" tipo="fantasma" compacto alTocar={() => router.push('/registro/celular')} />
        )}
        {paso === 'pin' && cargando && <Boton texto="Entrando…" cargando alTocar={() => {}} tipo="oscuro" />}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: color.fondo, paddingHorizontal: 22, paddingBottom: 12 },
  cabeza: { gap: 8, paddingTop: 24 },
  marca: { width: 56, height: 56, borderRadius: radio.l, backgroundColor: color.marca, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  medio: { flex: 1, justifyContent: 'center' },
  campo: { borderWidth: 2, borderColor: color.borde, backgroundColor: color.superficie, borderRadius: radio.l, height: 76, alignItems: 'center', justifyContent: 'center' },
});

/** El registro de un independiente que todavía no puede trabajar, explicado. */
function EstadoRegistro({ tipo, mensaje, alVolver }: { tipo: string; mensaje: string; alVolver: () => void }) {
  const cfg = {
    pendiente: { icono: 'clock-outline' as const, fondo: color.infoSuave, tinte: color.info, titulo: 'Tu registro está en revisión' },
    rechazado: { icono: 'file-alert-outline' as const, fondo: color.efectivoSuave, tinte: color.tinta, titulo: 'Tu registro necesita correcciones' },
    suspendido: { icono: 'account-cancel-outline' as const, fondo: color.peligroSuave, tinte: color.peligro, titulo: 'Tu cuenta está suspendida' },
  }[tipo] || { icono: 'information-outline' as const, fondo: color.fondo, tinte: color.tinta, titulo: 'Tu cuenta' };
  return (
    <SafeAreaView style={[s.fondo, { justifyContent: 'center', gap: 16 }]} testID={`registro-${tipo}`}>
      <View style={[s.marca, { backgroundColor: cfg.fondo, width: 72, height: 72 }]}><Icono nombre={cfg.icono} tam={36} tinte={cfg.tinte} /></View>
      <T v="titulo">{cfg.titulo}</T>
      <T v="cuerpo" c={color.tintaSuave}>{mensaje}</T>
      {tipo === 'rechazado' && <Boton texto="Corregir mi registro" icono="pencil" tipo="oscuro" alTocar={() => router.push('/registro/celular')} />}
      <Boton texto="Volver" tipo="fantasma" alTocar={alVolver} />
    </SafeAreaView>
  );
}
