"use client";

import { useCallback, useMemo, useState } from "react";
import { LayoutGrid, Menu, MoreVertical, Search, Trash2 } from "lucide-react";
import type { ProjectDocumentRow } from "@/lib/projects/documents";

function DocIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <path fill="#4285F4" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
      <path fill="#A1C2FA" d="M13 3.5L18.5 9H14c-.55 0-1-.45-1-1V3.5z" />
    </svg>
  );
}

function GoogleFab({ disabled, creating, onClick }: { disabled?: boolean; creating?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled || creating}
      onClick={onClick}
      className="fixed bottom-[calc(var(--bottom-nav-clearance)+0.75rem)] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.18)] transition hover:shadow-[0_4px_14px_rgba(0,0,0,0.22)] disabled:opacity-50 md:bottom-8"
      aria-label="新しいドキュメント"
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
  documents: ProjectDocumentRow[];
  canEdit: boolean;
  docCreating: boolean;
  userInitial?: string;
  selectedDocId: string | null;
  onSelectDoc: (id: string | null) => void;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onDelete?: (id: string) => void;
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
    <div className="relative -mx-4 -mt-4 flex min-h-[min(72dvh,720px)] flex-col bg-white sm:-mx-0 sm:mt-0">
      <div className="sticky top-0 z-20 border-b border-[#e8eaed] bg-white px-3 pb-2 pt-1 sm:px-4">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <h2 className="text-[20px] font-normal text-[#202124]">ドキュメント</h2>
          {canEdit && onDelete ? (
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

        <div className="flex items-center gap-2 rounded-full bg-[#f1f3f4] px-3 py-2.5">
          <Menu className="h-5 w-5 shrink-0 text-[#5f6368]" aria-hidden />
          <Search className="h-4 w-4 shrink-0 text-[#5f6368]" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ドキュメントを検索"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-[#202124] outline-none placeholder:text-[#5f6368]"
            aria-label="ドキュメントを検索"
          />
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a73e8] text-xs font-bold text-white">
            {userInitial}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between px-1">
          <button type="button" className="flex items-center gap-1 text-[14px] text-[#202124]">
            <span>最近更新</span>
            <span className="text-[#5f6368]" aria-hidden>
              ▾
            </span>
          </button>
          <button type="button" className="rounded-full p-2 text-[#5f6368] hover:bg-[#f1f3f4]" aria-label="表示形式">
            <LayoutGrid className="h-5 w-5" />
          </button>
        </div>
      </div>

      {selectedDocId ? (
        <p className="border-b border-[#e8f0fe] bg-[#e8f0fe] px-4 py-2 text-[13px] text-[#174ea6]">
          選択中 — 右上の「削除」で確認画面が開きます
        </p>
      ) : (
        <p className="border-b border-[#f1f3f4] bg-[#f8f9fa] px-4 py-2 text-[12px] text-[#5f6368]">
          行をタップで選択 · 「開く」で編集
        </p>
      )}

      <ul className="min-h-0 flex-1 divide-y divide-[#e8eaed] overflow-y-auto pb-24">
        {filtered.length === 0 ? (
          <li className="px-4 py-16 text-center text-[14px] text-[#5f6368]">
            {query.trim() ? "該当するドキュメントがありません" : "ドキュメントがありません"}
          </li>
        ) : (
          filtered.map((d) => {
            const selected = selectedDocId === d.id;
            return (
              <li key={d.id} className="relative flex items-center gap-1 pr-2">
                <button
                  type="button"
                  onClick={() => onSelectDoc(selected ? null : d.id)}
                  className={`flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left transition sm:px-4 ${
                    selected ? "bg-[#e8f0fe]" : "hover:bg-[#f8f9fa] active:bg-[#f1f3f4]"
                  }`}
                >
                  <DocIcon />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[15px] ${selected ? "font-medium text-[#174ea6]" : "font-normal text-[#202124]"}`}>
                      {d.title?.trim() || "無題のドキュメント"}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-[#5f6368]">{formatDocDate(d.updated_at)}</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpen(d.id)}
                  className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium text-[#1a73e8] hover:bg-[#e8f0fe]"
                >
                  開く
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded-full p-2 text-[#5f6368] hover:bg-[#f1f3f4]"
                  aria-label="その他"
                  onClick={() => setMenuId(menuId === d.id ? null : d.id)}
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
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

      {canEdit ? <GoogleFab disabled={!canEdit} creating={docCreating} onClick={onCreate} /> : null}

      {confirmDeleteId && confirmTarget ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal
            aria-labelledby="doc-delete-title"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          >
            <h3 id="doc-delete-title" className="text-base font-semibold text-[#202124]">
              ドキュメントを削除しますか？
            </h3>
            <p className="mt-2 text-sm text-[#5f6368]">
              「{confirmTarget.title?.trim() || "無題のドキュメント"}」を削除します。この操作は取り消せません。
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
