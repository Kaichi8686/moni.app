"use client";

import { OfficeScene } from "@/components/office/OfficeScene";
import type { OfficeIndustry } from "@/lib/office/industries";

type Props = {
  level: number;
  industry: OfficeIndustry | null;
  fx?: string | null;
  speech?: string | null;
  /** 将来: scene id。未配線時は共通オフィス */
  scene?: string | null;
  className?: string;
};

/**
 * ステージ枠：カラム幅に収め、固定アスペクト・overflow hidden・角丸。
 * 場面別背景は後続ステップで差し替え。今は既存 OfficeScene を枠内に表示。
 */
export function StageView({ level, industry, fx, speech, className }: Props) {
  return (
    <div
      className={`relative w-full max-w-full overflow-hidden rounded-3xl bg-[#FFF7ED] ring-1 ring-amber-100 ${className ?? ""}`}
      style={{ aspectRatio: "16 / 10" }}
    >
      <div className="absolute inset-0">
        <OfficeScene
          level={level}
          industry={industry}
          fx={fx}
          variant="card"
          speech={speech}
        />
      </div>
    </div>
  );
}
