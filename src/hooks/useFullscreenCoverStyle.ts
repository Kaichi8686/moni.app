"use client";

import { useEffect, useState, type CSSProperties } from "react";

function visualBottom(): number {
  const vv = window.visualViewport;
  if (!vv) return window.innerHeight;
  return Math.round(vv.height + vv.offsetTop);
}

function keyboardCovered(): number {
  const vv = window.visualViewport;
  if (!vv) return 0;
  return Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
}

/**
 * Styles for iOS-safe fullscreen fixed shells.
 *
 * Avoid `inset-0` / `bottom:0`: when Safari leaves the layout viewport short,
 * bottom anchors mid-screen and the lower half goes blank (white). Use top + a
 * pixel height that tracks the tallest stable visual bottom instead of lvh alone
 * (lvh can also lag or stick after keyboard dismiss).
 */
export function useFullscreenCoverStyles(): {
  shell: CSSProperties;
  shadow: CSSProperties;
  ready: boolean;
} {
  const [heightPx, setHeightPx] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let baseline = Math.max(window.innerHeight, visualBottom(), window.outerHeight || 0);

    const sync = () => {
      const covered = keyboardCovered();
      const bottom = visualBottom();
      // Grow while keyboard is closed. Never shrink while mounted — a stuck
      // short layout viewport must not collapse the cover mid-session.
      if (covered < 80) {
        baseline = Math.max(baseline, window.innerHeight, bottom, window.outerHeight || 0);
      } else {
        // Keyboard open: keep covering through the gap below the visual viewport.
        baseline = Math.max(baseline, bottom + covered);
      }
      setHeightPx(baseline);
    };

    const onOrientation = () => {
      baseline = Math.max(window.innerHeight, visualBottom(), window.outerHeight || 0);
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
    };
  }, []);

  const shellH = heightPx > 0 ? `${heightPx}px` : "100lvh";
  const shadowH = heightPx > 0 ? `${Math.round(heightPx * 1.6)}px` : "160lvh";

  return {
    ready: heightPx > 0,
    shell: { bottom: "auto", height: shellH, minHeight: shellH },
    shadow: { bottom: "auto", height: shadowH, minHeight: shadowH },
  };
}

/** Single shell cover (e.g. issues slide panel) — no extra shadow layer. */
export function useFullscreenCoverStyle(): CSSProperties {
  return useFullscreenCoverStyles().shell;
}
