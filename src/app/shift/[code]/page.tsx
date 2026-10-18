"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  formatMemberLineInvite,
  formatScheduleViewInvite,
} from "@/lib/shift/assign";
import { buildPersonalIcs, downloadIcs, myAssignedCells } from "@/lib/shift/ical";
import {
  cellKey,
  normalizeBoard,
  slotsForDay,
  workSlotsForDay,
  type Pref,
  type ShiftAssignmentResult,
  type ShiftBoard,
} from "@/lib/shift/types";

type PublicBoard = Omit<ShiftBoard, "adminKey">;

const PREF_LABEL: Record<Pref, string> = {
  prefer: "○",
  ok: "△",
  ng: "×",
};

function ShiftMemberInner() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const code = params.code;
  const initialTab = search.get("tab") === "prefs" ? "prefs" : "view";
  const initialName = search.get("name") ?? "";

  const [tab, setTab] = useState<"view" | "prefs">(initialTab);
  const [board, setBoard] = useState<PublicBoard | null>(null);
  const [responseCount, setResponseCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterName, setFilterName] = useState(initialName);
  const [name, setName] = useState(initialName);
  const [prefs, setPrefs] = useState<Record<string, Pref>>({});
  const [preferredRoleIds, setPreferredRoleIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [responseId, setResponseId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState("");

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
            if (parsed.name) {
              setName(parsed.name);
              if (!initialName) setFilterName(parsed.name);
            }
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
  }, [code, initialName]);

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

  const assignments = board?.assignments as ShiftAssignmentResult | null;
  const myCells = useMemo(
    () => (board ? myAssignedCells(board as ShiftBoard, assignments, filterName) : []),
    [assignments, board, filterName],
  );

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
      setFilterName(name);
      setResponseCount((n) => (responseId ? n : n + 1));
    } catch {
      setError("通信に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1600);
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
        <h1 className="shift-brand-mark">シフトメイキング</h1>
        <p className="shift-error">{error || "シフト表が見つかりません"}</p>
        <Link className="shift-btn shift-btn-primary" href="/shift" style={{ display: "inline-block", marginTop: 12 }}>
          新しく作る
        </Link>
      </main>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const viewUrl = `${origin}/shift/${board.code}`;
  const prefsUrl = `${origin}/shift/${board.code}?tab=prefs`;

  return (
    <main className="shift-shell">
      <header className="shift-brand">
        <p className="shift-muted" style={{ margin: 0, fontWeight: 700 }}>
          シフトメイキング
        </p>
        <motion.h1
          className="shift-brand-mark"
          style={{ fontSize: "clamp(1.8rem, 7vw, 2.6rem)" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {board.title}
        </motion.h1>
        {board.note ? <p className="shift-brand-sub">{board.note}</p> : null}
        <p className="shift-muted">
          {board.days.map((d) => d.label).join("・")} ／ {board.schedule.dayStart}–
          {board.schedule.dayEnd} ／ {board.schedule.slotMinutes}分ごと ／ メンバー
          {responseCount}人
        </p>
      </header>

      <div className="shift-tabs">
        <button type="button" className="shift-tab" data-on={tab === "view"} onClick={() => setTab("view")}>
          シフト表
        </button>
        <button type="button" className="shift-tab" data-on={tab === "prefs"} onClick={() => setTab("prefs")}>
          希望を入れる
        </button>
      </div>

      {tab === "view" ? (
        <>
          <section className="shift-panel">
            <label className="shift-label" htmlFor="filter">
              自分の名前で絞り込み
            </label>
            <input
              id="filter"
              className="shift-input"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="名前を入れると自分の枠だけ強調"
              list="member-names"
            />
            {filterName && myCells.length === 0 && assignments ? (
              <p className="shift-muted">まだ割当がありません（割り振り前か、名前が一致しません）</p>
            ) : null}
            {filterName && myCells.length > 0 ? (
              <p className="shift-success">あなたの枠: {myCells.length}コマ</p>
            ) : null}
          </section>

          <section className="shift-panel">
            <h2 className="shift-h2">全体スケジュール</h2>
            {!assignments ? (
              <p className="shift-muted">まだ自動割り振りされていません。希望を送って管理者の確定を待ってください。</p>
            ) : (
              <div className="shift-pref-grid">
                {board.days.map((day) => (
                  <div key={day.id}>
                    <h3 style={{ margin: "0 0 0.5rem" }}>
                      {day.label}
                      {day.date ? `（${day.date}）` : ""}
                    </h3>
                    {slotsForDay(board, day.id).map((slot) => {
                      if (slot.isBreak) {
                        return (
                          <div key={slot.id} className="shift-pref-card" style={{ opacity: 0.7 }}>
                            <h3>
                              {slot.label}
                              <span className="shift-break-chip">休み時間</span>
                            </h3>
                            <p className="shift-muted" style={{ margin: 0 }}>
                              この時間はシフトなし
                            </p>
                          </div>
                        );
                      }
                      const cells = assignments.cells.filter(
                        (c) => c.dayId === day.id && c.slotId === slot.id,
                      );
                      const mineHere = Boolean(
                        filterName &&
                          cells.some((c) => c.people.some((p) => p.name === filterName.trim())),
                      );
                      return (
                        <div
                          key={slot.id}
                          className={`shift-pref-card${mineHere ? " shift-mine" : ""}`}
                          style={{ marginBottom: 8 }}
                        >
                          <h3>{slot.label}</h3>
                          {cells.map((cell) => {
                            const role = board.roles.find((r) => r.id === cell.roleId);
                            const names = cell.people.map((p) => p.name).join("、") || "（空き）";
                            const hit = filterName
                              ? cell.people.some((p) => p.name === filterName.trim())
                              : false;
                            return (
                              <p key={cell.roleId} style={{ margin: "0.25rem 0", fontWeight: hit ? 800 : 400 }}>
                                {role?.name}：{names}
                                {cell.shortfall > 0 ? (
                                  <span className="shift-error"> ※あと{cell.shortfall}</span>
                                ) : null}
                              </p>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="shift-panel">
            <h2 className="shift-h2">共有</h2>
            <div className="shift-actions">
              <button
                type="button"
                className="shift-btn shift-btn-primary"
                onClick={() => copy(viewUrl, "view")}
              >
                リンクをコピー
              </button>
              <button
                type="button"
                className="shift-btn shift-btn-sun"
                onClick={() => {
                  const text = formatScheduleViewInvite(board.title, viewUrl);
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
                className="shift-btn shift-btn-ghost"
                disabled={!assignments || !filterName.trim()}
                onClick={() => {
                  if (!assignments || !filterName.trim()) return;
                  const ics = buildPersonalIcs(board as ShiftBoard, assignments, filterName.trim());
                  downloadIcs(`${board.code}-${filterName.trim()}.ics`, ics);
                }}
              >
                カレンダー追加
              </button>
            </div>
            {copied ? <p className="shift-success">コピーしました</p> : null}
          </section>
        </>
      ) : (
        <>
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
          {saved ? <p className="shift-success">保存しました。同じ端末ならあとから直せます。</p> : null}

          <div className="shift-actions">
            <button
              type="button"
              className="shift-btn shift-btn-primary"
              disabled={busy || !name.trim()}
              onClick={onSubmit}
            >
              {busy ? "送信中…" : saved ? "更新する" : "希望を送る"}
            </button>
            <button
              type="button"
              className="shift-btn shift-btn-ghost"
              onClick={() =>
                copy(formatMemberLineInvite(board.title, prefsUrl), "invite")
              }
            >
              招待文をコピー
            </button>
          </div>
          {copied === "invite" ? <p className="shift-success">コピーしました</p> : null}
        </>
      )}
    </main>
  );
}

export default function ShiftMemberPage() {
  return (
    <Suspense
      fallback={
        <main className="shift-shell">
          <p className="shift-muted">読み込み中…</p>
        </main>
      }
    >
      <ShiftMemberInner />
    </Suspense>
  );
}
