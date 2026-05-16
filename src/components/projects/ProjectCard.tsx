"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import type { Project } from "@/lib/workspace/types";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ProjectStatusBadge } from "@/components/projects/StatusBadge";

export function ProjectCard({
  project,
  issueTotal,
  issueDone,
}: {
  project: Project;
  issueTotal: number;
  issueDone: number;
}) {
  const pct = issueTotal === 0 ? 0 : Math.round((issueDone / issueTotal) * 100);
  const target = project.targetDate
    ? format(new Date(project.targetDate), "M/d", { locale: ja })
    : "未定";

  return (
    <div className="group relative flex items-center gap-4 border-b border-[#E5E7EB] bg-white px-4 py-3 transition-all duration-150 ease-out hover:bg-[#F7F8F8]">
      <span className="text-xl" aria-hidden>
        {project.icon || "📁"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/projects/${project.id}/overview`} className="truncate font-medium text-[#1A1A1A] hover:underline">
            {project.name}
          </Link>
          <ProjectStatusBadge status={project.status} />
        </div>
        <div className="mt-2 flex max-w-md items-center gap-3">
          <ProgressBar value={pct} className="max-w-[200px]" />
          <span className="text-[12px] text-[#6B7280]">
            {pct}% · {target}
          </span>
        </div>
      </div>
      <Link
        href={`/projects/${project.id}/overview`}
        className="shrink-0 rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1A1A1A] opacity-0 transition-all duration-150 ease-out hover:bg-white group-hover:opacity-100"
      >
        Open
      </Link>
    </div>
  );
}
