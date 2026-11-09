"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  PenLine,
  Sparkles,
} from "lucide-react";
import { ProjectBriefSection } from "@/components/projects/workspace/ProjectBriefSection";
import { ProjectDeletionVoteBanner } from "@/components/projects/workspace/ProjectDeletionVoteBanner";
import { ProjectGoalBanner } from "@/components/projects/workspace/ProjectGoalBanner";
import { ProjectGoalDetailSheet } from "@/components/projects/workspace/ProjectGoalDetailSheet";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { RoadmapPath, RoadmapPathItem } from "@/components/projects/workspace/roadmap/RoadmapPath";
import { RoadmapPathNode } from "@/components/projects/workspace/roadmap/RoadmapPathNode";
import { RoadmapPhaseInfoSheet } from "@/components/projects/workspace/roadmap/RoadmapPhaseInfoSheet";
import { RoadmapStepCreateSheet } from "@/components/projects/workspace/roadmap/RoadmapStepCreateSheet";
import {
  RoadmapStepMark,
  resolveRoadmapMarkId,
} from "@/components/projects/workspace/roadmap/roadmapPathMarks";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { resolveProjectBrief } from "@/lib/projects/projectBrief";
import { splitRoadmapPathLayout, sideSlotsForParent } from "@/lib/roadmap/pathLayout";
import { useRoadmapProject } from "@/lib/roadmap/useRoadmapProject";
import { isIssueAssignedTo } from "@/lib/workspace/issueAssignees";
import { isIssueSubmitted, isoToDateInput } from "@/lib/workspace/issueWork";
import { sortIssuesByDueDate } from "@/lib/workspace/sortIssuesByDueDate";
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
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
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
  const { main: mainPhases, bySideOf } = useMemo(
    () => splitRoadmapPathLayout(sortedPhases),
    [sortedPhases],
  );
  const selectedPhaseLive = selectedPhaseId
    ? sortedPhases.find((phase) => phase.id === selectedPhaseId) ?? null
    : null;
  /** 本線だけを縦に数え、横置きは親行にぶら下げる（最初から全件表示） */
  const displayPhases = mainPhases;

  const inProgressIndex = mainPhases.findIndex((phase) => phase.status === "in_progress");
  const firstOpenIndex = mainPhases.findIndex((phase) => phase.status !== "completed");
  const currentIndex = Math.max(0, inProgressIndex >= 0 ? inProgressIndex : firstOpenIndex);
  const selectedPhaseIsCurrent = Boolean(
    selectedPhaseLive &&
      selectedPhaseLive.status !== "completed" &&
      (selectedPhaseLive.status === "in_progress" ||
        mainPhases.findIndex((item) => item.id === selectedPhaseLive.id) === currentIndex ||
        (selectedPhaseLive.sideOf != null &&
          mainPhases.findIndex((item) => item.id === selectedPhaseLive.sideOf) === currentIndex)),
  );

  /**
   * 今取り組んでいるマスのうち、自分が担当の課題だけ（他メンバーのみ担当は出さない）。
   * 自分以外も担当に入っていても、自分が含まれていれば表示する。
   */
  const selectedPhaseTasks = useMemo(() => {
    if (!selectedPhaseId || !selectedPhaseIsCurrent || !uid) return [];
    return sortIssuesByDueDate(
      issues.filter(
        (issue) =>
          issue.phaseId === selectedPhaseId &&
          issue.status !== "cancelled" &&
          issue.status !== "done" &&
          !isIssueSubmitted(issue) &&
          isIssueAssignedTo(issue, uid),
      ),
    )
      .slice(0, 3)
      .map((issue) => ({
        id: issue.id,
        title: issue.title,
        dueLabel: issue.dueDate
          ? tx(`期限 ${isoToDateInput(issue.dueDate)}`, `Due ${isoToDateInput(issue.dueDate)}`)
          : undefined,
      }));
  }, [issues, selectedPhaseId, selectedPhaseIsCurrent, tx, uid]);

  /** 達成確認用：このマスに紐づく未完了課題（担当者問わず） */
  const selectedPhaseUnfinishedIssueCount = useMemo(() => {
    if (!selectedPhaseId) return 0;
    return issues.filter(
      (issue) =>
        issue.phaseId === selectedPhaseId &&
        issue.status !== "cancelled" &&
        issue.status !== "done",
    ).length;
  }, [issues, selectedPhaseId]);

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
        {/* 未入力は写真ボタン風 CTA、入力後は同じ位置にゴールバナー */}
        <div className="mb-4">
          <ProjectBriefSection />
          {project && projectGoal ? (
            <ProjectGoalBanner
              projectName={project.name}
              goal={projectGoal}
              onClick={() => setGoalDetailOpen(true)}
            />
          ) : null}
        </div>
        {sortedPhases.length > 0 ? (
          <>
            <RoadmapPath
              segmentCleared={displayPhases.map((phase) => {
                const index = mainPhases.findIndex((item) => item.id === phase.id);
                return phase.status === "completed" || index < currentIndex;
              })}
            >
              {displayPhases.map((phase, visibleIndex) => {
                const index = mainPhases.findIndex((item) => item.id === phase.id);
                const complete = phase.status === "completed";
                const current = phase.status === "in_progress" || (!complete && index === currentIndex);
                /** 先のマスは灰色（中身は開ける） */
                const upcoming = !complete && !current && index > currentIndex;
                const tone = complete ? "done" : upcoming ? "upcoming" : "active";
                const sidePhases = bySideOf.get(phase.id) ?? [];
                return (
                  <RoadmapPathItem
                    key={phase.id}
                    index={visibleIndex}
                    sides={sideSlotsForParent(sidePhases).map((side) => {
                      const sideComplete = side.status === "completed";
                      const sideCurrent = side.status === "in_progress";
                      const sideTone = sideComplete
                        ? ("done" as const)
                        : sideCurrent || current
                          ? ("active" as const)
                          : upcoming
                            ? ("upcoming" as const)
                            : ("active" as const);
                      return {
                        key: side.id,
                        lane: side.lane,
                        slotIndex: side.slotIndex,
                        lowerCleared: sideComplete,
                        children: (
                          <RoadmapPathNode
                            tone={sideTone}
                            sparkle={current || sideCurrent}
                            selected={selectedPhaseId === side.id}
                            onClick={() => setSelectedPhaseId(side.id)}
                            aria-label={tx(`横ステップ: ${side.title}`, `Side step: ${side.title}`)}
                          >
                            <RoadmapStepMark markId={side.icon} index={index} tone={sideTone} />
                          </RoadmapPathNode>
                        ),
                      };
                    })}
                  >
                    <RoadmapPathNode
                      tone={tone}
                      sparkle={current}
                      selected={selectedPhaseId === phase.id}
                      onClick={() => setSelectedPhaseId(phase.id)}
                      aria-label={tx(`ステップ ${index + 1}: ${phase.title}`, `Step ${index + 1}: ${phase.title}`)}
                    >
                      <RoadmapStepMark markId={phase.icon} index={index} tone={tone} />
                    </RoadmapPathNode>
                  </RoadmapPathItem>
                );
              })}
            </RoadmapPath>
          </>
        ) : (
          <RoadmapPath>
            <RoadmapPathItem index={0}>
              <RoadmapPathNode
                tone="create"
                sparkle
                disabled={!canEdit || !roadmap.canEdit || createBusy}
                onClick={() => {
                  if (!canEdit || !roadmap.canEdit) return;
                  setCreateSheetOpen(true);
                }}
                aria-label={tx("ロードマップを作成する", "Create roadmap")}
              >
                <RoadmapStepMark index={0} tone="create" />
              </RoadmapPathNode>
            </RoadmapPathItem>
          </RoadmapPath>
        )}
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

      <RoadmapPhaseInfoSheet
        open={Boolean(selectedPhaseLive)}
        phase={
          selectedPhaseLive
            ? {
                id: selectedPhaseLive.id,
                title: selectedPhaseLive.title,
                goal: selectedPhaseLive.goal,
                description: selectedPhaseLive.description,
                stepNumber: (() => {
                  const mainAt = mainPhases.findIndex((item) => item.id === selectedPhaseLive.id);
                  if (mainAt >= 0) return mainAt + 1;
                  if (selectedPhaseLive.sideOf) {
                    const parentAt = mainPhases.findIndex((item) => item.id === selectedPhaseLive.sideOf);
                    if (parentAt >= 0) return parentAt + 1;
                  }
                  return 1;
                })(),
                alreadyDone: selectedPhaseLive.status === "completed",
              }
            : null
        }
        onClose={() => setSelectedPhaseId(null)}
        canEdit={false}
        canAchieve={Boolean(roadmap.canEdit && selectedPhaseIsCurrent)}
        onAchieve={async () => {
          if (!selectedPhaseLive) return;
          if (!roadmap.canEdit) {
            throw new Error(tx("編集権限がありません", "You don’t have permission to edit"));
          }
          await roadmap.updatePhase(selectedPhaseLive.id, { status: "completed" });
          // 本線マスを達成したときだけ次の本線へ進める（横置きは親行の進捗を奪わない）
          if (!selectedPhaseLive.sideOf) {
            const idx = mainPhases.findIndex((item) => item.id === selectedPhaseLive.id);
            const next = idx >= 0
              ? mainPhases.slice(idx + 1).find((item) => item.status !== "completed")
              : undefined;
            if (next) {
              await roadmap.updatePhase(next.id, { status: "in_progress" });
            }
          }
          await wsReload();
          setSelectedPhaseId(null);
        }}
        showTasks={selectedPhaseIsCurrent && selectedPhaseTasks.length > 0}
        tasks={selectedPhaseTasks}
        unfinishedIssueCount={selectedPhaseUnfinishedIssueCount}
        onSelectTask={(taskId) => {
          setSelectedPhaseId(null);
          router.push(`/projects/${projectId}/issues?task=${taskId}`);
        }}
      />

      </div>

      {/* アイデアタブと同系の Duo 角丸四角ボタン（左下）→ AI コーチ */}
      <Link
        href={`/projects/${projectId}/coach`}
        className="pointer-events-auto fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] left-4 z-30 inline-flex select-none items-center justify-center gap-2 rounded-2xl bg-[#6B5CF6] px-5 py-3.5 text-[16px] font-extrabold leading-none tracking-tight text-white shadow-[0_4px_0_#4C3FBF] transition-[transform,box-shadow] duration-75 active:translate-y-[4px] active:shadow-none"
        aria-label={tx("AI", "AI")}
      >
        <Sparkles className="h-5 w-5 shrink-0" aria-hidden strokeWidth={2.5} />
        AI
      </Link>
    </div>
  );
}

