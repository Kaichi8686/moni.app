"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { formatScheduleViewInvite } from "@/lib/shift/assign";
import { generateSlotsFromSchedule } from "@/lib/shift/slots";
import { DEFAULT_SCHEDULE, type ShiftBreak, type ShiftScheduleConfig } from "@/lib/shift/types";

type DayDraft = { label: string; date: string };
type RoleDraft = { name: string; needed: number };

const DEFAULT_MEMBERS = "田中\n佐藤\n鈴木\n高橋\n伊藤\n渡辺";

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
  const [dayStart, setDayStart] = useState(DEFAULT_SCHEDULE.dayStart);
  const [dayEnd, setDayEnd] = useState(DEFAULT_SCHEDULE.dayEnd);
  const [slotMinutes, setSlotMinutes] = useState(DEFAULT_SCHEDULE.slotMinutes);
  const [maxConsecutive, setMaxConsecutive] = useState(DEFAULT_SCHEDULE.maxConsecutive);
  const [breaks, setBreaks] = useState<ShiftBreak[]>(DEFAULT_SCHEDULE.breaks);
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

  const schedule: ShiftScheduleConfig = useMemo(
    () => ({
      dayStart,
      dayEnd,
      slotMinutes,
      breaks,
      maxConsecutive,
      buddyPairs: [],
    }),
    [breaks, dayEnd, dayStart, maxConsecutive, slotMinutes],
  );

  const previewSlots = useMemo(() => generateSlotsFromSchedule(schedule), [schedule]);
  const neededPerSlot = useMemo(
    () => roles.reduce((sum, r) => sum + Math.max(1, r.needed || 1), 0),
    [roles],
  );

  async function onCreate() {
    setBusy(true);
    setError("");
    try {
      if (members.length === 0) {
        setError("メンバー名を1人以上入力してください");
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
                開始〜終了を、指定した分数ごとに切り替えます。休み時間は誰も入りません。
              </p>
              <div className="shift-row shift-row-2">
                <div>
                  <label className="shift-label" htmlFor="start">
                    開始
                  </label>
                  <input
                    id="start"
                    className="shift-input"
                    type="time"
                    value={dayStart}
                    onChange={(e) => setDayStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="shift-label" htmlFor="end">
                    終了
                  </label>
                  <input
                    id="end"
                    className="shift-input"
                    type="time"
                    value={dayEnd}
                    onChange={(e) => setDayEnd(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ height: 12 }} />
              <div className="shift-row shift-row-2">
                <div>
                  <label className="shift-label" htmlFor="mins">
                    何分ごとに変えるか
                  </label>
                  <div className="shift-row" style={{ gridTemplateColumns: "1fr auto", alignItems: "center" }}>
                    <input
                      id="mins"
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
                </div>
              </div>

              <div style={{ height: 14 }} />
              <h3 className="shift-h2" style={{ fontSize: "0.95rem" }}>
                休み時間
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
                        placeholder="昼休み"
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
                      aria-label="削除"
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
                      { id: `br${breaks.length + 1}`, label: "休み時間", start: "15:00", end: "15:30" },
                    ])
                  }
                >
                  休み時間を追加
                </button>
              </div>

              <div style={{ height: 12 }} />
              <p className="shift-muted">
                プレビュー（{previewSlots.filter((s) => !s.isBreak).length}コマ）／1コマあたり必要{" "}
                {neededPerSlot} 人
              </p>
              <div className="shift-chip-row">
                {previewSlots.map((s) => (
                  <span key={s.id} className="shift-chip" data-on={!s.isBreak}>
                    {s.label}
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
