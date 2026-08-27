"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { readLastProject } from "@/lib/workspace/lastProject";
import { supabase } from "@/lib/supabase";

type Props = { userId: string | null };

export function TodayActionCard({ userId }: Props) {
  const { t } = useI18n();
  const [action, setAction] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<string | null>(null);

  const loadCached = useCallback(async () => {
    if (!supabase || !userId) return;
    const { data } = await supabase.from("profiles").select("today_action_json").eq("id", userId).maybeSingle();
    const raw = (data as { today_action_json?: { date?: string; action?: string } } | null)?.today_action_json;
    const today = new Date().toISOString().slice(0, 10);
    if (raw?.date === today && raw.action) {
      setAction(raw.action);
      setDate(raw.date);
    }
  }, [userId]);

  const generate = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const last = readLastProject();
    let openTasks: string[] = [];
    let phaseTitle = "";
    if (supabase && last?.id) {
      const { data: issues } = await supabase
        .from("project_issues")
        .select("title,status")
        .eq("project_id", last.id)
        .neq("status", "done")
        .limit(5);
      openTasks = (issues ?? []).map((i) => (i.title as string) || "").filter(Boolean);
      const { data: phases } = await supabase
        .from("project_roadmap_steps")
        .select("title,status")
        .eq("project_id", last.id)
        .order("sort_order", { ascending: true });
      const active = (phases ?? []).find((p) => p.status === "active") ?? (phases ?? [])[0];
      phaseTitle = (active?.title as string) || "";
    }
    try {
      const res = await fetch("/api/gamification/today-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          projectName: last?.name,
          phaseTitle,
          openTasks,
        }),
      });
      const json = (await res.json()) as { action?: string; date?: string };
      if (json.action) {
        setAction(json.action);
        setDate(json.date ?? new Date().toISOString().slice(0, 10));
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadCached();
  }, [loadCached]);

  if (!userId) return null;

  return (
    <section className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-violet-900">{t("todayAction")}</h2>
        <button
          type="button"
          disabled={loading}
          className="text-xs font-semibold text-violet-600 hover:underline disabled:opacity-50"
          onClick={() => void generate()}
        >
          {loading ? "…" : action ? t("todayActionUpdate") : t("todayActionGenerate")}
        </button>
      </div>
      {action ? (
        <p className="text-sm leading-relaxed text-gray-800">{action}</p>
      ) : (
        <p className="text-sm text-gray-500">{t("todayActionHint")}</p>
      )}
      {date ? <p className="mt-1 text-[11px] text-gray-400">{date}</p> : null}
    </section>
  );
}
