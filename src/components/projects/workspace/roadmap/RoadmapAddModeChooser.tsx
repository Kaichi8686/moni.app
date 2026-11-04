"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowRight, X } from "lucide-react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  open: boolean;
  onClose: () => void;
  onChooseBelow: () => void;
  onChooseSide: () => void;
};

/** 下に追加 / 横に追加 の選択シート */
export function RoadmapAddModeChooser({ open, onClose, onChooseBelow, onChooseSide }: Props) {
  const { tx } = useI18n();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

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

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-end justify-center ${
        closing ? "roadmap-phase-sheet-root-out" : "roadmap-phase-sheet-root-in"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="roadmap-add-mode-title"
    >
      <button
        type="button"
        className={`absolute inset-0 border-0 bg-black/40 ${
          closing ? "roadmap-phase-sheet-backdrop-out" : "roadmap-phase-sheet-backdrop-in"
        }`}
        aria-label={tx("閉じる", "Close")}
        onClick={onClose}
      />
      <div
        className={`relative z-[1] w-full max-w-lg rounded-t-3xl bg-white shadow-xl ${
          closing ? "roadmap-phase-sheet-panel-out" : "roadmap-phase-sheet-panel-in"
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <h2 id="roadmap-add-mode-title" className="text-sm font-bold text-zinc-900">
            {tx("マスの追加方法", "How to add a step")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
            aria-label={tx("閉じる", "Close")}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex flex-col gap-2.5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="text-[13px] leading-relaxed text-zinc-500">
            {tx(
              "パスの下に足すか、横に差し込むかを選べます。",
              "Add below the path, or insert from the side.",
            )}
          </p>
          <DuoButton
            type="button"
            tone="orange"
            size="md"
            fullWidth
            onClick={onChooseBelow}
            className="gap-2 !justify-start !px-4 !text-[15px]"
          >
            <ArrowDown className="h-5 w-5 shrink-0" aria-hidden strokeWidth={2.5} />
            {tx("下にマス追加", "Add step below")}
          </DuoButton>
          <DuoButton
            type="button"
            tone="peach"
            size="md"
            fullWidth
            onClick={onChooseSide}
            className="gap-2 !justify-start !px-4 !text-[15px]"
          >
            <ArrowRight className="h-5 w-5 shrink-0" aria-hidden strokeWidth={2.5} />
            {tx("横にマス追加", "Add step beside")}
          </DuoButton>
        </div>
      </div>
    </div>
  );
}
