"use client";

import { useEffect, useState } from "react";
import { OFFICE_MAX_STAMINA } from "@/lib/office/constants";
import { formatRemainMmSs, formatStaminaDots, msUntil } from "@/lib/office/stamina";
import type { OfficeCompany } from "@/lib/office/types";

type Props = {
  company: OfficeCompany;
  seasonRevenue: number;
  staminaValue: number;
  nextRecoverAt: string | null;
  onOpenRank: () => void;
  onOpenCodex?: () => void;
};

/** 1行ヘッダー＋タップで詳細。順位は右上アイコン */
export function OfficeChrome({
  company,
  seasonRevenue,
  staminaValue,
  nextRecoverAt,
  onOpenRank,
  onOpenCodex,
}: Props) {
  const [open, setOpen] = useState(false);
  const recovering = Boolean(nextRecoverAt) && staminaValue < OFFICE_MAX_STAMINA;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!recovering) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [recovering, nextRecoverAt]);

  const remain = recovering && nextRecoverAt ? msUntil(new Date(nextRecoverAt), new Date(now)) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-left shadow-sm"
          aria-expanded={open}
        >
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-black text-zinc-900">{company.name}</span>
            <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold tabular-nums text-amber-900 ring-1 ring-amber-100">
              Lv {company.level}
            </span>
            <span className="ml-auto shrink-0 text-xs font-bold tabular-nums text-zinc-600">
              {seasonRevenue.toLocaleString("ja-JP")}
              <span className="ml-0.5 font-medium text-zinc-400">コイン</span>
            </span>
            <span
              className="shrink-0 text-sm font-bold tracking-[0.12em] text-[#FF9600]"
              title={`スタミナ ${staminaValue}/${OFFICE_MAX_STAMINA}`}
            >
              {formatStaminaDots(staminaValue)}
            </span>
            <span className="text-[10px] font-bold text-zinc-400">{open ? "▲" : "▼"}</span>
          </div>
        </button>

        {onOpenCodex ? (
          <button
            type="button"
            onClick={onOpenCodex}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-lg shadow-sm"
            aria-label="事件図鑑"
            title="事件図鑑"
          >
            📖
          </button>
        ) : null}

        <button
          type="button"
          onClick={onOpenRank}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-lg shadow-sm"
          aria-label="順位"
          title="順位"
        >
          🏆
        </button>
      </div>

      {open ? (
        <div className="rounded-2xl border border-zinc-200 bg-white px-3.5 py-3 text-sm shadow-sm">
          {company.about ? (
            <p className="text-xs leading-snug text-zinc-500">{company.about}</p>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-zinc-500">累計売上</p>
              <p className="mt-0.5 font-bold tabular-nums text-zinc-900">
                {company.totalRevenue.toLocaleString("ja-JP")}
                <span className="ml-1 text-[11px] font-medium text-zinc-400">コイン</span>
              </p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500">今月の売上</p>
              <p className="mt-0.5 font-bold tabular-nums text-zinc-900">
                {seasonRevenue.toLocaleString("ja-JP")}
                <span className="ml-1 text-[11px] font-medium text-zinc-400">コイン</span>
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2">
            <p className="text-xs font-bold text-zinc-600">
              スタミナ {staminaValue}/{OFFICE_MAX_STAMINA}
            </p>
            {remain != null ? (
              <p className="text-xs font-semibold tabular-nums text-zinc-500">
                次まで {formatRemainMmSs(remain)}
              </p>
            ) : (
              <p className="text-xs font-medium text-zinc-400">満タン</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
