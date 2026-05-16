import type { ReactNode } from "react";
import { ProjectWorkspaceProvider } from "@/components/projects/workspace/ProjectWorkspaceContext";

export default async function ProjectWorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ProjectWorkspaceProvider projectId={projectId}>{children}</ProjectWorkspaceProvider>;
}
