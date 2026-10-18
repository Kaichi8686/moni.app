"use client";

import { motion } from "framer-motion";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  formatAssignmentsForLine,
  formatScheduleViewInvite,
} from "@/lib/shift/assign";
import { generateSlotsFromSchedule } from "@/lib/shift/slots";
import type {
  AssignedPerson,
  CellAssignment,
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

function emptyCells(board: ShiftBoard): CellAssignment[] {
  const cells: CellAssignment[] = [];
  for (const day of board.days) {
    for (const slot of board.slots) {
      if (slot.isBreak) continue;
      for (const role of board.roles) {
        cells.push({
          dayId: day.id,
          slotId: slot.id,
          roleId: role.id,
          needed: role.needed,
          people: [],
          shortfall: role.needed,
        });
      }
    }
  }
  return cells;
}

function AdminInner() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const code = params.code;
  const adminKey = search.get("key") ?? "";

  const [board, setBoard] = useState<ShiftBoard | null>(null);
  const [responses, setResponses] = useState<ShiftResponse[]>([]);
  const [draftCells, setDraftCells] = useState<CellAssignment[]>([]);
  const [memberText, setMemberText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingMembers, setSavingMembers] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
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

  const applyAssignmentState = useCallback((b: ShiftBoard, nextResponses: ShiftResponse[]) => {
    setBoard(b);
    setResponses(nextResponses);
    setMemberText(nextResponses.map((r) => r.name).join("\n"));
    const cells = b.assignments?.cells?.length ? b.assignments.cells : emptyCells(b);
    setDraftCells(cells);
    if (b.assignments) {
      setLineText(formatAssignmentsForLine(b, b.assignments));
    }
  }, []);

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
      setDayStart(b.schedule.dayStart);
      setDayEnd(b.schedule.dayEnd);
      setSlotMinutes(b.schedule.slotMinutes);
      setMaxConsecutive(b.schedule.maxConsecutive);
      setBreaks(b.schedule.breaks);
      setBuddyPairs(b.schedule.buddyPairs);
      applyAssignmentState(b, data.responses);
    } catch {
      setError("通信に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [adminKey, applyAssignmentState, code]);

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

  const dayMap = useMemo(() => new Map(board?.days.map((d) => [d.id, d]) ?? []), [board]);
  const slotMap = useMemo(() => new Map(board?.slots.map((s) => [s.id, s]) ?? []), [board]);
  const roleMap = useMemo(() => new Map(board?.roles.map((r) => [r.id, r]) ?? []), [board]);

  const busyBySlot = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const cell of draftCells) {
      const key = cellKey(cell.dayId, cell.slotId);
      if (!map.has(key)) map.set(key, new Set());
      for (const p of cell.people) map.get(key)!.add(p.responseId);
    }
    return map;
  }, [draftCells]);

  function updateCellPeople(
    dayId: string,
    slotId: string,
    roleId: string,
    people: AssignedPerson[],
  ) {
    setDraftCells((prev) =>
      prev.map((c) => {
        if (c.dayId !== dayId || c.slotId !== slotId || c.roleId !== roleId) return c;
        return {
          ...c,
          people,
          shortfall: Math.max(0, c.needed - people.length),
        };
      }),
    );
    setSavedMsg("");
  }

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
      const b = normalizeBoard(data.board);
      applyAssignmentState(b, responses);
      setLineText("");
      setSavedMsg("時間設定を保存しました（コマを再生成。割り振りはやり直しが必要です）");
    } catch {
      setError("通信に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function saveMembers() {
    if (!board) return;
    setSavingMembers(true);
    setError("");
    setSavedMsg("");
    try {
      const members = memberText
        .split(/\n|,|、/)
        .map((n) => n.trim())
        .filter(Boolean);
      const res = await fetch(`/api/shift/${encodeURIComponent(code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey, members }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "名簿の保存に失敗しました");
        return;
      }
      await load();
      setSavedMsg("メンバー名簿を更新しました。必要なら割り振り直してください。");
    } catch {
      setError("通信に失敗しました");
    } finally {
      setSavingMembers(false);
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
      setDraftCells(data.assignments.cells);
      setLineText(data.lineText ?? "");
      setSavedMsg("自動割り振りしました。手直しして保存もできます。");
    } catch {
      setError("通信に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function saveManual() {
    setSavingManual(true);
    setError("");
    setSavedMsg("");
    try {
      const res = await fetch(`/api/shift/${encodeURIComponent(code)}/assign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminKey,
          cells: draftCells.map((c) => ({
            dayId: c.dayId,
            slotId: c.slotId,
            roleId: c.roleId,
            people: c.people.map((p) => ({ responseId: p.responseId, name: p.name })),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "保存に失敗しました");
        return;
      }
      setBoard((prev) => (prev ? { ...prev, assignments: data.assignments } : prev));
      setDraftCells(data.assignments.cells);
      setLineText(data.lineText ?? "");
      setSavedMsg("手直ししたシフトを保存しました");
    } catch {
      setError("通信に失敗しました");
    } finally {
      setSavingManual(false);
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

  const assignments: ShiftAssignmentResult | null = board.assignments;

  return (
    <main className="shift-shell">
      <header className="shift-brand">
        <p className="shift-muted" style={{ margin: 0, fontWeight: 700 }}>
          オーナー管理
        </p>
        <motion.h1
          className="shift-brand-mark"
          style={{ fontSize: "clamp(1.8rem, 7vw, 2.6rem)" }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {board.title}
        </motion.h1>
        <p className="shift-muted">
          {board.days.map((d) => d.label).join("・")} ／ メンバー {responses.length} 人
        </p>
      </header>

      <section className="shift-panel">
        <h2 className="shift-h2">共有リンク</h2>
        <label className="shift-label">シフト表（閲覧）</label>
        <div className="shift-link-box">{memberUrl}</div>
        <div className="shift-actions">
          <button
            type="button"
            className="shift-btn shift-btn-sun"
            onClick={() => {
              const text = formatScheduleViewInvite(board.title, memberUrl);
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
              void navigator.clipboard.writeText(formatScheduleViewInvite(board.title, memberUrl));
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            }}
          >
            文面をコピー
          </button>
          <button type="button" className="shift-btn shift-btn-ghost" onClick={() => void load()}>
            再読み込み
          </button>
        </div>
      </section>

      <section className="shift-panel">
        <h2 className="shift-h2">メンバー名簿</h2>
        <p className="shift-muted" style={{ marginTop: 0 }}>
          1行に1人。追加・削除したら保存してください。
        </p>
        <textarea
          className="shift-textarea"
          style={{ minHeight: "8rem" }}
          value={memberText}
          onChange={(e) => setMemberText(e.target.value)}
        />
        <div className="shift-actions">
          <button
            type="button"
            className="shift-btn shift-btn-primary"
            disabled={savingMembers}
            onClick={() => void saveMembers()}
          >
            {savingMembers ? "保存中…" : "名簿を保存"}
          </button>
        </div>
      </section>

      <section className="shift-panel">
        <h2 className="shift-h2">シフト割り振り（手直し可）</h2>
        <p className="shift-muted" style={{ marginTop: 0 }}>
          名前をタップで外す／＋で追加。同じ時間帯に二重配置はできません。
        </p>
        <div className="shift-actions" style={{ marginTop: 0, marginBottom: "0.85rem" }}>
          <button
            type="button"
            className="shift-btn shift-btn-primary"
            disabled={busy || responses.length === 0}
            onClick={() => void onAssign()}
          >
            {busy ? "計算中…" : assignments ? "自動で割り振り直す" : "自動で割り振る"}
          </button>
          <button
            type="button"
            className="shift-btn shift-btn-sun"
            disabled={savingManual || draftCells.length === 0}
            onClick={() => void saveManual()}
          >
            {savingManual ? "保存中…" : "手直しを保存"}
          </button>
        </div>

        {draftCells.map((cell) => {
          const day = dayMap.get(cell.dayId);
          const slot = slotMap.get(cell.slotId);
          const role = roleMap.get(cell.roleId);
          if (!day || !slot || !role) return null;
          const slotBusy = busyBySlot.get(cellKey(cell.dayId, cell.slotId)) ?? new Set();
          const available = responses.filter(
            (r) => !slotBusy.has(r.id) || cell.people.some((p) => p.responseId === r.id),
          );
          const unused = available.filter((r) => !cell.people.some((p) => p.responseId === r.id));

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
              <div className="shift-chip-row">
                {cell.people.map((p) => (
                  <button
                    key={p.responseId}
                    type="button"
                    className="shift-chip"
                    data-on="true"
                    onClick={() =>
                      updateCellPeople(
                        cell.dayId,
                        cell.slotId,
                        cell.roleId,
                        cell.people.filter((x) => x.responseId !== p.responseId),
                      )
                    }
                  >
                    {p.name} ×
                  </button>
                ))}
                {unused.length > 0 && cell.people.length < cell.needed + 3 ? (
                  <select
                    className="shift-input"
                    style={{ width: "auto", minWidth: 120, padding: "0.45rem 0.7rem" }}
                    defaultValue=""
                    onChange={(e) => {
                      const id = e.target.value;
                      e.target.value = "";
                      const person = responses.find((r) => r.id === id);
                      if (!person) return;
                      if (slotBusy.has(person.id)) return;
                      updateCellPeople(cell.dayId, cell.slotId, cell.roleId, [
                        ...cell.people,
                        { responseId: person.id, name: person.name, pref: "ok" },
                      ]);
                    }}
                  >
                    <option value="">＋ 追加</option>
                    {unused.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
              {cell.shortfall > 0 ? (
                <p className="shift-error" style={{ margin: "0.45rem 0 0" }}>
                  あと{cell.shortfall}人足りません
                </p>
              ) : null}
            </div>
          );
        })}

        {lineText ? (
          <>
            <label className="shift-label" style={{ marginTop: "1rem" }}>
              LINE用のシフト表
            </label>
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
            <div className="shift-row" style={{ gridTemplateColumns: "1fr auto", alignItems: "center" }}>
              <input
                className="shift-input"
                type="number"
                inputMode="numeric"
                min={5}
                max={480}
                step={5}
                value={slotMinutes}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  setSlotMinutes(Math.max(5, Math.min(480, Math.floor(n) || 5)));
                }}
              />
              <span className="shift-muted" style={{ paddingRight: 4 }}>
                分
              </span>
            </div>
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
      </section>

      {responses.some((r) => Object.keys(r.prefs).length > 0) ? (
        <section className="shift-panel">
          <h2 className="shift-h2">届いた希望（任意）</h2>
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
                          const pref = r.prefs[key];
                          return <td key={`${r.id}:${key}`}>{pref ? PREF_LABEL[pref] : "—"}</td>;
                        }),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {savedMsg ? <p className="shift-success">{savedMsg}</p> : null}
      {error ? <p className="shift-error">{error}</p> : null}
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
