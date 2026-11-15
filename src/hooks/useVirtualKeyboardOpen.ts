"use client";

import { useEffect, useState } from "react";

/**
 * Detects soft keyboard by visualViewport height shrink vs a closed baseline.
 * Focus alone is not enough: iOS often keeps focus after the keyboard closes.
 * Does not change element position — callers should only hide/show chrome.
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

    const viewportHeight = () => window.visualViewport?.height ?? window.innerHeight;

    /** Largest height seen while keyboard is considered closed. */
    let closedBaseline = viewportHeight();

    const sync = () => {
      const h = viewportHeight();
      const focused = isTextField(document.activeElement);
      const vv = window.visualViewport;
      const covered = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;

      if (!focused) {
        closedBaseline = Math.max(closedBaseline, h);
        setOpen(false);
        return;
      }

      // Grow baseline if viewport recovered (keyboard dismissed while focus remains).
      if (h > closedBaseline) closedBaseline = h;

      const shrunk = closedBaseline - h > thresholdPx || covered > thresholdPx;
      setOpen(shrunk);
    };

    const onFocusIn = (e: FocusEvent) => {
      if (!isTextField(e.target)) return;
      closedBaseline = Math.max(closedBaseline, viewportHeight());
      window.setTimeout(sync, 120);
      window.setTimeout(sync, 320);
    };

    const onFocusOut = () => {
      window.setTimeout(sync, 80);
    };

    const onOrientation = () => {
      closedBaseline = viewportHeight();
      setOpen(false);
    };

    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", onOrientation);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    sync();

    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", onOrientation);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [thresholdPx]);

  return open;
}
