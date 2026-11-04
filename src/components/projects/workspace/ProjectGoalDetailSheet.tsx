"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  open: boolean;
  onClose: () => void;
  projectName: string;
  goal: string;
  problemMotivation: string;
  canEdit?: boolean;
  onSave?: (patch: { goal: string; problemMotivation: string }) => Promise<void>;
};

/** ゴールバナー押下後の詳細。編集可のときはシート内で直接直せる。 */
export function ProjectGoalDetailSheet({
  open,
  onClose,
  projectName,
  goal,
  problemMotivation,
  canEdit = false,
  onSave,
}: Props) {
  const { tx } = useI18n();
  const [goalDraft, setGoalDraft] = useState(goal);
  const [motivationDraft, setMotivationDraft] = useState(problemMotivation);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  const name = projectName.trim() || tx("プロジェクト", "Project");
  const title = tx(`「${name}」のゴール`, `Goal of “${name}”`);
  const editable = Boolean(canEdit && onSave);

  useEffect(() => {
    if (!open) return;
    setGoalDraft(goal);
    setMotivationDraft(problemMotivation);
    setError("");
  }, [open, goal, problemMotivation]);

  useEffect(() => {
    if (open) {
      setClosing(false);
      setVisible(true);
      return;
    }
    if (!open && visible) {
      setClosing(true);
      const t = window.setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, 220);
      return () => window.clearTimeout(t);
    }
  }, [open, visible]);

  if (!visible) return null;
  if (!editable && !goal.trim()) return null;

  function requestClose() {
    if (busy) return;
    onClose();
  }

  async function handleSave() {
    if (!onSave || !editable) return;
    const nextGoal = goalDraft.trim();
    const nextMotivation = motivationDraft.trim();
    if (!nextGoal || !nextMotivation) {
      setError(
        tx(
          "きっかけとゴールの両方を入力してください。",
          "Please fill in both the motivation and the goal.",
        ),
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave({ goal: nextGoal, problemMotivation: nextMotivation });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("保存に失敗しました", "Couldn’t save"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-end justify-center ${
        closing ? "roadmap-phase-sheet-root-out" : "roadmap-phase-sheet-root-in"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-goal-sheet-title"
    >
      <button
        type="button"
        className={`absolute inset-0 border-0 bg-black/40 ${
          closing ? "roadmap-phase-sheet-backdrop-out" : "roadmap-phase-sheet-backdrop-in"
        }`}
        aria-label={tx("閉じる", "Close")}
        onClick={requestClose}
      />
      <div
        className={`relative z-10 flex max-h-[min(92dvh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_-12px_40px_rgba(0,0,0,0.15)] sm:mx-4 sm:mb-4 sm:rounded-2xl ${
          closing ? "roadmap-phase-sheet-panel-out" : "roadmap-phase-sheet-panel-in"
        }`}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-zinc-200 sm:hidden" aria-hidden />
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-4 py-3">
          <h2 id="project-goal-sheet-title" className="min-w-0 truncate text-sm font-bold text-zinc-900">
            {title}
          </h2>
          <button
            type="button"
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100"
            onClick={requestClose}
            aria-label={tx("閉じる", "Close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
            <label htmlFor="project-goal-sheet-goal" className="block text-[11px] font-bold tracking-wide text-orange-800">
              {tx("このプロジェクトのゴール", "Project goal")}
            </label>
            {editable ? (
              <textarea
                id="project-goal-sheet-goal"
                value={goalDraft}
                onChange={(event) => setGoalDraft(event.target.value)}
                disabled={busy}
                rows={3}
                placeholder={tx(
                  "例: 文化祭までに、クラス全員が見られる告知アプリを公開する",
                  "e.g. Ship a notice app the whole class can use by the school festival",
                )}
                className="mt-2 w-full resize-none rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-base font-semibold leading-relaxed text-zinc-900 outline-none focus:border-orange-400 disabled:opacity-60"
              />
            ) : (
              <p className="mt-2 whitespace-pre-wrap text-base font-semibold leading-relaxed text-zinc-900">
                {goal.trim()}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="project-goal-sheet-motivation"
              className="block text-[11px] font-semibold text-zinc-500"
            >
              {tx(
                "どのようなことを解決したくてこのプロジェクトを思いついたか",
                "What problem made you think of this project?",
              )}
            </label>
            {editable ? (
              <textarea
                id="project-goal-sheet-motivation"
                value={motivationDraft}
                onChange={(event) => setMotivationDraft(event.target.value)}
                disabled={busy}
                rows={4}
                placeholder={tx(
                  "例: 学校の行事告知がバラバラで、みんな見逃しがちだった",
                  "e.g. Event notices were scattered and people kept missing them",
                )}
                className="mt-2 w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-zinc-800 outline-none focus:border-orange-400 disabled:opacity-60"
              />
            ) : (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
                {problemMotivation.trim() || "—"}
              </p>
            )}
          </div>
        </div>

        {editable ? (
          <div className="flex shrink-0 flex-col gap-2 border-t border-zinc-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-center text-[12px] text-rose-700" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSave()}
              className="min-h-[44px] w-full rounded-2xl bg-orange-500 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {busy ? tx("保存中…", "Saving…") : tx("保存する", "Save")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
