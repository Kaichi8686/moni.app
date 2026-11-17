"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

function subscribeNever() {
  return () => {};
}
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowUpRight,
  ChevronLeft,
  Circle,
  Crop,
  Eraser,
  Link2,
  Minus,
  MousePointer2,
  Paperclip,
  PenLine,
  Plus,
  Redo2,
  Square,
  StickyNote,
  Triangle,
  Type,
  Trash2,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  defaultSheetTextStyle,
  edgePoint,
  FONT_SIZE_PRESETS,
  isBoardNode,
  newBoardId,
  nextZ,
  penBounds,
  penToPath,
  SHAPE_COLORS,
  SHEET_COLOR_ORDER,
  SHEET_COLORS,
  TEXT_COLOR_ORDER,
  isConnectorArrow,
  isFreeformArrow,
  type BoardArrow,
  type BoardImage,
  type BoardImageCrop,
  type BoardItem,
  type BoardNode,
  type BoardPen,
  type BoardShape,
  type BoardShapeKind,
  type BoardSheet,
  type BoardTextBox,
  type IssueWorkspaceBoard,
  type SheetColor,
  type SheetOverlay,
  type TextAlign,
} from "@/lib/workspace/issueWorkspaceBoard";

/** navigate = 通常 / select = 囲み選択 / text·shape·pen = 挿入 / sheet·arrow = 既存 */
type Tool = "navigate" | "select" | "sheet" | "arrow" | "text" | "shape" | "pen";
type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

type Props = {
  board: IssueWorkspaceBoard;
  canEdit: boolean;
  uploading?: boolean;
  onChange: (board: IssueWorkspaceBoard) => void;
  onRequestPhoto: () => void;
  /** 全画面レイアウト（課題フリースペース用） */
  fullscreen?: boolean;
  /** ツールバー左端（戻るボタンなど） */
  toolbarStart?: ReactNode;
};

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;
const DEFAULT_SHEET_W = 200;
const DEFAULT_SHEET_H = 160;
const DEFAULT_IMAGE_W = 200;
const DEFAULT_IMAGE_H = 150;
const IMAGE_INSERT_MAX_W = 240;
/** 画面内に必ず残すコンテンツの最低ピクセル */
const KEEP_VISIBLE_PX = 96;
const EMPTY_WORLD = { minX: 40, minY: 40, maxX: 520, maxY: 420 };
/** ロイロノート / スライド風の選択枠 */
const SELECTION_YELLOW = "#FACC15";
const FULL_CROP: BoardImageCrop = { x: 0, y: 0, w: 1, h: 1 };

function measureImageDisplaySize(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    if (typeof Image === "undefined") {
      resolve({ w: DEFAULT_IMAGE_W, h: DEFAULT_IMAGE_H });
      return;
    }
    const img = new Image();
    img.onload = () => {
      const nw = Math.max(1, img.naturalWidth || DEFAULT_IMAGE_W);
      const nh = Math.max(1, img.naturalHeight || DEFAULT_IMAGE_H);
      const w = IMAGE_INSERT_MAX_W;
      const h = Math.max(48, Math.round((IMAGE_INSERT_MAX_W * nh) / nw));
      resolve({ w, h });
    };
    img.onerror = () => resolve({ w: DEFAULT_IMAGE_W, h: DEFAULT_IMAGE_H });
    img.src = url;
  });
}

function strokesNear(
  a: Array<{ x: number; y: number }>,
  b: Array<{ x: number; y: number }>,
  thresh: number,
) {
  for (const p of a) {
    for (const q of b) {
      if (Math.hypot(p.x - q.x, p.y - q.y) <= thresh) return true;
    }
  }
  return false;
}

/** 図形ツール用：複数図形が見えるアイコン */
function ShapesGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="9" height="9" rx="1.5" />
      <circle cx="17.5" cy="7.5" r="3.5" />
      <path d="M8 21 L12 13 L16 21 Z" />
    </svg>
  );
}

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

type DragState =
  | { kind: "pan"; startX: number; startY: number; panX: number; panY: number }
  | {
      kind: "move";
      id: string;
      ids: string[];
      startX: number;
      startY: number;
      origins: Record<string, { x: number; y: number }>;
      penOrigins: Record<string, Array<{ x: number; y: number }>>;
      moved: boolean;
    }
  | {
      kind: "resize";
      id: string;
      handle: ResizeHandle;
      startX: number;
      startY: number;
      origX: number;
      origY: number;
      origW: number;
      origH: number;
    }
  | {
      kind: "marquee";
      startX: number;
      startY: number;
      curX: number;
      curY: number;
    }
  | {
      kind: "draw-shape";
      shape: BoardShapeKind;
      startX: number;
      startY: number;
      curX: number;
      curY: number;
    }
  | {
      kind: "draw-pen";
      points: Array<{ x: number; y: number }>;
    }
  | {
      kind: "draw-arrow";
      startX: number;
      startY: number;
      curX: number;
      curY: number;
    }
  | {
      kind: "crop-adjust";
      id: string;
      handle: ResizeHandle | "move";
      startX: number;
      startY: number;
      orig: BoardImageCrop;
    };

type PinchState = {
  dist: number;
  zoom: number;
  panX: number;
  panY: number;
  midX: number;
  midY: number;
};

function isNode(item: BoardItem): item is BoardNode {
  return isBoardNode(item);
}

function itemBounds(item: BoardItem): { x: number; y: number; w: number; h: number } | null {
  if (isBoardNode(item)) return { x: item.x, y: item.y, w: item.w, h: item.h };
  if (item.kind === "pen") return penBounds(item);
  return null;
}

function rectsIntersect(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function normalizeRect(x0: number, y0: number, x1: number, y1: number) {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  return { x, y, w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
}

const MIN_NODE_W = 40;
const MIN_NODE_H = 28;

function resizeByHandle(
  handle: ResizeHandle,
  ox: number,
  oy: number,
  ow: number,
  oh: number,
  dx: number,
  dy: number,
) {
  let x = ox;
  let y = oy;
  let w = ow;
  let h = oh;
  if (handle.includes("e")) w = ow + dx;
  if (handle.includes("s")) h = oh + dy;
  if (handle.includes("w")) {
    w = ow - dx;
    x = ox + dx;
  }
  if (handle.includes("n")) {
    h = oh - dy;
    y = oy + dy;
  }
  if (w < MIN_NODE_W) {
    if (handle.includes("w")) x = ox + ow - MIN_NODE_W;
    w = MIN_NODE_W;
  }
  if (h < MIN_NODE_H) {
    if (handle.includes("n")) y = oy + oh - MIN_NODE_H;
    h = MIN_NODE_H;
  }
  return { x, y, w, h };
}

const RESIZE_HANDLES: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function handleCursor(handle: ResizeHandle) {
  if (handle === "n" || handle === "s") return "ns-resize";
  if (handle === "e" || handle === "w") return "ew-resize";
  if (handle === "ne" || handle === "sw") return "nesw-resize";
  return "nwse-resize";
}

function handleStyle(handle: ResizeHandle): CSSProperties {
  const base: CSSProperties = {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 2,
    background: "#fff",
    border: `2px solid ${SELECTION_YELLOW}`,
    boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
    zIndex: 20,
    touchAction: "none",
  };
  const mid = "calc(50% - 5px)";
  if (handle.includes("n")) base.top = -5;
  if (handle.includes("s")) base.bottom = -5;
  if (handle.includes("w")) base.left = -5;
  if (handle.includes("e")) base.right = -5;
  if (handle === "n" || handle === "s") base.left = mid;
  if (handle === "e" || handle === "w") base.top = mid;
  return base;
}

function ShapeGeometry({
  shape,
  color,
  fill,
  w,
  h,
  dashed,
  /** カード内 % viewBox 向け。点線を細く一定幅で描く */
  hairline,
}: {
  shape: BoardShapeKind;
  color: string;
  fill?: string;
  w: number;
  h: number;
  dashed?: boolean;
  hairline?: boolean;
}) {
  const strokeDasharray = dashed ? (hairline ? "3 2.5" : "6 4") : undefined;
  const strokeWidth = hairline ? (dashed ? 0.9 : 1.25) : dashed ? 1.25 : 2.5;
  const nonScaling = hairline ? ("non-scaling-stroke" as const) : undefined;
  if (shape === "circle") {
    return (
      <ellipse
        cx={w / 2}
        cy={h / 2}
        rx={Math.max(1, Math.abs(w / 2) - 1)}
        ry={Math.max(1, Math.abs(h / 2) - 1)}
        fill={fill ?? "transparent"}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        vectorEffect={nonScaling}
      />
    );
  }
  if (shape === "triangle") {
    const points = `${w / 2},2 ${Math.max(2, w - 2)},${h - 2} 2,${h - 2}`;
    return (
      <polygon
        points={points}
        fill={fill ?? "transparent"}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        vectorEffect={nonScaling}
      />
    );
  }
  if (shape === "line") {
    return (
      <line
        x1={2}
        y1={h / 2}
        x2={Math.max(2, w - 2)}
        y2={h / 2}
        stroke={color}
        strokeWidth={strokeWidth + (hairline ? 0.2 : 0.5)}
        strokeDasharray={strokeDasharray}
        strokeLinecap="round"
        vectorEffect={nonScaling}
      />
    );
  }
  return (
    <rect
      x={1}
      y={1}
      width={Math.max(1, w - 2)}
      height={Math.max(1, h - 2)}
      rx={2}
      fill={fill ?? "transparent"}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      vectorEffect={nonScaling}
    />
  );
}

function contentBounds(nodes: BoardNode[]): Bounds {
  if (nodes.length === 0) return { ...EMPTY_WORLD };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.w);
    maxY = Math.max(maxY, node.y + node.h);
  }
  const pad = 40;
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** 紙・写真が必ず画面に少し映るようにパンを制限 */
function clampPan(
  pan: { x: number; y: number },
  zoom: number,
  viewport: { w: number; h: number },
  bounds: Bounds,
): { x: number; y: number } {
  if (viewport.w <= 0 || viewport.h <= 0) return pan;
  const keep = Math.min(KEEP_VISIBLE_PX, viewport.w * 0.35, viewport.h * 0.35);

  // 画面座標でのコンテンツ矩形: world * zoom + pan
  // contentRight >= keep  →  pan.x >= keep - maxX * zoom
  // contentLeft  <= vw-keep → pan.x <= vw - keep - minX * zoom
  let minPanX = keep - bounds.maxX * zoom;
  let maxPanX = viewport.w - keep - bounds.minX * zoom;
  let minPanY = keep - bounds.maxY * zoom;
  let maxPanY = viewport.h - keep - bounds.minY * zoom;

  if (minPanX > maxPanX) {
    const centerX = (viewport.w - (bounds.minX + bounds.maxX) * zoom) / 2;
    minPanX = centerX;
    maxPanX = centerX;
  }
  if (minPanY > maxPanY) {
    const centerY = (viewport.h - (bounds.minY + bounds.maxY) * zoom) / 2;
    minPanY = centerY;
    maxPanY = centerY;
  }

  return {
    x: Math.min(maxPanX, Math.max(minPanX, pan.x)),
    y: Math.min(maxPanY, Math.max(minPanY, pan.y)),
  };
}

function pointerDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointerMid(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function IssueWorkspaceCanvas({
  board,
  canEdit,
  uploading,
  onChange,
  onRequestPhoto,
  fullscreen = false,
  toolbarStart,
}: Props) {
  const { tx, locale } = useI18n();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [tool, setTool] = useState<Tool>("navigate");
  const [sheetColor, setSheetColor] = useState<SheetColor>("yellow");
  const [shapeKind, setShapeKind] = useState<BoardShapeKind>("rect");
  const [shapeColor, setShapeColor] = useState<string>(SHAPE_COLORS[0]!);
  const [shapePickerOpen, setShapePickerOpen] = useState(false);
  const [penColor, setPenColor] = useState("#1A1A1A");
  const [penEraser, setPenEraser] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds[0] ?? null;
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  /** ロイロノート風：紙をタップで全画面編集 */
  const [openSheetId, setOpenSheetId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [cropImageId, setCropImageId] = useState<string | null>(null);
  /** 切り取りドラッグ中の仮枠（毎フレーム board を書き換えない） */
  const [cropDraft, setCropDraft] = useState<BoardImageCrop | null>(null);
  const [handlesVisible, setHandlesVisible] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const lastNodeTap = useRef<{ id: string; t: number; x: number; y: number } | null>(null);
  const cropDraftRef = useRef<BoardImageCrop | null>(null);
  const [pan, setPan] = useState({ x: 24, y: 24 });
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const boardRef = useRef(board);
  boardRef.current = board;
  const [viewport, setViewport] = useState({ w: 1, h: 1 });
  const dragRef = useRef<DragState | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<PinchState | null>(null);
  const [dragTick, setDragTick] = useState(0);
  const historyRef = useRef<{ past: IssueWorkspaceBoard[]; future: IssueWorkspaceBoard[] }>({
    past: [],
    future: [],
  });
  const skipHistoryRef = useRef(false);
  const [historyTick, setHistoryTick] = useState(0);
  void historyTick;
  const toolbarMounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  const toolbarHidden = openSheetId !== null;
  const insertToolbarHidden = Boolean(cropImageId) || Boolean(editingTextId);

  function setSelectedId(id: string | null) {
    setSelectedIds(id ? [id] : []);
    if (!id) setHandlesVisible(false);
  }

  function resetScrollParents() {
    let node: HTMLElement | null = shellRef.current;
    while (node) {
      if (node.scrollTop || node.scrollLeft) {
        node.scrollTop = 0;
        node.scrollLeft = 0;
      }
      node = node.parentElement;
    }
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }
  }

  const nodes = useMemo(() => board.items.filter(isNode), [board.items]);
  const arrows = useMemo(
    () => board.items.filter((item): item is BoardArrow => item.kind === "arrow"),
    [board.items],
  );
  const nodeMap = useMemo(() => {
    const map = new Map<string, BoardNode>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);
  const bounds = useMemo(() => contentBounds(nodes), [nodes]);
  const sortedNodes = useMemo(() => [...nodes].sort((a, b) => a.z - b.z), [nodes]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setViewport({ w: rect.width, h: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // キーボード閉じたあと操作バーが画面外に残らないようスクロールを戻す
  useEffect(() => {
    if (openSheetId) return;
    resetScrollParents();
    const timer = window.setTimeout(resetScrollParents, 120);
    return () => window.clearTimeout(timer);
  }, [openSheetId]);

  useEffect(() => {
    if (!openSheetId) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenSheetId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [openSheetId]);

  const viewPan = useMemo(
    () => clampPan(pan, zoom, viewport, bounds),
    [pan, zoom, viewport, bounds],
  );

  function selectTool(next: Tool) {
    setTool(next);
    if (next !== "arrow") setConnectFromId(null);
    if (next !== "shape") setShapePickerOpen(false);
    if (next === "select" || next === "text" || next === "shape" || next === "pen" || next === "sheet" || next === "arrow") {
      setHandlesVisible(false);
    }
    // 挿入後に navigate へ戻ったときだけプラスメニューを閉じる
    if (next === "navigate" || next === "select" || next === "pen") {
      setPlusMenuOpen(false);
    }
    if (next !== "pen") setPenEraser(false);
  }

  const pens = useMemo(
    () => board.items.filter((item): item is BoardPen => item.kind === "pen"),
    [board.items],
  );
  const cropImage = useMemo(() => {
    if (!cropImageId) return null;
    const item = board.items.find((entry) => entry.id === cropImageId);
    return item?.kind === "image" ? item : null;
  }, [board.items, cropImageId]);
  const marqueePreview = dragRef.current?.kind === "marquee" ? dragRef.current : null;
  const drawShapePreview = dragRef.current?.kind === "draw-shape" ? dragRef.current : null;
  const drawPenPreview = dragRef.current?.kind === "draw-pen" ? dragRef.current : null;
  const drawArrowPreview = dragRef.current?.kind === "draw-arrow" ? dragRef.current : null;
  void dragTick;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  function commit(items: BoardItem[]) {
    if (!skipHistoryRef.current) {
      historyRef.current.past.push({
        v: 1,
        items: boardRef.current.items.map((item) => ({ ...item })) as BoardItem[],
      });
      if (historyRef.current.past.length > 60) historyRef.current.past.shift();
      historyRef.current.future = [];
      setHistoryTick((n) => n + 1);
    }
    onChangeRef.current({ v: 1, items });
  }

  function undoBoard() {
    const prev = historyRef.current.past.pop();
    if (!prev) return;
    historyRef.current.future.push({
      v: 1,
      items: boardRef.current.items.map((item) => ({ ...item })) as BoardItem[],
    });
    skipHistoryRef.current = true;
    onChangeRef.current(prev);
    skipHistoryRef.current = false;
    setHistoryTick((n) => n + 1);
    setSelectedIds([]);
    setHandlesVisible(false);
    setCropImageId(null);
    setCropDraft(null);
    cropDraftRef.current = null;
  }

  function redoBoard() {
    const next = historyRef.current.future.pop();
    if (!next) return;
    historyRef.current.past.push({
      v: 1,
      items: boardRef.current.items.map((item) => ({ ...item })) as BoardItem[],
    });
    skipHistoryRef.current = true;
    onChangeRef.current(next);
    skipHistoryRef.current = false;
    setHistoryTick((n) => n + 1);
    setSelectedIds([]);
    setHandlesVisible(false);
    setCropImageId(null);
    setCropDraft(null);
    cropDraftRef.current = null;
  }

  function updateItem(id: string, patch: Partial<BoardItem>) {
    commit(
      boardRef.current.items.map((item) => (item.id === id ? ({ ...item, ...patch } as BoardItem) : item)),
    );
  }

  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;

  function applyView(nextZoom: number, nextPan: { x: number; y: number }) {
    const z = clampZoom(nextZoom);
    setZoom(z);
    setPan(clampPan(nextPan, z, viewport, bounds));
  }

  function clientToWorld(clientX: number, clientY: number) {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - viewPan.x) / zoom,
      y: (clientY - rect.top - viewPan.y) / zoom,
    };
  }

  function pickSheetColor(color: SheetColor) {
    if (!canEdit) return;
    setSheetColor(color);
    selectTool("sheet");
  }

  function placeSheetAt(worldX: number, worldY: number) {
    if (!canEdit) return;
    const sheet: BoardSheet = {
      id: newBoardId("sheet"),
      kind: "sheet",
      x: worldX - DEFAULT_SHEET_W / 2,
      y: worldY - DEFAULT_SHEET_H / 2,
      w: DEFAULT_SHEET_W,
      h: DEFAULT_SHEET_H,
      color: sheetColor,
      text: "",
      z: nextZ(board.items),
      ...defaultSheetTextStyle(),
    };
    commit([...board.items, sheet]);
    setSelectedId(sheet.id);
    selectTool("navigate");
  }

  const openSheet = useMemo(() => {
    if (!openSheetId) return null;
    const item = board.items.find((entry) => entry.id === openSheetId);
    return item?.kind === "sheet" ? item : null;
  }, [board.items, openSheetId]);

  function patchOpenSheet(patch: Partial<BoardSheet>) {
    if (!openSheet || !canEdit) return;
    updateItem(openSheet.id, patch);
  }

  function closeOpenSheet() {
    setOpenSheetId(null);
    window.setTimeout(resetScrollParents, 50);
  }

  function deleteSelected() {
    if (!canEdit || selectedIds.length === 0) return;
    const drop = new Set(selectedIds);
    commit(
      board.items.filter((item) => {
        if (drop.has(item.id)) return false;
        if (
          item.kind === "arrow" &&
          ((item.fromId && drop.has(item.fromId)) || (item.toId && drop.has(item.toId)))
        ) {
          return false;
        }
        return true;
      }),
    );
    setSelectedIds([]);
    setHandlesVisible(false);
    setCropImageId(null);
  }

  function deleteItemById(id: string) {
    if (!canEdit) return;
    commit(
      board.items.filter((item) => {
        if (item.id === id) return false;
        if (item.kind === "arrow" && (item.fromId === id || item.toId === id)) return false;
        return true;
      }),
    );
    if (selectedIds.includes(id)) setSelectedIds((ids) => ids.filter((x) => x !== id));
    if (openSheetId === id) setOpenSheetId(null);
    if (cropImageId === id) setCropImageId(null);
  }

  function bringToFront(id: string) {
    updateItem(id, { z: nextZ(board.items) } as Partial<BoardItem>);
  }

  function beginPinch() {
    const pts = [...pointersRef.current.values()];
    if (pts.length < 2) return;
    const mid = pointerMid(pts[0], pts[1]);
    const rect = rootRef.current?.getBoundingClientRect();
    pinchRef.current = {
      dist: Math.max(1, pointerDistance(pts[0], pts[1])),
      zoom,
      panX: viewPan.x,
      panY: viewPan.y,
      midX: mid.x - (rect?.left ?? 0),
      midY: mid.y - (rect?.top ?? 0),
    };
    dragRef.current = null;
  }

  function updatePinch() {
    const pinch = pinchRef.current;
    const pts = [...pointersRef.current.values()];
    if (!pinch || pts.length < 2) return;
    const dist = Math.max(1, pointerDistance(pts[0], pts[1]));
    const mid = pointerMid(pts[0], pts[1]);
    const rect = rootRef.current?.getBoundingClientRect();
    const midX = mid.x - (rect?.left ?? 0);
    const midY = mid.y - (rect?.top ?? 0);
    const nextZoom = clampZoom(pinch.zoom * (dist / pinch.dist));
    // ピンチ中心を基準にズーム
    const worldX = (pinch.midX - pinch.panX) / pinch.zoom;
    const worldY = (pinch.midY - pinch.panY) / pinch.zoom;
    const nextPan = {
      x: midX - worldX * nextZoom,
      y: midY - worldY * nextZoom,
    };
    applyView(nextZoom, nextPan);
  }

  function onCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-board-ui]")) return;

    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);

    if (pointersRef.current.size >= 2) {
      beginPinch();
      return;
    }

    if (target.closest("[data-board-node]")) return;

    const world = clientToWorld(event.clientX, event.clientY);

    // 切り取り中に写真以外をタップ → 確定
    if (cropImageId) {
      const draft = cropDraftRef.current;
      if (draft) updateItem(cropImageId, { crop: draft });
      setCropImageId(null);
      setCropDraft(null);
      cropDraftRef.current = null;
      setHandlesVisible(false);
      return;
    }

    if (canEdit && tool === "text") {
      const box: BoardTextBox = {
        id: newBoardId("text"),
        kind: "text",
        x: world.x - 80,
        y: world.y - 20,
        w: 160,
        h: 48,
        text: "",
        fontSize: 18,
        textColor: "#1A1A1A",
        align: "left",
        z: nextZ(board.items),
      };
      commit([...board.items, box]);
      setSelectedIds([box.id]);
      setEditingTextId(box.id);
      setHandlesVisible(true);
      selectTool("navigate");
      return;
    }

    if (canEdit && tool === "sheet") {
      placeSheetAt(world.x, world.y);
      return;
    }

    if (canEdit && tool === "shape") {
      dragRef.current = {
        kind: "draw-shape",
        shape: shapeKind,
        startX: world.x,
        startY: world.y,
        curX: world.x,
        curY: world.y,
      };
      setDragTick((n) => n + 1);
      return;
    }

    if (canEdit && tool === "arrow") {
      setConnectFromId(null);
      dragRef.current = {
        kind: "draw-arrow",
        startX: world.x,
        startY: world.y,
        curX: world.x,
        curY: world.y,
      };
      setDragTick((n) => n + 1);
      return;
    }

    if (canEdit && tool === "pen") {
      dragRef.current = { kind: "draw-pen", points: [world] };
      setDragTick((n) => n + 1);
      return;
    }

    if (tool === "select") {
      dragRef.current = {
        kind: "marquee",
        startX: world.x,
        startY: world.y,
        curX: world.x,
        curY: world.y,
      };
      setDragTick((n) => n + 1);
      return;
    }

    setSelectedId(null);
    setEditingTextId(null);
    if (tool === "arrow") setConnectFromId(null);
    dragRef.current = {
      kind: "pan",
      startX: event.clientX,
      startY: event.clientY,
      panX: viewPan.x,
      panY: viewPan.y,
    };
  }

  function onNodePointerDown(event: ReactPointerEvent<HTMLDivElement>, node: BoardNode) {
    if (event.button !== 0) return;
    event.stopPropagation();

    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);

    if (pointersRef.current.size >= 2) {
      beginPinch();
      return;
    }

    if (!canEdit) {
      setSelectedId(node.id);
      return;
    }

    if (tool === "arrow" && (node.kind === "sheet" || node.kind === "image")) {
      if (!connectFromId) {
        setConnectFromId(node.id);
        setSelectedId(node.id);
        return;
      }
      if (connectFromId === node.id) {
        setConnectFromId(null);
        return;
      }
      const exists = arrows.some(
        (arrow) =>
          (arrow.fromId === connectFromId && arrow.toId === node.id) ||
          (arrow.fromId === node.id && arrow.toId === connectFromId),
      );
      if (!exists) {
        const arrow: BoardArrow = {
          id: newBoardId("arrow"),
          kind: "arrow",
          fromId: connectFromId,
          toId: node.id,
          color: "#52525B",
          z: 0,
        };
        commit([...board.items, arrow]);
      }
      setConnectFromId(null);
      setSelectedId(node.id);
      selectTool("navigate");
      return;
    }

    if (tool === "sheet" || tool === "text" || tool === "shape" || tool === "pen" || tool === "select") {
      selectTool("navigate");
    }

    const inGroup = selectedIds.includes(node.id) && selectedIds.length > 1;
    const ids = inGroup ? selectedIds : [node.id];
    if (!inGroup) setSelectedIds([node.id]);
    bringToFront(node.id);

    longPressFiredRef.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setHandlesVisible(true);
      if (node.kind === "image") setCropImageId(null);
    }, 420);

    const origins: Record<string, { x: number; y: number }> = {};
    const penOrigins: Record<string, Array<{ x: number; y: number }>> = {};
    for (const id of ids) {
      const n = nodeMap.get(id);
      if (n) origins[id] = { x: n.x, y: n.y };
      const pen = board.items.find((item): item is BoardPen => item.kind === "pen" && item.id === id);
      if (pen) penOrigins[id] = pen.points.map((pt) => ({ ...pt }));
    }
    dragRef.current = {
      kind: "move",
      id: node.id,
      ids,
      startX: event.clientX,
      startY: event.clientY,
      origins,
      penOrigins,
      moved: false,
    };
  }

  function onResizePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    node: BoardNode,
    handle: ResizeHandle = "se",
  ) {
    if (!canEdit || event.button !== 0) return;
    event.stopPropagation();
    setSelectedId(node.id);
    setHandlesVisible(true);
    dragRef.current = {
      kind: "resize",
      id: node.id,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      origX: node.x,
      origY: node.y,
      origW: node.w,
      origH: node.h,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  /** 切り取り枠ドラッグは window 監視（再描画で capture が切れても追従） */
  function beginCropAdjust(
    event: ReactPointerEvent<HTMLElement>,
    id: string,
    handle: ResizeHandle | "move",
    orig: BoardImageCrop,
  ) {
    if (!canEdit || event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    dragRef.current = {
      kind: "crop-adjust",
      id,
      handle,
      startX,
      startY,
      orig: { ...orig },
    };
    cropDraftRef.current = { ...orig };
    setCropDraft({ ...orig });

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const image = boardRef.current.items.find(
        (item): item is BoardImage => item.kind === "image" && item.id === id,
      );
      if (!image) return;
      const z = zoomRef.current;
      const dx = (ev.clientX - startX) / z / Math.max(1, image.w);
      const dy = (ev.clientY - startY) / z / Math.max(1, image.h);
      const min = 0.08;
      let { x, y, w, h } = orig;
      if (handle === "move") {
        x = Math.min(1 - orig.w, Math.max(0, orig.x + dx));
        y = Math.min(1 - orig.h, Math.max(0, orig.y + dy));
        w = orig.w;
        h = orig.h;
      } else {
        w = orig.w;
        h = orig.h;
        x = orig.x;
        y = orig.y;
        if (handle.includes("e")) w = orig.w + dx;
        if (handle.includes("s")) h = orig.h + dy;
        if (handle.includes("w")) {
          w = orig.w - dx;
          x = orig.x + dx;
        }
        if (handle.includes("n")) {
          h = orig.h - dy;
          y = orig.y + dy;
        }
        if (w < min) {
          if (handle.includes("w")) x = orig.x + orig.w - min;
          w = min;
        }
        if (h < min) {
          if (handle.includes("n")) y = orig.y + orig.h - min;
          h = min;
        }
        x = Math.min(1 - min, Math.max(0, x));
        y = Math.min(1 - min, Math.max(0, y));
        w = Math.min(1 - x, Math.max(min, w));
        h = Math.min(1 - y, Math.max(min, h));
      }
      const next = { x, y, w, h };
      cropDraftRef.current = next;
      setCropDraft(next);
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      const finalCrop = cropDraftRef.current ?? orig;
      dragRef.current = null;
      // 切り取り確定は枠を閉じるとき（途中の update が親 state と競合しないように）
      setCropDraft(finalCrop);
      cropDraftRef.current = finalCrop;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (pinchRef.current && pointersRef.current.size >= 2) {
      updatePinch();
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "pan") {
      applyView(zoom, {
        x: drag.panX + (event.clientX - drag.startX),
        y: drag.panY + (event.clientY - drag.startY),
      });
      return;
    }

    if (drag.kind === "marquee" || drag.kind === "draw-shape" || drag.kind === "draw-arrow") {
      const world = clientToWorld(event.clientX, event.clientY);
      drag.curX = world.x;
      drag.curY = world.y;
      setDragTick((n) => n + 1);
      return;
    }

    if (drag.kind === "crop-adjust") {
      const image = board.items.find((item): item is BoardImage => item.kind === "image" && item.id === drag.id);
      if (!image) return;
      const dx = (event.clientX - drag.startX) / zoom / Math.max(1, image.w);
      const dy = (event.clientY - drag.startY) / zoom / Math.max(1, image.h);
      const min = 0.08;
      let { x, y, w, h } = drag.orig;
      const handle = drag.handle;
      if (handle === "move") {
        x = drag.orig.x + dx;
        y = drag.orig.y + dy;
        x = Math.min(1 - w, Math.max(0, x));
        y = Math.min(1 - h, Math.max(0, y));
      } else {
        if (handle.includes("e")) w = drag.orig.w + dx;
        if (handle.includes("s")) h = drag.orig.h + dy;
        if (handle.includes("w")) {
          w = drag.orig.w - dx;
          x = drag.orig.x + dx;
        }
        if (handle.includes("n")) {
          h = drag.orig.h - dy;
          y = drag.orig.y + dy;
        }
        if (w < min) {
          if (handle.includes("w")) x = drag.orig.x + drag.orig.w - min;
          w = min;
        }
        if (h < min) {
          if (handle.includes("n")) y = drag.orig.y + drag.orig.h - min;
          h = min;
        }
        x = Math.min(1 - min, Math.max(0, x));
        y = Math.min(1 - min, Math.max(0, y));
        w = Math.min(1 - x, Math.max(min, w));
        h = Math.min(1 - y, Math.max(min, h));
      }
      const next = { x, y, w, h };
      cropDraftRef.current = next;
      setCropDraft(next);
      setDragTick((n) => n + 1);
      return;
    }

    if (drag.kind === "draw-pen") {
      const world = clientToWorld(event.clientX, event.clientY);
      const last = drag.points[drag.points.length - 1];
      if (!last || Math.hypot(world.x - last.x, world.y - last.y) >= 1.5 / zoom) {
        drag.points.push(world);
        setDragTick((n) => n + 1);
      }
      return;
    }

    const dx = (event.clientX - drag.startX) / zoom;
    const dy = (event.clientY - drag.startY) / zoom;
    if (drag.kind === "move") {
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        drag.moved = true;
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }
      const idSet = new Set(drag.ids);
      commit(
        board.items.map((item) => {
          if (item.kind === "pen" && idSet.has(item.id)) {
            const pts = drag.penOrigins[item.id];
            if (!pts) return item;
            return {
              ...item,
              points: pts.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })),
            };
          }
          if (!isNode(item) || !idSet.has(item.id)) return item;
          const origin = drag.origins[item.id];
          if (!origin) return item;
          return { ...item, x: origin.x + dx, y: origin.y + dy };
        }),
      );
      setDragTick((n) => n + 1);
      return;
    }
    if (drag.kind === "resize") {
      const next = resizeByHandle(drag.handle, drag.origX, drag.origY, drag.origW, drag.origH, dx, dy);
      commit(
        board.items.map((item) =>
          item.id === drag.id && isNode(item) ? { ...item, ...next } : item,
        ),
      );
      setDragTick((n) => n + 1);
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 1) {
      dragRef.current = null;
      return;
    }

    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;

    if (drag.kind === "marquee") {
      const rect = normalizeRect(drag.startX, drag.startY, drag.curX, drag.curY);
      if (rect.w < 4 && rect.h < 4) {
        setSelectedId(null);
        setDragTick((n) => n + 1);
        return;
      }
      const hits: string[] = [];
      for (const item of board.items) {
        const b = itemBounds(item);
        if (b && rectsIntersect(rect, b)) hits.push(item.id);
      }
      setSelectedIds(hits);
      setHandlesVisible(hits.length > 0);
      setDragTick((n) => n + 1);
      return;
    }

    if (drag.kind === "draw-shape") {
      const rect = normalizeRect(drag.startX, drag.startY, drag.curX, drag.curY);
      const tap = rect.w < 8 && rect.h < 8;
      const shape: BoardShape = {
        id: newBoardId("shape"),
        kind: "shape",
        shape: drag.shape,
        x: tap ? drag.startX - 40 : rect.x,
        y: tap ? drag.startY - 40 : rect.y,
        w: tap ? 80 : Math.max(16, rect.w),
        h: tap ? 80 : Math.max(16, rect.h),
        color: shapeColor,
        z: nextZ(board.items),
      };
      commit([...board.items, shape]);
      setSelectedIds([shape.id]);
      setHandlesVisible(true);
      selectTool("navigate");
      setDragTick((n) => n + 1);
      return;
    }

    if (drag.kind === "draw-pen") {
      if (drag.points.length >= 2) {
        if (penEraser) {
          const thresh = 14 / Math.max(0.4, zoom);
          commit(
            boardRef.current.items.filter((item) => {
              if (item.kind !== "pen") return true;
              return !strokesNear(item.points, drag.points, thresh);
            }),
          );
        } else {
          const stroke: BoardPen = {
            id: newBoardId("pen"),
            kind: "pen",
            points: drag.points,
            color: penColor,
            width: 3,
            z: nextZ(board.items),
          };
          // 描いた直後に選択しない（黄色フラッシュ防止）
          commit([...board.items, stroke]);
        }
      }
      setDragTick((n) => n + 1);
      return;
    }

    if (drag.kind === "draw-arrow") {
      const len = Math.hypot(drag.curX - drag.startX, drag.curY - drag.startY);
      if (len >= 12) {
        const arrow: BoardArrow = {
          id: newBoardId("arrow"),
          kind: "arrow",
          x1: drag.startX,
          y1: drag.startY,
          x2: drag.curX,
          y2: drag.curY,
          color: "#52525B",
          z: nextZ(board.items),
        };
        commit([...board.items, arrow]);
        selectTool("navigate");
      }
      setDragTick((n) => n + 1);
      return;
    }

    if (drag.kind === "crop-adjust") {
      // 確定は切り取りモード終了時。ここでは draft のみ
      const finalCrop = cropDraftRef.current ?? drag.orig;
      cropDraftRef.current = finalCrop;
      setCropDraft(finalCrop);
      setDragTick((n) => n + 1);
      return;
    }

    // ドラッグせずタップしたら紙を全画面で開く（矢印接続中は除く）
    if (drag.kind !== "move" || drag.moved) return;
    if (tool === "arrow") return;
    const node = nodeMap.get(drag.id);
    if (!node) return;

    // 長押しでハンドルを出したあとは、指を離しても編集可能のまま
    if (longPressFiredRef.current) {
      setSelectedIds([node.id]);
      setHandlesVisible(true);
      longPressFiredRef.current = false;
      return;
    }

    // モバイル向けダブルタップ検出（onDoubleClick が飛ばない端末対策）
    const now = Date.now();
    const prev = lastNodeTap.current;
    const isDouble =
      prev &&
      prev.id === node.id &&
      now - prev.t < 380 &&
      Math.hypot(event.clientX - prev.x, event.clientY - prev.y) < 28;
    lastNodeTap.current = { id: node.id, t: now, x: event.clientX, y: event.clientY };

    if (isDouble) {
      if (node.kind === "text") {
        setSelectedIds([node.id]);
        setHandlesVisible(false);
        setEditingTextId(node.id);
        resetScrollParents();
        return;
      }
      // その他パーツ：ダブルタップでサイズ編集ハンドル
      setSelectedIds([node.id]);
      setHandlesVisible(true);
      return;
    }

    if (node.kind === "sheet") {
      setOpenSheetId(node.id);
      return;
    }
    if (node.kind === "text") {
      // ワンタップはサイズ編集（ハンドル表示）。文字入力はダブルタップ
      setSelectedIds([node.id]);
      setHandlesVisible(true);
      setEditingTextId(null);
      return;
    }
    // 画像はワンタップで選択（切り取りバー表示）。ハンドルは長押し / ダブルタップ
    setSelectedIds([node.id]);
    setHandlesVisible(false);
  }

  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    // トラックパッドのピンチは ctrlKey 付き wheel として来る
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const midX = event.clientX - rect.left;
    const midY = event.clientY - rect.top;
    const factor = event.deltaY > 0 ? 0.92 : 1.08;
    const nextZoom = clampZoom(zoom * factor);
    const worldX = (midX - viewPan.x) / zoom;
    const worldY = (midY - viewPan.y) / zoom;
    applyView(nextZoom, {
      x: midX - worldX * nextZoom,
      y: midY - worldY * nextZoom,
    });
  }

  const selectedImage =
    selectedIds.length === 1 ? board.items.find((item): item is BoardImage => item.kind === "image" && item.id === selectedId) : null;
  const selectedTextBox =
    selectedIds.length === 1
      ? board.items.find((item): item is BoardTextBox => item.kind === "text" && item.id === selectedId)
      : null;
  // 写真選択中は切り取りバーを出す（ハンドル表示前でも）
  const showInsertBar = !insertToolbarHidden && !selectedImage;
  // リンク（矢印）はトップバー。プラス展開はカード/テキスト/図形/矢印のみ
  const insertFanOpen = plusMenuOpen || tool === "sheet" || tool === "text" || tool === "shape";

  // ソフトキーボード分の下余白（文字編集バーをキーボード直上に置く）
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setKeyboardInset(inset);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  function renderResizeHandles(node: BoardNode, selected: boolean) {
    if (!canEdit || !selected || !handlesVisible) return null;
    return RESIZE_HANDLES.map((handle) => (
      <button
        key={handle}
        type="button"
        data-board-ui
        aria-label={tx("サイズ変更", "Resize")}
        style={{ ...handleStyle(handle), cursor: handleCursor(handle) }}
        onPointerDown={(event) => onResizePointerDown(event, node, handle)}
      />
    ));
  }

  const shellClass = fullscreen
    ? "relative h-full min-h-0 w-full overflow-hidden overscroll-none bg-zinc-100"
    : "relative h-[min(70vh,560px)] overflow-hidden overscroll-none rounded-2xl border border-zinc-200 bg-zinc-100 shadow-sm";

  const crosshairTool = tool === "sheet" || tool === "text" || tool === "shape" || tool === "pen" || tool === "select";

  return (
    <div ref={shellRef} className={shellClass}>
      <div
        ref={rootRef}
        id="issue-workspace-canvas-surface"
        className={`absolute inset-0 touch-none overflow-hidden ${
          crosshairTool ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"
        }`}
        style={{
          backgroundColor: "#F4F4F5",
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(161,161,170,0.35) 1px, transparent 0)",
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${viewPan.x}px ${viewPan.y}px`,
        }}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div
          className="absolute left-0 top-0 origin-top-left will-change-transform"
          style={{ transform: `translate(${viewPan.x}px, ${viewPan.y}px) scale(${zoom})` }}
        >
          <svg
            className="pointer-events-none absolute left-0 top-0 overflow-visible"
            width={8000}
            height={6000}
            aria-hidden
          >
            <defs>
              <marker
                id="issue-board-arrowhead"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L6,3 L0,6 Z" fill="#52525B" />
              </marker>
            </defs>
            {arrows.map((arrow) => {
              let start: { x: number; y: number } | null = null;
              let end: { x: number; y: number } | null = null;
              if (isConnectorArrow(arrow)) {
                const from = nodeMap.get(arrow.fromId);
                const to = nodeMap.get(arrow.toId);
                if (!from || !to) return null;
                start = edgePoint(from, to);
                end = edgePoint(to, from);
              } else if (isFreeformArrow(arrow)) {
                start = { x: arrow.x1, y: arrow.y1 };
                end = { x: arrow.x2, y: arrow.y2 };
              } else {
                return null;
              }
              const selected = selectedIds.includes(arrow.id);
              return (
                <g key={arrow.id}>
                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke={arrow.color}
                    strokeWidth={selected ? 3.5 : 2.5}
                    markerEnd="url(#issue-board-arrowhead)"
                    opacity={selected ? 1 : 0.95}
                  />
                  {selected ? (
                    <line
                      x1={start.x}
                      y1={start.y}
                      x2={end.x}
                      y2={end.y}
                      stroke={SELECTION_YELLOW}
                      strokeWidth={6}
                      opacity={0.35}
                    />
                  ) : null}
                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke="transparent"
                    strokeWidth={16}
                    className="pointer-events-auto cursor-pointer"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      setSelectedId(arrow.id);
                    }}
                  />
                </g>
              );
            })}
            {pens.map((pen) => {
              const selected = selectedIds.includes(pen.id);
              return (
                <g key={pen.id}>
                  {selected ? (
                    <path
                      d={penToPath(pen.points)}
                      fill="none"
                      stroke={SELECTION_YELLOW}
                      strokeWidth={pen.width + 4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.45}
                    />
                  ) : null}
                <path
                  d={penToPath(pen.points)}
                  fill="none"
                  stroke={pen.color}
                  strokeWidth={pen.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={pen.opacity ?? 1}
                  className="pointer-events-auto"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    if (!canEdit) {
                      setSelectedId(pen.id);
                      return;
                    }
                    const ids =
                      selectedIds.includes(pen.id) && selectedIds.length > 1 ? selectedIds : [pen.id];
                    if (!(selectedIds.includes(pen.id) && selectedIds.length > 1)) setSelectedIds([pen.id]);
                    const origins: Record<string, { x: number; y: number }> = {};
                    const penOrigins: Record<string, Array<{ x: number; y: number }>> = {};
                    for (const id of ids) {
                      const n = nodeMap.get(id);
                      if (n) origins[id] = { x: n.x, y: n.y };
                      const p = board.items.find((item): item is BoardPen => item.kind === "pen" && item.id === id);
                      if (p) penOrigins[id] = p.points.map((pt) => ({ ...pt }));
                    }
                    dragRef.current = {
                      kind: "move",
                      id: pen.id,
                      ids,
                      startX: event.clientX,
                      startY: event.clientY,
                      origins,
                      penOrigins,
                      moved: false,
                    };
                    (event.currentTarget as SVGElement).setPointerCapture?.(event.pointerId);
                  }}
                />
                </g>
              );
            })}
            {drawPenPreview ? (
              <path
                d={penToPath(drawPenPreview.points)}
                fill="none"
                stroke={penEraser ? "#A1A1AA" : penColor}
                strokeWidth={penEraser ? 14 : 3}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={penEraser ? 0.45 : 1}
              />
            ) : null}
            {drawArrowPreview ? (
              <line
                x1={drawArrowPreview.startX}
                y1={drawArrowPreview.startY}
                x2={drawArrowPreview.curX}
                y2={drawArrowPreview.curY}
                stroke="#52525B"
                strokeWidth={2.5}
                strokeDasharray="6 4"
                markerEnd="url(#issue-board-arrowhead)"
              />
            ) : null}
            {drawShapePreview ? (
              (() => {
                const rect = normalizeRect(
                  drawShapePreview.startX,
                  drawShapePreview.startY,
                  drawShapePreview.curX,
                  drawShapePreview.curY,
                );
                return (
                  <g transform={`translate(${rect.x}, ${rect.y})`}>
                    <ShapeGeometry
                      shape={drawShapePreview.shape}
                      color={shapeColor}
                      w={Math.max(1, rect.w)}
                      h={Math.max(1, rect.h)}
                      dashed
                    />
                  </g>
                );
              })()
            ) : null}
            {marqueePreview ? (
              (() => {
                const rect = normalizeRect(
                  marqueePreview.startX,
                  marqueePreview.startY,
                  marqueePreview.curX,
                  marqueePreview.curY,
                );
                return (
                  <rect
                    x={rect.x}
                    y={rect.y}
                    width={rect.w}
                    height={rect.h}
                    fill="rgba(37,99,235,0.10)"
                    stroke="#2563EB"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                  />
                );
              })()
            ) : null}
          </svg>

          {sortedNodes.map((node) => {
            const selected = selectedIds.includes(node.id) || connectFromId === node.id;
            const selectionStyle = selected
              ? {
                  boxShadow: `0 0 0 3px ${SELECTION_YELLOW}, 0 0 0 6px ${SELECTION_YELLOW}40, 2px 3px 0 rgba(0,0,0,0.08)`,
                }
              : node.kind === "shape" || node.kind === "text"
                ? {}
                : { boxShadow: "2px 3px 0 rgba(0,0,0,0.08)" };
            const handles = renderResizeHandles(node, selected);

            if (node.kind === "sheet") {
              const colors = SHEET_COLORS[node.color];
              const style = {
                fontSize: node.fontSize ?? 14,
                color: node.textColor ?? "#1A1A1A",
                textAlign: (node.align ?? "center") as TextAlign,
              };
              const justify =
                node.valign === "top" ? "justify-start" : node.valign === "bottom" ? "justify-end" : "justify-center";
              return (
                <div
                  key={node.id}
                  data-board-node
                  className={`absolute flex flex-col select-none rounded-sm ${selected ? "overflow-visible" : "overflow-hidden"}`}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: node.w,
                    height: node.h,
                    zIndex: node.z,
                    backgroundColor: colors.bg,
                    border: `1px solid ${colors.border}`,
                    WebkitUserSelect: "none",
                    WebkitTouchCallout: "none",
                    ...selectionStyle,
                  }}
                  onContextMenu={(event) => event.preventDefault()}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    if (!canEdit) return;
                    setSelectedIds([node.id]);
                    setHandlesVisible(true);
                  }}
                  onPointerDown={(event) => onNodePointerDown(event, node)}
                >
                  <div
                    className={`relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm px-2.5 py-2 leading-relaxed whitespace-pre-wrap ${justify}`}
                    style={{
                      fontSize: style.fontSize,
                      color: style.color,
                      textAlign: style.textAlign,
                    }}
                  >
                    <span className="w-full shrink-0 select-none">
                      {(node.overlays?.some((o) => o.kind === "text" && o.text.trim())
                        ? ""
                        : node.text.trim()) || (
                        <span className="text-zinc-400" style={{ fontSize: 12 }}>
                          {tx("タップして開く", "Tap to open")}
                        </span>
                      )}
                    </span>
                    {(node.overlays?.length ?? 0) > 0 ? (
                      <div className="pointer-events-none absolute inset-0">
                        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                          {node.overlays!.map((ov) => {
                            if (ov.kind === "pen") {
                              return (
                                <path
                                  key={ov.id}
                                  d={penToPath(ov.points)}
                                  fill="none"
                                  stroke={ov.color}
                                  strokeWidth={ov.width}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  vectorEffect="non-scaling-stroke"
                                />
                              );
                            }
                            if (ov.kind === "shape") {
                              return (
                                <g key={ov.id} transform={`translate(${ov.x}, ${ov.y})`}>
                                  <ShapeGeometry
                                    shape={ov.shape}
                                    color={ov.color}
                                    fill={ov.fill}
                                    w={ov.w}
                                    h={ov.h}
                                    hairline
                                  />
                                </g>
                              );
                            }
                            return null;
                          })}
                        </svg>
                        {node.overlays!.map((ov) => {
                          if (ov.kind === "text") {
                            return (
                              <div
                                key={ov.id}
                                className="absolute overflow-hidden text-[8px] leading-tight"
                                style={{
                                  left: `${ov.x}%`,
                                  top: `${ov.y}%`,
                                  width: `${ov.w}%`,
                                  height: `${ov.h}%`,
                                  color: ov.textColor,
                                  textAlign: ov.align,
                                }}
                              >
                                {ov.text}
                              </div>
                            );
                          }
                          if (ov.kind === "image") {
                            return (
                              <div
                                key={ov.id}
                                className="absolute overflow-hidden"
                                style={{
                                  left: `${ov.x}%`,
                                  top: `${ov.y}%`,
                                  width: `${ov.w}%`,
                                  height: `${ov.h}%`,
                                }}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={ov.url} alt="" className="h-full w-full object-cover" draggable={false} />
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    ) : null}
                  </div>
                  {handles}
                </div>
              );
            }

            if (node.kind === "text") {
              const editing = editingTextId === node.id;
              // iOS は input/textarea が 16px 未満だと勝手にズームする
              const editFontPx = Math.max(16, node.fontSize);
              return (
                <div
                  key={node.id}
                  data-board-node
                  className={`absolute select-none ${selected || editing ? "overflow-visible" : "overflow-hidden"}`}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: node.w,
                    height: node.h,
                    zIndex: node.z,
                    border: selected || editing ? `1.5px solid ${SELECTION_YELLOW}` : "1px dashed rgba(0,0,0,0.2)",
                    background: editing ? "rgba(255,255,255,0.92)" : "transparent",
                    WebkitUserSelect: editing ? "text" : "none",
                    WebkitTouchCallout: "none",
                    ...selectionStyle,
                  }}
                  onContextMenu={(event) => event.preventDefault()}
                  onPointerDown={(event) => onNodePointerDown(event, node)}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    if (!canEdit) return;
                    setSelectedIds([node.id]);
                    setHandlesVisible(false);
                    setEditingTextId(node.id);
                    resetScrollParents();
                  }}
                >
                  {editing && canEdit ? (
                      <textarea
                        data-board-ui
                        autoFocus
                        value={node.text}
                        onChange={(e) => updateItem(node.id, { text: e.target.value })}
                        onFocus={() => {
                          resetScrollParents();
                          window.setTimeout(resetScrollParents, 80);
                        }}
                        onBlur={() => {
                          window.setTimeout(() => {
                            const active = document.activeElement as HTMLElement | null;
                            if (active?.closest("[data-board-ui]")) return;
                            setEditingTextId(null);
                            resetScrollParents();
                          }, 0);
                        }}
                        className="h-full w-full resize-none bg-transparent px-1 py-0.5 outline-none"
                        style={{
                          fontSize: editFontPx,
                          color: node.textColor,
                          textAlign: node.align,
                          // 実フォントが 16 未満でも見た目は合わせる
                          transform: node.fontSize < 16 ? `scale(${node.fontSize / 16})` : undefined,
                          transformOrigin: "top left",
                          width: node.fontSize < 16 ? `${(16 / node.fontSize) * 100}%` : undefined,
                          height: node.fontSize < 16 ? `${(16 / node.fontSize) * 100}%` : undefined,
                        }}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        data-form-type="other"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        enterKeyHint="done"
                        onPointerDown={(e) => e.stopPropagation()}
                      />
                  ) : (
                    <div
                      className="h-full w-full select-none whitespace-pre-wrap px-1 py-0.5"
                      style={{
                        fontSize: node.fontSize,
                        color: node.textColor,
                        textAlign: node.align,
                      }}
                    >
                      {node.text || (
                        <span className="text-zinc-400">{tx("テキスト", "Text")}</span>
                      )}
                    </div>
                  )}
                  {!editing ? handles : null}
                </div>
              );
            }

            if (node.kind === "shape") {
              return (
                <div
                  key={node.id}
                  data-board-node
                  className={`absolute select-none ${selected ? "overflow-visible" : "overflow-hidden"}`}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: node.w,
                    height: node.h,
                    zIndex: node.z,
                    WebkitUserSelect: "none",
                    WebkitTouchCallout: "none",
                    ...selectionStyle,
                  }}
                  onContextMenu={(event) => event.preventDefault()}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    if (!canEdit) return;
                    setSelectedIds([node.id]);
                    setHandlesVisible(true);
                  }}
                  onPointerDown={(event) => onNodePointerDown(event, node)}
                >
                  <svg width={node.w} height={node.h} className="overflow-visible">
                    <ShapeGeometry shape={node.shape} color={node.color} fill={node.fill} w={node.w} h={node.h} />
                  </svg>
                  {handles}
                </div>
              );
            }

            const image = node as BoardImage;
            const cropping = cropImageId === node.id;
            const crop =
              cropping && cropDraft
                ? cropDraft
                : (image.crop ?? { x: 0, y: 0, w: 1, h: 1 });
            return (
              <div
                key={node.id}
                data-board-node
                className={`absolute select-none rounded-sm bg-white ${
                  selected || cropping ? "overflow-visible" : "overflow-hidden"
                }`}
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.w,
                  height: node.h,
                  zIndex: node.z,
                  border: cropping ? "1.5px solid #2563EB" : "1px solid #D4D4D8",
                  WebkitUserSelect: "none",
                  WebkitTouchCallout: "none",
                  ...selectionStyle,
                }}
                onContextMenu={(event) => event.preventDefault()}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  if (!canEdit) return;
                  setSelectedIds([node.id]);
                  setHandlesVisible(true);
                }}
                onPointerDown={(event) => {
                  if (cropping) {
                    event.stopPropagation();
                    return;
                  }
                  onNodePointerDown(event, node);
                }}
              >
                <div className={`relative h-full w-full ${cropping ? "overflow-visible" : "overflow-hidden rounded-sm"}`}>
                  {cropping ? (
                    <>
                      {/* 画像だけクリップ。ハンドルは外に出して欠けないようにする */}
                      <div className="absolute inset-0 overflow-hidden rounded-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.url}
                          alt=""
                          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover opacity-35"
                          draggable={false}
                        />
                        <div
                          className="absolute overflow-hidden"
                          style={{
                            left: `${crop.x * 100}%`,
                            top: `${crop.y * 100}%`,
                            width: `${crop.w * 100}%`,
                            height: `${crop.h * 100}%`,
                            boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
                            outline: "1.5px dashed #2563EB",
                            outlineOffset: 0,
                          }}
                          onPointerDown={(event) => beginCropAdjust(event, node.id, "move", crop)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image.url}
                            alt=""
                            className="pointer-events-none absolute select-none object-cover"
                            draggable={false}
                            style={{
                              width: `${100 / Math.max(0.08, crop.w)}%`,
                              height: `${100 / Math.max(0.08, crop.h)}%`,
                              left: `${(-crop.x / Math.max(0.08, crop.w)) * 100}%`,
                              top: `${(-crop.y / Math.max(0.08, crop.h)) * 100}%`,
                              maxWidth: "none",
                            }}
                          />
                        </div>
                      </div>
                      {RESIZE_HANDLES.map((handle) => {
                        const left = handle.includes("w")
                          ? crop.x
                          : handle.includes("e")
                            ? crop.x + crop.w
                            : crop.x + crop.w / 2;
                        const top = handle.includes("n")
                          ? crop.y
                          : handle.includes("s")
                            ? crop.y + crop.h
                            : crop.y + crop.h / 2;
                        return (
                          <div
                            key={handle}
                            role="button"
                            tabIndex={0}
                            data-board-ui
                            aria-label={tx("切り取り枠", "Crop frame")}
                            className="absolute z-30 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border-2 border-[#2563EB] bg-white shadow-sm"
                            style={{ left: `${left * 100}%`, top: `${top * 100}%`, cursor: handleCursor(handle) }}
                            onPointerDown={(event) => beginCropAdjust(event, node.id, handle, crop)}
                          />
                        );
                      })}
                    </>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image.url}
                      alt=""
                      className="pointer-events-none absolute select-none"
                      draggable={false}
                      style={
                        image.crop
                          ? {
                              width: `${100 / image.crop.w}%`,
                              height: `${100 / image.crop.h}%`,
                              left: `${(-image.crop.x / image.crop.w) * 100}%`,
                              top: `${(-image.crop.y / image.crop.h) * 100}%`,
                              maxWidth: "none",
                            }
                          : { inset: 0, width: "100%", height: "100%", objectFit: "cover" }
                      }
                    />
                  )}
                </div>
                {!cropping ? handles : null}
              </div>
            );
          })}
        </div>
      </div>

      {toolbarMounted
        ? createPortal(
            <>
              {/* 戻るは画面左上に固定 */}
              {toolbarStart ? (
                <div
                  className={`pointer-events-none fixed left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[500] transition-opacity duration-200 ${
                    toolbarHidden ? "pointer-events-none opacity-0" : "opacity-100"
                  }`}
                >
                  <div className="pointer-events-auto" data-board-ui>
                    {toolbarStart}
                  </div>
                </div>
              ) : null}

              {/* ドキュメント同様：右上に Undo / Redo */}
              {canEdit ? (
                <div
                  className={`pointer-events-none fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[500] transition-opacity duration-200 ${
                    toolbarHidden ? "pointer-events-none opacity-0" : "opacity-100"
                  }`}
                >
                  <div
                    data-board-ui
                    className="pointer-events-auto flex items-center gap-0.5 rounded-full bg-white p-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
                  >
                    <button
                      type="button"
                      title={tx("元に戻す", "Undo")}
                      aria-label={tx("元に戻す", "Undo")}
                      disabled={!canUndo}
                      onClick={undoBoard}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-800 transition active:scale-95 disabled:opacity-35"
                    >
                      <Undo2 className="h-5 w-5" strokeWidth={2.25} />
                    </button>
                    <button
                      type="button"
                      title={tx("やり直し", "Redo")}
                      aria-label={tx("やり直し", "Redo")}
                      disabled={!canRedo}
                      onClick={redoBoard}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-800 transition active:scale-95 disabled:opacity-35"
                    >
                      <Redo2 className="h-5 w-5" strokeWidth={2.25} />
                    </button>
                  </div>
                </div>
              ) : null}

              {/* 文字編集中：キーボード直上の書式バー */}
              {editingTextId && selectedTextBox && canEdit && !toolbarHidden ? (
                <div
                  className="pointer-events-none fixed inset-x-0 z-[520] flex justify-center px-3"
                  style={{
                    bottom: `calc(${keyboardInset}px + max(0.35rem, env(safe-area-inset-bottom)))`,
                  }}
                >
                  <div
                    data-board-ui
                    className="pointer-events-auto flex max-w-[min(100%,28rem)] flex-wrap items-center justify-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-[0_8px_28px_rgba(0,0,0,0.16)]"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-0.5 rounded-full bg-zinc-100 p-0.5">
                      {FONT_SIZE_PRESETS.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => updateItem(selectedTextBox.id, { fontSize: size })}
                          className={`min-w-[2rem] rounded-full px-2 py-1.5 text-[12px] font-bold ${
                            selectedTextBox.fontSize === size ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {TEXT_COLOR_ORDER.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => updateItem(selectedTextBox.id, { textColor: color })}
                          className={`h-7 w-7 rounded-full border-2 ${
                            selectedTextBox.textColor.toLowerCase() === color.toLowerCase()
                              ? "scale-110 border-zinc-900"
                              : "border-zinc-200"
                          }`}
                          style={{ backgroundColor: color }}
                          aria-label={tx("文字色", "Text color")}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-0.5 rounded-full bg-zinc-100 p-0.5">
                      {(
                        [
                          ["left", AlignLeft, tx("左寄せ", "Left")],
                          ["center", AlignCenter, tx("中央", "Center")],
                          ["right", AlignRight, tx("右寄せ", "Right")],
                        ] as const
                      ).map(([value, Icon, label]) => (
                        <button
                          key={value}
                          type="button"
                          title={label}
                          onClick={() => updateItem(selectedTextBox.id, { align: value })}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
                            selectedTextBox.align === value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                          }`}
                          aria-label={label}
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* 下のフローティング操作バー */}
              <div
                className={`pointer-events-none fixed inset-x-0 bottom-0 z-[500] flex flex-col items-center gap-2 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] transition-transform duration-200 ease-out ${
                  toolbarHidden || editingTextId ? "translate-y-[120%]" : "translate-y-0"
                }`}
              >
                {/* ワンタップ選択中（未編集）の書式 */}
                {selectedTextBox && canEdit && !editingTextId && handlesVisible ? (
                  <div
                    data-board-ui
                    className="pointer-events-auto flex max-w-[min(100%,28rem)] flex-wrap items-center justify-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-[0_8px_28px_rgba(0,0,0,0.12)]"
                  >
                    <div className="flex items-center gap-0.5 rounded-full bg-zinc-100 p-0.5">
                      {FONT_SIZE_PRESETS.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => updateItem(selectedTextBox.id, { fontSize: size })}
                          className={`min-w-[2rem] rounded-full px-2 py-1.5 text-[12px] font-bold ${
                            selectedTextBox.fontSize === size ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {TEXT_COLOR_ORDER.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => updateItem(selectedTextBox.id, { textColor: color })}
                          className={`h-7 w-7 rounded-full border-2 ${
                            selectedTextBox.textColor.toLowerCase() === color.toLowerCase()
                              ? "scale-110 border-zinc-900"
                              : "border-zinc-200"
                          }`}
                          style={{ backgroundColor: color }}
                          aria-label={tx("文字色", "Text color")}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-0.5 rounded-full bg-zinc-100 p-0.5">
                      {(
                        [
                          ["left", AlignLeft, tx("左寄せ", "Left")],
                          ["center", AlignCenter, tx("中央", "Center")],
                          ["right", AlignRight, tx("右寄せ", "Right")],
                        ] as const
                      ).map(([value, Icon, label]) => (
                        <button
                          key={value}
                          type="button"
                          title={label}
                          onClick={() => updateItem(selectedTextBox.id, { align: value })}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
                            selectedTextBox.align === value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                          }`}
                          aria-label={label}
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {tool === "sheet" && canEdit ? (
                  <div
                    data-board-ui
                    className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white px-3 py-2 shadow-[0_8px_28px_rgba(0,0,0,0.12)]"
                  >
                    {SHEET_COLOR_ORDER.map((color) => (
                      <button
                        key={color}
                        type="button"
                        title={locale === "en" ? SHEET_COLORS[color].labelEn : SHEET_COLORS[color].labelJa}
                        onClick={() => pickSheetColor(color)}
                        className={`h-9 w-9 rounded-full border-2 shadow-sm transition active:scale-95 ${
                          sheetColor === color ? "scale-110 border-zinc-900" : "border-white"
                        }`}
                        style={{ backgroundColor: SHEET_COLORS[color].bg }}
                        aria-label={locale === "en" ? SHEET_COLORS[color].labelEn : SHEET_COLORS[color].labelJa}
                      />
                    ))}
                  </div>
                ) : null}

                {tool === "shape" && canEdit && shapePickerOpen ? (
                  <div
                    data-board-ui
                    className="pointer-events-auto flex flex-col items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-[0_8px_28px_rgba(0,0,0,0.12)]"
                  >
                    <div className="flex items-center gap-1">
                      {(
                        [
                          ["rect", Square, tx("四角", "Rect")],
                          ["circle", Circle, tx("円", "Circle")],
                          ["triangle", Triangle, tx("三角", "Triangle")],
                          ["line", Minus, tx("線", "Line")],
                        ] as const
                      ).map(([kind, Icon, label]) => (
                        <button
                          key={kind}
                          type="button"
                          title={label}
                          onClick={() => setShapeKind(kind)}
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${
                            shapeKind === kind ? "bg-zinc-100 text-zinc-950" : "text-zinc-600"
                          }`}
                          aria-label={label}
                        >
                          <Icon className="h-5 w-5" />
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {SHAPE_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setShapeColor(color)}
                          className={`h-7 w-7 rounded-full border-2 ${
                            shapeColor === color ? "scale-110 border-zinc-900" : "border-zinc-200"
                          }`}
                          style={{ backgroundColor: color }}
                          aria-label={tx("図形色", "Shape color")}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {tool === "pen" && canEdit ? (
                  <div
                    data-board-ui
                    className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white px-3 py-2 shadow-[0_8px_28px_rgba(0,0,0,0.12)]"
                  >
                    {SHAPE_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          setPenEraser(false);
                          setPenColor(color);
                        }}
                        className={`h-7 w-7 rounded-full border-2 ${
                          !penEraser && penColor === color ? "scale-110 border-zinc-900" : "border-zinc-200"
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={tx("ペン色", "Pen color")}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => setPenEraser(true)}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                        penEraser ? "scale-110 border-zinc-900 bg-zinc-100 text-zinc-900" : "border-zinc-200 text-zinc-600"
                      }`}
                      aria-label={tx("消しゴム", "Eraser")}
                      title={tx("消しゴム", "Eraser")}
                    >
                      <Eraser className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                  </div>
                ) : null}

                <div className="pointer-events-auto flex items-center gap-2">
                  {showInsertBar ? (
                    <div
                      data-board-ui
                      className="relative flex items-center gap-0.5 rounded-full bg-white p-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.14)]"
                    >
                      {insertFanOpen ? (
                        <div className="flex items-center gap-0.5 origin-right transition-all duration-200 ease-out">
                          <PillIconButton
                            active={tool === "sheet"}
                            label={tx("カード", "Card")}
                            icon={StickyNote}
                            disabled={!canEdit}
                            onClick={() => canEdit && selectTool(tool === "sheet" ? "navigate" : "sheet")}
                          />
                          <PillIconButton
                            active={tool === "text"}
                            label={tx("テキスト", "Text")}
                            icon={Type}
                            disabled={!canEdit}
                            onClick={() => canEdit && selectTool(tool === "text" ? "navigate" : "text")}
                          />
                          <button
                            type="button"
                            data-board-ui
                            title={tx("図形", "Shape")}
                            disabled={!canEdit}
                            onClick={() => {
                              if (!canEdit) return;
                              if (tool === "shape") {
                                selectTool("navigate");
                                setShapePickerOpen(false);
                              } else {
                                selectTool("shape");
                                setShapePickerOpen(true);
                              }
                            }}
                            className={`inline-flex h-12 w-12 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-40 ${
                              tool === "shape" ? "bg-zinc-100 text-zinc-950" : "text-zinc-800 hover:bg-zinc-50"
                            }`}
                            aria-label={tx("図形", "Shape")}
                          >
                            <ShapesGlyph className="h-6 w-6" />
                          </button>
                          <PillIconButton
                            active={tool === "arrow"}
                            label={tx("矢印", "Arrow")}
                            icon={ArrowUpRight}
                            disabled={!canEdit}
                            onClick={() => {
                              if (!canEdit) return;
                              setPlusMenuOpen(false);
                              selectTool(tool === "arrow" ? "navigate" : "arrow");
                            }}
                          />
                          <PillIconButton
                            active={false}
                            label={uploading ? tx("追加中", "Adding") : tx("写真", "Photo")}
                            icon={Paperclip}
                            disabled={!canEdit || Boolean(uploading)}
                            onClick={() => {
                              if (!canEdit) return;
                              setPlusMenuOpen(false);
                              selectTool("navigate");
                              onRequestPhoto();
                            }}
                          />
                        </div>
                      ) : (
                        <>
                          <PillIconButton
                            active={tool === "select"}
                            label={tx("選択", "Select")}
                            icon={MousePointer2}
                            disabled={!canEdit}
                            onClick={() => canEdit && selectTool(tool === "select" ? "navigate" : "select")}
                          />
                          <PillIconButton
                            active={tool === "pen"}
                            label={tx("手書き", "Pen")}
                            icon={PenLine}
                            disabled={!canEdit}
                            onClick={() => canEdit && selectTool(tool === "pen" ? "navigate" : "pen")}
                          />
                          <PillIconButton
                            active={tool === "arrow" && !plusMenuOpen}
                            label={tx("リンク", "Link")}
                            icon={Link2}
                            disabled={!canEdit}
                            onClick={() => {
                              if (!canEdit) return;
                              setPlusMenuOpen(false);
                              selectTool(tool === "arrow" ? "navigate" : "arrow");
                            }}
                          />
                          <PillIconButton
                            active={false}
                            label={tx("挿入", "Insert")}
                            icon={Plus}
                            disabled={!canEdit}
                            onClick={() => {
                              if (!canEdit) return;
                              selectTool("navigate");
                              setPlusMenuOpen(true);
                            }}
                          />
                        </>
                      )}
                    </div>
                  ) : selectedImage && canEdit ? (
                    <div
                      data-board-ui
                      className="flex items-center gap-0.5 rounded-full bg-white p-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.14)]"
                    >
                      <PillIconButton
                        active={Boolean(cropImageId)}
                        label={tx("切り取り", "Crop")}
                        icon={Crop}
                        onClick={() => {
                          const existing = selectedImage.crop ?? FULL_CROP;
                          updateItem(selectedImage.id, { crop: existing });
                          cropDraftRef.current = existing;
                          setCropDraft(existing);
                          setCropImageId(selectedImage.id);
                          setHandlesVisible(false);
                        }}
                      />
                    </div>
                  ) : null}

                  {selectedIds.length > 0 && canEdit ? (
                    <button
                      type="button"
                      data-board-ui
                      onClick={deleteSelected}
                      className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white text-rose-600 shadow-[0_8px_28px_rgba(0,0,0,0.14)] active:scale-95"
                      aria-label={tx("削除", "Delete")}
                    >
                      <Trash2 className="h-6 w-6" strokeWidth={2.25} />
                    </button>
                  ) : null}
                </div>

                {tool === "sheet" ? (
                  <p className="pointer-events-none rounded-full bg-zinc-900/80 px-3 py-1 text-[11px] font-medium text-white">
                    {tx("置きたい場所をタップ", "Tap to place")}
                  </p>
                ) : null}
              </div>
            </>,
            document.body,
          )
        : null}

      {toolbarMounted && openSheet
        ? createPortal(
            <SheetFullscreenEditor
              sheet={openSheet}
              canEdit={canEdit}
              uploading={uploading}
              tx={tx}
              onClose={closeOpenSheet}
              onPatch={patchOpenSheet}
              onDelete={() => {
                deleteItemById(openSheet.id);
              }}
            />,
            document.body,
          )
        : null}

    </div>
  );
}

type SheetEditTool = "text" | "shape" | "pen" | "photo";

function SheetFullscreenEditor({
  sheet,
  canEdit,
  uploading,
  tx,
  onClose,
  onPatch,
  onDelete,
}: {
  sheet: BoardSheet;
  canEdit: boolean;
  uploading?: boolean;
  tx: (ja: string, en: string) => string;
  onClose: () => void;
  onPatch: (patch: Partial<BoardSheet>) => void;
  onDelete: () => void;
}) {
  const colors = SHEET_COLORS[sheet.color];
  const stageRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const sheetRatio = useMemo(() => {
    const w = sheet.w > 0 ? sheet.w : DEFAULT_SHEET_W;
    const h = sheet.h > 0 ? sheet.h : DEFAULT_SHEET_H;
    return Math.min(2.4, Math.max(0.45, w / h));
  }, [sheet.w, sheet.h]);
  const [cardSize, setCardSize] = useState({ w: 0, h: 0 });
  const [editTool, setEditTool] = useState<SheetEditTool>("text");
  const [shapeKind, setShapeKind] = useState<BoardShapeKind>("rect");
  const [shapeColor, setShapeColor] = useState<string>(SHAPE_COLORS[0]!);
  const [penColor, setPenColor] = useState("#1A1A1A");
  const [penEraser, setPenEraser] = useState(false);
  const [selectedOverlayIds, setSelectedOverlayIds] = useState<string[]>([]);
  const selectedOverlayId = selectedOverlayIds[0] ?? null;
  const [editingOverlayId, setEditingOverlayId] = useState<string | null>(null);
  const [overlayHandlesVisible, setOverlayHandlesVisible] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setKeyboardInset(inset);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  const overlayDrag = useRef<
    | { kind: "shape"; startX: number; startY: number; curX: number; curY: number }
    | { kind: "pen"; points: Array<{ x: number; y: number }> }
    | {
        kind: "move-overlay";
        id: string;
        startX: number;
        startY: number;
        origX: number;
        origY: number;
        moved: boolean;
      }
    | {
        kind: "resize-overlay";
        id: string;
        handle: ResizeHandle;
        startX: number;
        startY: number;
        origX: number;
        origY: number;
        origW: number;
        origH: number;
      }
    | null
  >(null);
  const [overlayTick, setOverlayTick] = useState(0);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const overlays = sheet.overlays ?? [];
  const selectedOverlay = overlays.find((o) => o.id === selectedOverlayId) ?? null;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = () => {
      const maxW = Math.max(0, stage.clientWidth - 2);
      const maxH = Math.max(0, stage.clientHeight - 2);
      if (maxW < 2 || maxH < 2) return;
      let nextW = maxW;
      let nextH = nextW / sheetRatio;
      if (nextH > maxH) {
        nextH = maxH;
        nextW = nextH * sheetRatio;
      }
      const w = Math.floor(nextW);
      const h = Math.round(w / sheetRatio);
      setCardSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    window.addEventListener("orientationchange", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", update);
    };
  }, [sheetRatio]);

  function setOverlays(next: SheetOverlay[]) {
    onPatch({ overlays: next.length > 0 ? next : undefined });
  }

  function patchOverlay(id: string, patch: Partial<SheetOverlay>) {
    setOverlays(overlays.map((o) => (o.id === id ? ({ ...o, ...patch } as SheetOverlay) : o)));
  }

  function cardLocalPoint(clientX: number, clientY: number) {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect || cardSize.w <= 0) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  }

  function placeTextAt(xPct: number, yPct: number) {
    const id = newBoardId("ovt");
    const overlay: SheetOverlay = {
      id,
      kind: "text",
      x: Math.max(0, Math.min(70, xPct - 15)),
      y: Math.max(0, Math.min(80, yPct - 6)),
      w: 30,
      h: 14,
      text: "",
      fontSize: 18,
      textColor: "#1A1A1A",
      align: "left",
    };
    setOverlays([...overlays, overlay]);
    setSelectedOverlayIds([id]);
    setOverlayHandlesVisible(false);
    setEditingOverlayId(id);
    setEditTool("text");
  }

  function onCardPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!canEdit || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-overlay-node]") || target.closest("[data-overlay-handle]")) return;

    const pt = cardLocalPoint(event.clientX, event.clientY);

    if (editTool === "text") {
      const now = Date.now();
      const prev = lastTap.current;
      if (prev && now - prev.t < 420 && Math.hypot(pt.x - prev.x, pt.y - prev.y) < 8) {
        placeTextAt(pt.x, pt.y);
        lastTap.current = null;
        return;
      }
      lastTap.current = { t: now, x: pt.x, y: pt.y };
      return;
    }

    if (editTool === "shape") {
      overlayDrag.current = { kind: "shape", startX: pt.x, startY: pt.y, curX: pt.x, curY: pt.y };
      setOverlayTick((n) => n + 1);
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      return;
    }

    if (editTool === "pen") {
      overlayDrag.current = { kind: "pen", points: [pt] };
      setOverlayTick((n) => n + 1);
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      return;
    }

    setSelectedOverlayIds([]);
    setOverlayHandlesVisible(false);
    setEditingOverlayId(null);
  }

  function onCardPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = overlayDrag.current;
    if (!drag) return;
    const pt = cardLocalPoint(event.clientX, event.clientY);
    if (drag.kind === "shape") {
      drag.curX = pt.x;
      drag.curY = pt.y;
      setOverlayTick((n) => n + 1);
      return;
    }
    if (drag.kind === "move-overlay") {
      const dx = pt.x - drag.startX;
      const dy = pt.y - drag.startY;
      if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) drag.moved = true;
      const ov = overlays.find((o) => o.id === drag.id);
      if (!ov || ov.kind === "pen") return;
      patchOverlay(drag.id, {
        x: Math.max(0, Math.min(100 - ov.w, drag.origX + dx)),
        y: Math.max(0, Math.min(100 - ov.h, drag.origY + dy)),
      } as Partial<SheetOverlay>);
      setOverlayTick((n) => n + 1);
      return;
    }
    if (drag.kind === "resize-overlay") {
      const dx = pt.x - drag.startX;
      const dy = pt.y - drag.startY;
      const min = 4;
      let x = drag.origX;
      let y = drag.origY;
      let w = drag.origW;
      let h = drag.origH;
      const handle = drag.handle;
      if (handle.includes("e")) w = drag.origW + dx;
      if (handle.includes("s")) h = drag.origH + dy;
      if (handle.includes("w")) {
        w = drag.origW - dx;
        x = drag.origX + dx;
      }
      if (handle.includes("n")) {
        h = drag.origH - dy;
        y = drag.origY + dy;
      }
      if (w < min) {
        if (handle.includes("w")) x = drag.origX + drag.origW - min;
        w = min;
      }
      if (h < min) {
        if (handle.includes("n")) y = drag.origY + drag.origH - min;
        h = min;
      }
      x = Math.min(100 - min, Math.max(0, x));
      y = Math.min(100 - min, Math.max(0, y));
      w = Math.min(100 - x, Math.max(min, w));
      h = Math.min(100 - y, Math.max(min, h));
      patchOverlay(drag.id, { x, y, w, h } as Partial<SheetOverlay>);
      setOverlayTick((n) => n + 1);
      return;
    }
    if (drag.kind === "pen") {
      const last = drag.points[drag.points.length - 1];
      if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= 0.4) {
        drag.points.push(pt);
        setOverlayTick((n) => n + 1);
      }
    }
  }

  function onCardPointerUp() {
    const drag = overlayDrag.current;
    overlayDrag.current = null;
    if (!drag) {
      setOverlayTick((n) => n + 1);
      return;
    }
    if (drag.kind === "move-overlay" || drag.kind === "resize-overlay") {
      setOverlayTick((n) => n + 1);
      return;
    }
    if (drag.kind === "shape") {
      const x = Math.min(drag.startX, drag.curX);
      const y = Math.min(drag.startY, drag.curY);
      const w = Math.abs(drag.curX - drag.startX);
      const h = Math.abs(drag.curY - drag.startY);
      const tap = w < 2 && h < 2;
      const id = newBoardId("ovs");
      const overlay: SheetOverlay = {
        id,
        kind: "shape",
        shape: shapeKind,
        x: tap ? Math.max(0, drag.startX - 8) : x,
        y: tap ? Math.max(0, drag.startY - 8) : y,
        w: tap ? 16 : Math.max(4, w),
        h: tap ? 16 : Math.max(4, h),
        color: shapeColor,
      };
      setOverlays([...overlays, overlay]);
      setSelectedOverlayIds([id]);
      setOverlayHandlesVisible(true);
      setEditTool("text");
      setOverlayTick((n) => n + 1);
      return;
    }
    if (drag.kind === "pen" && drag.points.length >= 2) {
      if (penEraser) {
        setOverlays(
          overlays.filter((o) => {
            if (o.kind !== "pen") return true;
            return !strokesNear(o.points, drag.points, 3.2);
          }),
        );
      } else {
        const id = newBoardId("ovp");
        setOverlays([
          ...overlays,
          { id, kind: "pen", points: drag.points, color: penColor, width: 2.2 },
        ]);
      }
      // 描いた直後は選択しない（黄色フラッシュ防止）
    }
    setOverlayTick((n) => n + 1);
  }

  void overlayTick;
  const shapePreview = overlayDrag.current?.kind === "shape" ? overlayDrag.current : null;
  const penPreview = overlayDrag.current?.kind === "pen" ? overlayDrag.current : null;

  function renderOverlayTextToolbar(ov: Extract<SheetOverlay, { kind: "text" }>) {
    return (
      <div
        data-board-ui
        className="pointer-events-auto flex max-w-[min(92vw,22rem)] flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-white/95 px-2.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.16)] backdrop-blur-sm"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-0.5 rounded-full bg-zinc-100 p-0.5">
          {FONT_SIZE_PRESETS.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => patchOverlay(ov.id, { fontSize: size })}
              className={`min-w-[1.75rem] rounded-full px-1.5 py-1 text-[11px] font-bold ${
                ov.fontSize === size ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {TEXT_COLOR_ORDER.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => patchOverlay(ov.id, { textColor: color })}
              className={`h-6 w-6 rounded-full border-2 ${
                ov.textColor.toLowerCase() === color.toLowerCase() ? "scale-110 border-zinc-900" : "border-zinc-200"
              }`}
              style={{ backgroundColor: color }}
              aria-label={tx("文字色", "Text color")}
            />
          ))}
        </div>
        <div className="flex items-center gap-0.5 rounded-full bg-zinc-100 p-0.5">
          {(
            [
              ["left", AlignLeft, tx("左寄せ", "Left")],
              ["center", AlignCenter, tx("中央", "Center")],
              ["right", AlignRight, tx("右寄せ", "Right")],
            ] as const
          ).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              title={label}
              onClick={() => patchOverlay(ov.id, { align: value })}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
                ov.align === value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
              }`}
              aria-label={label}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderOverlayResizeHandles(ov: Extract<SheetOverlay, { kind: "text" | "image" | "shape" }>) {
    if (!canEdit || !overlayHandlesVisible || selectedOverlayIds.length !== 1 || selectedOverlayId !== ov.id) {
      return null;
    }
    return RESIZE_HANDLES.map((handle) => (
      <button
        key={handle}
        type="button"
        data-overlay-handle
        data-board-ui
        aria-label={tx("サイズ変更", "Resize")}
        style={{ ...handleStyle(handle), cursor: handleCursor(handle) }}
        onPointerDown={(event) => {
          if (!canEdit || event.button !== 0) return;
          event.stopPropagation();
          const pt = cardLocalPoint(event.clientX, event.clientY);
          overlayDrag.current = {
            kind: "resize-overlay",
            id: ov.id,
            handle,
            startX: pt.x,
            startY: pt.y,
            origX: ov.x,
            origY: ov.y,
            origW: ov.w,
            origH: ov.h,
          };
          (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        }}
      />
    ));
  }

  return (
    <div
      data-board-ui
      className="fixed inset-0 z-[600] flex flex-col bg-zinc-200"
      role="dialog"
      aria-modal="true"
      aria-label={tx("用紙を編集", "Edit sheet")}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage: "radial-gradient(circle, #a1a1aa 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      />

      <div className="relative z-10 flex shrink-0 items-center justify-between gap-2 px-3 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 items-center gap-0.5 rounded-full bg-white px-3 text-sm font-semibold text-zinc-900 shadow-[0_8px_24px_rgba(0,0,0,0.12)] active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
          {tx("完了", "Done")}
        </button>
        {canEdit ? (
          <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
            {(
              [
                { id: "text" as const, label: tx("文字", "Text") },
                { id: "shape" as const, label: tx("図形", "Shape") },
                { id: "photo" as const, label: tx("写真", "Photo") },
                { id: "pen" as const, label: tx("手書き", "Pen") },
              ]
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={label}
                disabled={id === "photo" && Boolean(uploading)}
                onClick={() => {
                  if (id === "photo") {
                    photoInputRef.current?.click();
                    return;
                  }
                  setEditTool(id);
                  setPenEraser(false);
                  setSelectedOverlayIds([]);
                  setOverlayHandlesVisible(false);
                  setEditingOverlayId(null);
                }}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-40 ${
                  editTool === id ? "bg-zinc-100 text-zinc-950" : "text-zinc-600"
                }`}
              >
                {id === "text" ? <Type className="h-4 w-4" strokeWidth={2.25} /> : null}
                {id === "shape" ? <ShapesGlyph className="h-4 w-4" /> : null}
                {id === "photo" ? <Paperclip className="h-4 w-4" strokeWidth={2.25} /> : null}
                {id === "pen" ? <PenLine className="h-4 w-4" strokeWidth={2.25} /> : null}
              </button>
            ))}
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-rose-600 active:scale-95"
              aria-label={tx("削除", "Delete")}
            >
              <Trash2 className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>
        ) : (
          <span className="w-11" />
        )}
      </div>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file || !canEdit) return;
          const reader = new FileReader();
          reader.onload = () => {
            const url = typeof reader.result === "string" ? reader.result : "";
            if (!url) return;
            void measureImageDisplaySize(url).then((size) => {
              const id = newBoardId("ovi");
              // カード % 座標に元比率を載せる（幅基準）
              const wPct = 42;
              const hPct = Math.min(70, Math.max(12, (wPct * size.h) / Math.max(1, size.w)));
              setOverlays([
                ...overlays,
                {
                  id,
                  kind: "image",
                  x: Math.max(0, (100 - wPct) / 2),
                  y: Math.max(0, (100 - hPct) / 2),
                  w: wPct,
                  h: hPct,
                  url,
                },
              ]);
              setSelectedOverlayIds([id]);
              setOverlayHandlesVisible(true);
              setEditTool("text");
            });
          };
          reader.readAsDataURL(file);
        }}
      />

      {canEdit && editTool === "shape" ? (
        <div className="relative z-10 flex justify-center px-3 pb-1">
          <div className="flex items-center gap-1 rounded-full bg-white px-2 py-1 shadow-sm">
            {(
              [
                ["rect", Square],
                ["circle", Circle],
                ["triangle", Triangle],
                ["line", Minus],
              ] as const
            ).map(([kind, Icon]) => (
              <button
                key={kind}
                type="button"
                onClick={() => setShapeKind(kind)}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
                  shapeKind === kind ? "bg-zinc-100" : ""
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
            {SHAPE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setShapeColor(color)}
                className={`h-5 w-5 rounded-full border ${shapeColor === color ? "border-zinc-900" : "border-zinc-200"}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {canEdit && editTool === "pen" ? (
        <div className="relative z-10 flex justify-center gap-1.5 px-3 pb-1">
          {SHAPE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => {
                setPenEraser(false);
                setPenColor(color);
              }}
              className={`h-6 w-6 rounded-full border-2 ${
                !penEraser && penColor === color ? "border-zinc-900" : "border-zinc-200"
              }`}
              style={{ backgroundColor: color }}
              aria-label={tx("ペン色", "Pen color")}
            />
          ))}
          <button
            type="button"
            onClick={() => setPenEraser(true)}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full border-2 ${
              penEraser ? "border-zinc-900 bg-zinc-100 text-zinc-900" : "border-zinc-200 text-zinc-600"
            }`}
            aria-label={tx("消しゴム", "Eraser")}
            title={tx("消しゴム", "Eraser")}
          >
            <Eraser className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        </div>
      ) : null}

      {canEdit && editTool === "text" ? (
        <p className="relative z-10 px-3 pb-1 text-center text-[11px] font-medium text-zinc-500">
          {tx("カード内をダブルタップして文字を置く", "Double-tap on the card to place text")}
        </p>
      ) : null}

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 min-w-0 flex-1 px-3 py-2">
          <div ref={stageRef} className="flex h-full w-full min-h-0 min-w-0 items-center justify-center">
            <div
              ref={cardRef}
              data-sheet-card
              className="relative touch-none select-none overflow-visible rounded-2xl"
              style={{
                width: cardSize.w > 0 ? cardSize.w : undefined,
                height: cardSize.h > 0 ? cardSize.h : undefined,
                visibility: cardSize.w > 0 ? "visible" : "hidden",
                boxSizing: "border-box",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
                userSelect: "none",
              }}
              onPointerDown={onCardPointerDown}
              onPointerMove={onCardPointerMove}
              onPointerUp={onCardPointerUp}
              onPointerCancel={onCardPointerUp}
              onContextMenu={(e) => e.preventDefault()}
            >
              {/* 角丸は内側クリップで常に効かせる（編集中 overflow-visible でも角が消えない） */}
              <div
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
                style={{
                  backgroundColor: colors.bg,
                  border: `1px solid ${colors.border}`,
                  boxShadow: "2px 3px 0 rgba(0,0,0,0.08), 0 18px 40px rgba(0,0,0,0.14)",
                }}
                aria-hidden
              />
              <div className="pointer-events-none absolute inset-0 overflow-visible rounded-2xl">
                <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {overlays.map((ov) => {
                    if (ov.kind === "pen") {
                      const selected = selectedOverlayIds.includes(ov.id);
                      return (
                        <g key={ov.id}>
                          {selected ? (
                            <path
                              d={penToPath(ov.points)}
                              fill="none"
                              stroke={SELECTION_YELLOW}
                              strokeWidth={ov.width + 1.5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              vectorEffect="non-scaling-stroke"
                              opacity={0.4}
                              strokeDasharray="2.5 2"
                            />
                          ) : null}
                          <path
                            d={penToPath(ov.points)}
                            fill="none"
                            stroke={ov.color}
                            strokeWidth={ov.width}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                            className="pointer-events-auto"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              setSelectedOverlayIds([ov.id]);
                              setOverlayHandlesVisible(false);
                              setEditingOverlayId(null);
                            }}
                          />
                        </g>
                      );
                    }
                    if (ov.kind === "shape") {
                      const selected = selectedOverlayIds.includes(ov.id);
                      return (
                        <g
                          key={ov.id}
                          transform={`translate(${ov.x}, ${ov.y})`}
                          className="pointer-events-auto"
                          data-overlay-node
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            const pt = cardLocalPoint(e.clientX, e.clientY);
                            setSelectedOverlayIds([ov.id]);
                            setOverlayHandlesVisible(true);
                            setEditingOverlayId(null);
                            overlayDrag.current = {
                              kind: "move-overlay",
                              id: ov.id,
                              startX: pt.x,
                              startY: pt.y,
                              origX: ov.x,
                              origY: ov.y,
                              moved: false,
                            };
                            (e.currentTarget as SVGElement).setPointerCapture?.(e.pointerId);
                          }}
                        >
                          {selected ? (
                            <ShapeGeometry
                              shape={ov.shape}
                              color={SELECTION_YELLOW}
                              w={ov.w}
                              h={ov.h}
                              dashed
                              hairline
                            />
                          ) : null}
                          <ShapeGeometry
                            shape={ov.shape}
                            color={ov.color}
                            fill={ov.fill}
                            w={ov.w}
                            h={ov.h}
                            hairline
                          />
                        </g>
                      );
                    }
                    return null;
                  })}
                  {shapePreview ? (
                    <g
                      transform={`translate(${Math.min(shapePreview.startX, shapePreview.curX)}, ${Math.min(shapePreview.startY, shapePreview.curY)})`}
                    >
                      <ShapeGeometry
                        shape={shapeKind}
                        color={shapeColor}
                        w={Math.max(0.5, Math.abs(shapePreview.curX - shapePreview.startX))}
                        h={Math.max(0.5, Math.abs(shapePreview.curY - shapePreview.startY))}
                        dashed
                        hairline
                      />
                    </g>
                  ) : null}
                  {penPreview ? (
                    <path
                      d={penToPath(penPreview.points)}
                      fill="none"
                      stroke={penEraser ? "#F4F4F5" : penColor}
                      strokeWidth={penEraser ? 4 : 2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      opacity={penEraser ? 0.55 : 1}
                    />
                  ) : null}
                </svg>

                {overlays.map((ov) => {
                  if (ov.kind === "shape") {
                    const selected = selectedOverlayIds.includes(ov.id);
                    if (!selected) return null;
                    return (
                      <div
                        key={`shape-handles-${ov.id}`}
                        className="pointer-events-none absolute"
                        style={{ left: `${ov.x}%`, top: `${ov.y}%`, width: `${ov.w}%`, height: `${ov.h}%` }}
                      >
                        <div className="pointer-events-auto absolute inset-0 overflow-visible">
                          {renderOverlayResizeHandles(ov)}
                        </div>
                      </div>
                    );
                  }
                  if (ov.kind !== "text" && ov.kind !== "image") return null;
                  const selected = selectedOverlayIds.includes(ov.id);
                  if (ov.kind === "image") {
                    return (
                      <div
                        key={ov.id}
                        data-overlay-node
                        className={`pointer-events-auto absolute ${selected ? "overflow-visible" : "overflow-hidden"}`}
                        style={{
                          left: `${ov.x}%`,
                          top: `${ov.y}%`,
                          width: `${ov.w}%`,
                          height: `${ov.h}%`,
                          outline: selected ? `1px dashed ${SELECTION_YELLOW}` : undefined,
                          outlineOffset: 1,
                          borderRadius: 4,
                        }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const pt = cardLocalPoint(e.clientX, e.clientY);
                          setSelectedOverlayIds([ov.id]);
                          setOverlayHandlesVisible(true);
                          setEditingOverlayId(null);
                          overlayDrag.current = {
                            kind: "move-overlay",
                            id: ov.id,
                            startX: pt.x,
                            startY: pt.y,
                            origX: ov.x,
                            origY: ov.y,
                            moved: false,
                          };
                          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                        }}
                      >
                        <div className="h-full w-full overflow-hidden rounded">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ov.url} alt="" className="h-full w-full object-cover" draggable={false} />
                        </div>
                        {renderOverlayResizeHandles(ov)}
                      </div>
                    );
                  }
                  const editing = editingOverlayId === ov.id;
                  const editFontPx = Math.max(16, ov.fontSize * 0.55);
                  return (
                    <div key={ov.id} className="pointer-events-none absolute inset-0 overflow-visible">
                      <div
                        data-overlay-node
                        className={`pointer-events-auto absolute ${selected || editing ? "overflow-visible" : "overflow-hidden"}`}
                        style={{
                          left: `${ov.x}%`,
                          top: `${ov.y}%`,
                          width: `${ov.w}%`,
                          height: `${ov.h}%`,
                          border: selected || editing
                            ? `1px dashed ${SELECTION_YELLOW}`
                            : "1px dashed rgba(0,0,0,0.18)",
                          background: editing ? "rgba(255,255,255,0.85)" : "transparent",
                          borderRadius: 4,
                        }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const pt = cardLocalPoint(e.clientX, e.clientY);
                          setSelectedOverlayIds([ov.id]);
                          setOverlayHandlesVisible(true);
                          if (!editing) setEditingOverlayId(null);
                          overlayDrag.current = {
                            kind: "move-overlay",
                            id: ov.id,
                            startX: pt.x,
                            startY: pt.y,
                            origX: ov.x,
                            origY: ov.y,
                            moved: false,
                          };
                          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setSelectedOverlayIds([ov.id]);
                          setOverlayHandlesVisible(false);
                          setEditingOverlayId(ov.id);
                        }}
                      >
                        {editing && canEdit ? (
                          <textarea
                            autoFocus
                            value={ov.text}
                            onChange={(e) => patchOverlay(ov.id, { text: e.target.value })}
                            onBlur={() => {
                              window.setTimeout(() => {
                                const active = document.activeElement as HTMLElement | null;
                                if (active?.closest("[data-board-ui]")) return;
                                setEditingOverlayId(null);
                              }, 0);
                            }}
                            className="h-full w-full resize-none bg-transparent px-1 outline-none"
                            style={{
                              color: ov.textColor,
                              textAlign: ov.align,
                              fontSize: editFontPx,
                              transform:
                                ov.fontSize * 0.55 < 16 ? `scale(${(ov.fontSize * 0.55) / 16})` : undefined,
                              transformOrigin: "top left",
                              width: ov.fontSize * 0.55 < 16 ? `${(16 / (ov.fontSize * 0.55)) * 100}%` : undefined,
                              height: ov.fontSize * 0.55 < 16 ? `${(16 / (ov.fontSize * 0.55)) * 100}%` : undefined,
                            }}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            data-form-type="other"
                            data-lpignore="true"
                            data-1p-ignore="true"
                            onPointerDown={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div
                            className="h-full w-full overflow-hidden whitespace-pre-wrap px-1"
                            style={{ color: ov.textColor, textAlign: ov.align, fontSize: ov.fontSize * 0.55 }}
                          >
                            {ov.text || tx("テキスト", "Text")}
                          </div>
                        )}
                        {!editing ? renderOverlayResizeHandles(ov) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* カード内テキスト編集：キーボード直上の書式バー */}
      {canEdit &&
      editingOverlayId &&
      selectedOverlay &&
      selectedOverlay.kind === "text" ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-40 flex justify-center px-3"
          style={{
            bottom: `calc(${keyboardInset}px + max(0.35rem, env(safe-area-inset-bottom)))`,
          }}
        >
          {renderOverlayTextToolbar(selectedOverlay)}
        </div>
      ) : null}
    </div>
  );
}

function PillIconButton({
  active,
  label,
  onClick,
  icon: Icon,
  disabled,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon: LucideIcon;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      data-board-ui
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-12 w-12 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-40 ${
        active ? "bg-zinc-100 text-zinc-950" : "text-zinc-800 hover:bg-zinc-50"
      }`}
      aria-label={label}
    >
      <Icon className="h-6 w-6" aria-hidden strokeWidth={2.25} />
    </button>
  );
}

/** 写真アップロード後にキャンバスへ載せるヘルパー（元画像の縦横比を維持） */
export async function appendImageToBoard(
  board: IssueWorkspaceBoard,
  url: string,
  at?: { x: number; y: number },
): Promise<IssueWorkspaceBoard> {
  const size = await measureImageDisplaySize(url);
  const image: BoardImage = {
    id: newBoardId("img"),
    kind: "image",
    x: at?.x ?? 120 + (board.items.length % 4) * 24,
    y: at?.y ?? 120 + (board.items.length % 4) * 24,
    w: size.w,
    h: size.h,
    url,
    z: nextZ(board.items),
  };
  return { v: 1, items: [...board.items, image] };
}
