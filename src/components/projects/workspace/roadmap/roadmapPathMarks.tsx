"use client";

import type { ComponentType } from "react";
import {
  BookOpen,
  Camera,
  Check,
  Compass,
  Flag,
  Headphones,
  Lightbulb,
  Plus,
  Star,
  Target,
} from "lucide-react";
import type { RoadmapPathNodeTone } from "@/components/projects/workspace/roadmap/RoadmapPathNode";

type Icon = ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;

const STEP_MARKS: Icon[] = [Star, BookOpen, Flag, Headphones, Camera, Compass, Lightbulb, Target];

/** ステップ番号に応じたマス内マーク（完了は ✓、作成は ＋） */
export function RoadmapStepMark({
  index,
  tone,
}: {
  index: number;
  tone: RoadmapPathNodeTone;
}) {
  const iconClass =
    tone === "upcoming"
      ? "h-8 w-8 text-[#9CA3AF] sm:h-9 sm:w-9"
      : "h-8 w-8 text-white sm:h-9 sm:w-9";

  if (tone === "create") {
    return <Plus className={iconClass} strokeWidth={2.75} aria-hidden />;
  }
  if (tone === "done") {
    return <Check className={iconClass} strokeWidth={3} aria-hidden />;
  }

  const Icon = STEP_MARKS[index % STEP_MARKS.length] ?? Star;
  return <Icon className={iconClass} strokeWidth={2.25} aria-hidden />;
}
