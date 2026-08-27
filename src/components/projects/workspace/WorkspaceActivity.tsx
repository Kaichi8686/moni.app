"use client";

import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { TeamActivityFeed } from "@/components/projects/workspace/TeamActivityFeed";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function WorkspaceActivity() {
  const { tx } = useI18n();
  const { projectId, loading } = useProjectWorkspace();

  if (loading) return <p className="text-sm text-[#6B7280]">{tx("読み込み中…", "Loading…")}</p>;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header>
        <h1 className="text-lg font-semibold text-[#1A1A1A]">{tx("活動", "Activity")}</h1>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          {tx("メンバーの最近の更新や進捗を時系列で確認できます。", "Recent member updates and progress, in order.")}
        </p>
      </header>
      <TeamActivityFeed projectId={projectId} fullPage />
    </div>
  );
}
