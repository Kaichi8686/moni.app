"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Duolingo 風の縦蛇行オフセット（px）。
 * 中 → 左 → さらに左 → 左 → 中 → 右 … のゆるい S カーブ。
 */
const PATH_OFFSETS_PX = [0, -40, -68, -40, 0, 40, 68, 40] as const;

export function roadmapPathOffsetX(index: number): number {
  return PATH_OFFSETS_PX[index % PATH_OFFSETS_PX.length] ?? 0;
}

type Point = { x: number; y: number };

function curvedRoad(a: Point, b: Point): string {
  const dy = b.y - a.y;
  const pull = Math.max(28, Math.abs(dy) * 0.42);
  return `M ${a.x} ${a.y} C ${a.x} ${a.y + pull}, ${b.x} ${b.y - pull}, ${b.x} ${b.y}`;
}

type Props = {
  children: ReactNode;
  /**
   * マス i → i+1 の道を「通過済み（緑）」にするか。
   * 省略時はすべて灰色。
   */
  segmentCleared?: boolean[];
  className?: string;
};

/** 子（各マス）を縦に並べ、曲線の道を背後に描く */
export function RoadmapPath({ children, segmentCleared, className = "" }: Props) {
  const listRef = useRef<HTMLOListElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const root = listRef.current;
    if (!root) return;

    const measure = () => {
      const rootRect = root.getBoundingClientRect();
      const nodes = root.querySelectorAll<HTMLElement>("[data-roadmap-node]");
      const next: Point[] = [];
      nodes.forEach((node) => {
        const r = node.getBoundingClientRect();
        next.push({
          x: r.left + r.width / 2 - rootRect.left,
          y: r.top + r.height / 2 - rootRect.top,
        });
      });
      setPoints(next);
      setSize({ w: root.offsetWidth, h: root.offsetHeight });
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [children, segmentCleared]);

  return (
    <ol
      ref={listRef}
      className={`relative mx-auto flex w-full max-w-md list-none flex-col items-center gap-8 py-3 sm:gap-9 ${className}`}
    >
      {size.w > 0 && points.length > 1 ? (
        <svg
          className="pointer-events-none absolute inset-0 z-0 overflow-visible"
          width={size.w}
          height={size.h}
          aria-hidden
        >
          {points.slice(0, -1).map((from, index) => {
            const to = points[index + 1];
            if (!to) return null;
            const cleared = Boolean(segmentCleared?.[index]);
            return (
              <path
                key={`road-${index}`}
                d={curvedRoad(from, to)}
                fill="none"
                stroke={cleared ? "#58CC02" : "#D4D4D8"}
                strokeWidth={16}
                strokeLinecap="round"
                opacity={cleared ? 0.85 : 0.9}
              />
            );
          })}
        </svg>
      ) : null}
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
    <li className={`relative z-[1] flex w-full flex-col items-center ${className}`}>
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
