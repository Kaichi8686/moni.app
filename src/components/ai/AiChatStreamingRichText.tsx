"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AI_CHAT_EMPHASIS_CLASS, AiChatRichText } from "@/components/ai/AiChatRichText";
import { prefersReducedMotion } from "@/lib/ui/activityCelebration";

type DisplayUnit = { text: string; bold: boolean };

type Props = {
  text: string;
  className?: string;
  /** When true, reveal text gradually with a fade-in (ChatGPT-like). */
  animate?: boolean;
  onTick?: () => void;
  onComplete?: () => void;
};

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/** Parse `**bold**` into display units (markers removed; bold flag set). */
export function parseAiDisplayUnits(text: string): DisplayUnit[] {
  const units: DisplayUnit[] = [];
  let bold = false;
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("**", i)) {
      bold = !bold;
      i += 2;
      continue;
    }
    const rest = text.slice(i);
    const grapheme = segmenter ? [...segmenter.segment(rest)][0]?.segment ?? rest[0]! : rest[0]!;
    units.push({ text: grapheme, bold });
    i += grapheme.length;
  }
  return units;
}

function charsPerFrame(total: number): number {
  if (total > 700) return 4;
  if (total > 400) return 3;
  if (total > 180) return 2;
  return 1;
}

function AiChatAnimatedReveal({
  text,
  units,
  className,
  onTick,
  onComplete,
}: {
  text: string;
  units: DisplayUnit[];
  className?: string;
  onTick?: () => void;
  onComplete?: () => void;
}) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const onTickRef = useRef(onTick);
  const onCompleteRef = useRef(onComplete);
  const tickAccumRef = useRef(0);

  useEffect(() => {
    onTickRef.current = onTick;
    onCompleteRef.current = onComplete;
  }, [onTick, onComplete]);

  useEffect(() => {
    tickAccumRef.current = 0;
    let count = 0;
    let raf = 0;
    let last = performance.now();
    const stepMs = 18;
    const perFrame = charsPerFrame(units.length);

    const tick = (now: number) => {
      const elapsed = now - last;
      if (elapsed >= stepMs) {
        last = now;
        count = Math.min(units.length, count + perFrame);
        setVisibleCount(count);
        tickAccumRef.current += elapsed;
        if (tickAccumRef.current >= 90) {
          tickAccumRef.current = 0;
          onTickRef.current?.();
        }
        if (count >= units.length) {
          setFinished(true);
          onCompleteRef.current?.();
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, units.length]);

  if (finished) {
    return <AiChatRichText text={text} className={className} />;
  }

  const visible = units.slice(0, visibleCount);

  return (
    <div className={`select-text ${className ?? ""}`.trim()} aria-busy="true">
      {visible.map((unit, index) =>
        unit.text === "\n" ? (
          <br key={index} />
        ) : (
          <span key={index} className={`ai-chat-glyph${unit.bold ? ` ${AI_CHAT_EMPHASIS_CLASS}` : ""}`}>
            {unit.text}
          </span>
        ),
      )}
    </div>
  );
}

/**
 * AI chat text with optional ChatGPT-like reveal:
 * glyphs appear progressively and fade from faint to solid.
 */
export function AiChatStreamingRichText({
  text,
  className,
  animate = false,
  onTick,
  onComplete,
}: Props) {
  const units = useMemo(() => parseAiDisplayUnits(text), [text]);
  const reduceMotion = prefersReducedMotion();
  const shouldAnimate = animate && !reduceMotion && units.length > 0;

  if (!shouldAnimate) {
    return <AiChatRichText text={text} className={className} />;
  }

  return (
    <AiChatAnimatedReveal
      key={text}
      text={text}
      units={units}
      className={className}
      onTick={onTick}
      onComplete={onComplete}
    />
  );
}
