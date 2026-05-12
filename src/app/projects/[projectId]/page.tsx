import type { Metadata } from "next";
import { ProjectSpaceDetail } from "@/components/projects/ProjectSpaceDetail";

export const metadata: Metadata = {
  title: "プロジェクト詳細 | moni",
};

type Props = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectDetailPage({ params }: Props) {
  const { projectId } = await params;
  return <ProjectSpaceDetail projectId={projectId} />;
}
