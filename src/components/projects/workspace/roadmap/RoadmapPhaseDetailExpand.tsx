"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  open: boolean;
  title: string;
  goal?: string;
  description?: string;
  stepNumber?: number;
  compact?: boolean;
  /** 編集画面のみ true。概要の閲覧では渡さない */
  canEdit?: boolean;
  onSave?: (patch: { title: string; goal: string; description: string }) => Promise<void>;
};

export function RoadmapPhaseDetailExpand({
  open,
  title,
  goal,
  description,
  stepNumber,
  compact = false,
  canEdit = false,
  onSave,
}: Props) {
  const { tx } = useI18n();
  const [titleDraft, setTitleDraft] = useState(title);
  const [goalDraft, setGoalDraft] = useState(goal ?? "");
  const [descriptionDraft, setDescriptionDraft] = useState(description ?? "");
  const [busy, setBusy] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitleDraft(title);
    setGoalDraft(goal ?? "");
    setDescriptionDraft(description ?? "");
    setSavedFlash(false);
  }, [open, title, goal, description]);

  if (!open) return null;

  const editable = Boolean(canEdit && onSave);
  const dirty =
    titleDraft.trim() !== title.trim() ||
    goalDraft.trim() !== (goal ?? "").trim() ||
    descriptionDraft.trim() !== (description ?? "").trim();

  async function handleSave() {
    if (!onSave || !editable) return;
    const nextTitle = titleDraft.trim();
    if (!nextTitle) return;
    setBusy(true);
    try {
      await onSave({
        title: nextTitle,
        goal: goalDraft.trim(),
        description: descriptionDraft.trim(),
      });
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1600);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`roadmap-phase-detail-expand overflow-hidden rounded-2xl border border-orange-100 bg-orange-50/70 ${
        compact ? "mt-1.5 px-2.5 py-2" : "mt-2 px-3 py-3"
      }`}
    >
      {stepNumber != null ? (
        <p className={`font-bold tracking-[0.12em] text-zinc-400 ${compact ? "text-[9px]" : "text-[10px]"}`}>
          STEP {stepNumber}
        </p>
      ) : null}

      {editable ? (
        <div className={compact ? "mt-1.5 space-y-2.5" : "mt-2 space-y-3"}>
          <div>
            <label className={`block font-semibold text-zinc-600 ${compact ? "text-[10px]" : "text-xs"}`}>
              {tx("名前", "Name")}
            </label>
            <input
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              disabled={busy}
              className="mt-1 min-h-[40px] w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:border-orange-400 disabled:opacity-60"
            />
          </div>
          <div>
            <label className={`block font-bold text-orange-900 ${compact ? "text-[10px]" : "text-xs"}`}>
              {tx("ゴール", "Goal")}
            </label>
            <textarea
              value={goalDraft}
              onChange={(event) => setGoalDraft(event.target.value)}
              disabled={busy}
              rows={2}
              placeholder={tx("達成したら「できた」と言えること", "What “done” looks like")}
              className="mt-1 w-full resize-none rounded-xl border border-orange-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-orange-400 disabled:opacity-60"
            />
          </div>
          <div>
            <label className={`block font-semibold text-zinc-600 ${compact ? "text-[10px]" : "text-xs"}`}>
              {tx("概要", "Overview")}
            </label>
            <textarea
              value={descriptionDraft}
              onChange={(event) => setDescriptionDraft(event.target.value)}
              disabled={busy}
              rows={3}
              placeholder={tx("このステップでやること", "What you’ll do in this step")}
              className="mt-1 w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none focus:border-orange-400 disabled:opacity-60"
            />
          </div>
          <button
            type="button"
            disabled={busy || !titleDraft.trim() || !dirty}
            onClick={() => void handleSave()}
            className="min-h-[40px] w-full rounded-xl bg-orange-500 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-40"
          >
            {busy ? tx("保存中…", "Saving…") : savedFlash ? tx("保存しました", "Saved") : tx("保存する", "Save")}
          </button>
        </div>
      ) : (
        <>
          <p className={`font-bold text-zinc-900 ${compact ? "mt-0.5 text-[12px] leading-snug" : "mt-1 text-sm"}`}>
            {title}
          </p>
          <div className={compact ? "mt-2 space-y-2" : "mt-3 space-y-3"}>
            <div>
              <p className={`font-bold text-orange-900 ${compact ? "text-[10px]" : "text-xs"}`}>
                {tx("ゴール", "Goal")}
              </p>
              {goal?.trim() ? (
                <p className={`mt-0.5 whitespace-pre-wrap leading-relaxed text-zinc-800 ${compact ? "text-[11px]" : "text-sm"}`}>
                  {goal}
                </p>
              ) : (
                <p className={`mt-0.5 text-zinc-400 ${compact ? "text-[11px]" : "text-sm"}`}>
                  {tx("まだ書かれていません", "Not set yet")}
                </p>
              )}
            </div>
            <div>
              <p className={`font-semibold text-zinc-600 ${compact ? "text-[10px]" : "text-xs"}`}>
                {tx("概要", "Overview")}
              </p>
              {description?.trim() ? (
                <p className={`mt-0.5 whitespace-pre-wrap leading-relaxed text-zinc-700 ${compact ? "text-[11px]" : "text-sm"}`}>
                  {description}
                </p>
              ) : (
                <p className={`mt-0.5 text-zinc-400 ${compact ? "text-[11px]" : "text-sm"}`}>
                  {tx("まだ書かれていません", "Not set yet")}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
