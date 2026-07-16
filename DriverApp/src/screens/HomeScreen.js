import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable, ScrollView,
  RefreshControl, Alert, Vibration, AppState, Animated, Easing, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { fetchOrders, getSession, clearSession, setOnline as apiSetOnline, heartbeat, fetchOffers, acceptOffer, rejectOffer } from '../services/api';
import { joinDomiRoom, disconnectSocket } from '../services/socket';
import notifee, { EventType } from '@notifee/react-native';
import { C, shadow } from '../theme';
import { MapView, Camera, MarkerView, UserLocation, MAP_STYLE_URL } from '../mapEngine';
import {
  displayIncomingOrder, cancelIncomingOrder,
  startOnlineService, stopOnlineService, requestNotifPermission,
} from '../services/incomingOrder';
import AvailabilityToggle from '../components/AvailabilityToggle';
import DraggableSheet from '../components/DraggableSheet';
import OfferModal from '../components/OfferModal';

const SCREEN_H = Dimensions.get('window').height;
const DEFAULT_CENTER = [-74.0836, 4.6533]; // [lng, lat] — Bogotá
const DEFAULT_ZOOM = 12;

const fmtPrice = (n) => `$${(n || 0).toLocaleString('es-CO')}`;
const fmtTime  = (iso) => iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';

export default function HomeScreen({ navigation, domiInfo, onLogout }) {
  const insets = useSafeAreaInsets();
  const [orders, setOrders]      = useState([]);
  const [online, setOnline]      = useState(true);
  const [connected, setConn]     = useState(false);
  const [refreshing, setRefresh] = useState(false);
  const [offer, setOffer]        = useState(null);
  const cameraRef = useRef(null);
  const centerRef = useRef(DEFAULT_CENTER);
  const appState = useRef(AppState.currentState);

  const recenter = useCallback((zoom = 15) => {
    cameraRef.current?.setCamera({ centerCoordinate: centerRef.current, zoomLevel: zoom, animationDuration: 600 });
  }, []);

  // Remember the online/offline choice across app restarts
  useEffect(() => {
    AsyncStorage.getItem('domi_online').then(v => { if (v !== null) setOnline(v === '1'); });
  }, []);
  useEffect(() => { AsyncStorage.setItem('domi_online', online ? '1' : '0'); }, [online]);

  const name = domiInfo?.name || domiInfo?.deliveryPerson?.name || 'Domiciliario';
  const initial = name.charAt(0).toUpperCase();

  const load = useCallback(async () => {
    try {
      const { slug } = await getSession();
      const data = await fetchOrders(slug);
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err.status === 401) Alert.alert('Sesión expirada', 'Ingresa de nuevo.', [{ text: 'OK', onPress: onLogout }]);
    }
  }, [onLogout]);

  useEffect(() => {
    (async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      centerRef.current = [pos.coords.longitude, pos.coords.latitude];
      // Center now, and retry shortly after in case the map camera mounts later
      recenter(15);
      setTimeout(() => recenter(15), 700);
    })();
  }, [recenter]);

  // Pick up any offer already pending (e.g. arrived while app was closed)
  const loadOffers = useCallback(async () => {
    try {
      const { slug } = await getSession();
      const list = await fetchOffers(slug);
      if (Array.isArray(list) && list.length > 0) setOffer(list[0]);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    (async () => {
      const { token, slug } = await getSession();
      const socket = joinDomiRoom(token, domiInfo?.deliveryPersonId, slug, domiInfo?.mode);
      socket.on('connect', () => setConn(true));
      socket.on('disconnect', () => setConn(false));
      socket.on('delivery:offer', (o) => {
        setOffer(o);
        // Full-screen incoming-call alert (loops sound; fires even if backgrounded)
        displayIncomingOrder({
          offerId: o.offerId || o._id,
          orderId: o.orderId,
          address: o.address || o.order?.address,
          totalAmount: o.totalAmount ?? o.order?.totalAmount,
          distanceKm: o.distanceKm,
          timeoutSec: o.timeoutSec,
        }).catch(() => {});
      });
      socket.on('delivery:assigned', () => { Vibration.vibrate([0, 220, 120, 220]); setOffer(null); cancelIncomingOrder(); load(); });
      socket.on('order:status', () => load());
    })();
    loadOffers();
    return () => disconnectSocket();
  }, [domiInfo, load, loadOffers]);

  // In-app Notifee taps (Accept / Reject on the heads-up while app is open)
  useEffect(() => {
    return notifee.onForegroundEvent(({ type, detail }) => {
      if (type !== EventType.ACTION_PRESS) return;
      const id = detail.pressAction?.id;
      if (id === 'accept') handleAcceptOffer();
      else if (id === 'reject') handleRejectOffer();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer]);

  useEffect(() => {
    load();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active' && appState.current !== 'active') load();
      appState.current = s;
    });
    const iv = setInterval(load, 30000);
    return () => { sub.remove(); clearInterval(iv); };
  }, [load]);

  /* ── Report availability + location for auto-assignment ── */
  const reportOnline = useCallback(async (isOnline) => {
    try {
      const { slug } = await getSession();
      let lat, lng;
      const { granted } = await Location.getForegroundPermissionsAsync();
      if (granted) {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      }
      await apiSetOnline(slug, isOnline, lat, lng);
    } catch { /* non-critical */ }
  }, []);

  // Fire on toggle change
  useEffect(() => { reportOnline(online); }, [online, reportOnline]);

  // Keep-alive foreground service while online, so offers arrive even when the
  // driver switches to another app. Stops when going offline / leaving the screen.
  useEffect(() => {
    if (online) {
      requestNotifPermission();
      startOnlineService().catch(() => {});
    } else {
      stopOnlineService().catch(() => {});
    }
    return () => { stopOnlineService().catch(() => {}); };
  }, [online]);

  // Heartbeat every 60s while online so the assignment algorithm sees fresh location
  useEffect(() => {
    if (!online) return;
    const iv = setInterval(async () => {
      try {
        const { slug } = await getSession();
        const { granted } = await Location.getForegroundPermissionsAsync();
        if (!granted) return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await heartbeat(slug, pos.coords.latitude, pos.coords.longitude);
      } catch { /* noop */ }
    }, 60000);
    return () => clearInterval(iv);
  }, [online]);

  const onRefresh = async () => { setRefresh(true); await load(); setRefresh(false); };

  /* ── Offer handlers ── */
  const handleAcceptOffer = useCallback(async () => {
    if (!offer) return;
    const offerId = offer._id || offer.offerId;
    const orderId = offer.orderId || offer.order?._id;
    cancelIncomingOrder();
    try {
      const { slug } = await getSession();
      await acceptOffer(slug, offerId);
      setOffer(null);
      await load();
      // Open the accepted order right away so the domi can start the delivery
      try {
        const fresh = await fetchOrders(slug);
        const ord = (fresh || []).find(o => String(o._id) === String(orderId));
        if (ord) navigation.navigate('Order', { order: ord });
      } catch { /* the order is still in the list if this fails */ }
    } catch (err) {
      Alert.alert('No se pudo aceptar', err.data?.message || 'La oferta ya no está disponible.');
      setOffer(null);
    }
  }, [offer, load, navigation]);

  const handleRejectOffer = useCallback(async () => {
    if (!offer) return;
    const offerId = offer._id || offer.offerId;
    cancelIncomingOrder();
    try {
      const { slug } = await getSession();
      await rejectOffer(slug, offerId);
    } catch { /* noop */ }
    setOffer(null);
  }, [offer]);

  const handleExpireOffer = useCallback(() => { cancelIncomingOrder(); setOffer(null); }, []);

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => {
        await stopOnlineService().catch(() => {});
        await cancelIncomingOrder().catch(() => {});
        await clearSession();
        onLogout();
      } },
    ]);
  };

  const enRuta = orders.filter(o => o.deliveryPickedAt).length;
  const porCobrar = orders
    .filter(o => ['cash', 'efectivo'].includes((o.paymentMethod || '').toLowerCase()))
    .reduce((s, o) => s + (o.totalAmount || 0), 0);
  const markers = orders.filter(o => o.deliveryCoordinates?.lat && o.deliveryCoordinates?.lon);

  return (
    <View style={styles.container}>
      {/* MAP */}
      <MapView
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE_URL}
        logoEnabled={false}
        attributionEnabled
        compassEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onDidFinishLoadingMap={() => recenter(15)}
      >
        <Camera ref={cameraRef} defaultSettings={{ centerCoordinate: DEFAULT_CENTER, zoomLevel: DEFAULT_ZOOM }} />
        <UserLocation visible renderMode="normal" />
        {markers.map(o => (
          <MarkerView
            key={o._id}
            id={o._id}
            coordinate={[o.deliveryCoordinates.lon, o.deliveryCoordinates.lat]}
            anchor={{ x: 0.5, y: 1 }}
          >
            <Pressable onPress={() => navigation.navigate('Order', { order: o })} style={styles.pin} hitSlop={8}>
              <MaterialCommunityIcons name="map-marker" size={38} color={C.brand} />
              <View style={styles.pinDot} />
            </Pressable>
          </MarkerView>
        ))}
      </MapView>

      <View pointerEvents="none" style={[styles.scrim, { height: insets.top + 90 }]} />

      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.navigate('Profile')} style={styles.avatar}>
          <Text style={styles.avatarTxt}>{initial}</Text>
          <View style={[styles.connDot, { backgroundColor: connected ? C.go : C.brand }]} />
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Profile')} style={styles.headerCenter}>
          <Text style={styles.hello}>Hola, {name.split(' ')[0]}</Text>
          <Text style={styles.headerSub}>{connected ? 'Conectado en tiempo real' : 'Reconectando…'}</Text>
        </Pressable>
        <AvailabilityToggle online={online} onToggle={() => setOnline(v => !v)} />
      </View>

      {/* recenter */}
      <TouchableOpacity style={styles.recenter} onPress={() => recenter(15)}>
        <MaterialCommunityIcons name="crosshairs-gps" size={22} color={C.text} />
      </TouchableOpacity>

      {/* SHEET */}
      <DraggableSheet collapsedHeight={SCREEN_H * 0.4} expandedHeight={SCREEN_H * 0.86}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
        >
          <View style={styles.statsRow}>
            <Stat icon="cube-outline" label="Activos" value={orders.length} color={C.brand} />
            <Stat icon="bike-fast" label="En ruta" value={enRuta} color={C.blue} lib="mci" />
            <Stat icon="cash" label="Por cobrar" value={fmtPrice(porCobrar)} color={C.go} small />
          </View>

          <Text style={styles.sectionTitle}>{online ? 'Pedidos asignados' : 'Estás desconectado'}</Text>

          {!online ? (
            <OfflineCard onGoOnline={() => setOnline(true)} />
          ) : orders.length === 0 ? (
            <SearchingCard />
          ) : (
            orders.map(o => (
              <OrderCard key={o._id} order={o} onPress={() => navigation.navigate('Order', { order: o })} />
            ))
          )}
        </ScrollView>
      </DraggableSheet>

      {/* Incoming offer */}
      <OfferModal
        offer={offer}
        onAccept={handleAcceptOffer}
        onReject={handleRejectOffer}
        onExpire={handleExpireOffer}
      />
    </View>
  );
}

/* ── Sub-components ── */
function Stat({ icon, label, value, color, lib, small }) {
  const Icon = lib === 'mci' ? MaterialCommunityIcons : Ionicons;
  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: color + '22' }]}>
        <Icon name={icon} size={17} color={color} />
      </View>
      <Text style={[styles.statValue, small && { fontSize: 15 }]} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function OrderCard({ order, onPress }) {
  const picked = !!order.deliveryPickedAt;
  const accent = picked ? C.blue : C.brand;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.cardStripe, { backgroundColor: accent }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardNum}>#{order.orderNumber}</Text>
          <View style={[styles.chip, { backgroundColor: accent + '22' }]}>
            <View style={[styles.chipDot, { backgroundColor: accent }]} />
            <Text style={[styles.chipTxt, { color: accent }]}>{picked ? 'En ruta' : 'Recoger'}</Text>
          </View>
        </View>
        <Text style={styles.cardName}>{order.customerName}</Text>
        {order.address ? (
          <View style={styles.cardAddr}>
            <Ionicons name="location-outline" size={13} color={C.faint} />
            <Text style={styles.cardAddrTxt} numberOfLines={1}>{order.address}</Text>
          </View>
        ) : null}
        <View style={styles.cardFoot}>
          <Text style={styles.cardTime}>{fmtTime(order.createdAt)}</Text>
          <Text style={styles.cardPrice}>{fmtPrice(order.totalAmount)}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={C.faint} style={{ alignSelf: 'center', marginRight: 8 }} />
    </TouchableOpacity>
  );
}

function SearchingCard() {
  const s = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(s, { toValue: 1.35, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      Animated.timing(s, { toValue: 1, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [s]);
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.radar}>
        <Animated.View style={[styles.radarRing, { transform: [{ scale: s }], opacity: s.interpolate({ inputRange: [1, 1.35], outputRange: [0.5, 0] }) }]} />
        <View style={styles.radarCore}>
          <MaterialCommunityIcons name="motorbike" size={30} color={C.brand} />
        </View>
      </View>
      <Text style={styles.emptyTitle}>Buscando pedidos…</Text>
      <Text style={styles.emptyHint}>Te avisaremos apenas te asignen una entrega.</Text>
    </View>
  );
}

function OfflineCard({ onGoOnline }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.offlineIcon}>
        <MaterialCommunityIcons name="power-sleep" size={34} color={C.faint} />
      </View>
      <Text style={styles.emptyTitle}>Estás fuera de línea</Text>
      <Text style={styles.emptyHint}>Ponte en línea para recibir pedidos.</Text>
      <TouchableOpacity style={styles.goOnlineBtn} onPress={onGoOnline} activeOpacity={0.9}>
        <MaterialCommunityIcons name="lightning-bolt" size={18} color={C.white} />
        <Text style={styles.goOnlineTxt}>Ponerme en línea</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(244,246,250,0.82)' },

  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.brand, justifyContent: 'center', alignItems: 'center', ...shadow.glow(C.brand) },
  avatarTxt: { color: C.white, fontSize: 19, fontWeight: '800' },
  connDot: { position: 'absolute', bottom: -1, right: -1, width: 13, height: 13, borderRadius: 7, borderWidth: 2.5, borderColor: C.bg },
  headerCenter: { flex: 1 },
  hello: { color: C.text, fontSize: 17, fontWeight: '800' },
  headerSub: { color: C.sub, fontSize: 11.5, marginTop: 1 },

  recenter: { position: 'absolute', right: 16, bottom: SCREEN_H * 0.42, width: 46, height: 46, borderRadius: 23, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, justifyContent: 'center', alignItems: 'center', ...shadow.card },

  pin: { alignItems: 'center', justifyContent: 'center' },
  pinDot: { position: 'absolute', top: 8, width: 12, height: 12, borderRadius: 6, backgroundColor: C.white },

  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginTop: 6, marginBottom: 18 },
  stat: { flex: 1, backgroundColor: C.card2, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 10, borderWidth: 1, borderColor: C.lineSoft },
  statIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { color: C.text, fontSize: 19, fontWeight: '800' },
  statLabel: { color: C.faint, fontSize: 11, marginTop: 1, fontWeight: '600' },

  sectionTitle: { color: C.text, fontSize: 15, fontWeight: '800', paddingHorizontal: 16, marginBottom: 12 },

  card: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: C.card2, borderRadius: 20, borderWidth: 1, borderColor: C.lineSoft, overflow: 'hidden' },
  cardStripe: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardNum: { color: C.faint, fontSize: 11.5, fontWeight: '700' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipTxt: { fontSize: 11, fontWeight: '800' },
  cardName: { color: C.text, fontSize: 16, fontWeight: '800', marginTop: 6 },
  cardAddr: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  cardAddrTxt: { color: C.sub, fontSize: 12.5, flex: 1 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  cardTime: { color: C.faint, fontSize: 12 },
  cardPrice: { color: C.text, fontSize: 15, fontWeight: '800' },

  emptyWrap: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 30 },
  radar: { width: 96, height: 96, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  radarRing: { position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: C.brand + '33' },
  radarCore: { width: 66, height: 66, borderRadius: 33, backgroundColor: C.card2, borderWidth: 1, borderColor: C.brand + '55', justifyContent: 'center', alignItems: 'center' },
  offlineIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.card2, borderWidth: 1, borderColor: C.line, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { color: C.text, fontSize: 17, fontWeight: '800' },
  emptyHint: { color: C.sub, fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 19 },
  goOnlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, backgroundColor: C.go, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 14, ...shadow.glow(C.go) },
  goOnlineTxt: { color: C.white, fontSize: 15, fontWeight: '800' },
});
