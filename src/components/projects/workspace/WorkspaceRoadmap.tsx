"use client";

import { useProjectWorkspace } from "@/components/projects/workspace/ProjectWorkspaceContext";
import { WorkspaceSchedulePanel } from "@/components/projects/workspace/WorkspaceSchedulePanel";

export default function WorkspaceRoadmap() {
  const { projectId } = useProjectWorkspace();
  return <WorkspaceSchedulePanel projectId={projectId} variant="full" />;
}
