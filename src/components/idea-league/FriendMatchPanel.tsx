"use client";

import { useEffect, useState } from "react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { leagueCardClass } from "@/components/idea-league/LeagueShell";
import {
  createFriendRoom,
  getActiveFriendRoom,
  joinFriendRoom,
  leaveFriendRoom,
  type FriendMatchRoom,
} from "@/lib/idea-league/friendMatchStore";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Me = { userId: string; displayName: string };

type Props = {
  me: Me;
};

export function FriendMatchPanel({ me }: Props) {
  const { tx } = useI18n();
  const [roomName, setRoomName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [room, setRoom] = useState<FriendMatchRoom | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRoom(getActiveFriendRoom(me.userId));
  }, [me.userId]);

  function mapError(code: string) {
    if (code === "ROOM_NAME_REQUIRED") return tx("ルーム名を入力してください", "Enter a room name");
    if (code === "CODE_INVALID") return tx("招待コードが短すぎます", "Invite code is too short");
    if (code === "ROOM_NOT_FOUND") return tx("ルームが見つかりません", "Room not found");
    if (code === "ROOM_FULL") return tx("ルームが満員です（8人まで）", "Room is full (max 8)");
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
  }

  if (room) {
    return (
      <div className="space-y-4">
        <section className="overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50 via-white to-sky-50">
          <div className="border-b border-teal-100/80 px-4 py-3 sm:px-5">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-teal-700/80 uppercase">
              {tx("ルーム", "Room")}
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">{room.name}</h2>
          </div>

          <div className="px-4 py-5 sm:px-5">
            <p className="text-[11px] font-medium text-zinc-500">{tx("招待コード", "Invite code")}</p>
            <div className="mt-2 flex items-center gap-2">
              <p className="rounded-xl border border-teal-200 bg-white px-4 py-3 font-mono text-2xl font-bold tracking-[0.28em] text-teal-900">
                {room.code}
              </p>
              <button
                type="button"
                onClick={() => void copyCode()}
                className="min-h-12 rounded-xl border border-teal-200 bg-teal-600 px-4 text-sm font-semibold text-white transition hover:bg-teal-700"
              >
                {copied ? tx("コピー済", "Copied") : tx("コピー", "Copy")}
              </button>
            </div>

            <ul className="mt-5 space-y-2">
              {room.members.map((m) => (
                <li
                  key={m.userId}
                  className="flex items-center justify-between rounded-xl border border-white/80 bg-white/70 px-3 py-2.5"
                >
                  <span className="truncate text-sm font-semibold text-zinc-900">
                    {m.displayName}
                    {m.userId === me.userId ? (
                      <span className="ml-1.5 text-[11px] font-medium text-teal-700">
                        {tx("あなた", "You")}
                      </span>
                    ) : null}
                  </span>
                  {m.isHost ? (
                    <span className="rounded-md bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-800">
                      {tx("ホスト", "Host")}
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-zinc-400">
                      {tx("参加者", "Member")}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <p className="mt-4 text-[12px] text-zinc-500">
              {tx(
                `${room.members.length} / 8 人 · コードを共有して招待`,
                `${room.members.length} / 8 · share the code to invite`,
              )}
            </p>

            <button
              type="button"
              onClick={handleLeave}
              className="mt-4 w-full rounded-xl border border-zinc-200 bg-white py-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
            >
              {tx("ルームを退出", "Leave room")}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-teal-200/70 bg-gradient-to-br from-[#F2FBFA] via-white to-[#EEF6FF] p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white">
            <CrossedSwordsIcon />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900">
              {tx("フレンドマッチ", "Friend Match")}
            </h2>
            <p className="text-[13px] text-zinc-500">{tx("友達と小さなルームで対戦", "Private rooms with friends")}</p>
          </div>
        </div>
      </section>

      <section className={`${leagueCardClass} !border-teal-100`}>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
            <PlusIcon />
          </span>
          <h3 className="text-sm font-bold text-zinc-900">{tx("ルームを作成", "Create room")}</h3>
        </div>
        <input
          value={roomName}
          onChange={(e) => setRoomName(e.target.value.slice(0, 40))}
          placeholder={tx("ルーム名", "Room name")}
          className="mt-3 w-full rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-3 text-sm outline-none transition focus:border-teal-400 focus:bg-white"
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
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
            <KeyIcon />
          </span>
          <h3 className="text-sm font-bold text-zinc-900">{tx("コードで参加", "Join with code")}</h3>
        </div>
        <input
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
          placeholder="ABC123"
          className="mt-3 w-full rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-3 font-mono text-sm tracking-[0.2em] outline-none transition focus:border-sky-400 focus:bg-white"
        />
        <div className="mt-3">
          <DuoButton
            type="button"
            tone="sky"
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
      <path d="M11 12.5l7.5-7.5M16 5.5l2.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
