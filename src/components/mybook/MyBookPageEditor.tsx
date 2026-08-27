"use client";

import { FormEvent, useState } from "react";
import { X } from "lucide-react";
import { clampMyBookDate, saveMyBookEntry, todayKeyJapan } from "@/lib/mybook/myBookData";
import { MYBOOK_MOOD_OPTIONS, type MyBookEntry, type MyBookMood } from "@/lib/mybook/types";
import { recordUserActivity } from "@/lib/gamification/recordUserActivity";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";

type Props = {
  userId: string;
  initial: MyBookEntry | null;
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
};

export function MyBookPageEditor({ userId, initial, defaultDate, onClose, onSaved }: Props) {
  const { tx, locale } = useI18n();
  const today = todayKeyJapan();
  const [entryDate, setEntryDate] = useState(() => clampMyBookDate(initial?.entryDate ?? defaultDate));
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [mood, setMood] = useState<MyBookMood>(initial?.mood ?? "calm");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setErr("");
    try {
      await saveMyBookEntry(supabase, userId, {
        entryDate,
        title,
        body,
        mood,
      });
      void recordUserActivity(supabase, userId, 2).catch(() => undefined);
      onSaved();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : tx("保存に失敗しました", "Failed to save"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="mybook-editor-backdrop fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      onClick={onClose}
    >
      <div className="mybook-editor-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mybook-editor-head flex items-start justify-between gap-2">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-900/45">New Page</p>
            <h2 className="font-[family-name:var(--font-display)] text-base font-bold text-amber-950">
              {initial ? tx("ページを編集", "Edit page") : tx("今日のページ", "Today’s page")}
            </h2>
          </div>
          <button
            type="button"
            className="rounded-full p-1.5 text-amber-900/55 hover:bg-amber-100/80"
            onClick={onClose}
            aria-label={tx("閉じる", "Close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="max-h-[min(72vh,640px)] overflow-y-auto px-4 py-4" onSubmit={(e) => void onSubmit(e)}>
          <label className="mybook-editor-field mybook-editor-label">
            {tx("日付", "Date")}
            <input
              type="date"
              className="mybook-editor-input"
              value={entryDate}
              max={today}
              required
              onChange={(e) => setEntryDate(clampMyBookDate(e.target.value))}
            />
            <span className="mt-1 block text-[11px] font-normal text-amber-900/50">
              {tx("今日までの日付だけ選べます", "You can only pick dates up to today")}
            </span>
          </label>

          <div className="mybook-editor-field">
            <p className="mybook-editor-label">{tx("きもち", "Mood")}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {MYBOOK_MOOD_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`mybook-mood-pill ${mood === o.value ? "is-selected" : ""}`}
                  onClick={() => setMood(o.value)}
                >
                  {o.icon} {locale === "en" ? o.labelEn : o.label}
                </button>
              ))}
            </div>
          </div>

          <label className="mybook-editor-field mybook-editor-label">
            {tx("タイトル（一行）", "Title (one line)")}
            <input
              className="mybook-editor-input"
              placeholder={tx("例：文化祭の準備が進んだ日", "e.g. Festival prep went well today")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className="mybook-editor-field mybook-editor-label">
            {tx("本文", "Body")}
            <textarea
              className="mybook-editor-textarea"
              placeholder={tx(
                "今日やったこと、感じたこと、次にやることを自由に書いてください。",
                "Write freely about what you did, how you felt, and what you’ll do next.",
              )}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>

          {err ? <p className="mt-3 text-sm text-rose-600">{err}</p> : null}

          <div className="mt-4 flex justify-end gap-2 pb-[env(safe-area-inset-bottom,0px)]">
            <button type="button" className="mybook-btn-secondary" onClick={onClose} disabled={saving}>
              {tx("キャンセル", "Cancel")}
            </button>
            <button type="submit" className="mybook-btn-primary" disabled={saving}>
              {saving ? tx("保存中…", "Saving…") : tx("本に保存", "Save to book")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
