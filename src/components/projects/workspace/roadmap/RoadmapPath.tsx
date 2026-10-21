"use client";

import type { ReactNode } from "react";

/**
 * Duolingo 風の縦蛇行オフセット（px）。
 * 中 → 左 → さらに左 → 左 → 中 → 右 … のゆるい S カーブ。
 */
const PATH_OFFSETS_PX = [0, -40, -68, -40, 0, 40, 68, 40] as const;

export function roadmapPathOffsetX(index: number): number {
  return PATH_OFFSETS_PX[index % PATH_OFFSETS_PX.length] ?? 0;
}

type Props = {
  children: ReactNode;
  className?: string;
};

/** 子（各マス）を縦に並べ、横位置だけ蛇行させるコンテナ */
export function RoadmapPath({ children, className = "" }: Props) {
  return (
    <ol
      className={`relative mx-auto flex w-full max-w-md list-none flex-col items-center gap-7 py-2 sm:gap-8 ${className}`}
    >
      {children}
    </ol>
  );
}

type ItemProps = {
  index: number;
  children: ReactNode;
  /** 蛇行させず中央に置く追従コンテンツ（詳細パネルなど） */
  below?: ReactNode;
  className?: string;
};

export function RoadmapPathItem({ index, children, below, className = "" }: ItemProps) {
  const offset = roadmapPathOffsetX(index);
  return (
    <li className={`relative flex w-full flex-col items-center ${className}`}>
      <div style={{ transform: `translateX(${offset}px)` }}>
        <div
          className="roadmap-path-node-in"
          style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
        >
          {children}
        </div>
      </div>
      {below ? <div className="mt-3 w-full max-w-sm px-1">{below}</div> : null}
    </li>
  );
}
