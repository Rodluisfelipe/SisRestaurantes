import React, { useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../theme';

const PAD = 5;
const THUMB = 56;

/**
 * Slide-to-confirm button (Rappi / Uber style) built on RN core Animated + PanResponder.
 * No reanimated / gesture-handler — bulletproof in Expo Go.
 */
export default function SlideToConfirm({
  label = 'Desliza para confirmar',
  onConfirm,
  color = C.go,
  colorDark = C.goDark,
  disabled = false,
}) {
  const [w, setW] = useState(0);
  const [done, setDone] = useState(false);
  const x = useRef(new Animated.Value(0)).current;
  const maxRef = useRef(1);

  maxRef.current = Math.max(w - THUMB - PAD * 2, 1);

  const fire = useCallback(() => {
    setDone(true);
    onConfirm?.();
  }, [onConfirm]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3,
      onPanResponderMove: (_, g) => {
        if (disabled || done) return;
        const nx = Math.min(Math.max(g.dx, 0), maxRef.current);
        x.setValue(nx);
      },
      onPanResponderRelease: (_, g) => {
        if (disabled || done) return;
        const max = maxRef.current;
        const nx = Math.min(Math.max(g.dx, 0), max);
        if (nx >= max * 0.85) {
          Animated.timing(x, { toValue: max, duration: 130, useNativeDriver: false, easing: Easing.out(Easing.quad) })
            .start(({ finished }) => finished && fire());
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: false, friction: 7, tension: 80 }).start();
        }
      },
    })
  ).current;

  const fillW = Animated.add(x, THUMB + PAD);
  const labelOpacity = x.interpolate({
    inputRange: [0, Math.max(maxRef.current * 0.55, 1)],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const doneOpacity = x.interpolate({
    inputRange: [Math.max(maxRef.current * 0.6, 1), Math.max(maxRef.current, 2)],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={[styles.track, disabled && styles.trackDisabled]}
      onLayout={e => setW(e.nativeEvent.layout.width)}
    >
      <Animated.View style={[styles.fill, { width: fillW }]}>
        <LinearGradient colors={[color, colorDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.Text style={[styles.label, { opacity: labelOpacity }]} numberOfLines={1}>{label}</Animated.Text>
      <Animated.Text style={[styles.doneLabel, { opacity: doneOpacity }]} numberOfLines={1}>¡Listo!</Animated.Text>

      <Animated.View style={[styles.thumb, { transform: [{ translateX: x }] }]} {...pan.panHandlers}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Chevron color={color} />
          <Chevron color={color} style={{ marginLeft: -6 }} />
        </View>
      </Animated.View>
    </View>
  );
}

function Chevron({ color, style }) {
  return (
    <View style={[{ width: 11, height: 11, borderTopWidth: 3, borderRightWidth: 3, borderColor: color, transform: [{ rotate: '45deg' }], borderRadius: 1 }, style]} />
  );
}

const styles = StyleSheet.create({
  track: {
    height: THUMB + PAD * 2,
    borderRadius: (THUMB + PAD * 2) / 2,
    backgroundColor: C.card2,
    borderWidth: 1, borderColor: C.line,
    justifyContent: 'center', overflow: 'hidden',
  },
  trackDisabled: { opacity: 0.4 },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: (THUMB + PAD * 2) / 2, overflow: 'hidden' },
  label: { textAlign: 'center', color: C.sub, fontSize: 15, fontWeight: '700', marginLeft: THUMB / 2 },
  doneLabel: { position: 'absolute', alignSelf: 'center', color: C.white, fontSize: 16, fontWeight: '800' },
  thumb: {
    position: 'absolute', left: PAD, width: THUMB, height: THUMB, borderRadius: THUMB / 2,
    backgroundColor: C.white, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
  },
});
