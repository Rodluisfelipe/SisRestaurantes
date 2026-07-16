import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { loginDomi, loginPassword, loginPhonePin } from '../services/api';
import { C, shadow } from '../theme';

export default function AuthScreen({ onLogin }) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState('phonepin'); // 'phonepin' | 'account' | 'pin'
  const [loading, setLoading] = useState(false);

  // shared / per-mode fields
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [slug, setSlug] = useState('');
  const [code, setCode] = useState('');

  const submit = async () => {
    setLoading(true);
    try {
      if (mode === 'phonepin') {
        if (!phone || code.length !== 4) { setLoading(false); return Alert.alert('Datos incompletos', 'Ingresa tu celular y tu PIN de 4 dígitos.'); }
        const data = await loginPhonePin(phone.replace(/\D/g, ''), code);
        onLogin({ ...data });
      } else if (mode === 'account') {
        if (!phone || password.length < 6) { setLoading(false); return Alert.alert('Datos incompletos', 'Ingresa tu teléfono y una contraseña de al menos 6 caracteres.'); }
        const data = await loginPassword(phone.replace(/\D/g, ''), password);
        onLogin({ ...data });
      } else {
        const s = slug.trim().toLowerCase();
        if (!s || code.length < 4) { setLoading(false); return Alert.alert('Datos incompletos', 'Ingresa el negocio y el PIN de 4 dígitos.'); }
        const data = await loginDomi(s, code);
        onLogin({ ...data, slug: s });
      }
    } catch (err) {
      Alert.alert('No pudimos entrar', err.data?.message || 'Credenciales incorrectas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={[C.brand, C.brandDark]} style={styles.logo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <MaterialCommunityIcons name="motorbike" size={40} color={C.white} />
        </LinearGradient>
        <Text style={styles.title}>Domi App</Text>
        <Text style={styles.subtitle}>Entregas en tiempo real</Text>

        {/* mode toggle */}
        <View style={styles.seg}>
          <TouchableOpacity style={[styles.segBtn, mode === 'phonepin' && styles.segBtnOn]} onPress={() => setMode('phonepin')}>
            <Text style={[styles.segTxt, mode === 'phonepin' && styles.segTxtOn]}>Cel + PIN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.segBtn, mode === 'account' && styles.segBtnOn]} onPress={() => setMode('account')}>
            <Text style={[styles.segTxt, mode === 'account' && styles.segTxtOn]}>Contraseña</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.segBtn, mode === 'pin' && styles.segBtnOn]} onPress={() => setMode('pin')}>
            <Text style={[styles.segTxt, mode === 'pin' && styles.segTxtOn]}>Negocio</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          {mode === 'phonepin' && (
            <>
              <Text style={styles.label}>CELULAR</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="call-outline" size={18} color={C.faint} />
                <TextInput
                  style={styles.input} placeholder="300 123 4567" placeholderTextColor={C.faint}
                  value={phone} onChangeText={t => setPhone(t.replace(/[^\d]/g, ''))}
                  keyboardType="phone-pad"
                />
              </View>
              <Text style={[styles.label, { marginTop: 18 }]}>PIN DE ACCESO</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="key-outline" size={18} color={C.faint} />
                <TextInput
                  style={[styles.input, styles.codeInput]} placeholder="0000" placeholderTextColor={C.faint}
                  value={code} onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad" secureTextEntry maxLength={4} onSubmitEditing={submit}
                />
              </View>
              <Text style={styles.hint}>Tu celular y el PIN de 4 dígitos que te dio el restaurante.</Text>
            </>
          )}
          {mode === 'account' && (
            <>
              <Text style={styles.label}>TELÉFONO</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="call-outline" size={18} color={C.faint} />
                <TextInput
                  style={styles.input} placeholder="300 123 4567" placeholderTextColor={C.faint}
                  value={phone} onChangeText={t => setPhone(t.replace(/[^\d]/g, ''))}
                  keyboardType="phone-pad"
                />
              </View>
              <Text style={[styles.label, { marginTop: 18 }]}>CONTRASEÑA</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={C.faint} />
                <TextInput
                  style={styles.input} placeholder="••••••••" placeholderTextColor={C.faint}
                  value={password} onChangeText={setPassword} secureTextEntry
                  onSubmitEditing={submit}
                />
              </View>
              <Text style={styles.hint}>Tu restaurante te da tu teléfono y contraseña.</Text>
            </>
          )}
          {mode === 'pin' && (
            <>
              <Text style={styles.label}>NEGOCIO</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="storefront-outline" size={18} color={C.faint} />
                <TextInput
                  style={styles.input} placeholder="mi-restaurante" placeholderTextColor={C.faint}
                  value={slug} onChangeText={setSlug} autoCapitalize="none" autoCorrect={false}
                />
              </View>
              <Text style={[styles.label, { marginTop: 18 }]}>PIN DE ACCESO</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="key-outline" size={18} color={C.faint} />
                <TextInput
                  style={[styles.input, styles.codeInput]} placeholder="0000" placeholderTextColor={C.faint}
                  value={code} onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad" secureTextEntry maxLength={4} onSubmitEditing={submit}
                />
              </View>
              <Text style={styles.hint}>PIN personal de 4 dígitos o el pase diario del negocio.</Text>
            </>
          )}

          <TouchableOpacity style={styles.btn} onPress={submit} disabled={loading} activeOpacity={0.9}>
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
  subtitle: { color: C.sub, fontSize: 14, marginTop: 4, marginBottom: 24 },

  seg: { flexDirection: 'row', backgroundColor: C.card2, borderRadius: 14, padding: 4, marginBottom: 16, width: '100%', borderWidth: 1, borderColor: C.line },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segBtnOn: { backgroundColor: C.brand },
  segTxt: { color: C.sub, fontSize: 13, fontWeight: '800' },
  segTxtOn: { color: C.white },

  card: { width: '100%', backgroundColor: C.card, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: C.line, ...shadow.card },
  label: { color: C.faint, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14 },
  input: { flex: 1, color: C.text, fontSize: 15, paddingVertical: 14 },
  codeInput: { fontSize: 22, fontWeight: '800', letterSpacing: 8 },
  hint: { color: C.faint, fontSize: 11.5, marginTop: 12, lineHeight: 16 },

  btn: { marginTop: 22, borderRadius: 16, overflow: 'hidden', ...shadow.glow(C.brand) },
  btnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 17 },
  btnTxt: { color: C.white, fontSize: 16, fontWeight: '800' },

  footer: { color: C.faint, fontSize: 11, marginTop: 28 },
});
