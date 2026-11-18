"use client";

const STEPS = [
  { id: "diagnose", label: "診断" },
  { id: "play", label: "施策" },
  { id: "result", label: "結果" },
] as const;

export type VisualStep = "diagnose" | "play" | "score" | "coach";

function mapStep(step: VisualStep): (typeof STEPS)[number]["id"] {
  if (step === "diagnose") return "diagnose";
  if (step === "play") return "play";
  return "result";
}

type Props = { step: VisualStep };

export function StepTracker({ step }: Props) {
  const active = mapStep(step);
  const idx = STEPS.findIndex((s) => s.id === active);
  return (
    <ol className="flex items-center justify-center gap-1.5 px-1" aria-label="進行">
      {STEPS.map((s, i) => {
        const on = i <= idx;
        return (
          <li key={s.id} className="flex items-center gap-1.5">
            <span
              className="ov-title flex h-11 min-w-[4.5rem] items-center justify-center rounded-full px-2 text-xs"
              style={{
                background: on ? "var(--ov-accent)" : "var(--ov-panel)",
                color: on ? "#1a1220" : "var(--ov-muted)",
                border: on ? "none" : "1px solid var(--ov-border)",
              }}
            >
              {i + 1} {s.label}
            </span>
            {i < STEPS.length - 1 ? (
              <span className="h-px w-3 bg-[var(--ov-border)]" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
