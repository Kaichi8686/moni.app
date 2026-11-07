"use client";

import type { CSSProperties, ReactNode, Ref } from "react";

type Props = {
  width: number;
  minHeight?: number | string;
  className?: string;
  trackClassName?: string;
  trackRef?: Ref<HTMLDivElement>;
  children: ReactNode;
};

/**
 * トラック幅が画面より広くても横スクロールさせず、
 * トラック中央（本線）をビューポート中央に固定する。
 * はみ出した左右はクリップする。
 */
export function RoadmapTrackViewport({
  width,
  minHeight,
  className = "",
  trackClassName = "",
  trackRef,
  children,
}: Props) {
  const trackStyle: CSSProperties = {
    width,
    minHeight,
    left: "50%",
    transform: "translateX(-50%)",
  };

  return (
    <div
      className={`relative w-full overflow-x-hidden touch-pan-y ${className}`.trim()}
    >
      <div
        ref={trackRef}
        className={`relative overflow-visible ${trackClassName}`.trim()}
        style={trackStyle}
      >
        {children}
      </div>
    </div>
  );
}
