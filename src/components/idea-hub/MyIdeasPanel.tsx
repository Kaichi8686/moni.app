"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
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
    setTitle("");
    setMemo("");
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
    <div className="relative mx-auto max-w-lg px-4 pb-28 pt-4">
      <div className="mb-4">
        <h2 className="text-[17px] font-semibold tracking-tight text-zinc-900">{tx("マイアイデア", "My ideas")}</h2>
        <p className="mt-0.5 text-[12px] text-zinc-500">
          {tx("思いついた種を、そのまま書いて残せます", "Write down idea seeds as they come")}
        </p>
      </div>

      <div className="mb-5 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3.5">
        <label className="block text-[12px] font-semibold text-zinc-600">
          {tx("タイトル", "Title")}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tx("例: 学校の提出を自動化するアプリ", "e.g. An app that automates school submissions")}
            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-zinc-200 bg-white px-3 text-[14px] text-zinc-900 outline-none focus:border-zinc-400"
          />
        </label>
        <label className="mt-3 block text-[12px] font-semibold text-zinc-600">
          {tx("一言メモ", "Quick note")}
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={3}
            placeholder={tx("なぜ気になったか、誰の困りごとかなど", "Why it stood out, whose problem it is, etc.")}
            className="mt-1.5 w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[14px] text-zinc-900 outline-none focus:border-zinc-400"
          />
        </label>
        <button
          type="button"
          disabled={!title.trim() || saving}
          onClick={() => void save()}
          className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tx("保存する", "Save")}
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      {ideas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white px-5 py-8 text-center">
          <span className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <h3 className="text-[15px] font-semibold text-zinc-900">{tx("まだ保存したアイデアはありません", "No saved ideas yet")}</h3>
          <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-zinc-500">
            {tx("上に書いて保存するか、右下のAIから発掘してみましょう。", "Write above to save, or open AI at the bottom right to excavate.")}
          </p>
          <button
            type="button"
            onClick={onGoExcavate}
            className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-500"
          >
            {tx("発掘を試す", "Try excavate")}
          </button>
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
    </div>
  );
}
