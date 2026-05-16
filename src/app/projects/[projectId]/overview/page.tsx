import type { Metadata } from "next";
import WorkspaceOverview from "@/components/projects/workspace/WorkspaceOverview";

export const metadata: Metadata = {
  title: "Overview | moni",
};

export default function OverviewPage() {
  return <WorkspaceOverview />;
}
