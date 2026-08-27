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
  const href = `/projects/${project.id}/roadmap`;

  return (
    <Link
      href={href}
      className="group relative flex items-center gap-4 border-b border-[#E5E7EB] bg-white px-4 py-3 transition-all duration-150 ease-out hover:bg-[#F7F8F8]"
    >
      <span className="text-xl" aria-hidden>
        {project.icon || "📁"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium text-[#1A1A1A] group-hover:underline">{project.name}</span>
          <ProjectStatusBadge status={project.status} />
        </div>
        <div className="mt-2 flex max-w-md items-center gap-3">
          <ProgressBar value={pct} className="max-w-[200px]" />
          <span className="text-[12px] text-[#6B7280]">
            {pct}% · {target}
          </span>
        </div>
      </div>
      <span className="shrink-0 rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1A1A1A] opacity-0 transition-all duration-150 ease-out group-hover:opacity-100">
        開く
      </span>
    </Link>
  );
}
