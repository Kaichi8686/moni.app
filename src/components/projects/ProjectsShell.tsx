"use client";

import { usePathname } from "next/navigation";
import { AppBottomNav } from "@/components/AppBottomNav";
import { CommandPaletteGate } from "@/components/ui/CommandPaletteGate";

export function ProjectsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const m = pathname?.match(/^\/projects\/([0-9a-fA-F-]{36})/);
  const projectId = m?.[1];
  const hideBottomNav = Boolean(pathname?.match(/^\/projects\/[0-9a-fA-F-]{36}\/coach\/?$/));
  return (
    <>
      {children}
      <CommandPaletteGate projectId={projectId} />
      {hideBottomNav ? null : <AppBottomNav />}
    </>
  );
}
