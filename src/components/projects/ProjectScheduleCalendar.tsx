"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import { displayScheduleDescription, isBusySchedule } from "@/lib/workspace/busyScheduleDays";

export type CalendarSchedule = {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  attendees: string[] | null;
  /** event=通常 / busy=忙しい日（課題期限を置かない） */
  kind?: "event" | "busy";
};

/** 課題の期限をカレンダーに載せる用（dueDate は ISO） */
export type CalendarIssueEntry = {
  id: string;
  title: string;
  dueDate: string;
  status?: string;
};

type DayItem =
  | { kind: "schedule"; schedule: CalendarSchedule }
  | { kind: "issue"; issue: CalendarIssueEntry };

const ISSUE_BAR_CLASS = "bg-[#5E6AD2]/90";
const BUSY_BAR_CLASS = "bg-zinc-500/90";

const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"] as const;
const EVENT_BAR_CLASS = [
  "bg-rose-400/90",
  "bg-amber-400/90",
  "bg-emerald-400/90",
  "bg-sky-400/90",
  "bg-violet-400/90",
  "bg-orange-400/90",
] as const;

function dateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function eachDateKeyInRange(startsAtIso: string, endsAtIso: string | null): string[] {
  const s = new Date(startsAtIso);
  const e = endsAtIso ? new Date(endsAtIso) : s;
  const start = startOfDay(s);
  const end = startOfDay(e);
  if (end < start) return [dateKeyLocal(start)];
  const keys: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    keys.push(dateKeyLocal(new Date(cur)));
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
}

function buildMonthGrid(view: Date): (Date | null)[] {
  const y = view.getFullYear();
  const m = view.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(y, m, d));
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);
  return cells;
}

function hashColor(id: string): (typeof EVENT_BAR_CLASS)[number] {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return EVENT_BAR_CLASS[h % EVENT_BAR_CLASS.length];
}

function issueDueDateKey(dueDateIso: string): string | null {
  const d = new Date(dueDateIso);
  if (Number.isNaN(d.getTime())) return null;
  return dateKeyLocal(d);
}

const issueStatusLabel: Record<string, string> = {
  backlog: "あとで",
  todo: "これから",
  in_progress: "いまやってる",
  in_review: "確認中",
  done: "完了",
  cancelled: "やめた",
};

type Props = {
  schedules: CalendarSchedule[];
  issues?: CalendarIssueEntry[];
  onIssueClick?: (issueId: string) => void;
  onSave: (payload: {
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
    attendees: string;
    kind: "event" | "busy";
  }) => Promise<void>;
  onDelete?: (scheduleId: string) => Promise<void>;
  saving?: boolean;
  canEdit?: boolean;
};

export function ProjectScheduleCalendar({
  schedules,
  issues = [],
  onIssueClick,
  onSave,
  onDelete,
  saving,
  canEdit = true,
}: Props) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState<string | null>(() => dateKeyLocal(new Date()));
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    startsAt: "",
    endsAt: "",
    attendees: "",
    kind: "event" as "event" | "busy",
  });

  const eventsByDay = useMemo(() => {
    const map = new Map<string, DayItem[]>();
    const push = (key: string, item: DayItem) => {
      const list = map.get(key) ?? [];
      const id = item.kind === "schedule" ? item.schedule.id : item.issue.id;
      if (!list.some((x) => (x.kind === "schedule" ? x.schedule.id : x.issue.id) === id && x.kind === item.kind)) {
        list.push(item);
      }
      map.set(key, list);
    };
    for (const ev of schedules) {
      for (const k of eachDateKeyInRange(ev.starts_at, ev.ends_at)) {
        push(k, { kind: "schedule", schedule: ev });
      }
    }
    for (const iss of issues) {
      const k = issueDueDateKey(iss.dueDate);
      if (k) push(k, { kind: "issue", issue: iss });
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "schedule" ? -1 : 1;
        if (a.kind === "schedule" && b.kind === "schedule") {
          return new Date(a.schedule.starts_at).getTime() - new Date(b.schedule.starts_at).getTime();
        }
        if (a.kind === "issue" && b.kind === "issue") {
          return a.issue.title.localeCompare(b.issue.title, "ja");
        }
        return 0;
      });
    }
    return map;
  }, [schedules, issues]);

  const monthCells = useMemo(() => buildMonthGrid(viewDate), [viewDate]);

  const titleMonth = useMemo(
    () =>
      viewDate.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
      }),
    [viewDate],
  );

  const selectedDayItems = useMemo(() => {
    if (!selectedKey) return [];
    return eventsByDay.get(selectedKey) ?? [];
  }, [eventsByDay, selectedKey]);

  const calendarIssues = useMemo(
    () => issues.filter((i) => issueDueDateKey(i.dueDate) !== null),
    [issues],
  );

  const goPrevMonth = useCallback(() => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }, []);

  const goNextMonth = useCallback(() => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }, []);

  const goToday = useCallback(() => {
    const n = new Date();
    setViewDate(new Date(n.getFullYear(), n.getMonth(), 1));
    setSelectedKey(dateKeyLocal(n));
  }, []);

  const onPickDay = useCallback((key: string | null) => {
    if (!key) return;
    setSelectedKey(key);
    const base = parseDateKey(key);
    const pad = (n: number) => String(n).padStart(2, "0");
    const localStart = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T10:00`;
    const localEnd = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T11:00`;
    setForm((f) => ({
      ...f,
      startsAt: localStart,
      endsAt: localEnd,
    }));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.startsAt) return;
    await onSave({
      title: form.title.trim(),
      description: form.description.trim(),
      startsAt: form.startsAt,
      endsAt: form.endsAt,
      attendees: form.attendees,
      kind: form.kind,
    });
    setForm((f) => ({
      title: "",
      description: "",
      startsAt: f.startsAt,
      endsAt: f.endsAt,
      attendees: "",
      kind: "event",
    }));
  }

  const todayKey = dateKeyLocal(new Date());

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-gradient-to-b from-white to-zinc-50/80 shadow-sm">
      {/* TimeTree風：ヘッダー */}
      <div className="flex items-center justify-between border-b border-zinc-100 bg-white/90 px-3 py-3 sm:px-4">
        <button
          type="button"
          onClick={goPrevMonth}
          className="flex h-10 w-10 items-center justify-center rounded-full text-lg text-zinc-600 transition hover:bg-zinc-100"
          aria-label="前の月"
        >
          ‹
        </button>
        <div className="flex flex-col items-center gap-1">
          <span className="text-lg font-bold tracking-tight text-zinc-900">{titleMonth}</span>
          <button type="button" onClick={goToday} className="text-[11px] font-semibold text-emerald-600 hover:underline">
            今日
          </button>
        </div>
        <button
          type="button"
          onClick={goNextMonth}
          className="flex h-10 w-10 items-center justify-center rounded-full text-lg text-zinc-600 transition hover:bg-zinc-100"
          aria-label="次の月"
        >
          ›
        </button>
      </div>

      {(schedules.length > 0 || calendarIssues.length > 0) && (
        <div className="flex flex-wrap gap-3 border-b border-zinc-100 bg-white/80 px-3 py-2 text-[10px] text-zinc-500 sm:px-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded bg-emerald-400/90" aria-hidden />
            予定
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-4 rounded ${BUSY_BAR_CLASS}`} aria-hidden />
            忙しい日（課題なし）
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-4 rounded ${ISSUE_BAR_CLASS}`} aria-hidden />
            課題（期限）
          </span>
        </div>
      )}

      {/* 曜日 */}
      <div className="grid grid-cols-7 border-b border-zinc-100 bg-zinc-50/90 px-1 py-2">
        {WEEKDAYS_JA.map((w, i) => (
          <div
            key={w}
            className={`text-center text-[11px] font-bold sm:text-xs ${i === 0 ? "text-rose-500" : i === 6 ? "text-sky-600" : "text-zinc-500"}`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 日付グリッド */}
      <div className="grid grid-cols-7 gap-px bg-zinc-100 p-px">
        {monthCells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="min-h-[72px] bg-zinc-50/50 sm:min-h-[88px]" />;
          }
          const key = dateKeyLocal(cell);
          const list = eventsByDay.get(key) ?? [];
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;
          const isBusyDay = list.some((item) => item.kind === "schedule" && isBusySchedule(item.schedule));
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPickDay(key)}
              className={`flex min-h-[72px] flex-col items-stretch border border-transparent p-1 text-left transition hover:bg-emerald-50/80 sm:min-h-[88px] ${
                isBusyDay ? "bg-zinc-100/90" : "bg-white"
              } ${isSelected ? "ring-2 ring-emerald-400 ring-offset-1" : ""} ${isToday && !isBusyDay ? "bg-emerald-50/40" : ""}`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold sm:h-7 sm:w-7 sm:text-xs ${
                  isToday ? "bg-emerald-500 text-white" : "text-zinc-800"
                }`}
              >
                {cell.getDate()}
              </span>
              <div className="mt-0.5 flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                {list.slice(0, 4).map((item) =>
                  item.kind === "schedule" ? (
                    <span
                      key={`s-${item.schedule.id}`}
                      className={`truncate rounded px-1 py-0.5 text-[9px] font-medium text-white shadow-sm sm:text-[10px] ${
                        isBusySchedule(item.schedule) ? BUSY_BAR_CLASS : hashColor(item.schedule.id)
                      }`}
                    >
                      {item.schedule.title}
                    </span>
                  ) : (
                    <span
                      key={`i-${item.issue.id}`}
                      className={`truncate rounded px-1 py-0.5 text-[9px] font-medium text-white shadow-sm sm:text-[10px] ${ISSUE_BAR_CLASS}`}
                    >
                      {item.issue.title}
                    </span>
                  ),
                )}
                {list.length > 4 ? (
                  <span className="text-[9px] font-medium text-zinc-400">+{list.length - 4}</span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {/* 選んだ日の一覧 */}
      {selectedKey ? (
        <div className="border-t border-zinc-100 bg-white px-3 py-3 sm:px-4">
          <p className="text-xs font-semibold text-zinc-500">
            {parseDateKey(selectedKey).toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "short",
            })}
          </p>
          <ul className="mt-2 space-y-2">
            {selectedDayItems.length === 0 ? (
              <li className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-3 py-4 text-center text-sm text-zinc-500">
                この日の予定・課題（期限）はありません
              </li>
            ) : (
              selectedDayItems.map((item) =>
                item.kind === "schedule" ? (
                  <li key={`s-${item.schedule.id}`} className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2 shadow-sm">
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 h-8 w-1 shrink-0 rounded-full ${
                          isBusySchedule(item.schedule) ? BUSY_BAR_CLASS : hashColor(item.schedule.id)
                        }`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                          {isBusySchedule(item.schedule) ? "忙しい日（課題なし）" : "予定"}
                        </p>
                        <p className="font-semibold text-zinc-900">{item.schedule.title}</p>
                        <p className="text-[11px] text-zinc-500">
                          {new Date(item.schedule.starts_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                          {item.schedule.ends_at
                            ? ` – ${new Date(item.schedule.ends_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`
                            : ""}
                        </p>
                        {displayScheduleDescription(item.schedule.description) ? (
                          <p className="mt-1 text-sm text-zinc-700">{displayScheduleDescription(item.schedule.description)}</p>
                        ) : null}
                        {item.schedule.attendees && item.schedule.attendees.length > 0 ? (
                          <p className="mt-1 text-[11px] text-zinc-400">{item.schedule.attendees.join(" · ")}</p>
                        ) : null}
                      </div>
                      {canEdit && onDelete ? (
                        <button
                          type="button"
                          disabled={saving || deletingId === item.schedule.id}
                          onClick={() => {
                            if (!window.confirm(`「${item.schedule.title}」を削除しますか？`)) return;
                            setDeletingId(item.schedule.id);
                            void onDelete(item.schedule.id).finally(() => setDeletingId(null));
                          }}
                          className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                        >
                          {deletingId === item.schedule.id ? "削除中…" : "削除"}
                        </button>
                      ) : null}
                    </div>
                  </li>
                ) : (
                  <li key={`i-${item.issue.id}`} className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-2 shadow-sm">
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 text-left"
                      onClick={() => onIssueClick?.(item.issue.id)}
                      disabled={!onIssueClick}
                    >
                      <span className={`mt-0.5 h-8 w-1 shrink-0 rounded-full ${ISSUE_BAR_CLASS}`} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#5E6AD2]">課題（期限）</p>
                        <p className="font-semibold text-zinc-900">{item.issue.title}</p>
                        {item.issue.status ? (
                          <p className="text-[11px] text-zinc-500">{issueStatusLabel[item.issue.status] ?? item.issue.status}</p>
                        ) : null}
                        {onIssueClick ? <p className="mt-1 text-[11px] font-medium text-[#5E6AD2]">タップして詳細</p> : null}
                      </div>
                    </button>
                  </li>
                ),
              )
            )}
          </ul>
        </div>
      ) : null}

      {canEdit ? (
      <form className="border-t border-zinc-200 bg-white px-3 py-4 sm:px-4" onSubmit={(e) => void handleSubmit(e)}>
        <p className="mb-3 text-sm font-bold text-zinc-900">予定を追加</p>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, kind: "event" }))}
            className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
              form.kind === "event"
                ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            通常の予定
          </button>
          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, kind: "busy" }))}
            className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
              form.kind === "busy"
                ? "border-zinc-500 bg-zinc-100 text-zinc-800"
                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            忙しい日（課題なし）
          </button>
        </div>
        {form.kind === "busy" ? (
          <p className="mb-3 text-[11px] leading-relaxed text-zinc-500">
            この日には課題の最終日を置きません。既存の課題期限もずらします。
          </p>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            required
            className="rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-sm outline-none ring-emerald-500/20 transition focus:border-emerald-400 focus:ring-2 sm:col-span-2"
            placeholder={form.kind === "busy" ? "タイトル（例：試験・出張）" : "タイトル（例：キックオフ）"}
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">開始</label>
            <input
              required
              type="datetime-local"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400"
              value={form.startsAt}
              onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">終了（任意）</label>
            <input
              type="datetime-local"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400"
              value={form.endsAt}
              onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))}
            />
          </div>
          {form.kind === "event" ? (
            <input
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 sm:col-span-2"
              placeholder="参加者（カンマ区切り・任意）"
              value={form.attendees}
              onChange={(e) => setForm((p) => ({ ...p, attendees: e.target.value }))}
            />
          ) : null}
          <textarea
            className="min-h-[72px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 sm:col-span-2"
            placeholder="メモ・場所など（任意）"
            rows={2}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </div>
        <button
          type="submit"
          disabled={saving || !form.title.trim() || !form.startsAt}
          className="mt-4 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-sm font-bold text-white shadow-md shadow-emerald-500/25 transition hover:brightness-105 disabled:opacity-50"
        >
          {saving ? "追加中…" : form.kind === "busy" ? "忙しい日を追加" : "予定を追加"}
        </button>
      </form>
      ) : null}
    </div>
  );
}
