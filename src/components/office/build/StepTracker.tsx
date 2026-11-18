"use client";

const STEPS = [
  { id: "diagnose", label: "診断" },
  { id: "play", label: "施策" },
  { id: "result", label: "結果" },
] as const;

export type BuildStepId = (typeof STEPS)[number]["id"];

type Props = {
  step: BuildStepId | "intro" | "coach" | "shop" | "score";
};

function mapStep(step: Props["step"]): BuildStepId {
  if (step === "intro" || step === "diagnose") return "diagnose";
  if (step === "play") return "play";
  return "result";
}

export function StepTracker({ step }: Props) {
  const active = mapStep(step);
  const idx = STEPS.findIndex((s) => s.id === active);
  return (
    <ol className="flex items-center justify-center gap-2 px-1">
      {STEPS.map((s, i) => {
        const on = i <= idx;
        return (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className="ob-title flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[11px]"
              style={{
                background: on ? "var(--ob-accent)" : "var(--ob-panel)",
                color: on ? "#1a1220" : "var(--ob-muted)",
                border: on ? "none" : "1px solid var(--ob-border)",
              }}
            >
              {i + 1} {s.label}
            </span>
            {i < STEPS.length - 1 ? (
              <span className="h-px w-4 bg-[var(--ob-border)]" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
