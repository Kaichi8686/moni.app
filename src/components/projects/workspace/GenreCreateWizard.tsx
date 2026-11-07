"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft } from "lucide-react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { useI18n } from "@/lib/i18n/I18nProvider";
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
  const [label, setLabel] = useState("");
  const [hint, setHint] = useState("");
  const [colorKey, setColorKey] = useState(() => nextCustomColorKey(existingCount));
  const [iconKey, setIconKey] = useState(CUSTOM_GENRE_ICON_PRESETS[0]!.key);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const isDirty = Boolean(label.trim()) || Boolean(hint.trim());
  const canSubmit = Boolean(normalizeCustomTaskGenreLabel(label));
  const SelectedIcon = CUSTOM_GENRE_ICON_PRESETS.find((p) => p.key === iconKey)?.icon ?? CUSTOM_GENRE_ICON_PRESETS[0]!.icon;

  useEffect(() => {
    setPortalReady(true);
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
  }, []);

  function closeWizard() {
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
    closeWizard();
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
      className={`fixed inset-0 z-[300] flex w-full max-w-[100vw] flex-col overflow-x-hidden overscroll-none bg-white ${
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
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-zinc-300 bg-white text-zinc-800 shadow-[0_2px_0_#D4D4D8] transition-[transform,box-shadow] duration-75 enabled:active:translate-y-[2px] enabled:active:shadow-none disabled:opacity-50"
          aria-label={tx("戻る", "Back")}
        >
          <ArrowLeft className="h-6 w-6" strokeWidth={2.5} aria-hidden />
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
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setIconKey(preset.key)}
                    className={`inline-flex h-12 flex-col items-center justify-center gap-0.5 rounded-2xl border text-[10px] font-semibold ${
                      selected
                        ? "border-[#FF9600] bg-[#FFF4E5] text-[#9A5B1F]"
                        : "border-zinc-200 bg-white text-zinc-600"
                    }`}
                    aria-pressed={selected}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    <span className="truncate px-0.5">{locale === "en" ? preset.labelEn : preset.labelJa}</span>
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
          <DuoButton
            type="button"
            tone="orange"
            size="lg"
            fullWidth
            disabled={!canSubmit || saving}
            onClick={() => void finish()}
          >
            {saving ? tx("作成中…", "Creating…") : tx("完了", "Done")}
          </DuoButton>
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
                onClick={closeWizard}
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
