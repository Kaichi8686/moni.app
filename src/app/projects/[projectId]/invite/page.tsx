import type { Metadata } from "next";
import WorkspaceInvite from "@/components/projects/workspace/WorkspaceInvite";

export const metadata: Metadata = {
  title: "メンバーを招待 | moni",
};

export default function InvitePage() {
  return <WorkspaceInvite />;
}
