import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, Linking, TextInput, ActivityIndicator,
  Vibration, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { markPicked, confirmDelivery, getSession } from '../services/api';
import { emitLocation } from '../services/socket';
import { startBackgroundLocation, stopBackgroundLocation } from '../tasks/locationTask';

const STATUS_LABEL = {
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  ready:     'Listo para recoger',
  inProgress: 'En camino',
  delivered: 'Entregado',
};

function fmtPrice(n) { return `$${(n || 0).toLocaleString('es-CO')}`; }

export default function OrderScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { order: initialOrder } = route.params;
  const [order, setOrder]     = useState(initialOrder);
  const [picked, setPicked]   = useState(!!initialOrder.deliveryPickedAt);
  const [delivering, setDelivering] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [code, setCode]       = useState('');
  const [gpsStatus, setGps]   = useState('idle'); // idle | requesting | active | error
  const watchRef = useRef(null);

  /* ── Foreground GPS tracking ── */
  const startFgTracking = useCallback(async () => {
    setGps('requesting');
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) {
      setGps('error');
      Alert.alert('Permiso requerido', 'Activa la ubicación para compartir tu posición con el restaurante.');
      return;
    }
    setGps('active');
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 8 },
      ({ coords }) => {
        emitLocation(order._id, coords.latitude, coords.longitude);
      },
    );
  }, [order._id]);

  const stopFgTracking = useCallback(() => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
    setGps('idle');
  }, []);

  /* ── Picked up ── */
  const handlePicked = async () => {
    setDelivering(true);
    try {
      const { slug } = await getSession();
      await markPicked(slug, order._id);
      setPicked(true);
      setOrder(o => ({ ...o, deliveryPickedAt: new Date().toISOString(), status: 'inProgress' }));
      Vibration.vibrate(100);
      // Start GPS (foreground + background)
      await startFgTracking();
      await startBackgroundLocation(order._id);
    } catch (err) {
      Alert.alert('Error', err.data?.message || 'No se pudo registrar la recogida.');
    } finally {
      setDelivering(false);
    }
  };

  /* ── Confirm delivery ── */
  const handleConfirm = async () => {
    if (order.requireDeliveryCode !== false && code.length < 4) {
      return Alert.alert('Código requerido', 'Ingresa el código de confirmación del cliente.');
    }
    setConfirming(true);
    try {
      const { slug } = await getSession();
      const payload = order.requireDeliveryCode === false ? { skipCode: true } : { code };
      await confirmDelivery(slug, order._id, payload.code);
      stopFgTracking();
      await stopBackgroundLocation();
      Vibration.vibrate([0, 100, 80, 100]);
      Alert.alert('¡Entrega completada!', 'Pedido marcado como entregado.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      const msg = err.data?.message || 'Código incorrecto. Intenta de nuevo.';
      Alert.alert('Error', msg);
    } finally {
      setConfirming(false);
    }
  };

  /* ── Stop tracking on unmount ── */
  useEffect(() => {
    return () => { stopFgTracking(); };
  }, [stopFgTracking]);

  /* ── Call / WhatsApp ── */
  const callCustomer = () => {
    if (order.phone) Linking.openURL(`tel:${order.phone}`);
  };

  const whatsapp = (msg) => {
    if (!order.phone) return;
    const phone = order.phone.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/57${phone}?text=${encodeURIComponent(msg)}`);
  };

  const waMessages = {
    onWay: `Hola ${order.customerName}, soy el domiciliario. Ya salí con tu pedido #${order.orderNumber}. Tiempo estimado: ${order.estimatedDeliveryTime?.min || 20}-${order.estimatedDeliveryTime?.max || 35} min.`,
    arriving: `Hola ${order.customerName}, estoy a pocos minutos de tu ubicación con tu pedido #${order.orderNumber}. 🛵`,
  };

  /* ── GPS status badge ── */
  const gpsBadge = () => {
    if (gpsStatus === 'active') return <View style={styles.gpsBadgeActive}><Text style={styles.gpsBadgeText}>GPS activo</Text></View>;
    if (gpsStatus === 'requesting') return <View style={styles.gpsBadgeWait}><ActivityIndicator size="small" color="#f59e0b" /></View>;
    if (gpsStatus === 'error') return <View style={styles.gpsBadgeError}><Text style={styles.gpsBadgeText}>Error GPS</Text></View>;
    return null;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>#{order.orderNumber}</Text>
        {gpsBadge()}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* Status card */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Estado</Text>
          <Text style={styles.statusText}>{STATUS_LABEL[order.status] || order.status}</Text>
        </View>

        {/* Customer info */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Cliente</Text>
          <Text style={styles.customerName}>{order.customerName}</Text>
          {order.phone && (
            <View style={styles.contactRow}>
              <TouchableOpacity onPress={callCustomer} style={styles.contactBtn}>
                <Text style={styles.contactBtnText}>📞 Llamar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => whatsapp(waMessages.onWay)} style={styles.contactBtn}>
                <Text style={styles.contactBtnText}>💬 En camino</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => whatsapp(waMessages.arriving)} style={styles.contactBtn}>
                <Text style={styles.contactBtnText}>📍 Llegando</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Address */}
        {order.address && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Dirección</Text>
            <Text style={styles.addressText}>{order.address}</Text>
            <TouchableOpacity
              onPress={() => {
                const addr = encodeURIComponent(order.address);
                const url = Platform.OS === 'ios'
                  ? `maps:?q=${addr}`
                  : `geo:0,0?q=${addr}`;
                Linking.openURL(url);
              }}
              style={styles.mapsBtn}
            >
              <Text style={styles.mapsBtnText}>Abrir en Mapas</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Items */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Pedido</Text>
          {order.items?.map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <Text style={styles.itemQty}>×{item.quantity}</Text>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>{fmtPrice(item.price * item.quantity)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{fmtPrice(order.totalAmount)}</Text>
          </View>
        </View>

        {/* ── Action section ── */}
        {order.status !== 'delivered' && (
          <View style={styles.section}>
            {!picked ? (
              /* Step 1: Pick up */
              <TouchableOpacity
                style={[styles.actionBtn, styles.pickBtn, delivering && styles.btnDisabled]}
                onPress={handlePicked}
                disabled={delivering}
                activeOpacity={0.85}
              >
                {delivering
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.actionBtnText}>🛵 Ya recogí el pedido</Text>
                }
              </TouchableOpacity>
            ) : (
              /* Step 2: Confirm delivery */
              <View>
                <Text style={styles.sectionLabel}>Confirmar entrega</Text>
                {order.requireDeliveryCode !== false && (
                  <>
                    <Text style={styles.codeHint}>
                      Pide al cliente el código de {order.confirmationCode?.length || 4} dígitos que recibió.
                    </Text>
                    <TextInput
                      style={styles.codeInput}
                      placeholder="Código del cliente"
                      placeholderTextColor="#475569"
                      value={code}
                      onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 4))}
                      keyboardType="number-pad"
                      maxLength={4}
                      textAlign="center"
                    />
                  </>
                )}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.confirmBtn, confirming && styles.btnDisabled]}
                  onPress={handleConfirm}
                  disabled={confirming}
                  activeOpacity={0.85}
                >
                  {confirming
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.actionBtnText}>✅ Confirmar entrega</Text>
                  }
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {order.status === 'delivered' && (
          <View style={[styles.section, styles.deliveredCard]}>
            <Text style={styles.deliveredText}>✅ Pedido entregado</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0f172a' },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b', gap: 12 },
  backBtn:      { paddingRight: 4 },
  backText:     { color: '#94a3b8', fontSize: 16 },
  headerTitle:  { flex: 1, color: '#f8fafc', fontSize: 17, fontWeight: '800' },

  gpsBadgeActive: { backgroundColor: '#10b98120', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#10b98140' },
  gpsBadgeWait:   { backgroundColor: '#f59e0b20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  gpsBadgeError:  { backgroundColor: '#ef444420', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  gpsBadgeText:   { color: '#10b981', fontSize: 10, fontWeight: '700' },

  scroll:       { flex: 1 },
  content:      { padding: 16, gap: 12 },

  section:      { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#334155' },
  sectionLabel: { color: '#64748b', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },

  statusText:   { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  customerName: { color: '#f8fafc', fontSize: 17, fontWeight: '800', marginBottom: 10 },

  contactRow:   { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  contactBtn:   { backgroundColor: '#0f172a', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#334155' },
  contactBtnText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },

  addressText:  { color: '#cbd5e1', fontSize: 14, lineHeight: 20, marginBottom: 10 },
  mapsBtn:      { backgroundColor: '#3b82f620', borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: '#3b82f640' },
  mapsBtnText:  { color: '#60a5fa', fontSize: 13, fontWeight: '700' },

  itemRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  itemQty:      { color: '#64748b', fontSize: 12, fontWeight: '700', width: 28 },
  itemName:     { flex: 1, color: '#cbd5e1', fontSize: 13 },
  itemPrice:    { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  totalRow:     { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' },
  totalLabel:   { color: '#94a3b8', fontSize: 13, fontWeight: '700' },
  totalValue:   { color: '#f8fafc', fontSize: 16, fontWeight: '800' },

  actionBtn:    { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  pickBtn:      { backgroundColor: '#3b82f6' },
  confirmBtn:   { backgroundColor: '#10b981' },
  btnDisabled:  { opacity: 0.6 },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  codeHint:     { color: '#64748b', fontSize: 12, marginBottom: 10, lineHeight: 17 },
  codeInput:    { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 12, paddingVertical: 14, color: '#f8fafc', fontSize: 22, fontWeight: '800', letterSpacing: 8, marginBottom: 12 },

  deliveredCard: { alignItems: 'center', paddingVertical: 20 },
  deliveredText: { color: '#10b981', fontSize: 17, fontWeight: '800' },
});
