import type { Metadata } from "next";
import { ProjectsHomeView } from "@/components/projects/ProjectsHomeView";

export const metadata: Metadata = {
  title: "プロジェクト | moni",
  description: "プロジェクトの一覧・進捗・ロードマップ・課題をまとめて管理します。",
};

export default function ProjectsPage() {
  return <ProjectsHomeView />;
}
