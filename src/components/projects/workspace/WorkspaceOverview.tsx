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
import { RoadmapPhaseDetailExpand } from "@/components/projects/workspace/roadmap/RoadmapPhaseDetailExpand";
import {
  nextOrderIds,
  RoadmapReorderMenu,
  type RoadmapReorderAction,
} from "@/components/projects/workspace/roadmap/RoadmapReorderMenu";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useRoadmapProject } from "@/lib/roadmap/useRoadmapProject";
import { supabase } from "@/lib/supabase";
import { assigneeLabel, isIssueAssignedTo } from "@/lib/workspace/issueAssignees";
import { isIssueSubmitted, isoToDateInput } from "@/lib/workspace/issueWork";
import { sortIssuesByDueDate } from "@/lib/workspace/sortIssuesByDueDate";

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
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [reorderBusy, setReorderBusy] = useState(false);

  /**
   * 地図ページと同じ project_phases を使う。
   * roadmap hook を優先し、初回ロード中のみ workspace のキャッシュを出す。
   */
  const sortedPhases = useMemo(() => {
    const source = !roadmap.loading ? roadmap.phases : workspacePhases;
    return [...source].sort((a, b) => a.order - b.order);
  }, [roadmap.loading, roadmap.phases, workspacePhases]);
  /** 未完了を先頭にし、完了済みはその後ろ */
  const displayPhases = useMemo(() => {
    const active = sortedPhases.filter((phase) => phase.status !== "completed");
    const done = sortedPhases.filter((phase) => phase.status === "completed");
    return [...active, ...done];
  }, [sortedPhases]);

  async function movePhase(phaseId: string, action: RoadmapReorderAction) {
    if (!supabase || !canEdit || reorderBusy) return;
    const ids = sortedPhases.map((phase) => phase.id);
    const next = nextOrderIds(ids, phaseId, action);
    if (!next) return;
    setReorderBusy(true);
    try {
      const client = supabase;
      const results = await Promise.all(
        next.map((id, index) =>
          client.from("project_phases").update({ order: index, updated_at: new Date().toISOString() }).eq("id", id),
        ),
      );
      const failed = results.find((result) => result.error);
      if (failed?.error) throw new Error(failed.error.message);
      await Promise.all([roadmap.reload(), reload()]);
    } finally {
      setReorderBusy(false);
    }
  }

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
          <Link
            href={`/projects/${projectId}/roadmap`}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-zinc-500 hover:text-zinc-900"
          >
            <PenLine className="h-3.5 w-3.5" aria-hidden />
            {tx("編集する", "Edit")}
          </Link>
        </div>
        {displayPhases.length > 0 ? (
          <div className="grid grid-cols-3 items-start gap-2 sm:gap-3">
            {displayPhases.map((phase) => {
              const index = sortedPhases.findIndex((item) => item.id === phase.id);
              const complete = phase.status === "completed";
              const current = phase.status === "in_progress" || (!complete && index === currentIndex);
              const locked = !complete && !current && index > currentIndex;
              const expanded = selectedPhaseId === phase.id;
              return (
                <div key={phase.id} className="min-w-0">
                  <div
                    className={`relative rounded-2xl border transition ${
                      locked
                        ? "border-zinc-200 bg-zinc-50 text-zinc-400"
                        : expanded
                          ? "border-orange-200 bg-white text-zinc-900 shadow-sm"
                          : "border-zinc-200 bg-white text-zinc-900 hover:border-orange-200 hover:shadow-sm"
                    }`}
                  >
                    <span
                      className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 rounded-t-2xl ${
                        complete || current ? "bg-orange-400" : "bg-zinc-200"
                      }`}
                    />
                    <div className="flex items-start gap-0.5 px-1 pb-2.5 pt-3.5 sm:px-1.5 sm:pb-3 sm:pt-5">
                      <RoadmapReorderMenu
                        disabled={!canEdit || reorderBusy}
                        canMoveUp={index > 0}
                        canMoveDown={index >= 0 && index < sortedPhases.length - 1}
                        onMove={(action) => void movePhase(phase.id, action)}
                      />
                      <button
                        type="button"
                        className="min-w-0 flex-1 px-0.5 pb-0.5 text-left sm:px-1"
                        aria-expanded={expanded}
                        onClick={() => setSelectedPhaseId((currentId) => (currentId === phase.id ? null : phase.id))}
                      >
                        {current ? (
                          <span className="absolute right-2 top-2.5 h-2 w-2 rounded-full bg-orange-500 ring-4 ring-orange-100 sm:right-3 sm:top-3 sm:h-2.5 sm:w-2.5" />
                        ) : null}
                        {locked ? (
                          <LockKeyhole className="absolute right-2 top-2.5 h-3.5 w-3.5 sm:right-3 sm:top-3 sm:h-4 sm:w-4" aria-hidden />
                        ) : null}
                        <p className="text-[9px] font-bold tracking-[0.12em] text-zinc-400 sm:text-[10px]">STEP {index + 1}</p>
                        <p
                          className={`mt-1.5 line-clamp-2 min-h-[2.4em] text-[12px] font-semibold leading-snug sm:mt-2 sm:text-sm ${
                            locked ? "text-zinc-400" : "text-zinc-800"
                          }`}
                        >
                          {phase.title}
                        </p>
                        {complete ? (
                          <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-orange-600 sm:mt-2">
                            <Check className="h-3 w-3" aria-hidden /> {tx("完了", "Done")}
                          </span>
                        ) : null}
                      </button>
                    </div>
                  </div>
                  <RoadmapPhaseDetailExpand
                    open={expanded}
                    title={phase.title}
                    goal={phase.goal}
                    description={phase.description}
                    stepNumber={index + 1}
                    compact
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <Link
            href={`/projects/${projectId}/roadmap`}
            className="flex min-h-[108px] items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 text-sm font-semibold text-zinc-600"
          >
            {tx("ロードマップを作成する", "Create roadmap")}
          </Link>
        )}
      </section>

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
