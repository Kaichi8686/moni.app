"use client";

import { FormEvent, useState } from "react";
import { CalendarDays, GanttChartSquare } from "lucide-react";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { RoadmapTimeline } from "@/components/roadmap/RoadmapTimeline";
import { ProjectScheduleCalendar } from "@/components/projects/ProjectScheduleCalendar";
import type { Phase, ProjectStatus } from "@/lib/workspace/types";

type RoadmapTab = "timeline" | "calendar";

/** ロードマップ専用: フェーズタイムラインと予定カレンダー（課題UIは含めない） */
export function WorkspaceSchedulePanel() {
  const { phases, schedules, canEdit, createPhase, movePhase, resizePhase, createSchedule, scheduleSaving } =
    useProjectWorkspace();

  const [tab, setTab] = useState<RoadmapTab>("timeline");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planned");
  const [color, setColor] = useState("purple");
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Phase | null>(null);

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

  const tabs: { id: RoadmapTab; label: string; icon: typeof GanttChartSquare }[] = [
    { id: "timeline", label: "フェーズ", icon: GanttChartSquare },
    { id: "calendar", label: "予定", icon: CalendarDays },
  ];

  return (
    <section className="space-y-4 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm" aria-label="ロードマップ">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#1A1A1A]">ロードマップ</h2>
        <p className="text-[11px] text-[#6B7280]">
          フェーズ {phases.length} · 予定 {schedules.length}
        </p>
      </div>

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
              onClick={() => setTab(t.id)}
            >
              <Icon className="h-3.5 w-3.5 opacity-80" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "timeline" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] text-[#6B7280]">バーをドラッグして期間を調整（デスクトップ）</p>
            {canEdit ? (
              <button
                type="button"
                className="rounded-md bg-[#5E6AD2] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#4F5BBD]"
                onClick={() => setOpen(true)}
              >
                + フェーズ
              </button>
            ) : null}
          </div>
          <RoadmapTimeline
            phases={phases}
            onMovePhase={(id, d) => void movePhase(id, d)}
            onResizePhase={(id, d) => void resizePhase(id, d)}
            onSelectPhase={(p) => setSel(p)}
          />
          {sel ? (
            <div className="rounded-md border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2 text-[13px] text-[#6B7280]">
              <span className="font-semibold text-[#1A1A1A]">{sel.title}</span>
              <span className="mx-1">·</span>
              {sel.startDate.slice(0, 10)} → {sel.endDate.slice(0, 10)}
              <button type="button" className="ml-2 text-[12px] text-[#5E6AD2] underline" onClick={() => setSel(null)}>
                閉じる
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "calendar" ? (
        <ProjectScheduleCalendar schedules={schedules} onSave={createSchedule} saving={scheduleSaving} canEdit={canEdit} />
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && setOpen(false)}>
          <form
            className="w-full max-w-md rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void onSubmitPhase(e)}
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
              <button type="button" className="rounded-md border border-[#E5E7EB] px-3 py-1.5 text-sm" onClick={() => setOpen(false)} disabled={busy}>
                キャンセル
              </button>
              <button type="submit" className="rounded-md bg-[#5E6AD2] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50" disabled={busy}>
                作成
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
