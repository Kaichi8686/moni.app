"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { readLastProject } from "@/lib/workspace/lastProject";
import { supabase } from "@/lib/supabase";
import { ProgressBar } from "@/components/ui/ProgressBar";

type Props = { userId: string | null };

export function ActiveProjectCard({ userId }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [openCount, setOpenCount] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const last = readLastProject();
    if (!last) return;
    setName(last.name);
    setProjectId(last.id);
    if (!supabase || !userId) return;
    void Promise.all([
      supabase
        .from("project_issues")
        .select("*", { count: "exact", head: true })
        .eq("project_id", last.id)
        .neq("status", "done"),
      supabase
        .from("project_issues")
        .select("*", { count: "exact", head: true })
        .eq("project_id", last.id)
        .eq("status", "done"),
      supabase
        .from("project_issues")
        .select("*", { count: "exact", head: true })
        .eq("project_id", last.id),
    ]).then(([openRes, doneRes, totalRes]) => {
      if (!openRes.error) setOpenCount(openRes.count ?? 0);
      if (!doneRes.error) setDoneCount(doneRes.count ?? 0);
      if (!totalRes.error) setTotalCount(totalRes.count ?? 0);
    });
  }, [userId]);

  if (!projectId || !name) return null;

  const pct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  return (
    <Link
      href={`/projects/${projectId}/overview`}
      className="block rounded-2xl border border-[var(--brand-muted,#ffd9cc)] bg-white p-4 shadow-sm transition hover:border-[var(--brand,#ff5c35)] hover:shadow-md"
    >
      <p className="text-[11px] font-semibold tracking-wide text-[var(--brand,#ff5c35)]">{t("activeProject")}</p>
      <p className="mt-0.5 truncate text-base font-semibold text-zinc-900">{name}</p>
      <p className="mt-1 text-xs text-zinc-500">
        {t("openIssues")} {openCount}
        {totalCount > 0 ? ` ・ ${pct}%` : ""}
      </p>
      {totalCount > 0 ? <ProgressBar value={pct} className="mt-2.5" /> : null}
    </Link>
  );
}
