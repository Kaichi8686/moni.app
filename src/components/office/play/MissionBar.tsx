"use client";

import {
  missionPhaseFor,
  missionPhaseHint,
  MISSION_PHASES,
  type MissionPhase,
  type PlayStep,
} from "@/components/office/play/PlayStepper";

type Props = {
  step: PlayStep;
  /** 聞き込み残り回数（ask 時に表示） */
  asksRemaining?: number | null;
  onBack?: () => void;
  canBack?: boolean;
};

const PHASE_LABEL: Record<MissionPhase, string> = {
  listen: "①話を聞く",
  plan: "②作戦",
  idea: "③アイデア",
  result: "④結果",
};

/**
 * 「いまやること」バー。旧 PlayStepper ドットをここに統合。
 */
export function MissionBar({ step, asksRemaining, onBack, canBack }: Props) {
  if (step === "result") return null;
  const phase = missionPhaseFor(step);
  const hint = missionPhaseHint(step, asksRemaining);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={!canBack}
          onClick={onBack}
          className="rounded-xl px-2.5 py-1.5 text-sm font-bold text-zinc-600 disabled:invisible hover:bg-zinc-100"
        >
          ← 戻る
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-[11px] font-semibold text-zinc-500">
          {hint}
        </p>
        <span className="w-[3.25rem]" aria-hidden />
      </div>

      <div
        className="grid grid-cols-4 gap-1 rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50/90 to-orange-50/80 p-1.5"
        aria-label="いまやること"
      >
        {MISSION_PHASES.map((p) => {
          const active = p === phase;
          const done = MISSION_PHASES.indexOf(p) < MISSION_PHASES.indexOf(phase);
          return (
            <div
              key={p}
              className={`rounded-xl px-1 py-2 text-center transition-opacity duration-300 ${
                active
                  ? "bg-white shadow-sm ring-1 ring-amber-200"
                  : done
                    ? "opacity-70"
                    : "opacity-45"
              }`}
            >
              <p
                className={`text-[10px] font-black leading-tight ${
                  active ? "text-[#FF9600]" : "text-zinc-500"
                }`}
              >
                {PHASE_LABEL[p]}
              </p>
              <span
                className={`mx-auto mt-1.5 block h-1 w-6 rounded-full ${
                  active || done ? "bg-[#FF9600]" : "bg-zinc-200"
                }`}
                aria-hidden
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
