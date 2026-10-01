/** Registro, paso 3: nombre, documento y en qué va a repartir. */
import { router } from 'expo-router';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Boton, Icono, T } from '@/componentes/base';
import { PasoRegistro } from '@/componentes/PasoRegistro';
import { tocar } from '@/lib/aviso';
import { DOCUMENTOS, useRegistro, VEHICULOS } from '@/estado/datosRegistro';
import { color, letra, radio } from '@/tema';

export default function RegistroDatos() {
  const r = useRegistro();
  const nombreOk = r.nombre.trim().length >= 5 && /\s/.test(r.nombre.trim());
  const docOk = !!r.tipoDocumento && r.numeroDocumento.replace(/[^\dA-Za-z]/g, '').length >= 5;
  const placaOk = !['moto', 'carro'].includes(r.vehiculo || '') || r.placa.replace(/[^A-Za-z0-9]/g, '').length >= 5;
  const listo = nombreOk && docOk && !!r.vehiculo && placaOk;

  return (
    <PasoRegistro
      paso={4}
      total={6}
      titulo="Tus datos"
      ayuda="Tal como aparecen en tu documento. Los revisamos antes de activarte."
      pie={<Boton prueba="datos-continuar" texto="Continuar" icono="arrow-right" tipo="oscuro" desactivado={!listo} alTocar={() => router.push('/registro/fotos')} />}>
      <Campo etiqueta="Nombre y apellido" valor={r.nombre} alCambiar={(v) => r.poner({ nombre: v })} placeholder="Ej. Julián Andrés Mora" prueba="campo-nombre" mayusculas="words" />

      <T v="fuerte" style={{ marginTop: 6 }}>Documento</T>
      <View style={s.opciones}>
        {DOCUMENTOS.map((d) => (
          <Pressable key={d.id} testID={`doc-${d.id}`} onPress={() => { tocar(); r.poner({ tipoDocumento: d.id }); }} style={[s.opcion, r.tipoDocumento === d.id && s.activa]}>
            <T v="fuerte" c={r.tipoDocumento === d.id ? '#fff' : color.tinta}>{d.texto}</T>
          </Pressable>
        ))}
      </View>
      <Campo etiqueta="Número del documento" valor={r.numeroDocumento} alCambiar={(v) => r.poner({ numeroDocumento: v })} placeholder="Sin puntos" prueba="campo-documento" teclado={r.tipoDocumento === 'cc' ? 'number-pad' : 'default'} />

      <T v="fuerte" style={{ marginTop: 6 }}>¿En qué vas a repartir?</T>
      <View style={s.opciones}>
        {VEHICULOS.map((v) => (
          <Pressable key={v.id} testID={`vehiculo-${v.id}`} onPress={() => { tocar(); r.poner({ vehiculo: v.id }); }} style={[s.vehiculo, r.vehiculo === v.id && s.activa]}>
            <Icono nombre={v.icono} tam={26} tinte={r.vehiculo === v.id ? '#fff' : color.tinta} />
            <T v="fuerte" c={r.vehiculo === v.id ? '#fff' : color.tinta}>{v.texto}</T>
          </Pressable>
        ))}
      </View>
      {['moto', 'carro'].includes(r.vehiculo || '') && (
        <Campo etiqueta="Placa" valor={r.placa} alCambiar={(v) => r.poner({ placa: v.toUpperCase() })} placeholder="ABC12D" prueba="campo-placa" mayusculas="characters" />
      )}
    </PasoRegistro>
  );
}

function Campo({ etiqueta, valor, alCambiar, placeholder, prueba, teclado = 'default', mayusculas = 'none' }: {
  etiqueta: string; valor: string; alCambiar: (v: string) => void; placeholder: string; prueba: string;
  teclado?: 'default' | 'number-pad'; mayusculas?: 'none' | 'words' | 'characters';
}) {
  return (
    <View style={{ gap: 6 }}>
      <T v="pequeno" c={color.tintaSuave}>{etiqueta}</T>
      <TextInput
        testID={prueba}
        value={valor}
        onChangeText={alCambiar}
        placeholder={placeholder}
        placeholderTextColor={color.tintaTenue}
        keyboardType={teclado}
        autoCapitalize={mayusculas}
        autoCorrect={false}
        maxLength={60}
        style={s.input}
      />
    </View>
  );
}

const s = StyleSheet.create({
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcion: { paddingHorizontal: 16, height: 48, borderRadius: radio.m, borderWidth: 2, borderColor: color.borde, backgroundColor: color.superficie, justifyContent: 'center' },
  vehiculo: { width: '47%', flexGrow: 1, height: 64, borderRadius: radio.m, borderWidth: 2, borderColor: color.borde, backgroundColor: color.superficie, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  activa: { backgroundColor: color.tinta, borderColor: color.tinta },
  input: { height: 56, borderRadius: radio.m, borderWidth: 2, borderColor: color.borde, backgroundColor: color.superficie, paddingHorizontal: 16, fontFamily: letra.fuerte, fontSize: 17, color: color.tinta },
});
