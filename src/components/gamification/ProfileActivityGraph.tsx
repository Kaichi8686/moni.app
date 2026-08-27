"use client";

import { useMemo } from "react";
import { formatActivityDate, summarizeActivity } from "@/lib/gamification/activityGraph";
import { useI18n } from "@/lib/i18n/I18nProvider";

const WEEKDAYS_JA = ["月", "火", "水", "木", "金", "土", "日"] as const;
const WEEKDAYS_EN = ["M", "T", "W", "T", "F", "S", "S"] as const;

type Props = {
  activityLog: Record<string, number>;
};

export function ProfileActivityGraph({ activityLog }: Props) {
  const { locale, tx } = useI18n();
  const summary = useMemo(() => summarizeActivity(activityLog), [activityLog]);
  const weekdays = locale === "en" ? WEEKDAYS_EN : WEEKDAYS_JA;
  const times = (n: number) => (locale === "en" ? `${n}x` : `${n}回`);

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">{tx("活動履歴", "Activity")}</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-gray-500">
        {tx("プロジェクトや投稿をした日です。色がついている日が、動いた日です。", "Days you posted or worked on a project. Colored days are active.")}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label={tx("合計", "Total")} value={times(summary.total)} hint={tx("いままでの記録", "All time")} />
        <Stat label={tx("今週", "This week")} value={times(summary.thisWeek)} hint={tx("月曜〜今日", "Mon–today")} />
        <Stat
          label={tx("今月", "This month")}
          value={times(summary.thisMonth)}
          hint={locale === "en" ? String(summary.month) : `${summary.month}月`}
        />
      </div>

      <p className="mt-5 text-[13px] font-semibold text-gray-900">
        {locale === "en" ? `${summary.year}/${summary.month}` : `${summary.year}年${summary.month}月`}
      </p>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center">
        {weekdays.map((d, i) => (
          <span key={`${d}-${i}`} className="text-[11px] font-medium text-gray-400">
            {d}
          </span>
        ))}
        {summary.monthCells.map((cell, i) => {
          if (!cell.day) {
            return <span key={`empty-${i}`} className="h-9" />;
          }
          const active = cell.count > 0;
          return (
            <span
              key={cell.date}
              title={active ? times(cell.count) : undefined}
              className={`flex h-9 items-center justify-center rounded-lg text-[13px] font-semibold ${
                active
                  ? "bg-violet-600 text-white"
                  : cell.isToday
                    ? "bg-violet-50 text-violet-700 ring-1 ring-violet-200"
                    : "text-gray-500"
              }`}
            >
              {cell.day}
            </span>
          );
        })}
      </div>
      <p className="mt-2 text-right text-[11px] text-gray-400">
        {tx("紫の日 = 活動した日", "Purple = active")}
      </p>

      {summary.recent.length > 0 ? (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="text-[13px] font-semibold text-gray-900">{tx("最近の活動", "Recent")}</p>
          <ul className="mt-2 space-y-2">
            {summary.recent.map((day) => (
              <li key={day.date} className="flex items-center justify-between text-[13px]">
                <span className="text-gray-700">{formatActivityDate(day.date, locale)}</span>
                <span className="font-semibold text-violet-700">{times(day.count)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-[13px] text-gray-400">
          {tx("まだ記録がありません。課題を進めたり投稿すると日付が色づきます。", "No activity yet. Complete issues or post to fill the calendar.")}
        </p>
      )}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2.5">
      <p className="text-[11px] font-medium text-gray-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900">{value}</p>
      <p className="text-[10px] text-gray-400">{hint}</p>
    </div>
  );
}
