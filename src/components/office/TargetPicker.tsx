"use client";

import { OFFICE_TARGET_OTHER_MAX } from "@/lib/office/constants";
import type { IncidentTargetPublic } from "@/lib/office/types";

type Props = {
  targets: IncidentTargetPublic[];
  selectedIds: string[];
  otherText: string;
  onToggle: (id: string) => void;
  onOtherText: (text: string) => void;
};

export function TargetPicker({
  targets,
  selectedIds,
  otherText,
  onToggle,
  onOtherText,
}: Props) {
  const hasOther = selectedIds.includes("other");

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-zinc-600">ターゲット（最大2つ）</p>
        <p className="text-xs tabular-nums text-zinc-400">{selectedIds.length}/2</p>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {targets.map((t) => {
          const on = selectedIds.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onToggle(t.id)}
              className={`rounded-2xl px-3.5 py-2 text-sm font-bold ring-1 transition ${
                on
                  ? "bg-[#FFF7E8] text-amber-900 ring-[#FF9600]"
                  : "bg-white/95 text-zinc-600 ring-zinc-200 hover:ring-zinc-300"
              }`}
            >
              {t.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onToggle("other")}
          className={`rounded-2xl px-3.5 py-2 text-sm font-bold ring-1 transition ${
            hasOther
              ? "bg-[#FFF7E8] text-amber-900 ring-[#FF9600]"
              : "bg-white/95 text-zinc-600 ring-zinc-200 hover:ring-zinc-300"
          }`}
        >
          その他
        </button>
      </div>
      {hasOther ? (
        <label className="mt-2 block">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-semibold text-zinc-500">その他のターゲット</span>
            <span className="text-[11px] tabular-nums text-zinc-400">
              {otherText.length}/{OFFICE_TARGET_OTHER_MAX}
            </span>
          </div>
          <input
            value={otherText}
            onChange={(e) => onOtherText(e.target.value.slice(0, OFFICE_TARGET_OTHER_MAX))}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-[#FF9600] focus:ring-2"
            placeholder="例: 保護者コミュニティ"
          />
        </label>
      ) : null}
    </div>
  );
}
