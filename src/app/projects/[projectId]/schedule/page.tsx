import type { Metadata } from "next";
import WorkspaceSchedule from "@/components/projects/workspace/WorkspaceSchedule";

export const metadata: Metadata = {
  title: "予定 | moni",
};

export default function SchedulePage() {
  return <WorkspaceSchedule />;
}
