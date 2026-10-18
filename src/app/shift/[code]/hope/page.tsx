"use client";

import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  cellKey,
  normalizeBoard,
  workSlotsForDay,
  type Pref,
  type ShiftBoard,
} from "@/lib/shift/types";

type PublicBoard = Omit<ShiftBoard, "adminKey">;

const PREF_LABEL: Record<Pref, string> = {
  prefer: "○",
  ok: "△",
  ng: "×",
};

const PREF_HINT: Record<Pref, string> = {
  prefer: "入りたい",
  ok: "入れる",
  ng: "無理",
};

export default function ShiftHopePage() {
  const params = useParams<{ code: string }>();
  const code = params.code;

  const [board, setBoard] = useState<PublicBoard | null>(null);
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
        const b = normalizeBoard(data.board as ShiftBoard);
        setBoard(b);

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
          for (const day of b.days) {
            for (const slot of workSlotsForDay(b, day.id)) {
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

  const workCells = useMemo(() => {
    if (!board) return [];
    return board.days.flatMap((day) =>
      workSlotsForDay(board, day.id).map((slot) => ({
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
        setError(data.error || "送信に失敗しました");
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
        <h1 className="shift-brand-mark">希望入力</h1>
        <p className="shift-error">{error || "シフト表が見つかりません"}</p>
      </main>
    );
  }

  return (
    <main className="shift-shell">
      <header className="shift-brand">
        <p className="shift-muted" style={{ margin: 0, fontWeight: 700 }}>
          希望をオーナーに送る
        </p>
        <motion.h1
          className="shift-brand-mark"
          style={{ fontSize: "clamp(1.8rem, 7vw, 2.6rem)" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {board.title}
        </motion.h1>
        <p className="shift-brand-sub">
          名前と ○△× を入れて送信すると、オーナーに届きます。
        </p>
      </header>

      {saved ? (
        <motion.section
          className="shift-panel"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="shift-h2">オーナーに届きました</h2>
          <p className="shift-success" style={{ marginTop: 0 }}>
            {name} さんの希望を送信しました。あとから同じ端末で直せます。
          </p>
          <div className="shift-actions">
            <button
              type="button"
              className="shift-btn shift-btn-ghost"
              onClick={() => setSaved(false)}
            >
              希望を直す
            </button>
          </div>
        </motion.section>
      ) : null}

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
        <h2 className="shift-h2">各時間帯の希望</h2>
        <p className="shift-muted" style={{ marginTop: 0 }}>
          <span style={{ color: "#166534", fontWeight: 800 }}>○緑＝入りたい</span>
          　
          <span style={{ color: "#854d0e", fontWeight: 800 }}>△黄＝入れる</span>
          　
          <span style={{ color: "#991b1b", fontWeight: 800 }}>×赤＝無理</span>
        </p>
        <div className="shift-pref-grid">
          {workCells.map(({ key, day, slot }, index) => (
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
                    aria-label={PREF_HINT[p]}
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

      <div className="shift-actions">
        <button
          type="button"
          className="shift-btn shift-btn-primary"
          disabled={busy || !name.trim()}
          onClick={() => void onSubmit()}
        >
          {busy ? "送信中…" : saved ? "もう一度送る" : "オーナーに希望を送る"}
        </button>
      </div>
    </main>
  );
}
