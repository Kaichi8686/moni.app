import type { Metadata } from "next";
import WorkspaceVoteCreate from "@/components/projects/workspace/WorkspaceVoteCreate";

export const metadata: Metadata = {
  title: "投票を作成 | moni",
};

export default function IdeaVoteCreatePage() {
  return <WorkspaceVoteCreate />;
}
