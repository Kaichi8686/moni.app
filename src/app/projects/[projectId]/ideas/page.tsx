import type { Metadata } from "next";
import { Suspense } from "react";
import WorkspaceIdeaVoting from "@/components/projects/workspace/WorkspaceIdeaVoting";
import { WorkspacePageSkeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = {
  title: "投票 | moni",
};

export default function IdeaVotingPage() {
  return (
    <Suspense fallback={<WorkspacePageSkeleton />}>
      <WorkspaceIdeaVoting />
    </Suspense>
  );
}
