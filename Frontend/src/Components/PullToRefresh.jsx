import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';

/**
 * PullToRefresh — touch-based pull-to-refresh with branded animation.
 * Wrap the scrollable area. Triggers `onRefresh()` when pulled past threshold.
 */

const PULL_THRESHOLD = 80;   // px needed to trigger refresh
const MAX_PULL = 120;        // maximum visual pull distance

const PullToRefresh = ({ children, onRefresh, themeColor = '#f97316', isLoading = false }) => {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef(null);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);
  const controls = useAnimation();

  const handleTouchStart = useCallback((e) => {
    // Only start pull if at top of scroll
    const el = containerRef.current;
    if (!el || el.scrollTop > 5) return;
    startYRef.current = e.touches[0].clientY;
    isPullingRef.current = true;
    setPulling(true);
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!isPullingRef.current) return;
    const el = containerRef.current;
    if (!el || el.scrollTop > 5) {
      isPullingRef.current = false;
      setPulling(false);
      setPullDistance(0);
      return;
    }

    const delta = e.touches[0].clientY - startYRef.current;
    if (delta < 0) {
      setPullDistance(0);
      return;
    }
    // Rubber-band resistance
    const resistance = Math.min(delta * 0.45, MAX_PULL);
    setPullDistance(resistance);
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;
    setPulling(false);

    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(PULL_THRESHOLD * 0.6); // Hold in place
      try {
        await onRefresh?.();
      } catch {
        // silent
      }
      setRefreshing(false);
    }
    setPullDistance(0);
  }, [pullDistance, refreshing, onRefresh]);

  // Smooth spring back when releasing
  useEffect(() => {
    if (!pulling && !refreshing) {
      controls.start({ y: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } });
    } else {
      controls.start({ y: pullDistance, transition: { duration: 0.1 } });
    }
  }, [pullDistance, pulling, refreshing, controls]);

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const indicatorOpacity = Math.min(progress * 1.5, 1);
  const showIndicator = pullDistance > 8 || refreshing;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className="relative w-full overflow-y-auto"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 top-0 z-30 flex items-center justify-center pointer-events-none overflow-hidden transition-opacity duration-150"
        style={{
          height: Math.max(pullDistance, refreshing ? 48 : 0),
          opacity: showIndicator ? indicatorOpacity : 0,
        }}
      >
        <div className="flex flex-col items-center gap-1">
          {/* Spinning / rotating indicator */}
          <motion.div
            animate={{
              rotate: refreshing ? 360 : progress * 270,
            }}
            transition={refreshing ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
            className="w-7 h-7 rounded-full border-[2.5px] border-gray-200 flex items-center justify-center"
            style={{
              borderTopColor: themeColor,
              borderRightColor: progress > 0.5 ? themeColor : 'transparent',
            }}
          />
          {pullDistance >= PULL_THRESHOLD && !refreshing && (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[10px] font-medium text-gray-400"
            >
              Soltar para actualizar
            </motion.span>
          )}
          {refreshing && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] font-medium text-gray-400"
            >
              Actualizando...
            </motion.span>
          )}
        </div>
      </div>

      {/* Content with pull offset */}
      <motion.div animate={controls} style={{ y: pullDistance }}>
        {children}
      </motion.div>
    </div>
  );
};

export default PullToRefresh;
