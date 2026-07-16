import React, { useRef, useEffect } from 'react';
import { Pressable, StyleSheet, View, Animated, Easing } from 'react-native';
import { C } from '../theme';

const W = 128;
const KNOB = 30;
const PAD = 4;

/**
 * Online / Offline pill toggle — RN core Animated (no reanimated).
 */
export default function AvailabilityToggle({ online, onToggle }) {
  const p = useRef(new Animated.Value(online ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(p, { toValue: online ? 1 : 0, duration: 260, useNativeDriver: false, easing: Easing.out(Easing.quad) }).start();
  }, [online, p]);

  useEffect(() => {
    let loop;
    if (online) {
      loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.6, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]));
      loop.start();
    } else {
      pulse.setValue(1);
    }
    return () => loop?.stop?.();
  }, [online, pulse]);

  const trackBg = p.interpolate({ inputRange: [0, 1], outputRange: [C.card2, 'rgba(18,226,156,0.16)'] });
  const trackBorder = p.interpolate({ inputRange: [0, 1], outputRange: [C.line, C.go] });
  const knobX = p.interpolate({ inputRange: [0, 1], outputRange: [0, W - KNOB - PAD * 2] });
  const knobBg = p.interpolate({ inputRange: [0, 1], outputRange: [C.faint, C.go] });
  const onOpacity = p;
  const offOpacity = p.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Pressable onPress={onToggle} hitSlop={8}>
      <Animated.View style={[styles.track, { backgroundColor: trackBg, borderColor: trackBorder }]}>
        <Animated.Text style={[styles.label, styles.labelOn, { color: C.go, opacity: onOpacity }]}>En línea</Animated.Text>
        <Animated.Text style={[styles.label, styles.labelOff, { color: C.sub, opacity: offOpacity }]}>Fuera</Animated.Text>
        <Animated.View style={[styles.knob, { transform: [{ translateX: knobX }], backgroundColor: knobBg }]}>
          {online && <Animated.View style={[styles.pulse, { transform: [{ scale: pulse }], opacity: 0.35 }]} />}
          <View style={styles.knobDot} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: W, height: KNOB + PAD * 2, borderRadius: (KNOB + PAD * 2) / 2, borderWidth: 1, justifyContent: 'center' },
  label: { position: 'absolute', fontSize: 12.5, fontWeight: '800' },
  labelOn: { left: 14 },
  labelOff: { right: 14 },
  knob: { position: 'absolute', left: PAD, width: KNOB, height: KNOB, borderRadius: KNOB / 2, justifyContent: 'center', alignItems: 'center' },
  pulse: { position: 'absolute', width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: C.go },
  knobDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.white },
});
