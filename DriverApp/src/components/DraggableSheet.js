import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, PanResponder, Dimensions } from 'react-native';
import { C } from '../theme';

const SCREEN_H = Dimensions.get('window').height;

/**
 * Bottom sheet that snaps between a collapsed and expanded height.
 * Built on RN core Animated + PanResponder (no reanimated / gorhom).
 *
 * Props:
 *   collapsedHeight, expandedHeight  — snap points (px)
 *   children                         — sheet content (rendered above optional footer)
 *   footer                           — node pinned at the bottom of the sheet (non-scrolling)
 */
export default function DraggableSheet({
  collapsedHeight = 300,
  expandedHeight = SCREEN_H * 0.86,
  children,
  footer,
}) {
  const range = Math.max(expandedHeight - collapsedHeight, 0);
  // translateY: 0 = expanded, range = collapsed
  const ty = useRef(new Animated.Value(range)).current;
  const current = useRef(range);

  // Track the animated value in a ref WITHOUT leaking listeners.
  // (Adding the listener in the render body attached a new one on every
  // re-render and never removed them, which progressively froze the screen.)
  useEffect(() => {
    const id = ty.addListener(({ value }) => { current.current = value; });
    return () => ty.removeListener(id);
  }, [ty]);

  const snap = (to) => {
    Animated.spring(ty, { toValue: to, useNativeDriver: true, friction: 9, tension: 65 }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        const next = Math.min(Math.max(current.current + g.dy, 0), range);
        ty.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const pos = Math.min(Math.max(current.current + g.dy, 0), range);
        // decide by velocity + position
        if (g.vy < -0.5) return snap(0);
        if (g.vy > 0.5) return snap(range);
        snap(pos < range / 2 ? 0 : range);
      },
    })
  ).current;

  return (
    <Animated.View
      style={[styles.sheet, { height: expandedHeight, transform: [{ translateY: ty }] }]}
    >
      {/* Drag handle zone */}
      <View {...pan.panHandlers} style={styles.handleZone}>
        <View style={styles.grabber} />
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>{children}</View>

      {/* Optional pinned footer */}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: C.card,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderTopWidth: 1, borderColor: C.lineSoft,
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20,
  },
  handleZone: { paddingTop: 10, paddingBottom: 6, alignItems: 'center' },
  grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: C.line },
  footer: { borderTopWidth: 1, borderTopColor: C.lineSoft },
});
