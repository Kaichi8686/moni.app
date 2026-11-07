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
    <div className="overflow-hidden rounded-3xl bg-white shadow-[0_10px_0_rgba(24,24,27,0.08)] ring-1 ring-zinc-200/80">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 bg-gradient-to-r from-[#FFF7ED] to-[#EEF2FF] px-4 py-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">
            {title ?? tx("今週の順位表", "This week's board")}
          </p>
          <div className="mt-1">
            <LeagueTierBadge tier={tier} size="sm" />
          </div>
        </div>
        <div className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold text-emerald-800">
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
                  m.isMe ? "bg-[#FFF4E5]" : inZone ? "bg-emerald-50/70" : "bg-white"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                    m.rank === 1
                      ? "bg-amber-300 text-amber-950"
                      : m.rank === 2
                        ? "bg-zinc-200 text-zinc-800"
                        : m.rank === 3
                          ? "bg-orange-200 text-orange-950"
                          : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {m.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-zinc-900">
                    {m.displayName}
                    {m.isMe ? (
                      <span className="ml-1.5 text-[11px] font-bold text-[#FF9600]">
                        {tx("あなた", "You")}
                      </span>
                    ) : null}
                    {m.highlighted ? (
                      <span className="ml-1.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                        {tx("注目", "Featured")}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[11px] font-semibold text-zinc-500">
                    {m.voteScore} {tx("票", "votes")}
                    {inZone ? ` · ${tx("昇格ゾーン", "Promotion zone")}` : ""}
                  </p>
                </div>
                {inZone ? (
                  <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                    ↑
                  </span>
                ) : null}
              </motion.div>
              {nextIsOut ? (
                <div className="relative flex items-center gap-2 bg-emerald-600 px-4 py-1.5 text-[11px] font-extrabold text-white">
                  <span className="h-px flex-1 bg-white/40" aria-hidden />
                  {tx("昇格ライン — ここより上が次リーグへ", "Promotion line — above advances")}
                  <span className="h-px flex-1 bg-white/40" aria-hidden />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
