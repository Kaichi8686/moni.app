"use client";

import { FormEvent, KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import type { ActivityCategoryId } from "@/lib/feed/activityRecord";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type ActivityComposerSubmitPayload = {
  title: string;
  detail: string;
  files: File[];
  recordedAt: string | null;
  category: ActivityCategoryId | null;
};

type Props = {
  open: boolean;
  posting: boolean;
  initialTitle?: string;
  initialDetail?: string;
  onClose: () => void;
  onSubmit: (payload: ActivityComposerSubmitPayload) => void | Promise<void>;
};

type PreviewItem = { id: string; file: File; url: string };
type FocusArea = "title" | "detail" | "media" | null;

const MAX_FILES = 6;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

/** Shared surface tokens — keep edges consistent (Linear-like). */
const RADIUS = "rounded-md";
const BORDER = "border border-zinc-200";
const BTN =
  "inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40";
const BTN_GHOST = `${BTN} ${BORDER} bg-white text-zinc-700 hover:bg-zinc-50`;
const BTN_PRIMARY = `${BTN} border border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800`;

function hasDraft(title: string, detail: string, files: number) {
  return Boolean(title.trim() || detail.trim() || files > 0);
}

export function ActivityComposer({
  open,
  posting,
  initialTitle = "",
  initialDetail = "",
  onClose,
  onSubmit,
}: Props) {
  const { tx } = useI18n();
  const titleId = useId();
  const detailId = useId();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [previews, setPreviews] = useState<PreviewItem[]>([]);
  const [error, setError] = useState("");
  const [focusArea, setFocusArea] = useState<FocusArea>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initialTitle);
    setDetail(initialDetail);
    setPreviews((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url));
      return [];
    });
    setError("");
    setFocusArea(null);
    setConfirmDiscard(false);
  }, [open, initialTitle, initialDetail]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      titleRef.current?.focus();
      setFocusArea("title");
    }, 60);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revoke on unmount only
  }, []);

  function appendFiles(list: FileList | null) {
    if (!list?.length) return;
    const next: PreviewItem[] = [];
    for (const f of Array.from(list)) {
      if (previews.length + next.length >= MAX_FILES) break;
      if (f.size > MAX_BYTES) {
        setError(tx("画像は1枚あたり5MB以下にしてください。", "Each image must be 5MB or smaller."));
        continue;
      }
      if (!/^image\/(jpeg|png|webp|gif)$/i.test(f.type)) {
        setError(tx("JPEG / PNG / WebP / GIF のみ対応しています。", "Only JPEG, PNG, WebP, and GIF are supported."));
        continue;
      }
      next.push({
        id: `${Date.now()}-${f.name}-${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        url: URL.createObjectURL(f),
      });
    }
    if (next.length > 0) {
      setPreviews((prev) => [...prev, ...next]);
      setError("");
      setFocusArea("media");
    }
  }

  function removePreview(id: string) {
    setPreviews((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.id !== id);
    });
  }

  function tryClose() {
    if (posting) return;
    if (hasDraft(title, detail, previews.length)) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }

  function discardAndClose() {
    setConfirmDiscard(false);
    onClose();
  }

  async function commit() {
    const t = title.trim();
    if (!t) {
      setError(tx("何をしたか（タイトル）を入力してください。", "Enter a title for what you did."));
      titleRef.current?.focus();
      return;
    }
    await onSubmit({
      title: t,
      detail: detail.trim(),
      files: previews.map((p) => p.file),
      recordedAt: null,
      category: null,
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await commit();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (confirmDiscard) {
        setConfirmDiscard(false);
        return;
      }
      tryClose();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (!posting && title.trim()) void commit();
    }
  }

  if (!open) return null;

  const canSubmit = Boolean(title.trim()) && !posting;
  const showToolbar = focusArea === "title" || focusArea === "detail" || focusArea === "media" || previews.length > 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-zinc-900/35 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-composer-title"
      onClick={tryClose}
      onKeyDown={onKeyDown}
    >
      <div
        className={`flex max-h-[min(92dvh,760px)] w-full max-w-2xl flex-col overflow-hidden ${RADIUS} border border-zinc-200 bg-white shadow-lg sm:rounded-lg sm:shadow-[0_24px_80px_-24px_rgba(24,24,27,0.45)]`}
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3.5 sm:px-8">
          <div className="min-w-0">
            <h3 id="activity-composer-title" className="text-[13px] font-semibold tracking-tight text-zinc-900">
              {tx("活動を記録", "Record activity")}
            </h3>
            <p className="mt-0.5 text-[11px] text-zinc-400">{tx("⌘/Ctrl + Enter で記録 · Esc で閉じる", "⌘/Ctrl + Enter to save · Esc to close")}</p>
          </div>
          <button type="button" className={`${BTN_GHOST} min-h-[32px] px-2.5`} onClick={tryClose} disabled={posting}>
            {tx("閉じる", "Close")}
          </button>
        </header>

        <form ref={formRef} className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => void handleSubmit(e)}>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-10 sm:py-8">
              <div className="mx-auto w-full max-w-[40rem] space-y-7">
                <div>
                  <label htmlFor={titleId} className="sr-only">
                    {tx("何をしたか", "What did you do")}
                  </label>
                  <input
                    ref={titleRef}
                    id={titleId}
                    className="w-full border-0 bg-transparent p-0 text-[1.65rem] font-semibold leading-[1.25] tracking-tight text-zinc-900 outline-none placeholder:font-medium placeholder:text-zinc-300 disabled:opacity-60 sm:text-2xl"
                    placeholder={tx("何をしたか", "What did you do")}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onFocus={() => setFocusArea("title")}
                    maxLength={120}
                    disabled={posting}
                  />
                </div>

                <div>
                  <label htmlFor={detailId} className="sr-only">
                    {tx("詳細（任意）", "Details (optional)")}
                  </label>
                  <textarea
                    id={detailId}
                    className="min-h-[10rem] w-full resize-none border-0 bg-transparent p-0 text-base leading-[1.8] text-zinc-700 outline-none placeholder:text-zinc-300 disabled:opacity-60"
                    placeholder={tx("気づき、次のアクション、結果のメモ…", "Notes, next actions, results…")}
                    value={detail}
                    onChange={(e) => setDetail(e.target.value)}
                    onFocus={() => setFocusArea("detail")}
                    maxLength={2000}
                    rows={6}
                    disabled={posting}
                  />
                </div>

                {/* Focus-aware media toolbar */}
                <div
                  className={`transition-all duration-200 ${
                    showToolbar ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"
                  }`}
                >
                  <div className={`flex flex-wrap items-center gap-2 ${RADIUS} bg-zinc-50/80 px-2 py-2`}>
                    <button
                      type="button"
                      className={BTN_GHOST}
                      onClick={() => {
                        setFocusArea("media");
                        galleryRef.current?.click();
                      }}
                      disabled={posting || previews.length >= MAX_FILES}
                    >
                      {tx("画像を添付", "Attach images")}
                    </button>
                    <button
                      type="button"
                      className={BTN_GHOST}
                      onClick={() => {
                        setFocusArea("media");
                        cameraRef.current?.click();
                      }}
                      disabled={posting || previews.length >= MAX_FILES}
                    >
                      {tx("カメラ", "Camera")}
                    </button>
                    <span className="ml-auto hidden text-[11px] text-zinc-400 sm:inline">{tx("証跡は任意です", "Photos are optional")}</span>
                  </div>
                </div>

                {previews.length > 0 ? (
                  <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {previews.map((p, i) => (
                      <li key={p.id} className={`relative aspect-square overflow-hidden ${RADIUS} ${BORDER} bg-zinc-100`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt="" className="h-full w-full object-cover" />
                        <span className="absolute left-1.5 top-1.5 rounded bg-zinc-900/70 px-1 text-[10px] font-medium text-white">
                          {i + 1}
                        </span>
                        <button
                          type="button"
                          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded bg-zinc-900/70 text-xs text-white"
                          onClick={() => removePreview(p.id)}
                          aria-label={tx("画像を削除", "Remove image")}
                          disabled={posting}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                    {previews.length < MAX_FILES ? (
                      <li>
                        <button
                          type="button"
                          className={`flex aspect-square w-full items-center justify-center ${RADIUS} border border-dashed border-zinc-300 bg-zinc-50 text-sm font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-800`}
                          onClick={() => galleryRef.current?.click()}
                          disabled={posting}
                        >
                          ＋
                        </button>
                      </li>
                    ) : null}
                  </ul>
                ) : null}

                {error ? <p className="text-sm text-rose-600">{error}</p> : null}

                <input
                  ref={galleryRef}
                  type="file"
                  accept={ACCEPT}
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    appendFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    appendFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            <footer className="shrink-0 border-t border-zinc-100 bg-white px-5 py-3 sm:px-8">
              <div className="mx-auto flex w-full max-w-[40rem] items-center gap-2">
                <button type="submit" disabled={!canSubmit} className={`ml-auto min-w-[7.5rem] ${canSubmit ? BTN_PRIMARY : `${BTN} border-zinc-200 bg-zinc-100 text-zinc-400`}`}>
                  {posting ? tx("記録中…", "Saving…") : tx("記録する", "Save")}
                </button>
              </div>
            </footer>
          </form>
      </div>

      {confirmDiscard ? (
        <div
          className="absolute inset-0 z-[110] flex items-center justify-center bg-zinc-900/40 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="discard-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`w-full max-w-sm ${RADIUS} ${BORDER} bg-white p-5 shadow-xl`}>
            <h4 id="discard-title" className="text-[15px] font-semibold text-zinc-900">
              {tx("下書きを破棄しますか？", "Discard this draft?")}
            </h4>
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">{tx("入力内容と添付は保存されません。", "Your text and attachments will not be saved.")}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={BTN_GHOST} onClick={() => setConfirmDiscard(false)}>
                {tx("続ける", "Keep editing")}
              </button>
              <button type="button" className={`${BTN} border border-rose-600 bg-rose-600 text-white hover:bg-rose-500`} onClick={discardAndClose}>
                {tx("破棄する", "Discard")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
