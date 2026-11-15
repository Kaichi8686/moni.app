"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PenLine, Plus, Sparkles } from "lucide-react";
import { ProjectBriefSection } from "@/components/projects/workspace/ProjectBriefSection";
import { ProjectDeletionVoteBanner } from "@/components/projects/workspace/ProjectDeletionVoteBanner";
import { ProjectGoalBanner } from "@/components/projects/workspace/ProjectGoalBanner";
import { ProjectGoalDetailSheet } from "@/components/projects/workspace/ProjectGoalDetailSheet";
import { StickyBelowWorkspaceHeader } from "@/components/projects/workspace/StickyBelowWorkspaceHeader";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { RoadmapAchieveConfirmDialog } from "@/components/projects/workspace/roadmap/RoadmapAchieveConfirmDialog";
import { RoadmapStepCreateSheet } from "@/components/projects/workspace/roadmap/RoadmapStepCreateSheet";
import { RoadmapStepList } from "@/components/projects/workspace/roadmap/RoadmapStepList";
import { resolveRoadmapMarkId } from "@/components/projects/workspace/roadmap/roadmapPathMarks";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { resolveProjectBrief } from "@/lib/projects/projectBrief";
import { buildStepListItems } from "@/lib/roadmap/buildStepListItems";
import { useRoadmapProject } from "@/lib/roadmap/useRoadmapProject";
import { addDays } from "date-fns";

export default function WorkspaceOverview() {
  const { tx } = useI18n();
  const router = useRouter();
  const {
    project,
    projectMeta,
    projectId,
    issues,
    phases: workspacePhases,
    loading,
    canEdit,
    coachingContext,
    reload: wsReload,
    uid,
  } = useProjectWorkspace();
  const roadmap = useRoadmapProject(projectId);
  const projectBrief = resolveProjectBrief({
    coachingContext,
    description: project?.description,
  });
  const projectGoal = projectBrief.projectGoal.trim();
  const problemMotivation = projectBrief.problemMotivation.trim();
  const roadmapEditHref = `/projects/${projectId}/roadmap`;
  const [goalDetailOpen, setGoalDetailOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [achievePhaseId, setAchievePhaseId] = useState<string | null>(null);
  const [achieveBusy, setAchieveBusy] = useState(false);
  const [achieveError, setAchieveError] = useState("");
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const photoUrl = projectMeta?.thumbnail_url?.trim() || "";
  const backgroundUrl = projectMeta?.background_url?.trim() || "";

  /**
   * 「すべて見る」地図ページと同じ project_phases を使う。
   * 地図側で削除した直後でも概要に戻ったときに連動するよう、
   * roadmap hook を優先し、初回ロード中のみ workspace のキャッシュを出す。
   * reload 中も roadmap.phases を保持し、達成直後に古い workspace へ戻らないようにする。
   */
  const sortedPhases = useMemo(() => {
    const source = roadmap.phases.length > 0 ? roadmap.phases : workspacePhases;
    return [...source].sort((a, b) => a.order - b.order);
  }, [roadmap.phases, workspacePhases]);

  const { items: stepListItems, currentMainIndex, currentStepId } = useMemo(
    () =>
      buildStepListItems(sortedPhases, {
        issues,
        assigneeUserId: uid,
        nextMoveLabel: tx("次の一手", "Next move"),
        dueLabelPrefix: tx("期限", "Due"),
      }),
    [issues, sortedPhases, tx, uid],
  );

  /** 今やっているステップは最初から開く（現在ステップが変わったら開き直す） */
  useEffect(() => {
    if (!currentStepId) return;
    setExpandedId(currentStepId);
  }, [currentStepId, projectId]);

  const achievePhase = achievePhaseId
    ? sortedPhases.find((phase) => phase.id === achievePhaseId) ?? null
    : null;

  const achieveUnfinishedIssueCount = useMemo(() => {
    if (!achievePhaseId) return 0;
    return issues.filter(
      (issue) =>
        issue.phaseId === achievePhaseId &&
        issue.status !== "cancelled" &&
        issue.status !== "done",
    ).length;
  }, [achievePhaseId, issues]);

  const expandedPhase = expandedId
    ? sortedPhases.find((phase) => phase.id === expandedId) ?? null
    : null;

  const expandedIsCurrent = Boolean(
    expandedPhase &&
      !expandedPhase.sideOf &&
      expandedPhase.status !== "completed" &&
      (expandedPhase.status === "in_progress" ||
        sortedPhases
          .filter((p) => !p.sideOf)
          .findIndex((p) => p.id === expandedPhase.id) === currentMainIndex),
  );

  if (loading) return <p className="text-sm text-zinc-500">{tx("読み込み中…", "Loading…")}</p>;
  if (!project) return <p className="text-sm text-zinc-500">{tx("プロジェクトがありません。", "No project found.")}</p>;

  const completedSteps = sortedPhases.filter((phase) => phase.status === "completed").length;
  const progress =
    sortedPhases.length > 0
      ? Math.round((completedSteps / sortedPhases.length) * 100)
      : issues.length > 0
        ? Math.round((issues.filter((issue) => issue.status === "done").length / issues.length) * 100)
        : 0;

  return (
    <div className="pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))]">
      {/* 背景（background_url）と正方形写真（thumbnail_url）は別画像 */}
      <section className="-mx-4 -mt-4 border-b border-zinc-200 bg-white md:-mx-6 md:-mt-5">
        <div className="relative h-44 w-full overflow-hidden bg-zinc-100 sm:h-52">
          {backgroundUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-owned Supabase image
            <img src={backgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(145deg, #fed7aa 0%, #fdba74 42%, #fb923c 100%)",
              }}
              aria-hidden
            />
          )}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent"
            aria-hidden
          />
        </div>

        <div className="px-4 pb-5 sm:px-5 md:px-6">
          <div className="relative z-10 mx-auto max-w-3xl">
            <div className="-mt-9 flex items-end gap-4">
              <div className="relative shrink-0">
                <div className="h-16 w-16 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 sm:h-20 sm:w-20">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- user-owned Supabase image
                    <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-orange-100 text-3xl">
                      {project.icon ?? "📁"}
                    </div>
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1 pb-0.5 pt-10">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold tracking-tight text-zinc-950 sm:text-xl">
                      {project.name}
                    </h2>
                    <p className="mt-1 text-[12px] text-zinc-500">
                      {tx(`${project.members.length}人のメンバー`, `${project.members.length} members`)}
                    </p>
                  </div>
                  <p className="shrink-0 text-2xl font-semibold tabular-nums tracking-tight text-orange-500 sm:text-3xl">
                    {progress}%
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-[13px] font-medium text-zinc-700">
              {sortedPhases.length > 0
                ? tx(
                    `ステップ ${completedSteps}/${sortedPhases.length} 完了`,
                    `${completedSteps}/${sortedPhases.length} steps complete`,
                  )
                : tx("ロードマップ未設定", "Roadmap not set")}
            </p>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-orange-400 transition-[width] duration-500"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-7 pt-7">
        <ProjectDeletionVoteBanner />
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-zinc-950 sm:text-lg">{tx("ロードマップ", "Roadmap")}</h2>
            {canEdit ? (
              <Link
                href={roadmapEditHref}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[12px] font-bold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100"
              >
                <PenLine className="h-3.5 w-3.5" aria-hidden />
                {tx("編集する", "Edit")}
              </Link>
            ) : null}
          </div>
          {/* 未入力はゴール CTA、入力後は同じ位置にゴールバナー */}
          <div className="mb-4">
            <ProjectBriefSection />
          </div>
          {project && projectGoal ? (
            <StickyBelowWorkspaceHeader>
              <ProjectGoalBanner
                projectName={project.name}
                goal={projectGoal}
                onClick={() => setGoalDetailOpen(true)}
              />
            </StickyBelowWorkspaceHeader>
          ) : null}
          <RoadmapStepList
            steps={stepListItems}
            currentIndex={currentMainIndex}
            expandedId={expandedId}
            onToggle={(id) => setExpandedId((current) => (current === id ? null : id))}
            onSelectTask={(task) => {
              if (!task.issueId) return;
              router.push(`/projects/${projectId}/issues?task=${encodeURIComponent(task.issueId)}`);
            }}
            renderExpandedActions={(step) => {
              if (step.status === "completed") return null;
              if (!roadmap.canEdit || !expandedIsCurrent || step.id !== expandedId) return null;
              return (
                <button
                  type="button"
                  onClick={() => {
                    setAchieveError("");
                    setAchievePhaseId(step.id);
                  }}
                  className="min-h-[44px] w-full rounded-full bg-orange-500 text-sm font-bold text-white shadow-sm hover:bg-orange-600"
                >
                  {tx("このステップを達成する", "Mark step achieved")}
                </button>
              );
            }}
            empty={
              <button
                type="button"
                disabled={!canEdit || !roadmap.canEdit || createBusy}
                onClick={() => {
                  if (!canEdit || !roadmap.canEdit) return;
                  setCreateSheetOpen(true);
                }}
                className="flex w-full flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 px-6 py-10 text-center transition hover:border-orange-300 hover:bg-orange-50/40 disabled:opacity-50"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-white shadow-[0_4px_0_#c2410c]">
                  <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden />
                </span>
                <span className="text-sm font-semibold text-zinc-800">
                  {tx("最初のステップを追加", "Add the first step")}
                </span>
                <span className="max-w-xs text-[13px] text-zinc-500">
                  {tx("ロードマップを縦のステップで組み立てましょう。", "Build your roadmap as a vertical list of steps.")}
                </span>
              </button>
            }
          />
        </section>

        {project && projectGoal ? (
          <ProjectGoalDetailSheet
            open={goalDetailOpen}
            onClose={() => setGoalDetailOpen(false)}
            projectName={project.name}
            goal={projectGoal}
            problemMotivation={problemMotivation}
            canEdit={false}
          />
        ) : null}

        <RoadmapStepCreateSheet
          open={createSheetOpen}
          busy={createBusy}
          initialIcon={resolveRoadmapMarkId(undefined, 0)}
          onClose={() => setCreateSheetOpen(false)}
          onSubmit={async (values) => {
            setCreateBusy(true);
            try {
              const start = new Date();
              await roadmap.createPhase({
                title: values.title,
                goal: values.goal,
                description: values.description,
                icon: values.icon,
                startDate: start.toISOString(),
                endDate: addDays(start, 14).toISOString(),
                status: "in_progress",
              });
              await wsReload();
            } finally {
              setCreateBusy(false);
            }
          }}
        />

        <RoadmapAchieveConfirmDialog
          open={Boolean(achievePhase)}
          goal={achievePhase?.goal}
          stepTitle={achievePhase?.title}
          unfinishedIssueCount={achieveUnfinishedIssueCount}
          busy={achieveBusy}
          error={achieveError}
          onCancel={() => {
            if (achieveBusy) return;
            setAchievePhaseId(null);
            setAchieveError("");
          }}
          onConfirm={async () => {
            if (!achievePhase) return;
            if (!roadmap.canEdit) {
              setAchieveError(tx("編集権限がありません", "You don’t have permission to edit"));
              return;
            }
            setAchieveBusy(true);
            setAchieveError("");
            try {
              await roadmap.updatePhase(achievePhase.id, { status: "completed" });
              if (!achievePhase.sideOf) {
                const mainPhases = sortedPhases.filter((p) => !p.sideOf);
                const idx = mainPhases.findIndex((item) => item.id === achievePhase.id);
                const next =
                  idx >= 0
                    ? mainPhases.slice(idx + 1).find((item) => item.status !== "completed")
                    : undefined;
                if (next) {
                  await roadmap.updatePhase(next.id, { status: "in_progress" });
                }
              }
              await wsReload();
              setAchievePhaseId(null);
              setExpandedId(null);
            } catch (e) {
              setAchieveError(
                e instanceof Error
                  ? e.message
                  : tx("達成の反映に失敗しました", "Could not mark this step achieved"),
              );
            } finally {
              setAchieveBusy(false);
            }
          }}
        />
      </div>

      {/* アイデアタブと同系の Duo 角丸正方形ボタン（左下）→ AI コーチ */}
      <Link
        href={`/projects/${projectId}/coach`}
        className="pointer-events-auto fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] left-4 z-30 inline-flex h-[60px] w-[60px] select-none flex-col items-center justify-center gap-0.5 rounded-[1.15rem] bg-[#6B5CF6] text-[12px] font-extrabold leading-none tracking-tight text-white shadow-[0_4px_0_#4C3FBF] transition-[transform,box-shadow] duration-75 active:translate-y-[4px] active:shadow-none"
        aria-label={tx("AI", "AI")}
      >
        <Sparkles className="h-5 w-5 shrink-0" aria-hidden strokeWidth={2.5} />
        AI
      </Link>
    </div>
  );
}
