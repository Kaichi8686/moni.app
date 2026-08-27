import type { Metadata } from "next";
import WorkspaceActivity from "@/components/projects/workspace/WorkspaceActivity";

export const metadata: Metadata = {
  title: "活動 | moni",
};

export default function ActivityPage() {
  return <WorkspaceActivity />;
}
