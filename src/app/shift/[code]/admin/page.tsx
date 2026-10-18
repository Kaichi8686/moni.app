"use client";

import { motion } from "framer-motion";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  formatAssignmentsForLine,
  formatScheduleViewInvite,
} from "@/lib/shift/assign";
import type {
  AssignedPerson,
  CellAssignment,
  Pref,
  ShiftAssignmentResult,
  ShiftBoard,
  ShiftResponse,
} from "@/lib/shift/types";
import {
  cellKey,
  DEFAULT_SCHEDULE,
  normalizeBoard,
  slotsForDay,
  workSlotsForDay,
} from "@/lib/shift/types";

type SlotDraft = { start: string; end: string; label: string; isBreak: boolean };

const PREF_LABEL: Record<Pref, string> = {
  prefer: "○",
  ok: "△",
  ng: "×",
};

function emptyCells(board: ShiftBoard): CellAssignment[] {
  const cells: CellAssignment[] = [];
  for (const day of board.days) {
    for (const slot of workSlotsForDay(board, day.id)) {
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

function draftsForDay(board: ShiftBoard, dayId: string): SlotDraft[] {
  return slotsForDay(board, dayId).map((s) => ({
    start: s.start || "09:00",
    end: s.end || "10:00",
    label: s.label,
    isBreak: Boolean(s.isBreak),
  }));
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

  const [day1Slots, setDay1Slots] = useState<SlotDraft[]>([]);
  const [day2Slots, setDay2Slots] = useState<SlotDraft[]>([]);
  const [maxConsecutive, setMaxConsecutive] = useState(DEFAULT_SCHEDULE.maxConsecutive);

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
      setMaxConsecutive(b.schedule.maxConsecutive);
      const d1 = b.days[0]?.id ?? "d1";
      const d2 = b.days[1]?.id ?? "d2";
      setDay1Slots(draftsForDay(b, d1));
      setDay2Slots(b.days[1] ? draftsForDay(b, d2) : []);
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
      const d1 = board.days[0]?.id ?? "d1";
      const d2 = board.days[1]?.id ?? "d2";
      const work1 = day1Slots.filter((s) => !s.isBreak);
      const work2 = board.days[1] ? day2Slots.filter((s) => !s.isBreak) : work1;
      if (work1.length === 0 || (board.days[1] && work2.length === 0)) {
        setError("各日にシフト用の時間帯を1つ以上追加してください");
        return;
      }
      const first = work1[0]!;
      const last = (work2[work2.length - 1] ?? work1[work1.length - 1])!;
      const toPayload = (list: SlotDraft[], dayId: string) =>
        list.map((s) => ({
          start: s.start,
          end: s.end,
          label: s.label.trim() || `${s.start}-${s.end}`,
          isBreak: s.isBreak,
          dayId,
        }));
      const slots = board.days[1]
        ? [...toPayload(day1Slots, d1), ...toPayload(day2Slots, d2)]
        : toPayload(day1Slots, d1);

      const res = await fetch(`/api/shift/${encodeURIComponent(code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminKey,
          schedule: {
            ...board.schedule,
            dayStart: first.start,
            dayEnd: last.end,
            maxConsecutive,
            breaks: [],
            buddyPairs: board.schedule.buddyPairs ?? [],
          },
          slots,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "保存に失敗しました");
        return;
      }
      const b = normalizeBoard(data.board);
      setDay1Slots(draftsForDay(b, b.days[0]?.id ?? "d1"));
      setDay2Slots(b.days[1] ? draftsForDay(b, b.days[1].id) : []);
      applyAssignmentState(b, responses);
      setLineText("");
      setSavedMsg("時間帯を保存しました。割り振りはやり直しが必要です");
    } catch {
      setError("通信に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  function renderSlotEditor(
    title: string,
    list: SlotDraft[],
    setList: (next: SlotDraft[]) => void,
  ) {
    const work = list.filter((s) => !s.isBreak);
    return (
      <div style={{ marginBottom: "1rem" }}>
        <h3 className="shift-h2" style={{ fontSize: "0.95rem" }}>
          {title}
        </h3>
        <div className="shift-item-list">
          {list.map((s, i) => (
            <div className="shift-item" key={`${title}-${i}`}>
              <div style={{ width: "100%", display: "grid", gap: 8 }}>
                <div className="shift-row" style={{ gridTemplateColumns: "1fr 1fr auto", gap: 6 }}>
                  <input
                    className="shift-input"
                    type="time"
                    value={s.start}
                    onChange={(e) => {
                      const next = [...list];
                      next[i] = { ...s, start: e.target.value };
                      setList(next);
                    }}
                  />
                  <input
                    className="shift-input"
                    type="time"
                    value={s.end}
                    onChange={(e) => {
                      const next = [...list];
                      next[i] = { ...s, end: e.target.value };
                      setList(next);
                    }}
                  />
                  <label
                    className="shift-muted"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      whiteSpace: "nowrap",
                      fontWeight: 700,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={s.isBreak}
                      onChange={(e) => {
                        const next = [...list];
                        next[i] = { ...s, isBreak: e.target.checked };
                        setList(next);
                      }}
                    />
                    休
                  </label>
                </div>
                <input
                  className="shift-input"
                  value={s.label}
                  onChange={(e) => {
                    const next = [...list];
                    next[i] = { ...s, label: e.target.value };
                    setList(next);
                  }}
                  placeholder={`${s.start}-${s.end}`}
                />
              </div>
              <button
                type="button"
                className="shift-x"
                onClick={() => setList(list.filter((_, j) => j !== i))}
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
              setList([
                ...list,
                {
                  start: work[work.length - 1]?.end || "15:00",
                  end: "17:00",
                  label: "",
                  isBreak: false,
                },
              ])
            }
          >
            時間帯を追加
          </button>
        </div>
      </div>
    );
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
        <h2 className="shift-h2">時間帯（日ごと）</h2>
        <p className="shift-muted" style={{ marginTop: 0 }}>
          1日目と2日目で別々に時間帯を決められます。休み時間は「休」にチェック。
        </p>
        {renderSlotEditor(board.days[0]?.label || "1日目", day1Slots, setDay1Slots)}
        {board.days[1] ? (
          <>
            <div className="shift-actions" style={{ marginTop: 0, marginBottom: "0.75rem" }}>
              <button
                type="button"
                className="shift-btn shift-btn-ghost"
                onClick={() => setDay2Slots(day1Slots.map((s) => ({ ...s })))}
              >
                1日目の時間帯を2日目にコピー
              </button>
            </div>
            {renderSlotEditor(board.days[1].label || "2日目", day2Slots, setDay2Slots)}
          </>
        ) : null}

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

        <div className="shift-actions">
          <button
            type="button"
            className="shift-btn shift-btn-primary"
            disabled={saving}
            onClick={() => void saveSchedule()}
          >
            {saving ? "保存中…" : "時間帯を保存"}
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
                    workSlotsForDay(board, day.id).map((slot) => (
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
                      workSlotsForDay(board, day.id).map((slot) => {
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
