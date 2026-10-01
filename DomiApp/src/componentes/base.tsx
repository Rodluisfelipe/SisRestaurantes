/** Piezas pequeñas que usa toda la app: texto, botones, íconos, tarjetas. */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { tocar } from '@/lib/aviso';
import { color, letra, radio, sombra, TOQUE } from '@/tema';

export type NombreIcono = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icono({ nombre, tam = 22, tinte = color.tinta }: { nombre: NombreIcono; tam?: number; tinte?: string }) {
  return <MaterialCommunityIcons name={nombre} size={tam} color={tinte} />;
}

type Variante = 'enorme' | 'titulo' | 'subtitulo' | 'cuerpo' | 'fuerte' | 'pequeno' | 'etiqueta';

const estilosTexto: Record<Variante, TextStyle> = {
  enorme: { fontFamily: letra.negra, fontSize: 40, letterSpacing: -1.2, lineHeight: 44 },
  titulo: { fontFamily: letra.negra, fontSize: 26, letterSpacing: -0.6, lineHeight: 31 },
  subtitulo: { fontFamily: letra.fuerte, fontSize: 19, letterSpacing: -0.3, lineHeight: 24 },
  cuerpo: { fontFamily: letra.normal, fontSize: 16, lineHeight: 22 },
  fuerte: { fontFamily: letra.fuerte, fontSize: 16, lineHeight: 22 },
  pequeno: { fontFamily: letra.media, fontSize: 13.5, lineHeight: 18 },
  etiqueta: { fontFamily: letra.fuerte, fontSize: 12, letterSpacing: 0.9, textTransform: 'uppercase' },
};

export function T({ v = 'cuerpo', c = color.tinta, style, children, lineas, centro }: {
  v?: Variante; c?: string; style?: StyleProp<TextStyle>; children: ReactNode; lineas?: number; centro?: boolean;
}) {
  return (
    <Text numberOfLines={lineas} style={[estilosTexto[v], { color: c }, centro && { textAlign: 'center' }, style]}>
      {children}
    </Text>
  );
}

type TipoBoton = 'primario' | 'oscuro' | 'claro' | 'peligro' | 'dinero' | 'fantasma';

const coloresBoton: Record<TipoBoton, { fondo: string; texto: string; borde?: string }> = {
  primario: { fondo: color.marca, texto: '#fff' },
  oscuro: { fondo: color.tinta, texto: '#fff' },
  claro: { fondo: color.superficie, texto: color.tinta, borde: color.borde },
  peligro: { fondo: color.peligroSuave, texto: color.peligro },
  dinero: { fondo: color.dinero, texto: '#fff' },
  fantasma: { fondo: 'transparent', texto: color.tintaSuave },
};

export function Boton({ texto, alTocar, tipo = 'primario', icono, cargando, desactivado, style, compacto, prueba }: {
  texto: string; alTocar: () => void; tipo?: TipoBoton; icono?: NombreIcono; cargando?: boolean;
  desactivado?: boolean; style?: StyleProp<ViewStyle>; compacto?: boolean; prueba?: string;
}) {
  const c = coloresBoton[tipo];
  const apagado = desactivado || cargando;
  return (
    <Pressable
      testID={prueba}
      accessibilityRole="button"
      accessibilityLabel={texto}
      disabled={apagado}
      onPress={() => { tocar(); alTocar(); }}
      style={({ pressed }) => [
        s.boton,
        compacto && { height: 46, paddingHorizontal: 16 },
        { backgroundColor: c.fondo, borderColor: c.borde || c.fondo, opacity: apagado ? 0.5 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        style,
      ]}>
      {cargando ? <ActivityIndicator color={c.texto} /> : (
        <>
          {icono && <Icono nombre={icono} tinte={c.texto} tam={compacto ? 20 : 22} />}
          <Text style={[s.textoBoton, compacto && { fontSize: 15 }, { color: c.texto }]} numberOfLines={1}>{texto}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Botón redondo con ícono y una palabra debajo (llamar, WhatsApp, navegar). */
export function Accion({ icono, texto, alTocar, tinte = color.tinta, fondo = color.superficie, prueba }: {
  icono: NombreIcono; texto: string; alTocar: () => void; tinte?: string; fondo?: string; prueba?: string;
}) {
  return (
    <Pressable testID={prueba} accessibilityRole="button" accessibilityLabel={texto} onPress={() => { tocar(); alTocar(); }}
      style={({ pressed }) => [s.accion, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={[s.accionCirculo, { backgroundColor: fondo }]}>
        <Icono nombre={icono} tinte={tinte} tam={24} />
      </View>
      <T v="pequeno" c={color.tintaSuave}>{texto}</T>
    </Pressable>
  );
}

export function Tarjeta({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.tarjeta, style]}>{children}</View>;
}

/** Pastilla de color: "Cobra $59.000", "Pagado", "Listo en el local". */
export function Pastilla({ texto, fondo, tinte, icono }: { texto: string; fondo: string; tinte: string; icono?: NombreIcono }) {
  return (
    <View style={[s.pastilla, { backgroundColor: fondo }]}>
      {icono && <Icono nombre={icono} tam={15} tinte={tinte} />}
      <Text style={[s.textoPastilla, { color: tinte }]}>{texto}</Text>
    </View>
  );
}

export function Separador({ alto = 12 }: { alto?: number }) {
  return <View style={{ height: alto }} />;
}

const s = StyleSheet.create({
  boton: {
    height: TOQUE + 4, borderRadius: radio.l, paddingHorizontal: 22, borderWidth: 1.5,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  textoBoton: { fontFamily: letra.fuerte, fontSize: 17, letterSpacing: -0.2 },
  accion: { alignItems: 'center', gap: 6, minWidth: 64 },
  accionCirculo: {
    width: TOQUE, height: TOQUE, borderRadius: TOQUE / 2, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: color.borde,
  },
  tarjeta: { backgroundColor: color.superficie, borderRadius: radio.l, padding: 16, ...sombra.tarjeta },
  pastilla: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radio.total, alignSelf: 'flex-start' },
  textoPastilla: { fontFamily: letra.fuerte, fontSize: 13 },
});
