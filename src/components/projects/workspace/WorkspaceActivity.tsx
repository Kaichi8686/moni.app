"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { TeamActivityFeed } from "@/components/projects/workspace/TeamActivityFeed";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { WorkspacePageSkeleton } from "@/components/ui/Skeleton";

export default function WorkspaceActivity() {
  const { tx } = useI18n();
  const router = useRouter();
  const { projectId, loading } = useProjectWorkspace();

  if (loading) return <WorkspacePageSkeleton />;

  return (
    <div className="relative min-h-[100dvh] w-full bg-white">
      <button
        type="button"
        onClick={() => router.push(`/projects/${projectId}/overview`)}
        className="fixed left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-800 shadow-sm transition hover:bg-zinc-50 active:scale-95"
        aria-label={tx("戻る", "Back")}
      >
        <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
      </button>

      <div className="mx-auto w-full max-w-xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[calc(3.5rem+env(safe-area-inset-top))]">
        <header className="mb-2">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">{tx("活動", "Activity")}</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
            {tx(
              "メンバーの参加・課題の完了・ロードマップ達成を時系列で確認できます。",
              "Member joins, completed issues, and roadmap achievements — in order.",
            )}
          </p>
        </header>
        <TeamActivityFeed projectId={projectId} fullPage />
      </div>
    </div>
  );
}
