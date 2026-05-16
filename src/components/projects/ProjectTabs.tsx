"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleDot, GanttChartSquare, LayoutDashboard, Users } from "lucide-react";

const tabs = [
  { id: "overview", label: "Overview", href: (id: string) => `/projects/${id}/overview`, icon: LayoutDashboard },
  { id: "roadmap", label: "Roadmap", href: (id: string) => `/projects/${id}/roadmap`, icon: GanttChartSquare },
  { id: "issues", label: "Issues", href: (id: string) => `/projects/${id}/issues`, icon: CircleDot },
  { id: "members", label: "Members", href: (id: string) => `/projects/${id}/members`, icon: Users },
] as const;

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b border-[#E5E7EB] px-4" aria-label="プロジェクト">
      {tabs.map((t) => {
        const href = t.href(projectId);
        const active = pathname === href || pathname?.startsWith(href + "/");
        const Icon = t.icon;
        return (
          <Link
            key={t.id}
            href={href}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-all duration-150 ease-out ${
              active
                ? "border-[#5E6AD2] text-[#1A1A1A]"
                : "border-transparent text-[#6B7280] hover:bg-[#F7F8F8] hover:text-[#1A1A1A]"
            }`}
          >
            <Icon className="h-4 w-4 opacity-80" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
