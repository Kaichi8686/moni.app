"use client";

import {
  useLayoutEffect,
  useMemo,
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

function curveTo(a: Point, b: Point): string {
  if (Math.abs(a.x - b.x) < 1) {
    return `L ${b.x} ${b.y}`;
  }
  const dy = b.y - a.y;
  const pull = Math.abs(dy) * 0.33;
  return `C ${a.x} ${a.y + pull}, ${b.x} ${b.y - pull}, ${b.x} ${b.y}`;
}

/** 複数マスを1本の道としてつなぐ */
function buildRoadPath(points: Point[]): string {
  if (points.length < 2) return "";
  const first = points[0];
  if (!first) return "";
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (!prev || !curr) continue;
    d += ` ${curveTo(prev, curr)}`;
  }
  return d;
}

/**
 * 先頭から連続して「通過済み」の区間の終点インデックス。
 * segmentCleared[i] = マス i → i+1 が通過済み。
 */
function clearedEndIndex(segmentCleared: boolean[] | undefined, pointCount: number): number {
  if (!segmentCleared || pointCount < 2) return 0;
  let end = 0;
  for (let i = 0; i < pointCount - 1; i++) {
    if (!segmentCleared[i]) break;
    end = i + 1;
  }
  return end;
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
  edge: "#C2410C",
  surface: "#FB923C",
  dash: "#FFF7ED",
};

function RoadStroke({ d, colors }: { d: string; colors: RoadColors }) {
  if (!d) return null;
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={colors.edge}
        strokeWidth={24}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke={colors.surface}
        strokeWidth={16}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
}

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

  const fullPath = useMemo(() => buildRoadPath(points), [points]);
  const clearedPath = useMemo(() => {
    const end = clearedEndIndex(segmentCleared, points.length);
    if (end < 1) return "";
    return buildRoadPath(points.slice(0, end + 1));
  }, [points, segmentCleared]);

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
          {/* 全体の道（未通過＝灰色） */}
          <RoadStroke d={fullPath} colors={ROAD_AHEAD} />
          {/* 通過済みを上に重ねる（継ぎ目なしの1本） */}
          {clearedPath ? <RoadStroke d={clearedPath} colors={ROAD_DONE} /> : null}
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
