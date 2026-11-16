"use client";

import { useRouter } from "next/navigation";
import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { ProjectSettingsModal } from "@/components/projects/workspace/ProjectSettingsModal";
import { WorkspacePageSkeleton } from "@/components/ui/Skeleton";
import { closeWorkspacePanel } from "@/lib/workspace/closeWorkspacePanel";

export default function WorkspaceSettingsPage() {
  const router = useRouter();
  const {
    project,
    projectId,
    projectMeta,
    coachingContext,
    uid,
    canEdit,
    isOwner,
    loading,
    reload,
  } = useProjectWorkspace();

  if (loading) return <WorkspacePageSkeleton />;

  return (
    <ProjectSettingsModal
      open
      projectId={projectId}
      userId={uid}
      canEdit={canEdit}
      isOwner={isOwner}
      name={project?.name ?? ""}
      description={project?.description}
      coachingContext={coachingContext}
      meta={projectMeta}
      onClose={() => closeWorkspacePanel(router, projectId)}
      onSaved={() => void reload()}
      onNotice={() => undefined}
    />
  );
}
