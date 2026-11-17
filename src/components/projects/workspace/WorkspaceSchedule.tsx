"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { WorkspaceSlideShell } from "@/components/projects/workspace/WorkspaceSlideShell";
import { ProjectScheduleCalendar } from "@/components/projects/ProjectScheduleCalendar";
import { IssueDetailSheet } from "@/components/issues/IssueDetailSheet";
import { IssueModal } from "@/components/issues/IssueModal";
import { sortIssuesByDueDate } from "@/lib/workspace/sortIssuesByDueDate";
import type { Issue } from "@/lib/workspace/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { WorkspacePageSkeleton } from "@/components/ui/Skeleton";
import { closeWorkspacePanel } from "@/lib/workspace/closeWorkspacePanel";

export default function WorkspaceSchedule() {
  const { tx } = useI18n();
  const router = useRouter();
  const {
    project,
    projectId,
    issues,
    phases,
    schedules,
    scheduleSaving,
    createSchedule,
    deleteSchedule,
    canEdit,
    updateIssue,
    updateIssueStatus,
    updateIssueWorkflow,
    saveIssueWork,
    completeIssue,
    loading,
  } = useProjectWorkspace();
  const [detailIssue, setDetailIssue] = useState<Issue | null>(null);
  const [editIssue, setEditIssue] = useState<Issue | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addEntered, setAddEntered] = useState(false);
  const closeCalendarRef = useRef<(() => void) | null>(null);
  const bindClose = useCallback((close: () => void) => {
    closeCalendarRef.current = close;
  }, []);
  const [form, setForm] = useState({
    title: "",
    description: "",
    startsAt: "",
    endsAt: "",
    attendees: "",
    kind: "event" as "event" | "busy",
  });

  useEffect(() => {
    if (!addOpen) {
      setAddEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setAddEntered(true));
    return () => cancelAnimationFrame(id);
  }, [addOpen]);

  function openAdd(prefill?: { startsAt?: string; endsAt?: string }) {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const fallbackStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T10:00`;
    const fallbackEnd = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T11:00`;
    setForm({
      title: "",
      description: "",
      startsAt: prefill?.startsAt || fallbackStart,
      endsAt: prefill?.endsAt || fallbackEnd,
      attendees: "",
      kind: "event",
    });
    setAddOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.startsAt) return;
    await createSchedule({
      title: form.title.trim(),
      description: form.description.trim(),
      startsAt: form.startsAt,
      endsAt: form.endsAt,
      attendees: form.attendees,
      kind: "event",
    });
    setAddOpen(false);
  }

  const sortedIssues = sortIssuesByDueDate(issues);
  const detailIssueLive = detailIssue ? issues.find((i) => i.id === detailIssue.id) ?? detailIssue : null;
  const editIssueLive = editIssue ? issues.find((i) => i.id === editIssue.id) ?? editIssue : null;
  const detailPhase = detailIssueLive?.phaseId ? phases.find((p) => p.id === detailIssueLive.phaseId) : undefined;

  if (loading) return <WorkspacePageSkeleton />;
  if (!project) {
    return (
      <WorkspaceSlideShell
        title={tx("カレンダー", "Calendar")}
        onClose={() => closeWorkspacePanel(router, projectId)}
        contentClassName="px-4 pt-8"
      >
        <p className="text-center text-sm text-zinc-500">{tx("プロジェクトがありません。", "No project found.")}</p>
      </WorkspaceSlideShell>
    );
  }

  return (
    <>
      <WorkspaceSlideShell
        title={tx("カレンダー", "Calendar")}
        onClose={() => closeWorkspacePanel(router, projectId)}
        hideHeader
        onBindClose={bindClose}
        contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden px-0 !pb-0"
      >
        <ProjectScheduleCalendar
          schedules={schedules}
          issues={sortedIssues
            .filter((i) => i.dueDate)
            .map((i) => ({ id: i.id, title: i.title, dueDate: i.dueDate!, status: i.status }))}
          onIssueClick={(id) => {
            const issue = issues.find((x) => x.id === id);
            if (issue) setDetailIssue(issue);
          }}
          onSave={createSchedule}
          onDelete={deleteSchedule}
          saving={scheduleSaving}
          canEdit={canEdit}
          fullBleed
          hideAddForm
          onRequestAdd={(prefill) => openAdd(prefill)}
          onBack={() => closeCalendarRef.current?.()}
        />
      </WorkspaceSlideShell>

      {addOpen ? (
        <div
          className="fixed inset-0 z-[220] flex items-end justify-center bg-black/40"
          onClick={() => setAddOpen(false)}
        >
          <div
            className={`w-full max-w-lg rounded-t-3xl bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              addEntered ? "translate-y-0" : "translate-y-full"
            }`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={tx("予定を追加", "Add event")}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-200" aria-hidden />
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[16px] font-bold text-zinc-950">{tx("予定を追加", "Add event")}</h2>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
                onClick={() => setAddOpen(false)}
                aria-label={tx("閉じる", "Close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form className="space-y-3" onSubmit={(e) => void handleSubmit(e)}>
              <input
                required
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-[15px] outline-none focus:border-[#FF9600] focus:bg-white focus:ring-2 focus:ring-[#FF9600]/20"
                placeholder={tx("タイトル（例：キックオフ）", "Title (e.g. kickoff)")}
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
              <div className="flex flex-col gap-2">
                <label className="block min-w-0 text-[11px] font-semibold text-zinc-500">
                  {tx("開始", "Starts")}
                  <input
                    required
                    type="datetime-local"
                    className="mt-1 box-border w-full max-w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[16px] outline-none focus:border-[#FF9600]"
                    value={form.startsAt}
                    onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))}
                  />
                </label>
                <label className="block min-w-0 text-[11px] font-semibold text-zinc-500">
                  {tx("終了（任意）", "Ends (optional)")}
                  <input
                    type="datetime-local"
                    className="mt-1 box-border w-full max-w-full min-w-0 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[16px] outline-none focus:border-[#FF9600]"
                    value={form.endsAt}
                    onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))}
                  />
                </label>
              </div>
              <input
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#FF9600]"
                placeholder={tx("参加者（カンマ区切り・任意）", "Attendees (optional)")}
                value={form.attendees}
                onChange={(e) => setForm((p) => ({ ...p, attendees: e.target.value }))}
              />
              <textarea
                className="min-h-[72px] w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#FF9600]"
                placeholder={tx("メモ・場所など（任意）", "Notes / place (optional)")}
                rows={2}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
              <button
                type="submit"
                disabled={scheduleSaving || !form.title.trim() || !form.startsAt}
                className="w-full rounded-full bg-[#FF9600] py-3.5 text-[15px] font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
              >
                {scheduleSaving ? tx("追加中…", "Adding…") : tx("予定を追加", "Add event")}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <IssueDetailSheet
        issue={detailIssueLive}
        open={Boolean(detailIssueLive)}
        phaseTitle={detailPhase?.title}
        phaseGoal={detailPhase?.description}
        members={project.members}
        canEdit={canEdit}
        onClose={() => setDetailIssue(null)}
        onEdit={
          canEdit && detailIssueLive
            ? () => {
                setEditIssue(detailIssueLive);
                setDetailIssue(null);
              }
            : undefined
        }
        onSaveWorkflow={async (id, workflow) => updateIssueWorkflow(id, workflow)}
        onMarkIssueDone={async (id, answer) => completeIssue(id, answer)}
        onToggleDone={async (issue) => {
          await updateIssueStatus(issue.id, issue.status === "done" ? "todo" : "done");
        }}
        onSaveMemo={async (id, memo) => {
          const issue = issues.find((item) => item.id === id);
          if (!issue) return;
          const next = memo.trim();
          const current = issue.workspaceText.trim();
          const workspaceText = !next || current.includes(next) ? current : `${current}\n\n## まとめ\n${next}`.trim();
          await saveIssueWork(id, { workspaceText });
        }}
      />
      <IssueModal
        issue={editIssueLive}
        open={Boolean(editIssueLive)}
        onClose={() => setEditIssue(null)}
        members={project.members}
        canEdit={canEdit}
        onSave={async (id, patch) => {
          await updateIssue(id, {
            title: patch.title,
            description: patch.description,
            priority: patch.priority,
            status: patch.status,
            assigneeIds: patch.assigneeIds,
            dueDate: patch.dueDate,
          });
        }}
      />
    </>
  );
}
