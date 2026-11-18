"use client";

import { IconBolt, IconCalendar, IconCoin } from "@/components/office/visual/icons";

type Props = {
  dateKey: string;
  coins: number;
  stamina: number;
  maxStamina?: number;
};

export function TopBar({ dateKey, coins, stamina, maxStamina = 5 }: Props) {
  return (
    <div className="ov-panel flex items-center gap-3 px-3 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5 text-[var(--ov-muted)]">
          <IconCalendar size={16} />
          <span className="ov-muted">営業日 {dateKey}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1 text-[var(--ov-gold)]">
            <IconCoin size={16} />
            <span className="ov-num text-sm font-bold">{coins.toLocaleString("ja-JP")}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-[var(--ov-accent)]">
            <IconBolt size={16} />
            <span className="ov-num text-sm font-bold">
              {stamina}/{maxStamina}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
