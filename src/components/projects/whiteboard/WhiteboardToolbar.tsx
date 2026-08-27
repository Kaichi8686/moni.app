"use client";

import {
  ArrowUpRight,
  Circle,
  Download,
  Eraser,
  Hand,
  Highlighter,
  LayoutTemplate,
  Minus,
  MousePointer2,
  Pencil,
  Plus,
  Redo2,
  Square,
  StickyNote,
  Type,
  Undo2,
} from "lucide-react";
import type { WhiteboardTool } from "@/lib/projects/whiteboard/types";
import { HIGHLIGHTER_COLORS, NOTE_COLORS, PEN_COLORS } from "@/lib/projects/whiteboard/types";

type Props = {
  tool: WhiteboardTool;
  onToolChange: (t: WhiteboardTool) => void;
  color: string;
  onColorChange: (c: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (w: number) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  canEdit: boolean;
  onOpenTemplates: () => void;
  saving: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExport?: () => void;
};

const TOOLS: Array<{ id: WhiteboardTool; label: string; icon: typeof Pencil }> = [
  { id: "select", label: "選択", icon: MousePointer2 },
  { id: "pan", label: "移動", icon: Hand },
  { id: "pen", label: "ペン", icon: Pencil },
  { id: "highlighter", label: "蛍光ペン", icon: Highlighter },
  { id: "eraser", label: "消しゴム", icon: Eraser },
  { id: "note", label: "付箋", icon: StickyNote },
  { id: "text", label: "文字", icon: Type },
  { id: "rect", label: "四角", icon: Square },
  { id: "circle", label: "丸", icon: Circle },
  { id: "arrow", label: "矢印", icon: ArrowUpRight },
];

const COLOR_TOOLS: WhiteboardTool[] = ["pen", "highlighter", "rect", "circle", "arrow"];

export function WhiteboardToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  canEdit,
  onOpenTemplates,
  saving,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExport,
}: Props) {
  const palette = tool === "highlighter" ? HIGHLIGHTER_COLORS : PEN_COLORS;
  const strokeMin = tool === "highlighter" ? 8 : 1;
  const strokeMax = tool === "highlighter" ? 32 : 16;
  return (
    <div className="wb-toolbar flex flex-wrap items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-sm">
      <div className="flex flex-wrap gap-1">
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            title={label}
            disabled={!canEdit && id !== "pan" && id !== "select"}
            onClick={() => onToolChange(id)}
            className={`flex h-10 min-w-[2.5rem] items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition ${
              tool === id ? "bg-violet-100 text-violet-800" : "text-[#6B7280] hover:bg-[#F3F4F6]"
            } disabled:opacity-40`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {canEdit && COLOR_TOOLS.includes(tool) ? (
        <div className="flex items-center gap-1 border-l border-[#E5E7EB] pl-2">
          {palette.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`色 ${c}`}
              onClick={() => onColorChange(c)}
              className={`h-7 w-7 rounded-full border-2 ${color === c ? "border-violet-500" : "border-white shadow"}`}
              style={{ backgroundColor: c, opacity: tool === "highlighter" ? 0.85 : 1 }}
            />
          ))}
          {tool === "pen" || tool === "highlighter" ? (
            <input
              type="range"
              min={strokeMin}
              max={strokeMax}
              value={strokeWidth}
              onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
              className="ml-1 w-16"
              aria-label={tool === "highlighter" ? "蛍光ペンの太さ" : "線の太さ"}
              title={tool === "highlighter" ? "太めのストローク推奨" : undefined}
            />
          ) : null}
        </div>
      ) : null}

      {canEdit && tool === "note" ? (
        <div className="flex items-center gap-1 border-l border-[#E5E7EB] pl-2">
          {NOTE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onColorChange(c)}
              className={`h-7 w-7 rounded-md border-2 ${color === c ? "border-violet-500" : "border-transparent"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      ) : null}

      <div className="ml-auto flex items-center gap-1">
        {canEdit ? (
          <>
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-30"
              aria-label="元に戻す"
              title="元に戻す"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-30"
              aria-label="やり直す"
              title="やり直す"
            >
              <Redo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onOpenTemplates}
              className="flex h-9 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-[#6B7280] hover:bg-[#F3F4F6]"
            >
              <LayoutTemplate className="h-4 w-4" />
              <span className="hidden sm:inline">テンプレ</span>
            </button>
            {onExport ? (
              <button
                type="button"
                onClick={onExport}
                className="flex h-9 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-[#6B7280] hover:bg-[#F3F4F6]"
                title="PNGでダウンロード"
                aria-label="PNGでダウンロード"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">PNG</span>
              </button>
            ) : null}
          </>
        ) : null}
        <div className="flex items-center gap-0.5 border-l border-[#E5E7EB] pl-1">
          <button type="button" onClick={onZoomOut} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[#F3F4F6]" aria-label="縮小">
            <Minus className="h-4 w-4" />
          </button>
          <button type="button" onClick={onZoomReset} className="min-w-[3rem] rounded-lg px-2 text-[11px] font-semibold hover:bg-[#F3F4F6]">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" onClick={onZoomIn} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[#F3F4F6]" aria-label="拡大">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {saving ? <span className="text-[10px] text-[#9CA3AF]">保存中…</span> : null}
      </div>
    </div>
  );
}

export function WhiteboardToolHint({ tool }: { tool: WhiteboardTool }) {
  const hints: Record<WhiteboardTool, string> = {
    select: "要素をタップで選択・ドラッグで移動 · 空白ドラッグで画面移動 · Deleteで削除",
    pan: "ドラッグで移動 · ピンチ/ホイールで拡大縮小",
    pen: "ドラッグして描く（なめらか補正あり）",
    highlighter: "ドラッグして半透明でハイライト（太め推奨）",
    eraser: "タップで要素を削除",
    note: "タップで付箋を置く · ダブルタップで編集",
    text: "タップで文字を置く · ダブルタップで編集",
    rect: "ドラッグで四角形",
    circle: "ドラッグで円",
    arrow: "ドラッグで矢印",
  };
  return (
    <p className="flex items-center gap-1 text-[11px] text-[#9CA3AF]">
      <MousePointer2 className="h-3 w-3" />
      {hints[tool]}
    </p>
  );
}
