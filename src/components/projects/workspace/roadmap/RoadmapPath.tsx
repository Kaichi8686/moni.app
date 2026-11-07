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
/** 進行中マスの外枠が切れないよう余白を確保 */
const TOP_PAD = 20;
const STEP_Y = NODE_SIZE + ROW_GAP;
/** 横置きを複数並べられるようトラックを広げる */
const TRACK_WIDTH = 560;
/** 本線から1つ目の横置きまでの距離 */
const SIDE_GAP = 120;

/** 作成空間などでも同じ並びを使うための公開定数 */
export const ROADMAP_PATH_LAYOUT = {
  nodeSize: NODE_SIZE,
  rowGap: ROW_GAP,
  topPad: TOP_PAD,
  stepY: STEP_Y,
  trackWidth: TRACK_WIDTH,
  sideGap: SIDE_GAP,
} as const;

export function roadmapPathOffsetX(index: number): number {
  return PATH_OFFSETS_PX[index % PATH_OFFSETS_PX.length] ?? 0;
}

export function roadmapPathNodeCenter(index: number): { x: number; y: number } {
  return {
    x: TRACK_WIDTH / 2 + roadmapPathOffsetX(index),
    y: TOP_PAD + index * STEP_Y + NODE_SIZE / 2,
  };
}

/** slotIndex: 同じ左右で外側へ 0,1,2…（0が本線にいちばん近い） */
export function roadmapPathSideCenter(
  mainIndex: number,
  lane: -1 | 1,
  slotIndex = 0,
): { x: number; y: number } {
  const main = roadmapPathNodeCenter(mainIndex);
  const rawX = main.x + lane * SIDE_GAP * (Math.max(slotIndex, 0) + 1);
  const minX = NODE_SIZE / 2 + 4;
  const maxX = TRACK_WIDTH - NODE_SIZE / 2 - 4;
  return {
    x: Math.min(Math.max(rawX, minX), maxX),
    y: main.y,
  };
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

export type RoadmapPathSideSlot = {
  key: string;
  lane: -1 | 1;
  /** 同じ左右で本線から何個目か（0が最内） */
  slotIndex?: number;
  /** 下の棒をオレンジにする（横マス達成済み） */
  lowerCleared?: boolean;
  children: ReactNode;
};

type ItemProps = {
  index: number;
  children: ReactNode;
  below?: ReactNode;
  /** 同じ行の横置きマス */
  sides?: RoadmapPathSideSlot[];
  className?: string;
};

/** 位置は親が決める。children = マス、below = タップ時パネル、sides = 横置き */
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
 * - 本線マス: 中央 + offset
 * - 横置き: 同じ Y で左右へ（複数は外側へずらす）
 * - 線: 本線同士＋横置きは上下の本線／内側の横マスへ
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

  useLayoutEffect(() => {
    if (!hasBelow) {
      setMeasuredYs(null);
      return;
    }
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const rootTop = root.getBoundingClientRect().top;
      const discs = root.querySelectorAll<HTMLElement>("[data-roadmap-main-slot]");
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

  const fullPath = buildStraightPath(points);
  const clearedEnd = clearedEndIndex(segmentCleared, points.length);
  const clearedPath = clearedEnd >= 1 ? buildStraightPath(points.slice(0, clearedEnd + 1)) : "";

  /**
   * 横置き:
   * - 最内（slot 0）: 上下の本線へ（下棒は横マス達成時だけオレンジ）
   * - 外側: ひとつ内側の横マスへ水平につなぐ
   */
  const sideLinks = useMemo(() => {
    const links: Array<{ from: Point; to: Point; key: string; cleared: boolean }> = [];
    items.forEach((item, index) => {
      const main = points[index];
      if (!main) return;
      const prev = points[index - 1];
      const next = points[index + 1];
      for (const side of item.props.sides ?? []) {
        const slot = Math.max(side.slotIndex ?? 0, 0);
        const sidePoint = {
          x: roadmapPathSideCenter(index, side.lane, slot).x,
          y: main.y,
        };
        const baseKey = `${item.key ?? index}-${side.key}`;
        if (slot === 0) {
          if (prev) {
            links.push({
              from: prev,
              to: sidePoint,
              key: `${baseKey}-prev`,
              cleared: clearedEnd >= index,
            });
          }
          if (next) {
            links.push({
              from: next,
              to: sidePoint,
              key: `${baseKey}-next`,
              // 下棒は横マスを達成するまで灰色
              cleared: Boolean(side.lowerCleared),
            });
          }
        } else {
          const inner = {
            x: roadmapPathSideCenter(index, side.lane, slot - 1).x,
            y: main.y,
          };
          links.push({
            from: inner,
            to: sidePoint,
            key: `${baseKey}-inner`,
            cleared: clearedEnd >= index,
          });
        }
      }
    });
    return links;
  }, [items, points, clearedEnd]);

  const contentHeight = hasBelow && measuredYs && measuredYs.length > 0
    ? Math.max(...measuredYs) + NODE_SIZE / 2 + 24
    : TOP_PAD + Math.max(count, 1) * STEP_Y - ROW_GAP + 12;

  return (
    <div ref={rootRef} className={`relative mx-auto w-full max-w-lg ${className}`}>
      <div className="relative mx-auto overflow-visible" style={{ width: TRACK_WIDTH, minHeight: contentHeight }}>
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
            {sideLinks.map((link) => (
              <path
                key={link.key}
                d={`M ${link.from.x} ${link.from.y} L ${link.to.x} ${link.to.y}`}
                fill="none"
                stroke={link.cleared ? "#F97316" : "#D4D4D8"}
                strokeWidth={14}
                strokeLinecap="round"
              />
            ))}
          </svg>
        ) : null}

        {count <= 1 && sideLinks.length > 0 ? (
          <svg
            className="pointer-events-none absolute left-0 top-0 z-0 overflow-visible"
            width={TRACK_WIDTH}
            height={contentHeight}
            viewBox={`0 0 ${TRACK_WIDTH} ${contentHeight}`}
            aria-hidden
          >
            {sideLinks.map((link) => (
              <path
                key={link.key}
                d={`M ${link.from.x} ${link.from.y} L ${link.to.x} ${link.to.y}`}
                fill="none"
                stroke={link.cleared ? "#F97316" : "#D4D4D8"}
                strokeWidth={14}
                strokeLinecap="round"
              />
            ))}
          </svg>
        ) : null}

        {items.map((item, index) => {
          const offset = roadmapPathOffsetX(index);
          const top = (measuredYs?.[index] ?? TOP_PAD + index * STEP_Y + NODE_SIZE / 2) - NODE_SIZE / 2;
          const mainY = top + NODE_SIZE / 2;
          return (
            <div key={item.key ?? `node-${index}`}>
              <div
                data-roadmap-main-slot
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
              {(item.props.sides ?? []).map((side) => {
                const slot = Math.max(side.slotIndex ?? 0, 0);
                const sideCenter = roadmapPathSideCenter(index, side.lane, slot);
                return (
                  <div
                    key={side.key}
                    className="roadmap-path-node-in absolute z-[1] flex items-center justify-center"
                    style={{
                      top: mainY - NODE_SIZE / 2,
                      left: sideCenter.x - NODE_SIZE / 2,
                      width: NODE_SIZE,
                      height: NODE_SIZE,
                      animationDelay: `${Math.min(index, 5) * 30 + 40 + slot * 20}ms`,
                    }}
                  >
                    {side.children}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

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
