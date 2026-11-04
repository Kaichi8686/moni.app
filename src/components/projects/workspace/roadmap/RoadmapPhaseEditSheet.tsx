"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  RoadmapMarkPicker,
  RoadmapStepMark,
  resolveRoadmapMarkId,
  type RoadmapMarkId,
} from "@/components/projects/workspace/roadmap/roadmapPathMarks";

export type RoadmapPhaseEditValues = {
  title: string;
  goal: string;
  description: string;
  icon: RoadmapMarkId;
};

type PhaseInput = {
  id: string;
  title: string;
  goal?: string;
  description?: string;
  icon?: string | null;
  stepNumber?: number;
};

type Props = {
  open: boolean;
  phase: PhaseInput | null;
  busy?: boolean;
  onClose: () => void;
  onSave: (patch: RoadmapPhaseEditValues) => Promise<void>;
  onDelete?: () => Promise<void>;
};

/** ヘッダー左に出す小さめの立体マス */
function EditSheetMasuPreview({ markId, index }: { markId: RoadmapMarkId; index: number }) {
  return (
    <span
      data-roadmap-node
      className="relative block h-12 w-12 shrink-0 sm:h-14 sm:w-14"
      aria-hidden
    >
      <span className="absolute inset-x-0 bottom-0 top-[4px] rounded-full bg-[#C2410C]" />
      <span className="absolute inset-x-0 bottom-[4px] top-0 flex items-center justify-center rounded-full bg-[#F97316]">
        <span
          className="pointer-events-none absolute inset-[10%] rounded-full"
          style={{
            background:
              "radial-gradient(circle at 50% 28%, rgba(255,255,255,0.42) 0%, transparent 62%)",
          }}
        />
        <span className="relative z-[1] flex scale-[0.72] items-center justify-center sm:scale-[0.78]">
          <RoadmapStepMark markId={markId} index={index} tone="active" />
        </span>
      </span>
    </span>
  );
}

/** 編集画面用：マスの名前・絵・ゴール・詳細を下から出すシート */
export function RoadmapPhaseEditSheet({
  open,
  phase,
  busy = false,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const { tx } = useI18n();
  const [titleDraft, setTitleDraft] = useState("");
  /** ヘッダーに出す確定済みの名前（入力中は即反映しない） */
  const [headerTitle, setHeaderTitle] = useState("");
  const [goalDraft, setGoalDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [iconDraft, setIconDraft] = useState<RoadmapMarkId>("star");
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!phase) return;
    setTitleDraft(phase.title);
    setHeaderTitle(phase.title.trim() || phase.title);
    setGoalDraft(phase.goal ?? "");
    setDescriptionDraft(phase.description ?? "");
    setIconDraft(resolveRoadmapMarkId(phase.icon, (phase.stepNumber ?? 1) - 1));
  }, [phase]);

  useEffect(() => {
    if (open && phase) {
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
  }, [open, phase, visible]);

  if (!visible || !phase) return null;

  const locked = busy || saving;
  const stepIndex = Math.max((phase.stepNumber ?? 1) - 1, 0);
  const displayTitle = headerTitle.trim() || tx("名前未設定", "Untitled");

  function commitHeaderTitle() {
    const next = titleDraft.trim();
    if (next) setHeaderTitle(next);
  }

  function requestClose() {
    if (locked) return;
    onClose();
  }

  async function handleSave() {
    const nextTitle = titleDraft.trim();
    if (!nextTitle) return;
    setHeaderTitle(nextTitle);
    setSaving(true);
    try {
      await onSave({
        title: nextTitle,
        goal: goalDraft.trim(),
        description: descriptionDraft.trim(),
        icon: iconDraft,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (
      !window.confirm(
        tx(`「${phase!.title}」を削除しますか？`, `Delete “${phase!.title}”?`),
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await onDelete();
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
      aria-labelledby="roadmap-phase-edit-sheet-title"
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
        <div className="flex shrink-0 items-center gap-3 border-b border-zinc-100 px-4 py-3">
          <EditSheetMasuPreview markId={iconDraft} index={stepIndex} />
          <div className="min-w-0 flex-1">
            {phase.stepNumber != null ? (
              <p className="text-[10px] font-bold tracking-[0.12em] text-zinc-400">STEP {phase.stepNumber}</p>
            ) : null}
            <h2 id="roadmap-phase-edit-sheet-title" className="truncate text-sm font-bold text-zinc-900">
              {displayTitle}
            </h2>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-full p-2 text-zinc-500 hover:bg-zinc-100"
            onClick={requestClose}
            aria-label={tx("閉じる", "Close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <label htmlFor="roadmap-edit-title" className="block text-xs font-semibold text-zinc-600">
              {tx("名前", "Name")}
            </label>
            <input
              id="roadmap-edit-title"
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={commitHeaderTitle}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitHeaderTitle();
                  event.currentTarget.blur();
                }
              }}
              disabled={locked}
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 outline-none focus:border-orange-400 disabled:opacity-60"
            />
          </div>
          <RoadmapMarkPicker
            value={iconDraft}
            onChange={setIconDraft}
            disabled={locked}
            label={tx("マスの絵", "Step icon")}
          />
          <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-3">
            <label htmlFor="roadmap-edit-goal" className="block text-xs font-bold text-orange-900">
              {tx("ゴール", "Goal")}
            </label>
            <p className="mt-0.5 text-[11px] leading-snug text-orange-800/80">
              {tx("達成したら「できた」と言えること", "What “done” looks like")}
            </p>
            <textarea
              id="roadmap-edit-goal"
              value={goalDraft}
              onChange={(event) => setGoalDraft(event.target.value)}
              disabled={locked}
              rows={2}
              placeholder={tx("例：10人に話を聞く", "e.g. Talk to 10 people")}
              className="mt-2 w-full resize-none rounded-xl border border-orange-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 disabled:opacity-60"
            />
          </div>
          <div>
            <label htmlFor="roadmap-edit-details" className="block text-xs font-semibold text-zinc-600">
              {tx("詳細", "Details")}
            </label>
            <textarea
              id="roadmap-edit-details"
              value={descriptionDraft}
              onChange={(event) => setDescriptionDraft(event.target.value)}
              disabled={locked}
              rows={3}
              placeholder={tx("このステップでやること", "What you’ll do in this step")}
              className="mt-1.5 w-full resize-none rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 disabled:opacity-60"
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-zinc-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={locked || !titleDraft.trim()}
            onClick={() => void handleSave()}
            className="min-h-[44px] w-full rounded-2xl bg-orange-500 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-40"
          >
            {saving ? tx("保存中…", "Saving…") : tx("保存する", "Save")}
          </button>
          {onDelete ? (
            <button
              type="button"
              disabled={locked}
              onClick={() => void handleDelete()}
              className="min-h-[40px] w-full rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40"
            >
              {tx("このマスを削除", "Delete this step")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
