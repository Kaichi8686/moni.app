import type { Metadata } from "next";
import WorkspaceMembers from "@/components/projects/workspace/WorkspaceMembers";

export const metadata: Metadata = {
  title: "メンバー | moni",
};

export default function MembersPage() {
  return <WorkspaceMembers />;
}
