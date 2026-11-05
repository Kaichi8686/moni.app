"use client";

import DOMPurify from "dompurify";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  Check,
  Highlighter,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
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
  type ReactNode,
} from "react";
import { a4MinHeightForWidth } from "@/lib/projects/documents";

const PAGE_MAX_WIDTH = 680;
const PAGE_MIN_HEIGHT = a4MinHeightForWidth(PAGE_MAX_WIDTH);
const AUTOSAVE_MS = 800;

const TEXT_COLORS = ["#000000", "#434343", "#666666", "#d93025", "#e37400", "#188038", "#1a73e8", "#a142f4"] as const;
const HIGHLIGHT_COLORS = ["transparent", "#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#e5e7eb"] as const;

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
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentsRef = useRef(documents);
  const flushDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef(docTitle);
  const contentRef = useRef("");
  const activeDocIdRef = useRef(activeDocId);
  const onSaveRef = useRef(onSave);
  const persistNowRef = useRef<() => Promise<void>>(async () => {});
  const savingRef = useRef(false);
  const dirtyRef = useRef(false);
  const discardOnLeaveRef = useRef(false);
  const savedRangeRef = useRef<Range | null>(null);
  const lastTapRef = useRef(0);
  const [saveHint, setSaveHint] = useState("保存済み");
  const [leaving, setLeaving] = useState(false);
  const [editMode, setEditMode] = useState(true);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [viewportBox, setViewportBox] = useState({ top: 0, height: 0 });
  const [imageBusy, setImageBusy] = useState(false);
  const [imageErr, setImageErr] = useState("");
  const [colorOpen, setColorOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);

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

  const exec = useCallback(
    (command: string, value?: string) => {
      restoreSelection();
      editorRef.current?.focus();
      try {
        document.execCommand("styleWithCSS", false, "true");
        document.execCommand(command, false, value);
      } catch {
        /* noop */
      }
      rememberSelection();
      refreshHistoryState();
    },
    [rememberSelection, refreshHistoryState, restoreSelection],
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

  /** チェック: 保存して閲覧モードへ（戻るボタン表示） */
  const handleDone = useCallback(async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await flushAndSave();
      setEditMode(false);
      setColorOpen(false);
      setHighlightOpen(false);
      setAlignOpen(false);
      setStyleOpen(false);
      setInsertOpen(false);
      editorRef.current?.blur();
      setCanUndo(false);
      setCanRedo(false);
    } catch {
      // 保存失敗時も閲覧へは進める
      setEditMode(false);
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

  const enterEditMode = useCallback(() => {
    if (!autoSave || activeDocId === null) return;
    setEditMode(true);
    queueMicrotask(() => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      refreshHistoryState();
    });
  }, [activeDocId, autoSave, refreshHistoryState]);

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

  /** キーボード直上にツールバーが来るよう visualViewport に合わせる */
  useEffect(() => {
    if (!fullscreen || typeof window === "undefined") return;
    const sync = () => {
      const vv = window.visualViewport;
      if (vv) {
        setViewportBox({ top: vv.offsetTop, height: vv.height });
      } else {
        setViewportBox({ top: 0, height: window.innerHeight });
      }
    };
    sync();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    return () => {
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [fullscreen]);

  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el || activeDocId === null) return;
    const row = documentsRef.current.find((d) => d.id === activeDocId);
    const html = initialHtmlFromStored(row?.content ?? "");
    el.innerHTML = html;
    contentRef.current = sanitizeHtml(html);
    dirtyRef.current = false;
    setEditMode(Boolean(autoSave));
    discardOnLeaveRef.current = false;
    queueMicrotask(() => {
      setSaveHint("保存済み");
      refreshHistoryState();
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
  }, [refreshHistoryState, rememberSelection, scheduleFlush]);

  const onTitleChange = useCallback(
    (value: string) => {
      titleRef.current = value;
      onDocTitleChange(value);
      scheduleAutoSave();
    },
    [onDocTitleChange, scheduleAutoSave],
  );

  const onEditorBlur = useCallback(() => {
    rememberSelection();
    flushToParent();
    refreshHistoryState();
  }, [flushToParent, refreshHistoryState, rememberSelection]);

  const onEditorDoubleActivate = useCallback(() => {
    if (editMode) return;
    enterEditMode();
  }, [editMode, enterEditMode]);

  const onEditorTouchEnd = useCallback(() => {
    if (editMode) return;
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      enterEditMode();
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
  }, [editMode, enterEditMode]);

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

  const onPickImage = useCallback(
    async (file: File | null) => {
      if (!file || !onUploadImage || !autoSave) return;
      setImageErr("");
      setImageBusy(true);
      setInsertOpen(false);
      try {
        const url = await onUploadImage(file);
        insertImageAtCursor(url);
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
  const fullscreenStyle =
    fullscreen && viewportBox.height > 0
      ? { height: viewportBox.height, maxHeight: viewportBox.height }
      : undefined;

  return (
    <section
      className={
        fullscreen
          ? "flex h-full min-h-0 w-full flex-col overflow-hidden bg-white"
          : `flex min-h-[min(70dvh,720px)] flex-col overflow-hidden rounded-lg border border-[#E5E7EB] bg-white lg:min-h-[min(75dvh,780px)] ${
              showSidebar ? "lg:flex-row" : ""
            }`
      }
      style={fullscreenStyle}
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
                  ? saveHint
                  : canEditDoc
                    ? "ダブルタップで編集"
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
                    setHighlightOpen(false);
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
                className="hidden"
                onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
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
          className={
            fullscreen
              ? "min-h-0 flex-1 overflow-y-auto bg-white"
              : "min-h-0 flex-1 overflow-y-auto bg-[#F3F4F6] px-3 py-4 sm:px-6 sm:py-6"
          }
        >
          {activeDocId === null ? (
            <p className="py-12 text-center text-sm text-[#6B7280]">ドキュメントを選択するか、新規作成してください。</p>
          ) : (
            <div
              className={
                fullscreen
                  ? "mx-auto flex min-h-full w-full flex-col bg-white"
                  : "mx-auto w-full bg-white shadow-sm ring-1 ring-[#E5E7EB]"
              }
              style={fullscreen ? undefined : { maxWidth: PAGE_MAX_WIDTH }}
            >
              <div
                ref={editorRef}
                role="textbox"
                aria-multiline
                aria-readonly={!editing}
                tabIndex={0}
                contentEditable={editing}
                suppressContentEditableWarning
                onInput={onEditorInput}
                onBlur={onEditorBlur}
                onMouseUp={() => {
                  rememberSelection();
                  refreshHistoryState();
                }}
                onKeyUp={() => {
                  rememberSelection();
                  refreshHistoryState();
                }}
                onSelect={() => {
                  rememberSelection();
                  refreshHistoryState();
                }}
                onDoubleClick={onEditorDoubleActivate}
                onTouchEnd={onEditorTouchEnd}
                className={`gdocs-editor-body w-full flex-1 outline-none ${editing ? "" : "cursor-text"}`}
                style={{
                  minHeight: fullscreen ? "100%" : PAGE_MIN_HEIGHT,
                  padding: fullscreen
                    ? "1rem 1.25rem 1.5rem"
                    : "clamp(1.5rem, 4vw, 3.5rem) clamp(1.25rem, 5vw, 4rem)",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}
        </div>

        {/* 入力欄の直上（キーボードのすぐ上）に文字設定バー */}
        {editing ? (
        <div
          className={`relative z-10 shrink-0 border-t border-[#dadce0] bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.06)] ${
            fullscreen && viewportBox.height >= (typeof window !== "undefined" ? window.innerHeight - 8 : 9999)
              ? "pb-[max(0.25rem,env(safe-area-inset-bottom))]"
              : "pb-1"
          }`}
          role="toolbar"
          aria-label="文字の書式"
        >
          <div className="flex items-center gap-0.5 overflow-x-auto px-1.5 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ToolBtn
              title="太字"
              onClick={() => {
                exec("bold");
                scheduleAutoSave();
              }}
              disabled={!editing}
            >
              <Bold className="h-4 w-4" strokeWidth={2.75} />
            </ToolBtn>
            <ToolBtn
              title="斜体"
              onClick={() => {
                exec("italic");
                scheduleAutoSave();
              }}
              disabled={!editing}
            >
              <Italic className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn
              title="下線"
              onClick={() => {
                exec("underline");
                scheduleAutoSave();
              }}
              disabled={!editing}
            >
              <Underline className="h-4 w-4" />
            </ToolBtn>

            <span className="mx-0.5 h-5 w-px shrink-0 bg-[#dadce0]" aria-hidden />

            <div className="relative">
              <ToolBtn
                title="文字色"
                active={colorOpen}
                disabled={!editing}
                onClick={() => {
                  rememberSelection();
                  setColorOpen((v) => !v);
                  setHighlightOpen(false);
                  setAlignOpen(false);
                  setStyleOpen(false);
                }}
              >
                <span className="flex flex-col items-center leading-none">
                  <span className="text-[15px] font-semibold">A</span>
                  <span className="mt-0.5 h-[3px] w-4 rounded-sm bg-[#d93025]" aria-hidden />
                </span>
              </ToolBtn>
              {colorOpen ? (
                <>
                  <button type="button" className="fixed inset-0 z-40" aria-label="閉じる" onClick={() => setColorOpen(false)} />
                  <div className="absolute bottom-full left-0 z-50 mb-1 flex gap-1 rounded-lg border border-[#dadce0] bg-white p-2 shadow-lg">
                    {TEXT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`文字色 ${c}`}
                        className="h-7 w-7 rounded-full border border-[#dadce0]"
                        style={{ background: c }}
                        onClick={() => {
                          exec("foreColor", c);
                          setColorOpen(false);
                          scheduleAutoSave();
                        }}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            <div className="relative">
              <ToolBtn
                title="ハイライト"
                active={highlightOpen}
                disabled={!editing}
                onClick={() => {
                  rememberSelection();
                  setHighlightOpen((v) => !v);
                  setColorOpen(false);
                  setAlignOpen(false);
                  setStyleOpen(false);
                }}
              >
                <Highlighter className="h-4 w-4" />
              </ToolBtn>
              {highlightOpen ? (
                <>
                  <button type="button" className="fixed inset-0 z-40" aria-label="閉じる" onClick={() => setHighlightOpen(false)} />
                  <div className="absolute bottom-full left-0 z-50 mb-1 flex gap-1 rounded-lg border border-[#dadce0] bg-white p-2 shadow-lg">
                    {HIGHLIGHT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={c === "transparent" ? "ハイライトなし" : `ハイライト ${c}`}
                        className="h-7 w-7 rounded-md border border-[#dadce0]"
                        style={{
                          background:
                            c === "transparent"
                              ? "linear-gradient(to bottom right, transparent calc(50% - 1px), #d93025 calc(50% - 1px), #d93025 calc(50% + 1px), transparent calc(50% + 1px)), #fff"
                              : c,
                        }}
                        onClick={() => {
                          exec("hiliteColor", c === "transparent" ? "transparent" : c);
                          setHighlightOpen(false);
                          scheduleAutoSave();
                        }}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            <div className="relative">
              <ToolBtn
                title="配置"
                active={alignOpen}
                disabled={!editing}
                onClick={() => {
                  rememberSelection();
                  setAlignOpen((v) => !v);
                  setColorOpen(false);
                  setHighlightOpen(false);
                  setStyleOpen(false);
                }}
              >
                <AlignLeft className="h-4 w-4" />
              </ToolBtn>
              {alignOpen ? (
                <>
                  <button type="button" className="fixed inset-0 z-40" aria-label="閉じる" onClick={() => setAlignOpen(false)} />
                  <div className="absolute bottom-full left-0 z-50 mb-1 flex gap-0.5 rounded-lg border border-[#dadce0] bg-white p-1 shadow-lg">
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
                </>
              ) : null}
            </div>

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

            <div className="relative">
              <ToolBtn
                title="スタイル"
                active={styleOpen}
                disabled={!editing}
                onClick={() => {
                  rememberSelection();
                  setStyleOpen((v) => !v);
                  setColorOpen(false);
                  setHighlightOpen(false);
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
              {styleOpen ? (
                <>
                  <button type="button" className="fixed inset-0 z-40" aria-label="閉じる" onClick={() => setStyleOpen(false)} />
                  <div className="absolute bottom-full right-0 z-50 mb-1 min-w-[140px] rounded-lg border border-[#dadce0] bg-white py-1 shadow-lg">
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
                        className="block w-full px-4 py-2.5 text-left text-[14px] text-[#202124] hover:bg-[#f1f3f4]"
                        onClick={() => applyBlockStyle(v)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
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
