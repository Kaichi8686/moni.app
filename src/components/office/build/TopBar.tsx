"use client";

import { MOOD_LABEL_JA, type OfficeMood } from "@/lib/office/build/mood";
import { formatStaminaDots } from "@/lib/office/stamina";

type Props = {
  dateKey: string;
  coins: number;
  stamina: number;
  mood: OfficeMood;
  onOpenRank?: () => void;
  onOpenCodex?: () => void;
  onOpenSettings?: () => void;
};

export function TopBar({
  dateKey,
  coins,
  stamina,
  mood,
  onOpenRank,
  onOpenCodex,
  onOpenSettings,
}: Props) {
  return (
    <div className="ob-panel flex items-center gap-2 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="ob-title text-[11px] text-[var(--ob-muted)]">営業日 {dateKey}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="ob-num text-sm font-bold text-[var(--ob-gold)]">
            {coins.toLocaleString("ja-JP")}
            <span className="ml-0.5 text-[10px] font-medium text-[var(--ob-muted)]">コイン</span>
          </span>
          <span className="text-xs tracking-[0.12em] text-[var(--ob-accent)]" title="スタミナ">
            {formatStaminaDots(stamina)}
          </span>
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
            style={{ background: "var(--ob-border)", color: "var(--ob-text)" }}
            title={MOOD_LABEL_JA[mood]}
          >
            {MOOD_LABEL_JA[mood]}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        {onOpenCodex ? (
          <button type="button" className="ob-btn-ghost px-2 py-2 text-sm" onClick={onOpenCodex} aria-label="用語図鑑">
            図
          </button>
        ) : null}
        {onOpenRank ? (
          <button type="button" className="ob-btn-ghost px-2 py-2 text-sm" onClick={onOpenRank} aria-label="順位">
            位
          </button>
        ) : null}
        {onOpenSettings ? (
          <button type="button" className="ob-btn-ghost px-2 py-2 text-sm" onClick={onOpenSettings} aria-label="設定">
            設
          </button>
        ) : null}
      </div>
    </div>
  );
}
