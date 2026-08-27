"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, PenLine } from "lucide-react";
import { AppBottomNav } from "@/components/AppBottomNav";
import { MyBookPageEditor } from "@/components/mybook/MyBookPageEditor";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  deleteMyBookEntry,
  formatBookDate,
  loadMyBookEntries,
  todayKeyJapan,
} from "@/lib/mybook/myBookData";
import { MYBOOK_MOOD_OPTIONS, type MyBookEntry } from "@/lib/mybook/types";
import { supabase, supabaseEnabled } from "@/lib/supabase";

function moodIcon(mood: MyBookEntry["mood"]): string {
  if (!mood) return "📄";
  return MYBOOK_MOOD_OPTIONS.find((o) => o.value === mood)?.icon ?? "📄";
}

function moodLabel(mood: MyBookEntry["mood"], locale: "ja" | "en"): string {
  if (!mood) return "";
  const option = MYBOOK_MOOD_OPTIONS.find((o) => o.value === mood);
  if (!option) return "";
  return locale === "en" ? option.labelEn : option.label;
}

export function MyBookScreen() {
  const router = useRouter();
  const { tx, locale } = useI18n();
  const [userId, setUserId] = useState<string | null>(null);
  const [entries, setEntries] = useState<MyBookEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MyBookEntry | null>(null);

  const untitled = tx("無題のページ", "Untitled page");

  const reload = useCallback(async (uid: string) => {
    if (!supabase) return;
    setLoading(true);
    setErr("");
    try {
      const list = await loadMyBookEntries(supabase, uid);
      setEntries(list);
      setSelectedId((prev) => {
        if (prev && list.some((e) => e.id === prev)) return prev;
        return list.at(-1)?.id ?? null;
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : tx("読み込みに失敗しました", "Failed to load"));
    } finally {
      setLoading(false);
    }
  }, [tx]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      const uid = session?.user.id ?? null;
      setUserId(uid);
      if (uid) void reload(uid);
      else {
        setEntries([]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [reload]);

  const selectedIndex = useMemo(
    () => entries.findIndex((e) => e.id === selectedId),
    [entries, selectedId],
  );

  const selected = selectedIndex >= 0 ? entries[selectedIndex] : null;

  const todayEntry = useMemo(() => entries.find((e) => e.entryDate === todayKeyJapan()) ?? null, [entries]);

  function openEditor(entry?: MyBookEntry | null) {
    setEditTarget(entry ?? todayEntry);
    setEditorOpen(true);
  }

  function selectByOffset(offset: number) {
    if (selectedIndex < 0) return;
    const next = selectedIndex + offset;
    if (next >= 0 && next < entries.length) {
      setSelectedId(entries[next].id);
    }
  }

  async function handleDelete(entry: MyBookEntry) {
    if (!supabase || !userId) return;
    const pageName = entry.title || formatBookDate(entry.entryDate);
    if (
      !window.confirm(
        tx(`「${pageName}」のページを削除しますか？`, `Delete the page “${pageName}”?`),
      )
    )
      return;
    try {
      await deleteMyBookEntry(supabase, userId, entry.id);
      await reload(userId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : tx("削除に失敗しました", "Failed to delete"));
    }
  }

  if (!supabaseEnabled) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center text-sm text-gray-600">
        {tx("Supabase 未接続です", "Supabase is not connected")}
      </div>
    );
  }

  if (!userId && !loading) {
    return (
      <div className="mybook-shell pb-bottom-nav">
        <header className="mybook-header">
          <h1 className="mybook-title">{tx("マイブック", "My Book")}</h1>
        </header>
        <div className="mybook-inset py-16 text-center">
          <p className="text-sm text-amber-900/80">{tx("日記を書くにはログインが必要です。", "Log in to write in your journal.")}</p>
          <Link href="/login" className="mybook-btn-primary mt-4 inline-flex items-center">
            {tx("ログイン", "Log in")}
          </Link>
        </div>
        <AppBottomNav />
      </div>
    );
  }

  return (
    <div className="mybook-shell pb-bottom-nav">
      <header className="mybook-header">
        <button type="button" className="mybook-back" onClick={() => router.back()} aria-label={tx("戻る", "Back")}>
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-amber-900/45">Private Journal</p>
          <h1 className="mybook-title">{tx("マイブック", "My Book")}</h1>
        </div>
        <button
          type="button"
          className="mybook-action"
          onClick={() => openEditor(todayEntry)}
          aria-label={tx("今日のページを書く", "Write today’s page")}
        >
          <PenLine className="h-4 w-4" aria-hidden />
        </button>
      </header>

      <div className="mybook-inset">
        <p className="mybook-tagline">
          {tx("1日1ページ。試行錯誤や気づきを、自分だけの本に。", "One page a day. Capture experiments and insights in your own book.")}
        </p>

        {err ? <p className="mb-3 text-center text-sm text-rose-600">{err}</p> : null}

        {loading ? (
          <p className="py-16 text-center text-sm text-amber-900/60">{tx("本を開いています…", "Opening your book…")}</p>
        ) : (
          <div className="mybook-cover-wrap">
            <div className="mybook-open">
              <div className="mybook-spine" aria-hidden />
              <aside className="mybook-index">
                <p className="mybook-cover-emboss">MY BOOK</p>
                <p className="mybook-index-label">{tx("目次", "Contents")}</p>
                <ul className="mybook-index-list">
                  {entries.length === 0 ? (
                    <li className="mybook-index-empty">{tx("白いページが、あなたを待っています", "Blank pages are waiting for you")}</li>
                  ) : (
                    entries.map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          className={`mybook-index-item ${selectedId === e.id ? "is-active" : ""}`}
                          onClick={() => setSelectedId(e.id)}
                        >
                          <span aria-hidden>{moodIcon(e.mood)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="mybook-index-date">{e.entryDate}</span>
                            <span className="mybook-index-title">{e.title.trim() || untitled}</span>
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                <button type="button" className="mybook-new-page" onClick={() => openEditor(null)}>
                  {tx("＋ 今日のページ", "+ Today’s page")}
                </button>
              </aside>

              <div className="mybook-page-wrap">
                <article className="mybook-page">
                  {selected ? (
                    <>
                      <div className="mybook-page-meta">
                        <span>{formatBookDate(selected.entryDate)}</span>
                        {selected.mood ? (
                          <span className="mybook-mood-stamp">
                            <span aria-hidden>{moodIcon(selected.mood)}</span>
                            {moodLabel(selected.mood, locale)}
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mybook-page-title">{selected.title.trim() || untitled}</h2>
                      <div className="mybook-page-body">
                        {selected.body.trim() ? (
                          <p className="whitespace-pre-wrap">{selected.body}</p>
                        ) : (
                          <p className="text-amber-900/35">{tx("本文はまだ空です。", "This page is still empty.")}</p>
                        )}
                      </div>
                      <footer className="mybook-page-footer">
                        <span className="mybook-page-num">
                          {String(selectedIndex + 1).padStart(2, "0")} / {String(entries.length).padStart(2, "0")}
                        </span>
                        <div className="mybook-page-nav">
                          <button
                            type="button"
                            className="mybook-page-nav-btn"
                            onClick={() => selectByOffset(-1)}
                            disabled={selectedIndex <= 0}
                            aria-label={tx("前のページ", "Previous page")}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="mybook-page-nav-btn"
                            onClick={() => selectByOffset(1)}
                            disabled={selectedIndex >= entries.length - 1}
                            aria-label={tx("次のページ", "Next page")}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mybook-page-actions">
                          <button type="button" className="mybook-btn-secondary" onClick={() => openEditor(selected)}>
                            {tx("編集", "Edit")}
                          </button>
                          <button type="button" className="mybook-btn-danger" onClick={() => void handleDelete(selected)}>
                            {tx("削除", "Delete")}
                          </button>
                        </div>
                      </footer>
                    </>
                  ) : (
                    <div className="mybook-page-empty">
                      <div className="mybook-empty-book" aria-hidden>
                        <div className="mybook-empty-book-cover" />
                        <div className="mybook-empty-book-pages" />
                      </div>
                      <p className="text-sm font-semibold text-amber-950">{tx("最初の1ページを書こう", "Write your first page")}</p>
                      <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-amber-900/55">
                        {tx("今日やったこと、考えたこと、明日やりたいことを自由に。", "What you did, what you thought, what you want to do tomorrow.")}
                      </p>
                      <button type="button" className="mybook-btn-primary mt-5" onClick={() => openEditor(null)}>
                        {tx("今日のページを書く", "Write today’s page")}
                      </button>
                    </div>
                  )}
                </article>
              </div>
            </div>
          </div>
        )}
      </div>

      {editorOpen && userId ? (
        <MyBookPageEditor
          userId={userId}
          initial={editTarget}
          defaultDate={todayKeyJapan()}
          onClose={() => setEditorOpen(false)}
          onSaved={() => {
            setEditorOpen(false);
            void reload(userId);
          }}
        />
      ) : null}

      <AppBottomNav />
    </div>
  );
}
