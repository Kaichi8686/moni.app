"use client";

type Props = {
  /** 文字列グリッド。非空白がピクセル */
  grid: string[];
  palette: Record<string, string>;
  /** 1セルのCSS px */
  scale?: number;
  className?: string;
  title?: string;
};

/**
 * 文字列グリッド＋パレットから SVG rect を描く。
 * 後でスプライト画像に差し替えやすいよう定義は呼び出し側データに分離。
 */
export function PixelSprite({ grid, palette, scale = 4, className, title }: Props) {
  const h = grid.length;
  const w = Math.max(0, ...grid.map((r) => r.length));
  const rects: React.ReactElement[] = [];
  for (let y = 0; y < h; y++) {
    const row = grid[y] ?? "";
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      if (ch === "." || ch === " ") continue;
      const fill = palette[ch];
      if (!fill) continue;
      rects.push(
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />,
      );
    }
  }
  return (
    <svg
      className={className}
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      {rects}
    </svg>
  );
}

/** 固定規格のキャラ（頭身を揃える） */
export const SPRITE_CHAR = {
  w: 16,
  h: 24,
};

export const SPRITE_SECRETARY: { grid: string[]; palette: Record<string, string> } = {
  palette: {
    S: "#f0c8a0",
    H: "#3a2a1a",
    C: "#5eead4",
    K: "#2a2038",
    W: "#fff4dc",
  },
  grid: [
    "......HHHH......",
    ".....HHHHHH.....",
    "....HHSSSSHH....",
    "....HSHSSSHH....",
    "....HSSSSSSH....",
    ".....SSSSSS.....",
    "......S..S......",
    ".....CCCCCC.....",
    "....CCCCCCCC....",
    "....CCWWWWCC....",
    "....CCCCCCCC....",
    "....CC....CC....",
    "....CC....CC....",
    ".....K....K.....",
    ".....K....K.....",
    ".....KK..KK.....",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
};
