"use client";

import { useCallback, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { loadProfileGamification } from "@/lib/gamification/profileGamification";
import { supabase } from "@/lib/supabase";

type Report = {
  summary?: string;
  good?: string;
  challenge?: string;
  cheer?: string;
};

type Props = { userId: string | null };

export function WeeklyReportCard({ userId }: Props) {
  const { t, tx } = useI18n();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");

  const load = useCallback(async () => {
    if (!supabase || !userId) return;
    const { data } = await supabase.from("profiles").select("weekly_report_json").eq("id", userId).maybeSingle();
    const raw = (data as { weekly_report_json?: Report } | null)?.weekly_report_json;
    if (raw?.summary) setReport(raw);
  }, [userId]);

  const generate = useCallback(async () => {
    if (!userId || !supabase) return;
    setLoading(true);
    try {
      const gam = await loadProfileGamification(supabase, userId);
      const { count: posts } = await supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("author_id", userId);
      const res = await fetch("/api/gamification/weekly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          posts: posts ?? 0,
          completedTasks: 0,
          milestones: [],
          streak: gam.activityStreak,
        }),
      });
      const json = (await res.json()) as Report;
      setReport(json);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  async function sendEmail() {
    if (!userId) return;
    setEmailMsg("");
    const res = await fetch("/api/gamification/weekly-report/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const json = (await res.json()) as { error?: string; ok?: boolean };
    setEmailMsg(json.error ?? (json.ok ? tx("送信しました", "Sent") : tx("失敗しました", "Failed")));
  }

  if (!userId) return null;

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{t("weeklyReport")}</h2>
        <button
          type="button"
          disabled={loading}
          className="text-xs font-semibold text-violet-600 hover:underline"
          onClick={() => void (report ? load() : generate())}
        >
          {loading ? "…" : report ? "↻" : t("weeklyReportGenerate").slice(0, 8) + "…"}
        </button>
      </div>
      {report ? (
        <div className="space-y-2 text-sm text-gray-700">
          <p className="font-semibold text-gray-900">{report.summary}</p>
          <p>
            <span className="text-gray-500">{t("weeklyReportGood")}</span>
            {report.good}
          </p>
          <p>
            <span className="text-gray-500">{t("weeklyReportChallenge")}</span>
            {report.challenge}
          </p>
          <p className="text-violet-700">{report.cheer}</p>
          <button
            type="button"
            className="text-xs font-semibold text-violet-600 hover:underline"
            onClick={() => void sendEmail()}
          >
            {t("weeklyReportEmail")}
          </button>
          {emailMsg ? <p className="text-xs text-gray-500">{emailMsg}</p> : null}
        </div>
      ) : (
        <button
          type="button"
          className="text-sm text-gray-500 hover:text-violet-600"
          onClick={() => void generate()}
        >
          {t("weeklyReportGenerate")}
        </button>
      )}
    </section>
  );
}
