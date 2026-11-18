"use client";

type Props = {
  grid: string[];
  palette: Record<string, string>;
  /** 1ドットのCSS px（既定6） */
  scale?: number;
  className?: string;
  title?: string;
};

/** 文字列グリッド＋パレット → SVG rect（差し替え可能なデータ駆動） */
export function PixelSprite({ grid, palette, scale = 6, className, title }: Props) {
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
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />);
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
