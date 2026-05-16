import type { Metadata } from "next";
import { ProjectsLinearHome } from "@/components/projects/workspace/ProjectsLinearHome";

export const metadata: Metadata = {
  title: "プロジェクト | moni",
  description: "Linear スタイルのプロジェクトワークスペース",
};

export default function ProjectsPage() {
  return <ProjectsLinearHome />;
}
