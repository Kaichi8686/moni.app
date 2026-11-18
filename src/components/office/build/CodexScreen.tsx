"use client";

import { OFFICE_TERMS } from "@/lib/office/build/content/terms";

type Props = {
  unlocked: string[];
  onClose: () => void;
};

export function CodexScreen({ unlocked, onClose }: Props) {
  return (
    <div className="space-y-3">
      <button type="button" className="text-sm font-bold text-[var(--ob-muted)]" onClick={onClose}>
        ← 戻る
      </button>
      <div className="ob-panel p-4">
        <p className="ob-title text-sm text-[var(--ob-gold)]">用語図鑑</p>
        <p className="mt-1 text-xs text-[var(--ob-muted)]">遊んだあとに解放されるよ</p>
        <ul className="mt-3 space-y-2">
          {OFFICE_TERMS.map((t) => {
            const on = unlocked.includes(t.id);
            return (
              <li
                key={t.id}
                className="rounded-xl border border-[var(--ob-border)] px-3 py-2"
                style={{ opacity: on ? 1 : 0.45 }}
              >
                <p className="ob-title text-sm">{on ? t.name : "？？？"}</p>
                {on ? (
                  <>
                    <p className="mt-0.5 text-xs text-[var(--ob-muted)]">{t.shortDesc}</p>
                    {t.formula ? (
                      <p className="ob-num mt-1 text-[11px] text-[var(--ob-mint)]">{t.formula}</p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-0.5 text-xs text-[var(--ob-muted)]">まだ未解放</p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
