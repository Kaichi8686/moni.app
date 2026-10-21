"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * 左右に少しずらして縦に並べる（直線でつなぐ前提なので控えめ）。
 */
const PATH_OFFSETS_PX = [0, -28, -40, -28, 0, 28, 40, 28] as const;

export function roadmapPathOffsetX(index: number): number {
  return PATH_OFFSETS_PX[index % PATH_OFFSETS_PX.length] ?? 0;
}

type Point = { x: number; y: number };

/** マス中心を直線でつなぐ */
function buildStraightPath(points: Point[]): string {
  if (points.length < 2) return "";
  const first = points[0];
  if (!first) return "";
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (!p) continue;
    d += ` L ${p.x} ${p.y}`;
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
   * マス i → i+1 の線を「通過済み（オレンジ）」にするか。
   * 省略時はすべて灰色。
   */
  segmentCleared?: boolean[];
  className?: string;
};

/** 子（各マス）を縦に並べ、マス間を細い直線でつなぐ */
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
    const raf = window.requestAnimationFrame(() => measure());
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    window.addEventListener("resize", measure);
    return () => {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [children, segmentCleared]);

  const fullPath = useMemo(() => buildStraightPath(points), [points]);
  const clearedPath = useMemo(() => {
    const end = clearedEndIndex(segmentCleared, points.length);
    if (end < 1) return "";
    return buildStraightPath(points.slice(0, end + 1));
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
          {/* 太い直線（マスの下に敷く） */}
          <path
            d={fullPath}
            fill="none"
            stroke="#D4D4D8"
            strokeWidth={12}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {clearedPath ? (
            <path
              d={clearedPath}
              fill="none"
              stroke="#F97316"
              strokeWidth={12}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </svg>
      ) : null}
      {children}
    </ol>
  );
}

type ItemProps = {
  index: number;
  children: ReactNode;
  /** 直線パスからずらさず中央に置く追従コンテンツ（詳細パネルなど） */
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
