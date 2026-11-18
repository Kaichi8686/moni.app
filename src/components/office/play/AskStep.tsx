"use client";

import { DuoButton } from "@/components/idea-garden/DuoButton";

type Props = {
  /** Step5 で質問 UI に差し替え。今はプレースホルダ */
  onNext: () => void;
  onSkip?: () => void;
};

/** 聞き込み画面（Step5 で本実装）。Step1 では進行の受け皿のみ */
export function AskStep({ onNext, onSkip }: Props) {
  return (
    <section className="space-y-4 rounded-3xl border border-white/70 bg-white/90 p-4 shadow-[0_16px_48px_rgba(28,25,23,0.1)] backdrop-blur-md sm:p-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">
          聞き込み
        </p>
        <h3 className="mt-1 text-lg font-black text-zinc-900">社員に聞いてみよう</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
          質問は最大2つまで。聞かずに進んでもOK（手がかりは減るよ）。
        </p>
      </div>
      <p className="rounded-2xl bg-zinc-50 px-3 py-2 text-center text-xs font-medium text-zinc-400">
        質問カードは次のステップで追加するよ
      </p>
      <div className="flex flex-col gap-2">
        <DuoButton type="button" tone="orange" size="lg" fullWidth onClick={onNext}>
          作戦を考える
        </DuoButton>
        {onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="text-center text-xs font-bold text-zinc-400 hover:text-zinc-600"
          >
            聞かずに進む
          </button>
        ) : null}
      </div>
    </section>
  );
}
