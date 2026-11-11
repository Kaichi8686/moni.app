"use client";

import { motion } from "framer-motion";
import { LeagueTierBadge } from "@/components/idea-league/LeagueTierBadge";
import { PROMOTION_SLOTS } from "@/lib/idea-league/tiers";
import type { LeagueMember, LeagueTier } from "@/lib/idea-league/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  members: LeagueMember[];
  tier: LeagueTier;
  promotionCutoff?: number;
  title?: string;
};

export function LeagueRankingBoard({
  members,
  tier,
  promotionCutoff = PROMOTION_SLOTS,
  title,
}: Props) {
  const { tx } = useI18n();
  const groupSize = Math.max(members.length, 1);
  const stayRank = Math.min(
    groupSize,
    Math.max(promotionCutoff + 1, Math.ceil(groupSize * 0.66)),
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-zinc-500">
            {title ?? tx("今週の順位表", "This week's board")}
          </p>
          <div className="mt-1">
            <LeagueTierBadge tier={tier} size="sm" flat />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            TOP {promotionCutoff} {tx("昇格", "promote")}
          </span>
          <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
            {tx("残留", "Stay")}
          </span>
        </div>
      </div>

      <ul className="divide-y divide-zinc-100">
        {members.map((m, idx) => {
          const inPromo = m.rank <= promotionCutoff;
          const inRisk = m.rank > stayRank;
          const nextIsOutOfPromo =
            members[idx + 1] && members[idx + 1]!.rank === promotionCutoff + 1;
          const nextIsRisk = members[idx + 1] && members[idx + 1]!.rank === stayRank + 1;

          return (
            <li key={m.id}>
              <motion.div
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.03, 0.35) }}
                className={`flex items-center gap-3 px-3 py-2.5 sm:px-4 ${
                  m.isMe
                    ? "bg-orange-50/90"
                    : inPromo
                      ? "bg-emerald-50/60"
                      : inRisk
                        ? "bg-zinc-50"
                        : "bg-white"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    m.rank === 1
                      ? "bg-amber-100 text-amber-900"
                      : m.rank === 2
                        ? "bg-zinc-100 text-zinc-700"
                        : m.rank === 3
                          ? "bg-orange-100 text-orange-900"
                          : "bg-zinc-50 text-zinc-500"
                  }`}
                >
                  {m.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900">
                    {m.displayName}
                    {m.isMe ? (
                      <span className="ml-1.5 text-[11px] font-medium text-[#FF9600]">
                        {tx("あなた", "You")}
                      </span>
                    ) : null}
                    {m.highlighted ? (
                      <span className="ml-1.5 rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                        {tx("注目", "Featured")}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {m.voteScore} {tx("票", "votes")}
                    {inPromo
                      ? ` · ${tx("昇格ゾーン", "Promotion")}`
                      : inRisk
                        ? ` · ${tx("下位", "Lower")}`
                        : ` · ${tx("残留", "Stay")}`}
                  </p>
                </div>
                {inPromo ? (
                  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    ↑
                  </span>
                ) : null}
              </motion.div>
              {nextIsOutOfPromo ? (
                <ZoneDivider
                  label={tx("昇格ライン — ここより上が次リーグへ", "Promotion line — above advances")}
                  tone="promote"
                />
              ) : null}
              {nextIsRisk ? (
                <ZoneDivider
                  label={tx("維持ライン — ここより下は下位ゾーン", "Stay line — below is lower zone")}
                  tone="stay"
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ZoneDivider({ label, tone }: { label: string; tone: "promote" | "stay" }) {
  const styles =
    tone === "promote"
      ? "border-emerald-100 bg-emerald-50/80 text-emerald-800"
      : "border-zinc-200 bg-zinc-50 text-zinc-600";
  const line = tone === "promote" ? "bg-emerald-200" : "bg-zinc-200";
  return (
    <div className={`flex items-center gap-2 border-y px-4 py-1.5 text-[11px] font-semibold ${styles}`}>
      <span className={`h-px flex-1 ${line}`} aria-hidden />
      {label}
      <span className={`h-px flex-1 ${line}`} aria-hidden />
    </div>
  );
}
