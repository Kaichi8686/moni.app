"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

const DISMISS_KEY = "moni.pwaInstallHint.dismissed";

function isStandaloneDisplay() {
  if (typeof window === "undefined") return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone) return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches
  );
}

function isMobileLike() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 900px)").matches || navigator.maxTouchPoints > 0;
}

function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const notOther = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return ios && webkit && notOther;
}

/**
 * Safari / Chrome のタブでは上下のブラウザバーを消せない。
 * ホーム画面追加（standalone）へ誘導する。
 */
export function PwaInstallHint() {
  const { tx } = useI18n();
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [deferred, setDeferred] = useState<{ prompt: () => Promise<void> } | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }

    if (isStandaloneDisplay() || !isMobileLike()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }

    setIos(isIosSafari());
    setVisible(true);

    const onBip = (event: Event) => {
      event.preventDefault();
      const e = event as Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };
      setDeferred({
        prompt: async () => {
          await e.prompt();
          await e.userChoice;
        },
      });
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (!visible) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  async function install() {
    if (!deferred) return;
    try {
      await deferred.prompt();
    } catch {
      /* ignore */
    }
    setDeferred(null);
    dismiss();
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[450] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.16)] backdrop-blur">
        <p className="text-[13px] font-semibold text-zinc-900">
          {tx("ブラウザのバーを消すには", "To hide the browser bars")}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-zinc-600">
          {ios
            ? tx(
                "画面下の共有ボタン →「ホーム画面に追加」で開くと、上下のバーなしで使えます。",
                "Tap Share → Add to Home Screen. Opening from there hides the browser bars.",
              )
            : deferred
              ? tx(
                  "アプリとして追加すると、上下のブラウザバーなしで使えます。",
                  "Install the app to use it without browser bars.",
                )
              : tx(
                  "メニューから「ホーム画面に追加」または「アプリをインストール」で開くと、上下のバーなしで使えます。",
                  "Use Add to Home screen / Install app, then open from there to hide the bars.",
                )}
        </p>
        <div className="mt-2.5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="min-h-9 rounded-full px-3 text-[12px] font-semibold text-zinc-500"
          >
            {tx("あとで", "Later")}
          </button>
          {deferred ? (
            <button
              type="button"
              onClick={() => void install()}
              className="min-h-9 rounded-full bg-zinc-900 px-3.5 text-[12px] font-semibold text-white"
            >
              {tx("追加する", "Install")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
