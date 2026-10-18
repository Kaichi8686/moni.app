"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { formatScheduleViewInvite } from "@/lib/shift/assign";
import { DEFAULT_SCHEDULE, type ShiftScheduleConfig } from "@/lib/shift/types";

type DayDraft = { label: string; date: string };
type RoleDraft = { name: string; needed: number };
type SlotDraft = { start: string; end: string; label: string; isBreak: boolean };

const DEFAULT_MEMBERS = "田中\n佐藤\n鈴木\n高橋\n伊藤\n渡辺";

const DEFAULT_SLOTS: SlotDraft[] = [
  { start: "09:00", end: "12:00", label: "", isBreak: false },
  { start: "12:00", end: "13:00", label: "昼休み", isBreak: true },
  { start: "13:00", end: "15:00", label: "", isBreak: false },
  { start: "15:00", end: "17:00", label: "", isBreak: false },
];

function parseMembers(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const line of text.split(/\n|,|、/)) {
    const name = line.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

function slotLabel(s: SlotDraft): string {
  return s.label.trim() || `${s.start}-${s.end}`;
}

export default function ShiftCreatePage() {
  const [title, setTitle] = useState("文化祭シフト");
  const [note, setNote] = useState("");
  const [days, setDays] = useState<DayDraft[]>([
    { label: "1日目", date: "" },
    { label: "2日目", date: "" },
  ]);
  const [memberText, setMemberText] = useState(DEFAULT_MEMBERS);
  const [roles, setRoles] = useState<RoleDraft[]>([
    { name: "受付", needed: 2 },
    { name: "販売", needed: 3 },
    { name: "呼び込み", needed: 2 },
  ]);
  const [slots, setSlots] = useState<SlotDraft[]>(DEFAULT_SLOTS);
  const [maxConsecutive, setMaxConsecutive] = useState(DEFAULT_SCHEDULE.maxConsecutive);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{
    memberUrl: string;
    adminUrl: string;
    lineText: string;
    viewInvite: string;
  } | null>(null);
  const [copied, setCopied] = useState("");

  const members = useMemo(() => parseMembers(memberText), [memberText]);
  const workSlots = useMemo(() => slots.filter((s) => !s.isBreak), [slots]);
  const neededPerSlot = useMemo(
    () => roles.reduce((sum, r) => sum + Math.max(1, r.needed || 1), 0),
    [roles],
  );

  const schedule: ShiftScheduleConfig = useMemo(() => {
    const first = workSlots[0] ?? slots[0];
    const last = workSlots[workSlots.length - 1] ?? slots[slots.length - 1];
    return {
      dayStart: first?.start || DEFAULT_SCHEDULE.dayStart,
      dayEnd: last?.end || DEFAULT_SCHEDULE.dayEnd,
      slotMinutes: DEFAULT_SCHEDULE.slotMinutes,
      breaks: slots
        .filter((s) => s.isBreak)
        .map((s, i) => ({
          id: `br${i + 1}`,
          label: slotLabel(s),
          start: s.start,
          end: s.end,
        })),
      maxConsecutive,
      buddyPairs: [],
    };
  }, [maxConsecutive, slots, workSlots]);

  async function onCreate() {
    setBusy(true);
    setError("");
    try {
      if (members.length === 0) {
        setError("メンバー名を1人以上入力してください");
        return;
      }
      if (workSlots.length === 0) {
        setError("シフト用の時間帯を1つ以上追加してください");
        return;
      }
      const res = await fetch("/api/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          note,
          days,
          roles,
          schedule,
          members,
          autoAssign: true,
          slots: slots.map((s) => ({
            start: s.start,
            end: s.end,
            label: slotLabel(s),
            isBreak: s.isBreak,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "作成に失敗しました");
        return;
      }
      const origin = window.location.origin;
      const memberUrl = `${origin}/shift/${data.board.code}`;
      const adminUrl = `${origin}/shift/${data.board.code}/admin?key=${encodeURIComponent(data.board.adminKey)}`;
      setCreated({
        memberUrl,
        adminUrl,
        lineText: data.lineText || formatScheduleViewInvite(data.board.title, memberUrl),
        viewInvite: formatScheduleViewInvite(data.board.title, memberUrl),
      });
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
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setError("コピーできませんでした");
    }
  }

  function shareLine(text: string) {
    window.open(`https://line.me/R/msg/text/?${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  function updateSlot(i: number, patch: Partial<SlotDraft>) {
    setSlots((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  return (
    <main className="shift-shell">
      <div className="shift-hero-visual" aria-hidden />
      <header className="shift-brand">
        <motion.h1
          className="shift-brand-mark"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          シフト<span>メイキング</span>
        </motion.h1>
        <motion.p
          className="shift-brand-sub"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          オーナーがメンバー・時間帯・役割・人数を決めて、2日分のシフトをすぐ作れます。
        </motion.p>
      </header>

      <AnimatePresence mode="wait">
        {!created ? (
          <motion.div key="form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <section className="shift-panel">
              <h2 className="shift-h2">1. 基本情報</h2>
              <label className="shift-label" htmlFor="title">
                タイトル
              </label>
              <input
                id="title"
                className="shift-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: 2年A組 模擬店シフト"
              />
              <div style={{ height: 12 }} />
              <label className="shift-label" htmlFor="note">
                メモ（任意）
              </label>
              <textarea
                id="note"
                className="shift-textarea"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例: 当日はスマホで自分の枠を確認してね"
              />
            </section>

            <section className="shift-panel">
              <h2 className="shift-h2">2. 日程（2日間）</h2>
              <p className="shift-muted" style={{ marginTop: 0 }}>
                このアプリは2日分専用です。ラベルと日付だけ変えてください。
              </p>
              <div className="shift-item-list">
                {days.map((d, i) => (
                  <div className="shift-item" key={`day-${i}`}>
                    <div className="shift-row shift-row-2" style={{ width: "100%" }}>
                      <input
                        className="shift-input"
                        value={d.label}
                        onChange={(e) => {
                          const next = [...days];
                          next[i] = { ...d, label: e.target.value };
                          setDays(next);
                        }}
                        placeholder={i === 0 ? "1日目" : "2日目"}
                      />
                      <input
                        className="shift-input"
                        type="date"
                        value={d.date}
                        onChange={(e) => {
                          const next = [...days];
                          next[i] = { ...d, date: e.target.value };
                          setDays(next);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="shift-panel">
              <h2 className="shift-h2">3. メンバー名</h2>
              <p className="shift-muted" style={{ marginTop: 0 }}>
                1行に1人ずつ。いま {members.length} 人です。
              </p>
              <textarea
                className="shift-textarea"
                style={{ minHeight: "9rem" }}
                value={memberText}
                onChange={(e) => setMemberText(e.target.value)}
                placeholder={"田中\n佐藤\n鈴木"}
              />
            </section>

            <section className="shift-panel">
              <h2 className="shift-h2">4. 時間帯</h2>
              <p className="shift-muted" style={{ marginTop: 0 }}>
                開始・終了を自分で決めて追加してください。休み時間は「休」にチェック。
              </p>
              <div className="shift-item-list">
                {slots.map((s, i) => (
                  <div className="shift-item" key={`slot-${i}`}>
                    <div style={{ width: "100%", display: "grid", gap: 8 }}>
                      <div className="shift-row" style={{ gridTemplateColumns: "1fr 1fr auto", gap: 6 }}>
                        <input
                          className="shift-input"
                          type="time"
                          value={s.start}
                          onChange={(e) => updateSlot(i, { start: e.target.value })}
                          aria-label="開始"
                        />
                        <input
                          className="shift-input"
                          type="time"
                          value={s.end}
                          onChange={(e) => updateSlot(i, { end: e.target.value })}
                          aria-label="終了"
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
                            onChange={(e) => updateSlot(i, { isBreak: e.target.checked })}
                          />
                          休
                        </label>
                      </div>
                      <input
                        className="shift-input"
                        value={s.label}
                        onChange={(e) => updateSlot(i, { label: e.target.value })}
                        placeholder={`${s.start}-${s.end}`}
                        aria-label="時間帯の名前（任意）"
                      />
                    </div>
                    <button
                      type="button"
                      className="shift-x"
                      aria-label="削除"
                      onClick={() => setSlots(slots.filter((_, j) => j !== i))}
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
                    setSlots([
                      ...slots,
                      {
                        start: workSlots[workSlots.length - 1]?.end || "15:00",
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

              <div style={{ height: 12 }} />
              <label className="shift-label" htmlFor="consec">
                連続シフト上限
              </label>
              <select
                id="consec"
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

              <div style={{ height: 12 }} />
              <p className="shift-muted">
                {workSlots.length}コマ ／ 1コマあたり必要 {neededPerSlot} 人
              </p>
              <div className="shift-chip-row">
                {slots.map((s, i) => (
                  <span key={`preview-${i}`} className="shift-chip" data-on={!s.isBreak}>
                    {slotLabel(s)}
                    {s.isBreak ? "（休）" : ""}
                  </span>
                ))}
              </div>
            </section>

            <section className="shift-panel">
              <h2 className="shift-h2">5. 役割と人数</h2>
              <p className="shift-muted" style={{ marginTop: 0 }}>
                各時間帯に、役割ごとの必要人数を入れます。
              </p>
              <div className="shift-item-list">
                {roles.map((r, i) => (
                  <div className="shift-item" key={`role-${i}`}>
                    <div className="shift-row shift-row-2" style={{ width: "100%" }}>
                      <input
                        className="shift-input"
                        value={r.name}
                        onChange={(e) => {
                          const next = [...roles];
                          next[i] = { ...r, name: e.target.value };
                          setRoles(next);
                        }}
                        placeholder="役割名"
                      />
                      <input
                        className="shift-input"
                        type="number"
                        min={1}
                        max={50}
                        value={r.needed}
                        onChange={(e) => {
                          const next = [...roles];
                          next[i] = { ...r, needed: Number(e.target.value) || 1 };
                          setRoles(next);
                        }}
                        aria-label="必要人数"
                      />
                    </div>
                    <button
                      type="button"
                      className="shift-x"
                      aria-label="削除"
                      onClick={() => setRoles(roles.filter((_, j) => j !== i))}
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
                  onClick={() => setRoles([...roles, { name: "役割", needed: 2 }])}
                >
                  役割を追加
                </button>
              </div>
            </section>

            {error ? <p className="shift-error">{error}</p> : null}
            <div className="shift-actions">
              <button
                type="button"
                className="shift-btn shift-btn-primary"
                disabled={busy}
                onClick={() => void onCreate()}
              >
                {busy ? "作成中…" : "2日分のシフトを作る"}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="done" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <section className="shift-panel">
              <h2 className="shift-h2">できた！共有しよう</h2>
              <p className="shift-muted" style={{ marginTop: 0 }}>
                メンバー名簿から自動で割り振り済みです。手直しは管理画面からできます。
              </p>
              <label className="shift-label">LINE用シフト表</label>
              <pre
                className="shift-link-box"
                style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}
              >
                {created.lineText}
              </pre>
              <div className="shift-actions">
                <button
                  type="button"
                  className="shift-btn shift-btn-sun"
                  onClick={() => shareLine(created.lineText)}
                >
                  LINEで送る
                </button>
                <button
                  type="button"
                  className="shift-btn shift-btn-primary"
                  onClick={() => void copy(created.lineText, "line")}
                >
                  文面をコピー
                </button>
              </div>
              {copied ? <p className="shift-success">コピーしました</p> : null}
            </section>
            <section className="shift-panel">
              <h2 className="shift-h2">シフト表（閲覧URL）</h2>
              <div className="shift-link-box">{created.memberUrl}</div>
              <div className="shift-actions">
                <button
                  type="button"
                  className="shift-btn shift-btn-ghost"
                  onClick={() => void copy(created.viewInvite, "view")}
                >
                  招待文をコピー
                </button>
                <a className="shift-btn shift-btn-ghost" href={created.memberUrl}>
                  表を開く
                </a>
              </div>
            </section>
            <section className="shift-panel">
              <h2 className="shift-h2">管理者用（自分だけ）</h2>
              <div className="shift-link-box">{created.adminUrl}</div>
              <div className="shift-actions">
                <a className="shift-btn shift-btn-primary" href={created.adminUrl}>
                  管理画面で手直し
                </a>
                <button
                  type="button"
                  className="shift-btn shift-btn-ghost"
                  onClick={() => void copy(created.adminUrl, "admin")}
                >
                  URLをコピー
                </button>
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
