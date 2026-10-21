"use client";

import {
  Children,
  isValidElement,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

const PATH_OFFSETS_PX = [0, -28, -40, -28, 0, 28, 40, 28] as const;
const NODE_SIZE = 80;
const ROW_GAP = 40;
const TOP_PAD = 12;
const STEP_Y = NODE_SIZE + ROW_GAP;
const TRACK_WIDTH = 360;

export function roadmapPathOffsetX(index: number): number {
  return PATH_OFFSETS_PX[index % PATH_OFFSETS_PX.length] ?? 0;
}

type Point = { x: number; y: number };

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

function clearedEndIndex(segmentCleared: boolean[] | undefined, pointCount: number): number {
  if (!segmentCleared || pointCount < 2) return 0;
  let end = 0;
  for (let i = 0; i < pointCount - 1; i++) {
    if (!segmentCleared[i]) break;
    end = i + 1;
  }
  return end;
}

type ItemProps = {
  index: number;
  children: ReactNode;
  below?: ReactNode;
  className?: string;
};

/** 位置は親が決める。children = マス、below = タップ時パネル */
export function RoadmapPathItem(_props: ItemProps) {
  return null;
}

type Props = {
  children: ReactNode;
  segmentCleared?: boolean[];
  className?: string;
};

/**
 * マスと線を同じ座標系で描く。
 * - マス: 中央 + offset
 * - 線: 同じ中心座標を太い直線で接続
 */
export function RoadmapPath({ children, segmentCleared, className = "" }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [measuredYs, setMeasuredYs] = useState<number[] | null>(null);

  const items = useMemo(() => {
    const list: ReactElement<ItemProps>[] = [];
    Children.forEach(children, (child) => {
      if (isValidElement<ItemProps>(child)) list.push(child);
    });
    return list;
  }, [children]);

  const count = items.length;
  const hasBelow = items.some((item) => Boolean(item.props.below));

  // 閉じているときは定数座標。詳細パネル展開時だけ実測 Y に切り替える
  useLayoutEffect(() => {
    if (!hasBelow) {
      setMeasuredYs(null);
      return;
    }
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const rootTop = root.getBoundingClientRect().top;
      const discs = root.querySelectorAll<HTMLElement>("[data-roadmap-node]");
      const ys: number[] = [];
      discs.forEach((disc) => {
        const r = disc.getBoundingClientRect();
        ys.push(r.top - rootTop + r.height / 2);
      });
      if (ys.length === count) setMeasuredYs(ys);
    };
    measure();
    const t = window.setTimeout(measure, 50);
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
    };
  }, [hasBelow, count, children]);

  const points: Point[] = useMemo(() => {
    return Array.from({ length: count }, (_, index) => ({
      x: TRACK_WIDTH / 2 + roadmapPathOffsetX(index),
      y: measuredYs?.[index] ?? TOP_PAD + index * STEP_Y + NODE_SIZE / 2,
    }));
  }, [count, measuredYs]);

  const contentHeight = hasBelow && measuredYs && measuredYs.length > 0
    ? Math.max(...measuredYs) + NODE_SIZE / 2 + 24
    : TOP_PAD + Math.max(count, 1) * STEP_Y - ROW_GAP + 12;

  const fullPath = buildStraightPath(points);
  const end = clearedEndIndex(segmentCleared, points.length);
  const clearedPath = end >= 1 ? buildStraightPath(points.slice(0, end + 1)) : "";

  return (
    <div ref={rootRef} className={`relative mx-auto w-full max-w-md ${className}`}>
      <div className="relative mx-auto" style={{ width: TRACK_WIDTH, minHeight: contentHeight }}>
        {count > 1 && fullPath ? (
          <svg
            className="pointer-events-none absolute left-0 top-0 z-0 overflow-visible"
            width={TRACK_WIDTH}
            height={contentHeight}
            viewBox={`0 0 ${TRACK_WIDTH} ${contentHeight}`}
            aria-hidden
          >
            <path
              d={fullPath}
              fill="none"
              stroke="#D4D4D8"
              strokeWidth={14}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {clearedPath ? (
              <path
                d={clearedPath}
                fill="none"
                stroke="#F97316"
                strokeWidth={14}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
          </svg>
        ) : null}

        {items.map((item, index) => {
          const offset = roadmapPathOffsetX(index);
          const top = (measuredYs?.[index] ?? TOP_PAD + index * STEP_Y + NODE_SIZE / 2) - NODE_SIZE / 2;
          return (
            <div key={item.key ?? `node-${index}`}>
              <div
                className="roadmap-path-node-in absolute z-[1] flex items-center justify-center"
                style={{
                  top,
                  left: TRACK_WIDTH / 2 + offset - NODE_SIZE / 2,
                  width: NODE_SIZE,
                  height: NODE_SIZE,
                  animationDelay: `${Math.min(index, 5) * 30}ms`,
                }}
              >
                {item.props.children}
              </div>
            </div>
          );
        })}
      </div>

      {/* 詳細パネルは線トラックの下に並べる（展開時は Y を実測して線を追従） */}
      {items.map((item, index) =>
        item.props.below ? (
          <div key={`below-${item.key ?? index}`} className="mx-auto mt-2 w-full max-w-sm px-1">
            {item.props.below}
          </div>
        ) : null,
      )}
    </div>
  );
}
