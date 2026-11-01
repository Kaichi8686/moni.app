"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, RotateCcw, Sparkles, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppBottomNav } from "@/components/AppBottomNav";
import { AppBrandHeader } from "@/components/AppBrandHeader";
import { formatYen } from "@/lib/invest-sim/math";
import type {
  InvestSimApiResponse,
  InvestSimInput,
  InvestSimMethodId,
  InvestSimResult,
} from "@/lib/invest-sim/types";
import { INVEST_SIM_METHOD_OPTIONS } from "@/lib/invest-sim/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

const STORAGE_KEY = "moni-invest-sim-v1";

type Phase = "form" | "loading" | "result";

type SavedState = {
  budgetYen: string;
  years: string;
  monthlyYen: string;
  methods: InvestSimMethodId[];
  customLimits: string;
};

function loadSaved(): Partial<SavedState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<SavedState>;
  } catch {
    return null;
  }
}

function saveSaved(state: SavedState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function GrowthChart({ result, locale }: { result: InvestSimResult; locale: "ja" | "en" }) {
  const w = 320;
  const h = 140;
  const pad = { t: 12, r: 8, b: 24, l: 8 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const maxBal = Math.max(...result.yearly.map((y) => y.balance), 1);
  const pts = result.yearly.map((row, i) => {
    const x = pad.l + (result.yearly.length <= 1 ? innerW / 2 : (i / (result.yearly.length - 1)) * innerW);
    const y = pad.t + innerH - (row.balance / maxBal) * innerH;
    return { x, y, row };
  });
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area =
    pts.length > 0
      ? `${line} L${pts[pts.length - 1]!.x.toFixed(1)},${(pad.t + innerH).toFixed(1)} L${pts[0]!.x.toFixed(1)},${(pad.t + innerH).toFixed(1)} Z`
      : "";

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={locale === "ja" ? "資産推移グラフ" : "Growth chart"}>
        <defs>
          <linearGradient id="investGrowFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f766e" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#0f766e" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#investGrowFill)" />
        <path d={line} fill="none" stroke="#0f766e" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
        {pts.length > 0 ? (
          <circle cx={pts[pts.length - 1]!.x} cy={pts[pts.length - 1]!.y} r="4" fill="#0f766e" />
        ) : null}
        <text x={pad.l} y={h - 6} className="fill-zinc-400" style={{ fontSize: 10 }}>
          {locale === "ja" ? "1年目" : "Y1"}
        </text>
        <text x={w - pad.r} y={h - 6} textAnchor="end" className="fill-zinc-400" style={{ fontSize: 10 }}>
          {locale === "ja" ? `${result.yearly.length}年目` : `Y${result.yearly.length}`}
        </text>
      </svg>
    </div>
  );
}

export function InvestSimApp() {
  const { tx, locale } = useI18n();
  const [phase, setPhase] = useState<Phase>("form");
  const [budgetYen, setBudgetYen] = useState("300000");
  const [years, setYears] = useState("10");
  const [monthlyYen, setMonthlyYen] = useState("10000");
  const [methods, setMethods] = useState<InvestSimMethodId[]>(["nisa_only", "index_only", "no_crypto"]);
  const [customLimits, setCustomLimits] = useState("");
  const [result, setResult] = useState<InvestSimResult | null>(null);
  const [mode, setMode] = useState<"gemini" | "demo" | null>(null);
  const [error, setError] = useState("");
  const [storageReady, setStorageReady] = useState(false);

  /* Restore persisted form after mount (localStorage is client-only). */
  useEffect(() => {
    const saved = loadSaved();
    /* eslint-disable react-hooks/set-state-in-effect -- intentional hydrate-from-storage */
    if (saved?.budgetYen != null) setBudgetYen(String(saved.budgetYen));
    if (saved?.years != null) setYears(String(saved.years));
    if (saved?.monthlyYen != null) setMonthlyYen(String(saved.monthlyYen));
    if (Array.isArray(saved?.methods)) setMethods(saved.methods);
    if (typeof saved?.customLimits === "string") setCustomLimits(saved.customLimits);
    setStorageReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    saveSaved({ budgetYen, years, monthlyYen, methods, customLimits });
  }, [storageReady, budgetYen, years, monthlyYen, methods, customLimits]);

  const toggleMethod = (id: InvestSimMethodId) => {
    setMethods((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const inputPreview = useMemo(() => {
    const b = Number(budgetYen.replace(/,/g, "")) || 0;
    const y = Number(years) || 0;
    const m = Number(monthlyYen.replace(/,/g, "")) || 0;
    return { b, y, m };
  }, [budgetYen, years, monthlyYen]);

  const canSubmit = (inputPreview.b > 0 || inputPreview.m > 0) && inputPreview.y >= 1 && inputPreview.y <= 50;

  const runSim = useCallback(async () => {
    if (!canSubmit) return;
    setError("");
    setPhase("loading");
    const payload: InvestSimInput = {
      budgetYen: inputPreview.b,
      years: Math.round(inputPreview.y),
      monthlyYen: inputPreview.m,
      methods,
      customLimits: customLimits.trim(),
    };
    try {
      const res = await fetch("/api/invest-sim/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as InvestSimApiResponse;
      if (!data.ok) {
        setError(data.error || tx("シミュレーションに失敗しました。", "Simulation failed."));
        setPhase("form");
        return;
      }
      setResult(data.result);
      setMode(data.mode);
      setPhase("result");
    } catch {
      setError(tx("通信エラーです。もう一度お試しください。", "Network error. Please try again."));
      setPhase("form");
    }
  }, [canSubmit, customLimits, inputPreview, methods, tx]);

  const resetForm = () => {
    setPhase("form");
    setResult(null);
    setMode(null);
    setError("");
  };

  return (
    <div className="relative min-h-[100dvh] bg-[#f6f7f4] pb-bottom-nav text-zinc-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[42vh] bg-[radial-gradient(ellipse_80%_60%_at_20%_0%,rgba(15,118,110,0.12),transparent_55%),radial-gradient(ellipse_70%_50%_at_90%_10%,rgba(24,24,27,0.05),transparent_50%)]"
      />

      <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-[#f6f7f4]/90 backdrop-blur-md">
        <div className="mx-auto max-w-lg px-4 pb-1 pt-1">
          <AppBrandHeader
            bare
            left={
              <Link href="/idea" className="text-[13px] font-semibold text-teal-800 hover:underline">
                {tx("← AI", "← AI")}
              </Link>
            }
            right={
              phase === "result" ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-zinc-500 hover:text-zinc-800"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  {tx("条件を変える", "Edit inputs")}
                </button>
              ) : (
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  {tx("シミュ", "Sim")}
                </span>
              )
            }
          />
        </div>
      </header>

      <main className="relative mx-auto max-w-lg px-4 pb-10 pt-5">
        <AnimatePresence mode="wait">
          {phase === "form" || phase === "loading" ? (
            <motion.section
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28 }}
              className="space-y-7"
            >
              <div>
                <p className="font-[family-name:var(--font-display)] text-[2.15rem] leading-[1.05] tracking-tight text-zinc-900 sm:text-[2.35rem]">
                  {tx("投資シミュレーター", "Invest simulator")}
                </p>
                <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-zinc-600">
                  {tx(
                    "予算・年数・方法の限定を入れると、AIが学習用シミュレーションを返します。",
                    "Enter budget, years, and method limits — AI runs a learning simulation.",
                  )}
                </p>
              </div>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold tracking-wide text-zinc-500">
                  {tx("予算（初期資金・円）", "Budget (starting capital, JPY)")}
                </span>
                <input
                  inputMode="numeric"
                  className="w-full rounded-2xl border border-zinc-300/90 bg-white px-4 py-3.5 text-[17px] outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
                  value={budgetYen}
                  onChange={(e) => setBudgetYen(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="300000"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold tracking-wide text-zinc-500">
                  {tx("かける年", "Years")}
                </span>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={40}
                    value={Math.min(40, Math.max(1, Number(years) || 1))}
                    onChange={(e) => setYears(e.target.value)}
                    className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-200 accent-teal-800"
                  />
                  <input
                    inputMode="numeric"
                    className="w-16 rounded-xl border border-zinc-300 bg-white px-2 py-2 text-center text-[15px] font-semibold outline-none focus:border-teal-700"
                    value={years}
                    onChange={(e) => setYears(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
                  />
                  <span className="text-sm text-zinc-500">{tx("年", "yrs")}</span>
                </div>
              </label>

              <label className="block space-y-2">
                <span className="text-[12px] font-semibold tracking-wide text-zinc-500">
                  {tx("毎月の積立（任意・円）", "Monthly contribution (optional, JPY)")}
                </span>
                <input
                  inputMode="numeric"
                  className="w-full rounded-2xl border border-zinc-300/90 bg-white px-4 py-3.5 text-[17px] outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
                  value={monthlyYen}
                  onChange={(e) => setMonthlyYen(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="10000"
                />
              </label>

              <div className="space-y-2.5">
                <span className="text-[12px] font-semibold tracking-wide text-zinc-500">
                  {tx("方法の限定", "Method limits")}
                </span>
                <div className="flex flex-wrap gap-2">
                  {INVEST_SIM_METHOD_OPTIONS.map((opt) => {
                    const on = methods.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleMethod(opt.id)}
                        aria-pressed={on}
                        className={`rounded-full px-3.5 py-2 text-[12px] font-semibold transition ${
                          on
                            ? "bg-zinc-900 text-white"
                            : "border border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
                        }`}
                      >
                        {tx(opt.labelJa, opt.labelEn)}
                      </button>
                    );
                  })}
                </div>
                <textarea
                  className="min-h-[88px] w-full resize-none rounded-2xl border border-zinc-300/90 bg-white px-4 py-3 text-[14px] leading-relaxed outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
                  placeholder={tx(
                    "追加の限定（例: 毎月3万円まで / 生活防衛資金は触らない）",
                    "Extra limits (e.g. max ¥30k/mo, don’t touch emergency fund)",
                  )}
                  value={customLimits}
                  onChange={(e) => setCustomLimits(e.target.value.slice(0, 500))}
                />
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <button
                type="button"
                disabled={!canSubmit || phase === "loading"}
                onClick={() => void runSim()}
                className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 text-[15px] font-semibold text-white shadow-[0_10px_28px_rgba(15,23,42,0.14)] transition hover:bg-zinc-800 disabled:opacity-40"
              >
                {phase === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    {tx("AIがシミュレーション中…", "AI is simulating…")}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" aria-hidden />
                    {tx("投資AIにシミュレーションさせる", "Run investment AI sim")}
                  </>
                )}
              </button>

              <p className="text-[11px] leading-relaxed text-zinc-400">
                {tx(
                  "学習用です。投資助言や特定商品の推奨ではありません。入力はこの端末に保存されます。",
                  "For learning only — not investment advice. Inputs stay on this device.",
                )}
              </p>
            </motion.section>
          ) : null}

          {phase === "result" && result ? (
            <motion.section
              key="result"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.32 }}
              className="space-y-8"
            >
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-900/90 px-2.5 py-1 text-[11px] font-semibold text-teal-50">
                    <TrendingUp className="h-3 w-3" aria-hidden />
                    {mode === "demo"
                      ? tx("デモ結果", "Demo result")
                      : tx("AIシミュレーション", "AI simulation")}
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {tx(`想定年率 約${result.assumedAnnualReturnPct}%`, `~${result.assumedAnnualReturnPct}% / yr`)}
                  </span>
                </div>
                <h2 className="font-[family-name:var(--font-display)] text-[1.85rem] leading-tight tracking-tight text-zinc-900">
                  {result.title}
                </h2>
                <p className="mt-2 text-[14px] leading-relaxed text-zinc-600">{result.summary}</p>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-5 border-y border-zinc-200/90 py-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    {tx("最終見込み", "Projected end")}
                  </p>
                  <p className="mt-1 text-[1.35rem] font-semibold tracking-tight text-zinc-900">
                    {formatYen(result.finalBalance, locale)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    {tx("想定の増え分", "Est. gain")}
                  </p>
                  <p className="mt-1 text-[1.35rem] font-semibold tracking-tight text-teal-800">
                    +{formatYen(result.estimatedGain, locale)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    {tx("元本合計", "Total put in")}
                  </p>
                  <p className="mt-1 text-[15px] font-semibold text-zinc-800">
                    {formatYen(result.totalContributed, locale)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    {tx("条件", "Inputs")}
                  </p>
                  <p className="mt-1 text-[15px] font-semibold text-zinc-800">
                    {formatYen(inputPreview.b, locale)}
                    {inputPreview.m > 0 ? ` + ${formatYen(inputPreview.m, locale)}/${tx("月", "mo")}` : ""}
                    {` · ${Math.round(inputPreview.y)}${tx("年", "y")}`}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-[13px] font-bold text-zinc-900">{tx("資産の増え方（イメージ）", "Growth path")}</h3>
                <motion.div
                  initial={{ opacity: 0, scaleY: 0.92 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  transition={{ delay: 0.08, duration: 0.35 }}
                  className="mt-2 origin-bottom"
                >
                  <GrowthChart result={result} locale={locale} />
                </motion.div>
              </div>

              <div>
                <h3 className="text-[13px] font-bold text-zinc-900">{tx("配分イメージ", "Allocation")}</h3>
                <ul className="mt-3 space-y-3">
                  {result.allocation.map((a, i) => (
                    <motion.li
                      key={`${a.name}-${i}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * i, duration: 0.25 }}
                    >
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="text-[14px] font-semibold text-zinc-900">{a.name}</span>
                        <span className="text-[13px] font-semibold tabular-nums text-teal-900">{a.percent}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200">
                        <motion.div
                          className="h-full rounded-full bg-teal-800"
                          initial={{ width: 0 }}
                          animate={{ width: `${clampPct(a.percent)}%` }}
                          transition={{ delay: 0.1 + 0.05 * i, duration: 0.45, ease: "easeOut" }}
                        />
                      </div>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500">{a.reason}</p>
                    </motion.li>
                  ))}
                </ul>
              </div>

              {result.yearly.length > 0 ? (
                <div>
                  <h3 className="text-[13px] font-bold text-zinc-900">{tx("年ごとの見込み", "Year by year")}</h3>
                  <div className="mt-2 max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-[12px]">
                      <thead className="sticky top-0 bg-[#f6f7f4] text-zinc-400">
                        <tr>
                          <th className="py-1.5 font-semibold">{tx("年", "Yr")}</th>
                          <th className="py-1.5 font-semibold">{tx("残高", "Balance")}</th>
                          <th className="py-1.5 font-semibold">{tx("元本", "In")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.yearly.map((row) => (
                          <tr key={row.year} className="border-t border-zinc-100">
                            <td className="py-1.5 tabular-nums text-zinc-600">{row.year}</td>
                            <td className="py-1.5 tabular-nums font-medium text-zinc-900">
                              {formatYen(row.balance, locale)}
                            </td>
                            <td className="py-1.5 tabular-nums text-zinc-500">
                              {formatYen(row.contributed, locale)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {result.nextSteps.length > 0 ? (
                <div>
                  <h3 className="text-[13px] font-bold text-zinc-900">{tx("次にやること", "Next steps")}</h3>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[13px] leading-relaxed text-zinc-700">
                    {result.nextSteps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {result.risks.length > 0 ? (
                <div>
                  <h3 className="text-[13px] font-bold text-zinc-900">{tx("注意・リスク", "Risks")}</h3>
                  <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[13px] leading-relaxed text-zinc-600">
                    {result.risks.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {result.assumptions.length > 0 ? (
                <div>
                  <h3 className="text-[13px] font-bold text-zinc-900">{tx("前提", "Assumptions")}</h3>
                  <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[12px] leading-relaxed text-zinc-500">
                    {result.assumptions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p className="border-t border-zinc-200 pt-4 text-[11px] leading-relaxed text-zinc-400">
                {result.disclaimer}
              </p>

              <button
                type="button"
                onClick={resetForm}
                className="min-h-[48px] w-full rounded-2xl border border-zinc-300 bg-white text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                {tx("条件を変えて再シミュレーション", "Change inputs & re-run")}
              </button>
            </motion.section>
          ) : null}
        </AnimatePresence>
      </main>

      <AppBottomNav />
    </div>
  );
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}
