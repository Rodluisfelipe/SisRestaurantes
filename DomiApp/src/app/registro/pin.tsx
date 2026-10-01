/**
 * Registro, paso 5: crear el PIN (dos veces) y enviar todo.
 * El PIN es con lo que va a entrar siempre, junto con su celular.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { T } from '@/componentes/base';
import { PasoRegistro } from '@/componentes/PasoRegistro';
import { Casillas, Teclado } from '@/componentes/Teclado';
import { exito, fallo } from '@/lib/aviso';
import { ErrorApi, llamar } from '@/lib/api';
import { useRegistro } from '@/estado/datosRegistro';
import { color } from '@/tema';

const FACIL = /^(\d)\1{3}$|^(1234|4321|0000|1212|2580)$/;

async function adjuntar(form: FormData, campo: string, uri: string) {
  if (Platform.OS === 'web') form.append(campo, await (await fetch(uri)).blob(), `${campo}.jpg`);
  else form.append(campo, { uri, name: `${campo}.jpg`, type: 'image/jpeg' } as unknown as Blob);
}

export default function RegistroPin() {
  const [pin, setPin] = useState('');
  const [primero, setPrimero] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (definitivo: string) => {
    const r = useRegistro.getState();
    setEnviando(true);
    setError('');
    try {
      const form = new FormData();
      form.append('pase', r.pase);
      form.append('nombre', r.nombre.trim());
      form.append('tipoDocumento', r.tipoDocumento || '');
      form.append('numeroDocumento', r.numeroDocumento);
      form.append('vehiculo', r.vehiculo || '');
      form.append('placa', r.placa);
      form.append('pin', definitivo);
      if (r.frente) await adjuntar(form, 'frente', r.frente);
      if (r.reverso && r.tipoDocumento !== 'pasaporte') await adjuntar(form, 'reverso', r.reverso);
      if (r.selfie) await adjuntar(form, 'selfie', r.selfie);
      await llamar('/domi-app/registro', { formulario: form, sinSesion: true, tiempo: 90_000 });
      exito();
      router.replace('/registro/listo');
    } catch (e) {
      fallo();
      setPin('');
      setPrimero('');
      if (e instanceof ErrorApi && e.codigo === 'pase') {
        setError('Tu verificación venció. Vuelve a confirmar tu celular.');
        setTimeout(() => router.replace('/registro/celular'), 1800);
      } else {
        setError(e instanceof ErrorApi ? (e.status === 0 ? 'Sin conexión. Tus fotos siguen aquí: intenta de nuevo.' : e.message) : 'No se pudo enviar.');
      }
    } finally {
      setEnviando(false);
    }
  };

  const tecla = (d: string) => {
    if (enviando || pin.length >= 4) return;
    setError('');
    const n = pin + d;
    setPin(n);
    if (n.length < 4) return;
    if (!primero) {
      if (FACIL.test(n)) { fallo(); setError('Muy fácil de adivinar. Elige otro.'); setPin(''); return; }
      setPrimero(n);
      setPin('');
      return;
    }
    if (n !== primero) { fallo(); setError('No coinciden. Escríbelo de nuevo.'); setPrimero(''); setPin(''); return; }
    enviar(n);
  };

  return (
    <PasoRegistro
      paso={6}
      total={6}
      titulo={primero ? 'Repite tu PIN' : 'Crea tu PIN'}
      ayuda="4 números que solo tú sepas. Con tu celular y este PIN entras siempre."
      sinScroll>
      <View style={{ gap: 14, alignItems: 'center' }}>
        <Casillas valor={pin} error={!!error} />
        {!!error && <T v="fuerte" c={color.peligro} centro>{error}</T>}
        {enviando && <T v="fuerte" c={color.tintaSuave}>Enviando tus datos…</T>}
      </View>
      <View style={{ flex: 1 }} />
      <Teclado alTecla={tecla} alBorrar={() => setPin((p) => p.slice(0, -1))} />
    </PasoRegistro>
  );
}
