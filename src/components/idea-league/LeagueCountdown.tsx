"use client";

import { useEffect, useState } from "react";
import { formatCountdown, leagueNow } from "@/lib/idea-league/calendar";

type Props = {
  target: Date;
  label: string;
  compact?: boolean;
  /** Soft chip for status-card corners (readable on light cards) */
  pill?: boolean;
};

export function LeagueCountdown({ target, label, compact, pill }: Props) {
  const [now, setNow] = useState(() => leagueNow());

  useEffect(() => {
    const id = window.setInterval(() => setNow(leagueNow()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const { days, hours, minutes, seconds, label: clock } = formatCountdown(
    Math.max(0, target.getTime() - now.getTime()),
  );

  if (compact) {
    if (pill) {
      return (
        <div className="inline-flex max-w-[11.5rem] shrink-0 flex-col items-end gap-0.5 rounded-2xl bg-[#FFF4E5] px-2.5 py-1.5 ring-1 ring-[#FFD59A] sm:max-w-none sm:flex-row sm:items-center sm:gap-2 sm:rounded-full sm:px-3">
          <span className="text-[10px] font-bold leading-tight text-[#9A5B1F] sm:text-[11px]">{label}</span>
          <span className="text-sm font-black tabular-nums tracking-tight text-zinc-900 sm:text-xs">
            {clock}
          </span>
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white">
        <span className="opacity-70">{label}</span>
        <span className="tabular-nums tracking-tight">{clock}</span>
      </div>
    );
  }

  const cells = [
    { v: days, u: "日" },
    { v: hours, u: "時" },
    { v: minutes, u: "分" },
    { v: seconds, u: "秒" },
  ];

  return (
    <div className="rounded-2xl bg-zinc-900 px-4 py-3 text-white shadow-[0_8px_0_#18181b]">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{label}</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {cells.map((c) => (
          <div key={c.u} className="rounded-xl bg-white/10 px-1 py-2 text-center">
            <p className="text-xl font-black tabular-nums tracking-tight sm:text-2xl">
              {String(c.v).padStart(2, "0")}
            </p>
            <p className="text-[10px] font-semibold text-zinc-400">{c.u}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
