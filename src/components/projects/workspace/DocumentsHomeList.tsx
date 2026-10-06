"use client";

import { useCallback, useMemo, useState, type ComponentType } from "react";
import { LayoutGrid, Menu, MoreVertical, Plus, Search, Trash2 } from "lucide-react";
import type { ProjectDocumentRow } from "@/lib/projects/documents";

function DocIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <path fill="#4285F4" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
      <path fill="#A1C2FA" d="M13 3.5L18.5 9H14c-.55 0-1-.45-1-1V3.5z" />
    </svg>
  );
}

function GoogleFab({ disabled, creating, onClick, label }: { disabled?: boolean; creating?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      disabled={disabled || creating}
      onClick={onClick}
      className="fixed bottom-[calc(var(--bottom-nav-clearance)+0.75rem)] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.18)] transition hover:shadow-[0_4px_14px_rgba(0,0,0,0.22)] disabled:opacity-50 md:bottom-8"
      aria-label={label}
    >
      <span className="text-[28px] font-light leading-none" aria-hidden>
        <span className="bg-gradient-to-br from-[#ea4335] via-[#fbbc04] to-[#34a853] bg-clip-text text-transparent">+</span>
      </span>
    </button>
  );
}

function formatDocDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type Props = {
  documents: Array<Pick<ProjectDocumentRow, "id" | "title" | "updated_at">>;
  canEdit: boolean;
  docCreating: boolean;
  userInitial?: string;
  selectedDocId: string | null;
  onSelectDoc: (id: string | null) => void;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onDelete?: (id: string) => void;
  heading?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  untitledLabel?: string;
  noun?: string;
  fabLabel?: string;
  icon?: ComponentType;
  /** library: 新規作成を見出し横に出し、行の右端のゴミ箱で削除する */
  variant?: "docs" | "library";
};

export function DocumentsHomeList({
  documents,
  canEdit,
  docCreating,
  userInitial = "?",
  selectedDocId,
  onSelectDoc,
  onOpen,
  onCreate,
  onDelete,
  heading = "ドキュメント",
  searchPlaceholder = "ドキュメントを検索",
  emptyLabel = "ドキュメントがありません",
  untitledLabel = "無題のドキュメント",
  noun = "ドキュメント",
  fabLabel = "新しいドキュメント",
  icon: Icon = DocIcon,
  variant = "docs",
}: Props) {
  const [query, setQuery] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectHint, setSelectHint] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((d) => (d.title || "無題のドキュメント").toLowerCase().includes(q));
  }, [documents, query]);

  const confirmTarget = useMemo(
    () => (confirmDeleteId ? documents.find((d) => d.id === confirmDeleteId) : null),
    [confirmDeleteId, documents],
  );

  const requestDelete = useCallback(() => {
    if (!onDelete) return;
    if (!selectedDocId) {
      setSelectHint(true);
      window.setTimeout(() => setSelectHint(false), 3500);
      return;
    }
    setConfirmDeleteId(selectedDocId);
  }, [onDelete, selectedDocId]);

  return (
    <div
      className={
        variant === "library"
          ? "relative mt-6 flex min-h-[min(72dvh,720px)] flex-col bg-white"
          : "relative -mx-4 -mt-4 flex min-h-[min(72dvh,720px)] flex-col bg-white sm:-mx-0 sm:mt-0"
      }
    >
      <div
        className={`sticky top-0 z-20 bg-white ${
          variant === "library" ? "px-1 pb-2 pt-2" : "border-b border-[#e8eaed] px-3 pb-2 pt-1 sm:px-4"
        }`}
      >
        <div className={`flex items-center justify-between gap-3 px-1 ${variant === "library" ? "mb-5" : "mb-2"}`}>
          <h2 className="text-[20px] font-normal text-[#202124]">{heading}</h2>
          {variant === "library" && canEdit ? (
            <button
              type="button"
              disabled={docCreating}
              onClick={onCreate}
              aria-label={fabLabel}
              className="moni-btn-primary inline-flex h-11 shrink-0 items-center gap-1.5 !rounded-xl !px-3.5 !text-[13px] disabled:opacity-50"
            >
              <Plus className="h-5 w-5" aria-hidden />
              <span>{docCreating ? "作成中…" : fabLabel}</span>
            </button>
          ) : canEdit && onDelete ? (
            <button
              type="button"
              onClick={requestDelete}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#d93025] bg-white px-4 py-2 text-[14px] font-semibold text-[#d93025] shadow-sm transition hover:bg-[#fce8e6]"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              削除
            </button>
          ) : null}
        </div>

        {selectHint ? (
          <p className="mb-2 rounded-lg bg-[#fef7e0] px-3 py-2 text-[13px] text-[#b06000]">
            削除する行をタップして選んでから、右上の「削除」を押してください。
          </p>
        ) : null}

        <div className={`flex items-center gap-2 rounded-full bg-[#f1f3f4] px-3 py-2.5 ${variant === "library" ? "mt-1" : ""}`}>
          {variant === "docs" ? <Menu className="h-5 w-5 shrink-0 text-[#5f6368]" aria-hidden /> : null}
          <Search className="h-4 w-4 shrink-0 text-[#5f6368]" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-[#202124] outline-none placeholder:text-[#5f6368]"
            aria-label="ドキュメントを検索"
          />
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a73e8] text-xs font-bold text-white">
            {userInitial}
          </span>
        </div>

        {variant === "docs" ? (
          <div className="mt-3 flex items-center justify-between px-1">
            <p className="text-[14px] text-[#202124]">最近更新</p>
            <LayoutGrid className="h-5 w-5 text-[#5f6368]" aria-hidden />
          </div>
        ) : null}
      </div>

      {variant === "library" ? null : selectedDocId ? (
        <p className="border-b border-[#e8f0fe] bg-[#e8f0fe] px-4 py-2 text-[13px] text-[#174ea6]">
          選択中 — 右上の「削除」で確認画面が開きます
        </p>
      ) : (
        <p className="border-b border-[#f1f3f4] bg-[#f8f9fa] px-4 py-2 text-[12px] text-[#5f6368]">
          行をタップで選択 · 「開く」で編集
        </p>
      )}

      <ul className={`min-h-0 flex-1 overflow-y-auto pb-24 ${variant === "library" ? "mt-6 space-y-1" : "divide-y divide-[#e8eaed]"}`}>
        {filtered.length === 0 ? (
          <li className="px-4 py-16 text-center">
            {query.trim() ? (
              <p className="text-[14px] text-[#5f6368]">{`該当する${noun}がありません`}</p>
            ) : (
              <div className="mx-auto max-w-sm">
                <p className="text-[14px] leading-relaxed text-[#5f6368]">{emptyLabel}</p>
                {canEdit && variant === "library" ? (
                  <button
                    type="button"
                    disabled={docCreating}
                    onClick={onCreate}
                    className="moni-btn-primary mt-4 inline-flex items-center gap-1.5 !rounded-xl !px-4 !py-2.5 !text-[13px]"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    {docCreating ? "作成中…" : fabLabel}
                  </button>
                ) : null}
              </div>
            )}
          </li>
        ) : (
          filtered.map((d) => {
            const selected = selectedDocId === d.id;
            return (
              <li key={d.id} className="relative flex items-center gap-1 pr-2">
                <button
                  type="button"
                  onClick={() => (variant === "library" ? onOpen(d.id) : onSelectDoc(selected ? null : d.id))}
                  className={`flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left transition sm:px-4 ${
                    selected && variant === "docs" ? "bg-[#e8f0fe]" : "hover:bg-[#f8f9fa] active:bg-[#f1f3f4]"
                  }`}
                >
                  <Icon />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[15px] ${selected && variant === "docs" ? "font-medium text-[#174ea6]" : "font-normal text-[#202124]"}`}>
                      {d.title?.trim() || untitledLabel}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-[#5f6368]">{formatDocDate(d.updated_at)}</span>
                  </span>
                </button>
                {variant === "docs" ? (
                  <button
                    type="button"
                    onClick={() => onOpen(d.id)}
                    className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium text-[#1a73e8] hover:bg-[#e8f0fe]"
                  >
                    開く
                  </button>
                ) : null}
                {variant === "library" && canEdit && onDelete ? (
                  <button
                    type="button"
                    className="shrink-0 rounded-full p-2 text-[#d93025] hover:bg-[#fce8e6]"
                    aria-label="削除"
                    onClick={() => setConfirmDeleteId(d.id)}
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="shrink-0 rounded-full p-2 text-[#5f6368] hover:bg-[#f1f3f4]"
                    aria-label="その他"
                    onClick={() => setMenuId(menuId === d.id ? null : d.id)}
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>
                )}
                {menuId === d.id ? (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-40"
                      aria-label="メニューを閉じる"
                      onClick={() => setMenuId(null)}
                    />
                    <div className="absolute right-2 top-full z-50 min-w-[140px] rounded-lg border border-[#dadce0] bg-white py-1 shadow-lg">
                      <button
                        type="button"
                        className="block w-full px-4 py-2.5 text-left text-[14px] text-[#202124] hover:bg-[#f1f3f4]"
                        onClick={() => {
                          setMenuId(null);
                          onOpen(d.id);
                        }}
                      >
                        開く
                      </button>
                      {canEdit && onDelete ? (
                        <button
                          type="button"
                          className="block w-full px-4 py-2.5 text-left text-[14px] text-[#d93025] hover:bg-[#fce8e6]"
                          onClick={() => {
                            setMenuId(null);
                            setConfirmDeleteId(d.id);
                          }}
                        >
                          削除
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </li>
            );
          })
        )}
      </ul>

      {canEdit && variant === "docs" ? <GoogleFab disabled={!canEdit} creating={docCreating} onClick={onCreate} label={fabLabel} /> : null}

      {confirmDeleteId && confirmTarget ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal
            aria-labelledby="doc-delete-title"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          >
            <h3 id="doc-delete-title" className="text-base font-semibold text-[#202124]">
              {noun}を削除しますか？
            </h3>
            <p className="mt-2 text-sm text-[#5f6368]">
              「{confirmTarget.title?.trim() || untitledLabel}」を削除します。この操作は取り消せません。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-medium text-[#5f6368] hover:bg-[#f1f3f4]"
                onClick={() => setConfirmDeleteId(null)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="rounded-lg bg-[#d93025] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c5221f]"
                onClick={() => {
                  onDelete?.(confirmDeleteId);
                  setConfirmDeleteId(null);
                  onSelectDoc(null);
                }}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
