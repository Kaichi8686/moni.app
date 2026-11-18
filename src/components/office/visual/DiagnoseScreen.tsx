"use client";

import { CafeStage } from "@/components/office/visual/CafeStage";
import { MOCK_EVENT, type MockHypothesis } from "@/components/office/visual/mockData";

type Props = {
  selected: string | null;
  onSelect: (id: string) => void;
  onNext: () => void;
};

export function DiagnoseScreen({ selected, onSelect, onNext }: Props) {
  return (
    <div className="space-y-3">
      <CafeStage title={MOCK_EVENT.title} />

      <div className="ov-panel px-4 py-3">
        <p className="ov-muted">ノルマ</p>
        <p className="ov-num text-xl text-[var(--ov-accent)]">
          {MOCK_EVENT.norma.toLocaleString("ja-JP")}
        </p>
      </div>

      <div className="ov-panel p-4">
        <p className="ov-title text-sm text-[var(--ov-gold)]">現場データ</p>
        <ul className="mt-3 space-y-2">
          {MOCK_EVENT.chips.map((c) => (
            <li
              key={c.id}
              className="flex items-baseline justify-between gap-3 border-b border-[var(--ov-border)] pb-2 last:border-0"
            >
              <span className="ov-muted">{c.label}</span>
              <span className="ov-num text-sm font-bold">{c.value}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="ov-panel p-4">
        <p className="ov-title text-sm text-[var(--ov-gold)]">原因の仮説</p>
        <p className="ov-muted mt-1">1つ選ぶと強調されるよ</p>
        <div className="mt-3 space-y-2">
          {MOCK_EVENT.hypotheses.map((h: MockHypothesis) => {
            const on = selected === h.id;
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => onSelect(h.id)}
                className="w-full rounded-xl border px-3 text-left text-sm font-semibold"
                style={{
                  minHeight: 44,
                  borderColor: on ? "var(--ov-accent)" : "var(--ov-border)",
                  background: on ? "rgba(255,179,71,0.14)" : "transparent",
                  color: "var(--ov-text)",
                  transform: on ? "translateY(-2px)" : undefined,
                }}
              >
                {h.text}
              </button>
            );
          })}
        </div>
        <button type="button" className="ov-btn mt-4" disabled={!selected} onClick={onNext}>
          この仮説で進む
        </button>
      </div>
    </div>
  );
}
