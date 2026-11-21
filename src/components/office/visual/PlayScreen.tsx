"use client";

import { useMemo } from "react";
import {
  calcMockScore,
  MOCK_EVENT,
  MOCK_HAND,
  type MockCard,
} from "@/components/office/visual/mockData";

type Props = {
  selected: string[];
  onToggle: (id: string) => void;
  hypothesisId: string | null;
  adlib: string;
  onAdlib: (v: string) => void;
  onNext: () => void;
};

function ScorePanel({
  customers,
  price,
  revenue,
  ratio,
  mult,
  cost,
}: {
  customers: number;
  price: number;
  revenue: number;
  ratio: number;
  mult: number;
  cost: number;
}) {
  const gauge = Math.min(1.4, Math.max(0, ratio)) / 1.4;
  return (
    <div className="ov-panel p-4">
      <p className="ov-muted">売上ボード</p>
      <p className="ov-num mt-2 text-center text-2xl tracking-wide">
        <span className="text-[var(--ov-mint)]">{customers}</span>
        <span className="mx-1 text-[var(--ov-muted)]">×</span>
        <span className="text-[var(--ov-gold)]">{price}</span>
        <span className="mx-1 text-[var(--ov-muted)]">＝</span>
        <span className="text-[var(--ov-accent)]">{revenue.toLocaleString("ja-JP")}</span>
      </p>
      {mult !== 1 ? (
        <p className="ov-muted mt-1 text-center">実効倍率 ×{mult.toFixed(2)}</p>
      ) : null}
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--ov-border)]">
        <div
          className="h-full rounded-full bg-[var(--ov-accent)] transition-[width] duration-300"
          style={{ width: `${gauge * 100}%` }}
        />
      </div>
      <p className="ov-muted mt-1 text-center">
        ノルマ {MOCK_EVENT.norma.toLocaleString("ja-JP")} · 達成 {(ratio * 100).toFixed(0)}%
      </p>
      <p className="ov-muted mt-1 text-center">予算 {cost}/3</p>
    </div>
  );
}

export function PlayScreen({
  selected,
  onToggle,
  hypothesisId,
  adlib,
  onAdlib,
  onNext,
}: Props) {
  const score = useMemo(
    () => calcMockScore(selected, hypothesisId),
    [selected, hypothesisId],
  );
  const cost = MOCK_HAND.filter((c) => selected.includes(c.id)).reduce((s, c) => s + c.cost, 0);

  const slots = useMemo(() => {
    const cards: (MockCard | null)[] = selected
      .map((id) => MOCK_HAND.find((c) => c.id === id) ?? null)
      .filter(Boolean) as MockCard[];
    while (cards.length < 3) cards.push(null);
    return cards.slice(0, 3);
  }, [selected]);

  return (
    <div className="space-y-3">
      <ScorePanel
        customers={score.customers}
        price={score.price}
        revenue={score.revenue}
        ratio={score.ratio}
        mult={score.mult}
        cost={cost}
      />

      <div className="ov-panel p-3">
        <p className="ov-muted mb-2">場（最大3）</p>
        <div className="grid grid-cols-3 gap-2">
          {slots.map((c, i) => (
            <div
              key={i}
              className="flex min-h-[72px] items-center justify-center rounded-xl border border-dashed border-[var(--ov-border)] px-1 text-center text-xs font-bold"
              style={{
                background: c ? "rgba(255,179,71,0.1)" : "transparent",
                transform: c ? "translateY(-3px)" : undefined,
                color: "var(--ov-text)",
              }}
            >
              {c ? c.name : "空"}
            </div>
          ))}
        </div>
      </div>

      <div className="ov-panel p-3">
        <p className="ov-muted mb-2">手札</p>
        <div className="space-y-2">
          {MOCK_HAND.map((c) => {
            const on = selected.includes(c.id);
            const wouldOver = !on && cost + c.cost > 3;
            return (
              <button
                key={c.id}
                type="button"
                disabled={wouldOver}
                onClick={() => onToggle(c.id)}
                className="ov-card-paper flex w-full items-start gap-2 px-3 py-2 text-left transition-transform disabled:opacity-40"
                style={{
                  minHeight: 44,
                  outline: on ? "2px solid var(--ov-accent)" : "none",
                  transform: on ? "translateY(-2px)" : undefined,
                }}
              >
                <span className="ov-num shrink-0 rounded-md bg-[#e8dcc0] px-1.5 py-0.5 text-xs font-bold">
                  {c.cost}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{c.name}</span>
                  <span className="block text-xs opacity-80">{c.text}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="ov-panel p-3">
        <label className="block">
          <span className="ov-muted">アドリブ（見た目のみ・40字）</span>
          <input
            value={adlib}
            onChange={(e) => onAdlib(e.target.value.slice(0, 40))}
            maxLength={40}
            placeholder="場のカードに合わせた一言"
            className="mt-1 w-full rounded-xl border border-[var(--ov-border)] bg-transparent px-3 py-2 text-sm outline-none"
            style={{ color: "var(--ov-text)", minHeight: 44 }}
          />
        </label>
      </div>

      <button
        type="button"
        className="ov-btn"
        disabled={selected.length < 1 || cost > 3}
        onClick={onNext}
      >
        営業スタート
      </button>
    </div>
  );
}
