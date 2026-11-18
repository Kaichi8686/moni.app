"use client";

import { useEffect, useState } from "react";
import type { TriggerLogEntry } from "@/lib/office/build/score";

type Props = {
  customers: number;
  price: number;
  mult: number;
  revenue: number;
  ratio: number;
  rank: string;
  coins: number;
  triggerLog: TriggerLogEntry[];
  onDone: () => void;
};

function usePrefersReduced() {
  const [v, setV] = useState(false);
  useEffect(() => {
    setV(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return v;
}

export function ScoreReveal({
  customers,
  price,
  mult,
  revenue,
  ratio,
  rank,
  coins,
  triggerLog,
  onDone,
}: Props) {
  const reduce = usePrefersReduced();
  const [logIdx, setLogIdx] = useState(reduce ? triggerLog.length : 0);
  const [shownRev, setShownRev] = useState(reduce ? revenue : 0);
  const [phase, setPhase] = useState<"log" | "rev" | "done">(reduce ? "done" : "log");

  useEffect(() => {
    if (reduce) return;
    if (phase !== "log") return;
    if (logIdx >= triggerLog.length) {
      setPhase("rev");
      return;
    }
    const t = window.setTimeout(() => setLogIdx((n) => n + 1), 450);
    return () => window.clearTimeout(t);
  }, [phase, logIdx, triggerLog.length, reduce]);

  useEffect(() => {
    if (reduce || phase !== "rev") return;
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setShownRev(Math.round(revenue * p));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setPhase("done");
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, revenue, reduce]);

  const shake =
    !reduce && phase === "done" && ratio >= 1.4
      ? "animate-[obshake_0.4s_ease]"
      : "";

  return (
    <div className={`ob-panel space-y-3 p-4 ${shake}`}>
      <style>{`@keyframes obshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}`}</style>
      <p className="ob-title text-center text-sm text-[var(--ob-gold)]">得点</p>
      <ul className="max-h-40 space-y-1 overflow-auto text-xs">
        {triggerLog.slice(0, logIdx).map((e) => (
          <li key={`${e.order}-${e.id}`} className="text-[var(--ob-muted)]">
            <span className="font-bold text-[var(--ob-text)]">{e.label}</span>
            {e.customersDelta ? ` 客${e.customersDelta > 0 ? "+" : ""}${Math.round(e.customersDelta)}` : ""}
            {e.priceDelta ? ` 単価${e.priceDelta > 0 ? "+" : ""}${Math.round(e.priceDelta)}` : ""}
            {e.multFactor ? ` ×${e.multFactor}` : ""}
          </li>
        ))}
      </ul>
      <p className="ob-num text-center text-xl">
        {customers} × {price}
        {mult !== 1 ? ` × ${mult.toFixed(2)}` : ""}
      </p>
      <p className="ob-num text-center text-3xl text-[var(--ob-accent)]">
        {shownRev.toLocaleString("ja-JP")}
      </p>
      <p className="text-center text-sm">
        ランク <span className="ob-title text-[var(--ob-gold)]">{rank}</span>
        <span className="mx-2 text-[var(--ob-muted)]">·</span>
        +{coins} コイン
      </p>
      <button
        type="button"
        className="ob-btn w-full"
        onClick={() => {
          if (phase !== "done") {
            setLogIdx(triggerLog.length);
            setShownRev(revenue);
            setPhase("done");
            return;
          }
          onDone();
        }}
      >
        {phase !== "done" ? "スキップ" : "解説を見る"}
      </button>
    </div>
  );
}
