"use client";

import { FormEvent, useState } from "react";
import { X } from "lucide-react";
import {
  createUserMilestone,
  MILESTONE_TYPE_OPTIONS,
  type CreateMilestoneInput,
  type MilestoneType,
} from "@/lib/gamification/milestones";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";

type Props = {
  open: boolean;
  userId: string;
  onClose: () => void;
  onCreated: () => void;
};

export function MilestoneRecordModal({ open, userId, onClose, onCreated }: Props) {
  const { locale, tx } = useI18n();
  const [type, setType] = useState<MilestoneType>("first_sale");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [achievedAt, setAchievedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  if (!open) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setErr(tx("タイトルを入力してください", "Enter a title"));
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const input: CreateMilestoneInput = {
        type,
        title: trimmed,
        description: description.trim() || undefined,
        achievedAt: new Date(`${achievedAt}T12:00:00`).toISOString(),
        isPublic,
      };
      await createUserMilestone(supabase, userId, input);
      setTitle("");
      setDescription("");
      onCreated();
      onClose();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : tx("保存に失敗しました", "Couldn’t save"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal>
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{tx("マイルストーンを記録", "Record a milestone")}</h2>
          <button type="button" className="rounded-lg p-1 hover:bg-gray-100" onClick={onClose} aria-label={tx("閉じる", "Close")}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
          <label className="block text-xs font-medium text-gray-600">
            {tx("種類", "Type")}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {MILESTONE_TYPE_OPTIONS.map((o) => (
                <button
                  key={o.type}
                  type="button"
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    type === o.type
                      ? "border-violet-500 bg-violet-50 text-violet-800"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                  onClick={() => setType(o.type)}
                >
                  {o.icon} {locale === "en" ? o.labelEn : o.label}
                </button>
              ))}
            </div>
          </label>

          <label className="block text-xs font-medium text-gray-600">
            {tx("タイトル", "Title")}
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none ring-violet-500 focus:ring-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tx("例：友人10人への初回販売、売上3,000円", "e.g. First sales to 10 friends, ¥3,000")}
              required
            />
          </label>

          <label className="block text-xs font-medium text-gray-600">
            {tx("達成日", "Date achieved")}
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={achievedAt}
              onChange={(e) => setAchievedAt(e.target.value)}
            />
          </label>

          <label className="block text-xs font-medium text-gray-600">
            {tx("詳細（任意）", "Details (optional)")}
            <textarea
              className="mt-1 min-h-[4rem] w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            {tx("みんなに公開する", "Make public")}
          </label>

          {err ? <p className="text-sm text-rose-600">{err}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium"
              onClick={onClose}
              disabled={saving}
            >
              {tx("キャンセル", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? tx("保存中…", "Saving…") : tx("記録する", "Save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
