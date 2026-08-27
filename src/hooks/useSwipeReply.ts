"use client";

import { useRef } from "react";

export function useSwipeReply(onReply: () => void, threshold = 56) {
  const startX = useRef(0);
  const active = useRef(false);

  return {
    onTouchStart: (e: React.TouchEvent) => {
      startX.current = e.touches[0]?.clientX ?? 0;
      active.current = true;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!active.current) return;
      active.current = false;
      const endX = e.changedTouches[0]?.clientX ?? 0;
      if (endX - startX.current > threshold) onReply();
    },
  };
}
