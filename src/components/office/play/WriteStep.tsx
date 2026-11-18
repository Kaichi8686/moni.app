"use client";

import { DuoButton } from "@/components/idea-garden/DuoButton";
import {
  OFFICE_ANSWER_MAX,
  OFFICE_ANSWER_MIN,
} from "@/lib/office/constants";
import type { IncidentMission } from "@/lib/office/script";

type Props = {
  strategyTitle: string;
  targetLabels: string[];
  answer: string;
  onAnswer: (v: string) => void;
  placeholder: string;
  canSubmit: boolean;
  busy: boolean;
  stamina: number;
  staminaHint?: string | null;
  mission?: IncidentMission | null;
  clues?: string[];
  onSubmit: () => void;
};

function CharGauge({ value, maxVisible = 100 }: { value: number; maxVisible?: number }) {
  const pct = Math.min(1, value / maxVisible);
  const r = 16;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90" aria-hidden>
      <circle cx="20" cy="20" r={r} fill="none" stroke="#F4F4F5" strokeWidth="4" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke="#FF9600"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        className="transition-[stroke-dasharray] duration-300"
      />
    </svg>
  );
}

export function WriteStep({
  strategyTitle,
  targetLabels,
  answer,
  onAnswer,
  placeholder,
  canSubmit,
  busy,
  stamina,
  staminaHint,
  mission,
  clues = [],
  onSubmit,
}: Props) {
  const targetsText = targetLabels.length ? targetLabels.join("、") : "お客さん";

  return (
    <div className="space-y-4">
      <h3 className="text-base font-black text-zinc-900">アイデアを書く</h3>

      {mission ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/80 px-3 py-2.5">
          <p className="text-[10px] font-bold text-amber-700">ミッション</p>
          <p className="mt-0.5 text-sm font-black text-zinc-900">{mission.goal}</p>
          <p className="mt-0.5 text-xs font-medium text-zinc-600">制約: {mission.constraint}</p>
        </div>
      ) : null}

      {clues.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-zinc-400">手がかり</p>
          <ul className="flex flex-wrap gap-1.5">
            {clues.map((c) => (
              <li
                key={c}
                className="rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-amber-900 ring-1 ring-amber-100"
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="rounded-2xl bg-zinc-50 px-4 py-3 text-[15px] leading-relaxed text-zinc-700">
        <span className="font-bold text-[#FF9600]">【{strategyTitle}】</span>
        の作戦で、
        <span className="font-bold text-zinc-900">【{targetsText}】</span>
        に向けて、
        <span className="text-zinc-400">＿＿＿</span>
      </p>

      <p className="text-[11px] font-medium text-zinc-400">
        目安: 誰に／何を／どうやって（送信文には入らないよ）
      </p>

      <label className="block">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-zinc-600">解決アイデア</span>
          <div className="flex items-center gap-2">
            <CharGauge value={answer.length} />
            <span className="text-xs tabular-nums text-zinc-400">
              {answer.length}/{OFFICE_ANSWER_MAX}
            </span>
          </div>
        </div>
        <textarea
          value={answer}
          onChange={(e) => onAnswer(e.target.value.slice(0, OFFICE_ANSWER_MAX))}
          rows={5}
          className="w-full resize-y rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 text-[15px] leading-relaxed outline-none ring-[#FF9600] focus:ring-2"
          placeholder={placeholder}
        />
        {answer.trim().length > 0 && answer.trim().length < OFFICE_ANSWER_MIN ? (
          <p className="mt-1 text-xs font-medium text-zinc-400">
            あと {OFFICE_ANSWER_MIN - answer.trim().length} 字書いてね
          </p>
        ) : null}
      </label>

      {stamina <= 0 && staminaHint ? (
        <p className="text-center text-sm font-semibold text-zinc-500">{staminaHint}</p>
      ) : null}

      <DuoButton
        type="button"
        tone="orange"
        size="lg"
        fullWidth
        disabled={!canSubmit}
        onClick={onSubmit}
      >
        {busy ? "採点中…" : "この作戦でいく！"}
      </DuoButton>
    </div>
  );
}
