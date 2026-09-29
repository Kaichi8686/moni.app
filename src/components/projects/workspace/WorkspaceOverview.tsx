"use client";

import Link from "next/link";
import { useMemo, useState, type ComponentType } from "react";
import {
  Check,
  FileText,
  Lightbulb,
  ListChecks,
  LockKeyhole,
  MessageCircle,
  PenLine,
  PenTool,
  Sparkles,
  Vote,
} from "lucide-react";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { RoadmapPhaseInfoSheet } from "@/components/projects/workspace/roadmap/RoadmapPhaseInfoSheet";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useRoadmapProject } from "@/lib/roadmap/useRoadmapProject";
import { assigneeLabel, isIssueAssignedTo } from "@/lib/workspace/issueAssignees";
import { isIssueSubmitted, isoToDateInput } from "@/lib/workspace/issueWork";
import { sortIssuesByDueDate } from "@/lib/workspace/sortIssuesByDueDate";

/** 概要のロードマップカードは未完了から最大この件数まで常時表示 */
const ROADMAP_VISIBLE_LIMIT = 6;

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

function ActionLink({
  href,
  icon: IconComponent,
  label,
  detail,
  filled = false,
}: {
  href: string;
  icon: Icon;
  label: string;
  detail?: string;
  filled?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-[104px] flex-col justify-between rounded-2xl border p-4 transition active:scale-[0.99] ${
        filled
          ? "border-violet-600 bg-violet-600 text-white shadow-sm hover:bg-violet-700"
          : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50"
      }`}
    >
      <IconComponent className="h-6 w-6" aria-hidden />
      <div className="mt-4">
        <p className="text-[15px] font-semibold">{label}</p>
        {detail ? <p className={`mt-0.5 text-[12px] ${filled ? "text-violet-100" : "text-zinc-500"}`}>{detail}</p> : null}
      </div>
    </Link>
  );
}

function CompactLink({ href, icon: IconComponent, label }: { href: string; icon: Icon; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-2 text-center transition hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.99] sm:min-h-[104px]"
    >
      <IconComponent className="h-6 w-6 text-zinc-700 sm:h-7 sm:w-7" aria-hidden />
      <span className="text-[13px] font-semibold text-zinc-800 sm:text-sm">{label}</span>
    </Link>
  );
}

export default function WorkspaceOverview() {
  const { tx } = useI18n();
  const { project, projectMeta, projectId, issues, phases: workspacePhases, loading, uid, canEdit, reload } =
    useProjectWorkspace();
  const roadmap = useRoadmapProject(projectId);
  const [expandState, setExpandState] = useState<{ projectId: string; open: boolean }>({
    projectId,
    open: false,
  });
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const roadmapExpanded = expandState.open && expandState.projectId === projectId;

  /**
   * 「すべて見る」地図ページと同じ project_phases を使う。
   * 地図側で削除した直後でも概要に戻ったときに連動するよう、
   * roadmap hook を優先し、初回ロード中のみ workspace のキャッシュを出す。
   */
  const sortedPhases = useMemo(() => {
    const source = !roadmap.loading ? roadmap.phases : workspacePhases;
    return [...source].sort((a, b) => a.order - b.order);
  }, [roadmap.loading, roadmap.phases, workspacePhases]);
  const selectedPhaseLive = selectedPhaseId
    ? sortedPhases.find((phase) => phase.id === selectedPhaseId) ?? null
    : null;
  /** 未完了を先頭にし、完了済みはその後ろ */
  const displayPhases = useMemo(() => {
    const active = sortedPhases.filter((phase) => phase.status !== "completed");
    const done = sortedPhases.filter((phase) => phase.status === "completed");
    return [...active, ...done];
  }, [sortedPhases]);
  const visiblePhases = useMemo(
    () => (roadmapExpanded ? displayPhases : displayPhases.slice(0, ROADMAP_VISIBLE_LIMIT)),
    [displayPhases, roadmapExpanded],
  );
  const hiddenPhaseCount = Math.max(0, displayPhases.length - visiblePhases.length);

  const upcomingIssues = useMemo(
    () =>
      sortIssuesByDueDate(
        issues.filter(
          (issue) =>
            issue.status !== "cancelled" &&
            !isIssueSubmitted(issue) &&
            isIssueAssignedTo(issue, uid),
        ),
      ).slice(0, 3),
    [issues, uid],
  );

  if (loading) return <p className="text-sm text-zinc-500">{tx("読み込み中…", "Loading…")}</p>;
  if (!project) return <p className="text-sm text-zinc-500">{tx("プロジェクトがありません。", "No project found.")}</p>;

  const completedSteps = sortedPhases.filter((phase) => phase.status === "completed").length;
  const inProgressIndex = sortedPhases.findIndex((phase) => phase.status === "in_progress");
  const firstOpenIndex = sortedPhases.findIndex((phase) => phase.status !== "completed");
  const currentIndex = Math.max(0, inProgressIndex >= 0 ? inProgressIndex : firstOpenIndex);
  const progress =
    sortedPhases.length > 0
      ? Math.round((completedSteps / sortedPhases.length) * 100)
      : issues.length > 0
        ? Math.round((issues.filter((issue) => issue.status === "done").length / issues.length) * 100)
        : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-7 pb-8">
      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-4">
          {projectMeta?.thumbnail_url?.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-owned Supabase image
            <img
              src={projectMeta.thumbnail_url.trim()}
              alt=""
              className="h-16 w-16 shrink-0 rounded-2xl border border-zinc-200 object-cover sm:h-20 sm:w-20"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-3xl sm:h-20 sm:w-20">
              {project.icon ?? "📁"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold tracking-tight text-zinc-950 sm:text-xl">{project.name}</h2>
                <p className="mt-1 text-[12px] text-zinc-500">
                  {tx(`${project.members.length}人のメンバー`, `${project.members.length} members`)}
                </p>
                <p className="mt-1 text-[13px] font-medium text-zinc-700">
                  {sortedPhases.length > 0
                    ? tx(
                        `ステップ ${completedSteps}/${sortedPhases.length} 完了`,
                        `${completedSteps}/${sortedPhases.length} steps complete`,
                      )
                    : tx("ロードマップ未設定", "Roadmap not set")}
                </p>
              </div>
              <p className="shrink-0 text-2xl font-semibold tabular-nums tracking-tight text-orange-500 sm:text-3xl">
                {progress}%
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-orange-400 transition-[width] duration-500"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-950 sm:text-lg">{tx("ロードマップ", "Roadmap")}</h2>
          <Link href={`/projects/${projectId}/roadmap`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-zinc-500 hover:text-zinc-900">
            <PenLine className="h-3.5 w-3.5" aria-hidden />
            {tx("編集する", "Edit")}
          </Link>
        </div>
        {sortedPhases.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {visiblePhases.map((phase) => {
                const index = sortedPhases.findIndex((item) => item.id === phase.id);
                const complete = phase.status === "completed";
                const current = phase.status === "in_progress" || (!complete && index === currentIndex);
                const locked = !complete && !current && index > currentIndex;
                const card = (
                  <div
                    className={`relative min-h-[96px] overflow-hidden rounded-2xl border p-2.5 pt-4 transition sm:min-h-[120px] sm:p-4 sm:pt-6 ${
                      locked
                        ? "border-zinc-200 bg-zinc-50 text-zinc-400"
                        : "border-zinc-200 bg-white text-zinc-900 hover:border-orange-200 hover:shadow-sm"
                    }`}
                  >
                    <span className={`absolute inset-x-0 top-0 h-1.5 ${complete || current ? "bg-orange-400" : "bg-zinc-200"}`} />
                    {current ? <span className="absolute right-2 top-2.5 h-2 w-2 rounded-full bg-orange-500 ring-4 ring-orange-100 sm:right-3 sm:top-3 sm:h-2.5 sm:w-2.5" /> : null}
                    {locked ? <LockKeyhole className="absolute right-2 top-2.5 h-3.5 w-3.5 sm:right-3 sm:top-3 sm:h-4 sm:w-4" aria-hidden /> : null}
                    <p className="text-[9px] font-bold tracking-[0.12em] text-zinc-400 sm:text-[10px]">STEP {index + 1}</p>
                    <p className={`mt-1.5 line-clamp-2 text-[12px] font-semibold leading-snug sm:mt-2 sm:text-sm ${locked ? "text-zinc-400" : "text-zinc-800"}`}>
                      {phase.title}
                    </p>
                    {complete ? (
                      <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-orange-600 sm:mt-2">
                        <Check className="h-3 w-3" aria-hidden /> {tx("完了", "Done")}
                      </span>
                    ) : null}
                  </div>
                );
                return locked ? (
                  <div key={phase.id} aria-disabled="true">{card}</div>
                ) : (
                  <button
                    key={phase.id}
                    type="button"
                    className="text-left"
                    onClick={() => setSelectedPhaseId(phase.id)}
                  >
                    {card}
                  </button>
                );
              })}
            </div>
            {hiddenPhaseCount > 0 ? (
              <button
                type="button"
                onClick={() => setExpandState({ projectId, open: true })}
                className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50"
              >
                {tx(`もっと見る（あと${hiddenPhaseCount}件）`, `Show more (${hiddenPhaseCount} more)`)}
              </button>
            ) : roadmapExpanded && displayPhases.length > ROADMAP_VISIBLE_LIMIT ? (
              <button
                type="button"
                onClick={() => setExpandState({ projectId, open: false })}
                className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[13px] font-semibold text-zinc-700 transition hover:bg-zinc-100"
              >
                {tx(`閉じる（${ROADMAP_VISIBLE_LIMIT}件まで表示）`, `Show fewer (up to ${ROADMAP_VISIBLE_LIMIT})`)}
              </button>
            ) : null}
          </>
        ) : (
          <Link href={`/projects/${projectId}/roadmap`} className="flex min-h-[108px] items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 text-sm font-semibold text-zinc-600">
            {tx("ロードマップを作成する", "Create roadmap")}
          </Link>
        )}
      </section>

      <RoadmapPhaseInfoSheet
        open={Boolean(selectedPhaseLive)}
        phase={
          selectedPhaseLive
            ? {
                id: selectedPhaseLive.id,
                title: selectedPhaseLive.title,
                goal: selectedPhaseLive.goal,
                description: selectedPhaseLive.description,
                stepNumber: sortedPhases.findIndex((item) => item.id === selectedPhaseLive.id) + 1,
              }
            : null
        }
        onClose={() => setSelectedPhaseId(null)}
        canEdit={canEdit}
        onSave={
          canEdit && selectedPhaseLive
            ? async (patch) => {
                await roadmap.updatePhase(selectedPhaseLive.id, {
                  goal: patch.goal,
                  description: patch.description,
                });
                await reload();
              }
            : undefined
        }
        editHref={
          !canEdit && selectedPhaseLive
            ? `/projects/${projectId}/roadmap?phase=${selectedPhaseLive.id}`
            : undefined
        }
      />

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-950 sm:text-lg">{tx("今やるべき課題", "What to do now")}</h2>
          <Link href={`/projects/${projectId}/issues`} className="text-[12px] font-semibold text-zinc-500 hover:text-zinc-900">
            {tx("課題一覧", "All issues")}
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          {upcomingIssues.length > 0 ? (
            <ul className="list-none divide-y divide-zinc-100">
              {upcomingIssues.map((issue) => {
                const assignees = assigneeLabel(issue, project.members, tx("未担当", "Unassigned"));
                return (
                  <li key={issue.id}>
                    <Link
                      href={`/projects/${projectId}/issues?task=${issue.id}`}
                      className="flex min-h-[58px] items-center gap-3 px-3.5 py-2.5 hover:bg-zinc-50 sm:px-4"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-zinc-800 sm:text-sm">{issue.title}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
                          {[
                            issue.beginAt ? tx(`開始 ${isoToDateInput(issue.beginAt)}`, `Start ${isoToDateInput(issue.beginAt)}`) : "",
                            issue.dueDate ? tx(`期限 ${isoToDateInput(issue.dueDate)}`, `Due ${isoToDateInput(issue.dueDate)}`) : "",
                          ].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="max-w-[30%] shrink-0 truncate text-[11px] text-zinc-500 sm:text-xs">
                        {assignees}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-[13px] text-zinc-500">
              {tx("あなたの担当課題はありません", "No issues assigned to you")}
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-zinc-950 sm:text-lg">{tx("進める", "Move forward")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <ActionLink href={`/projects/${projectId}/coach`} icon={Sparkles} label={tx("相談AI", "Ask AI")} detail={tx("次の一手を相談", "Plan your next move")} filled />
          <ActionLink href={`/projects/${projectId}/issues`} icon={ListChecks} label={tx("課題", "Issues")} detail={tx(`全${issues.length}件を見る・追加`, `View or add all ${issues.length}`)} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-zinc-950 sm:text-lg">{tx("ひらめき", "Create")}</h2>
        <div className="grid grid-cols-3 gap-3">
          <CompactLink href={`/projects/${projectId}/business-idea`} icon={Lightbulb} label={tx("アイデア", "Ideas")} />
          <CompactLink href={`/projects/${projectId}/ideas`} icon={Vote} label={tx("投票", "Voting")} />
          <CompactLink href={`/projects/${projectId}/whiteboard`} icon={PenTool} label={tx("ボード", "Board")} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-zinc-950 sm:text-lg">{tx("資料", "Files")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <CompactLink href={`/projects/${projectId}/documents`} icon={FileText} label={tx("資料", "Documents")} />
          <CompactLink href={`/projects/${projectId}/chat`} icon={MessageCircle} label={tx("チャット", "Chat")} />
        </div>
      </section>
    </div>
  );
}
