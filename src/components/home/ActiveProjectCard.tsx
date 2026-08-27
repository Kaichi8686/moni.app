"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { readLastProject } from "@/lib/workspace/lastProject";
import { supabase } from "@/lib/supabase";

type Props = { userId: string | null };

export function ActiveProjectCard({ userId }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [openCount, setOpenCount] = useState(0);

  useEffect(() => {
    const last = readLastProject();
    if (!last) return;
    setName(last.name);
    setProjectId(last.id);
    if (!supabase || !userId) return;
    void supabase
      .from("project_issues")
      .select("*", { count: "exact", head: true })
      .eq("project_id", last.id)
      .neq("status", "done")
      .then(({ count, error }) => {
        if (!error) setOpenCount(count ?? 0);
      });
  }, [userId]);

  if (!projectId || !name) return null;

  return (
    <Link
      href={`/projects/${projectId}/overview`}
      className="block rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-violet-200"
    >
      <p className="text-[11px] font-medium text-violet-600">{t("activeProject")}</p>
      <p className="mt-0.5 truncate text-base font-semibold text-gray-900">{name}</p>
      <p className="mt-1 text-xs text-gray-500">
        {t("openIssues")} {openCount}
      </p>
    </Link>
  );
}
