"use client";

import { motion } from "framer-motion";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  formatAssignmentsForLine,
  formatMemberLineInvite,
} from "@/lib/shift/assign";
import { generateSlotsFromSchedule } from "@/lib/shift/slots";
import type {
  Pref,
  ShiftAssignmentResult,
  ShiftBoard,
  ShiftBreak,
  ShiftResponse,
  ShiftScheduleConfig,
} from "@/lib/shift/types";
import { cellKey, DEFAULT_SCHEDULE, normalizeBoard } from "@/lib/shift/types";

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
  const [saving, setSaving] = useState(false);
  const [lineText, setLineText] = useState("");
  const [copied, setCopied] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const [dayStart, setDayStart] = useState(DEFAULT_SCHEDULE.dayStart);
  const [dayEnd, setDayEnd] = useState(DEFAULT_SCHEDULE.dayEnd);
  const [slotMinutes, setSlotMinutes] = useState(DEFAULT_SCHEDULE.slotMinutes);
  const [maxConsecutive, setMaxConsecutive] = useState(DEFAULT_SCHEDULE.maxConsecutive);
  const [breaks, setBreaks] = useState<ShiftBreak[]>([]);
  const [buddyA, setBuddyA] = useState("");
  const [buddyB, setBuddyB] = useState("");
  const [buddyPairs, setBuddyPairs] = useState<ShiftScheduleConfig["buddyPairs"]>([]);

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
      const b = normalizeBoard(data.board);
      setBoard(b);
      setResponses(data.responses);
      setDayStart(b.schedule.dayStart);
      setDayEnd(b.schedule.dayEnd);
      setSlotMinutes(b.schedule.slotMinutes);
      setMaxConsecutive(b.schedule.maxConsecutive);
      setBreaks(b.schedule.breaks);
      setBuddyPairs(b.schedule.buddyPairs);
      if (b.assignments) {
        setLineText(formatAssignmentsForLine(b, b.assignments));
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

  const previewSlots = useMemo(
    () =>
      generateSlotsFromSchedule({
        dayStart,
        dayEnd,
        slotMinutes,
        breaks,
        maxConsecutive,
        buddyPairs,
      }),
    [breaks, buddyPairs, dayEnd, dayStart, maxConsecutive, slotMinutes],
  );

  const assignments: ShiftAssignmentResult | null = board?.assignments ?? null;
  const dayMap = useMemo(() => new Map(board?.days.map((d) => [d.id, d]) ?? []), [board]);
  const slotMap = useMemo(() => new Map(board?.slots.map((s) => [s.id, s]) ?? []), [board]);
  const roleMap = useMemo(() => new Map(board?.roles.map((r) => [r.id, r]) ?? []), [board]);

  async function saveSchedule() {
    if (!board) return;
    setSaving(true);
    setError("");
    setSavedMsg("");
    try {
      const schedule: ShiftScheduleConfig = {
        dayStart,
        dayEnd,
        slotMinutes,
        breaks,
        maxConsecutive,
        buddyPairs,
      };
      const res = await fetch(`/api/shift/${encodeURIComponent(code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey, schedule }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "保存に失敗しました");
        return;
      }
      setBoard(normalizeBoard(data.board));
      setLineText("");
      setSavedMsg("時間設定を保存しました（コマを再生成。割り振りはやり直しが必要です）");
    } catch {
      setError("通信に失敗しました");
    } finally {
      setSaving(false);
    }
  }

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
  const prefsUrl = `${memberUrl}?tab=prefs`;

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
        <h2 className="shift-h2">共有リンク</h2>
        <label className="shift-label">希望入力用</label>
        <div className="shift-link-box">{prefsUrl}</div>
        <div className="shift-actions">
          <button
            type="button"
            className="shift-btn shift-btn-sun"
            onClick={() => {
              const text = formatMemberLineInvite(board.title, prefsUrl);
              window.open(
                `https://line.me/R/msg/text/?${encodeURIComponent(text)}`,
                "_blank",
                "noopener,noreferrer",
              );
            }}
          >
            LINEで送る
          </button>
          <button
            type="button"
            className="shift-btn shift-btn-primary"
            onClick={() => {
              void navigator.clipboard.writeText(formatMemberLineInvite(board.title, prefsUrl));
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            }}
          >
            文面をコピー
          </button>
          <button type="button" className="shift-btn shift-btn-ghost" onClick={() => void load()}>
            回答を更新
          </button>
        </div>
        <div style={{ height: 10 }} />
        <label className="shift-label">シフト表（閲覧）</label>
        <div className="shift-link-box">{memberUrl}</div>
      </section>

      <section className="shift-panel">
        <h2 className="shift-h2">時間・コマ設定</h2>
        <p className="shift-muted" style={{ marginTop: 0 }}>
          開始・終了・何分ごと・休み時間を変更できます。保存するとコマが作り直されます。
        </p>
        <div className="shift-row shift-row-2">
          <div>
            <label className="shift-label">開始</label>
            <input
              className="shift-input"
              type="time"
              value={dayStart}
              onChange={(e) => setDayStart(e.target.value)}
            />
          </div>
          <div>
            <label className="shift-label">終了</label>
            <input
              className="shift-input"
              type="time"
              value={dayEnd}
              onChange={(e) => setDayEnd(e.target.value)}
            />
          </div>
        </div>
        <div style={{ height: 10 }} />
        <div className="shift-row shift-row-2">
          <div>
            <label className="shift-label">何分ごとに変えるか</label>
            <select
              className="shift-input"
              value={slotMinutes}
              onChange={(e) => setSlotMinutes(Number(e.target.value))}
            >
              {[30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {m}分
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="shift-label">連続シフト上限</label>
            <select
              className="shift-input"
              value={maxConsecutive}
              onChange={(e) => setMaxConsecutive(Number(e.target.value))}
            >
              <option value={0}>制限なし</option>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  最大{n}コマ連続
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ height: 12 }} />
        <h3 className="shift-h2" style={{ fontSize: "0.95rem" }}>
          休み時間（シフトなし）
        </h3>
        <div className="shift-item-list">
          {breaks.map((b, i) => (
            <div className="shift-item" key={b.id}>
              <div className="shift-row" style={{ width: "100%", gap: 6 }}>
                <input
                  className="shift-input"
                  value={b.label}
                  onChange={(e) => {
                    const next = [...breaks];
                    next[i] = { ...b, label: e.target.value };
                    setBreaks(next);
                  }}
                />
                <input
                  className="shift-input"
                  type="time"
                  value={b.start}
                  onChange={(e) => {
                    const next = [...breaks];
                    next[i] = { ...b, start: e.target.value };
                    setBreaks(next);
                  }}
                />
                <input
                  className="shift-input"
                  type="time"
                  value={b.end}
                  onChange={(e) => {
                    const next = [...breaks];
                    next[i] = { ...b, end: e.target.value };
                    setBreaks(next);
                  }}
                />
              </div>
              <button
                type="button"
                className="shift-x"
                onClick={() => setBreaks(breaks.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="shift-actions">
          <button
            type="button"
            className="shift-btn shift-btn-ghost"
            onClick={() =>
              setBreaks([
                ...breaks,
                { id: `br${Date.now()}`, label: "休み時間", start: "15:00", end: "15:30" },
              ])
            }
          >
            休み時間を追加
          </button>
        </div>

        <div style={{ height: 12 }} />
        <h3 className="shift-h2" style={{ fontSize: "0.95rem" }}>
          バディ（なるべく同じコマ）
        </h3>
        <div className="shift-row shift-row-2">
          <input
            className="shift-input"
            placeholder="名前A"
            value={buddyA}
            onChange={(e) => setBuddyA(e.target.value)}
          />
          <input
            className="shift-input"
            placeholder="名前B"
            value={buddyB}
            onChange={(e) => setBuddyB(e.target.value)}
          />
        </div>
        <div className="shift-actions">
          <button
            type="button"
            className="shift-btn shift-btn-ghost"
            onClick={() => {
              if (!buddyA.trim() || !buddyB.trim()) return;
              setBuddyPairs([
                ...buddyPairs,
                { id: `bp${Date.now()}`, nameA: buddyA.trim(), nameB: buddyB.trim() },
              ]);
              setBuddyA("");
              setBuddyB("");
            }}
          >
            バディを追加
          </button>
        </div>
        <div className="shift-chip-row" style={{ marginTop: 8 }}>
          {buddyPairs.map((p) => (
            <button
              key={p.id}
              type="button"
              className="shift-chip"
              onClick={() => setBuddyPairs(buddyPairs.filter((x) => x.id !== p.id))}
            >
              {p.nameA}×{p.nameB} ×
            </button>
          ))}
        </div>

        <p className="shift-muted" style={{ marginTop: 12 }}>
          プレビュー: {previewSlots.length}コマ
        </p>
        <div className="shift-chip-row">
          {previewSlots.map((s) => (
            <span key={s.id} className="shift-chip" data-on={!s.isBreak}>
              {s.label}
              {s.isBreak ? "（休）" : ""}
            </span>
          ))}
        </div>

        <div className="shift-actions">
          <button
            type="button"
            className="shift-btn shift-btn-primary"
            disabled={saving}
            onClick={() => void saveSchedule()}
          >
            {saving ? "保存中…" : "時間設定を保存"}
          </button>
        </div>
        {savedMsg ? <p className="shift-success">{savedMsg}</p> : null}
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
                    board.slots
                      .filter((s) => !s.isBreak)
                      .map((slot) => (
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
                      board.slots
                        .filter((s) => !s.isBreak)
                        .map((slot) => {
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
          ○優先・役割希望・負荷・連続制限・休み時間スキップ・バディを反映します。
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
                <div
                  key={`${cell.dayId}:${cell.slotId}:${cell.roleId}`}
                  className="shift-pref-card"
                  style={{ marginBottom: 8 }}
                >
                  <h3>
                    {day.label} ／ {slot.label} ／ {role.name}
                    <span className="shift-muted">
                      （{cell.people.length}/{cell.needed}）
                    </span>
                  </h3>
                  <p style={{ margin: 0 }}>
                    {cell.people.length > 0
                      ? cell.people.map((p) => `${p.name}(${PREF_LABEL[p.pref]})`).join("、")
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
                  <button
                    type="button"
                    className="shift-btn shift-btn-sun"
                    onClick={() =>
                      window.open(
                        `https://line.me/R/msg/text/?${encodeURIComponent(lineText)}`,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    LINEで送る
                  </button>
                  <button
                    type="button"
                    className="shift-btn shift-btn-primary"
                    onClick={() => void copyLine()}
                  >
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
