"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { createSkillRequest, SKILL_OPTIONS } from "@/lib/discover/skillRequests";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase } from "@/lib/supabase";

type Props = {
  projectId: string;
  projectName: string;
  userId: string | null;
  canEdit: boolean;
  recruitmentTarget: string;
  recruitmentMessage: string;
  visibility?: "public" | "private";
  onRecruitmentSaved: () => void;
  onNotice: (message: string) => void;
};

export function ProjectTalentPanel({
  projectId,
  projectName,
  userId,
  canEdit,
  recruitmentTarget,
  recruitmentMessage,
  visibility = "public",
  onRecruitmentSaved,
  onNotice,
}: Props) {
  const { tx } = useI18n();
  const [targetDraft, setTargetDraft] = useState(recruitmentTarget);
  const [messageDraft, setMessageDraft] = useState(recruitmentMessage);
  const [skillName, setSkillName] = useState<string>(SKILL_OPTIONS[0]);
  const [duration, setDuration] = useState("1週間");
  const [compensation, setCompensation] = useState("なし（経験・実績として）");
  const [postToBoard, setPostToBoard] = useState(true);
  const [saving, setSaving] = useState(false);
  const [published, setPublished] = useState(false);

  useEffect(() => {
    setTargetDraft(recruitmentTarget);
    setMessageDraft(recruitmentMessage);
  }, [recruitmentTarget, recruitmentMessage]);

  async function saveRecruitment() {
    if (!supabase || !userId || !canEdit) return;
    const target = targetDraft.trim();
    if (!target) {
      onNotice(tx("欲しい人材を入力してください", "Enter the talent you want"));
      return;
    }
    setSaving(true);
    try {
      const patch: {
        recruitment_target: string;
        recruitment_message: string;
        visibility?: "public";
      } = {
        recruitment_target: target,
        recruitment_message: messageDraft.trim(),
      };
      if (visibility !== "public") {
        patch.visibility = "public";
      }
      const { error } = await supabase.from("projects").update(patch).eq("id", projectId);
      if (error) throw new Error(error.message);

      if (postToBoard) {
        await createSkillRequest(supabase, userId, {
          skillName,
          description: [projectName, messageDraft.trim() || target].filter(Boolean).join(" — "),
          projectId,
          duration,
          compensation,
        });
      }

      setPublished(true);
      onRecruitmentSaved();
      onNotice(
        tx(
          "募集を公開しました。探すタブの「募集」から確認できます。",
          "Recruitment published. Check it under Explore → Recruiting.",
        ),
      );
    } catch (e) {
      onNotice(e instanceof Error ? e.message : tx("保存に失敗しました", "Failed to save"));
    } finally {
      setSaving(false);
    }
  }

  const recruiting = Boolean(recruitmentTarget.trim() || recruitmentMessage.trim());

  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-zinc-950 sm:text-lg">
            {tx("欲しい人材を募集", "Recruit talent")}
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
            {tx(
              "募集を出すと、探すタブの公開プロジェクトに載ります。",
              "Post a role and it appears on public projects in Discover.",
            )}
          </p>
        </div>
        <Users className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
      </div>

      {recruiting ? (
        <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-emerald-800">{tx("いまの募集", "Current posting")}</p>
          <p className="mt-0.5 text-sm font-medium text-zinc-900">
            {recruitmentTarget.trim() || tx("未設定", "Not set")}
          </p>
          {recruitmentMessage.trim() ? (
            <p className="mt-1 line-clamp-2 text-[12px] text-zinc-600">{recruitmentMessage}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {!canEdit ? (
          <p className="text-sm text-zinc-500">
            {tx("募集の編集はオーナー・管理者のみできます。", "Only owners and admins can post recruitment.")}
          </p>
        ) : (
          <>
            <input
              className="min-h-[44px] w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
              placeholder={tx("欲しい人材・姿勢（必須）", "Wanted talent / mindset (required)")}
              value={targetDraft}
              onChange={(e) => setTargetDraft(e.target.value)}
            />
            <textarea
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              rows={3}
              placeholder={tx("募集文・ビジョン（任意）", "Recruitment message / vision (optional)")}
              value={messageDraft}
              onChange={(e) => setMessageDraft(e.target.value)}
            />
            <label className="flex items-start gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-[12px] text-zinc-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={postToBoard}
                onChange={(e) => setPostToBoard(e.target.checked)}
              />
              <span>
                {tx(
                  "スキル募集ボードにも出す（探す・Discover で見つけやすくなります）",
                  "Also post to the skills board (easier to find on Discover)",
                )}
              </span>
            </label>
            {postToBoard ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <select
                  className="min-h-[40px] rounded-xl border border-zinc-200 px-2 text-sm"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                >
                  {SKILL_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  className="min-h-[40px] rounded-xl border border-zinc-200 px-2 text-sm"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                >
                  <option>1日以内</option>
                  <option>1週間</option>
                  <option>1ヶ月</option>
                  <option>長期</option>
                </select>
                <select
                  className="min-h-[40px] rounded-xl border border-zinc-200 px-2 text-sm"
                  value={compensation}
                  onChange={(e) => setCompensation(e.target.value)}
                >
                  <option>なし（経験・実績として）</option>
                  <option>成果報酬</option>
                  <option>相談</option>
                </select>
              </div>
            ) : null}
            <p className="text-[11px] leading-relaxed text-zinc-500">
              {tx(
                "公開プロジェクトとして探すタブに表示されます。非公開の場合は公開に切り替えます。",
                "Shown as a public project on Discover. Private projects are switched to public.",
              )}
            </p>
            <button
              type="button"
              disabled={saving || !targetDraft.trim()}
              className="w-full min-h-[44px] rounded-xl bg-zinc-900 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() => void saveRecruitment()}
            >
              {saving ? tx("公開中…", "Publishing…") : tx("募集を公開する", "Publish recruitment")}
            </button>
            {published || recruiting ? (
              <Link
                href="/?tab=chat&segment=recruit"
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-900"
              >
                {tx("探すタブの募集で見る", "View on Explore → Recruiting")}
              </Link>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
