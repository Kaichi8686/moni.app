"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Share2, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { IssueWorkFileItem } from "@/lib/workspace/issueWorkFiles";

type Props = {
  items: IssueWorkFileItem[];
  initialItemId: string;
  canDelete: boolean;
  onClose: () => void;
  onDelete: (itemId: string) => Promise<void>;
};

export function IssuePhotoViewer({ items, initialItemId, canDelete, onClose, onDelete }: Props) {
  const { tx } = useI18n();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const ignoreTapUntil = useRef(0);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [index, setIndex] = useState(() => {
    const found = items.findIndex((item) => item.id === initialItemId);
    return found >= 0 ? found : 0;
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [shareNotice, setShareNotice] = useState("");

  const current = items[index] ?? items[0] ?? null;

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const width = el.clientWidth || 1;
    el.scrollTo({ left: index * width, behavior: "auto" });
    // initial only
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount scroll to start item
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      onClose();
      return;
    }
    if (index <= items.length - 1) return;
    const nextIndex = items.length - 1;
    setIndex(nextIndex);
    const el = scrollerRef.current;
    if (!el) return;
    const width = el.clientWidth || 1;
    el.scrollTo({ left: nextIndex * width, behavior: "auto" });
  }, [index, items.length, onClose]);

  useEffect(() => {
    if (!shareNotice) return;
    const t = window.setTimeout(() => setShareNotice(""), 2200);
    return () => window.clearTimeout(t);
  }, [shareNotice]);

  const syncIndexFromScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const width = el.clientWidth || 1;
    const next = Math.round(el.scrollLeft / width);
    if (next !== index && next >= 0 && next < items.length) setIndex(next);
  }, [index, items.length]);

  async function handleShare() {
    if (!current || typeof window === "undefined") return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: current.title || tx("写真", "Photo"),
          url: current.url,
        });
        return;
      }
      await navigator.clipboard.writeText(current.url);
      setShareNotice(tx("リンクをコピーしました", "Link copied"));
    } catch {
      /* user cancelled */
    }
  }

  async function confirmDeletePhoto() {
    if (!current || deleting) return;
    setDeleting(true);
    try {
      await onDelete(current.id);
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[260] bg-black">
      <div
        ref={scrollerRef}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={syncIndexFromScroll}
        onTouchStart={() => {
          ignoreTapUntil.current = 0;
        }}
        onTouchMove={() => {
          ignoreTapUntil.current = Date.now() + 280;
        }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="flex h-full w-full shrink-0 snap-center items-center justify-center px-1"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- fullscreen slot photo */}
            <img
              src={item.url}
              alt={item.title || tx("写真", "Photo")}
              draggable={false}
              className="max-h-full max-w-full select-none object-contain"
              onClick={() => {
                if (Date.now() < ignoreTapUntil.current) return;
                setChromeVisible((v) => !v);
              }}
            />
          </div>
        ))}
      </div>

      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 px-3 pb-8 pt-[max(0.75rem,env(safe-area-inset-top))] transition-opacity duration-200 ${
          chromeVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          type="button"
          disabled={!chromeVisible}
          onClick={onClose}
          className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-sm backdrop-blur-sm transition hover:bg-black/60 disabled:pointer-events-none"
          aria-label={tx("戻る", "Back")}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden strokeWidth={2.25} />
        </button>
        <div className="flex items-center gap-2">
          {canDelete ? (
            <button
              type="button"
              disabled={!chromeVisible}
              onClick={() => setConfirmDelete(true)}
              className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-sm backdrop-blur-sm transition hover:bg-black/60 disabled:pointer-events-none"
              aria-label={tx("削除", "Delete")}
            >
              <Trash2 className="h-5 w-5" aria-hidden strokeWidth={2.25} />
            </button>
          ) : null}
          <button
            type="button"
            disabled={!chromeVisible}
            onClick={() => void handleShare()}
            className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-sm backdrop-blur-sm transition hover:bg-black/60 disabled:pointer-events-none"
            aria-label={tx("共有", "Share")}
          >
            <Share2 className="h-5 w-5" aria-hidden strokeWidth={2.25} />
          </button>
        </div>
      </div>

      {shareNotice ? (
        <p className="pointer-events-none absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-20 -translate-x-1/2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-zinc-900 shadow-lg">
          {shareNotice}
        </p>
      ) : null}

      {confirmDelete && current ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal
            aria-labelledby="photo-delete-title"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          >
            <h3 id="photo-delete-title" className="text-base font-semibold text-[#202124]">
              {tx("この写真を削除しますか？", "Delete this photo?")}
            </h3>
            <p className="mt-2 text-sm text-[#5f6368]">
              {tx("この操作は取り消せません。", "This can’t be undone.")}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-medium text-[#5f6368] hover:bg-[#f1f3f4]"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
              >
                {tx("キャンセル", "Cancel")}
              </button>
              <button
                type="button"
                className="rounded-lg bg-[#d93025] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c5221f] disabled:opacity-60"
                disabled={deleting}
                onClick={() => void confirmDeletePhoto()}
              >
                {deleting ? tx("削除中…", "Deleting…") : tx("削除する", "Delete")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
