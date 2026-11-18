"use client";

import { useMemo } from "react";

export type HandCard = {
  id: string;
  name: string;
  cost: number;
  text: string;
  effect: { customers?: number; price?: number; mult?: number };
};

type Preview = {
  customers: number;
  price: number;
  mult: number;
  revenue: number;
  ratio: number;
  totalCost: number;
  budget: number;
  comboHint: string | null;
} | null;

type Props = {
  hand: HandCard[];
  selected: string[];
  onToggle: (id: string) => void;
  preview: Preview;
  norma: number;
  adlib: string;
  onAdlib: (v: string) => void;
  onSubmit: () => void;
  busy?: boolean;
};

export function PlayStep({
  hand,
  selected,
  onToggle,
  preview,
  norma,
  adlib,
  onAdlib,
  onSubmit,
  busy,
}: Props) {
  const slots = useMemo(() => {
    const cards = selected.map((id) => hand.find((h) => h.id === id)!).filter(Boolean);
    while (cards.length < 3) cards.push(null as unknown as HandCard);
    return cards.slice(0, 3);
  }, [hand, selected]);

  const gauge = Math.min(1.4, Math.max(0, preview?.ratio ?? 0)) / 1.4;

  return (
    <div className="space-y-3">
      <div className="ob-panel p-4">
        <p className="text-[11px] font-bold text-[var(--ob-muted)]">売上ボード</p>
        <p className="ob-num mt-1 text-center text-2xl font-bold tracking-wide">
          <span className="text-[var(--ob-mint)]">{preview?.customers ?? "—"}</span>
          <span className="mx-1 text-[var(--ob-muted)]">×</span>
          <span className="text-[var(--ob-gold)]">{preview?.price ?? "—"}</span>
          <span className="mx-1 text-[var(--ob-muted)]">＝</span>
          <span className="text-[var(--ob-accent)]">
            {(preview?.revenue ?? 0).toLocaleString("ja-JP")}
          </span>
        </p>
        {preview?.mult && preview.mult !== 1 ? (
          <p className="mt-1 text-center text-xs text-[var(--ob-muted)]">
            倍率 ×{preview.mult.toFixed(2)}
          </p>
        ) : null}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--ob-border)]">
          <div
            className="h-full rounded-full bg-[var(--ob-accent)] transition-[width] duration-300"
            style={{ width: `${gauge * 100}%` }}
          />
        </div>
        <p className="mt-1 text-center text-[11px] text-[var(--ob-muted)]">
          ノルマ {norma.toLocaleString("ja-JP")}
          {preview ? ` · 達成 ${(preview.ratio * 100).toFixed(0)}%` : ""}
        </p>
        {preview?.comboHint ? (
          <p className="mt-2 text-center text-xs font-bold text-[var(--ob-mint)]">
            {preview.comboHint}
          </p>
        ) : null}
        <p className="mt-2 text-center text-[11px] text-[var(--ob-muted)]">
          予算 {preview?.totalCost ?? 0}/{preview?.budget ?? 3}
        </p>
      </div>

      <div className="ob-panel p-3">
        <p className="mb-2 text-[11px] font-bold text-[var(--ob-muted)]">場（最大3）</p>
        <div className="grid grid-cols-3 gap-2">
          {slots.map((c, i) => (
            <div
              key={i}
              className="flex min-h-[72px] items-center justify-center rounded-xl border border-dashed border-[var(--ob-border)] px-1 text-center text-[11px] font-bold"
              style={{
                background: c ? "rgba(255,179,71,0.1)" : "transparent",
                transform: c ? "translateY(-3px)" : undefined,
              }}
            >
              {c ? c.name : "空"}
            </div>
          ))}
        </div>
      </div>

      <div className="ob-panel p-3">
        <p className="mb-2 text-[11px] font-bold text-[var(--ob-muted)]">手札</p>
        <div className="space-y-2">
          {hand.map((c) => {
            const on = selected.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onToggle(c.id)}
                className="flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left transition-transform"
                style={{
                  borderColor: on ? "var(--ob-accent)" : "var(--ob-border)",
                  transform: on ? "translateY(-2px)" : undefined,
                  background: on ? "rgba(94,234,212,0.08)" : "transparent",
                }}
              >
                <span className="ob-num shrink-0 rounded-md bg-[var(--ob-border)] px-1.5 py-0.5 text-[10px]">
                  {c.cost}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{c.name}</span>
                  <span className="block text-[11px] text-[var(--ob-muted)]">{c.text}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="ob-panel p-3">
        <label className="block">
          <span className="text-[11px] font-bold text-[var(--ob-muted)]">
            アドリブ（任意・40字）
          </span>
          <input
            value={adlib}
            onChange={(e) => onAdlib(e.target.value.slice(0, 40))}
            maxLength={40}
            placeholder="場のカードに合わせた一言"
            className="mt-1 w-full rounded-xl border border-[var(--ob-border)] bg-transparent px-3 py-2 text-sm outline-none"
            style={{ color: "var(--ob-text)" }}
          />
        </label>
      </div>

      <button
        type="button"
        className="ob-btn w-full"
        disabled={busy || selected.length < 1}
        onClick={onSubmit}
      >
        {busy ? "計算中…" : "営業！"}
      </button>
    </div>
  );
}
