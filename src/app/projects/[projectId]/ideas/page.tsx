import type { Metadata } from "next";
import WorkspaceIdeaVoting from "@/components/projects/workspace/WorkspaceIdeaVoting";

export const metadata: Metadata = {
  title: "投票 | moni",
};

export default function IdeaVotingPage() {
  return <WorkspaceIdeaVoting />;
}
