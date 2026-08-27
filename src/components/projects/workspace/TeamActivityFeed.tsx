"use client";

import { useCallback, useEffect, useState } from "react";
import { loadProjectActivity, type ProjectActivityEvent } from "@/lib/projects/projectActivity";
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
  return d.toLocaleDateString(locale === "en" ? "en-US" : "ja-JP", { month: "short", day: "numeric" });
}

export function TeamActivityFeed({ projectId, fullPage = false }: Props) {
  const { tx, locale } = useI18n();
  const [events, setEvents] = useState<ProjectActivityEvent[]>([]);

  const reload = useCallback(async () => {
    if (!supabase) return;
    const list = await loadProjectActivity(supabase, projectId, 15);
    setEvents(list);
  }, [projectId]);

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

  if (events.length === 0) {
    if (!fullPage) return null;
    return (
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 text-center text-[13px] text-[#6B7280]">
        {tx("まだ活動の記録がありません。課題の更新やメンバーの参加があるとここに表示されます。", "No activity yet. Issue updates and member joins will show up here.")}
      </div>
    );
  }

  const Wrapper = fullPage ? "div" : "aside";

  return (
    <Wrapper className="rounded-xl border border-[#E5E7EB] bg-white p-3">
      {!fullPage ? <h3 className="mb-2 text-[12px] font-semibold text-[#6B7280]">{tx("チームの動き", "Team activity")}</h3> : null}
      <ul className={`space-y-2 overflow-y-auto ${fullPage ? "max-h-none" : "max-h-48"}`}>
        {events.map((e) => (
          <li key={e.id} className="text-[12px] leading-snug text-[#1A1A1A]">
            <span className="text-[#9CA3AF]">{formatWhen(e.createdAt, locale)}</span>
            <span className="ml-1">{e.body}</span>
          </li>
        ))}
      </ul>
    </Wrapper>
  );
}
