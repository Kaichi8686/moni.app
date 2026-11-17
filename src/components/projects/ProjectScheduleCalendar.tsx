"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowLeft, Plus, Search } from "lucide-react";
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

const ISSUE_BAR_CLASS = "bg-[#5E6AD2]";
const BUSY_BAR_CLASS = "bg-zinc-400";
const ACCENT = "#FF9600";

const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"] as const;
const EVENT_PILL_CLASS = [
  "bg-[#FF9600]",
  "bg-sky-400",
  "bg-rose-400",
  "bg-amber-400",
  "bg-[#5E6AD2]",
  "bg-teal-400",
] as const;

const HOUR_START = 0;
const HOUR_END = 23;
const HOUR_PX = 52;
/** 日フォーカス時の週ストリップ高さ（日付数字が切れないよう余裕を持たせる） */
const DAY_FOCUS_WEEK_PX = 56;
const TIMETABLE_TOP_PAD = 14;

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

/** 前後月の日付も含む 6 週グリッド（null なし） */
function buildMonthGrid(view: Date): Date[] {
  const y = view.getFullYear();
  const m = view.getMonth();
  const first = new Date(y, m, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const cells: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

/** 指定日を含む日曜始まりの1週間 */
function weekContaining(key: string): Date[] {
  const d = parseDateKey(key);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    return x;
  });
}

const SWIPE_THRESHOLD_PX = 48;

function hashColor(id: string): (typeof EVENT_PILL_CLASS)[number] {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return EVENT_PILL_CLASS[h % EVENT_PILL_CLASS.length];
}

function issueDueDateKey(dueDateIso: string): string | null {
  const d = new Date(dueDateIso);
  if (Number.isNaN(d.getTime())) return null;
  return dateKeyLocal(d);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function minutesFromMidnight(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
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
  fullBleed?: boolean;
  hideAddForm?: boolean;
  onRequestAdd?: (prefill: { startsAt: string; endsAt: string }) => void;
  /** 親ヘッダーの検索トグルと連動 */
  searchOpen?: boolean;
  onSearchOpenChange?: (open: boolean) => void;
  /** フルスクリーン時: 戻る＋検索/追加を年月行に載せる */
  onBack?: () => void;
};

export function ProjectScheduleCalendar({
  schedules,
  issues = [],
  onIssueClick,
  onSave,
  onDelete,
  saving,
  canEdit = true,
  fullBleed = false,
  hideAddForm = false,
  onRequestAdd,
  searchOpen: searchOpenProp,
  onSearchOpenChange,
  onBack,
}: Props) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dayFocus, setDayFocus] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchInternal, setSearchInternal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [monthSlideClass, setMonthSlideClass] = useState("");
  const [weekSlideClass, setWeekSlideClass] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const timetableScrollRef = useRef<HTMLDivElement | null>(null);
  const monthPendingDelta = useRef<-1 | 1 | null>(null);
  const monthBusyRef = useRef(false);
  const weekPendingDelta = useRef<-1 | 1 | null>(null);
  const weekBusyRef = useRef(false);
  const monthTouchRef = useRef<{ x: number; y: number; locked: "h" | "v" | null } | null>(null);
  const weekTouchRef = useRef<{ x: number; y: number; locked: "h" | "v" | null } | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    startsAt: "",
    endsAt: "",
    attendees: "",
    kind: "event" as "event" | "busy",
  });

  const searchOpen = searchOpenProp ?? searchInternal;
  const setSearchOpen = useCallback(
    (open: boolean) => {
      if (onSearchOpenChange) onSearchOpenChange(open);
      else setSearchInternal(open);
      if (!open) setSearchQuery("");
    },
    [onSearchOpenChange],
  );

  const openSearchAndFocus = useCallback(() => {
    if (searchOpen) {
      setSearchOpen(false);
      return;
    }
    // 同一ジェスチャ内でフォーカスし、すぐキーボード入力できるようにする
    flushSync(() => {
      setSearchOpen(true);
    });
    const input = searchInputRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    try {
      const len = input.value.length;
      input.setSelectionRange(len, len);
    } catch {
      /* ignore */
    }
  }, [searchOpen, setSearchOpen]);

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
  const weeks = useMemo(() => {
    const rows: Date[][] = [];
    for (let i = 0; i < monthCells.length; i += 7) rows.push(monthCells.slice(i, i + 7));
    return rows;
  }, [monthCells]);

  const focusWeekDays = useMemo(() => {
    if (!selectedKey) return null;
    return weekContaining(selectedKey);
  }, [selectedKey]);

  const titleMonth = useMemo(
    () => viewDate.toLocaleDateString("ja-JP", { month: "long" }),
    [viewDate],
  );

  const titleYear = viewDate.getFullYear();

  const selectedDayItems = useMemo(() => {
    if (!selectedKey) return [];
    return eventsByDay.get(selectedKey) ?? [];
  }, [eventsByDay, selectedKey]);

  const searchSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [] as Array<{ id: string; title: string; subtitle: string; kind: "schedule" | "issue" }>;
    const out: Array<{ id: string; title: string; subtitle: string; kind: "schedule" | "issue" }> = [];
    for (const s of schedules) {
      const hay = `${s.title} ${displayScheduleDescription(s.description)}`.toLowerCase();
      if (!hay.includes(q)) continue;
      out.push({
        id: s.id,
        title: s.title,
        subtitle: `${new Date(s.starts_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })} ${formatTime(s.starts_at)}`,
        kind: "schedule",
      });
    }
    for (const iss of issues) {
      if (!iss.title.toLowerCase().includes(q)) continue;
      const due = new Date(iss.dueDate);
      out.push({
        id: iss.id,
        title: iss.title,
        subtitle: `課題 · ${due.toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}`,
        kind: "issue",
      });
    }
    return out.slice(0, 8);
  }, [searchQuery, schedules, issues]);

  const applyMonthDelta = useCallback((delta: -1 | 1) => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }, []);

  const requestMonthChange = useCallback((delta: -1 | 1) => {
    if (monthBusyRef.current) return;
    monthBusyRef.current = true;
    monthPendingDelta.current = delta;
    // 日フォーカス中でも月グリッド側でスライドできるよう一旦月表示へ戻す
    setDayFocus(false);
    setSelectedKey(null);
    setMonthSlideClass(delta > 0 ? "calendar-pane-exit-left" : "calendar-pane-exit-right");
  }, []);

  const goPrevMonth = useCallback(() => {
    requestMonthChange(-1);
  }, [requestMonthChange]);

  const goNextMonth = useCallback(() => {
    requestMonthChange(1);
  }, [requestMonthChange]);

  const applyWeekDelta = useCallback(
    (delta: -1 | 1) => {
      if (!selectedKey) return;
      const d = parseDateKey(selectedKey);
      d.setDate(d.getDate() + 7 * delta);
      const key = dateKeyLocal(d);
      setSelectedKey(key);
      if (d.getMonth() !== viewDate.getMonth() || d.getFullYear() !== viewDate.getFullYear()) {
        setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
      }
      const pad = (n: number) => String(n).padStart(2, "0");
      setForm((f) => ({
        ...f,
        startsAt: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`,
        endsAt: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T11:00`,
      }));
    },
    [selectedKey, viewDate],
  );

  const requestWeekChange = useCallback((delta: -1 | 1) => {
    if (weekBusyRef.current || !selectedKey) return;
    weekBusyRef.current = true;
    weekPendingDelta.current = delta;
    setWeekSlideClass(delta > 0 ? "calendar-pane-exit-left" : "calendar-pane-exit-right");
  }, [selectedKey]);

  useEffect(() => {
    if (!monthSlideClass) return;
    const isExit = monthSlideClass.includes("exit");
    const t = window.setTimeout(() => {
      const delta = monthPendingDelta.current;
      if (delta == null) return;
      if (isExit) {
        applyMonthDelta(delta);
        setMonthSlideClass(delta > 0 ? "calendar-pane-enter-right" : "calendar-pane-enter-left");
        return;
      }
      monthPendingDelta.current = null;
      monthBusyRef.current = false;
      setMonthSlideClass("");
    }, isExit ? 230 : 290);
    return () => window.clearTimeout(t);
  }, [monthSlideClass, applyMonthDelta]);

  useEffect(() => {
    if (!weekSlideClass) return;
    const isExit = weekSlideClass.includes("exit");
    const t = window.setTimeout(() => {
      const delta = weekPendingDelta.current;
      if (delta == null) return;
      if (isExit) {
        applyWeekDelta(delta);
        setWeekSlideClass(delta > 0 ? "calendar-pane-enter-right" : "calendar-pane-enter-left");
        return;
      }
      weekPendingDelta.current = null;
      weekBusyRef.current = false;
      setWeekSlideClass("");
    }, isExit ? 230 : 290);
    return () => window.clearTimeout(t);
  }, [weekSlideClass, applyWeekDelta]);

  const goToday = useCallback(() => {
    const n = new Date();
    setViewDate(new Date(n.getFullYear(), n.getMonth(), 1));
    const key = dateKeyLocal(n);
    setSelectedKey(key);
    setDayFocus(true);
  }, []);

  const onPickDay = useCallback(
    (key: string) => {
      const base = parseDateKey(key);
      // 表示月外の日付を押したらその月へ
      if (base.getMonth() !== viewDate.getMonth() || base.getFullYear() !== viewDate.getFullYear()) {
        setViewDate(new Date(base.getFullYear(), base.getMonth(), 1));
      }
      setSelectedKey(key);
      setDayFocus(true);
      const pad = (n: number) => String(n).padStart(2, "0");
      const localStart = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T10:00`;
      const localEnd = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T11:00`;
      setForm((f) => ({ ...f, startsAt: localStart, endsAt: localEnd }));
    },
    [viewDate],
  );

  function expandMonth() {
    setDayFocus(false);
  }

  function jumpToSuggestion(item: { id: string; kind: "schedule" | "issue" }) {
    setSearchOpen(false);
    if (item.kind === "issue") {
      onIssueClick?.(item.id);
      const iss = issues.find((i) => i.id === item.id);
      if (iss) {
        const key = issueDueDateKey(iss.dueDate);
        if (key) {
          const d = parseDateKey(key);
          setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
          setSelectedKey(key);
          setDayFocus(true);
        }
      }
      return;
    }
    const s = schedules.find((x) => x.id === item.id);
    if (!s) return;
    const d = new Date(s.starts_at);
    const key = dateKeyLocal(d);
    setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedKey(key);
    setDayFocus(true);
  }

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
  const viewMonth = viewDate.getMonth();
  const viewYear = viewDate.getFullYear();

  const timedEvents = useMemo(() => {
    const rangeStart = HOUR_START * 60;
    const rangeEnd = HOUR_END * 60;
    return selectedDayItems
      .filter((item): item is { kind: "schedule"; schedule: CalendarSchedule } => item.kind === "schedule")
      .map((item) => {
        const startMin = minutesFromMidnight(item.schedule.starts_at);
        const endMin = item.schedule.ends_at
          ? Math.max(startMin + 30, minutesFromMidnight(item.schedule.ends_at))
          : startMin + 60;
        const top = ((Math.max(startMin, rangeStart) - rangeStart) / 60) * HOUR_PX;
        const height = Math.max(28, ((Math.min(endMin, rangeEnd) - Math.max(startMin, rangeStart)) / 60) * HOUR_PX);
        return { schedule: item.schedule, top, height, allDay: isBusySchedule(item.schedule) };
      });
  }, [selectedDayItems]);

  const allDayItems = useMemo(() => {
    return selectedDayItems.filter((item) => {
      if (item.kind === "issue") return true;
      return isBusySchedule(item.schedule);
    });
  }, [selectedDayItems]);

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = HOUR_START; h <= HOUR_END; h += 1) list.push(h);
    return list;
  }, []);

  useEffect(() => {
    if (!dayFocus || !selectedKey) return;
    const el = timetableScrollRef.current;
    if (!el) return;
    const now = new Date();
    const targetHour =
      selectedKey === dateKeyLocal(now) ? Math.max(0, Math.min(HOUR_END, now.getHours() - 1)) : 8;
    el.scrollTop = TIMETABLE_TOP_PAD + targetHour * HOUR_PX;
  }, [dayFocus, selectedKey]);

  const immersive = Boolean(onBack);

  return (
    <div className={fullBleed ? "flex min-h-0 flex-1 flex-col bg-white" : "overflow-hidden rounded-2xl border border-zinc-200 bg-white"}>
      {/* 月タイトル（フルスクリーン時は戻る＋検索/追加を同列） */}
      <div
        className={`flex items-end gap-1 pb-2 ${
          immersive ? "px-3 pt-[max(0.5rem,env(safe-area-inset-top))]" : "px-4 pt-1"
        }`}
      >
        {onBack ? (
          <button
            type="button"
            onClick={() => {
              if (dayFocus) {
                expandMonth();
                return;
              }
              onBack();
            }}
            className="mb-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-800 transition hover:bg-zinc-100 active:scale-95"
            aria-label="戻る"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-zinc-400">{titleYear}</p>
          <div className="flex items-center gap-2">
            <h2 className="text-[28px] font-bold tracking-tight text-zinc-950">{titleMonth}</h2>
            {dayFocus ? (
              <button
                type="button"
                onClick={expandMonth}
                className="rounded-full px-2.5 py-1 text-[12px] font-semibold text-[#FF9600] hover:bg-orange-50"
              >
                月
              </button>
            ) : null}
          </div>
        </div>
        <div className="mb-0.5 flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={goPrevMonth}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
            aria-label="前の月"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={goNextMonth}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
            aria-label="次の月"
          >
            ›
          </button>
          {immersive ? (
            <div className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-zinc-100/90 p-1 ring-1 ring-zinc-200/80">
              <button
                type="button"
                onClick={openSearchAndFocus}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition ${
                  searchOpen ? "bg-white text-[#FF9600] shadow-sm" : "text-zinc-700 hover:bg-white/80"
                }`}
                aria-label="予定を検索"
                aria-pressed={searchOpen}
              >
                <Search className="h-5 w-5" strokeWidth={2.25} />
              </button>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => {
                    const base = selectedKey ? parseDateKey(selectedKey) : new Date();
                    const pad = (n: number) => String(n).padStart(2, "0");
                    onRequestAdd?.({
                      startsAt: `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T10:00`,
                      endsAt: `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T11:00`,
                    });
                  }}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-zinc-700 transition hover:bg-white/80"
                  aria-label="予定を追加"
                >
                  <Plus className="h-6 w-6" strokeWidth={2.25} />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* 検索（上から展開・開いた瞬間に入力可能） */}
      <div
        className={`relative border-zinc-100 transition-[max-height,opacity] duration-200 ease-out ${
          searchOpen
            ? "max-h-24 overflow-visible border-b opacity-100"
            : "pointer-events-none max-h-0 overflow-hidden opacity-0"
        }`}
        aria-hidden={!searchOpen}
      >
        <div className="px-4 pb-3 pt-1">
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="予定を検索"
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            tabIndex={searchOpen ? 0 : -1}
            className="h-11 w-full rounded-xl bg-zinc-100 px-3 text-[16px] outline-none ring-[#FF9600]/30 focus:bg-white focus:ring-2"
          />
        </div>
        {searchOpen && searchQuery.trim() ? (
          <ul className="absolute left-4 right-4 top-[calc(100%-0.25rem)] z-30 max-h-64 overflow-y-auto rounded-2xl border border-zinc-200 bg-white py-1 shadow-xl">
            {searchSuggestions.length === 0 ? (
              <li className="px-3 py-3 text-[13px] text-zinc-500">一致する予定がありません</li>
            ) : (
              searchSuggestions.map((s) => (
                <li key={`${s.kind}-${s.id}`}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start px-3 py-2.5 text-left hover:bg-zinc-50"
                    onClick={() => jumpToSuggestion(s)}
                  >
                    <span className="text-[14px] font-semibold text-zinc-950">{s.title}</span>
                    <span className="text-[12px] text-zinc-500">{s.subtitle}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      {/* 曜日 */}
      <div className="grid shrink-0 grid-cols-7 px-2 pb-1 pt-1">
        {WEEKDAYS_JA.map((w, i) => (
          <div
            key={w}
            className={`text-center text-[11px] font-semibold ${
              i === 0 ? "text-rose-400" : i === 6 ? "text-sky-500" : "text-zinc-400"
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 週グリッド（選択時は該当週のみ表示して日付が切れないようにする） */}
      <div
        className={`relative ${
          dayFocus
            ? "shrink-0 overflow-hidden"
            : `overflow-hidden transition-[height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                fullBleed ? "flex min-h-0 flex-1 flex-col" : ""
              }`
        }`}
        style={dayFocus ? { height: DAY_FOCUS_WEEK_PX } : undefined}
      >
        {dayFocus && focusWeekDays ? (
          <div
            className={`grid h-full touch-pan-y grid-cols-7 border-t border-zinc-100 px-2 ${weekSlideClass}`}
            style={{ height: DAY_FOCUS_WEEK_PX }}
            onTouchStart={(e) => {
              const t = e.changedTouches[0];
              if (!t) return;
              weekTouchRef.current = { x: t.clientX, y: t.clientY, locked: null };
            }}
            onTouchMove={(e) => {
              const st = weekTouchRef.current;
              const t = e.changedTouches[0];
              if (!st || !t) return;
              const dx = t.clientX - st.x;
              const dy = t.clientY - st.y;
              if (!st.locked) {
                if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
                st.locked = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
              }
              if (st.locked === "h") e.preventDefault();
            }}
            onTouchEnd={(e) => {
              const st = weekTouchRef.current;
              weekTouchRef.current = null;
              const t = e.changedTouches[0];
              if (!st || !t || st.locked === "v") return;
              const dx = t.clientX - st.x;
              if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
              requestWeekChange(dx < 0 ? 1 : -1);
            }}
          >
            {focusWeekDays.map((cell) => {
              const key = dateKeyLocal(cell);
              const inMonth = cell.getMonth() === viewMonth && cell.getFullYear() === viewYear;
              if (!inMonth) {
                return <div key={key} className="h-full" aria-hidden />;
              }
              const isToday = key === todayKey;
              const isSelected = key === selectedKey;
              const showMark = selectedKey ? isSelected : isToday;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onPickDay(key)}
                  className="flex h-full flex-col items-center justify-center gap-0 px-0.5 py-1.5 text-center transition active:bg-zinc-50"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold tabular-nums leading-none transition-colors duration-300 ${
                      showMark ? "bg-[#FF9600] text-white" : "text-zinc-900"
                    }`}
                  >
                    {cell.getDate()}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div
            className={`w-full touch-pan-y ${monthSlideClass} ${
              dayFocus || !fullBleed ? "" : "flex min-h-0 flex-1 flex-col"
            }`}
            onTouchStart={(e) => {
              const t = e.changedTouches[0];
              if (!t) return;
              monthTouchRef.current = { x: t.clientX, y: t.clientY, locked: null };
            }}
            onTouchMove={(e) => {
              const st = monthTouchRef.current;
              const t = e.changedTouches[0];
              if (!st || !t) return;
              const dx = t.clientX - st.x;
              const dy = t.clientY - st.y;
              if (!st.locked) {
                if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
                st.locked = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
              }
              if (st.locked === "h") e.preventDefault();
            }}
            onTouchEnd={(e) => {
              const st = monthTouchRef.current;
              monthTouchRef.current = null;
              const t = e.changedTouches[0];
              if (!st || !t || st.locked === "v") return;
              const dx = t.clientX - st.x;
              if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
              requestMonthChange(dx < 0 ? 1 : -1);
            }}
          >
            {weeks.map((week, weekIdx) => (
              <div
                key={weekIdx}
                className={`grid grid-cols-7 border-t border-zinc-100 px-2 ${
                  fullBleed ? "min-h-0 flex-1" : "max-h-[130px]"
                }`}
              >
                {week.map((cell) => {
                  const key = dateKeyLocal(cell);
                  const inMonth = cell.getMonth() === viewMonth && cell.getFullYear() === viewYear;
                  if (!inMonth) {
                    return (
                      <div
                        key={key}
                        className={fullBleed ? "min-h-[96px]" : "min-h-[88px]"}
                        aria-hidden
                      />
                    );
                  }
                  const list = eventsByDay.get(key) ?? [];
                  const overflow = list.length >= 4;
                  const visible = overflow ? list.slice(0, 2) : list;
                  const moreCount = overflow ? list.length - 2 : 0;
                  const isToday = key === todayKey;
                  const isSelected = key === selectedKey;
                  const showMark = selectedKey ? isSelected : isToday;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onPickDay(key)}
                      className={`flex h-full flex-col items-center gap-0.5 overflow-hidden px-0.5 py-1.5 text-center transition active:bg-zinc-50 ${
                        fullBleed ? "min-h-[96px]" : "min-h-[88px]"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold tabular-nums leading-none transition-colors duration-300 ${
                          showMark ? "bg-[#FF9600] text-white" : "text-zinc-900"
                        }`}
                      >
                        {cell.getDate()}
                      </span>
                      <div className="flex w-full min-h-0 flex-1 flex-col gap-[2px] overflow-hidden px-[1px]">
                        {visible.map((item) =>
                          item.kind === "schedule" ? (
                            <span
                              key={`s-${item.schedule.id}`}
                              className={`truncate rounded-full px-1 py-[1px] text-left text-[8px] font-semibold leading-tight text-white ${
                                isBusySchedule(item.schedule) ? BUSY_BAR_CLASS : hashColor(item.schedule.id)
                              }`}
                            >
                              {item.schedule.title}
                            </span>
                          ) : (
                            <span
                              key={`i-${item.issue.id}`}
                              className={`truncate rounded-full px-1 py-[1px] text-left text-[8px] font-semibold leading-tight text-white ${ISSUE_BAR_CLASS}`}
                            >
                              {item.issue.title}
                            </span>
                          ),
                        )}
                        {moreCount > 0 ? (
                          <span className="truncate px-0.5 text-left text-[8px] font-medium leading-tight text-zinc-400">
                            他{moreCount}件
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 日フォーカス：タイムテーブル（下からスライドイン） */}
      {dayFocus && selectedKey ? (
        <div className="calendar-day-panel-in flex min-h-0 flex-1 flex-col border-t border-zinc-100 bg-white">
          <div className="flex items-center justify-between px-4 py-2">
            <p className="text-[13px] font-semibold text-zinc-800">
              {parseDateKey(selectedKey).toLocaleDateString("ja-JP", {
                month: "long",
                day: "numeric",
                weekday: "short",
              })}
            </p>
            <button
              type="button"
              onClick={goToday}
              className="rounded-full px-3 py-1 text-[12px] font-semibold text-zinc-700 ring-1 ring-zinc-200"
            >
              今日
            </button>
          </div>

          {allDayItems.length > 0 ? (
            <div className="space-y-1 border-b border-zinc-100 px-4 pb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">終日</p>
              {allDayItems.map((item) =>
                item.kind === "schedule" ? (
                  <div
                    key={`ad-s-${item.schedule.id}`}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-white ${
                      isBusySchedule(item.schedule) ? BUSY_BAR_CLASS : hashColor(item.schedule.id)
                    }`}
                  >
                    <span className="truncate">{item.schedule.title}</span>
                    {canEdit && onDelete ? (
                      <button
                        type="button"
                        className="ml-2 shrink-0 text-[11px] font-bold text-white/90"
                        disabled={saving || deletingId === item.schedule.id}
                        onClick={() => {
                          if (!window.confirm(`「${item.schedule.title}」を削除しますか？`)) return;
                          setDeletingId(item.schedule.id);
                          void onDelete(item.schedule.id).finally(() => setDeletingId(null));
                        }}
                      >
                        削除
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <button
                    key={`ad-i-${item.issue.id}`}
                    type="button"
                    className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[13px] font-semibold text-white ${ISSUE_BAR_CLASS}`}
                    onClick={() => onIssueClick?.(item.issue.id)}
                  >
                    <span className="truncate">{item.issue.title}</span>
                    {item.issue.status ? (
                      <span className="ml-2 shrink-0 text-[11px] font-medium text-white/80">
                        {issueStatusLabel[item.issue.status] ?? item.issue.status}
                      </span>
                    ) : null}
                  </button>
                ),
              )}
            </div>
          ) : null}

          <div ref={timetableScrollRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div
              className="relative"
              style={{ height: TIMETABLE_TOP_PAD + hours.length * HOUR_PX + 12 }}
            >
              {hours.map((h, idx) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-t border-zinc-100"
                  style={{ top: TIMETABLE_TOP_PAD + idx * HOUR_PX, height: HOUR_PX }}
                >
                  <span className="absolute left-2 top-1.5 w-10 text-right text-[10px] font-medium leading-none text-zinc-400">
                    {String(h).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
              <div
                className="absolute left-0 right-0 border-t border-zinc-100"
                style={{ top: TIMETABLE_TOP_PAD + hours.length * HOUR_PX }}
              >
                <span className="absolute left-2 top-1.5 w-10 text-right text-[10px] font-medium leading-none text-zinc-400">
                  24:00
                </span>
              </div>

              {timedEvents
                .filter((e) => !e.allDay)
                .map(({ schedule, top, height }) => (
                  <div
                    key={schedule.id}
                    className={`absolute left-14 right-3 overflow-hidden rounded-lg px-2 py-1 text-white shadow-sm ${hashColor(schedule.id)}`}
                    style={{ top: TIMETABLE_TOP_PAD + top, height, backgroundColor: undefined }}
                  >
                    <p className="truncate text-[12px] font-bold leading-tight">{schedule.title}</p>
                    <p className="text-[10px] font-medium text-white/90">
                      {formatTime(schedule.starts_at)}
                      {schedule.ends_at ? ` – ${formatTime(schedule.ends_at)}` : ""}
                    </p>
                    {displayScheduleDescription(schedule.description) ? (
                      <p className="mt-0.5 line-clamp-2 text-[10px] text-white/85">
                        {displayScheduleDescription(schedule.description)}
                      </p>
                    ) : null}
                    {canEdit && onDelete ? (
                      <button
                        type="button"
                        className="mt-0.5 text-[10px] font-bold underline"
                        disabled={saving || deletingId === schedule.id}
                        onClick={() => {
                          if (!window.confirm(`「${schedule.title}」を削除しますか？`)) return;
                          setDeletingId(schedule.id);
                          void onDelete(schedule.id).finally(() => setDeletingId(null));
                        }}
                      >
                        削除
                      </button>
                    ) : null}
                  </div>
                ))}

              {selectedDayItems.length === 0 ? (
                <p
                  className="absolute left-14 right-3 text-[13px] text-zinc-400"
                  style={{ top: TIMETABLE_TOP_PAD + 18 }}
                >
                  予定はありません
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={goToday}
            className="rounded-xl px-3 py-1.5 text-[13px] font-semibold text-zinc-800 ring-1 ring-zinc-200"
          >
            今日
          </button>
          <p className="text-[11px] text-zinc-400">日付をタップして時間割を表示</p>
        </div>
      )}

      {canEdit && !hideAddForm ? (
        <form className="border-t border-zinc-200 bg-white px-3 py-4" onSubmit={(e) => void handleSubmit(e)}>
          <p className="mb-3 text-sm font-bold text-zinc-900">予定を追加</p>
          <input
            required
            className="mb-2 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-[#FF9600]"
            placeholder="タイトル"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />
          <button
            type="submit"
            disabled={saving || !form.title.trim() || !form.startsAt}
            className="w-full rounded-xl bg-[#FF9600] py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? "追加中…" : "予定を追加"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

/** 親から検索トグル用に色定数を参照したい場合 */
export const CALENDAR_ACCENT = ACCENT;
