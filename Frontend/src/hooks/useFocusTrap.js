import { useEffect, useRef } from 'react';

/**
 * Custom hook that traps keyboard focus within a container element.
 * When active, Tab/Shift+Tab cycle through focusable elements inside the container.
 * 
 * @param {boolean} active - Whether the trap is currently active
 * @returns {React.RefObject} - Ref to attach to the container element
 */
export default function useFocusTrap(active) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const focusableSelector = 'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])';

    function handleKeyDown(e) {
      if (e.key !== 'Tab') return;

      const focusable = Array.from(container.querySelectorAll(focusableSelector)).filter(
        el => el.offsetParent !== null // visible
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    // Focus the first focusable element on mount
    const focusable = container.querySelectorAll(focusableSelector);
    if (focusable.length > 0) {
      focusable[0].focus();
    }

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [active]);

  return containerRef;
}
