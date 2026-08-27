"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { MilestoneRecordModal } from "@/components/gamification/MilestoneRecordModal";
import {
  deleteUserMilestone,
  milestoneTypeIcon,
  milestoneTypeLabel,
  type UserMilestone,
} from "@/lib/gamification/milestones";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";

type Props = {
  milestones: UserMilestone[];
  isOwnProfile: boolean;
  userId: string;
  onReload: () => void;
};

export function ProfileMilestonesSection({ milestones, isOwnProfile, userId, onReload }: Props) {
  const { locale, tx } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [err, setErr] = useState("");

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "ja-JP", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso.slice(0, 10);
    }
  }

  async function handleDelete(m: UserMilestone) {
    if (!supabase || !isOwnProfile) return;
    if (
      !window.confirm(
        tx(`「${m.title}」を削除しますか？`, `Delete “${m.title}”?`),
      )
    )
      return;
    setDeletingId(m.id);
    setErr("");
    try {
      await deleteUserMilestone(supabase, userId, m.id);
      onReload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : tx("削除に失敗しました", "Couldn’t delete"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="bg-zinc-50 px-4 py-4 sm:px-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-zinc-900">{tx("マイルストーン", "Milestones")}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">{tx("節目の記録", "Key moments")}</p>
        </div>
        {isOwnProfile ? (
          <button
            type="button"
            className="inline-flex min-h-[36px] items-center rounded-lg bg-zinc-900 px-3 text-xs font-bold text-white transition hover:bg-zinc-800 active:scale-[0.98]"
            onClick={() => setModalOpen(true)}
          >
            {tx("＋ 記録する", "+ Record")}
          </button>
        ) : null}
      </div>

      {milestones.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-8 text-center shadow-sm">
          <p className="text-sm font-medium text-zinc-700">
            {isOwnProfile
              ? tx("まだ記録がありません", "No milestones yet")
              : tx("まだマイルストーンはありません", "No milestones yet")}
          </p>
          {isOwnProfile ? (
            <p className="mt-1 text-xs text-zinc-500">
              {tx("売上・受賞・チーム結成など、節目を残そう", "Log sales, awards, team formation, and more")}
            </p>
          ) : null}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {milestones.map((m) => (
            <li key={m.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg">
                  <span aria-hidden>{milestoneTypeIcon(m.type)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-500">{milestoneTypeLabel(m.type, locale)}</p>
                  <p className="mt-0.5 text-[15px] font-bold text-zinc-900">{m.title}</p>
                  {m.description ? (
                    <p className="mt-1 text-sm leading-relaxed text-zinc-600">{m.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-zinc-500">{formatDate(m.achievedAt)}</p>
                </div>
                {isOwnProfile ? (
                  <button
                    type="button"
                    disabled={deletingId === m.id}
                    onClick={() => void handleDelete(m)}
                    className="shrink-0 rounded-lg p-2 text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    aria-label={tx(`${m.title}を削除`, `Delete ${m.title}`)}
                    title={tx("削除", "Delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {err ? <p className="mt-2 text-xs text-rose-600">{err}</p> : null}

      <MilestoneRecordModal
        open={modalOpen}
        userId={userId}
        onClose={() => setModalOpen(false)}
        onCreated={onReload}
      />
    </section>
  );
}
