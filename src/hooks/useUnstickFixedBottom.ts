"use client";

import { useEffect, type RefObject } from "react";

/**
 * iOS Safari sometimes leaves the layout viewport shorter than the screen after
 * keyboard dismiss / chrome transitions. `position:fixed; bottom:0` then sits
 * mid-screen. Push the element down by the shortfall so it stays on the true
 * bottom — without lifting it above an open keyboard (overlays-content).
 */
export function useUnstickFixedBottom(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let baseline = window.innerHeight;

    const sync = () => {
      const node = ref.current;
      if (!node) return;

      const ih = window.innerHeight;
      const vv = window.visualViewport;
      const covered = vv ? Math.max(0, ih - vv.height - vv.offsetTop) : 0;

      // Track the tallest stable layout while we are not mid-keyboard.
      if (covered < 50) {
        baseline = Math.max(baseline, ih);
        if (vv) baseline = Math.max(baseline, Math.round(vv.height + vv.offsetTop));
      }

      const shortfall = Math.max(0, baseline - ih);
      // Real soft keyboard covers a large slice; a stuck layout shortfall is
      // smaller and may linger after the iOS dismiss-keyboard button.
      const keyboardLikely = covered > 120;
      node.style.bottom = shortfall > 40 && !keyboardLikely ? `${-shortfall}px` : "0px";
    };

    const onOrientation = () => {
      baseline = window.innerHeight;
      window.setTimeout(sync, 100);
      window.setTimeout(sync, 400);
    };

    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", onOrientation);
    document.addEventListener("focusin", sync);
    document.addEventListener("focusout", sync);
    sync();

    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", onOrientation);
      document.removeEventListener("focusin", sync);
      document.removeEventListener("focusout", sync);
      const node = ref.current;
      if (node) node.style.bottom = "";
    };
  }, [ref]);
}
