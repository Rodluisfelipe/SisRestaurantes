/** Registro, paso 2: el código de 6 números que llegó por WhatsApp. */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Boton, T } from '@/componentes/base';
import { PasoRegistro } from '@/componentes/PasoRegistro';
import { Casillas, Teclado } from '@/componentes/Teclado';
import { exito, fallo } from '@/lib/aviso';
import { ErrorApi, llamar } from '@/lib/api';
import { celularBonito } from '@/lib/formato';
import { useRegistro } from '@/estado/datosRegistro';
import { color } from '@/tema';

const ESPERA = 60;

export default function RegistroCodigo() {
  const { prueba } = useLocalSearchParams<{ prueba?: string }>();
  const telefono = useRegistro((s) => s.telefono);
  const email = useRegistro((s) => s.email);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [falta, setFalta] = useState(ESPERA);

  useEffect(() => {
    const t = setInterval(() => setFalta((f) => Math.max(0, f - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const verificar = async (c: string) => {
    setCargando(true);
    setError('');
    try {
      const r = await llamar<{ pase: string }>('/domi-app/registro/verificar', { cuerpo: { telefono, codigo: c }, sinSesion: true });
      exito();
      useRegistro.getState().poner({ pase: r.pase });
      router.replace('/registro/datos');
    } catch (e) {
      fallo();
      setCodigo('');
      setError(e instanceof ErrorApi ? e.message : 'No se pudo verificar.');
    } finally {
      setCargando(false);
    }
  };

  const reenviar = async () => {
    setError('');
    try {
      await llamar('/domi-app/registro/codigo', { cuerpo: { telefono, email }, sinSesion: true });
      setFalta(ESPERA);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo reenviar.');
    }
  };

  const tecla = (d: string) => {
    if (cargando || codigo.length >= 6) return;
    setError('');
    const n = codigo + d;
    setCodigo(n);
    if (n.length === 6) verificar(n);
  };

  return (
    <PasoRegistro
      paso={3}
      total={6}
      titulo="Escribe el código"
      ayuda={email ? `Te lo enviamos a ${email}. Si no lo ves, revisa la carpeta de spam.` : `Te lo enviamos al ${celularBonito(telefono)}.`}
      sinScroll>
      <View style={{ gap: 14, alignItems: 'center' }}>
        <Casillas valor={codigo} largo={6} error={!!error} />
        {!!error && <T v="fuerte" c={color.peligro} centro>{error}</T>}
        {cargando && <T v="fuerte" c={color.tintaSuave}>Comprobando…</T>}
        {!!prueba && <T v="pequeno" c={color.tintaTenue}>Modo de prueba: {prueba}</T>}
        {falta > 0
          ? <T v="pequeno" c={color.tintaSuave}>¿No te llegó? Puedes pedir otro en {falta} s</T>
          : <Boton texto="Enviarme otro código" tipo="fantasma" compacto icono="refresh" alTocar={reenviar} />}
      </View>
      <View style={{ flex: 1 }} />
      <Teclado alTecla={tecla} alBorrar={() => setCodigo((c) => c.slice(0, -1))} />
    </PasoRegistro>
  );
}
