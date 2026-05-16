import type { Metadata } from "next";
import WorkspaceIssues from "@/components/projects/workspace/WorkspaceIssues";

export const metadata: Metadata = {
  title: "課題 | moni",
};

export default function IssuesPage() {
  return <WorkspaceIssues />;
}
