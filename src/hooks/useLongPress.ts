"use client";

import { useCallback, useRef } from "react";

type Options = { threshold?: number; onStart?: () => void };

export function useLongPress(onLongPress: () => void, { threshold = 400, onStart }: Options = {}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    onStart?.();
    clear();
    timerRef.current = setTimeout(onLongPress, threshold);
  }, [clear, onLongPress, onStart, threshold]);

  return {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchCancel: clear,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      onLongPress();
    },
  };
}
