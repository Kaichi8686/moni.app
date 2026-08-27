"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ArrowUpDown,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  ListFilter,
  MessageCircle,
  SearchX,
  X,
} from "lucide-react";
import { QNA_CATEGORIES, qnaCategoryLabel, type QnaCategoryId } from "@/lib/qna/categories";
import type { QnaListFilter, QnaQuestion } from "@/lib/qna/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

const PANEL = "rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900";

const TOOL_BTN =
  "inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-[12px] font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:bg-zinc-800";
const TOOL_BTN_ACTIVE =
  "border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50";

const PAGE_SIZE = 20;

type SortMode = "newest" | "unresolved" | "most_replies";

const DEFAULT_FILTER: QnaListFilter = { category: "all", unresolvedOnly: false };

type Props = {
  questions: QnaQuestion[];
  loading: boolean;
  filter: QnaListFilter;
  formatTime: (iso: string) => string;
  onFilterChange: (next: QnaListFilter) => void;
  onOpen: (id: string) => void;
};

function sortQuestions(list: QnaQuestion[], mode: SortMode): QnaQuestion[] {
  const next = [...list];
  next.sort((a, b) => {
    if (mode === "unresolved") {
      const aOpen = a.bestAnswerId ? 1 : 0;
      const bOpen = b.bestAnswerId ? 1 : 0;
      if (aOpen !== bOpen) return aOpen - bOpen;
    }
    if (mode === "most_replies") {
      if (b.answerCount !== a.answerCount) return b.answerCount - a.answerCount;
    }
    return new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime();
  });
  return next;
}

function countActiveFilters(filter: QnaListFilter): number {
  let n = 0;
  if (filter.category !== "all") n += 1;
  if (filter.unresolvedOnly) n += 1;
  return n;
}

function useDismissable(open: boolean, onClose: () => void, rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open, onClose, rootRef]);
}

function MenuPanel({
  open,
  align = "left",
  children,
  className = "",
}: {
  open: boolean;
  align?: "left" | "right";
  children: ReactNode;
  className?: string;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      className={`absolute z-30 mt-1.5 w-[min(100vw-2rem,20rem)] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900 ${
        align === "right" ? "right-0" : "left-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function QnAQuestionList({
  questions,
  loading,
  filter,
  formatTime,
  onFilterChange,
  onOpen,
}: Props) {
  const { tx, locale } = useI18n();
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [draftFilter, setDraftFilter] = useState<QnaListFilter>(filter);
  const filterRootRef = useRef<HTMLDivElement>(null);
  const sortRootRef = useRef<HTMLDivElement>(null);

  useDismissable(filterOpen, () => setFilterOpen(false), filterRootRef);
  useDismissable(sortOpen, () => setSortOpen(false), sortRootRef);

  const filtered = useMemo(() => {
    const base = questions.filter((q) => {
      if (filter.category !== "all" && q.category !== filter.category) return false;
      if (filter.unresolvedOnly && q.bestAnswerId) return false;
      return true;
    });
    return sortQuestions(base, sortMode);
  }, [questions, filter, sortMode]);

  const sortOptions: { id: SortMode; label: string }[] = [
    { id: "newest", label: tx("新着順", "Newest") },
    { id: "unresolved", label: tx("未解決を優先", "Unresolved first") },
    { id: "most_replies", label: tx("回答が多い順", "Most replies") },
  ];
  const activeFilterCount = countActiveFilters(filter);
  const hasActiveFilter = activeFilterCount > 0;
  const sortLabel = sortOptions.find((o) => o.id === sortMode)?.label ?? tx("新着順", "Newest");
  const showChips = hasActiveFilter || sortMode !== "newest";

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  const openFilter = () => {
    setDraftFilter(filter);
    setSortOpen(false);
    setFilterOpen(true);
  };

  const applyFilter = () => {
    onFilterChange(draftFilter);
    setVisibleCount(PAGE_SIZE);
    setFilterOpen(false);
  };

  const resetDraftAndApply = () => {
    setDraftFilter(DEFAULT_FILTER);
    onFilterChange(DEFAULT_FILTER);
    setVisibleCount(PAGE_SIZE);
    setFilterOpen(false);
  };

  const resetPage = () => setVisibleCount(PAGE_SIZE);

  return (
    <div className="mt-6 px-4 pb-8 pt-2">
      <div className="mb-4">
        <h4 className="text-[16px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {tx("みんなの質問", "Questions")}
        </h4>
        <p className="mt-1 text-[12px] leading-relaxed text-zinc-400 dark:text-zinc-500">
          {tx("カードをタップするとスレッドで回答を確認できます", "Tap a card to open the thread and read replies")}
        </p>
      </div>

      {/* Toolbar: Filter + Sort */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative" ref={filterRootRef}>
          <button
            type="button"
            aria-expanded={filterOpen}
            aria-haspopup="dialog"
            onClick={() => (filterOpen ? setFilterOpen(false) : openFilter())}
            className={`${TOOL_BTN} ${activeFilterCount > 0 || filterOpen ? TOOL_BTN_ACTIVE : ""}`}
          >
            <ListFilter className="h-3.5 w-3.5" aria-hidden />
            {tx("フィルタ", "Filter")}
            {activeFilterCount > 0 ? (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-zinc-900 px-1 text-[10px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                {activeFilterCount}
              </span>
            ) : null}
            <ChevronDown
              className={`h-3.5 w-3.5 text-zinc-400 transition ${filterOpen ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>

          <MenuPanel open={filterOpen}>
            <div className="border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                {tx("カテゴリ", "Category")}
              </p>
              <div className="mt-2 flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => setDraftFilter((d) => ({ ...d, category: "all" }))}
                  className={`flex items-center justify-between rounded-md px-2 py-2 text-left text-[13px] transition ${
                    draftFilter.category === "all"
                      ? "bg-zinc-100 font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                      : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/70"
                  }`}
                >
                  {tx("すべて", "All")}
                  {draftFilter.category === "all" ? (
                    <Check className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-200" aria-hidden />
                  ) : null}
                </button>
                {QNA_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setDraftFilter((d) => ({ ...d, category: c.id as QnaCategoryId }))
                    }
                    className={`flex items-center justify-between rounded-md px-2 py-2 text-left text-[13px] transition ${
                      draftFilter.category === c.id
                        ? "bg-zinc-100 font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                        : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/70"
                    }`}
                  >
                    {qnaCategoryLabel(c.id, locale)}
                    {draftFilter.category === c.id ? (
                      <Check className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-200" aria-hidden />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                {tx("ステータス", "Status")}
              </p>
              <label className="mt-2 flex cursor-pointer items-center justify-between rounded-md px-2 py-2 text-[13px] text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/70">
                <span>{tx("未解決のみ", "Unresolved only")}</span>
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-900 accent-zinc-900 dark:border-zinc-600 dark:accent-zinc-100"
                  checked={draftFilter.unresolvedOnly}
                  onChange={() =>
                    setDraftFilter((d) => ({ ...d, unresolvedOnly: !d.unresolvedOnly }))
                  }
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 px-3 py-2.5">
              <button
                type="button"
                onClick={resetDraftAndApply}
                className="min-h-[32px] rounded-md px-2.5 text-[12px] font-semibold text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                {tx("リセット", "Reset")}
              </button>
              <button
                type="button"
                onClick={applyFilter}
                className="min-h-[32px] rounded-md bg-zinc-900 px-3 text-[12px] font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                {tx("適用", "Apply")}
              </button>
            </div>
          </MenuPanel>
        </div>

        <div className="relative" ref={sortRootRef}>
          <button
            type="button"
            aria-expanded={sortOpen}
            aria-haspopup="listbox"
            onClick={() => {
              setFilterOpen(false);
              setSortOpen((v) => !v);
            }}
            className={`${TOOL_BTN} ${sortMode !== "newest" || sortOpen ? TOOL_BTN_ACTIVE : ""}`}
          >
            <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
            {tx("並び替え", "Sort")}: {sortLabel}
            <ChevronDown
              className={`h-3.5 w-3.5 text-zinc-400 transition ${sortOpen ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>

          <MenuPanel open={sortOpen}>
            <div className="p-1.5" role="listbox" aria-label={tx("並び替え", "Sort")}>
              {sortOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={sortMode === opt.id}
                  onClick={() => {
                    setSortMode(opt.id);
                    resetPage();
                    setSortOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[13px] transition ${
                    sortMode === opt.id
                      ? "bg-zinc-100 font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                      : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/70"
                  }`}
                >
                  {opt.label}
                  {sortMode === opt.id ? (
                    <Check className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-200" aria-hidden />
                  ) : null}
                </button>
              ))}
            </div>
          </MenuPanel>
        </div>
      </div>

      {/* Active chips */}
      {showChips ? (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {filter.category !== "all" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              {qnaCategoryLabel(filter.category, locale)}
              <button
                type="button"
                aria-label={tx(
                  `${qnaCategoryLabel(filter.category, locale)} を解除`,
                  `Remove ${qnaCategoryLabel(filter.category, locale)}`,
                )}
                onClick={() => {
                  onFilterChange({ ...filter, category: "all" });
                  resetPage();
                }}
                className="rounded-full p-0.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ) : null}

          {filter.unresolvedOnly ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              {tx("未解決のみ", "Unresolved only")}
              <button
                type="button"
                aria-label={tx("未解決のみを解除", "Remove unresolved-only filter")}
                onClick={() => {
                  onFilterChange({ ...filter, unresolvedOnly: false });
                  resetPage();
                }}
                className="rounded-full p-0.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ) : null}

          {sortMode !== "newest" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              {sortLabel}
              <button
                type="button"
                aria-label={tx("並び替えを新着順に戻す", "Reset sort to newest")}
                onClick={() => {
                  setSortMode("newest");
                  resetPage();
                }}
                className="rounded-full p-0.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ) : null}

          {hasActiveFilter ? (
            <button
              type="button"
              onClick={() => {
                onFilterChange(DEFAULT_FILTER);
                resetPage();
              }}
              className="px-1.5 text-[11px] font-semibold text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              {tx("リセット", "Reset")}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mb-4" />
      )}

      {loading ? (
        <p className={`${PANEL} px-4 py-8 text-center text-sm text-zinc-500`}>{tx("読み込み中…", "Loading…")}</p>
      ) : filtered.length === 0 ? (
        <div className={`${PANEL} border-dashed px-4 py-12 text-center dark:border-zinc-600`}>
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <SearchX className="h-5 w-5" aria-hidden />
          </div>
          <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            {tx("該当する質問がありません。", "No matching questions.")}
          </p>
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            {tx("フィルタを変えるか、新しい質問を投稿してみよう。", "Try a different filter, or post a new question.")}
          </p>
          {hasActiveFilter ? (
            <button
              type="button"
              onClick={() => {
                onFilterChange(DEFAULT_FILTER);
                resetPage();
              }}
              className="mt-4 inline-flex min-h-[36px] items-center rounded-lg border border-zinc-200 bg-white px-3.5 text-[12px] font-semibold text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {tx("すべて表示に戻る", "Show all")}
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {visible.map((q) => {
              const resolved = Boolean(q.bestAnswerId);
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    className={`group flex w-full items-start gap-2 ${PANEL} px-3.5 py-3 text-left transition hover:border-zinc-300 hover:bg-zinc-50/80 active:bg-zinc-50 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/60 dark:active:bg-zinc-800`}
                    onClick={() => onOpen(q.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
                            resolved
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          {resolved ? (
                            <CheckCircle2 className="h-3 w-3" aria-hidden />
                          ) : (
                            <CircleDashed className="h-3 w-3" aria-hidden />
                          )}
                          {resolved ? tx("解決済み", "Resolved") : tx("未解決", "Unresolved")}
                        </span>
                        <span className="inline-flex rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                          {qnaCategoryLabel(q.category, locale)}
                        </span>
                      </div>

                      <h5 className="mt-1.5 text-[15px] font-semibold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50">
                        {q.title.trim()}
                      </h5>

                      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>{q.authorName}</span>
                        <span aria-hidden>·</span>
                        <time dateTime={q.createdAtIso}>{formatTime(q.createdAtIso)}</time>
                        <span aria-hidden>·</span>
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" aria-hidden />
                          <span className="tabular-nums">{q.answerCount}</span>
                          <span>{tx("回答", "replies")}</span>
                        </span>
                      </p>
                    </div>
                    <ChevronRight
                      className="mt-1 h-4 w-4 shrink-0 text-zinc-300 transition group-hover:text-zinc-500 dark:text-zinc-600"
                      aria-hidden
                    />
                  </button>
                </li>
              );
            })}
          </ul>

          {hasMore ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                className="inline-flex min-h-[40px] items-center rounded-lg border border-zinc-200 bg-white px-4 text-[13px] font-semibold text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                {tx(
                  `もっと見る（残り ${filtered.length - visibleCount} 件）`,
                  `See more (${filtered.length - visibleCount} remaining)`,
                )}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
