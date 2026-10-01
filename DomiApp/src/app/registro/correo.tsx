/** Registro, paso 2: el correo. Ahí le llega el código para verificarse. */
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { Boton, T } from '@/componentes/base';
import { PasoRegistro } from '@/componentes/PasoRegistro';
import { fallo } from '@/lib/aviso';
import { ErrorApi, llamar } from '@/lib/api';
import { useRegistro } from '@/estado/datosRegistro';
import { color, letra, radio } from '@/tema';

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function RegistroCorreo() {
  const [correo, setCorreo] = useState(useRegistro.getState().email);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const valido = CORREO.test(correo.trim());

  const enviar = async () => {
    const email = correo.trim().toLowerCase();
    setCargando(true);
    setError('');
    try {
      const { telefono } = useRegistro.getState();
      const r = await llamar<{ enviado: boolean; codigoPrueba?: string }>('/domi-app/registro/codigo', { cuerpo: { telefono, email }, sinSesion: true });
      useRegistro.getState().poner({ email, pase: '' });
      router.push({ pathname: '/registro/codigo', params: r.codigoPrueba ? { prueba: r.codigoPrueba } : {} });
    } catch (e) {
      fallo();
      if (e instanceof ErrorApi && e.codigo === 'espera') {
        useRegistro.getState().poner({ email });
        router.push('/registro/codigo'); // ya tiene un código vigente
        return;
      }
      setError(e instanceof ErrorApi ? (e.status === 0 ? 'Sin conexión. Revisa tus datos o el wifi.' : e.message) : 'No se pudo enviar el código.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <PasoRegistro
      paso={2}
      total={6}
      titulo="¿Cuál es tu correo?"
      ayuda="Te enviamos un código de 6 números para confirmar que eres tú."
      pie={<Boton prueba="enviar-codigo" texto="Enviarme el código" icono="email-fast-outline" tipo="oscuro" desactivado={!valido} cargando={cargando} alTocar={enviar} />}>
      <TextInput
        testID="campo-correo"
        value={correo}
        onChangeText={(v) => { setError(''); setCorreo(v); }}
        placeholder="tucorreo@gmail.com"
        placeholderTextColor={color.tintaTenue}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        autoFocus
        onSubmitEditing={() => valido && !cargando && enviar()}
        style={[s.input, !!error && { borderColor: color.peligro }]}
      />
      {!!error && <T v="fuerte" c={color.peligro}>{error}</T>}
    </PasoRegistro>
  );
}

const s = StyleSheet.create({
  input: { height: 60, borderRadius: radio.l, borderWidth: 2, borderColor: color.borde, backgroundColor: color.superficie, paddingHorizontal: 18, fontFamily: letra.fuerte, fontSize: 18, color: color.tinta },
});
