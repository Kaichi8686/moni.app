"use client";

import { useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type RoadmapReorderAction = "up" | "down" | "top" | "bottom";

type Props = {
  disabled?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (action: RoadmapReorderAction) => void;
};

export function RoadmapReorderMenu({ disabled, canMoveUp, canMoveDown, onMove }: Props) {
  const { tx } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (disabled) return null;

  const items: Array<{ action: RoadmapReorderAction; label: string; enabled: boolean }> = [
    { action: "up", label: tx("一つ上に移動", "Move up one"), enabled: canMoveUp },
    { action: "down", label: tx("一つ下に移動", "Move down one"), enabled: canMoveDown },
    { action: "top", label: tx("1番上に移動", "Move to top"), enabled: canMoveUp },
    { action: "bottom", label: tx("1番下に移動", "Move to bottom"), enabled: canMoveDown },
  ];

  return (
    <div ref={rootRef} className="relative shrink-0" data-roadmap-reorder-menu>
      <button
        type="button"
        disabled={disabled}
        aria-label={tx("並び替えメニュー", "Reorder menu")}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="inline-flex h-9 w-8 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40"
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+4px)] z-40 min-w-[10.5rem] overflow-hidden rounded-2xl border border-zinc-200 bg-white py-1 shadow-xl"
        >
          {items.map((item) => (
            <button
              key={item.action}
              type="button"
              role="menuitem"
              disabled={!item.enabled}
              className="flex w-full px-3 py-2.5 text-left text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-300"
              onClick={(event) => {
                event.stopPropagation();
                if (!item.enabled) return;
                setOpen(false);
                onMove(item.action);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function nextOrderIds(ids: string[], phaseId: string, action: RoadmapReorderAction): string[] | null {
  const from = ids.indexOf(phaseId);
  if (from < 0) return null;
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  if (action === "up") {
    if (from === 0) return null;
    next.splice(from - 1, 0, moved);
  } else if (action === "down") {
    if (from >= ids.length - 1) return null;
    next.splice(from + 1, 0, moved);
  } else if (action === "top") {
    if (from === 0) return null;
    next.unshift(moved);
  } else {
    if (from >= ids.length - 1) return null;
    next.push(moved);
  }
  return next;
}
