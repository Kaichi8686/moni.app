"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { formatScheduleViewInvite } from "@/lib/shift/assign";
import { DEFAULT_SCHEDULE, type ShiftScheduleConfig } from "@/lib/shift/types";

type DayDraft = { label: string; date: string };
type RoleDraft = { name: string; needed: number };
type SlotDraft = { start: string; end: string; label: string; isBreak: boolean };

type CreatedLinks = {
  memberUrl: string;
  adminUrl: string;
  lineText: string;
  viewInvite: string;
};

type FormDraft = {
  title: string;
  note: string;
  days: DayDraft[];
  memberText: string;
  roles: RoleDraft[];
  day1Slots: SlotDraft[];
  day2Slots: SlotDraft[];
  maxConsecutive: number;
};

const DRAFT_KEY = "shift-maker:draft:v1";
const LAST_CREATED_KEY = "shift-maker:last-created:v1";

const DEFAULT_MEMBERS = "田中\n佐藤\n鈴木\n高橋\n伊藤\n渡辺";

const DEFAULT_SLOTS: SlotDraft[] = [
  { start: "09:00", end: "12:00", label: "", isBreak: false },
  { start: "12:00", end: "13:00", label: "昼休み", isBreak: true },
  { start: "13:00", end: "15:00", label: "", isBreak: false },
  { start: "15:00", end: "17:00", label: "", isBreak: false },
];

const DEFAULT_FORM: FormDraft = {
  title: "文化祭シフト",
  note: "",
  days: [
    { label: "1日目", date: "" },
    { label: "2日目", date: "" },
  ],
  memberText: DEFAULT_MEMBERS,
  roles: [
    { name: "受付", needed: 2 },
    { name: "販売", needed: 3 },
    { name: "呼び込み", needed: 2 },
  ],
  day1Slots: DEFAULT_SLOTS,
  day2Slots: DEFAULT_SLOTS,
  maxConsecutive: DEFAULT_SCHEDULE.maxConsecutive,
};

function cloneSlots(slots: SlotDraft[]): SlotDraft[] {
  return slots.map((s) => ({ ...s }));
}

function loadDraft(): FormDraft {
  if (typeof window === "undefined") {
    return {
      ...DEFAULT_FORM,
      day1Slots: cloneSlots(DEFAULT_SLOTS),
      day2Slots: cloneSlots(DEFAULT_SLOTS),
      days: DEFAULT_FORM.days.map((d) => ({ ...d })),
      roles: DEFAULT_FORM.roles.map((r) => ({ ...r })),
    };
  }
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) {
      return {
        ...DEFAULT_FORM,
        day1Slots: cloneSlots(DEFAULT_SLOTS),
        day2Slots: cloneSlots(DEFAULT_SLOTS),
        days: DEFAULT_FORM.days.map((d) => ({ ...d })),
        roles: DEFAULT_FORM.roles.map((r) => ({ ...r })),
      };
    }
    const parsed = JSON.parse(raw) as Partial<FormDraft>;
    return {
      title: typeof parsed.title === "string" ? parsed.title : DEFAULT_FORM.title,
      note: typeof parsed.note === "string" ? parsed.note : "",
      days:
        Array.isArray(parsed.days) && parsed.days.length >= 2
          ? parsed.days.slice(0, 2).map((d) => ({
              label: String(d?.label || ""),
              date: String(d?.date || ""),
            }))
          : DEFAULT_FORM.days.map((d) => ({ ...d })),
      memberText: typeof parsed.memberText === "string" ? parsed.memberText : DEFAULT_MEMBERS,
      roles:
        Array.isArray(parsed.roles) && parsed.roles.length > 0
          ? parsed.roles.map((r) => ({
              name: String(r?.name || "役割"),
              needed: Math.max(1, Number(r?.needed) || 1),
            }))
          : DEFAULT_FORM.roles.map((r) => ({ ...r })),
      day1Slots:
        Array.isArray(parsed.day1Slots) && parsed.day1Slots.length > 0
          ? parsed.day1Slots.map((s) => ({
              start: String(s?.start || "09:00"),
              end: String(s?.end || "10:00"),
              label: String(s?.label || ""),
              isBreak: Boolean(s?.isBreak),
            }))
          : cloneSlots(DEFAULT_SLOTS),
      day2Slots:
        Array.isArray(parsed.day2Slots) && parsed.day2Slots.length > 0
          ? parsed.day2Slots.map((s) => ({
              start: String(s?.start || "09:00"),
              end: String(s?.end || "10:00"),
              label: String(s?.label || ""),
              isBreak: Boolean(s?.isBreak),
            }))
          : cloneSlots(DEFAULT_SLOTS),
      maxConsecutive: Math.max(0, Number(parsed.maxConsecutive) || 0),
    };
  } catch {
    return {
      ...DEFAULT_FORM,
      day1Slots: cloneSlots(DEFAULT_SLOTS),
      day2Slots: cloneSlots(DEFAULT_SLOTS),
      days: DEFAULT_FORM.days.map((d) => ({ ...d })),
      roles: DEFAULT_FORM.roles.map((r) => ({ ...r })),
    };
  }
}

function loadLastCreated(): CreatedLinks | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_CREATED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CreatedLinks;
    if (!parsed?.adminUrl || !parsed?.memberUrl) return null;
    return parsed;
  } catch {
    return null;
  }
}

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

function DaySlotsEditor({
  title,
  slots,
  onChange,
}: {
  title: string;
  slots: SlotDraft[];
  onChange: (next: SlotDraft[]) => void;
}) {
  const workSlots = slots.filter((s) => !s.isBreak);

  function updateSlot(i: number, patch: Partial<SlotDraft>) {
    onChange(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  return (
    <div style={{ marginBottom: "1rem" }}>
      <h3 className="shift-h2" style={{ fontSize: "0.95rem", marginBottom: 8 }}>
        {title}
      </h3>
      <div className="shift-item-list">
        {slots.map((s, i) => (
          <div className="shift-item" key={`${title}-${i}`}>
            <div style={{ width: "100%", display: "grid", gap: 8 }}>
              <div className="shift-row" style={{ gridTemplateColumns: "1fr 1fr auto", gap: 6 }}>
                <input
                  className="shift-input"
                  type="time"
                  value={s.start}
                  onChange={(e) => updateSlot(i, { start: e.target.value })}
                  aria-label={`${title} 開始`}
                />
                <input
                  className="shift-input"
                  type="time"
                  value={s.end}
                  onChange={(e) => updateSlot(i, { end: e.target.value })}
                  aria-label={`${title} 終了`}
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
                aria-label={`${title} 名前`}
              />
            </div>
            <button
              type="button"
              className="shift-x"
              aria-label="削除"
              onClick={() => onChange(slots.filter((_, j) => j !== i))}
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
            onChange([
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
        <button
          type="button"
          className="shift-btn shift-btn-ghost"
          onClick={() => onChange(cloneSlots(DEFAULT_SLOTS))}
        >
          初期値に戻す
        </button>
      </div>
      <div className="shift-chip-row" style={{ marginTop: 8 }}>
        {slots.map((s, i) => (
          <span key={`${title}-p-${i}`} className="shift-chip" data-on={!s.isBreak}>
            {slotLabel(s)}
            {s.isBreak ? "（休）" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ShiftCreatePage() {
  const [hydrated, setHydrated] = useState(false);
  const [title, setTitle] = useState(DEFAULT_FORM.title);
  const [note, setNote] = useState("");
  const [days, setDays] = useState<DayDraft[]>(() => DEFAULT_FORM.days.map((d) => ({ ...d })));
  const [memberText, setMemberText] = useState(DEFAULT_MEMBERS);
  const [roles, setRoles] = useState<RoleDraft[]>(() => DEFAULT_FORM.roles.map((r) => ({ ...r })));
  const [day1Slots, setDay1Slots] = useState(() => cloneSlots(DEFAULT_SLOTS));
  const [day2Slots, setDay2Slots] = useState(() => cloneSlots(DEFAULT_SLOTS));
  const [maxConsecutive, setMaxConsecutive] = useState(DEFAULT_SCHEDULE.maxConsecutive);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedLinks | null>(null);
  const [copied, setCopied] = useState("");
  const [draftSaved, setDraftSaved] = useState(false);

  useEffect(() => {
    const draft = loadDraft();
    setTitle(draft.title);
    setNote(draft.note);
    setDays(draft.days);
    setMemberText(draft.memberText);
    setRoles(draft.roles);
    setDay1Slots(draft.day1Slots);
    setDay2Slots(draft.day2Slots);
    setMaxConsecutive(draft.maxConsecutive);
    setCreated(loadLastCreated());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const draft: FormDraft = {
      title,
      note,
      days,
      memberText,
      roles,
      day1Slots,
      day2Slots,
      maxConsecutive,
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setDraftSaved(true);
      const t = window.setTimeout(() => setDraftSaved(false), 1200);
      return () => window.clearTimeout(t);
    } catch {
      /* ignore quota */
    }
  }, [hydrated, title, note, days, memberText, roles, day1Slots, day2Slots, maxConsecutive]);

  const members = useMemo(() => parseMembers(memberText), [memberText]);
  const neededPerSlot = useMemo(
    () => roles.reduce((sum, r) => sum + Math.max(1, r.needed || 1), 0),
    [roles],
  );

  const schedule: ShiftScheduleConfig = useMemo(() => {
    const allWork = [...day1Slots, ...day2Slots].filter((s) => !s.isBreak);
    const first = allWork[0] ?? day1Slots[0];
    const last = allWork[allWork.length - 1] ?? day1Slots[day1Slots.length - 1];
    return {
      dayStart: first?.start || DEFAULT_SCHEDULE.dayStart,
      dayEnd: last?.end || DEFAULT_SCHEDULE.dayEnd,
      slotMinutes: DEFAULT_SCHEDULE.slotMinutes,
      breaks: [],
      maxConsecutive,
      buddyPairs: [],
    };
  }, [day1Slots, day2Slots, maxConsecutive]);

  async function onCreate() {
    setBusy(true);
    setError("");
    try {
      if (members.length === 0) {
        setError("メンバー名を1人以上入力してください");
        return;
      }
      const work1 = day1Slots.filter((s) => !s.isBreak);
      const work2 = day2Slots.filter((s) => !s.isBreak);
      if (work1.length === 0 || work2.length === 0) {
        setError("1日目・2日目それぞれに、シフト用の時間帯を1つ以上追加してください");
        return;
      }

      const slots = [
        ...day1Slots.map((s) => ({
          start: s.start,
          end: s.end,
          label: slotLabel(s),
          isBreak: s.isBreak,
          dayId: "d1",
        })),
        ...day2Slots.map((s) => ({
          start: s.start,
          end: s.end,
          label: slotLabel(s),
          isBreak: s.isBreak,
          dayId: "d2",
        })),
      ];

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
          slots,
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
      const links: CreatedLinks = {
        memberUrl,
        adminUrl,
        lineText: data.lineText || formatScheduleViewInvite(data.board.title, memberUrl),
        viewInvite: formatScheduleViewInvite(data.board.title, memberUrl),
      };
      setCreated(links);
      try {
        localStorage.setItem(LAST_CREATED_KEY, JSON.stringify(links));
      } catch {
        /* ignore */
      }
    } catch {
      setError("通信に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  function resetDraft() {
    setTitle(DEFAULT_FORM.title);
    setNote("");
    setDays(DEFAULT_FORM.days.map((d) => ({ ...d })));
    setMemberText(DEFAULT_MEMBERS);
    setRoles(DEFAULT_FORM.roles.map((r) => ({ ...r })));
    setDay1Slots(cloneSlots(DEFAULT_SLOTS));
    setDay2Slots(cloneSlots(DEFAULT_SLOTS));
    setMaxConsecutive(DEFAULT_SCHEDULE.maxConsecutive);
    setCreated(null);
    setError("");
    try {
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(LAST_CREATED_KEY);
    } catch {
      /* ignore */
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
        {hydrated ? (
          <p className="shift-muted" style={{ margin: "0.35rem 0 0" }}>
            入力内容はこの端末に自動保存されます
            {draftSaved ? "（保存済み）" : ""}
          </p>
        ) : null}
      </header>

      <AnimatePresence mode="wait">
        {!hydrated ? (
          <motion.div key="boot" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="shift-muted">読み込み中…</p>
          </motion.div>
        ) : !created ? (
          <motion.div key="form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <section className="shift-panel">
              <div className="shift-actions" style={{ marginTop: 0, marginBottom: "0.75rem" }}>
                <button type="button" className="shift-btn shift-btn-ghost" onClick={resetDraft}>
                  入力を初期状態に戻す
                </button>
              </div>
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
              <h2 className="shift-h2">4. 時間帯（日ごと）</h2>
              <p className="shift-muted" style={{ marginTop: 0 }}>
                1日目と2日目で別々に時間帯を決められます。休み時間は「休」にチェック。
              </p>
              <DaySlotsEditor
                title={days[0]?.label || "1日目"}
                slots={day1Slots}
                onChange={setDay1Slots}
              />
              <div className="shift-actions" style={{ marginTop: 0, marginBottom: "0.75rem" }}>
                <button
                  type="button"
                  className="shift-btn shift-btn-ghost"
                  onClick={() => setDay2Slots(cloneSlots(day1Slots))}
                >
                  1日目の時間帯を2日目にコピー
                </button>
              </div>
              <DaySlotsEditor
                title={days[1]?.label || "2日目"}
                slots={day2Slots}
                onChange={setDay2Slots}
              />

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
              <p className="shift-muted" style={{ marginTop: 10 }}>
                1コマあたり必要 {neededPerSlot} 人
              </p>
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
            <div className="shift-actions">
              <button
                type="button"
                className="shift-btn shift-btn-ghost"
                onClick={() => setCreated(null)}
              >
                保存した設定で作り直す
              </button>
              <button type="button" className="shift-btn shift-btn-ghost" onClick={resetDraft}>
                全部消して最初から
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
