"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { IdeaList } from "@/components/projects/idea-voting/IdeaList";
import { voteAppleBtn, voteCard, voteChip, voteChipActive } from "@/components/projects/idea-voting/voteUi";
import { supabase } from "@/lib/supabase";
import {
  fetchEvents,
  fetchIdeas,
  fetchVotes,
  ideaVotingRealtimeTable,
  resolveIdeaVotingBackend,
  setMyVote,
  updateVoteEvent,
  type IdeaVoteEventWithCount,
  type IdeaVoteRow,
} from "@/lib/projects/ideaVoting/ideaVotingApi";
import {
  isUnlimitedVotes,
  isVoteEventClosed,
  type IdeaVotingSettings,
  type IdeaWithTally,
  type ProjectIdea,
} from "@/lib/projects/ideaVoting/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

function formatDeadline(iso: string | null, locale: "ja" | "en"): string {
  if (!iso) return locale === "en" ? "No deadline" : "締切なし";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return locale === "en" ? "No deadline" : "締切なし";
  return d.toLocaleString(locale === "en" ? "en-US" : "ja-JP", {
    month: locale === "en" ? "short" : "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 投票詳細のみ。一覧・ルール変更はメッセージのカード側に移した。 */
export default function WorkspaceIdeaVoting() {
  const { tx, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventParam = searchParams.get("event")?.trim() || null;
  const { projectId, loading, uid } = useProjectWorkspace();
  const [events, setEvents] = useState<IdeaVoteEventWithCount[]>([]);
  const [ideas, setIdeas] = useState<ProjectIdea[]>([]);
  const [votes, setVotes] = useState<IdeaVoteRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  /** ユーザーがチェックを動かしたら true。サーバー票で上書きしない */
  const [selectionDirty, setSelectionDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);

  const messagesHref = `/messages?project=${encodeURIComponent(projectId)}`;
  const selected = eventParam ? (events.find((e) => e.id === eventParam) ?? null) : null;
  const closed = selected ? isVoteEventClosed(selected) : false;

  const refreshEvents = useCallback(async () => {
    if (!projectId || !supabase) return [];
    const list = await fetchEvents(projectId);
    setEvents(list);
    return list;
  }, [projectId]);

  const refreshSelected = useCallback(async () => {
    if (!projectId || !supabase || !eventParam) {
      setIdeas([]);
      setVotes([]);
      return;
    }
    const [i, v] = await Promise.all([fetchIdeas(projectId, eventParam), fetchVotes(projectId)]);
    setIdeas(i);
    setVotes(v);
  }, [projectId, eventParam]);

  const refresh = useCallback(async () => {
    if (!projectId || !supabase) return;
    try {
      await refreshEvents();
      await refreshSelected();
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("読み込みに失敗しました", "Couldn’t load"));
    }
  }, [projectId, refreshEvents, refreshSelected, tx]);

  useEffect(() => {
    if (!loading && projectId && !eventParam) {
      router.replace(messagesHref);
    }
  }, [loading, projectId, eventParam, router, messagesHref]);

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    void (async () => {
      try {
        await refreshEvents();
        setError("");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : tx("読み込みに失敗しました", "Couldn’t load"));
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshEvents, tx]);

  useEffect(() => {
    void (async () => {
      try {
        await refreshSelected();
      } catch (e) {
        setError(e instanceof Error ? e.message : tx("読み込みに失敗しました", "Couldn’t load"));
      }
    })();
  }, [refreshSelected, tx]);

  useEffect(() => {
    setSelectedIds(new Set());
    setSelectionDirty(false);
  }, [eventParam]);

  useEffect(() => {
    if (!projectId || !supabase) return;
    const client = supabase;
    let cancelled = false;
    let channel: ReturnType<typeof client.channel> | null = null;

    void (async () => {
      const backend = await resolveIdeaVotingBackend();
      if (cancelled) return;
      const table = ideaVotingRealtimeTable(backend);
      channel = client
        .channel(`idea-vote-${projectId}`)
        .on("postgres_changes", { event: "*", schema: "public", table, filter: `project_id=eq.${projectId}` }, () => void refresh());
      if (backend === "tables") {
        channel = channel
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "project_idea_votes", filter: `project_id=eq.${projectId}` },
            () => void refresh(),
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "project_idea_events", filter: `project_id=eq.${projectId}` },
            () => void refresh(),
          );
      }
      channel.subscribe();
    })();

    const poll = window.setInterval(() => void refresh(), 20000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      if (channel) void client.removeChannel(channel);
    };
  }, [projectId, refresh]);

  const ideaIds = useMemo(() => new Set(ideas.map((i) => i.id)), [ideas]);

  const tallies = useMemo(() => {
    const total = new Map<string, number>();
    const voters = new Map<string, number>();
    const mine = new Map<string, number>();
    for (const v of votes) {
      if (v.count <= 0 || !ideaIds.has(v.ideaId)) continue;
      total.set(v.ideaId, (total.get(v.ideaId) ?? 0) + v.count);
      voters.set(v.ideaId, (voters.get(v.ideaId) ?? 0) + 1);
      if (uid && v.userId === uid) mine.set(v.ideaId, v.count);
    }
    return { total, voters, mine };
  }, [votes, uid, ideaIds]);

  const ideasWithTally = useMemo<IdeaWithTally[]>(
    () =>
      ideas.map((idea) => ({
        ...idea,
        authorName: selected?.anonymous ? undefined : idea.authorName,
        votes: tallies.total.get(idea.id) ?? 0,
        voters: tallies.voters.get(idea.id) ?? 0,
        myVotes: tallies.mine.get(idea.id) ?? 0,
      })),
    [ideas, tallies, selected?.anonymous],
  );

  const votesUsed = useMemo(() => {
    let sum = 0;
    for (const n of tallies.mine.values()) sum += n;
    return sum;
  }, [tallies.mine]);
  const votesRemaining = selected ? Math.max(0, selected.votesPerPerson - votesUsed) : 0;

  const settingsForList: IdeaVotingSettings = {
    votesPerPerson: selected?.votesPerPerson ?? 1,
    maxVotesPerIdea: selected?.maxVotesPerIdea ?? 1,
  };

  const hideUntilClose = Boolean(selected?.hideResultsUntilClose);
  const iHaveVoted = votesUsed > 0;
  const showResults = closed || (!hideUntilClose && iHaveVoted);
  const resultBarMax = useMemo(() => {
    if (!showResults || ideasWithTally.length === 0) return 1;
    return Math.max(1, ...ideasWithTally.map((idea) => idea.votes));
  }, [showResults, ideasWithTally]);

  const winner = useMemo(() => {
    if (!closed || ideasWithTally.length === 0) return null;
    return [...ideasWithTally].sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt))[0];
  }, [closed, ideasWithTally]);

  const maxSelectable = selected
    ? isUnlimitedVotes(selected.votesPerPerson)
      ? Math.max(ideas.length, 1)
      : selected.votesPerPerson
    : 1;
  const singleSelect = maxSelectable <= 1;

  /** いまの票とチェック選択の差分（変更・新規とも） */
  const voteDiffs = useMemo(() => {
    const diffs: Array<{ ideaId: string; prev: number; next: number }> = [];
    const ids = new Set<string>([...ideaIds, ...selectedIds]);
    for (const ideaId of ids) {
      const prev = tallies.mine.get(ideaId) ?? 0;
      const next = selectedIds.has(ideaId) ? 1 : 0;
      if (prev !== next) diffs.push({ ideaId, prev, next });
    }
    return diffs;
  }, [ideaIds, selectedIds, tallies.mine]);

  const canSubmitVote =
    !closed && !submitting && selectedIds.size <= maxSelectable && voteDiffs.length > 0;

  /** 期限なし投票は作成者だけ手動で締め切れる */
  const canCloseManually = Boolean(
    selected && !closed && !selected.closesAt && uid && selected.createdBy === uid,
  );

  // サーバー票をチェックに反映（ユーザーが触るまでは追従）
  useEffect(() => {
    if (closed || selectionDirty) return;
    const next = new Set<string>();
    for (const [id, n] of tallies.mine) {
      if (n > 0 && ideaIds.has(id)) next.add(id);
    }
    setSelectedIds(next);
  }, [closed, selectionDirty, tallies.mine, ideaIds]);

  function applyMyVoteLocal(ideaId: string, nextCount: number) {
    if (!uid) return;
    setVotes((prev) => {
      const without = prev.filter((v) => !(v.ideaId === ideaId && v.userId === uid));
      if (nextCount <= 0) return without;
      return [...without, { ideaId, userId: uid, count: nextCount }];
    });
  }

  function handleToggleSelect(ideaId: string) {
    if (!selected || closed) return;
    setSelectionDirty(true);
    setSelectedIds((prev) => {
      // 選択中の候補をもう一度押したらチェックを外す
      if (prev.has(ideaId)) {
        const next = new Set(prev);
        next.delete(ideaId);
        return next;
      }
      // 1人1票: 押した候補へチェックが移る（ラジオ）
      if (singleSelect) {
        return new Set([ideaId]);
      }
      const next = new Set(prev);
      if (next.size >= maxSelectable) {
        // 上限いっぱいなら、先に入っている1つを外して付け替え
        const first = next.values().next().value;
        if (first) next.delete(first);
      }
      next.add(ideaId);
      return next;
    });
  }

  async function handleSubmitVotes() {
    if (!uid || !selected || !canSubmitVote) return;
    setSubmitting(true);
    setError("");
    const rollback = voteDiffs.map((d) => ({ ideaId: d.ideaId, prev: d.prev }));
    try {
      for (const { ideaId, next } of voteDiffs) {
        applyMyVoteLocal(ideaId, next);
        await setMyVote(projectId, ideaId, uid, next);
      }
      setSelectionDirty(false);
    } catch (e) {
      for (const item of rollback) applyMyVoteLocal(item.ideaId, item.prev);
      setError(e instanceof Error ? e.message : tx("投票に失敗しました", "Couldn’t vote"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCloseVote() {
    if (!selected || !canCloseManually || closing) return;
    const ok = window.confirm(
      tx(
        "本当にこの投票を締め切りますか？締切後は投票できなくなり、結果が表示されます。",
        "Really close this vote? Voting will stop and results will be shown.",
      ),
    );
    if (!ok) return;
    setClosing(true);
    setError("");
    try {
      await updateVoteEvent(selected, { closed: true });
      setEvents((prev) => prev.map((ev) => (ev.id === selected.id ? { ...ev, closed: true } : ev)));
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("締め切りに失敗しました", "Couldn’t close the vote"));
    } finally {
      setClosing(false);
    }
  }

  if (loading || !hydrated) {
    return <p className="text-sm text-[#6B7280]">{tx("読み込み中…", "Loading…")}</p>;
  }

  if (!eventParam) {
    return <p className="text-sm text-[#6B7280]">{tx("メッセージへ戻っています…", "Returning to messages…")}</p>;
  }

  const backButton = (
    <button
      type="button"
      onClick={() => router.push(messagesHref)}
      className="fixed left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-800 shadow-sm transition hover:bg-zinc-50 active:scale-95"
      aria-label={tx("戻る", "Back")}
    >
      <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
    </button>
  );

  if (!selected) {
    return (
      <div className="relative mx-auto max-w-2xl space-y-3 pt-12">
        {backButton}
        <p className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
          {error || tx("この投票は見つかりません。", "This vote wasn’t found.")}
        </p>
      </div>
    );
  }

  const tipText = closed
    ? null
    : hideUntilClose
      ? tx(
          "右のチェックで選んで投票できます。締切まで票の付け替えもできます。結果は締切後に表示します。",
          "Check an option to vote. You can change it until close. Results show after close.",
        )
      : iHaveVoted
        ? tx(
            "別の候補を押すとチェックが移ります。下のボタンで票を更新できます。",
            "Tap another option to move the check, then update your vote below.",
          )
        : tx("右のチェックで選んで、下の「投票する」を押してください。", "Check options on the right, then tap Vote below.");

  return (
    <div
      className={`relative mx-auto max-w-2xl space-y-3 pt-12 ${
        canCloseManually
          ? "pb-[calc(7.25rem+env(safe-area-inset-bottom,0px))]"
          : "pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))]"
      }`}
    >
      {backButton}
      <header className="border-b border-zinc-200 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-[17px] font-semibold tracking-tight text-zinc-900">{selected.title}</h1>
            {selected.description ? <p className="mt-0.5 text-[12px] text-zinc-500">{selected.description}</p> : null}
            <p className="mt-1 text-[11px] text-zinc-400">
              {formatDeadline(selected.closesAt, locale)}
              {selected.anonymous ? tx(" · 匿名", " · Anonymous") : ""}
              {isUnlimitedVotes(selected.votesPerPerson)
                ? tx(" · 複数投票可", " · Multiple votes")
                : tx(` · 1人${selected.votesPerPerson}票`, ` · ${selected.votesPerPerson} votes each`)}
              {hideUntilClose ? tx(" · 結果は締切後", " · Results after close") : ""}
            </p>
          </div>
          <span className={closed ? voteChip : voteChipActive}>
            {closed
              ? tx("締切済み", "Closed")
              : isUnlimitedVotes(selected.votesPerPerson)
                ? tx("何票でも可", "Unlimited")
                : tx(`残り ${votesRemaining}/${selected.votesPerPerson}`, `${votesRemaining}/${selected.votesPerPerson} left`)}
          </span>
        </div>
      </header>

      {closed && winner && showResults ? (
        <div className={`${voteCard} rounded-2xl border-zinc-900 px-3 py-2`}>
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{tx("最多得票", "Top vote")}</p>
          <p className="text-[13px] font-semibold tracking-tight text-zinc-900">{winner.text}</p>
          <p className="text-[11px] text-zinc-500">{tx(`${winner.votes}票`, `${winner.votes} votes`)}</p>
        </div>
      ) : tipText ? (
        <p className="border-l-2 border-zinc-900 pl-2 text-[11px] leading-relaxed text-zinc-500">{tipText}</p>
      ) : null}

      <p className="text-[11px] text-zinc-500">
        {isUnlimitedVotes(selected.votesPerPerson)
          ? tx("1人あたり何票でも投票できます", "Each person can cast as many votes as they want")
          : tx(
              `1人${selected.votesPerPerson}票 · 1案最大${selected.maxVotesPerIdea}票`,
              `${selected.votesPerPerson} votes each · max ${selected.maxVotesPerIdea} per option`,
            )}
        {selected.anonymous ? tx(" · 匿名", " · Anonymous") : ""}
      </p>

      {error ? <p className="rounded-2xl border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-[12px] text-rose-800">{error}</p> : null}

      <section className="space-y-1.5">
        <h2 className="text-[12px] font-medium text-zinc-500">
          {tx(`選択肢 ${ideas.length}`, `Options ${ideas.length}`)}
          {closed && showResults ? tx(" · 票数順", " · by votes") : ""}
        </h2>
        <IdeaList
          ideas={ideasWithTally}
          votingSettings={settingsForList}
          votingClosed={closed}
          sortByVotes={closed && showResults}
          showResults={showResults}
          resultBarMax={resultBarMax}
          selectMode={!closed}
          selectedIds={selectedIds}
          allowChangeVote
          votesRemaining={votesRemaining}
          currentUid={uid}
          isOwner={false}
          voteOnly
          onToggleSelect={handleToggleSelect}
          onDelete={() => undefined}
        />
      </section>

      {!closed ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-100 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm">
          <div className="mx-auto flex max-w-lg flex-col items-stretch gap-1.5">
            {canCloseManually ? (
              <button
                type="button"
                disabled={closing || submitting}
                onClick={() => void handleCloseVote()}
                className="mx-auto px-2 py-1 text-[12px] font-medium text-zinc-500 underline-offset-2 transition hover:text-zinc-800 hover:underline disabled:opacity-50"
              >
                {closing ? tx("締め切り中…", "Closing…") : tx("締め切り", "Close vote")}
              </button>
            ) : null}
            <button
              type="button"
              disabled={!canSubmitVote || closing}
              onClick={() => void handleSubmitVotes()}
              className={voteAppleBtn}
            >
              {submitting
                ? iHaveVoted
                  ? tx("更新中…", "Updating…")
                  : tx("投票中…", "Voting…")
                : iHaveVoted && selectedIds.size === 0
                  ? tx("票を取り消す", "Clear vote")
                  : iHaveVoted
                    ? tx("票を変更する", "Change vote")
                    : selectedIds.size > 1
                      ? tx(`投票する（${selectedIds.size}）`, `Vote (${selectedIds.size})`)
                      : tx("投票する", "Vote")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
