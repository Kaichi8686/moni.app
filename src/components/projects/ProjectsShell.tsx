"use client";

import { usePathname } from "next/navigation";
import { CommandPalette } from "@/components/ui/CommandPalette";

export function ProjectsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const m = pathname?.match(/^\/projects\/([0-9a-fA-F-]{36})/);
  const projectId = m?.[1];
  return (
    <>
      {children}
      <CommandPalette projectId={projectId} />
    </>
  );
}
