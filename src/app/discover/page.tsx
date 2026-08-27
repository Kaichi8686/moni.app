"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppBottomNav } from "@/components/AppBottomNav";
import {
  createOpportunity,
  loadOpportunities,
  opportunityTypeLabel,
  type Opportunity,
  type OpportunityType,
} from "@/lib/discover/opportunities";
import {
  createSkillRequest,
  loadOpenSkillRequests,
  SKILL_OPTIONS,
  type SkillRequest,
} from "@/lib/discover/skillRequests";
import {
  loadActiveMentors,
  registerAsMentor,
  requestMentorSession,
  type MentorListing,
} from "@/lib/discover/mentors";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { supabase, supabaseEnabled } from "@/lib/supabase";

type Tab = "opportunities" | "skills" | "mentors";

export default function DiscoverPage() {
  const { t } = useI18n();
  const [fromIdeaInterview, setFromIdeaInterview] = useState(false);
  const [interviewTheme, setInterviewTheme] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("opportunities");
  const [uid, setUid] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [skills, setSkills] = useState<SkillRequest[]>([]);
  const [mentors, setMentors] = useState<MentorListing[]>([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const reload = useCallback(async () => {
    if (!supabase) return;
    const [o, s, m] = await Promise.all([
      loadOpportunities(supabase),
      loadOpenSkillRequests(supabase),
      loadActiveMentors(supabase),
    ]);
    setOpportunities(o);
    setSkills(s);
    setMentors(m);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null));
    void reload();
  }, [reload]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setFromIdeaInterview(params.get("from") === "idea-interview");
    setInterviewTheme(params.get("theme"));
  }, []);

  async function onSkillSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !uid) return;
    const fd = new FormData(e.currentTarget);
    try {
      await createSkillRequest(supabase, uid, {
        skillName: String(fd.get("skill") ?? ""),
        description: String(fd.get("description") ?? ""),
        duration: String(fd.get("duration") ?? "1週間"),
        compensation: String(fd.get("compensation") ?? "なし（経験・実績として）"),
      });
      setMsg("依頼を投稿しました");
      await reload();
      e.currentTarget.reset();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "失敗しました");
    }
  }

  async function onOppSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !uid) return;
    const fd = new FormData(e.currentTarget);
    try {
      await createOpportunity(supabase, uid, {
        type: String(fd.get("type")) as OpportunityType,
        title: String(fd.get("title") ?? ""),
        organizer: String(fd.get("organizer") ?? ""),
        description: String(fd.get("description") ?? ""),
        prize: String(fd.get("prize") ?? ""),
        deadline: fd.get("deadline") ? new Date(String(fd.get("deadline"))).toISOString() : null,
        url: String(fd.get("url") ?? ""),
        tags: [],
      });
      setMsg("機会を投稿しました（運営が確認します）");
      await reload();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "失敗しました");
    }
  }

  if (!supabaseEnabled) {
    return <p className="p-8 text-center text-sm text-gray-500">Supabase 未接続</p>;
  }

  return (
    <div className="min-h-[100dvh] bg-[#fafaf8] pb-bottom-nav">
      <header className="mobile-sticky-header mobile-content-inset py-3">
        <div className="flex items-center gap-3">
          <Link href="/?tab=posts" className="touch-target inline-flex items-center justify-center text-lg">
            ←
          </Link>
          <h1 className="text-lg font-semibold">{t("discoverTitle")}</h1>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
          {(
            [
              ["opportunities", t("discoverOpportunities")],
              ["skills", t("discoverSkills")],
              ["mentors", t("discoverMentors")],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`min-h-[44px] touch-manipulation rounded-lg px-1 py-2 text-sm font-semibold leading-snug ${
                tab === id ? "bg-violet-600 text-white shadow-sm" : "text-gray-700"
              }`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* TODO: wire idea-interview theme interest into real peer matching when ranking exists */}
      {fromIdeaInterview ? (
        <div className="mx-4 mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm leading-relaxed text-sky-900">
          アイデア発掘インタビューからの流入です
          {interviewTheme ? `（テーマ: ${interviewTheme}）` : ""}。
          関心が近い機会・スキル募集・メンターを探してみましょう。
        </div>
      ) : null}

      <main className="mobile-content-inset mx-auto w-full max-w-none space-y-4 py-4 sm:max-w-lg">
        {msg ? <p className="text-sm text-violet-700">{msg}</p> : null}
        {err ? <p className="text-sm text-rose-600">{err}</p> : null}

        {tab === "opportunities" ? (
          <>
            <ul className="space-y-3">
              {opportunities.map((o) => (
                <li key={o.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-medium text-violet-600">
                      {opportunityTypeLabel(o.type)}
                      {o.isVerified ? " · 認定" : ""}
                    </span>
                    {o.deadline ? (
                      <span className="text-[11px] text-gray-400">
                        {new Date(o.deadline).toLocaleDateString("ja-JP")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-semibold text-gray-900">{o.title}</p>
                  {o.organizer ? <p className="text-xs text-gray-500">{o.organizer}</p> : null}
                  {o.description ? <p className="mt-2 text-sm text-gray-600">{o.description}</p> : null}
                  {o.url ? (
                    <a href={o.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-violet-600">
                      詳細を見る →
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
            {uid ? (
              <form className="rounded-2xl border border-dashed border-gray-200 bg-white p-4" onSubmit={(e) => void onOppSubmit(e)}>
                <p className="mb-2 text-sm font-semibold">機会を投稿</p>
                <select name="type" className="mb-2 w-full rounded-lg border px-3 py-2 text-sm">
                  <option value="contest">ビジコン</option>
                  <option value="grant">補助金</option>
                  <option value="internship">インターン</option>
                  <option value="event">イベント</option>
                </select>
                <input name="title" required placeholder="タイトル" className="mb-2 w-full rounded-lg border px-3 py-2 text-sm" />
                <input name="organizer" placeholder="主催" className="mb-2 w-full rounded-lg border px-3 py-2 text-sm" />
                <textarea name="description" placeholder="説明" className="mb-2 w-full rounded-lg border px-3 py-2 text-sm" />
                <input name="url" placeholder="URL" className="mb-2 w-full rounded-lg border px-3 py-2 text-sm" />
                <button type="submit" className="w-full rounded-xl bg-violet-600 py-2 text-sm font-semibold text-white">
                  投稿
                </button>
              </form>
            ) : null}
          </>
        ) : null}

        {tab === "skills" ? (
          <>
            <ul className="space-y-3">
              {skills.map((s) => (
                <li key={s.id} className="rounded-2xl border border-gray-100 bg-white p-4">
                  <p className="text-xs text-violet-600">{s.skillName}</p>
                  <p className="font-semibold">{s.requesterName}</p>
                  {s.description ? <p className="mt-1 text-sm text-gray-600">{s.description}</p> : null}
                  <p className="mt-2 text-[11px] text-gray-400">
                    {s.duration} · {s.compensation}
                  </p>
                </li>
              ))}
            </ul>
            {uid ? (
              <form className="rounded-2xl border border-dashed border-gray-200 bg-white p-4" onSubmit={(e) => void onSkillSubmit(e)}>
                <p className="mb-2 text-sm font-semibold">仲間を募集</p>
                <select name="skill" className="mb-2 w-full rounded-lg border px-3 py-2 text-sm">
                  {SKILL_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <textarea name="description" placeholder="どんなプロジェクト？" className="mb-2 w-full rounded-lg border px-3 py-2 text-sm" />
                <select name="duration" className="mb-2 w-full rounded-lg border px-3 py-2 text-sm">
                  <option>1日以内</option>
                  <option>1週間</option>
                  <option>1ヶ月</option>
                  <option>長期</option>
                </select>
                <select name="compensation" className="mb-2 w-full rounded-lg border px-3 py-2 text-sm">
                  <option>なし（経験・実績として）</option>
                  <option>成果報酬</option>
                  <option>相談</option>
                </select>
                <button type="submit" className="w-full rounded-xl bg-violet-600 py-2 text-sm font-semibold text-white">
                  依頼を出す
                </button>
              </form>
            ) : null}
          </>
        ) : null}

        {tab === "mentors" ? (
          <>
            <ul className="space-y-3">
              {mentors.map((m) => (
                <li key={m.id} className="rounded-2xl border border-gray-100 bg-white p-4">
                  <p className="font-semibold">{m.displayName}</p>
                  <p className="text-xs text-gray-500">{m.expertise.join(" · ") || "ビジネス全般"}</p>
                  {m.bio ? <p className="mt-2 text-sm text-gray-600">{m.bio}</p> : null}
                  <p className="mt-1 text-[11px] text-gray-400">
                    {m.sessionType === "free" ? "無料" : m.pricePer30min ? `${m.pricePer30min}円/30分` : "要相談"} · ★
                    {m.rating.toFixed(1)} · {m.sessionCount}セッション
                  </p>
                  {uid && uid !== m.userId ? (
                    <button
                      type="button"
                      className="mt-2 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
                      onClick={() =>
                        void requestMentorSession(supabase!, uid, m.id).then(() => setMsg("セッションをリクエストしました"))
                      }
                    >
                      相談をリクエスト
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            {uid ? (
              <button
                type="button"
                className="w-full rounded-xl border border-violet-200 py-2 text-sm font-semibold text-violet-700"
                onClick={() =>
                  void registerAsMentor(supabase!, uid, {
                    expertise: ["ビジネス", "マーケ"],
                    bio: "moniメンターとして登録しました",
                    sessionType: "free",
                    pricePer30min: 0,
                  }).then(() => {
                    setMsg("メンター登録しました");
                    void reload();
                  })
                }
              >
                メンターとして登録する
              </button>
            ) : null}
          </>
        ) : null}
      </main>
      <AppBottomNav />
    </div>
  );
}
