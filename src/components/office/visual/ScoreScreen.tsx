"use client";

import { useEffect, useState } from "react";
import { PixelSprite } from "@/components/office/visual/PixelSprite";
import { SPRITE_COIN, SPRITE_STAR } from "@/components/office/visual/sprites";
import type { MockScore } from "@/components/office/visual/mockData";

type Props = {
  score: MockScore;
  onNext: () => void;
};

function useReduced() {
  const [v, setV] = useState(false);
  useEffect(() => {
    setV(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return v;
}

export function ScoreScreen({ score, onNext }: Props) {
  const reduce = useReduced();
  const [logIdx, setLogIdx] = useState(reduce ? score.log.length : 0);
  const [shown, setShown] = useState(reduce ? score.revenue : 0);
  const [done, setDone] = useState(reduce);

  useEffect(() => {
    if (reduce) return;
    if (done) return;
    if (logIdx < score.log.length) {
      const t = window.setTimeout(() => setLogIdx((n) => n + 1), 350);
      return () => window.clearTimeout(t);
    }
    const start = performance.now();
    const dur = 700;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setShown(Math.round(score.revenue * p));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setDone(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [logIdx, score.log.length, score.revenue, reduce, done]);

  function skip() {
    setLogIdx(score.log.length);
    setShown(score.revenue);
    setDone(true);
  }

  return (
    <div className="ov-panel space-y-3 p-4">
      <div className="flex items-center justify-center gap-2">
        <PixelSprite {...SPRITE_STAR} scale={6} title="星" />
        <p className="ov-title text-sm text-[var(--ov-gold)]">得点</p>
        <PixelSprite {...SPRITE_COIN} scale={6} title="コイン" />
      </div>

      <ul className="max-h-36 space-y-1 overflow-auto">
        {score.log.slice(0, logIdx).map((line, i) => (
          <li key={i} className="ov-muted">
            {line}
          </li>
        ))}
      </ul>

      {score.hypothesisHit ? (
        <p className="rounded-xl bg-[rgba(94,234,212,0.12)] px-3 py-2 text-sm font-bold text-[var(--ov-mint)]">
          仮説的中！ ×1.3
        </p>
      ) : (
        <p className="ov-muted">仮説は外れ（倍率そのまま）</p>
      )}

      <p className="ov-num text-center text-sm text-[var(--ov-muted)]">
        {score.customers} × {score.price}
        {score.mult !== 1 ? ` × ${score.mult}` : ""}
      </p>
      <p className="ov-num text-center text-3xl text-[var(--ov-accent)]">
        {shown.toLocaleString("ja-JP")}
      </p>
      <p className="text-center text-sm">
        ランク <span className="ov-title text-[var(--ov-gold)]">{score.rank}</span>
        <span className="mx-2 text-[var(--ov-muted)]">·</span>
        +{score.coins} コイン
      </p>

      <button
        type="button"
        className="ov-btn"
        onClick={() => {
          if (!done) skip();
          else onNext();
        }}
      >
        {done ? "解説を見る" : "スキップ"}
      </button>
    </div>
  );
}
