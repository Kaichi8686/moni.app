"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  clearGenreCreateDraft,
  clearGenreCreateOpen,
  markGenreCreateOpen,
  readGenreCreateDraft,
  writeGenreCreateDraft,
} from "@/lib/workspace/genreCreateDraft";
import {
  CUSTOM_COLOR_PRESETS,
  CUSTOM_GENRE_ICON_PRESETS,
  CUSTOM_TASK_GENRE_LABEL_MAX,
  createCustomTaskGenreId,
  nextCustomColorKey,
  normalizeCustomTaskGenreLabel,
} from "@/lib/workspace/taskGenres";
import type { CustomTaskGenreDef } from "@/lib/workspace/types";

type Props = {
  projectId: string;
  phaseId: string | null;
  existingCount: number;
  existingLabels: string[];
  onClose: () => void;
  onComplete: (genre: CustomTaskGenreDef) => Promise<void>;
};

function resetViewportZoom() {
  if (typeof document === "undefined") return;
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const prev = meta.getAttribute("content") || "width=device-width, initial-scale=1";
  meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1");
  window.setTimeout(() => {
    meta.setAttribute("content", prev.includes("width=") ? prev : "width=device-width, initial-scale=1");
  }, 80);
}

export function GenreCreateWizard({
  projectId,
  phaseId,
  existingCount,
  existingLabels,
  onClose,
  onComplete,
}: Props) {
  const { tx, locale } = useI18n();
  const [portalReady, setPortalReady] = useState(false);
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [label, setLabel] = useState("");
  const [hint, setHint] = useState("");
  const [colorKey, setColorKey] = useState(() => nextCustomColorKey(existingCount));
  const [iconKey, setIconKey] = useState(CUSTOM_GENRE_ICON_PRESETS[0]!.key);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const closedRef = useRef(false);

  const isDirty = Boolean(label.trim()) || Boolean(hint.trim());
  const canSubmit = Boolean(normalizeCustomTaskGenreLabel(label));
  const SelectedIcon = CUSTOM_GENRE_ICON_PRESETS.find((p) => p.key === iconKey)?.icon ?? CUSTOM_GENRE_ICON_PRESETS[0]!.icon;

  // 下書き復元
  useEffect(() => {
    closedRef.current = false;
    const draft = readGenreCreateDraft(projectId, phaseId);
    if (draft) {
      setLabel(draft.label);
      setHint(draft.hint);
      if (draft.colorKey) setColorKey(draft.colorKey);
      setIconKey(draft.iconKey);
    }
    setHydrated(true);
  }, [projectId, phaseId]);

  // 下書き保存
  useEffect(() => {
    if (!hydrated || closedRef.current) return;
    writeGenreCreateDraft(projectId, phaseId, {
      label,
      hint,
      colorKey,
      iconKey,
    });
  }, [hydrated, projectId, phaseId, label, hint, colorKey, iconKey]);

  useEffect(() => {
    setPortalReady(true);
    markGenreCreateOpen(projectId, phaseId);
    const id = window.requestAnimationFrame(() => setEntered(true));
    const prevOverflow = document.body.style.overflow;
    const prevHtmlOverflowX = document.documentElement.style.overflowX;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflowX = "hidden";
    return () => {
      window.cancelAnimationFrame(id);
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflowX = prevHtmlOverflowX;
    };
  }, [projectId, phaseId]);

  function clearDraftAndClose() {
    closedRef.current = true;
    clearGenreCreateDraft(projectId, phaseId);
    clearGenreCreateOpen(projectId);
    setConfirmDiscard(false);
    setExiting(true);
    window.setTimeout(() => onClose(), 220);
  }

  function requestClose() {
    if (saving) return;
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }
    clearDraftAndClose();
  }

  async function finish() {
    const labelJa = normalizeCustomTaskGenreLabel(label);
    if (!labelJa || saving) return;
    if (existingLabels.some((item) => item.toLowerCase() === labelJa.toLowerCase())) {
      setError(tx("同じ名前のジャンルがすでにあります", "That genre name already exists"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onComplete({
        id: createCustomTaskGenreId(),
        labelJa,
        hintJa: hint.trim().slice(0, 60) || undefined,
        colorKey,
        iconKey,
        phaseId: phaseId ?? undefined,
      });
      closedRef.current = true;
      clearGenreCreateDraft(projectId, phaseId);
      clearGenreCreateOpen(projectId);
      setExiting(true);
      window.setTimeout(() => onClose(), 180);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("ジャンルを追加できませんでした", "Couldn’t add the genre"));
      setSaving(false);
    }
  }

  if (!portalReady) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[300] flex w-full max-w-[100vw] flex-col overscroll-none bg-white ${
        exiting ? "issue-create-wizard-out" : entered ? "issue-create-wizard-in" : "translate-x-full"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={tx("ジャンルを作成", "Create genre")}
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-zinc-100 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          disabled={saving}
          onClick={requestClose}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50 active:bg-zinc-100 disabled:opacity-50"
          aria-label={tx("戻る", "Back")}
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2.5} aria-hidden />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[20px] font-extrabold leading-tight text-zinc-900">
          {tx("ジャンルを作成", "Create genre")}
        </h1>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] pt-4">
        <div className="mx-auto flex w-full min-w-0 max-w-lg flex-col gap-5">
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3">
            <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white ${colorKey}`}>
              <SelectedIcon className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold text-zinc-900">
                {label.trim() || tx("ジャンル名", "Genre name")}
              </p>
              <p className="truncate text-[12px] text-zinc-500">
                {hint.trim() || tx("説明（任意）", "Description (optional)")}
              </p>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-[12px] font-semibold text-zinc-700">{tx("名前", "Name")}</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={resetViewportZoom}
              maxLength={CUSTOM_TASK_GENRE_LABEL_MAX}
              placeholder={tx("例: 撮影・編集", "e.g. Filming & editing")}
              className="min-h-[48px] w-full rounded-2xl border border-zinc-200 px-3 text-[16px] outline-none focus:border-[#FF9600]"
              autoFocus
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-[12px] font-semibold text-zinc-700">{tx("説明", "Description")}</span>
            <textarea
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              onBlur={resetViewportZoom}
              maxLength={60}
              rows={3}
              placeholder={tx("どんな課題を入れるか（任意）", "What kinds of tasks (optional)")}
              className="w-full resize-y rounded-2xl border border-zinc-200 px-3 py-2.5 text-[16px] outline-none focus:border-[#FF9600]"
            />
          </label>

          <div className="space-y-2">
            <p className="text-[12px] font-semibold text-zinc-700">{tx("マークの色", "Mark color")}</p>
            <div className="flex flex-wrap gap-2.5">
              {CUSTOM_COLOR_PRESETS.map((preset) => {
                const selected = colorKey === preset.iconBg;
                return (
                  <button
                    key={preset.iconBg}
                    type="button"
                    onClick={() => setColorKey(preset.iconBg)}
                    className={`h-11 w-11 rounded-full ${preset.iconBg} ${
                      selected ? "ring-2 ring-[#FF9600] ring-offset-2" : ""
                    }`}
                    aria-label={preset.iconBg}
                    aria-pressed={selected}
                  />
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[12px] font-semibold text-zinc-700">{tx("マークの形", "Mark icon")}</p>
            <div className="grid grid-cols-5 gap-2">
              {CUSTOM_GENRE_ICON_PRESETS.map((preset) => {
                const Icon = preset.icon;
                const selected = iconKey === preset.key;
                const markLabel = locale === "en" ? preset.labelEn : preset.labelJa;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setIconKey(preset.key)}
                    className={`inline-flex h-12 w-full items-center justify-center rounded-2xl border ${
                      selected
                        ? "border-[#FF9600] bg-[#FFF4E5] text-[#9A5B1F]"
                        : "border-zinc-200 bg-white text-zinc-600"
                    }`}
                    aria-label={markLabel}
                    aria-pressed={selected}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </button>
                );
              })}
            </div>
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-100 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            disabled={!canSubmit || saving}
            onClick={() => void finish()}
            className="inline-flex w-full select-none items-center justify-center rounded-full bg-[#FF9600] px-4 min-h-[50px] text-[17px] font-semibold tracking-[-0.022em] text-white transition-[opacity,transform] duration-100 ease-out active:scale-[0.99] active:opacity-70 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 disabled:active:opacity-40"
          >
            {saving ? tx("作成中…", "Creating…") : tx("完了", "Done")}
          </button>
        </div>
      </div>

      {confirmDiscard ? (
        <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal
            aria-labelledby="genre-create-discard-title"
            className="w-full max-w-sm rounded-2xl bg-white px-5 py-6 text-center shadow-xl"
          >
            <h3 id="genre-create-discard-title" className="text-base font-semibold text-[#202124]">
              {tx("入力内容を捨てますか？", "Discard what you entered?")}
            </h3>
            <p className="mt-2 text-sm text-[#5f6368]">
              {tx(
                "今まで入力した内容は消えます。戻っても大丈夫ですか？この操作は取り消せません。",
                "Everything you’ve entered will be lost. Go back anyway? This can’t be undone.",
              )}
            </p>
            <div className="mx-auto mt-6 flex w-full max-w-[220px] flex-col items-stretch gap-3">
              <button
                type="button"
                className="rounded-xl bg-[#d93025] px-4 py-3 text-sm font-semibold text-white hover:bg-[#c5221f]"
                onClick={clearDraftAndClose}
              >
                {tx("捨てて戻る", "Discard")}
              </button>
              <button
                type="button"
                className="rounded-xl px-4 py-3 text-sm font-medium text-[#5f6368] hover:bg-[#f1f3f4]"
                onClick={() => setConfirmDiscard(false)}
              >
                {tx("キャンセル", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
