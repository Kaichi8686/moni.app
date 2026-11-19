"use client";

import { useEffect } from "react";
import { repairIosLayoutViewport } from "@/lib/ios/repairIosLayoutViewport";

/** html class: hide in-flow issues underlays while a fullscreen work editor is open. */
export const IMMERSIVE_WORK_EDITOR_CLASS = "moni-immersive-work-editor";

/**
 * iOS Safari clips position:fixed layers to the visual viewport while the soft
 * keyboard is up. In-flow UI (the step genre list) still paints in the layout
 * viewport below the keyboard, so it flashes through when the keyboard moves.
 * Locking this class lets CSS hide those underlays for the whole edit session.
 *
 * On unlock, nudge Safari to recompute the layout viewport — otherwise a short
 * viewport can stick and leave a white blank under every later fixed shell.
 */
export function useImmersiveWorkEditorLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.add(IMMERSIVE_WORK_EDITOR_CLASS);
    return () => {
      root.classList.remove(IMMERSIVE_WORK_EDITOR_CLASS);
      repairIosLayoutViewport();
    };
  }, [active]);
}
