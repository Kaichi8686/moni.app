"use client";

import { motion } from "framer-motion";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { formatAssignmentsForLine } from "@/lib/shift/assign";
import type {
  Pref,
  ShiftAssignmentResult,
  ShiftBoard,
  ShiftResponse,
} from "@/lib/shift/types";
import { cellKey } from "@/lib/shift/types";

const PREF_LABEL: Record<Pref, string> = {
  prefer: "○",
  ok: "△",
  ng: "×",
};

function AdminInner() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const code = params.code;
  const adminKey = search.get("key") ?? "";

  const [board, setBoard] = useState<ShiftBoard | null>(null);
  const [responses, setResponses] = useState<ShiftResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lineText, setLineText] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(
        `/api/shift/${encodeURIComponent(code)}?adminKey=${encodeURIComponent(adminKey)}`,
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "読み込めませんでした");
        setBoard(null);
        return;
      }
      if (!data.isAdmin) {
        setError("管理者キーが違います。作成時の管理用URLを開いてください。");
        setBoard(null);
        return;
      }
      setBoard(data.board);
      setResponses(data.responses);
      if (data.board.assignments) {
        setLineText(formatAssignmentsForLine(data.board, data.board.assignments));
      }
    } catch {
      setError("通信に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [adminKey, code]);

  useEffect(() => {
    void load();
  }, [load]);

  const assignments: ShiftAssignmentResult | null = board?.assignments ?? null;

  const dayMap = useMemo(() => new Map(board?.days.map((d) => [d.id, d]) ?? []), [board]);
  const slotMap = useMemo(() => new Map(board?.slots.map((s) => [s.id, s]) ?? []), [board]);
  const roleMap = useMemo(() => new Map(board?.roles.map((r) => [r.id, r]) ?? []), [board]);

  async function onAssign() {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const res = await fetch(`/api/shift/${encodeURIComponent(code)}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "割り振りに失敗しました");
        return;
      }
      setBoard((prev) => (prev ? { ...prev, assignments: data.assignments } : prev));
      setLineText(data.lineText ?? "");
    } catch {
      setError("通信に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function copyLine() {
    if (!lineText) return;
    try {
      await navigator.clipboard.writeText(lineText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("コピーできませんでした");
    }
  }

  function shareLine() {
    if (!lineText) return;
    window.open(
      `https://line.me/R/msg/text/?${encodeURIComponent(lineText)}`,
      "_blank",
      "noopener,noreferrer",
    );
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
        <h1 className="shift-brand-mark">管理画面</h1>
        <p className="shift-error">{error || "開けません"}</p>
      </main>
    );
  }

  const memberUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/shift/${board.code}`
      : `/shift/${board.code}`;

  return (
    <main className="shift-shell">
      <header className="shift-brand">
        <p className="shift-muted" style={{ margin: 0, fontWeight: 700 }}>
          管理者モード
        </p>
        <motion.h1
          className="shift-brand-mark"
          style={{ fontSize: "clamp(1.8rem, 7vw, 2.6rem)" }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {board.title}
        </motion.h1>
        <p className="shift-muted">回答 {responses.length} 人</p>
      </header>

      <section className="shift-panel">
        <h2 className="shift-h2">メンバー用リンク</h2>
        <div className="shift-link-box">{memberUrl}</div>
        <div className="shift-actions">
          <button
            type="button"
            className="shift-btn shift-btn-sun"
            onClick={() => {
              const text = [
                `【${board.title}】シフト希望を教えて！`,
                "",
                "○＝入りたい　△＝入れる　×＝無理",
                "",
                memberUrl,
              ].join("\n");
              window.open(
                `https://line.me/R/msg/text/?${encodeURIComponent(text)}`,
                "_blank",
                "noopener,noreferrer",
              );
            }}
          >
            LINEで再送
          </button>
          <button type="button" className="shift-btn shift-btn-ghost" onClick={() => void load()}>
            回答を更新
          </button>
        </div>
      </section>

      <section className="shift-panel">
        <h2 className="shift-h2">届いた希望</h2>
        {responses.length === 0 ? (
          <p className="shift-muted">まだ誰も回答していません。</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="shift-table">
              <thead>
                <tr>
                  <th>名前</th>
                  {board.days.flatMap((day) =>
                    board.slots.map((slot) => (
                      <th key={`${day.id}:${slot.id}`}>
                        {day.label}
                        <br />
                        {slot.label}
                      </th>
                    )),
                  )}
                  <th>役割希望</th>
                </tr>
              </thead>
              <tbody>
                {responses.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    {board.days.flatMap((day) =>
                      board.slots.map((slot) => {
                        const key = cellKey(day.id, slot.id);
                        const pref = r.prefs[key] ?? "ok";
                        return <td key={`${r.id}:${key}`}>{PREF_LABEL[pref]}</td>;
                      }),
                    )}
                    <td>
                      {r.preferredRoleIds
                        .map((id) => roleMap.get(id)?.name)
                        .filter(Boolean)
                        .join("、") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="shift-panel">
        <h2 className="shift-h2">自動割り振り</h2>
        <p className="shift-muted" style={{ marginTop: 0 }}>
          ○を優先、役割希望を加点、同じ人に偏りすぎないように調整します。
        </p>
        <div className="shift-actions">
          <button
            type="button"
            className="shift-btn shift-btn-primary"
            disabled={busy || responses.length === 0}
            onClick={() => void onAssign()}
          >
            {busy ? "計算中…" : assignments ? "もう一度割り振る" : "希望を反映して割り振る"}
          </button>
        </div>
        {error ? <p className="shift-error">{error}</p> : null}

        {assignments ? (
          <div style={{ marginTop: "1rem" }}>
            {assignments.cells.map((cell) => {
              const day = dayMap.get(cell.dayId);
              const slot = slotMap.get(cell.slotId);
              const role = roleMap.get(cell.roleId);
              if (!day || !slot || !role) return null;
              return (
                <div key={`${cell.dayId}:${cell.slotId}:${cell.roleId}`} className="shift-pref-card" style={{ marginBottom: 8 }}>
                  <h3>
                    {day.label} ／ {slot.label} ／ {role.name}
                    <span className="shift-muted">（{cell.people.length}/{cell.needed}）</span>
                  </h3>
                  <p style={{ margin: 0 }}>
                    {cell.people.length > 0
                      ? cell.people
                          .map((p) => `${p.name}(${PREF_LABEL[p.pref]})`)
                          .join("、")
                      : "空き"}
                    {cell.shortfall > 0 ? (
                      <span className="shift-error">　あと{cell.shortfall}人足りません</span>
                    ) : null}
                  </p>
                </div>
              );
            })}

            {lineText ? (
              <>
                <label className="shift-label">LINE用のシフト表</label>
                <pre
                  className="shift-link-box"
                  style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}
                >
                  {lineText}
                </pre>
                <div className="shift-actions">
                  <button type="button" className="shift-btn shift-btn-sun" onClick={shareLine}>
                    LINEで送る
                  </button>
                  <button type="button" className="shift-btn shift-btn-primary" onClick={() => void copyLine()}>
                    コピー
                  </button>
                </div>
                {copied ? <p className="shift-success">コピーしました</p> : null}
              </>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default function ShiftAdminPage() {
  return (
    <Suspense
      fallback={
        <main className="shift-shell">
          <p className="shift-muted">読み込み中…</p>
        </main>
      }
    >
      <AdminInner />
    </Suspense>
  );
}
