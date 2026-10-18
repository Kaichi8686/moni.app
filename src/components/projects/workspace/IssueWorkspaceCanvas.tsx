"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
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
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowUpRight,
  ChevronLeft,
  Paperclip,
  StickyNote,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  defaultSheetTextStyle,
  edgePoint,
  FONT_SIZE_PRESETS,
  newBoardId,
  nextZ,
  SHEET_COLOR_ORDER,
  SHEET_COLORS,
  TEXT_COLOR_ORDER,
  type BoardArrow,
  type BoardImage,
  type BoardItem,
  type BoardNode,
  type BoardSheet,
  type IssueWorkspaceBoard,
  type SheetColor,
  type TextAlign,
  type TextVAlign,
} from "@/lib/workspace/issueWorkspaceBoard";

/** navigate = 通常操作（紙を触る=選択/移動、空き地=パン） */
type Tool = "navigate" | "sheet" | "arrow";

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
/** 画面内に必ず残すコンテンツの最低ピクセル */
const KEEP_VISIBLE_PX = 96;
const EMPTY_WORLD = { minX: 40, minY: 40, maxX: 520, maxY: 420 };
/** ロイロノート / スライド風の選択枠 */
const SELECTION_YELLOW = "#FACC15";

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

type DragState =
  | { kind: "pan"; startX: number; startY: number; panX: number; panY: number }
  | {
      kind: "move";
      id: string;
      startX: number;
      startY: number;
      origX: number;
      origY: number;
      moved: boolean;
    }
  | {
      kind: "resize";
      id: string;
      startX: number;
      startY: number;
      origW: number;
      origH: number;
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
  return item.kind === "sheet" || item.kind === "image";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  /** ロイロノート風：紙をタップで全画面編集 */
  const [openSheetId, setOpenSheetId] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 24, y: 24 });
  const [zoom, setZoom] = useState(1);
  const [viewport, setViewport] = useState({ w: 1, h: 1 });
  const dragRef = useRef<DragState | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<PinchState | null>(null);
  const [dragTick, setDragTick] = useState(0);
  const toolbarMounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  const toolbarHidden = openSheetId !== null;

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
  }

  function commit(items: BoardItem[]) {
    onChange({ v: 1, items });
  }

  function updateItem(id: string, patch: Partial<BoardItem>) {
    commit(board.items.map((item) => (item.id === id ? ({ ...item, ...patch } as BoardItem) : item)));
  }

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

  function viewportCenterWorld() {
    return {
      x: (viewport.w / 2 - viewPan.x) / zoom,
      y: (viewport.h / 2 - viewPan.y) / zoom,
    };
  }

  function addSheetWithColor(color: SheetColor) {
    if (!canEdit) return;
    const center = viewportCenterWorld();
    const sheet: BoardSheet = {
      id: newBoardId("sheet"),
      kind: "sheet",
      x: center.x - DEFAULT_SHEET_W / 2,
      y: center.y - DEFAULT_SHEET_H / 2,
      w: DEFAULT_SHEET_W,
      h: DEFAULT_SHEET_H,
      color,
      text: "",
      z: nextZ(board.items),
      ...defaultSheetTextStyle(),
    };
    setSheetColor(color);
    commit([...board.items, sheet]);
    setSelectedId(sheet.id);
    setOpenSheetId(sheet.id);
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

  function deleteItemById(id: string) {
    if (!canEdit) return;
    commit(
      board.items.filter((item) => {
        if (item.id === id) return false;
        if (item.kind === "arrow" && (item.fromId === id || item.toId === id)) return false;
        return true;
      }),
    );
    if (selectedId === id) setSelectedId(null);
    if (openSheetId === id) setOpenSheetId(null);
  }

  function deleteSelected() {
    if (!selectedId) return;
    deleteItemById(selectedId);
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

    // 用紙ツール中は色選択待ち。空き地タップで色パネルを閉じる
    if (tool === "sheet") {
      selectTool("navigate");
      setSelectedId(null);
      dragRef.current = {
        kind: "pan",
        startX: event.clientX,
        startY: event.clientY,
        panX: viewPan.x,
        panY: viewPan.y,
      };
      return;
    }

    setSelectedId(null);
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

    if (tool === "arrow") {
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

    if (tool === "sheet") selectTool("navigate");

    setSelectedId(node.id);
    bringToFront(node.id);
    dragRef.current = {
      kind: "move",
      id: node.id,
      startX: event.clientX,
      startY: event.clientY,
      origX: node.x,
      origY: node.y,
      moved: false,
    };
  }

  function onResizePointerDown(event: ReactPointerEvent<HTMLButtonElement>, node: BoardNode) {
    if (!canEdit || event.button !== 0) return;
    event.stopPropagation();
    setSelectedId(node.id);
    dragRef.current = {
      kind: "resize",
      id: node.id,
      startX: event.clientX,
      startY: event.clientY,
      origW: node.w,
      origH: node.h,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
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
    const dx = (event.clientX - drag.startX) / zoom;
    const dy = (event.clientY - drag.startY) / zoom;
    if (drag.kind === "move") {
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) drag.moved = true;
      commit(
        board.items.map((item) =>
          item.id === drag.id && isNode(item) ? { ...item, x: drag.origX + dx, y: drag.origY + dy } : item,
        ),
      );
      setDragTick((n) => n + 1);
      return;
    }
    if (drag.kind === "resize") {
      commit(
        board.items.map((item) =>
          item.id === drag.id && isNode(item)
            ? {
                ...item,
                w: Math.max(100, drag.origW + dx),
                h: Math.max(80, drag.origH + dy),
              }
            : item,
        ),
      );
      setDragTick((n) => n + 1);
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 1) {
      // ピンチ解除後は残った指でパンし直さない
      dragRef.current = null;
      return;
    }

    const drag = dragRef.current;
    dragRef.current = null;
    // ドラッグせずタップしたら紙を全画面で開く（矢印接続中は除く）
    if (!drag || drag.kind !== "move" || drag.moved) return;
    if (tool === "arrow") return;
    const node = nodeMap.get(drag.id);
    if (!node || node.kind !== "sheet") return;
    setOpenSheetId(node.id);
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

  void dragTick;

  const shellClass = fullscreen
    ? "relative h-full min-h-0 w-full overflow-hidden overscroll-none bg-zinc-100"
    : "relative h-[min(70vh,560px)] overflow-hidden overscroll-none rounded-2xl border border-zinc-200 bg-zinc-100 shadow-sm";

  return (
    <div ref={shellRef} className={shellClass}>
      <div
        ref={rootRef}
        id="issue-workspace-canvas-surface"
        className={`absolute inset-0 touch-none overflow-hidden ${
          tool === "sheet" ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"
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
              const from = nodeMap.get(arrow.fromId);
              const to = nodeMap.get(arrow.toId);
              if (!from || !to) return null;
              const start = edgePoint(from, to);
              const end = edgePoint(to, from);
              const selected = selectedId === arrow.id;
              return (
                <g key={arrow.id}>
                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke={selected ? SELECTION_YELLOW : arrow.color}
                    strokeWidth={selected ? 3.5 : 2.5}
                    markerEnd="url(#issue-board-arrowhead)"
                  />
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
          </svg>

          {sortedNodes.map((node) => {
            const selected = selectedId === node.id || connectFromId === node.id;
            const selectionStyle = selected
              ? {
                  outline: `3px solid ${SELECTION_YELLOW}`,
                  outlineOffset: 2,
                  boxShadow: `0 0 0 5px ${SELECTION_YELLOW}55, 2px 3px 0 rgba(0,0,0,0.08)`,
                }
              : { boxShadow: "2px 3px 0 rgba(0,0,0,0.08)" };
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
                  className="absolute flex flex-col overflow-hidden rounded-sm"
                  style={{
                    left: node.x,
                    top: node.y,
                    width: node.w,
                    height: node.h,
                    zIndex: node.z,
                    backgroundColor: colors.bg,
                    border: `1px solid ${colors.border}`,
                    ...selectionStyle,
                  }}
                  onPointerDown={(event) => onNodePointerDown(event, node)}
                >
                  <div className="h-2 shrink-0 opacity-40" style={{ background: colors.border }} />
                  <div
                    className={`flex min-h-0 flex-1 flex-col overflow-hidden px-2.5 py-2 leading-relaxed whitespace-pre-wrap ${justify}`}
                    style={{
                      fontSize: style.fontSize,
                      color: style.color,
                      textAlign: style.textAlign,
                    }}
                  >
                    <span className="w-full shrink-0">
                      {node.text.trim() || (
                        <span className="text-zinc-400" style={{ fontSize: 12 }}>
                          {tx("タップして開く", "Tap to open")}
                        </span>
                      )}
                    </span>
                  </div>
                  {selected && canEdit ? (
                    <button
                      type="button"
                      data-board-ui
                      aria-label={tx("サイズ変更", "Resize")}
                      className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-se-resize rounded-sm border-2 border-white"
                      style={{ backgroundColor: SELECTION_YELLOW }}
                      onPointerDown={(event) => onResizePointerDown(event, node)}
                    />
                  ) : null}
                </div>
              );
            }

            return (
              <div
                key={node.id}
                data-board-node
                className="absolute overflow-hidden rounded-sm bg-white"
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.w,
                  height: node.h,
                  zIndex: node.z,
                  border: "1px solid #D4D4D8",
                  ...selectionStyle,
                }}
                onPointerDown={(event) => onNodePointerDown(event, node)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={(node as BoardImage).url} alt="" className="h-full w-full object-cover" draggable={false} />
                {selected && canEdit ? (
                  <button
                    type="button"
                    data-board-ui
                    aria-label={tx("サイズ変更", "Resize")}
                    className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-se-resize rounded-sm border-2 border-white"
                    style={{ backgroundColor: SELECTION_YELLOW }}
                    onPointerDown={(event) => onResizePointerDown(event, node)}
                  />
                ) : null}
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

              {/* 下のフローティング操作バー */}
              <div
                className={`pointer-events-none fixed inset-x-0 bottom-0 z-[500] flex flex-col items-center gap-2 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] transition-transform duration-200 ease-out ${
                  toolbarHidden ? "translate-y-[120%]" : "translate-y-0"
                }`}
              >
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
                        onClick={() => addSheetWithColor(color)}
                        className={`h-9 w-9 rounded-full border-2 shadow-sm transition active:scale-95 ${
                          sheetColor === color ? "scale-110 border-zinc-900" : "border-white"
                        }`}
                        style={{ backgroundColor: SHEET_COLORS[color].bg }}
                        aria-label={locale === "en" ? SHEET_COLORS[color].labelEn : SHEET_COLORS[color].labelJa}
                      />
                    ))}
                  </div>
                ) : null}

                <div className="pointer-events-auto flex items-center gap-2">
                  <div
                    data-board-ui
                    className="flex items-center gap-0.5 rounded-full bg-white p-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.14)]"
                  >
                    <PillIconButton
                      active={tool === "sheet"}
                      label={tx("用紙", "Sheet")}
                      icon={StickyNote}
                      disabled={!canEdit}
                      onClick={() => canEdit && selectTool(tool === "sheet" ? "navigate" : "sheet")}
                    />
                    <PillIconButton
                      active={false}
                      label={uploading ? tx("追加中", "Adding") : tx("添付", "Attach")}
                      icon={Paperclip}
                      disabled={!canEdit || Boolean(uploading)}
                      onClick={() => {
                        if (!canEdit) return;
                        selectTool("navigate");
                        onRequestPhoto();
                      }}
                    />
                    <PillIconButton
                      active={tool === "arrow"}
                      label={tx("矢印", "Arrow")}
                      icon={ArrowUpRight}
                      disabled={!canEdit}
                      onClick={() => canEdit && selectTool(tool === "arrow" ? "navigate" : "arrow")}
                    />
                  </div>

                  {selectedId && canEdit ? (
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

                {tool === "arrow" ? (
                  <p className="pointer-events-none rounded-full bg-zinc-900/80 px-3 py-1 text-[11px] font-medium text-white">
                    {connectFromId
                      ? tx("つなげ先をタップ", "Tap the target")
                      : tx("つなぎ始めをタップ", "Tap the start")}
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

function SheetFullscreenEditor({
  sheet,
  canEdit,
  tx,
  onClose,
  onPatch,
  onDelete,
}: {
  sheet: BoardSheet;
  canEdit: boolean;
  tx: (ja: string, en: string) => string;
  onClose: () => void;
  onPatch: (patch: Partial<BoardSheet>) => void;
  onDelete: () => void;
}) {
  const colors = SHEET_COLORS[sheet.color];
  const fontSize = sheet.fontSize ?? 14;
  const textColor = sheet.textColor ?? "#1A1A1A";
  const align = (sheet.align ?? "center") as TextAlign;
  const valign = sheet.valign ?? "middle";
  const justify =
    valign === "top" ? "justify-start" : valign === "bottom" ? "justify-end" : "justify-center";
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el || !canEdit) return;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, [canEdit, sheet.id]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [fontSize, sheet.text, align]);

  return (
    <div
      data-board-ui
      className="fixed inset-0 z-[600] flex flex-col"
      style={{ backgroundColor: colors.bg }}
      role="dialog"
      aria-modal="true"
      aria-label={tx("用紙を編集", "Edit sheet")}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]"
        style={{ borderBottom: `1px solid ${colors.border}` }}
      >
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 items-center gap-0.5 rounded-full bg-white/80 px-3 text-sm font-semibold text-zinc-900 shadow-sm backdrop-blur active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
          {tx("完了", "Done")}
        </button>
        {canEdit ? (
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-rose-600 shadow-sm backdrop-blur active:scale-95"
            aria-label={tx("削除", "Delete")}
          >
            <Trash2 className="h-5 w-5" strokeWidth={2.25} />
          </button>
        ) : (
          <span className="w-11" />
        )}
      </div>

      <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-8 ${justify}`}>
        {canEdit ? (
          <textarea
            ref={textareaRef}
            value={sheet.text}
            onChange={(event) => {
              const el = event.target;
              onPatch({ text: el.value });
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
            placeholder={tx("ここに書く…", "Write here…")}
            rows={1}
            className="w-full resize-none overflow-hidden bg-transparent leading-relaxed outline-none placeholder:text-zinc-500/70"
            style={{
              fontSize: Math.max(22, Math.round(fontSize * 1.75)),
              color: textColor,
              textAlign: align,
              height: "auto",
            }}
          />
        ) : (
          <p
            className="w-full whitespace-pre-wrap leading-relaxed"
            style={{
              fontSize: Math.max(22, Math.round(fontSize * 1.75)),
              color: textColor,
              textAlign: align,
            }}
          >
            {sheet.text.trim() || tx("（空の用紙）", "(Empty sheet)")}
          </p>
        )}
      </div>

      {canEdit ? (
        <div
          className="shrink-0 border-t border-black/5 bg-white/90 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_28px_rgba(0,0,0,0.08)] backdrop-blur"
        >
          <div className="mx-auto flex w-full max-w-lg flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <div className="flex items-center gap-0.5 rounded-full bg-zinc-100 p-0.5">
                {FONT_SIZE_PRESETS.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => onPatch({ fontSize: size })}
                    className={`min-w-[2rem] rounded-full px-2 py-1.5 text-[12px] font-bold ${
                      fontSize === size ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
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
                    onClick={() => onPatch({ textColor: color })}
                    className={`h-7 w-7 rounded-full border-2 ${
                      textColor.toLowerCase() === color.toLowerCase()
                        ? "scale-110 border-zinc-900"
                        : "border-zinc-200"
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={tx("文字色", "Text color")}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
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
                    onClick={() => onPatch({ align: value })}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
                      align === value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                    }`}
                    aria-label={label}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-0.5 rounded-full bg-zinc-100 p-0.5">
                {(
                  [
                    ["top", AlignVerticalJustifyStart, tx("上寄せ", "Top")],
                    ["middle", AlignVerticalJustifyCenter, tx("中央", "Middle")],
                    ["bottom", AlignVerticalJustifyEnd, tx("下寄せ", "Bottom")],
                  ] as const
                ).map(([value, Icon, label]) => (
                  <button
                    key={value}
                    type="button"
                    title={label}
                    onClick={() => onPatch({ valign: value })}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
                      valign === value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                    }`}
                    aria-label={label}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>
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

/** 写真アップロード後にキャンバスへ載せるヘルパー */
export function appendImageToBoard(
  board: IssueWorkspaceBoard,
  url: string,
  at?: { x: number; y: number },
): IssueWorkspaceBoard {
  const image: BoardImage = {
    id: newBoardId("img"),
    kind: "image",
    x: at?.x ?? 120 + (board.items.length % 4) * 24,
    y: at?.y ?? 120 + (board.items.length % 4) * 24,
    w: DEFAULT_IMAGE_W,
    h: DEFAULT_IMAGE_H,
    url,
    z: nextZ(board.items),
  };
  return { v: 1, items: [...board.items, image] };
}
