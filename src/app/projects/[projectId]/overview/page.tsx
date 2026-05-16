import type { Metadata } from "next";
import WorkspaceOverview from "@/components/projects/workspace/WorkspaceOverview";

export const metadata: Metadata = {
  title: "概要 | moni",
};

export default function OverviewPage() {
  return <WorkspaceOverview />;
}
