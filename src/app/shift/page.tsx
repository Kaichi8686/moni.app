"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

type DayDraft = { label: string; date: string };
type SlotDraft = { label: string };
type RoleDraft = { name: string; needed: number };

const DEFAULT_DAYS: DayDraft[] = [
  { label: "本番1日目", date: "" },
  { label: "本番2日目", date: "" },
];
const DEFAULT_SLOTS: SlotDraft[] = [{ label: "午前" }, { label: "午後" }];
const DEFAULT_ROLES: RoleDraft[] = [
  { name: "受付", needed: 2 },
  { name: "販売", needed: 3 },
  { name: "キッチン", needed: 2 },
];

export default function ShiftCreatePage() {
  const [title, setTitle] = useState("文化祭シフト");
  const [note, setNote] = useState("");
  const [days, setDays] = useState<DayDraft[]>(DEFAULT_DAYS);
  const [slots, setSlots] = useState<SlotDraft[]>(DEFAULT_SLOTS);
  const [roles, setRoles] = useState<RoleDraft[]>(DEFAULT_ROLES);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{
    code: string;
    adminKey: string;
    memberUrl: string;
    adminUrl: string;
    lineText: string;
  } | null>(null);
  const [copied, setCopied] = useState("");

  async function onCreate() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, note, days, slots, roles }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "作成に失敗しました");
        return;
      }
      const origin = window.location.origin;
      const memberUrl = `${origin}/shift/${data.board.code}`;
      const adminUrl = `${origin}/shift/${data.board.code}/admin?key=${encodeURIComponent(data.board.adminKey)}`;
      const lineText = [
        `【${data.board.title}】シフト希望を教えて！`,
        "",
        "下のリンクを開いて、名前と ○△× を入れてね。",
        "○＝入りたい　△＝入れる　×＝無理",
        "",
        memberUrl,
      ].join("\n");
      setCreated({
        code: data.board.code,
        adminKey: data.board.adminKey,
        memberUrl,
        adminUrl,
        lineText,
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

  async function shareLine(text: string) {
    const url = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="shift-shell">
      <div className="shift-hero-visual" aria-hidden />
      <header className="shift-brand">
        <motion.h1
          className="shift-brand-mark"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          シフト<span>合わせ</span>
        </motion.h1>
        <motion.p
          className="shift-brand-sub"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
        >
          文化祭のシフトを、みんなの希望から自動で決める。グループLINEにリンクを送って集めよう。
        </motion.p>
      </header>

      <AnimatePresence mode="wait">
        {!created ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
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
                placeholder="例: 10/25・26の本番シフト。各自○△×を入れてね"
              />
            </section>

            <section className="shift-panel">
              <h2 className="shift-h2">2. 日程</h2>
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
                        placeholder="日程名"
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
                    <button
                      type="button"
                      className="shift-x"
                      aria-label="削除"
                      onClick={() => setDays(days.filter((_, j) => j !== i))}
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
                  onClick={() => setDays([...days, { label: `日程${days.length + 1}`, date: "" }])}
                >
                  日程を追加
                </button>
              </div>
            </section>

            <section className="shift-panel">
              <h2 className="shift-h2">3. 時間帯</h2>
              <div className="shift-item-list">
                {slots.map((s, i) => (
                  <div className="shift-item" key={`slot-${i}`}>
                    <input
                      className="shift-input"
                      value={s.label}
                      onChange={(e) => {
                        const next = [...slots];
                        next[i] = { label: e.target.value };
                        setSlots(next);
                      }}
                      placeholder="例: 午前 / 1限"
                    />
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
                  onClick={() => setSlots([...slots, { label: `時間帯${slots.length + 1}` }])}
                >
                  時間帯を追加
                </button>
              </div>
            </section>

            <section className="shift-panel">
              <h2 className="shift-h2">4. 役割と人数</h2>
              <p className="shift-muted" style={{ marginTop: 0 }}>
                各時間帯に何人必要か。あとで希望を見て自動割り振りします。
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
                onClick={onCreate}
              >
                {busy ? "作成中…" : "リンクを作る"}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <section className="shift-panel">
              <h2 className="shift-h2">できた！LINEに送ろう</h2>
              <p className="shift-muted">
                メンバー用リンクをグループに送ってください。管理者用は自分だけ保存。
              </p>
              <label className="shift-label">メンバー用（みんなに送る）</label>
              <div className="shift-link-box">{created.memberUrl}</div>
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
                  onClick={() => copy(created.lineText, "line")}
                >
                  文面をコピー
                </button>
              </div>
              {copied === "line" ? <p className="shift-success">コピーしました</p> : null}
            </section>

            <section className="shift-panel">
              <h2 className="shift-h2">管理者用（自分だけ）</h2>
              <p className="shift-muted">
                希望の確認・自動割り振り・シフト表のコピーはここから。紛失注意。
              </p>
              <div className="shift-link-box">{created.adminUrl}</div>
              <div className="shift-actions">
                <a className="shift-btn shift-btn-primary" href={created.adminUrl}>
                  管理画面を開く
                </a>
                <button
                  type="button"
                  className="shift-btn shift-btn-ghost"
                  onClick={() => copy(created.adminUrl, "admin")}
                >
                  URLをコピー
                </button>
              </div>
              {copied === "admin" ? <p className="shift-success">コピーしました</p> : null}
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
