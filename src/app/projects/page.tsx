import type { Metadata } from "next";
import { ProjectsHomeView } from "@/components/projects/ProjectsHomeView";

export const metadata: Metadata = {
  title: "プロジェクト | moni",
  description: "学生向けプロジェクト作成・参加・共同実行スペース",
};

export default function ProjectsPage() {
  return <ProjectsHomeView />;
}
