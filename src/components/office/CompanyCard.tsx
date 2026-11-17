"use client";

import { useEffect, useState } from "react";
import { OFFICE_MAX_STAMINA } from "@/lib/office/constants";
import { industryMeta } from "@/lib/office/industries";
import { formatRemainMmSs, formatStaminaDots, msUntil } from "@/lib/office/stamina";
import { OFFICE_LEAGUE_META } from "@/lib/office/tiers";
import type { OfficeCompany } from "@/lib/office/types";

type Props = {
  company: OfficeCompany;
  seasonRevenue: number;
  staminaValue: number;
  nextRecoverAt: string | null;
};

export function CompanyCard({
  company,
  seasonRevenue,
  staminaValue,
  nextRecoverAt,
}: Props) {
  const meta = OFFICE_LEAGUE_META[company.leagueId];
  const ind = industryMeta(company.industry);
  const aboutLine = company.about?.trim() || null;
  const recovering = Boolean(nextRecoverAt) && staminaValue < OFFICE_MAX_STAMINA;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!recovering) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [recovering, nextRecoverAt]);

  const remain = recovering && nextRecoverAt ? msUntil(new Date(nextRecoverAt), new Date(now)) : null;

  return (
    <section className="rounded-3xl border border-white/70 bg-white/85 p-4 shadow-[0_12px_40px_rgba(28,25,23,0.08)] backdrop-blur-md sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-zinc-500">
            {meta.crown} {meta.labelJa}
            {ind ? ` · ${ind.icon}` : ""}
          </p>
          <h2 className="mt-1 truncate text-2xl font-bold tracking-tight text-zinc-900 sm:text-[1.75rem]">
            {company.name}
          </h2>
          {aboutLine ? (
            <p className="mt-1 truncate text-sm leading-snug text-zinc-500" title={aboutLine}>
              {aboutLine}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 rounded-2xl bg-amber-50 px-3 py-2 text-center ring-1 ring-amber-100">
          <p className="text-[11px] font-bold text-amber-800/80">Lv</p>
          <p className="text-xl font-black tabular-nums text-amber-900">{company.level}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-100/80 pt-4">
        <div>
          <p className="text-xs text-zinc-500">累計売上</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-zinc-900 sm:text-2xl">
            {company.totalRevenue.toLocaleString("ja-JP")}
            <span className="ml-1 text-xs font-medium text-zinc-400">コイン</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">今月の売上</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-zinc-900 sm:text-2xl">
            {seasonRevenue.toLocaleString("ja-JP")}
            <span className="ml-1 text-xs font-medium text-zinc-400">コイン</span>
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-zinc-50/90 px-3.5 py-3">
        <div>
          <p className="text-xs text-zinc-500">スタミナ</p>
          <p className="mt-1 flex items-center gap-2">
            <span className="text-xl font-bold tracking-[0.2em] text-[#FF9600] leading-none">
              {formatStaminaDots(staminaValue)}
            </span>
            <span className="text-sm font-bold tabular-nums text-zinc-700">
              {staminaValue}/{OFFICE_MAX_STAMINA}
            </span>
          </p>
        </div>
        {remain != null ? (
          <p className="text-sm font-semibold tabular-nums text-zinc-600">
            次まで {formatRemainMmSs(remain)}
          </p>
        ) : (
          <p className="text-sm font-medium text-zinc-400">満タン</p>
        )}
      </div>
    </section>
  );
}
