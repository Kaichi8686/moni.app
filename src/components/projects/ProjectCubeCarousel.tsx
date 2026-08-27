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
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_50%_40%,#f4f4f5_0%,#ffffff_70%)]">
          <div className="h-[min(48vmin,420px)] w-[min(48vmin,420px)] animate-pulse rounded-3xl bg-zinc-200/70" />
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
