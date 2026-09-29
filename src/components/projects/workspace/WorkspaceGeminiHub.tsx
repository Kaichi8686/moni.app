"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { GeminiAgentPanel } from "@/components/projects/workspace/gemini/GeminiAgentPanel";
import type { GeminiAgentMode } from "@/lib/ai/geminiAgents/types";
import { IDEA_INTERVIEW_HANDOFF_KEY, type IdeaInterviewHandoff } from "@/lib/idea-interview/types";
import { userSituationPromptLabel } from "@/lib/projects/userSituation";
import { useI18n } from "@/lib/i18n/I18nProvider";

function parseMode(raw: string | null): "general" | "ideas" {
  return raw === "ideas" ? "ideas" : "general";
}

export default function WorkspaceGeminiHub() {
  const { tx } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { project, projectId, phases, issues, coachingContext, loading, canEdit, reload } = useProjectWorkspace();
  const modeFromUrl = parseMode(searchParams.get("mode"));
  const [mode, setMode] = useState<"general" | "ideas">(modeFromUrl);
  const [handoffPrompt, setHandoffPrompt] = useState<string | null>(null);

  useEffect(() => {
    setMode(modeFromUrl);
  }, [modeFromUrl]);

  const changeMode = useCallback(
    (next: "general" | "ideas") => {
      setMode(next);
      const qs = next === "ideas" ? "?mode=ideas" : "";
      router.replace(`/projects/${projectId}/coach${qs}`, { scroll: false });
    },
    [projectId, router],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(IDEA_INTERVIEW_HANDOFF_KEY);
      if (!raw) return;
      sessionStorage.removeItem(IDEA_INTERVIEW_HANDOFF_KEY);
      const handoff = JSON.parse(raw) as IdeaInterviewHandoff;
      if (!handoff.seedTitle) return;
      setMode("ideas");
      router.replace(`/projects/${projectId}/coach?mode=ideas`, { scroll: false });
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
  }, [projectId, router]);

  const phaseSummary = useMemo(
    () =>
      phases
        .slice(0, 8)
        .map((p) => `- ${p.title}${p.description?.trim() ? `（${p.description.trim().slice(0, 40)}）` : ""}`)
        .join("\n"),
    [phases],
  );

  const issueSummary = useMemo(() => {
    const openIssues = issues.filter((i) => i.status !== "done" && i.status !== "cancelled");
    const doneCount = issues.filter((i) => i.status === "done").length;
    const inProgress = openIssues.filter((i) => i.status === "in_progress" || i.status === "in_review");
    return [
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
  }, [issues]);

  const userSituationLabel = coachingContext.userSituation
    ? userSituationPromptLabel(coachingContext.userSituation)
    : undefined;

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center text-sm text-[#6B7280]">
        {tx("読み込み中…", "Loading…")}
      </div>
    );
  }
  if (!project) {
    return (
      <div className="flex h-[100dvh] items-center justify-center text-sm text-[#6B7280]">
        {tx("プロジェクトがありません。", "No project found.")}
      </div>
    );
  }

  const panelMode = mode as GeminiAgentMode;

  return (
    <div className="h-[100dvh] w-full bg-white">
      <GeminiAgentPanel
        key={`${mode}-${handoffPrompt ? "handoff" : "plain"}`}
        mode={panelMode}
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
        variant="fullscreen"
        backHref={`/projects/${projectId}/overview`}
        onModeChange={changeMode}
      />
    </div>
  );
}
