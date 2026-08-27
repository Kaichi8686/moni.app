"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { createMyIdea, deleteMyIdea, listMyIdeas } from "@/lib/idea-hub/myIdeas";
import type { MyIdea } from "@/lib/idea-hub/types";
import { useI18n } from "@/lib/i18n/I18nProvider";

function formatSavedAt(iso: string, locale: "ja" | "en") {
  try {
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16);
  }
}

export function MyIdeasPanel({ onGoExcavate }: { onGoExcavate: () => void }) {
  const { tx, locale } = useI18n();
  const [ideas, setIdeas] = useState<MyIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loginRequired, setLoginRequired] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    const { ideas: rows, error: err } = await listMyIdeas();
    if (err === "login_required") {
      setLoginRequired(true);
      setIdeas([]);
    } else if (err) {
      setLoginRequired(false);
      setError(err);
      setIdeas([]);
    } else {
      setLoginRequired(false);
      setIdeas(rows);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openComposer = () => {
    setTitle("");
    setMemo("");
    setComposerOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    const { idea, error: err } = await createMyIdea({
      title,
      memo,
      source: "manual",
    });
    setSaving(false);
    if (err === "login_required") {
      setLoginRequired(true);
      return;
    }
    if (err || !idea) {
      setError(err || tx("保存に失敗しました", "Failed to save"));
      return;
    }
    setIdeas((prev) => [idea, ...prev]);
    setComposerOpen(false);
  };

  const remove = async (id: string) => {
    if (!window.confirm(tx("このアイデアを削除しますか？", "Delete this idea?"))) return;
    setDeletingId(id);
    const { error: err } = await deleteMyIdea(id);
    setDeletingId(null);
    if (err) {
      setError(err);
      return;
    }
    setIdeas((prev) => prev.filter((x) => x.id !== id));
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        {tx("読み込み中…", "Loading…")}
      </div>
    );
  }

  if (loginRequired) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-5 py-16 text-center">
        <h2 className="text-lg font-semibold text-zinc-900">{tx("ログインが必要です", "Sign in required")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          {tx("マイアイデアを保存・一覧するにはログインしてください。", "Sign in to save and view your ideas.")}
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white"
        >
          {tx("ログインする", "Sign in")}
        </Link>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-lg px-4 pb-8 pt-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-zinc-900">{tx("マイアイデア", "My ideas")}</h2>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            {tx("思いついた種を、あとから見返せるメモ箱", "A notebook for ideas you want to revisit")}
          </p>
        </div>
        <button
          type="button"
          onClick={openComposer}
          className="inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-full bg-zinc-900 px-3.5 text-[12px] font-semibold text-white"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {tx("保存", "Save")}
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      {ideas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 px-5 py-10 text-center">
          <span className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <h3 className="text-[15px] font-semibold text-zinc-900">{tx("まだアイデアがありません", "No ideas yet")}</h3>
          <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-zinc-500">
            {tx("発掘機能を試すか、思いついたことを直接メモしてみましょう。", "Try excavate, or jot something down yourself.")}
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={onGoExcavate}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-500"
            >
              {tx("発掘を試す", "Try excavate")}
            </button>
            <button
              type="button"
              onClick={openComposer}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            >
              {tx("直接メモする", "Write a note")}
            </button>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {ideas.map((idea) => (
            <li
              key={idea.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm shadow-zinc-900/[0.03]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        idea.source === "interview"
                          ? "bg-sky-50 text-sky-700"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {idea.source === "interview" ? tx("発掘から", "From excavate") : tx("手動メモ", "Manual note")}
                    </span>
                    <time className="text-[11px] text-zinc-400" dateTime={idea.created_at}>
                      {formatSavedAt(idea.created_at, locale)}
                    </time>
                  </div>
                  <h3 className="text-[15px] font-semibold text-zinc-900">{idea.title}</h3>
                  {idea.memo ? (
                    <p className="mt-1.5 text-[13px] leading-relaxed whitespace-pre-wrap text-zinc-500">
                      {idea.memo}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void remove(idea.id)}
                  disabled={deletingId === idea.id}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
                  aria-label={tx("削除", "Delete")}
                >
                  {deletingId === idea.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {composerOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/35 p-0 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="my-idea-composer-title"
            className="w-full max-w-lg rounded-t-2xl border border-zinc-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl sm:pb-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 id="my-idea-composer-title" className="text-[15px] font-semibold text-zinc-900">
                {tx("新しいアイデアを保存", "Save a new idea")}
              </h3>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
                aria-label={tx("閉じる", "Close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="block text-[12px] font-semibold text-zinc-600">
              {tx("タイトル", "Title")}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={tx("例: 学校の提出を自動化するアプリ", "e.g. An app that automates school submissions")}
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-[14px] text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
                autoFocus
              />
            </label>
            <label className="mt-3 block text-[12px] font-semibold text-zinc-600">
              {tx("一言メモ", "Quick note")}
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={4}
                placeholder={tx("なぜ気になったか、誰の困りごとかなど", "Why it stood out, whose problem it is, etc.")}
                className="mt-1.5 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[14px] text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
              />
            </label>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-700"
              >
                {tx("キャンセル", "Cancel")}
              </button>
              <button
                type="button"
                disabled={!title.trim() || saving}
                onClick={() => void save()}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tx("保存する", "Save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
