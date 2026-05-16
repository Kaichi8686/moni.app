"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";

export type CalendarSchedule = {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  attendees: string[] | null;
};

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

type Props = {
  schedules: CalendarSchedule[];
  onSave: (payload: { title: string; description: string; startsAt: string; endsAt: string; attendees: string }) => Promise<void>;
  saving?: boolean;
  canEdit?: boolean;
};

export function ProjectScheduleCalendar({ schedules, onSave, saving, canEdit = true }: Props) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState<string | null>(() => dateKeyLocal(new Date()));
  const [form, setForm] = useState({
    title: "",
    description: "",
    startsAt: "",
    endsAt: "",
    attendees: "",
  });

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarSchedule[]>();
    for (const ev of schedules) {
      const keys = eachDateKeyInRange(ev.starts_at, ev.ends_at);
      for (const k of keys) {
        const list = map.get(k) ?? [];
        if (!list.some((x) => x.id === ev.id)) list.push(ev);
        map.set(k, list);
      }
    }
    for (const [, list] of map) {
      list.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    }
    return map;
  }, [schedules]);

  const monthCells = useMemo(() => buildMonthGrid(viewDate), [viewDate]);

  const titleMonth = useMemo(
    () =>
      viewDate.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
      }),
    [viewDate],
  );

  const selectedDayEvents = useMemo(() => {
    if (!selectedKey) return [];
    return eventsByDay.get(selectedKey) ?? [];
  }, [eventsByDay, selectedKey]);

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
    });
    setForm((f) => ({ title: "", description: "", startsAt: f.startsAt, endsAt: f.endsAt, attendees: "" }));
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
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPickDay(key)}
              className={`flex min-h-[72px] flex-col items-stretch border border-transparent bg-white p-1 text-left transition hover:bg-emerald-50/80 sm:min-h-[88px] ${
                isSelected ? "ring-2 ring-emerald-400 ring-offset-1" : ""
              } ${isToday ? "bg-emerald-50/40" : ""}`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold sm:h-7 sm:w-7 sm:text-xs ${
                  isToday ? "bg-emerald-500 text-white" : "text-zinc-800"
                }`}
              >
                {cell.getDate()}
              </span>
              <div className="mt-0.5 flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                {list.slice(0, 3).map((ev) => (
                  <span
                    key={ev.id}
                    className={`truncate rounded px-1 py-0.5 text-[9px] font-medium text-white shadow-sm sm:text-[10px] ${hashColor(ev.id)}`}
                  >
                    {ev.title}
                  </span>
                ))}
                {list.length > 3 ? (
                  <span className="text-[9px] font-medium text-zinc-400">+{list.length - 3}</span>
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
            {selectedDayEvents.length === 0 ? (
              <li className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-3 py-4 text-center text-sm text-zinc-500">この日の予定はまだありません</li>
            ) : (
              selectedDayEvents.map((s) => (
                <li key={s.id} className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2 shadow-sm">
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 h-8 w-1 shrink-0 rounded-full ${hashColor(s.id)}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-zinc-900">{s.title}</p>
                      <p className="text-[11px] text-zinc-500">
                        {new Date(s.starts_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                        {s.ends_at ? ` – ${new Date(s.ends_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}` : ""}
                      </p>
                      {s.description ? <p className="mt-1 text-sm text-zinc-700">{s.description}</p> : null}
                      {s.attendees && s.attendees.length > 0 ? (
                        <p className="mt-1 text-[11px] text-zinc-400">{s.attendees.join(" · ")}</p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}

      {canEdit ? (
      <form className="border-t border-zinc-200 bg-white px-3 py-4 sm:px-4" onSubmit={(e) => void handleSubmit(e)}>
        <p className="mb-3 text-sm font-bold text-zinc-900">予定を追加</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            required
            className="rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-sm outline-none ring-emerald-500/20 transition focus:border-emerald-400 focus:ring-2 sm:col-span-2"
            placeholder="タイトル（例：キックオフ）"
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
          <input
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 sm:col-span-2"
            placeholder="参加者（カンマ区切り・任意）"
            value={form.attendees}
            onChange={(e) => setForm((p) => ({ ...p, attendees: e.target.value }))}
          />
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
          {saving ? "追加中…" : "予定を追加"}
        </button>
      </form>
      ) : null}
    </div>
  );
}
