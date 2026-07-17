import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Linking,
  TextInput, Vibration, Platform, ScrollView, Dimensions, Image, Modal, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';

import { arrivedStore, confirmDelivery, getSession } from '../services/api';
import { emitLocation } from '../services/socket';
import { startBackgroundLocation, stopBackgroundLocation } from '../tasks/locationTask';
import { C, shadow } from '../theme';
import { MapView, Camera, MarkerView, ShapeSource, LineLayer, UserLocation, MAP_STYLE_URL } from '../mapEngine';
import Sheet from '../components/Sheet';

const SCREEN_H = Dimensions.get('window').height;
const SNAP_POINTS = ['50%', '90%'];
const fmtPrice = (n) => `$${(n || 0).toLocaleString('es-CO')}`;

export default function OrderScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { order: initial } = route.params;
  const [order, setOrder]   = useState(initial);
  const [picked, setPicked] = useState(!!initial.deliveryPickedAt);
  const [codeModal, setCodeModal] = useState(null); // 'pickup' | 'deliver'
  const [modalCode, setModalCode] = useState('');
  const [driverLoc, setDriverLoc] = useState(null);
  const [gps, setGps]       = useState('idle');
  const [busy, setBusy]     = useState(false);
  const cameraRef = useRef(null);
  const sheetRef = useRef(null);
  const watchRef = useRef(null);

  const rest = initial.restaurant || null;
  const restCoords = rest?.coordinates?.lat ? { latitude: rest.coordinates.lat, longitude: rest.coordinates.lng } : null;
  const custCoords = initial.deliveryCoordinates?.lat
    ? { latitude: initial.deliveryCoordinates.lat, longitude: initial.deliveryCoordinates.lon }
    : null;
  const needsCode = order.requireConfirmationCode !== false;

  // Current navigation target depends on the phase
  const target = picked ? custCoords : restCoords;

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

  // Fit the map to driver + current target
  useEffect(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    if (driverLoc && target) {
      const lngs = [driverLoc.longitude, target.longitude];
      const lats = [driverLoc.latitude, target.latitude];
      cam.fitBounds([Math.max(...lngs), Math.max(...lats)], [Math.min(...lngs), Math.min(...lats)], [120, 80, SCREEN_H * 0.5, 80], 600);
    } else if (target) {
      cam.setCamera({ centerCoordinate: [target.longitude, target.latitude], zoomLevel: 15, animationDuration: 600 });
    } else if (driverLoc) {
      cam.setCamera({ centerCoordinate: [driverLoc.longitude, driverLoc.latitude], zoomLevel: 15, animationDuration: 600 });
    }
  }, [driverLoc, target, picked]);

  const handlePickup = async (enteredCode) => {
    if ((enteredCode || '').length !== 4) return Alert.alert('Código requerido', 'Ingresa el código de recogida de 4 dígitos que te da el restaurante.');
    setBusy(true);
    try {
      const { slug } = await getSession();
      await arrivedStore(slug, order._id, enteredCode);
      setCodeModal(null);
      setPicked(true);
      setOrder(o => ({ ...o, deliveryPickedAt: new Date().toISOString(), deliveryArrivedStoreAt: new Date().toISOString() }));
      Vibration.vibrate(80);
      await startTracking();
      await startBackgroundLocation(order._id);
    } catch (err) {
      Alert.alert('No se pudo recoger', err.data?.message || 'Verifica el código con el restaurante.');
    } finally { setBusy(false); }
  };

  const handleConfirm = async (enteredCode) => {
    if (needsCode && (enteredCode || '').length !== 4) return Alert.alert('Código requerido', 'Ingresa el código de 4 dígitos que te da el cliente.');
    setBusy(true);
    try {
      const { slug } = await getSession();
      await confirmDelivery(slug, order._id, needsCode ? enteredCode : undefined);
      setCodeModal(null);
      stopTracking();
      await stopBackgroundLocation();
      Vibration.vibrate([0, 90, 70, 90]);
      Alert.alert('¡Entrega completada! 🎉', 'Buen trabajo.', [{ text: 'Continuar', onPress: () => navigation.goBack() }]);
    } catch (err) {
      Alert.alert('Código incorrecto', err.data?.message || 'Verifica el código con el cliente.');
    } finally { setBusy(false); }
  };

  const openCode = (mode) => { setModalCode(''); setCodeModal(mode); };
  const submitCode = () => { if (codeModal === 'pickup') handlePickup(modalCode); else handleConfirm(modalCode); };

  const call = (phone) => phone && Linking.openURL(`tel:${phone}`);
  const whatsapp = (phone) => {
    if (!phone) return;
    const msg = `Hola ${order.customerName}, soy tu domiciliario con el pedido #${order.orderNumber}.`;
    Linking.openURL(`https://wa.me/57${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`);
  };
  const openMaps = (coords) => {
    if (!coords) return;
    const q = `${coords.latitude},${coords.longitude}`;
    // geo: lets the driver pick any maps app (Google, Waze…)
    const url = Platform.OS === 'ios' ? `maps:?daddr=${q}` : `geo:${q}?q=${q}`;
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}`));
  };

  const footer = (
    <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12 }]}>
      {order.status === 'delivered' ? (
        <View style={styles.deliveredPill}>
          <Ionicons name="checkmark-circle" size={20} color={C.go} />
          <Text style={styles.deliveredTxt}>Pedido entregado</Text>
        </View>
      ) : !picked ? (
        <>
          <TouchableOpacity style={styles.navBtn} onPress={() => openMaps(restCoords)} activeOpacity={0.9}>
            <MaterialCommunityIcons name="navigation-variant" size={18} color={C.brand} />
            <Text style={styles.navBtnTxt}>Ir al restaurante</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: C.brand }]} onPress={() => openCode('pickup')} activeOpacity={0.9}>
            <Ionicons name="checkmark-circle" size={20} color={C.white} />
            <Text style={styles.primaryBtnTxt}>Recoger pedido</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity style={styles.navBtn} onPress={() => openMaps(custCoords)} activeOpacity={0.9}>
            <MaterialCommunityIcons name="navigation-variant" size={18} color={C.blue} />
            <Text style={[styles.navBtnTxt, { color: C.blue }]}>Ir a destino</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: C.go }]} onPress={() => needsCode ? openCode('deliver') : handleConfirm(undefined)} activeOpacity={0.9}>
            <Ionicons name="checkmark-circle" size={20} color={C.white} />
            <Text style={styles.primaryBtnTxt}>Entregar pedido</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* MAP */}
      <MapView style={StyleSheet.absoluteFill} mapStyle={MAP_STYLE_URL} logoEnabled={false} attributionEnabled compassEnabled={false} rotateEnabled={false} pitchEnabled={false}>
        <Camera ref={cameraRef} defaultSettings={{ centerCoordinate: target ? [target.longitude, target.latitude] : [-74.0836, 4.6533], zoomLevel: 14 }} />
        <UserLocation visible renderMode="normal" />
        {driverLoc && target && (
          <ShapeSource id="route" shape={{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[driverLoc.longitude, driverLoc.latitude], [target.longitude, target.latitude]] } }}>
            <LineLayer id="routeLine" style={{ lineColor: picked ? C.blue : C.brand, lineWidth: 4, lineDasharray: [2, 2], lineCap: 'round', lineJoin: 'round' }} />
          </ShapeSource>
        )}
        {target && (
          <MarkerView id="target" coordinate={[target.longitude, target.latitude]} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.destPin}>
              <View style={[styles.destPinInner, { backgroundColor: picked ? C.blue : C.brand }]}>
                <Ionicons name={picked ? 'flag' : 'storefront'} size={16} color={C.white} />
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
        <TouchableOpacity style={styles.iconBtn} onPress={() => openMaps(target)}>
          <MaterialCommunityIcons name="navigation-variant" size={22} color={picked ? C.blue : C.brand} />
        </TouchableOpacity>
      </View>

      {gps === 'active' && (
        <View style={[styles.gpsBadge, { top: insets.top + 58 }]}>
          <View style={styles.gpsDot} />
          <Text style={styles.gpsTxt}>GPS activo · compartiendo ubicación</Text>
        </View>
      )}

      {/* Sheet */}
      <Sheet height={SCREEN_H * 0.66} footer={footer}>
        <ScrollView contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Phase header */}
          <View style={styles.statusHead}>
            <View style={[styles.statusIcon, { backgroundColor: (picked ? C.blue : C.brand) + '22' }]}>
              <MaterialCommunityIcons name={picked ? 'bike-fast' : 'storefront'} size={22} color={picked ? C.blue : C.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>{picked ? 'En camino al cliente' : 'Recoge en el restaurante'}</Text>
              <Text style={styles.statusSub}>{picked ? 'Entrega y confirma con el código del cliente' : 'Ve al restaurante e ingresa el código de recogida'}</Text>
            </View>
          </View>

          {/* Restaurant block (phase 1) */}
          {!picked && rest && (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>RESTAURANTE</Text>
              <View style={styles.bizRow}>
                {rest.logo ? <Image source={{ uri: rest.logo }} style={styles.bizLogo} /> : <View style={styles.bizLogoFallback}><MaterialCommunityIcons name="storefront" size={20} color={C.brand} /></View>}
                <View style={{ flex: 1 }}>
                  <Text style={styles.custName}>{rest.name}</Text>
                  {rest.address ? <Text style={styles.addrTxt}>{rest.address}</Text> : null}
                </View>
              </View>
              {rest.phone ? (
                <TouchableOpacity style={styles.contactBtnFull} onPress={() => call(rest.phone)} activeOpacity={0.85}>
                  <Ionicons name="call" size={16} color={C.go} /><Text style={styles.contactTxt}>Llamar al restaurante</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {/* Customer block */}
          <View style={styles.block}>
            <Text style={styles.blockLabel}>CLIENTE</Text>
            <Text style={styles.custName}>{order.customerName}</Text>
            {order.address ? (
              <View style={styles.addrRow}>
                <Ionicons name="location" size={15} color={picked ? C.blue : C.faint} />
                <Text style={styles.addrTxt}>{order.address}</Text>
              </View>
            ) : null}
            {order.phone && picked ? (
              <View style={styles.contactRow}>
                <TouchableOpacity style={styles.contactBtn} onPress={() => call(order.phone)} activeOpacity={0.85}>
                  <Ionicons name="call" size={16} color={C.go} /><Text style={styles.contactTxt}>Llamar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contactBtn} onPress={() => whatsapp(order.phone)} activeOpacity={0.85}>
                  <FontAwesome5 name="whatsapp" size={16} color={C.go} /><Text style={styles.contactTxt}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contactBtn} onPress={() => openMaps(custCoords)} activeOpacity={0.85}>
                  <MaterialCommunityIcons name="navigation-variant" size={16} color={C.blue} /><Text style={[styles.contactTxt, { color: C.blue }]}>Ir</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {/* Items */}
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
              <Text style={styles.totalVal}>{fmtPrice(order.finalAmount || order.totalAmount)}</Text>
            </View>
          </View>
        </ScrollView>
      </Sheet>

      {/* Code entry modal — keyboard-friendly (not covered by the pinned footer) */}
      <Modal visible={!!codeModal} transparent animationType="fade" onRequestClose={() => !busy && setCodeModal(null)} statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIcon, { backgroundColor: (codeModal === 'pickup' ? C.brand : C.go) + '22' }]}>
              <Ionicons name={codeModal === 'pickup' ? 'storefront' : 'flag'} size={24} color={codeModal === 'pickup' ? C.brand : C.go} />
            </View>
            <Text style={styles.modalTitle}>{codeModal === 'pickup' ? 'Código de recogida' : 'Código del cliente'}</Text>
            <Text style={styles.modalSub}>
              {codeModal === 'pickup' ? 'Pídeselo al restaurante y escríbelo aquí para confirmar la recogida.' : 'Pídeselo al cliente y escríbelo aquí para confirmar la entrega.'}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="0000" placeholderTextColor={C.faint}
              value={modalCode} onChangeText={t => setModalCode(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad" maxLength={4} textAlign="center" autoFocus
              onSubmitEditing={submitCode}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setCodeModal(null)} disabled={busy} activeOpacity={0.85}>
                <Text style={styles.modalCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, { backgroundColor: codeModal === 'pickup' ? C.brand : C.go }, (modalCode.length !== 4 || busy) && { opacity: 0.5 }]}
                onPress={submitCode} disabled={modalCode.length !== 4 || busy} activeOpacity={0.85}
              >
                {busy ? <ActivityIndicator color={C.white} /> : <Text style={styles.modalConfirmTxt}>Confirmar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  sheetBg: { backgroundColor: C.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: 1, borderColor: C.lineSoft },
  sheetGrabber: { backgroundColor: C.line, width: 44, height: 5 },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, justifyContent: 'center', alignItems: 'center', ...shadow.card },
  topPill: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, ...shadow.card },
  topPillTxt: { color: C.text, fontSize: 14, fontWeight: '800' },

  gpsBadge: { position: 'absolute', alignSelf: 'center', zIndex: 5, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.card, borderWidth: 1, borderColor: C.go + '55', paddingHorizontal: 13, paddingVertical: 7, borderRadius: 16, ...shadow.card },
  gpsDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.go },
  gpsTxt: { color: C.go, fontSize: 11.5, fontWeight: '700' },

  destPin: { alignItems: 'center', justifyContent: 'center' },
  destPinInner: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: C.white, ...shadow.glow(C.brand) },

  statusHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 4, paddingBottom: 16 },
  statusIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  statusTitle: { color: C.text, fontSize: 16.5, fontWeight: '800' },
  statusSub: { color: C.sub, fontSize: 12.5, marginTop: 2 },

  block: { marginHorizontal: 16, marginBottom: 12, backgroundColor: C.card2, borderRadius: 18, borderWidth: 1, borderColor: C.lineSoft, padding: 16 },
  blockLabel: { color: C.faint, fontSize: 10.5, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  custName: { color: C.text, fontSize: 17, fontWeight: '800' },
  addrRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  addrTxt: { color: C.sub, fontSize: 13.5, flex: 1, lineHeight: 19, marginTop: 2 },

  bizRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bizLogo: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.card },
  bizLogoFallback: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.brand + '18', justifyContent: 'center', alignItems: 'center' },

  contactRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  contactBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 11 },
  contactBtnFull: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 11, marginTop: 12 },
  contactTxt: { color: C.go, fontSize: 13, fontWeight: '700' },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  itemQty: { color: C.brand, fontSize: 13, fontWeight: '800', width: 28 },
  itemName: { flex: 1, color: C.text, fontSize: 14 },
  itemPrice: { color: C.sub, fontSize: 13, fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  totalLabel: { color: C.sub, fontSize: 14, fontWeight: '700' },
  totalVal: { color: C.text, fontSize: 18, fontWeight: '800' },

  actionBar: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: C.card },
  navBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.card2, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 13, marginBottom: 12 },
  navBtnTxt: { color: C.brand, fontSize: 15, fontWeight: '800' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 16, ...shadow.glow(C.brand) },
  primaryBtnTxt: { color: C.white, fontSize: 16, fontWeight: '900' },
  deliveredPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.go + '1A', borderWidth: 1, borderColor: C.go + '44', borderRadius: 16, paddingVertical: 18 },
  deliveredTxt: { color: C.go, fontSize: 16, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.55)', justifyContent: 'center', paddingHorizontal: 28 },
  modalCard: { backgroundColor: C.card, borderRadius: 26, padding: 24, alignItems: 'center', ...shadow.card },
  modalIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  modalTitle: { color: C.text, fontSize: 19, fontWeight: '900' },
  modalSub: { color: C.sub, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  modalInput: { alignSelf: 'stretch', backgroundColor: C.card2, borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingVertical: 14, color: C.text, fontSize: 30, fontWeight: '800', letterSpacing: 14, marginTop: 18 },
  modalActions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 16 },
  modalCancel: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: C.card2, borderWidth: 1, borderColor: C.line },
  modalCancelTxt: { color: C.sub, fontSize: 15, fontWeight: '800' },
  modalConfirm: { flex: 1.4, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14 },
  modalConfirmTxt: { color: C.white, fontSize: 16, fontWeight: '900' },
});
