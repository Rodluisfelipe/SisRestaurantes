/**
 * Registro, paso 4: fotos del documento y selfie.
 *
 * Cada foto dice qué se espera y por qué se rechazan (borrosa, con reflejo,
 * cortada): la mayoría de los registros devueltos son por fotos malas, y un
 * rechazo le cuesta al domi un día de espera.
 */
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Boton, Icono, T, type NombreIcono } from '@/componentes/base';
import { PasoRegistro } from '@/componentes/PasoRegistro';
import { tocar } from '@/lib/aviso';
import { useRegistro } from '@/estado/datosRegistro';
import { color, radio } from '@/tema';

type Clave = 'frente' | 'reverso' | 'selfie';

export default function RegistroFotos() {
  const r = useRegistro();
  const pasaporte = r.tipoDocumento === 'pasaporte';
  const listo = !!r.frente && !!r.selfie && (pasaporte || !!r.reverso);

  const tomar = async (clave: Clave) => {
    tocar();
    try {
      const permiso = await ImagePicker.requestCameraPermissionsAsync();
      let res: ImagePicker.ImagePickerResult;
      if (permiso.granted) {
        res = await ImagePicker.launchCameraAsync({
          quality: 0.7,
          cameraType: clave === 'selfie' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
          exif: false,
        });
      } else {
        res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      }
      if (!res.canceled && res.assets[0]) r.poner({ [clave]: res.assets[0].uri } as Partial<Record<Clave, string>>);
    } catch { /* sin cámara: se intenta de nuevo */ }
  };

  return (
    <PasoRegistro
      paso={5}
      total={6}
      titulo="Fotos para verificarte"
      ayuda="Con buena luz, sin reflejos y que se lea todo. Si la foto sale borrosa, la rechazamos."
      pie={<Boton prueba="fotos-continuar" texto="Continuar" icono="arrow-right" tipo="oscuro" desactivado={!listo} alTocar={() => router.push('/registro/pin')} />}>
      <Foto clave="frente" titulo={pasaporte ? 'Página de la foto del pasaporte' : 'Documento por delante'} ayuda="Todo el documento dentro de la foto" icono="card-account-details-outline" uri={r.frente} alTomar={tomar} />
      {!pasaporte && <Foto clave="reverso" titulo="Documento por detrás" ayuda="Que se lea el código de barras" icono="card-bulleted-outline" uri={r.reverso} alTomar={tomar} />}
      <Foto clave="selfie" titulo="Una selfie" ayuda="Tu cara de frente, sin gafas ni gorra" icono="face-recognition" uri={r.selfie} alTomar={tomar} />
    </PasoRegistro>
  );
}

function Foto({ clave, titulo, ayuda, icono, uri, alTomar }: {
  clave: Clave; titulo: string; ayuda: string; icono: NombreIcono; uri: string | null; alTomar: (c: Clave) => void;
}) {
  return (
    <Pressable testID={`foto-${clave}`} onPress={() => alTomar(clave)} style={[s.foto, !!uri && { borderColor: color.dinero }]}>
      {uri
        ? <Image source={{ uri }} style={s.miniatura} contentFit="cover" />
        : <View style={[s.miniatura, s.vacia]}><Icono nombre={icono} tam={30} tinte={color.tintaSuave} /></View>}
      <View style={{ flex: 1, gap: 2 }}>
        <T v="fuerte">{titulo}</T>
        <T v="pequeno" c={color.tintaSuave}>{ayuda}</T>
      </View>
      <View style={[s.boton, !!uri && { backgroundColor: color.dineroSuave }]}>
        <Icono nombre={uri ? 'check-bold' : 'camera'} tam={20} tinte={uri ? color.dinero : color.tinta} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  foto: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: radio.l, borderWidth: 2, borderColor: color.borde, backgroundColor: color.superficie },
  miniatura: { width: 72, height: 56, borderRadius: radio.s },
  vacia: { backgroundColor: color.fondo, alignItems: 'center', justifyContent: 'center' },
  boton: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.fondo, alignItems: 'center', justifyContent: 'center' },
});
