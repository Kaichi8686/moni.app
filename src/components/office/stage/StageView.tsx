"use client";

import { CastFigure } from "@/components/office/stage/CastFigure";
import { OfficeScene } from "@/components/office/OfficeScene";
import type { CastMember } from "@/lib/office/cast";
import type { OfficeIndustry } from "@/lib/office/industries";
import type { CastEmotion, OfficeSceneId } from "@/lib/office/scenes";

type Props = {
  level: number;
  industry: OfficeIndustry | null;
  fx?: string | null;
  speech?: string | null;
  scene?: OfficeSceneId | null;
  speaker?: CastMember | null;
  emotion?: CastEmotion | null;
  /** 新規発生時のみ入場演出 */
  enter?: boolean;
  className?: string;
};

const SCENE_WASH: Partial<Record<OfficeSceneId, string>> = {
  queue: "from-amber-400/25 via-transparent to-orange-300/10",
  complaint: "from-rose-400/25 via-transparent to-orange-200/10",
  rival: "from-violet-400/20 via-transparent to-zinc-300/15",
  viral: "from-fuchsia-400/20 via-transparent to-sky-200/15",
  staff_trouble: "from-sky-400/20 via-transparent to-amber-200/10",
  sold_out: "from-orange-400/25 via-transparent to-amber-200/15",
  equipment: "from-zinc-400/25 via-transparent to-slate-300/15",
  vip: "from-yellow-300/30 via-transparent to-amber-200/15",
  rainy: "from-slate-400/30 via-transparent to-sky-300/15",
  sns_fire: "from-rose-500/25 via-transparent to-orange-300/20",
  deadline: "from-red-400/20 via-transparent to-amber-200/10",
  new_hire: "from-emerald-300/25 via-transparent to-sky-200/10",
};

/**
 * ステージ枠：カラム幅・固定アスペクト・overflow hidden・角丸。
 * OfficeScene 背景＋場面別カラーウォッシュ。
 */
export function StageView({
  level,
  industry,
  fx,
  speech,
  scene,
  speaker,
  emotion,
  enter,
  className,
}: Props) {
  const wash = scene ? SCENE_WASH[scene] : null;

  return (
    <div
      className={`relative w-full max-w-full overflow-hidden rounded-3xl bg-[#FFF7ED] ring-1 ring-amber-100 ${
        enter ? "office-stage-enter" : ""
      } ${className ?? ""}`}
      style={{ aspectRatio: "16 / 10" }}
    >
      <div className="absolute inset-0">
        <OfficeScene
          level={level}
          industry={industry}
          fx={fx}
          variant="card"
          speech={null}
        />
      </div>

      {wash ? (
        <div
          className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${wash}`}
          aria-hidden
        />
      ) : null}

      {speaker ? (
        <div className="pointer-events-none absolute bottom-[6%] left-1/2 flex h-[62%] -translate-x-1/2 items-end justify-center">
          <CastFigure member={speaker} emotion={emotion} enter={enter} />
        </div>
      ) : null}

      {speech ? (
        <div
          className={`absolute left-1/2 top-[8%] z-10 w-[78%] max-w-[20rem] -translate-x-1/2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-center text-sm font-bold text-zinc-800 shadow-sm ${
            enter ? "office-speech" : ""
          }`}
        >
          {speech}
          <span
            className="absolute left-1/2 top-full -mt-px h-0 w-0 -translate-x-1/2 border-x-8 border-t-8 border-x-transparent border-t-white"
            aria-hidden
          />
        </div>
      ) : null}
    </div>
  );
}
