"use client";

import { Suspense } from "react";
import { RoadmapMapEditor } from "@/components/projects/workspace/roadmap/RoadmapMapEditor";
import { WorkspacePageSkeleton } from "@/components/ui/Skeleton";

export default function WorkspaceRoadmap() {
  return (
    <Suspense fallback={<WorkspacePageSkeleton className="p-6" />}>
      <RoadmapMapEditor />
    </Suspense>
  );
}
