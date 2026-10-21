"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * ゆるい左右の切り替え（道のカーブ）。極端なウネリは避ける。
 */
const PATH_OFFSETS_PX = [0, -22, -34, -22, 0, 22, 34, 22] as const;

export function roadmapPathOffsetX(index: number): number {
  return PATH_OFFSETS_PX[index % PATH_OFFSETS_PX.length] ?? 0;
}

type Point = { x: number; y: number };

/**
 * マス間の道。横ずれは控えめなベジェでつなぎ、
 * 縁＋路面＋中央破線で「道」に見せる（太い一本線のウネリにしない）。
 */
function roadSegment(a: Point, b: Point): string {
  if (Math.abs(a.x - b.x) < 1) {
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }
  const dy = b.y - a.y;
  const pull = Math.abs(dy) * 0.33;
  return `M ${a.x} ${a.y} C ${a.x} ${a.y + pull}, ${b.x} ${b.y - pull}, ${b.x} ${b.y}`;
}

type Props = {
  children: ReactNode;
  /**
   * マス i → i+1 の道を「通過済み」にするか。
   * 省略時はすべて未通過。
   */
  segmentCleared?: boolean[];
  className?: string;
};

type RoadColors = {
  edge: string;
  surface: string;
  dash: string;
};

const ROAD_AHEAD: RoadColors = {
  edge: "#C5C5C5",
  surface: "#EDEDED",
  dash: "#FFFFFF",
};

const ROAD_DONE: RoadColors = {
  edge: "#46A302",
  surface: "#7AC70C",
  dash: "#F4FFE8",
};

/** 子（各マス）を縦に並べ、縁のある道を背後に描く */
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
            const colors = cleared ? ROAD_DONE : ROAD_AHEAD;
            const d = roadSegment(from, to);
            return (
              <g key={`road-${index}`}>
                {/* 道の縁 */}
                <path
                  d={d}
                  fill="none"
                  stroke={colors.edge}
                  strokeWidth={24}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* 路面 */}
                <path
                  d={d}
                  fill="none"
                  stroke={colors.surface}
                  strokeWidth={16}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* 中央の破線 */}
                <path
                  d={d}
                  fill="none"
                  stroke={colors.dash}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="8 12"
                  opacity={0.9}
                />
              </g>
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
