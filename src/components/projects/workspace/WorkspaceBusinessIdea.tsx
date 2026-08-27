"use client";

import { IdeaInterviewApp } from "@/components/idea-interview/IdeaInterviewApp";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function WorkspaceBusinessIdea() {
  const { tx } = useI18n();
  const { projectId, loading, project } = useProjectWorkspace();

  if (loading) {
    return <p className="text-sm text-[#6B7280]">{tx("読み込み中…", "Loading…")}</p>;
  }
  if (!project) {
    return <p className="text-sm text-[#6B7280]">{tx("プロジェクトがありません。", "No project found.")}</p>;
  }

  return (
    <div className="-mx-1 overflow-hidden rounded-xl border border-zinc-200 bg-white sm:-mx-0">
      <IdeaInterviewApp variant="project" projectId={projectId} />
    </div>
  );
}
