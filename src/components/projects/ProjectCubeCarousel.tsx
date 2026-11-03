"use client";

import dynamic from "next/dynamic";
import type { ProjectRow } from "@/lib/projects/types";

type Props = {
  projects: ProjectRow[];
  currentUserId: string | null;
  joinedIds: Set<string>;
  onCreate: () => void;
  loading?: boolean;
};

const ProjectCubeScene = dynamic(
  () => import("@/components/projects/ProjectCubeScene").then((m) => m.ProjectCubeCarousel),
  {
    ssr: false,
    loading: () => (
      <div className="relative h-full min-h-0 w-full flex-1" aria-busy>
        <div className="projects-soft-lilac-bg absolute inset-0 flex flex-col items-center justify-center">
          <div className="h-[min(48vmin,420px)] w-[min(48vmin,420px)] animate-pulse rounded-3xl bg-violet-100/50" />
          <p className="mt-4 text-xs text-zinc-400">3Dを準備中…</p>
        </div>
      </div>
    ),
  },
);

/** WebGL キューブのエントリ。SSR を避けてクライアントのみ描画する。 */
export function ProjectCubeCarousel(props: Props) {
  return <ProjectCubeScene {...props} />;
}
