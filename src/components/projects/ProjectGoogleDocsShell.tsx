"use client";

import DOMPurify from "dompurify";
import { ArrowLeft } from "lucide-react";
import {
  useCallback,
  useEffect,
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

type Props = {
  activeDocId: string | null;
  documents: Array<{ id: string; content: string }>;
  docTitle: string;
  onDocTitleChange: (title: string) => void;
  onDocContentChange: (html: string) => void;
  onSave: () => void | Promise<void>;
  saving?: boolean;
  wordCount: number;
  updatedByLabel: string;
  sidebar?: ReactNode;
  hideSidebar?: boolean;
  onBack?: () => void;
};

export function ProjectGoogleDocsShell({
  activeDocId,
  documents,
  docTitle,
  onDocTitleChange,
  onDocContentChange,
  onSave,
  saving,
  wordCount,
  updatedByLabel,
  sidebar,
  hideSidebar = false,
  onBack,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const documentsRef = useRef(documents);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveHint, setSaveHint] = useState("保存済み");

  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

  const exec = useCallback((command: string, value?: string) => {
    editorRef.current?.focus();
    try {
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand(command, false, value);
    } catch {
      /* noop */
    }
  }, []);

  const flushToParent = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    onDocContentChange(sanitizeHtml(el.innerHTML));
  }, [onDocContentChange]);

  const scheduleFlush = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      flushToParent();
      debounceRef.current = null;
    }, 400);
  }, [flushToParent]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el || activeDocId === null) return;
    const row = documentsRef.current.find((d) => d.id === activeDocId);
    el.innerHTML = initialHtmlFromStored(row?.content ?? "");
    queueMicrotask(() => setSaveHint("保存済み"));
  }, [activeDocId]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || activeDocId === null) return;
    const row = documentsRef.current.find((d) => d.id === activeDocId);
    if (!row?.content?.trim()) return;
    const visuallyEmpty = !el.textContent?.replace(/\u00a0/g, "").trim();
    if (visuallyEmpty) el.innerHTML = initialHtmlFromStored(row.content);
  }, [documents, activeDocId]);

  const onEditorInput = useCallback(() => {
    scheduleFlush();
    setSaveHint("編集中…");
  }, [scheduleFlush]);

  const handleSave = useCallback(async () => {
    flushToParent();
    await onSave();
    setSaveHint("保存済み");
  }, [flushToParent, onSave]);

  const onStyleChange = (e: FormEvent<HTMLSelectElement>) => {
    const v = e.currentTarget.value;
    if (v === "p") exec("formatBlock", "<p>");
    else if (v === "h1") exec("formatBlock", "<h1>");
    else if (v === "h2") exec("formatBlock", "<h2>");
    else if (v === "h3") exec("formatBlock", "<h3>");
    e.currentTarget.value = "p";
  };

  const insertLink = () => {
    const url = typeof window !== "undefined" ? window.prompt("リンクの URL", "https://") : null;
    if (url) exec("createLink", url);
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
              onClick={onBack}
              className="mr-1 flex h-8 w-8 items-center justify-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4]"
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
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || activeDocId === null}
            className="ml-auto rounded-md bg-[#5E6AD2] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>

        <div className="border-b border-[#E5E7EB] bg-white px-3 py-2">
          <input
            className="w-full border-0 bg-transparent text-lg font-semibold text-[#1A1A1A] outline-none placeholder:text-[#9CA3AF]"
            value={docTitle}
            onChange={(e) => onDocTitleChange(e.target.value)}
            placeholder="無題のドキュメント"
            disabled={activeDocId === null}
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
                contentEditable
                suppressContentEditableWarning
                onInput={onEditorInput}
                onBlur={() => flushToParent()}
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
}
