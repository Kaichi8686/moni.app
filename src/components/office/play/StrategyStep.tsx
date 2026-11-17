"use client";

import type { IncidentStrategy, StrategyKind } from "@/lib/office/types";

const KIND_META: Record<
  Exclude<StrategyKind, "custom">,
  { icon: string; label: string; risk: "safe" | "standard" | "bold" }
> = {
  safe: { icon: "🛡", label: "堅実", risk: "safe" },
  standard: { icon: "⚖", label: "標準", risk: "standard" },
  bold: { icon: "🔥", label: "大胆", risk: "bold" },
};

function RiskMeter({ kind }: { kind: Exclude<StrategyKind, "custom"> }) {
  // 見た目だけのバー。safe=短く中央 / standard=中 / bold=広く
  const width =
    kind === "safe" ? "w-[28%]" : kind === "standard" ? "w-[52%]" : "w-[88%]";
  const arrows =
    kind === "safe" ? "▲" : kind === "standard" ? "▲〜▲▲" : "▲▲▲／▼▼▼";
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold text-zinc-400">当たり外れの幅</p>
        <p className="text-[10px] font-bold tracking-wide text-amber-700" aria-label="メーター変化のヒント">
          {arrows}
        </p>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`absolute left-1/2 top-0 h-full -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-300 to-[#FF9600] ${width}`}
        />
      </div>
    </div>
  );
}

type Props = {
  strategies: IncidentStrategy[];
  selectedId: string | null;
  canReroll: boolean;
  rerolling?: boolean;
  onSelect: (id: string) => void;
  onReroll: () => void;
};

export function StrategyStep({
  strategies,
  selectedId,
  canReroll,
  rerolling,
  onSelect,
  onReroll,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-black text-zinc-900">作戦を選ぶ</h3>
        <button
          type="button"
          disabled={!canReroll || rerolling}
          onClick={onReroll}
          className="text-xs font-bold text-[#FF9600] disabled:text-zinc-300"
        >
          {rerolling ? "引き直し中…" : canReroll ? "作戦を引き直す" : "引き直し済み"}
        </button>
      </div>

      <div className="space-y-2.5">
        {strategies.map((s) => {
          const meta = KIND_META[s.kind];
          const selected = selectedId === s.id;
          const dimmed = selectedId != null && !selected;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className={`w-full rounded-2xl border px-4 py-4 text-left transition duration-300 ${
                selected
                  ? "-translate-y-1 border-[#FF9600] bg-[#FFF7E8] shadow-[0_8px_20px_rgba(255,150,0,0.22)] opacity-100"
                  : dimmed
                    ? "border-zinc-200 bg-white opacity-50"
                    : "border-zinc-200 bg-white opacity-100 hover:border-zinc-300"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl" aria-hidden>
                  {meta.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                    {meta.label}
                  </p>
                  <p className="mt-0.5 text-base font-bold text-zinc-900">{s.title}</p>
                  <p className="mt-1 text-sm leading-snug text-zinc-500">{s.summary}</p>
                  <RiskMeter kind={s.kind} />
                </div>
              </div>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onSelect("custom")}
          className={`relative w-full rounded-2xl border-2 px-4 py-4 text-left transition duration-300 ${
            selectedId === "custom"
              ? "-translate-y-1 border-amber-400 bg-gradient-to-br from-amber-50 via-white to-yellow-50 shadow-[0_8px_20px_rgba(245,158,11,0.25)] opacity-100"
              : selectedId != null
                ? "border-amber-300/70 bg-gradient-to-br from-amber-50/80 to-white opacity-50"
                : "border-amber-300 bg-gradient-to-br from-amber-50/90 to-white opacity-100"
          }`}
        >
          <span className="absolute right-3 top-3 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-white">
            オリジナル+10%
          </span>
          <p className="text-[11px] font-bold text-amber-700">特別カード</p>
          <p className="mt-0.5 text-base font-bold text-zinc-900">自分の作戦で行く</p>
          <p className="mt-1 text-sm leading-snug text-zinc-500">
            カードに頼らず、きみのアイデアで勝負
          </p>
        </button>
      </div>
    </div>
  );
}
