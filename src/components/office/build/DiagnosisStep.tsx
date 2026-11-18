"use client";

type Chip = { id: string; label: string; value: string };
type Hyp = { id: string; text: string };

type Props = {
  chips: Chip[];
  hypotheses: Hyp[];
  selected: string | null;
  onSelect: (id: string) => void;
  onConfirm: () => void;
  busy?: boolean;
};

export function DiagnosisStep({
  chips,
  hypotheses,
  selected,
  onSelect,
  onConfirm,
  busy,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="ob-panel p-4">
        <p className="ob-title text-sm text-[var(--ob-gold)]">現場データ</p>
        <ul className="mt-3 space-y-2">
          {chips.map((c) => (
            <li
              key={c.id}
              className="flex items-baseline justify-between gap-3 border-b border-[var(--ob-border)] pb-2 text-sm last:border-0"
            >
              <span className="text-[var(--ob-muted)]">{c.label}</span>
              <span className="ob-num font-bold">{c.value}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="ob-panel p-4">
        <p className="ob-title text-sm text-[var(--ob-gold)]">原因の仮説（1つ）</p>
        <p className="mt-1 text-xs text-[var(--ob-muted)]">当たりなら倍率×1.3。正解は結果で。</p>
        <div className="mt-3 space-y-2">
          {hypotheses.map((h) => {
            const on = selected === h.id;
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => onSelect(h.id)}
                className="w-full rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-transform"
                style={{
                  borderColor: on ? "var(--ob-accent)" : "var(--ob-border)",
                  background: on ? "rgba(255,179,71,0.12)" : "transparent",
                  color: "var(--ob-text)",
                  transform: on ? "translateY(-2px)" : undefined,
                }}
              >
                {h.text}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="ob-btn mt-4 w-full"
          disabled={!selected || busy}
          onClick={onConfirm}
        >
          施策を選ぶ
        </button>
      </div>
    </div>
  );
}
