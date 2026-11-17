"use client";

export type PlayStep = "incident" | "strategy" | "target" | "write" | "result";

const DOT_STEPS: PlayStep[] = ["incident", "strategy", "target", "write"];

type Props = {
  step: PlayStep;
  onBack?: () => void;
  canBack?: boolean;
};

export function PlayStepper({ step, onBack, canBack }: Props) {
  if (step === "result") return null;
  const idx = DOT_STEPS.indexOf(step);

  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        disabled={!canBack}
        onClick={onBack}
        className="rounded-xl px-3 py-2 text-sm font-bold text-zinc-600 disabled:invisible hover:bg-zinc-100"
      >
        ← 戻る
      </button>
      <div className="flex items-center gap-2" aria-label="進行状況">
        {DOT_STEPS.map((s, i) => (
          <span
            key={s}
            className={`h-2.5 w-2.5 rounded-full transition-opacity duration-300 ${
              i <= idx ? "bg-[#FF9600] opacity-100" : "bg-zinc-200 opacity-70"
            }`}
          />
        ))}
      </div>
      <span className="w-[4.5rem]" aria-hidden />
    </div>
  );
}

export function previousPlayStep(step: PlayStep): PlayStep | null {
  switch (step) {
    case "strategy":
      return "incident";
    case "target":
      return "strategy";
    case "write":
      return "target";
    default:
      return null;
  }
}
