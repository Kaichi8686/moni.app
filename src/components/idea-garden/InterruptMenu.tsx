"use client";

import { X } from "lucide-react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** 記録して中断 → 植木鉢＋続けるへ */
  onSaveAndPause: () => void;
  /** 中止 → 作業を捨てる */
  onAbort: () => void;
};

/** 右上バツ → 記録して中断 / 中止 */
export function InterruptControl({ open, onOpen, onClose, onSaveAndPause, onAbort }: Props) {
  const { tx } = useI18n();

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-label={tx("中断", "Pause")}
        className="absolute right-4 top-[max(0.85rem,env(safe-area-inset-top))] z-50 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[#3C3C3C] shadow-md"
      >
        <X className="h-5 w-5" strokeWidth={2.5} />
      </button>

      {open ? (
        <div
          className="absolute inset-0 z-[60] flex items-end justify-center bg-black/35 px-4 pb-10 pt-20 sm:items-center sm:pb-0"
          role="dialog"
          aria-modal="true"
          aria-label={tx("中断メニュー", "Pause menu")}
        >
          <div className="w-full max-w-sm rounded-3xl border-[3px] border-[#E5E5E5] bg-white p-5 shadow-xl">
            <p className="text-center text-[18px] font-extrabold text-[#3C3C3C]">
              {tx("どうする？", "What do you want to do?")}
            </p>
            <p className="mt-2 text-center text-[13px] font-semibold text-zinc-500">
              {tx(
                "記録して中断すると、あとから続けられます",
                "Save & pause to continue later",
              )}
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <DuoButton tone="orange" fullWidth onClick={onSaveAndPause}>
                {tx("記録して中断", "Save & pause")}
              </DuoButton>
              <DuoButton tone="zinc" fullWidth onClick={onAbort}>
                {tx("中止する", "Discard")}
              </DuoButton>
              <button
                type="button"
                onClick={onClose}
                className="py-2 text-center text-[14px] font-bold text-zinc-500"
              >
                {tx("キャンセル", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
