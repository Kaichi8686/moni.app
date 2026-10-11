"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { ProjectRow } from "@/lib/projects/types";
import { PROJECT_ICON_BG, projectHashIndex } from "@/lib/projects/projectCardVisual";
import { projectLineShortLabel } from "@/lib/projects/roadmapTemplates";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  project: ProjectRow | null;
  memberCount?: number;
  loading?: boolean;
  onPromptSet?: () => void;
};

export function WorkingOnHero({ project, memberCount = 0, loading, onPromptSet }: Props) {
  const { tx } = useI18n();

  if (loading) {
    return (
      <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-zinc-100">
        <div className="aspect-[16/10] w-full animate-pulse bg-zinc-200/80 sm:aspect-[21/9]" />
      </section>
    );
  }

  if (!project) {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-dashed border-zinc-300/90 bg-gradient-to-br from-[#fff8f4] via-white to-[#f4f7fb] px-5 py-8 sm:px-8 sm:py-10">
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[var(--startup-accent)]/10 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-12 left-8 h-32 w-32 rounded-full bg-sky-400/10 blur-2xl"
          aria-hidden
        />
        <div className="relative max-w-lg">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--startup-accent)]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {tx("取り組み中", "Working on")}
          </p>
          <h2
            className="mt-3 text-2xl leading-tight text-zinc-900 sm:text-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {tx("今、熱心に取り組んでいるプロジェクトを設定しよう", "Set the project you’re most invested in")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            {tx(
              "参加中のプロジェクトのメニューから「取り組み中に設定」を選ぶと、ここに大きく表示されます。",
              "Choose “Set as working on” from a joined project’s menu to feature it here.",
            )}
          </p>
          {onPromptSet ? (
            <button
              type="button"
              onClick={onPromptSet}
              className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              {tx("参加中のプロジェクトを見る", "Browse joined projects")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  const color = PROJECT_ICON_BG[projectHashIndex(project.id, PROJECT_ICON_BG.length)] ?? "bg-zinc-500";
  const thumb = project.thumbnail_url?.trim();
  const category = project.category?.trim() || projectLineShortLabel(project.business_type);

  return (
    <section className="group relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-zinc-900 shadow-[var(--shadow-md)]">
      <div className="relative aspect-[16/10] w-full sm:aspect-[21/9]">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-configured Supabase project image
          <img
            src={thumb}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className={`absolute inset-0 ${color}`}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.28),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(0,0,0,0.25),transparent_50%)]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-6xl font-semibold text-white/90 sm:text-7xl" aria-hidden>
                {(project.icon?.trim() || project.name.trim().charAt(0) || "P").toUpperCase()}
              </span>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
          <span className="inline-flex items-center rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white backdrop-blur-sm">
            {tx("取り組み中", "Working on")}
          </span>
          <h2
            className="mt-2 max-w-2xl text-2xl leading-tight text-white sm:text-3xl md:text-4xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {project.name}
          </h2>
          <p className="mt-1.5 line-clamp-2 max-w-xl text-sm leading-relaxed text-white/85">
            {project.description?.trim() ||
              tx("概要はまだありません。プロジェクトを開いて詳しく見てみましょう。", "No description yet — open the project to explore.")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-white/80">
            {category ? (
              <span className="rounded-md bg-white/12 px-2 py-0.5 backdrop-blur-sm">{category}</span>
            ) : null}
            {memberCount > 0 ? (
              <span className="rounded-md bg-white/12 px-2 py-0.5 backdrop-blur-sm">
                {tx(`${memberCount}人のメンバー`, `${memberCount} members`)}
              </span>
            ) : null}
          </div>
          <Link
            href={`/projects/${project.id}/overview`}
            prefetch
            className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
          >
            {tx("プロジェクトを見る", "View project")}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
