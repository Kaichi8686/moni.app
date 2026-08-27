"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, Lock, LockOpen, Plus, Trash2, VenetianMask } from "lucide-react";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { IdeaForm } from "@/components/projects/idea-voting/IdeaForm";
import { IdeaList } from "@/components/projects/idea-voting/IdeaList";
import { IdeaVotingSettingsPanel } from "@/components/projects/idea-voting/IdeaVotingSettingsPanel";
import { voteBtnGhost, voteBtnPrimary, voteCard, voteChip, voteChipActive, voteInput } from "@/components/projects/idea-voting/voteUi";
import { supabase } from "@/lib/supabase";
import {
  createIdea,
  createVoteEvent,
  deleteIdea,
  deleteVoteEvent,
  fetchEvents,
  fetchIdeas,
  fetchVotes,
  ideaVotingRealtimeTable,
  LEGACY_EVENT_ID,
  resolveIdeaVotingBackend,
  setMyVote,
  updateVoteEvent,
  type IdeaVoteEventWithCount,
  type IdeaVoteRow,
} from "@/lib/projects/ideaVoting/ideaVotingApi";
import {
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

function localDatetimeToIso(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function WorkspaceIdeaVoting() {
  const { tx, locale } = useI18n();
  const { projectId, project, loading, uid, isOwner } = useProjectWorkspace();
  const [events, setEvents] = useState<IdeaVoteEventWithCount[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<ProjectIdea[]>([]);
  const [votes, setVotes] = useState<IdeaVoteRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const selected = events.find((e) => e.id === selectedId) ?? null;
  const closed = selected ? isVoteEventClosed(selected) : false;

  const posterName = useMemo(() => {
    if (!uid || !project?.members) return undefined;
    return project.members.find((m) => m.id === uid)?.name;
  }, [uid, project?.members]);

  const refreshEvents = useCallback(async () => {
    if (!projectId || !supabase) return;
    const list = await fetchEvents(projectId);
    setEvents(list);
    return list;
  }, [projectId]);

  const refreshSelected = useCallback(async () => {
    if (!projectId || !supabase || !selectedId) {
      setIdeas([]);
      setVotes([]);
      return;
    }
    const [i, v] = await Promise.all([fetchIdeas(projectId, selectedId), fetchVotes(projectId)]);
    setIdeas(i);
    setVotes(v);
  }, [projectId, selectedId]);

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
  }, [refreshEvents]);

  useEffect(() => {
    void (async () => {
      try {
        await refreshSelected();
      } catch (e) {
        setError(e instanceof Error ? e.message : tx("読み込みに失敗しました", "Couldn’t load"));
      }
    })();
  }, [refreshSelected]);

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

    const poll = window.setInterval(() => void refresh(), 8000);
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

  const winner = useMemo(() => {
    if (!closed || ideasWithTally.length === 0) return null;
    return [...ideasWithTally].sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt))[0];
  }, [closed, ideasWithTally]);

  const canManageEvent = Boolean(
    selected && uid && (isOwner || selected.createdBy === uid || selected.id === LEGACY_EVENT_ID && isOwner),
  );

  async function handleCreateEvent(input: {
    title: string;
    description: string;
    closesAt: string;
    anonymous: boolean;
  }) {
    if (!uid) return;
    setBusy(true);
    try {
      const created = await createVoteEvent(projectId, uid, {
        title: input.title,
        description: input.description,
        closesAt: localDatetimeToIso(input.closesAt),
        anonymous: input.anonymous,
      });
      await refreshEvents();
      setSelectedId(created.id);
      setCreateOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("作成に失敗しました", "Couldn’t create"));
    } finally {
      setBusy(false);
    }
  }

  async function handlePost(text: string) {
    if (!uid || !selected || closed) return;
    setBusy(true);
    try {
      const created = await createIdea(
        projectId,
        uid,
        text,
        selected.anonymous ? null : posterName ?? tx("メンバー", "Member"),
        selected.id,
      );
      setIdeas((prev) => [created, ...prev.filter((i) => i.id !== created.id)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("投稿に失敗しました", "Couldn’t post"));
    } finally {
      setBusy(false);
    }
  }

  function applyMyVoteLocal(ideaId: string, nextCount: number) {
    if (!uid) return;
    setVotes((prev) => {
      const without = prev.filter((v) => !(v.ideaId === ideaId && v.userId === uid));
      if (nextCount <= 0) return without;
      return [...without, { ideaId, userId: uid, count: nextCount }];
    });
  }

  async function changeMyVote(ideaId: string, nextCount: number) {
    if (!uid) return;
    const prevCount = tallies.mine.get(ideaId) ?? 0;
    applyMyVoteLocal(ideaId, nextCount);
    try {
      await setMyVote(projectId, ideaId, uid, nextCount);
    } catch (e) {
      applyMyVoteLocal(ideaId, prevCount);
      setError(e instanceof Error ? e.message : tx("投票に失敗しました", "Couldn’t vote"));
    }
  }

  function handleVote(ideaId: string) {
    if (!selected || closed) return;
    const current = tallies.mine.get(ideaId) ?? 0;
    if (votesRemaining <= 0 || current >= selected.maxVotesPerIdea) return;
    void changeMyVote(ideaId, current + 1);
  }

  function handleUnvote(ideaId: string) {
    if (closed) return;
    const current = tallies.mine.get(ideaId) ?? 0;
    if (current <= 0) return;
    void changeMyVote(ideaId, current - 1);
  }

  async function handleDelete(ideaId: string) {
    const idea = ideas.find((i) => i.id === ideaId);
    const canDelete = Boolean(uid) && (isOwner || idea?.authorId === uid);
    if (!canDelete) return;
    if (typeof window !== "undefined" && !window.confirm(tx("この選択肢を削除しますか？", "Delete this option?"))) return;
    setIdeas((prev) => prev.filter((i) => i.id !== ideaId));
    setVotes((prev) => prev.filter((v) => v.ideaId !== ideaId));
    try {
      await deleteIdea(ideaId);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("削除に失敗しました", "Couldn’t delete"));
      void refresh();
    }
  }

  async function persistEvent(patch: Parameters<typeof updateVoteEvent>[1]) {
    if (!selected) return;
    try {
      await updateVoteEvent(selected, patch);
      await refreshEvents();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("設定の保存に失敗しました", "Couldn’t save settings"));
      void refresh();
    }
  }

  async function handleDeleteEvent() {
    if (!selected || selected.id === LEGACY_EVENT_ID) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(tx(`「${selected.title}」を削除しますか？選択肢も消えます。`, `Delete “${selected.title}”? Options will be removed too.`))
    )
      return;
    try {
      await deleteVoteEvent(selected);
      setSelectedId(null);
      await refreshEvents();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("削除に失敗しました", "Couldn’t delete"));
    }
  }

  if (loading || !hydrated) {
    return <p className="text-sm text-[#6B7280]">{tx("読み込み中…", "Loading…")}</p>;
  }

  if (!selected) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <header className="flex items-end justify-between gap-3 border-b border-zinc-200 pb-3">
          <div>
            <h1 className="text-[17px] font-semibold tracking-tight text-zinc-900">{tx("投票", "Voting")}</h1>
            <p className="mt-0.5 text-[12px] text-zinc-500">
              {tx("テーマごとに作って、選択肢へ投票します。", "Create a topic, then vote on options.")}
            </p>
          </div>
          <button type="button" onClick={() => setCreateOpen((v) => !v)} className={voteBtnPrimary}>
            <Plus className="h-3.5 w-3.5" />
            {tx("投票を作る", "Create vote")}
          </button>
        </header>

        {error ? (
          <p className="border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-[12px] text-rose-800">{error}</p>
        ) : null}

        {createOpen ? (
          <VoteEventCreateForm busy={busy} onCancel={() => setCreateOpen(false)} onSubmit={handleCreateEvent} />
        ) : null}

        {events.length === 0 ? (
          <div className="border border-dashed border-zinc-300 px-3 py-4 text-[12px] text-zinc-500">
            {tx("まだありません。「投票を作る」から追加してください。", "None yet. Use “Create vote” to add one.")}
          </div>
        ) : (
          <ul className="space-y-1.5">
            {events.map((ev) => {
              const done = isVoteEventClosed(ev);
              return (
                <li key={ev.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(ev.id)}
                    className={`${voteCard} flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:border-zinc-400`}
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold tracking-tight text-zinc-900">{ev.title}</p>
                      {ev.description ? <p className="mt-0.5 truncate text-[12px] text-zinc-500">{ev.description}</p> : null}
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] text-zinc-400">
                        <span>{tx(`${ev.optionCount}件`, `${ev.optionCount}`)}</span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          {formatDeadline(ev.closesAt, locale)}
                        </span>
                        {ev.anonymous ? (
                          <span className="inline-flex items-center gap-1">
                            <VenetianMask className="h-3 w-3" />
                            {tx("匿名", "Anonymous")}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <span className={done ? voteChip : voteChipActive}>
                      {done ? tx("終了", "Closed") : tx("投票中", "Open")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <header className="border-b border-zinc-200 pb-3">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {tx("一覧", "All votes")}
        </button>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-[17px] font-semibold tracking-tight text-zinc-900">{selected.title}</h1>
            {selected.description ? <p className="mt-0.5 text-[12px] text-zinc-500">{selected.description}</p> : null}
            <p className="mt-1 text-[11px] text-zinc-400">
              {formatDeadline(selected.closesAt, locale)}
              {selected.anonymous ? tx(" · 匿名", " · Anonymous") : ""}
              {tx(` · 1人${selected.votesPerPerson}票`, ` · ${selected.votesPerPerson} votes each`)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={closed ? voteChip : voteChipActive}>
              {closed
                ? tx("締切済み", "Closed")
                : tx(`残り ${votesRemaining}/${selected.votesPerPerson}`, `${votesRemaining}/${selected.votesPerPerson} left`)}
            </span>
            {canManageEvent ? (
              <button type="button" onClick={() => void persistEvent({ closed: !selected.closed })} className={voteBtnGhost}>
                {closed ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                {closed ? tx("再開", "Reopen") : tx("締切", "Close")}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {closed && winner ? (
        <div className={`${voteCard} border-zinc-900 px-3 py-2`}>
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{tx("最多得票", "Top vote")}</p>
          <p className="text-[13px] font-semibold tracking-tight text-zinc-900">{winner.text}</p>
          <p className="text-[11px] text-zinc-500">{tx(`${winner.votes}票`, `${winner.votes} votes`)}</p>
        </div>
      ) : (
        <p className="border-l-2 border-zinc-900 pl-2 text-[11px] leading-relaxed text-zinc-500">
          {tx("投票中は票数順に並べません。結果は締切後に表示します。", "Options aren’t ranked while voting is open. Results show after close.")}
        </p>
      )}

      {canManageEvent ? (
        <div className="space-y-1.5">
          <IdeaVotingSettingsPanel
            settings={settingsForList}
            onSave={(next) => void persistEvent({ votesPerPerson: next.votesPerPerson, maxVotesPerIdea: next.maxVotesPerIdea })}
          />
          <div className={`${voteCard} flex items-center justify-between gap-2 px-3 py-2`}>
            <p className="text-[12px] text-zinc-500">
              {selected.anonymous ? tx("誰が入れたかは見えません", "Voters stay hidden") : tx("投稿者名を表示", "Show author names")}
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={selected.anonymous}
              onClick={() => void persistEvent({ anonymous: !selected.anonymous })}
              className={selected.anonymous ? voteChipActive : voteChip}
            >
              <VenetianMask className="h-3 w-3" />
              {selected.anonymous ? tx("匿名オン", "Anonymous on") : tx("匿名オフ", "Anonymous off")}
            </button>
          </div>
          {selected.id !== LEGACY_EVENT_ID ? (
            <button
              type="button"
              onClick={() => void handleDeleteEvent()}
              className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-rose-600"
            >
              <Trash2 className="h-3 w-3" />
              {tx("この投票を削除", "Delete this vote")}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-[11px] text-zinc-500">
          {tx(
            `1人${selected.votesPerPerson}票 · 1案最大${selected.maxVotesPerIdea}票`,
            `${selected.votesPerPerson} votes each · max ${selected.maxVotesPerIdea} per option`,
          )}
          {selected.anonymous ? tx(" · 匿名", " · Anonymous") : ""}
        </p>
      )}

      {error ? <p className="border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-[12px] text-rose-800">{error}</p> : null}

      <IdeaForm
        disabled={closed || busy}
        anonymousMode={selected.anonymous}
        posterName={posterName}
        heading={selected.anonymous ? tx("選択肢を追加（匿名）", "Add option (anonymous)") : tx("選択肢を追加", "Add option")}
        placeholder={tx("例: A案 / 体育館でやる / 予算3万円以内…", "e.g. Plan A / gym / under $200…")}
        submitLabel={tx("追加", "Add")}
        onSubmit={handlePost}
      />

      <section className="space-y-1.5">
        <h2 className="text-[12px] font-medium text-zinc-500">
          {tx(`選択肢 ${ideas.length}`, `Options ${ideas.length}`)}
          {closed ? tx(" · 票数順", " · by votes") : ""}
        </h2>
        <IdeaList
          ideas={ideasWithTally}
          votingSettings={settingsForList}
          votingClosed={closed}
          sortByVotes={closed}
          hideTallies={!closed}
          votesRemaining={votesRemaining}
          currentUid={uid}
          isOwner={isOwner}
          onVote={handleVote}
          onUnvote={handleUnvote}
          onDelete={handleDelete}
        />
      </section>
    </div>
  );
}

function VoteEventCreateForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: { title: string; description: string; closesAt: string; anonymous: boolean }) => void;
}) {
  const { tx } = useI18n();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [anonymous, setAnonymous] = useState(true);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    onSubmit({ title, description, closesAt, anonymous });
  }

  return (
    <form onSubmit={handleSubmit} className={`${voteCard} space-y-2 p-3`}>
      <p className="text-[13px] font-semibold tracking-tight text-zinc-900">{tx("新しい投票", "New vote")}</p>
      <input
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={tx("何を決める？（例: 文化祭の出し物）", "What are you deciding? (e.g. festival booth)")}
        className={voteInput}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder={tx("説明（任意）", "Description (optional)")}
        className={`${voteInput} resize-y`}
      />
      <label className="block">
        <span className="text-[11px] text-zinc-500">{tx("締切", "Deadline")}</span>
        <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className={`${voteInput} mt-0.5`} />
      </label>
      <label className="flex items-center gap-2 text-[12px] text-zinc-700">
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="rounded-[2px] border-zinc-400" />
        {tx("匿名投票", "Anonymous voting")}
      </label>
      <div className="flex justify-end gap-1.5">
        <button type="button" onClick={onCancel} className={voteBtnGhost}>
          {tx("キャンセル", "Cancel")}
        </button>
        <button type="submit" disabled={busy || !title.trim()} className={voteBtnPrimary}>
          {busy ? tx("作成中…", "Creating…") : tx("作成", "Create")}
        </button>
      </div>
    </form>
  );
}
