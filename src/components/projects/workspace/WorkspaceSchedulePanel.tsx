"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarDays, ChevronDown, ChevronUp, GanttChartSquare, ListTodo } from "lucide-react";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { RoadmapTimeline } from "@/components/roadmap/RoadmapTimeline";
import { ProjectScheduleCalendar } from "@/components/projects/ProjectScheduleCalendar";
import type { Phase, ProjectStatus } from "@/lib/workspace/types";
import { IssueStatusBadge } from "@/components/projects/StatusBadge";

type ScheduleTab = "timeline" | "calendar" | "due";

type Props = {
  projectId: string;
  variant?: "full" | "embedded";
  defaultCollapsed?: boolean;
};

export function WorkspaceSchedulePanel({
  projectId,
  variant = "full",
  defaultCollapsed = false,
}: Props) {
  const {
    phases,
    issues,
    schedules,
    canEdit,
    createPhase,
    movePhase,
    resizePhase,
    createSchedule,
    scheduleSaving,
  } = useProjectWorkspace();

  const embedded = variant === "embedded";
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [tab, setTab] = useState<ScheduleTab>("timeline");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planned");
  const [color, setColor] = useState("purple");
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Phase | null>(null);

  const upcomingIssues = useMemo(() => {
    const now = Date.now();
    return issues
      .filter((i) => i.dueDate && i.status !== "done" && i.status !== "cancelled")
      .filter((i) => new Date(i.dueDate!).getTime() >= now - 86400000)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, embedded ? 8 : 12);
  }, [issues, embedded]);

  async function onSubmitPhase(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !start || !end) return;
    setBusy(true);
    try {
      await createPhase({
        title: title.trim(),
        startDate: new Date(start).toISOString(),
        endDate: new Date(end).toISOString(),
        status,
        color,
      });
      setOpen(false);
      setTitle("");
      setStart("");
      setEnd("");
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: ScheduleTab; label: string; icon: typeof GanttChartSquare }[] = [
    { id: "timeline", label: "フェーズ", icon: GanttChartSquare },
    { id: "calendar", label: "予定", icon: CalendarDays },
    { id: "due", label: "期限の課題", icon: ListTodo },
  ];

  const body = (
    <div className={embedded ? "space-y-3 p-4" : "space-y-4 px-4 pb-4"}>
      <ScheduleTabs tab={tab} onTab={setTab} tabs={tabs} />

      {tab === "timeline" ? (
        <div className="space-y-3">
          <ScheduleToolbar
            canEdit={canEdit}
            onAddPhase={() => setOpen(true)}
            showRoadmapLink={embedded}
            projectId={projectId}
          />
          <RoadmapTimeline
            phases={phases}
            compact={embedded}
            onMovePhase={(id, d) => void movePhase(id, d)}
            onResizePhase={(id, d) => void resizePhase(id, d)}
            onSelectPhase={(p) => setSel(p)}
          />
          {sel ? (
            <div className="rounded-md border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2 text-[13px] text-[#6B7280]">
              <span className="font-semibold text-[#1A1A1A]">{sel.title}</span>
              <span className="mx-1">·</span>
              {sel.startDate.slice(0, 10)} → {sel.endDate.slice(0, 10)}
              <span className="mx-1">·</span>
              {sel.issues.length} 件の課題
              <button type="button" className="ml-2 text-[12px] text-[#5E6AD2] underline" onClick={() => setSel(null)}>
                閉じる
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "calendar" ? (
        <div className={embedded ? "max-h-[min(70vh,640px)] overflow-y-auto" : undefined}>
          <ProjectScheduleCalendar
            schedules={schedules}
            onSave={createSchedule}
            saving={scheduleSaving}
            canEdit={canEdit}
          />
        </div>
      ) : null}

      {tab === "due" ? (
        <ul className="divide-y divide-[#F7F8F8]">
          {upcomingIssues.length === 0 ? (
            <li className="py-6 text-center text-[13px] text-[#6B7280]">期限が近い未完了の課題はありません</li>
          ) : (
            upcomingIssues.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13px]">
                <span className="min-w-0 flex-1 font-medium text-[#1A1A1A]">{i.title}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[12px] font-medium text-[#5E6AD2]">
                    {format(parseISO(i.dueDate!), "M/d（EEE）", { locale: ja })}
                  </span>
                  <IssueStatusBadge status={i.status} />
                </div>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );

  return (
    <section
      className={`overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-sm ${embedded ? "" : ""}`}
      aria-label="スケジュール"
    >
      <ScheduleHeader
        embedded={embedded}
        collapsed={collapsed}
        onToggle={() => embedded && setCollapsed((c) => !c)}
        projectId={projectId}
        phaseCount={phases.length}
        scheduleCount={schedules.length}
        dueCount={upcomingIssues.length}
      />
      {!embedded || !collapsed ? body : null}
      {open ? (
        <PhaseCreateModal
          busy={busy}
          onClose={() => !busy && setOpen(false)}
          onSubmit={onSubmitPhase}
          title={title}
          setTitle={setTitle}
          start={start}
          setStart={setStart}
          end={end}
          setEnd={setEnd}
          status={status}
          setStatus={setStatus}
          color={color}
          setColor={setColor}
        />
      ) : null}
    </section>
  );
}

function ScheduleHeader({
  embedded,
  collapsed,
  onToggle,
  projectId,
  phaseCount,
  scheduleCount,
  dueCount,
}: {
  embedded: boolean;
  collapsed: boolean;
  onToggle: () => void;
  projectId: string;
  phaseCount: number;
  scheduleCount: number;
  dueCount: number;
}) {
  if (!embedded) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <h2 className="text-sm font-semibold text-[#1A1A1A]">スケジュール</h2>
        <p className="text-[11px] text-[#6B7280]">
          フェーズ {phaseCount} · 予定 {scheduleCount} · 期限の課題 {dueCount}
        </p>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-2 border-b border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3 text-left"
      onClick={onToggle}
      aria-expanded={!collapsed}
    >
      <div>
        <span className="text-sm font-semibold text-[#1A1A1A]">スケジュール</span>
        <span className="mt-0.5 block text-[11px] text-[#6B7280]">
          フェーズ {phaseCount} · 予定 {scheduleCount} · 期限 {dueCount}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/projects/${projectId}/roadmap`}
          className="rounded-md border border-[#E5E7EB] bg-white px-2 py-1 text-[11px] font-medium text-[#5E6AD2] hover:bg-[#F7F8F8]"
          onClick={(e) => e.stopPropagation()}
        >
          ロードマップ
        </Link>
        {collapsed ? <ChevronDown className="h-4 w-4 text-[#6B7280]" /> : <ChevronUp className="h-4 w-4 text-[#6B7280]" />}
      </div>
    </button>
  );
}

function ScheduleTabs({
  tab,
  onTab,
  tabs,
}: {
  tab: ScheduleTab;
  onTab: (t: ScheduleTab) => void;
  tabs: { id: ScheduleTab; label: string; icon: typeof GanttChartSquare }[];
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-md bg-[#F7F8F8] p-1" role="tablist">
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition ${
              active ? "bg-white text-[#1A1A1A] shadow-sm" : "text-[#6B7280] hover:text-[#1A1A1A]"
            }`}
            onClick={() => onTab(t.id)}
          >
            <Icon className="h-3.5 w-3.5 opacity-80" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function ScheduleToolbar({
  canEdit,
  onAddPhase,
  showRoadmapLink,
  projectId,
}: {
  canEdit: boolean;
  onAddPhase: () => void;
  showRoadmapLink: boolean;
  projectId: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[12px] text-[#6B7280]">バーをドラッグして期間を調整（デスクトップ）</p>
      <div className="flex gap-2">
        {showRoadmapLink ? (
          <Link
            href={`/projects/${projectId}/roadmap`}
            className="rounded-md border border-[#E5E7EB] px-2.5 py-1.5 text-[12px] font-medium text-[#6B7280] hover:bg-[#F7F8F8]"
          >
            拡大表示
          </Link>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            className="rounded-md bg-[#5E6AD2] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#4F5BBD]"
            onClick={onAddPhase}
          >
            + フェーズ
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PhaseCreateModal({
  busy,
  onClose,
  onSubmit,
  title,
  setTitle,
  start,
  setStart,
  end,
  setEnd,
  status,
  setStatus,
  color,
  setColor,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  title: string;
  setTitle: (v: string) => void;
  start: string;
  setStart: (v: string) => void;
  end: string;
  setEnd: (v: string) => void;
  status: ProjectStatus;
  setStatus: (v: ProjectStatus) => void;
  color: string;
  setColor: (v: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        className="w-full max-w-md rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => void onSubmit(e)}
      >
        <h3 className="text-base font-semibold">フェーズを追加</h3>
        <label className="mt-3 block text-[12px] text-[#6B7280]">名前</label>
        <input
          className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="text-[12px] text-[#6B7280]">開始</label>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-[12px] text-[#6B7280]">終了</label>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              required
            />
          </div>
        </div>
        <label className="mt-3 block text-[12px] text-[#6B7280]">ステータス</label>
        <select
          className="mt-1 w-full rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as ProjectStatus)}
        >
          <option value="planned">計画中</option>
          <option value="in_progress">進行中</option>
          <option value="backlog">未着手</option>
        </select>
        <label className="mt-3 block text-[12px] text-[#6B7280]">色</label>
        <div className="mt-1 flex gap-2">
          {["gray", "blue", "purple", "green", "amber"].map((c) => (
            <button
              key={c}
              type="button"
              className={`h-7 w-7 rounded-full border-2 ${color === c ? "border-[#1A1A1A]" : "border-transparent"} ${
                c === "gray"
                  ? "bg-zinc-400"
                  : c === "blue"
                    ? "bg-sky-500"
                    : c === "purple"
                      ? "bg-[#5E6AD2]"
                      : c === "green"
                        ? "bg-emerald-500"
                        : "bg-amber-400"
              }`}
              onClick={() => setColor(c)}
              aria-label={c}
            />
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded-md border border-[#E5E7EB] px-3 py-1.5 text-sm" onClick={onClose} disabled={busy}>
            キャンセル
          </button>
          <button type="submit" className="rounded-md bg-[#5E6AD2] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50" disabled={busy}>
            作成
          </button>
        </div>
      </form>
    </div>
  );
}
