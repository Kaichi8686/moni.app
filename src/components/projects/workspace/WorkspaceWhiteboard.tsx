"use client";

import { ProjectWhiteboard } from "@/components/projects/whiteboard/ProjectWhiteboard";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";

export default function WorkspaceWhiteboard() {
  const { projectId, loading, project, uid, canEdit } = useProjectWorkspace();

  if (loading) return <p className="text-sm text-[#6B7280]">読み込み中…</p>;
  if (!project) return <p className="text-sm text-[#6B7280]">プロジェクトがありません。</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <header>
        <h1 className="text-lg font-semibold text-[#1A1A1A]">ホワイトボード</h1>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          GoodNotes風の無限キャンバス。ブレスト・マインドマップ・図を描いて、プロジェクトに残せます。
        </p>
      </header>
      <ProjectWhiteboard projectId={projectId} uid={uid} canEdit={canEdit} />
    </div>
  );
}
