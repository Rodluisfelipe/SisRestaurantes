import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Linking,
  TextInput, Vibration, Platform, ScrollView, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';

import { markPicked, confirmDelivery, getSession } from '../services/api';
import { emitLocation } from '../services/socket';
import { startBackgroundLocation, stopBackgroundLocation } from '../tasks/locationTask';
import { C, shadow } from '../theme';
import { MapView, Camera, MarkerView, ShapeSource, LineLayer, UserLocation, MAP_STYLE_URL } from '../mapEngine';
import SlideToConfirm from '../components/SlideToConfirm';
import DraggableSheet from '../components/DraggableSheet';

const SCREEN_H = Dimensions.get('window').height;
const fmtPrice = (n) => `$${(n || 0).toLocaleString('es-CO')}`;

export default function OrderScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { order: initial } = route.params;
  const [order, setOrder]   = useState(initial);
  const [picked, setPicked] = useState(!!initial.deliveryPickedAt);
  const [code, setCode]     = useState('');
  const [driverLoc, setDriverLoc] = useState(null);
  const [gps, setGps]       = useState('idle');
  const cameraRef = useRef(null);
  const watchRef = useRef(null);

  const dest = initial.deliveryCoordinates?.lat
    ? { latitude: initial.deliveryCoordinates.lat, longitude: initial.deliveryCoordinates.lon }
    : null;
  const needsCode = order.requireDeliveryCode !== false;

  const startTracking = useCallback(async () => {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) { setGps('error'); return; }
    setGps('active');
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 8 },
      ({ coords }) => {
        setDriverLoc({ latitude: coords.latitude, longitude: coords.longitude });
        emitLocation(order._id, coords.latitude, coords.longitude);
      },
    );
  }, [order._id]);

  const stopTracking = useCallback(() => {
    watchRef.current?.remove?.();
    watchRef.current = null;
    setGps('idle');
  }, []);

  useEffect(() => {
    (async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setDriverLoc({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    })();
    return () => stopTracking();
  }, [stopTracking]);

  useEffect(() => {
    if (picked) { startTracking(); startBackgroundLocation(order._id).catch(() => {}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (driverLoc && dest && cameraRef.current) {
      const lngs = [driverLoc.longitude, dest.longitude];
      const lats = [driverLoc.latitude, dest.latitude];
      const ne = [Math.max(...lngs), Math.max(...lats)];
      const sw = [Math.min(...lngs), Math.min(...lats)];
      cameraRef.current.fitBounds(ne, sw, [120, 80, SCREEN_H * 0.5, 80], 600);
    } else if (dest && cameraRef.current) {
      cameraRef.current.setCamera({ centerCoordinate: [dest.longitude, dest.latitude], zoomLevel: 15, animationDuration: 600 });
    }
  }, [driverLoc, dest]);

  const handlePicked = async () => {
    try {
      const { slug } = await getSession();
      await markPicked(slug, order._id);
      setPicked(true);
      setOrder(o => ({ ...o, deliveryPickedAt: new Date().toISOString(), status: 'inProgress' }));
      Vibration.vibrate(80);
      await startTracking();
      await startBackgroundLocation(order._id);
    } catch (err) {
      Alert.alert('Error', err.data?.message || 'No se pudo registrar la recogida.');
    }
  };

  const handleConfirm = async () => {
    if (needsCode && code.length < 4) return Alert.alert('Código requerido', 'Pide al cliente el código de 4 dígitos.');
    try {
      const { slug } = await getSession();
      await confirmDelivery(slug, order._id, needsCode ? code : undefined);
      stopTracking();
      await stopBackgroundLocation();
      Vibration.vibrate([0, 90, 70, 90]);
      Alert.alert('¡Entrega completada! 🎉', 'Buen trabajo.', [{ text: 'Continuar', onPress: () => navigation.goBack() }]);
    } catch (err) {
      Alert.alert('Código incorrecto', err.data?.message || 'Verifica el código con el cliente.');
    }
  };

  const call = () => order.phone && Linking.openURL(`tel:${order.phone}`);
  const whatsapp = () => {
    if (!order.phone) return;
    const msg = `Hola ${order.customerName}, soy tu domiciliario con el pedido #${order.orderNumber}.`;
    Linking.openURL(`https://wa.me/57${order.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`);
  };
  const openMaps = () => {
    if (!dest) return;
    const q = `${dest.latitude},${dest.longitude}`;
    Linking.openURL(Platform.OS === 'ios' ? `maps:?daddr=${q}` : `google.navigation:q=${q}`);
  };

  const footer = (
    <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12 }]}>
      {order.status === 'delivered' ? (
        <View style={styles.deliveredPill}>
          <Ionicons name="checkmark-circle" size={20} color={C.go} />
          <Text style={styles.deliveredTxt}>Pedido entregado</Text>
        </View>
      ) : !picked ? (
        <SlideToConfirm label="Desliza para recoger" color={C.brand} colorDark={C.brandDark} onConfirm={handlePicked} />
      ) : (
        <SlideToConfirm label="Desliza para entregar" color={C.go} colorDark={C.goDark} onConfirm={handleConfirm} />
      )}
    </View>
  );

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
      >
        <Camera ref={cameraRef} defaultSettings={{ centerCoordinate: dest ? [dest.longitude, dest.latitude] : [-74.0836, 4.6533], zoomLevel: 14 }} />
        <UserLocation visible renderMode="normal" />

        {driverLoc && dest && (
          <ShapeSource
            id="route"
            shape={{
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: [[driverLoc.longitude, driverLoc.latitude], [dest.longitude, dest.latitude]] },
            }}
          >
            <LineLayer id="routeLine" style={{ lineColor: C.brand, lineWidth: 4, lineDasharray: [2, 2], lineCap: 'round', lineJoin: 'round' }} />
          </ShapeSource>
        )}

        {dest && (
          <MarkerView id="dest" coordinate={[dest.longitude, dest.latitude]} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.destPin}>
              <View style={styles.destPinInner}>
                <Ionicons name="flag" size={16} color={C.white} />
              </View>
            </View>
          </MarkerView>
        )}
      </MapView>

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={styles.topPill}>
          <Text style={styles.topPillTxt}>Pedido #{order.orderNumber}</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={openMaps}>
          <MaterialCommunityIcons name="navigation-variant" size={22} color={C.brand} />
        </TouchableOpacity>
      </View>

      {gps === 'active' && (
        <View style={[styles.gpsBadge, { top: insets.top + 58 }]}>
          <View style={styles.gpsDot} />
          <Text style={styles.gpsTxt}>GPS activo · compartiendo ubicación</Text>
        </View>
      )}

      {/* Sheet */}
      <DraggableSheet collapsedHeight={SCREEN_H * 0.46} expandedHeight={SCREEN_H * 0.85} footer={footer}>
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
          <View style={styles.statusHead}>
            <View style={[styles.statusIcon, { backgroundColor: (picked ? C.blue : C.brand) + '22' }]}>
              <MaterialCommunityIcons name={picked ? 'bike-fast' : 'store'} size={22} color={picked ? C.blue : C.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>{picked ? 'En camino al cliente' : 'Recoge el pedido'}</Text>
              <Text style={styles.statusSub}>{picked ? 'Entrega y confirma con el código' : 'Ve al restaurante y recógelo'}</Text>
            </View>
          </View>

          <View style={styles.block}>
            <Text style={styles.blockLabel}>CLIENTE</Text>
            <Text style={styles.custName}>{order.customerName}</Text>
            {order.address ? (
              <View style={styles.addrRow}>
                <Ionicons name="location" size={15} color={C.brand} />
                <Text style={styles.addrTxt}>{order.address}</Text>
              </View>
            ) : null}
            {order.phone ? (
              <View style={styles.contactRow}>
                <TouchableOpacity style={styles.contactBtn} onPress={call} activeOpacity={0.85}>
                  <Ionicons name="call" size={16} color={C.go} />
                  <Text style={styles.contactTxt}>Llamar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contactBtn} onPress={whatsapp} activeOpacity={0.85}>
                  <FontAwesome5 name="whatsapp" size={16} color={C.go} />
                  <Text style={styles.contactTxt}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contactBtn} onPress={openMaps} activeOpacity={0.85}>
                  <MaterialCommunityIcons name="navigation-variant" size={16} color={C.blue} />
                  <Text style={[styles.contactTxt, { color: C.blue }]}>Ir</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View style={styles.block}>
            <Text style={styles.blockLabel}>PEDIDO</Text>
            {order.items?.map((it, i) => (
              <View key={i} style={styles.itemRow}>
                <Text style={styles.itemQty}>{it.quantity}×</Text>
                <Text style={styles.itemName}>{it.name}</Text>
                <Text style={styles.itemPrice}>{fmtPrice((it.price || 0) * (it.quantity || 1))}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total{['cash','efectivo'].includes((order.paymentMethod||'').toLowerCase()) ? ' a cobrar' : ''}</Text>
              <Text style={styles.totalVal}>{fmtPrice(order.totalAmount)}</Text>
            </View>
          </View>

          {picked && needsCode && (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>CÓDIGO DEL CLIENTE</Text>
              <TextInput
                style={styles.codeInput}
                placeholder="• • • •"
                placeholderTextColor={C.faint}
                value={code}
                onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
                textAlign="center"
              />
            </View>
          )}
        </ScrollView>
      </DraggableSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, justifyContent: 'center', alignItems: 'center', ...shadow.card },
  topPill: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, ...shadow.card },
  topPillTxt: { color: C.text, fontSize: 14, fontWeight: '800' },

  gpsBadge: { position: 'absolute', alignSelf: 'center', zIndex: 5, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.card, borderWidth: 1, borderColor: C.go + '55', paddingHorizontal: 13, paddingVertical: 7, borderRadius: 16, ...shadow.card },
  gpsDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.go },
  gpsTxt: { color: C.go, fontSize: 11.5, fontWeight: '700' },

  destPin: { alignItems: 'center', justifyContent: 'center' },
  destPinInner: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.brand, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: C.white, ...shadow.glow(C.brand) },

  statusHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 4, paddingBottom: 16 },
  statusIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  statusTitle: { color: C.text, fontSize: 16.5, fontWeight: '800' },
  statusSub: { color: C.sub, fontSize: 12.5, marginTop: 2 },

  block: { marginHorizontal: 16, marginBottom: 12, backgroundColor: C.card2, borderRadius: 18, borderWidth: 1, borderColor: C.lineSoft, padding: 16 },
  blockLabel: { color: C.faint, fontSize: 10.5, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  custName: { color: C.text, fontSize: 18, fontWeight: '800' },
  addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  addrTxt: { color: C.sub, fontSize: 14, flex: 1, lineHeight: 20 },
  contactRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  contactBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 11 },
  contactTxt: { color: C.go, fontSize: 13, fontWeight: '700' },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  itemQty: { color: C.brand, fontSize: 13, fontWeight: '800', width: 28 },
  itemName: { flex: 1, color: C.text, fontSize: 14 },
  itemPrice: { color: C.sub, fontSize: 13, fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  totalLabel: { color: C.sub, fontSize: 14, fontWeight: '700' },
  totalVal: { color: C.text, fontSize: 18, fontWeight: '800' },

  codeInput: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 16, color: C.text, fontSize: 30, fontWeight: '800', letterSpacing: 14 },

  actionBar: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: C.card },
  deliveredPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.go + '1A', borderWidth: 1, borderColor: C.go + '44', borderRadius: 16, paddingVertical: 18 },
  deliveredTxt: { color: C.go, fontSize: 16, fontWeight: '800' },
});
