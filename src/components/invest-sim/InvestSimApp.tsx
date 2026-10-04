"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ExperimentDurationDays,
  ExperimentSession,
  RiskLevel,
  TickResponse,
} from "@/lib/invest-sim/types";

const STORAGE_KEY = "moni-invest-experiment-v2";

type Phase = "setup" | "live";

const RISK_OPTIONS: { id: RiskLevel; title: string; blurb: string }[] = [
  { id: "safe", title: "安全", blurb: "守り重視。現金多め" },
  { id: "balanced", title: "バランス", blurb: "分散してじっくり" },
  { id: "growth", title: "成長", blurb: "積極的にゴールへ" },
];

const DURATION_OPTIONS: { days: ExperimentDurationDays; label: string }[] = [
  { days: 30, label: "30日" },
  { days: 90, label: "90日" },
  { days: 180, label: "180日" },
  { days: 365, label: "1年" },
];

function yen(n: number) {
  return `${Math.round(n).toLocaleString("ja-JP")}円`;
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function loadSession(): ExperimentSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExperimentSession;
    if (parsed?.version !== 2) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveSession(session: ExperimentSession | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function ProgressBar({ value, max, tone = "gold" }: { value: number; max: number; tone?: "gold" | "moss" }) {
  const ratio = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <motion.div
        className={`h-full rounded-full ${tone === "gold" ? "bg-[var(--is-gold)]" : "bg-emerald-400/80"}`}
        initial={{ width: 0 }}
        animate={{ width: `${ratio * 100}%` }}
        transition={{ duration: 0.6 }}
      />
    </div>
  );
}

function MiniEquity({ session }: { session: ExperimentSession }) {
  const pts = session.equityCurve;
  if (pts.length < 2) {
    return (
      <p className="text-sm text-[var(--is-mute)]">
        日々の更新が進むと、ここに資産の軌跡が伸びていきます。
      </p>
    );
  }
  const w = 640;
  const h = 160;
  const pad = 12;
  const ys = pts.map((p) => p.equity);
  const goal = session.setup.goalAmount;
  const minY = Math.min(...ys, goal) * 0.98;
  const maxY = Math.max(...ys, goal) * 1.02;
  const xAt = (i: number) => pad + (i / (pts.length - 1)) * (w - pad * 2);
  const yAt = (v: number) => pad + (1 - (v - minY) / (maxY - minY || 1)) * (h - pad * 2);
  const line = ys.map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(v)}`).join(" ");
  const goalY = yAt(goal);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label="資産の軌跡">
      <line x1={pad} y1={goalY} x2={w - pad} y2={goalY} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 4" />
      <path d={line} fill="none" stroke="#d4af6a" strokeWidth="2.5" />
    </svg>
  );
}

export function InvestSimApp() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [session, setSession] = useState<ExperimentSession | null>(null);
  const [initialCapital, setInitialCapital] = useState(1_000_000);
  const [goalAmount, setGoalAmount] = useState(1_300_000);
  const [risk, setRisk] = useState<RiskLevel>("balanced");
  const [durationDays, setDurationDays] = useState<ExperimentDurationDays>(90);
  const [goalLabel, setGoalLabel] = useState("期間内の目標資金");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      setSession(saved);
      setPhase("live");
    }
  }, []);

  const persist = useCallback((next: ExperimentSession | null) => {
    setSession(next);
    saveSession(next);
  }, []);

  const latestBriefing = session?.briefings.at(-1) ?? null;
  const equity = latestBriefing?.equity ?? session?.setup.initialCapital ?? 0;
  const daysTotal = session?.setup.durationDays ?? durationDays;
  const daysLeft = latestBriefing?.daysRemaining ?? daysTotal;
  const daysElapsed = Math.max(0, daysTotal - daysLeft);

  const statusLabel = useMemo(() => {
    if (!session) return "";
    if (session.status === "goal_reached") return "目標達成";
    if (session.status === "finished") return "期間終了";
    if (session.status === "stopped") return "停止中";
    return "実験中";
  }, [session]);

  async function start() {
    if (initialCapital < 10_000 || goalAmount < initialCapital) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/invest-sim/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initialCapital,
          goalAmount,
          risk,
          durationDays,
          goalLabel: goalLabel.trim() || undefined,
        }),
      });
      const json = (await res.json()) as TickResponse & { error?: string };
      if (!res.ok || !json.session) throw new Error(json.error || "開始に失敗しました");
      persist(json.session);
      setMessage(json.message);
      setPhase("live");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  async function tick() {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/invest-sim/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session }),
      });
      const json = (await res.json()) as TickResponse & { error?: string };
      if (!res.ok || !json.session) throw new Error(json.error || "更新に失敗しました");
      persist(json.session);
      setMessage(json.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    persist(null);
    setPhase("setup");
    setMessage(null);
    setError(null);
  }

  return (
    <div className="invest-sim-root min-h-dvh text-[#f3efe6]">
      <style jsx global>{`
        .invest-sim-root {
          --is-ink: #0b1f1c;
          --is-gold: #d4af6a;
          --is-sand: #f3efe6;
          --is-mute: rgba(243, 239, 230, 0.72);
          background:
            radial-gradient(1100px 520px at 12% -8%, rgba(212, 175, 106, 0.16), transparent 55%),
            radial-gradient(800px 480px at 92% 8%, rgba(56, 140, 120, 0.2), transparent 50%),
            linear-gradient(165deg, #071614 0%, var(--is-ink) 42%, #0e2a25 100%);
          font-family: var(--font-noto-jp), var(--font-geist-sans), sans-serif;
        }
        .invest-sim-brand {
          font-family: var(--font-moni-script), cursive;
          font-size: clamp(3.2rem, 11vw, 5.8rem);
          line-height: 0.9;
        }
        .invest-sim-display {
          font-family: var(--font-instrument-serif), serif;
          font-style: italic;
        }
        @keyframes is-drift {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(2%, -1%, 0) scale(1.03); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }
        .invest-sim-glow { animation: is-drift 14s ease-in-out infinite; }
      `}</style>

      <div className="relative mx-auto max-w-3xl px-5 pb-28 pt-6 sm:px-8">
        <div className="mb-6 flex items-center justify-between text-sm text-[var(--is-mute)]">
          <Link href="/" className="hover:text-[var(--is-sand)]">
            ← moni
          </Link>
          <span className="tracking-wide">LIVE EXPERIMENT · NO REAL MONEY</span>
        </div>

        <AnimatePresence mode="wait">
          {phase === "setup" && (
            <motion.section
              key="setup"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.45 }}
              className="relative"
            >
              <div
                aria-hidden
                className="invest-sim-glow pointer-events-none absolute -left-20 top-6 h-56 w-56 rounded-full bg-[rgba(212,175,106,0.12)] blur-3xl"
              />
              <p className="invest-sim-brand">moni</p>
              <h2 className="invest-sim-display mt-3 max-w-xl text-[clamp(1.7rem,4.8vw,2.5rem)] leading-tight">
                今日から期限まで、
                <br />
                AIと一緒にゴールを追う。
              </h2>
              <p className="mt-4 max-w-lg text-[0.98rem] leading-relaxed text-[var(--is-mute)]">
                過去データを一気に回して結果を出すアプリではありません。資金と目標・期間を決めたら、実際の株の動きを日々解説しながら、期限までにAIが目標を目指します。
              </p>

              <form
                className="mt-10 space-y-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  void start();
                }}
              >
                <label className="block">
                  <span className="text-xs tracking-[0.18em] text-[var(--is-gold)]">INITIAL CAPITAL</span>
                  <div className="mt-2 flex items-baseline gap-2 border-b border-white/20 pb-2">
                    <input
                      type="number"
                      min={10000}
                      step={10000}
                      value={initialCapital}
                      onChange={(e) => setInitialCapital(Number(e.target.value))}
                      className="w-full bg-transparent text-3xl outline-none sm:text-4xl"
                    />
                    <span className="text-[var(--is-mute)]">円</span>
                  </div>
                </label>

                <label className="block">
                  <span className="text-xs tracking-[0.18em] text-[var(--is-gold)]">GOAL BY DEADLINE</span>
                  <div className="mt-2 flex items-baseline gap-2 border-b border-white/20 pb-2">
                    <input
                      type="number"
                      min={initialCapital}
                      step={10000}
                      value={goalAmount}
                      onChange={(e) => setGoalAmount(Number(e.target.value))}
                      className="w-full bg-transparent text-3xl outline-none sm:text-4xl"
                    />
                    <span className="text-[var(--is-mute)]">円</span>
                  </div>
                  <input
                    type="text"
                    value={goalLabel}
                    onChange={(e) => setGoalLabel(e.target.value)}
                    placeholder="目標の名前（任意）"
                    className="mt-3 w-full border-b border-white/10 bg-transparent pb-2 text-sm text-[var(--is-mute)] outline-none placeholder:text-white/30"
                  />
                </label>

                <div>
                  <span className="text-xs tracking-[0.18em] text-[var(--is-gold)]">RISK</span>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {RISK_OPTIONS.map((opt) => {
                      const on = risk === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setRisk(opt.id)}
                          className={`rounded-md px-2 py-3 text-left transition ${
                            on ? "bg-[var(--is-gold)] text-[var(--is-ink)]" : "bg-white/5 hover:bg-white/10"
                          }`}
                        >
                          <div className="text-sm font-medium">{opt.title}</div>
                          <div className={`mt-1 text-[10px] leading-snug ${on ? "text-[var(--is-ink)]/70" : "text-[var(--is-mute)]"}`}>
                            {opt.blurb}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="text-xs tracking-[0.18em] text-[var(--is-gold)]">EXPERIMENT LENGTH</span>
                  <p className="mt-1 text-xs text-[var(--is-mute)]">今日からこの期間、日々の相場を追い続けます</p>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {DURATION_OPTIONS.map((opt) => (
                      <button
                        key={opt.days}
                        type="button"
                        onClick={() => setDurationDays(opt.days)}
                        className={`rounded-md py-2.5 text-sm ${
                          durationDays === opt.days
                            ? "bg-white text-[var(--is-ink)]"
                            : "bg-white/5 hover:bg-white/10"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {error && <p className="text-sm text-rose-300">{error}</p>}

                <motion.button
                  type="submit"
                  disabled={loading || initialCapital < 10_000 || goalAmount < initialCapital}
                  whileTap={{ scale: 0.98 }}
                  className="w-full rounded-full bg-[var(--is-gold)] px-6 py-4 text-base font-medium text-[var(--is-ink)] disabled:opacity-40"
                >
                  {loading ? "実験を準備中…" : "実験を始める（実資金は使いません）"}
                </motion.button>
              </form>
            </motion.section>
          )}

          {phase === "live" && session && (
            <motion.section
              key="live"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div>
                <div className="flex items-end justify-between gap-3">
                  <p className="invest-sim-brand text-5xl">moni</p>
                  <span className="rounded-full border border-white/20 px-3 py-1 text-xs tracking-wide">
                    {statusLabel}
                  </span>
                </div>
                <p className="invest-sim-display mt-3 text-2xl text-[var(--is-gold)] sm:text-3xl">
                  {session.setup.goalLabel || "目標"}まで、あと {daysLeft} 日
                </p>
                <p className="mt-2 text-sm text-[var(--is-mute)]">
                  {session.startDate} → {session.endDate} ／ リスク:{" "}
                  {RISK_OPTIONS.find((r) => r.id === session.setup.risk)?.title}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>目標進捗</span>
                  <span>
                    {yen(equity)} / {yen(session.setup.goalAmount)}
                  </span>
                </div>
                <ProgressBar value={equity} max={session.setup.goalAmount} />
                <div className="flex justify-between text-sm">
                  <span>期間の経過</span>
                  <span>
                    {daysElapsed} / {daysTotal} 日
                  </span>
                </div>
                <ProgressBar value={daysElapsed} max={daysTotal} tone="moss" />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void tick()}
                  disabled={loading || session.status === "finished" || session.status === "stopped"}
                  className="flex-1 rounded-full bg-[var(--is-gold)] px-6 py-3.5 text-sm font-medium text-[var(--is-ink)] disabled:opacity-40"
                >
                  {loading ? "相場を確認中…" : "今日の相場を追う"}
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-full border border-white/25 px-6 py-3.5 text-sm hover:bg-white/5"
                >
                  実験をやり直す
                </button>
              </div>

              {message && (
                <p className="rounded-md bg-white/5 px-4 py-3 text-sm leading-relaxed text-[var(--is-mute)]">
                  {message}
                </p>
              )}
              {error && <p className="text-sm text-rose-300">{error}</p>}

              {latestBriefing && (
                <motion.article
                  key={latestBriefing.date + latestBriefing.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border-t border-white/15 pt-6"
                >
                  <p className="text-xs tracking-[0.18em] text-[var(--is-gold)]">LATEST AI BRIEFING</p>
                  <h3 className="invest-sim-display mt-2 text-2xl">{latestBriefing.title}</h3>
                  <p className="mt-3 leading-relaxed text-[var(--is-mute)]">{latestBriefing.marketSummary}</p>
                  <ul className="mt-4 space-y-2">
                    {latestBriefing.moves.map((m) => (
                      <li key={m.ticker} className="text-sm">
                        <span className={m.changePct >= 0 ? "text-emerald-300" : "text-rose-300"}>
                          {m.changePct >= 0 ? "+" : ""}
                          {(m.changePct * 100).toFixed(1)}%
                        </span>{" "}
                        <span>{m.note}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-sm leading-relaxed">{latestBriefing.aiAction}</p>
                  <p className="mt-2 text-sm text-[var(--is-gold)]">{latestBriefing.paceComment}</p>
                </motion.article>
              )}

              <div>
                <h3 className="invest-sim-display text-2xl text-[var(--is-gold)]">資産の軌跡</h3>
                <div className="mt-3">
                  <MiniEquity session={session} />
                </div>
              </div>

              <div>
                <h3 className="invest-sim-display text-2xl text-[var(--is-gold)]">いまの保有</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {session.positions.length === 0 && (
                    <li className="text-[var(--is-mute)]">まだ保有なし（更新でAIが組み始めます）</li>
                  )}
                  {session.positions.map((p) => (
                    <li key={p.ticker} className="flex justify-between gap-3">
                      <span>
                        {p.name}{" "}
                        <span className="text-[var(--is-mute)]">{p.shares}株</span>
                      </span>
                      <span className="text-[var(--is-mute)]">平均 {yen(p.avgPrice)}</span>
                    </li>
                  ))}
                  <li className="flex justify-between border-t border-white/10 pt-2 text-[var(--is-mute)]">
                    <span>現金</span>
                    <span>{yen(session.cash)}</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="invest-sim-display text-2xl text-[var(--is-gold)]">これまでの日誌</h3>
                <ol className="mt-4 space-y-5">
                  {[...session.briefings].reverse().map((b) => (
                    <li key={`${b.date}-${b.title}`} className="border-l border-[var(--is-gold)]/45 pl-4">
                      <div className="text-xs text-[var(--is-mute)]">{b.date}</div>
                      <div className="mt-0.5 font-medium">{b.title}</div>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--is-mute)]">{b.marketSummary}</p>
                      <p className="mt-1 text-sm">{b.aiAction}</p>
                    </li>
                  ))}
                </ol>
              </div>

              {session.trades.length > 0 && (
                <div>
                  <h3 className="invest-sim-display text-2xl text-[var(--is-gold)]">売買ログ</h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    {[...session.trades].reverse().slice(0, 12).map((t, i) => (
                      <li key={`${t.date}-${t.ticker}-${i}`}>
                        <span className="text-[var(--is-mute)]">{t.date}</span>{" "}
                        <span className={t.side === "BUY" ? "text-emerald-300" : "text-rose-300"}>
                          {t.side === "BUY" ? "買い" : "売り"}
                        </span>{" "}
                        {t.name} {t.shares}株 @{yen(t.price)}
                        <div className="text-[var(--is-mute)]">{t.reason}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs leading-relaxed text-[var(--is-mute)]">
                これは仮想の投資実験です。1回の更新では最大1営業日分だけ進みます。毎日（または相場が動いたあと）「今日の相場を追う」で、AIの解説を積み重ねてください。リターン {pct(equity / session.setup.initialCapital - 1)}。
                データ: {session.dataSource === "yahoo" ? "実相場" : session.dataSource === "mixed" ? "実相場+補完" : "代替データ"}。
              </p>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
