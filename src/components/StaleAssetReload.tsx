"use client";

import { useEffect } from "react";

const RELOAD_KEY = "moni.stale-asset-reload";

/**
 * After a Vercel redeploy, Safari often restores a background tab with HTML that
 * still points at purged /_next/ chunks — styles vanish and the app looks like a
 * broken “weird site”. Reload once when stylesheet/script/chunk load fails.
 */
export function StaleAssetReload() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const clearSoon = window.setTimeout(() => {
      try {
        sessionStorage.removeItem(RELOAD_KEY);
      } catch {
        /* ignore */
      }
    }, 4000);

    const reloadOnce = () => {
      try {
        if (sessionStorage.getItem(RELOAD_KEY) === "1") return;
        sessionStorage.setItem(RELOAD_KEY, "1");
      } catch {
        /* still try reload */
      }
      window.location.reload();
    };

    const onResourceError = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const tag = target.tagName;
      if (tag !== "LINK" && tag !== "SCRIPT") return;
      if (tag === "LINK") {
        const rel = (target as HTMLLinkElement).rel;
        if (rel && rel !== "stylesheet") return;
      }
      const href =
        (target as HTMLLinkElement).href || (target as HTMLScriptElement).src || "";
      if (href && !href.includes("/_next/")) return;
      reloadOnce();
    };

    const onUnhandled = (event: PromiseRejectionEvent) => {
      const msg = String(
        (event.reason as { message?: string } | undefined)?.message ?? event.reason ?? "",
      );
      if (
        !/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(
          msg,
        )
      ) {
        return;
      }
      reloadOnce();
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      const links = document.querySelectorAll('link[rel="stylesheet"][href*="/_next/"]');
      for (const node of Array.from(links)) {
        const link = node as HTMLLinkElement;
        // Failed or not applied stylesheet after bfcache restore
        if (!link.sheet) {
          reloadOnce();
          return;
        }
      }
    };

    window.addEventListener("error", onResourceError, true);
    window.addEventListener("unhandledrejection", onUnhandled);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.clearTimeout(clearSoon);
      window.removeEventListener("error", onResourceError, true);
      window.removeEventListener("unhandledrejection", onUnhandled);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return null;
}
