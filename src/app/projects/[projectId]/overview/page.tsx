import type { Metadata } from "next";
import { Suspense } from "react";
import WorkspaceOverview from "@/components/projects/workspace/WorkspaceOverview";
import { WorkspacePageSkeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = {
  title: "概要 | moni",
};

export default function OverviewPage() {
  return (
    <Suspense fallback={<WorkspacePageSkeleton className="p-6" />}>
      <WorkspaceOverview />
    </Suspense>
  );
}
