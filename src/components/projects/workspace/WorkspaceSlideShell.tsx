"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

const SLIDE_OUT_MS = 220;

type Props = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  /** 右上に置く追加アクション（予定追加など） */
  trailing?: ReactNode;
  /** ヘッダー下の固定領域（検索バーなど） */
  stickyBelowHeader?: ReactNode;
  className?: string;
  contentClassName?: string;
};

/**
 * 右からスライドインする全画面シェル（ヘッダー／タブバー非表示ページ向け）。
 */
export function WorkspaceSlideShell({
  title,
  children,
  onClose,
  trailing,
  stickyBelowHeader,
  className = "",
  contentClassName = "",
}: Props) {
  const { tx } = useI18n();
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);
  const closingRef = useRef(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    return () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, []);

  function requestClose() {
    if (closingRef.current) return;
    closingRef.current = true;
    setExiting(true);
    exitTimer.current = setTimeout(() => {
      onClose();
    }, SLIDE_OUT_MS);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close binder once
  }, []);

  const motionClass = exiting
    ? "issue-create-wizard-out"
    : entered
      ? "issue-create-wizard-in"
      : "translate-x-full";

  return (
    <div
      className={`fixed inset-0 z-[200] flex w-full max-w-[100vw] flex-col overflow-hidden overscroll-none bg-white ${motionClass} ${className}`}
    >
      <header className="sticky top-0 z-30 shrink-0 border-b border-zinc-100 bg-white/95 backdrop-blur-sm">
        <div
          className="flex items-center gap-2 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
        >
          <button
            type="button"
            onClick={requestClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-800 transition hover:bg-zinc-100 active:scale-95"
            aria-label={tx("戻る", "Back")}
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-[17px] font-bold tracking-tight text-zinc-950">
            {title}
          </h1>
          {trailing ? <div className="shrink-0">{trailing}</div> : null}
        </div>
        {stickyBelowHeader}
      </header>
      <div
        className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain pb-[max(1rem,env(safe-area-inset-bottom))] ${contentClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
