import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  StatusBar,
} from 'react-native';
import { loginDomi } from '../services/api';

export default function AuthScreen({ onLogin }) {
  const [slug, setSlug]       = useState('');
  const [code, setCode]       = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const cleanSlug = slug.trim().toLowerCase();
    const cleanCode = code.trim();
    if (!cleanSlug) return Alert.alert('Campo requerido', 'Ingresa el identificador del negocio.');
    if (cleanCode.length < 4) return Alert.alert('Código inválido', 'El código debe tener al menos 4 caracteres.');

    setLoading(true);
    try {
      const data = await loginDomi(cleanSlug, cleanCode);
      onLogin(data);
    } catch (err) {
      const msg = err.data?.message || 'Código o negocio incorrecto.';
      Alert.alert('Error de acceso', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      <View style={styles.content}>
        {/* Logo / Icon */}
        <View style={styles.iconWrap}>
          <Text style={styles.iconText}>🛵</Text>
        </View>

        <Text style={styles.title}>Domi App</Text>
        <Text style={styles.subtitle}>Portal del domiciliario</Text>

        <View style={styles.card}>
          {/* Slug input */}
          <Text style={styles.label}>Negocio</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: restaurante-la-plaza"
            placeholderTextColor="#64748b"
            value={slug}
            onChangeText={setSlug}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          {/* Code input */}
          <Text style={[styles.label, { marginTop: 16 }]}>Código de acceso</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="1234"
            placeholderTextColor="#64748b"
            value={code}
            onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          <Text style={styles.hint}>
            Tu código es el PIN personal de 4 dígitos o el pase diario del negocio.
          </Text>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Entrar</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 36,
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  label: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#f8fafc',
    fontSize: 15,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 8,
  },
  hint: {
    color: '#475569',
    fontSize: 11,
    marginTop: 10,
    lineHeight: 16,
  },
  btn: {
    backgroundColor: '#ef4444',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
