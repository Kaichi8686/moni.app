"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { UserPlus, Users } from "lucide-react";
import { createSkillRequest, SKILL_OPTIONS } from "@/lib/discover/skillRequests";
import { searchTalentByKeywords, type TalentHit } from "@/lib/discover/talentSearch";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { sendProjectInvite } from "@/lib/projects/projectInvites";
import { supabase } from "@/lib/supabase";

type Mode = "search" | "recruit";

type Props = {
  projectId: string;
  projectName: string;
  userId: string | null;
  canEdit: boolean;
  memberIds: string[];
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
  memberIds,
  recruitmentTarget,
  recruitmentMessage,
  visibility = "public",
  onRecruitmentSaved,
  onNotice,
}: Props) {
  const { tx } = useI18n();
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState(recruitmentTarget.trim());
  const [hits, setHits] = useState<TalentHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchNotice, setSearchNotice] = useState("");
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);

  const [targetDraft, setTargetDraft] = useState(recruitmentTarget);
  const [messageDraft, setMessageDraft] = useState(recruitmentMessage);
  const [skillName, setSkillName] = useState<string>(SKILL_OPTIONS[0]);
  const [duration, setDuration] = useState("1週間");
  const [compensation, setCompensation] = useState("なし（経験・実績として）");
  const [postToBoard, setPostToBoard] = useState(true);
  const [saving, setSaving] = useState(false);

  const memberSet = useMemo(() => new Set(memberIds), [memberIds]);

  useEffect(() => {
    setTargetDraft(recruitmentTarget);
    setMessageDraft(recruitmentMessage);
  }, [recruitmentTarget, recruitmentMessage]);

  useEffect(() => {
    const seed = recruitmentTarget.trim();
    if (!seed) return;
    setQuery((prev) => (prev.trim() ? prev : seed));
  }, [recruitmentTarget]);

  useEffect(() => {
    if (mode !== "search") return;
    const q = query.trim();
    if (q.length < 1) {
      setHits([]);
      setSearchNotice("");
      return;
    }
    const client = supabase;
    if (!client || !userId) return;

    const handle = window.setTimeout(() => {
      void (async () => {
        setSearching(true);
        setSearchNotice("");
        try {
          const results = await searchTalentByKeywords(client, {
            query: q,
            excludeUserId: userId,
            excludeUserIds: memberIds,
            limit: 20,
          });
          setHits(results);
          setSearchNotice(
            results.length === 0
              ? tx(
                  "条件に合う人がまだいません。キーワードを変えるか、募集を出してみましょう。",
                  "No matching people yet. Try other keywords or post a recruitment.",
                )
              : tx(`${results.length}人見つかりました`, `${results.length} people found`),
          );
        } catch (e) {
          setHits([]);
          setSearchNotice(e instanceof Error ? e.message : tx("検索に失敗しました", "Search failed"));
        } finally {
          setSearching(false);
        }
      })();
    }, 320);
    return () => window.clearTimeout(handle);
  }, [mode, query, userId, memberIds, tx]);

  async function invitePerson(hit: TalentHit) {
    if (!userId) return;
    setInviteBusyId(hit.id);
    try {
      const res = await sendProjectInvite(projectId, hit.id);
      if (!res.ok) {
        onNotice(res.error.includes("すでにメンバー") ? tx("すでにメンバーです", "Already a member") : res.error);
        return;
      }
      onNotice(tx(`${hit.displayName} さんを招待しました`, `Invited ${hit.displayName}`));
      setHits((prev) => prev.filter((h) => h.id !== hit.id));
    } finally {
      setInviteBusyId(null);
    }
  }

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

      setQuery(target);
      setMode("search");
      onRecruitmentSaved();
      onNotice(
        postToBoard
          ? tx(
              "募集を公開しました。探すタブのプロジェクトとスキル募集に反映されます。",
              "Recruitment posted. It appears on Discover projects and the skills board.",
            )
          : tx(
              "欲しい人材を保存しました。探すタブの公開プロジェクトに表示されます。",
              "Saved. It will show on public projects in Discover.",
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
            {tx("欲しい人材", "Wanted talent")}
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
            {tx(
              "キーワードで仲間を探すか、募集を出して探すタブに載せられます。",
              "Search people by keyword, or post a role that appears on Discover.",
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

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1">
        <button
          type="button"
          className={`min-h-[40px] rounded-lg text-sm font-semibold transition ${
            mode === "search" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
          }`}
          onClick={() => setMode("search")}
        >
          {tx("人材を探す", "Search talent")}
        </button>
        <button
          type="button"
          className={`min-h-[40px] rounded-lg text-sm font-semibold transition ${
            mode === "recruit" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
          }`}
          onClick={() => setMode("recruit")}
          disabled={!canEdit}
        >
          {tx("人材を募集", "Post role")}
        </button>
      </div>

      {mode === "search" ? (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="sr-only">{tx("欲しい人材を入力", "Type the talent you want")}</span>
            <input
              className="min-h-[44px] w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none focus:border-zinc-400"
              placeholder={tx(
                "例: デザイナー プログラミング マーケ",
                "e.g. designer programming marketing",
              )}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {searchNotice ? <p className="text-[12px] text-zinc-500">{searchNotice}</p> : null}
          {searching ? <p className="text-[12px] text-zinc-400">{tx("検索中…", "Searching…")}</p> : null}
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200">
            {hits.map((hit) => {
              const alreadyMember = memberSet.has(hit.id);
              return (
                <li key={hit.id} className="flex items-center gap-3 px-3 py-3">
                  {hit.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- user avatar from Supabase
                    <img src={hit.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-600">
                      {hit.displayName.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/profile/${hit.id}`}
                      className="block truncate text-sm font-semibold text-zinc-900 hover:underline"
                    >
                      {hit.displayName}
                    </Link>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500">
                      {hit.skills.slice(0, 3).join(" · ") || hit.goal || tx("プロフィール未設定", "No profile yet")}
                    </p>
                  </div>
                  {canEdit ? (
                    <button
                      type="button"
                      disabled={alreadyMember || inviteBusyId === hit.id}
                      className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg bg-zinc-900 px-2.5 text-[12px] font-semibold text-white disabled:opacity-40"
                      onClick={() => void invitePerson(hit)}
                    >
                      <UserPlus className="h-3.5 w-3.5" aria-hidden />
                      {alreadyMember
                        ? tx("参加済", "Joined")
                        : inviteBusyId === hit.id
                          ? "…"
                          : tx("招待", "Invite")}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {canEdit && query.trim() && hits.length === 0 && !searching ? (
            <button
              type="button"
              className="w-full min-h-[44px] rounded-xl border border-zinc-300 bg-white text-sm font-semibold text-zinc-800"
              onClick={() => {
                setTargetDraft(query.trim());
                setMode("recruit");
              }}
            >
              {tx("この条件で募集を出す", "Post a recruitment with this role")}
            </button>
          ) : null}
        </div>
      ) : (
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
            </>
          )}
        </div>
      )}
    </section>
  );
}
