import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { loginDomi } from '../services/api';
import { C, shadow } from '../theme';

export default function AuthScreen({ onLogin }) {
  const insets = useSafeAreaInsets();
  const [slug, setSlug]       = useState('');
  const [code, setCode]       = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const s = slug.trim().toLowerCase();
    const c = code.trim();
    if (!s) return Alert.alert('Falta el negocio', 'Ingresa el identificador del negocio.');
    if (c.length < 4) return Alert.alert('Código inválido', 'El código debe tener 4 dígitos.');
    setLoading(true);
    try {
      const data = await loginDomi(s, c);
      onLogin({ ...data, slug: s });
    } catch (err) {
      Alert.alert('No pudimos entrar', err.data?.message || 'Código o negocio incorrecto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        {/* brand */}
        <LinearGradient colors={[C.brand, C.brandDark]} style={styles.logo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <MaterialCommunityIcons name="motorbike" size={40} color={C.white} />
        </LinearGradient>

        <Text style={styles.title}>Domi App</Text>
        <Text style={styles.subtitle}>Entregas en tiempo real</Text>

        <View style={styles.card}>
          <Text style={styles.label}>NEGOCIO</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="storefront-outline" size={18} color={C.faint} />
            <TextInput
              style={styles.input}
              placeholder="mi-restaurante"
              placeholderTextColor={C.faint}
              value={slug}
              onChangeText={setSlug}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Text style={[styles.label, { marginTop: 18 }]}>CÓDIGO DE ACCESO</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="key-outline" size={18} color={C.faint} />
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="0000"
              placeholderTextColor={C.faint}
              value={code}
              onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              onSubmitEditing={handleLogin}
            />
          </View>

          <Text style={styles.hint}>
            Usa tu PIN personal de 4 dígitos o el pase diario del negocio.
          </Text>

          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading} activeOpacity={0.9}>
            <LinearGradient colors={[C.brand, C.brandDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnGrad}>
              {loading ? <ActivityIndicator color={C.white} /> : (
                <>
                  <Text style={styles.btnTxt}>Entrar</Text>
                  <Ionicons name="arrow-forward" size={18} color={C.white} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>menuby.tech · Domiciliarios</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, alignItems: 'center' },

  logo: { width: 84, height: 84, borderRadius: 24, justifyContent: 'center', alignItems: 'center', ...shadow.glow(C.brand) },
  title: { color: C.text, fontSize: 30, fontWeight: '900', marginTop: 20, letterSpacing: -0.5 },
  subtitle: { color: C.sub, fontSize: 14, marginTop: 4, marginBottom: 32 },

  card: { width: '100%', backgroundColor: C.card, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: C.line, ...shadow.card },
  label: { color: C.faint, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14,
  },
  input: { flex: 1, color: C.text, fontSize: 15, paddingVertical: 14 },
  codeInput: { fontSize: 22, fontWeight: '800', letterSpacing: 8 },
  hint: { color: C.faint, fontSize: 11.5, marginTop: 12, lineHeight: 16 },

  btn: { marginTop: 22, borderRadius: 16, overflow: 'hidden', ...shadow.glow(C.brand) },
  btnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 17 },
  btnTxt: { color: C.white, fontSize: 16, fontWeight: '800' },

  footer: { color: C.faint, fontSize: 11, marginTop: 28 },
});
