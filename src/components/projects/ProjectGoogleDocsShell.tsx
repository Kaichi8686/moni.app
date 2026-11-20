"use client";

import DOMPurify from "dompurify";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  Check,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Plus,
  Redo2,
  Underline,
  Undo2,
} from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { useVirtualKeyboardOpen } from "@/hooks/useVirtualKeyboardOpen";
import { a4MinHeightForWidth } from "@/lib/projects/documents";

const PAGE_MAX_WIDTH = 680;
const PAGE_MIN_HEIGHT = a4MinHeightForWidth(PAGE_MAX_WIDTH);
const AUTOSAVE_MS = 800;
/** 本文 11pt 相当（作業スペースのサイズバーと同じ px 単位） */
const DEFAULT_DOC_FONT_SIZE_PX = 15;
const MIN_DOC_FONT_SIZE_PX = 8;
const MAX_DOC_FONT_SIZE_PX = 96;

const TEXT_COLORS = ["#000000", "#434343", "#666666", "#d93025", "#e37400", "#188038", "#1a73e8", "#a142f4"] as const;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function initialHtmlFromStored(content: string): string {
  const t = content.trim();
  if (!t) return "<p><br /></p>";
  if (t.startsWith("<")) {
    const sample = t.slice(0, 80).toLowerCase();
    if (/<(p|div|h[1-6]|ul|ol|span|br|img)\b/.test(sample)) return content;
  }
  const paragraphs = content.split(/\n\n+/);
  const body = paragraphs.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br />")}</p>`).join("");
  return body || "<p><br /></p>";
}

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "div",
      "span",
      "b",
      "i",
      "u",
      "strong",
      "em",
      "s",
      "strike",
      "h1",
      "h2",
      "h3",
      "ul",
      "ol",
      "li",
      "a",
      "img",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "style", "src", "alt", "width", "height"],
  });
}

function ToolBtn({
  children,
  title,
  onClick,
  disabled,
  active,
  className = "",
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      // タップで contentEditable の選択が消えないようにする
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-9 min-w-9 shrink-0 items-center justify-center rounded-md px-2 text-[15px] text-[#3c4043] transition hover:bg-[#f1f3f4] disabled:pointer-events-none disabled:opacity-25 ${
        active ? "bg-[#e8f0fe] text-[#174ea6]" : ""
      } ${className}`}
    >
      {children}
    </button>
  );
}

export type DocumentSavePayload = {
  title: string;
  content: string;
};

export type ProjectGoogleDocsShellHandle = {
  /** デバウンス待ちを捨てて最新内容を即保存（戻る前など） */
  flushAndSave: () => Promise<void>;
};

type Props = {
  activeDocId: string | null;
  documents: Array<{ id: string; content: string }>;
  docTitle: string;
  onDocTitleChange: (title: string) => void;
  onDocContentChange: (html: string) => void;
  /** 自動保存。title/content の最新値を渡す（親 state の遅延を避ける） */
  onSave: (payload: DocumentSavePayload) => void | Promise<void>;
  saving?: boolean;
  /** false のとき自動保存しない（閲覧のみ） */
  autoSave?: boolean;
  wordCount: number;
  updatedByLabel: string;
  sidebar?: ReactNode;
  hideSidebar?: boolean;
  onBack?: () => void;
  /** 写真アップロード。公開 URL を返す。未指定時はプラスからの写真追加は無効 */
  onUploadImage?: (file: File) => Promise<string>;
  /** 画面全体で編集（タブバー・余白なし）。Workspace のドキュメント編集向け */
  fullscreen?: boolean;
};

export const ProjectGoogleDocsShell = forwardRef<ProjectGoogleDocsShellHandle, Props>(function ProjectGoogleDocsShell(
  {
    activeDocId,
    documents,
    docTitle,
    onDocTitleChange,
    onDocContentChange,
    onSave,
    saving,
    autoSave = true,
    wordCount,
    updatedByLabel,
    sidebar,
    hideSidebar = false,
    onBack,
    onUploadImage,
    fullscreen = false,
  },
  ref,
) {
  const shellRef = useRef<HTMLElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentsRef = useRef(documents);
  const flushDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef(docTitle);
  const contentRef = useRef("");
  const activeDocIdRef = useRef(activeDocId);
  const onSaveRef = useRef(onSave);
  const persistNowRef = useRef<() => Promise<void>>(async () => {});
  const savingRef = useRef(false);
  const dirtyRef = useRef(false);
  const discardOnLeaveRef = useRef(false);
  const savedRangeRef = useRef<Range | null>(null);
  const suppressEditUntilRef = useRef(0);
  const lastTapRef = useRef<{ t: number; x: number; y: number } | null>(null);
  const editModeRef = useRef(false);
  const keyboardWasOpenRef = useRef(false);
  const pendingCaretAtEndRef = useRef(false);
  const pinchRef = useRef<{
    startDist: number;
    startZoom: number;
    startPanX: number;
    startPanY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const [saveHint, setSaveHint] = useState("保存済み");
  const [leaving, setLeaving] = useState(false);
  /** 編集セッション（チェック・書式バー表示）。入力自体はダブルタップで開始 */
  const [editMode, setEditMode] = useState(() => Boolean(autoSave));
  /** エディタにフォーカスして文字入力中 */
  const [typingActive, setTypingActive] = useState(false);
  editModeRef.current = editMode;
  const [zoomUnlocked, setZoomUnlocked] = useState(false);
  const [docZoom, setDocZoom] = useState(1);
  const [docPan, setDocPan] = useState({ x: 0, y: 0 });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  /** 可視領域下端より下にはみ出した分（Safari バー＋キーボード）。シェルは lvh のまま */
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageErr, setImageErr] = useState("");
  const [colorOpen, setColorOpen] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const [formatState, setFormatState] = useState({ bold: false, italic: false, underline: false });
  const [activeTextColor, setActiveTextColor] = useState<string>("#000000");
  const [activeFontSize, setActiveFontSize] = useState(DEFAULT_DOC_FONT_SIZE_PX);
  const activeFontSizeRef = useRef(DEFAULT_DOC_FONT_SIZE_PX);
  activeFontSizeRef.current = activeFontSize;
  const fontSizeRepeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** iOS はフォーカス残留でもキーボードが閉じることがあるので VV で判定 */
  const keyboardOpen = useVirtualKeyboardOpen(120);

  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

  useEffect(() => {
    titleRef.current = docTitle;
  }, [docTitle]);

  useEffect(() => {
    activeDocIdRef.current = activeDocId;
  }, [activeDocId]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    savingRef.current = Boolean(saving);
    if (saving) setSaveHint("保存中…");
  }, [saving]);

  const rememberSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (editorRef.current?.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const range = savedRangeRef.current;
    const el = editorRef.current;
    if (!range || !el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
  }, []);

  const refreshHistoryState = useCallback(() => {
    try {
      setCanUndo(document.queryCommandEnabled("undo"));
      setCanRedo(document.queryCommandEnabled("redo"));
    } catch {
      setCanUndo(false);
      setCanRedo(false);
    }
  }, []);

  const refreshFormatState = useCallback(() => {
    try {
      setFormatState({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
      });
    } catch {
      setFormatState({ bold: false, italic: false, underline: false });
    }
    try {
      const value = document.queryCommandValue("foreColor");
      if (value) {
        // rgb(r, g, b) → #rrggbb
        const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (match) {
          const hex = `#${[match[1], match[2], match[3]]
            .map((n) => Number(n).toString(16).padStart(2, "0"))
            .join("")}`;
          setActiveTextColor(hex);
        } else if (value.startsWith("#")) {
          setActiveTextColor(value);
        }
      }
    } catch {
      /* noop */
    }
    try {
      const sel = window.getSelection();
      let node: Node | null = sel?.anchorNode ?? null;
      if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
      const el =
        node instanceof HTMLElement && editorRef.current?.contains(node)
          ? node
          : editorRef.current;
      if (!el) return;
      const px = Math.round(Number.parseFloat(getComputedStyle(el).fontSize));
      if (Number.isFinite(px) && px > 0) {
        setActiveFontSize(Math.min(MAX_DOC_FONT_SIZE_PX, Math.max(MIN_DOC_FONT_SIZE_PX, px)));
      }
    } catch {
      /* noop */
    }
  }, []);

  const ensureEditorReadyForFormat = useCallback(() => {
    if (blurTypingTimerRef.current) {
      clearTimeout(blurTypingTimerRef.current);
      blurTypingTimerRef.current = null;
    }
    if (!editModeRef.current) {
      editModeRef.current = true;
      setEditMode(true);
    }
    setTypingActive(true);
    restoreSelection();
    const el = editorRef.current;
    el?.focus({ preventScroll: true });
  }, [restoreSelection]);

  const placeCaretInSpan = useCallback((span: HTMLElement) => {
    const sel = window.getSelection();
    if (!sel) return;
    const next = document.createRange();
    if (span.firstChild) {
      const len = span.firstChild.textContent?.length ?? 0;
      next.setStart(span.firstChild, len);
    } else {
      next.selectNodeContents(span);
    }
    next.collapse(true);
    sel.removeAllRanges();
    sel.addRange(next);
  }, []);

  const wrapSelectionOrCaret = useCallback(
    (createEl: () => HTMLElement) => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return false;
      const range = sel.getRangeAt(0);
      const el = createEl();
      if (range.collapsed) {
        // これから打つ文字用: キャレット位置に空要素を置き、中にキャレット
        el.appendChild(document.createTextNode("\u200b"));
        range.insertNode(el);
        placeCaretInSpan(el);
        return true;
      }
      try {
        range.surroundContents(el);
      } catch {
        el.appendChild(range.extractContents());
        range.insertNode(el);
      }
      sel.removeAllRanges();
      const next = document.createRange();
      next.selectNodeContents(el);
      sel.addRange(next);
      return true;
    },
    [placeCaretInSpan],
  );

  const exec = useCallback(
    (command: string, value?: string) => {
      ensureEditorReadyForFormat();
      try {
        const useCss = command === "foreColor" || command === "fontSize";
        document.execCommand("styleWithCSS", false, useCss ? "true" : "false");
        const ok = document.execCommand(command, false, value);
        // iOS などで foreColor / fontSize が効かない場合は span でフォールバック
        if (!ok && (command === "foreColor" || command === "fontSize")) {
          wrapSelectionOrCaret(() => {
            const span = document.createElement("span");
            if (command === "foreColor" && value) span.style.color = value;
            if (command === "fontSize" && value) span.style.fontSize = value;
            return span;
          });
        }
      } catch {
        /* noop */
      }
      rememberSelection();
      refreshHistoryState();
      refreshFormatState();
    },
    [ensureEditorReadyForFormat, rememberSelection, refreshFormatState, refreshHistoryState, wrapSelectionOrCaret],
  );

  /** 太字・斜体・下線・文字色: 選択範囲に適用し、キャレットのみならこれから打つ文字にも効く。
   *  太字+斜体は <b>/<i> ネストで同時適用可能にする。 */
  const applyTextFormat = useCallback(
    (command: "bold" | "italic" | "underline" | "foreColor", value?: string) => {
      ensureEditorReadyForFormat();
      const selBefore = window.getSelection();
      const collapsed =
        !selBefore || selBefore.rangeCount === 0 || selBefore.getRangeAt(0).collapsed;

      try {
        if (command === "foreColor" && value) {
          setActiveTextColor(value);
          document.execCommand("styleWithCSS", false, "true");
          if (collapsed) {
            wrapSelectionOrCaret(() => {
              const span = document.createElement("span");
              span.style.color = value;
              return span;
            });
          } else {
            const ok = document.execCommand("foreColor", false, value);
            if (!ok) {
              wrapSelectionOrCaret(() => {
                const span = document.createElement("span");
                span.style.color = value;
                return span;
              });
            }
          }
        } else {
          // セマンティックタグでネスト（太字+斜体の両立）
          document.execCommand("styleWithCSS", false, "false");
          const before = document.queryCommandState(command);
          const ok = document.execCommand(command, false);
          const after = document.queryCommandState(command);
          if (!ok || before === after) {
            // exec が効かない／トグルできなかった場合は b/i/u で包む
            // すでに ON なら外すのは難しいので、OFF→ON のフォールバックに限定
            if (!before) {
              wrapSelectionOrCaret(() => {
                if (command === "bold") return document.createElement("b");
                if (command === "italic") return document.createElement("i");
                return document.createElement("u");
              });
            }
          }
        }
      } catch {
        /* noop */
      }

      rememberSelection();
      refreshHistoryState();
      refreshFormatState();
    },
    [ensureEditorReadyForFormat, rememberSelection, refreshFormatState, refreshHistoryState, wrapSelectionOrCaret],
  );

  const applyFontSizePx = useCallback(
    (px: number) => {
      const next = Math.min(MAX_DOC_FONT_SIZE_PX, Math.max(MIN_DOC_FONT_SIZE_PX, Math.round(px)));
      ensureEditorReadyForFormat();
      const sel = window.getSelection();
      const collapsed = !sel || sel.rangeCount === 0 || sel.getRangeAt(0).collapsed;

      const clearInnerFontSizes = (root: HTMLElement) => {
        root.querySelectorAll<HTMLElement>("[style]").forEach((node) => {
          if (node === root) return;
          if (!node.style.fontSize) return;
          node.style.fontSize = "";
          if (!node.getAttribute("style")?.trim()) node.removeAttribute("style");
        });
      };

      const findEditableSizeSpan = (from: Node | null): HTMLElement | null => {
        let node: Node | null = from;
        while (node && node !== editorRef.current) {
          if (node instanceof HTMLElement && node.style.fontSize) return node;
          node = node.parentNode;
        }
        return null;
      };

      try {
        if (collapsed) {
          const existing = findEditableSizeSpan(sel?.anchorNode ?? null);
          if (existing) {
            existing.style.fontSize = `${next}px`;
          } else {
            wrapSelectionOrCaret(() => {
              const span = document.createElement("span");
              span.style.fontSize = `${next}px`;
              return span;
            });
          }
        } else {
          const range = sel!.getRangeAt(0);
          const selectedText = range.toString();
          const existing = findEditableSizeSpan(range.commonAncestorContainer);
          let updatedExisting = false;
          // 選択が既存サイズ span 内の同一テキスト全体 → ネストせず上書き（連打用）
          if (
            existing &&
            selectedText.length > 0 &&
            existing.contains(range.startContainer) &&
            existing.contains(range.endContainer) &&
            (existing.textContent || "").replace(/\u200b/g, "") === selectedText
          ) {
            existing.style.fontSize = `${next}px`;
            clearInnerFontSizes(existing);
            sel!.removeAllRanges();
            const nextRange = document.createRange();
            nextRange.selectNodeContents(existing);
            sel!.addRange(nextRange);
            updatedExisting = true;
          }
          if (!updatedExisting) {
            // 選択全体を 1 つのサイズ span に包み、内側の旧サイズを消す
            const ok = wrapSelectionOrCaret(() => {
              const span = document.createElement("span");
              span.style.fontSize = `${next}px`;
              return span;
            });
            if (ok) {
              const span = sel && sel.rangeCount > 0 ? findEditableSizeSpan(sel.anchorNode) : null;
              if (span) clearInnerFontSizes(span);
            } else {
              document.execCommand("styleWithCSS", false, "true");
              document.execCommand("fontSize", false, "7");
              const el = editorRef.current;
              el?.querySelectorAll('font[size="7"]').forEach((node) => {
                const span = document.createElement("span");
                span.style.fontSize = `${next}px`;
                while (node.firstChild) span.appendChild(node.firstChild);
                clearInnerFontSizes(span);
                node.parentNode?.replaceChild(span, node);
              });
              el?.querySelectorAll('span[style*="xxx-large"]').forEach((node) => {
                const span = node as HTMLElement;
                span.style.fontSize = `${next}px`;
                clearInnerFontSizes(span);
              });
            }
          }
        }
      } catch {
        wrapSelectionOrCaret(() => {
          const span = document.createElement("span");
          span.style.fontSize = `${next}px`;
          return span;
        });
      }

      setActiveFontSize(next);
      activeFontSizeRef.current = next;
      rememberSelection();
      refreshHistoryState();
      refreshFormatState();
    },
    [
      ensureEditorReadyForFormat,
      rememberSelection,
      refreshFormatState,
      refreshHistoryState,
      wrapSelectionOrCaret,
    ],
  );

  const bumpFontSize = useCallback(
    (delta: number) => {
      const next = Math.min(
        MAX_DOC_FONT_SIZE_PX,
        Math.max(MIN_DOC_FONT_SIZE_PX, activeFontSizeRef.current + delta),
      );
      applyFontSizePx(next);
    },
    [applyFontSizePx],
  );

  const startFontSizeRepeat = useCallback(
    (delta: number) => {
      if (fontSizeRepeatRef.current) clearInterval(fontSizeRepeatRef.current);
      bumpFontSize(delta);
      fontSizeRepeatRef.current = setInterval(() => bumpFontSize(delta), 90);
    },
    [bumpFontSize],
  );

  const stopFontSizeRepeat = useCallback(() => {
    if (fontSizeRepeatRef.current) {
      clearInterval(fontSizeRepeatRef.current);
      fontSizeRepeatRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      if (fontSizeRepeatRef.current) clearInterval(fontSizeRepeatRef.current);
    },
    [],
  );

  const readEditorHtml = useCallback(() => {
    const el = editorRef.current;
    if (!el) return contentRef.current;
    return sanitizeHtml(el.innerHTML);
  }, []);

  const persistNow = useCallback(async () => {
    if (!autoSave) return;
    const id = activeDocIdRef.current;
    if (!id || savingRef.current) return;
    if (!dirtyRef.current) return;

    const payload: DocumentSavePayload = {
      title: titleRef.current,
      content: readEditorHtml(),
    };
    contentRef.current = payload.content;
    onDocContentChange(payload.content);
    dirtyRef.current = false;
    setSaveHint("保存中…");
    try {
      await onSaveRef.current(payload);
      setSaveHint("保存済み");
    } catch {
      dirtyRef.current = true;
      setSaveHint("保存に失敗 · 再試行します");
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = setTimeout(() => {
        void persistNowRef.current();
      }, AUTOSAVE_MS);
    }
  }, [autoSave, onDocContentChange, readEditorHtml]);

  useEffect(() => {
    persistNowRef.current = persistNow;
  }, [persistNow]);

  const scheduleAutoSave = useCallback(() => {
    if (!autoSave || activeDocIdRef.current === null) return;
    dirtyRef.current = true;
    setSaveHint("編集中…");
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => {
      saveDebounceRef.current = null;
      void persistNowRef.current();
    }, AUTOSAVE_MS);
  }, [autoSave]);

  const flushToParent = useCallback(() => {
    const html = readEditorHtml();
    contentRef.current = html;
    onDocContentChange(html);
  }, [onDocContentChange, readEditorHtml]);

  /** デバウンスをキャンセルし、エディタ最新内容を親へ反映して保存する */
  const flushAndSave = useCallback(async () => {
    if (flushDebounceRef.current) {
      clearTimeout(flushDebounceRef.current);
      flushDebounceRef.current = null;
    }
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = null;
    }
    const html = readEditorHtml();
    if (html !== contentRef.current) {
      dirtyRef.current = true;
    }
    contentRef.current = html;
    onDocContentChange(html);
    if (!autoSave || !activeDocIdRef.current) return;
    // 保存中でも戻る前に最新を送る（親側で上書き）
    if (dirtyRef.current) {
      const payload: DocumentSavePayload = {
        title: titleRef.current,
        content: html,
      };
      dirtyRef.current = false;
      setSaveHint("保存中…");
      try {
        await onSaveRef.current(payload);
        setSaveHint("保存済み");
      } catch {
        dirtyRef.current = true;
        setSaveHint("保存に失敗 · 再試行します");
        throw new Error("document save failed");
      }
    }
  }, [autoSave, onDocContentChange, readEditorHtml]);

  useImperativeHandle(ref, () => ({ flushAndSave }), [flushAndSave]);

  /** チェック: 保存して閲覧モードへ（ズーム／横スクロール解禁） */
  const handleDone = useCallback(async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await flushAndSave();
      editModeRef.current = false;
      setEditMode(false);
      setTypingActive(false);
      setZoomUnlocked(true);
      setColorOpen(false);
      setAlignOpen(false);
      setStyleOpen(false);
      setInsertOpen(false);
      editorRef.current?.blur();
      setCanUndo(false);
      setCanRedo(false);
    } catch {
      // 保存失敗時も閲覧へは進める
      editModeRef.current = false;
      setEditMode(false);
      setTypingActive(false);
      setZoomUnlocked(true);
    } finally {
      setLeaving(false);
    }
  }, [flushAndSave, leaving]);

  /** 戻る: 保存せず一覧へ */
  const handleLeaveWithoutSave = useCallback(() => {
    if (!onBack || leaving) return;
    discardOnLeaveRef.current = true;
    if (flushDebounceRef.current) {
      clearTimeout(flushDebounceRef.current);
      flushDebounceRef.current = null;
    }
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = null;
    }
    dirtyRef.current = false;
    onBack();
  }, [leaving, onBack]);

  const isDoubleTap = useCallback((x: number, y: number) => {
    const now = Date.now();
    const prev = lastTapRef.current;
    const doubled =
      !!prev && now - prev.t < 380 && Math.hypot(x - prev.x, y - prev.y) < 28;
    lastTapRef.current = { t: now, x, y };
    return doubled;
  }, []);

  const placeCaretAtEnd = useCallback((el: HTMLElement) => {
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    savedRangeRef.current = range.cloneRange();
  }, []);

  /** ダブルタップで編集セッション＋文字入力を開始（キャレットは末尾＝右端） */
  const beginTyping = useCallback(() => {
    if (!autoSave || activeDocId === null) return;
    if (Date.now() < suppressEditUntilRef.current) return;
    if (blurTypingTimerRef.current) {
      clearTimeout(blurTypingTimerRef.current);
      blurTypingTimerRef.current = null;
    }
    lastTapRef.current = null;
    editModeRef.current = true;
    pendingCaretAtEndRef.current = true;
    setEditMode(true);
    setTypingActive(true);
    setDocZoom(1);
    setDocPan({ x: 0, y: 0 });
  }, [activeDocId, autoSave]);

  /** contentEditable 有効化後にフォーカスし、末尾（右端）へキャレットを置く */
  useLayoutEffect(() => {
    if (!typingActive || !pendingCaretAtEndRef.current) return;
    pendingCaretAtEndRef.current = false;
    const el = editorRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    placeCaretAtEnd(el);
    refreshHistoryState();
    refreshFormatState();
  }, [typingActive, placeCaretAtEnd, refreshFormatState, refreshHistoryState]);

  const canBrowseZoom = zoomUnlocked && !editMode;

  const applyDocZoom = useCallback((nextZoom: number, nextPan: { x: number; y: number }) => {
    const z = Math.min(3, Math.max(1, nextZoom));
    setDocZoom(z);
    if (z <= 1.01) {
      setDocPan({ x: 0, y: 0 });
      return;
    }
    setDocPan(nextPan);
  }, []);

  const onDocPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!canBrowseZoom) return;
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointersRef.current.size === 2) {
        const pts = [...pointersRef.current.values()];
        const dx = pts[0]!.x - pts[1]!.x;
        const dy = pts[0]!.y - pts[1]!.y;
        const dist = Math.hypot(dx, dy) || 1;
        pinchRef.current = {
          startDist: dist,
          startZoom: docZoom,
          startPanX: docPan.x,
          startPanY: docPan.y,
          originX: (pts[0]!.x + pts[1]!.x) / 2,
          originY: (pts[0]!.y + pts[1]!.y) / 2,
        };
        suppressEditUntilRef.current = Date.now() + 500;
      }
    },
    [canBrowseZoom, docPan.x, docPan.y, docZoom],
  );

  const onDocPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!canBrowseZoom) return;
      if (!pointersRef.current.has(event.pointerId)) return;
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const pinch = pinchRef.current;
      if (!pinch || pointersRef.current.size < 2) return;
      const pts = [...pointersRef.current.values()];
      const dx = pts[0]!.x - pts[1]!.x;
      const dy = pts[0]!.y - pts[1]!.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nextZoom = pinch.startZoom * (dist / pinch.startDist);
      applyDocZoom(nextZoom, {
        x: pinch.startPanX,
        y: pinch.startPanY,
      });
      suppressEditUntilRef.current = Date.now() + 500;
    },
    [applyDocZoom, canBrowseZoom],
  );

  const onDocPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) {
      if (pinchRef.current) suppressEditUntilRef.current = Date.now() + 400;
      pinchRef.current = null;
    }
  }, []);

  const onDocWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      if (!canBrowseZoom) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const next = docZoom * (event.deltaY < 0 ? 1.08 : 0.92);
      applyDocZoom(next, docPan);
      suppressEditUntilRef.current = Date.now() + 400;
    },
    [applyDocZoom, canBrowseZoom, docPan, docZoom],
  );

  const scheduleFlush = useCallback(() => {
    if (flushDebounceRef.current) clearTimeout(flushDebounceRef.current);
    flushDebounceRef.current = setTimeout(() => {
      flushToParent();
      flushDebounceRef.current = null;
      scheduleAutoSave();
    }, 400);
  }, [flushToParent, scheduleAutoSave]);

  useEffect(
    () => () => {
      if (flushDebounceRef.current) clearTimeout(flushDebounceRef.current);
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    },
    [],
  );

  // アンマウント時: 戻る（保存なし）以外で未保存があれば送る
  useEffect(() => {
    return () => {
      if (flushDebounceRef.current) clearTimeout(flushDebounceRef.current);
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      if (discardOnLeaveRef.current) return;
      if (!autoSave || !activeDocIdRef.current) return;
      const html = readEditorHtml();
      if (!dirtyRef.current && html === contentRef.current) return;
      void onSaveRef.current({
        title: titleRef.current,
        content: html,
      });
    };
  }, [autoSave, activeDocId, readEditorHtml]);

  /** 書式バーを可視領域下端（Safari バー／キーボード直上）へ。シェル高さは縮めない */
  useLayoutEffect(() => {
    if (!fullscreen || typeof window === "undefined") return;
    const sync = () => {
      const shell = shellRef.current;
      const vv = window.visualViewport;
      if (!shell || !vv) {
        setKeyboardInset(0);
        return;
      }
      const rect = shell.getBoundingClientRect();
      const vvBottom = vv.offsetTop + vv.height;
      setKeyboardInset(Math.max(0, Math.round(rect.bottom - vvBottom)));
    };
    sync();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, [fullscreen]);

  /** キーボードが閉じたら入力終了（書式バー消去・再度ダブルタップが必要） */
  useEffect(() => {
    if (!fullscreen) return;
    if (keyboardOpen) {
      keyboardWasOpenRef.current = true;
      return;
    }
    if (!keyboardWasOpenRef.current || !typingActive) return;
    keyboardWasOpenRef.current = false;
    setTypingActive(false);
    setColorOpen(false);
    setAlignOpen(false);
    setStyleOpen(false);
    editorRef.current?.blur();
  }, [fullscreen, keyboardOpen, typingActive]);

  /** iOS の選択ハンドル操作中も選択範囲を保持（書式ボタンで消えないように） */
  useEffect(() => {
    if (!typingActive) return;
    const onSel = () => {
      rememberSelection();
      refreshFormatState();
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, [typingActive, rememberSelection, refreshFormatState]);

  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el || activeDocId === null) return;
    const row = documentsRef.current.find((d) => d.id === activeDocId);
    const html = initialHtmlFromStored(row?.content ?? "");
    el.innerHTML = html;
    contentRef.current = sanitizeHtml(html);
    dirtyRef.current = false;
    editModeRef.current = Boolean(autoSave);
    setEditMode(Boolean(autoSave));
    setTypingActive(false);
    setZoomUnlocked(false);
    setDocZoom(1);
    setDocPan({ x: 0, y: 0 });
    lastTapRef.current = null;
    discardOnLeaveRef.current = false;
    queueMicrotask(() => {
      setSaveHint("保存済み");
      refreshHistoryState();
      // 開いた直後はフォーカスしない。ダブルタップで入力開始
      el.blur();
    });
  }, [activeDocId, autoSave, refreshHistoryState]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || activeDocId === null) return;
    if (dirtyRef.current) return;
    const row = documentsRef.current.find((d) => d.id === activeDocId);
    if (!row?.content?.trim()) return;
    const visuallyEmpty = !el.textContent?.replace(/\u00a0/g, "").trim() && !el.querySelector("img");
    if (visuallyEmpty) {
      el.innerHTML = initialHtmlFromStored(row.content);
      contentRef.current = sanitizeHtml(el.innerHTML);
    }
  }, [documents, activeDocId]);

  const onEditorInput = useCallback(() => {
    rememberSelection();
    scheduleFlush();
    setSaveHint("編集中…");
    refreshHistoryState();
    refreshFormatState();
  }, [refreshFormatState, refreshHistoryState, rememberSelection, scheduleFlush]);

  const onTitleChange = useCallback(
    (value: string) => {
      titleRef.current = value;
      onDocTitleChange(value);
      scheduleAutoSave();
    },
    [onDocTitleChange, scheduleAutoSave],
  );

  const onEditorFocus = useCallback(() => {
    // 閲覧中の1打目で focus が立っても入力中扱いしない（ダブルタップ判定を壊す）
    if (!editModeRef.current) {
      queueMicrotask(() => {
        if (!editModeRef.current) editorRef.current?.blur();
      });
      return;
    }
    if (blurTypingTimerRef.current) {
      clearTimeout(blurTypingTimerRef.current);
      blurTypingTimerRef.current = null;
    }
    setTypingActive(true);
    refreshHistoryState();
    refreshFormatState();
  }, [refreshFormatState, refreshHistoryState]);

  const onEditorBlur = useCallback(() => {
    rememberSelection();
    flushToParent();
    refreshHistoryState();
    if (blurTypingTimerRef.current) clearTimeout(blurTypingTimerRef.current);
    // 書式バーの preventDefault でフォーカスが戻る場合は入力継続
    blurTypingTimerRef.current = setTimeout(() => {
      blurTypingTimerRef.current = null;
      const el = editorRef.current;
      if (el && document.activeElement === el) return;
      // キーボード下降＝入力終了。書式バーも一緒に消す
      setTypingActive(false);
      setColorOpen(false);
      setAlignOpen(false);
      setStyleOpen(false);
    }, 80);
  }, [flushToParent, refreshHistoryState, rememberSelection]);

  const tryBeginTypingFromTap = useCallback(
    (x: number, y: number) => {
      // 編集セッション中かつ入力中のみスキップ。閲覧中の誤 focus 残留は無視
      if (editModeRef.current && typingActive) return;
      if (Date.now() < suppressEditUntilRef.current) return;
      if (docZoom > 1.02) return;
      // ピンチ中のみ拒否。単指の pointerdown 残余でダブルタップを落とさない
      if (pointersRef.current.size >= 2 || pinchRef.current) return;
      if (!isDoubleTap(x, y)) return;
      beginTyping();
    },
    [beginTyping, docZoom, isDoubleTap, typingActive],
  );

  useEffect(
    () => () => {
      if (blurTypingTimerRef.current) clearTimeout(blurTypingTimerRef.current);
    },
    [],
  );

  const applyBlockStyle = (v: string) => {
    if (v === "p") exec("formatBlock", "<p>");
    else if (v === "h1") exec("formatBlock", "<h1>");
    else if (v === "h2") exec("formatBlock", "<h2>");
    else if (v === "h3") exec("formatBlock", "<h3>");
    setStyleOpen(false);
    scheduleAutoSave();
  };

  const insertLink = () => {
    const url = typeof window !== "undefined" ? window.prompt("リンクの URL", "https://") : null;
    if (url) {
      exec("createLink", url);
      scheduleAutoSave();
    }
    setInsertOpen(false);
  };

  const insertImageAtCursor = useCallback(
    (url: string) => {
      restoreSelection();
      editorRef.current?.focus();
      const html = `<p><img src="${escapeHtml(url)}" alt="" /></p><p><br /></p>`;
      try {
        document.execCommand("insertHTML", false, html);
      } catch {
        const el = editorRef.current;
        if (el) el.insertAdjacentHTML("beforeend", html);
      }
      rememberSelection();
      scheduleFlush();
      scheduleAutoSave();
    },
    [rememberSelection, restoreSelection, scheduleAutoSave, scheduleFlush],
  );

  const onPickImages = useCallback(
    async (list: FileList | File[] | null) => {
      if (!list || !onUploadImage || !autoSave) return;
      const files = Array.from(list).filter((file) => file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name));
      if (files.length === 0) return;
      setImageErr("");
      setImageBusy(true);
      setInsertOpen(false);
      try {
        for (const file of files) {
          const url = await onUploadImage(file);
          insertImageAtCursor(url);
        }
      } catch (e) {
        setImageErr(e instanceof Error ? e.message : "画像の追加に失敗しました。");
      } finally {
        setImageBusy(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [autoSave, insertImageAtCursor, onUploadImage],
  );

  const statusLine = useMemo(() => {
    if (activeDocId === null) return "ドキュメントを選択してください";
    return `最終更新: ${updatedByLabel} · ${wordCount} 語 · ${saveHint}`;
  }, [activeDocId, saveHint, updatedByLabel, wordCount]);

  const showSidebar = !hideSidebar && sidebar && !fullscreen;
  const canEditDoc = activeDocId !== null && autoSave;
  const editing = canEditDoc && editMode;
  const showTypingShield = editing && !typingActive;
  /** フルスクリーンはキーボード実表示中のみ。デスクトップ埋め込みは入力中なら出す */
  const showFormatBar = editing && typingActive && (!fullscreen || keyboardOpen);

  return (
    <section
      ref={shellRef}
      className={
        fullscreen
          ? "flex h-full min-h-0 w-full flex-col overflow-hidden bg-white"
          : `flex min-h-[min(70dvh,720px)] flex-col overflow-hidden rounded-lg border border-[#E5E7EB] bg-white lg:min-h-[min(75dvh,780px)] ${
              showSidebar ? "lg:flex-row" : ""
            }`
      }
      style={fullscreen ? { paddingBottom: keyboardInset } : undefined}
    >
      {showSidebar ? (
        <aside className="flex max-h-[200px] shrink-0 flex-col border-b border-[#E5E7EB] bg-[#FAFAFA] lg:max-h-none lg:w-56 lg:shrink-0 lg:border-b-0 lg:border-r xl:w-60">
          {sidebar}
        </aside>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Google Docs 風トップバー: 完了 / 元に戻す・やり直し・＋ */}
        <div
          className={`relative flex items-center gap-0.5 border-b border-[#e8eaed] bg-white px-1.5 py-1 ${
            fullscreen ? "pt-[max(0.25rem,env(safe-area-inset-top))]" : ""
          }`}
        >
          {onBack ? (
            editing ? (
              <button
                type="button"
                onClick={() => void handleDone()}
                disabled={leaving}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#1a73e8] hover:bg-[#e8f0fe] disabled:opacity-50"
                aria-label="保存して編集を終了"
              >
                <Check className="h-6 w-6" strokeWidth={2.5} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLeaveWithoutSave}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4]"
                aria-label="ドキュメント一覧に戻る（保存しない）"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )
          ) : null}

          <div className="min-w-0 flex-1 px-1">
            <input
              className="w-full truncate border-0 bg-transparent text-[15px] font-medium text-[#202124] outline-none placeholder:text-[#9CA3AF]"
              value={docTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="無題のドキュメント"
              disabled={!editing}
              aria-label="タイトル"
            />
            <p className="truncate text-[11px] text-[#5f6368]" aria-live="polite">
              {activeDocId === null
                ? ""
                : editing
                  ? typingActive
                    ? saveHint
                    : "ダブルタップで入力"
                  : canEditDoc
                    ? zoomUnlocked
                      ? "ピンチで拡大 · ダブルタップで編集"
                      : "ダブルタップで編集"
                    : saveHint}
            </p>
          </div>

          {editing ? (
            <>
              <ToolBtn title="元に戻す" onClick={() => exec("undo")} disabled={!canUndo}>
                <Undo2 className="h-5 w-5" />
              </ToolBtn>
              <ToolBtn title="やり直し" onClick={() => exec("redo")} disabled={!canRedo}>
                <Redo2 className="h-5 w-5" />
              </ToolBtn>

              <div className="relative">
                <ToolBtn
                  title="挿入"
                  onClick={() => {
                    rememberSelection();
                    setInsertOpen((v) => !v);
                    setColorOpen(false);
                    setAlignOpen(false);
                    setStyleOpen(false);
                  }}
                  disabled={imageBusy}
                  active={insertOpen}
                >
                  <Plus className="h-5 w-5" />
                </ToolBtn>
                {insertOpen ? (
                  <>
                    <button type="button" className="fixed inset-0 z-40" aria-label="閉じる" onClick={() => setInsertOpen(false)} />
                    <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-[#dadce0] bg-white py-1 shadow-lg">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[14px] text-[#202124] hover:bg-[#f1f3f4] disabled:opacity-40"
                        disabled={!onUploadImage}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImagePlus className="h-4 w-4 text-[#5f6368]" />
                        写真を追加
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[14px] text-[#202124] hover:bg-[#f1f3f4]"
                        onClick={insertLink}
                      >
                        <Link2 className="h-4 w-4 text-[#5f6368]" />
                        リンクを追加
                      </button>
                    </div>
                  </>
                ) : null}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                multiple
                className="hidden"
                onChange={(e) => void onPickImages(e.target.files)}
              />
            </>
          ) : null}
        </div>

        {imageErr ? (
          <p className="border-b border-rose-100 bg-rose-50 px-3 py-1.5 text-[12px] text-rose-800">{imageErr}</p>
        ) : null}
        {imageBusy ? (
          <p className="border-b border-[#e8f0fe] bg-[#e8f0fe] px-3 py-1.5 text-[12px] text-[#174ea6]">写真を追加中…</p>
        ) : null}

        <div
          className={`relative z-0 min-h-0 flex-1 bg-white ${
            canBrowseZoom && docZoom > 1.01 ? "overflow-auto" : "overflow-y-auto overflow-x-hidden"
          } ${fullscreen ? "" : "bg-[#F3F4F6] px-3 py-4 sm:px-6 sm:py-6"}`}
          style={{ touchAction: canBrowseZoom ? "none" : "pan-y" }}
          onPointerDown={onDocPointerDown}
          onPointerMove={onDocPointerMove}
          onPointerUp={onDocPointerUp}
          onPointerCancel={onDocPointerUp}
          onWheel={onDocWheel}
        >
          {activeDocId === null ? (
            <p className="py-12 text-center text-sm text-[#6B7280]">ドキュメントを選択するか、新規作成してください。</p>
          ) : (
            <div
              className={
                fullscreen
                  ? "relative mx-auto flex min-h-full w-full flex-col bg-white"
                  : "relative mx-auto w-full bg-white shadow-sm ring-1 ring-[#E5E7EB]"
              }
              style={{
                ...(fullscreen ? undefined : { maxWidth: PAGE_MAX_WIDTH }),
                transform: canBrowseZoom ? `translate(${docPan.x}px, ${docPan.y}px) scale(${docZoom})` : undefined,
                transformOrigin: "0 0",
              }}
            >
              <div
                ref={editorRef}
                role="textbox"
                aria-multiline
                aria-readonly={!editing}
                tabIndex={editing && typingActive ? 0 : -1}
                contentEditable={editing && typingActive}
                suppressContentEditableWarning
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-form-type="other"
                data-lpignore="true"
                data-1p-ignore="true"
                inputMode="text"
                onInput={onEditorInput}
                onFocus={onEditorFocus}
                onBlur={onEditorBlur}
                onMouseUp={() => {
                  rememberSelection();
                  refreshHistoryState();
                  refreshFormatState();
                }}
                onKeyUp={() => {
                  rememberSelection();
                  refreshHistoryState();
                  refreshFormatState();
                }}
                onSelect={() => {
                  rememberSelection();
                  refreshHistoryState();
                  refreshFormatState();
                }}
                onClick={(event) => {
                  // 一部環境で contentEditable=false 時に onDoubleClick が欠けるため detail でも拾う
                  if (showTypingShield) return;
                  if (editMode && typingActive) return;
                  if (event.detail < 2) return;
                  beginTyping();
                }}
                onDoubleClick={() => {
                  if (editMode && typingActive) return;
                  beginTyping();
                }}
                onTouchEnd={(event) => {
                  if (showTypingShield) return;
                  if (editMode && typingActive) return;
                  const touch = event.changedTouches[0];
                  if (!touch) return;
                  tryBeginTypingFromTap(touch.clientX, touch.clientY);
                }}
                className={`gdocs-editor-body w-full flex-1 outline-none ${editing ? "" : "cursor-text"}`}
                style={{
                  minHeight: fullscreen ? "100%" : PAGE_MIN_HEIGHT,
                  padding: fullscreen
                    ? "1rem 1.25rem 1.5rem"
                    : "clamp(1.5rem, 4vw, 3.5rem) clamp(1.25rem, 5vw, 4rem)",
                  boxSizing: "border-box",
                  // iOS のダブルタップズームを抑えつつ、ダブルタップ入力と両立
                  touchAction: canBrowseZoom ? "none" : "manipulation",
                }}
              />
              {showTypingShield ? (
                <div
                  className="absolute inset-0 z-10 touch-pan-y"
                  aria-hidden
                  onClick={(event) => {
                    if (event.detail < 2) return;
                    event.preventDefault();
                    beginTyping();
                  }}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    beginTyping();
                  }}
                  onTouchEnd={(event) => {
                    const touch = event.changedTouches[0];
                    if (!touch) return;
                    tryBeginTypingFromTap(touch.clientX, touch.clientY);
                  }}
                />
              ) : null}
            </div>
          )}
        </div>

        {/* キーボード表示中だけ文字設定バーを出す（閉じたら消える）。
            色などは上方向 absolute だとドキュメント面の下に回るので、バー内の行で開く */}
        {showFormatBar ? (
          <div
            className={`relative z-50 shrink-0 border-t border-[#dadce0] bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.08)] ${
              fullscreen && keyboardInset < 8
                ? "pb-[max(0.25rem,env(safe-area-inset-bottom))]"
                : "pb-1"
            }`}
            role="toolbar"
            aria-label="文字の書式"
            onPointerDown={(e) => {
              e.stopPropagation();
              // タップ前に選択を退避（iOS で選択が消える前に掴む）
              rememberSelection();
            }}
          >
            {colorOpen ? (
              <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[#e8eaed] px-2 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`文字色 ${c}`}
                    className={`h-8 w-8 shrink-0 rounded-full border ${
                      activeTextColor.toLowerCase() === c ? "border-[#1a73e8] ring-2 ring-[#1a73e8]/40" : "border-[#dadce0]"
                    }`}
                    style={{ background: c }}
                    onMouseDown={(e) => e.preventDefault()}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => {
                      applyTextFormat("foreColor", c);
                      setColorOpen(false);
                      scheduleAutoSave();
                    }}
                  />
                ))}
              </div>
            ) : null}
            {alignOpen ? (
              <div className="flex items-center gap-0.5 border-b border-[#e8eaed] px-1.5 py-1">
                <ToolBtn
                  title="左揃え"
                  onClick={() => {
                    exec("justifyLeft");
                    setAlignOpen(false);
                    scheduleAutoSave();
                  }}
                >
                  <AlignLeft className="h-4 w-4" />
                </ToolBtn>
                <ToolBtn
                  title="中央揃え"
                  onClick={() => {
                    exec("justifyCenter");
                    setAlignOpen(false);
                    scheduleAutoSave();
                  }}
                >
                  <AlignCenter className="h-4 w-4" />
                </ToolBtn>
                <ToolBtn
                  title="右揃え"
                  onClick={() => {
                    exec("justifyRight");
                    setAlignOpen(false);
                    scheduleAutoSave();
                  }}
                >
                  <AlignRight className="h-4 w-4" />
                </ToolBtn>
              </div>
            ) : null}
            {styleOpen ? (
              <div className="border-b border-[#e8eaed] px-2 py-1.5">
                <p className="pb-1 text-[11px] font-semibold text-[#80868b]">文字サイズ</p>
                <div className="flex flex-wrap gap-1 pb-2">
                  {[12, 14, 16, 18, 24, 32].map((size) => (
                    <button
                      key={size}
                      type="button"
                      className="min-w-[2.25rem] rounded-md border border-[#dadce0] px-2 py-1.5 text-[12px] font-semibold text-[#202124] hover:bg-[#f1f3f4]"
                      onMouseDown={(e) => e.preventDefault()}
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => {
                        applyFontSizePx(size);
                        setStyleOpen(false);
                        scheduleAutoSave();
                      }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <p className="pb-1 text-[11px] font-semibold text-[#80868b]">スタイル</p>
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      ["p", "本文"],
                      ["h1", "見出し1"],
                      ["h2", "見出し2"],
                      ["h3", "見出し3"],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      className="rounded-md border border-[#dadce0] px-3 py-1.5 text-[13px] text-[#202124] hover:bg-[#f1f3f4]"
                      onMouseDown={(e) => e.preventDefault()}
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => applyBlockStyle(v)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-0.5 overflow-x-auto px-1.5 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <ToolBtn
                title="太字"
                active={formatState.bold}
                onClick={() => {
                  applyTextFormat("bold");
                  scheduleAutoSave();
                }}
                disabled={!editing}
              >
                <Bold className="h-4 w-4" strokeWidth={2.75} />
              </ToolBtn>
              <ToolBtn
                title="斜体"
                active={formatState.italic}
                onClick={() => {
                  applyTextFormat("italic");
                  scheduleAutoSave();
                }}
                disabled={!editing}
              >
                <Italic className="h-4 w-4" />
              </ToolBtn>
              <ToolBtn
                title="下線"
                active={formatState.underline}
                onClick={() => {
                  applyTextFormat("underline");
                  scheduleAutoSave();
                }}
                disabled={!editing}
              >
                <Underline className="h-4 w-4" />
              </ToolBtn>

              <span className="mx-0.5 h-5 w-px shrink-0 bg-[#dadce0]" aria-hidden />

              <ToolBtn
                title="文字色"
                active={colorOpen}
                disabled={!editing}
                onClick={() => {
                  rememberSelection();
                  setColorOpen((v) => !v);
                  setAlignOpen(false);
                  setStyleOpen(false);
                }}
              >
                <span className="flex flex-col items-center leading-none">
                  <span className="text-[15px] font-semibold">A</span>
                  <span
                    className="mt-0.5 h-[3px] w-4 rounded-sm"
                    style={{ background: activeTextColor || "#d93025" }}
                    aria-hidden
                  />
                </span>
              </ToolBtn>

              {/* 作業スペースと同じ：− 数値 ＋ */}
              <div className="mx-0.5 flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#dadce0] text-[#3c4043] active:bg-[#f1f3f4] disabled:opacity-25"
                  aria-label="小さく"
                  disabled={!editing}
                  onMouseDown={(e) => e.preventDefault()}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    rememberSelection();
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    startFontSizeRepeat(-1);
                  }}
                  onPointerUp={() => {
                    stopFontSizeRepeat();
                    scheduleAutoSave();
                  }}
                  onPointerCancel={stopFontSizeRepeat}
                  onLostPointerCapture={stopFontSizeRepeat}
                  onClick={(e) => e.preventDefault()}
                >
                  <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
                <span
                  className="inline-flex h-8 min-w-[1.75rem] items-center justify-center px-0.5 text-[14px] font-semibold tabular-nums text-[#202124]"
                  aria-label={`文字サイズ ${activeFontSize}`}
                >
                  {activeFontSize}
                </span>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#dadce0] text-[#3c4043] active:bg-[#f1f3f4] disabled:opacity-25"
                  aria-label="大きく"
                  disabled={!editing}
                  onMouseDown={(e) => e.preventDefault()}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    rememberSelection();
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    startFontSizeRepeat(1);
                  }}
                  onPointerUp={() => {
                    stopFontSizeRepeat();
                    scheduleAutoSave();
                  }}
                  onPointerCancel={stopFontSizeRepeat}
                  onLostPointerCapture={stopFontSizeRepeat}
                  onClick={(e) => e.preventDefault()}
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
              </div>

              <ToolBtn
                title="配置"
                active={alignOpen}
                disabled={!editing}
                onClick={() => {
                  rememberSelection();
                  setAlignOpen((v) => !v);
                  setColorOpen(false);
                  setStyleOpen(false);
                }}
              >
                <AlignLeft className="h-4 w-4" />
              </ToolBtn>

              <ToolBtn
                title="箇条書き"
                onClick={() => {
                  exec("insertUnorderedList");
                  scheduleAutoSave();
                }}
                disabled={!editing}
              >
                <List className="h-4 w-4" />
              </ToolBtn>
              <ToolBtn
                title="番号付き"
                onClick={() => {
                  exec("insertOrderedList");
                  scheduleAutoSave();
                }}
                disabled={!editing}
              >
                <ListOrdered className="h-4 w-4" />
              </ToolBtn>

              <ToolBtn
                title="スタイル"
                active={styleOpen}
                disabled={!editing}
                onClick={() => {
                  rememberSelection();
                  setStyleOpen((v) => !v);
                  setColorOpen(false);
                  setAlignOpen(false);
                }}
              >
                <span className="flex items-center gap-0.5 text-[13px] font-semibold">
                  A
                  <span className="flex flex-col gap-[2px]" aria-hidden>
                    <span className="block h-[1.5px] w-2.5 bg-current" />
                    <span className="block h-[1.5px] w-2.5 bg-current" />
                    <span className="block h-[1.5px] w-2.5 bg-current" />
                  </span>
                </span>
              </ToolBtn>
            </div>
          </div>
        ) : null}

        {fullscreen ? null : (
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E7EB] bg-white px-3 py-1.5 text-[11px] text-[#6B7280]">
            <p className="min-w-0 truncate">{statusLine}</p>
          </footer>
        )}
      </div>
    </section>
  );
});
