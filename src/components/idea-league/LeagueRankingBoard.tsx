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
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          TOP {promotionCutoff} {tx("昇格", "promote")}
        </div>
      </div>

      <ul className="divide-y divide-zinc-100">
        {members.map((m, idx) => {
          const inZone = m.rank <= promotionCutoff;
          const nextIsOut = members[idx + 1] && members[idx + 1]!.rank === promotionCutoff + 1;
          return (
            <li key={m.id}>
              <motion.div
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.03, 0.35) }}
                className={`flex items-center gap-3 px-3 py-2.5 sm:px-4 ${
                  m.isMe ? "bg-orange-50/80" : inZone ? "bg-emerald-50/50" : "bg-white"
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
                      <span className="ml-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                        {tx("注目", "Featured")}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {m.voteScore} {tx("票", "votes")}
                    {inZone ? ` · ${tx("昇格ゾーン", "Promotion zone")}` : ""}
                  </p>
                </div>
                {inZone ? (
                  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    ↑
                  </span>
                ) : null}
              </motion.div>
              {nextIsOut ? (
                <div className="flex items-center gap-2 border-y border-emerald-100 bg-emerald-50/80 px-4 py-1.5 text-[11px] font-semibold text-emerald-800">
                  <span className="h-px flex-1 bg-emerald-200" aria-hidden />
                  {tx("昇格ライン — ここより上が次リーグへ", "Promotion line — above advances")}
                  <span className="h-px flex-1 bg-emerald-200" aria-hidden />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
