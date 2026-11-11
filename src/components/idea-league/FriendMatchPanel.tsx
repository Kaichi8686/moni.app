"use client";

import { useEffect, useMemo, useState } from "react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { leagueCardClass } from "@/components/idea-league/LeagueShell";
import {
  createFriendRoom,
  finishFriendRound,
  getActiveFriendRoom,
  joinFriendRoom,
  leaveFriendRoom,
  rankedFriendMembers,
  startFriendRound,
  submitFriendIdea,
  type FriendMatchRoom,
} from "@/lib/idea-league/friendMatchStore";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Me = { userId: string; displayName: string };

type Props = {
  me: Me;
};

export function FriendMatchPanel({ me }: Props) {
  const { locale, tx } = useI18n();
  const [roomName, setRoomName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [room, setRoom] = useState<FriendMatchRoom | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [appeal, setAppeal] = useState("");

  useEffect(() => {
    const active = getActiveFriendRoom(me.userId);
    setRoom(active);
    const mine = active?.members.find((m) => m.userId === me.userId)?.submission;
    if (mine) {
      setTitle(mine.title);
      setContent(mine.content);
      setAppeal(mine.appeal ?? "");
    }
  }, [me.userId]);

  const ranked = useMemo(() => (room ? rankedFriendMembers(room) : []), [room]);
  const meMember = room?.members.find((m) => m.userId === me.userId) ?? null;
  const canControl =
    Boolean(room) && (room!.hostUserId === me.userId || room!.members.length === 1);

  function mapError(code: string) {
    if (code === "ROOM_NAME_REQUIRED") return tx("ルーム名を入力してください", "Enter a room name");
    if (code === "CODE_INVALID") return tx("招待コードが短すぎます", "Invite code is too short");
    if (code === "ROOM_NOT_FOUND") return tx("ルームが見つかりません", "Room not found");
    if (code === "ROOM_FULL") return tx("ルームが満員です（8人まで）", "Room is full (max 8)");
    if (code === "HOST_ONLY") return tx("ホストだけが操作できます", "Only the host can do that");
    if (code === "IDEA_REQUIRED") return tx("タイトルと内容を入力してください", "Enter title and idea");
    if (code === "NOT_PLAYING") return tx("試合を開始してから提出できます", "Start the match first");
    if (code === "NOT_IN_ROOM") return tx("ルームに参加していません", "You are not in this room");
    return tx("うまくいきませんでした", "Something went wrong");
  }

  function handleCreate() {
    setBusy(true);
    setErr("");
    try {
      const next = createFriendRoom({
        userId: me.userId,
        displayName: me.displayName,
        name: roomName,
      });
      setRoom(next);
      setRoomName("");
      setTitle("");
      setContent("");
      setAppeal("");
    } catch (e) {
      setErr(mapError(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  }

  function handleJoin() {
    setBusy(true);
    setErr("");
    try {
      const next = joinFriendRoom({
        userId: me.userId,
        displayName: me.displayName,
        code: inviteCode,
      });
      setRoom(next);
      setInviteCode("");
    } catch (e) {
      setErr(mapError(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setErr(tx("コピーに失敗しました", "Could not copy"));
    }
  }

  function handleLeave() {
    leaveFriendRoom(me.userId);
    setRoom(null);
    setErr("");
    setTitle("");
    setContent("");
    setAppeal("");
  }

  function run(action: () => FriendMatchRoom) {
    setBusy(true);
    setErr("");
    try {
      setRoom(action());
    } catch (e) {
      setErr(mapError(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  }

  if (room) {
    const statusLabel =
      room.status === "lobby"
        ? tx("待機中", "Lobby")
        : room.status === "playing"
          ? tx("試合中", "Playing")
          : tx("結果", "Results");

    return (
      <div className="space-y-3">
        <section className="rounded-2xl border border-zinc-200 bg-white">
          <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-zinc-500">
                {tx("ルーム", "Room")} · R{room.round}
              </p>
              <h2 className="mt-1 truncate text-xl font-bold tracking-tight text-zinc-900">{room.name}</h2>
            </div>
            <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-600">
              {statusLabel}
            </span>
          </div>

          <div className="px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-lg font-bold tracking-[0.22em] text-zinc-900">
                {room.code}
              </p>
              <button
                type="button"
                onClick={() => void copyCode()}
                className="min-h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                {copied ? tx("コピー済", "Copied") : tx("コードをコピー", "Copy code")}
              </button>
            </div>

            <ul className="mt-4 space-y-1.5">
              {ranked.map((m, idx) => (
                <li
                  key={m.userId}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${
                    m.userId === me.userId ? "bg-zinc-100" : "bg-zinc-50"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900">
                      <span className="mr-2 tabular-nums text-zinc-400">#{idx + 1}</span>
                      {m.displayName}
                      {m.isHost ? (
                        <span className="ml-1.5 text-[10px] font-semibold text-zinc-500">
                          {tx("ホスト", "Host")}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {m.submission
                        ? tx("提出済み", "Submitted")
                        : tx("未提出", "Not submitted")}
                    </p>
                  </div>
                  <p className="text-base font-bold tabular-nums text-zinc-900">
                    {m.score}
                    <span className="ml-0.5 text-xs font-medium text-zinc-400">pt</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {(room.status === "lobby" || room.status === "results") && canControl ? (
          <section className={leagueCardClass}>
            <h3 className="text-sm font-bold text-zinc-900">
              {room.status === "results"
                ? tx("次のラウンドへ", "Next round")
                : tx("試合を始める", "Start match")}
            </h3>
            <p className="mt-1 text-[13px] text-zinc-500">
              {tx(
                "お題が出て、アイデア提出 → AI採点で勝ち点が入ります。1人でも遊べます。",
                "A prompt appears — submit ideas, AI scores points. Solo works too.",
              )}
            </p>
            <div className="mt-3">
              <DuoButton
                type="button"
                tone="orange"
                size="lg"
                fullWidth
                disabled={busy}
                onClick={() => run(() => startFriendRound({ userId: me.userId, roomId: room.id }))}
              >
                {room.status === "results"
                  ? tx("次のお題で再開", "Start next prompt")
                  : tx("お題を出して開始", "Deal prompt & start")}
              </DuoButton>
            </div>
          </section>
        ) : null}

        {room.status === "lobby" && !canControl ? (
          <p className={`${leagueCardClass} text-center text-sm text-zinc-500`}>
            {tx("ホストの試合開始を待っています…", "Waiting for the host to start…")}
          </p>
        ) : null}

        {(room.status === "playing" || room.status === "results") && room.promptTitle ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
            <p className="text-[11px] font-medium text-zinc-500">
              {tx("お題", "Prompt")}
            </p>
            <h3 className="mt-1 text-base font-bold text-zinc-900">{room.promptTitle}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{room.promptBody}</p>
          </section>
        ) : null}

        {room.status === "playing" ? (
          <section className={`space-y-3 ${leagueCardClass}`}>
            <h3 className="text-sm font-bold text-zinc-900">
              {meMember?.submission
                ? tx("アイデアを更新して再採点", "Update idea & re-score")
                : tx("アイデアを提出して勝ち点ゲット", "Submit idea for points")}
            </h3>
            <label className="block">
              <span className="text-xs font-medium text-zinc-600">{tx("タイトル", "Title")}</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 40))}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-3 text-sm outline-none focus:border-zinc-400 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-600">{tx("アイデア", "Idea")}</span>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-3 text-sm outline-none focus:border-zinc-400 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-600">
                {tx("ひとこと（任意）", "Pitch (optional)")}
              </span>
              <input
                value={appeal}
                onChange={(e) => setAppeal(e.target.value.slice(0, 140))}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-3 text-sm outline-none focus:border-zinc-400 focus:bg-white"
              />
            </label>
            <DuoButton
              type="button"
              tone="orange"
              size="lg"
              fullWidth
              disabled={busy}
              onClick={() =>
                run(() =>
                  submitFriendIdea({
                    userId: me.userId,
                    roomId: room.id,
                    title,
                    content,
                    appeal,
                  }),
                )
              }
            >
              {meMember?.submission
                ? tx("再提出して採点", "Resubmit & score")
                : tx("提出してAI採点", "Submit for AI score")}
            </DuoButton>
            {canControl ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => finishFriendRound({ userId: me.userId, roomId: room.id }))}
                className="w-full rounded-xl border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
              >
                {tx("結果を締める", "Close round")}
              </button>
            ) : null}
          </section>
        ) : null}

        {meMember?.submission ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium text-zinc-500">
                  {tx("あなたの採点", "Your score")}
                </p>
                <h3 className="mt-1 text-base font-bold text-zinc-900">{meMember.submission.title}</h3>
              </div>
              <p className="text-3xl font-bold tabular-nums text-zinc-900">
                {meMember.submission.review.score}
                <span className="ml-1 text-sm font-medium text-zinc-500">pt</span>
              </p>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-700">
              {locale === "en"
                ? meMember.submission.review.commentEn
                : meMember.submission.review.commentJa}
            </p>
          </section>
        ) : null}

        {err ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-center text-[13px] font-medium text-rose-700">
            {err}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleLeave}
          className="w-full rounded-xl border border-zinc-200 bg-white py-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
        >
          {tx("ルームを退出", "Leave room")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <CrossedSwordsIcon />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900">
              {tx("フレンドマッチ", "Friend Match")}
            </h2>
            <p className="text-[13px] text-zinc-500">
              {tx("作ってすぐ提出・AI採点まで遊べる", "Create, submit, and score right away")}
            </p>
          </div>
        </div>
      </section>

      <section className={leagueCardClass}>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
            <PlusIcon />
          </span>
          <h3 className="text-sm font-bold text-zinc-900">{tx("ルームを作成", "Create room")}</h3>
        </div>
        <input
          value={roomName}
          onChange={(e) => setRoomName(e.target.value.slice(0, 40))}
          placeholder={tx("ルーム名", "Room name")}
          className="mt-3 w-full rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-3 text-sm outline-none transition focus:border-zinc-400 focus:bg-white"
        />
        <div className="mt-3">
          <DuoButton
            type="button"
            tone="orange"
            size="lg"
            fullWidth
            disabled={busy || !roomName.trim()}
            onClick={handleCreate}
          >
            {tx("作成する", "Create")}
          </DuoButton>
        </div>
      </section>

      <section className={leagueCardClass}>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
            <KeyIcon />
          </span>
          <h3 className="text-sm font-bold text-zinc-900">{tx("コードで参加", "Join with code")}</h3>
        </div>
        <input
          value={inviteCode}
          onChange={(e) =>
            setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))
          }
          placeholder="ABC123"
          className="mt-3 w-full rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-3 font-mono text-sm tracking-[0.2em] outline-none transition focus:border-zinc-400 focus:bg-white"
        />
        <div className="mt-3">
          <DuoButton
            type="button"
            tone="orange"
            size="lg"
            fullWidth
            disabled={busy || inviteCode.trim().length < 4}
            onClick={handleJoin}
          >
            {tx("参加する", "Join")}
          </DuoButton>
        </div>
      </section>

      {err ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-center text-[13px] font-medium text-rose-700">
          {err}
        </p>
      ) : null}
    </div>
  );
}

function CrossedSwordsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 4l6.5 6.5M14 14l6 6M20 4l-6.5 6.5M10 14l-6 6M9.5 9.5L7 20M14.5 9.5L17 20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="8" cy="14" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M11 12.5l7.5-7.5M16 5.5l2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
