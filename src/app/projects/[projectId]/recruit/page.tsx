import type { Metadata } from "next";
import WorkspaceRecruit from "@/components/projects/workspace/WorkspaceRecruit";

export const metadata: Metadata = {
  title: "募集 | moni",
};

export default function RecruitPage() {
  return <WorkspaceRecruit />;
}
