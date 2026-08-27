import type { PhaseColor } from "@/lib/roadmap/types";

export type GalleryCategory = "app" | "hardware" | "service" | "food" | "event" | "retail" | "research" | "other";

export type SystemTemplatePhase = {
  title: string;
  goal: string;
  description?: string;
  status: "planned" | "in_progress" | "paused" | "completed";
  color: PhaseColor;
  order: number;
  defaultDurationDays: number;
  milestones?: string[];
  keyQuestions?: string[];
};

export type SystemTemplate = {
  id: string;
  title: string;
  description: string;
  category: "app" | "hardware" | "service";
  businessType: string;
  thumbnailEmoji: string;
  tags: string[];
  authorLabel: string;
  phases: SystemTemplatePhase[];
};

export type UserRoadmapTemplateRow = {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  category: GalleryCategory;
  business_type: string | null;
  is_public: boolean;
  use_count: number;
  like_count: number;
  phases_json: unknown;
  tags: string[];
  thumbnail_emoji: string;
  created_at: string;
  updated_at: string;
};

export type GalleryTemplateSource = "system" | "project" | "community";

/** ギャラリーUI用の統一ビュー */
export type GalleryTemplateView = {
  id: string;
  title: string;
  description: string;
  category: GalleryCategory;
  businessType: string;
  thumbnailEmoji: string;
  tags: string[];
  authorLabel: string;
  isOfficial: boolean;
  source: GalleryTemplateSource;
  /** source=project のとき applyTemplateToProject に渡す ID */
  projectTemplateId?: string;
  phaseCount?: number;
  sources?: string[];
  usageGuide?: string;
  useCount?: number;
  likeCount?: number;
  phases: SystemTemplatePhase[];
};
