"use client";

import DOMPurify from "dompurify";
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

/** Google Docs に寄せた配色・寸法 */
const C = {
  blue: "#1a73e8",
  blueHover: "#1765cc",
  barBg: "#f8f9fa",
  border: "#dadce0",
  toolbarHover: "#f1f3f4",
  iconMuted: "#5f6368",
  pageShadow: "0 1px 2px rgba(60,64,67,.3), 0 2px 6px 2px rgba(60,64,67,.15)",
  canvasBg: "#f8f9fa",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 既存のプレーンテキストを HTML に（保存済み HTML はそのまま通す） */
export function initialHtmlFromStored(content: string): string {
  const t = content.trim();
  if (!t) return "<p><br /></p>";
  if (t.startsWith("<")) {
    const sample = t.slice(0, 80).toLowerCase();
    if (/<(p|div|h[1-6]|ul|ol|span|br)\b/.test(sample)) return content;
  }
  const paragraphs = content.split(/\n\n+/);
  const body = paragraphs
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
    .join("");
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

function TbIcon({
  children,
  title,
  onClick,
  disabled,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[#5f6368] hover:bg-[#f1f3f4] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function TbDivider() {
  return <span className="mx-1 h-6 w-px shrink-0 bg-[#dadce0]" aria-hidden />;
}

function MenuBar() {
  const items = ["ファイル", "編集", "表示", "挿入", "書式", "ツール", "ヘルプ"];
  return (
    <div className="flex min-h-9 items-center gap-1 border-b px-2 py-1 text-[13px] text-[#202124]" style={{ borderColor: C.border, background: C.barBg }}>
      {items.map((label) => (
        <button
          key={label}
          type="button"
          className="rounded px-2 py-1.5 text-[13px] font-normal text-[#202124] hover:bg-black/[0.06]"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

type Props = {
  activeDocId: string | null;
  /** エディタ初期表示用（DB / 一覧のスナップショット） */
  documents: Array<{ id: string; content: string }>;
  docTitle: string;
  onDocTitleChange: (title: string) => void;
  onDocContentChange: (html: string) => void;
  onSave: () => void | Promise<void>;
  saving?: boolean;
  /** フッター表示用 */
  wordCount: number;
  updatedByLabel: string;
  sidebar: ReactNode;
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
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const documentsRef = useRef(documents);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveHint, setSaveHint] = useState("すべての変更をクラウドに保存しました");

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
    const raw = el.innerHTML;
    onDocContentChange(sanitizeHtml(raw));
  }, [onDocContentChange]);

  const scheduleFlush = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      flushToParent();
      debounceRef.current = null;
    }, 450);
  }, [flushToParent]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  /** 別ドキュメントに切り替えたときにエディタを差し替え */
  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el || activeDocId === null) return;
    const row = documentsRef.current.find((d) => d.id === activeDocId);
    el.innerHTML = initialHtmlFromStored(row?.content ?? "");
    queueMicrotask(() => setSaveHint("すべての変更をクラウドに保存しました"));
  }, [activeDocId]);

  /** 初回ロードで一覧が後から届いたとき（空エディタを埋める） */
  useEffect(() => {
    const el = editorRef.current;
    if (!el || activeDocId === null) return;
    const row = documentsRef.current.find((d) => d.id === activeDocId);
    if (!row?.content?.trim()) return;
    const visuallyEmpty = !el.textContent?.replace(/\u00a0/g, "").trim();
    if (visuallyEmpty) {
      el.innerHTML = initialHtmlFromStored(row.content);
    }
  }, [documents, activeDocId]);

  const onEditorInput = useCallback(() => {
    scheduleFlush();
    setSaveHint("保存しています…");
  }, [scheduleFlush]);

  const handleSave = useCallback(async () => {
    flushToParent();
    await onSave();
    setSaveHint("すべての変更をクラウドに保存しました");
  }, [flushToParent, onSave]);

  const zoomLabel = useMemo(() => "100%", []);

  const styleSelectId = "gdocs-style-select";
  const fontSelectId = "gdocs-font-select";
  const sizeSelectId = "gdocs-size-select";

  const onStyleChange = (e: FormEvent<HTMLSelectElement>) => {
    const v = e.currentTarget.value;
    if (v === "normal" || v === "p") exec("formatBlock", "<p>");
    else if (v === "h1") exec("formatBlock", "<h1>");
    else if (v === "h2") exec("formatBlock", "<h2>");
    else if (v === "h3") exec("formatBlock", "<h3>");
    e.currentTarget.value = "normal";
  };

  const onFontChange = (e: FormEvent<HTMLSelectElement>) => {
    exec("fontName", e.currentTarget.value);
  };

  const onSizeChange = (e: FormEvent<HTMLSelectElement>) => {
    const map: Record<string, string> = {
      "1": "1",
      "2": "2",
      "3": "3",
      "4": "4",
      "5": "5",
      "6": "6",
      "7": "7",
    };
    const k = map[e.currentTarget.value];
    if (k) exec("fontSize", k);
  };

  const insertLink = () => {
    const url = typeof window !== "undefined" ? window.prompt("リンクの URL を入力", "https://") : null;
    if (url) exec("createLink", url);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-0 md:grid md:min-h-[min(72dvh,720px)] md:grid-cols-[minmax(0,260px)_1fr] md:gap-3">
      <div className="max-h-[min(38vh,280px)] min-h-0 shrink-0 overflow-y-auto rounded-none border-0 bg-white md:max-h-none md:overflow-hidden md:rounded-lg md:border md:border-[#dadce0] md:p-3 md:shadow-sm">
        {sidebar}
      </div>

      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-none border-0 bg-white md:rounded-lg md:border md:border-[#dadce0] md:shadow-sm">
        <MenuBar />

        {/* ツールバー 1 段目 */}
        <div
          className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1"
          style={{ borderColor: C.border, background: "#fff" }}
        >
          <TbIcon title="元に戻す (⌘Z)" onClick={() => exec("undo")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
            </svg>
          </TbIcon>
          <TbIcon title="やり直す (⌘Y)" onClick={() => exec("redo")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z" />
            </svg>
          </TbIcon>
          <TbDivider />
          <TbIcon title="印刷 (⌘P)" onClick={() => typeof window !== "undefined" && window.print()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-8c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" />
            </svg>
          </TbIcon>
          <TbIcon title="コピー" onClick={() => exec("copy")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
            </svg>
          </TbIcon>
          <div className="mx-2 flex items-center gap-1">
            <button
              type="button"
              className="flex h-8 items-center rounded border bg-white px-2 text-[13px] text-[#202124]"
              style={{ borderColor: C.border }}
            >
              {zoomLabel}
              <span className="ml-1 text-[10px] text-[#5f6368]">▼</span>
            </button>
          </div>
        </div>

        {/* ツールバー 2 段目（書式） */}
        <div
          className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5"
          style={{ borderColor: C.border, background: "#fff" }}
        >
          <label htmlFor={styleSelectId} className="sr-only">
            スタイル
          </label>
          <select
            id={styleSelectId}
            defaultValue="normal"
            onChange={onStyleChange}
            className="h-8 max-w-[140px] rounded border bg-white px-2 text-[13px] text-[#202124]"
            style={{ borderColor: C.border }}
          >
            <option value="normal">標準テキスト</option>
            <option value="p">本文</option>
            <option value="h1">見出し 1</option>
            <option value="h2">見出し 2</option>
            <option value="h3">見出し 3</option>
          </select>

          <label htmlFor={fontSelectId} className="sr-only">
            フォント
          </label>
          <select
            id={fontSelectId}
            defaultValue="Arial"
            onChange={onFontChange}
            className="h-8 max-w-[130px] rounded border bg-white px-2 text-[13px]"
            style={{ borderColor: C.border }}
          >
            <option value="Arial">Arial</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Courier New">Courier New</option>
            <option value="Georgia">Georgia</option>
            <option value="Verdana">Verdana</option>
            <option value="Roboto">Roboto</option>
          </select>

          <label htmlFor={sizeSelectId} className="sr-only">
            サイズ
          </label>
          <select
            id={sizeSelectId}
            defaultValue="3"
            onChange={onSizeChange}
            className="h-8 w-14 rounded border bg-white px-1 text-[13px]"
            style={{ borderColor: C.border }}
          >
            <option value="1">8</option>
            <option value="2">10</option>
            <option value="3">11</option>
            <option value="4">12</option>
            <option value="5">14</option>
            <option value="6">18</option>
            <option value="7">24</option>
          </select>

          <TbDivider />

          <TbIcon title="太字 (⌘B)" onClick={() => exec("bold")}>
            <span className="text-sm font-bold">B</span>
          </TbIcon>
          <TbIcon title="斜体 (⌘I)" onClick={() => exec("italic")}>
            <span className="text-sm italic">I</span>
          </TbIcon>
          <TbIcon title="下線 (⌘U)" onClick={() => exec("underline")}>
            <span className="text-sm underline">U</span>
          </TbIcon>
          <TbIcon title="取り消し線" onClick={() => exec("strikeThrough")}>
            <span className="text-sm line-through">S</span>
          </TbIcon>

          <TbDivider />

          <TbIcon title="テキストの色" onClick={() => exec("foreColor", "#000000")}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
              <path fill="#202124" d="M11 3L5.5 17h2l1.12-3h6.76l1.12 3h2L13 3h-2zm-1.38 9l2.38-6.33 2.38 6.33H9.62z" />
            </svg>
          </TbIcon>
          <TbIcon title="ハイライトの色" onClick={() => exec("hiliteColor", "#ffff00")}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
              <path fill="#fbbc04" d="M17.66 8L12 2.35 6.34 8C4.78 9.56 4 11.64 4 13.64s.79 4.08 2.34 5.64 3.62 2.35 5.66 2.35 4.11-.79 5.66-2.35 2.34-3.62 2.34-5.64-.78-4.08-2.34-5.64z" />
            </svg>
          </TbIcon>

          <TbDivider />

          <TbIcon title="リンク (⌘K)" onClick={insertLink}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
            </svg>
          </TbIcon>

          <TbDivider />

          <TbIcon title="左揃え" onClick={() => exec("justifyLeft")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z" />
            </svg>
          </TbIcon>
          <TbIcon title="中央揃え" onClick={() => exec("justifyCenter")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z" />
            </svg>
          </TbIcon>
          <TbIcon title="右揃え" onClick={() => exec("justifyRight")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z" />
            </svg>
          </TbIcon>
          <TbIcon title="両端揃え" onClick={() => exec("justifyFull")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M3 21h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18V7H3v2zm0-6v2h18V3H3z" />
            </svg>
          </TbIcon>

          <TbDivider />

          <TbIcon title="箇条書き" onClick={() => exec("insertUnorderedList")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 5 4 5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z" />
            </svg>
          </TbIcon>
          <TbIcon title="番号付きリスト" onClick={() => exec("insertOrderedList")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z" />
            </svg>
          </TbIcon>
          <TbIcon title="インデントを減らす" onClick={() => exec("outdent")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M11 17h10v-2H11v2zm-8-5l4 4V8l-4 4zm0 9h18v-2H3v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z" />
            </svg>
          </TbIcon>
          <TbIcon title="インデントを増やす" onClick={() => exec("indent")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M3 21h18v-2H3v2zm0-8h18v-2H3v2zm0-8v2h18V5H3zm8 4h10V7H11v2zm0 4h10v-2H11v2zM7 12l-4 4V8l4 4z" />
            </svg>
          </TbIcon>

          <TbDivider />

          <TbIcon title="書式をクリア" onClick={() => exec("removeFormat")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M6 5H3v14h9v-9H8V9H6V5zm9 3h5v2h-5V8zm0 5h5v2h-5v-2zM15 3v2h5v2h-5v2h5v2h-7V3h2z" />
            </svg>
          </TbIcon>
        </div>

        {/* タイトル行（Docs のドキュメント見出し帯） */}
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2" style={{ borderColor: C.border, background: "#fff" }}>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-white"
            style={{ borderColor: C.border }}
            aria-hidden
          >
            <svg width="28" height="28" viewBox="0 0 48 48">
              <path fill={C.blue} d="M14 4h20l10 10v26a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z" />
              <path fill="#fff" d="M22 14h10v4H22zm0 8h14v4H22zm0 8h10v4H22z" opacity=".9" />
            </svg>
          </div>
          <input
            className="min-w-0 flex-1 border-0 bg-transparent text-[18px] text-[#202124] outline-none placeholder:text-[#80868b]"
            style={{ fontFamily: '"Google Sans", Roboto, Arial, sans-serif' }}
            value={docTitle}
            onChange={(e) => onDocTitleChange(e.target.value)}
            placeholder="無題のドキュメント"
            aria-label="ドキュメントのタイトル"
          />
          <button type="button" className="rounded p-2 text-[#5f6368] hover:bg-[#f1f3f4]" title="スター" aria-label="スター">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
          <button type="button" className="rounded p-2 text-[#5f6368] hover:bg-[#f1f3f4]" title="フォルダで開く" aria-label="フォルダ">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
            </svg>
          </button>
          <div className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-auto sm:ml-auto">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#188038" aria-hidden>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <span className="truncate text-[13px] text-[#188038]">{saveHint}</span>
          </div>
        </div>

        {/* ルーラー */}
        <div className="relative h-6 overflow-hidden border-b bg-[#f8f9fa]" style={{ borderColor: C.border }}>
          <div className="absolute inset-x-0 top-3 flex h-3 justify-between px-[96px] text-[0]">
            {Array.from({ length: 17 }).map((_, i) => (
              <span key={i} className="inline-block w-px bg-[#bdc1c6]" />
            ))}
          </div>
          <div className="pointer-events-none absolute left-[96px] top-1 h-0 w-0 border-x-8 border-x-transparent border-b-[6px] border-b-[#666]" />
          <div className="pointer-events-none absolute right-[96px] top-1 h-0 w-0 border-x-8 border-x-transparent border-b-[6px] border-b-[#666]" />
        </div>

        {/* キャンバス */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4 pb-8" style={{ background: C.canvasBg }}>
          <div className="mx-auto w-full max-w-[816px]" style={{ boxShadow: C.pageShadow }}>
            <div
              ref={editorRef}
              role="textbox"
              aria-multiline
              tabIndex={0}
              contentEditable={activeDocId !== null}
              suppressContentEditableWarning
              onInput={onEditorInput}
              onBlur={() => flushToParent()}
              className="gdocs-editor-body min-h-[min(70vh,560px)] w-full border border-[#dadce0] bg-white px-4 pb-12 pt-8 outline-none sm:min-h-[720px] sm:px-12 sm:pb-16 sm:pt-12 md:px-[72px] md:pb-[72px] md:pt-[56px] print:border-0 print:shadow-none"
            />
          </div>
        </div>

        {/* ステータスバー */}
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-[12px]"
          style={{ borderColor: C.border, background: "#fff", color: "#5f6368" }}
        >
          <p className="min-w-0 truncate">
            最終更新: {updatedByLabel} ・ 単語数 {wordCount}
          </p>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">{saveHint}</span>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || activeDocId === null}
              className="rounded px-4 py-1.5 text-[13px] font-medium text-white shadow-sm disabled:opacity-50"
              style={{ background: C.blue }}
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
