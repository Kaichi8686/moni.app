"use client";

import { useState } from "react";
import { DuoButton } from "@/components/idea-garden/DuoButton";
import { OFFICE_NAME_MAX } from "@/lib/office/constants";
import { OFFICE_INDUSTRIES, type OfficeIndustry } from "@/lib/office/industries";

type Props = {
  busy: boolean;
  error?: string;
  /** 業種補完モード：既存の会社名を固定表示 */
  existingName?: string | null;
  onSubmit: (payload: { name: string; industry: OfficeIndustry }) => void;
};

export function NameSetup({ busy, error, existingName, onSubmit }: Props) {
  const patchMode = Boolean(existingName);
  const [name, setName] = useState(existingName ?? "");
  const [industry, setIndustry] = useState<OfficeIndustry | null>(null);

  const canSubmit =
    !busy &&
    industry != null &&
    (patchMode || (name.trim().length >= 1 && name.trim().length <= OFFICE_NAME_MAX));

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-8">
      <p className="text-center text-[11px] font-bold uppercase tracking-[0.16em] text-[#FF9600]">
        Office
      </p>
      <h1 className="mt-2 text-center font-[family-name:var(--font-instrument-serif)] text-3xl tracking-tight text-zinc-900">
        {patchMode ? "業種を選ぼう" : "会社をつくろう"}
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-relaxed text-zinc-600">
        {patchMode
          ? `『${existingName}』の業種を決めてね。あとからは変えられないよ。`
          : "会社名と業種を決めよう。業種はあとから変えられないよ。"}
      </p>

      {!patchMode ? (
        <label className="mt-8 block">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-xs font-bold text-zinc-600">会社名</span>
            <span className="text-[11px] tabular-nums text-zinc-400">
              {name.length}/{OFFICE_NAME_MAX}
            </span>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, OFFICE_NAME_MAX))}
            className="w-full rounded-2xl border border-zinc-200 bg-white px-3.5 py-3 text-sm font-semibold outline-none ring-[#FF9600] focus:ring-2"
            placeholder="例: 放課後ラボ"
            autoFocus
          />
        </label>
      ) : (
        <div className="mt-8 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
          <p className="text-[11px] font-medium text-zinc-500">会社名</p>
          <p className="mt-0.5 text-base font-bold text-zinc-900">{existingName}</p>
        </div>
      )}

      <p className="mt-6 text-xs font-bold text-zinc-600">業種（1つ選ぶ）</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {OFFICE_INDUSTRIES.map((item) => {
          const selected = industry === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setIndustry(item.id)}
              className={`rounded-2xl border px-3 py-3 text-left transition ${
                selected
                  ? "border-[#FF9600] bg-[#FFF7E8] shadow-[0_2px_0_#F0B85A]"
                  : "border-zinc-200 bg-white hover:border-zinc-300"
              }`}
            >
              <span className="text-xl" aria-hidden>
                {item.icon}
              </span>
              <p className="mt-1 text-sm font-bold text-zinc-900">{item.labelJa}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{item.blurb}</p>
            </button>
          );
        })}
      </div>

      {error ? <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p> : null}
      <div className="mt-5">
        <DuoButton
          type="button"
          tone="orange"
          size="lg"
          fullWidth
          disabled={!canSubmit}
          onClick={() => {
            if (!industry) return;
            onSubmit({
              name: patchMode ? (existingName ?? "").trim() : name.trim(),
              industry,
            });
          }}
        >
          {busy ? "準備中…" : patchMode ? "業種を決める" : "会社を始める"}
        </DuoButton>
      </div>
    </div>
  );
}
