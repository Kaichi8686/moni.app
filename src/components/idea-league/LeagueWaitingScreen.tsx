"use client";

import { useState } from "react";
import { FriendMatchPanel } from "@/components/idea-league/FriendMatchPanel";
import { LeagueIncentivesPanel } from "@/components/idea-league/LeagueIncentivesPanel";
import { LeagueModeTabs, type LeaguePlayMode } from "@/components/idea-league/LeagueModeTabs";
import { LeaguePromptComposer } from "@/components/idea-league/LeaguePromptComposer";
import { LeagueRankingBoard } from "@/components/idea-league/LeagueRankingBoard";
import { LeagueShell, leagueCardClass } from "@/components/idea-league/LeagueShell";
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
  const [playMode, setPlayMode] = useState<LeaguePlayMode>("league");

  return (
    <LeagueShell
      sidebar={
        playMode === "league" ? (
          <LeagueStatusCard
            tier={profile.tier}
            countdownTarget={sched.nextBoundary}
            countdownLabel={tx("次の提出まで", "Until next submit")}
            members={publishedBattle?.members}
            promotionCutoff={publishedBattle?.promotionCutoff}
            idleHint={!publishedBattle}
            countdownActive={countdownActive}
          />
        ) : (
          <section className={leagueCardClass}>
            <p className="text-[11px] font-medium tracking-wide text-zinc-500">
              {tx("フレンドマッチ", "Friend Match")}
            </p>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-zinc-900">
              {tx("カスタムルーム", "Custom room")}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              {tx(
                "友達同士の勝ち点バトル用。ルーム作成・招待コード参加の枠組みです。",
                "Private point battles — create a room or join with a code.",
              )}
            </p>
          </section>
        )
      }
    >
      <LeagueModeTabs mode={playMode} onChange={setPlayMode} />

      {playMode === "friend" ? (
        <FriendMatchPanel />
      ) : (
        <>
          <div className={leagueCardClass}>
            <h2 className="text-sm font-bold text-zinc-900">{tx("開催ルール", "How it works")}</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-600">
              <li>・{tx("花を開いて得た種からお題を書く", "Write the prompt from flower seeds")}</li>
              <li>・{tx("土曜11時〜日曜11時：提出", "Sat 11–Sun 11: submit")}</li>
              <li>
                ・
                {tx(
                  "日曜11時〜：AI審査で勝ち点 / 水曜11時：結果公表",
                  "Sun 11+: AI points / Wed 11: results",
                )}
              </li>
              <li>
                ・
                {tx(
                  "初期フェーズはユーザー投票ではなくAI/運営判定",
                  "Early phase: AI / ops review, not peer votes",
                )}
              </li>
            </ul>
          </div>

          <div className="grid gap-4 xl:grid-cols-2 xl:gap-5">
            <LeaguePromptComposer
              userId={userId}
              currentTitle={currentPrompt?.title}
              currentBody={currentPrompt?.body}
              onOpenGarden={onOpenGarden}
              onSave={onSavePrompt}
            />
            <LeagueIncentivesPanel currentTier={profile.tier} promotions={profile.promotions} />
          </div>

          {publishedBattle ? (
            <LeagueRankingBoard
              members={publishedBattle.members}
              tier={publishedBattle.tier}
              title={tx("先週の結果", "Last week's results")}
            />
          ) : (
            <section className={leagueCardClass}>
              <h2 className="text-sm font-bold text-zinc-900">{tx("過去の結果", "Past results")}</h2>
              {profile.history.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">
                  {tx("まだ公表済みの結果がありません。", "No published results yet.")}
                </p>
              ) : (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {profile.history.slice(0, 6).map((h) => (
                    <li
                      key={`${h.weekKey}-${h.endedAt}`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-900">{h.promptTitle}</p>
                        <p className="text-[11px] text-zinc-500">
                          {h.weekKey} · {h.tier}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums text-zinc-900">#{h.rank ?? "—"}</p>
                        <p
                          className={`text-[11px] font-medium ${
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
        </>
      )}
    </LeagueShell>
  );
}
