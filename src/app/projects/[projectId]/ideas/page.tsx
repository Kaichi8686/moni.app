import type { Metadata } from "next";
import { Suspense } from "react";
import WorkspaceIdeaVoting from "@/components/projects/workspace/WorkspaceIdeaVoting";

export const metadata: Metadata = {
  title: "投票 | moni",
};

export default function IdeaVotingPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[#6B7280]">読み込み中…</p>}>
      <WorkspaceIdeaVoting />
    </Suspense>
  );
}
