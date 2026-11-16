"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Flag, MessageSquare, Radio, UserPlus } from "lucide-react";
import {
  loadProjectActivity,
  type ProjectActivityEvent,
  type ProjectActivityKind,
} from "@/lib/projects/projectActivity";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = { projectId: string; fullPage?: boolean };

function formatWhen(iso: string, locale: "ja" | "en") {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 3600000) {
    const n = Math.max(1, Math.floor(diff / 60000));
    return locale === "en" ? `${n}m ago` : `${n}分前`;
  }
  if (diff < 86400000) {
    const n = Math.floor(diff / 3600000);
    return locale === "en" ? `${n}h ago` : `${n}時間前`;
  }
  if (diff < 86400000 * 7) {
    const n = Math.floor(diff / 86400000);
    return locale === "en" ? `${n}d ago` : `${n}日前`;
  }
  return d.toLocaleDateString(locale === "en" ? "en-US" : "ja-JP", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

function kindMeta(kind: ProjectActivityKind): {
  Icon: typeof Radio;
  tone: string;
  labelJa: string;
  labelEn: string;
} {
  switch (kind) {
    case "member":
      return {
        Icon: UserPlus,
        tone: "bg-sky-50 text-sky-700",
        labelJa: "参加",
        labelEn: "Joined",
      };
    case "issue_done":
    case "task_done":
      return {
        Icon: CheckCircle2,
        tone: "bg-emerald-50 text-emerald-700",
        labelJa: "課題",
        labelEn: "Issue",
      };
    case "phase":
      return {
        Icon: Flag,
        tone: "bg-amber-50 text-amber-800",
        labelJa: "ロードマップ",
        labelEn: "Roadmap",
      };
    case "comment":
      return {
        Icon: MessageSquare,
        tone: "bg-violet-50 text-violet-700",
        labelJa: "コメント",
        labelEn: "Comment",
      };
    default:
      return {
        Icon: Radio,
        tone: "bg-zinc-100 text-zinc-600",
        labelJa: "更新",
        labelEn: "Update",
      };
  }
}

export function TeamActivityFeed({ projectId, fullPage = false }: Props) {
  const { tx, locale } = useI18n();
  const [events, setEvents] = useState<ProjectActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const list = await loadProjectActivity(supabase, projectId, fullPage ? 50 : 15);
    setEvents(list);
    setLoading(false);
  }, [fullPage, projectId]);

  useEffect(() => {
    void reload();
    if (!supabase) return;
    const channel = supabase
      .channel(`team-activity-${projectId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "project_activity_events", filter: `project_id=eq.${projectId}` },
        () => void reload(),
      )
      .subscribe();
    return () => {
      if (supabase) void supabase.removeChannel(channel);
    };
  }, [projectId, reload]);

  if (loading && fullPage) {
    return (
      <div className="space-y-3 py-2" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-zinc-100" />
            <div className="min-w-0 flex-1 space-y-2 py-1">
              <div className="h-3 w-16 animate-pulse rounded bg-zinc-100" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    if (!fullPage) return null;
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center px-2 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
          <Radio className="h-5 w-5" aria-hidden />
        </span>
        <p className="text-[15px] font-semibold text-zinc-800">
          {tx("まだ活動がありません", "No activity yet")}
        </p>
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-zinc-500">
          {tx(
            "メンバーの参加、課題の完了、ロードマップの達成があるとここに表示されます。",
            "Member joins, completed issues, and roadmap achievements will show up here.",
          )}
        </p>
      </div>
    );
  }

  if (!fullPage) {
    return (
      <aside className="rounded-xl border border-[#E5E7EB] bg-white p-3">
        <h3 className="mb-2 text-[12px] font-semibold text-[#6B7280]">{tx("チームの動き", "Team activity")}</h3>
        <ul className="max-h-48 space-y-2 overflow-y-auto">
          {events.map((e) => (
            <li key={e.id} className="text-[12px] leading-snug text-[#1A1A1A]">
              <span className="text-[#9CA3AF]">{formatWhen(e.createdAt, locale)}</span>
              <span className="ml-1">{e.body}</span>
            </li>
          ))}
        </ul>
      </aside>
    );
  }

  return (
    <ul className="divide-y divide-zinc-100">
      {events.map((e) => {
        const meta = kindMeta(e.kind);
        const Icon = meta.Icon;
        return (
          <li key={e.id} className="flex gap-3 py-4 first:pt-1">
            <span
              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${meta.tone}`}
              aria-hidden
            >
              <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] font-semibold tracking-wide text-zinc-500">
                  {locale === "en" ? meta.labelEn : meta.labelJa}
                </span>
                <time className="shrink-0 text-[11px] text-zinc-400" dateTime={e.createdAt}>
                  {formatWhen(e.createdAt, locale)}
                </time>
              </div>
              <p className="mt-1 text-[15px] font-medium leading-snug text-zinc-900">{e.body}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
