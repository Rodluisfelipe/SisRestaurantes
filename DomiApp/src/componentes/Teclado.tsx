/**
 * Teclado numérico propio, grande. El teclado del sistema cambia de tamaño y
 * de orden según el celular, tapa la mitad de la pantalla y a veces aparece
 * con letras: para cuatro números esto es más rápido y siempre igual.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tocar } from '@/lib/aviso';
import { color, letra, radio } from '@/tema';
import { Icono } from './base';

export function Casillas({ valor, largo = 4, error, oscuro }: { valor: string; largo?: number; error?: boolean; oscuro?: boolean }) {
  return (
    <View style={s.casillas}>
      {Array.from({ length: largo }, (_, i) => {
        const lleno = i < valor.length;
        const activa = i === valor.length;
        return (
          <View key={i} style={[
            s.casilla,
            largo > 4 && { width: 48, height: 62 },
            oscuro && { backgroundColor: color.nocheSuave, borderColor: color.nocheSuave },
            activa && { borderColor: oscuro ? '#fff' : color.tinta },
            error && { borderColor: color.peligro, backgroundColor: oscuro ? color.nocheSuave : color.peligroSuave },
          ]}>
            <Text style={[s.digito, oscuro && { color: '#fff' }]}>{lleno ? valor[i] : ''}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function Teclado({ alTecla, alBorrar, oscuro }: { alTecla: (d: string) => void; alBorrar: () => void; oscuro?: boolean }) {
  const filas = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', '⌫']];
  return (
    <View style={s.teclado}>
      {filas.map((f, i) => (
        <View key={i} style={s.fila}>
          {f.map((k) => (
            <Pressable
              key={k || `vacio${i}`}
              testID={k ? `tecla-${k === '⌫' ? 'borrar' : k}` : undefined}
              disabled={!k}
              accessibilityLabel={k === '⌫' ? 'Borrar' : k}
              onPress={() => { tocar(); if (k === '⌫') alBorrar(); else alTecla(k); }}
              style={({ pressed }) => [s.tecla, !k && { opacity: 0 }, pressed && { backgroundColor: oscuro ? color.nocheSuave : color.borde }]}>
              {k === '⌫'
                ? <Icono nombre="backspace-outline" tam={28} tinte={oscuro ? '#fff' : color.tinta} />
                : <Text style={[s.textoTecla, oscuro && { color: '#fff' }]}>{k}</Text>}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  casillas: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  casilla: {
    width: 62, height: 72, borderRadius: radio.m, borderWidth: 2, borderColor: color.borde,
    backgroundColor: color.superficie, alignItems: 'center', justifyContent: 'center',
  },
  digito: { fontFamily: letra.negra, fontSize: 32, color: color.tinta },
  teclado: { gap: 6 },
  fila: { flexDirection: 'row', gap: 6 },
  tecla: { flex: 1, height: 64, borderRadius: radio.m, alignItems: 'center', justifyContent: 'center' },
  textoTecla: { fontFamily: letra.fuerte, fontSize: 28, color: color.tinta },
});
