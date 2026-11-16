"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppBottomNav } from "@/components/AppBottomNav";
import { CommandPalette } from "@/components/ui/CommandPalette";

export function ProjectsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const m = pathname?.match(/^\/projects\/([0-9a-fA-F-]{36})/);
  const projectId = m?.[1];
  const [docEditorOpen, setDocEditorOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () =>
      setDocEditorOpen(
        root.classList.contains("moni-doc-editor") ||
          root.classList.contains("moni-issues-drill") ||
          root.classList.contains("moni-recruit-drill"),
      );
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const hideBottomNav = Boolean(
    docEditorOpen ||
      pathname?.match(/^\/projects\/[^/]+\/roadmap\/?$/) ||
      pathname?.match(/^\/projects\/[^/]+\/ideas(?:\/|$)/) ||
      pathname?.match(/^\/projects\/[^/]+\/activity\/?$/) ||
      pathname?.match(/^\/projects\/[^/]+\/members\/?$/) ||
      pathname?.match(/^\/projects\/[^/]+\/schedule\/?$/) ||
      pathname?.match(/^\/projects\/[^/]+\/settings\/?$/) ||
      pathname?.match(/^\/projects\/[^/]+\/invite\/?$/),
  );
  return (
    <>
      {children}
      <CommandPalette projectId={projectId} />
      {hideBottomNav ? null : <AppBottomNav />}
    </>
  );
}
