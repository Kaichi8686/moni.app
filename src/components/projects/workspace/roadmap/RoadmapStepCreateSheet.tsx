"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  RoadmapMarkPicker,
  type RoadmapMarkId,
} from "@/components/projects/workspace/roadmap/roadmapPathMarks";

type Props = {
  open: boolean;
  busy?: boolean;
  initialIcon: RoadmapMarkId;
  onClose: () => void;
  onSubmit: (values: {
    title: string;
    goal: string;
    description: string;
    icon: RoadmapMarkId;
  }) => Promise<void>;
};

/** マス追加用の下から出るシート */
export function RoadmapStepCreateSheet({
  open,
  busy = false,
  initialIcon,
  onClose,
  onSubmit,
}: Props) {
  const { tx } = useI18n();
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<RoadmapMarkId>(initialIcon);
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setGoal("");
    setDescription("");
    setIcon(initialIcon);
  }, [open, initialIcon]);

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

  const locked = busy || saving;

  function requestClose() {
    if (locked) return;
    onClose();
  }

  async function handleSubmit() {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    setSaving(true);
    try {
      await onSubmit({
        title: nextTitle,
        goal: goal.trim(),
        description: description.trim(),
        icon,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-end justify-center ${
        closing ? "roadmap-phase-sheet-root-out" : "roadmap-phase-sheet-root-in"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="roadmap-step-create-sheet-title"
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
          <h2 id="roadmap-step-create-sheet-title" className="text-sm font-bold text-zinc-900">
            {tx("マスを作成", "Create step")}
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <label htmlFor="roadmap-create-title" className="block text-xs font-semibold text-zinc-600">
              {tx("ステップ名", "Step name")}
            </label>
            <input
              id="roadmap-create-title"
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={locked}
              placeholder={tx("例：ヒアリング", "e.g. Interviews")}
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-zinc-300 px-3 text-sm outline-none focus:border-orange-400 disabled:opacity-60"
            />
          </div>
          <RoadmapMarkPicker
            value={icon}
            onChange={setIcon}
            disabled={locked}
            label={tx("マスの絵", "Step icon")}
          />
          <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-3">
            <label htmlFor="roadmap-create-goal" className="block text-xs font-bold text-orange-900">
              {tx("このステップのゴール", "Goal for this step")}
            </label>
            <p className="mt-0.5 text-[11px] leading-snug text-orange-800/80">
              {tx("達成したら「できた」と言えること", "What “done” looks like")}
            </p>
            <textarea
              id="roadmap-create-goal"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              disabled={locked}
              placeholder={tx("例：10人に話を聞く", "e.g. Talk to 10 people")}
              rows={2}
              className="mt-2 w-full resize-none rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 disabled:opacity-60"
            />
          </div>
          <div>
            <label htmlFor="roadmap-create-overview" className="block text-xs font-semibold text-zinc-600">
              {tx("詳細", "Details")}
            </label>
            <textarea
              id="roadmap-create-overview"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={locked}
              placeholder={tx("このステップでやること", "What you’ll do in this step")}
              rows={3}
              className="mt-1.5 w-full resize-none rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-orange-400 disabled:opacity-60"
            />
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-zinc-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={locked}
            onClick={requestClose}
            className="min-h-[44px] rounded-2xl border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
          >
            {tx("キャンセル", "Cancel")}
          </button>
          <button
            type="button"
            disabled={locked || !title.trim()}
            onClick={() => void handleSubmit()}
            className="min-h-[44px] flex-1 rounded-2xl bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-40"
          >
            {saving ? tx("追加中…", "Adding…") : tx("マスを追加", "Add step")}
          </button>
        </div>
      </div>
    </div>
  );
}
