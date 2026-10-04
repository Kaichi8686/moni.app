"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { InvestSimResult, RiskLevel } from "@/lib/invest-sim/types";

type Phase = "setup" | "running" | "result";

const RISK_OPTIONS: { id: RiskLevel; title: string; blurb: string }[] = [
  { id: "safe", title: "安全", blurb: "守り重視。現金多め・値動き控えめ" },
  { id: "balanced", title: "バランス", blurb: "分散してじっくり増やす" },
  { id: "growth", title: "成長", blurb: "積極配分。上下は大きくなりやすい" },
];

const RUN_STEPS = [
  "目標とリスクを読み取り中…",
  "日本株ユニバースをスキャン…",
  "ポートフォリオを組み立て中…",
  "過去相場で仮想売買を実行…",
  "レポートをまとめています…",
];

function yen(n: number) {
  return `${Math.round(n).toLocaleString("ja-JP")}円`;
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function EquityChart({ result }: { result: InvestSimResult }) {
  const points = result.equityCurve;
  if (points.length < 2) return null;

  const w = 640;
  const h = 220;
  const pad = 16;
  const xs = points.map((_, i) => i);
  const ysEq = points.map((p) => p.equity);
  const ysBm = points.map((p) => p.benchmark);
  const minY = Math.min(...ysEq, ...ysBm, result.request.goalAmount) * 0.98;
  const maxY = Math.max(...ysEq, ...ysBm, result.request.goalAmount) * 1.02;
  const xAt = (i: number) => pad + (i / (xs.length - 1)) * (w - pad * 2);
  const yAt = (v: number) => pad + (1 - (v - minY) / (maxY - minY || 1)) * (h - pad * 2);

  const line = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(v)}`).join(" ");

  const goalY = yAt(result.request.goalAmount);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label="資産推移">
      <defs>
        <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(212,175,106,0.35)" />
          <stop offset="100%" stopColor="rgba(212,175,106,0)" />
        </linearGradient>
      </defs>
      <line x1={pad} y1={goalY} x2={w - pad} y2={goalY} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 4" />
      <path d={`${line(ysEq)} L${xAt(xs.length - 1)},${h - pad} L${pad},${h - pad} Z`} fill="url(#eqFill)" />
      <path d={line(ysBm)} fill="none" stroke="rgba(148,163,184,0.85)" strokeWidth="2" />
      <path d={line(ysEq)} fill="none" stroke="#d4af6a" strokeWidth="2.5" />
    </svg>
  );
}

export function InvestSimApp() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [initialCapital, setInitialCapital] = useState(1_000_000);
  const [goalAmount, setGoalAmount] = useState(1_300_000);
  const [risk, setRisk] = useState<RiskLevel>("balanced");
  const [years, setYears] = useState<1 | 2 | 3>(3);
  const [goalLabel, setGoalLabel] = useState("将来のまとまった資金");
  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InvestSimResult | null>(null);

  const canSubmit = initialCapital >= 10_000 && goalAmount >= initialCapital;

  async function startSim() {
    if (!canSubmit) return;
    setError(null);
    setPhase("running");
    setStepIdx(0);
    setResult(null);

    let tick = 0;
    const timer = window.setInterval(() => {
      tick += 1;
      setStepIdx((s) => Math.min(RUN_STEPS.length - 1, s + 1));
      if (tick >= RUN_STEPS.length + 2) window.clearInterval(timer);
    }, 700);

    try {
      const res = await fetch("/api/invest-sim/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initialCapital,
          goalAmount,
          risk,
          years,
          goalLabel: goalLabel.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { result?: InvestSimResult; error?: string };
      window.clearInterval(timer);
      if (!res.ok || !json.result) {
        throw new Error(json.error || "失敗しました");
      }
      setStepIdx(RUN_STEPS.length - 1);
      setResult(json.result);
      setPhase("result");
    } catch (e) {
      window.clearInterval(timer);
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setPhase("setup");
    }
  }

  const recentTrades = useMemo(() => result?.trades.slice(-8).reverse() ?? [], [result]);

  return (
    <div className="invest-sim-root min-h-dvh text-[#f3efe6]">
      <style jsx global>{`
        .invest-sim-root {
          --is-ink: #0b1f1c;
          --is-pine: #14352f;
          --is-moss: #1f4d42;
          --is-gold: #d4af6a;
          --is-sand: #f3efe6;
          --is-mute: rgba(243, 239, 230, 0.72);
          background:
            radial-gradient(1200px 600px at 10% -10%, rgba(212, 175, 106, 0.18), transparent 55%),
            radial-gradient(900px 500px at 90% 10%, rgba(56, 140, 120, 0.22), transparent 50%),
            linear-gradient(165deg, #071614 0%, var(--is-ink) 40%, #0e2a25 100%);
          font-family: var(--font-noto-jp), var(--font-geist-sans), sans-serif;
        }
        .invest-sim-brand {
          font-family: var(--font-moni-script), cursive;
          font-size: clamp(3.5rem, 12vw, 6.5rem);
          line-height: 0.9;
          letter-spacing: 0.02em;
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
        .invest-sim-glow {
          animation: is-drift 14s ease-in-out infinite;
        }
      `}</style>

      <div className="relative mx-auto max-w-3xl px-5 pb-24 pt-6 sm:px-8">
        <div className="mb-6 flex items-center justify-between text-sm text-[var(--is-mute)]">
          <Link href="/" className="hover:text-[var(--is-sand)]">
            ← moni
          </Link>
          <span className="tracking-wide">SIMULATOR · NO REAL MONEY</span>
        </div>

        <AnimatePresence mode="wait">
          {phase === "setup" && (
            <motion.section
              key="setup"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45 }}
              className="relative min-h-[78dvh]"
            >
              <div
                aria-hidden
                className="invest-sim-glow pointer-events-none absolute -left-24 top-8 h-64 w-64 rounded-full bg-[rgba(212,175,106,0.12)] blur-3xl"
              />
              <p className="invest-sim-brand text-[var(--is-sand)]">moni</p>
              <h2 className="invest-sim-display mt-3 max-w-xl text-[clamp(1.75rem,5vw,2.6rem)] leading-tight text-[var(--is-sand)]">
                金額と目標を決めたら、
                <br />
                あとは投資AIに任せる。
              </h2>
              <p className="mt-4 max-w-lg text-[0.98rem] leading-relaxed text-[var(--is-mute)]">
                実資金は使いません。過去の日本株相場で、AIが銘柄選びから売買・レポートまで一気に仮想運用します。
              </p>

              <form
                className="mt-10 space-y-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  void startSim();
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
                  <span className="text-xs tracking-[0.18em] text-[var(--is-gold)]">GOAL</span>
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
                            on
                              ? "bg-[var(--is-gold)] text-[var(--is-ink)]"
                              : "bg-white/5 text-[var(--is-sand)] hover:bg-white/10"
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
                  <span className="text-xs tracking-[0.18em] text-[var(--is-gold)]">PERIOD</span>
                  <div className="mt-3 flex gap-2">
                    {([1, 2, 3] as const).map((y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => setYears(y)}
                        className={`flex-1 rounded-md py-2.5 text-sm ${
                          years === y
                            ? "bg-white text-[var(--is-ink)]"
                            : "bg-white/5 text-[var(--is-sand)] hover:bg-white/10"
                        }`}
                      >
                        過去{y}年
                      </button>
                    ))}
                  </div>
                </div>

                {error && <p className="text-sm text-rose-300">{error}</p>}

                <motion.button
                  type="submit"
                  disabled={!canSubmit}
                  whileTap={{ scale: 0.98 }}
                  className="mt-2 w-full rounded-full bg-[var(--is-gold)] px-6 py-4 text-base font-medium text-[var(--is-ink)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  投資AIにすべて任せる
                </motion.button>
              </form>
            </motion.section>
          )}

          {phase === "running" && (
            <motion.section
              key="running"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex min-h-[70dvh] flex-col justify-center"
            >
              <p className="invest-sim-brand text-5xl text-[var(--is-sand)]">moni</p>
              <p className="invest-sim-display mt-6 text-3xl text-[var(--is-gold)]">運用を組み立てています</p>
              <ul className="mt-10 space-y-3">
                {RUN_STEPS.map((label, i) => {
                  const active = i <= stepIdx;
                  return (
                    <motion.li
                      key={label}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: active ? 1 : 0.25, x: 0 }}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          active ? "bg-[var(--is-gold)]" : "bg-white/20"
                        }`}
                      />
                      {label}
                    </motion.li>
                  );
                })}
              </ul>
            </motion.section>
          )}

          {phase === "result" && result && (
            <motion.section
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-10"
            >
              <div>
                <p className="invest-sim-brand text-5xl">moni</p>
                <p className="invest-sim-display mt-4 text-3xl text-[var(--is-gold)]">
                  {result.goalReached ? "目標に届きました" : "仮想運用の結果です"}
                </p>
                <p className="mt-3 max-w-2xl text-[var(--is-mute)]">{result.aiSummary}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ["最終資産", yen(result.finalEquity)],
                  ["リターン", pct(result.totalReturn)],
                  ["最大下落", pct(result.maxDrawdown)],
                  ["売買回数", `${result.tradeCount}回`],
                ].map(([k, v]) => (
                  <div key={k} className="border-t border-white/15 pt-3">
                    <div className="text-[11px] tracking-wider text-[var(--is-mute)]">{k}</div>
                    <div className="mt-1 text-xl text-[var(--is-sand)]">{v}</div>
                  </div>
                ))}
              </div>

              <div>
                <div className="mb-2 flex items-end justify-between text-xs text-[var(--is-mute)]">
                  <span>資産推移（金） vs TOPIX連動（灰） / 点線=目標</span>
                  <span>{result.dataSource === "yahoo" ? "実相場データ" : "代替データ"}</span>
                </div>
                <EquityChart result={result} />
              </div>

              <div>
                <h3 className="invest-sim-display text-2xl text-[var(--is-gold)]">AIの運用日記</h3>
                <ol className="mt-4 space-y-4">
                  {result.diary.map((d) => (
                    <li key={`${d.date}-${d.title}`} className="border-l border-[var(--is-gold)]/50 pl-4">
                      <div className="text-xs text-[var(--is-mute)]">{d.date}</div>
                      <div className="mt-0.5 font-medium">{d.title}</div>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--is-mute)]">{d.body}</p>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <h3 className="invest-sim-display text-2xl text-[var(--is-gold)]">最終保有</h3>
                <ul className="mt-4 space-y-2">
                  {result.finalHoldings.map((h) => (
                    <li key={h.ticker} className="flex items-baseline justify-between gap-3 text-sm">
                      <span>
                        {h.name}{" "}
                        <span className="text-[var(--is-mute)]">
                          {h.shares}株 · {pct(h.weight)}
                        </span>
                      </span>
                      <span>{yen(h.value)}</span>
                    </li>
                  ))}
                  <li className="flex justify-between border-t border-white/10 pt-2 text-sm text-[var(--is-mute)]">
                    <span>現金</span>
                    <span>{yen(result.cash)}</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="invest-sim-display text-2xl text-[var(--is-gold)]">直近の売買</h3>
                <ul className="mt-4 space-y-3">
                  {recentTrades.map((t, i) => (
                    <li key={`${t.date}-${t.ticker}-${i}`} className="text-sm">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[var(--is-mute)]">{t.date}</span>
                        <span className={t.side === "BUY" ? "text-emerald-300" : "text-rose-300"}>
                          {t.side === "BUY" ? "買い" : "売り"}
                        </span>
                        <span>
                          {t.name} {t.shares}株 @{yen(t.price)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[var(--is-mute)]">{t.reason}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setPhase("setup");
                    setResult(null);
                  }}
                  className="flex-1 rounded-full border border-white/25 px-6 py-3 text-sm hover:bg-white/5"
                >
                  条件を変えてもう一度
                </button>
                <button
                  type="button"
                  onClick={() => void startSim()}
                  className="flex-1 rounded-full bg-[var(--is-gold)] px-6 py-3 text-sm font-medium text-[var(--is-ink)]"
                >
                  同じ条件でもう一度
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
