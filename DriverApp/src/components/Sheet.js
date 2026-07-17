import React from 'react';
import { View, StyleSheet } from 'react-native';
import { C } from '../theme';

/**
 * Lightweight bottom panel — a fixed-height card pinned to the bottom with a
 * native scroll area (passed as children) and an optional pinned footer.
 *
 * Deliberately NO gesture/animation libraries (no reanimated / gesture-handler /
 * PanResponder): the native ScrollView already scrolls smoothly, and this can't
 * crash on launch the way the reanimated stack did. Reliability over flourish.
 */
export default function Sheet({ height, children, footer }) {
  return (
    <View style={[styles.sheet, { height }]}>
      <View style={styles.handle}><View style={styles.grabber} /></View>
      <View style={styles.body}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: C.card,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderTopWidth: 1, borderColor: C.lineSoft,
    shadowColor: '#1B2A4A', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 16,
  },
  handle: { paddingTop: 10, paddingBottom: 6, alignItems: 'center' },
  grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: C.line },
  body: { flex: 1 },
  footer: { borderTopWidth: 1, borderTopColor: C.lineSoft },
});
