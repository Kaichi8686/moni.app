"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  addDaysToDateKey,
  gardenBusinessDateKey,
  tokyoWeekday,
} from "@/lib/idea-garden/calendar";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  open: boolean;
  onClose: () => void;
  /** アイデアを出した日 YYYY-MM-DD */
  plantedDateKeys: string[];
  streakDays: number;
};

type DayCell = {
  dateKey: string;
  day: number;
  inMonth: boolean;
  status: "done" | "missed" | "today-empty" | "future" | "outside";
};

function monthKeyFromDateKey(dateKey: string): string {
  return dateKey.slice(0, 7); // YYYY-MM
}

function firstOfMonth(monthKey: string): string {
  return `${monthKey}-01`;
}

function addMonths(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1, 12, 0, 0));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function buildMonthCells(monthKey: string, planted: Set<string>, today: string): DayCell[] {
  const first = firstOfMonth(monthKey);
  const firstWeekday = tokyoWeekday(new Date(`${first}T12:00:00+09:00`));
  const total = daysInMonth(monthKey);
  const cells: DayCell[] = [];

  // Leading padding (Sun-start, same as Duolingo-ish week)
  for (let i = 0; i < firstWeekday; i++) {
    const key = addDaysToDateKey(first, i - firstWeekday);
    cells.push({
      dateKey: key,
      day: Number(key.slice(8, 10)),
      inMonth: false,
      status: "outside",
    });
  }

  for (let d = 1; d <= total; d++) {
    const dateKey = `${monthKey}-${String(d).padStart(2, "0")}`;
    let status: DayCell["status"];
    if (planted.has(dateKey)) {
      status = "done";
    } else if (dateKey > today) {
      status = "future";
    } else if (dateKey === today) {
      status = "today-empty";
    } else {
      status = "missed";
    }
    cells.push({ dateKey, day: d, inMonth: true, status });
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]!.dateKey;
    const key = addDaysToDateKey(last, 1);
    cells.push({
      dateKey: key,
      day: Number(key.slice(8, 10)),
      inMonth: false,
      status: "outside",
    });
  }

  return cells;
}

function formatMonthTitle(monthKey: string, locale: "ja" | "en"): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (locale === "en") {
    const name = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    return name;
  }
  return `${y}年${m}月`;
}

/** 連続記録タップ → 出した日／休んだ日のカレンダー */
export function IdeaStreakCalendar({ open, onClose, plantedDateKeys, streakDays }: Props) {
  const { tx, locale } = useI18n();
  const today = gardenBusinessDateKey();
  const planted = useMemo(() => new Set(plantedDateKeys), [plantedDateKeys]);
  const [monthKey, setMonthKey] = useState(() => monthKeyFromDateKey(today));
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setMonthKey(monthKeyFromDateKey(gardenBusinessDateKey()));
  }

  const cells = useMemo(
    () => buildMonthCells(monthKey, planted, today),
    [monthKey, planted, today],
  );

  const doneInMonth = cells.filter((c) => c.inMonth && c.status === "done").length;
  const missedInMonth = cells.filter((c) => c.inMonth && c.status === "missed").length;

  const weekdays =
    locale === "en"
      ? ["S", "M", "T", "W", "T", "F", "S"]
      : ["日", "月", "火", "水", "木", "金", "土"];

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={tx("連続記録カレンダー", "Streak calendar")}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="w-full max-w-md rounded-t-[1.75rem] border-[3px] border-[#FF9600]/35 bg-gradient-to-b from-[#FFF8EC] to-white p-4 shadow-xl sm:rounded-[1.75rem]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FF9600] text-white shadow-[0_3px_0_#D97706]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 2c1.5 3.2-.2 5.2-1.4 6.6C9.2 10.2 8 11.6 8 14a4 4 0 0 0 8 0c0-2.8-1.6-4.6-2.8-6C11.8 6.5 12 4.2 12 2zm0 18a2.5 2.5 0 0 1-2.5-2.5c0-1.2.7-2 1.5-2.8.3.9.9 1.5 1.7 1.8.5.2 1 .7 1 1.5A2.5 2.5 0 0 1 12 20z" />
                  </svg>
                </span>
                <div className="leading-tight">
                  <p className="text-[28px] font-extrabold tabular-nums tracking-tight text-[#D97706]">
                    {streakDays}
                    <span className="ml-1 text-[14px] font-bold text-[#B45309]">
                      {tx("日連続", "day streak")}
                    </span>
                  </p>
                  <p className="text-[12px] font-semibold text-zinc-500">
                    {tx("アイデアを出した日をカレンダーで確認", "See which days you planted ideas")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-600"
                aria-label={tx("閉じる", "Close")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMonthKey((m) => addMonths(m, -1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#3C3C3C] shadow-sm"
                aria-label={tx("前の月", "Previous month")}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <p className="text-[16px] font-extrabold text-[#3C3C3C]">
                {formatMonthTitle(monthKey, locale === "en" ? "en" : "ja")}
              </p>
              <button
                type="button"
                onClick={() => setMonthKey((m) => addMonths(m, 1))}
                disabled={monthKey >= monthKeyFromDateKey(today)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#3C3C3C] shadow-sm disabled:opacity-30"
                aria-label={tx("次の月", "Next month")}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1 text-center">
              {weekdays.map((w, i) => (
                <div
                  key={`${w}-${i}`}
                  className={`pb-1 text-[11px] font-bold ${
                    i === 0 ? "text-[#E11D48]" : i === 6 ? "text-[#2563EB]" : "text-zinc-400"
                  }`}
                >
                  {w}
                </div>
              ))}
              {cells.map((cell) => {
                const isToday = cell.dateKey === today;
                const base =
                  "relative mx-auto flex h-10 w-10 flex-col items-center justify-center rounded-full text-[13px] font-extrabold transition-colors";
                if (!cell.inMonth || cell.status === "outside") {
                  return <div key={cell.dateKey} className={`${base} text-zinc-200`} />;
                }
                if (cell.status === "done") {
                  return (
                    <div
                      key={cell.dateKey}
                      className={`${base} bg-[#FF9600] text-white shadow-[0_2px_0_#D97706] ${
                        isToday ? "ring-2 ring-[#D97706] ring-offset-2" : ""
                      }`}
                      title={cell.dateKey}
                    >
                      {cell.day}
                    </div>
                  );
                }
                if (cell.status === "missed") {
                  return (
                    <div
                      key={cell.dateKey}
                      className={`${base} bg-zinc-100 text-zinc-400`}
                      title={cell.dateKey}
                    >
                      <span className="leading-none">{cell.day}</span>
                      <span className="absolute bottom-1 h-1 w-1 rounded-full bg-zinc-300" />
                    </div>
                  );
                }
                if (cell.status === "today-empty") {
                  return (
                    <div
                      key={cell.dateKey}
                      className={`${base} border-[2.5px] border-dashed border-[#FF9600] text-[#D97706]`}
                      title={cell.dateKey}
                    >
                      {cell.day}
                    </div>
                  );
                }
                return (
                  <div key={cell.dateKey} className={`${base} text-zinc-300`} title={cell.dateKey}>
                    {cell.day}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-bold text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded-full bg-[#FF9600] shadow-[0_1px_0_#D97706]" />
                {tx(`出した日（${doneInMonth}）`, `Planted (${doneInMonth})`)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded-full bg-zinc-100 ring-1 ring-zinc-200" />
                {tx(`休んだ日（${missedInMonth}）`, `Missed (${missedInMonth})`)}
              </span>
              {!planted.has(today) ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 rounded-full border-[2px] border-dashed border-[#FF9600]" />
                  {tx("今日（まだ）", "Today (open)")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 rounded-full bg-[#FF9600] ring-2 ring-[#D97706] ring-offset-1" />
                  {tx("今日", "Today")}
                </span>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
