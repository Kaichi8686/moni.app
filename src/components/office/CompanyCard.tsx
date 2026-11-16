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
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      <div className="md:grid md:grid-cols-[minmax(0,1.45fr)_minmax(240px,0.9fr)] md:items-stretch">
        <div className="bg-[#FFF7ED] p-2 sm:p-2.5 md:h-full md:min-h-[200px]">
          <OfficeScene level={company.level} industry={company.industry} fx={sceneFx} />
        </div>

        <div className="flex flex-col p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-zinc-500">
                {meta.crown} {meta.labelJa}
                {ind ? ` · ${ind.icon}` : ""}
              </p>
              <h2 className="mt-0.5 truncate text-lg font-bold tracking-tight text-zinc-900">
                {company.name}
              </h2>
              {aboutLine ? (
                <p
                  className="mt-0.5 truncate text-[11px] leading-tight text-zinc-400"
                  title={aboutLine}
                >
                  {aboutLine}
                </p>
              ) : null}
            </div>
            <div className="shrink-0 rounded-xl bg-amber-50 px-2 py-1 text-center">
              <p className="text-[10px] font-bold text-amber-800/80">Lv</p>
              <p className="text-base font-black tabular-nums text-amber-900">{company.level}</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3">
            <div>
              <p className="text-[10px] text-zinc-500">累計売上</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-zinc-900 sm:text-lg">
                {company.totalRevenue.toLocaleString("ja-JP")}
                <span className="ml-0.5 text-[10px] font-medium text-zinc-400">コイン</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500">今月の売上</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-zinc-900 sm:text-lg">
                {seasonRevenue.toLocaleString("ja-JP")}
                <span className="ml-0.5 text-[10px] font-medium text-zinc-400">コイン</span>
              </p>
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between gap-2 rounded-xl bg-zinc-50 px-2.5 py-2.5 mt-3">
            <div>
              <p className="text-[10px] text-zinc-500">スタミナ</p>
              <p className="mt-0.5 flex items-center gap-1.5">
                <span className="text-base font-bold tracking-[0.18em] text-[#FF9600] leading-none">
                  {formatStaminaDots(staminaValue)}
                </span>
                <span className="text-xs font-bold tabular-nums text-zinc-700">
                  {staminaValue}/{OFFICE_MAX_STAMINA}
                </span>
              </p>
            </div>
            {remain != null ? (
              <p className="text-[11px] font-semibold tabular-nums text-zinc-600">
                次まで {formatRemainMmSs(remain)}
              </p>
            ) : (
              <p className="text-[11px] font-medium text-zinc-400">満タン</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
