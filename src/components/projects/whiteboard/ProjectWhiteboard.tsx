"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import { WhiteboardToolbar, WhiteboardToolHint } from "@/components/projects/whiteboard/WhiteboardToolbar";
import {
  deleteBoardElement,
  ensureProjectBoard,
  insertBoardElement,
  loadBoardElements,
  updateBoardElement,
} from "@/lib/projects/whiteboard/boardApi";
import {
  loadViewport,
  saveViewport,
  WHITEBOARD_TEMPLATES,
  type NotePayload,
  type PenPayload,
  type ShapePayload,
  type TextPayload,
  type WhiteboardElement,
  type WhiteboardTool,
  type WhiteboardViewport,
} from "@/lib/projects/whiteboard/types";

const CANVAS_SIZE = 8000;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;
const HIGHLIGHTER_DEFAULT_WIDTH = 18;
const HIGHLIGHTER_OPACITY = 0.35;

type Props = {
  projectId: string;
  uid: string | null;
  canEdit: boolean;
};

type Pt = { x: number; y: number };
type Bounds = { x: number; y: number; w: number; h: number };

/** 中点法でなめらかな曲線パスを生成（GoodNotes風の書き味） */
function penToPath(p: PenPayload): string {
  const pts = p.points;
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y} L ${pts[0].x + 0.1} ${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q ${pts[i].x} ${pts[i].y} ${mx} ${my}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function textBounds(t: TextPayload): Bounds {
  const w = Math.max(40, t.text.length * t.fontSize * 0.62);
  const h = t.fontSize * 1.4;
  return { x: t.x, y: t.y, w, h };
}

function elementBounds(el: WhiteboardElement): Bounds {
  if (el.type === "pen") {
    const p = el.payload as PenPayload;
    if (p.points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const pt of p.points) {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  if (el.type === "text") return textBounds(el.payload as TextPayload);
  const p = el.payload as NotePayload | ShapePayload;
  const x2 = p.x + p.w;
  const y2 = p.y + p.h;
  return { x: Math.min(p.x, x2), y: Math.min(p.y, y2), w: Math.abs(p.w), h: Math.abs(p.h) };
}

function hitElement(el: WhiteboardElement, wx: number, wy: number, tol: number): boolean {
  if (el.type === "pen") {
    const p = el.payload as PenPayload;
    if (p.points.length === 1) return Math.hypot(wx - p.points[0].x, wy - p.points[0].y) < tol;
    for (let i = 1; i < p.points.length; i += 1) {
      if (distToSegment(wx, wy, p.points[i - 1].x, p.points[i - 1].y, p.points[i].x, p.points[i].y) < tol) {
        return true;
      }
    }
    return false;
  }
  if (el.type === "shape") {
    const s = el.payload as ShapePayload;
    if (s.shape === "arrow") {
      return distToSegment(wx, wy, s.x, s.y, s.x + s.w, s.y + s.h) < tol;
    }
    const b = elementBounds(el);
    return wx >= b.x - tol && wx <= b.x + b.w + tol && wy >= b.y - tol && wy <= b.y + b.h + tol;
  }
  const b = elementBounds(el);
  return wx >= b.x - tol && wx <= b.x + b.w + tol && wy >= b.y - tol && wy <= b.y + b.h + tol;
}

type HistoryEntry =
  | { type: "add"; element: WhiteboardElement }
  | { type: "remove"; element: WhiteboardElement }
  | { type: "modify"; id: string; before: WhiteboardElement["payload"]; after: WhiteboardElement["payload"] };

export function ProjectWhiteboard({ projectId, uid, canEdit }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [tool, setTool] = useState<WhiteboardTool>("pen");
  const [color, setColor] = useState("#1A1A1A");
  const [noteColor, setNoteColor] = useState("#FEF08A");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const penOpacity = tool === "highlighter" ? HIGHLIGHTER_OPACITY : undefined;
  const [viewport, setViewport] = useState<WhiteboardViewport>({ panX: 40, panY: 40, zoom: 1 });
  const [templateOpen, setTemplateOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const drawingRef = useRef<{ points: Pt[] } | null>(null);
  const shapeStartRef = useRef<Pt | null>(null);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const dragRef = useRef<
    | { id: string; kind: "pen"; startX: number; startY: number; orig: Pt[]; moved: boolean }
    | { id: string; kind: "box"; startX: number; startY: number; ox: number; oy: number; moved: boolean }
    | null
  >(null);
  const [previewShape, setPreviewShape] = useState<ShapePayload | null>(null);
  const [livePen, setLivePen] = useState<PenPayload | null>(null);

  const pointersRef = useRef<Map<number, Pt>>(new Map());
  const pinchRef = useRef<{ dist: number; zoom: number; panX: number; panY: number; cx: number; cy: number } | null>(null);

  const undoRef = useRef<HistoryEntry[]>([]);
  const redoRef = useRef<HistoryEntry[]>([]);
  const penStrokeWidthRef = useRef<number | null>(null);
  const [undoLen, setUndoLen] = useState(0);
  const [redoLen, setRedoLen] = useState(0);

  const syncHistoryLen = useCallback(() => {
    setUndoLen(undoRef.current.length);
    setRedoLen(redoRef.current.length);
  }, []);

  const pushHistory = useCallback(
    (entry: HistoryEntry) => {
      undoRef.current = [...undoRef.current.slice(-49), entry];
      redoRef.current = [];
      syncHistoryLen();
    },
    [syncHistoryLen],
  );

  const screenToWorld = useCallback(
    (clientX: number, clientY: number): Pt => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - viewport.panX) / viewport.zoom,
        y: (clientY - rect.top - viewport.panY) / viewport.zoom,
      };
    },
    [viewport],
  );

  useEffect(() => {
    const saved = loadViewport(projectId);
    if (saved) setViewport(saved);
  }, [projectId]);

  useEffect(() => {
    saveViewport(projectId, viewport);
  }, [projectId, viewport]);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const bid = await ensureProjectBoard(projectId, uid);
        if (cancelled) return;
        setBoardId(bid);
        const els = await loadBoardElements(bid);
        if (!cancelled) setElements(els);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "読み込み失敗");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, uid]);

  const persistElement = useCallback(
    async (el: Pick<WhiteboardElement, "type" | "payload">) => {
      if (!boardId || !uid || !canEdit) return null;
      setSaving(true);
      try {
        const saved = await insertBoardElement(boardId, uid, el);
        setElements((prev) => [...prev, saved]);
        pushHistory({ type: "add", element: saved });
        return saved;
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存失敗");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [boardId, canEdit, uid, pushHistory],
  );

  const removeElement = useCallback(
    async (id: string, record = true) => {
      if (!canEdit) return;
      const target = elements.find((e) => e.id === id);
      setSaving(true);
      try {
        await deleteBoardElement(id);
        setElements((prev) => prev.filter((e) => e.id !== id));
        if (record && target) pushHistory({ type: "remove", element: target });
        setSelectedId((cur) => (cur === id ? null : cur));
      } catch (e) {
        setError(e instanceof Error ? e.message : "削除失敗");
      } finally {
        setSaving(false);
      }
    },
    [canEdit, elements, pushHistory],
  );

  const undo = useCallback(async () => {
    if (!uid || !boardId) return;
    const entry = undoRef.current.pop();
    if (!entry) return;
    setSaving(true);
    try {
      if (entry.type === "add") {
        await deleteBoardElement(entry.element.id);
        setElements((prev) => prev.filter((e) => e.id !== entry.element.id));
        redoRef.current.push(entry);
      } else if (entry.type === "remove") {
        await insertBoardElement(boardId, uid, entry.element, entry.element.id);
        setElements((prev) => [...prev, entry.element]);
        redoRef.current.push(entry);
      } else {
        await updateBoardElement(entry.id, uid, entry.before);
        setElements((prev) => prev.map((e) => (e.id === entry.id ? { ...e, payload: entry.before } : e)));
        redoRef.current.push(entry);
      }
      setSelectedId(null);
      syncHistoryLen();
    } catch (e) {
      setError(e instanceof Error ? e.message : "元に戻す失敗");
    } finally {
      setSaving(false);
    }
  }, [uid, boardId, syncHistoryLen]);

  const redo = useCallback(async () => {
    if (!uid || !boardId) return;
    const entry = redoRef.current.pop();
    if (!entry) return;
    setSaving(true);
    try {
      if (entry.type === "add") {
        await insertBoardElement(boardId, uid, entry.element, entry.element.id);
        setElements((prev) => [...prev, entry.element]);
        undoRef.current.push(entry);
      } else if (entry.type === "remove") {
        await deleteBoardElement(entry.element.id);
        setElements((prev) => prev.filter((e) => e.id !== entry.element.id));
        undoRef.current.push(entry);
      } else {
        await updateBoardElement(entry.id, uid, entry.after);
        setElements((prev) => prev.map((e) => (e.id === entry.id ? { ...e, payload: entry.after } : e)));
        undoRef.current.push(entry);
      }
      setSelectedId(null);
      syncHistoryLen();
    } catch (e) {
      setError(e instanceof Error ? e.message : "やり直し失敗");
    } finally {
      setSaving(false);
    }
  }, [uid, boardId, syncHistoryLen]);

  const applyPinchZoom = useCallback((nextZoom: number, cx: number, cy: number) => {
    setViewport((v) => {
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
      const k = z / v.zoom;
      return {
        zoom: z,
        panX: cx - (cx - v.panX) * k,
        panY: cy - (cy - v.panY) * k,
      };
    });
  }, []);

  const beginDrag = (el: WhiteboardElement, world: Pt, pointerId: number) => {
    setSelectedId(el.id);
    if (el.type === "pen") {
      dragRef.current = {
        id: el.id,
        kind: "pen",
        startX: world.x,
        startY: world.y,
        orig: (el.payload as PenPayload).points.map((p) => ({ ...p })),
        moved: false,
      };
    } else {
      const p = el.payload as NotePayload | TextPayload | ShapePayload;
      dragRef.current = { id: el.id, kind: "box", startX: world.x, startY: world.y, ox: p.x, oy: p.y, moved: false };
    }
    rootRef.current?.setPointerCapture(pointerId);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // 2本指 → ピンチズーム開始
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      const rect = rootRef.current?.getBoundingClientRect();
      pinchRef.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        zoom: viewport.zoom,
        panX: viewport.panX,
        panY: viewport.panY,
        cx: (a.x + b.x) / 2 - (rect?.left ?? 0),
        cy: (a.y + b.y) / 2 - (rect?.top ?? 0),
      };
      drawingRef.current = null;
      setLivePen(null);
      shapeStartRef.current = null;
      setPreviewShape(null);
      panStartRef.current = null;
      dragRef.current = null;
      return;
    }

    const { x, y } = screenToWorld(e.clientX, e.clientY);
    rootRef.current?.setPointerCapture(e.pointerId);

    if (tool === "select") {
      const tol = 12 / viewport.zoom;
      const hit = [...elements].reverse().find((el) => hitElement(el, x, y, tol));
      if (hit && canEdit) {
        beginDrag(hit, { x, y }, e.pointerId);
      } else {
        setSelectedId(null);
        panStartRef.current = { x: e.clientX, y: e.clientY, panX: viewport.panX, panY: viewport.panY };
      }
      return;
    }

    if (tool === "pan") {
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: viewport.panX, panY: viewport.panY };
      return;
    }

    if (!canEdit) return;

    if (tool === "eraser") {
      const tol = 12 / viewport.zoom;
      const hit = [...elements].reverse().find((el) => hitElement(el, x, y, tol));
      if (hit) void removeElement(hit.id);
      return;
    }

    if (tool === "pen" || tool === "highlighter") {
      drawingRef.current = { points: [{ x, y }] };
      setLivePen({ points: [{ x, y }], color, width: strokeWidth, opacity: penOpacity });
      return;
    }

    if (tool === "rect" || tool === "circle" || tool === "arrow") {
      shapeStartRef.current = { x, y };
      setPreviewShape({ shape: tool, x, y, w: 0, h: 0, color });
      return;
    }

    if (tool === "note") {
      void persistElement({
        type: "note",
        payload: { text: "メモ", x: x - 80, y: y - 60, w: 160, h: 120, color: noteColor },
      });
      return;
    }

    if (tool === "text") {
      void persistElement({
        type: "text",
        payload: { text: "テキスト", x, y, fontSize: 18, color },
      });
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pinchRef.current && pointersRef.current.size >= 2) {
      const [a, b] = [...pointersRef.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const ratio = dist / (pinchRef.current.dist || 1);
      applyPinchZoom(pinchRef.current.zoom * ratio, pinchRef.current.cx, pinchRef.current.cy);
      return;
    }

    const { x, y } = screenToWorld(e.clientX, e.clientY);

    if (panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setViewport((v) => ({ ...v, panX: panStartRef.current!.panX + dx, panY: panStartRef.current!.panY + dy }));
      return;
    }

    if (dragRef.current) {
      const d = dragRef.current;
      const dx = x - d.startX;
      const dy = y - d.startY;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) d.moved = true;
      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== d.id) return el;
          if (d.kind === "pen") {
            const pts = d.orig.map((p) => ({ x: p.x + dx, y: p.y + dy }));
            return { ...el, payload: { ...(el.payload as PenPayload), points: pts } };
          }
          const p = { ...(el.payload as NotePayload | TextPayload | ShapePayload) };
          p.x = d.ox + dx;
          p.y = d.oy + dy;
          return { ...el, payload: p };
        }),
      );
      return;
    }

    if (drawingRef.current) {
      const pts = drawingRef.current.points;
      const last = pts[pts.length - 1];
      const minDist = 2 / viewport.zoom;
      if (!last || Math.hypot(x - last.x, y - last.y) >= minDist) {
        pts.push({ x, y });
        setLivePen({ points: [...pts], color, width: strokeWidth, opacity: penOpacity });
      }
      return;
    }

    if (shapeStartRef.current && previewShape) {
      const sx = shapeStartRef.current.x;
      const sy = shapeStartRef.current.y;
      setPreviewShape({ ...previewShape, x: sx, y: sy, w: x - sx, h: y - sy });
    }
  };

  const onPointerUp = async (e: React.PointerEvent) => {
    rootRef.current?.releasePointerCapture(e.pointerId);
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;

    const { x, y } = screenToWorld(e.clientX, e.clientY);

    if (panStartRef.current) {
      panStartRef.current = null;
      return;
    }

    if (dragRef.current) {
      const d = dragRef.current;
      const el = elements.find((it) => it.id === d.id);
      dragRef.current = null;
      if (el && d.moved && uid) {
        const before =
          d.kind === "pen"
            ? ({ ...(el.payload as PenPayload), points: d.orig } as WhiteboardElement["payload"])
            : ({ ...(el.payload as NotePayload | TextPayload | ShapePayload), x: d.ox, y: d.oy } as WhiteboardElement["payload"]);
        setSaving(true);
        try {
          await updateBoardElement(el.id, uid, el.payload);
          pushHistory({ type: "modify", id: el.id, before, after: el.payload });
        } catch (err) {
          setError(err instanceof Error ? err.message : "更新失敗");
        } finally {
          setSaving(false);
        }
      }
      return;
    }

    if (drawingRef.current) {
      const captured = drawingRef.current.points;
      drawingRef.current = null;
      setLivePen(null);
      if (captured.length > 1) {
        const payload: PenPayload = { points: captured, color, width: strokeWidth };
        if (tool === "highlighter") payload.opacity = HIGHLIGHTER_OPACITY;
        await persistElement({ type: "pen", payload });
      }
      return;
    }

    if (shapeStartRef.current && previewShape) {
      const isArrow = previewShape.shape === "arrow";
      const w = Math.abs(previewShape.w);
      const h = Math.abs(previewShape.h);
      const start = shapeStartRef.current;
      shapeStartRef.current = null;
      setPreviewShape(null);
      if (isArrow) {
        if (Math.hypot(previewShape.w, previewShape.h) > 8) {
          await persistElement({
            type: "shape",
            payload: { shape: "arrow", x: start.x, y: start.y, w: x - start.x, h: y - start.y, color: previewShape.color },
          });
        }
      } else if (w > 8 && h > 8) {
        await persistElement({
          type: "shape",
          payload: {
            shape: previewShape.shape,
            x: previewShape.w < 0 ? x : start.x,
            y: previewShape.h < 0 ? y : start.y,
            w,
            h,
            color: previewShape.color,
          },
        });
      }
    }
  };

  const commitPayloadEdit = useCallback(
    async (id: string, next: WhiteboardElement["payload"]) => {
      const el = elements.find((x) => x.id === id);
      if (!el || !uid) return;
      const before = el.payload;
      setElements((prev) => prev.map((x) => (x.id === id ? { ...x, payload: next } : x)));
      setSaving(true);
      try {
        await updateBoardElement(id, uid, next);
        pushHistory({ type: "modify", id, before, after: next });
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存失敗");
      } finally {
        setSaving(false);
      }
    },
    [elements, uid, pushHistory],
  );

  async function saveNoteText(id: string, text: string) {
    const el = elements.find((x) => x.id === id);
    setEditingNoteId(null);
    if (!el || el.type !== "note") return;
    const current = (el.payload as NotePayload).text;
    if (current === text) return;
    await commitPayloadEdit(id, { ...(el.payload as NotePayload), text });
  }

  async function saveTextValue(id: string, text: string) {
    const el = elements.find((x) => x.id === id);
    setEditingTextId(null);
    if (!el || el.type !== "text") return;
    const current = (el.payload as TextPayload).text;
    if (current === text.trim()) return;
    if (!text.trim()) {
      await removeElement(id);
      return;
    }
    await commitPayloadEdit(id, { ...(el.payload as TextPayload), text: text.trim() });
  }

  async function applyTemplate(templateId: string) {
    const tpl = WHITEBOARD_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl || !canEdit) return;
    setTemplateOpen(false);
    for (const el of tpl.elements) {
      await persistElement({ type: el.type, payload: el.payload });
    }
  }

  const zoomIn = () =>
    applyPinchZoom(viewport.zoom * 1.2, (rootRef.current?.clientWidth ?? 0) / 2, (rootRef.current?.clientHeight ?? 0) / 2);
  const zoomOut = () =>
    applyPinchZoom(viewport.zoom / 1.2, (rootRef.current?.clientWidth ?? 0) / 2, (rootRef.current?.clientHeight ?? 0) / 2);
  const zoomReset = () => setViewport((v) => ({ ...v, zoom: 1 }));

  const handleToolChange = useCallback(
    (next: WhiteboardTool) => {
      if (next === "highlighter" && tool !== "highlighter") {
        penStrokeWidthRef.current = strokeWidth;
        setStrokeWidth(HIGHLIGHTER_DEFAULT_WIDTH);
        setColor("#FACC15");
      } else if (tool === "highlighter" && next !== "highlighter" && penStrokeWidthRef.current !== null) {
        setStrokeWidth(penStrokeWidthRef.current);
        penStrokeWidthRef.current = null;
      }
      setTool(next);
      if (next !== "select") setSelectedId(null);
    },
    [tool, strokeWidth],
  );

  const exportPng = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("width", String(CANVAS_SIZE));
    bg.setAttribute("height", String(CANVAS_SIZE));
    bg.setAttribute("fill", "#FBFCFE");
    clone.insertBefore(bg, clone.firstChild);
    const svgString = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((pngBlob) => {
          if (!pngBlob) return;
          const a = document.createElement("a");
          a.href = URL.createObjectURL(pngBlob);
          a.download = `whiteboard-${projectId}.png`;
          a.click();
          URL.revokeObjectURL(a.href);
        }, "image/png");
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, [projectId]);

  useEffect(() => {
    if (!canEdit) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        void undo();
      } else if (meta && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        void redo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        void removeElement(selectedId);
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canEdit, selectedId, undo, redo, removeElement]);

  if (!uid) {
    return <p className="text-sm text-[#6B7280]">ログインするとホワイトボードを使えます。</p>;
  }

  if (loading) {
    return <p className="text-sm text-[#6B7280]">ホワイトボードを読み込み中…</p>;
  }

  const selected = selectedId ? elements.find((e) => e.id === selectedId) ?? null : null;
  const selBounds = selected ? elementBounds(selected) : null;
  const cursorStyle =
    tool === "pan"
      ? "grab"
      : tool === "eraser"
        ? "cell"
        : tool === "select"
          ? "default"
          : "crosshair";

  return (
    <div className="space-y-2">
      <WhiteboardToolbar
        tool={tool}
        onToolChange={handleToolChange}
        color={tool === "note" ? noteColor : color}
        onColorChange={(c) => (tool === "note" ? setNoteColor(c) : setColor(c))}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
        zoom={viewport.zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={zoomReset}
        canEdit={canEdit}
        onOpenTemplates={() => setTemplateOpen(true)}
        onExport={exportPng}
        saving={saving}
        onUndo={() => void undo()}
        onRedo={() => void redo()}
        canUndo={undoLen > 0}
        canRedo={redoLen > 0}
      />
      <WhiteboardToolHint tool={tool} />

      {error ? <p className="text-[13px] text-red-600">{error}</p> : null}

      <div className="relative">
        <div
          ref={rootRef}
          className="wb-canvas-root relative h-[min(72dvh,660px)] w-full touch-none overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#FBFCFE]"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => void onPointerUp(e)}
          onPointerCancel={(e) => void onPointerUp(e)}
          onPointerLeave={(e) => void onPointerUp(e)}
          onWheel={(e) => {
            e.preventDefault();
            const rect = rootRef.current?.getBoundingClientRect();
            const cx = e.clientX - (rect?.left ?? 0);
            const cy = e.clientY - (rect?.top ?? 0);
            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            applyPinchZoom(viewport.zoom * factor, cx, cy);
          }}
          style={{ cursor: cursorStyle }}
        >
          <div
            className="wb-canvas-layer absolute left-0 top-0"
            style={{
              width: CANVAS_SIZE,
              height: CANVAS_SIZE,
              transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
              transformOrigin: "0 0",
              backgroundImage: "radial-gradient(circle, #D6DBE5 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          >
            <svg ref={svgRef} width={CANVAS_SIZE} height={CANVAS_SIZE} className="pointer-events-none absolute inset-0">
              {elements.map((el) => {
                if (el.type === "pen") {
                  const p = el.payload as PenPayload;
                  return (
                    <path
                      key={el.id}
                      d={penToPath(p)}
                      fill="none"
                      stroke={p.color}
                      strokeWidth={p.width}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={p.opacity ?? 1}
                    />
                  );
                }
                if (el.type === "shape") {
                  const s = el.payload as ShapePayload;
                  if (s.shape === "circle") {
                    return (
                      <ellipse
                        key={el.id}
                        cx={s.x + s.w / 2}
                        cy={s.y + s.h / 2}
                        rx={Math.abs(s.w / 2)}
                        ry={Math.abs(s.h / 2)}
                        stroke={s.color}
                        fill={s.fill ?? "transparent"}
                        strokeWidth={2}
                      />
                    );
                  }
                  if (s.shape === "arrow") {
                    const x2 = s.x + s.w;
                    const y2 = s.y + s.h;
                    const ang = Math.atan2(y2 - s.y, x2 - s.x);
                    const head = 14;
                    return (
                      <g key={el.id}>
                        <line x1={s.x} y1={s.y} x2={x2} y2={y2} stroke={s.color} strokeWidth={2.5} strokeLinecap="round" />
                        <polygon
                          points={`${x2},${y2} ${x2 - head * Math.cos(ang - Math.PI / 6)},${y2 - head * Math.sin(ang - Math.PI / 6)} ${x2 - head * Math.cos(ang + Math.PI / 6)},${y2 - head * Math.sin(ang + Math.PI / 6)}`}
                          fill={s.color}
                        />
                      </g>
                    );
                  }
                  return (
                    <rect
                      key={el.id}
                      x={s.x}
                      y={s.y}
                      width={s.w}
                      height={s.h}
                      stroke={s.color}
                      fill={s.fill ?? "transparent"}
                      strokeWidth={2}
                      rx={4}
                    />
                  );
                }
                return null;
              })}
              {livePen ? (
                <path
                  d={penToPath(livePen)}
                  fill="none"
                  stroke={livePen.color}
                  strokeWidth={livePen.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={livePen.opacity ?? 0.9}
                />
              ) : null}
              {previewShape ? (
                previewShape.shape === "circle" ? (
                  <ellipse
                    cx={previewShape.x + previewShape.w / 2}
                    cy={previewShape.y + previewShape.h / 2}
                    rx={Math.abs(previewShape.w / 2)}
                    ry={Math.abs(previewShape.h / 2)}
                    stroke={previewShape.color}
                    fill="transparent"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                  />
                ) : previewShape.shape === "arrow" ? (
                  <line
                    x1={previewShape.x}
                    y1={previewShape.y}
                    x2={previewShape.x + previewShape.w}
                    y2={previewShape.y + previewShape.h}
                    stroke={previewShape.color}
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                  />
                ) : (
                  <rect
                    x={Math.min(previewShape.x, previewShape.x + previewShape.w)}
                    y={Math.min(previewShape.y, previewShape.y + previewShape.h)}
                    width={Math.abs(previewShape.w)}
                    height={Math.abs(previewShape.h)}
                    stroke={previewShape.color}
                    fill="transparent"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                  />
                )
              ) : null}
              {selBounds ? (
                <rect
                  x={selBounds.x - 6}
                  y={selBounds.y - 6}
                  width={selBounds.w + 12}
                  height={selBounds.h + 12}
                  fill="rgba(94,106,210,0.06)"
                  stroke="#5E6AD2"
                  strokeWidth={1.5 / viewport.zoom}
                  strokeDasharray={`${6 / viewport.zoom} ${4 / viewport.zoom}`}
                  rx={6}
                />
              ) : null}
            </svg>

            {elements.map((el) => {
              if (el.type === "note") {
                const n = el.payload as NotePayload;
                return (
                  <div
                    key={el.id}
                    className="wb-sticky-note absolute rounded-lg border border-black/10 p-2 shadow-md"
                    style={{
                      left: n.x,
                      top: n.y,
                      width: n.w,
                      minHeight: n.h,
                      backgroundColor: n.color,
                      touchAction: "none",
                    }}
                    onPointerDown={(e) => {
                      if (tool !== "select" || !canEdit) return;
                      e.stopPropagation();
                      const w = screenToWorld(e.clientX, e.clientY);
                      beginDrag(el, w, e.pointerId);
                    }}
                    onDoubleClick={(e) => {
                      if (!canEdit) return;
                      e.stopPropagation();
                      setEditingNoteId(el.id);
                    }}
                  >
                    {editingNoteId === el.id ? (
                      <textarea
                        autoFocus
                        defaultValue={n.text}
                        className="h-full min-h-[90px] w-full resize-none bg-transparent text-[13px] outline-none"
                        onPointerDown={(e) => e.stopPropagation()}
                        onBlur={(e) => void saveNoteText(el.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setEditingNoteId(null);
                        }}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-[13px] leading-snug text-[#1A1A1A]">{n.text}</p>
                    )}
                  </div>
                );
              }
              if (el.type === "text") {
                const t = el.payload as TextPayload;
                if (editingTextId === el.id) {
                  return (
                    <input
                      key={el.id}
                      autoFocus
                      defaultValue={t.text}
                      className="absolute rounded border border-violet-400 bg-white/90 px-1 font-semibold outline-none"
                      style={{ left: t.x, top: t.y, fontSize: t.fontSize, color: t.color, minWidth: 80 }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onBlur={(e) => void saveTextValue(el.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setEditingTextId(null);
                      }}
                    />
                  );
                }
                return (
                  <p
                    key={el.id}
                    className="absolute font-semibold"
                    style={{ left: t.x, top: t.y, fontSize: t.fontSize, color: t.color, touchAction: "none" }}
                    onPointerDown={(e) => {
                      if (tool !== "select" || !canEdit) return;
                      e.stopPropagation();
                      const w = screenToWorld(e.clientX, e.clientY);
                      beginDrag(el, w, e.pointerId);
                    }}
                    onDoubleClick={(e) => {
                      if (!canEdit) return;
                      e.stopPropagation();
                      setEditingTextId(el.id);
                    }}
                  >
                    {t.text}
                  </p>
                );
              }
              return null;
            })}
          </div>

          {selected && canEdit ? (
            <button
              type="button"
              onClick={() => void removeElement(selected.id)}
              className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-lg border border-rose-200 bg-white/95 px-3 py-2 text-[12px] font-semibold text-rose-600 shadow-sm hover:bg-rose-50"
            >
              <Trash2 className="h-4 w-4" />
              選択を削除
            </button>
          ) : null}

          {/* ミニマップ */}
          <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg border border-[#E5E7EB] bg-white/90 p-1 shadow-sm">
            <svg width={120} height={80} viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`} className="block">
              <rect width={CANVAS_SIZE} height={CANVAS_SIZE} fill="#F1F5F9" />
              {elements.slice(0, 120).map((el) => {
                const b = elementBounds(el);
                if (el.type === "pen") {
                  return <circle key={el.id} cx={b.x + b.w / 2} cy={b.y + b.h / 2} r={50} fill="#94A3B8" opacity={0.5} />;
                }
                return (
                  <rect key={el.id} x={b.x} y={b.y} width={b.w || 80} height={b.h || 60} fill="#5E6AD2" opacity={0.35} />
                );
              })}
              {(() => {
                const rect = rootRef.current?.getBoundingClientRect();
                if (!rect) return null;
                const wx = -viewport.panX / viewport.zoom;
                const wy = -viewport.panY / viewport.zoom;
                const ww = rect.width / viewport.zoom;
                const wh = rect.height / viewport.zoom;
                return <rect x={wx} y={wy} width={ww} height={wh} fill="none" stroke="#5E6AD2" strokeWidth={80} />;
              })()}
            </svg>
          </div>
        </div>
      </div>

      {templateOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-[#1A1A1A]">テンプレート</h3>
              <button type="button" onClick={() => setTemplateOpen(false)} className="rounded-full p-2 hover:bg-[#F3F4F6]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="space-y-2">
              {WHITEBOARD_TEMPLATES.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => void applyTemplate(t.id)}
                    className="w-full rounded-xl border border-[#E5E7EB] px-3 py-3 text-left hover:border-violet-300 hover:bg-violet-50"
                  >
                    <p className="font-semibold text-[#1A1A1A]">{t.label}</p>
                    <p className="text-[12px] text-[#6B7280]">{t.description}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {!canEdit ? (
        <p className="text-[12px] text-[#9CA3AF]">閲覧のみです。編集するにはプロジェクトのメンバーである必要があります。</p>
      ) : null}
    </div>
  );
}
