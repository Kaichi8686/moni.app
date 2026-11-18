"use client";

import { PixelSprite, SPRITE_SECRETARY } from "@/components/office/build/PixelSprite";
import type { TermDef } from "@/lib/office/build/content/terms";

type Props = {
  summary: string;
  terms: TermDef[];
  correctText: string;
  onNext: () => void;
  nextLabel?: string;
};

export function CoachStep({ summary, terms, correctText, onNext, nextLabel }: Props) {
  return (
    <div className="ob-panel space-y-3 p-4">
      <div className="flex gap-3">
        <PixelSprite {...SPRITE_SECRETARY} scale={3} title="秘書" />
        <div>
          <p className="ob-title text-sm text-[var(--ob-gold)]">秘書のひとこと</p>
          <p className="mt-2 text-sm leading-relaxed">{summary}</p>
        </div>
      </div>
      <p className="rounded-xl bg-[var(--ob-border)]/40 px-3 py-2 text-xs text-[var(--ob-muted)]">
        正解の仮説：{correctText}
      </p>
      {terms.length ? (
        <div>
          <p className="text-[11px] font-bold text-[var(--ob-muted)]">用語カード追加</p>
          <ul className="mt-2 space-y-2">
            {terms.map((t) => (
              <li key={t.id} className="rounded-xl border border-[var(--ob-border)] px-3 py-2">
                <p className="ob-title text-sm text-[var(--ob-mint)]">{t.name}</p>
                <p className="mt-0.5 text-xs text-[var(--ob-muted)]">{t.shortDesc}</p>
                {t.formula ? (
                  <p className="ob-num mt-1 text-[11px] text-[var(--ob-gold)]">{t.formula}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <button type="button" className="ob-btn w-full" onClick={onNext}>
        {nextLabel ?? "次へ"}
      </button>
    </div>
  );
}
