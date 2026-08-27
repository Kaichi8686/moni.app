"use client";

import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { ProfileProjectHighlight } from "@/lib/profile/types";

type Props = {
  projects: ProfileProjectHighlight[];
  isOwnProfile: boolean;
};

export function StoryHighlights({ projects, isOwnProfile }: Props) {
  const { tx } = useI18n();

  const roleLabel = (role: string | undefined) => {
    if (role === "owner") return tx("オーナー", "Owner");
    if (role === "admin") return tx("管理者", "Admin");
    return tx("メンバー", "Member");
  };

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-500">
          <FolderKanban className="h-5 w-5" aria-hidden />
        </div>
        <p className="text-[15px] font-semibold tracking-tight text-zinc-900">
          {tx("プロジェクトはまだありません", "No projects yet")}
        </p>
        <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-zinc-500">
          {isOwnProfile
            ? tx("企画を始めると、ここに進捗と役割が表示されます。", "Start a project and your progress and role will show up here.")
            : tx("このユーザーの参加プロジェクトはまだありません。", "This user hasn’t joined any projects yet.")}
        </p>
        {isOwnProfile ? (
          <Link
            href="/projects"
            className="mt-5 inline-flex min-h-[40px] items-center rounded-lg bg-zinc-900 px-4 text-[13px] font-semibold text-white transition hover:bg-zinc-800"
          >
            {tx("プロジェクトを探す / 作る", "Find or create a project")}
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="bg-white px-4 py-4 sm:px-5">
      <div className="mb-3">
        <h2 className="text-[13px] font-semibold tracking-tight text-zinc-900">
          {tx("参加プロジェクト", "Projects")}
        </h2>
        <p className="mt-0.5 text-[12px] text-zinc-500">{tx("いま関わっている企画", "Projects you’re part of")}</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3.5 py-3 transition hover:border-zinc-300"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-900 text-[13px] font-bold text-white">
              {(project.name.trim().charAt(0) || "?").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold tracking-tight text-zinc-900">{project.name}</p>
              <p className="mt-0.5 truncate text-[12px] text-zinc-500">
                {roleLabel(project.role)}
                {project.description ? ` · ${project.description}` : ""}
              </p>
            </div>
          </Link>
        ))}
        {isOwnProfile ? (
          <Link
            href="/projects"
            className="flex min-h-[40px] items-center justify-center rounded-xl border border-dashed border-zinc-300 px-3 py-2.5 text-[12px] font-semibold text-zinc-500 transition hover:bg-zinc-50"
          >
            {tx("プロジェクトを見る / 作る", "Browse or create projects")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
