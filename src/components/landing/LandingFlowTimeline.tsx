"use client";

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

export type FlowStep = {
  n: number;
  title: string;
  body: string;
  icon: LucideIcon;
  visualLabel: string;
};

type Props = {
  steps: FlowStep[];
  locale: "ja" | "en";
};

function StepVisual({ step, active }: { step: FlowStep; active: boolean }) {
  const Icon = step.icon;
  return (
    <div
      className={`relative overflow-hidden rounded-xl border px-4 py-5 transition-colors duration-500 ${
        active ? "border-sky-200 bg-sky-50/70" : "border-zinc-200 bg-zinc-50/80"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-500 ${
            active ? "bg-sky-600 text-white" : "bg-white text-zinc-500 ring-1 ring-zinc-200"
          }`}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-snug text-zinc-800">{step.visualLabel}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-zinc-500">{step.title}</p>
        </div>
      </div>
      <div className="mt-4 space-y-1.5" aria-hidden>
        <div className={`h-2 rounded-full ${active ? "bg-sky-200/80" : "bg-zinc-200/90"}`} />
        <div className={`h-2 w-[80%] rounded-full ${active ? "bg-sky-100" : "bg-zinc-100"}`} />
        <div className={`h-2 w-[65%] rounded-full ${active ? "bg-sky-100/80" : "bg-zinc-100"}`} />
      </div>
    </div>
  );
}

export function LandingFlowTimeline({ steps, locale }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    const nodes = itemRefs.current.filter(Boolean) as HTMLLIElement[];
    if (nodes.length === 0) return;

    const ratios = new Map<number, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (Number.isNaN(index)) continue;
          ratios.set(index, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let best = 0;
        let bestRatio = -1;
        for (const [index, ratio] of ratios) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = index;
          }
        }
        if (bestRatio > 0) setActiveIndex(best);
      },
      {
        root: null,
        rootMargin: "-40% 0px -40% 0px",
        threshold: [0, 0.35, 0.7],
      },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [steps.length]);

  return (
    <ol className="relative mt-12 max-w-3xl" aria-label={locale === "ja" ? "使い方の流れ" : "Product flow"}>
      {steps.map((step, index) => {
        const active = index <= activeIndex;
        const current = index === activeIndex;
        const isLast = index === steps.length - 1;
        return (
          <li
            key={step.n}
            data-index={index}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 pb-10 last:pb-0 sm:grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,14rem)] sm:gap-x-6 sm:pb-12"
          >
            {!isLast ? (
              <span
                className={`absolute left-[1.15rem] top-10 bottom-0 w-px transition-colors duration-300 sm:left-[1.25rem] ${
                  index < activeIndex ? "bg-sky-500" : "bg-zinc-200"
                }`}
                aria-hidden
              />
            ) : null}

            <div className="relative z-[1] flex justify-center pt-0.5">
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums transition-colors duration-300 ${
                  current
                    ? "bg-sky-600 text-white shadow-sm shadow-sky-600/25"
                    : active
                      ? "bg-sky-100 text-sky-800 ring-1 ring-sky-200"
                      : "bg-white text-zinc-400 ring-1 ring-zinc-200"
                }`}
              >
                {step.n}
              </span>
            </div>

            <div className="min-w-0 pt-1">
              <h3
                className={`text-[1.05rem] font-semibold tracking-[-0.02em] transition-colors duration-300 sm:text-lg ${
                  current ? "text-zinc-950" : "text-zinc-800"
                }`}
              >
                {step.title}
              </h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-500 sm:text-[15px]">{step.body}</p>
              <div className="mt-4 sm:hidden">
                <StepVisual step={step} active={current} />
              </div>
            </div>

            <div className="col-start-2 mt-0 hidden sm:col-start-3 sm:block sm:pt-0.5">
              <StepVisual step={step} active={current} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
