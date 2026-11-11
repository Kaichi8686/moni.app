"use client";

import { useState } from "react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { leagueCardClass } from "@/components/idea-league/LeagueShell";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function FriendMatchPanel() {
  const { tx } = useI18n();
  const [inviteCode, setInviteCode] = useState("");
  const [roomName, setRoomName] = useState("");
  const [notice, setNotice] = useState("");

  function stub(action: "create" | "join") {
    setNotice(
      action === "create"
        ? tx(
            "カスタムルームは準備中です。まもなく友達と勝ち点バトルができます。",
            "Custom rooms are coming soon — friend point battles are on the way.",
          )
        : tx(
            "招待コード参加は準備中です。コードを控えておいてください。",
            "Invite codes are coming soon. Keep your code handy.",
          ),
    );
  }

  return (
    <div className="space-y-4">
      <section className={leagueCardClass}>
        <p className="text-[11px] font-medium tracking-wide text-zinc-500">
          {tx("フレンドマッチ", "Friend Match")}
        </p>
        <h2 className="mt-1.5 text-lg font-bold tracking-tight text-zinc-900">
          {tx("友達と勝ち点バトル", "Point battles with friends")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          {tx(
            "リーグ戦とは別に、招待コードで小さなルームを作れます。初期フェーズでは枠組みのみ公開しています。",
            "Separate from league play — spin up a small room with an invite code. Scaffold only for now.",
          )}
        </p>
      </section>

      <section className={leagueCardClass}>
        <h3 className="text-sm font-bold text-zinc-900">
          {tx("➕ カスタムルームを作成", "➕ Create a custom room")}
        </h3>
        <p className="mt-1 text-[13px] text-zinc-500">
          {tx("ルーム名を決めて、友達を招待します。", "Name a room and invite friends.")}
        </p>
        <label className="mt-3 block">
          <span className="text-xs font-medium text-zinc-600">{tx("ルーム名", "Room name")}</span>
          <input
            value={roomName}
            onChange={(e) => setRoomName(e.target.value.slice(0, 40))}
            placeholder={tx("例: 週末アイデア部", "e.g. Weekend Idea Club")}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-400"
          />
        </label>
        <div className="mt-3">
          <DuoButton type="button" tone="orange" size="lg" fullWidth onClick={() => stub("create")}>
            {tx("ルームを作成する", "Create room")}
          </DuoButton>
        </div>
      </section>

      <section className={leagueCardClass}>
        <h3 className="text-sm font-bold text-zinc-900">
          {tx("🔑 招待コードで参加", "🔑 Join with invite code")}
        </h3>
        <p className="mt-1 text-[13px] text-zinc-500">
          {tx("友達から共有されたコードを入力します。", "Enter the code your friend shared.")}
        </p>
        <label className="mt-3 block">
          <span className="text-xs font-medium text-zinc-600">{tx("招待コード", "Invite code")}</span>
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase().slice(0, 8))}
            placeholder="ABCD1234"
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 font-mono text-sm tracking-widest outline-none focus:border-zinc-400"
          />
        </label>
        <div className="mt-3">
          <DuoButton
            type="button"
            tone="peach"
            size="lg"
            fullWidth
            disabled={!inviteCode.trim()}
            onClick={() => stub("join")}
          >
            {tx("ルームに参加する", "Join room")}
          </DuoButton>
        </div>
      </section>

      {notice ? (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-center text-[13px] text-zinc-600">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
