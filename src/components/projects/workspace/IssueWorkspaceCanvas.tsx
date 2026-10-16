"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  ArrowUpRight,
  Camera,
  Hand,
  Minus,
  MousePointer2,
  Plus,
  StickyNote,
  Trash2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  edgePoint,
  newBoardId,
  nextZ,
  SHEET_COLOR_ORDER,
  SHEET_COLORS,
  type BoardArrow,
  type BoardImage,
  type BoardItem,
  type BoardNode,
  type BoardSheet,
  type IssueWorkspaceBoard,
  type SheetColor,
} from "@/lib/workspace/issueWorkspaceBoard";

type Tool = "select" | "pan" | "sheet" | "image" | "arrow";

type Props = {
  board: IssueWorkspaceBoard;
  canEdit: boolean;
  uploading?: boolean;
  onChange: (board: IssueWorkspaceBoard) => void;
  onRequestPhoto: () => void;
};

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.2;
const DEFAULT_SHEET_W = 200;
const DEFAULT_SHEET_H = 160;
const DEFAULT_IMAGE_W = 200;
const DEFAULT_IMAGE_H = 150;

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

function isNode(item: BoardItem): item is BoardNode {
  return item.kind === "sheet" || item.kind === "image";
}

export function IssueWorkspaceCanvas({ board, canEdit, uploading, onChange, onRequestPhoto }: Props) {
  const { tx, locale } = useI18n();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [sheetColor, setSheetColor] = useState<SheetColor>("yellow");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 24, y: 24 });
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef<DragState | null>(null);
  const [dragTick, setDragTick] = useState(0);

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

  const sortedNodes = useMemo(
    () => [...nodes].sort((a, b) => a.z - b.z),
    [nodes],
  );

  function selectTool(next: Tool) {
    setTool(next);
    if (next !== "arrow") setConnectFromId(null);
  }

  function commit(items: BoardItem[]) {
    onChange({ v: 1, items });
  }

  function updateItem(id: string, patch: Partial<BoardItem>) {
    commit(
      board.items.map((item) => (item.id === id ? ({ ...item, ...patch } as BoardItem) : item)),
    );
  }

  function clientToWorld(clientX: number, clientY: number) {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }

  function addSheetAt(worldX: number, worldY: number) {
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
    };
    commit([...board.items, sheet]);
    setSelectedId(sheet.id);
    setEditingId(sheet.id);
    selectTool("select");
  }

  function deleteSelected() {
    if (!canEdit || !selectedId) return;
    const id = selectedId;
    commit(
      board.items.filter((item) => {
        if (item.id === id) return false;
        if (item.kind === "arrow" && (item.fromId === id || item.toId === id)) return false;
        return true;
      }),
    );
    setSelectedId(null);
    setEditingId(null);
  }

  function bringToFront(id: string) {
    const z = nextZ(board.items);
    updateItem(id, { z } as Partial<BoardItem>);
  }

  function onCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-board-ui]")) return;

    if (tool === "pan" || event.altKey) {
      dragRef.current = {
        kind: "pan",
        startX: event.clientX,
        startY: event.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (tool === "sheet" && canEdit) {
      const world = clientToWorld(event.clientX, event.clientY);
      addSheetAt(world.x, world.y);
      return;
    }

    if (tool === "image" && canEdit) {
      onRequestPhoto();
      return;
    }

    // empty canvas click
    if (!(event.target as HTMLElement).closest("[data-board-node]")) {
      setSelectedId(null);
      setEditingId(null);
      setConnectFromId(null);
    }
  }

  function onNodePointerDown(event: ReactPointerEvent<HTMLDivElement>, node: BoardNode) {
    if (event.button !== 0) return;
    event.stopPropagation();
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
      selectTool("select");
      return;
    }

    if (tool === "pan") return;

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
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
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
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "pan") {
      setPan({
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
          item.id === drag.id && isNode(item)
            ? { ...item, x: drag.origX + dx, y: drag.origY + dy }
            : item,
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

  function onPointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.kind === "move" && !drag.moved) {
      const node = nodeMap.get(drag.id);
      if (node?.kind === "sheet") setEditingId(node.id);
    }
  }

  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    const factor = event.deltaY > 0 ? 0.92 : 1.08;
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor)));
  }

  // silence unused dragTick (forces re-render during drag for arrow follow)
  void dragTick;

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-sm">
      <div
        data-board-ui
        className="flex flex-wrap items-center gap-1.5 border-b border-zinc-200 bg-white/95 px-2 py-2"
      >
        <ToolButton
          active={tool === "select"}
          label={tx("選択", "Select")}
          onClick={() => selectTool("select")}
          icon={MousePointer2}
        />
        <ToolButton
          active={tool === "pan"}
          label={tx("移動", "Pan")}
          onClick={() => selectTool("pan")}
          icon={Hand}
        />
        <ToolButton
          active={tool === "sheet"}
          label={tx("用紙", "Sheet")}
          onClick={() => canEdit && selectTool("sheet")}
          icon={StickyNote}
          disabled={!canEdit}
        />
        <ToolButton
          active={tool === "image"}
          label={tx("写真", "Photo")}
          onClick={() => {
            if (!canEdit) return;
            selectTool("image");
            onRequestPhoto();
          }}
          icon={Camera}
          disabled={!canEdit || Boolean(uploading)}
        />
        <ToolButton
          active={tool === "arrow"}
          label={tx("矢印", "Arrow")}
          onClick={() => canEdit && selectTool("arrow")}
          icon={ArrowUpRight}
          disabled={!canEdit}
        />
        <div className="mx-1 h-6 w-px bg-zinc-200" />
        <div className="flex items-center gap-1" data-board-ui>
          {SHEET_COLOR_ORDER.map((color) => (
            <button
              key={color}
              type="button"
              title={locale === "en" ? SHEET_COLORS[color].labelEn : SHEET_COLORS[color].labelJa}
              disabled={!canEdit}
              onClick={() => {
                setSheetColor(color);
                if (selectedId) {
                  const node = nodeMap.get(selectedId);
                  if (node?.kind === "sheet") updateItem(selectedId, { color });
                } else {
                  selectTool("sheet");
                }
              }}
              className={`h-7 w-7 rounded-md border-2 transition ${
                sheetColor === color ? "scale-110 border-zinc-800" : "border-transparent"
              } disabled:opacity-40`}
              style={{ backgroundColor: SHEET_COLORS[color].bg }}
              aria-label={locale === "en" ? SHEET_COLORS[color].labelEn : SHEET_COLORS[color].labelJa}
            />
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            data-board-ui
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z * 0.9))}
            aria-label={tx("縮小", "Zoom out")}
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            data-board-ui
            className="min-w-[3rem] rounded-lg px-1 text-center text-[11px] font-semibold text-zinc-600 hover:bg-zinc-100"
            onClick={() => {
              setZoom(1);
              setPan({ x: 24, y: 24 });
            }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            data-board-ui
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.1))}
            aria-label={tx("拡大", "Zoom in")}
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            data-board-ui
            disabled={!canEdit || !selectedId}
            onClick={deleteSelected}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-30"
            aria-label={tx("削除", "Delete")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {tool === "arrow" ? (
        <p className="border-b border-amber-100 bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-900">
          {connectFromId
            ? tx("つなげ先の用紙や写真をタップ", "Tap the target sheet or photo")
            : tx("つなぎ始めの用紙や写真をタップ", "Tap the starting sheet or photo")}
        </p>
      ) : null}
      {tool === "sheet" ? (
        <p className="border-b border-sky-100 bg-sky-50 px-3 py-1.5 text-[11px] font-medium text-sky-900">
          {tx("キャンバスをタップして用紙を置く", "Tap the canvas to place a colored sheet")}
        </p>
      ) : null}

      <div
        ref={rootRef}
        id="issue-workspace-canvas-surface"
        className={`relative h-[min(70vh,560px)] w-full touch-none overflow-hidden ${
          tool === "pan" ? "cursor-grab active:cursor-grabbing" : tool === "sheet" ? "cursor-crosshair" : "cursor-default"
        }`}
        style={{
          backgroundColor: "#F4F4F5",
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(161,161,170,0.35) 1px, transparent 0)",
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div
          className="absolute left-0 top-0 origin-top-left will-change-transform"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <svg
            className="pointer-events-none absolute left-0 top-0 overflow-visible"
            width={4000}
            height={3000}
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
                    stroke={selected ? "#EA580C" : arrow.color}
                    strokeWidth={selected ? 3 : 2.5}
                    markerEnd="url(#issue-board-arrowhead)"
                  />
                  {/* hit area */}
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
                      setEditingId(null);
                    }}
                  />
                </g>
              );
            })}
          </svg>

          {sortedNodes.map((node) => {
            const selected = selectedId === node.id || connectFromId === node.id;
            if (node.kind === "sheet") {
              const colors = SHEET_COLORS[node.color];
              return (
                <div
                  key={node.id}
                  data-board-node
                  className={`absolute flex flex-col overflow-hidden rounded-sm shadow-md ${
                    selected ? "ring-2 ring-orange-500 ring-offset-1" : ""
                  }`}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: node.w,
                    height: node.h,
                    zIndex: node.z,
                    backgroundColor: colors.bg,
                    border: `1px solid ${colors.border}`,
                    boxShadow: "2px 3px 0 rgba(0,0,0,0.08)",
                  }}
                  onPointerDown={(event) => onNodePointerDown(event, node)}
                >
                  <div className="h-2 shrink-0 opacity-40" style={{ background: colors.border }} />
                  {editingId === node.id && canEdit ? (
                    <textarea
                      data-board-ui
                      autoFocus
                      value={node.text}
                      onChange={(event) => updateItem(node.id, { text: event.target.value })}
                      onBlur={() => setEditingId(null)}
                      onPointerDown={(event) => event.stopPropagation()}
                      placeholder={tx("ここに書く…", "Write here…")}
                      className="min-h-0 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400"
                    />
                  ) : (
                    <button
                      type="button"
                      className="min-h-0 flex-1 overflow-hidden px-2.5 py-2 text-left text-sm leading-relaxed text-zinc-900 whitespace-pre-wrap"
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        if (canEdit) setEditingId(node.id);
                      }}
                    >
                      {node.text.trim() || (
                        <span className="text-zinc-400">{tx("タップして編集", "Tap to edit")}</span>
                      )}
                    </button>
                  )}
                  {selected && canEdit ? (
                    <button
                      type="button"
                      data-board-ui
                      aria-label={tx("サイズ変更", "Resize")}
                      className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize bg-orange-500/80"
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
                className={`absolute overflow-hidden rounded-sm bg-white shadow-md ${
                  selected ? "ring-2 ring-orange-500 ring-offset-1" : ""
                }`}
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.w,
                  height: node.h,
                  zIndex: node.z,
                  border: "1px solid #D4D4D8",
                  boxShadow: "2px 3px 0 rgba(0,0,0,0.08)",
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
                    className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize bg-orange-500/80"
                    onPointerDown={(event) => onResizePointerDown(event, node)}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        {board.items.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-xs rounded-2xl bg-white/90 px-4 py-3 text-center text-sm text-zinc-600 shadow-sm backdrop-blur">
              {tx(
                "色付きの用紙を置いてメモしたり、写真を貼ったり、矢印でつなげられます",
                "Place colored sheets, add photos, and connect them with arrows",
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ToolButton({
  active,
  label,
  onClick,
  icon: Icon,
  disabled,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon: typeof Hand;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      data-board-ui
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition disabled:opacity-40 ${
        active ? "bg-orange-100 text-orange-800" : "text-zinc-600 hover:bg-zinc-100"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
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
