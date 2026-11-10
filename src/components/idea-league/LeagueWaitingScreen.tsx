"use client";

import { LeagueIncentivesPanel } from "@/components/idea-league/LeagueIncentivesPanel";
import { LeaguePromptComposer } from "@/components/idea-league/LeaguePromptComposer";
import { LeagueRankingBoard } from "@/components/idea-league/LeagueRankingBoard";
import { LeagueStatusCard } from "@/components/idea-league/LeagueStatusCard";
import { scheduleFor } from "@/lib/idea-league/calendar";
import type { LeagueBattleState, LeagueProfileState } from "@/lib/idea-league/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  profile: LeagueProfileState;
  userId: string;
  currentPrompt?: { title: string; body: string };
  publishedBattle?: LeagueBattleState | null;
  onOpenGarden: () => void;
  onSavePrompt: (input: { plantId: string; title: string; body: string }) => Promise<void>;
  countdownActive?: boolean;
};

export function LeagueWaitingScreen({
  profile,
  userId,
  currentPrompt,
  publishedBattle,
  onOpenGarden,
  onSavePrompt,
  countdownActive = true,
}: Props) {
  const { tx } = useI18n();
  const sched = scheduleFor();

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pb-28 pt-4 sm:space-y-5">
      <LeagueStatusCard
        tier={profile.tier}
        countdownTarget={sched.nextBoundary}
        countdownLabel={tx("次の提出まで", "Until next submit")}
        members={publishedBattle?.members}
        promotionCutoff={publishedBattle?.promotionCutoff}
        idleHint={!publishedBattle}
        countdownActive={countdownActive}
      />

      <div className="rounded-[28px] bg-white/90 p-4 shadow-[0_8px_0_rgba(24,24,27,0.06)] ring-1 ring-zinc-200/80 sm:p-5">
        <h2 className="text-sm font-black text-zinc-900">{tx("開催ルール", "How it works")}</h2>
        <ul className="mt-2 space-y-1.5 text-sm font-medium text-zinc-600">
          <li>・{tx("花を開いて得た種からお題を書く", "Write the prompt from flower seeds")}</li>
          <li>・{tx("土曜11時〜日曜11時：提出（他者の解答は非公開）", "Sat 11–Sun 11: submit (peers hidden)")}</li>
          <li>・{tx("日曜11時〜：投票開始 / 水曜11時：結果公表", "Sun 11+: vote / Wed 11: results")}</li>
          <li>・{tx("結果公表までは先週の結果を表示", "Until publish, show last week’s results")}</li>
        </ul>
      </div>

      <LeaguePromptComposer
        userId={userId}
        currentTitle={currentPrompt?.title}
        currentBody={currentPrompt?.body}
        onOpenGarden={onOpenGarden}
        onSave={onSavePrompt}
      />

      <LeagueIncentivesPanel currentTier={profile.tier} promotions={profile.promotions} />

      {publishedBattle ? (
        <LeagueRankingBoard
          members={publishedBattle.members}
          tier={publishedBattle.tier}
          title={tx("先週の結果", "Last week's results")}
        />
      ) : (
        <section className="rounded-[28px] bg-white/90 p-4 shadow-[0_8px_0_rgba(24,24,27,0.06)] ring-1 ring-zinc-200/80 sm:p-5">
          <h2 className="text-sm font-black text-zinc-900">{tx("過去の結果", "Past results")}</h2>
          {profile.history.length === 0 ? (
            <p className="mt-2 text-sm font-medium text-zinc-500">
              {tx("まだ公表済みの結果がありません。", "No published results yet.")}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {profile.history.slice(0, 6).map((h) => (
                <li
                  key={`${h.weekKey}-${h.endedAt}`}
                  className="flex items-center justify-between gap-2 rounded-2xl bg-zinc-50 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-zinc-900">{h.promptTitle}</p>
                    <p className="text-[11px] font-semibold text-zinc-500">
                      {h.weekKey} · {h.tier}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black tabular-nums text-zinc-900">#{h.rank ?? "—"}</p>
                    <p
                      className={`text-[11px] font-bold ${
                        h.resultStatus === "promoted" ? "text-emerald-600" : "text-zinc-500"
                      }`}
                    >
                      {h.resultStatus === "promoted" ? tx("昇格", "Promoted") : tx("残留", "Stayed")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
