"use client";

import { useEffect, useState } from "react";
import { Lightbulb, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { GeminiAgentPanel } from "@/components/projects/workspace/gemini/GeminiAgentPanel";
import { IDEA_INTERVIEW_HANDOFF_KEY, type IdeaInterviewHandoff } from "@/lib/idea-interview/types";
import { userSituationPromptLabel } from "@/lib/projects/userSituation";
import { useI18n } from "@/lib/i18n/I18nProvider";

const TABS: Array<{ mode: "general" | "ideas"; icon: typeof MessageCircle }> = [
  { mode: "general", icon: MessageCircle },
  { mode: "ideas", icon: Lightbulb },
];

export default function WorkspaceGeminiHub() {
  const { tx } = useI18n();
  const { project, projectId, phases, issues, coachingContext, loading, canEdit, reload } = useProjectWorkspace();
  const [mode, setMode] = useState<"general" | "ideas">("general");
  const [handoffPrompt, setHandoffPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(IDEA_INTERVIEW_HANDOFF_KEY);
      if (!raw) return;
      sessionStorage.removeItem(IDEA_INTERVIEW_HANDOFF_KEY);
      const handoff = JSON.parse(raw) as IdeaInterviewHandoff;
      if (!handoff.seedTitle) return;
      setMode("ideas");
      setHandoffPrompt(
        [
          `ビジネスアイデア発掘インタビューからの引き継ぎです。`,
          `選んだ種: ${handoff.seedTitle}`,
          `概要: ${handoff.seedSummary}`,
          handoff.theme ? `テーマ: ${handoff.theme}` : "",
          handoff.notes ? `ユーザーのメモ:\n${handoff.notes}` : "",
          ``,
          `この種をプロジェクト向けに深掘りし、次に検証すべき小さな一手を提案してください。`,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    } catch {
      /* ignore */
    }
  }, []);

  if (loading) return <p className="text-sm text-[#6B7280]">{tx("読み込み中…", "Loading…")}</p>;
  if (!project) return <p className="text-sm text-[#6B7280]">{tx("プロジェクトがありません。", "No project found.")}</p>;

  const phaseSummary = phases
    .slice(0, 8)
    .map((p) => `- ${p.title}${p.description?.trim() ? `（${p.description.trim().slice(0, 40)}）` : ""}`)
    .join("\n");

  const openIssues = issues.filter((i) => i.status !== "done" && i.status !== "cancelled");
  const doneCount = issues.filter((i) => i.status === "done").length;
  const inProgress = openIssues.filter((i) => i.status === "in_progress" || i.status === "in_review");
  const issueSummary = [
    `全体: ${issues.length}件 / 完了 ${doneCount}件 / 未完了 ${openIssues.length}件`,
    inProgress.length > 0
      ? `進行中: ${inProgress
          .slice(0, 5)
          .map((i) => i.title)
          .join("、")}`
      : "",
    openIssues.length > 0
      ? `未完了（優先表示）:\n${openIssues
          .slice(0, 8)
          .map((i) => `- [${i.status}] ${i.title}`)
          .join("\n")}`
      : "未完了の課題はまだありません。",
  ]
    .filter(Boolean)
    .join("\n");

  const userSituationLabel = coachingContext.userSituation
    ? userSituationPromptLabel(coachingContext.userSituation)
    : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header>
        <h1 className="text-lg font-semibold text-[#1A1A1A]">{tx("相談AI（Gemini）", "Ask AI (Gemini)")}</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-[#6B7280]">
          {tx("プロジェクトの相談やアイデア深掘りはここ。最初の種をゼロから探す場合は", "Ask about the project or go deeper on ideas here. To find a first seed from scratch, go to the")}
          <Link
            href={`/projects/${projectId}/business-idea`}
            className="mx-1 font-semibold text-sky-700 underline"
          >
            {tx("ビジネスアイデア", "Business idea")}
          </Link>
          {tx("タブへ。ロードマップをAIで作る場合は", " tab. To generate a roadmap with AI, use")}
          <Link
            href={`/projects/${projectId}/roadmap/templates?tab=ai`}
            className="ml-1 font-semibold text-violet-700 underline"
          >
            {tx("テンプレートの「AIで作る」", "Templates → “Create with AI”")}
          </Link>
          {tx("を使ってください。", ".")}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {TABS.map(({ mode: m, icon: Icon }) => {
          const active = mode === m;
          const labels = { general: tx("なんでも相談", "Ask anything"), ideas: tx("アイデア編", "Ideas") } as const;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center transition ${
                active
                  ? "border-violet-300 bg-violet-50 text-violet-800"
                  : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-violet-200"
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span className="text-[13px] font-bold leading-snug">{labels[m]}</span>
            </button>
          );
        })}
      </div>

      <GeminiAgentPanel
        key={`${mode}-${handoffPrompt ? "handoff" : "plain"}`}
        mode={mode}
        projectId={projectId}
        projectName={project.name}
        projectDescription={project.description}
        phaseSummary={phaseSummary}
        issueSummary={issueSummary}
        userSituationLabel={userSituationLabel}
        phasesCount={phases.length}
        canEdit={canEdit}
        onReload={reload}
        initialUserMessage={mode === "ideas" ? handoffPrompt ?? undefined : undefined}
      />

      <p className="text-[11px] leading-relaxed text-[#9CA3AF]">
        {tx("使うには", "To use this, set")} <code className="rounded bg-[#F3F4F6] px-1">GEMINI_API_KEY</code> {tx("を .env.local に設定してください（", " in .env.local (get a key from ")}
        <a href="https://aistudio.google.com/apikey" className="underline" target="_blank" rel="noreferrer">
          Google AI Studio
        </a>
        {tx("で取得）。", ").")}
      </p>
    </div>
  );
}
