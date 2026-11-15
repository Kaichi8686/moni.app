"use client";

import { useEffect, type RefObject } from "react";

/**
 * Keep `position:fixed; bottom:0` chrome visible above iOS Safari's bottom
 * toolbar. Soft keyboards cover a much larger slice — leave those alone so the
 * tab bar stays under the keyboard (`interactive-widget: overlays-content`).
 *
 * Do NOT push with a negative `bottom`: that can send the bar off-screen when
 * the layout viewport was briefly taller (collapsed browser chrome).
 */
export function useUnstickFixedBottom(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const sync = () => {
      const node = ref.current;
      if (!node) return;

      const vv = window.visualViewport;
      if (!vv) {
        node.style.bottom = "0px";
        return;
      }

      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      // Safari / Chrome bottom UI is typically well under ~110px; keyboards are larger.
      node.style.bottom = inset > 0 && inset <= 110 ? `${inset}px` : "0px";
    };

    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    sync();

    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      const node = ref.current;
      if (node) node.style.bottom = "";
    };
  }, [ref]);
}
