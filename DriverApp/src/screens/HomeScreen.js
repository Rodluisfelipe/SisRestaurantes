import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, StatusBar, Alert, Vibration, AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchOrders, getSession, clearSession } from '../services/api';
import { joinDomiRoom, disconnectSocket } from '../services/socket';

const STATUS_COLOR = {
  confirmed:  '#3b82f6',
  preparing:  '#f59e0b',
  ready:      '#10b981',
  inProgress: '#8b5cf6',
};

const STATUS_LABEL = {
  confirmed:  'Confirmado',
  preparing:  'Preparando',
  ready:      'Listo para recoger',
  inProgress: 'En camino',
};

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function fmtPrice(n) {
  return `$${(n || 0).toLocaleString('es-CO')}`;
}

export default function HomeScreen({ navigation, domiInfo, onLogout }) {
  const insets = useSafeAreaInsets();
  const [orders, setOrders]       = useState([]);
  const [refreshing, setRefresh]  = useState(false);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const appState  = useRef(AppState.currentState);

  const load = useCallback(async () => {
    try {
      const { slug } = await getSession();
      const data = await fetchOrders(slug);
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err.status === 401) {
        Alert.alert('Sesión expirada', 'Por favor ingresa de nuevo.', [
          { text: 'OK', onPress: onLogout },
        ]);
      }
    }
  }, [onLogout]);

  /* ── Socket setup ── */
  useEffect(() => {
    (async () => {
      const { token, slug } = await getSession();
      const socket = joinDomiRoom(
        token,
        domiInfo?.deliveryPersonId,
        slug,
        domiInfo?.mode,
      );
      socketRef.current = socket;

      socket.on('connect', () => setConnected(true));
      socket.on('disconnect', () => setConnected(false));

      socket.on('delivery:assigned', () => {
        Vibration.vibrate([0, 200, 100, 200]);
        load();
      });

      socket.on('order:status', () => load());
    })();

    return () => disconnectSocket();
  }, [domiInfo, load]);

  /* ── Polling when app in background ── */
  useEffect(() => {
    load();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && appState.current !== 'active') {
        load();
      }
      appState.current = state;
    });
    const interval = setInterval(load, 30_000);
    return () => { sub.remove(); clearInterval(interval); };
  }, [load]);

  const onRefresh = async () => {
    setRefresh(true);
    await load();
    setRefresh(false);
  };

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => { await clearSession(); onLogout(); } },
    ]);
  };

  const renderOrder = ({ item: order }) => {
    const statusColor = STATUS_COLOR[order.status] || '#64748b';
    const statusText  = STATUS_LABEL[order.status] || order.status;
    const isPickedUp  = !!order.deliveryPickedAt;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('Order', { order })}
        activeOpacity={0.82}
      >
        {/* Status stripe */}
        <View style={[styles.stripe, { backgroundColor: statusColor }]} />

        <View style={styles.cardBody}>
          {/* Header row */}
          <View style={styles.row}>
            <Text style={styles.orderNum}>#{order.orderNumber}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor + '55' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
            </View>
          </View>

          {/* Customer */}
          <Text style={styles.customerName}>{order.customerName}</Text>

          {/* Address */}
          {order.address ? (
            <Text style={styles.address} numberOfLines={2}>{order.address}</Text>
          ) : null}

          {/* Footer */}
          <View style={[styles.row, { marginTop: 10 }]}>
            <Text style={styles.time}>{fmtTime(order.createdAt)}</Text>
            <Text style={styles.price}>{fmtPrice(order.totalAmount)}</Text>
          </View>

          {/* Picked indicator */}
          {isPickedUp && (
            <View style={styles.pickedRow}>
              <View style={styles.pickedDot} />
              <Text style={styles.pickedText}>Recogido · GPS activo</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Mis pedidos</Text>
          <View style={styles.connRow}>
            <View style={[styles.connDot, { backgroundColor: connected ? '#10b981' : '#ef4444' }]} />
            <Text style={styles.connText}>{connected ? 'Conectado' : 'Sin conexión'}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={orders}
        keyExtractor={o => o._id}
        renderItem={renderOrder}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ef4444" />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🛵</Text>
            <Text style={styles.emptyTitle}>Sin pedidos asignados</Text>
            <Text style={styles.emptyHint}>Te avisaremos cuando llegue uno nuevo.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0f172a' },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  headerTitle:  { color: '#f8fafc', fontSize: 20, fontWeight: '800' },
  connRow:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  connDot:      { width: 6, height: 6, borderRadius: 3 },
  connText:     { color: '#64748b', fontSize: 11 },
  logoutBtn:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  logoutText:   { color: '#94a3b8', fontSize: 13, fontWeight: '600' },

  list:         { padding: 16, gap: 12 },

  card:         { backgroundColor: '#1e293b', borderRadius: 16, borderWidth: 1, borderColor: '#334155', overflow: 'hidden', flexDirection: 'row' },
  stripe:       { width: 4 },
  cardBody:     { flex: 1, padding: 14 },

  row:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderNum:     { color: '#64748b', fontSize: 11, fontWeight: '700' },
  statusBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  statusDot:    { width: 5, height: 5, borderRadius: 3 },
  statusText:   { fontSize: 10, fontWeight: '700' },

  customerName: { color: '#f8fafc', fontSize: 15, fontWeight: '700', marginTop: 4 },
  address:      { color: '#64748b', fontSize: 12, marginTop: 4, lineHeight: 17 },
  time:         { color: '#475569', fontSize: 11 },
  price:        { color: '#f8fafc', fontSize: 14, fontWeight: '800' },

  pickedRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  pickedDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  pickedText:   { color: '#10b981', fontSize: 11, fontWeight: '600' },

  empty:        { alignItems: 'center', paddingTop: 80 },
  emptyIcon:    { fontSize: 48, marginBottom: 16 },
  emptyTitle:   { color: '#94a3b8', fontSize: 17, fontWeight: '700' },
  emptyHint:    { color: '#475569', fontSize: 13, marginTop: 6 },
});
