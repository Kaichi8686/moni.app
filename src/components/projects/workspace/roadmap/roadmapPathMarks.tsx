"use client";

import type { ComponentType } from "react";
import {
  BookOpen,
  Camera,
  Check,
  Compass,
  Flag,
  Headphones,
  Heart,
  Lightbulb,
  Plus,
  Rocket,
  Star,
  Target,
  Users,
} from "lucide-react";
import type { RoadmapPathNodeTone } from "@/components/projects/workspace/roadmap/RoadmapPathNode";

type Icon = ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;

export const ROADMAP_MARK_IDS = [
  "star",
  "book",
  "flag",
  "headphones",
  "camera",
  "compass",
  "lightbulb",
  "target",
  "rocket",
  "heart",
  "users",
] as const;

export type RoadmapMarkId = (typeof ROADMAP_MARK_IDS)[number];

const MARK_ICONS: Record<RoadmapMarkId, Icon> = {
  star: Star,
  book: BookOpen,
  flag: Flag,
  headphones: Headphones,
  camera: Camera,
  compass: Compass,
  lightbulb: Lightbulb,
  target: Target,
  rocket: Rocket,
  heart: Heart,
  users: Users,
};

export function isRoadmapMarkId(value: string | null | undefined): value is RoadmapMarkId {
  return Boolean(value && (ROADMAP_MARK_IDS as readonly string[]).includes(value));
}

export function resolveRoadmapMarkId(value: string | null | undefined, fallbackIndex = 0): RoadmapMarkId {
  if (isRoadmapMarkId(value)) return value;
  return ROADMAP_MARK_IDS[fallbackIndex % ROADMAP_MARK_IDS.length] ?? "star";
}

/** ステップ番号に応じたマス内マーク（完了は ✓、作成は ＋） */
export function RoadmapStepMark({
  markId,
  index = 0,
  tone,
}: {
  markId?: string | null;
  index?: number;
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

  const id = resolveRoadmapMarkId(markId, index);
  const Icon = MARK_ICONS[id];
  return <Icon className={iconClass} strokeWidth={2.25} aria-hidden />;
}

type PickerProps = {
  value: RoadmapMarkId;
  onChange: (id: RoadmapMarkId) => void;
  disabled?: boolean;
  label?: string;
};

/** ロードマップ作成・編集時のマーク選択 */
export function RoadmapMarkPicker({ value, onChange, disabled = false, label }: PickerProps) {
  return (
    <div>
      {label ? <p className="mb-1.5 text-xs font-semibold text-zinc-600">{label}</p> : null}
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
        {ROADMAP_MARK_IDS.map((id) => {
          const Icon = MARK_ICONS[id];
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(id)}
              aria-pressed={selected}
              aria-label={id}
              className={`flex h-10 w-full items-center justify-center rounded-xl border transition ${
                selected
                  ? "border-orange-500 bg-orange-500 text-white shadow-sm"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-orange-200 hover:bg-orange-50"
              } disabled:opacity-40`}
            >
              <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}
