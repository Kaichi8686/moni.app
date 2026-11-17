"use client";

import { useEffect, useState } from "react";
import { OfficeView } from "@/components/office/OfficeView";
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
  sceneFx?: string | null;
  speech?: string | null;
};

export function CompanyCard({
  company,
  seasonRevenue,
  staminaValue,
  nextRecoverAt,
  sceneFx = null,
  speech = null,
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
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <OfficeView
        level={company.level}
        industry={company.industry}
        fx={sceneFx}
        speech={speech}
      />

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-zinc-500">
              {meta.crown} {meta.labelJa}
              {ind ? ` · ${ind.icon}` : ""}
            </p>
            <h2 className="mt-0.5 truncate text-lg font-bold tracking-tight text-zinc-900">
              {company.name}
              <span className="ml-2 text-sm font-semibold text-zinc-400">Lv {company.level}</span>
            </h2>
            {aboutLine ? (
              <p className="mt-1 truncate text-xs leading-snug text-zinc-500" title={aboutLine}>
                {aboutLine}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-zinc-100 pt-3">
          <div>
            <p className="text-[11px] text-zinc-500">累計売上</p>
            <p className="mt-0.5 text-base font-bold tabular-nums text-zinc-900">
              {company.totalRevenue.toLocaleString("ja-JP")}
              <span className="ml-1 text-[11px] font-medium text-zinc-400">コイン</span>
            </p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">今月の売上</p>
            <p className="mt-0.5 text-base font-bold tabular-nums text-zinc-900">
              {seasonRevenue.toLocaleString("ja-JP")}
              <span className="ml-1 text-[11px] font-medium text-zinc-400">コイン</span>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-2.5">
          <div>
            <p className="text-[11px] text-zinc-500">スタミナ</p>
            <p className="mt-0.5 flex items-center gap-2">
              <span className="text-lg font-bold tracking-[0.18em] text-[#FF9600] leading-none">
                {formatStaminaDots(staminaValue)}
              </span>
              <span className="text-xs font-bold tabular-nums text-zinc-700">
                {staminaValue}/{OFFICE_MAX_STAMINA}
              </span>
            </p>
          </div>
          {remain != null ? (
            <p className="text-xs font-semibold tabular-nums text-zinc-600">
              次まで {formatRemainMmSs(remain)}
            </p>
          ) : (
            <p className="text-xs font-medium text-zinc-400">満タン</p>
          )}
        </div>
      </div>
    </section>
  );
}
