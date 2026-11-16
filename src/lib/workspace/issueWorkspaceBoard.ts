/** 課題作業スペース用のフリーキャンバス（ロイロノート / Miro 風） */

export const BOARD_MARKER = "---moni-board-v1---";

export type SheetColor = "yellow" | "pink" | "sky" | "mint" | "orange" | "lavender" | "white";
export type TextAlign = "left" | "center" | "right";
export type TextVAlign = "top" | "middle" | "bottom";

export const SHEET_COLOR_ORDER: SheetColor[] = [
  "yellow",
  "pink",
  "sky",
  "mint",
  "orange",
  "lavender",
  "white",
];

export const SHEET_COLORS: Record<
  SheetColor,
  { bg: string; border: string; labelJa: string; labelEn: string }
> = {
  yellow: { bg: "#FFF3A0", border: "#E6CF5C", labelJa: "黄", labelEn: "Yellow" },
  pink: { bg: "#FFD6E7", border: "#EFA8C0", labelJa: "桃", labelEn: "Pink" },
  sky: { bg: "#C8E7FF", border: "#8FC4EF", labelJa: "青", labelEn: "Blue" },
  mint: { bg: "#C8F5D8", border: "#8ED9AE", labelJa: "緑", labelEn: "Green" },
  orange: { bg: "#FFD4A8", border: "#F0B070", labelJa: "橙", labelEn: "Orange" },
  lavender: { bg: "#E4D4FF", border: "#C4A8F0", labelJa: "紫", labelEn: "Purple" },
  white: { bg: "#FFFFFF", border: "#D4D4D8", labelJa: "白", labelEn: "White" },
};

export const TEXT_COLOR_ORDER = ["#1A1A1A", "#DC2626", "#2563EB", "#16A34A", "#9333EA", "#FFFFFF"] as const;
export const FONT_SIZE_PRESETS = [12, 14, 18, 24, 32] as const;
export const DEFAULT_FONT_SIZE = 14;
export const DEFAULT_TEXT_COLOR = "#1A1A1A";
export const DEFAULT_TEXT_ALIGN: TextAlign = "center";
export const DEFAULT_TEXT_VALIGN: TextVAlign = "middle";

export type BoardShapeKind = "rect" | "circle" | "triangle" | "line";

/** カード内のオーバーレイ（テキストボックス・図形・手書き・写真） */
export type SheetOverlay =
  | {
      id: string;
      kind: "text";
      x: number;
      y: number;
      w: number;
      h: number;
      text: string;
      fontSize: number;
      textColor: string;
      align: TextAlign;
    }
  | {
      id: string;
      kind: "shape";
      shape: BoardShapeKind;
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      fill?: string;
    }
  | {
      id: string;
      kind: "pen";
      points: Array<{ x: number; y: number }>;
      color: string;
      width: number;
      opacity?: number;
    }
  | {
      id: string;
      kind: "image";
      x: number;
      y: number;
      w: number;
      h: number;
      url: string;
    };

export type BoardSheet = {
  id: string;
  kind: "sheet";
  x: number;
  y: number;
  w: number;
  h: number;
  color: SheetColor;
  text: string;
  z: number;
  fontSize: number;
  textColor: string;
  align: TextAlign;
  valign: TextVAlign;
  overlays?: SheetOverlay[];
};

/** 写真の切り取り（0–1 正規化） */
export type BoardImageCrop = { x: number; y: number; w: number; h: number };

export type BoardImage = {
  id: string;
  kind: "image";
  x: number;
  y: number;
  w: number;
  h: number;
  url: string;
  z: number;
  crop?: BoardImageCrop;
};

/** Googleスライド風テキストボックス */
export type BoardTextBox = {
  id: string;
  kind: "text";
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fontSize: number;
  textColor: string;
  align: TextAlign;
  z: number;
};

export type BoardShape = {
  id: string;
  kind: "shape";
  shape: BoardShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  fill?: string;
  z: number;
};

export type BoardPen = {
  id: string;
  kind: "pen";
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
  opacity?: number;
  z: number;
};

export type BoardArrow = {
  id: string;
  kind: "arrow";
  fromId: string;
  toId: string;
  color: string;
  z: number;
};

/** 位置と大きさを持つ要素（移動・リサイズ対象） */
export type BoardNode = BoardSheet | BoardImage | BoardTextBox | BoardShape;
export type BoardItem = BoardNode | BoardArrow | BoardPen;

export const SHAPE_KIND_ORDER: BoardShapeKind[] = ["rect", "circle", "triangle", "line"];
export const SHAPE_COLORS = ["#1A1A1A", "#DC2626", "#2563EB", "#16A34A", "#F59E0B", "#9333EA"] as const;

export type IssueWorkspaceBoard = {
  v: 1;
  items: BoardItem[];
};

export function createEmptyBoard(): IssueWorkspaceBoard {
  return { v: 1, items: [] };
}

export function newBoardId(prefix = "b"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function isSheetColor(value: unknown): value is SheetColor {
  return typeof value === "string" && value in SHEET_COLORS;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isTextAlign(value: unknown): value is TextAlign {
  return value === "left" || value === "center" || value === "right";
}

function isTextVAlign(value: unknown): value is TextVAlign {
  return value === "top" || value === "middle" || value === "bottom";
}

export function defaultSheetTextStyle(): Pick<BoardSheet, "fontSize" | "textColor" | "align" | "valign"> {
  return {
    fontSize: DEFAULT_FONT_SIZE,
    textColor: DEFAULT_TEXT_COLOR,
    align: DEFAULT_TEXT_ALIGN,
    valign: DEFAULT_TEXT_VALIGN,
  };
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

function isShapeKind(value: unknown): value is BoardShapeKind {
  return value === "rect" || value === "circle" || value === "triangle" || value === "line";
}

function parseCrop(raw: unknown): BoardImageCrop | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  if (![c.x, c.y, c.w, c.h].every(isFiniteNumber)) return undefined;
  const x = Math.min(1, Math.max(0, c.x as number));
  const y = Math.min(1, Math.max(0, c.y as number));
  const w = Math.min(1 - x, Math.max(0.05, c.w as number));
  const h = Math.min(1 - y, Math.max(0.05, c.h as number));
  return { x, y, w, h };
}

function parseOverlay(raw: unknown): SheetOverlay | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id) return null;
  if (row.kind === "text") {
    if (![row.x, row.y, row.w, row.h].every(isFiniteNumber)) return null;
    return {
      id: row.id,
      kind: "text",
      x: row.x as number,
      y: row.y as number,
      w: Math.max(40, row.w as number),
      h: Math.max(24, row.h as number),
      text: typeof row.text === "string" ? row.text : "",
      fontSize:
        isFiniteNumber(row.fontSize) && (row.fontSize as number) >= 8
          ? Math.round(row.fontSize as number)
          : DEFAULT_FONT_SIZE,
      textColor: isHexColor(row.textColor) ? row.textColor : DEFAULT_TEXT_COLOR,
      align: isTextAlign(row.align) ? row.align : "left",
    };
  }
  if (row.kind === "shape") {
    if (![row.x, row.y, row.w, row.h].every(isFiniteNumber) || !isShapeKind(row.shape)) return null;
    return {
      id: row.id,
      kind: "shape",
      shape: row.shape,
      x: row.x as number,
      y: row.y as number,
      w: row.w as number,
      h: row.h as number,
      color: isHexColor(row.color) ? row.color : "#1A1A1A",
      fill: isHexColor(row.fill) ? row.fill : undefined,
    };
  }
  if (row.kind === "pen") {
    if (!Array.isArray(row.points) || row.points.length === 0) return null;
    const points: Array<{ x: number; y: number }> = [];
    for (const pt of row.points) {
      if (!pt || typeof pt !== "object") continue;
      const p = pt as Record<string, unknown>;
      if (!isFiniteNumber(p.x) || !isFiniteNumber(p.y)) continue;
      points.push({ x: p.x, y: p.y });
    }
    if (points.length === 0) return null;
    return {
      id: row.id,
      kind: "pen",
      points,
      color: isHexColor(row.color) ? row.color : "#1A1A1A",
      width: isFiniteNumber(row.width) ? Math.max(1, row.width as number) : 3,
      opacity: isFiniteNumber(row.opacity) ? (row.opacity as number) : undefined,
    };
  }
  if (row.kind === "image") {
    if (![row.x, row.y, row.w, row.h].every(isFiniteNumber)) return null;
    if (typeof row.url !== "string" || !row.url.trim()) return null;
    return {
      id: row.id,
      kind: "image",
      x: row.x as number,
      y: row.y as number,
      w: Math.max(40, row.w as number),
      h: Math.max(40, row.h as number),
      url: row.url.trim(),
    };
  }
  return null;
}

function parseSheet(raw: Record<string, unknown>): BoardSheet | null {
  if (!isFiniteNumber(raw.x) || !isFiniteNumber(raw.y) || !isFiniteNumber(raw.w) || !isFiniteNumber(raw.h)) {
    return null;
  }
  if (typeof raw.id !== "string" || !raw.id) return null;
  if (!isSheetColor(raw.color)) return null;
  const fontSize =
    isFiniteNumber(raw.fontSize) && raw.fontSize >= 8 && raw.fontSize <= 72
      ? Math.round(raw.fontSize)
      : DEFAULT_FONT_SIZE;
  const textColor = isHexColor(raw.textColor) ? raw.textColor : DEFAULT_TEXT_COLOR;
  const overlays = Array.isArray(raw.overlays)
    ? raw.overlays.map(parseOverlay).filter((o): o is SheetOverlay => Boolean(o))
    : undefined;
  return {
    id: raw.id,
    kind: "sheet",
    x: raw.x,
    y: raw.y,
    w: Math.max(80, raw.w),
    h: Math.max(60, raw.h),
    color: raw.color,
    text: typeof raw.text === "string" ? raw.text : "",
    z: isFiniteNumber(raw.z) ? raw.z : 1,
    fontSize,
    textColor,
    align: isTextAlign(raw.align) ? raw.align : DEFAULT_TEXT_ALIGN,
    valign: isTextVAlign(raw.valign) ? raw.valign : DEFAULT_TEXT_VALIGN,
    overlays: overlays && overlays.length > 0 ? overlays : undefined,
  };
}

function parseImage(raw: Record<string, unknown>): BoardImage | null {
  if (!isFiniteNumber(raw.x) || !isFiniteNumber(raw.y) || !isFiniteNumber(raw.w) || !isFiniteNumber(raw.h)) {
    return null;
  }
  if (typeof raw.id !== "string" || !raw.id) return null;
  if (typeof raw.url !== "string" || !raw.url.trim()) return null;
  const crop = parseCrop(raw.crop);
  return {
    id: raw.id,
    kind: "image",
    x: raw.x,
    y: raw.y,
    w: Math.max(80, raw.w),
    h: Math.max(60, raw.h),
    url: raw.url.trim(),
    z: isFiniteNumber(raw.z) ? raw.z : 1,
    crop,
  };
}

function parseTextBox(raw: Record<string, unknown>): BoardTextBox | null {
  if (!isFiniteNumber(raw.x) || !isFiniteNumber(raw.y) || !isFiniteNumber(raw.w) || !isFiniteNumber(raw.h)) {
    return null;
  }
  if (typeof raw.id !== "string" || !raw.id) return null;
  return {
    id: raw.id,
    kind: "text",
    x: raw.x,
    y: raw.y,
    w: Math.max(40, raw.w),
    h: Math.max(28, raw.h),
    text: typeof raw.text === "string" ? raw.text : "",
    fontSize:
      isFiniteNumber(raw.fontSize) && raw.fontSize >= 8 && raw.fontSize <= 96
        ? Math.round(raw.fontSize)
        : 18,
    textColor: isHexColor(raw.textColor) ? raw.textColor : DEFAULT_TEXT_COLOR,
    align: isTextAlign(raw.align) ? raw.align : "left",
    z: isFiniteNumber(raw.z) ? raw.z : 1,
  };
}

function parseShape(raw: Record<string, unknown>): BoardShape | null {
  if (!isFiniteNumber(raw.x) || !isFiniteNumber(raw.y) || !isFiniteNumber(raw.w) || !isFiniteNumber(raw.h)) {
    return null;
  }
  if (typeof raw.id !== "string" || !raw.id) return null;
  if (!isShapeKind(raw.shape)) return null;
  return {
    id: raw.id,
    kind: "shape",
    shape: raw.shape,
    x: raw.x,
    y: raw.y,
    w: raw.w,
    h: raw.h,
    color: isHexColor(raw.color) ? raw.color : "#1A1A1A",
    fill: isHexColor(raw.fill) ? raw.fill : undefined,
    z: isFiniteNumber(raw.z) ? raw.z : 1,
  };
}

function parsePen(raw: Record<string, unknown>): BoardPen | null {
  if (typeof raw.id !== "string" || !raw.id) return null;
  if (!Array.isArray(raw.points) || raw.points.length === 0) return null;
  const points: Array<{ x: number; y: number }> = [];
  for (const pt of raw.points) {
    if (!pt || typeof pt !== "object") continue;
    const p = pt as Record<string, unknown>;
    if (!isFiniteNumber(p.x) || !isFiniteNumber(p.y)) continue;
    points.push({ x: p.x, y: p.y });
  }
  if (points.length === 0) return null;
  return {
    id: raw.id,
    kind: "pen",
    points,
    color: isHexColor(raw.color) ? raw.color : "#1A1A1A",
    width: isFiniteNumber(raw.width) ? Math.max(1, raw.width) : 3,
    opacity: isFiniteNumber(raw.opacity) ? raw.opacity : undefined,
    z: isFiniteNumber(raw.z) ? raw.z : 1,
  };
}

function parseArrow(raw: Record<string, unknown>): BoardArrow | null {
  if (typeof raw.id !== "string" || !raw.id) return null;
  if (typeof raw.fromId !== "string" || !raw.fromId) return null;
  if (typeof raw.toId !== "string" || !raw.toId) return null;
  if (raw.fromId === raw.toId) return null;
  return {
    id: raw.id,
    kind: "arrow",
    fromId: raw.fromId,
    toId: raw.toId,
    color: typeof raw.color === "string" && raw.color ? raw.color : "#52525B",
    z: isFiniteNumber(raw.z) ? raw.z : 0,
  };
}

export function isBoardNode(item: BoardItem): item is BoardNode {
  return item.kind === "sheet" || item.kind === "image" || item.kind === "text" || item.kind === "shape";
}

export function penBounds(pen: BoardPen): { x: number; y: number; w: number; h: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pt of pen.points) {
    minX = Math.min(minX, pt.x);
    minY = Math.min(minY, pt.y);
    maxX = Math.max(maxX, pt.x);
    maxY = Math.max(maxY, pt.y);
  }
  const pad = pen.width;
  return { x: minX - pad, y: minY - pad, w: Math.max(1, maxX - minX + pad * 2), h: Math.max(1, maxY - minY + pad * 2) };
}

export function penToPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y} L ${points[0]!.x + 0.1} ${points[0]!.y}`;
  if (points.length === 2) return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`;
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const mx = (points[i]!.x + points[i + 1]!.x) / 2;
    const my = (points[i]!.y + points[i + 1]!.y) / 2;
    d += ` Q ${points[i]!.x} ${points[i]!.y} ${mx} ${my}`;
  }
  const last = points[points.length - 1]!;
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export function parseWorkspaceBoard(raw: unknown): IssueWorkspaceBoard | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { v?: unknown; items?: unknown };
  if (!Array.isArray(obj.items)) return null;
  const items: BoardItem[] = [];
  for (const entry of obj.items) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const kind = row.kind;
    if (kind === "sheet") {
      const sheet = parseSheet(row);
      if (sheet) items.push(sheet);
      continue;
    }
    if (kind === "image") {
      const image = parseImage(row);
      if (image) items.push(image);
      continue;
    }
    if (kind === "text") {
      const text = parseTextBox(row);
      if (text) items.push(text);
      continue;
    }
    if (kind === "shape") {
      const shape = parseShape(row);
      if (shape) items.push(shape);
      continue;
    }
    if (kind === "pen") {
      const pen = parsePen(row);
      if (pen) items.push(pen);
      continue;
    }
    if (kind === "arrow") {
      const arrow = parseArrow(row);
      if (arrow) items.push(arrow);
    }
  }
  const nodeIds = new Set(items.filter(isBoardNode).map((item) => item.id));
  const cleaned = items.filter((item) => {
    if (item.kind !== "arrow") return true;
    return nodeIds.has(item.fromId) && nodeIds.has(item.toId);
  });
  return { v: 1, items: cleaned };
}

export function boardFromPlainText(text: string): IssueWorkspaceBoard {
  const trimmed = text.trim();
  if (!trimmed) return createEmptyBoard();
  return {
    v: 1,
    items: [
      {
        id: newBoardId("sheet"),
        kind: "sheet",
        x: 80,
        y: 80,
        w: 240,
        h: 180,
        color: "yellow",
        text: trimmed,
        z: 1,
        ...defaultSheetTextStyle(),
      },
    ],
  };
}

/** テキストメモ保存時にボードの先頭用紙へ反映（用紙が無ければ新規） */
export function applyPlainTextToBoard(
  board: IssueWorkspaceBoard | null | undefined,
  text: string,
): IssueWorkspaceBoard {
  const trimmed = text.trim();
  const base = board ?? createEmptyBoard();
  const firstSheet = base.items.find((item): item is BoardSheet => item.kind === "sheet");
  if (!firstSheet) return boardFromPlainText(trimmed);
  return {
    v: 1,
    items: base.items.map((item) =>
      item.id === firstSheet.id && item.kind === "sheet" ? { ...item, text: trimmed } : item,
    ),
  };
}

/** 既存の写真URLをキャンバス上の画像カードへ載せる（重複URLはスキップ） */
export function ensureImagesOnBoard(board: IssueWorkspaceBoard, urls: string[]): IssueWorkspaceBoard {
  const existing = new Set(
    board.items.filter((item): item is BoardImage => item.kind === "image").map((item) => item.url),
  );
  const missing = urls.filter((url) => typeof url === "string" && url.trim() && !existing.has(url.trim()));
  if (missing.length === 0) return board;
  const maxZ = board.items.reduce((acc, item) => Math.max(acc, item.z), 0);
  const nodes = board.items.filter(isBoardNode);
  const offset = nodes.length;
  const added: BoardImage[] = missing.map((url, index) => {
    const col = (offset + index) % 3;
    const row = Math.floor((offset + index) / 3);
    return {
      id: newBoardId("img"),
      kind: "image",
      x: 80 + col * 220,
      y: 300 + row * 180,
      w: 200,
      h: 150,
      url: url.trim(),
      z: maxZ + index + 1,
    };
  });
  return { v: 1, items: [...board.items, ...added] };
}

export function boardPlainText(board: IssueWorkspaceBoard | null | undefined): string {
  if (!board) return "";
  return board.items
    .filter((item): item is BoardSheet => item.kind === "sheet")
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function boardImageUrls(board: IssueWorkspaceBoard | null | undefined): string[] {
  if (!board) return [];
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const item of board.items) {
    if (item.kind !== "image") continue;
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    urls.push(item.url);
  }
  return urls;
}

export function serializeBoardMarker(board: IssueWorkspaceBoard): string {
  return `${BOARD_MARKER}\n${JSON.stringify(board)}`;
}

export function readBoardFromText(text?: string | null): IssueWorkspaceBoard | null {
  if (!text?.includes(BOARD_MARKER)) return null;
  const json = text.slice(text.indexOf(BOARD_MARKER) + BOARD_MARKER.length).trim();
  try {
    return parseWorkspaceBoard(JSON.parse(json));
  } catch {
    return null;
  }
}

export function nodeCenter(node: BoardNode): { x: number; y: number } {
  return { x: node.x + node.w / 2, y: node.y + node.h / 2 };
}

/** 矢印の端点をカード縁に乗せる */
export function edgePoint(from: BoardNode, to: BoardNode): { x: number; y: number } {
  const a = nodeCenter(from);
  const b = nodeCenter(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return a;
  const hw = from.w / 2;
  const hh = from.h / 2;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  if (absDx * hh > absDy * hw) {
    const sx = dx > 0 ? hw : -hw;
    return { x: a.x + sx, y: a.y + (dy * sx) / dx };
  }
  const sy = dy > 0 ? hh : -hh;
  return { x: a.x + (dx * sy) / dy, y: a.y + sy };
}

export function nextZ(items: BoardItem[]): number {
  return items.reduce((acc, item) => Math.max(acc, item.z), 0) + 1;
}
