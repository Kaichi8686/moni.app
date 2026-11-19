"use client";

import {
  useEffect,
  useLayoutEffect,
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
  Bold,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Circle,
  Crop,
  Eraser,
  Image as ImageIcon,
  Italic,
  Minus,
  MousePointer2,
  PenLine,
  Plus,
  Redo2,
  Shapes,
  Square,
  StickyNote,
  Triangle,
  Type,
  Trash2,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  applyInlineFormat,
  defaultSheetTextStyle,
  edgePoint,
  isBoardNode,
  newBoardId,
  nextZ,
  penBounds,
  penToPath,
  placeCaretAtEnd,
  plainTextFromRichHtml,
  queryInlineFormatState,
  richHtmlForTextBox,
  sanitizeRichHtml,
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
  /** カード編集中のシートIDを sessionStorage に覚えるキー */
  storageKey?: string;
};

/** iOS などでキーボードが開いているとみなす閾値（px） */
const KEYBOARD_OPEN_PX = 120;
/** 開閉アニメ中のチラつきで編集が終わるのを防ぐ */
const KEYBOARD_CLOSE_DEBOUNCE_MS = 520;
/** フォーカス中・VV が曖昧なときの閉じ debounce（中間イベント耐性） */
const KEYBOARD_CLOSE_DEBOUNCE_FOCUSED_MS = 720;
/** フォーカス中でも VV がはっきり全高なら短い debounce（赤い閉じの即応） */
const KEYBOARD_CLOSE_DEBOUNCE_CLEAR_MS = 120;
/** キーボード上昇が終わってから書式バーを出す（上昇中マウントのピョコ付きを防ぐ） */
const KEYBOARD_SETTLE_MS = 260;
/** open=false 直後に VV がまだ残っているときだけ待つ（下降アニメ） */
const KEYBOARD_CLOSE_SETTLE_MS = 160;
/** キーボード下降直後は配置用ダブルタップを無視（閉じ操作のタップで新規テキストが開くのを防ぐ） */
const PLACE_TEXT_DBLTAP_IGNORE_AFTER_KB_MS = 600;
/** 書式バー操作直後は誤閉じでバーが消えないようにする */
const FORMAT_BAR_GUARD_MS = 4000;
/** 用紙エディタのピンチ拡大（作業スペースと同じ translate + scale） */
const SHEET_CARD_MIN_ZOOM = 0.5;
const SHEET_CARD_MAX_ZOOM = 5;

/** 書式バー連打中に visualViewport がチラついてもキーボード open を落とさない */
let visualKeyboardHoldOpenUntil = 0;
function holdVisualKeyboardOpen(ms = FORMAT_BAR_GUARD_MS) {
  visualKeyboardHoldOpenUntil = Math.max(visualKeyboardHoldOpenUntil, Date.now() + ms);
}
function visualKeyboardHoldOpenActive() {
  return Date.now() < visualKeyboardHoldOpenUntil;
}

/** visualViewport がまだキーボード相当に潰れているか（誤閉じ判定用） */
function keyboardStillCovering() {
  if (typeof window === "undefined") return false;
  const vv = window.visualViewport;
  if (!vv) return false;
  const covered = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  return covered > 80 || vv.height < window.innerHeight - 100;
}

function isIOSLikeUa() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * inset + open + settled。
 * open は visualViewport の縮みで判定（フォーカスだけでは不可）。
 * settled は開いてから一度だけ立ち、上昇アニメ中は書式バーを出さない。
 * iOS の fixed は VV 基準 → bottom:0 がキーボード直上。
 */
function useVisualKeyboard() {
  const [inset, setInset] = useState(0);
  const [open, setOpen] = useState(false);
  const [settled, setSettled] = useState(false);
  const iosLike = useSyncExternalStore(
    () => () => {},
    () => isIOSLikeUa(),
    () => false,
  );
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let closeTimer: ReturnType<typeof setTimeout> | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let settledOnce = false;
    let editableFocused = false;
    /** キーボード閉じとみなしているあいだの最大 VV 高さ */
    let closedBaseline = vv.height;
    /** 開いているあいだの最大 inset（カード持ち上げの上下バウンス防止） */
    let peakInset = 0;
    /** dev プレビュー用: デスクトップでキーボード inset を模す */
    let demoInset: number | null = null;
    const isEditable = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "TEXTAREA" || el.isContentEditable) return true;
      if (tag !== "INPUT") return false;
      const type = (el as HTMLInputElement).type || "text";
      return !["button", "checkbox", "radio", "file", "submit", "reset", "range", "color", "hidden"].includes(type);
    };
    const measureInset = () => {
      if (demoInset != null) return demoInset;
      return Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    };
    const measureOpen = () => {
      if (demoInset != null) return demoInset >= KEYBOARD_OPEN_PX;
      const h = vv.height;
      const covered = measureInset();
      // フォーカス無しで VV がほぼ全高 → 閉じ
      if (!editableFocused) {
        return false;
      }
      // フォーカス中は「ほぼ全高」だけで閉じない（iOS は開閉中に中間 VV を吐く）
      // 明確に潰れているときだけ open
      if (h > closedBaseline) closedBaseline = h;
      return closedBaseline - h > KEYBOARD_OPEN_PX || covered > KEYBOARD_OPEN_PX;
    };
    const confirmClosed = () => {
      // 書式バー連打中は open を落とさない（キーボードが一瞬消えて戻るのを防ぐ）
      if (visualKeyboardHoldOpenActive()) {
        setOpen(true);
        if (peakInset > 0) setInset(peakInset);
        return;
      }
      peakInset = 0;
      settledOnce = false;
      if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }
      setSettled(false);
      setOpen(false);
      setInset(measureInset());
    };
    const update = () => {
      const next = measureInset();
      const isOpen = measureOpen();
      if (isOpen || (visualKeyboardHoldOpenActive() && peakInset > 0)) {
        peakInset = Math.max(peakInset, next, visualKeyboardHoldOpenActive() ? peakInset : 0);
        // 持ち上げ量は上方向だけ追従（一瞬大きくなって戻るピョコを防ぐ）
        setInset(peakInset);
        if (closeTimer) {
          clearTimeout(closeTimer);
          closeTimer = null;
        }
        setOpen(true);
        if (!settledOnce && !settleTimer) {
          settleTimer = setTimeout(() => {
            settleTimer = null;
            if (measureOpen() || visualKeyboardHoldOpenActive()) {
              settledOnce = true;
              setSettled(true);
            }
          }, KEYBOARD_SETTLE_MS);
        }
        return;
      }
      // フォーカス中かつ VV がまだキーボードで潰れているなら「開いたまま」
      if (editableFocused) {
        const covered = next;
        if (covered > 60 || vv.height < window.innerHeight - 80) {
          peakInset = Math.max(peakInset, covered);
          setInset(peakInset || covered);
          if (closeTimer) {
            clearTimeout(closeTimer);
            closeTimer = null;
          }
          setOpen(true);
          return;
        }
      }
      // VV の一瞬の揺れでは peak / settled を落とさない
      if (!editableFocused) {
        closedBaseline = Math.max(closedBaseline, vv.height);
      } else if (vv.height > closedBaseline) {
        closedBaseline = vv.height;
      }
      if (closeTimer) return;
      // はっきり閉じているなら短く、曖昧なら長く待つ（赤い閉じは即 open=false へ）
      const clearlyClosed =
        next < 40 && vv.height >= window.innerHeight - 60;
      const debounceMs = !editableFocused
        ? KEYBOARD_CLOSE_DEBOUNCE_MS
        : clearlyClosed
          ? KEYBOARD_CLOSE_DEBOUNCE_CLEAR_MS
          : KEYBOARD_CLOSE_DEBOUNCE_FOCUSED_MS;
      closeTimer = setTimeout(() => {
        closeTimer = null;
        if (visualKeyboardHoldOpenActive()) {
          setOpen(true);
          if (peakInset > 0) setInset(peakInset);
          return;
        }
        if (editableFocused) {
          const covered = measureInset();
          // フォーカス中ははっきり閉じたときだけ（中間イベントで落とさない）
          if (covered > 40 || vv.height < window.innerHeight - 60) {
            setOpen(true);
            return;
          }
        }
        if (!measureOpen()) confirmClosed();
      }, debounceMs);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!isEditable(event.target)) return;
      editableFocused = true;
      closedBaseline = Math.max(closedBaseline, vv.height);
      window.setTimeout(update, 120);
      window.setTimeout(update, 320);
    };
    const onFocusOut = () => {
      window.setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        // 書式バー操作で一瞬フォーカスが外れる／ボタン側に移る → 開いたまま扱う
        if (
          visualKeyboardHoldOpenActive() ||
          active?.closest?.("[data-text-format-bar]")
        ) {
          editableFocused = true;
          if (closeTimer) {
            clearTimeout(closeTimer);
            closeTimer = null;
          }
          setOpen(true);
          if (peakInset > 0) setInset(peakInset);
          return;
        }
        editableFocused = isEditable(active);
        if (!editableFocused) closedBaseline = Math.max(closedBaseline, vv.height);
        update();
      }, 120);
    };
    const onOrientation = () => {
      closedBaseline = vv.height;
      peakInset = 0;
      settledOnce = false;
      setSettled(false);
      setOpen(false);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", onOrientation);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    if (process.env.NODE_ENV !== "production") {
      (window as Window & { __moniSetKbDemo?: (inset: number | null) => void }).__moniSetKbDemo = (inset) => {
        demoInset = inset == null ? null : Math.max(0, Math.round(inset));
        peakInset = 0;
        settledOnce = false;
        setSettled(false);
        if (settleTimer) {
          clearTimeout(settleTimer);
          settleTimer = null;
        }
        if (closeTimer) {
          clearTimeout(closeTimer);
          closeTimer = null;
        }
        update();
      };
    }
    return () => {
      if (closeTimer) clearTimeout(closeTimer);
      if (settleTimer) clearTimeout(settleTimer);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", onOrientation);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      if (process.env.NODE_ENV !== "production") {
        delete (window as Window & { __moniSetKbDemo?: (inset: number | null) => void }).__moniSetKbDemo;
      }
    };
  }, []);
  return {
    inset,
    open,
    /** キーボード上昇後に一度だけ true。書式バーはこれで出してピョコ付きを防ぐ */
    settled,
    iosLike,
    /**
     * キーボード直上。
     * - iOS: fixed が VV 基準なので bottom:0
     * - その他: layout 基準なので inset で持ち上げる
     */
    dockStyle: {
      position: "fixed" as const,
      left: 0,
      right: 0,
      top: "auto" as const,
      bottom: iosLike ? 0 : inset,
      // シート全画面 chrome (z≈600) より上。キーボード直上で必ず見えるようにする
      zIndex: 8000,
      transition: "none",
    } satisfies CSSProperties,
  };
}

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
  storageKey,
}: Props) {
  const { tx, locale } = useI18n();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const textEditRef = useRef<HTMLDivElement | null>(null);
  const [workspaceInlineFormat, setWorkspaceInlineFormat] = useState({
    bold: false,
    italic: false,
    underline: false,
  });
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
  const [openSheetId, setOpenSheetId] = useState<string | null>(() => {
    if (!storageKey || typeof window === "undefined") return null;
    try {
      const raw = window.sessionStorage.getItem(`moni:ws-open-sheet:${storageKey}`);
      return raw && raw.trim() ? raw.trim() : null;
    } catch {
      return null;
    }
  });
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

  // iOS 長押しの「コピー / Google で検索」を抑止
  useEffect(() => {
    const shell = shellRef.current;
    const root = rootRef.current;
    if (!shell && !root) return;
    const block = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("textarea, input, [contenteditable='true']")) return;
      event.preventDefault();
    };
    const nodes = [shell, root].filter(Boolean) as HTMLElement[];
    for (const node of nodes) {
      node.addEventListener("selectstart", block);
      node.addEventListener("dragstart", block);
    }
    return () => {
      for (const node of nodes) {
        node.removeEventListener("selectstart", block);
        node.removeEventListener("dragstart", block);
      }
    };
  }, []);

  // カード編集中のシートを記憶（他サイト／他画面から戻ったとき復元）
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      const key = `moni:ws-open-sheet:${storageKey}`;
      if (openSheetId) window.sessionStorage.setItem(key, openSheetId);
      else window.sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }, [openSheetId, storageKey]);

  // 記憶したシートがボードから消えていたらクリア
  // ※ボード未ロード（items 空）の瞬間に消すと、復帰時にカード編集が復元できない
  useEffect(() => {
    if (!openSheetId) return;
    if (board.items.length === 0) return;
    const exists = board.items.some((item) => item.kind === "sheet" && item.id === openSheetId);
    if (!exists) setOpenSheetId(null);
  }, [board.items, openSheetId]);

  // 他サイトから戻ったとき・ボードが後から載ったときにカード編集を再開
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    const key = `moni:ws-open-sheet:${storageKey}`;
    const restore = () => {
      if (openSheetId) return;
      try {
        const raw = window.sessionStorage.getItem(key)?.trim();
        if (!raw) return;
        if (!boardRef.current.items.some((item) => item.kind === "sheet" && item.id === raw)) return;
        setOpenSheetId(raw);
      } catch {
        /* ignore */
      }
    };
    restore();
    const onShow = () => {
      if (document.visibilityState === "visible") restore();
    };
    window.addEventListener("pageshow", restore);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.removeEventListener("pageshow", restore);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [storageKey, openSheetId, board.items]);

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

  /** 切り取り確定：見える領域の形に枠を合わせ、crop を合成する */
  function commitImageCrop(imageId: string, draft: BoardImageCrop) {
    const image = boardRef.current.items.find((item): item is BoardImage => item.kind === "image" && item.id === imageId);
    if (!image) {
      setCropImageId(null);
      setCropDraft(null);
      cropDraftRef.current = null;
      return;
    }
    const prev = image.crop ?? FULL_CROP;
    const nextCrop: BoardImageCrop = {
      x: prev.x + draft.x * prev.w,
      y: prev.y + draft.y * prev.h,
      w: Math.min(prev.w, Math.max(0.08, draft.w * prev.w)),
      h: Math.min(prev.h, Math.max(0.08, draft.h * prev.h)),
    };
    updateItem(imageId, {
      crop: nextCrop,
      x: image.x + image.w * draft.x,
      y: image.y + image.h * draft.y,
      w: Math.max(16, image.w * draft.w),
      h: Math.max(16, image.h * draft.h),
    });
    setCropImageId(null);
    setCropDraft(null);
    cropDraftRef.current = null;
    setHandlesVisible(false);
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

    // 切り取り中に写真以外をタップ → 確定（枠を切り取り形に合わせる）
    if (cropImageId) {
      commitImageCrop(cropImageId, cropDraftRef.current ?? FULL_CROP);
      return;
    }

    // プラス展開中（ツール未選択）にキャンバスをタップ → 最初の挿入バーに戻す
    if (plusMenuOpen) {
      setPlusMenuOpen(false);
      if (tool === "navigate" || tool === "select") {
        selectTool("navigate");
        setSelectedId(null);
        setEditingTextId(null);
        return;
      }
      // カード/テキスト/図形ツール選択済みなら配置処理へ続く
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
      beginWorkspaceTextEdit(box.id);
      setHandlesVisible(false);
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
    setPlusMenuOpen(false);

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
        // ダブルタップ：文字入力
        setSelectedIds([node.id]);
        setHandlesVisible(false);
        beginWorkspaceTextEdit(node.id);
        return;
      }
      // その他：ダブルタップで大きさ調整ハンドル
      setSelectedIds([node.id]);
      setHandlesVisible(true);
      return;
    }

    if (node.kind === "sheet") {
      setOpenSheetId(node.id);
      return;
    }
    if (node.kind === "text") {
      // ワンタップ：黄色選択のみ。大きさ調整は長押し
      setSelectedIds([node.id]);
      setHandlesVisible(false);
      setEditingTextId(null);
      return;
    }
    // 画像・図形：ワンタップは選択のみ。ハンドルは長押し / ダブルタップ
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
  const editingTextBox = editingTextId
    ? board.items.find((item): item is BoardTextBox => item.kind === "text" && item.id === editingTextId) ?? null
    : null;
  // 写真選択中は切り取りバーを出す（ハンドル表示前でも）
  const showInsertBar = !insertToolbarHidden && !selectedImage;
  // プラス展開：カード / テキスト / 図形 / 矢印（写真はトップバー）
  const insertFanOpen = plusMenuOpen || tool === "sheet" || tool === "text" || tool === "shape";

  const keyboard = useVisualKeyboard();
  const workspaceKeyboardOpenRef = useRef(keyboard.open);
  workspaceKeyboardOpenRef.current = keyboard.open;
  /** 編集中は書式バーを出す。キーボード閉じで編集終了したとき一緒に消える。 */
  const showWorkspaceFormatBar = Boolean(
    editingTextBox && canEdit && !toolbarHidden && toolbarMounted,
  );

  const editingTextIdRef = useRef<string | null>(null);
  editingTextIdRef.current = editingTextId;

  function beginWorkspaceTextEdit(id: string) {
    setEditingTextId(id);
  }

  function keepWorkspaceTextFocus() {
    const el = textEditRef.current;
    if (!el) return;
    // 既にフォーカス中の focus() は iOS でキーボードが一瞬消える
    if (document.activeElement === el) return;
    el.focus({ preventScroll: true });
  }

  const workspaceFormatBarGuardRef = useRef(0);
  function touchWorkspaceFormatBar() {
    workspaceFormatBarGuardRef.current = Date.now();
    holdVisualKeyboardOpen();
    keepWorkspaceTextFocus();
  }
  function workspaceFormatBarGuarding() {
    return Date.now() - workspaceFormatBarGuardRef.current < FORMAT_BAR_GUARD_MS;
  }

  function finishWorkspaceTextEdit() {
    const id = editingTextIdRef.current;
    setEditingTextId(null);
    textEditRef.current?.blur();
    if (!id) return;
    const box = boardRef.current.items.find((item): item is BoardTextBox => item.kind === "text" && item.id === id);
    if (box && !box.text.trim()) {
      commit(boardRef.current.items.filter((item) => item.id !== id));
      setSelectedIds((ids) => ids.filter((x) => x !== id));
      setHandlesVisible(false);
    }
  }

  // autoFocus は iOS で scrollIntoView → キーボード即閉じの原因になるので preventScroll で当てる
  // 既存テキストはキャレットを末尾へ（左端から始まらないように）
  useLayoutEffect(() => {
    if (!editingTextId) return;
    const el = textEditRef.current;
    if (!el) return;
    const box = boardRef.current.items.find(
      (item): item is BoardTextBox => item.kind === "text" && item.id === editingTextId,
    );
    el.innerHTML = box ? richHtmlForTextBox(box) : "";
    el.focus({ preventScroll: true });
    placeCaretAtEnd(el);
    setWorkspaceInlineFormat(queryInlineFormatState());
  }, [editingTextId]);

  useEffect(() => {
    if (!editingTextId) return;
    const sync = () => setWorkspaceInlineFormat(queryInlineFormatState());
    document.addEventListener("selectionchange", sync);
    return () => document.removeEventListener("selectionchange", sync);
  }, [editingTextId]);

  // iOS キーボード閉じボタン → すぐ編集終了（完了／挿入復帰）。チラつきは covering で弾く。
  const workspaceKeyboardWasOpenRef = useRef(false);
  useEffect(() => {
    if (!editingTextId) {
      workspaceKeyboardWasOpenRef.current = false;
      return;
    }
    if (keyboard.open) {
      workspaceKeyboardWasOpenRef.current = true;
      return;
    }
    if (!workspaceKeyboardWasOpenRef.current) return;
    workspaceKeyboardWasOpenRef.current = false;
    const editId = editingTextId;
    let cancelled = false;
    const closeTimers: number[] = [];
    const tryFinish = () => {
      if (cancelled || editingTextIdRef.current !== editId) return;
      if (workspaceFormatBarGuarding()) {
        workspaceKeyboardWasOpenRef.current = true;
        keepWorkspaceTextFocus();
        return;
      }
      if (workspaceKeyboardOpenRef.current || keyboardStillCovering()) {
        workspaceKeyboardWasOpenRef.current = true;
        keepWorkspaceTextFocus();
        return;
      }
      finishWorkspaceTextEdit();
    };
    // VV がすでに全高＝本当の閉じ → 即 chrome 復帰。下降中だけ短く待つ。
    if (!keyboardStillCovering()) {
      tryFinish();
    } else {
      closeTimers.push(window.setTimeout(tryFinish, KEYBOARD_CLOSE_SETTLE_MS));
    }
    return () => {
      cancelled = true;
      for (const t of closeTimers) window.clearTimeout(t);
      if (workspaceKeyboardOpenRef.current || workspaceFormatBarGuarding()) {
        workspaceKeyboardWasOpenRef.current = true;
      }
    };
  }, [keyboard.open, editingTextId]);

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
    <div
      ref={shellRef}
      className={shellClass}
      style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        ref={rootRef}
        id="issue-workspace-canvas-surface"
        className={`absolute inset-0 touch-none overflow-hidden select-none ${
          crosshairTool ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"
        }`}
        style={{
          backgroundColor: "#F4F4F5",
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(161,161,170,0.35) 1px, transparent 0)",
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${viewPan.x}px ${viewPan.y}px`,
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
        onContextMenu={(event) => event.preventDefault()}
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
                      {node.overlays?.some((o) => o.kind === "text" && o.text.trim())
                        ? ""
                        : node.text.trim()}
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
              const hasRich = Boolean(node.html);
              const textStyle: CSSProperties = {
                color: node.textColor,
                textAlign: node.align,
                fontSize: node.fontSize,
                fontWeight: hasRich ? undefined : node.bold ? 700 : 400,
                fontStyle: hasRich ? undefined : node.italic ? "italic" : "normal",
                textDecoration: hasRich ? undefined : node.underline ? "underline" : "none",
              };
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
                    border:
                      editing || selected
                        ? `1.5px solid ${SELECTION_YELLOW}`
                        : "1px solid rgba(0,0,0,0.28)",
                    background: "transparent",
                    WebkitUserSelect: editing ? "text" : "none",
                    WebkitTouchCallout: "none",
                    userSelect: editing ? "text" : "none",
                    ...selectionStyle,
                  }}
                  onContextMenu={(event) => event.preventDefault()}
                  onPointerDown={(event) => onNodePointerDown(event, node)}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    if (!canEdit) return;
                    setSelectedIds([node.id]);
                    setHandlesVisible(false);
                    beginWorkspaceTextEdit(node.id);
                  }}
                >
                  {editing && canEdit ? (
                      <div
                        ref={textEditRef}
                        data-board-ui
                        contentEditable
                        suppressContentEditableWarning
                        role="textbox"
                        aria-multiline
                        onInput={() => {
                          const el = textEditRef.current;
                          if (!el) return;
                          const html = sanitizeRichHtml(el.innerHTML);
                          const text = plainTextFromRichHtml(html);
                          updateItem(node.id, { text, html });
                          setWorkspaceInlineFormat(queryInlineFormatState());
                        }}
                        onBlur={() => {
                          window.setTimeout(() => {
                            if (!editingTextIdRef.current) return;
                            const active = document.activeElement as HTMLElement | null;
                            if (active === textEditRef.current) return;
                            if (active?.closest("[data-text-format-bar]")) return;
                            if (
                              workspaceFormatBarGuarding() ||
                              workspaceKeyboardOpenRef.current ||
                              keyboardStillCovering()
                            ) {
                              keepWorkspaceTextFocus();
                            }
                          }, 40);
                        }}
                        className="h-full w-full bg-transparent px-1 py-0.5 outline-none"
                        style={textStyle}
                        onPointerDown={(e) => e.stopPropagation()}
                      />
                  ) : (
                    <div
                      className="h-full w-full select-none whitespace-pre-wrap px-1 py-0.5"
                      style={{
                        ...textStyle,
                        WebkitUserSelect: "none",
                        WebkitTouchCallout: "none",
                        userSelect: "none",
                      }}
                      {...(hasRich
                        ? { dangerouslySetInnerHTML: { __html: richHtmlForTextBox(node) } }
                        : {})}
                    >
                      {!hasRich
                        ? node.text || <span className="text-zinc-400">{tx("テキスト", "Text")}</span>
                        : null}
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
            const sourceCrop = image.crop ?? FULL_CROP;
            const draft = cropping && cropDraft ? cropDraft : FULL_CROP;
            const sourceImgStyle: CSSProperties = {
              width: `${100 / Math.max(0.08, sourceCrop.w)}%`,
              height: `${100 / Math.max(0.08, sourceCrop.h)}%`,
              left: `${(-sourceCrop.x / Math.max(0.08, sourceCrop.w)) * 100}%`,
              top: `${(-sourceCrop.y / Math.max(0.08, sourceCrop.h)) * 100}%`,
              maxWidth: "none",
            };
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
                      {/* いま見えている写真を基準に切り取り。確定後は枠もこの形になる */}
                      <div className="absolute inset-0 overflow-hidden rounded-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.url}
                          alt=""
                          className="pointer-events-none absolute select-none opacity-35"
                          draggable={false}
                          style={sourceImgStyle}
                        />
                        <div
                          className="absolute overflow-hidden"
                          style={{
                            left: `${draft.x * 100}%`,
                            top: `${draft.y * 100}%`,
                            width: `${draft.w * 100}%`,
                            height: `${draft.h * 100}%`,
                            boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
                            outline: "1.5px dashed #2563EB",
                            outlineOffset: 0,
                          }}
                          onPointerDown={(event) => beginCropAdjust(event, node.id, "move", draft)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image.url}
                            alt=""
                            className="pointer-events-none absolute select-none"
                            draggable={false}
                            style={{
                              width: `${100 / Math.max(0.08, sourceCrop.w * draft.w)}%`,
                              height: `${100 / Math.max(0.08, sourceCrop.h * draft.h)}%`,
                              left: `${(-(sourceCrop.x + draft.x * sourceCrop.w) / Math.max(0.08, sourceCrop.w * draft.w)) * 100}%`,
                              top: `${(-(sourceCrop.y + draft.y * sourceCrop.h) / Math.max(0.08, sourceCrop.h * draft.h)) * 100}%`,
                              maxWidth: "none",
                            }}
                          />
                        </div>
                      </div>
                      {RESIZE_HANDLES.map((handle) => {
                        const left = handle.includes("w")
                          ? draft.x
                          : handle.includes("e")
                            ? draft.x + draft.w
                            : draft.x + draft.w / 2;
                        const top = handle.includes("n")
                          ? draft.y
                          : handle.includes("s")
                            ? draft.y + draft.h
                            : draft.y + draft.h / 2;
                        return (
                          <div
                            key={handle}
                            role="button"
                            tabIndex={0}
                            data-board-ui
                            aria-label={tx("切り取り枠", "Crop frame")}
                            className="absolute z-30 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border-2 border-[#2563EB] bg-white shadow-sm"
                            style={{ left: `${left * 100}%`, top: `${top * 100}%`, cursor: handleCursor(handle) }}
                            onPointerDown={(event) => beginCropAdjust(event, node.id, handle, draft)}
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
                          ? sourceImgStyle
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

              {/* キーボードが開いた瞬間に直上へ（追従スライドなし） */}
              {showWorkspaceFormatBar
                ? createPortal(
                    <div className="pointer-events-none" style={keyboard.dockStyle}>
                      <SlidesTextFormatBar
                        fontSize={editingTextBox!.fontSize}
                        textColor={editingTextBox!.textColor}
                        align={editingTextBox!.align}
                        bold={workspaceInlineFormat.bold}
                        italic={workspaceInlineFormat.italic}
                        underline={workspaceInlineFormat.underline}
                        tx={tx}
                        onChange={(patch) => updateItem(editingTextBox!.id, patch)}
                        onInlineFormat={(command, value) => {
                          touchWorkspaceFormatBar();
                          keepWorkspaceTextFocus();
                          applyInlineFormat(command, value);
                          const el = textEditRef.current;
                          if (el) {
                            const html = sanitizeRichHtml(el.innerHTML);
                            const text = plainTextFromRichHtml(html);
                            updateItem(editingTextBox!.id, {
                              text,
                              html,
                              ...(command === "foreColor" && value ? { textColor: value } : {}),
                            });
                          }
                          setWorkspaceInlineFormat(queryInlineFormatState());
                          window.requestAnimationFrame(() => keepWorkspaceTextFocus());
                        }}
                        onKeepFocus={keepWorkspaceTextFocus}
                        onInteract={touchWorkspaceFormatBar}
                      />
                    </div>,
                    document.body,
                  )
                : null}

              {/* 下のフローティング操作バー */}
              <div
                className={`pointer-events-none fixed inset-x-0 bottom-0 z-[500] flex flex-col items-center gap-2 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] transition-transform duration-200 ease-out ${
                  toolbarHidden || editingTextId ? "translate-y-[120%]" : "translate-y-0"
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
                            active={false}
                            label={tx("戻る", "Back")}
                            icon={ChevronLeft}
                            disabled={!canEdit}
                            onClick={() => {
                              setPlusMenuOpen(false);
                              setShapePickerOpen(false);
                              selectTool("navigate");
                            }}
                          />
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
                          <PillIconButton
                            active={tool === "shape"}
                            label={tx("図形", "Shape")}
                            icon={Shapes}
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
                          />
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
                            active={false}
                            label={uploading ? tx("追加中", "Adding") : tx("写真", "Photo")}
                            icon={ImageIcon}
                            disabled={!canEdit || Boolean(uploading)}
                            onClick={() => {
                              if (!canEdit) return;
                              setPlusMenuOpen(false);
                              selectTool("navigate");
                              onRequestPhoto();
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
                          // いま見えている写真全体を基準に切り取り（確定時に枠も合わせる）
                          cropDraftRef.current = FULL_CROP;
                          setCropDraft(FULL_CROP);
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
}: {
  sheet: BoardSheet;
  canEdit: boolean;
  uploading?: boolean;
  tx: (ja: string, en: string) => string;
  onClose: () => void;
  onPatch: (patch: Partial<BoardSheet>) => void;
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
  /** 作業スペースと同じ：translate + scale で好きな位置を拡大・パン */
  const [cardZoom, setCardZoom] = useState(1);
  const cardZoomRef = useRef(1);
  cardZoomRef.current = cardZoom;
  const [sheetPan, setSheetPan] = useState({ x: 0, y: 0 });
  const sheetPanRef = useRef(sheetPan);
  sheetPanRef.current = sheetPan;
  const sheetPinchRef = useRef<{
    dist: number;
    zoom: number;
    panX: number;
    panY: number;
    midX: number;
    midY: number;
  } | null>(null);
  const sheetPanDragRef = useRef<{
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const sheetPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  /** null = 何も選ばない（初期・同じボタン再押しで解除） */
  const [editTool, setEditTool] = useState<SheetEditTool | null>(null);
  const [shapeKind, setShapeKind] = useState<BoardShapeKind>("rect");
  const [shapeColor, setShapeColor] = useState<string>(SHAPE_COLORS[0]!);
  const [penColor, setPenColor] = useState("#1A1A1A");
  const [penEraser, setPenEraser] = useState(false);
  const [selectedOverlayIds, setSelectedOverlayIds] = useState<string[]>([]);
  const selectedOverlayId = selectedOverlayIds[0] ?? null;
  const [editingOverlayId, setEditingOverlayId] = useState<string | null>(null);
  const [overlayHandlesVisible, setOverlayHandlesVisible] = useState(false);
  const overlayTextRef = useRef<HTMLDivElement | null>(null);
  const [overlayInlineFormat, setOverlayInlineFormat] = useState({
    bold: false,
    italic: false,
    underline: false,
  });
  const keyboard = useVisualKeyboard();
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
  const lastOverlayTap = useRef<{ id: string; t: number; x: number; y: number } | null>(null);
  const overlayLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayLongPressFiredRef = useRef(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const overlays = sheet.overlays ?? [];
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;
  const selectedOverlay = overlays.find((o) => o.id === selectedOverlayId) ?? null;

  /**
   * 編集中は書式バーを出す（open チラつきでアンマウントしない）。
   * キーボード閉じ確定 → 編集終了で消え、完了／挿入が戻る。
   */
  const overlayKeyboardOpenRef = useRef(keyboard.open);
  overlayKeyboardOpenRef.current = keyboard.open;
  const editingOverlayText = (() => {
    if (!editingOverlayId) return null;
    const ov = overlays.find((o) => o.id === editingOverlayId);
    return ov && ov.kind === "text" ? ov : null;
  })();
  const showOverlayFormatBar = Boolean(canEdit && editingOverlayText);

  const editingOverlayIdRef = useRef<string | null>(null);
  editingOverlayIdRef.current = editingOverlayId;

  const placeTextDblTapArmedUntilRef = useRef(0);
  const keyboardWasOpenForPlaceRef = useRef(false);

  function beginOverlayTextEdit(id: string) {
    // 配置／編集開始の直後に残った 1 打目でダブルタップ判定しない
    lastTap.current = null;
    setEditingOverlayId(id);
  }

  function keepOverlayTextFocus() {
    const el = overlayTextRef.current;
    if (!el) return;
    // 既にフォーカス中の focus() は iOS でキーボードが一瞬消える
    if (document.activeElement === el) return;
    el.focus({ preventScroll: true });
  }

  /** 書式バー連打中にキーボード誤閉じ → バー消滅を防ぐ */
  const overlayFormatBarGuardRef = useRef(0);
  const overlayFormatBarPointerDownRef = useRef(false);
  /** サイズ／配置／色は DOM に即反映し、React 更新は指を離してから（再レンダーでキーボードが消えるのを防ぐ） */
  const pendingOverlayStyleRef = useRef<Partial<{ fontSize: number; align: TextAlign; textColor: string }>>({});
  const pendingOverlayHtmlRef = useRef<{ text: string; html: string } | null>(null);
  function touchOverlayFormatBar() {
    overlayFormatBarGuardRef.current = Date.now();
    holdVisualKeyboardOpen(FORMAT_BAR_GUARD_MS);
    keepOverlayTextFocus();
  }
  function overlayFormatBarGuarding() {
    return (
      overlayFormatBarPointerDownRef.current ||
      Date.now() - overlayFormatBarGuardRef.current < FORMAT_BAR_GUARD_MS
    );
  }
  function applyOverlayStyleDom(patch: Partial<{ fontSize: number; align: TextAlign; textColor: string }>) {
    const el = overlayTextRef.current;
    if (!el) return;
    if (typeof patch.fontSize === "number") {
      el.style.fontSize = `${patch.fontSize * 0.55}px`;
    }
    if (patch.align) el.style.textAlign = patch.align;
    if (patch.textColor) el.style.color = patch.textColor;
  }
  function flushPendingOverlayEdits() {
    const id = editingOverlayIdRef.current;
    const pendingStyle = pendingOverlayStyleRef.current;
    const pendingHtml = pendingOverlayHtmlRef.current;
    pendingOverlayStyleRef.current = {};
    pendingOverlayHtmlRef.current = null;
    if (!id) return;
    if (Object.keys(pendingStyle).length === 0 && !pendingHtml) return;
    const next = overlaysRef.current.map((o) => {
      if (o.id !== id) return o;
      return {
        ...o,
        ...pendingStyle,
        ...(pendingHtml ?? {}),
      } as SheetOverlay;
    });
    onPatch({ overlays: next.length > 0 ? next : undefined });
  }

  useLayoutEffect(() => {
    if (!editingOverlayId) return;
    const el = overlayTextRef.current;
    if (!el) return;
    const ov = overlaysRef.current.find((o) => o.id === editingOverlayId);
    el.innerHTML =
      ov && ov.kind === "text" ? richHtmlForTextBox(ov) : "";
    el.focus({ preventScroll: true });
    placeCaretAtEnd(el);
    setOverlayInlineFormat(queryInlineFormatState());
  }, [editingOverlayId]);

  useEffect(() => {
    if (!editingOverlayId) return;
    const sync = () => setOverlayInlineFormat(queryInlineFormatState());
    document.addEventListener("selectionchange", sync);
    return () => document.removeEventListener("selectionchange", sync);
  }, [editingOverlayId]);

  function finishOverlayTextEdit() {
    flushPendingOverlayEdits();
    const id = editingOverlayIdRef.current;
    setEditingOverlayId(null);
    lastTap.current = null;
    placeTextDblTapArmedUntilRef.current = Date.now() + PLACE_TEXT_DBLTAP_IGNORE_AFTER_KB_MS;
    overlayTextRef.current?.blur();
    if (!id) return;
    const ov = overlaysRef.current.find((o) => o.id === id);
    if (ov?.kind === "text" && !ov.text.trim()) {
      const next = overlaysRef.current.filter((o) => o.id !== id);
      onPatch({ overlays: next.length > 0 ? next : undefined });
      setSelectedOverlayIds((ids) => ids.filter((x) => x !== id));
      setOverlayHandlesVisible(false);
    }
  }

  /** 編集中・キーボード表示中・下降直後は「置く」ダブルタップを無効化 */
  function placeTextDblTapAllowed() {
    if (editingOverlayId || keyboard.open) return false;
    if (Date.now() < placeTextDblTapArmedUntilRef.current) return false;
    return true;
  }

  function deleteSelectedOverlays() {
    if (!canEdit || selectedOverlayIds.length === 0) return;
    const drop = new Set(selectedOverlayIds);
    const next = overlaysRef.current.filter((o) => !drop.has(o.id));
    setOverlays(next);
    setSelectedOverlayIds([]);
    setOverlayHandlesVisible(false);
    if (editingOverlayId && drop.has(editingOverlayId)) setEditingOverlayId(null);
  }

  // iOS キーボード閉じボタン → すぐ完了／挿入復帰。チラつきは covering で弾く。
  const overlayKeyboardWasOpenRef = useRef(false);
  useEffect(() => {
    if (keyboard.open) {
      keyboardWasOpenForPlaceRef.current = true;
      lastTap.current = null;
    } else if (keyboardWasOpenForPlaceRef.current) {
      keyboardWasOpenForPlaceRef.current = false;
      lastTap.current = null;
      placeTextDblTapArmedUntilRef.current = Date.now() + PLACE_TEXT_DBLTAP_IGNORE_AFTER_KB_MS;
    }
  }, [keyboard.open]);
  useEffect(() => {
    if (!editingOverlayId) {
      overlayKeyboardWasOpenRef.current = false;
      return;
    }
    if (keyboard.open) {
      overlayKeyboardWasOpenRef.current = true;
      return;
    }
    if (!overlayKeyboardWasOpenRef.current) return;
    const editId = editingOverlayId;
    let cancelled = false;
    const closeTimers: number[] = [];
    const tryFinish = () => {
      if (cancelled || editingOverlayIdRef.current !== editId) return;
      // 書式バー操作中／直後は閉じない。ガード明けに再判定する
      if (overlayFormatBarGuarding() || visualKeyboardHoldOpenActive()) {
        holdVisualKeyboardOpen(FORMAT_BAR_GUARD_MS);
        keepOverlayTextFocus();
        closeTimers.push(window.setTimeout(tryFinish, 400));
        return;
      }
      if (overlayKeyboardOpenRef.current || keyboardStillCovering()) {
        overlayKeyboardWasOpenRef.current = true;
        keepOverlayTextFocus();
        return;
      }
      overlayKeyboardWasOpenRef.current = false;
      // 赤い閉じ → 書式バー消し・完了／挿入をすぐ戻す
      finishOverlayTextEdit();
    };
    // wasOpen は成功するまで立てたまま（チラつきで取りこぼさない）
    closeTimers.push(window.setTimeout(tryFinish, KEYBOARD_CLOSE_SETTLE_MS));
    return () => {
      cancelled = true;
      for (const t of closeTimers) window.clearTimeout(t);
      if (overlayKeyboardOpenRef.current || overlayFormatBarGuarding()) {
        overlayKeyboardWasOpenRef.current = true;
      }
    };
  }, [keyboard.open, editingOverlayId]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = () => {
      // 編集中にカード寸法が変わると iOS がフォーカス中キーボードを切る
      if (editingOverlayIdRef.current) return;
      // 拡大中は基準サイズを凍結
      if (cardZoomRef.current > 1.01) return;
      // 画面に収まる基準サイズ（zoom=1）
      const maxW = Math.max(0, stage.clientWidth - 24);
      const maxH = Math.max(0, stage.clientHeight - 24);
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

  // zoom≈1 のときカードを中央へ（作業スペースの初期配置に相当）
  useEffect(() => {
    if (cardSize.w <= 0 || cardSize.h <= 0) return;
    if (cardZoomRef.current > 1.01) return;
    const stage = stageRef.current;
    if (!stage) return;
    setSheetPan({
      x: (stage.clientWidth - cardSize.w) / 2,
      y: (stage.clientHeight - cardSize.h) / 2,
    });
  }, [cardSize.w, cardSize.h]);

  // 文字編集中はビューを動かさない（transform 変更で iOS キーボードが切れる）

  function clampSheetZoom(z: number) {
    return Math.min(SHEET_CARD_MAX_ZOOM, Math.max(SHEET_CARD_MIN_ZOOM, z));
  }

  function applySheetView(nextZoom: number, nextPan: { x: number; y: number }) {
    const z = clampSheetZoom(nextZoom);
    setCardZoom(z);
    setSheetPan(nextPan);
  }

  function beginSheetPinch() {
    const pts = [...sheetPointersRef.current.values()];
    if (pts.length < 2) return;
    const midX = (pts[0]!.x + pts[1]!.x) / 2;
    const midY = (pts[0]!.y + pts[1]!.y) / 2;
    const rect = stageRef.current?.getBoundingClientRect();
    sheetPinchRef.current = {
      dist: Math.max(1, Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y)),
      zoom: cardZoomRef.current,
      panX: sheetPanRef.current.x,
      panY: sheetPanRef.current.y,
      midX: midX - (rect?.left ?? 0),
      midY: midY - (rect?.top ?? 0),
    };
    sheetPanDragRef.current = null;
    overlayDrag.current = null;
  }

  function updateSheetPinch() {
    const pinch = sheetPinchRef.current;
    const pts = [...sheetPointersRef.current.values()];
    if (!pinch || pts.length < 2) return;
    const rect = stageRef.current?.getBoundingClientRect();
    const midX = (pts[0]!.x + pts[1]!.x) / 2 - (rect?.left ?? 0);
    const midY = (pts[0]!.y + pts[1]!.y) / 2 - (rect?.top ?? 0);
    const dist = Math.max(1, Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y));
    const nextZoom = clampSheetZoom(pinch.zoom * (dist / pinch.dist));
    // ピンチ中心を基準にズーム（作業スペースと同じ）
    const worldX = (pinch.midX - pinch.panX) / pinch.zoom;
    const worldY = (pinch.midY - pinch.panY) / pinch.zoom;
    applySheetView(nextZoom, {
      x: midX - worldX * nextZoom,
      y: midY - worldY * nextZoom,
    });
  }

  /** capture でポインタを拾う（オーバーレイの stopPropagation でもピンチできるように） */
  function onStagePointerDownCapture(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    sheetPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (editingOverlayIdRef.current) return;
    if (sheetPointersRef.current.size >= 2) beginSheetPinch();
  }

  function onStagePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if (editingOverlayIdRef.current) return;
    if (sheetPointersRef.current.size >= 2 || sheetPinchRef.current) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-overlay-node]") || target.closest("[data-overlay-handle]")) return;
    // 挿入ツール未選択時は1本指でパン（作業スペースの掴んで移動）
    if (!editTool) {
      sheetPanDragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        panX: sheetPanRef.current.x,
        panY: sheetPanRef.current.y,
      };
    }
  }

  function onStagePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (sheetPointersRef.current.has(event.pointerId)) {
      sheetPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (editingOverlayIdRef.current) return;
    if (sheetPinchRef.current && sheetPointersRef.current.size >= 2) {
      updateSheetPinch();
      return;
    }
    const drag = sheetPanDragRef.current;
    if (!drag || sheetPointersRef.current.size !== 1) return;
    applySheetView(cardZoomRef.current, {
      x: drag.panX + (event.clientX - drag.startX),
      y: drag.panY + (event.clientY - drag.startY),
    });
  }

  function onStagePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    sheetPointersRef.current.delete(event.pointerId);
    if (sheetPointersRef.current.size < 2) sheetPinchRef.current = null;
    if (sheetPointersRef.current.size === 0) sheetPanDragRef.current = null;
  }

  function onStageWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (editingOverlayIdRef.current) return;
    event.preventDefault();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const midX = event.clientX - rect.left;
    const midY = event.clientY - rect.top;
    const z = cardZoomRef.current;
    const nextZoom = clampSheetZoom(z * (event.deltaY > 0 ? 0.92 : 1.08));
    const worldX = (midX - sheetPanRef.current.x) / z;
    const worldY = (midY - sheetPanRef.current.y) / z;
    applySheetView(nextZoom, {
      x: midX - worldX * nextZoom,
      y: midY - worldY * nextZoom,
    });
  }

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
    // 1つ置いたら挿入ツールの選択を外す
    setEditTool(null);
    beginOverlayTextEdit(id);
  }

  function clearOverlayLongPress() {
    if (overlayLongPressTimer.current) {
      clearTimeout(overlayLongPressTimer.current);
      overlayLongPressTimer.current = null;
    }
  }

  type MovableSheetOverlay = Exclude<SheetOverlay, { kind: "pen" }>;

  /** 作業スペースと同じ：1タップ / ダブルタップ / 長押し */
  function beginOverlayPartPointer(
    event: ReactPointerEvent<Element>,
    ov: MovableSheetOverlay,
    clientX: number,
    clientY: number,
  ) {
    const pt = cardLocalPoint(clientX, clientY);
    setSelectedOverlayIds([ov.id]);
    setEditingOverlayId(null);
    overlayLongPressFiredRef.current = false;
    clearOverlayLongPress();
    overlayLongPressTimer.current = setTimeout(() => {
      overlayLongPressFiredRef.current = true;
      setOverlayHandlesVisible(true);
    }, 420);
    overlayDrag.current = {
      kind: "move-overlay",
      id: ov.id,
      startX: pt.x,
      startY: pt.y,
      origX: ov.x,
      origY: ov.y,
      moved: false,
    };
    (event.currentTarget as HTMLElement | SVGElement).setPointerCapture?.(event.pointerId);
  }

  function finishOverlayPartTap(ov: SheetOverlay, clientX: number, clientY: number) {
    if (overlayLongPressFiredRef.current) {
      setSelectedOverlayIds([ov.id]);
      setOverlayHandlesVisible(ov.kind !== "pen");
      overlayLongPressFiredRef.current = false;
      return;
    }
    const now = Date.now();
    const prev = lastOverlayTap.current;
    const isDouble =
      prev &&
      prev.id === ov.id &&
      now - prev.t < 380 &&
      Math.hypot(clientX - prev.x, clientY - prev.y) < 28;
    lastOverlayTap.current = { id: ov.id, t: now, x: clientX, y: clientY };

    if (isDouble) {
      if (ov.kind === "text") {
        // ダブルタップ：文字入力
        setSelectedOverlayIds([ov.id]);
        setOverlayHandlesVisible(false);
        beginOverlayTextEdit(ov.id);
        return;
      }
      // その他：ダブルタップで大きさ調整ハンドル
      setSelectedOverlayIds([ov.id]);
      setOverlayHandlesVisible(ov.kind !== "pen");
      return;
    }

    setSelectedOverlayIds([ov.id]);
    if (ov.kind === "text") {
      // ワンタップ：黄色選択のみ。大きさ調整は長押し
      setOverlayHandlesVisible(false);
      setEditingOverlayId(null);
      return;
    }
    // 画像・図形・手書き：ワンタップは黄色選択のみ。ハンドルは長押し / ダブルタップ
    setOverlayHandlesVisible(false);
  }

  function onCardPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!canEdit || event.button !== 0) return;
    // ピンチ拡大中は図形描画などを開始しない
    if (sheetPointersRef.current.size > 1 || sheetPinchRef.current) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-overlay-node]") || target.closest("[data-overlay-handle]")) return;

    // 文字編集中はカード余白・背景タップを無視（キーボードを落とさない）
    if (editingOverlayId) return;

    const pt = cardLocalPoint(event.clientX, event.clientY);

    // 余白タップでリサイズモード解除
    clearOverlayLongPress();
    overlayLongPressFiredRef.current = false;

    if (editTool === "text") {
      const now = Date.now();
      const prev = lastTap.current;
      if (placeTextDblTapAllowed() && prev && now - prev.t < 420 && Math.hypot(pt.x - prev.x, pt.y - prev.y) < 8) {
        placeTextAt(pt.x, pt.y);
        lastTap.current = null;
        return;
      }
      if (placeTextDblTapAllowed()) {
        lastTap.current = { t: now, x: pt.x, y: pt.y };
      } else {
        lastTap.current = null;
      }
      setSelectedOverlayIds([]);
      setOverlayHandlesVisible(false);
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
      if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) {
        drag.moved = true;
        clearOverlayLongPress();
      }
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

  function onCardPointerUp(event?: ReactPointerEvent<HTMLDivElement>) {
    const drag = overlayDrag.current;
    overlayDrag.current = null;
    clearOverlayLongPress();
    if (!drag) {
      setOverlayTick((n) => n + 1);
      return;
    }
    if (drag.kind === "move-overlay") {
      if (!drag.moved) {
        const ov = overlaysRef.current.find((o) => o.id === drag.id);
        if (ov) {
          finishOverlayPartTap(ov, event?.clientX ?? 0, event?.clientY ?? 0);
        }
      }
      setOverlayTick((n) => n + 1);
      return;
    }
    if (drag.kind === "resize-overlay") {
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
      // 1つ置いたら挿入ツールの選択を外す
      setEditTool(null);
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

  // iOS は fixed + bottom:0 が visualViewport に追従して縮み、キーボード下にジャンルが透ける。
  // bottom は使わず lvh で覆い、さらに下へ伸ばした作業スペース影で隙間を塞ぐ。
  const workspaceCoverStyle = {
    bottom: "auto" as const,
    height: "100lvh",
    minHeight: "100lvh",
  };
  const workspaceDots = {
    backgroundImage: "radial-gradient(circle, #a1a1aa 1px, transparent 1px)",
    backgroundSize: "18px 18px",
  };

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed left-0 right-0 top-0 z-[599] bg-zinc-200"
        style={{ ...workspaceCoverStyle, height: "160lvh", minHeight: "160lvh", ...workspaceDots }}
      />
      <div
        data-board-ui
        className="fixed left-0 right-0 top-0 z-[600] flex flex-col bg-zinc-200"
        style={workspaceCoverStyle}
        role="dialog"
        aria-modal="true"
        aria-label={tx("用紙を編集", "Edit sheet")}
      >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70" style={workspaceDots} />

      {/*
        作業スペースと同じ：translate + scale で指の位置を中心に拡大・パン。
        編集中はビュー固定。完了／挿入は fixed ポータル。
      */}
      <div
        ref={stageRef}
        className="absolute inset-0 z-10 touch-none overflow-hidden overscroll-none"
        style={{ touchAction: "none" }}
        onPointerDownCapture={onStagePointerDownCapture}
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerUp}
        onPointerCancel={onStagePointerUp}
        onWheel={onStageWheel}
      >
            <div
              className="absolute left-0 top-0 origin-top-left will-change-transform"
              style={{
                width: cardSize.w > 0 ? cardSize.w : undefined,
                height: cardSize.h > 0 ? cardSize.h : undefined,
                transform: `translate(${sheetPan.x}px, ${sheetPan.y}px) scale(${cardZoom})`,
                visibility: cardSize.w > 0 ? "visible" : "hidden",
              }}
            >
            <div
              ref={cardRef}
              data-sheet-card
              className="relative h-full w-full touch-none select-none overflow-visible rounded-2xl"
              style={{
                boxSizing: "border-box",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
                userSelect: "none",
              }}
              onPointerDown={onCardPointerDown}
              onPointerMove={onCardPointerMove}
              onPointerUp={(e) => onCardPointerUp(e)}
              onPointerCancel={(e) => onCardPointerUp(e)}
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
                      return (
                        <g
                          key={ov.id}
                          transform={`translate(${ov.x}, ${ov.y})`}
                          className="pointer-events-auto"
                          data-overlay-node
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            beginOverlayPartPointer(e, ov, e.clientX, e.clientY);
                          }}
                        >
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
                        style={{
                          left: `${ov.x}%`,
                          top: `${ov.y}%`,
                          width: `${ov.w}%`,
                          height: `${ov.h}%`,
                          // 作業スペースの図形と同じ黄色いリング
                          boxShadow: `0 0 0 3px ${SELECTION_YELLOW}, 0 0 0 6px ${SELECTION_YELLOW}40`,
                          borderRadius: 2,
                        }}
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
                          outline: selected ? `2px solid ${SELECTION_YELLOW}` : undefined,
                          outlineOffset: 1,
                          borderRadius: 4,
                          WebkitTouchCallout: "none",
                          userSelect: "none",
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          beginOverlayPartPointer(e, ov, e.clientX, e.clientY);
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
                  // 書式バー連打中は pending を優先（親再レンダーで DOM 直書きが戻らないように）
                  const pendingStyle = editing ? pendingOverlayStyleRef.current : {};
                  const displayFontSize = pendingStyle.fontSize ?? ov.fontSize;
                  const displayAlign = pendingStyle.align ?? ov.align;
                  const displayColor = pendingStyle.textColor ?? ov.textColor;
                  // 表示と同じ大きさで打つ（編集時だけ 16px 下限にするとジャンプする）
                  const fontPx = displayFontSize * 0.55;
                  const hasRich = Boolean(ov.html);
                  const textStyle: CSSProperties = {
                    color: displayColor,
                    textAlign: displayAlign,
                    fontSize: fontPx,
                    fontWeight: hasRich ? undefined : ov.bold ? 700 : 400,
                    fontStyle: hasRich ? undefined : ov.italic ? "italic" : "normal",
                    textDecoration: hasRich ? undefined : ov.underline ? "underline" : "none",
                  };
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
                          border:
                            editing || selected
                              ? `2px solid ${SELECTION_YELLOW}`
                              : "1px solid rgba(0,0,0,0.28)",
                          background: "transparent",
                          borderRadius: 4,
                          WebkitTouchCallout: "none",
                          WebkitUserSelect: editing ? "text" : "none",
                          userSelect: editing ? "text" : "none",
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          if (editing) return;
                          beginOverlayPartPointer(e, ov, e.clientX, e.clientY);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setSelectedOverlayIds([ov.id]);
                          setOverlayHandlesVisible(false);
                          beginOverlayTextEdit(ov.id);
                        }}
                      >
                        {editing && canEdit ? (
                          <div
                            ref={overlayTextRef}
                            contentEditable
                            suppressContentEditableWarning
                            role="textbox"
                            aria-multiline
                            onInput={() => {
                              const el = overlayTextRef.current;
                              if (!el) return;
                              const html = sanitizeRichHtml(el.innerHTML);
                              const text = plainTextFromRichHtml(html);
                              const pendingStyle = pendingOverlayStyleRef.current;
                              pendingOverlayStyleRef.current = {};
                              pendingOverlayHtmlRef.current = null;
                              patchOverlay(ov.id, { text, html, ...pendingStyle });
                              setOverlayInlineFormat(queryInlineFormatState());
                            }}
                            onBlur={() => {
                              window.setTimeout(() => {
                                if (!editingOverlayIdRef.current) return;
                                const active = document.activeElement as HTMLElement | null;
                                if (active === overlayTextRef.current) return;
                                if (active?.closest("[data-text-format-bar]")) return;
                                // 書式バー連打・キーボード表示中は常に取り戻す
                                if (
                                  overlayFormatBarGuarding() ||
                                  overlayKeyboardOpenRef.current ||
                                  keyboardStillCovering()
                                ) {
                                  keepOverlayTextFocus();
                                }
                              }, 40);
                            }}
                            className="h-full w-full bg-transparent px-1 outline-none"
                            style={textStyle}
                            onPointerDown={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div
                            className="h-full w-full overflow-hidden whitespace-pre-wrap px-1"
                            style={textStyle}
                            {...(hasRich
                              ? { dangerouslySetInnerHTML: { __html: richHtmlForTextBox(ov) } }
                              : {})}
                          >
                            {!hasRich ? ov.text || tx("テキスト", "Text") : null}
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
              setEditTool(null);
            });
          };
          reader.readAsDataURL(file);
        }}
      />

      {/* 完了・挿入は画面に固定（カード拡大／スクロールしても追従）。編集中は隠す */}
      {createPortal(
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-[650] flex flex-col pt-[max(0.75rem,env(safe-area-inset-top))]"
          data-board-ui
        >
          <div className="flex items-center justify-between gap-2 px-3 pb-1">
            {!editingOverlayId ? (
              <button
                type="button"
                onClick={onClose}
                className="pointer-events-auto inline-flex min-h-11 items-center gap-0.5 rounded-full bg-white px-3 text-sm font-semibold text-zinc-900 shadow-[0_8px_24px_rgba(0,0,0,0.12)] active:scale-95"
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
                {tx("完了", "Done")}
              </button>
            ) : (
              <span className="w-11" />
            )}
            {canEdit && !editingOverlayId ? (
              <div className="pointer-events-auto flex items-center gap-2">
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
                        setEditTool((prev) => (prev === id ? null : id));
                        setPenEraser(false);
                        setSelectedOverlayIds([]);
                        setOverlayHandlesVisible(false);
                      }}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-40 ${
                        editTool === id ? "bg-zinc-100 text-zinc-950" : "text-zinc-600"
                      }`}
                    >
                      {id === "text" ? <Type className="h-4 w-4" strokeWidth={2.25} /> : null}
                      {id === "shape" ? <Shapes className="h-4 w-4" strokeWidth={2.25} /> : null}
                      {id === "photo" ? <ImageIcon className="h-4 w-4" strokeWidth={2.25} /> : null}
                      {id === "pen" ? <PenLine className="h-4 w-4" strokeWidth={2.25} /> : null}
                    </button>
                  ))}
                </div>
                {selectedOverlayIds.length > 0 ? (
                  <button
                    type="button"
                    data-board-ui
                    onClick={deleteSelectedOverlays}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-rose-600 shadow-[0_8px_24px_rgba(0,0,0,0.12)] active:scale-95"
                    aria-label={tx("削除", "Delete")}
                  >
                    <Trash2 className="h-5 w-5" strokeWidth={2.25} />
                  </button>
                ) : null}
              </div>
            ) : (
              <span className="w-11" />
            )}
          </div>

          {canEdit && editTool === "shape" && !editingOverlayId ? (
            <div className="flex justify-center px-3 pb-1">
              <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-white px-2 py-1 shadow-sm">
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

          {canEdit && editTool === "pen" && !editingOverlayId ? (
            <div className="flex justify-center gap-1.5 px-3 pb-1">
              {SHAPE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    setPenEraser(false);
                    setPenColor(color);
                  }}
                  className={`pointer-events-auto h-6 w-6 rounded-full border-2 ${
                    !penEraser && penColor === color ? "border-zinc-900" : "border-zinc-200"
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={tx("ペン色", "Pen color")}
                />
              ))}
              <button
                type="button"
                onClick={() => setPenEraser(true)}
                className={`pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                  penEraser ? "border-zinc-900 bg-zinc-100 text-zinc-900" : "border-zinc-200 text-zinc-600"
                }`}
                aria-label={tx("消しゴム", "Eraser")}
                title={tx("消しゴム", "Eraser")}
              >
                <Eraser className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
            </div>
          ) : null}

          {canEdit && editTool === "text" && !editingOverlayId ? (
            <p className="px-3 pb-1 text-center text-[11px] font-medium text-zinc-500">
              {tx("カード内をダブルタップして文字を置く", "Double-tap on the card to place text")}
            </p>
          ) : null}
        </div>,
        document.body,
      )}

      {/* 編集中は常に表示。iOS は bottom:0 でキーボード直上（transition なし） */}
      {showOverlayFormatBar && editingOverlayText
        ? createPortal(
            <div className="pointer-events-none" style={keyboard.dockStyle}>
              <SlidesTextFormatBar
                fontSize={editingOverlayText.fontSize}
                textColor={editingOverlayText.textColor}
                align={editingOverlayText.align}
                bold={overlayInlineFormat.bold}
                italic={overlayInlineFormat.italic}
                underline={overlayInlineFormat.underline}
                tx={tx}
                onChange={(patch) => {
                  overlayFormatBarPointerDownRef.current = true;
                  touchOverlayFormatBar();
                  applyOverlayStyleDom(patch);
                  pendingOverlayStyleRef.current = {
                    ...pendingOverlayStyleRef.current,
                    ...patch,
                  };
                }}
                onInlineFormat={(command, value) => {
                  overlayFormatBarPointerDownRef.current = true;
                  touchOverlayFormatBar();
                  applyInlineFormat(command, value);
                  const el = overlayTextRef.current;
                  if (el) {
                    const html = sanitizeRichHtml(el.innerHTML);
                    const text = plainTextFromRichHtml(html);
                    pendingOverlayHtmlRef.current = { text, html };
                    if (command === "foreColor" && value) {
                      pendingOverlayStyleRef.current = {
                        ...pendingOverlayStyleRef.current,
                        textColor: value,
                      };
                      applyOverlayStyleDom({ textColor: value });
                    }
                  }
                  setOverlayInlineFormat(queryInlineFormatState());
                }}
                onKeepFocus={keepOverlayTextFocus}
                onInteract={() => {
                  overlayFormatBarPointerDownRef.current = true;
                  touchOverlayFormatBar();
                }}
                onInteractEnd={() => {
                  overlayFormatBarPointerDownRef.current = false;
                  flushPendingOverlayEdits();
                  touchOverlayFormatBar();
                }}
              />
            </div>,
            document.body,
          )
        : null}
      </div>
    </>
  );
}

/** Googleスライド風：キーボード上の横スクロール書式バー */
function SlidesTextFormatBar({
  fontSize,
  textColor,
  align,
  bold,
  italic,
  underline,
  tx,
  onChange,
  onInlineFormat,
  onKeepFocus,
  onInteract,
  onInteractEnd,
}: {
  fontSize: number;
  textColor: string;
  align: TextAlign;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  tx: (ja: string, en: string) => string;
  onChange: (
    patch: Partial<{
      fontSize: number;
      textColor: string;
      align: TextAlign;
    }>,
  ) => void;
  /** 選択範囲（またはこれから打つ文字）へのインライン装飾 */
  onInlineFormat?: (command: "bold" | "italic" | "underline" | "foreColor", value?: string) => void;
  /** サイズ矢印など操作後にテキストエリアへフォーカスを戻す */
  onKeepFocus?: () => void;
  /** 連打中に編集終了しないためのガード更新 */
  onInteract?: () => void;
  onInteractEnd?: () => void;
}) {
  const [sizeEditing, setSizeEditing] = useState(false);
  const [sizeDraft, setSizeDraft] = useState(String(fontSize));
  const [colorOpen, setColorOpen] = useState(false);
  /** 親への連打更新を避けるため、表示用はローカルで持つ */
  const [localSize, setLocalSize] = useState(fontSize);
  const [localAlign, setLocalAlign] = useState(align);
  const [localColor, setLocalColor] = useState(textColor);
  const fontSizeRef = useRef(fontSize);
  fontSizeRef.current = localSize;
  const sizeRepeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const interactingRef = useRef(false);

  useEffect(() => {
    if (!interactingRef.current) {
      setLocalSize(fontSize);
      setLocalAlign(align);
      setLocalColor(textColor);
    }
  }, [fontSize, align, textColor]);

  useEffect(() => {
    if (!sizeEditing) setSizeDraft(String(localSize));
  }, [localSize, sizeEditing]);

  useEffect(
    () => () => {
      if (sizeRepeatRef.current) clearInterval(sizeRepeatRef.current);
    },
    [],
  );

  /** ボタンがフォーカスを奪ってキーボードが閉じるのを防ぐ */
  function keepEditingPointerDown(e: ReactPointerEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    interactingRef.current = true;
    onInteract?.();
    onKeepFocus?.();
  }

  function bumpSize(delta: number) {
    const next = Math.min(96, Math.max(8, fontSizeRef.current + delta));
    fontSizeRef.current = next;
    setLocalSize(next);
    interactingRef.current = true;
    onInteract?.();
    onChange({ fontSize: next });
    onKeepFocus?.();
  }

  function startSizeRepeat(delta: number) {
    if (sizeRepeatRef.current) clearInterval(sizeRepeatRef.current);
    bumpSize(delta);
    sizeRepeatRef.current = setInterval(() => bumpSize(delta), 90);
  }

  function stopSizeRepeat() {
    if (sizeRepeatRef.current) {
      clearInterval(sizeRepeatRef.current);
      sizeRepeatRef.current = null;
    }
    interactingRef.current = false;
    onInteractEnd?.();
    onKeepFocus?.();
  }

  function commitSize(raw: string) {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) {
      setSizeDraft(String(localSize));
      setSizeEditing(false);
      onKeepFocus?.();
      return;
    }
    const next = Math.min(96, Math.max(8, n));
    setLocalSize(next);
    onChange({ fontSize: next });
    setSizeEditing(false);
    onKeepFocus?.();
  }

  return (
    <div
      data-board-ui
      data-text-format-bar
      className="pointer-events-auto w-full border-t border-zinc-200 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
      onPointerDown={(e) => {
        e.stopPropagation();
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") e.preventDefault();
        onInteract?.();
        onKeepFocus?.();
      }}
      onPointerUp={() => onInteractEnd?.()}
      onPointerCancel={() => onInteractEnd?.()}
      onPointerLeave={(e) => {
        // バー外へドラッグで離した場合も解除
        if (e.buttons === 0) onInteractEnd?.();
      }}
      onTouchStart={(e) => {
        const tag = (e.target as HTMLElement).tagName;
        // iOS: touch でフォーカスが奪われるのを防ぐ
        if (tag !== "INPUT" && tag !== "TEXTAREA") e.preventDefault();
        onInteract?.();
        onKeepFocus?.();
      }}
      onTouchEnd={() => onInteractEnd?.()}
      onTouchCancel={() => onInteractEnd?.()}
    >
      {colorOpen ? (
        <div className="flex items-center gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TEXT_COLOR_ORDER.map((color) => (
            <button
              key={color}
              type="button"
              onPointerDown={keepEditingPointerDown}
              onClick={() => {
                setLocalColor(color);
                interactingRef.current = true;
                if (onInlineFormat) {
                  onInlineFormat("foreColor", color);
                } else {
                  onChange({ textColor: color });
                }
                setColorOpen(false);
                interactingRef.current = false;
                onInteractEnd?.();
                window.requestAnimationFrame(() => onKeepFocus?.());
              }}
              className={`h-7 w-7 shrink-0 rounded-full border-2 ${
                localColor.toLowerCase() === color.toLowerCase() ? "border-zinc-900" : "border-zinc-200"
              }`}
              style={{ backgroundColor: color }}
              aria-label={tx("文字色", "Text color")}
            />
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-1 overflow-x-auto px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex shrink-0 items-center gap-0.5 pr-1">
          <div className="flex flex-col">
            <button
              type="button"
              className="inline-flex h-4 w-5 items-center justify-center text-zinc-600 active:bg-zinc-100"
              aria-label={tx("大きく", "Larger")}
              onPointerDown={(e) => {
                keepEditingPointerDown(e);
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                startSizeRepeat(1);
              }}
              onPointerUp={stopSizeRepeat}
              onPointerCancel={stopSizeRepeat}
              onLostPointerCapture={stopSizeRepeat}
              onClick={(e) => e.preventDefault()}
            >
              <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              className="inline-flex h-4 w-5 items-center justify-center text-zinc-600 active:bg-zinc-100"
              aria-label={tx("小さく", "Smaller")}
              onPointerDown={(e) => {
                keepEditingPointerDown(e);
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                startSizeRepeat(-1);
              }}
              onPointerUp={stopSizeRepeat}
              onPointerCancel={stopSizeRepeat}
              onLostPointerCapture={stopSizeRepeat}
              onClick={(e) => e.preventDefault()}
            >
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>
          {sizeEditing && !onKeepFocus ? (
            <input
              autoFocus
              inputMode="numeric"
              value={sizeDraft}
              onChange={(e) => setSizeDraft(e.target.value.replace(/[^\d]/g, ""))}
              onBlur={() => commitSize(sizeDraft)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitSize(sizeDraft);
                if (e.key === "Escape") {
                  setSizeDraft(String(localSize));
                  setSizeEditing(false);
                }
              }}
              className="h-8 w-10 rounded bg-zinc-100 text-center text-[14px] font-semibold text-zinc-900 outline-none"
            />
          ) : (
            <button
              type="button"
              onPointerDown={keepEditingPointerDown}
              onClick={() => {
                // キーボード維持モードでは数値入力を開かず、フォーカスを奪わない
                if (onKeepFocus) return;
                setSizeDraft(String(localSize));
                setSizeEditing(true);
              }}
              className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded px-1 text-[14px] font-semibold text-zinc-800"
            >
              {localSize}
            </button>
          )}
        </div>

        <div className="mx-1 h-6 w-px shrink-0 bg-zinc-200" />

        <button
          type="button"
          onPointerDown={keepEditingPointerDown}
          onClick={() => {
            onInlineFormat?.("bold");
            window.requestAnimationFrame(() => onKeepFocus?.());
          }}
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded ${
            bold ? "bg-[#E8F0FE] text-[#1A73E8]" : "text-zinc-700"
          }`}
          aria-label={tx("太字", "Bold")}
        >
          <Bold className="h-4 w-4" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onPointerDown={keepEditingPointerDown}
          onClick={() => {
            onInlineFormat?.("italic");
            window.requestAnimationFrame(() => onKeepFocus?.());
          }}
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded ${
            italic ? "bg-[#E8F0FE] text-[#1A73E8]" : "text-zinc-700"
          }`}
          aria-label={tx("斜体", "Italic")}
        >
          <Italic className="h-4 w-4" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          onPointerDown={keepEditingPointerDown}
          onClick={() => {
            onInlineFormat?.("underline");
            window.requestAnimationFrame(() => onKeepFocus?.());
          }}
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded ${
            underline ? "bg-[#E8F0FE] text-[#1A73E8]" : "text-zinc-700"
          }`}
          aria-label={tx("下線", "Underline")}
        >
          <Underline className="h-4 w-4" strokeWidth={2.25} />
        </button>

        <button
          type="button"
          onPointerDown={keepEditingPointerDown}
          onClick={() => setColorOpen((v) => !v)}
          className="inline-flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded text-zinc-700"
          aria-label={tx("文字色", "Text color")}
        >
          <span className="text-[13px] font-bold leading-none" style={{ color: localColor }}>
            A
          </span>
          <span className="mt-0.5 h-1 w-4 rounded-sm" style={{ backgroundColor: localColor }} />
        </button>

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
            onPointerDown={keepEditingPointerDown}
            onClick={() => {
              setLocalAlign(value);
              interactingRef.current = true;
              onChange({ align: value });
              interactingRef.current = false;
              onInteractEnd?.();
              window.requestAnimationFrame(() => onKeepFocus?.());
            }}
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded ${
              localAlign === value ? "bg-[#E8F0FE] text-[#1A73E8]" : "text-zinc-700"
            }`}
            aria-label={label}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
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
