"use client";

import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cellKey, type Pref, type ShiftBoard } from "@/lib/shift/types";

type PublicBoard = Omit<ShiftBoard, "adminKey">;

const PREF_LABEL: Record<Pref, string> = {
  prefer: "○",
  ok: "△",
  ng: "×",
};

export default function ShiftRespondPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;

  const [board, setBoard] = useState<PublicBoard | null>(null);
  const [responseCount, setResponseCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [prefs, setPrefs] = useState<Record<string, Pref>>({});
  const [preferredRoleIds, setPreferredRoleIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [responseId, setResponseId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/shift/${encodeURIComponent(code)}`);
        const data = await res.json();
        if (!res.ok || !data.ok) {
          if (!cancelled) setError(data.error || "読み込めませんでした");
          return;
        }
        if (cancelled) return;
        setBoard(data.board);
        setResponseCount(data.responseCount ?? 0);

        const storageKey = `shift-response:${code}`;
        const cached = localStorage.getItem(storageKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as {
              name?: string;
              prefs?: Record<string, Pref>;
              preferredRoleIds?: string[];
              note?: string;
              responseId?: string;
            };
            if (parsed.name) setName(parsed.name);
            if (parsed.prefs) setPrefs(parsed.prefs);
            if (parsed.preferredRoleIds) setPreferredRoleIds(parsed.preferredRoleIds);
            if (parsed.note) setNote(parsed.note);
            if (parsed.responseId) setResponseId(parsed.responseId);
          } catch {
            /* ignore */
          }
        } else {
          const initial: Record<string, Pref> = {};
          for (const day of data.board.days as PublicBoard["days"]) {
            for (const slot of data.board.slots as PublicBoard["slots"]) {
              initial[cellKey(day.id, slot.id)] = "ok";
            }
          }
          setPrefs(initial);
        }
      } catch {
        if (!cancelled) setError("通信に失敗しました");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const cells = useMemo(() => {
    if (!board) return [];
    return board.days.flatMap((day) =>
      board.slots.map((slot) => ({
        key: cellKey(day.id, slot.id),
        day,
        slot,
      })),
    );
  }, [board]);

  function setPref(key: string, pref: Pref) {
    setPrefs((prev) => ({ ...prev, [key]: pref }));
    setSaved(false);
  }

  function toggleRole(roleId: string) {
    setPreferredRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId],
    );
    setSaved(false);
  }

  async function onSubmit() {
    if (!board) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch(`/api/shift/${encodeURIComponent(code)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, prefs, preferredRoleIds, note, responseId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "保存に失敗しました");
        return;
      }
      setResponseId(data.response.id);
      localStorage.setItem(
        `shift-response:${code}`,
        JSON.stringify({
          name,
          prefs,
          preferredRoleIds,
          note,
          responseId: data.response.id,
        }),
      );
      setSaved(true);
      setResponseCount((n) => (responseId ? n : n + 1));
    } catch {
      setError("通信に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="shift-shell">
        <p className="shift-muted">読み込み中…</p>
      </main>
    );
  }

  if (!board) {
    return (
      <main className="shift-shell">
        <h1 className="shift-brand-mark">シフトメイキング</h1>
        <p className="shift-error">{error || "見つかりません"}</p>
      </main>
    );
  }

  return (
    <main className="shift-shell">
      <header className="shift-brand">
        <motion.p
          className="shift-muted"
          style={{ margin: 0, fontWeight: 700 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          シフトメイキング
        </motion.p>
        <motion.h1
          className="shift-brand-mark"
          style={{ fontSize: "clamp(1.8rem, 7vw, 2.6rem)" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {board.title}
        </motion.h1>
        {board.note ? <p className="shift-brand-sub">{board.note}</p> : null}
        <p className="shift-muted">{responseCount}人が回答済み</p>
      </header>

      <section className="shift-panel">
        <label className="shift-label" htmlFor="name">
          あなたの名前
        </label>
        <input
          id="name"
          className="shift-input"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          placeholder="例: たろう"
          autoComplete="name"
        />
      </section>

      <section className="shift-panel">
        <h2 className="shift-h2">希望を入れる</h2>
        <p className="shift-muted" style={{ marginTop: 0 }}>
          ○＝入りたい　△＝入れる　×＝無理
        </p>
        <div className="shift-pref-grid">
          {cells.map(({ key, day, slot }, index) => (
            <motion.div
              key={key}
              className="shift-pref-card"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.03, 0.3) }}
            >
              <h3>
                {day.label}
                {day.date ? `（${day.date}）` : ""} ／ {slot.label}
              </h3>
              <div className="shift-pref-btns">
                {(["prefer", "ok", "ng"] as Pref[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="shift-pref-btn"
                    data-active={prefs[key] === p ? p : undefined}
                    onClick={() => setPref(key, p)}
                  >
                    {PREF_LABEL[p]}
                  </button>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="shift-panel">
        <h2 className="shift-h2">やりたい役割（任意）</h2>
        <div className="shift-chip-row">
          {board.roles.map((role) => (
            <button
              key={role.id}
              type="button"
              className="shift-chip"
              data-on={preferredRoleIds.includes(role.id)}
              onClick={() => toggleRole(role.id)}
            >
              {role.name}
            </button>
          ))}
        </div>
        <div style={{ height: 12 }} />
        <label className="shift-label" htmlFor="note">
          一言メモ（任意）
        </label>
        <textarea
          id="note"
          className="shift-textarea"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setSaved(false);
          }}
          placeholder="例: 午前は部活で遅れるかも"
        />
      </section>

      {error ? <p className="shift-error">{error}</p> : null}
      {saved ? <p className="shift-success">保存しました。あとから同じ端末なら直せます。</p> : null}

      <div className="shift-actions">
        <button
          type="button"
          className="shift-btn shift-btn-primary"
          disabled={busy || !name.trim()}
          onClick={onSubmit}
        >
          {busy ? "送信中…" : saved ? "更新する" : "希望を送る"}
        </button>
      </div>
    </main>
  );
}
