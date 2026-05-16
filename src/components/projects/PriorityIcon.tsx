"use client";

import type { Priority } from "@/lib/workspace/types";
import { AlertCircle, ArrowDown, ArrowUp, Circle, Flame } from "lucide-react";

export function PriorityIcon({ priority, className = "" }: { priority: Priority; className?: string }) {
  const common = `h-4 w-4 shrink-0 ${className}`;
  switch (priority) {
    case "urgent":
      return <Flame className={`${common} text-red-500`} aria-label="急" />;
    case "high":
      return <ArrowUp className={`${common} text-amber-500`} aria-label="高" />;
    case "medium":
      return <Circle className={`${common} text-zinc-400`} aria-label="中" />;
    case "low":
      return <ArrowDown className={`${common} text-sky-400`} aria-label="低" />;
    default:
      return <AlertCircle className={`${common} text-zinc-300`} aria-label="なし" />;
  }
}
