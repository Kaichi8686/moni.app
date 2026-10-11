"use client";

import { useState } from "react";
import { ProjectTalentPanel } from "@/components/projects/ProjectTalentPanel";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function WorkspaceRecruit() {
  const { tx } = useI18n();
  const { project, projectMeta, projectId, loading, uid, canEdit, reload } = useProjectWorkspace();
  const [notice, setNotice] = useState("");

  if (loading) return <p className="text-sm text-zinc-500">{tx("読み込み中…", "Loading…")}</p>;
  if (!project) return <p className="text-sm text-zinc-500">{tx("プロジェクトがありません。", "No project found.")}</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      {notice ? (
        <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-800">
          {notice}
        </p>
      ) : null}
      <ProjectTalentPanel
        projectId={projectId}
        projectName={project.name}
        userId={uid}
        canEdit={canEdit}
        recruitmentTarget={projectMeta?.recruitment_target ?? ""}
        recruitmentMessage={projectMeta?.recruitment_message ?? ""}
        visibility={projectMeta?.visibility === "private" ? "private" : "public"}
        onRecruitmentSaved={() => {
          void reload();
        }}
        onNotice={(message) => {
          setNotice(message);
          window.setTimeout(() => setNotice(""), 4200);
        }}
      />
    </div>
  );
}
