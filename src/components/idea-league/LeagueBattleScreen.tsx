"use client";

import { useMemo, useState } from "react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { LeagueCountdown } from "@/components/idea-league/LeagueCountdown";
import { LeagueRankingBoard } from "@/components/idea-league/LeagueRankingBoard";
import { LeagueTierBadge } from "@/components/idea-league/LeagueTierBadge";
import { saturdayWindow } from "@/lib/idea-league/calendar";
import { LEAGUE_TIER_META } from "@/lib/idea-league/tiers";
import type { LeagueBattleState } from "@/lib/idea-league/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  battle: LeagueBattleState;
  onSubmit: (input: { title: string; content: string; appeal?: string }) => Promise<void>;
  onVote: (submissionId: string) => Promise<void>;
};

export function LeagueBattleScreen({ battle, onSubmit, onVote }: Props) {
  const { locale, tx } = useI18n();
  const [tab, setTab] = useState<"board" | "prompt" | "vote">("board");
  const [title, setTitle] = useState(battle.mySubmission?.title ?? "");
  const [content, setContent] = useState(battle.mySubmission?.content ?? "");
  const [appeal, setAppeal] = useState(battle.mySubmission?.appeal ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const endsAt = useMemo(() => saturdayWindow(battle.week.weekKey).endsAt, [battle.week.weekKey]);
  const meta = LEAGUE_TIER_META[battle.tier];
  const specialSlots = meta.specialSlots;

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) {
      setErr(tx("タイトルと内容を入力してください", "Please enter a title and idea"));
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await onSubmit({ title: title.trim(), content: content.trim(), appeal: appeal.trim() || undefined });
      setTab("board");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleVote(id: string) {
    setBusy(true);
    setErr("");
    try {
      await onVote(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pb-28 pt-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF9600]">
            {tx("土曜バトル開催中", "Saturday battle live")}
          </p>
          <div className="mt-1">
            <LeagueTierBadge tier={battle.tier} size="sm" animated />
          </div>
        </div>
        <LeagueCountdown compact target={endsAt} label={tx("終了まで", "Ends in")} />
      </div>

      {specialSlots > 0 ? (
        <div
          className="rounded-2xl px-3 py-2.5 text-sm font-bold text-white"
          style={{ background: `linear-gradient(90deg, ${meta.accent}, #0f172a)` }}
        >
          {tx(
            `上位リーグ特典: 特別アイデア応募枠 ×${specialSlots} / ハイライト表示`,
            `League perk: special idea slots ×${specialSlots} + highlight`,
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white/80 p-1 shadow-sm ring-1 ring-zinc-200/70">
        {(
          [
            ["board", tx("順位表", "Board")],
            ["prompt", tx("お題・提出", "Prompt")],
            ["vote", tx("投票", "Vote")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`min-h-10 rounded-xl text-xs font-extrabold transition sm:text-sm ${
              tab === id ? "bg-[#FF9600] text-white shadow-[0_3px_0_#D97706]" : "text-zinc-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {err ? <p className="text-sm font-semibold text-rose-600">{err}</p> : null}

      {tab === "board" ? (
        <LeagueRankingBoard members={battle.members} tier={battle.tier} promotionCutoff={battle.promotionCutoff} />
      ) : null}

      {tab === "prompt" ? (
        <div className="space-y-3">
          <div className="rounded-3xl bg-white p-4 shadow-[0_8px_0_rgba(24,24,27,0.06)] ring-1 ring-zinc-200/80">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              {tx("今週の共通お題", "This week's shared prompt")}
            </p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-zinc-900">{battle.week.promptTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{battle.week.promptBody}</p>
          </div>
          <label className="block">
            <span className="text-xs font-bold text-zinc-600">{tx("タイトル", "Title")}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 40))}
              className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#FF9600]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-zinc-600">{tx("アイデア", "Idea")}</span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#FF9600]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-zinc-600">
              {tx("ひとことアピール（任意）", "Short pitch (optional)")}
            </span>
            <input
              value={appeal}
              onChange={(e) => setAppeal(e.target.value.slice(0, 140))}
              className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#FF9600]"
            />
          </label>
          <DuoButton type="button" tone="orange" size="lg" fullWidth disabled={busy} onClick={() => void handleSubmit()}>
            {battle.mySubmission
              ? tx("アイデアを更新する", "Update idea")
              : tx("アイデアを提出する", "Submit idea")}
          </DuoButton>
        </div>
      ) : null}

      {tab === "vote" ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-zinc-600">
            {tx(
              "自分以外のアイデアに1票だけ投票できます。票が多いほど順位が上がります。",
              "Cast one vote for someone else's idea. More votes = higher rank.",
            )}
          </p>
          {battle.submissions.filter((s) => !s.isMe).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/80 px-4 py-10 text-center text-sm font-semibold text-zinc-500">
              {tx("まだ投票できる提出がありません", "No peer submissions to vote on yet")}
            </div>
          ) : (
            battle.submissions
              .filter((s) => !s.isMe)
              .map((s) => (
                <article
                  key={s.id}
                  className={`rounded-3xl bg-white p-4 shadow-[0_6px_0_rgba(24,24,27,0.05)] ring-1 ${
                    s.votedByMe ? "ring-[#FF9600]" : "ring-zinc-200/80"
                  } ${s.highlighted ? "bg-gradient-to-br from-indigo-50 to-white" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-zinc-500">{s.authorName}</p>
                      <h3 className="text-base font-black text-zinc-900">{s.title}</h3>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-black tabular-nums text-zinc-700">
                      {s.voteCount}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">{s.content}</p>
                  {s.appeal ? (
                    <p className="mt-2 text-xs font-semibold text-indigo-700">
                      {locale === "en" ? "Pitch: " : "アピール: "}
                      {s.appeal}
                    </p>
                  ) : null}
                  <div className="mt-3">
                    <DuoButton
                      type="button"
                      tone={s.votedByMe ? "peach" : "orange"}
                      size="md"
                      fullWidth
                      disabled={busy}
                      onClick={() => void handleVote(s.id)}
                    >
                      {s.votedByMe
                        ? tx("投票済み", "Voted")
                        : tx("このアイデアに投票", "Vote for this idea")}
                    </DuoButton>
                  </div>
                </article>
              ))
          )}
        </div>
      ) : null}

      {battle.demo ? (
        <p className="text-center text-[11px] font-medium text-zinc-400">
          {tx("デモグループで動作中（DB未適用時）", "Running in demo group (DB not applied)")}
        </p>
      ) : null}
    </div>
  );
}
