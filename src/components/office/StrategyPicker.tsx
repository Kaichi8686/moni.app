"use client";

import type { IncidentStrategy } from "@/lib/office/types";

const KIND_LABEL: Record<string, string> = {
  safe: "堅実",
  standard: "標準",
  bold: "大胆",
};

type Props = {
  strategies: IncidentStrategy[];
  selectedId: string | null;
  canReroll: boolean;
  rerolling?: boolean;
  onSelect: (id: string) => void;
  onReroll: () => void;
};

export function StrategyPicker({
  strategies,
  selectedId,
  canReroll,
  rerolling,
  onSelect,
  onReroll,
}: Props) {
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-zinc-600">作戦を選ぶ</p>
        <button
          type="button"
          disabled={!canReroll || rerolling}
          onClick={onReroll}
          className="text-xs font-bold text-[#FF9600] disabled:text-zinc-300"
        >
          {rerolling ? "引き直し中…" : canReroll ? "作戦を引き直す" : "引き直し済み"}
        </button>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {strategies.map((s) => {
          const selected = selectedId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className={`rounded-2xl border px-3.5 py-3.5 text-left transition ${
                selected
                  ? "border-[#FF9600] bg-[#FFF7E8] shadow-[0_2px_0_#F0B85A]"
                  : "border-zinc-200 bg-white/95 hover:border-zinc-300"
              }`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                {KIND_LABEL[s.kind] ?? s.kind}
              </p>
              <p className="mt-0.5 text-[15px] font-bold text-zinc-900">{s.title}</p>
              <p className="mt-1 text-xs leading-snug text-zinc-500">{s.summary}</p>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onSelect("custom")}
          className={`rounded-2xl border px-3.5 py-3.5 text-left transition sm:col-span-2 ${
            selectedId === "custom"
              ? "border-[#FF9600] bg-[#FFF7E8] shadow-[0_2px_0_#F0B85A]"
              : "border-dashed border-zinc-300 bg-zinc-50/90 hover:border-zinc-400"
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">オリジナル</p>
          <p className="mt-0.5 text-[15px] font-bold text-zinc-900">自分の作戦で行く</p>
          <p className="mt-1 text-xs leading-snug text-zinc-500">
            カードに頼らず、きみのアイデアで勝負
          </p>
        </button>
      </div>
    </div>
  );
}
