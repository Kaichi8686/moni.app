"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * トラック幅が画面より広いとき、横スクロール位置を中央に合わせて
 * 本線マスがビューポート中央に来るようにする。
 */
export function useRoadmapTrackScrollCenter(deps: unknown[] = []) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const center = () => {
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) {
        el.scrollLeft = 0;
        return;
      }
      el.scrollLeft = max / 2;
    };

    center();
    const frame = window.requestAnimationFrame(center);
    const ro = new ResizeObserver(center);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    window.addEventListener("resize", center);
    return () => {
      window.cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", center);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls when to re-center
  }, deps);

  return scrollRef;
}
