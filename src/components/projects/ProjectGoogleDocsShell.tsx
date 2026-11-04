"use client";

import DOMPurify from "dompurify";
import { ArrowLeft } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { a4MinHeightForWidth } from "@/lib/projects/documents";

const PAGE_MAX_WIDTH = 680;
const PAGE_MIN_HEIGHT = a4MinHeightForWidth(PAGE_MAX_WIDTH);
const AUTOSAVE_MS = 800;

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
    if (/<(p|div|h[1-6]|ul|ol|span|br)\b/.test(sample)) return content;
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
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "style"],
  });
}

function ToolBtn({
  children,
  title,
  onClick,
  disabled,
  active,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm text-[#374151] transition hover:bg-[#F3F4F6] disabled:opacity-40 ${
        active ? "bg-[#EEF2FF] text-[#4338CA]" : ""
      }`}
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
  },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);
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
  const [saveHint, setSaveHint] = useState("保存済み");
  const [leaving, setLeaving] = useState(false);

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

  const exec = useCallback((command: string, value?: string) => {
    editorRef.current?.focus();
    try {
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand(command, false, value);
    } catch {
      /* noop */
    }
  }, []);

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

  const handleBack = useCallback(async () => {
    if (!onBack || leaving) return;
    setLeaving(true);
    try {
      await flushAndSave();
    } catch {
      // 保存失敗でも一覧へは戻す（ヒントは flushAndSave 内で更新済み）
    }
    onBack();
  }, [flushAndSave, leaving, onBack]);

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

  // アンマウント / ドキュメント切替前に未保存分を送る（デバウンス待ちも含む）
  useEffect(() => {
    return () => {
      if (flushDebounceRef.current) clearTimeout(flushDebounceRef.current);
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      if (!autoSave || !activeDocIdRef.current) return;
      const html = readEditorHtml();
      if (!dirtyRef.current && html === contentRef.current) return;
      void onSaveRef.current({
        title: titleRef.current,
        content: html,
      });
    };
  }, [autoSave, activeDocId, readEditorHtml]);

  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el || activeDocId === null) return;
    const row = documentsRef.current.find((d) => d.id === activeDocId);
    const html = initialHtmlFromStored(row?.content ?? "");
    el.innerHTML = html;
    contentRef.current = sanitizeHtml(html);
    dirtyRef.current = false;
    queueMicrotask(() => setSaveHint("保存済み"));
  }, [activeDocId]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || activeDocId === null) return;
    if (dirtyRef.current) return;
    const row = documentsRef.current.find((d) => d.id === activeDocId);
    if (!row?.content?.trim()) return;
    const visuallyEmpty = !el.textContent?.replace(/\u00a0/g, "").trim();
    if (visuallyEmpty) {
      el.innerHTML = initialHtmlFromStored(row.content);
      contentRef.current = sanitizeHtml(el.innerHTML);
    }
  }, [documents, activeDocId]);

  const onEditorInput = useCallback(() => {
    scheduleFlush();
    setSaveHint("編集中…");
  }, [scheduleFlush]);

  const onTitleChange = useCallback(
    (value: string) => {
      titleRef.current = value;
      onDocTitleChange(value);
      scheduleAutoSave();
    },
    [onDocTitleChange, scheduleAutoSave],
  );

  const onEditorBlur = useCallback(() => {
    flushToParent();
    if (dirtyRef.current) void persistNow();
  }, [flushToParent, persistNow]);

  const onStyleChange = (e: FormEvent<HTMLSelectElement>) => {
    const v = e.currentTarget.value;
    if (v === "p") exec("formatBlock", "<p>");
    else if (v === "h1") exec("formatBlock", "<h1>");
    else if (v === "h2") exec("formatBlock", "<h2>");
    else if (v === "h3") exec("formatBlock", "<h3>");
    e.currentTarget.value = "p";
    scheduleAutoSave();
  };

  const insertLink = () => {
    const url = typeof window !== "undefined" ? window.prompt("リンクの URL", "https://") : null;
    if (url) {
      exec("createLink", url);
      scheduleAutoSave();
    }
  };

  const statusLine = useMemo(() => {
    if (activeDocId === null) return "ドキュメントを選択してください";
    return `最終更新: ${updatedByLabel} · ${wordCount} 語 · ${saveHint}`;
  }, [activeDocId, saveHint, updatedByLabel, wordCount]);

  const showSidebar = !hideSidebar && sidebar;

  return (
    <section
      className={`flex min-h-[min(70dvh,720px)] flex-col overflow-hidden rounded-lg border border-[#E5E7EB] bg-white lg:min-h-[min(75dvh,780px)] ${
        showSidebar ? "lg:flex-row" : ""
      }`}
    >
      {showSidebar ? (
        <aside className="flex max-h-[200px] shrink-0 flex-col border-b border-[#E5E7EB] bg-[#FAFAFA] lg:max-h-none lg:w-56 lg:shrink-0 lg:border-b-0 lg:border-r xl:w-60">
          {sidebar}
        </aside>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-1 border-b border-[#E5E7EB] bg-white px-2 py-1.5">
          {onBack ? (
            <button
              type="button"
              onClick={() => void handleBack()}
              disabled={leaving}
              className="mr-1 flex h-8 w-8 items-center justify-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4] disabled:opacity-50"
              aria-label="ドキュメント一覧に戻る"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : null}
          <ToolBtn title="元に戻す" onClick={() => exec("undo")} disabled={activeDocId === null}>
            ↶
          </ToolBtn>
          <ToolBtn title="やり直し" onClick={() => exec("redo")} disabled={activeDocId === null}>
            ↷
          </ToolBtn>
          <span className="mx-1 h-5 w-px bg-[#E5E7EB]" aria-hidden />
          <label className="sr-only">見出しスタイル</label>
          <select
            defaultValue="p"
            onChange={onStyleChange}
            disabled={activeDocId === null}
            className="h-8 rounded-md border border-[#E5E7EB] bg-white px-2 text-[12px] text-[#374151] disabled:opacity-40"
          >
            <option value="p">本文</option>
            <option value="h1">見出し1</option>
            <option value="h2">見出し2</option>
            <option value="h3">見出し3</option>
          </select>
          <span className="mx-1 h-5 w-px bg-[#E5E7EB]" aria-hidden />
          <ToolBtn title="太字" onClick={() => exec("bold")} disabled={activeDocId === null}>
            <strong>B</strong>
          </ToolBtn>
          <ToolBtn title="斜体" onClick={() => exec("italic")} disabled={activeDocId === null}>
            <em>I</em>
          </ToolBtn>
          <ToolBtn title="下線" onClick={() => exec("underline")} disabled={activeDocId === null}>
            <span className="underline">U</span>
          </ToolBtn>
          <ToolBtn title="箇条書き" onClick={() => exec("insertUnorderedList")} disabled={activeDocId === null}>
            •
          </ToolBtn>
          <ToolBtn title="番号付き" onClick={() => exec("insertOrderedList")} disabled={activeDocId === null}>
            1.
          </ToolBtn>
          <ToolBtn title="リンク" onClick={insertLink} disabled={activeDocId === null}>
            🔗
          </ToolBtn>
          <p className="ml-auto px-2 text-[11px] font-medium text-[#6B7280]" aria-live="polite">
            {activeDocId === null ? "" : saveHint}
          </p>
        </div>

        <div className="border-b border-[#E5E7EB] bg-white px-3 py-2">
          <input
            className="w-full border-0 bg-transparent text-lg font-semibold text-[#1A1A1A] outline-none placeholder:text-[#9CA3AF]"
            value={docTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={() => {
              if (dirtyRef.current) void persistNow();
            }}
            placeholder="無題のドキュメント"
            disabled={activeDocId === null || !autoSave}
            aria-label="タイトル"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#F3F4F6] px-3 py-4 sm:px-6 sm:py-6">
          {activeDocId === null ? (
            <p className="py-12 text-center text-sm text-[#6B7280]">ドキュメントを選択するか、新規作成してください。</p>
          ) : (
            <div
              className="mx-auto w-full bg-white shadow-sm ring-1 ring-[#E5E7EB]"
              style={{ maxWidth: PAGE_MAX_WIDTH }}
            >
              <div
                ref={editorRef}
                role="textbox"
                aria-multiline
                tabIndex={0}
                contentEditable={autoSave}
                suppressContentEditableWarning
                onInput={onEditorInput}
                onBlur={onEditorBlur}
                className="gdocs-editor-body w-full outline-none"
                style={{
                  minHeight: PAGE_MIN_HEIGHT,
                  padding: "clamp(1.5rem, 4vw, 3.5rem) clamp(1.25rem, 5vw, 4rem)",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E7EB] bg-white px-3 py-2 text-[11px] text-[#6B7280]">
          <p className="min-w-0 truncate">{statusLine}</p>
        </footer>
      </div>
    </section>
  );
});
