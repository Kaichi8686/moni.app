"use client";

import Link from "next/link";
import { FolderKanban, Inbox, LayoutGrid } from "lucide-react";

const nav = [
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Inbox", href: "/projects?view=inbox", icon: Inbox },
  { label: "Views", href: "/projects?view=views", icon: LayoutGrid },
] as const;

export function ProjectSidebar() {
  return (
    <aside className="hidden w-[200px] shrink-0 flex-col border-r border-[#E5E7EB] bg-white lg:flex">
      <div className="p-3 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">Workspace</div>
      <nav className="flex flex-col gap-0.5 px-2 pb-4">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-[13px] font-medium text-[#6B7280] transition-all duration-150 ease-out hover:bg-[#F7F8F8] hover:text-[#1A1A1A]"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
