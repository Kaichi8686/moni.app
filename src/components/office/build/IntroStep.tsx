"use client";

import { useState } from "react";
import { PixelSprite, SPRITE_SECRETARY } from "@/components/office/build/PixelSprite";
import type { IntroBeat } from "@/lib/office/build/content/events";

type Props = {
  title: string;
  beats: IntroBeat[];
  onSkip: () => void;
  onDone: () => void;
};

export function IntroStep({ title, beats, onSkip, onDone }: Props) {
  const [i, setI] = useState(0);
  const beat = beats[i];
  const last = i >= beats.length - 1;

  return (
    <div className="ob-panel space-y-3 p-4">
      <div className="flex items-start gap-3">
        <PixelSprite {...SPRITE_SECRETARY} scale={3} title="秘書" />
        <div className="min-w-0 flex-1">
          <p className="ob-title text-sm text-[var(--ob-gold)]">{title}</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ob-text)]">
            {beat?.line ?? "……"}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" className="ob-btn-ghost flex-1" onClick={onSkip}>
          スキップ
        </button>
        <button
          type="button"
          className="ob-btn flex-1"
          onClick={() => {
            if (last) onDone();
            else setI((n) => n + 1);
          }}
        >
          {last ? "現場データを見る" : "次へ"}
        </button>
      </div>
    </div>
  );
}
