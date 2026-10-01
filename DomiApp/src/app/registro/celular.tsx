/** Registro, paso 1: el celular. Le llega un código por WhatsApp. */
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Boton, T } from '@/componentes/base';
import { PasoRegistro } from '@/componentes/PasoRegistro';
import { Teclado } from '@/componentes/Teclado';
import { celularBonito } from '@/lib/formato';
import { useRegistro } from '@/estado/datosRegistro';
import { color, letra, radio } from '@/tema';

export default function RegistroCelular() {
  const [celular, setCelular] = useState(useRegistro.getState().telefono);
  const [error, setError] = useState('');
  const valido = /^3\d{9}$/.test(celular);

  const seguir = () => {
    useRegistro.getState().poner({ telefono: celular, pase: '' });
    router.push('/registro/correo');
  };

  return (
    <PasoRegistro
      paso={1}
      titulo="Reparte con MenuBy"
      total={6}
      ayuda="Escribe tu celular. Con él y tu PIN vas a entrar siempre."
      sinScroll
      pie={<Boton prueba="celular-continuar" texto="Continuar" icono="arrow-right" tipo="oscuro" desactivado={!valido} alTocar={seguir} />}>
      <View style={[s.campo, !!error && { borderColor: color.peligro }]} testID="registro-celular">
        <T v="titulo" c={celular ? color.tinta : color.tintaTenue} style={{ fontFamily: letra.negra, letterSpacing: 1 }}>
          {celular ? celularBonito(celular) : '300 000 0000'}
        </T>
      </View>
      {!!error && <T v="fuerte" c={color.peligro} centro>{error}</T>}
      <View style={{ flex: 1 }} />
      <Teclado alTecla={(d) => { setError(''); setCelular((c) => (c + d).slice(0, 10)); }} alBorrar={() => setCelular((c) => c.slice(0, -1))} />
    </PasoRegistro>
  );
}

const s = StyleSheet.create({
  campo: { borderWidth: 2, borderColor: color.borde, backgroundColor: color.superficie, borderRadius: radio.l, height: 76, alignItems: 'center', justifyContent: 'center' },
});
