"use client";

import { useEffect, useState } from "react";
import { OfficeScene } from "@/components/office/OfficeScene";
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
};

export function CompanyCard({
  company,
  seasonRevenue,
  staminaValue,
  nextRecoverAt,
  sceneFx = null,
}: Props) {
  const meta = OFFICE_LEAGUE_META[company.leagueId];
  const ind = industryMeta(company.industry);
  const recovering = Boolean(nextRecoverAt) && staminaValue < OFFICE_MAX_STAMINA;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!recovering) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [recovering, nextRecoverAt]);

  const remain = recovering && nextRecoverAt ? msUntil(new Date(nextRecoverAt), new Date(now)) : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div className="p-3 pb-0 sm:p-4 sm:pb-0">
        <OfficeScene level={company.level} industry={company.industry} fx={sceneFx} />
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-zinc-500">
              {meta.crown} {meta.labelJa}
              {ind ? ` · ${ind.icon} ${ind.labelJa}` : ""}
            </p>
            <h2 className="mt-1 truncate text-lg font-bold tracking-tight text-zinc-900">
              {company.name}
            </h2>
          </div>
          <div className="rounded-xl bg-amber-50 px-2.5 py-1.5 text-center">
            <p className="text-[10px] font-bold text-amber-800/80">Lv</p>
            <p className="text-lg font-black tabular-nums text-amber-900">{company.level}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-4">
          <div>
            <p className="text-[11px] text-zinc-500">累計売上</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-zinc-900">
              {company.totalRevenue.toLocaleString("ja-JP")}
              <span className="ml-1 text-xs font-medium text-zinc-400">コイン</span>
            </p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">今月の売上</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-zinc-900">
              {seasonRevenue.toLocaleString("ja-JP")}
              <span className="ml-1 text-xs font-medium text-zinc-400">コイン</span>
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-3">
          <div>
            <p className="text-[11px] text-zinc-500">スタミナ</p>
            <p className="mt-1 flex items-center gap-2">
              <span className="text-lg font-bold tracking-[0.2em] text-[#FF9600] leading-none">
                {formatStaminaDots(staminaValue)}
              </span>
              <span className="text-sm font-bold tabular-nums text-zinc-700">
                {staminaValue}/{OFFICE_MAX_STAMINA}
              </span>
            </p>
          </div>
          {remain != null ? (
            <p className="text-[12px] font-semibold tabular-nums text-zinc-600">
              次の回復まで {formatRemainMmSs(remain)}
            </p>
          ) : (
            <p className="text-[12px] font-medium text-zinc-400">満タン</p>
          )}
        </div>
      </div>
    </section>
  );
}
