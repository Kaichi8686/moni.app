"use client";

import Link from "next/link";
import { Heart, Users } from "lucide-react";
import type { ProjectRow } from "@/lib/projects/types";
import { PROJECT_ICON_BG, projectHashIndex } from "@/lib/projects/projectCardVisual";
import { projectLineShortLabel } from "@/lib/projects/roadmapTemplates";
import { ProjectCardMenu, type ProjectCardMenuItem } from "@/components/projects/ProjectCardMenu";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type ProjectFeedCardVariant = "feed" | "rail" | "compact";

type Props = {
  project: ProjectRow;
  variant?: ProjectFeedCardVariant;
  ownerName?: string;
  memberCount?: number;
  likeCount?: number;
  likedByMe?: boolean;
  showLike?: boolean;
  menuItems?: ProjectCardMenuItem[];
  likeBusy?: boolean;
  onToggleLike?: () => void;
};

export function ProjectFeedCard({
  project,
  variant = "feed",
  ownerName,
  memberCount = 0,
  likeCount = 0,
  likedByMe = false,
  showLike = true,
  menuItems,
  likeBusy,
  onToggleLike,
}: Props) {
  const { tx } = useI18n();
  const color = PROJECT_ICON_BG[projectHashIndex(project.id, PROJECT_ICON_BG.length)] ?? "bg-zinc-500";
  const thumb = project.thumbnail_url?.trim();
  const category = project.category?.trim() || projectLineShortLabel(project.business_type);
  const isRail = variant === "rail";
  const isCompact = variant === "compact";

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] ${
        isRail ? "w-[11.5rem] shrink-0 sm:w-[13rem]" : "h-full"
      }`}
    >
      <Link href={`/projects/${project.id}/overview`} prefetch className="relative block focus-visible:outline-none">
        <div className={`relative w-full overflow-hidden bg-zinc-100 ${isRail || isCompact ? "aspect-[4/3]" : "aspect-[16/11]"}`}>
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-configured Supabase project image
            <img
              src={thumb}
              alt=""
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className={`flex h-full w-full items-center justify-center ${color}`}>
              <span className="text-3xl font-semibold text-white sm:text-4xl" aria-hidden>
                {(project.icon?.trim() || project.name.trim().charAt(0) || "P").toUpperCase()}
              </span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-80" />
        </div>
      </Link>

      {menuItems && menuItems.length > 0 ? (
        <div className="absolute right-2 top-2">
          <ProjectCardMenu items={menuItems} label={tx("プロジェクトメニュー", "Project menu")} />
        </div>
      ) : null}

      <div className={`flex flex-1 flex-col ${isRail ? "gap-1 px-2.5 py-2.5" : "gap-1.5 px-3 py-3"}`}>
        <Link href={`/projects/${project.id}/overview`} prefetch className="min-w-0">
          <h3
            className={`font-semibold leading-snug text-zinc-900 ${
              isRail ? "line-clamp-2 text-sm" : "line-clamp-2 text-[0.95rem]"
            }`}
          >
            {project.name}
          </h3>
        </Link>

        {!isRail ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-zinc-500">
            {project.description?.trim() || tx("説明はまだありません", "No description yet")}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-medium text-zinc-500">
          {category ? (
            <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-zinc-700">{category}</span>
          ) : null}
          {ownerName ? <span className="truncate">{ownerName}</span> : null}
          {memberCount > 0 ? (
            <span className="inline-flex items-center gap-0.5">
              <Users className="h-3 w-3" aria-hidden />
              {memberCount}
            </span>
          ) : null}
        </div>

        {showLike ? (
          <div className="mt-1.5 border-t border-zinc-100 pt-2">
            <button
              type="button"
              disabled={likeBusy || !onToggleLike}
              aria-pressed={likedByMe}
              aria-label={likedByMe ? tx("いいねを解除", "Unlike") : tx("いいね", "Like")}
              className={`inline-flex min-h-9 w-full touch-manipulation items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50 ${
                likedByMe
                  ? "bg-rose-50 text-rose-600"
                  : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100 active:scale-[0.98]"
              }`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleLike?.();
              }}
            >
              <Heart className={`h-3.5 w-3.5 ${likedByMe ? "fill-current" : ""}`} aria-hidden />
              <span>{likeCount}</span>
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
