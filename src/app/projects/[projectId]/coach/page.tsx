import type { Metadata } from "next";
import WorkspaceCoach from "@/components/projects/workspace/WorkspaceCoach";

export const metadata: Metadata = {
  title: "AI | moni",
};

export default function CoachPage() {
  return <WorkspaceCoach />;
}
