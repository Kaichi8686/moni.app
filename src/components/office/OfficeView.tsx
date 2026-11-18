"use client";

import { OfficeScene } from "@/components/office/OfficeScene";
import type { OfficeIndustry } from "@/lib/office/industries";

type Props = {
  level: number;
  industry: OfficeIndustry | null;
  fx?: string | null;
  speech?: string | null;
  className?: string;
};

/** 会社カード内に収める固定サイズのオフィス枠 */
export function OfficeView({ level, industry, fx, speech, className }: Props) {
  return (
    <div
      className={`relative h-[160px] w-full max-w-full overflow-hidden rounded-2xl ring-1 ring-amber-100 ${className ?? ""}`}
    >
      <OfficeScene
        level={level}
        industry={industry}
        fx={fx}
        variant="card"
        speech={speech}
      />
    </div>
  );
}
