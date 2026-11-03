"use client";

import { useEffect, useState } from "react";

/**
 * Detects mobile soft keyboard via visualViewport shrink (and focused text fields).
 * Used to hide fixed chrome (bottom nav) so it doesn't cover inputs.
 */
export function useVirtualKeyboardOpen(thresholdPx = 120): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isTextField = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "TEXTAREA") return true;
      if (tag === "INPUT") {
        const type = (el as HTMLInputElement).type || "text";
        return !["button", "checkbox", "radio", "file", "submit", "reset", "range", "color", "hidden"].includes(
          type,
        );
      }
      return el.isContentEditable;
    };

    const readViewportOpen = () => {
      const vv = window.visualViewport;
      if (!vv) return false;
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      return covered > thresholdPx;
    };

    const isCoarsePointer = () => window.matchMedia("(pointer: coarse)").matches;

    const sync = () => {
      const viewportOpen = readViewportOpen();
      // iOS can keep visualViewport tall with interactive-widget; hide on text focus for touch devices.
      const focusedOnTouch = isCoarsePointer() && isTextField(document.activeElement);
      setOpen(viewportOpen || focusedOnTouch);
    };

    const onFocusIn = (e: FocusEvent) => {
      if (isCoarsePointer() && isTextField(e.target)) setOpen(true);
    };
    const onFocusOut = () => {
      // Delay so focus moving between fields doesn't flicker the nav.
      window.setTimeout(sync, 80);
    };

    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    sync();

    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [thresholdPx]);

  return open;
}
