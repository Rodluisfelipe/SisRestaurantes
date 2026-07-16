import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { getSession, fetchMe, fetchMyStats, uploadPhoto } from '../services/api';
import { C, shadow } from '../theme';

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }) : '';

export default function ProfileScreen({ navigation, onLogout }) {
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const { slug } = await getSession();
      const [m, s] = await Promise.all([fetchMe(slug), fetchMyStats(slug)]);
      setMe(m); setStats(s);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const changePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos.');
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    setUploading(true);
    try {
      const { slug } = await getSession();
      const out = await uploadPhoto(slug, res.assets[0].uri);
      setMe(prev => ({ ...prev, photo: out.photo }));
    } catch (err) {
      Alert.alert('Error', err.data?.message || 'No se pudo subir la foto.');
    } finally { setUploading(false); }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={C.brand} size="large" /></View>;
  }

  const initial = (me?.name || '?').charAt(0).toUpperCase();
  const maxBar = Math.max(1, ...((stats?.chartData || []).map(d => d.count)));

  return (
    <View style={styles.container}>
      {/* top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Mi perfil</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
      >
        {/* header card */}
        <View style={styles.headerCard}>
          <TouchableOpacity onPress={changePhoto} activeOpacity={0.85} style={styles.avatarWrap}>
            {me?.photo ? (
              <Image source={{ uri: me.photo }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{initial}</Text></View>
            )}
            <View style={styles.camBadge}>
              {uploading ? <ActivityIndicator color={C.white} size="small" /> : <Ionicons name="camera" size={15} color={C.white} />}
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{me?.name}</Text>
          {me?.phone ? <Text style={styles.phone}>{me.phone}</Text> : null}
          <View style={styles.ratingPill}>
            <Ionicons name="star" size={13} color={C.amber} />
            <Text style={styles.ratingTxt}>{(me?.rating ?? 5).toFixed(1)}</Text>
          </View>
        </View>

        {/* stats */}
        <View style={styles.statsRow}>
          <Stat value={stats?.total ?? 0} label="Entregas" color={C.brand} />
          <Stat value={stats?.today ?? 0} label="Hoy" color={C.blue} />
          <Stat value={stats?.week ?? 0} label="Semana" color={C.go} />
          <Stat value={`${stats?.avgMinutes ?? 0}m`} label="Promedio" color={C.violet} small />
        </View>

        {/* 7-day chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Entregas — últimos 7 días</Text>
          <View style={styles.chart}>
            {(stats?.chartData || []).map((d, i) => (
              <View key={i} style={styles.barCol}>
                <Text style={styles.barVal}>{d.count > 0 ? d.count : ''}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${Math.round((d.count / maxBar) * 100)}%` }]} />
                </View>
                <Text style={styles.barLabel}>{d.date}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* restaurant */}
        {me?.business && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Restaurante</Text>
            <View style={styles.bizRow}>
              {me.business.logo ? (
                <Image source={{ uri: me.business.logo }} style={styles.bizLogo} />
              ) : (
                <View style={styles.bizLogoFallback}><MaterialCommunityIcons name="storefront" size={22} color={C.brand} /></View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.bizName}>{me.business.name}</Text>
                {me.business.slug ? <Text style={styles.bizSlug}>menuby.tech/{me.business.slug}</Text> : null}
              </View>
            </View>
          </View>
        )}

        {me?.memberSince ? <Text style={styles.member}>Miembro desde {fmtDate(me.memberSince)}</Text> : null}

        <TouchableOpacity style={styles.logout} onPress={onLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color={C.bad} />
          <Text style={styles.logoutTxt}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label, color, small }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }, small && { fontSize: 18 }]} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  topTitle: { color: C.text, fontSize: 16, fontWeight: '800' },

  headerCard: { alignItems: 'center', paddingVertical: 20, marginHorizontal: 16, marginTop: 4, backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.line, ...shadow.card },
  avatarWrap: { width: 96, height: 96, marginBottom: 12 },
  avatarImg: { width: 96, height: 96, borderRadius: 48, backgroundColor: C.card2 },
  avatarFallback: { width: 96, height: 96, borderRadius: 48, backgroundColor: C.brand, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: C.white, fontSize: 38, fontWeight: '900' },
  camBadge: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: C.brand, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: C.card },
  name: { color: C.text, fontSize: 20, fontWeight: '900' },
  phone: { color: C.sub, fontSize: 13, marginTop: 2 },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, backgroundColor: C.card2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: C.line },
  ratingTxt: { color: C.text, fontSize: 13, fontWeight: '800' },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 14 },
  stat: { flex: 1, backgroundColor: C.card, borderRadius: 18, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: C.line, ...shadow.card },
  statValue: { fontSize: 22, fontWeight: '900' },
  statLabel: { color: C.faint, fontSize: 11, marginTop: 2, fontWeight: '600' },

  card: { marginHorizontal: 16, marginTop: 14, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 16, ...shadow.card },
  cardTitle: { color: C.text, fontSize: 14, fontWeight: '800', marginBottom: 14 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 130 },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barVal: { color: C.faint, fontSize: 10, fontWeight: '700', marginBottom: 3 },
  barTrack: { width: 18, flex: 1, justifyContent: 'flex-end', backgroundColor: C.card2, borderRadius: 6, overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: C.brand, borderRadius: 6, minHeight: 4 },
  barLabel: { color: C.faint, fontSize: 10, marginTop: 5, fontWeight: '600' },

  bizRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bizLogo: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.card2 },
  bizLogoFallback: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.brand + '18', justifyContent: 'center', alignItems: 'center' },
  bizName: { color: C.text, fontSize: 15, fontWeight: '800' },
  bizSlug: { color: C.sub, fontSize: 12, marginTop: 2 },

  member: { color: C.faint, fontSize: 12, textAlign: 'center', marginTop: 16 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 16, paddingVertical: 14, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  logoutTxt: { color: C.bad, fontSize: 15, fontWeight: '800' },
});
