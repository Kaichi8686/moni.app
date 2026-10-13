"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FESTIVAL_SLOTS, SLOT_CAPACITY, type SlotId } from "@/lib/bunkasai/slots";
import { getOrCreateMemberToken } from "@/lib/bunkasai/token";
import type { BunkasaiSignup } from "@/lib/bunkasai/types";
import { supabase, supabaseEnabled } from "@/lib/supabase";

function isSlotFullError(message: string): boolean {
  return /SLOT_FULL|P0001|定員/i.test(message);
}

export default function BunkasaiShiftPage() {
  const [token, setToken] = useState("");
  const [rows, setRows] = useState<BunkasaiSignup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busySlot, setBusySlot] = useState<SlotId | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "error" | "muted"; text: string } | null>(
    null,
  );

  const mine = useMemo(
    () => rows.find((r) => r.member_token === token) ?? null,
    [rows, token],
  );

  const bySlot = useMemo(() => {
    const map: Record<SlotId, BunkasaiSignup[]> = {
      slot1: [],
      slot2: [],
      slot3: [],
      slot4: [],
    };
    for (const row of rows) {
      if (map[row.slot_id]) map[row.slot_id].push(row);
    }
    for (const id of Object.keys(map) as SlotId[]) {
      map[id].sort((a, b) => a.member_number - b.member_number);
    }
    return map;
  }, [rows]);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("bunkasai_signups")
      .select("id,slot_id,member_token,member_number,created_at,updated_at")
      .order("member_number", { ascending: true });
    if (error) {
      setStatus({
        tone: "error",
        text:
          error.message.includes("relation") || error.code === "42P01"
            ? "まだデータベースの準備ができていません。管理者にSQLの実行を頼んでください。"
            : `読み込みエラー: ${error.message}`,
      });
      return;
    }
    setRows((data ?? []) as BunkasaiSignup[]);
  }, []);

  useEffect(() => {
    setToken(getOrCreateMemberToken());
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!supabaseEnabled || !client) {
      setLoading(false);
      setStatus({
        tone: "error",
        text: "Supabaseの設定がありません。NEXT_PUBLIC_SUPABASE_URL と ANON_KEY を入れてください。",
      });
      return;
    }

    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();

    const channel = client
      .channel("bunkasai-signups-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bunkasai_signups" },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void client.removeChannel(channel);
    };
  }, [refresh]);

  async function joinSlot(slotId: SlotId) {
    if (!supabase || !token) return;
    setBusySlot(slotId);
    setStatus(null);
    try {
      if (mine) {
        if (mine.slot_id === slotId) return;
        if (bySlot[slotId].length >= SLOT_CAPACITY) {
          setStatus({ tone: "error", text: "この時間帯は満員です" });
          return;
        }
        const { error } = await supabase
          .from("bunkasai_signups")
          .update({ slot_id: slotId })
          .eq("member_token", token);
        if (error) {
          setStatus({
            tone: "error",
            text: isSlotFullError(error.message)
              ? "直前に満員になりました。別の時間帯を選んでください。"
              : error.message,
          });
          await refresh();
          return;
        }
        setStatus({ tone: "ok", text: "シフトを変更しました" });
      } else {
        if (bySlot[slotId].length >= SLOT_CAPACITY) {
          setStatus({ tone: "error", text: "この時間帯は満員です" });
          return;
        }
        const { error } = await supabase.from("bunkasai_signups").insert({
          slot_id: slotId,
          member_token: token,
        });
        if (error) {
          setStatus({
            tone: "error",
            text: isSlotFullError(error.message)
              ? "直前に満員になりました。別の時間帯を選んでください。"
              : error.message,
          });
          await refresh();
          return;
        }
        setStatus({ tone: "ok", text: "登録しました！あなたのシフトが上に表示されます" });
      }
      await refresh();
    } finally {
      setBusySlot(null);
    }
  }

  async function cancelMine() {
    if (!supabase || !token || !mine) return;
    setBusySlot(mine.slot_id);
    setStatus(null);
    try {
      const { error } = await supabase.from("bunkasai_signups").delete().eq("member_token", token);
      if (error) {
        setStatus({ tone: "error", text: error.message });
        return;
      }
      setStatus({ tone: "ok", text: "キャンセルしました。別の時間帯を選べます" });
      await refresh();
    } finally {
      setBusySlot(null);
    }
  }

  const mineSlot = mine ? FESTIVAL_SLOTS.find((s) => s.id === mine.slot_id) : null;

  return (
    <main className="bunkasai-shell">
      <header className="bunkasai-hero">
        <span className="bunkasai-kicker">クラス文化祭シフト</span>
        <h1 className="bunkasai-title">入りたい時間を選ぼう</h1>
        <p className="bunkasai-sub">
          ログイン不要。ボタンを押すだけ。1人1枠・各枠9人まで。みんなの画面にすぐ反映されます。
        </p>

        {mine && mineSlot ? (
          <div className="bunkasai-mine" aria-live="polite">
            <strong>
              あなたは {mineSlot.title}（{mineSlot.time}）
            </strong>
            <span>
              表示名: メンバー{mine.member_number}　・　変更やキャンセルも下のカードからできます
            </span>
          </div>
        ) : (
          !loading && (
            <div className="bunkasai-mine" style={{ background: "rgba(255,107,44,0.1)" }}>
              <strong>まだ未登録です</strong>
              <span>好きな時間帯の「このシフトに入る」を押してください</span>
            </div>
          )
        )}
      </header>

      {loading ? (
        <p className="bunkasai-status" data-tone="muted">
          読み込み中…
        </p>
      ) : (
        <section className="bunkasai-list" aria-label="シフト一覧">
          {FESTIVAL_SLOTS.map((slot) => {
            const members = bySlot[slot.id];
            const count = members.length;
            const full = count >= SLOT_CAPACITY;
            const isMine = mine?.slot_id === slot.id;
            const remaining = Math.max(0, SLOT_CAPACITY - count);

            return (
              <article
                key={slot.id}
                className="bunkasai-card"
                data-full={full && !isMine}
                data-mine={isMine}
              >
                <div className="bunkasai-card-top">
                  <div>
                    <h2 className="bunkasai-slot-title">{slot.title}</h2>
                    <p className="bunkasai-slot-time">{slot.time}</p>
                    <p className="bunkasai-slot-hint">{slot.hint}</p>
                  </div>
                  <div className="bunkasai-count" data-full={full}>
                    {full ? "満員" : `あと${remaining}`}
                    <small>
                      {count} / {SLOT_CAPACITY}人
                    </small>
                  </div>
                </div>

                {members.length > 0 ? (
                  <ul className="bunkasai-members">
                    {members.map((m) => (
                      <li key={m.id} data-me={m.member_token === token}>
                        メンバー{m.member_number}
                        {m.member_token === token ? "（あなた）" : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="bunkasai-empty">まだ誰も入っていません</p>
                )}

                <div className="bunkasai-actions">
                  {isMine ? (
                    <>
                      <button type="button" className="bunkasai-btn bunkasai-btn-primary" disabled>
                        あなたのシフト ✓
                      </button>
                      <button
                        type="button"
                        className="bunkasai-btn bunkasai-btn-danger"
                        disabled={busySlot !== null}
                        onClick={() => void cancelMine()}
                      >
                        {busySlot === slot.id ? "処理中…" : "キャンセルする"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="bunkasai-btn bunkasai-btn-primary"
                      disabled={full || busySlot !== null}
                      onClick={() => void joinSlot(slot.id)}
                    >
                      {busySlot === slot.id
                        ? "登録中…"
                        : full
                          ? "満員"
                          : mine
                            ? "このシフトに変更する"
                            : "このシフトに入る"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {status ? (
        <p className="bunkasai-status" data-tone={status.tone} role="status">
          {status.text}
        </p>
      ) : null}

      <p className="bunkasai-foot">
        この端末だけが「あなた」として記憶されます。
        <br />
        別のスマホでは別の人として扱われます。
      </p>
    </main>
  );
}
