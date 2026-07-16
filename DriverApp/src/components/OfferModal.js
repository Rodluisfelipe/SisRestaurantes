import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Vibration, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C, shadow } from '../theme';

const fmtPrice = (n) => `$${(n || 0).toLocaleString('es-CO')}`;

/**
 * Incoming offer — the Rappi-like moment. Shows a countdown; the driver accepts
 * or rejects. On timeout it auto-dismisses (the server expires + re-offers).
 */
export default function OfferModal({ offer, onAccept, onReject, onExpire }) {
  const insets = useSafeAreaInsets();
  const [acting, setActing] = useState(null); // 'accept' | 'reject'
  const bar = useRef(new Animated.Value(1)).current;
  const [secsLeft, setSecsLeft] = useState(0);
  const expireFired = useRef(false);

  const visible = !!offer;

  const totalMs = offer ? Math.max(new Date(offer.expiresAt).getTime() - Date.now(), 0) : 0;

  useEffect(() => {
    if (!offer) return;
    expireFired.current = false;
    Vibration.vibrate([0, 400, 200, 400]);

    const total = Math.max(new Date(offer.expiresAt).getTime() - Date.now(), 1);
    bar.setValue(1);
    Animated.timing(bar, { toValue: 0, duration: total, useNativeDriver: false }).start();

    const tick = () => {
      const left = Math.max(Math.ceil((new Date(offer.expiresAt).getTime() - Date.now()) / 1000), 0);
      setSecsLeft(left);
      if (left <= 0 && !expireFired.current) {
        expireFired.current = true;
        onExpire?.();
      }
    };
    tick();
    const iv = setInterval(tick, 250);
    return () => clearInterval(iv);
  }, [offer, bar, onExpire]);

  const doAccept = useCallback(async () => {
    setActing('accept');
    try { await onAccept?.(); } finally { setActing(null); }
  }, [onAccept]);

  const doReject = useCallback(async () => {
    setActing('reject');
    try { await onReject?.(); } finally { setActing(null); }
  }, [onReject]);

  if (!visible) return null;
  const o = offer.order || {};

  const barColor = bar.interpolate({ inputRange: [0, 0.3, 1], outputRange: [C.bad, C.amber, C.go] });

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.card, { paddingBottom: insets.bottom + 20 }]}>
          {/* countdown bar */}
          <View style={styles.barTrack}>
            <Animated.View style={[styles.barFill, { width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), backgroundColor: barColor }]} />
          </View>

          <View style={styles.head}>
            <View style={styles.pulse}><MaterialCommunityIcons name="motorbike" size={26} color={C.brand} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>¡Nuevo pedido!</Text>
              <Text style={styles.sub}>Pedido #{offer.orderNumber || o.orderNumber}</Text>
            </View>
            <View style={styles.timer}>
              <Text style={styles.timerNum}>{secsLeft}</Text>
              <Text style={styles.timerUnit}>seg</Text>
            </View>
          </View>

          {/* details */}
          <View style={styles.details}>
            <Row icon="person-outline" label={o.customerName || offer.customerName || 'Cliente'} />
            {(o.address || offer.address) ? <Row icon="location-outline" label={o.address || offer.address} multiline /> : null}
            <View style={styles.metaRow}>
              {offer.distanceKm != null && (
                <View style={styles.metaPill}>
                  <MaterialCommunityIcons name="map-marker-distance" size={14} color={C.blue} />
                  <Text style={styles.metaTxt}>{offer.distanceKm.toFixed(1)} km</Text>
                </View>
              )}
              <View style={styles.metaPill}>
                <Ionicons name="cash-outline" size={14} color={C.go} />
                <Text style={styles.metaTxt}>{fmtPrice(o.totalAmount || offer.totalAmount)}</Text>
              </View>
              {o.items?.length ? (
                <View style={styles.metaPill}>
                  <Ionicons name="bag-handle-outline" size={14} color={C.sub} />
                  <Text style={styles.metaTxt}>{o.items.length} ítems</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.reject]} onPress={doReject} disabled={!!acting} activeOpacity={0.85}>
              {acting === 'reject' ? <ActivityIndicator color={C.sub} /> : <Text style={styles.rejectTxt}>Rechazar</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.accept]} onPress={doAccept} disabled={!!acting} activeOpacity={0.85}>
              {acting === 'accept' ? <ActivityIndicator color={C.white} /> : (
                <>
                  <Ionicons name="checkmark" size={20} color={C.white} />
                  <Text style={styles.acceptTxt}>Aceptar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Row({ icon, label, multiline }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={C.faint} style={{ marginTop: 1 }} />
      <Text style={[styles.rowTxt, multiline && { lineHeight: 20 }]} numberOfLines={multiline ? 3 : 1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  card: { backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: C.line, padding: 22, ...shadow.card },

  barTrack: { height: 6, borderRadius: 3, backgroundColor: C.card2, overflow: 'hidden', marginBottom: 20 },
  barFill: { height: '100%', borderRadius: 3 },

  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  pulse: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.brand + '22', justifyContent: 'center', alignItems: 'center' },
  title: { color: C.text, fontSize: 20, fontWeight: '900' },
  sub: { color: C.sub, fontSize: 13, marginTop: 1 },
  timer: { alignItems: 'center', backgroundColor: C.card2, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: C.line },
  timerNum: { color: C.text, fontSize: 22, fontWeight: '900' },
  timerUnit: { color: C.faint, fontSize: 10, fontWeight: '700', marginTop: -2 },

  details: { backgroundColor: C.card2, borderRadius: 18, padding: 16, gap: 10, marginBottom: 20, borderWidth: 1, borderColor: C.lineSoft },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  rowTxt: { flex: 1, color: C.text, fontSize: 14, fontWeight: '600' },
  metaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 2 },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: C.line },
  metaTxt: { color: C.text, fontSize: 12.5, fontWeight: '700' },

  actions: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16, borderRadius: 16 },
  reject: { backgroundColor: C.card2, borderWidth: 1, borderColor: C.line },
  rejectTxt: { color: C.sub, fontSize: 15, fontWeight: '800' },
  accept: { backgroundColor: C.brand, ...shadow.glow(C.brand) },
  acceptTxt: { color: C.white, fontSize: 16, fontWeight: '900' },
});
