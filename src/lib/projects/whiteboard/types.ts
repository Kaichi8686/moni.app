/** GoodNotes風ホワイトボード要素 */

export type WhiteboardTool =
  | "select"
  | "pan"
  | "pen"
  | "highlighter"
  | "eraser"
  | "note"
  | "text"
  | "rect"
  | "circle"
  | "arrow";

export type PenPayload = {
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
  /** 1 = opaque pen; highlighter strokes use ~0.35 */
  opacity?: number;
};

export type NotePayload = {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
};

export type TextPayload = {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
};

export type ShapePayload = {
  shape: "rect" | "circle" | "arrow";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  fill?: string;
};

export type WhiteboardElement = {
  id: string;
  boardId: string;
  type: "pen" | "note" | "text" | "shape";
  payload: PenPayload | NotePayload | TextPayload | ShapePayload;
  updatedAt: string;
};

export type WhiteboardViewport = {
  panX: number;
  panY: number;
  zoom: number;
};

export const NOTE_COLORS = ["#FEF08A", "#BBF7D0", "#BFDBFE", "#FBCFE8", "#E9D5FF"] as const;

export const PEN_COLORS = ["#1A1A1A", "#DC2626", "#2563EB", "#16A34A", "#9333EA"] as const;

export const HIGHLIGHTER_COLORS = ["#FACC15", "#FBCFE8", "#93C5FD", "#BBF7D0", "#FDE68A"] as const;

export type WhiteboardTemplate = {
  id: string;
  label: string;
  description: string;
  elements: Array<Omit<WhiteboardElement, "id" | "boardId" | "updatedAt">>;
};

export const WHITEBOARD_TEMPLATES: WhiteboardTemplate[] = [
  {
    id: "brainstorm",
    label: "ブレスト",
    description: "中央テーマ＋付箋4枚",
    elements: [
      {
        type: "text",
        payload: { text: "テーマをここに", x: 380, y: 280, fontSize: 22, color: "#1A1A1A" },
      },
      {
        type: "note",
        payload: { text: "アイデア1", x: 120, y: 120, w: 160, h: 120, color: "#FEF08A" },
      },
      {
        type: "note",
        payload: { text: "アイデア2", x: 620, y: 120, w: 160, h: 120, color: "#BBF7D0" },
      },
      {
        type: "note",
        payload: { text: "アイデア3", x: 120, y: 420, w: 160, h: 120, color: "#BFDBFE" },
      },
      {
        type: "note",
        payload: { text: "アイデア4", x: 620, y: 420, w: 160, h: 120, color: "#FBCFE8" },
      },
    ],
  },
  {
    id: "three-columns",
    label: "3列ボード",
    description: "やること・進行中・完了",
    elements: [
      {
        type: "shape",
        payload: { shape: "rect", x: 80, y: 80, w: 220, h: 480, color: "#E5E7EB", fill: "#FAFAFA" },
      },
      {
        type: "shape",
        payload: { shape: "rect", x: 340, y: 80, w: 220, h: 480, color: "#E5E7EB", fill: "#FAFAFA" },
      },
      {
        type: "shape",
        payload: { shape: "rect", x: 600, y: 80, w: 220, h: 480, color: "#E5E7EB", fill: "#FAFAFA" },
      },
      {
        type: "text",
        payload: { text: "やること", x: 140, y: 100, fontSize: 18, color: "#374151" },
      },
      {
        type: "text",
        payload: { text: "進行中", x: 400, y: 100, fontSize: 18, color: "#374151" },
      },
      {
        type: "text",
        payload: { text: "完了", x: 680, y: 100, fontSize: 18, color: "#374151" },
      },
    ],
  },
  {
    id: "mindmap",
    label: "マインドマップ",
    description: "中心から枝分かれ",
    elements: [
      {
        type: "shape",
        payload: { shape: "circle", x: 360, y: 260, w: 160, h: 160, color: "#5E6AD2", fill: "#EEF2FF" },
      },
      {
        type: "text",
        payload: { text: "中心テーマ", x: 395, y: 330, fontSize: 16, color: "#1A1A1A" },
      },
      {
        type: "shape",
        payload: { shape: "arrow", x: 520, y: 340, w: 120, h: 0, color: "#6B7280" },
      },
      {
        type: "note",
        payload: { text: "枝1", x: 660, y: 300, w: 140, h: 90, color: "#FEF08A" },
      },
      {
        type: "shape",
        payload: { shape: "arrow", x: 300, y: 340, w: -120, h: 0, color: "#6B7280" },
      },
      {
        type: "note",
        payload: { text: "枝2", x: 100, y: 300, w: 140, h: 90, color: "#BBF7D0" },
      },
    ],
  },
];

export function viewportStorageKey(projectId: string) {
  return `moni-wb-view:${projectId}`;
}

export function loadViewport(projectId: string): WhiteboardViewport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(viewportStorageKey(projectId));
    if (!raw) return null;
    const v = JSON.parse(raw) as WhiteboardViewport;
    if (typeof v.panX === "number" && typeof v.panY === "number" && typeof v.zoom === "number") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function saveViewport(projectId: string, v: WhiteboardViewport) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(viewportStorageKey(projectId), JSON.stringify(v));
  } catch {
    /* ignore */
  }
}
