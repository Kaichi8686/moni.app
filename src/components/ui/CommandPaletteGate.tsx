"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useWorkspaceUiStore } from "@/lib/workspace/store";

const CommandPalette = dynamic(
  () => import("@/components/ui/CommandPalette").then((m) => m.CommandPalette),
  { ssr: false },
);

/** Loads cmdk only after the user opens the palette (⌘/Ctrl+K or store). */
export function CommandPaletteGate({ projectId }: { projectId?: string }) {
  const open = useWorkspaceUiStore((s) => s.commandOpen);
  const setOpen = useWorkspaceUiStore((s) => s.setCommandOpen);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setArmed(true);
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  if (!armed && !open) return null;
  return <CommandPalette projectId={projectId} />;
}
